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
  /**
   * Quantas das `quantidade` pessoas desta linha são cargo de direção ou
   * confiança (excluídas da base) — permite excluir só uma parte das pessoas
   * de um CBO (ex.: 1 de 5) sem precisar de uma linha separada. Ausente ou 0
   * equivale a nenhuma. O CalculoService separa essa parcela ao agregar.
   */
  quantidadeConfianca?: number;
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
  /** Se esta linha foi marcada como cargo de confiança já na entrada (form/planilha). */
  cargoConfianca: boolean;
}

export interface ComposicaoQuadro {
  entramNaBase: number;
  excluidosPeloCbo: number;
  aprendizes: number;
  estagiarios: number;
  /** Excluídos pelo toggle "Excluir" na tabela de resultado, depois de calculado. */
  excluidosManualmente: number;
  /** Excluídos por já terem sido sinalizados como cargo de confiança/direção no formulário ou na planilha. */
  excluidosCargoConfianca: number;
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
