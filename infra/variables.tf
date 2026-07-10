variable "aws_region" {
  description = "Região AWS dos recursos"
  type        = string
  default     = "sa-east-1"
}

variable "github_repo" {
  description = "Repositório GitHub no formato usuario/repositorio"
  type        = string
}

variable "github_branch" {
  description = "Branch onde a base CBO é commitada"
  type        = string
  default     = "main"
}

variable "github_pat" {
  description = "Fine-grained PAT do GitHub com contents:write apenas neste repositório (usado pela Lambda para commitar a base CBO)"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Account ID da Cloudflare (para o projeto Pages)"
  type        = string
}

variable "pages_project_name" {
  description = "Nome do projeto no Cloudflare Pages"
  type        = string
  default     = "cota-aprendiz"
}

variable "dominio_site" {
  description = "Domínio customizado do site no Cloudflare Pages (ex.: cota.exemplo.com.br); vazio = usa apenas <projeto>.pages.dev"
  type        = string
  default     = ""
}

variable "cloudflare_zone_id" {
  description = "Zone ID da Cloudflare do domínio (necessário para criar o registro DNS quando dominio_site é definido)"
  type        = string
  default     = ""
}
