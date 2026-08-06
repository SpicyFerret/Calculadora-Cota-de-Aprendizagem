import { ResultadoCalculo } from './modelos';

export interface SituacaoCota {
  /** Se o estabelecimento precisa fazer alguma coisa a respeito da cota. */
  precisaAgir: boolean;
  /** Rótulo curto, para tabelas e listas. */
  rotulo: string;
  /** Frase de abertura do resumo: o veredito, em duas palavras. */
  chamada: string;
  /** O que fazer (ou por que não há o que fazer), em texto corrido. */
  orientacao: string;
}

/**
 * Traduz os números da cota em "precisa agir ou não" — é o que o relatório
 * responde antes de qualquer tabela. Fonte única para tela, PDF, CSV e XLSX.
 */
export function avaliarSituacao(r: ResultadoCalculo): SituacaoCota {
  if (r.excedente > 0) {
    return {
      precisaAgir: true,
      rotulo: `${r.excedente} acima da máxima`,
      chamada: 'Ação necessária',
      orientacao:
        `O estabelecimento tem ${quantos(r.aprendizesAtuais, 'aprendiz', 'aprendizes')} para uma cota ` +
        `máxima de ${r.maximo} (15% da base de ${r.base}). ${quantos(r.excedente, 'contrato', 'contratos')} ` +
        `não se enquadra${r.excedente > 1 ? 'm' : ''} na cota — verifique a situação com a fiscalização ` +
        'do trabalho ou o setor jurídico.',
    };
  }
  if (!r.obrigada) {
    return {
      precisaAgir: false,
      rotulo: 'Isenta (base < 7)',
      chamada: 'Nenhuma ação necessária',
      orientacao:
        `A base de cálculo tem ${quantos(r.base, 'funcionário', 'funcionários')}, abaixo dos 7 que tornam ` +
        'a contratação obrigatória. Contratar aprendizes é facultativo neste estabelecimento.',
    };
  }
  if (r.deficit > 0) {
    return {
      precisaAgir: true,
      rotulo: `Déficit de ${r.deficit}`,
      chamada: 'Ação necessária',
      orientacao:
        `Contratar ${quantos(r.deficit, 'aprendiz', 'aprendizes')} para cumprir a cota mínima de ` +
        `${r.minimo} (5% da base de ${r.base}). Hoje o estabelecimento tem ` +
        `${quantos(r.aprendizesAtuais, 'aprendiz', 'aprendizes')}.`,
    };
  }
  return {
    precisaAgir: false,
    rotulo: 'Cota cumprida',
    chamada: 'Nenhuma ação necessária',
    orientacao:
      `A cota mínima de ${quantos(r.minimo, 'aprendiz', 'aprendizes')} está cumprida: o estabelecimento ` +
      `tem ${r.aprendizesAtuais}. O limite máximo é de ${r.maximo} (15% da base de ${r.base}).`,
  };
}

function quantos(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
