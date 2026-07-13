import { Injectable, signal } from '@angular/core';

export interface PreRequisitoAjuda {
  /** Seletor CSS do elemento que precisa ser acionado antes. */
  alvo: string;
  /** Aviso exibido em tooltip sobre esse elemento. */
  mensagem: string;
}

export interface TopicoAjuda {
  id: string;
  titulo: string;
  descricao: string;
  /** Seletor CSS da área destacada ao clicar no tópico. */
  alvo: string;
  /**
   * Quando o alvo não está visível, o primeiro pré-requisito visível é
   * destacado no lugar, com a mensagem em tooltip (ex.: trocar de aba,
   * calcular a cota antes).
   */
  preRequisitos?: PreRequisitoAjuda[];
}

const ABA_FORMULARIO: PreRequisitoAjuda = {
  alvo: '.ajuda-aba-formulario',
  mensagem: 'Abra a aba "Formulário" para ver esta área.',
};
const ABA_IMPORTAR: PreRequisitoAjuda = {
  alvo: '.ajuda-aba-importar',
  mensagem: 'Abra a aba "Importar planilha" para ver esta área.',
};
const CALCULAR_ANTES: PreRequisitoAjuda = {
  alvo: '[data-ajuda="calcular"]',
  mensagem: 'Calcule a cota primeiro: o resultado aparece depois de clicar aqui.',
};

@Injectable({ providedIn: 'root' })
export class AjudaService {
  readonly aberta = signal(false);
  readonly topicoAtivo = signal<string | null>(null);

  readonly topicos: TopicoAjuda[] = [
    {
      id: 'quadro',
      titulo: 'Quadro de funcionários',
      descricao:
        'Cartão onde você informa os funcionários da empresa, pelo formulário ou importando uma planilha. É a partir dele que a cota é calculada.',
      alvo: '[data-ajuda="quadro"]',
    },
    {
      id: 'campo-cbo',
      titulo: 'Campo CBO',
      descricao:
        'Digite o código (ex.: 411010) ou o título da ocupação; o campo sugere ocupações da base oficial e mostra o título do CBO escolhido.',
      alvo: '[data-ajuda="campo-cbo"]',
      preRequisitos: [ABA_FORMULARIO],
    },
    {
      id: 'vinculo',
      titulo: 'Vínculo',
      descricao:
        'Tipo de contrato da linha: CLT e PCD entram na base de cálculo; estagiários ficam de fora; aprendizes servem para aferir o cumprimento da cota.',
      alvo: '[data-ajuda="campo-tipo"]',
      preRequisitos: [ABA_FORMULARIO],
    },
    {
      id: 'quantidade',
      titulo: 'Quantidade',
      descricao:
        'Número de funcionários daquele CBO com aquele vínculo. Use "Adicionar linha" para incluir outras ocupações.',
      alvo: '[data-ajuda="campo-qtd"]',
      preRequisitos: [ABA_FORMULARIO],
    },
    {
      id: 'cargo-confianca',
      titulo: 'Cargo de confiança',
      descricao:
        'Quantas das pessoas desta linha são cargo de direção ou confiança — essa parcela fica fora da base de cálculo. Ex.: 5 no CBO e 1 de confiança conta 4 na base e exclui só 1, sem precisar de outra linha.',
      alvo: '[data-ajuda="campo-confianca"]',
      preRequisitos: [ABA_FORMULARIO],
    },
    {
      id: 'filiais',
      titulo: 'Matriz e filiais (CNPJ)',
      descricao:
        'A cota é apurada por estabelecimento. Use "Adicionar filial" para criar outro quadro e informe o CNPJ (opcional) no topo de cada retângulo.',
      alvo: '[data-ajuda="adicionar-filial"]',
      preRequisitos: [ABA_FORMULARIO],
    },
    {
      id: 'importar',
      titulo: 'Importar planilha',
      descricao:
        'Arraste ou escolha um arquivo .csv ou .xlsx; os dados preenchem o formulário automaticamente, no formato por quantidade ou por nome de funcionário.',
      alvo: '[data-ajuda="importar"]',
      preRequisitos: [ABA_IMPORTAR],
    },
    {
      id: 'modelos',
      titulo: 'Modelos de planilha',
      descricao:
        'Baixe um modelo pronto (CSV ou XLSX), por quantidade ou por nome, para preencher e importar.',
      alvo: '[data-ajuda="modelos"]',
      preRequisitos: [ABA_IMPORTAR],
    },
    {
      id: 'calcular',
      titulo: 'Calcular cota',
      descricao:
        'Valida as linhas, classifica cada CBO segundo a base legal e calcula a cota mínima (5%) e máxima (15%) por estabelecimento.',
      alvo: '[data-ajuda="calcular"]',
    },
    {
      id: 'visao',
      titulo: 'Visão geral × detalhada',
      descricao:
        'Alterna o resultado entre o painel com cartões e gráficos e a tabela detalhada por CBO.',
      alvo: '[data-ajuda="troca-visao"]',
      preRequisitos: [CALCULAR_ANTES],
    },
    {
      id: 'cartoes',
      titulo: 'Cartões de resumo',
      descricao:
        'Base de cálculo, cotas mínima e máxima, aprendizes atuais e a situação: déficit, cumprida, isenta ou excedente.',
      alvo: '[data-ajuda="cartoes"]',
      preRequisitos: [CALCULAR_ANTES],
    },
    {
      id: 'graficos',
      titulo: 'Gráficos',
      descricao:
        'Composição do quadro informado e comparação entre a cota exigida e os aprendizes atuais.',
      alvo: '[data-ajuda="graficos"]',
      preRequisitos: [
        {
          alvo: '[data-ajuda="troca-visao"]',
          mensagem: 'Selecione "Visão geral" para ver os gráficos.',
        },
        CALCULAR_ANTES,
      ],
    },
    {
      id: 'detalhe',
      titulo: 'Tabela detalhada por CBO',
      descricao:
        'Mostra se cada CBO entra na base e o motivo; permite excluir cargos de direção ou confiança.',
      alvo: '[data-ajuda="detalhe"]',
      preRequisitos: [
        {
          alvo: '[data-ajuda="troca-visao"]',
          mensagem: 'Clique em "Detalhado por CBO" para ver esta tabela.',
        },
        CALCULAR_ANTES,
      ],
    },
    {
      id: 'conferir-cbo',
      titulo: 'Conferência do CBO',
      descricao:
        'A classificação de cada CBO — se ele entra na cota ou não — vem direto da ficha oficial do MTE (Livros 1 e 2 da Classificação Brasileira de Ocupações), não de uma estimativa. O ícone ao lado de cada linha abre o PDF oficial já na página da família daquele código, para você conferir a fonte.',
      alvo: '[data-ajuda="conferir-cbo"]',
      preRequisitos: [
        {
          alvo: '[data-ajuda="troca-visao"]',
          mensagem: 'Clique em "Detalhado por CBO" para ver o botão de conferência.',
        },
        CALCULAR_ANTES,
      ],
    },
    {
      id: 'exportar',
      titulo: 'Baixar relatório',
      descricao:
        'Gera o relatório completo em CSV, XLSX ou PDF, com o resumo por estabelecimento e o detalhe por CBO.',
      alvo: '[data-ajuda="exportar"]',
      preRequisitos: [CALCULAR_ANTES],
    },
    {
      id: 'contratar',
      titulo: 'Contratar aprendizes',
      descricao:
        'Leva ao site do Aprendiz Gerar para contratar os aprendizes necessários para cumprir a cota.',
      alvo: '[data-ajuda="contratar"]',
      preRequisitos: [CALCULAR_ANTES],
    },
    {
      id: 'tema',
      titulo: 'Tema claro/escuro',
      descricao: 'Alterna a aparência da página; a preferência fica salva no navegador.',
      alvo: '[data-ajuda="tema"]',
    },
    {
      id: 'base',
      titulo: 'Base CBO oficial',
      descricao:
        'O rodapé mostra quantas ocupações a base tem, quando foi atualizada e a fonte oficial (MTE); ela é atualizada automaticamente.',
      alvo: '[data-ajuda="rodape"]',
    },
  ];

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  abrir(): void {
    this.aberta.set(true);
  }

  fechar(): void {
    this.aberta.set(false);
    this.limpar();
  }

  /**
   * Destaca a área do tópico na tela. Se ela não estiver visível (outra aba,
   * resultado ainda não calculado), destaca a ação necessária para exibi-la e
   * mostra um tooltip explicando o passo que falta.
   */
  destacar(topico: TopicoAjuda): void {
    this.limpar();
    this.topicoAtivo.set(topico.id);

    const alvo = this.elementoVisivel(topico.alvo);
    if (alvo) {
      this.aplicarDestaque(alvo);
      return;
    }
    for (const pre of topico.preRequisitos ?? []) {
      const elemento = this.elementoVisivel(pre.alvo);
      if (elemento) {
        this.aplicarDestaque(elemento, pre.mensagem);
        return;
      }
    }
    this.topicoAtivo.set(null);
  }

  limpar(): void {
    this.removerDestaque();
    this.topicoAtivo.set(null);
  }

  private removerDestaque(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    document.querySelectorAll('.ajuda-destaque').forEach((e) => e.classList.remove('ajuda-destaque'));
    document.querySelectorAll('.ajuda-dica').forEach((e) => e.remove());
  }

  /** Visível = presente no DOM, com caixa renderizada e sem visibility:hidden (abas inativas). */
  private elementoVisivel(seletor: string): HTMLElement | null {
    const elemento = document.querySelector<HTMLElement>(seletor);
    if (!elemento || elemento.getClientRects().length === 0) {
      return null;
    }
    return getComputedStyle(elemento).visibility === 'hidden' ? null : elemento;
  }

  private aplicarDestaque(elemento: HTMLElement, mensagem?: string): void {
    elemento.classList.add('ajuda-destaque');
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (mensagem) {
      // Espera o scroll assentar para medir a posição correta do tooltip.
      setTimeout(() => this.mostrarDica(elemento, mensagem), 450);
    }
    this.temporizador = setTimeout(() => this.removerDestaque(), 8000);
  }

  private mostrarDica(elemento: HTMLElement, mensagem: string): void {
    if (!elemento.classList.contains('ajuda-destaque')) {
      return; // destaque já foi limpo nesse meio-tempo
    }
    const dica = document.createElement('div');
    dica.className = 'ajuda-dica';
    dica.setAttribute('role', 'status');
    dica.textContent = mensagem;
    document.body.appendChild(dica);

    const area = elemento.getBoundingClientRect();
    const largura = dica.offsetWidth;
    const altura = dica.offsetHeight;
    const esquerda = Math.min(
      Math.max(area.left + area.width / 2 - largura / 2, 8),
      window.innerWidth - largura - 8,
    );
    const acima = area.top - altura - 10;
    dica.style.left = `${esquerda}px`;
    dica.style.top = `${acima >= 8 ? acima : area.bottom + 10}px`;
  }
}
