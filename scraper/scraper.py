"""Atualiza a base CBO do app a partir de fontes oficiais do MTE (gov.br).

Duas fontes:
  - CSV "cbo2002-ocupacao.csv" em gov.br/trabalho-e-emprego/.../downloads
    (HTTPS direto, sem sessão): código e título de cada ocupação.
  - Busca por Código em cbo.mte.gov.br — o mesmo site que uma pessoa usaria
    para conferir uma família manualmente. A aba "Características de
    Trabalho" de cada família ocupacional (4 dígitos) declara explicitamente
    se ela demanda formação profissional "para efeitos do cálculo do número
    de aprendizes [...] nos termos do artigo 429 [...] CLT" — esse é o
    critério real usado pelo MTE, mais preciso que inferir pelo Grande Grupo
    (1º dígito do código). Substituiu os Livros 1/2 em PDF (edição CBO 2002
    parada no tempo desde 2002): este site é mantido e atualizado (build
    observado em abril/2026), então correções e famílias novas já aparecem
    aqui antes de qualquer nova edição impressa.

    O site é JSF antigo: navegação via POST + ViewState + cookie de sessão,
    sem URL própria por família (não dá pra "linkar direto" numa família,
    só reproduzir os mesmos passos de um humano: buscar → abrir a família →
    trocar de aba). Além disso o servidor roda um OpenSSL 1.0.2k tão antigo
    que o cliente TLS padrão do Python (OpenSSL 3.x, SECLEVEL=2) não fecha o
    handshake — daí o SECLEVEL=1 abaixo.

Modos de execução:
  - Lambda: handler(event, context) — compara com o cbo.json atual no GitHub e,
    se as ocupações mudaram, commita via API de conteúdo (dispara o deploy).
  - Local:  python scraper.py --local — escreve app/public/data/cbo.json.
"""

import base64
import csv
import io
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter

DOWNLOADS = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads"
CSV_URL = f"{DOWNLOADS}/cbo2002-ocupacao.csv"
BUSCA_URL = "https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorCodigo.jsf"
FONTE = (
    "Ministério do Trabalho e Emprego — CBO 2002 (CSV de ocupações em "
    "gov.br/trabalho-e-emprego + consulta ao vivo em cbo.mte.gov.br, "
    'aba "Características de Trabalho" de cada família)'
)
USER_AGENT = "cota-aprendiz-bot/1.0 (atualizacao da base CBO; uso educacional)"

# Guardas de sanidade: a base tem ~2.700 ocupações e ~624 famílias; um download
# quebrado (página de erro, arquivo truncado, layout do site mudou) não pode
# silenciosamente substituir uma base boa.
MIN_OCUPACOES = 2000
MIN_FAMILIAS = 500
ARQUIVO_JSON = "app/public/data/cbo.json"

GITHUB_API = "https://api.github.com"

GATILHO_ART_429 = "para efeitos do calculo do numero de aprendizes"

# Fallback só se a consulta ao vivo falhar para uma família específica (rede
# instável, família fora do ar) mesmo após nova tentativa: GG 0–3 (militares,
# direção, nível superior, técnico de nível médio) não demandam a formação do
# art. 429; GG 4–9 demandam.
GG_FALLBACK_EXCLUI = {"0", "1", "2", "3"}

# Testado ao vivo sem nenhum erro com até 16 sessões simultâneas (~7
# famílias/s); 6 é uma folga confortável sem virar um mini teste de carga
# num site antigo de uso público. Pausa por família é por civilidade, não
# por necessidade (o site aguentou bem mais que isso no teste).
PARALELISMO = 6
PAUSA_ENTRE_FAMILIAS_S = 0.1
TENTATIVAS_POR_FAMILIA = 2


class _AdaptadorTlsAntigo(HTTPAdapter):
    """cbo.mte.gov.br roda um Apache/OpenSSL 1.0.2k tão antigo que o cliente
    TLS padrão do Python (OpenSSL 3.x, SECLEVEL=2) não fecha o handshake."""

    def init_poolmanager(self, *args, **kwargs):
        contexto = ssl.create_default_context()
        contexto.set_ciphers("DEFAULT@SECLEVEL=1")
        kwargs["ssl_context"] = contexto
        return super().init_poolmanager(*args, **kwargs)


def _normalizar_texto(s: str) -> str:
    """Remove acentos e colapsa espaços, pra o gatilho não depender de como o
    HTML representa cada caractere acentuado."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s).lower()


def _sessao_cbo() -> requests.Session:
    sessao = requests.Session()
    sessao.headers.update({"User-Agent": USER_AGENT})
    sessao.mount("https://", _AdaptadorTlsAntigo())
    return sessao


def _campos_formulario(soup: BeautifulSoup, campo_presente: str):
    """Acha o <form> que contém um input com esse name e devolve seus campos
    (ocultos + valores atuais) — necessário porque cada postback JSF exige
    reenviar o ViewState e os demais campos ocultos da página anterior."""
    formulario = next(f for f in soup.find_all("form") if f.find("input", {"name": campo_presente}))
    campos = {i.get("name"): i.get("value", "") for i in formulario.find_all("input") if i.get("name")}
    return campos, formulario


def _pagina(resposta: requests.Response) -> BeautifulSoup:
    resposta.encoding = "ISO-8859-1"
    return BeautifulSoup(resposta.text, "html.parser")


def consultar_familia(sessao: requests.Session, familia: str) -> bool:
    """Reproduz a navegação de uma pessoa em cbo.mte.gov.br: busca a família,
    abre a ficha e lê a aba "Características de Trabalho". Levanta em caso de
    erro de rede ou se a família não existir (chamador decide o fallback)."""
    r1 = sessao.get(BUSCA_URL, timeout=30)
    campos, _ = _campos_formulario(_pagina(r1), "formBuscaPorCodigo")
    campos["formBuscaPorCodigo:j_idt79"] = familia
    campos["formBuscaPorCodigo:btConsultarCodigo"] = "Consultar"

    r2 = sessao.post(BUSCA_URL, data=campos, timeout=30)
    campos2, _ = _campos_formulario(_pagina(r2), "formBuscaPorCodigo")
    campos2.pop("formBuscaPorCodigo:btConsultarCodigo", None)
    # A primeira linha da tabela de resultado é sempre a própria família
    # (CAIXA ALTA na legenda do site; as linhas seguintes são as ocupações).
    campos2["formBuscaPorCodigo:objetos2:0:j_idt110"] = "formBuscaPorCodigo:objetos2:0:j_idt110"

    r3 = sessao.post(BUSCA_URL, data=campos2, timeout=30)
    soup3 = _pagina(r3)
    campos3, form3 = _campos_formulario(soup3, "formSite004")
    action = requests.compat.urljoin(r3.url, form3.get("action"))
    campos3["formSite004:j_idt22"] = "formSite004:j_idt22"  # aba "Características de Trabalho"

    r4 = sessao.post(action, data=campos3, timeout=30)
    texto = _normalizar_texto(_pagina(r4).get_text(" ", strip=True))
    if "caracteristicas de trabalho" not in texto:
        raise ValueError(f"família {familia}: página de destino inesperada (layout do site mudou?)")
    return GATILHO_ART_429 in texto


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


def _classificar_uma(familia: str) -> tuple[str, bool, Exception | None]:
    """Roda numa thread do pool — cada chamada usa sua própria sessão (cada
    thread não pode compartilhar cookiejar/ViewState com as outras)."""
    sessao = _sessao_cbo()
    erro: Exception | None = None
    for _tentativa in range(TENTATIVAS_POR_FAMILIA):
        try:
            exige = consultar_familia(sessao, familia)
            time.sleep(PAUSA_ENTRE_FAMILIAS_S)
            return familia, exige, None
        except Exception as e:  # noqa: BLE001 — qualquer falha de rede/parsing cai no retry/fallback
            erro = e
            sessao = _sessao_cbo()  # sessão pode ter ficado num estado inconsistente
    return familia, familia[0] not in GG_FALLBACK_EXCLUI, erro


def classificar_familias(familias: list[str], paralelismo: int = PARALELISMO) -> dict[str, bool]:
    """Consulta cbo.mte.gov.br família por família, em paralelo (cada worker
    com sua própria sessão HTTP — testado sem erros com até 16 simultâneas;
    fica em 6 por civilidade com um site antigo e de uso público). Uma falha
    isolada (rede) cai no fallback por Grande Grupo, com aviso; layout mudado
    ou queda total do site abortam (guarda de sanidade), pra não gravar uma
    base ruim.

    Loga progresso periodicamente — sem isso, um timeout na Lambda não deixa
    nenhuma pista de até onde chegou (só aparece no fim, no print do handler).
    """
    resultado: dict[str, bool] = {}
    com_falha = []
    total = len(familias)
    inicio = time.time()
    print(f"Consultando {total} famílias em cbo.mte.gov.br (paralelismo={paralelismo})...", flush=True)

    with ThreadPoolExecutor(max_workers=paralelismo) as executor:
        futuros = {executor.submit(_classificar_uma, familia): familia for familia in familias}
        for concluidas, futuro in enumerate(as_completed(futuros), start=1):
            familia, exige, erro = futuro.result()
            resultado[familia] = exige
            if erro is not None:
                com_falha.append(familia)
                print(
                    f"Aviso: falha ao consultar família {familia} ({erro}); usando fallback por Grande Grupo.",
                    flush=True,
                )
            if concluidas % 50 == 0 or concluidas == total:
                print(f"{concluidas}/{total} famílias em {time.time() - inicio:.0f}s", flush=True)

    if len(resultado) < MIN_FAMILIAS:
        raise ValueError(
            f"Só {len(resultado)} família(s) processadas (mínimo {MIN_FAMILIAS}); "
            "abortando sem alterar a base."
        )
    if len(com_falha) > len(familias) * 0.1:
        raise ValueError(
            f"{len(com_falha)} de {len(familias)} famílias falharam na consulta ao vivo "
            "(site fora do ar ou layout mudou?) — abortando sem alterar a base."
        )
    return resultado


def aplicar_classificacao(ocupacoes: list[dict], exige_por_familia: dict[str, bool]) -> list[dict]:
    resultado = []
    for o in ocupacoes:
        familia = o["codigo"][:4]
        exige = exige_por_familia.get(familia, familia[0] not in GG_FALLBACK_EXCLUI)
        resultado.append({**o, "exigeFormacaoProfissional": exige})
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


def _gerar_ocupacoes() -> list[dict]:
    print("Baixando CSV de ocupações...", flush=True)
    ocupacoes = baixar_ocupacoes()
    familias = sorted({o["codigo"][:4] for o in ocupacoes})
    print(f"{len(ocupacoes)} ocupações, {len(familias)} famílias.", flush=True)
    exige_por_familia = classificar_familias(familias)
    return aplicar_classificacao(ocupacoes, exige_por_familia)


def handler(event, context):
    repo = os.environ["GITHUB_REPO"]  # ex.: "usuario/repositorio"
    branch = os.environ.get("GITHUB_BRANCH", "main")
    token = _token_do_ssm()

    ocupacoes = _gerar_ocupacoes()
    resultado = publicar_no_github(ocupacoes, repo, branch, token)
    msg = f"{resultado}: {len(ocupacoes)} ocupações em {datetime.now(timezone.utc).isoformat()}"
    print(msg)
    return {"resultado": resultado, "ocupacoes": len(ocupacoes)}


def main_local():
    destino = Path(__file__).resolve().parent.parent / ARQUIVO_JSON
    ocupacoes = _gerar_ocupacoes()

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
