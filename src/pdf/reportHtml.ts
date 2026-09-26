import type { Report } from '@/domain/reports';

import { esc } from './render';

/** Words for the report, in the app language (the report is for the owner). */
export type ReportLabels = {
  title: string;
  period: string;
  generated: string;
  profit: string;
  income: string;
  expenses: string;
  mileage: string;
  invoiced: string;
  credited: string;
  outstanding: string;
  byMonth: string;
  month: string;
  byClient: string;
  client: string;
  noClient: string;
  taxCollected: string;
  tax: string;
  byCategory: string;
  category: string;
  aging: string;
  amount: string;
  agingBuckets: [string, string, string, string, string];
  categoryName: (key: string) => string;
  monthName: (key: string) => string;
  taxName: (name: string, rate: number) => string;
};

/**
 * A plain, printable summary of the Reports screen. Same fonts as the
 * documents; one accent for the figures that matter.
 */
export function renderReportHtml(opts: {
  report: Report;
  labels: ReportLabels;
  business: string;
  money: (minor: number) => string;
  paper: 'A4' | 'LETTER';
}): string {
  const { report: r, labels: L, money } = opts;
  const max = Math.max(1, ...r.months.flatMap(m => [m.income, m.expenses]));
  const row = (cells: string[], cls = '') =>
    `<tr class="${cls}">${cells.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>`;
  const table = (head: string[], rows: string[]) =>
    rows.length
      ? `<table><thead><tr>${head.map((h, i) => `<th class="${i ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
      : '';

  const bars = r.months
    .map(
      (m, i) => `
      <g transform="translate(${i * (560 / r.months.length)}, 0)">
        <rect x="${560 / r.months.length / 2 - 9}" y="${120 - (m.income / max) * 110}" width="8" height="${(m.income / max) * 110}" rx="2" fill="#3E63DD"/>
        <rect x="${560 / r.months.length / 2 + 1}" y="${120 - (m.expenses / max) * 110}" width="8" height="${(m.expenses / max) * 110}" rx="2" fill="#B9BBC6"/>
      </g>`,
    )
    .join('');

  const aging = [
    r.aging.current,
    r.aging.days1to30,
    r.aging.days31to60,
    r.aging.days61to90,
    r.aging.days90plus,
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Inter'; src: url('fonts/Inter-Regular.ttf'); font-weight: 400; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-SemiBold.ttf'); font-weight: 600; }
@font-face { font-family: 'Inter Display'; src: url('fonts/InterDisplay-SemiBold.ttf'); font-weight: 600; }
@page { size: ${opts.paper === 'LETTER' ? 'letter' : 'A4'}; margin: 16mm; @bottom-right { content: counter(page) " / " counter(pages); font: 7pt Inter; color: #8B8D98; } }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 9pt/1.45 Inter, sans-serif; color: #1C2024; font-feature-settings: 'tnum' 1; }
h1 { font: 600 20pt 'Inter Display', sans-serif; margin: 0; letter-spacing: -0.01em; }
h2 { font-size: 7pt; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8B8D98; margin: 20pt 0 6pt; }
.muted { color: #60646C; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin-top: 16pt; }
.kpi { background: #F9F9FB; border-radius: 6pt; padding: 8pt 10pt; }
.kpi .v { font: 600 13pt 'Inter Display', sans-serif; margin-top: 2pt; }
.kpi.main { background: #EDF2FE; } .kpi.main .v { color: #3E63DD; }
table { width: 100%; border-collapse: collapse; }
th { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #60646C; text-align: left; padding: 4pt 0; border-bottom: 0.75pt solid #E0E1E6; }
td { padding: 4pt 0; border-bottom: 0.5pt solid #EBEBEF; }
.num { text-align: right; white-space: nowrap; }
tr { break-inside: avoid; }
section { break-inside: avoid; }
</style></head><body>
<h1>${esc(L.title)}</h1>
<div class="muted">${esc(opts.business)} · ${esc(L.period)}</div>
<div class="kpis">
  <div class="kpi main"><div class="muted">${esc(L.profit)}</div><div class="v">${esc(money(r.profit))}</div></div>
  <div class="kpi"><div class="muted">${esc(L.income)}</div><div class="v">${esc(money(r.income))}</div></div>
  <div class="kpi"><div class="muted">${esc(L.expenses)}</div><div class="v">${esc(money(r.expenses))}</div></div>
  <div class="kpi"><div class="muted">${esc(L.mileage)}</div><div class="v">${esc(money(r.mileage))}</div></div>
</div>
<section>
<h2>${esc(L.byMonth)}</h2>
<svg viewBox="0 0 560 124" width="100%" height="124">${bars}<line x1="0" x2="560" y1="120.5" y2="120.5" stroke="#E0E1E6"/></svg>
${table(
  [L.month, L.income, L.expenses],
  r.months.map(m => row([esc(L.monthName(m.month)), esc(money(m.income)), esc(money(m.expenses))])),
)}
</section>
<section>
<h2>${esc(L.byClient)}</h2>
${table(
  [L.client, L.income],
  r.byClient.map(c => row([esc(c.name ?? L.noClient), esc(money(c.income))])),
)}
</section>
<section>
<h2>${esc(L.taxCollected)}</h2>
${table(
  [L.tax, L.amount],
  r.taxCollected.map(t => row([esc(L.taxName(t.name, t.rate)), esc(money(t.amount))])),
)}
</section>
<section>
<h2>${esc(L.byCategory)}</h2>
${table(
  [L.category, L.amount],
  r.expensesByCategory.map(c => row([esc(L.categoryName(c.category)), esc(money(c.amount))])),
)}
</section>
<section>
<h2>${esc(L.aging)}</h2>
${table(
  [L.aging, L.amount],
  aging.map((v, i) => row([esc(L.agingBuckets[i]!), esc(money(v))])),
)}
</section>
<section>
<h2>${esc(L.invoiced)}</h2>
${table(
  [L.invoiced, L.amount],
  [
    row([esc(L.invoiced), esc(money(r.invoiced))]),
    row([esc(L.credited), esc(money(r.credited))]),
    row([esc(L.outstanding), esc(money(r.outstanding))]),
  ],
)}
</section>
<div class="muted" style="margin-top: 18pt; font-size: 7pt">${esc(L.generated)}</div>
</body></html>`;
}
