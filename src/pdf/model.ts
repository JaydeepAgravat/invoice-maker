import type { TaxSummary } from '@/domain/calc';
import type { ISODate } from '@/domain/dates';
import { hasPrices, isPayable, isSupplierFacing } from '@/domain/docTypes';
import { formatMoney, QTY_SCALE, RATE_SCALE } from '@/domain/money';
import {
  fieldsFor,
  formatField,
  isComplete,
  qrFor,
  type PaymentMethod,
} from '@/domain/payments';
import {
  documentTitleKey,
  legalNotesFor,
  type CountryCode,
} from '@/domain/presets';
import type { Statement } from '@/domain/statement';
import type { DisplayStatus } from '@/domain/status';
import type { DocumentRecord, LineRecord } from '@/data/repositories/documents';
import type { BusinessProfile } from '@/data/repositories/profile';

import { fill, pdfLabels, toPdfLanguage, type PdfLabels } from './labels';
import { qrSvg } from './qr';

/* ────────────────────────────── Input ────────────────────────────── */

export type TemplateId = 'classic' | 'minimal' | 'modern' | 'bold';
export const TEMPLATE_IDS: readonly TemplateId[] = [
  'classic',
  'minimal',
  'modern',
  'bold',
];
export const PRO_TEMPLATES: readonly TemplateId[] = ['modern', 'bold'];

export const isTemplateId = (v: string | null | undefined): v is TemplateId =>
  !!v && (TEMPLATE_IDS as readonly string[]).includes(v);

export type PdfParty = {
  name: string;
  company?: string | null;
  isBusiness?: boolean;
  emails?: string[];
  phone?: string | null;
  taxId?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
};

export type PdfImage = {
  uri: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
};

export type PdfInput = {
  doc: DocumentRecord;
  status: DisplayStatus;
  business: BusinessProfile;
  client: PdfParty | null;
  paymentMethods: PaymentMethod[];
  /** Estimate an invoice/change order came from, invoice a credit note corrects. */
  source: { type: DocumentRecord['type']; number: string | null } | null;
  /** Change orders: the contract they modify. */
  contract?: {
    original: number;
    previousChanges: number;
    revised: number;
  } | null;
  statement?: Statement | null;
  /** Number shown on drafts (what it will be when issued). */
  numberPreview?: string | null;
  logo?: PdfImage | null;
  signature?: PdfImage | null;
  clientSignature?: (PdfImage & { name?: string | null; signedAt?: ISODate | null }) | null;
  photos?: PdfImage[];
  template?: string | null;
  accentColor?: string | null;
  paperSize?: 'A4' | 'LETTER' | null;
  isPro: boolean;
  appName: string;
};

/* ────────────────────────────── Model ────────────────────────────── */

export type Row = { label: string; value: string };
export type TotalRow = Row & { tone?: 'strong' | 'muted' | 'accent' };

export type ItemRow = {
  name: string;
  description: string | null;
  qty: string;
  unitPrice: string;
  discount: string;
  tax: string;
  amount: string;
};

export type PaymentBlock = {
  methods: { title: string; rows: Row[]; text: string | null }[];
  qr: { svg: string; caption: string; code: string | null } | null;
};

export type PdfModel = {
  lang: string;
  template: TemplateId;
  paper: 'A4' | 'LETTER';
  accent: string;
  accentInk: string;
  accentSoft: string;
  labels: PdfLabels;
  title: string;
  number: string | null;
  subtitle: string | null;
  docTitle: string | null;
  stamp: { kind: 'PAID' | 'VOID' | 'DRAFT'; label: string } | null;
  business: { name: string; lines: string[]; logo: PdfImage | null };
  party: { heading: string; name: string; lines: string[] } | null;
  shipTo: { heading: string; lines: string[] } | null;
  meta: Row[];
  highlight: Row | null;
  columns: {
    prices: boolean;
    discount: boolean;
    tax: boolean;
  };
  items: ItemRow[];
  totals: TotalRow[];
  contract: TotalRow[] | null;
  statement: {
    rows: {
      date: string;
      document: string;
      charges: string;
      credits: string;
      balance: string;
    }[];
    opening: string;
    closing: string;
    aging: Row[];
  } | null;
  notes: string | null;
  terms: string | null;
  footerText: string | null;
  legalNotes: string[];
  payment: PaymentBlock | null;
  signatures: {
    business: PdfImage | null;
    client: { heading: string; image: PdfImage | null; name: string | null; date: string | null } | null;
  };
  photos: PdfImage[];
  pageFooter: { left: string; center: string | null; page: string; of: string };
};

/* ──────────────────────────── Formatting ─────────────────────────── */

const DEFAULT_REGION: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
};

/** Words in the document language, number/date style of the business country. */
export const pdfLocale = (lang: string, business: BusinessProfile): string => {
  if (business.locale.split('-')[0] === lang) {
    return business.locale;
  }
  if (business.country !== 'OTHER') {
    const candidate = `${lang}-${business.country}`;
    try {
      if (Intl.NumberFormat.supportedLocalesOf([candidate]).length) {
        return candidate;
      }
    } catch {
      // Fall through to the language default.
    }
  }
  return DEFAULT_REGION[lang] ?? 'en-US';
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const formatPdfDate = (date: ISODate, locale: string) => {
  let f = dateFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
    dateFormatters.set(locale, f);
  }
  return f.format(new Date(`${date}T00:00:00Z`));
};

const formatRate = (ppm: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 3,
  }).format(ppm / RATE_SCALE);

const formatQty = (milli: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(
    milli / QTY_SCALE,
  );

const splitLines = (text: string | null | undefined) =>
  (text ?? '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

const DEFAULT_ACCENT = '#3E63DD';

/* eslint-disable no-bitwise -- colour channel maths */

/** Hex colour → readable ink on top of it and a soft tint for fills. */
export const accentPalette = (hex: string | null | undefined) => {
  const valid = /^#[0-9a-f]{6}$/i.test(hex ?? '') ? hex! : DEFAULT_ACCENT;
  const n = parseInt(valid.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.92);
  const hex2 = (c: number) => c.toString(16).padStart(2, '0');
  return {
    accent: valid.toUpperCase(),
    // Ink on accent fills is large, bold text (3:1 is enough). White keeps
    // at least 3:1 up to luminance 0.3; lighter accents get near-black ink.
    accentInk: luminance > 0.3 ? '#111113' : '#FFFFFF',
    accentSoft: `#${hex2(mix(r))}${hex2(mix(g))}${hex2(mix(b))}`,
  };
};

/* eslint-enable no-bitwise */

/* ───────────────────────────── Builder ───────────────────────────── */

const taxLabel = (t: Pick<TaxSummary, 'name' | 'rate'>, locale: string) =>
  `${t.name} ${formatRate(t.rate, locale)}`;

export function buildModel(input: PdfInput): PdfModel {
  const { doc, business, client } = input;
  const lang = toPdfLanguage(doc.language);
  const country: CountryCode = business.country;
  const L = pdfLabels(lang, country);
  const locale = pdfLocale(lang, business);
  // Typographic minus: "−£320.55" reads better than a hyphen on paper.
  const minus = (s: string) => s.replace(/-/g, '\u2212');
  const money = (minor: number) =>
    minus(formatMoney(minor, { locale, currency: doc.currency }));
  const signedMoney = (minor: number) =>
    minus(
      formatMoney(minor, { locale, currency: doc.currency, signed: true }),
    );
  const date = (d: ISODate) => formatPdfDate(d, locale);
  const prices = hasPrices(doc.type);
  const payable = isPayable(doc.type);
  const totals = doc.totals;

  const title =
    L.title[
      documentTitleKey(country, doc.type, {
        taxRegistered: business.isTaxRegistered,
      }) as keyof PdfLabels['title']
    ] ?? L.title[doc.type];
  const number = doc.number ?? input.numberPreview ?? null;

  /* Stamp */
  const stampKind: 'PAID' | 'VOID' | 'DRAFT' | null =
    input.status === 'VOID'
      ? 'VOID'
      : input.status === 'DRAFT'
      ? 'DRAFT'
      : input.status === 'PAID' || (doc.type === 'RECEIPT' && !!doc.number)
      ? 'PAID'
      : null;

  /* Business block */
  const businessLines = [
    ...(business.legalName && business.legalName !== business.name
      ? [business.legalName]
      : []),
    ...splitLines(business.address),
    ...[business.email, business.phone, business.website].filter(
      (v): v is string => !!v,
    ),
    ...(business.taxId
      ? [`${business.taxIdLabel ?? L.taxId} ${business.taxId}`]
      : []),
    ...(business.secondaryTaxId
      ? [`${business.secondaryTaxIdLabel ?? ''} ${business.secondaryTaxId}`.trim()]
      : []),
  ];

  /* Client block */
  const party = client
    ? {
        heading: isSupplierFacing(doc.type) ? L.supplier : L.billTo,
        name: client.company || client.name,
        lines: [
          ...(client.company && client.company !== client.name
            ? [client.name]
            : []),
          ...splitLines(client.billingAddress),
          ...(client.emails?.[0] ? [client.emails[0]] : []),
          ...(client.phone ? [client.phone] : []),
          ...(client.taxId ? [`${L.taxId} ${client.taxId}`] : []),
        ],
      }
    : null;
  const shipLines = splitLines(client?.shippingAddress);
  const shipTo =
    shipLines.length &&
    (['INVOICE', 'PROFORMA', 'DELIVERY_NOTE'] as string[]).includes(doc.type)
      ? { heading: doc.type === 'DELIVERY_NOTE' ? L.deliverTo : L.shipTo, lines: shipLines }
      : null;

  /* Meta */
  const meta: Row[] = [];
  if (number) {
    meta.push({ label: L.number, value: number });
  }
  if (doc.type === 'STATEMENT' && doc.statementFrom && doc.statementTo) {
    meta.push({
      label: L.period,
      value: `${date(doc.statementFrom)} – ${date(doc.statementTo)}`,
    });
  }
  meta.push({ label: L.issueDate, value: date(doc.issueDate) });
  if (doc.supplyDate) {
    meta.push({ label: L.supplyDate, value: date(doc.supplyDate) });
  }
  if (doc.dueDate && payable) {
    meta.push({ label: L.dueDate, value: date(doc.dueDate) });
  }
  if (doc.validUntil && doc.type !== 'INVOICE') {
    meta.push({ label: L.validUntil, value: date(doc.validUntil) });
  }
  if (doc.reference && doc.reference !== input.source?.number) {
    meta.push({ label: L.reference, value: doc.reference });
  }

  /* Subtitle: what this document relates to */
  const src = input.source?.number;
  const subtitle = !src
    ? null
    : doc.type === 'CREDIT_NOTE'
    ? fill(L.creditFor, { number: src })
    : doc.type === 'CHANGE_ORDER'
    ? fill(L.changeFor, { number: src })
    : doc.type === 'INVOICE' && input.source?.type === 'ESTIMATE'
    ? fill(L.invoiceFor, { number: src })
    : null;

  /* Line items */
  const items = doc.lines.filter(l => l.kind === 'ITEM');
  const charges = doc.lines.filter(l => l.kind === 'CHARGE');
  const taxSet = (l: LineRecord) =>
    l.taxes
      .filter(t => t.kind !== 'WITHHOLDING')
      .map(t => `${t.name}|${t.rate}`)
      .sort()
      .join(',');
  const distinctTaxSets = new Set(items.map(taxSet));
  const columns = {
    prices,
    discount: prices && items.some(l => !!l.discount),
    tax:
      prices &&
      distinctTaxSets.size > 1 &&
      items.some(l => l.taxes.some(t => t.kind !== 'WITHHOLDING')),
  };
  const unitText = (unit: string | null) =>
    unit ? L.units[unit] ?? unit : '';
  const itemRows: ItemRow[] = items.map(l => ({
    name: l.name,
    description: l.description,
    qty: [formatQty(l.quantity, locale), unitText(l.unit)]
      .filter(Boolean)
      .join(' '),
    unitPrice: prices ? money(l.unitPrice) : '',
    discount: !l.discount
      ? ''
      : l.discount.type === 'PERCENT'
      ? `−${formatRate(l.discount.rate, locale)}`
      : `−${money(l.discount.amount)}`,
    tax: columns.tax
      ? l.taxes
          .filter(t => t.kind !== 'WITHHOLDING')
          .map(t => formatRate(t.rate, locale))
          .join(' + ') || '—'
      : '',
    amount: prices ? money(l.net) : '',
  }));

  /* Totals */
  const totalRows: TotalRow[] = [];
  if (prices && doc.type !== 'STATEMENT') {
    const standard = totals.taxes.filter(t => t.kind !== 'WITHHOLDING');
    const withholding = totals.taxes.filter(t => t.kind === 'WITHHOLDING');
    const showSubtotal =
      totals.documentDiscount !== 0 ||
      charges.length > 0 ||
      withholding.length > 0 ||
      (!doc.pricesIncludeTax && standard.length > 0);
    if (showSubtotal) {
      totalRows.push({ label: L.subtotal, value: money(totals.subtotal) });
    }
    if (totals.documentDiscount) {
      totalRows.push({
        label:
          doc.discount?.type === 'PERCENT'
            ? `${L.discount} ${formatRate(doc.discount.rate, locale)}`
            : L.discount,
        value: money(-totals.documentDiscount),
      });
    }
    charges.forEach(c => totalRows.push({ label: c.name, value: money(c.net) }));
    if (!doc.pricesIncludeTax) {
      standard.forEach(t =>
        totalRows.push({ label: taxLabel(t, locale), value: money(t.amount) }),
      );
    }
    withholding.forEach(t =>
      totalRows.push({ label: taxLabel(t, locale), value: money(-t.amount) }),
    );
    totalRows.push({ label: L.total, value: money(totals.total), tone: 'strong' });
    if (doc.pricesIncludeTax) {
      standard.forEach(t =>
        totalRows.push({
          label: fill(L.includesTax, { tax: taxLabel(t, locale) }),
          value: money(t.amount),
          tone: 'muted',
        }),
      );
    }
    if (payable && totals.paid > 0) {
      totalRows.push({ label: L.paid, value: money(-totals.paid) });
      totalRows.push({
        label: L.balanceDue,
        value: money(totals.balanceDue),
        tone: 'accent',
      });
    }
  }

  const highlight: Row | null = !prices
    ? null
    : doc.type === 'STATEMENT'
    ? input.statement
      ? { label: L.statement.totalDue, value: money(input.statement.closingBalance) }
      : null
    : payable && input.status !== 'VOID'
    ? {
        label: totals.paid > 0 ? L.balanceDue : L.amountDue,
        value: money(totals.balanceDue),
      }
    : doc.type === 'RECEIPT'
    ? { label: L.amountReceived, value: money(totals.total) }
    : { label: L.total, value: money(totals.total) };

  /* Contract summary (change orders) */
  const contract = input.contract
    ? [
        { label: L.original, value: money(input.contract.original) },
        {
          label: L.previousChanges,
          value: signedMoney(input.contract.previousChanges),
        },
        {
          label: L.thisChange,
          value: signedMoney(totals.total),
        },
        {
          label: L.revisedTotal,
          value: money(input.contract.revised),
          tone: 'strong' as const,
        },
      ]
    : null;

  /* Statement */
  const statement =
    doc.type === 'STATEMENT' && input.statement
      ? {
          opening: money(input.statement.openingBalance),
          closing: money(input.statement.closingBalance),
          rows: input.statement.entries.map(e => ({
            date: date(e.date),
            document:
              e.kind === 'PAYMENT'
                ? e.reference
                  ? `${L.statement.payment} · ${e.reference}`
                  : L.statement.payment
                : fill(
                    e.kind === 'INVOICE'
                      ? L.statement.invoice
                      : L.statement.creditNote,
                    { number: e.reference },
                  ),
            charges: e.debit ? money(e.debit) : '',
            credits: e.credit ? money(e.credit) : '',
            balance: money(e.balance),
          })),
          aging: (
            [
              ['current', input.statement.aging.current],
              ['days1to30', input.statement.aging.days1to30],
              ['days31to60', input.statement.aging.days31to60],
              ['days61to90', input.statement.aging.days61to90],
              ['days90plus', input.statement.aging.days90plus],
            ] as const
          ).map(([k, v]) => ({ label: L.statement[k], value: money(v) })),
        }
      : null;

  /* Payment details */
  const wantsPayment =
    payable && input.status !== 'VOID' && input.status !== 'PAID';
  const chosen = input.paymentMethods
    .filter(m =>
      doc.paymentMethodIds.length
        ? doc.paymentMethodIds.includes(m.id)
        : m.isDefault,
    )
    .filter(isComplete)
    .sort((a, b) => a.position - b.position);
  let payment: PaymentBlock | null = null;
  if (wantsPayment && chosen.length) {
    const reference = number;
    let qr: PaymentBlock['qr'] = null;
    for (const m of chosen) {
      const code = qrFor(m, {
        currency: doc.currency,
        amount: totals.balanceDue,
        reference,
        businessName: business.legalName || business.name || '',
      });
      if (code) {
        qr = {
          svg: qrSvg(code.payload),
          caption:
            code.kind === 'EPC'
              ? L.scanSepa
              : code.kind === 'PIX'
              ? L.scanPix
              : L.scanToPay,
          code: code.kind === 'PIX' ? code.payload : null,
        };
        break;
      }
    }
    payment = {
      qr,
      methods: chosen.map(m => ({
        title: m.label || L.kind[m.kind],
        text: m.kind === 'OTHER' ? m.fields.instructions?.trim() || null : null,
        rows: fieldsFor(m.kind, country)
          .filter(f => f !== 'instructions' && !!m.fields[f]?.trim())
          .map(f => ({
            label: L.field[f],
            value: formatField(f, m.fields[f]!),
          })),
      })),
    };
  }

  /* Notes */
  const legalNotes = legalNotesFor(country, {
    taxRegistered: business.isTaxRegistered,
    clientIsBusiness: !!client?.isBusiness,
  }).map(n => n.text);
  if (doc.type === 'PROFORMA') {
    legalNotes.unshift(L.proformaNote);
  }
  if (doc.type === 'RECEIPT' && doc.number) {
    legalNotes.unshift(L.receiptNote);
  }

  /* Signatures */
  const signs =
    doc.type === 'ESTIMATE' ||
    doc.type === 'CHANGE_ORDER' ||
    doc.type === 'DELIVERY_NOTE' ||
    doc.type === 'PURCHASE_ORDER';
  const clientSign = input.clientSignature
    ? {
        heading:
          doc.type === 'DELIVERY_NOTE' ? L.receivedBy : L.acceptedBy,
        image: input.clientSignature,
        name: input.clientSignature.name ?? null,
        date: input.clientSignature.signedAt
          ? date(input.clientSignature.signedAt)
          : null,
      }
    : signs && doc.type !== 'PURCHASE_ORDER'
    ? {
        heading: doc.type === 'DELIVERY_NOTE' ? L.receivedBy : L.acceptedBy,
        image: null,
        name: null,
        date: null,
      }
    : null;

  const template: TemplateId = isTemplateId(input.template)
    ? input.template
    : 'classic';

  return {
    lang,
    template,
    paper: input.paperSize ?? business.paperSize,
    ...accentPalette(input.accentColor),
    labels: L,
    title,
    number,
    subtitle,
    docTitle: doc.title,
    stamp: stampKind ? { kind: stampKind, label: L.stamp[stampKind] } : null,
    business: {
      name: business.name || business.legalName || '',
      lines: businessLines,
      logo: input.logo ?? null,
    },
    party,
    shipTo,
    meta,
    highlight,
    columns,
    items: itemRows,
    totals: totalRows,
    contract,
    statement,
    notes: doc.notes?.trim() || null,
    terms: doc.terms?.trim() || null,
    footerText: doc.footer?.trim() || null,
    legalNotes,
    payment,
    signatures: {
      business:
        input.signature && (signs || doc.type === 'INVOICE') ? input.signature : null,
      client: clientSign,
    },
    photos: input.photos ?? [],
    pageFooter: {
      left: [number, business.name].filter(Boolean).join(' · '),
      center: input.isPro ? null : fill(L.madeWith, { app: input.appName }),
      page: L.page,
      of: L.of,
    },
  };
}
