import { fatiasComposicao } from '../graficos/graficos';
import { ItemResultado, ResultadoCalculo, TIPOS } from '../modelos/modelos';
import { avaliarSituacao } from '../situacao/situacao';

/** `comOrientacao` só nos formatos sem caixa de destaque (CSV e planilha). */
export function linhasResumo(resultado: ResultadoCalculo, comOrientacao: boolean): string[][] {
  const situacao = avaliarSituacao(resultado);
  const linhas = [
    ['Precisa agir?', situacao.precisaAgir ? 'SIM' : 'Não'],
    ['Situação', situacao.rotulo],
    ['Funcionários informados', String(resultado.totalPessoas)],
    ['Base de cálculo (funções que demandam formação profissional)', String(resultado.base)],
    ['Cota mínima (5%, frações arredondadas para cima)', String(resultado.minimo)],
    ['Cota máxima (15%)', String(resultado.maximo)],
    ['Aprendizes atuais', String(resultado.aprendizesAtuais)],
  ];
  if (resultado.deficit > 0) {
    linhas.push(['Aprendizes a contratar (déficit)', String(resultado.deficit)]);
  }
  if (resultado.excedente > 0) {
    linhas.push(['Aprendizes acima da cota máxima de 15%', String(resultado.excedente)]);
  }
  if (comOrientacao) {
    linhas.push(['O que fazer', situacao.orientacao]);
  }
  // Os mesmos números da rosca, em texto: quem lê a planilha ou o relatório
  // impresso em preto e branco não depende das cores do gráfico.
  for (const fatia of fatiasComposicao(resultado)) {
    linhas.push([`Composição — ${fatia.rotulo}`, String(fatia.valor)]);
  }
  return linhas;
}

export function rotuloFilial(resultado: ResultadoCalculo): string {
  return resultado.cnpj || 'Estabelecimento não informado';
}

export function rotuloTipo(item: ItemResultado): string {
  return TIPOS.find((t) => t.valor === item.tipo)?.rotulo ?? item.tipo;
}

export function nomeArquivo(extensao: string): string {
  const data = new Date().toISOString().slice(0, 10);
  return `relatorio-cota-aprendiz-${data}.${extensao}`;
}

export function baixar(blob: Blob, extensao: string): void {
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeArquivo(extensao);
  ancora.click();
  URL.revokeObjectURL(url);
}
