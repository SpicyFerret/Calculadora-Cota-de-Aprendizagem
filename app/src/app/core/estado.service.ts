import { Injectable, computed, inject, signal } from '@angular/core';
import { CalculoService } from './calculo.service';
import { GrupoEstabelecimento, ResultadoCalculo } from './modelos';

/** Duração mínima da barra de progresso, para o feedback ser perceptível. */
const DURACAO_MINIMA_MS = 500;

@Injectable({ providedIn: 'root' })
export class EstadoService {
  private calculo = inject(CalculoService);

  readonly processando = signal(false);
  readonly progresso = signal(0);
  /** Um resultado por estabelecimento (CNPJ). */
  readonly resultados = signal<ResultadoCalculo[] | null>(null);
  readonly filialSelecionada = signal(0);
  /** Resultado do estabelecimento selecionado (dashboard/tabela). */
  readonly resultado = computed(() => this.resultados()?.[this.filialSelecionada()] ?? null);

  /** Exclusões manuais (cargo de confiança), por estabelecimento. */
  private excluidosPorFilial = new Map<number, Set<string>>();

  async calcular(grupos: GrupoEstabelecimento[]): Promise<void> {
    this.processando.set(true);
    this.progresso.set(0);
    this.resultados.set(null);
    this.filialSelecionada.set(0);
    this.excluidosPorFilial.clear();
    const inicio = performance.now();
    try {
      const resultados = await this.calculo.calcularGrupos(grupos, (p) => this.progresso.set(p));
      const decorrido = performance.now() - inicio;
      if (decorrido < DURACAO_MINIMA_MS) {
        await new Promise((r) => setTimeout(r, DURACAO_MINIMA_MS - decorrido));
      }
      this.resultados.set(resultados);
    } finally {
      this.processando.set(false);
    }
  }

  alternarExclusaoManual(codigo: string): void {
    const indice = this.filialSelecionada();
    const atual = this.resultados()?.[indice];
    if (!atual) {
      return;
    }
    const excluidos = this.excluidosPorFilial.get(indice) ?? new Set<string>();
    if (excluidos.has(codigo)) {
      excluidos.delete(codigo);
    } else {
      excluidos.add(codigo);
    }
    this.excluidosPorFilial.set(indice, excluidos);
    const recalculado = this.calculo.recalcular(atual, excluidos);
    this.resultados.update((todos) =>
      (todos ?? []).map((r, i) => (i === indice ? recalculado : r)),
    );
  }

  limpar(): void {
    this.resultados.set(null);
    this.filialSelecionada.set(0);
    this.excluidosPorFilial.clear();
    this.progresso.set(0);
  }
}
