import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  Plugin,
  Tooltip,
} from 'chart.js';
import { CboService } from '../../core/cbo.service';
import { EstadoService } from '../../core/estado.service';
import { ExportService } from '../../core/export.service';
import { ThemeService } from '../../core/theme.service';
import { ItemResultado, ResultadoCalculo, TIPOS } from '../../core/modelos';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
);

@Component({
  selector: 'app-resultado',
  imports: [
    DecimalPipe,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './resultado.html',
  styleUrl: './resultado.scss',
})
export class Resultado {
  readonly estado = inject(EstadoService);
  readonly cbo = inject(CboService);
  readonly exportador = inject(ExportService);
  private tema = inject(ThemeService);

  readonly visao = signal<'geral' | 'detalhe'>('geral');
  readonly colunas = ['codigo', 'titulo', 'tipo', 'quantidade', 'situacao', 'acoes'];

  private telaComposicao = viewChild<ElementRef<HTMLCanvasElement>>('graficoComposicao');
  private telaCota = viewChild<ElementRef<HTMLCanvasElement>>('graficoCota');
  private graficoComposicao: Chart | null = null;
  private graficoCota: Chart | null = null;

  constructor() {
    // Redesenha quando o resultado, o tema ou a visão mudarem.
    effect(() => {
      const resultado = this.estado.resultado();
      this.tema.escuro();
      this.visao();
      const composicao = this.telaComposicao()?.nativeElement;
      const cota = this.telaCota()?.nativeElement;
      if (resultado && composicao && cota) {
        this.desenharComposicao(composicao, resultado);
        this.desenharCota(cota, resultado);
      }
    });
  }

  rotuloTipo(item: ItemResultado): string {
    return TIPOS.find((t) => t.valor === item.tipo)?.rotulo ?? item.tipo;
  }

  situacaoDe(r: ResultadoCalculo): string {
    if (r.excedente > 0) {
      return `${r.excedente} acima da máxima`;
    }
    if (!r.obrigada) {
      return 'Isenta (base < 7)';
    }
    return r.deficit > 0 ? `Déficit de ${r.deficit}` : 'Cota cumprida';
  }

  /**
   * Resolve uma expressão de cor CSS (var(), light-dark()) para rgb() computado —
   * o canvas não entende light-dark(), então ler a custom property crua não basta.
   */
  private resolverCor(expressao: string, alternativa: string): string {
    const sonda = document.createElement('span');
    sonda.style.color = expressao;
    document.body.appendChild(sonda);
    const cor = getComputedStyle(sonda).color;
    sonda.remove();
    return cor || alternativa;
  }

  private corVar(nome: string): string {
    return this.resolverCor(`var(${nome})`, '#888888');
  }

  private desenharComposicao(tela: HTMLCanvasElement, resultado: ResultadoCalculo): void {
    const c = resultado.composicao;
    const fatias = [
      { rotulo: 'Entram na base', valor: c.entramNaBase, cor: this.corVar('--viz-incluidos') },
      { rotulo: 'Excluídos pelo CBO', valor: c.excluidosPeloCbo, cor: this.corVar('--viz-excluidos-cbo') },
      { rotulo: 'Aprendizes atuais', valor: c.aprendizes, cor: this.corVar('--viz-aprendizes') },
      { rotulo: 'Estagiários', valor: c.estagiarios, cor: this.corVar('--viz-estagiarios') },
      { rotulo: 'Excluídos manualmente', valor: c.excluidosManualmente, cor: this.corVar('--viz-excluidos-manual') },
      {
        rotulo: 'Cargo de confiança (entrada)',
        valor: c.excluidosCargoConfianca,
        cor: this.corVar('--viz-excluidos-confianca'),
      },
    ].filter((f) => f.valor > 0);

    const superficie = this.resolverCor('var(--mat-sys-surface)', '#ffffff');
    const ink = this.resolverCor('var(--mat-sys-on-surface-variant)', '#52514e');
    const inkForte = this.resolverCor('var(--mat-sys-on-surface)', '#0b0b0b');
    const base = resultado.base;

    // Número-herói no centro da rosca: o tamanho da base de cálculo.
    const centro: Plugin<'doughnut'> = {
      id: 'textoCentral',
      afterDraw(grafico) {
        const { ctx, chartArea } = grafico;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '600 26px Roboto, sans-serif';
        ctx.fillStyle = inkForte;
        ctx.fillText(String(base), x, y);
        ctx.font = '400 12px Roboto, sans-serif';
        ctx.fillStyle = ink;
        ctx.fillText('na base', x, y + 18);
        ctx.restore();
      },
    };

    const config: ChartConfiguration<'doughnut', number[], string> = {
      type: 'doughnut',
      data: {
        labels: fatias.map((f) => `${f.rotulo} — ${f.valor}`),
        datasets: [
          {
            data: fatias.map((f) => f.valor),
            backgroundColor: fatias.map((f) => f.cor),
            borderColor: superficie, // espaçador de 2px entre fatias
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: ink, boxWidth: 12, boxHeight: 12, usePointStyle: true },
          },
          tooltip: { callbacks: {} },
        },
      },
      plugins: [centro],
    };
    this.graficoComposicao?.destroy();
    this.graficoComposicao = new Chart(tela, config);
  }

  private desenharCota(tela: HTMLCanvasElement, resultado: ResultadoCalculo): void {
    const ink = this.resolverCor('var(--mat-sys-on-surface-variant)', '#52514e');
    const inkForte = this.resolverCor('var(--mat-sys-on-surface)', '#0b0b0b');
    const grade = this.corVar('--viz-grade');
    const valores = [resultado.minimo, resultado.maximo, resultado.aprendizesAtuais];
    const cores = [
      this.corVar('--viz-incluidos'),
      this.corVar('--viz-cota-maxima'),
      this.corVar('--viz-aprendizes'),
    ];

    // Rótulo direto com o valor acima de cada barra.
    const rotulos: Plugin<'bar'> = {
      id: 'rotulosBarras',
      afterDatasetsDraw(grafico) {
        const { ctx } = grafico;
        const meta = grafico.getDatasetMeta(0);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '600 13px Roboto, sans-serif';
        ctx.fillStyle = inkForte;
        meta.data.forEach((barra, i) => {
          ctx.fillText(String(valores[i]), barra.x, barra.y - 6);
        });
        ctx.restore();
      },
    };

    const config: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: {
        labels: ['Cota mínima (5%)', 'Cota máxima (15%)', 'Aprendizes atuais'],
        datasets: [
          {
            data: valores,
            backgroundColor: cores,
            borderRadius: 4,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: ink }, grid: { display: false } },
          y: {
            beginAtZero: true,
            grace: '10%', // folga para o rótulo acima da barra mais alta
            ticks: { color: ink, precision: 0 },
            grid: { color: grade },
          },
        },
        plugins: { legend: { display: false } },
      },
      plugins: [rotulos],
    };
    this.graficoCota?.destroy();
    this.graficoCota = new Chart(tela, config);
  }
}
