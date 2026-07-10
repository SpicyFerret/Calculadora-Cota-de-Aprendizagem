# Projeto Pages em modo direct upload — o deploy dos arquivos é feito
# pelo wrangler no workflow deploy-pages.yml.
resource "cloudflare_pages_project" "cota_aprendiz" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = "main"
}

output "pages_url" {
  value = "https://${cloudflare_pages_project.cota_aprendiz.name}.pages.dev"
}
