# boto3 já existe no runtime, mas pypdf (leitura dos Livros da CBO em PDF) não
# — precisa ser vendorado no zip. O tofu apply roda no runner do GitHub Actions
# (Linux), daí o local-exec assumir um shell POSIX com python/pip disponíveis.
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
  # Medido localmente: baixar (~4s) + fazer parsing em Python puro (pypdf) dos
  # ~17MB dos Livros 1 e 2 leva ~20s de CPU num notebook. Na Lambda, CPU escala
  # com a memória (1024MB ≈ meio vCPU) — 512MB deixaria pouca folga. memory_size
  # mais alto tende a sair de custo parecido (menos GB-segundo por rodar mais
  # rápido); timeout generoso cobre variação de rede até o gov.br.
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
