import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CboService } from '../../core/cbo.service';
import { EstadoService } from '../../core/estado.service';
import { ImportService, ResultadoImportacao } from '../../core/import.service';
import { LinhaQuadro, Ocupacao, TIPOS, TipoVinculo } from '../../core/modelos';

interface LinhaFormulario {
  cbo: string;
  tipo: TipoVinculo;
  quantidade: number;
}

@Component({
  selector: 'app-entrada',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
  ],
  templateUrl: './entrada.html',
  styleUrl: './entrada.scss',
})
export class Entrada {
  readonly cbo = inject(CboService);
  readonly estado = inject(EstadoService);
  private importador = inject(ImportService);
  private aviso = inject(MatSnackBar);

  readonly tipos = TIPOS;
  readonly linhas = signal<LinhaFormulario[]>([this.novaLinha()]);
  readonly opcoes = signal<Ocupacao[]>([]);
  readonly abaAtiva = signal(0);
  readonly importacao = signal<ResultadoImportacao | null>(null);
  readonly arrastando = signal(false);
  readonly lendoArquivo = signal(false);

  private novaLinha(): LinhaFormulario {
    return { cbo: '', tipo: 'CLT', quantidade: 1 };
  }

  adicionarLinha(): void {
    this.linhas.update((l) => [...l, this.novaLinha()]);
  }

  removerLinha(indice: number): void {
    this.linhas.update((l) => (l.length > 1 ? l.filter((_, i) => i !== indice) : l));
  }

  aoDigitarCbo(valor: string): void {
    this.opcoes.set(this.cbo.pesquisar(valor));
  }

  tituloDe(codigo: string): string | null {
    const normalizado = this.cbo.normalizar(codigo);
    return normalizado.length === 6 ? this.cbo.titulo(normalizado) : null;
  }

  cboInvalido(codigo: string): boolean {
    const normalizado = this.cbo.normalizar(codigo);
    return normalizado.length === 6 && !this.cbo.existe(normalizado);
  }

  totalPessoas(): number {
    return this.linhas()
      .filter((l) => this.cbo.existe(l.cbo))
      .reduce((soma, l) => soma + (l.quantidade || 0), 0);
  }

  async calcularDoFormulario(): Promise<void> {
    const preenchidas = this.linhas().filter((l) => l.cbo.trim() !== '');
    const invalidas = preenchidas.filter(
      (l) => !this.cbo.existe(l.cbo) || !Number.isInteger(l.quantidade) || l.quantidade < 1,
    );
    if (preenchidas.length === 0) {
      this.aviso.open('Informe ao menos uma linha com CBO e quantidade.', 'OK', { duration: 4000 });
      return;
    }
    if (invalidas.length > 0) {
      this.aviso.open(
        `Há ${invalidas.length} linha(s) com CBO não encontrado ou quantidade inválida.`,
        'OK',
        { duration: 5000 },
      );
      return;
    }
    await this.estado.calcular(
      preenchidas.map((l) => ({ cbo: l.cbo, tipo: l.tipo, quantidade: l.quantidade })),
    );
  }

  // ---- importação ----

  async aoEscolherArquivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    entrada.value = '';
    if (arquivo) {
      await this.lerArquivo(arquivo);
    }
  }

  aoArrastar(evento: DragEvent, sobre: boolean): void {
    evento.preventDefault();
    this.arrastando.set(sobre);
  }

  async aoSoltar(evento: DragEvent): Promise<void> {
    evento.preventDefault();
    this.arrastando.set(false);
    const arquivo = evento.dataTransfer?.files?.[0];
    if (arquivo) {
      await this.lerArquivo(arquivo);
    }
  }

  private async lerArquivo(arquivo: File): Promise<void> {
    if (!/\.(csv|xlsx|xls)$/i.test(arquivo.name)) {
      this.aviso.open('Formato não suportado: use .csv ou .xlsx.', 'OK', { duration: 4000 });
      return;
    }
    this.lendoArquivo.set(true);
    try {
      this.importacao.set(await this.importador.lerArquivo(arquivo));
    } catch (e) {
      this.aviso.open(`Não foi possível ler o arquivo (${e}).`, 'OK', { duration: 5000 });
    } finally {
      this.lendoArquivo.set(false);
    }
  }

  pessoasImportadas(): number {
    return (this.importacao()?.linhas ?? []).reduce((soma, l) => soma + l.quantidade, 0);
  }

  async calcularDaImportacao(): Promise<void> {
    const linhas = this.importacao()?.linhas ?? [];
    if (linhas.length === 0) {
      return;
    }
    await this.estado.calcular(linhas);
  }

  editarNoFormulario(): void {
    const importadas = this.importacao()?.linhas ?? [];
    if (importadas.length === 0) {
      return;
    }
    const agrupadas = new Map<string, LinhaQuadro>();
    for (const linha of importadas) {
      const chave = `${linha.cbo}|${linha.tipo}`;
      const atual = agrupadas.get(chave);
      if (atual) {
        atual.quantidade += linha.quantidade;
      } else {
        agrupadas.set(chave, { ...linha });
      }
    }
    this.linhas.set([...agrupadas.values()]);
    this.abaAtiva.set(0);
  }
}
