# Bootstrap — aplicar UMA vez, localmente, com credenciais AWS de admin:
#   cd infra/bootstrap
#   tofu init && tofu apply -var "github_repo=usuario/repositorio" -var "state_bucket=NOME-UNICO"
#
# Cria o bucket de estado e a role OIDC que o GitHub Actions assume
# (sem chaves de longa duração). O estado deste bootstrap fica local.

terraform {
  required_version = ">= 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "sa-east-1"
}

variable "github_repo" {
  description = "Repositório GitHub no formato usuario/repositorio"
  type        = string
}

variable "state_bucket" {
  description = "Nome (globalmente único) do bucket S3 para o estado do Tofu"
  type        = string
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "estado" {
  bucket = var.state_bucket
}

resource "aws_s3_bucket_versioning" "estado" {
  bucket = aws_s3_bucket.estado.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "estado" {
  bucket                  = aws_s3_bucket.estado.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "cota-aprendiz-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_permissoes" {
  statement {
    sid = "Estado"
    actions = [
      "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.estado.arn,
      "${aws_s3_bucket.estado.arn}/*",
    ]
  }

  statement {
    sid = "GerenciarInfra"
    actions = [
      "lambda:*",
      "events:*",
      "logs:*",
      "ssm:GetParameter", "ssm:GetParameters", "ssm:PutParameter",
      "ssm:DeleteParameter", "ssm:DescribeParameters", "ssm:AddTagsToResource",
      "ssm:ListTagsForResource",
      "iam:GetRole", "iam:CreateRole", "iam:DeleteRole", "iam:UpdateRole",
      "iam:PassRole", "iam:TagRole", "iam:ListRolePolicies", "iam:GetRolePolicy",
      "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "kms:DescribeKey",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions" {
  name   = "permissoes"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_permissoes.json
}

output "aws_role_arn" {
  description = "Colocar no secret AWS_ROLE_ARN do repositório"
  value       = aws_iam_role.github_actions.arn
}

output "tf_state_bucket" {
  description = "Colocar na variable TF_STATE_BUCKET do repositório"
  value       = aws_s3_bucket.estado.bucket
}
