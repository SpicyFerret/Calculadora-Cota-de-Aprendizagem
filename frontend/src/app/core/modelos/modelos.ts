export type TipoVinculo =
  | 'CLT'
  | 'ESTAGIARIO'
  | 'APRENDIZ'
  | 'AFASTADO_INSS'
  | 'TERCEIRIZADO'
  | 'TEMPORARIO';

export const TIPOS: { valor: TipoVinculo; rotulo: string }[] = [
  { valor: 'CLT', rotulo: 'CLT' },
  { valor: 'ESTAGIARIO', rotulo: 'Estagiário' },
  { valor: 'APRENDIZ', rotulo: 'Aprendiz' },
  { valor: 'AFASTADO_INSS', rotulo: 'Afastado pelo INSS' },
  { valor: 'TERCEIRIZADO', rotulo: 'Terceirizado' },
  { valor: 'TEMPORARIO', rotulo: 'Trabalho temporário' },
];

/**
 * Vínculos que não compõem a base de cálculo, com o motivo mostrado no
 * resultado. Só o CLT entra na base; os demais saem antes mesmo da consulta
 * ao CBO, porque o vínculo decide sozinho.
 */
export const VINCULOS_FORA_DA_BASE: Partial<Record<TipoVinculo, string>> = {
  APRENDIZ: 'Aprendiz já contratado (não compõe a base)',
  ESTAGIARIO: 'Estagiário não é empregado (Lei 11.788/2008)',
  AFASTADO_INSS: 'Afastado pelo INSS — não compõe a base de cálculo',
  TERCEIRIZADO: 'Terceirizado — empregado da prestadora, não do tomador',
  TEMPORARIO:
    'Trabalho temporário — vínculo com a empresa de trabalho temporário (Lei 6.019/1974)',
};

export interface Ocupacao {
  codigo: string;
  titulo: string;
  /**
   * Se a família ocupacional (4 primeiros dígitos) demanda formação profissional
   * para efeitos do cálculo da cota, segundo a ficha do MTE (art. 429 da CLT) —
   * fonte oficial, não uma heurística por Grande Grupo. Ver scraper/scraper.py.
   */
  exigeFormacaoProfissional: boolean;
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
  /** Linhas CLT com CBO incluso podem ser tiradas da base manualmente. */
  podeExcluirManualmente: boolean;
  /** Incluído manualmente apesar de a CBO não exigir formação profissional. */
  overrideIncluido: boolean;
  /** Linhas cujo CBO oficialmente não entra podem ser incluídas manualmente. */
  podeIncluirManualmente: boolean;
}

export interface ComposicaoQuadro {
  entramNaBase: number;
  excluidosPeloCbo: number;
  aprendizes: number;
  estagiarios: number;
  afastadosInss: number;
  terceirizados: number;
  temporarios: number;
  /** Excluídos pelo toggle "Excluir" na tabela de resultado, depois de calculado. */
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
