import { TestBed } from '@angular/core/testing';
import { CboService } from './cbo.service';

describe('CboService', () => {
  let servico: CboService;

  beforeEach(() => {
    localStorage.clear();
    servico = TestBed.inject(CboService);
    servico.usarBase({
      geradoEm: '2026-07-10',
      fonte: 'teste',
      ocupacoes: [
        { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
        { codigo: '411005', titulo: 'Auxiliar de escritório', exigeFormacaoProfissional: true },
        { codigo: '212405', titulo: 'Analista de desenvolvimento de sistemas', exigeFormacaoProfissional: false },
        { codigo: '514320', titulo: 'Vendedor', exigeFormacaoProfissional: true },
        { codigo: '992225', titulo: 'Trabalhador de manutenção', exigeFormacaoProfissional: true },
        { codigo: '010105', titulo: 'Oficial das forças armadas', exigeFormacaoProfissional: false },
        { codigo: '142105', titulo: 'Diretor geral', exigeFormacaoProfissional: false },
        { codigo: '351305', titulo: 'Técnico de nível médio', exigeFormacaoProfissional: false },
        { codigo: '410230', titulo: 'Supervisor de câmbio', exigeFormacaoProfissional: false },
      ],
    });
  });

  it('normaliza códigos com máscara', () => {
    expect(servico.normalizar('4110-10')).toBe('411010');
    expect(servico.normalizar(' 4110.10 ')).toBe('411010');
  });

  it('classifica pela flag exigeFormacaoProfissional vinda da base (ficha oficial do MTE)', () => {
    expect(servico.classificar('411010').entra).toBe(true);
    expect(servico.classificar('514320').entra).toBe(true);
    expect(servico.classificar('992225').entra).toBe(true);
    expect(servico.classificar('010105').entra).toBe(false);
    expect(servico.classificar('142105').entra).toBe(false);
    expect(servico.classificar('212405').entra).toBe(false);
    expect(servico.classificar('351305').entra).toBe(false);
  });

  it('exclui família 4102 (exige curso técnico, não formação profissional do art. 429)', () => {
    expect(servico.classificar('410230').entra).toBe(false);
  });

  it('pesquisa por prefixo de código e por trecho do título', () => {
    expect(servico.pesquisar('4110').length).toBe(2);
    expect(servico.pesquisar('sistemas')[0].codigo).toBe('212405');
    expect(servico.pesquisar('')).toEqual([]);
  });

  it('linka a busca oficial por código e mostra o código da família a digitar', () => {
    expect(servico.linkFicha('410230')).toContain('cbo.mte.gov.br');
    expect(servico.descricaoFicha('4102-30')).toBe('4102');
  });

  it('baseAtual() devolve a base ativa no formato exportável', () => {
    const base = servico.baseAtual();
    expect(base.geradoEm).toBe('2026-07-10');
    expect(base.ocupacoes.length).toBe(9);
  });

  describe('importar()', () => {
    const baseCustomizada = {
      geradoEm: '2026-08-01',
      fonte: 'Base importada manualmente pelo usuário',
      ocupacoes: [{ codigo: '999999', titulo: 'Ocupação de teste', exigeFormacaoProfissional: true }],
    };

    it('troca a base ativa e marca como customizada', () => {
      servico.importar(baseCustomizada);
      expect(servico.customizada()).toBe(true);
      expect(servico.existe('999999')).toBe(true);
      expect(servico.existe('411010')).toBe(false);
    });

    it('persiste a base no localStorage', () => {
      servico.importar(baseCustomizada);
      const salvo = localStorage.getItem('cota-aprendiz.base-cbo-customizada');
      expect(salvo).toBeTruthy();
      expect(JSON.parse(salvo!)).toEqual(baseCustomizada);
    });

    it('carregar() usa a base salva em vez de buscar o cbo.json padrão quando existe uma customizada', async () => {
      localStorage.setItem('cota-aprendiz.base-cbo-customizada', JSON.stringify(baseCustomizada));
      const novoServico = TestBed.inject(CboService);
      await novoServico.carregar();
      expect(novoServico.customizada()).toBe(true);
      expect(novoServico.existe('999999')).toBe(true);
    });
  });

  describe('restaurarPadrao()', () => {
    it('remove a base salva e marca como não customizada', async () => {
      servico.importar({
        geradoEm: '2026-08-01',
        fonte: 'teste',
        ocupacoes: [{ codigo: '999999', titulo: 'X', exigeFormacaoProfissional: true }],
      });
      expect(servico.customizada()).toBe(true);

      // fetch indisponível no ambiente de teste: só valida que a chave some e o flag muda.
      await servico.restaurarPadrao().catch(() => undefined);
      expect(localStorage.getItem('cota-aprendiz.base-cbo-customizada')).toBeNull();
      expect(servico.customizada()).toBe(false);
    });
  });
});
