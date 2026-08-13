import { Component, HostListener, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AjudaService } from './core/ajuda/ajuda.service';
import { CboBaseService } from './core/cbo/cbo-base.service';
import { CboService } from './core/cbo/cbo.service';
import { EditorCboService } from './core/cbo/editor-cbo.service';
import { ThemeService } from './core/theme/theme.service';
import { Ajuda } from './features/ajuda/ajuda';
import { EditorCbo } from './features/editor-cbo/editor-cbo';
import { Entrada } from './features/entrada/entrada';
import { Resultado } from './features/resultado/resultado';

@Component({
  selector: 'app-root',
  imports: [
    Ajuda,
    EditorCbo,
    Entrada,
    Resultado,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatToolbarModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '[class.ajuda-aberta]': 'ajuda.aberta()' },
})
export class App {
  readonly cbo = inject(CboService);
  readonly tema = inject(ThemeService);
  readonly ajuda = inject(AjudaService);
  readonly baseCbo = inject(CboBaseService);
  readonly editorCbo = inject(EditorCboService);
  private aviso = inject(MatSnackBar);

  readonly importandoBase = signal(false);
  /** Dropdown do menu de base CBO (sem MatMenu/CDK Overlay: mantém o bundle inicial dentro do orçamento). */
  readonly menuBaseCboAberto = signal(false);

  constructor() {
    void this.cbo.carregar();
  }

  /** Fecha o menu ao clicar fora dele — os cliques internos já param a propagação. */
  @HostListener('document:click')
  fecharMenuBaseCbo(): void {
    this.menuBaseCboAberto.set(false);
  }

  async aoEscolherArquivoBase(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (!arquivo) {
      return;
    }
    this.importandoBase.set(true);
    try {
      const { sucesso, erros } = await this.baseCbo.importarArquivo(arquivo);
      if (sucesso) {
        this.aviso.open(`Base CBO customizada carregada: ${this.cbo.totalOcupacoes()} ocupações.`, 'OK', {
          duration: 4000,
        });
      } else {
        this.aviso.open(erros[0] ?? 'Não foi possível importar o arquivo.', 'OK', { duration: 5000 });
      }
    } catch (e) {
      this.aviso.open(`Não foi possível ler o arquivo (${e}).`, 'OK', { duration: 5000 });
    } finally {
      this.importandoBase.set(false);
    }
  }

  async restaurarBasePadrao(): Promise<void> {
    await this.baseCbo.restaurarPadrao();
    this.aviso.open('Base CBO padrão do site restaurada.', 'OK', { duration: 4000 });
  }
}
