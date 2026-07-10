# Bootstrap — aplicar UMA vez, localmente, com credenciais AWS de admin:
#   cd infra/bootstrap
#   tofu init && tofu apply -var "github_repo=usuario/repositorio"
#
# Cria o provider OIDC e a role que o GitHub Actions assume (sem chaves de
# longa duração). O bucket do estado NÃO é criado aqui: o workflow tofu.yml
# calcula o nome determinístico (org-repo-conta-regiao-tf-state) e cria o
# bucket na primeira execução, se não existir. O estado deste bootstrap é local.

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

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "atual" {}

locals {
  # Mesmo nome calculado pelo workflow: org-repo-conta-regiao-tf-state,
  # minúsculo, com / _ . trocados por hífen, truncado em 63 caracteres.
  nome_bucket_estado = substr(
    replace(
      replace(
        replace(
          lower("${var.github_repo}-${data.aws_caller_identity.atual.account_id}-${var.aws_region}-tf-state"),
          "/", "-"
        ),
        "_", "-"
      ),
      ".", "-"
    ),
    0, 63
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

import {
  to = aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::${data.aws_caller_identity.atual.account_id}:oidc-provider/token.actions.githubusercontent.com"
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

# Permissões da role em arquivo JSON versionado (permissoes-github-actions.json.tftpl)
resource "aws_iam_role_policy" "github_actions" {
  name = "permissoes"
  role = aws_iam_role.github_actions.id
  policy = templatefile("${path.module}/permissoes-github-actions.json.tftpl", {
    bucket_arn = "arn:aws:s3:::${local.nome_bucket_estado}"
  })
}

output "aws_role_arn" {
  description = "Colocar no secret AWS_ROLE_ARN do repositório"
  value       = aws_iam_role.github_actions.arn
}

output "bucket_estado" {
  description = "Nome do bucket que o workflow criará/usará para o estado"
  value       = local.nome_bucket_estado
}
