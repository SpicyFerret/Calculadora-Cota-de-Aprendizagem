import { BaseCbo } from '../modelos/modelos';

const CABECALHO = ['CBO', 'Título', 'Exige Formação Profissional'];

function nomeArquivoCbo(extensao: string): string {
  const data = new Date().toISOString().slice(0, 10);
  return `base-cbo-${data}.${extensao}`;
}

function baixarCbo(blob: Blob, extensao: string): void {
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeArquivoCbo(extensao);
  ancora.click();
  URL.revokeObjectURL(url);
}

export function baixarCboJson(base: BaseCbo): void {
  const texto = JSON.stringify(base, null, 1);
  baixarCbo(new Blob([texto], { type: 'application/json;charset=utf-8' }), 'json');
}

export async function baixarCboCsv(base: BaseCbo): Promise<void> {
  const linhas: string[][] = [
    CABECALHO,
    ...base.ocupacoes.map((o) => [o.codigo, o.titulo, o.exigeFormacaoProfissional ? 'Sim' : 'Não']),
  ];
  const csv = linhas
    .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  // BOM para o Excel pt-BR abrir como UTF-8
  baixarCbo(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
}

export async function baixarCboXlsx(base: BaseCbo): Promise<void> {
  const XLSX = await import('xlsx');
  const linhas: (string | number)[][] = [
    CABECALHO,
    ...base.ocupacoes.map((o) => [o.codigo, o.titulo, o.exigeFormacaoProfissional ? 'Sim' : 'Não']),
  ];
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  aba['!cols'] = [{ wch: 10 }, { wch: 60 }, { wch: 26 }];

  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Base CBO');
  const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  baixarCbo(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'xlsx',
  );
}
