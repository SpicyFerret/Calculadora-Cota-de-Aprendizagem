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

  /**
   * Inclusões/exclusões manuais por estabelecimento — true força o CBO para
   * dentro da base, false força para fora; ausência = classificação automática.
   */
  private overridesPorFilial = new Map<number, Map<string, boolean>>();

  async calcular(grupos: GrupoEstabelecimento[]): Promise<void> {
    this.processando.set(true);
    this.progresso.set(0);
    this.resultados.set(null);
    this.filialSelecionada.set(0);
    this.overridesPorFilial.clear();
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
    this.alternarOverride(codigo, false);
  }

  alternarInclusaoManual(codigo: string): void {
    this.alternarOverride(codigo, true);
  }

  /** Liga/desliga o override para `valorForcado`; alternar de novo volta ao automático. */
  private alternarOverride(codigo: string, valorForcado: boolean): void {
    const indice = this.filialSelecionada();
    const atual = this.resultados()?.[indice];
    if (!atual) {
      return;
    }
    const overrides = this.overridesPorFilial.get(indice) ?? new Map<string, boolean>();
    if (overrides.get(codigo) === valorForcado) {
      overrides.delete(codigo);
    } else {
      overrides.set(codigo, valorForcado);
    }
    this.overridesPorFilial.set(indice, overrides);
    const recalculado = this.calculo.recalcular(atual, overrides);
    this.resultados.update((todos) =>
      (todos ?? []).map((r, i) => (i === indice ? recalculado : r)),
    );
  }

  limpar(): void {
    this.resultados.set(null);
    this.filialSelecionada.set(0);
    this.overridesPorFilial.clear();
    this.progresso.set(0);
  }
}
