import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AjudaService } from './core/ajuda.service';
import { CboService } from './core/cbo.service';
import { ThemeService } from './core/theme.service';
import { Ajuda } from './features/ajuda/ajuda';
import { Entrada } from './features/entrada/entrada';
import { Resultado } from './features/resultado/resultado';

@Component({
  selector: 'app-root',
  imports: [Ajuda, Entrada, Resultado, MatButtonModule, MatIconModule, MatToolbarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '[class.ajuda-aberta]': 'ajuda.aberta()' },
})
export class App {
  readonly cbo = inject(CboService);
  readonly tema = inject(ThemeService);
  readonly ajuda = inject(AjudaService);

  constructor() {
    void this.cbo.carregar();
  }
}
