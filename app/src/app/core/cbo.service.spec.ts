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
        { codigo: '411010', titulo: 'Assistente administrativo' },
        { codigo: '411005', titulo: 'Auxiliar de escritório' },
        { codigo: '212405', titulo: 'Analista de desenvolvimento de sistemas' },
      ],
    });
  });

  it('normaliza códigos com máscara', () => {
    expect(servico.normalizar('4110-10')).toBe('411010');
    expect(servico.normalizar(' 4110.10 ')).toBe('411010');
  });

  it('classifica GG 4–9 como incluso e GG 0–3 como excluído', () => {
    expect(servico.classificar('411010').entra).toBe(true);
    expect(servico.classificar('514320').entra).toBe(true);
    expect(servico.classificar('992225').entra).toBe(true);
    expect(servico.classificar('010105').entra).toBe(false);
    expect(servico.classificar('142105').entra).toBe(false);
    expect(servico.classificar('212405').entra).toBe(false);
    expect(servico.classificar('351305').entra).toBe(false);
  });

  it('pesquisa por prefixo de código e por trecho do título', () => {
    expect(servico.pesquisar('4110').length).toBe(2);
    expect(servico.pesquisar('sistemas')[0].codigo).toBe('212405');
    expect(servico.pesquisar('')).toEqual([]);
  });
});
