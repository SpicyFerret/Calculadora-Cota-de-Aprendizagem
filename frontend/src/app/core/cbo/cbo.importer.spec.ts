import * as XLSX from 'xlsx';
import { lerBaseCbo } from './cbo.importer';

function planilhaXlsx(linhas: unknown[][]): File {
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Base CBO');
  const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new File([buffer], 'base.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function arquivoJson(conteudo: unknown): File {
  return new File([JSON.stringify(conteudo)], 'base.json', { type: 'application/json' });
}

function arquivoCsv(texto: string): File {
  return new File([texto], 'base.csv', { type: 'text/csv' });
}

describe('lerBaseCbo', () => {
  it('lê um JSON válido no formato BaseCbo', async () => {
    const { base, erros } = await lerBaseCbo(
      arquivoJson({
        geradoEm: '2026-08-01',
        fonte: 'teste',
        ocupacoes: [{ codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true }],
      }),
    );
    expect(erros).toEqual([]);
    expect(base?.geradoEm).toBe('2026-08-01');
    expect(base?.ocupacoes).toEqual([
      { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
    ]);
  });

  it('rejeita JSON sem o campo ocupacoes', async () => {
    const { base, erros } = await lerBaseCbo(arquivoJson({ geradoEm: '2026-08-01' }));
    expect(base).toBeNull();
    expect(erros[0]).toContain('ocupacoes');
  });

  it('rejeita JSON malformado', async () => {
    const arquivo = new File(['{ nao é json'], 'base.json', { type: 'application/json' });
    const { base, erros } = await lerBaseCbo(arquivo);
    expect(base).toBeNull();
    expect(erros[0]).toContain('inválido');
  });

  it('lê um CSV com as 3 colunas exportadas (CBO;Título;Exige Formação Profissional)', async () => {
    const csv = 'CBO;Título;Exige Formação Profissional\r\n411010;Assistente administrativo;Sim\r\n212405;Analista de sistemas;Não\r\n';
    const { base, erros } = await lerBaseCbo(arquivoCsv(csv));
    expect(erros).toEqual([]);
    expect(base?.ocupacoes).toEqual([
      { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
      { codigo: '212405', titulo: 'Analista de sistemas', exigeFormacaoProfissional: false },
    ]);
  });

  it('lê um XLSX com as mesmas 3 colunas', async () => {
    const arquivo = planilhaXlsx([
      ['CBO', 'Título', 'Exige Formação Profissional'],
      ['411010', 'Assistente administrativo', 'Sim'],
    ]);
    const { base, erros } = await lerBaseCbo(arquivo);
    expect(erros).toEqual([]);
    expect(base?.ocupacoes).toEqual([
      { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
    ]);
  });

  it('rejeita planilha com cabeçalho não reconhecido', async () => {
    const arquivo = planilhaXlsx([['A', 'B', 'C'], ['1', '2', '3']]);
    const { base, erros } = await lerBaseCbo(arquivo);
    expect(base).toBeNull();
    expect(erros[0]).toContain('Cabeçalho não reconhecido');
  });

  it('rejeita linhas com código fora do padrão de 6 dígitos, mas mantém as válidas', async () => {
    const csv = 'CBO;Título;Exige Formação Profissional\r\n4110;Código curto demais;Sim\r\n212405;Analista de sistemas;Não\r\n';
    const { base, erros } = await lerBaseCbo(arquivoCsv(csv));
    expect(erros.length).toBe(1);
    expect(erros[0]).toContain('inválido');
    expect(base?.ocupacoes).toEqual([
      { codigo: '212405', titulo: 'Analista de sistemas', exigeFormacaoProfissional: false },
    ]);
  });
});
