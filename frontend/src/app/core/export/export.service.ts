import { Injectable, inject } from '@angular/core';
import { CboService } from '../cbo/cbo.service';
import { ResultadoCalculo } from '../modelos/modelos';
import { baixarCsv } from './csv.exporter';
import { baixarPdf } from './pdf.exporter';
import { baixarXlsx } from './xlsx.exporter';

/**
 * Fachada dos três formatos de exportação (CSV, XLSX, PDF). A lógica de cada
 * formato vive em seu próprio arquivo — este serviço só resolve as
 * dependências do Angular (CboService) e delega.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private cbo = inject(CboService);

  async baixarCsv(resultados: ResultadoCalculo[]): Promise<void> {
    await baixarCsv(resultados);
  }

  async baixarXlsx(resultados: ResultadoCalculo[]): Promise<void> {
    await baixarXlsx(resultados, this.cbo.geradoEm());
  }

  async baixarPdf(resultados: ResultadoCalculo[]): Promise<void> {
    await baixarPdf(resultados, { geradoEm: this.cbo.geradoEm(), fonte: this.cbo.fonte() });
  }
}
