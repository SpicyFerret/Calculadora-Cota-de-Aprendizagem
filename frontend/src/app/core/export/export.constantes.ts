export const URL_CONTRATAR = 'https://gerar.org.br/projeto/aprendiz-gerar/';

// Identidade Aprendiz Gerar
export const AZUL_MARCA: [number, number, number] = [39, 46, 97]; // #272E61
export const VERDE_MARCA_TEXTO: [number, number, number] = [0, 133, 124]; // verde-água escurecido p/ texto
export const VERMELHO_ACAO: [number, number, number] = [208, 59, 59]; // #d03b3b, igual ao --status-critico
export const VERDE_OK: [number, number, number] = [12, 163, 12]; // #0ca30c, igual ao --status-bom

// Página A4 do relatório, em mm.
export const MARGEM = 14;
export const TOPO_PAGINA = 20;
/** Última linha utilizável: abaixo disso o conteúdo vai para a página seguinte. */
export const RODAPE_SEGURO = 276;
export const LARGURA_UTIL = 210 - 2 * MARGEM;
export const MEIO_PAGINA = 105;

// Gráficos: renderizados em ~2x o tamanho impresso, para não sair serrilhado.
export const ROSCA_PX = { largura: 1400, altura: 560 };
export const BARRAS_PX = { largura: 1400, altura: 460 };
export const ALTURA_ROSCA_MM = (LARGURA_UTIL * ROSCA_PX.altura) / ROSCA_PX.largura;
export const ALTURA_BARRAS_MM = (LARGURA_UTIL * BARRAS_PX.altura) / BARRAS_PX.largura;
/** Altura do bloco de gráficos com as duas legendas e o respiro entre elas. */
export const ALTURA_BLOCO_GRAFICOS = 6 + ALTURA_ROSCA_MM + 10 + ALTURA_BARRAS_MM;

export const NOME_ABA_RESUMO = 'Resumo geral';

export const TINTA = '#3f3f3c';
export const TINTA_FORTE = '#1a1a19';
export const FONTE = "'Roboto', 'Helvetica Neue', sans-serif";

export const AVISOS = [
  'Estimativa com base na CLT art. 429 e no Decreto 9.579/2018; não substitui orientação jurídica.',
  'A obrigação só existe com 7+ funcionários na base, por estabelecimento (CNPJ).',
  'ME, EPP e entidades sem fins lucrativos de formação profissional são dispensadas da cota.',
];

export interface GraficosRelatorio {
  composicao: string;
  cota: string;
}
