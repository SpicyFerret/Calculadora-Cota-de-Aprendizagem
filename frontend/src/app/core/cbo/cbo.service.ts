import { Injectable, signal } from '@angular/core';
import { BaseCbo, Classificacao, Ocupacao } from './modelos';

const MOTIVO_ENTRA =
  'Segundo a ficha oficial do MTE, esta família ocupacional demanda formação profissional para efeitos do cálculo da cota (art. 429 da CLT)';
const MOTIVO_NAO_ENTRA =
  'Segundo a ficha oficial do MTE, esta família ocupacional não demanda formação profissional para efeitos do cálculo da cota (art. 429 da CLT)';

/** Mesmo site que o scraper consulta como fonte (ver scraper/scraper.py). */
const BUSCA_POR_CODIGO_URL = 'https://cbo.mte.gov.br/cbosite/pages/pesquisas/BuscaPorCodigo.jsf';

@Injectable({ providedIn: 'root' })
export class CboService {
  private ocupacoesPorCodigo = new Map<string, Ocupacao>();
  private ocupacoes: Ocupacao[] = [];

  readonly carregada = signal(false);
  readonly erroCarga = signal<string | null>(null);
  readonly geradoEm = signal('');
  readonly fonte = signal('');
  readonly totalOcupacoes = signal(0);

  async carregar(): Promise<void> {
    try {
      const resposta = await fetch('data/cbo.json');
      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}`);
      }
      const base = (await resposta.json()) as BaseCbo;
      this.usarBase(base);
    } catch (e) {
      this.erroCarga.set(`Não foi possível carregar a base CBO (${e}).`);
    }
  }

  /** Também usado pelos testes para injetar uma base pequena. */
  usarBase(base: BaseCbo): void {
    this.ocupacoes = base.ocupacoes;
    this.ocupacoesPorCodigo = new Map(base.ocupacoes.map((o) => [o.codigo, o]));
    this.geradoEm.set(base.geradoEm);
    this.fonte.set(base.fonte);
    this.totalOcupacoes.set(base.ocupacoes.length);
    this.erroCarga.set(null);
    this.carregada.set(true);
  }

  /** Remove tudo que não é dígito ("4110-10" → "411010"). */
  normalizar(codigo: string): string {
    return (codigo ?? '').replace(/\D/g, '');
  }

  titulo(codigo: string): string | null {
    return this.ocupacoesPorCodigo.get(this.normalizar(codigo))?.titulo ?? null;
  }

  existe(codigo: string): boolean {
    return this.ocupacoesPorCodigo.has(this.normalizar(codigo));
  }

  /** Autocomplete: busca por prefixo do código ou trecho do título. */
  pesquisar(termo: string, limite = 20): Ocupacao[] {
    const t = (termo ?? '').trim().toLowerCase();
    if (!t) {
      return [];
    }
    const soDigitos = this.normalizar(t);
    const resultado: Ocupacao[] = [];
    for (const o of this.ocupacoes) {
      const bateCodigo = soDigitos.length > 0 && o.codigo.startsWith(soDigitos);
      const bateTitulo = o.titulo.toLowerCase().includes(t);
      if (bateCodigo || bateTitulo) {
        resultado.push(o);
        if (resultado.length >= limite) {
          break;
        }
      }
    }
    return resultado;
  }

  /** Diz se o CBO entra na base de cálculo da cota e por quê. Só chamar para código existente. */
  classificar(codigo: string): Classificacao {
    const ocupacao = this.ocupacoesPorCodigo.get(this.normalizar(codigo));
    const entra = ocupacao?.exigeFormacaoProfissional ?? false;
    return { entra, motivo: entra ? MOTIVO_ENTRA : MOTIVO_NAO_ENTRA };
  }

  /**
   * Link para a busca oficial por código em cbo.mte.gov.br — o site não tem
   * URL própria por família (navegação via ViewState/sessão JSF), então não
   * dá pra linkar direto na ficha; abre a busca para o usuário digitar o
   * código da família e conferir.
   */
  linkFicha(_codigo: string): string {
    return BUSCA_POR_CODIGO_URL;
  }

  /** Código da família (4 dígitos) a digitar na busca oficial do MTE. */
  descricaoFicha(codigo: string): string {
    return this.normalizar(codigo).slice(0, 4);
  }
}
