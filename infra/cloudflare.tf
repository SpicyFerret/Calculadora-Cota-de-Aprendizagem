# Projeto Pages em modo direct upload — o deploy dos arquivos é feito
# pelo wrangler no workflow deploy-pages.yml.
resource "cloudflare_pages_project" "cota_aprendiz" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = "main"
}

# Domínio customizado (opcional): definido pela variável dominio_site.
resource "cloudflare_pages_domain" "dominio" {
  count        = var.dominio_site == "" ? 0 : 1
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.cota_aprendiz.name
  domain       = var.dominio_site
}

resource "cloudflare_record" "dominio" {
  count   = var.dominio_site != "" && var.cloudflare_zone_id != "" ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.dominio_site
  type    = "CNAME"
  content = "${cloudflare_pages_project.cota_aprendiz.name}.pages.dev"
  proxied = true
}

output "pages_url" {
  value = var.dominio_site != "" ? "https://${var.dominio_site}" : "https://${cloudflare_pages_project.cota_aprendiz.name}.pages.dev"
}
