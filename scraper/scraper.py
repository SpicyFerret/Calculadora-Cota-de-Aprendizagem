"""Atualiza a base CBO do app a partir da fonte oficial do MTE (gov.br).

Fontes, ambas em https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads
(HTTPS direto, sem captcha — ao contrário do mtecbo.gov.br, cujo fluxo de busca
por família exige sessão/ViewState JSF instável demais para rodar em Lambda):
  - CSV "cbo2002-ocupacao.csv": código e título de cada ocupação.
  - Livros 1 e 2 ("Códigos, Títulos e Descrições", PDF): a ficha de cada família
    ocupacional, cujo texto declara explicitamente se ela demanda formação
    profissional "para efeitos do cálculo do número de aprendizes [...] nos
    termos do artigo 429 [...] CLT" — esse é o critério real usado pelo MTE,
    mais preciso que inferir pelo Grande Grupo (1º dígito do código). Famílias
    ausentes dos livros (edições novas da CBO ainda não impressas) caem no
    fallback por Grande Grupo, com aviso no log.

Modos de execução:
  - Lambda: handler(event, context) — compara com o cbo.json atual no GitHub e,
    se as ocupações mudaram, commita via API de conteúdo (dispara o deploy).
  - Local:  python scraper.py --local — escreve app/src/assets/data/cbo.json.
"""

import base64
import bisect
import csv
import io
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from pypdf import PdfReader

DOWNLOADS = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads"
CSV_URL = f"{DOWNLOADS}/cbo2002-ocupacao.csv"
LIVROS_URL = [f"{DOWNLOADS}/livro-1-portal-cbo.pdf", f"{DOWNLOADS}/cbo2002_liv2.pdf"]
FONTE = (
    "Ministério do Trabalho e Emprego — CBO 2002 "
    "(gov.br/trabalho-e-emprego, CSV de ocupações + Livros 1 e 2 de famílias)"
)
USER_AGENT = "cota-aprendiz-bot/1.0 (atualizacao da base CBO; uso educacional)"

# Guardas de sanidade: a base tem ~2.700 ocupações e ~626 famílias; um download
# quebrado (página de erro, arquivo truncado, layout do PDF mudou) não pode
# silenciosamente substituir uma base boa.
MIN_OCUPACOES = 2000
MIN_FAMILIAS = 500
ARQUIVO_JSON = "app/public/data/cbo.json"

GITHUB_API = "https://api.github.com"

GATILHO_ART_429 = "para efeitos do calculo do numero de aprendizes"

# Fallback só para famílias ausentes dos Livros (edição nova da CBO ainda não
# impressa): GG 0–3 (militares, direção, nível superior, técnico de nível
# médio) não demandam a formação profissional do art. 429; GG 4–9 demandam.
GG_FALLBACK_EXCLUI = {"0", "1", "2", "3"}


def _normalizar_texto(s: str) -> str:
    """Remove acentos, junta hifenização de fim de linha e colapsa espaços —
    necessário porque o PDF corrompe a capitalização de certas palavras em
    alguns trechos de fonte e quebra frases no meio com o wrap de linha."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"-\s*\n\s*", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower()


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


def _baixar_pdf(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return resp.read()


def extrair_familias(conteudo_pdf: bytes) -> dict[str, dict]:
    """Lê um Livro (PDF) e devolve, por família (4 dígitos): se exige formação
    profissional e em que página do PDF (1-based) a ficha começa — usada para
    linkar direto à página certa (fragmento #page=N, suportado pelos leitores
    de PDF embutidos nos navegadores)."""
    leitor = PdfReader(io.BytesIO(conteudo_pdf))
    textos_pagina = [_normalizar_texto(p.extract_text() or "") for p in leitor.pages]

    # Offset de cada página no texto concatenado, para depois descobrir em que
    # página caiu a posição onde uma família começa.
    offsets = []
    acumulado = 0
    for t in textos_pagina:
        offsets.append(acumulado)
        acumulado += len(t) + 1  # +1 pelo "\n" usado no join abaixo
    texto = "\n".join(textos_pagina)

    # Âncora robusta: linha de ocupação "NNNN-NN" — dígitos não sofrem a
    # corrupção de glyph que afeta letras em alguns trechos de fonte do PDF
    # (ex.: "CÓDIGO" às vezes extrai como "CÓDiGO"), ao contrário do cabeçalho.
    primeira_ocorrencia: dict[str, int] = {}
    for m in re.finditer(r"\b(\d{4})-\d{2}\b", texto):
        familia = m.group(1)
        if familia not in primeira_ocorrencia:
            primeira_ocorrencia[familia] = m.start()

    ordenadas = sorted(primeira_ocorrencia.items(), key=lambda kv: kv[1])
    resultado = {}
    for i, (familia, inicio) in enumerate(ordenadas):
        fim = ordenadas[i + 1][1] if i + 1 < len(ordenadas) else len(texto)
        pagina = bisect.bisect_right(offsets, inicio)  # já 1-based (ver nota no bisect_right)
        resultado[familia] = {
            "exige": GATILHO_ART_429 in texto[inicio:fim],
            "pagina": pagina,
        }
    return resultado


def classificar_familias() -> dict[str, dict]:
    familias: dict[str, dict] = {}
    for numero_livro, url in enumerate(LIVROS_URL, start=1):
        for familia, dados in extrair_familias(_baixar_pdf(url)).items():
            familias[familia] = {**dados, "livro": numero_livro}

    if len(familias) < MIN_FAMILIAS:
        raise ValueError(
            f"Livros da CBO retornaram só {len(familias)} famílias (mínimo {MIN_FAMILIAS}); "
            "layout do PDF possivelmente mudou — abortando sem alterar a base."
        )
    return familias


def aplicar_classificacao(ocupacoes: list[dict], familias: dict[str, dict]) -> list[dict]:
    sem_ficha = set()
    resultado = []
    for o in ocupacoes:
        familia = o["codigo"][:4]
        dados = familias.get(familia)
        if dados:
            exige = dados["exige"]
            extra = {"livro": dados["livro"], "paginaLivro": dados["pagina"]}
        else:
            # Família nova, ainda não impressa nos Livros: fallback por Grande
            # Grupo para a flag; o link do "livro" vira um palpite sem página.
            sem_ficha.add(familia)
            exige = familia[0] not in GG_FALLBACK_EXCLUI
            extra = {"livro": 1 if familia[0] <= "5" else 2}
        resultado.append({**o, "exigeFormacaoProfissional": exige, **extra})

    if sem_ficha:
        print(
            f"Aviso: {len(sem_ficha)} família(s) sem ficha nos Livros 1/2 — "
            f"usando fallback por Grande Grupo: {sorted(sem_ficha)}"
        )
    return resultado


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

    ocupacoes = aplicar_classificacao(baixar_ocupacoes(), classificar_familias())
    resultado = publicar_no_github(ocupacoes, repo, branch, token)
    msg = f"{resultado}: {len(ocupacoes)} ocupações em {datetime.now(timezone.utc).isoformat()}"
    print(msg)
    return {"resultado": resultado, "ocupacoes": len(ocupacoes)}


def main_local():
    destino = Path(__file__).resolve().parent.parent / ARQUIVO_JSON
    ocupacoes = aplicar_classificacao(baixar_ocupacoes(), classificar_familias())

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
