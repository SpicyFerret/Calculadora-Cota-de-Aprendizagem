import { BaseCbo, Ocupacao } from '../modelos/modelos';

export interface ResultadoImportacaoCbo {
  base: BaseCbo | null;
  erros: string[];
}

/** Lê .json, .csv ou .xlsx (mesmas 3 colunas exportadas por cbo.exporter.ts). */
export async function lerBaseCbo(arquivo: File): Promise<ResultadoImportacaoCbo> {
  if (arquivo.name.toLowerCase().endsWith('.json')) {
    return interpretarJson(await arquivo.text());
  }
  return interpretarPlanilha(await arquivo.arrayBuffer());
}

function interpretarJson(texto: string): ResultadoImportacaoCbo {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { base: null, erros: ['Arquivo JSON inválido (não foi possível interpretar).'] };
  }
  const candidato = bruto as Partial<BaseCbo>;
  if (!Array.isArray(candidato.ocupacoes)) {
    return { base: null, erros: ['JSON não tem o formato esperado (falta o campo "ocupacoes").'] };
  }
  return validarOcupacoes(
    candidato.ocupacoes.map((o) => ({
      codigo: String((o as Ocupacao)?.codigo ?? ''),
      titulo: String((o as Ocupacao)?.titulo ?? ''),
      exigeFormacaoProfissional: Boolean((o as Ocupacao)?.exigeFormacaoProfissional),
    })),
    candidato.geradoEm,
    candidato.fonte,
  );
}

async function interpretarPlanilha(buffer: ArrayBuffer): Promise<ResultadoImportacaoCbo> {
  // Import dinâmico: o SheetJS (~400 kB) só carrega quando alguém importa CSV/XLSX.
  const XLSX = await import('xlsx');
  const pasta = XLSX.read(buffer, { type: 'array', codepage: 65001 });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  const matriz = XLSX.utils
    .sheet_to_json<unknown[]>(aba, { header: 1, raw: false, defval: '' })
    .map((linha) => linha.map((c) => String(c ?? '').trim()))
    .filter((linha) => linha.some((c) => c !== ''));

  if (matriz.length < 2) {
    return { base: null, erros: ['Arquivo vazio ou sem linhas de dados.'] };
  }

  const cabecalho = matriz[0].map((c) => c.toLowerCase().trim());
  const colCodigo = cabecalho.findIndex((c) => c === 'cbo' || c === 'código' || c === 'codigo');
  const colTitulo = cabecalho.findIndex((c) => c === 'título' || c === 'titulo');
  const colExige = cabecalho.findIndex((c) => c.startsWith('exige'));
  if (colCodigo < 0 || colTitulo < 0 || colExige < 0) {
    return {
      base: null,
      erros: ['Cabeçalho não reconhecido: são necessárias as colunas CBO, Título e Exige Formação Profissional.'],
    };
  }

  const ocupacoes = matriz.slice(1).map((linha) => ({
    codigo: (linha[colCodigo] ?? '').replace(/\D/g, ''),
    titulo: linha[colTitulo] ?? '',
    exigeFormacaoProfissional: /^(sim|true|1|x)$/i.test((linha[colExige] ?? '').trim()),
  }));
  return validarOcupacoes(ocupacoes);
}

function validarOcupacoes(
  ocupacoes: Ocupacao[],
  geradoEm?: string,
  fonte?: string,
): ResultadoImportacaoCbo {
  const erros: string[] = [];
  const validas: Ocupacao[] = [];
  ocupacoes.forEach((o, indice) => {
    const numeroLinha = indice + 2; // 1-based + cabeçalho
    if (!/^\d{6}$/.test(o.codigo)) {
      erros.push(`Linha ${numeroLinha}: código "${o.codigo}" inválido (esperados 6 dígitos).`);
      return;
    }
    if (!o.titulo.trim()) {
      erros.push(`Linha ${numeroLinha}: título vazio para o código ${o.codigo}.`);
      return;
    }
    validas.push(o);
  });

  if (validas.length === 0) {
    erros.push('Nenhuma ocupação válida encontrada no arquivo.');
    return { base: null, erros };
  }

  const base: BaseCbo = {
    geradoEm: geradoEm || new Date().toISOString().slice(0, 10),
    fonte: fonte || 'Base importada manualmente pelo usuário',
    ocupacoes: validas,
  };
  return { base, erros };
}
