# O scraper usa apenas a stdlib do Python (boto3 já existe no runtime),
# então o zip é montado pelo próprio Tofu, sem etapa de pip install.
data "archive_file" "scraper" {
  type        = "zip"
  source_file = "${path.module}/../scraper/scraper.py"
  output_path = "${path.module}/build/scraper.zip"
}

resource "aws_lambda_function" "atualiza_cbo" {
  function_name = "cota-aprendiz-atualiza-cbo"
  description   = "Baixa a base CBO oficial (gov.br) e commita cbo.json no GitHub quando há mudanças"

  filename         = data.archive_file.scraper.output_path
  source_code_hash = data.archive_file.scraper.output_base64sha256

  runtime       = "python3.12"
  handler       = "scraper.handler"
  timeout       = 120
  memory_size   = 256
  architectures = ["arm64"]

  environment {
    variables = {
      GITHUB_REPO        = var.github_repo
      GITHUB_BRANCH      = var.github_branch
      GITHUB_TOKEN_PARAM = aws_ssm_parameter.github_pat.name
    }
  }

  role = aws_iam_role.lambda_atualiza_cbo.arn
}

resource "aws_cloudwatch_log_group" "atualiza_cbo" {
  name              = "/aws/lambda/${aws_lambda_function.atualiza_cbo.function_name}"
  retention_in_days = 30
}

resource "aws_ssm_parameter" "github_pat" {
  name        = "/cota-aprendiz/github-pat"
  description = "PAT do GitHub usado pela Lambda para commitar a base CBO"
  type        = "SecureString"
  value       = var.github_pat
}
