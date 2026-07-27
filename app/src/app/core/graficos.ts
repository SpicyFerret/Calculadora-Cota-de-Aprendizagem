import { ResultadoCalculo } from './modelos';

/** Uma fatia/barra do gráfico: o valor e a variável CSS que dá a cor. */
export interface SerieGrafico {
  rotulo: string;
  valor: number;
  corVar: string;
}

/**
 * Fatias da rosca de composição do quadro, na ordem em que devem ser
 * desenhadas — a ordem faz parte da paleta validada (separação de cores entre
 * fatias vizinhas, em tema claro e escuro). Não reordenar sem revalidar.
 * Usada tanto na tela quanto nos relatórios PDF/XLSX.
 */
export function fatiasComposicao(resultado: ResultadoCalculo): SerieGrafico[] {
  const c = resultado.composicao;
  return [
    { rotulo: 'Entram na base', valor: c.entramNaBase, corVar: '--viz-incluidos' },
    { rotulo: 'Excluídos pelo CBO', valor: c.excluidosPeloCbo, corVar: '--viz-excluidos-cbo' },
    { rotulo: 'Afastados pelo INSS', valor: c.afastadosInss, corVar: '--viz-afastados-inss' },
    { rotulo: 'Aprendizes atuais', valor: c.aprendizes, corVar: '--viz-aprendizes' },
    { rotulo: 'Estagiários', valor: c.estagiarios, corVar: '--viz-estagiarios' },
    { rotulo: 'Excluídos manualmente', valor: c.excluidosManualmente, corVar: '--viz-excluidos-manual' },
    { rotulo: 'Terceirizados', valor: c.terceirizados, corVar: '--viz-terceirizados' },
    { rotulo: 'Trabalho temporário', valor: c.temporarios, corVar: '--viz-temporarios' },
  ].filter((f) => f.valor > 0);
}

/** Barras da comparação entre a cota exigida e os aprendizes atuais. */
export function barrasCota(resultado: ResultadoCalculo): SerieGrafico[] {
  return [
    { rotulo: 'Cota mínima (5%)', valor: resultado.minimo, corVar: '--viz-incluidos' },
    { rotulo: 'Cota máxima (15%)', valor: resultado.maximo, corVar: '--viz-cota-maxima' },
    { rotulo: 'Aprendizes atuais', valor: resultado.aprendizesAtuais, corVar: '--viz-aprendizes' },
  ];
}

/**
 * Paleta do tema claro, para os gráficos dos relatórios: PDF e planilha são
 * impressos em fundo branco, então não seguem o tema escolhido na tela.
 * Gêmea dos valores do bloco `html { }` em `src/styles.scss` — mudou lá, muda aqui.
 */
export const PALETA_RELATORIO: Record<string, string> = {
  '--viz-incluidos': '#00958b',
  '--viz-excluidos-cbo': '#eb6834',
  '--viz-afastados-inss': '#1baf7a',
  '--viz-aprendizes': '#4a3aa7',
  '--viz-estagiarios': '#eda100',
  '--viz-excluidos-manual': '#e87ba4',
  '--viz-terceirizados': '#3d6fd1',
  '--viz-temporarios': '#e34948',
  '--viz-cota-maxima': '#5cb8b0',
  '--viz-grade': '#e1e0d9',
};
