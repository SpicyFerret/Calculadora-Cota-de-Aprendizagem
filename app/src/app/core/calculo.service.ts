import { Injectable, inject } from '@angular/core';
import { CboService } from './cbo.service';
import { ItemResultado, LinhaQuadro, ResultadoCalculo } from './modelos';

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

    return this.consolidar(itens);
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
    }));
    const itens = linhas.map((l) => this.classificarLinha(l, excluidosManualmente));
    return this.consolidar(itens);
  }

  /** Soma quantidades de linhas repetidas (mesmo CBO + tipo). */
  private agregar(linhas: LinhaQuadro[]): LinhaQuadro[] {
    const mapa = new Map<string, LinhaQuadro>();
    for (const linha of linhas) {
      const codigo = this.cbo.normalizar(linha.cbo);
      const chave = `${codigo}|${linha.tipo}`;
      const atual = mapa.get(chave);
      if (atual) {
        atual.quantidade += linha.quantidade;
      } else {
        mapa.set(chave, { cbo: codigo, tipo: linha.tipo, quantidade: linha.quantidade });
      }
    }
    return [...mapa.values()].sort((a, b) => a.cbo.localeCompare(b.cbo));
  }

  private classificarLinha(
    linha: LinhaQuadro,
    excluidosManualmente: ReadonlySet<string>,
  ): ItemResultado {
    const codigo = this.cbo.normalizar(linha.cbo);
    const titulo = this.cbo.titulo(codigo);
    const encontrado = titulo !== null;

    const comum = {
      codigo,
      titulo,
      encontrado,
      tipo: linha.tipo,
      quantidade: linha.quantidade,
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

  private consolidar(itens: ItemResultado[]): ResultadoCalculo {
    let base = 0;
    let aprendizesAtuais = 0;
    let totalPessoas = 0;
    const composicao = {
      entramNaBase: 0,
      excluidosPeloCbo: 0,
      aprendizes: 0,
      estagiarios: 0,
      excluidosManualmente: 0,
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

    return {
      itens,
      totalPessoas,
      base,
      obrigada,
      minimo,
      maximo,
      aprendizesAtuais,
      deficit,
      composicao,
      calculadoEm: new Date(),
    };
  }
}
