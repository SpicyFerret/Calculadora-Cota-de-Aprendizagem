import { ResultadoCalculo } from './modelos';
import { avaliarSituacao } from './situacao';

function resultado(parcial: Partial<ResultadoCalculo>): ResultadoCalculo {
  return {
    cnpj: '',
    itens: [],
    totalPessoas: 0,
    base: 0,
    obrigada: true,
    minimo: 0,
    maximo: 0,
    aprendizesAtuais: 0,
    deficit: 0,
    excedente: 0,
    composicao: {
      entramNaBase: 0,
      excluidosPeloCbo: 0,
      aprendizes: 0,
      estagiarios: 0,
      afastadosInss: 0,
      terceirizados: 0,
      temporarios: 0,
      excluidosManualmente: 0,
    },
    calculadoEm: new Date(),
    ...parcial,
  };
}

describe('avaliarSituacao', () => {
  it('déficit exige ação e diz quantos contratar', () => {
    const s = avaliarSituacao(
      resultado({ base: 100, minimo: 5, maximo: 15, aprendizesAtuais: 2, deficit: 3 }),
    );
    expect(s.precisaAgir).toBe(true);
    expect(s.chamada).toBe('Ação necessária');
    expect(s.rotulo).toBe('Déficit de 3');
    expect(s.orientacao).toContain('Contratar 3 aprendizes');
  });

  it('base abaixo de 7 não exige ação', () => {
    const s = avaliarSituacao(resultado({ base: 6, obrigada: false }));
    expect(s.precisaAgir).toBe(false);
    expect(s.chamada).toBe('Nenhuma ação necessária');
    expect(s.rotulo).toBe('Isenta (base < 7)');
    expect(s.orientacao).toContain('facultativo');
  });

  it('cota cumprida não exige ação', () => {
    const s = avaliarSituacao(
      resultado({ base: 20, minimo: 1, maximo: 3, aprendizesAtuais: 1, deficit: 0 }),
    );
    expect(s.precisaAgir).toBe(false);
    expect(s.rotulo).toBe('Cota cumprida');
    expect(s.orientacao).toContain('está cumprida');
  });

  it('excedente exige ação, mesmo sem déficit', () => {
    const s = avaliarSituacao(
      resultado({ base: 20, minimo: 1, maximo: 3, aprendizesAtuais: 5, excedente: 2 }),
    );
    expect(s.precisaAgir).toBe(true);
    expect(s.rotulo).toBe('2 acima da máxima');
    expect(s.orientacao).toContain('2 contratos');
  });

  it('concorda em número com valores no singular', () => {
    const s = avaliarSituacao(
      resultado({ base: 7, minimo: 1, maximo: 2, aprendizesAtuais: 0, deficit: 1 }),
    );
    expect(s.orientacao).toContain('Contratar 1 aprendiz ');
    expect(s.orientacao).toContain('tem 0 aprendizes');
  });
});
