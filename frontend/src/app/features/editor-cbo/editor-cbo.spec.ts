import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CboService } from '../../core/cbo/cbo.service';
import { EditorCboService } from '../../core/cbo/editor-cbo.service';
import { EditorCbo } from './editor-cbo';

describe('EditorCbo', () => {
  let cbo: CboService;
  let editorService: EditorCboService;
  let componente: EditorCbo;
  let fixture: ComponentFixture<EditorCbo>;

  beforeEach(() => {
    localStorage.clear();
    cbo = TestBed.inject(CboService);
    cbo.usarBase({
      geradoEm: '2026-07-10',
      fonte: 'teste',
      ocupacoes: Array.from({ length: 30 }, (_, i) => ({
        codigo: String(100000 + i),
        titulo: `Ocupação ${i}`,
        exigeFormacaoProfissional: i % 2 === 0,
      })),
    });
    editorService = TestBed.inject(EditorCboService);
    fixture = TestBed.createComponent(EditorCbo);
    componente = fixture.componentInstance;
  });

  function abrir(): void {
    editorService.abrir();
    fixture.detectChanges();
  }

  describe('filtro', () => {
    it('filtra pelo prefixo do código', () => {
      abrir();
      componente.aoMudarBusca('100005');
      expect(componente.filtradas().length).toBe(1);
      expect(componente.filtradas()[0].codigo).toBe('100005');
    });

    it('filtra por trecho do título', () => {
      abrir();
      componente.aoMudarBusca('Ocupação 2');
      // "Ocupação 2", "Ocupação 20".."Ocupação 29" -> 11 itens
      expect(componente.filtradas().length).toBe(11);
    });

    it('sem termo devolve todas as ocupações', () => {
      abrir();
      expect(componente.filtradas().length).toBe(30);
    });
  });

  describe('paginação', () => {
    it('divide em páginas de 25 itens', () => {
      abrir();
      expect(componente.totalPaginas()).toBe(2);
      expect(componente.ocupacoesPaginadas().length).toBe(25);
      componente.proximaPagina();
      expect(componente.ocupacoesPaginadas().length).toBe(5);
    });

    it('reseta a página ao mudar o filtro', () => {
      abrir();
      componente.proximaPagina();
      expect(componente.paginaAtual()).toBe(1);
      componente.aoMudarBusca('100005');
      expect(componente.paginaAtual()).toBe(0);
    });

    it('não fica em página vazia quando o filtro reduz o total de páginas', () => {
      abrir();
      componente.paginaAtual.set(1);
      componente.aoMudarBusca('100005');
      expect(componente.paginaClampada()).toBe(0);
      expect(componente.ocupacoesPaginadas().length).toBe(1);
    });
  });

  describe('adicionar', () => {
    it('adiciona uma ocupação válida ao array local', () => {
      abrir();
      componente.abrirFormAdicionar();
      componente.ocupacaoEmForm.set({ codigo: '999999', titulo: 'Nova ocupação', exigeFormacaoProfissional: true });
      componente.salvarLinhaDoForm();
      expect(componente.ocupacoesEmEdicao().some((o) => o.codigo === '999999')).toBe(true);
      expect(componente.ocupacaoEmForm()).toBeNull();
    });

    it('rejeita código malformado sem alterar o array', () => {
      abrir();
      componente.abrirFormAdicionar();
      componente.ocupacaoEmForm.set({ codigo: '123', titulo: 'Inválida', exigeFormacaoProfissional: false });
      componente.salvarLinhaDoForm();
      expect(componente.errosForm().codigo).toBeTruthy();
      expect(componente.ocupacoesEmEdicao().length).toBe(30);
    });

    it('rejeita código duplicado', () => {
      abrir();
      componente.abrirFormAdicionar();
      componente.ocupacaoEmForm.set({ codigo: '100000', titulo: 'Duplicada', exigeFormacaoProfissional: false });
      componente.salvarLinhaDoForm();
      expect(componente.errosForm().codigo).toBeTruthy();
      expect(componente.ocupacoesEmEdicao().length).toBe(30);
    });
  });

  describe('editar', () => {
    it('edita mantendo o mesmo código', () => {
      abrir();
      const alvo = componente.ocupacoesEmEdicao()[0];
      componente.abrirFormEditar(alvo);
      componente.ocupacaoEmForm.set({ ...alvo, titulo: 'Título atualizado' });
      componente.salvarLinhaDoForm();
      expect(componente.ocupacoesEmEdicao().find((o) => o.codigo === alvo.codigo)?.titulo).toBe('Título atualizado');
    });

    it('rejeita mudar para o código de outra linha existente', () => {
      abrir();
      const [primeira, segunda] = componente.ocupacoesEmEdicao();
      componente.abrirFormEditar(primeira);
      componente.ocupacaoEmForm.set({ ...primeira, codigo: segunda.codigo });
      componente.salvarLinhaDoForm();
      expect(componente.errosForm().codigo).toBeTruthy();
    });
  });

  describe('excluir', () => {
    it('remove a ocupação do array local', () => {
      abrir();
      const alvo = componente.ocupacoesEmEdicao()[0];
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      componente.excluirLinha(alvo);
      expect(componente.ocupacoesEmEdicao().some((o) => o.codigo === alvo.codigo)).toBe(false);
    });

    it('não remove se o usuário cancelar a confirmação', () => {
      abrir();
      const alvo = componente.ocupacoesEmEdicao()[0];
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      componente.excluirLinha(alvo);
      expect(componente.ocupacoesEmEdicao().some((o) => o.codigo === alvo.codigo)).toBe(true);
    });
  });

  describe('salvar', () => {
    it('persiste as alterações via cbo.importar() e marca a base como customizada', () => {
      abrir();
      componente.abrirFormAdicionar();
      componente.ocupacaoEmForm.set({ codigo: '999999', titulo: 'Nova', exigeFormacaoProfissional: true });
      componente.salvarLinhaDoForm();
      componente.salvarTudo();
      expect(cbo.customizada()).toBe(true);
      expect(cbo.existe('999999')).toBe(true);
      expect(editorService.aberto()).toBe(false);
    });
  });

  describe('fechar sem salvar', () => {
    it('descarta o rascunho local sem alterar o CboService', () => {
      abrir();
      componente.abrirFormAdicionar();
      componente.ocupacaoEmForm.set({ codigo: '999999', titulo: 'Nova', exigeFormacaoProfissional: true });
      componente.salvarLinhaDoForm();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      componente.fecharSemSalvar();
      expect(cbo.existe('999999')).toBe(false);
      expect(cbo.customizada()).toBe(false);
      expect(editorService.aberto()).toBe(false);
    });
  });
});
