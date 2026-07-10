import { Injectable, effect, signal } from '@angular/core';

const CHAVE = 'cota-aprendiz.tema';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly escuro = signal(this.temaInicial());

  constructor() {
    effect(() => {
      const escuro = this.escuro();
      document.documentElement.classList.toggle('tema-escuro', escuro);
      localStorage.setItem(CHAVE, escuro ? 'escuro' : 'claro');
    });
  }

  alternar(): void {
    this.escuro.update((v) => !v);
  }

  private temaInicial(): boolean {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'escuro' || salvo === 'claro') {
      return salvo === 'escuro';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
