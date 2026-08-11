import { Injectable, inject } from '@angular/core';
import { baixarCboCsv, baixarCboJson, baixarCboXlsx } from '../export/cbo.exporter';
import { CboService } from './cbo.service';
import { lerBaseCbo } from './cbo.importer';

export interface ResultadoImportarArquivoCbo {
  sucesso: boolean;
  erros: string[];
}

/**
 * Fachada de exportar/importar a própria base CBO (não o quadro de
 * funcionários — isso é ImportService). Delega a leitura/escrita de arquivo
 * para cbo.exporter.ts / cbo.importer.ts e troca a base ativa via CboService.
 */
@Injectable({ providedIn: 'root' })
export class CboBaseService {
  private cbo = inject(CboService);

  baixarJson(): void {
    baixarCboJson(this.cbo.baseAtual());
  }

  async baixarCsv(): Promise<void> {
    await baixarCboCsv(this.cbo.baseAtual());
  }

  async baixarXlsx(): Promise<void> {
    await baixarCboXlsx(this.cbo.baseAtual());
  }

  async importarArquivo(arquivo: File): Promise<ResultadoImportarArquivoCbo> {
    const { base, erros } = await lerBaseCbo(arquivo);
    if (!base) {
      return { sucesso: false, erros };
    }
    this.cbo.importar(base);
    return { sucesso: true, erros };
  }

  async restaurarPadrao(): Promise<void> {
    await this.cbo.restaurarPadrao();
  }
}
