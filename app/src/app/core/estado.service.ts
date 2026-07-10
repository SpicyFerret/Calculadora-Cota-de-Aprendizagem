import { Injectable, inject, signal } from '@angular/core';
import { CalculoService } from './calculo.service';
import { LinhaQuadro, ResultadoCalculo } from './modelos';

/** Duração mínima da barra de progresso, para o feedback ser perceptível. */
const DURACAO_MINIMA_MS = 500;

@Injectable({ providedIn: 'root' })
export class EstadoService {
  private calculo = inject(CalculoService);

  readonly processando = signal(false);
  readonly progresso = signal(0);
  readonly resultado = signal<ResultadoCalculo | null>(null);
  readonly excluidosManualmente = signal<ReadonlySet<string>>(new Set());

  async calcular(linhas: LinhaQuadro[]): Promise<void> {
    this.processando.set(true);
    this.progresso.set(0);
    this.resultado.set(null);
    this.excluidosManualmente.set(new Set());
    const inicio = performance.now();
    try {
      const resultado = await this.calculo.calcular(linhas, new Set(), (p) =>
        this.progresso.set(p),
      );
      const decorrido = performance.now() - inicio;
      if (decorrido < DURACAO_MINIMA_MS) {
        await new Promise((r) => setTimeout(r, DURACAO_MINIMA_MS - decorrido));
      }
      this.resultado.set(resultado);
    } finally {
      this.processando.set(false);
    }
  }

  alternarExclusaoManual(codigo: string): void {
    const resultado = this.resultado();
    if (!resultado) {
      return;
    }
    const novo = new Set(this.excluidosManualmente());
    if (novo.has(codigo)) {
      novo.delete(codigo);
    } else {
      novo.add(codigo);
    }
    this.excluidosManualmente.set(novo);
    this.resultado.set(this.calculo.recalcular(resultado, novo));
  }

  limpar(): void {
    this.resultado.set(null);
    this.excluidosManualmente.set(new Set());
    this.progresso.set(0);
  }
}
