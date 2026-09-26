import { createClient } from '@/data/repositories/clients';
import {
  applyAction,
  createChangeOrder,
  createCreditNote,
  createDraft,
  issueDocument,
  recordPayment,
  saveDocument,
  toDraft,
  type LineDraft,
  type LineTaxSnapshot,
} from '@/data/repositories/documents';
import { createPaymentMethod } from '@/data/repositories/paymentMethods';
import { updateProfile } from '@/data/repositories/profile';
import type { DocType } from '@/domain/docTypes';
import type { CountryCode } from '@/domain/presets';

import { setupDb } from '../../data/__tests__/helpers';
import { loadPdfInput } from '../load';
import type { PdfInput } from '../model';

const LINES: Array<Omit<LineDraft, 'taxes'>> = [
  {
    name: 'Brand identity system',
    description: 'Logo suite, colour palette, typography and usage guidelines',
    quantity: 1000,
    unitPrice: 240000,
    unit: 'project',
  },
  {
    name: 'Website design',
    description: 'Eight responsive page templates in Figma',
    quantity: 32000,
    unitPrice: 9500,
    unit: 'hr',
    discount: { type: 'PERCENT', rate: 100000 },
  },
  {
    name: 'Photography day rate',
    quantity: 1500,
    unitPrice: 85000,
    unit: 'day',
  },
];

export type Scenario = {
  type?: DocType;
  country?: CountryCode;
  region?: string;
  language?: string;
  currency?: string;
  lines?: number;
  paid?: 'none' | 'partial' | 'full';
  issued?: boolean;
  void?: boolean;
  pricesIncludeTax?: boolean;
  withPayment?: boolean;
};

const CURRENCY: Record<CountryCode, string> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  ES: 'EUR',
  MX: 'MXN',
  BR: 'BRL',
  FR: 'EUR',
  DE: 'EUR',
  PT: 'EUR',
  OTHER: 'USD',
};

/** A realistic document built through the real repositories. */
export async function scenario(s: Scenario = {}): Promise<PdfInput> {
  const country = s.country ?? 'GB';
  const { db, clock } = await setupDb(country, s.region);
  const currency = s.currency ?? CURRENCY[country];
  await updateProfile(db, clock, {
    name: 'Northwind Studio',
    legalName: 'Northwind Studio Ltd',
    address: '14 Chalk Farm Road\nLondon NW1 8AB\nUnited Kingdom',
    email: 'hello@northwind.studio',
    phone: '+44 20 7946 0321',
    website: 'northwind.studio',
    taxId: 'GB 123 4567 89',
    currency,
  });
  if (s.withPayment !== false) {
    if (country === 'BR') {
      await createPaymentMethod(db, clock, {
        kind: 'PIX',
        fields: {
          pixKey: 'financeiro@northwind.com.br',
          accountName: 'Northwind Estudio',
          merchantCity: 'Sao Paulo',
        },
      });
    }
    await createPaymentMethod(db, clock, {
      kind: 'BANK',
      fields: {
        accountName: 'Northwind Studio Ltd',
        bankName: 'Monzo Business',
        sortCode: '04-00-04',
        accountNumber: '12345678',
        routingNumber: '026009593',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'COBADEFFXXX',
        bsb: '062-000',
        clabe: '002010077777777771',
        agency: '0001',
        institution: '003',
        transit: '12345',
      },
    });
    await createPaymentMethod(db, clock, {
      kind: 'LINK',
      label: 'Card or Apple Pay',
      fields: { url: 'https://pay.northwind.studio/i/7Q2K' },
      showQr: country !== 'BR' && currency !== 'EUR',
    });
  }
  const client = await createClient(db, clock, {
    name: 'Amelia Hart',
    company: 'Harper & Lane Architects',
    isBusiness: true,
    emails: ['accounts@harperlane.co'],
    phone: '+44 7700 900123',
    taxId: 'GB 987 6543 21',
    billingAddress: '2 Granary Square\nLondon N1C 4BH',
    shippingAddress: 'Site office, 88 York Way\nLondon N1 9AG',
  });
  const type = s.type ?? 'INVOICE';
  const baseType: DocType =
    type === 'CHANGE_ORDER' ? 'ESTIMATE' : type === 'CREDIT_NOTE' ? 'INVOICE' : type;
  const draft = await createDraft(db, clock, baseType, { clientId: client.id });
  const standard = (
    await db.execute("SELECT id, name, rate_ppm, kind FROM tax_rates WHERE kind <> 'WITHHOLDING' ORDER BY is_default DESC, position")
  ).rows.map(
    (r): LineTaxSnapshot => ({
      taxRateId: String(r.id),
      name: String(r.name),
      rate: Number(r.rate_ppm),
      kind: r.kind as LineTaxSnapshot['kind'],
    }),
  );
  const count = s.lines ?? 3;
  const lines: LineDraft[] = Array.from({ length: count }, (_, i) => {
    const base = LINES[i % LINES.length]!;
    return {
      ...base,
      name: count > LINES.length ? `${base.name} ${i + 1}` : base.name,
      taxes: standard.length ? [standard[i === 2 && standard[1] ? 1 : 0]!] : [],
    };
  });
  lines.push({
    kind: 'CHARGE',
    name: 'Courier',
    quantity: 1000,
    unitPrice: 1800,
    taxes: standard.length ? [standard[0]!] : [],
  });
  let doc = await saveDocument(db, clock, {
    ...toDraft(draft),
    title: 'Spring rebrand',
    reference: 'PO-20417',
    pricesIncludeTax: s.pricesIncludeTax ?? draft.pricesIncludeTax,
    discount: { type: 'PERCENT', rate: 50000 },
    supplyDate: draft.issueDate,
    language: s.language ?? 'en',
    notes: 'Thank you for choosing Northwind.\nWe loved working on this.',
    terms: 'Payment within 30 days. Late payments may incur interest at 8% above base rate.',
    lines,
  });
  if (type === 'CHANGE_ORDER') {
    await issueDocument(db, clock, doc.id);
    await applyAction(db, clock, doc.id, 'ACCEPT');
    const co = await createChangeOrder(db, clock, doc.id);
    doc = await saveDocument(db, clock, {
      ...toDraft(co),
      lines: [{ ...lines[0]!, name: 'Additional signage', quantity: 1000, unitPrice: 45000 }],
    });
  }
  if (type === 'CREDIT_NOTE') {
    await issueDocument(db, clock, doc.id);
    const cn = await createCreditNote(db, clock, doc.id);
    doc = await saveDocument(db, clock, {
      ...toDraft(cn),
      lines: [{ ...lines[0]!, quantity: 1000 }],
    });
  }
  if (type === 'STATEMENT') {
    for (const amount of [150000, 98000]) {
      const inv = await createDraft(db, clock, 'INVOICE', { clientId: client.id });
      await saveDocument(db, clock, {
        ...toDraft(inv),
        issueDate: '2026-08-01',
        dueDate: '2026-08-31',
        lines: [{ ...lines[0]!, unitPrice: amount }],
      });
      const issued = await issueDocument(db, clock, inv.id);
      await recordPayment(db, clock, issued.id, {
        amount: amount / 2,
        paidOn: '2026-09-02',
        method: 'BANK_TRANSFER',
      });
    }
  }
  if (s.issued !== false) {
    doc = await issueDocument(db, clock, doc.id);
  }
  if (s.paid && s.paid !== 'none' && type === 'INVOICE') {
    await recordPayment(db, clock, doc.id, {
      amount:
        s.paid === 'full' ? doc.totals.balanceDue : Math.round(doc.totals.total / 3),
      paidOn: '2026-09-26',
      method: 'BANK_TRANSFER',
    });
  }
  if (s.void) {
    await applyAction(db, clock, doc.id, 'VOID');
  }
  const input = await loadPdfInput(db, doc.id, {
    today: clock.today(),
    isPro: false,
    appName: 'Invoice Maker',
  });
  db.close();
  return input!;
}
