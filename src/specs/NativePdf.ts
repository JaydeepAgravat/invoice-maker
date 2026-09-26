import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type PdfResult = { path: string; pages: number; bytes: number };
export type PageImage = { uri: string; width: number; height: number };

export interface Spec extends TurboModule {
  /** Render HTML to a PDF file in the app cache. `paper` is 'A4' or 'LETTER'. */
  toPdf(html: string, paper: string, fileName: string): Promise<PdfResult>;
  /** Rasterize every page of a PDF to PNG files `width` pixels wide. */
  renderPages(path: string, width: number): Promise<PageImage[]>;
  /** Open the system print dialog for the HTML. */
  print(html: string, paper: string, jobName: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativePdf');
