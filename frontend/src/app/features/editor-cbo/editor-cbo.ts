import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CboService } from '../../core/cbo/cbo.service';
import { EditorCboService } from '../../core/cbo/editor-cbo.service';
import { ErrosCampoOcupacao, validarCampoOcupacao } from '../../core/cbo/cbo.validacao';
import { Ocupacao } from '../../core/modelos/modelos';

const ITENS_POR_PAGINA = 25;

@Component({
  selector: 'app-editor-cbo',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './editor-cbo.html',
  styleUrl: './editor-cbo.scss',
})
export class EditorCbo {
  readonly editor = inject(EditorCboService);
  private cbo = inject(CboService);
  private aviso = inject(MatSnackBar);

  readonly ocupacoesEmEdicao = signal<Ocupacao[]>([]);
  readonly termoBusca = signal('');
  readonly paginaAtual = signal(0);

  /** null = formulário fechado. */
  readonly ocupacaoEmForm = signal<Ocupacao | null>(null);
  /** null = modo "adicionar"; string = editando esta ocupação (mantém o código permitido). */
  readonly editandoCodigoOriginal = signal<string | null>(null);
  readonly errosForm = signal<ErrosCampoOcupacao>({});

  private snapshotOriginal: Ocupacao[] = [];

  readonly filtradas = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    const lista = this.ocupacoesEmEdicao();
    if (!termo) {
      return lista;
    }
    const soDigitos = termo.replace(/\D/g, '');
    return lista.filter(
      (o) => (soDigitos.length > 0 && o.codigo.startsWith(soDigitos)) || o.titulo.toLowerCase().includes(termo),
    );
  });

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / ITENS_POR_PAGINA)));

  readonly paginaClampada = computed(() => Math.min(this.paginaAtual(), this.totalPaginas() - 1));

  readonly ocupacoesPaginadas = computed(() => {
    const inicio = this.paginaClampada() * ITENS_POR_PAGINA;
    return this.filtradas().slice(inicio, inicio + ITENS_POR_PAGINA);
  });

  readonly houveAlteracao = computed(
    () => JSON.stringify(this.ocupacoesEmEdicao()) !== JSON.stringify(this.snapshotOriginal),
  );

  constructor() {
    effect(() => {
      if (this.editor.aberto()) {
        this.reiniciarComABaseAtual();
      }
    });
  }

  aoMudarBusca(termo: string): void {
    this.termoBusca.set(termo);
    this.paginaAtual.set(0);
  }

  paginaAnterior(): void {
    this.paginaAtual.update((p) => Math.max(0, p - 1));
  }

  proximaPagina(): void {
    this.paginaAtual.update((p) => Math.min(this.totalPaginas() - 1, p + 1));
  }

  abrirFormAdicionar(): void {
    this.editandoCodigoOriginal.set(null);
    this.ocupacaoEmForm.set({ codigo: '', titulo: '', exigeFormacaoProfissional: false });
    this.errosForm.set({});
  }

  abrirFormEditar(ocupacao: Ocupacao): void {
    this.editandoCodigoOriginal.set(ocupacao.codigo);
    this.ocupacaoEmForm.set({ ...ocupacao });
    this.errosForm.set({});
  }

  fecharForm(): void {
    this.ocupacaoEmForm.set(null);
    this.errosForm.set({});
  }

  salvarLinhaDoForm(): void {
    const candidato = this.ocupacaoEmForm();
    if (!candidato) {
      return;
    }
    const codigoNormalizado = { ...candidato, codigo: candidato.codigo.replace(/\D/g, '') };
    const erros = validarCampoOcupacao(codigoNormalizado, this.ocupacoesEmEdicao(), this.editandoCodigoOriginal());
    this.errosForm.set(erros);
    if (Object.keys(erros).length > 0) {
      return;
    }

    const codigoOriginal = this.editandoCodigoOriginal();
    if (codigoOriginal === null) {
      this.ocupacoesEmEdicao.update((lista) => [codigoNormalizado, ...lista]);
    } else {
      this.ocupacoesEmEdicao.update((lista) =>
        lista.map((o) => (o.codigo === codigoOriginal ? codigoNormalizado : o)),
      );
    }
    this.fecharForm();
  }

  excluirLinha(ocupacao: Ocupacao): void {
    if (!confirm(`Excluir a ocupação ${ocupacao.codigo} — ${ocupacao.titulo}?`)) {
      return;
    }
    this.ocupacoesEmEdicao.update((lista) => lista.filter((o) => o.codigo !== ocupacao.codigo));
  }

  salvarTudo(): void {
    this.cbo.importar({
      geradoEm: this.cbo.geradoEm(),
      fonte: this.cbo.fonte(),
      ocupacoes: this.ocupacoesEmEdicao(),
    });
    this.aviso.open(`Base CBO atualizada: ${this.ocupacoesEmEdicao().length} ocupações.`, 'OK', { duration: 4000 });
    this.editor.fechar();
  }

  fecharSemSalvar(): void {
    if (this.houveAlteracao() && !confirm('Existem alterações não salvas. Fechar mesmo assim?')) {
      return;
    }
    this.fecharForm();
    this.editor.fechar();
  }

  private reiniciarComABaseAtual(): void {
    const copia = this.cbo.baseAtual().ocupacoes.map((o) => ({ ...o }));
    this.ocupacoesEmEdicao.set(copia);
    this.snapshotOriginal = copia.map((o) => ({ ...o }));
    this.termoBusca.set('');
    this.paginaAtual.set(0);
    this.fecharForm();
  }
}
