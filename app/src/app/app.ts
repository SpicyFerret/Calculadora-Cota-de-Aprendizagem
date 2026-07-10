import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CboService } from './core/cbo.service';
import { ThemeService } from './core/theme.service';
import { Entrada } from './features/entrada/entrada';
import { Resultado } from './features/resultado/resultado';

@Component({
  selector: 'app-root',
  imports: [Entrada, Resultado, MatButtonModule, MatIconModule, MatToolbarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly cbo = inject(CboService);
  readonly tema = inject(ThemeService);

  constructor() {
    void this.cbo.carregar();
  }
}
