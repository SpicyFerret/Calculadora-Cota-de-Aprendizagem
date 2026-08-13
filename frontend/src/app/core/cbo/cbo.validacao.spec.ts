import { Ocupacao } from '../modelos/modelos';
import { validarCampoOcupacao } from './cbo.validacao';

describe('validarCampoOcupacao()', () => {
  const existentes: Ocupacao[] = [
    { codigo: '411010', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
    { codigo: '514320', titulo: 'Vendedor', exigeFormacaoProfissional: true },
  ];

  it('aceita uma ocupação nova válida', () => {
    const erros = validarCampoOcupacao(
      { codigo: '999999', titulo: 'Ocupação de teste', exigeFormacaoProfissional: false },
      existentes,
      null,
    );
    expect(erros).toEqual({});
  });

  it('rejeita código com menos de 6 dígitos', () => {
    const erros = validarCampoOcupacao({ codigo: '4110', titulo: 'X', exigeFormacaoProfissional: false }, existentes, null);
    expect(erros.codigo).toBeTruthy();
  });

  it('rejeita código com mais de 6 dígitos', () => {
    const erros = validarCampoOcupacao(
      { codigo: '4110100', titulo: 'X', exigeFormacaoProfissional: false },
      existentes,
      null,
    );
    expect(erros.codigo).toBeTruthy();
  });

  it('rejeita título vazio ou só espaços', () => {
    expect(
      validarCampoOcupacao({ codigo: '999999', titulo: '', exigeFormacaoProfissional: false }, existentes, null).titulo,
    ).toBeTruthy();
    expect(
      validarCampoOcupacao({ codigo: '999999', titulo: '   ', exigeFormacaoProfissional: false }, existentes, null)
        .titulo,
    ).toBeTruthy();
  });

  it('rejeita código duplicado ao adicionar (codigoOriginal null)', () => {
    const erros = validarCampoOcupacao(
      { codigo: '411010', titulo: 'Outro título', exigeFormacaoProfissional: false },
      existentes,
      null,
    );
    expect(erros.codigo).toBeTruthy();
  });

  it('rejeita ao editar para o código de outra linha existente', () => {
    const erros = validarCampoOcupacao(
      { codigo: '514320', titulo: 'Assistente administrativo', exigeFormacaoProfissional: true },
      existentes,
      '411010',
    );
    expect(erros.codigo).toBeTruthy();
  });

  it('aceita editar mantendo o próprio código', () => {
    const erros = validarCampoOcupacao(
      { codigo: '411010', titulo: 'Assistente administrativo júnior', exigeFormacaoProfissional: true },
      existentes,
      '411010',
    );
    expect(erros).toEqual({});
  });
});
