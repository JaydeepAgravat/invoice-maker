import { DOC_TYPES } from '@/domain/docTypes';

import { PDF_LANGUAGES, pdfLabels } from '../labels';
import { shareMessage } from '../messages';
import { accentPalette, buildModel, TEMPLATE_IDS, type PdfModel } from '../model';
import { qrSvg } from '../qr';
import { esc, renderHtml } from '../render';

import { scenario } from './fixtures';

/** Things that must never reach paper. */
const assertClean = (html: string) => {
  expect(html).not.toMatch(/undefined|NaN|\[object |null<|>null/);
  expect(html).not.toMatch(/\{\w+\}/); // unfilled label placeholders
  expect(html.match(/<table/g)?.length ?? 0).toBe(
    html.match(/<\/table>/g)?.length ?? 0,
  );
  expect(html.match(/<div/g)?.length ?? 0).toBe(
    html.match(/<\/div>/g)?.length ?? 0,
  );
};

describe('full matrix: 9 types × 5 languages × 4 templates × 2 papers', () => {
  for (const type of DOC_TYPES) {
    it(`${type} renders cleanly everywhere`, async () => {
      for (const lang of PDF_LANGUAGES) {
        const input = await scenario({
          type,
          language: lang,
          country: lang === 'en' ? 'GB' : lang === 'pt' ? 'BR' : lang === 'es' ? 'ES' : lang === 'fr' ? 'FR' : 'DE',
        });
        const L = pdfLabels(lang, input.business.country);
        for (const template of TEMPLATE_IDS) {
          for (const paperSize of ['A4', 'LETTER'] as const) {
            const html = renderHtml(buildModel({ ...input, template, paperSize }));
            assertClean(html);
            expect(html).toContain(`size: ${paperSize === 'A4' ? 'A4' : 'letter'}`);
            expect(html).toContain(`class="t-${template}"`);
            expect(html).toContain(input.doc.number!);
            expect(html).toContain('Harper &amp; Lane Architects');
            if (type !== 'STATEMENT') {
              expect(html).toContain(esc(L.description));
            } else {
              expect(html).toContain(esc(L.statement.closingBalance));
            }
          }
        }
      }
    });
  }
});

describe('golden HTML', () => {
  for (const template of TEMPLATE_IDS) {
    it(`invoice, ${template}`, async () => {
      const input = await scenario({ paid: 'partial' });
      expect(renderHtml(buildModel({ ...input, template }))).toMatchSnapshot();
    });
  }
  for (const type of DOC_TYPES) {
    it(`${type}, classic`, async () => {
      const input = await scenario({ type });
      expect(renderHtml(buildModel(input))).toMatchSnapshot();
    });
  }
});

describe('model', () => {
  it('prints what is due, with a payment QR and a free-tier footer', async () => {
    const m = buildModel(await scenario({ paid: 'partial' }));
    expect(m.highlight?.label).toBe('Balance due');
    expect(m.totals.at(-1)).toMatchObject({ label: 'Balance due', tone: 'accent' });
    expect(m.payment?.qr?.svg).toContain('<svg');
    expect(m.pageFooter.center).toBe('Made with Invoice Maker');
    expect(m.stamp).toBeNull();
  });

  it('drops the footer for Pro and payment details once paid', async () => {
    const input = await scenario({ paid: 'full' });
    const m = buildModel({ ...input, isPro: true });
    expect(m.pageFooter.center).toBeNull();
    expect(m.payment).toBeNull();
    expect(m.stamp?.kind).toBe('PAID');
  });

  it('marks drafts and void documents', async () => {
    const draft = buildModel(await scenario({ issued: false }));
    expect(draft.stamp?.kind).toBe('DRAFT');
    expect(draft.number).toBe('INV-0001');
    const voided = buildModel(await scenario({ void: true }));
    expect(voided.stamp?.kind).toBe('VOID');
    expect(renderHtml(voided)).toContain('void-mark');
  });

  it('uses local titles and SEPA / Pix codes', async () => {
    const es = buildModel(await scenario({ type: 'CREDIT_NOTE', country: 'ES', language: 'es' }));
    expect(es.title).toBe('Factura rectificativa');
    expect(es.subtitle).toBe('Rectifica la factura INV-2026-0001');
    const de = buildModel(await scenario({ country: 'DE', language: 'de' }));
    expect(de.payment?.qr?.caption).toBe('Mit Ihrer Banking-App scannen');
    const br = buildModel(await scenario({ country: 'BR', language: 'pt' }));
    expect(br.payment?.qr?.code).toMatch(/^000201.*6304[0-9A-F]{4}$/);
    const au = buildModel(await scenario({ country: 'AU' }));
    expect(au.title).toBe('Tax invoice');
  });

  it('shows prices-included taxes after the total', async () => {
    const m = buildModel(await scenario({ country: 'DE', language: 'de', pricesIncludeTax: true }));
    const i = m.totals.findIndex(r => r.tone === 'strong');
    expect(m.totals.slice(i + 1).some(r => r.tone === 'muted' && r.label.startsWith('Enthaltene'))).toBe(true);
  });

  it('delivery notes have no prices, statements have a ledger', async () => {
    const dn = buildModel(await scenario({ type: 'DELIVERY_NOTE' }));
    expect(dn.columns.prices).toBe(false);
    expect(dn.totals).toEqual([]);
    expect(dn.signatures.client?.heading).toBe('Received by');
    const st = buildModel(await scenario({ type: 'STATEMENT' }));
    expect(st.statement?.rows.length).toBe(4);
    expect(st.highlight?.label).toBe('Total due');
  });

  it('change orders summarise the contract', async () => {
    const m: PdfModel = buildModel(await scenario({ type: 'CHANGE_ORDER' }));
    expect(m.contract?.map(r => r.label)).toEqual([
      'Original estimate',
      'Previous approved changes',
      'This change',
      'Revised contract total',
    ]);
  });

  it('paginates long documents with repeating headers and unsplit rows', async () => {
    const html = renderHtml(buildModel(await scenario({ lines: 40 })));
    expect(html.match(/<tr>\s*<td class="desc">/g)?.length).toBe(40);
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toMatch(/tr, figure \{ break-inside: avoid/);
    expect(html).toContain('counter(pages)');
  });
});

describe('helpers', () => {
  it('escapes user text', () => {
    expect(esc(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;',
    );
  });
  it('picks readable ink for the accent', () => {
    expect(accentPalette('#FFE629').accentInk).toBe('#111113');
    expect(accentPalette('#3E63DD').accentInk).toBe('#FFFFFF');
    expect(accentPalette('nope').accent).toBe('#3E63DD');
  });
  it('builds a vector QR', () => {
    const svg = qrSvg('https://example.com/ñ');
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 (\d+) \1"/);
    expect(svg).toContain('<path');
  });
});

describe('share message', () => {
  const v = {
    client: 'Amelia',
    business: 'Northwind',
    title: 'Invoice',
    number: 'INV-0042',
    amount: '£1,200.00',
    due: '26 Oct 2026',
  };
  it('writes a friendly message in the document language', () => {
    const en = shareMessage('en', 'INVOICE', v);
    expect(en.subject).toBe('Invoice INV-0042 from Northwind');
    expect(en.body).toBe(
      'Hi Amelia,\n\nPlease find invoice INV-0042 for £1,200.00 attached. It is due on 26 Oct 2026.\n\nThank you,\nNorthwind',
    );
    for (const lang of ['es', 'pt', 'fr', 'de', 'xx']) {
      for (const type of ['INVOICE', 'ESTIMATE', 'RECEIPT', 'DELIVERY_NOTE'] as const) {
        const m = shareMessage(lang, type, { ...v, client: null, amount: null });
        expect(m.body).toContain('INV-0042');
        expect(m.body).not.toMatch(/undefined|null/);
      }
    }
    expect(shareMessage('es', 'ESTIMATE', v).body).toContain('válido hasta');
  });
});
