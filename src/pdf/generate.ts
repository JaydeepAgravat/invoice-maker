import { isPro } from '@/billing/entitlement';
import { APP_NAME } from '@/config';
import { clock, getDatabase } from '@/data/database';
import NativePdf, { type PageImage } from '@/specs/NativePdf';

import { loadPdfInput } from './load';
import { buildModel, type PdfInput, type PdfModel } from './model';
import { renderHtml } from './render';

export type Appearance = Partial<
  Pick<PdfInput, 'template' | 'accentColor' | 'paperSize'>
>;

export type RenderedDocument = {
  model: PdfModel;
  html: string;
  fileName: string;
};

const native = () => {
  if (!NativePdf) {
    throw new Error('NativePdf module is not available');
  }
  return NativePdf;
};

/** "Invoice INV-0042.pdf", in the document's language. */
const fileNameFor = (m: PdfModel) =>
  `${[m.title, m.number].filter(Boolean).join(' ')}.pdf`.replace(
    /[\\/:*?"<>|]/g,
    '-',
  );

export async function renderDocument(
  id: string,
  appearance: Appearance = {},
): Promise<RenderedDocument | null> {
  const db = await getDatabase();
  const input = await loadPdfInput(db, id, {
    today: clock.today(),
    isPro: isPro(),
    appName: APP_NAME,
  });
  if (!input) {
    return null;
  }
  const model = buildModel({
    ...input,
    ...Object.fromEntries(
      Object.entries(appearance).filter(([, v]) => v !== undefined),
    ),
  });
  return { model, html: renderHtml(model), fileName: fileNameFor(model) };
}

export type GeneratedPdf = RenderedDocument & {
  path: string;
  pages: number;
  bytes: number;
};

/** Write the PDF to the app cache (shared from there through the FileProvider). */
export async function generatePdf(
  id: string,
  appearance?: Appearance,
): Promise<GeneratedPdf | null> {
  const doc = await renderDocument(id, appearance);
  if (!doc) {
    return null;
  }
  const result = await native().toPdf(doc.html, doc.model.paper, doc.fileName);
  return { ...doc, ...result };
}

/**
 * Preview pages as images. Written under a per-preview name so a preview
 * never overwrites the file currently being shared.
 */
export async function previewPages(
  id: string,
  appearance: Appearance,
  widthPx: number,
): Promise<{ pages: PageImage[]; model: PdfModel } | null> {
  const doc = await renderDocument(id, appearance);
  if (!doc) {
    return null;
  }
  const pdf = await native().toPdf(
    doc.html,
    doc.model.paper,
    `preview-${id}-${widthPx}.pdf`,
  );
  const pages = await native().renderPages(pdf.path, widthPx);
  return { pages, model: doc.model };
}

export async function printDocument(id: string): Promise<void> {
  const doc = await renderDocument(id);
  if (doc) {
    await native().print(
      doc.html,
      doc.model.paper,
      doc.fileName.replace(/\.pdf$/, ''),
    );
  }
}
