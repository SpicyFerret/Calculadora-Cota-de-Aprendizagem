data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_atualiza_cbo" {
  name               = "cota-aprendiz-lambda-atualiza-cbo"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_permissoes" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.atualiza_cbo.arn}:*"]
  }

  statement {
    sid       = "LerTokenGitHub"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.github_pat.arn]
  }

  # SecureString usa a chave gerenciada aws/ssm; o decrypt passa pelo serviço SSM
  statement {
    sid       = "DecryptViaSSM"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda_atualiza_cbo" {
  name   = "permissoes"
  role   = aws_iam_role.lambda_atualiza_cbo.id
  policy = data.aws_iam_policy_document.lambda_permissoes.json
}
