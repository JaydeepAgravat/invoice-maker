import type { ItemRow, PdfImage, PdfModel, Row, TotalRow } from './model';

/**
 * HTML for Chromium's print engine. One document structure, four looks.
 * Print rules that matter: table headers repeat on every page, rows and
 * blocks never split across pages, page numbers live in @page margin boxes,
 * and colours print exactly (print-color-adjust).
 */

/* ───────────────────────────── Helpers ───────────────────────────── */

export const esc = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Multi-line user text: escaped, line breaks kept. */
const multiline = (s: string) => esc(s).replace(/\r?\n/g, '<br>');

/** Value for CSS `content: "..."`. */
const cssString = (s: string) =>
  `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

const src = (uri: string) =>
  esc(/^(file|content|data|https?):/.test(uri) ? uri : `file://${uri}`);

const img = (image: PdfImage, cls: string, alt = '') =>
  `<img class="${cls}" src="${src(image.uri)}" alt="${esc(alt)}">`;

const when = (cond: unknown, html: () => string) => (cond ? html() : '');

const lines = (ls: string[], cls = 'lines') =>
  when(ls.length, () => `<div class="${cls}">${ls.map(l => `<div>${esc(l)}</div>`).join('')}</div>`);

/* ───────────────────────────── Partials ──────────────────────────── */

const businessBlock = (m: PdfModel, opts: { logo?: boolean } = {}) => `
  <div class="business">
    ${when(opts.logo !== false && m.business.logo, () => img(m.business.logo!, 'logo', m.business.name))}
    ${when(m.business.name, () => `<div class="business-name">${esc(m.business.name)}</div>`)}
    ${lines(m.business.lines, 'lines muted')}
  </div>`;

const partyBlock = (m: PdfModel) =>
  when(m.party || m.shipTo, () => `
  <div class="parties">
    ${when(m.party, () => `
      <div class="party">
        <div class="label">${esc(m.party!.heading)}</div>
        <div class="party-name">${esc(m.party!.name)}</div>
        ${lines(m.party!.lines, 'lines muted')}
      </div>`)}
    ${when(m.shipTo, () => `
      <div class="party">
        <div class="label">${esc(m.shipTo!.heading)}</div>
        ${lines(m.shipTo!.lines, 'lines muted')}
      </div>`)}
  </div>`);

const metaTable = (rows: Row[]) =>
  when(rows.length, () => `
  <table class="meta">
    ${rows.map(r => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join('')}
  </table>`);

const stampBadge = (m: PdfModel) =>
  when(m.stamp && m.stamp.kind !== 'VOID', () =>
    `<span class="stamp stamp-${m.stamp!.kind.toLowerCase()}">${esc(m.stamp!.label)}</span>`);

const voidWatermark = (m: PdfModel) =>
  when(m.stamp?.kind === 'VOID', () => `<div class="void-mark">${esc(m.stamp!.label)}</div>`);

const subtitle = (m: PdfModel) =>
  when(m.docTitle || m.subtitle, () => `
  <div class="subtitle">
    ${when(m.docTitle, () => `<div class="doc-title">${esc(m.docTitle)}</div>`)}
    ${when(m.subtitle, () => `<div class="muted">${esc(m.subtitle)}</div>`)}
  </div>`);

const itemsTable = (m: PdfModel) => {
  const L = m.labels;
  const c = m.columns;
  const head = [
    `<th class="desc">${esc(L.description)}</th>`,
    `<th class="num">${esc(L.qty)}</th>`,
    c.prices ? `<th class="num">${esc(L.unitPrice)}</th>` : '',
    c.discount ? `<th class="num">${esc(L.discount)}</th>` : '',
    c.tax ? `<th class="num">${esc(L.tax)}</th>` : '',
    c.prices ? `<th class="num">${esc(L.amount)}</th>` : '',
  ].join('');
  const row = (r: ItemRow) => `
    <tr>
      <td class="desc"><div class="item-name">${esc(r.name)}</div>${when(r.description, () => `<div class="item-desc">${multiline(r.description!)}</div>`)}</td>
      <td class="num">${esc(r.qty)}</td>
      ${c.prices ? `<td class="num">${esc(r.unitPrice)}</td>` : ''}
      ${c.discount ? `<td class="num">${esc(r.discount)}</td>` : ''}
      ${c.tax ? `<td class="num">${esc(r.tax)}</td>` : ''}
      ${c.prices ? `<td class="num amount">${esc(r.amount)}</td>` : ''}
    </tr>`;
  return when(m.items.length, () => `
  <table class="items">
    <thead><tr>${head}</tr></thead>
    <tbody>${m.items.map(row).join('')}</tbody>
  </table>`);
};

const totalsTable = (rows: TotalRow[], cls = 'totals') =>
  when(rows.length, () => `
  <table class="${cls}">
    ${rows.map(r => `<tr class="${r.tone ?? ''}"><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join('')}
  </table>`);

const contractBlock = (m: PdfModel) =>
  when(m.contract, () => `
  <div class="block keep contract">
    ${totalsTable(m.contract!, 'totals contract-table')}
  </div>`);

const statementBlock = (m: PdfModel) => {
  const s = m.statement;
  const S = m.labels.statement;
  return when(s, () => `
  <table class="items statement">
    <thead><tr>
      <th>${esc(S.date)}</th><th class="desc">${esc(S.document)}</th>
      <th class="num">${esc(S.charges)}</th><th class="num">${esc(S.credits)}</th><th class="num">${esc(S.balance)}</th>
    </tr></thead>
    <tbody>
      <tr class="opening"><td></td><td class="desc">${esc(S.openingBalance)}</td><td></td><td></td><td class="num amount">${esc(s!.opening)}</td></tr>
      ${s!.rows.map(r => `<tr><td class="nowrap">${esc(r.date)}</td><td class="desc">${esc(r.document)}</td><td class="num">${esc(r.charges)}</td><td class="num">${esc(r.credits)}</td><td class="num amount">${esc(r.balance)}</td></tr>`).join('')}
      <tr class="closing"><td></td><td class="desc">${esc(S.closingBalance)}</td><td></td><td></td><td class="num amount">${esc(s!.closing)}</td></tr>
    </tbody>
  </table>
  <div class="block keep aging">
    <div class="label">${esc(S.aging)}</div>
    <table class="aging-table"><tr>${s!.aging.map(a => `<th>${esc(a.label)}</th>`).join('')}</tr>
    <tr>${s!.aging.map(a => `<td>${esc(a.value)}</td>`).join('')}</tr></table>
  </div>`);
};

const paymentBlock = (m: PdfModel) => {
  const p = m.payment;
  return when(p, () => `
  <div class="block keep payment">
    <div class="payment-body">
      <div class="label">${esc(m.labels.paymentDetails)}</div>
      ${p!.methods.map(method => `
        <div class="method">
          <div class="method-title">${esc(method.title)}</div>
          ${when(method.rows.length, () => `<table class="kv">${method.rows.map(r => `<tr><th>${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join('')}</table>`)}
          ${when(method.text, () => `<div class="muted">${multiline(method.text!)}</div>`)}
        </div>`).join('')}
    </div>
    ${when(p!.qr, () => `
      <div class="qr">
        <div class="qr-code">${p!.qr!.svg}</div>
        <div class="qr-caption">${esc(p!.qr!.caption)}</div>
      </div>`)}
  </div>
  ${when(p!.qr?.code, () => `
    <div class="block keep pix-code">
      <div class="label">${esc(m.labels.pixCopyPaste)}</div>
      <div class="code">${esc(p!.qr!.code)}</div>
    </div>`)}`);
};

const notesBlock = (m: PdfModel) =>
  when(m.notes || m.terms, () => `
  <div class="block notes">
    ${when(m.notes, () => `<div class="note keep"><div class="label">${esc(m.labels.notes)}</div><div>${multiline(m.notes!)}</div></div>`)}
    ${when(m.terms, () => `<div class="note keep"><div class="label">${esc(m.labels.terms)}</div><div>${multiline(m.terms!)}</div></div>`)}
  </div>`);

const signatureBlock = (m: PdfModel) => {
  const { business, client } = m.signatures;
  const L = m.labels;
  return when(business || client, () => `
  <div class="block keep signatures">
    ${when(business, () => `
      <div class="sign">
        <div class="sign-area">${img(business!, 'sign-img', L.signature)}</div>
        <div class="sign-line">${esc(L.signature)}</div>
      </div>`)}
    ${when(client, () => `
      <div class="sign">
        <div class="sign-area">${when(client!.image, () => img(client!.image!, 'sign-img', client!.heading))}</div>
        <div class="sign-line">${esc(client!.heading)}${when(client!.name, () => ` · ${esc(client!.name)}`)}</div>
        <div class="sign-meta">${client!.date ? esc(m.labels.date) + ' ' + esc(client!.date) : esc(L.name) + ' / ' + esc(L.date)}</div>
      </div>`)}
  </div>`);
};

const legalBlock = (m: PdfModel) =>
  when(m.legalNotes.length || m.footerText, () => `
  <div class="block legal">
    ${m.legalNotes.map(n => `<div>${esc(n)}</div>`).join('')}
    ${when(m.footerText, () => `<div>${multiline(m.footerText!)}</div>`)}
  </div>`);

const photosAppendix = (m: PdfModel) =>
  when(m.photos.length, () => `
  <section class="photos">
    <div class="label">${esc(m.labels.photos)}</div>
    <div class="photo-grid">
      ${m.photos.map(p => `<figure class="keep">${img(p, 'photo')}${when(p.caption, () => `<figcaption>${esc(p.caption)}</figcaption>`)}</figure>`).join('')}
    </div>
  </section>`);

/** Everything below the header, shared by all templates. */
const body = (m: PdfModel) => `
  ${m.statement ? statementBlock(m) : itemsTable(m)}
  ${when(m.totals.length, () => `<div class="block keep totals-wrap">${totalsTable(m.totals)}</div>`)}
  ${contractBlock(m)}
  ${paymentBlock(m)}
  ${notesBlock(m)}
  ${signatureBlock(m)}
  ${legalBlock(m)}
  ${photosAppendix(m)}`;

/* ───────────────────────────── Headers ───────────────────────────── */

const highlightBox = (m: PdfModel, cls = 'highlight') =>
  when(m.highlight, () => `
  <div class="${cls}">
    <div class="label">${esc(m.highlight!.label)}</div>
    <div class="highlight-value">${esc(m.highlight!.value)}</div>
  </div>`);

const HEADERS: Record<PdfModel['template'], (m: PdfModel) => string> = {
  classic: m => `
    <header class="head">
      ${businessBlock(m)}
      <div class="title-block">
        <h1>${esc(m.title)} ${stampBadge(m)}</h1>
        ${when(m.number, () => `<div class="number">${esc(m.number)}</div>`)}
      </div>
    </header>
    ${subtitle(m)}
    <div class="info">
      ${partyBlock(m) || '<div></div>'}
      <div class="info-side">
        ${metaTable(m.meta.filter(r => r.label !== m.labels.number))}
        ${highlightBox(m)}
      </div>
    </div>`,

  minimal: m => `
    <header class="head">
      <div>
        ${when(m.business.name, () => `<div class="business-name">${esc(m.business.name)}</div>`)}
        <h1>${esc(m.title)}${when(m.number, () => ` <span class="number">${esc(m.number)}</span>`)} ${stampBadge(m)}</h1>
      </div>
      ${when(m.business.logo, () => img(m.business.logo!, 'logo', m.business.name))}
    </header>
    <div class="from">${lines(m.business.lines, 'lines muted inline')}</div>
    ${subtitle(m)}
    <div class="info">
      ${partyBlock(m) || '<div></div>'}
      ${metaTable(m.meta.filter(r => r.label !== m.labels.number))}
      ${highlightBox(m)}
    </div>`,

  modern: m => `
    <header class="head">
      <div class="head-brand">
        ${when(m.business.logo, () => `<div class="logo-chip">${img(m.business.logo!, 'logo', m.business.name)}</div>`)}
        ${when(m.business.name, () => `<div class="business-name">${esc(m.business.name)}</div>`)}
      </div>
      <div class="title-block">
        <h1>${esc(m.title)}</h1>
        ${when(m.number, () => `<div class="number">${esc(m.number)} ${stampBadge(m)}</div>`)}
        ${when(!m.number, () => stampBadge(m))}
      </div>
    </header>
    ${subtitle(m)}
    <div class="cards">
      <div class="card">
        ${partyBlock(m) || lines(m.business.lines, 'lines muted')}
      </div>
      <div class="card">${metaTable(m.meta.filter(r => r.label !== m.labels.number))}</div>
      ${highlightBox(m, 'card highlight')}
    </div>
    <div class="from">${lines(m.business.lines, 'lines muted inline')}</div>`,

  bold: m => `
    <header class="head">
      <div class="title-block${m.title.length > 14 ? ' long' : ''}">
        <h1>${esc(m.title)}</h1>
        ${when(m.number, () => `<div class="number">${esc(m.number)}</div>`)}
        ${stampBadge(m)}
      </div>
      ${businessBlock(m)}
    </header>
    <div class="bar"></div>
    ${subtitle(m)}
    <div class="info">
      ${partyBlock(m) || '<div></div>'}
      ${metaTable(m.meta.filter(r => r.label !== m.labels.number))}
    </div>
    ${highlightBox(m, 'highlight big')}`,
};

/* ─────────────────────────────── CSS ─────────────────────────────── */

const FONT_FACES = `
@font-face { font-family: 'Inter'; src: url('fonts/Inter-Regular.ttf'); font-weight: 400; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-Medium.ttf'); font-weight: 500; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-SemiBold.ttf'); font-weight: 600; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-Bold.ttf'); font-weight: 700; }
@font-face { font-family: 'Inter Display'; src: url('fonts/InterDisplay-Medium.ttf'); font-weight: 500; }
@font-face { font-family: 'Inter Display'; src: url('fonts/InterDisplay-SemiBold.ttf'); font-weight: 600; }
@font-face { font-family: 'Inter Display'; src: url('fonts/InterDisplay-Bold.ttf'); font-weight: 700; }`;

const baseCss = (m: PdfModel) => {
  const f = m.pageFooter;
  const box = `font-family: 'Inter', sans-serif; font-size: 7pt; color: #8B8D98;`;
  return `
${FONT_FACES}
@page {
  size: ${m.paper === 'LETTER' ? 'letter' : 'A4'};
  margin: 15mm 15mm 17mm 15mm;
  @bottom-left { content: ${cssString(f.left)}; ${box} }
  ${f.center ? `@bottom-center { content: ${cssString(f.center)}; ${box} }` : ''}
  @bottom-right { content: ${cssString(f.page + ' ')} counter(page) ${cssString(' ' + f.of + ' ')} counter(pages); ${box} }
}
:root {
  --accent: ${m.accent};
  --accent-ink: ${m.accentInk};
  --accent-soft: ${m.accentSoft};
  --ink: #1C2024;
  --muted: #60646C;
  --faint: #8B8D98;
  --line: #E0E1E6;
  --line-soft: #EBEBEF;
  --surface: #F9F9FB;
  --green: #218358;
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  font-size: 8.75pt;
  line-height: 1.45;
  color: var(--ink);
  font-feature-settings: 'tnum' 1, 'cv11' 1;
  -webkit-font-smoothing: antialiased;
}
h1 { margin: 0; font-family: 'Inter Display', 'Inter', sans-serif; font-weight: 600; letter-spacing: -0.01em; }
table { border-collapse: collapse; }
th { font-weight: 400; text-align: left; }
.muted { color: var(--muted); }
.lines > div { white-space: pre-wrap; }
.label { font-size: 7pt; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); margin-bottom: 3pt; }
.keep, .block, tr, figure { break-inside: avoid; page-break-inside: avoid; }
.block { margin-top: 14pt; }
.from { margin-top: 6pt; }
.from .inline { display: flex; flex-wrap: wrap; gap: 0 10pt; font-size: 7.5pt; }
.nowrap { white-space: nowrap; }

.logo { display: block; max-width: 48mm; max-height: 16mm; object-fit: contain; object-position: left center; margin-bottom: 8pt; }
.business-name { font-weight: 600; font-size: 10.5pt; }
.party-name { font-weight: 600; font-size: 9.5pt; margin-bottom: 1pt; }
.parties { display: flex; gap: 22pt; }
.party { min-width: 0; max-width: 62mm; }
.subtitle { margin-top: 10pt; }
.doc-title { font-weight: 600; font-size: 10pt; }

.meta th { color: var(--muted); padding: 1pt 12pt 1pt 0; white-space: nowrap; vertical-align: top; }
.meta td { padding: 1pt 0; font-weight: 500; text-align: right; white-space: nowrap; }

.stamp { display: inline-block; vertical-align: middle; font-family: 'Inter', sans-serif; font-size: 7pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 2pt 6pt; border-radius: 4pt; border: 0.75pt solid currentColor; line-height: 1.2; }
.stamp-paid { color: var(--green); }
.stamp-draft { color: var(--faint); }
.void-mark { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-family: 'Inter Display', sans-serif; font-weight: 700; font-size: 96pt; letter-spacing: 0.1em; text-transform: uppercase; color: #E5484D; opacity: 0.12; transform: rotate(-24deg); z-index: -1; }

.items { width: 100%; margin-top: 20pt; }
.items thead { display: table-header-group; }
.items th { font-size: 7pt; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding: 6pt 6pt 6pt 0; }
.items td { padding: 6pt 6pt 6pt 0; vertical-align: top; border-bottom: 0.5pt solid var(--line); }
.items th:last-child, .items td:last-child { padding-right: 0; }
.items .num { text-align: right; white-space: nowrap; }
.items .desc { width: 100%; }
.items .amount { font-weight: 500; }
.item-name { font-weight: 500; }
.item-desc { color: var(--muted); font-size: 8pt; margin-top: 1pt; }
.statement .opening td, .statement .closing td { font-weight: 600; }

.totals-wrap { display: flex; justify-content: flex-end; margin-top: 10pt; }
.totals { min-width: 44%; }
.totals th { color: var(--muted); padding: 3pt 16pt 3pt 0; }
.totals td { text-align: right; padding: 3pt 0; white-space: nowrap; font-weight: 500; }
.totals tr.strong th, .totals tr.strong td { color: var(--ink); font-weight: 700; font-size: 10.5pt; padding-top: 7pt; border-top: 0.75pt solid var(--ink); }
.totals tr.muted th, .totals tr.muted td { color: var(--faint); font-weight: 400; font-size: 8pt; }
.totals tr.accent th, .totals tr.accent td { color: var(--accent); font-weight: 700; font-size: 10.5pt; }
.contract { display: flex; justify-content: flex-end; }

.payment { display: flex; gap: 18pt; justify-content: space-between; padding: 12pt 14pt; border: 0.75pt solid var(--line); border-radius: 8pt; }
.payment-body { flex: 1; display: flex; flex-wrap: wrap; gap: 6pt 28pt; align-content: flex-start; }
.payment-body > .label { flex-basis: 100%; }
.method-title { font-weight: 600; margin-bottom: 2pt; }
.kv th { color: var(--muted); padding: 0.5pt 10pt 0.5pt 0; white-space: nowrap; }
.kv td { font-weight: 500; }
.qr { width: 27mm; text-align: center; flex: none; }
.qr-code svg { display: block; width: 27mm; height: 27mm; }
.qr-caption { font-size: 6.5pt; color: var(--muted); margin-top: 2pt; line-height: 1.3; }
.pix-code .code { font-family: monospace; font-size: 6.5pt; word-break: break-all; color: var(--muted); }

.notes { display: flex; gap: 24pt; }
.note { flex: 1; white-space: normal; }
.signatures { display: flex; gap: 28pt; margin-top: 26pt; }
.sign { width: 62mm; }
.sign-area { height: 18mm; display: flex; align-items: flex-end; }
.sign-img { max-height: 18mm; max-width: 60mm; object-fit: contain; }
.sign-line { border-top: 0.75pt solid var(--ink); padding-top: 3pt; font-size: 7.5pt; font-weight: 500; }
.sign-meta { font-size: 7pt; color: var(--faint); }
.legal { font-size: 7.5pt; color: var(--muted); }
.legal > div + div { margin-top: 3pt; }
.aging-table { width: 100%; margin-top: 2pt; }
.aging-table th { font-size: 7pt; color: var(--muted); padding: 3pt 4pt 1pt 0; }
.aging-table td { font-weight: 600; padding: 0 4pt 3pt 0; }

.photos { break-before: page; }
.photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-top: 6pt; }
figure { margin: 0; }
.photo { width: 100%; max-height: 105mm; object-fit: contain; border-radius: 4pt; background: var(--surface); }
figcaption { font-size: 7.5pt; color: var(--muted); margin-top: 3pt; }
`;
};

const TEMPLATE_CSS: Record<PdfModel['template'], string> = {
  classic: `
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; padding-bottom: 14pt; border-bottom: 0.75pt solid var(--line); }
.business { max-width: 55%; }
.title-block { text-align: right; }
.title-block h1 { font-size: 22pt; color: var(--accent); line-height: 1.1; }
.title-block .number { font-size: 10pt; font-weight: 500; color: var(--muted); margin-top: 3pt; }
.info { display: flex; justify-content: space-between; gap: 24pt; margin-top: 16pt; }
.info-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10pt; }
.highlight { background: var(--accent-soft); border-radius: 6pt; padding: 7pt 12pt; text-align: right; min-width: 46mm; }
.highlight .label { color: var(--accent); margin-bottom: 1pt; }
.highlight-value { font-family: 'Inter Display', sans-serif; font-size: 15pt; font-weight: 600; }
.items thead th { border-bottom: 1.25pt solid var(--accent); }
`,
  minimal: `
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.head .logo { max-height: 12mm; max-width: 36mm; margin: 0; }
.business-name { font-size: 9pt; }
.head h1 { font-family: 'Inter', sans-serif; font-size: 9pt; font-weight: 500; color: var(--muted); letter-spacing: 0; margin-top: 2pt; }
.head h1 .number { color: var(--ink); }
.info { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 28pt; margin-top: 32pt; align-items: start; }
.info .parties { gap: 18pt; }
.info .party { max-width: 52mm; }
.info .meta td { text-align: left; }
.highlight { text-align: right; }
.highlight-value { font-family: 'Inter Display', sans-serif; font-size: 20pt; font-weight: 500; letter-spacing: -0.02em; line-height: 1.1; }
.items { margin-top: 36pt; }
.items thead th { color: var(--faint); font-weight: 500; border-bottom: 0.5pt solid var(--line); }
.items td { border-bottom-color: var(--line-soft); }
.totals tr.strong th, .totals tr.strong td { border-top: 0.5pt solid var(--line); font-weight: 600; }
.totals tr.accent th, .totals tr.accent td { color: var(--ink); }
.payment { border: none; border-top: 0.5pt solid var(--line); border-radius: 0; padding: 14pt 0 0; }
`,
  modern: `
.head { display: flex; justify-content: space-between; align-items: center; gap: 20pt; background: var(--accent); color: var(--accent-ink); border-radius: 10pt; padding: 16pt 18pt; }
.head-brand { display: flex; align-items: center; gap: 10pt; min-width: 0; }
.logo-chip { background: #fff; border-radius: 6pt; padding: 4pt 6pt; }
.logo-chip .logo { max-height: 11mm; max-width: 34mm; margin: 0; }
.head .business-name { font-size: 12pt; }
.title-block { text-align: right; }
.title-block h1 { font-size: 20pt; line-height: 1.1; }
.title-block .number { font-size: 9.5pt; opacity: 0.85; margin-top: 2pt; }
.head .stamp { color: var(--accent-ink); }
.cards { display: grid; grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1fr); gap: 8pt; margin-top: 12pt; }
.card { background: var(--surface); border-radius: 8pt; padding: 10pt 12pt; min-width: 0; }
.card .parties { display: block; }
.card .party + .party { margin-top: 8pt; }
.card .meta { width: 100%; }
.card.highlight { background: var(--accent-soft); }
.card.highlight .label { color: var(--accent); }
.highlight-value { font-family: 'Inter Display', sans-serif; font-size: 17pt; font-weight: 600; margin-top: 4pt; line-height: 1.15; }
.from { margin-top: 8pt; }
.items { border-collapse: separate; border-spacing: 0; }
.items thead th { background: var(--accent-soft); color: var(--accent); padding: 6pt 8pt; }
.items thead th:first-child { border-radius: 6pt 0 0 6pt; }
.items thead th:last-child { border-radius: 0 6pt 6pt 0; padding-right: 8pt; }
.items td { padding: 7pt 8pt; border-bottom-color: var(--line-soft); }
.items td:last-child { padding-right: 8pt; }
.totals-wrap .totals { background: var(--surface); border-radius: 8pt; border-collapse: separate; padding: 6pt 12pt; }
.totals tr.strong th, .totals tr.strong td { border-top-color: var(--line); color: var(--accent); }
.payment { background: var(--surface); border: none; }
`,
  bold: `
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; }
.title-block h1 { font-size: 38pt; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
.title-block.long h1 { font-size: 26pt; line-height: 1.05; }
.title-block .number { font-family: 'Inter Display', sans-serif; font-size: 13pt; font-weight: 600; color: var(--accent); margin-top: 5pt; margin-bottom: 4pt; }
.head .business { text-align: right; max-width: 50%; }
.head .logo { margin-left: auto; object-position: right center; }
.bar { height: 5pt; background: var(--accent); border-radius: 3pt; margin: 14pt 0 16pt; }
.info { display: flex; justify-content: space-between; align-items: flex-start; gap: 24pt; }
.highlight.big { margin-top: 16pt; display: flex; align-items: baseline; justify-content: space-between; border-top: 0.75pt solid var(--ink); border-bottom: 0.75pt solid var(--ink); padding: 8pt 0; }
.highlight.big .label { color: var(--ink); font-size: 8pt; margin: 0; }
.highlight-value { font-family: 'Inter Display', sans-serif; font-size: 24pt; font-weight: 700; letter-spacing: -0.02em; }
.items thead th { background: var(--ink); color: #fff; padding: 6pt 8pt; }
.items td { padding: 7pt 8pt; }
.items th:last-child, .items td:last-child { padding-right: 8pt; }
.totals tr.strong th, .totals tr.strong td { background: var(--accent); color: var(--accent-ink); border: none; padding: 7pt 10pt; }
.totals tr.accent th, .totals tr.accent td { padding: 5pt 10pt; }
.payment { border: 1.25pt solid var(--ink); border-radius: 0; }
`,
};

/* ───────────────────────────── Document ──────────────────────────── */

export function renderHtml(m: PdfModel): string {
  return `<!doctype html>
<html lang="${esc(m.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc([m.title, m.number].filter(Boolean).join(' '))}</title>
<style>${baseCss(m)}${TEMPLATE_CSS[m.template]}</style>
</head>
<body class="t-${m.template}">
${voidWatermark(m)}
${HEADERS[m.template](m)}
${body(m)}
</body>
</html>`;
}
