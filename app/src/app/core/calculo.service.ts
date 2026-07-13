import { Injectable, inject } from '@angular/core';
import { CboService } from './cbo.service';
import { GrupoEstabelecimento, ItemResultado, LinhaQuadro, ResultadoCalculo, TipoVinculo } from './modelos';

const PERCENTUAL_MINIMO = 5;
const PERCENTUAL_MAXIMO = 15;
/** Abaixo de 7 funcionários na base, a contratação de aprendiz é facultativa. */
const BASE_MINIMA_OBRIGATORIA = 7;
const TAMANHO_LOTE = 100;

@Injectable({ providedIn: 'root' })
export class CalculoService {
  private cbo = inject(CboService);

  /**
   * Classifica o quadro e calcula a cota (CLT art. 429):
   * mínimo 5% e máximo 15% dos empregados cujas funções demandem formação
   * profissional, com frações arredondadas para cima (§1º).
   *
   * Processa em lotes assíncronos e reporta progresso (0–100) para a barra.
   */
  async calcular(
    linhas: LinhaQuadro[],
    excluidosManualmente: ReadonlySet<string>,
    aoProgredir?: (percentual: number) => void,
    cnpj = '',
  ): Promise<ResultadoCalculo> {
    const agregadas = this.agregar(linhas);
    const itens: ItemResultado[] = [];

    for (let i = 0; i < agregadas.length; i += TAMANHO_LOTE) {
      for (const linha of agregadas.slice(i, i + TAMANHO_LOTE)) {
        itens.push(this.classificarLinha(linha, excluidosManualmente));
      }
      aoProgredir?.(Math.round(((i + TAMANHO_LOTE) / Math.max(agregadas.length, 1)) * 100));
      await new Promise((resolve) => setTimeout(resolve));
    }
    aoProgredir?.(100);

    return this.consolidar(itens, cnpj);
  }

  /** A cota é apurada por estabelecimento (CNPJ): um resultado por grupo. */
  async calcularGrupos(
    grupos: GrupoEstabelecimento[],
    aoProgredir?: (percentual: number) => void,
  ): Promise<ResultadoCalculo[]> {
    const resultados: ResultadoCalculo[] = [];
    for (let g = 0; g < grupos.length; g++) {
      const resultado = await this.calcular(
        grupos[g].linhas,
        new Set(),
        (p) => aoProgredir?.(Math.round(((g + p / 100) / grupos.length) * 100)),
        grupos[g].cnpj,
      );
      resultados.push(resultado);
    }
    aoProgredir?.(100);
    return resultados;
  }

  /** Recalcula de forma síncrona (usado ao alternar exclusões manuais). */
  recalcular(
    resultado: ResultadoCalculo,
    excluidosManualmente: ReadonlySet<string>,
  ): ResultadoCalculo {
    const linhas = resultado.itens.map((i) => ({
      cbo: i.codigo,
      tipo: i.tipo,
      quantidade: i.quantidade,
      quantidadeConfianca: i.cargoConfianca ? i.quantidade : 0,
    }));
    const itens = linhas.map((l) => this.classificarLinha(l, excluidosManualmente));
    return this.consolidar(itens, resultado.cnpj);
  }

  /**
   * Separa a parcela de cargo de confiança de cada linha (quantidadeConfianca)
   * do restante, e soma quantidades repetidas (mesmo CBO + tipo + condição) —
   * assim a parcela de confiança fica num grupo à parte do resto do mesmo CBO,
   * e pode ser excluída sozinha (exclusão parcial).
   */
  private agregar(linhas: LinhaQuadro[]): LinhaQuadro[] {
    const mapa = new Map<string, { cbo: string; tipo: TipoVinculo; quantidade: number; confianca: boolean }>();
    const somar = (codigo: string, tipo: TipoVinculo, quantidade: number, confianca: boolean) => {
      if (quantidade <= 0) {
        return;
      }
      const chave = `${codigo}|${tipo}|${confianca}`;
      const atual = mapa.get(chave);
      if (atual) {
        atual.quantidade += quantidade;
      } else {
        mapa.set(chave, { cbo: codigo, tipo, quantidade, confianca });
      }
    };
    for (const linha of linhas) {
      const codigo = this.cbo.normalizar(linha.cbo);
      const confianca = Math.min(Math.max(Math.trunc(linha.quantidadeConfianca ?? 0), 0), linha.quantidade);
      somar(codigo, linha.tipo, linha.quantidade - confianca, false);
      somar(codigo, linha.tipo, confianca, true);
    }
    return [...mapa.values()]
      .sort((a, b) => a.cbo.localeCompare(b.cbo))
      .map((g) => ({
        cbo: g.cbo,
        tipo: g.tipo,
        quantidade: g.quantidade,
        quantidadeConfianca: g.confianca ? g.quantidade : 0,
      }));
  }

  private classificarLinha(
    linha: LinhaQuadro,
    excluidosManualmente: ReadonlySet<string>,
  ): ItemResultado {
    const codigo = this.cbo.normalizar(linha.cbo);
    const titulo = this.cbo.titulo(codigo);
    const encontrado = titulo !== null;
    const cargoConfianca = (linha.quantidadeConfianca ?? 0) > 0;

    const comum = {
      codigo,
      titulo,
      encontrado,
      tipo: linha.tipo,
      quantidade: linha.quantidade,
      cargoConfianca,
      overrideExcluido: false,
      podeExcluirManualmente: false,
    };

    if (linha.tipo === 'APRENDIZ') {
      return { ...comum, entraNaBase: false, motivo: 'Aprendiz já contratado (não compõe a base)' };
    }
    if (linha.tipo === 'ESTAGIARIO') {
      return { ...comum, entraNaBase: false, motivo: 'Estagiário não é empregado (Lei 11.788/2008)' };
    }
    if (!encontrado) {
      return { ...comum, entraNaBase: false, motivo: 'CBO não encontrado na base oficial — confira o código' };
    }

    const classificacao = this.cbo.classificar(codigo);
    if (!classificacao.entra) {
      return { ...comum, entraNaBase: false, motivo: classificacao.motivo };
    }
    if (cargoConfianca) {
      return {
        ...comum,
        entraNaBase: false,
        overrideExcluido: true,
        motivo: 'Cargo de direção ou confiança (sinalizado na entrada)',
      };
    }
    if (excluidosManualmente.has(codigo)) {
      return {
        ...comum,
        entraNaBase: false,
        overrideExcluido: true,
        podeExcluirManualmente: true,
        motivo: 'Excluído manualmente (cargo de direção ou confiança)',
      };
    }
    return { ...comum, entraNaBase: true, podeExcluirManualmente: true, motivo: classificacao.motivo };
  }

  private consolidar(itens: ItemResultado[], cnpj: string): ResultadoCalculo {
    let base = 0;
    let aprendizesAtuais = 0;
    let totalPessoas = 0;
    const composicao = {
      entramNaBase: 0,
      excluidosPeloCbo: 0,
      aprendizes: 0,
      estagiarios: 0,
      excluidosManualmente: 0,
      excluidosCargoConfianca: 0,
    };

    for (const item of itens) {
      totalPessoas += item.quantidade;
      if (item.tipo === 'APRENDIZ') {
        aprendizesAtuais += item.quantidade;
        composicao.aprendizes += item.quantidade;
      } else if (item.tipo === 'ESTAGIARIO') {
        composicao.estagiarios += item.quantidade;
      } else if (item.entraNaBase) {
        base += item.quantidade;
        composicao.entramNaBase += item.quantidade;
      } else if (item.cargoConfianca) {
        composicao.excluidosCargoConfianca += item.quantidade;
      } else if (item.overrideExcluido) {
        composicao.excluidosManualmente += item.quantidade;
      } else {
        composicao.excluidosPeloCbo += item.quantidade;
      }
    }

    // Frações dão lugar à admissão de um aprendiz (CLT art. 429, §1º),
    // mas a obrigação só nasce com 7 ou mais funcionários na base.
    const obrigada = base >= BASE_MINIMA_OBRIGATORIA;
    const minimo = obrigada ? Math.ceil((base * PERCENTUAL_MINIMO) / 100) : 0;
    const maximo = Math.ceil((base * PERCENTUAL_MAXIMO) / 100);
    const deficit = Math.max(0, minimo - aprendizesAtuais);
    const excedente = Math.max(0, aprendizesAtuais - maximo);

    return {
      cnpj,
      itens,
      totalPessoas,
      base,
      obrigada,
      minimo,
      maximo,
      aprendizesAtuais,
      deficit,
      excedente,
      composicao,
      calculadoEm: new Date(),
    };
  }
}
