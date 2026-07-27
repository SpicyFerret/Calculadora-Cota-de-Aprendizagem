import { Injectable, inject } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { CboService } from './cbo.service';
import { PALETA_RELATORIO, barrasCota, fatiasComposicao } from './graficos';
import { ItemResultado, ResultadoCalculo, TIPOS } from './modelos';
import { avaliarSituacao } from './situacao';

const URL_CONTRATAR = 'https://gerar.org.br/projeto/aprendiz-gerar/';

// Identidade Aprendiz Gerar
const AZUL_MARCA: [number, number, number] = [39, 46, 97]; // #272E61
const VERDE_MARCA_TEXTO: [number, number, number] = [0, 133, 124]; // verde-água escurecido p/ texto
const VERMELHO_ACAO: [number, number, number] = [208, 59, 59]; // #d03b3b, igual ao --status-critico
const VERDE_OK: [number, number, number] = [12, 163, 12]; // #0ca30c, igual ao --status-bom

// Página A4 do relatório, em mm.
const MARGEM = 14;
const TOPO_PAGINA = 20;
/** Última linha utilizável: abaixo disso o conteúdo vai para a página seguinte. */
const RODAPE_SEGURO = 276;
const LARGURA_UTIL = 210 - 2 * MARGEM;
const MEIO_PAGINA = 105;

// Gráficos: renderizados em ~2x o tamanho impresso, para não sair serrilhado.
const ROSCA_PX = { largura: 1400, altura: 560 };
const BARRAS_PX = { largura: 1400, altura: 460 };
const ALTURA_ROSCA_MM = (LARGURA_UTIL * ROSCA_PX.altura) / ROSCA_PX.largura;
const ALTURA_BARRAS_MM = (LARGURA_UTIL * BARRAS_PX.altura) / BARRAS_PX.largura;
/** Altura do bloco de gráficos com as duas legendas e o respiro entre elas. */
const ALTURA_BLOCO_GRAFICOS = 6 + ALTURA_ROSCA_MM + 10 + ALTURA_BARRAS_MM;

const NOME_ABA_RESUMO = 'Resumo geral';

const TINTA = '#3f3f3c';
const TINTA_FORTE = '#1a1a19';
const FONTE = "'Roboto', 'Helvetica Neue', sans-serif";

const AVISOS = [
  'Estimativa com base na CLT art. 429 e no Decreto 9.579/2018; não substitui orientação jurídica.',
  'A obrigação só existe com 7+ funcionários na base, por estabelecimento (CNPJ).',
  'ME, EPP e entidades sem fins lucrativos de formação profissional são dispensadas da cota.',
];

interface GraficosRelatorio {
  composicao: string;
  cota: string;
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  private cbo = inject(CboService);

  // ---- CSV ----

  async baixarCsv(resultados: ResultadoCalculo[]): Promise<void> {
    const linhas: string[][] = [];
    // Um bloco por estabelecimento, cada um com o seu resumo e o seu detalhe.
    for (const r of resultados) {
      linhas.push([`Estabelecimento: ${this.rotuloFilial(r)}`]);
      linhas.push(...this.linhasResumo(r, true));
      linhas.push([]);
      linhas.push(['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo']);
      for (const i of r.itens) {
        linhas.push([
          i.codigo,
          i.titulo ?? 'CBO não encontrado',
          this.rotuloTipo(i),
          String(i.quantidade),
          i.entraNaBase ? 'Sim' : 'Não',
          i.motivo,
        ]);
      }
      linhas.push([]);
    }
    linhas.push(['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);
    const csv = linhas
      .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    // BOM para o Excel pt-BR abrir como UTF-8
    this.baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
  }

  // ---- XLSX ----

  async baixarXlsx(resultados: ResultadoCalculo[]): Promise<void> {
    const XLSX = await import('xlsx');
    const pasta = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(pasta, this.abaResumoGeral(XLSX, resultados), NOME_ABA_RESUMO);

    // Uma aba por estabelecimento, com o resumo e o detalhe do próprio CNPJ.
    const nomesUsados = [NOME_ABA_RESUMO];
    for (const r of resultados) {
      const nome = this.nomeAba(this.rotuloFilial(r), nomesUsados);
      nomesUsados.push(nome);
      XLSX.utils.book_append_sheet(pasta, this.abaEstabelecimento(XLSX, r), nome);
    }

    const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    this.baixar(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'xlsx',
    );
  }

  /** Panorama: uma linha por estabelecimento, dizendo se precisa agir. */
  private abaResumoGeral(
    XLSX: typeof import('xlsx'),
    resultados: ResultadoCalculo[],
  ): import('xlsx').WorkSheet {
    const linhas: (string | number)[][] = [
      ['Relatório — Cota de Aprendizagem'],
      [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
      [`Base CBO de ${this.cbo.geradoEm()}`],
      [],
      [
        'Estabelecimento',
        'Precisa agir?',
        'Situação',
        'Base',
        'Cota mínima',
        'Cota máxima',
        'Aprendizes',
        'O que fazer',
      ],
    ];
    for (const r of resultados) {
      const situacao = avaliarSituacao(r);
      linhas.push([
        this.rotuloFilial(r),
        situacao.precisaAgir ? 'SIM' : 'Não',
        situacao.rotulo,
        r.base,
        r.minimo,
        r.maximo,
        r.aprendizesAtuais,
        situacao.orientacao,
      ]);
    }
    linhas.push([], ['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);

    const aba = XLSX.utils.aoa_to_sheet(linhas);
    aba['!cols'] = [
      { wch: 24 },
      { wch: 13 },
      { wch: 20 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 80 },
    ];
    const celulaUrl = XLSX.utils.encode_cell({ r: linhas.length - 1, c: 1 });
    aba[celulaUrl].l = { Target: URL_CONTRATAR };
    return aba;
  }

  /** Aba de um estabelecimento: o veredito, o resumo e o detalhe do próprio CNPJ. */
  private abaEstabelecimento(
    XLSX: typeof import('xlsx'),
    resultado: ResultadoCalculo,
  ): import('xlsx').WorkSheet {
    const situacao = avaliarSituacao(resultado);
    const linhas: (string | number)[][] = [
      [`Estabelecimento: ${this.rotuloFilial(resultado)}`],
      [situacao.precisaAgir ? 'AÇÃO NECESSÁRIA' : 'NENHUMA AÇÃO NECESSÁRIA', situacao.rotulo],
      [situacao.orientacao],
      [],
      ['Resumo'],
      ...this.linhasResumo(resultado, false),
      [],
      ['Detalhado por CBO'],
      ['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
    ];
    for (const i of resultado.itens) {
      linhas.push([
        i.codigo,
        i.titulo ?? 'CBO não encontrado',
        this.rotuloTipo(i),
        i.quantidade,
        i.entraNaBase ? 'Sim' : 'Não',
        i.motivo,
      ]);
    }

    const aba = XLSX.utils.aoa_to_sheet(linhas);
    aba['!cols'] = [{ wch: 46 }, { wch: 46 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 60 }];
    return aba;
  }

  /**
   * Nome de aba aceito pelo Excel: sem `: \ / ? * [ ]`, até 31 caracteres e
   * único na pasta (CNPJ tem barra, então quase sempre precisa de ajuste).
   */
  private nomeAba(rotulo: string, usados: string[]): string {
    const limpo = rotulo.replace(/[:\\/?*[\]]/g, '-').trim() || 'Estabelecimento';
    let nome = limpo.slice(0, 31);
    let n = 2;
    while (usados.includes(nome)) {
      const sufixo = ` (${n++})`;
      nome = limpo.slice(0, 31 - sufixo.length) + sufixo;
    }
    return nome;
  }

  // ---- PDF ----

  async baixarPdf(resultados: ResultadoCalculo[]): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const pdf = new jsPDF();

    await this.capa(pdf);

    for (const resultado of resultados) {
      pdf.addPage();
      this.paginaResumo(pdf, autoTable, resultado);
      pdf.addPage();
      await this.paginasDetalhe(pdf, autoTable, resultado);
    }

    this.rodapes(pdf);
    pdf.save(this.nomeArquivo('pdf'));
  }

  /** Página 1: só a identificação do relatório. */
  private async capa(pdf: import('jspdf').jsPDF): Promise<void> {
    const logo = await this.logoDataUrl();
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
      `Base CBO de ${this.cbo.geradoEm()} (${this.cbo.fonte()})`,
      LARGURA_UTIL - 20,
    ) as string[];
    pdf.text(fonte, MEIO_PAGINA, 158, { align: 'center' });
  }

  /** Uma página por estabelecimento: o veredito primeiro, os números depois. */
  private paginaResumo(
    pdf: import('jspdf').jsPDF,
    autoTable: typeof import('jspdf-autotable').default,
    resultado: ResultadoCalculo,
  ): void {
    let posicao = this.cabecalhoEstabelecimento(pdf, this.rotuloFilial(resultado), 'Resumo');
    posicao = this.caixaSituacao(pdf, resultado, posicao);

    autoTable(pdf, {
      startY: posicao,
      head: [['Números do estabelecimento', '']],
      body: this.linhasResumo(resultado, false),
      theme: 'plain',
      styles: { fontSize: 10 },
      headStyles: { fontStyle: 'bold', textColor: AZUL_MARCA },
      columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { top: 30, left: MARGEM, right: MARGEM },
      didDrawPage: () => {
        this.cabecalhoEstabelecimento(pdf, this.rotuloFilial(resultado), 'Resumo');
      },
    });
  }

  /** Gráficos e tabela por CBO — do estabelecimento, não de todos juntos. */
  private async paginasDetalhe(
    pdf: import('jspdf').jsPDF,
    autoTable: typeof import('jspdf-autotable').default,
    resultado: ResultadoCalculo,
  ): Promise<void> {
    const posicao = this.cabecalhoEstabelecimento(
      pdf,
      this.rotuloFilial(resultado),
      'Detalhamento',
    );
    const depoisDosGraficos = await this.desenharGraficos(pdf, resultado, posicao);

    autoTable(pdf, {
      startY: depoisDosGraficos,
      head: [['CBO', 'Título', 'Tipo', 'Qtd.', 'Base', 'Motivo']],
      body: resultado.itens.map((i) => [
        i.codigo,
        i.titulo ?? 'CBO não encontrado',
        this.rotuloTipo(i),
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
        this.cabecalhoEstabelecimento(pdf, this.rotuloFilial(resultado), 'Detalhamento');
      },
    });
  }

  /** Faixa com o CNPJ no topo da página, separando um estabelecimento do outro. */
  private cabecalhoEstabelecimento(
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
  private caixaSituacao(
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
  private async desenharGraficos(
    pdf: import('jspdf').jsPDF,
    resultado: ResultadoCalculo,
    posicaoInicial: number,
  ): Promise<number> {
    const graficos = await this.renderizarGraficos(resultado);
    let posicao = this.garantirEspaco(pdf, posicaoInicial, ALTURA_BLOCO_GRAFICOS);

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
  private garantirEspaco(pdf: import('jspdf').jsPDF, posicao: number, altura: number): number {
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
  private rodapes(pdf: import('jspdf').jsPDF): void {
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

  // ---- gráficos ----

  /**
   * Renderiza os gráficos do estabelecimento como PNG, fora da tela. Os
   * relatórios saem em fundo branco, então usam a paleta do tema claro
   * (PALETA_RELATORIO) e não a do tema escolhido na tela.
   */
  private async renderizarGraficos(resultado: ResultadoCalculo): Promise<GraficosRelatorio> {
    const chartjs = await import('chart.js');
    const { Chart } = chartjs;
    Chart.register(
      chartjs.ArcElement,
      chartjs.BarController,
      chartjs.BarElement,
      chartjs.CategoryScale,
      chartjs.DoughnutController,
      chartjs.Legend,
      chartjs.LinearScale,
    );

    const fatias = fatiasComposicao(resultado);
    const base = resultado.base;
    const centro = {
      id: 'textoCentral',
      afterDraw(grafico: import('chart.js').Chart) {
        const { ctx, chartArea } = grafico;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `600 44px ${FONTE}`;
        ctx.fillStyle = TINTA_FORTE;
        ctx.fillText(String(base), x, y);
        ctx.font = `400 20px ${FONTE}`;
        ctx.fillStyle = TINTA;
        ctx.fillText('na base', x, y + 30);
        ctx.restore();
      },
    };

    const composicao: ChartConfiguration<'doughnut', number[], string> = {
      type: 'doughnut',
      data: {
        labels: fatias.map((f) => `${f.rotulo} — ${f.valor}`),
        datasets: [
          {
            data: fatias.map((f) => f.valor),
            backgroundColor: fatias.map((f) => PALETA_RELATORIO[f.corVar]),
            borderColor: '#ffffff', // espaçador entre fatias
            borderWidth: 4,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        cutout: '62%',
        layout: { padding: 16 },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: TINTA,
              boxWidth: 20,
              boxHeight: 20,
              usePointStyle: true,
              font: { size: 20 },
            },
          },
        },
      },
      plugins: [centro],
    };

    const barras = barrasCota(resultado);
    const valores = barras.map((b) => b.valor);
    const rotulos = {
      id: 'rotulosBarras',
      afterDatasetsDraw(grafico: import('chart.js').Chart) {
        const { ctx } = grafico;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = `600 22px ${FONTE}`;
        ctx.fillStyle = TINTA_FORTE;
        grafico.getDatasetMeta(0).data.forEach((barra, i) => {
          ctx.fillText(String(valores[i]), barra.x, barra.y - 10);
        });
        ctx.restore();
      },
    };

    const cota: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: {
        labels: barras.map((b) => b.rotulo),
        datasets: [
          {
            data: valores,
            backgroundColor: barras.map((b) => PALETA_RELATORIO[b.corVar]),
            borderRadius: 6,
            maxBarThickness: 160,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        layout: { padding: { top: 24, right: 16, bottom: 8, left: 8 } },
        scales: {
          x: { ticks: { color: TINTA, font: { size: 20 } }, grid: { display: false } },
          y: {
            beginAtZero: true,
            grace: '15%', // folga para o rótulo acima da barra mais alta
            ticks: { color: TINTA, precision: 0, font: { size: 18 } },
            grid: { color: PALETA_RELATORIO['--viz-grade'] },
          },
        },
        plugins: { legend: { display: false } },
      },
      plugins: [rotulos],
    };

    return {
      composicao: await this.paraPng(Chart, ROSCA_PX, composicao),
      cota: await this.paraPng(Chart, BARRAS_PX, cota),
    };
  }

  /** Desenha um gráfico num canvas fora da tela e devolve o PNG em data URL. */
  private async paraPng(
    Chart: typeof import('chart.js').Chart,
    tamanhoPx: { largura: number; altura: number },
    config: ChartConfiguration<'doughnut' | 'bar', number[], string>,
  ): Promise<string> {
    const tela = document.createElement('canvas');
    tela.width = tamanhoPx.largura;
    tela.height = tamanhoPx.altura;
    // Fora da área visível, mas no documento: o Chart.js precisa disso para
    // medir fontes corretamente.
    tela.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
    document.body.appendChild(tela);
    try {
      const contexto = tela.getContext('2d');
      if (contexto) {
        // O PNG sai transparente por padrão; no PDF isso vira fundo escuro.
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, tela.width, tela.height);
      }
      const grafico = new Chart(tela, config as ChartConfiguration);
      const url = tela.toDataURL('image/png');
      grafico.destroy();
      return url;
    } finally {
      tela.remove();
    }
  }

  /** Logo colorida (fundo claro) embutida no PDF; sem ela a capa sai só com texto. */
  private async logoDataUrl(): Promise<string | null> {
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

  // ---- conteúdo comum aos formatos ----

  /** `comOrientacao` só nos formatos sem caixa de destaque (CSV e planilha). */
  private linhasResumo(resultado: ResultadoCalculo, comOrientacao: boolean): string[][] {
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

  private rotuloFilial(resultado: ResultadoCalculo): string {
    return resultado.cnpj || 'Estabelecimento não informado';
  }

  private rotuloTipo(item: ItemResultado): string {
    return TIPOS.find((t) => t.valor === item.tipo)?.rotulo ?? item.tipo;
  }

  private baixar(blob: Blob, extensao: string): void {
    const url = URL.createObjectURL(blob);
    const ancora = document.createElement('a');
    ancora.href = url;
    ancora.download = this.nomeArquivo(extensao);
    ancora.click();
    URL.revokeObjectURL(url);
  }

  private nomeArquivo(extensao: string): string {
    const data = new Date().toISOString().slice(0, 10);
    return `relatorio-cota-aprendiz-${data}.${extensao}`;
  }
}
