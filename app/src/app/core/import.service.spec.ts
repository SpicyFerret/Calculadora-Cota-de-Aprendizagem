import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx';
import { CboService } from './cbo.service';
import { ImportService } from './import.service';

const BASE_TESTE = {
  geradoEm: '2026-07-10',
  fonte: 'teste',
  ocupacoes: [
    { codigo: '411010', titulo: 'Assistente administrativo' },
    { codigo: '514320', titulo: 'Faxineiro' },
    { codigo: '212405', titulo: 'Analista de sistemas' },
  ],
};

function planilha(linhas: unknown[][]): ArrayBuffer {
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Dados');
  return XLSX.write(pasta, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('ImportService', () => {
  let servico: ImportService;

  beforeEach(() => {
    servico = TestBed.inject(ImportService);
    TestBed.inject(CboService).usarBase(BASE_TESTE);
  });

  it('importa o formato agregado (CBO;TIPO;QUANTIDADE)', async () => {
    const r = await servico.importarPlanilha(
      planilha([
        ['CBO', 'TIPO', 'QUANTIDADE'],
        ['411010', 'CLT', 12],
        ['4110-10', 'PCD', 1],
        ['514320', 'Estagiário', 2],
        ['212405', 'Aprendiz', 1],
      ]),
    );
    expect(r.formato).toBe('agregado');
    expect(r.erros).toEqual([]);
    expect(r.linhas).toEqual([
      { cbo: '411010', tipo: 'CLT', quantidade: 12 },
      { cbo: '411010', tipo: 'PCD', quantidade: 1 },
      { cbo: '514320', tipo: 'ESTAGIARIO', quantidade: 2 },
      { cbo: '212405', tipo: 'APRENDIZ', quantidade: 1 },
    ]);
  });

  it('importa o formato lista (NOME;CBO;TIPO), 1 pessoa por linha', async () => {
    const r = await servico.importarPlanilha(
      planilha([
        ['NOME', 'CBO', 'TIPO'],
        ['Ana', '411010', 'CLT'],
        ['Bia', '411010', 'clt'],
        ['Caio', '514320', 'Jovem Aprendiz'],
      ]),
    );
    expect(r.formato).toBe('lista');
    expect(r.erros).toEqual([]);
    expect(r.linhas.length).toBe(3);
    expect(r.linhas.every((l) => l.quantidade === 1)).toBe(true);
  });

  it('acusa erros por linha sem derrubar a importação', async () => {
    const r = await servico.importarPlanilha(
      planilha([
        ['CBO', 'TIPO', 'QUANTIDADE'],
        ['411010', 'CLT', 5],
        ['123', 'CLT', 1], // CBO curto
        ['999999', 'CLT', 1], // não existe
        ['514320', 'Sócio', 1], // tipo desconhecido
        ['514320', 'CLT', 0], // quantidade inválida
      ]),
    );
    expect(r.linhas.length).toBe(1);
    expect(r.erros.length).toBe(4);
    expect(r.erros[0]).toContain('Linha 3');
  });

  it('rejeita cabeçalho sem as colunas obrigatórias', async () => {
    const r = await servico.importarPlanilha(planilha([['A', 'B'], ['1', '2']]));
    expect(r.linhas).toEqual([]);
    expect(r.erros[0]).toContain('Cabeçalho');
  });
});
