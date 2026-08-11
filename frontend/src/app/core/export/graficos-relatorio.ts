import type { ChartConfiguration } from 'chart.js';
import { PALETA_RELATORIO, barrasCota, fatiasComposicao } from '../graficos/graficos';
import { ResultadoCalculo } from '../modelos/modelos';
import { BARRAS_PX, FONTE, GraficosRelatorio, ROSCA_PX, TINTA, TINTA_FORTE } from './export.constantes';

/**
 * Renderiza os gráficos do estabelecimento como PNG, fora da tela. Os
 * relatórios saem em fundo branco, então usam a paleta do tema claro
 * (PALETA_RELATORIO) e não a do tema escolhido na tela.
 */
export async function renderizarGraficos(resultado: ResultadoCalculo): Promise<GraficosRelatorio> {
  const chartjs = await import('chart.js');
  const { Chart } = chartjs;
  Chart.register(
    chartjs.ArcElement,
    chartjs.BarController,
    chartjs.BarElement,
    chartjs.CategoryScale,
    chartjs.DoughnutController,
    chartjs.Legend,
    chartjs.LinearScale,
  );

  const fatias = fatiasComposicao(resultado);
  const base = resultado.base;
  const centro = {
    id: 'textoCentral',
    afterDraw(grafico: import('chart.js').Chart) {
      const { ctx, chartArea } = grafico;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `600 44px ${FONTE}`;
      ctx.fillStyle = TINTA_FORTE;
      ctx.fillText(String(base), x, y);
      ctx.font = `400 20px ${FONTE}`;
      ctx.fillStyle = TINTA;
      ctx.fillText('na base', x, y + 30);
      ctx.restore();
    },
  };

  const composicao: ChartConfiguration<'doughnut', number[], string> = {
    type: 'doughnut',
    data: {
      labels: fatias.map((f) => `${f.rotulo} — ${f.valor}`),
      datasets: [
        {
          data: fatias.map((f) => f.valor),
          backgroundColor: fatias.map((f) => PALETA_RELATORIO[f.corVar]),
          borderColor: '#ffffff', // espaçador entre fatias
          borderWidth: 4,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      cutout: '62%',
      layout: { padding: 16 },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: TINTA,
            boxWidth: 20,
            boxHeight: 20,
            usePointStyle: true,
            font: { size: 20 },
          },
        },
      },
    },
    plugins: [centro],
  };

  const barras = barrasCota(resultado);
  const valores = barras.map((b) => b.valor);
  const rotulos = {
    id: 'rotulosBarras',
    afterDatasetsDraw(grafico: import('chart.js').Chart) {
      const { ctx } = grafico;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `600 22px ${FONTE}`;
      ctx.fillStyle = TINTA_FORTE;
      grafico.getDatasetMeta(0).data.forEach((barra, i) => {
        ctx.fillText(String(valores[i]), barra.x, barra.y - 10);
      });
      ctx.restore();
    },
  };

  const cota: ChartConfiguration<'bar', number[], string> = {
    type: 'bar',
    data: {
      labels: barras.map((b) => b.rotulo),
      datasets: [
        {
          data: valores,
          backgroundColor: barras.map((b) => PALETA_RELATORIO[b.corVar]),
          borderRadius: 6,
          maxBarThickness: 160,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      layout: { padding: { top: 24, right: 16, bottom: 8, left: 8 } },
      scales: {
        x: { ticks: { color: TINTA, font: { size: 20 } }, grid: { display: false } },
        y: {
          beginAtZero: true,
          grace: '15%', // folga para o rótulo acima da barra mais alta
          ticks: { color: TINTA, precision: 0, font: { size: 18 } },
          grid: { color: PALETA_RELATORIO['--viz-grade'] },
        },
      },
      plugins: { legend: { display: false } },
    },
    plugins: [rotulos],
  };

  return {
    composicao: await paraPng(Chart, ROSCA_PX, composicao),
    cota: await paraPng(Chart, BARRAS_PX, cota),
  };
}

/** Desenha um gráfico num canvas fora da tela e devolve o PNG em data URL. */
async function paraPng(
  Chart: typeof import('chart.js').Chart,
  tamanhoPx: { largura: number; altura: number },
  config: ChartConfiguration<'doughnut' | 'bar', number[], string>,
): Promise<string> {
  const tela = document.createElement('canvas');
  tela.width = tamanhoPx.largura;
  tela.height = tamanhoPx.altura;
  // Fora da área visível, mas no documento: o Chart.js precisa disso para
  // medir fontes corretamente.
  tela.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
  document.body.appendChild(tela);
  try {
    const contexto = tela.getContext('2d');
    if (contexto) {
      // O PNG sai transparente por padrão; no PDF isso vira fundo escuro.
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, tela.width, tela.height);
    }
    const grafico = new Chart(tela, config as ChartConfiguration);
    const url = tela.toDataURL('image/png');
    grafico.destroy();
    return url;
  } finally {
    tela.remove();
  }
}
