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
import { MatTooltipModule } from '@angular/material/tooltip';
import { CboService } from '../../core/cbo.service';
import { EstadoService } from '../../core/estado.service';
import { ImportService, ResultadoImportacao } from '../../core/import.service';
import { GrupoEstabelecimento, Ocupacao, TIPOS, TipoVinculo } from '../../core/modelos';

interface LinhaFormulario {
  cbo: string;
  tipo: TipoVinculo;
  quantidade: number;
}

interface GrupoFormulario {
  cnpj: string;
  linhas: LinhaFormulario[];
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
    MatTooltipModule,
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
  readonly grupos = signal<GrupoFormulario[]>([this.novoGrupo()]);
  readonly opcoes = signal<Ocupacao[]>([]);
  readonly abaAtiva = signal(0);
  readonly importacao = signal<ResultadoImportacao | null>(null);
  readonly arrastando = signal(false);
  readonly lendoArquivo = signal(false);

  private novaLinha(): LinhaFormulario {
    return { cbo: '', tipo: 'CLT', quantidade: 1 };
  }

  private novoGrupo(): GrupoFormulario {
    return { cnpj: '', linhas: [this.novaLinha()] };
  }

  adicionarGrupo(): void {
    this.grupos.update((g) => [...g, this.novoGrupo()]);
  }

  removerGrupo(indice: number): void {
    this.grupos.update((g) => (g.length > 1 ? g.filter((_, i) => i !== indice) : g));
  }

  adicionarLinha(grupo: GrupoFormulario): void {
    grupo.linhas.push(this.novaLinha());
    this.grupos.update((g) => [...g]);
  }

  removerLinha(grupo: GrupoFormulario, indice: number): void {
    if (grupo.linhas.length > 1) {
      grupo.linhas.splice(indice, 1);
      this.grupos.update((g) => [...g]);
    }
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
    return this.grupos()
      .flatMap((g) => g.linhas)
      .filter((l) => this.cbo.existe(l.cbo))
      .reduce((soma, l) => soma + (l.quantidade || 0), 0);
  }

  async calcularDoFormulario(): Promise<void> {
    const grupos: GrupoEstabelecimento[] = [];
    let preenchidas = 0;
    let invalidas = 0;

    for (const grupo of this.grupos()) {
      const linhas = grupo.linhas.filter((l) => l.cbo.trim() !== '');
      preenchidas += linhas.length;
      invalidas += linhas.filter(
        (l) => !this.cbo.existe(l.cbo) || !Number.isInteger(l.quantidade) || l.quantidade < 1,
      ).length;
      if (linhas.length > 0) {
        grupos.push({
          cnpj: grupo.cnpj.trim(),
          linhas: linhas.map((l) => ({ cbo: l.cbo, tipo: l.tipo, quantidade: l.quantidade })),
        });
      }
    }

    if (preenchidas === 0) {
      this.aviso.open('Informe ao menos uma linha com CBO e quantidade.', 'OK', { duration: 4000 });
      return;
    }
    if (invalidas > 0) {
      this.aviso.open(
        `Há ${invalidas} linha(s) com CBO não encontrado ou quantidade inválida.`,
        'OK',
        { duration: 5000 },
      );
      return;
    }
    await this.estado.calcular(this.nomearGrupos(grupos));
  }

  /** Sem CNPJ informado, cada grupo extra ganha um rótulo para os relatórios. */
  private nomearGrupos(grupos: GrupoEstabelecimento[]): GrupoEstabelecimento[] {
    if (grupos.length === 1) {
      return grupos;
    }
    return grupos.map((g, i) => ({ ...g, cnpj: g.cnpj || `Estabelecimento ${i + 1}` }));
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
      const resultado = await this.importador.lerArquivo(arquivo);
      this.importacao.set(resultado);
      if (resultado.grupos.length > 0) {
        this.aplicarNoFormulario(resultado.grupos);
        this.aviso.open('Planilha importada: o formulário foi atualizado.', 'OK', {
          duration: 4000,
        });
      }
    } catch (e) {
      this.aviso.open(`Não foi possível ler o arquivo (${e}).`, 'OK', { duration: 5000 });
    } finally {
      this.lendoArquivo.set(false);
    }
  }

  /** A planilha importada vira o conteúdo do formulário, que passa a ser a fonte dos dados. */
  private aplicarNoFormulario(grupos: GrupoEstabelecimento[]): void {
    this.grupos.set(
      grupos.map((g) => ({
        cnpj: g.cnpj,
        linhas: g.linhas.map((l) => ({ ...l })),
      })),
    );
  }

  linhasImportadas(): number {
    return (this.importacao()?.grupos ?? []).reduce((soma, g) => soma + g.linhas.length, 0);
  }

  pessoasImportadas(): number {
    return (this.importacao()?.grupos ?? [])
      .flatMap((g) => g.linhas)
      .reduce((soma, l) => soma + l.quantidade, 0);
  }

  /** O formulário já contém os dados importados; basta trocar de aba para revisar. */
  editarNoFormulario(): void {
    this.abaAtiva.set(0);
  }
}
