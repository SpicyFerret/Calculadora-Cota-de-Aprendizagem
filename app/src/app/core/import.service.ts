import { Injectable, inject } from '@angular/core';
import { CboService } from './cbo.service';
import { GrupoEstabelecimento, TipoVinculo } from './modelos';

export interface ResultadoImportacao {
  /** Linhas válidas agrupadas por estabelecimento (coluna CNPJ opcional). */
  grupos: GrupoEstabelecimento[];
  erros: string[];
  formato: 'agregado' | 'lista';
}

const TIPOS_RECONHECIDOS: Record<string, TipoVinculo> = {
  clt: 'CLT',
  pcd: 'PCD',
  'pessoa com deficiencia': 'PCD',
  estagiario: 'ESTAGIARIO',
  estagiaria: 'ESTAGIARIO',
  estagio: 'ESTAGIARIO',
  aprendiz: 'APRENDIZ',
  'jovem aprendiz': 'APRENDIZ',
};

@Injectable({ providedIn: 'root' })
export class ImportService {
  private cbo = inject(CboService);

  /**
   * Lê CSV ou XLSX. Dois formatos, detectados pelo cabeçalho:
   *  - agregado: CBO; TIPO; QUANTIDADE
   *  - lista:    [NOME;] CBO; TIPO   (cada linha = 1 pessoa)
   * Uma coluna CNPJ opcional separa os estabelecimentos (matriz/filiais).
   */
  async lerArquivo(arquivo: File): Promise<ResultadoImportacao> {
    const buffer = await arquivo.arrayBuffer();
    return this.importarPlanilha(buffer);
  }

  async importarPlanilha(buffer: ArrayBuffer): Promise<ResultadoImportacao> {
    // Import dinâmico: o SheetJS (~400 kB) só carrega quando alguém importa planilha.
    const XLSX = await import('xlsx');
    const pasta = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    const aba = pasta.Sheets[pasta.SheetNames[0]];
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, {
      header: 1,
      raw: false,
      defval: '',
    });
    return this.interpretar(matriz.map((l) => l.map((c) => String(c ?? '').trim())));
  }

  private interpretar(matriz: string[][]): ResultadoImportacao {
    const semVazias = matriz.filter((linha) => linha.some((celula) => celula !== ''));
    if (semVazias.length < 2) {
      return { grupos: [], erros: ['Arquivo vazio ou sem linhas de dados.'], formato: 'agregado' };
    }

    const cabecalho = semVazias[0].map((c) => this.normalizarTexto(c));
    const colCbo = cabecalho.findIndex((c) => c === 'cbo' || c.startsWith('cbo '));
    const colTipo = cabecalho.findIndex((c) => c === 'tipo' || c === 'vinculo');
    const colQuantidade = cabecalho.findIndex((c) => c === 'quantidade' || c === 'qtd' || c === 'qtde');
    const colCnpj = cabecalho.findIndex((c) => c === 'cnpj' || c === 'estabelecimento' || c === 'filial');
    if (colCbo < 0 || colTipo < 0) {
      return {
        grupos: [],
        erros: [
          'Cabeçalho não reconhecido: são necessárias as colunas CBO e TIPO (QUANTIDADE e CNPJ opcionais).',
        ],
        formato: 'agregado',
      };
    }
    const formato = colQuantidade >= 0 ? 'agregado' : 'lista';

    const grupos = new Map<string, GrupoEstabelecimento>();
    const erros: string[] = [];
    semVazias.slice(1).forEach((valores, indice) => {
      const numeroLinha = indice + 2; // 1-based + cabeçalho
      const codigo = this.cbo.normalizar(valores[colCbo] ?? '');
      const tipo = TIPOS_RECONHECIDOS[this.normalizarTexto(valores[colTipo] ?? '')];
      const quantidade =
        formato === 'agregado' ? Number(valores[colQuantidade]?.replace(',', '.')) : 1;
      const cnpj = colCnpj >= 0 ? this.normalizarCnpj(valores[colCnpj] ?? '') : '';

      if (codigo.length !== 6) {
        erros.push(`Linha ${numeroLinha}: CBO "${valores[colCbo]}" inválido (esperados 6 dígitos).`);
        return;
      }
      if (!this.cbo.existe(codigo)) {
        erros.push(`Linha ${numeroLinha}: CBO ${codigo} não encontrado na base oficial.`);
        return;
      }
      if (!tipo) {
        erros.push(
          `Linha ${numeroLinha}: tipo "${valores[colTipo]}" não reconhecido (use CLT, PCD, Estagiário ou Aprendiz).`,
        );
        return;
      }
      if (!Number.isFinite(quantidade) || quantidade < 1 || !Number.isInteger(quantidade)) {
        erros.push(`Linha ${numeroLinha}: quantidade "${valores[colQuantidade]}" inválida.`);
        return;
      }

      const grupo = grupos.get(cnpj) ?? { cnpj, linhas: [] };
      grupo.linhas.push({ cbo: codigo, tipo, quantidade });
      grupos.set(cnpj, grupo);
    });

    return { grupos: [...grupos.values()], erros, formato };
  }

  /** Máscara padrão quando são 14 dígitos; senão mantém o texto como rótulo. */
  private normalizarCnpj(texto: string): string {
    const digitos = texto.replace(/\D/g, '');
    if (digitos.length === 14) {
      return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
    }
    return texto.trim();
  }

  /** minúsculas, sem acentos */
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }
}
