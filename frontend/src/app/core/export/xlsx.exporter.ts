import { ResultadoCalculo } from '../modelos/modelos';
import { avaliarSituacao } from '../situacao/situacao';
import { NOME_ABA_RESUMO, URL_CONTRATAR } from './export.constantes';
import { baixar, linhasResumo, rotuloFilial, rotuloTipo } from './export.resumo';

export async function baixarXlsx(
  resultados: ResultadoCalculo[],
  cboGeradoEm: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const pasta = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    pasta,
    abaResumoGeral(XLSX, resultados, cboGeradoEm),
    NOME_ABA_RESUMO,
  );

  // Uma aba por estabelecimento, com o resumo e o detalhe do próprio CNPJ.
  const nomesUsados = [NOME_ABA_RESUMO];
  for (const r of resultados) {
    const nome = nomeAba(rotuloFilial(r), nomesUsados);
    nomesUsados.push(nome);
    XLSX.utils.book_append_sheet(pasta, abaEstabelecimento(XLSX, r), nome);
  }

  const buffer = XLSX.write(pasta, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  baixar(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'xlsx',
  );
}

/** Panorama: uma linha por estabelecimento, dizendo se precisa agir. */
function abaResumoGeral(
  XLSX: typeof import('xlsx'),
  resultados: ResultadoCalculo[],
  cboGeradoEm: string,
): import('xlsx').WorkSheet {
  const linhas: (string | number)[][] = [
    ['Relatório — Cota de Aprendizagem'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [`Base CBO de ${cboGeradoEm}`],
    [],
    [
      'Estabelecimento',
      'Precisa agir?',
      'Situação',
      'Base',
      'Cota mínima',
      'Cota máxima',
      'Aprendizes',
      'O que fazer',
    ],
  ];
  for (const r of resultados) {
    const situacao = avaliarSituacao(r);
    linhas.push([
      rotuloFilial(r),
      situacao.precisaAgir ? 'SIM' : 'Não',
      situacao.rotulo,
      r.base,
      r.minimo,
      r.maximo,
      r.aprendizesAtuais,
      situacao.orientacao,
    ]);
  }
  linhas.push([], ['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);

  const aba = XLSX.utils.aoa_to_sheet(linhas);
  aba['!cols'] = [
    { wch: 24 },
    { wch: 13 },
    { wch: 20 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 80 },
  ];
  const celulaUrl = XLSX.utils.encode_cell({ r: linhas.length - 1, c: 1 });
  aba[celulaUrl].l = { Target: URL_CONTRATAR };
  return aba;
}

/** Aba de um estabelecimento: o veredito, o resumo e o detalhe do próprio CNPJ. */
function abaEstabelecimento(
  XLSX: typeof import('xlsx'),
  resultado: ResultadoCalculo,
): import('xlsx').WorkSheet {
  const situacao = avaliarSituacao(resultado);
  const linhas: (string | number)[][] = [
    [`Estabelecimento: ${rotuloFilial(resultado)}`],
    [situacao.precisaAgir ? 'AÇÃO NECESSÁRIA' : 'NENHUMA AÇÃO NECESSÁRIA', situacao.rotulo],
    [situacao.orientacao],
    [],
    ['Resumo'],
    ...linhasResumo(resultado, false),
    [],
    ['Detalhado por CBO'],
    ['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo'],
  ];
  for (const i of resultado.itens) {
    linhas.push([
      i.codigo,
      i.titulo ?? 'CBO não encontrado',
      rotuloTipo(i),
      i.quantidade,
      i.entraNaBase ? 'Sim' : 'Não',
      i.motivo,
    ]);
  }

  const aba = XLSX.utils.aoa_to_sheet(linhas);
  aba['!cols'] = [{ wch: 46 }, { wch: 46 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 60 }];
  return aba;
}

/**
 * Nome de aba aceito pelo Excel: sem `: \ / ? * [ ]`, até 31 caracteres e
 * único na pasta (CNPJ tem barra, então quase sempre precisa de ajuste).
 */
function nomeAba(rotulo: string, usados: string[]): string {
  const limpo = rotulo.replace(/[:\\/?*[\]]/g, '-').trim() || 'Estabelecimento';
  let nome = limpo.slice(0, 31);
  let n = 2;
  while (usados.includes(nome)) {
    const sufixo = ` (${n++})`;
    nome = limpo.slice(0, 31 - sufixo.length) + sufixo;
  }
  return nome;
}
