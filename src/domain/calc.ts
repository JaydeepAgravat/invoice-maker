/**
 * Document calculation engine. Pure, deterministic, no React imports.
 *
 * Pipeline per line:
 *   gross      = quantity × unit price                         (rounded to minor)
 *   net        = gross − line discount                         (rounded to minor)
 *   taxable    = net − share of the document discount          (exact allocation)
 *   base       = taxable, or taxable ÷ (1 + taxes) when prices include tax
 *   taxes      = STANDARD on base; COMPOUND on base + standard taxes;
 *                WITHHOLDING on base, subtracted from the amount payable
 *
 * Rounding happens only at these points. With PER_TOTAL rounding each tax is
 * rounded once over the whole document and then distributed back to lines by
 * largest remainder, so line columns always add up to the printed totals.
 */

import {
  allocate,
  allocateExact,
  Fraction,
  toSafeNumber,
  type RoundingMode,
} from './fraction';
import { QTY_SCALE, RATE_SCALE, type Minor } from './money';

export type TaxKind = 'STANDARD' | 'COMPOUND' | 'WITHHOLDING';

export type TaxInput = {
  id: string;
  name: string;
  /** Parts per million: 200_000 = 20%. */
  rate: number;
  kind: TaxKind;
};

export type Discount =
  | { type: 'PERCENT'; /** Parts per million. */ rate: number }
  | { type: 'AMOUNT'; amount: Minor };

export type LineInput = {
  id: string;
  /** Thousandths: 1500 = 1.5. May be negative (credit notes, refunds). */
  quantity: number;
  unitPrice: Minor;
  discount?: Discount | null;
  taxes?: readonly TaxInput[];
};

export type CalcInput = {
  lines: readonly LineInput[];
  /** Shipping and other charges: taxed like lines, never discounted. */
  charges?: readonly LineInput[];
  discount?: Discount | null;
  pricesIncludeTax?: boolean;
  rounding?: 'PER_LINE' | 'PER_TOTAL';
  roundingMode?: RoundingMode;
  paid?: Minor;
};

export type LineTax = { id: string; amount: Minor };

export type LineResult = {
  id: string;
  isCharge: boolean;
  gross: Minor;
  lineDiscount: Minor;
  net: Minor;
  documentDiscount: Minor;
  taxable: Minor;
  base: Minor;
  taxes: LineTax[];
  /** Base plus added (standard + compound) taxes. Withholding not deducted. */
  total: Minor;
};

export type TaxSummary = {
  id: string;
  name: string;
  rate: number;
  kind: TaxKind;
  base: Minor;
  amount: Minor;
};

export type CalcResult = {
  lines: LineResult[];
  /** Sum of item line nets (after line discounts, before document discount). */
  subtotal: Minor;
  lineDiscountTotal: Minor;
  documentDiscount: Minor;
  chargesTotal: Minor;
  /** Sum of tax-exclusive bases. */
  baseTotal: Minor;
  taxes: TaxSummary[];
  /** Standard + compound taxes. */
  taxTotal: Minor;
  withholdingTotal: Minor;
  /** Base + taxes, before withholding ("invoice total" in ES/PT/MX). */
  totalBeforeWithholding: Minor;
  /** Amount the client pays. */
  total: Minor;
  paid: Minor;
  balanceDue: Minor;
};

const ONE = Fraction.of(1);
const rateOf = (ppm: number) => Fraction.of(ppm, RATE_SCALE);

const assertInt = (value: number, label: string) => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer, got ${value}`);
  }
};

const taxKey = (t: TaxInput) => `${t.id}|${t.rate}|${t.kind}`;

/** Discount magnitude for an amount, same sign as the amount, never larger. */
const discountFor = (
  amount: number,
  discount: Discount,
  mode: RoundingMode,
): number => {
  if (discount.type === 'PERCENT') {
    assertInt(discount.rate, 'Discount rate');
    const rate = Math.min(Math.max(discount.rate, 0), RATE_SCALE);
    return toSafeNumber(Fraction.of(amount).mul(rateOf(rate)).round(mode));
  }
  assertInt(discount.amount, 'Discount amount');
  const magnitude = Math.min(Math.abs(discount.amount), Math.abs(amount));
  return amount < 0 ? -magnitude : magnitude;
};

type Working = {
  input: LineInput;
  isCharge: boolean;
  gross: number;
  lineDiscount: number;
  net: number;
  documentDiscount: number;
  taxable: number;
  added: TaxInput[];
  withholding: TaxInput[];
  /** Exact added-tax amounts keyed by tax key, before base is fixed. */
  addedExact: Map<string, Fraction>;
  base: number;
  taxes: Map<string, number>;
};

export function calculate(input: CalcInput): CalcResult {
  const mode = input.roundingMode ?? 'HALF_UP';
  const perLine = (input.rounding ?? 'PER_LINE') === 'PER_LINE';
  const inclusive = input.pricesIncludeTax ?? false;

  const build = (line: LineInput, isCharge: boolean): Working => {
    assertInt(line.quantity, 'Quantity');
    assertInt(line.unitPrice, 'Unit price');
    const gross = toSafeNumber(
      Fraction.of(line.quantity)
        .mul(Fraction.of(line.unitPrice, QTY_SCALE))
        .round(mode),
    );
    const lineDiscount =
      line.discount && !isCharge ? discountFor(gross, line.discount, mode) : 0;
    const taxes = line.taxes ?? [];
    return {
      input: line,
      isCharge,
      gross,
      lineDiscount,
      net: gross - lineDiscount,
      documentDiscount: 0,
      taxable: gross - lineDiscount,
      added: taxes.filter(t => t.kind !== 'WITHHOLDING'),
      withholding: taxes.filter(t => t.kind === 'WITHHOLDING'),
      addedExact: new Map(),
      base: 0,
      taxes: new Map(),
    };
  };

  const items = input.lines.map(l => build(l, false));
  const charges = (input.charges ?? []).map(l => build(l, true));
  const all = [...items, ...charges];

  // Document discount, allocated to item lines in proportion to their nets.
  const subtotal = items.reduce((a, w) => a + w.net, 0);
  const documentDiscount = input.discount
    ? discountFor(subtotal, input.discount, mode)
    : 0;
  if (documentDiscount !== 0) {
    const shares = allocate(
      documentDiscount,
      items.map(w => w.net),
    );
    items.forEach((w, i) => {
      w.documentDiscount = shares[i]!;
      w.taxable = w.net - w.documentDiscount;
    });
  }

  // Exact added taxes (standard + compound) for a given exact base.
  const addedTaxesOn = (w: Working, base: Fraction) => {
    const standard = w.added.filter(t => t.kind === 'STANDARD');
    const compound = w.added.filter(t => t.kind === 'COMPOUND');
    const out = new Map<string, Fraction>();
    let standardSum = Fraction.ZERO;
    for (const t of standard) {
      const amount = base.mul(rateOf(t.rate));
      out.set(taxKey(t), (out.get(taxKey(t)) ?? Fraction.ZERO).add(amount));
      standardSum = standardSum.add(amount);
    }
    for (const t of compound) {
      const amount = base.add(standardSum).mul(rateOf(t.rate));
      out.set(taxKey(t), (out.get(taxKey(t)) ?? Fraction.ZERO).add(amount));
    }
    return out;
  };

  // Multiplier M such that base × M = price including added taxes.
  const inclusiveMultiplier = (w: Working) => {
    const s = w.added
      .filter(t => t.kind === 'STANDARD')
      .reduce((acc, t) => acc.add(rateOf(t.rate)), Fraction.ZERO);
    const c = w.added
      .filter(t => t.kind === 'COMPOUND')
      .reduce((acc, t) => acc.add(rateOf(t.rate)), Fraction.ZERO);
    return ONE.add(s).add(c.mul(ONE.add(s)));
  };

  for (const w of all) {
    const baseExact = inclusive
      ? Fraction.of(w.taxable).div(inclusiveMultiplier(w))
      : Fraction.of(w.taxable);
    w.addedExact = addedTaxesOn(w, baseExact);
  }

  // Round added taxes, per line or per total.
  const roundGroup = (
    lines: Working[],
    exactOf: (w: Working) => Map<string, Fraction>,
    assign: (w: Working, key: string, amount: number) => void,
  ) => {
    if (perLine) {
      for (const w of lines) {
        for (const [key, exact] of exactOf(w)) {
          assign(w, key, toSafeNumber(exact.round(mode)));
        }
      }
      return;
    }
    const keys = new Set<string>();
    lines.forEach(w => exactOf(w).forEach((_, k) => keys.add(k)));
    for (const key of keys) {
      const holders = lines.filter(w => exactOf(w).has(key));
      const exacts = holders.map(w => exactOf(w).get(key)!);
      const total = toSafeNumber(
        exacts.reduce((a, b) => a.add(b), Fraction.ZERO).round(mode),
      );
      const parts = allocateExact(total, exacts);
      holders.forEach((w, i) => assign(w, key, parts[i]!));
    }
  };

  roundGroup(
    all,
    w => w.addedExact,
    (w, key, amount) => w.taxes.set(key, amount),
  );

  for (const w of all) {
    const addedSum = [...w.taxes.values()].reduce((a, b) => a + b, 0);
    w.base = inclusive ? w.taxable - addedSum : w.taxable;
  }

  // Withholding is computed on the settled integer base.
  roundGroup(
    all,
    w => {
      const out = new Map<string, Fraction>();
      for (const t of w.withholding) {
        const amount = Fraction.of(w.base).mul(rateOf(t.rate));
        out.set(taxKey(t), (out.get(taxKey(t)) ?? Fraction.ZERO).add(amount));
      }
      return out;
    },
    (w, key, amount) => w.taxes.set(key, amount),
  );

  // Summaries in first-seen order.
  const meta = new Map<string, TaxInput>();
  all.forEach(w =>
    (w.input.taxes ?? []).forEach(
      t => meta.has(taxKey(t)) || meta.set(taxKey(t), t),
    ),
  );

  const taxes: TaxSummary[] = [...meta.entries()].map(([key, t]) => {
    const holders = all.filter(w => w.taxes.has(key));
    return {
      id: t.id,
      name: t.name,
      rate: t.rate,
      kind: t.kind,
      base: holders.reduce((a, w) => a + w.base, 0),
      amount: holders.reduce((a, w) => a + (w.taxes.get(key) ?? 0), 0),
    };
  });

  const lines: LineResult[] = all.map(w => {
    const lineTaxes: LineTax[] = [...w.taxes.entries()].map(
      ([key, amount]) => ({
        id: meta.get(key)!.id,
        amount,
      }),
    );
    const added = [...w.taxes.entries()]
      .filter(([key]) => meta.get(key)!.kind !== 'WITHHOLDING')
      .reduce((a, [, v]) => a + v, 0);
    return {
      id: w.input.id,
      isCharge: w.isCharge,
      gross: w.gross,
      lineDiscount: w.lineDiscount,
      net: w.net,
      documentDiscount: w.documentDiscount,
      taxable: w.taxable,
      base: w.base,
      taxes: lineTaxes,
      total: w.base + added,
    };
  });

  const taxTotal = taxes
    .filter(t => t.kind !== 'WITHHOLDING')
    .reduce((a, t) => a + t.amount, 0);
  const withholdingTotal = taxes
    .filter(t => t.kind === 'WITHHOLDING')
    .reduce((a, t) => a + t.amount, 0);
  const baseTotal = all.reduce((a, w) => a + w.base, 0);
  const totalBeforeWithholding = baseTotal + taxTotal;
  const total = totalBeforeWithholding - withholdingTotal;
  const paid = input.paid ?? 0;
  assertInt(paid, 'Paid');

  return {
    lines,
    subtotal,
    lineDiscountTotal: items.reduce((a, w) => a + w.lineDiscount, 0),
    documentDiscount,
    chargesTotal: charges.reduce((a, w) => a + w.taxable, 0),
    baseTotal,
    taxes,
    taxTotal,
    withholdingTotal,
    totalBeforeWithholding,
    total,
    paid,
    balanceDue: total - paid,
  };
}
