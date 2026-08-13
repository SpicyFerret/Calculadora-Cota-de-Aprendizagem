import { Injectable, signal } from '@angular/core';

/** Controla a abertura do painel de edição da base CBO (app.ts abre, editor-cbo.ts observa). */
@Injectable({ providedIn: 'root' })
export class EditorCboService {
  readonly aberto = signal(false);

  abrir(): void {
    this.aberto.set(true);
  }

  fechar(): void {
    this.aberto.set(false);
  }
}
