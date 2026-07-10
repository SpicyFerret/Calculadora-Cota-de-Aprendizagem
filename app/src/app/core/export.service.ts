import { Injectable, inject } from '@angular/core';
import { CboService } from './cbo.service';
import { ItemResultado, ResultadoCalculo, TIPOS } from './modelos';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private cbo = inject(CboService);

  baixarCsv(resultado: ResultadoCalculo): void {
    const linhas = [
      ['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
      ...resultado.itens.map((i) => [
        i.codigo,
        i.titulo ?? 'CBO não encontrado',
        this.rotuloTipo(i),
        String(i.quantidade),
        i.entraNaBase ? 'Sim' : 'Não',
        i.motivo,
      ]),
      [],
      ...this.linhasResumo(resultado),
    ];
    const csv = linhas
      .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    // BOM para o Excel pt-BR abrir como UTF-8
    this.baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
  }

  async baixarXlsx(resultado: ResultadoCalculo): Promise<void> {
    const XLSX = await import('xlsx');
    const resumo = XLSX.utils.aoa_to_sheet([
      ['Relatório — Cota de Aprendizagem'],
      [],
      ...this.linhasResumo(resultado),
    ]);
    const detalhado = XLSX.utils.aoa_to_sheet([
      ['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
      ...resultado.itens.map((i) => [
        i.codigo,
        i.titulo ?? 'CBO não encontrado',
        this.rotuloTipo(i),
        i.quantidade,
        i.entraNaBase ? 'Sim' : 'Não',
        i.motivo,
      ]),
    ]);
    detalhado['!cols'] = [{ wch: 8 }, { wch: 50 }, { wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 60 }];
    resumo['!cols'] = [{ wch: 42 }, { wch: 14 }];

    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, resumo, 'Resumo');
    XLSX.utils.book_append_sheet(pasta, detalhado, 'Detalhado por CBO');
    const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' });
    this.baixar(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'xlsx',
    );
  }

  async baixarPdf(resultado: ResultadoCalculo): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text('Relatório — Cota de Aprendizagem', 14, 18);
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(
      `Gerado em ${resultado.calculadoEm.toLocaleString('pt-BR')} · Base CBO de ${this.cbo.geradoEm()} (${this.cbo.fonte()})`,
      14,
      25,
    );

    autoTable(pdf, {
      startY: 32,
      head: [['Resumo', '']],
      body: this.linhasResumo(resultado),
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: 'right', fontStyle: 'bold' } },
    });

    autoTable(pdf, {
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
      headStyles: { fillColor: [14, 147, 163] },
      columnStyles: { 3: { halign: 'right' } },
    });

    const posicaoFinal = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text(
      'Estimativa com base na CLT art. 429 e no Decreto 9.579/2018; não substitui orientação jurídica.\n' +
        'ME, EPP e entidades sem fins lucrativos de formação profissional são dispensadas da cota.',
      14,
      Math.min(posicaoFinal + 10, 285),
    );
    pdf.save(this.nomeArquivo('pdf'));
  }

  private linhasResumo(resultado: ResultadoCalculo): string[][] {
    return [
      ['Funcionários informados', String(resultado.totalPessoas)],
      ['Base de cálculo (funções que demandam formação profissional)', String(resultado.base)],
      ['Cota mínima (5%, frações arredondadas para cima)', String(resultado.minimo)],
      ['Cota máxima (15%)', String(resultado.maximo)],
      ['Aprendizes atuais', String(resultado.aprendizesAtuais)],
      [
        !resultado.obrigada ? 'Situação' : resultado.deficit > 0 ? 'Aprendizes a contratar (déficit)' : 'Situação',
        !resultado.obrigada
          ? 'Não obrigada: menos de 7 funcionários na base (contratação facultativa)'
          : resultado.deficit > 0
            ? String(resultado.deficit)
            : 'Cota mínima cumprida',
      ],
    ];
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
