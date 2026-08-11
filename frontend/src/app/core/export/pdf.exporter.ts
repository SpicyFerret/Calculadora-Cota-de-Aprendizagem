import { ResultadoCalculo } from '../modelos/modelos';
import { avaliarSituacao } from '../situacao/situacao';
import {
  ALTURA_BLOCO_GRAFICOS,
  ALTURA_BARRAS_MM,
  ALTURA_ROSCA_MM,
  AVISOS,
  AZUL_MARCA,
  LARGURA_UTIL,
  MARGEM,
  MEIO_PAGINA,
  RODAPE_SEGURO,
  TOPO_PAGINA,
  URL_CONTRATAR,
  VERDE_MARCA_TEXTO,
  VERDE_OK,
  VERMELHO_ACAO,
} from './export.constantes';
import { linhasResumo, nomeArquivo, rotuloFilial, rotuloTipo } from './export.resumo';
import { renderizarGraficos } from './graficos-relatorio';

interface InfoCbo {
  geradoEm: string;
  fonte: string;
}

export async function baixarPdf(resultados: ResultadoCalculo[], cbo: InfoCbo): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF();

  await capa(pdf, cbo);

  for (const resultado of resultados) {
    pdf.addPage();
    paginaResumo(pdf, autoTable, resultado);
    pdf.addPage();
    await paginasDetalhe(pdf, autoTable, resultado);
  }

  rodapes(pdf);
  pdf.save(nomeArquivo('pdf'));
}

/** Página 1: só a identificação do relatório. */
async function capa(pdf: import('jspdf').jsPDF, cbo: InfoCbo): Promise<void> {
  const logo = await logoDataUrl();
  if (logo) {
    // Logo horizontal 1849×824 px → 88×39 mm, centralizada.
    pdf.addImage(logo, 'PNG', MEIO_PAGINA - 44, 78, 88, 39);
  }
  pdf.setFontSize(20);
  pdf.setTextColor(...AZUL_MARCA);
  pdf.text('Relatório — Cota de Aprendizagem', MEIO_PAGINA, 138, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, MEIO_PAGINA, 150, {
    align: 'center',
  });

  pdf.setFontSize(9);
  const fonte = pdf.splitTextToSize(
    `Base CBO de ${cbo.geradoEm} (${cbo.fonte})`,
    LARGURA_UTIL - 20,
  ) as string[];
  pdf.text(fonte, MEIO_PAGINA, 158, { align: 'center' });
}

/** Uma página por estabelecimento: o veredito primeiro, os números depois. */
function paginaResumo(
  pdf: import('jspdf').jsPDF,
  autoTable: typeof import('jspdf-autotable').default,
  resultado: ResultadoCalculo,
): void {
  let posicao = cabecalhoEstabelecimento(pdf, rotuloFilial(resultado), 'Resumo');
  posicao = caixaSituacao(pdf, resultado, posicao);

  autoTable(pdf, {
    startY: posicao,
    head: [['Números do estabelecimento', '']],
    body: linhasResumo(resultado, false),
    theme: 'plain',
    styles: { fontSize: 10 },
    headStyles: { fontStyle: 'bold', textColor: AZUL_MARCA },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { top: 30, left: MARGEM, right: MARGEM },
    didDrawPage: () => {
      cabecalhoEstabelecimento(pdf, rotuloFilial(resultado), 'Resumo');
    },
  });
}

/** Gráficos e tabela por CBO — do estabelecimento, não de todos juntos. */
async function paginasDetalhe(
  pdf: import('jspdf').jsPDF,
  autoTable: typeof import('jspdf-autotable').default,
  resultado: ResultadoCalculo,
): Promise<void> {
  const posicao = cabecalhoEstabelecimento(pdf, rotuloFilial(resultado), 'Detalhamento');
  const depoisDosGraficos = await desenharGraficos(pdf, resultado, posicao);

  autoTable(pdf, {
    startY: depoisDosGraficos,
    head: [['CBO', 'Título', 'Tipo', 'Qtd.', 'Base', 'Motivo']],
    body: resultado.itens.map((i) => [
      i.codigo,
      i.titulo ?? 'CBO não encontrado',
      rotuloTipo(i),
      i.quantidade,
      i.entraNaBase ? 'Sim' : 'Não',
      i.motivo,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: AZUL_MARCA, textColor: 255 },
    columnStyles: { 3: { halign: 'right' } },
    // `top` reserva a faixa do CNPJ, redesenhada a cada página em que a
    // tabela continua — assim nenhuma página fica sem dizer de quem é.
    margin: { top: 30, left: MARGEM, right: MARGEM },
    didDrawPage: () => {
      cabecalhoEstabelecimento(pdf, rotuloFilial(resultado), 'Detalhamento');
    },
  });
}

/** Faixa com o CNPJ no topo da página, separando um estabelecimento do outro. */
function cabecalhoEstabelecimento(
  pdf: import('jspdf').jsPDF,
  filial: string,
  secao: string,
): number {
  pdf.setFillColor(...AZUL_MARCA);
  pdf.rect(0, 0, 210, 18, 'F');
  pdf.setFontSize(12);
  pdf.setTextColor(255);
  pdf.text(filial, MARGEM, 11.5);
  pdf.setFontSize(10);
  pdf.text(secao, 210 - MARGEM, 11.5, { align: 'right' });
  pdf.setTextColor(0);
  return 30;
}

/** Caixa de destaque com o veredito: precisa agir ou não, e o que fazer. */
function caixaSituacao(
  pdf: import('jspdf').jsPDF,
  resultado: ResultadoCalculo,
  posicao: number,
): number {
  const situacao = avaliarSituacao(resultado);
  const cor = situacao.precisaAgir ? VERMELHO_ACAO : VERDE_OK;
  const texto = pdf.splitTextToSize(situacao.orientacao, LARGURA_UTIL - 14) as string[];
  const altura = 16 + texto.length * 5;

  pdf.setDrawColor(...cor);
  pdf.setLineWidth(0.4);
  pdf.rect(MARGEM, posicao, LARGURA_UTIL, altura);
  // Barra lateral na cor do veredito — a chamada em texto diz o mesmo, para
  // não depender de enxergar a cor.
  pdf.setFillColor(...cor);
  pdf.rect(MARGEM, posicao, 2.5, altura, 'F');
  pdf.setLineWidth(0.2);

  pdf.setFontSize(12);
  pdf.setTextColor(...cor);
  pdf.text(situacao.chamada.toUpperCase(), MARGEM + 7, posicao + 8);
  pdf.setFontSize(10);
  pdf.setTextColor(60);
  pdf.text(texto, MARGEM + 7, posicao + 15);
  pdf.setTextColor(0);

  return posicao + altura + 10;
}

/** Desenha os dois gráficos do estabelecimento e devolve a posição depois deles. */
async function desenharGraficos(
  pdf: import('jspdf').jsPDF,
  resultado: ResultadoCalculo,
  posicaoInicial: number,
): Promise<number> {
  const graficos = await renderizarGraficos(resultado);
  let posicao = garantirEspaco(pdf, posicaoInicial, ALTURA_BLOCO_GRAFICOS);

  pdf.setFontSize(10);
  pdf.setTextColor(...AZUL_MARCA);
  pdf.text(
    `Composição do quadro informado (${resultado.totalPessoas} funcionários)`,
    MARGEM,
    posicao,
  );
  posicao += 4;
  pdf.addImage(graficos.composicao, 'PNG', MARGEM, posicao, LARGURA_UTIL, ALTURA_ROSCA_MM);
  posicao += ALTURA_ROSCA_MM + 8;

  pdf.text('Cota exigida × aprendizes atuais', MARGEM, posicao);
  posicao += 4;
  pdf.addImage(graficos.cota, 'PNG', MARGEM, posicao, LARGURA_UTIL, ALTURA_BARRAS_MM);
  pdf.setTextColor(0);
  return posicao + ALTURA_BARRAS_MM + 8;
}

/** Abre uma página nova quando o bloco não cabe inteiro no que sobrou desta. */
function garantirEspaco(pdf: import('jspdf').jsPDF, posicao: number, altura: number): number {
  if (posicao + altura <= RODAPE_SEGURO) {
    return posicao;
  }
  pdf.addPage();
  return TOPO_PAGINA;
}

/**
 * Avisos legais, link e numeração no pé de cada página (menos a capa) —
 * escritos no fim, quando já se sabe o total de páginas.
 */
function rodapes(pdf: import('jspdf').jsPDF): void {
  const total = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    pdf.setPage(pagina);
    if (pagina === 1) {
      // A capa leva os avisos legais, e não a numeração.
      pdf.setFontSize(8);
      pdf.setTextColor(130);
      pdf.text(AVISOS, MEIO_PAGINA, 262, { align: 'center' });
      pdf.setFontSize(9);
      pdf.setTextColor(...VERDE_MARCA_TEXTO);
      // Centralizado na mão: com `align: 'center'` o texto anda mas a área
      // clicável do link continua sendo calculada a partir de x.
      const chamada = 'Contrate aprendizes com a GERAR: gerar.org.br/projeto/aprendiz-gerar';
      pdf.textWithLink(chamada, MEIO_PAGINA - pdf.getTextWidth(chamada) / 2, 280, {
        url: URL_CONTRATAR,
      });
      continue;
    }
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text('Relatório — Cota de Aprendizagem', MARGEM, 288);
    pdf.text(`página ${pagina} de ${total}`, 210 - MARGEM, 288, { align: 'right' });
  }
}

/** Logo colorida (fundo claro) embutida no PDF; sem ela a capa sai só com texto. */
async function logoDataUrl(): Promise<string | null> {
  try {
    const resposta = await fetch('marca/logo-horizontal.png');
    if (!resposta.ok) {
      return null;
    }
    const blob = await resposta.blob();
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as string);
      leitor.onerror = reject;
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
