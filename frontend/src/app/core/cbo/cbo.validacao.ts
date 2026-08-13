import { Ocupacao } from '../modelos/modelos';

export interface ErrosCampoOcupacao {
  codigo?: string;
  titulo?: string;
}

/** Valida uma única ocupação do formulário de edição (código, título, duplicidade). */
export function validarCampoOcupacao(
  candidato: Ocupacao,
  existentes: Ocupacao[],
  codigoOriginal: string | null,
): ErrosCampoOcupacao {
  const erros: ErrosCampoOcupacao = {};

  if (!/^\d{6}$/.test(candidato.codigo)) {
    erros.codigo = 'Código deve ter exatamente 6 dígitos.';
  } else if (existentes.some((o) => o.codigo === candidato.codigo && o.codigo !== codigoOriginal)) {
    erros.codigo = 'Já existe uma ocupação com este código.';
  }

  if (!candidato.titulo.trim()) {
    erros.titulo = 'Título não pode ficar vazio.';
  }

  return erros;
}
