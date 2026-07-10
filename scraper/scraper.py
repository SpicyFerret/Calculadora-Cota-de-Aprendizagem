"""Atualiza a base CBO do app a partir da fonte oficial do MTE (gov.br).

Fonte: CSV "cbo2002-ocupacao.csv" publicado pelo Ministério do Trabalho e
Emprego em https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads
(URL direta, HTTPS, sem captcha — ao contrário do mtecbo.gov.br, cujo download
exige reCAPTCHA e portanto não é automatizável).

Modos de execução:
  - Lambda: handler(event, context) — compara com o cbo.json atual no GitHub e,
    se as ocupações mudaram, commita via API de conteúdo (dispara o deploy).
  - Local:  python scraper.py --local — escreve app/src/assets/data/cbo.json.
"""

import base64
import csv
import io
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

CSV_URL = (
    "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/"
    "servicos/downloads/cbo2002-ocupacao.csv"
)
FONTE = "Ministério do Trabalho e Emprego — CBO 2002 (gov.br/trabalho-e-emprego)"
USER_AGENT = "cota-aprendiz-bot/1.0 (atualizacao da base CBO; uso educacional)"

# Guardas de sanidade: a base tem ~2.700 ocupações; um download quebrado
# (página de erro, arquivo truncado) não pode substituir uma base boa.
MIN_OCUPACOES = 2000
ARQUIVO_JSON = "app/public/data/cbo.json"

GITHUB_API = "https://api.github.com"


def baixar_ocupacoes() -> list[dict]:
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        conteudo = resp.read().decode("latin-1")

    leitor = csv.DictReader(io.StringIO(conteudo), delimiter=";")
    ocupacoes = []
    for linha in leitor:
        codigo = (linha.get("CODIGO") or "").strip()
        titulo = (linha.get("TITULO") or "").strip()
        if not codigo and not titulo:
            continue
        if not (codigo.isdigit() and len(codigo) == 6):
            raise ValueError(f"Código CBO inesperado no CSV: {codigo!r}")
        if not titulo:
            raise ValueError(f"Título vazio para o código {codigo}")
        ocupacoes.append({"codigo": codigo, "titulo": titulo})

    if len(ocupacoes) < MIN_OCUPACOES:
        raise ValueError(
            f"CSV retornou só {len(ocupacoes)} ocupações (mínimo {MIN_OCUPACOES}); "
            "download possivelmente quebrado — abortando sem alterar a base."
        )
    ocupacoes.sort(key=lambda o: o["codigo"])
    return ocupacoes


def montar_json(ocupacoes: list[dict], gerado_em: str) -> str:
    doc = {"geradoEm": gerado_em, "fonte": FONTE, "ocupacoes": ocupacoes}
    return json.dumps(doc, ensure_ascii=False, indent=1) + "\n"


def _github(metodo: str, url: str, token: str, corpo: dict | None = None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(
        url,
        data=dados,
        method=metodo,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def publicar_no_github(ocupacoes: list[dict], repo: str, branch: str, token: str) -> str:
    url = f"{GITHUB_API}/repos/{repo}/contents/{ARQUIVO_JSON}?ref={branch}"
    sha_atual = None
    ocupacoes_atuais = None
    try:
        atual = _github("GET", url, token)
        sha_atual = atual["sha"]
        texto = base64.b64decode(atual["content"]).decode("utf-8")
        ocupacoes_atuais = json.loads(texto).get("ocupacoes")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    # geradoEm marca a última MUDANÇA de dados; comparar só as ocupações
    # evita um commit (e um deploy) por noite quando nada mudou.
    if ocupacoes_atuais == ocupacoes:
        return "sem-mudancas"

    novo = montar_json(ocupacoes, date.today().isoformat())
    corpo = {
        "message": f"chore: atualiza base CBO ({len(ocupacoes)} ocupações) [bot]",
        "content": base64.b64encode(novo.encode()).decode(),
        "branch": branch,
    }
    if sha_atual:
        corpo["sha"] = sha_atual
    _github("PUT", f"{GITHUB_API}/repos/{repo}/contents/{ARQUIVO_JSON}", token, corpo)
    return "atualizado"


def _token_do_ssm() -> str:
    import boto3  # disponível no runtime da Lambda

    nome = os.environ["GITHUB_TOKEN_PARAM"]
    ssm = boto3.client("ssm")
    return ssm.get_parameter(Name=nome, WithDecryption=True)["Parameter"]["Value"]


def handler(event, context):
    repo = os.environ["GITHUB_REPO"]  # ex.: "usuario/repositorio"
    branch = os.environ.get("GITHUB_BRANCH", "main")
    token = _token_do_ssm()

    ocupacoes = baixar_ocupacoes()
    resultado = publicar_no_github(ocupacoes, repo, branch, token)
    msg = f"{resultado}: {len(ocupacoes)} ocupações em {datetime.now(timezone.utc).isoformat()}"
    print(msg)
    return {"resultado": resultado, "ocupacoes": len(ocupacoes)}


def main_local():
    destino = Path(__file__).resolve().parent.parent / ARQUIVO_JSON
    ocupacoes = baixar_ocupacoes()

    gerado_em = date.today().isoformat()
    if destino.exists():
        atual = json.loads(destino.read_text(encoding="utf-8"))
        if atual.get("ocupacoes") == ocupacoes:
            print(f"Sem mudanças ({len(ocupacoes)} ocupações); {destino} mantido.")
            return
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(montar_json(ocupacoes, gerado_em), encoding="utf-8", newline="\n")
    print(f"Gravado {destino} com {len(ocupacoes)} ocupações.")


if __name__ == "__main__":
    if "--local" in sys.argv:
        main_local()
    else:
        print("Uso: python scraper.py --local  (fora da Lambda)")
        sys.exit(2)
