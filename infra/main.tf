terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # bucket/key/region informados via -backend-config (ver .github/workflows/tofu.yml)
  backend "s3" {
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      projeto    = "cota-aprendiz"
      gerenciado = "opentofu"
    }
  }
}

# Token lido da variável de ambiente CLOUDFLARE_API_TOKEN
provider "cloudflare" {}
