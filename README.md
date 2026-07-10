# Calculadora de Cota de Aprendizagem

App web que calcula a **cota de aprendizagem** de uma empresa (CLT art. 429 + Decreto 9.579/2018):
informe o quadro de funcionários por CBO — por formulário ou importando CSV/XLSX — e veja quantos
aprendizes a empresa deve contratar (mínimo 5%, máximo 15% da base, frações arredondadas para cima).

## Como funciona

```
EventBridge (cron 03:00 UTC = meia-noite BRT)
  └─> Lambda Python (scraper/scraper.py)
        ├─ baixa o CSV oficial da CBO (gov.br/trabalho-e-emprego, URL direta)
        ├─ gera app/public/data/cbo.json
        └─ se mudou: commita via API do GitHub
              └─> push dispara o GitHub Actions
                    └─> testes + build Angular + deploy no Cloudflare Pages
```

- **App** (`app/`): Angular 22 + Angular Material (tema Cyan & Orange, claro/escuro), 100% estático.
  A base CBO (~2.700 ocupações) fica embutida como asset — sem backend em runtime.
  Suporta **múltiplos estabelecimentos** (matriz/filiais): a cota é apurada por CNPJ, tanto no
  formulário (um retângulo por filial, com campo de CNPJ opcional) quanto na importação
  (coluna `CNPJ` opcional). O resultado avisa déficit, isenção (base < 7) e **extrapolação da
  cota máxima de 15%**.
- **Classificação**: entra na base quem está nos Grandes Grupos 4–9 da CBO; ficam fora GG 0
  (militares), 1 (direção/gerência), 2 (nível superior) e 3 (técnicos), além de aprendizes,
  estagiários e exclusões manuais (cargos de confiança). Consulta ao site do MTE não é feita em
  tempo real: o site não envia CORS, não tem HTTPS válido e o download oficial exige captcha —
  por isso a base é atualizada diariamente pelo scraper a partir da URL direta do gov.br.
- **Scraper** (`scraper/`): Python 3.12, só stdlib. Rode local com
  `python scraper/scraper.py --local` para (re)gerar o `cbo.json`.
- **Infra** (`infra/`): OpenTofu — Lambda + EventBridge + SSM (token do GitHub) + projeto
  Cloudflare Pages. Estado no S3.
- **CI/CD** (`.github/workflows/`): deploys separados por branch —
  `deploy-pages.yml` roda em push na **`main`** (testes, build e deploy do app; é o que o commit
  do bot dispara) e `tofu.yml` roda em push na branch **`infra`** (plan/apply via OIDC, sem
  chaves de longa duração; PRs mostram só o plan). Assim, o commit noturno do scraper na main
  nunca mexe na infraestrutura.

## Desenvolvimento local

```bash
cd app
npm ci
npm start        # http://localhost:4200
npm test         # testes unitários (vitest)
npm run build    # build de produção em dist/cota-aprendiz/browser
```

## Configuração do deploy (uma vez)

1. **Bootstrap AWS** (cria o provider OIDC + a role para o GitHub Actions; as permissões da
   role estão em [permissoes-github-actions.json.tftpl](infra/bootstrap/permissoes-github-actions.json.tftpl)):

   ```bash
   cd infra/bootstrap
   tofu init
   tofu apply -var "github_repo=SEU_USUARIO/SEU_REPO"
   ```

   Anote a saída `aws_role_arn`. O bucket do estado **não precisa ser criado**: o workflow
   calcula o nome determinístico `org-repo-contaAWS-regiao-tf-state` e cria o bucket na
   primeira execução, se não existir.

2. **PAT do GitHub para a Lambda**: crie um fine-grained PAT com permissão `Contents: Read and write`
   **apenas neste repositório** (a Lambda usa para commitar o `cbo.json`).

3. **Secrets do repositório** (Settings → Secrets and variables → Actions → *Secrets*):

   | Secret | Valor |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Token da Cloudflare com permissão *Cloudflare Pages: Edit* (+ *DNS: Edit* se usar domínio próprio) |
   | `CLOUDFLARE_ACCOUNT_ID` | Account ID da Cloudflare |
   | `CLOUDFLARE_ZONE_ID` | (opcional) Zone ID do domínio, para criar o CNAME do domínio próprio |
   | `AWS_ROLE_ARN` | Saída `aws_role_arn` do bootstrap |
   | `GH_PAT_CBO_BOT` | O PAT do passo 2 |

   E em *Variables*:

   | Variable | Valor |
   |---|---|
   | `AWS_REGION` | (opcional) região AWS — padrão `sa-east-1` |
   | `DOMINIO_SITE` | (opcional) domínio próprio do site, ex.: `cota.exemplo.com.br` |

4. Crie a branch **`infra`** e faça push nela: o `tofu.yml` cria o bucket de estado (se
   preciso) e provisiona Lambda/EventBridge/Pages. Push na **`main`** com mudanças em `app/**`
   dispara o `deploy-pages.yml`, que publica o site em `https://cota-aprendiz.pages.dev`
   (ou no `DOMINIO_SITE`, se definido).

Para testar a Lambda sem esperar a meia-noite:
`aws lambda invoke --function-name cota-aprendiz-atualiza-cbo /dev/stdout`

## Aviso legal

O resultado é uma **estimativa** com base na CLT art. 429 e no Decreto 9.579/2018 (art. 52).
A obrigação só existe quando o estabelecimento tem **7 ou mais funcionários** em funções que
entram na base de cálculo — com menos, a contratação é facultativa. Microempresas, empresas de
pequeno porte e entidades sem fins lucrativos que tenham por objetivo a educação profissional
são dispensadas da contratação obrigatória. O cálculo é por
estabelecimento (CNPJ). Não substitui orientação jurídica nem a fiscalização do trabalho.
