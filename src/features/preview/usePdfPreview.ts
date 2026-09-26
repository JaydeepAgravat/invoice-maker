import { useEffect, useRef, useState } from 'react';

import { useDataVersion } from '@/data/live';
import { previewPages, type Appearance } from '@/pdf/generate';
import type { PdfModel } from '@/pdf/model';
import type { PageImage } from '@/specs/NativePdf';

export type PdfPreview = {
  pages: PageImage[] | null;
  model: PdfModel | null;
  rendering: boolean;
  error: unknown;
};

/**
 * Real PDF pages for a document, re-rendered when its data or appearance
 * changes. Renders never overlap: changes during a render queue exactly one
 * more, and the previous pages stay on screen until the new ones are ready.
 */
export function usePdfPreview(
  id: string,
  appearance: Appearance,
  widthPx: number,
): PdfPreview {
  const version = useDataVersion();
  const [state, setState] = useState<PdfPreview>({
    pages: null,
    model: null,
    rendering: true,
    error: null,
  });
  const running = useRef(false);
  const queued = useRef(false);
  const latest = useRef({ id, appearance, widthPx });
  latest.current = { id, appearance, widthPx };
  const alive = useRef(true);
  const key = JSON.stringify(appearance);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (running.current) {
        queued.current = true;
        return;
      }
      running.current = true;
      setState(s => ({ ...s, rendering: true }));
      try {
        do {
          queued.current = false;
          const { id: docId, appearance: a, widthPx: w } = latest.current;
          const result = await previewPages(docId, a, w);
          if (alive.current && !queued.current) {
            setState({
              pages: result?.pages ?? [],
              model: result?.model ?? null,
              rendering: false,
              error: null,
            });
          }
        } while (queued.current);
      } catch (error) {
        if (alive.current) {
          setState(s => ({ ...s, rendering: false, error }));
        }
      } finally {
        running.current = false;
      }
    };
    const timer = setTimeout(run, 180);
    return () => clearTimeout(timer);
  }, [id, key, widthPx, version]);

  return state;
}
