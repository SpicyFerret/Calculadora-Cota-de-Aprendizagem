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

export interface Classificacao {
  entra: boolean;
  grandeGrupo: number;
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
  itens: ItemResultado[];
  totalPessoas: number;
  base: number;
  /** Obrigação de contratar só existe com 7+ funcionários na base. */
  obrigada: boolean;
  minimo: number;
  maximo: number;
  aprendizesAtuais: number;
  deficit: number;
  composicao: ComposicaoQuadro;
  calculadoEm: Date;
}
