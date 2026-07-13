import { Injectable, inject } from '@angular/core';
import { CboService } from './cbo.service';
import { ItemResultado, ResultadoCalculo, TIPOS } from './modelos';

const URL_CONTRATAR = 'https://gerar.org.br/projeto/aprendiz-gerar/';

// Identidade Aprendiz Gerar
const AZUL_MARCA: [number, number, number] = [39, 46, 97]; // #272E61
const VERDE_MARCA_TEXTO: [number, number, number] = [0, 133, 124]; // verde-água escurecido p/ texto

@Injectable({ providedIn: 'root' })
export class ExportService {
  private cbo = inject(CboService);

  async baixarCsv(resultados: ResultadoCalculo[]): Promise<void> {
    const linhas: string[][] = [
      ['Estabelecimento', 'CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
    ];
    for (const r of resultados) {
      for (const i of r.itens) {
        linhas.push([
          this.rotuloFilial(r),
          i.codigo,
          i.titulo ?? 'CBO não encontrado',
          this.rotuloTipo(i),
          String(i.quantidade),
          i.entraNaBase ? 'Sim' : 'Não',
          i.motivo,
        ]);
      }
    }
    for (const r of resultados) {
      linhas.push([]);
      linhas.push([`Resumo — ${this.rotuloFilial(r)}`]);
      linhas.push(...this.linhasResumo(r));
    }
    linhas.push([], ['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);
    const csv = linhas
      .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    // BOM para o Excel pt-BR abrir como UTF-8
    this.baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
  }

  async baixarXlsx(resultados: ResultadoCalculo[]): Promise<void> {
    const XLSX = await import('xlsx');

    const linhasResumo: (string | number)[][] = [['Relatório — Cota de Aprendizagem']];
    for (const r of resultados) {
      linhasResumo.push([], [`Estabelecimento: ${this.rotuloFilial(r)}`], ...this.linhasResumo(r));
    }
    linhasResumo.push([], ['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);
    const resumo = XLSX.utils.aoa_to_sheet(linhasResumo);
    resumo['!cols'] = [{ wch: 52 }, { wch: 20 }];
    // Hiperlink clicável na célula da URL
    const celulaUrl = XLSX.utils.encode_cell({ r: linhasResumo.length - 1, c: 1 });
    resumo[celulaUrl].l = { Target: URL_CONTRATAR };

    const detalhado = XLSX.utils.aoa_to_sheet([
      ['Estabelecimento', 'CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
      ...resultados.flatMap((r) =>
        r.itens.map((i) => [
          this.rotuloFilial(r),
          i.codigo,
          i.titulo ?? 'CBO não encontrado',
          this.rotuloTipo(i),
          i.quantidade,
          i.entraNaBase ? 'Sim' : 'Não',
          i.motivo,
        ]),
      ),
    ]);
    detalhado['!cols'] = [
      { wch: 20 },
      { wch: 8 },
      { wch: 50 },
      { wch: 12 },
      { wch: 11 },
      { wch: 14 },
      { wch: 60 },
    ];

    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, resumo, 'Resumo');
    XLSX.utils.book_append_sheet(pasta, detalhado, 'Detalhado por CBO');
    const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' });
    this.baixar(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'xlsx',
    );
  }

  async baixarPdf(resultados: ResultadoCalculo[]): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const pdf = new jsPDF();
    const logo = await this.logoDataUrl();
    if (logo) {
      // Logo horizontal 1849×824 px → 36×16 mm, alinhada à margem direita
      pdf.addImage(logo, 'PNG', 160, 8, 36, 16);
    }
    pdf.setFontSize(16);
    pdf.setTextColor(...AZUL_MARCA);
    pdf.text('Relatório — Cota de Aprendizagem', 14, 18);
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(
      [
        `Gerado em ${new Date().toLocaleString('pt-BR')}`,
        `Base CBO de ${this.cbo.geradoEm()} (${this.cbo.fonte()})`,
      ],
      14,
      25,
    );

    let posicao = 36;
    for (const r of resultados) {
      autoTable(pdf, {
        startY: posicao,
        head: [[`Resumo — ${this.rotuloFilial(r)}`, '']],
        body: this.linhasResumo(r),
        theme: 'plain',
        styles: { fontSize: 10 },
        headStyles: { fontStyle: 'bold', textColor: AZUL_MARCA },
        columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
      });
      posicao = this.posicaoFinal(pdf) + 6;
    }

    autoTable(pdf, {
      startY: posicao,
      head: [['Estab.', 'CBO', 'Título', 'Tipo', 'Qtd.', 'Base', 'Motivo']],
      body: resultados.flatMap((r) =>
        r.itens.map((i) => [
          this.rotuloFilial(r),
          i.codigo,
          i.titulo ?? 'CBO não encontrado',
          this.rotuloTipo(i),
          i.quantidade,
          i.entraNaBase ? 'Sim' : 'Não',
          i.motivo,
        ]),
      ),
      styles: { fontSize: 8 },
      headStyles: { fillColor: AZUL_MARCA, textColor: 255 },
      columnStyles: { 4: { halign: 'right' } },
    });

    const posicaoAvisos = Math.min(this.posicaoFinal(pdf) + 10, 272);
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text(
      'Estimativa com base na CLT art. 429 e no Decreto 9.579/2018; não substitui orientação jurídica.\n' +
        'A obrigação só existe com 7+ funcionários na base, por estabelecimento (CNPJ).\n' +
        'ME, EPP e entidades sem fins lucrativos de formação profissional são dispensadas da cota.',
      14,
      posicaoAvisos,
    );
    pdf.setFontSize(10);
    pdf.setTextColor(...VERDE_MARCA_TEXTO);
    pdf.textWithLink('Contrate aprendizes com a GERAR: gerar.org.br/projeto/aprendiz-gerar', 14, posicaoAvisos + 14, {
      url: URL_CONTRATAR,
    });
    pdf.save(this.nomeArquivo('pdf'));
  }

  /** Logo colorida (fundo claro) embutida no PDF; sem ela o relatório sai só com texto. */
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

  private posicaoFinal(pdf: unknown): number {
    return (pdf as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }

  private linhasResumo(resultado: ResultadoCalculo): string[][] {
    const linhas = [
      ['Funcionários informados', String(resultado.totalPessoas)],
      ['Base de cálculo (funções que demandam formação profissional)', String(resultado.base)],
      ['Cota mínima (5%, frações arredondadas para cima)', String(resultado.minimo)],
      ['Cota máxima (15%)', String(resultado.maximo)],
      ['Aprendizes atuais', String(resultado.aprendizesAtuais)],
    ];
    if (!resultado.obrigada) {
      linhas.push(['Situação', 'Não obrigada: menos de 7 funcionários na base (contratação facultativa)']);
    } else if (resultado.deficit > 0) {
      linhas.push(['Aprendizes a contratar (déficit)', String(resultado.deficit)]);
    } else {
      linhas.push(['Situação', 'Cota mínima cumprida']);
    }
    if (resultado.excedente > 0) {
      linhas.push([
        'Atenção: aprendizes acima da cota máxima de 15%',
        String(resultado.excedente),
      ]);
    }
    return linhas;
  }

  private rotuloFilial(resultado: ResultadoCalculo): string {
    return resultado.cnpj || 'Não informado';
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
