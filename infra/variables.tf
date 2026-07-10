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
