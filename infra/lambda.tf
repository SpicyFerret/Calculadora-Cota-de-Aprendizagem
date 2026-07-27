# boto3 já existe no runtime, mas requests/beautifulsoup4 (consulta ao vivo
# em cbo.mte.gov.br) não — precisam ser vendorados no zip. O tofu apply roda
# no runner do GitHub Actions (Linux), daí o local-exec assumir um shell
# POSIX com python/pip disponíveis.
resource "null_resource" "pacote_scraper" {
  triggers = {
    requirements_hash = filemd5("${path.module}/../scraper/requirements.txt")
    scraper_hash      = filemd5("${path.module}/../scraper/scraper.py")
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      rm -rf "${path.module}/build/package"
      mkdir -p "${path.module}/build/package"
      pip install -r "${path.module}/../scraper/requirements.txt" -t "${path.module}/build/package" --upgrade
      cp "${path.module}/../scraper/scraper.py" "${path.module}/build/package/"
    EOT
  }
}

data "archive_file" "scraper" {
  type        = "zip"
  source_dir  = "${path.module}/build/package"
  output_path = "${path.module}/build/scraper.zip"
  depends_on  = [null_resource.pacote_scraper]
}

resource "aws_lambda_function" "atualiza_cbo" {
  function_name = "cota-aprendiz-atualiza-cbo"
  description   = "Baixa a base CBO oficial (gov.br) e commita cbo.json no GitHub quando há mudanças"

  filename         = data.archive_file.scraper.output_path
  source_code_hash = data.archive_file.scraper.output_base64sha256

  runtime = "python3.12"
  handler = "scraper.handler"
  # Testado com 256MB: rodou os ~624 lookups em cbo.mte.gov.br (6 sessões em
  # paralelo) sem estourar memória (~143MB usados) mas estourou os 180s de
  # timeout mesmo assim — na Lambda a CPU escala com a memória, e o TLS de 6
  # handshakes simultâneos (mais o overhead do SECLEVEL=1 legado) é sensível a
  # isso, mesmo sendo um trabalho "de rede". 1024MB dá a mesma CPU que era
  # usada na época do parsing de PDF; timeout generoso cobre a variação real
  # observada em produção, bem acima do ~1min medido localmente (que tinha CPU
  # de notebook inteira à disposição).
  timeout       = 300
  memory_size   = 1024
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
