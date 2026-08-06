import { TestBed } from '@angular/core/testing';
import { CboService } from './cbo.service';

describe('CboService', () => {
  let servico: CboService;

  beforeEach(() => {
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
});
