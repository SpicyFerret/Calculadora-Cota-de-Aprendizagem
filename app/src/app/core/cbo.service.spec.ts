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
        { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true, livro: 1, paginaLivro: 696 },
        { codigo: '411005', titulo: 'Auxiliar de escritório', exigeFormacaoProfissional: true, livro: 1, paginaLivro: 696 },
        {
          codigo: '212405',
          titulo: 'Analista de desenvolvimento de sistemas',
          exigeFormacaoProfissional: false,
          livro: 1,
          paginaLivro: 182,
        },
        { codigo: '514320', titulo: 'Vendedor', exigeFormacaoProfissional: true, livro: 1, paginaLivro: 400 },
        { codigo: '992225', titulo: 'Trabalhador de manutenção', exigeFormacaoProfissional: true, livro: 2, paginaLivro: 500 },
        { codigo: '010105', titulo: 'Oficial das forças armadas', exigeFormacaoProfissional: false, livro: 1, paginaLivro: 1 },
        { codigo: '142105', titulo: 'Diretor geral', exigeFormacaoProfissional: false, livro: 1, paginaLivro: 50 },
        { codigo: '351305', titulo: 'Técnico de nível médio', exigeFormacaoProfissional: false, livro: 1, paginaLivro: 300 },
        { codigo: '410230', titulo: 'Supervisor de câmbio', exigeFormacaoProfissional: false, livro: 1, paginaLivro: 694 },
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

  it('linka a ficha da família na página certa do livro certo', () => {
    expect(servico.linkFicha('410230')).toContain('livro-1-portal-cbo.pdf#page=694');
    expect(servico.linkFicha('992225')).toContain('cbo2002_liv2.pdf#page=500');
  });
});
