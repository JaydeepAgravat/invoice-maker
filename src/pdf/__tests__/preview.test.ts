/**
 * Writes sample HTML for visual review when PDF_PREVIEW_DIR is set:
 *   PDF_PREVIEW_DIR=/tmp/pdf npx jest src/pdf/__tests__/preview.test.ts
 * Skipped in normal runs.
 */

import { buildModel, TEMPLATE_IDS } from '../model';
import { renderHtml } from '../render';

import { scenario, type Scenario } from './fixtures';

// Tooling only: Node APIs typed locally (the app tsconfig has no Node types).
const { writeFileSync, mkdirSync } = require('node:fs') as {
  writeFileSync: (path: string, data: string) => void;
  mkdirSync: (path: string, opts: { recursive: boolean }) => void;
};
declare const process: { env: Record<string, string | undefined> };
const join = (...parts: string[]) => parts.join('/');

const dir = process.env.PDF_PREVIEW_DIR;
const run = dir ? describe : describe.skip;

const CASES: Array<[string, Scenario]> = (
  process.env.PDF_PREVIEW_CASES ?? 'invoice'
)
  .split(',')
  .map((name: string): [string, Scenario] => {
    switch (name) {
      case 'long':
        return [name, { lines: 40 }];
      case 'partial':
        return [name, { paid: 'partial' }];
      case 'es':
        return [name, { country: 'ES', language: 'es' }];
      case 'br':
        return [name, { country: 'BR', language: 'pt' }];
      case 'de':
        return [name, { country: 'DE', language: 'de' }];
      case 'estimate':
        return [name, { type: 'ESTIMATE' }];
      case 'statement':
        return [name, { type: 'STATEMENT' }];
      case 'delivery':
        return [name, { type: 'DELIVERY_NOTE' }];
      case 'co':
        return [name, { type: 'CHANGE_ORDER' }];
      case 'void':
        return [name, { void: true }];
      default:
        return [name, {}];
    }
  });

run('pdf preview', () => {
  it('writes HTML', async () => {
    mkdirSync(dir!, { recursive: true });
    for (const [name, s] of CASES) {
      const input = await scenario(s);
      const templates = process.env.PDF_PREVIEW_TEMPLATES?.split(',') ?? TEMPLATE_IDS;
      for (const template of templates) {
        const html = renderHtml(buildModel({ ...input, template }));
        writeFileSync(join(dir!, `${name}-${template}.html`), html);
      }
    }
  });
});
