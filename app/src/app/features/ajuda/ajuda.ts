import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AjudaService, TopicoAjuda } from '../../core/ajuda.service';

@Component({
  selector: 'app-ajuda',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './ajuda.html',
  styleUrl: './ajuda.scss',
})
export class Ajuda {
  readonly ajuda = inject(AjudaService);

  /** Índice do passo do tour ("Percorrer o sistema"); null = tour parado. */
  readonly passo = signal<number | null>(null);

  abrir(): void {
    this.ajuda.abrir();
  }

  fechar(): void {
    this.passo.set(null);
    this.ajuda.fechar();
  }

  selecionar(topico: TopicoAjuda): void {
    if (this.passo() !== null) {
      this.passo.set(this.ajuda.topicos.indexOf(topico));
    }
    this.ajuda.destacar(topico);
  }

  iniciarTour(): void {
    this.irPara(0);
  }

  proximo(): void {
    this.irPara((this.passo() ?? -1) + 1);
  }

  anterior(): void {
    this.irPara((this.passo() ?? 1) - 1);
  }

  encerrarTour(): void {
    this.passo.set(null);
    this.ajuda.limpar();
  }

  private irPara(indice: number): void {
    const topico = this.ajuda.topicos[indice];
    if (topico) {
      this.passo.set(indice);
      this.ajuda.destacar(topico);
      this.rolarMenuParaTopico(topico.id);
    }
  }

  /** Desliza a lista de tópicos para trazer o item ativo à vista durante o tour. */
  private rolarMenuParaTopico(id: string): void {
    // rAF garante que o layout do painel já assentou antes de medir o scroll.
    requestAnimationFrame(() => {
      const item = document.getElementById(`ajuda-item-${id}`);
      item?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}
