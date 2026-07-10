import { TestBed } from '@angular/core/testing';
import { CalculoService } from './calculo.service';
import { CboService } from './cbo.service';
import { LinhaQuadro } from './modelos';

const BASE_TESTE = {
  geradoEm: '2026-07-10',
  fonte: 'teste',
  ocupacoes: [
    { codigo: '411010', titulo: 'Assistente administrativo' },
    { codigo: '514320', titulo: 'Faxineiro' },
    { codigo: '212405', titulo: 'Analista de sistemas' }, // GG 2 — nível superior
    { codigo: '142105', titulo: 'Gerente administrativo' }, // GG 1 — direção/gerência
    { codigo: '351305', titulo: 'Técnico em administração' }, // GG 3 — técnico
    { codigo: '010105', titulo: 'Oficial general' }, // GG 0 — militar
  ],
};

describe('CalculoService', () => {
  let servico: CalculoService;

  beforeEach(() => {
    servico = TestBed.inject(CalculoService);
    TestBed.inject(CboService).usarBase(BASE_TESTE);
  });

  async function calcular(linhas: LinhaQuadro[], excluidos: Set<string> = new Set()) {
    return servico.calcular(linhas, excluidos);
  }

  it('arredonda frações para cima (base 47 → mínimo 3, máximo 8)', async () => {
    const r = await calcular([{ cbo: '411010', tipo: 'CLT', quantidade: 47 }]);
    expect(r.base).toBe(47);
    expect(r.minimo).toBe(3); // 5% de 47 = 2,35
    expect(r.maximo).toBe(8); // 15% de 47 = 7,05
  });

  it('não arredonda quando o percentual é exato (base 40 → mínimo 2, máximo 6)', async () => {
    const r = await calcular([{ cbo: '411010', tipo: 'CLT', quantidade: 40 }]);
    expect(r.minimo).toBe(2);
    expect(r.maximo).toBe(6);
  });

  it('com menos de 7 na base não há obrigação (base 6 → mínimo 0)', async () => {
    const r = await calcular([{ cbo: '411010', tipo: 'CLT', quantidade: 6 }]);
    expect(r.obrigada).toBe(false);
    expect(r.minimo).toBe(0);
    expect(r.deficit).toBe(0);
  });

  it('com 7 na base a obrigação começa (base 7 → mínimo 1)', async () => {
    const r = await calcular([{ cbo: '411010', tipo: 'CLT', quantidade: 7 }]);
    expect(r.obrigada).toBe(true);
    expect(r.minimo).toBe(1);
    expect(r.deficit).toBe(1);
  });

  it('exclui da base os Grandes Grupos 0, 1, 2 e 3', async () => {
    const r = await calcular([
      { cbo: '411010', tipo: 'CLT', quantidade: 10 }, // entra
      { cbo: '010105', tipo: 'CLT', quantidade: 1 },
      { cbo: '142105', tipo: 'CLT', quantidade: 2 },
      { cbo: '212405', tipo: 'CLT', quantidade: 3 },
      { cbo: '351305', tipo: 'CLT', quantidade: 4 },
    ]);
    expect(r.base).toBe(10);
    expect(r.composicao.excluidosPeloCbo).toBe(10);
    const motivos = r.itens.filter((i) => !i.entraNaBase).map((i) => i.motivo);
    expect(motivos.some((m) => m.includes('direção e gerência'))).toBe(true);
    expect(motivos.some((m) => m.includes('nível superior'))).toBe(true);
    expect(motivos.some((m) => m.includes('técnicos de nível médio'))).toBe(true);
  });

  it('PCD conta na base; estagiário e aprendiz não contam', async () => {
    const r = await calcular([
      { cbo: '411010', tipo: 'CLT', quantidade: 10 },
      { cbo: '411010', tipo: 'PCD', quantidade: 2 },
      { cbo: '411010', tipo: 'ESTAGIARIO', quantidade: 5 },
      { cbo: '411010', tipo: 'APRENDIZ', quantidade: 1 },
    ]);
    expect(r.base).toBe(12);
    expect(r.aprendizesAtuais).toBe(1);
    expect(r.composicao.estagiarios).toBe(5);
  });

  it('calcula o déficit em relação à cota mínima', async () => {
    const r = await calcular([
      { cbo: '411010', tipo: 'CLT', quantidade: 100 },
      { cbo: '411010', tipo: 'APRENDIZ', quantidade: 2 },
    ]);
    expect(r.minimo).toBe(5);
    expect(r.deficit).toBe(3);
  });

  it('acusa excedente quando os aprendizes passam da cota máxima', async () => {
    const r = await calcular([
      { cbo: '411010', tipo: 'CLT', quantidade: 20 }, // máxima = ceil(3) = 3
      { cbo: '411010', tipo: 'APRENDIZ', quantidade: 5 },
    ]);
    expect(r.maximo).toBe(3);
    expect(r.excedente).toBe(2);
    expect(r.deficit).toBe(0);
  });

  it('calcula a cota por estabelecimento (CNPJ), não pelo total', async () => {
    const grupos = [
      { cnpj: '11.111.111/0001-11', linhas: [{ cbo: '411010', tipo: 'CLT' as const, quantidade: 7 }] },
      { cnpj: '11.111.111/0002-22', linhas: [{ cbo: '514320', tipo: 'CLT' as const, quantidade: 6 }] },
    ];
    const resultados = await servico.calcularGrupos(grupos);
    expect(resultados.length).toBe(2);
    expect(resultados[0].cnpj).toBe('11.111.111/0001-11');
    expect(resultados[0].minimo).toBe(1); // 7 na base → obrigada
    expect(resultados[1].obrigada).toBe(false); // 6 na base → isenta
    expect(resultados[1].minimo).toBe(0);
  });

  it('déficit zero quando a cota mínima está cumprida', async () => {
    const r = await calcular([
      { cbo: '411010', tipo: 'CLT', quantidade: 20 },
      { cbo: '411010', tipo: 'APRENDIZ', quantidade: 1 },
    ]);
    expect(r.minimo).toBe(1);
    expect(r.deficit).toBe(0);
  });

  it('exclusão manual tira o CBO da base (cargo de confiança)', async () => {
    const r = await calcular(
      [
        { cbo: '411010', tipo: 'CLT', quantidade: 10 },
        { cbo: '514320', tipo: 'CLT', quantidade: 10 },
      ],
      new Set(['514320']),
    );
    expect(r.base).toBe(10);
    expect(r.composicao.excluidosManualmente).toBe(10);
  });

  it('recalcular reflete mudança nas exclusões manuais', async () => {
    const original = await calcular([{ cbo: '411010', tipo: 'CLT', quantidade: 20 }]);
    const alterado = servico.recalcular(original, new Set(['411010']));
    expect(alterado.base).toBe(0);
    expect(alterado.minimo).toBe(0);
    const revertido = servico.recalcular(alterado, new Set());
    expect(revertido.base).toBe(20);
  });

  it('CBO não encontrado fica fora da base, com motivo', async () => {
    const r = await calcular([
      { cbo: '999999', tipo: 'CLT', quantidade: 5 },
      { cbo: '411010', tipo: 'CLT', quantidade: 5 },
    ]);
    expect(r.base).toBe(5);
    const item = r.itens.find((i) => i.codigo === '999999');
    expect(item?.entraNaBase).toBe(false);
    expect(item?.motivo).toContain('não encontrado');
  });

  it('agrega linhas repetidas do mesmo CBO e tipo e aceita código com máscara', async () => {
    const r = await calcular([
      { cbo: '4110-10', tipo: 'CLT', quantidade: 3 },
      { cbo: '411010', tipo: 'CLT', quantidade: 4 },
    ]);
    expect(r.itens.length).toBe(1);
    expect(r.itens[0].quantidade).toBe(7);
  });

  it('reporta progresso até 100', async () => {
    const percentuais: number[] = [];
    await servico.calcular(
      [{ cbo: '411010', tipo: 'CLT', quantidade: 10 }],
      new Set(),
      (p) => percentuais.push(p),
    );
    expect(percentuais.at(-1)).toBe(100);
  });
});
