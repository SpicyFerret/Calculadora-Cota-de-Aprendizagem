import { ResultadoCalculo } from '../modelos/modelos';
import { URL_CONTRATAR } from './export.constantes';
import { baixar, linhasResumo, rotuloFilial, rotuloTipo } from './export.resumo';

export async function baixarCsv(resultados: ResultadoCalculo[]): Promise<void> {
  const linhas: string[][] = [];
  // Um bloco por estabelecimento, cada um com o seu resumo e o seu detalhe.
  for (const r of resultados) {
    linhas.push([`Estabelecimento: ${rotuloFilial(r)}`]);
    linhas.push(...linhasResumo(r, true));
    linhas.push([]);
    linhas.push(['CBO', 'Título', 'Tipo', 'Quantidade', 'Entra na base', 'Motivo']);
    for (const i of r.itens) {
      linhas.push([
        i.codigo,
        i.titulo ?? 'CBO não encontrado',
        rotuloTipo(i),
        String(i.quantidade),
        i.entraNaBase ? 'Sim' : 'Não',
        i.motivo,
      ]);
    }
    linhas.push([]);
  }
  linhas.push(['Contrate aprendizes com a GERAR:', URL_CONTRATAR]);
  const csv = linhas
    .map((linha) => linha.map((celula) => `"${celula.replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  // BOM para o Excel pt-BR abrir como UTF-8
  baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'csv');
}
