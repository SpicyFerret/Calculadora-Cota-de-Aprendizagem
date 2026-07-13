export type TipoVinculo = 'CLT' | 'PCD' | 'ESTAGIARIO' | 'APRENDIZ';

export const TIPOS: { valor: TipoVinculo; rotulo: string }[] = [
  { valor: 'CLT', rotulo: 'CLT' },
  { valor: 'PCD', rotulo: 'PCD (CLT)' },
  { valor: 'ESTAGIARIO', rotulo: 'Estagiário' },
  { valor: 'APRENDIZ', rotulo: 'Aprendiz' },
];

export interface Ocupacao {
  codigo: string;
  titulo: string;
  /**
   * Se a família ocupacional (4 primeiros dígitos) demanda formação profissional
   * para efeitos do cálculo da cota, segundo a ficha do MTE (art. 429 da CLT) —
   * fonte oficial, não uma heurística por Grande Grupo. Ver scraper/scraper.py.
   */
  exigeFormacaoProfissional: boolean;
  /** Em qual Livro da CBO (1 ou 2) a ficha desta família está. */
  livro: 1 | 2;
  /** Página (1-based) do Livro onde a ficha começa; ausente para famílias sem ficha nos livros. */
  paginaLivro?: number;
}

export interface BaseCbo {
  geradoEm: string;
  fonte: string;
  ocupacoes: Ocupacao[];
}

/** Uma linha do quadro de funcionários: N pessoas de um tipo num CBO. */
export interface LinhaQuadro {
  cbo: string;
  tipo: TipoVinculo;
  quantidade: number;
}

/** Um estabelecimento (matriz ou filial): a cota é apurada por CNPJ. */
export interface GrupoEstabelecimento {
  /** CNPJ ou rótulo livre; vazio = não informado. */
  cnpj: string;
  linhas: LinhaQuadro[];
}

export interface Classificacao {
  entra: boolean;
  motivo: string;
}

export interface ItemResultado {
  codigo: string;
  titulo: string | null;
  encontrado: boolean;
  tipo: TipoVinculo;
  quantidade: number;
  entraNaBase: boolean;
  motivo: string;
  overrideExcluido: boolean;
  /** Linhas CLT/PCD com CBO incluso podem ser excluídas manualmente (cargo de confiança). */
  podeExcluirManualmente: boolean;
}

export interface ComposicaoQuadro {
  entramNaBase: number;
  excluidosPeloCbo: number;
  aprendizes: number;
  estagiarios: number;
  excluidosManualmente: number;
}

export interface ResultadoCalculo {
  /** CNPJ/rótulo do estabelecimento; vazio quando não informado. */
  cnpj: string;
  itens: ItemResultado[];
  totalPessoas: number;
  base: number;
  /** Obrigação de contratar só existe com 7+ funcionários na base. */
  obrigada: boolean;
  minimo: number;
  maximo: number;
  aprendizesAtuais: number;
  deficit: number;
  /** Aprendizes acima da cota máxima de 15% (extrapolação). */
  excedente: number;
  composicao: ComposicaoQuadro;
  calculadoEm: Date;
}
