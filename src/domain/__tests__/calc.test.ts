import { calculate, type TaxInput } from '../calc';

const tax = (
  id: string,
  percent: number,
  kind: TaxInput['kind'] = 'STANDARD',
): TaxInput => ({
  id,
  name: id,
  rate: Math.round(percent * 10_000),
  kind,
});

const VAT20 = tax('vat20', 20);
const VAT0 = tax('vat0', 0);
const GST10 = tax('gst10', 10);

describe('calculate: basics', () => {
  it('returns zeros for an empty document', () => {
    const r = calculate({ lines: [] });
    expect(r.total).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.taxes).toEqual([]);
    expect(r.balanceDue).toBe(0);
  });

  it('multiplies decimal quantities and rounds half up', () => {
    // 0.5 × 33.33 = 16.665 → 16.67
    const r = calculate({
      lines: [{ id: 'a', quantity: 500, unitPrice: 3333 }],
    });
    expect(r.lines[0]!.gross).toBe(1667);
    expect(r.total).toBe(1667);
  });

  it('supports half-even rounding', () => {
    const r = calculate({
      lines: [{ id: 'a', quantity: 500, unitPrice: 3333 }],
      roundingMode: 'HALF_EVEN',
    });
    expect(r.lines[0]!.gross).toBe(1666);
  });

  it('rejects non-integer inputs', () => {
    expect(() =>
      calculate({ lines: [{ id: 'a', quantity: 1.5, unitPrice: 100 }] }),
    ).toThrow(RangeError);
    expect(() =>
      calculate({ lines: [{ id: 'a', quantity: 1000, unitPrice: 10.5 }] }),
    ).toThrow(RangeError);
    expect(() => calculate({ lines: [], paid: 0.5 })).toThrow(RangeError);
    expect(() =>
      calculate({
        lines: [
          {
            id: 'a',
            quantity: 1000,
            unitPrice: 100,
            discount: { type: 'AMOUNT', amount: 0.5 },
          },
        ],
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculate({
        lines: [
          {
            id: 'a',
            quantity: 1000,
            unitPrice: 100,
            discount: { type: 'PERCENT', rate: 0.5 },
          },
        ],
      }),
    ).toThrow(RangeError);
  });

  it('tracks payments and balance', () => {
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 10000 }],
      paid: 2500,
    });
    expect(r.paid).toBe(2500);
    expect(r.balanceDue).toBe(7500);
  });
});

describe('calculate: UK VAT, exclusive', () => {
  // 2 h × £45.00 (20%) + 1.5 × £60.00 (20%) + 1 × £12.99 (zero-rated)
  const r = calculate({
    lines: [
      { id: 'a', quantity: 2000, unitPrice: 4500, taxes: [VAT20] },
      { id: 'b', quantity: 1500, unitPrice: 6000, taxes: [VAT20] },
      { id: 'c', quantity: 1000, unitPrice: 1299, taxes: [VAT0] },
    ],
  });

  it('computes subtotal, VAT and total', () => {
    expect(r.subtotal).toBe(19299);
    expect(r.taxTotal).toBe(3600);
    expect(r.total).toBe(22899);
  });

  it('breaks VAT down by rate with its taxable base', () => {
    expect(r.taxes).toEqual([
      {
        id: 'vat20',
        name: 'vat20',
        rate: 200_000,
        kind: 'STANDARD',
        base: 18000,
        amount: 3600,
      },
      {
        id: 'vat0',
        name: 'vat0',
        rate: 0,
        kind: 'STANDARD',
        base: 1299,
        amount: 0,
      },
    ]);
  });

  it('reports per-line totals', () => {
    expect(r.lines.map(l => l.total)).toEqual([10800, 10800, 1299]);
  });
});

describe('calculate: AU GST, inclusive', () => {
  // $110.00 incl. GST and 3 × $9.99 incl. GST
  const input = {
    lines: [
      { id: 'a', quantity: 1000, unitPrice: 11000, taxes: [GST10] },
      { id: 'b', quantity: 3000, unitPrice: 999, taxes: [GST10] },
    ],
    pricesIncludeTax: true,
  };

  it('extracts GST so base + GST equals the price', () => {
    const r = calculate(input);
    // 29.97 / 1.1 = 27.245454… → GST 2.72 (2.7245… rounds down), base 27.25
    expect(r.lines.map(l => [l.base, l.taxes[0]!.amount])).toEqual([
      [10000, 1000],
      [2725, 272],
    ]);
    expect(r.total).toBe(13997);
    expect(r.taxTotal).toBe(1272);
    expect(r.baseTotal).toBe(12725);
  });

  it('gives the same answer per total here', () => {
    expect(calculate({ ...input, rounding: 'PER_TOTAL' }).total).toBe(13997);
  });
});

describe('calculate: rounding strategy', () => {
  // Three lines of $0.33 with 10% tax: exact tax 0.033 each.
  const lines = [1, 2, 3].map(i => ({
    id: `l${i}`,
    quantity: 1000,
    unitPrice: 33,
    taxes: [GST10],
  }));

  it('per line: each 3.3¢ rounds to 3¢', () => {
    const r = calculate({ lines, rounding: 'PER_LINE' });
    expect(r.taxTotal).toBe(9);
    expect(r.lines.map(l => l.taxes[0]!.amount)).toEqual([3, 3, 3]);
  });

  it('per total: 9.9¢ rounds to 10¢ and lines still add up', () => {
    const r = calculate({ lines, rounding: 'PER_TOTAL' });
    expect(r.taxTotal).toBe(10);
    expect(r.lines.map(l => l.taxes[0]!.amount)).toEqual([4, 3, 3]);
  });

  it('per total with inclusive prices keeps base + tax = price', () => {
    const r = calculate({
      lines,
      rounding: 'PER_TOTAL',
      pricesIncludeTax: true,
    });
    r.lines.forEach(l => expect(l.base + l.taxes[0]!.amount).toBe(33));
    expect(r.total).toBe(99);
  });
});

describe('calculate: Canada', () => {
  const GST5 = tax('gst', 5);

  it('GST + QST 9.975% as two standard taxes', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 10000,
          taxes: [GST5, tax('qst', 9.975)],
        },
      ],
    });
    // 500.00 GST + 997.50 QST → 997.50 rounds half up to 998
    expect(r.taxes.map(t => t.amount)).toEqual([500, 998]);
    expect(r.total).toBe(11498);
  });

  it('compound tax applies on base plus standard taxes', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 10000,
          taxes: [GST5, tax('pst', 8.5, 'COMPOUND')],
        },
      ],
    });
    // (100.00 + 5.00) × 8.5% = 8.925 → 8.93
    expect(r.taxes.map(t => t.amount)).toEqual([500, 893]);
    expect(r.total).toBe(11393);
  });

  it('compound tax with half-even rounding', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 10000,
          taxes: [GST5, tax('pst', 8.5, 'COMPOUND')],
        },
      ],
      roundingMode: 'HALF_EVEN',
    });
    // 892.5 → 892 (even)
    expect(r.taxes[1]!.amount).toBe(892);
  });

  it('extracts compound taxes from inclusive prices', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 11393,
          taxes: [GST5, tax('pst', 8.5, 'COMPOUND')],
        },
      ],
      pricesIncludeTax: true,
    });
    // M = 1 + 0.05 + 0.085 × 1.05 = 1.13925; 113.93 / 1.13925 = 100.0044 → GST 5.00, PST 8.93
    expect(r.lines[0]!.taxes.map(t => t.amount)).toEqual([500, 893]);
    expect(r.lines[0]!.base).toBe(10000);
    expect(r.total).toBe(11393);
  });
});

describe('calculate: withholding (Spain IRPF)', () => {
  const IVA21 = tax('iva', 21);
  const IRPF15 = tax('irpf', 15, 'WITHHOLDING');

  it('adds IVA and deducts IRPF from the amount payable', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 100000, taxes: [IVA21, IRPF15] },
      ],
    });
    expect(r.baseTotal).toBe(100000);
    expect(r.taxTotal).toBe(21000);
    expect(r.withholdingTotal).toBe(15000);
    expect(r.totalBeforeWithholding).toBe(121000);
    expect(r.total).toBe(106000);
    expect(r.lines[0]!.total).toBe(121000);
    expect(r.taxes.find(t => t.id === 'irpf')).toMatchObject({
      kind: 'WITHHOLDING',
      base: 100000,
      amount: 15000,
    });
  });

  it('computes withholding on the extracted base when prices include tax', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 121000, taxes: [IVA21, IRPF15] },
      ],
      pricesIncludeTax: true,
    });
    expect(r.baseTotal).toBe(100000);
    expect(r.withholdingTotal).toBe(15000);
    expect(r.total).toBe(106000);
  });

  it('rounds withholding per total too', () => {
    const r = calculate({
      lines: [1, 2, 3].map(i => ({
        id: `l${i}`,
        quantity: 1000,
        unitPrice: 33,
        taxes: [IRPF15],
      })),
      rounding: 'PER_TOTAL',
    });
    // 3 × 4.95¢ = 14.85¢ → 15¢
    expect(r.withholdingTotal).toBe(15);
    expect(r.total).toBe(99 - 15);
  });
});

describe('calculate: discounts', () => {
  it('applies percent line discounts before tax', () => {
    // $80.00 less 12.5% = $70.00, plus 20% = $84.00
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 8000,
          discount: { type: 'PERCENT', rate: 125_000 },
          taxes: [VAT20],
        },
      ],
    });
    expect(r.lines[0]).toMatchObject({
      gross: 8000,
      lineDiscount: 1000,
      net: 7000,
      base: 7000,
      total: 8400,
    });
    expect(r.lineDiscountTotal).toBe(1000);
  });

  it('caps amount discounts at the line amount and clamps percent', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: 1000,
          unitPrice: 3000,
          discount: { type: 'AMOUNT', amount: 5000 },
        },
        {
          id: 'b',
          quantity: 1000,
          unitPrice: 3000,
          discount: { type: 'PERCENT', rate: 2_000_000 },
        },
      ],
    });
    expect(r.lines.map(l => l.net)).toEqual([0, 0]);
  });

  it('allocates a document percent discount across lines before tax', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 10000, taxes: [VAT20] },
        { id: 'b', quantity: 1000, unitPrice: 5000, taxes: [VAT20] },
      ],
      discount: { type: 'PERCENT', rate: 100_000 },
    });
    expect(r.documentDiscount).toBe(1500);
    expect(r.lines.map(l => l.documentDiscount)).toEqual([1000, 500]);
    expect(r.taxTotal).toBe(2700);
    expect(r.total).toBe(16200);
  });

  it('allocates a fixed document discount by largest remainder', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 10000 },
        { id: 'b', quantity: 1000, unitPrice: 20000 },
      ],
      discount: { type: 'AMOUNT', amount: 1000 },
    });
    expect(r.lines.map(l => l.documentDiscount)).toEqual([333, 667]);
    expect(r.total).toBe(29000);
  });

  it('never discounts charges', () => {
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 10000, taxes: [VAT20] }],
      charges: [
        {
          id: 'ship',
          quantity: 1000,
          unitPrice: 500,
          taxes: [VAT20],
          discount: { type: 'AMOUNT', amount: 500 },
        },
      ],
      discount: { type: 'PERCENT', rate: 500_000 },
    });
    expect(r.chargesTotal).toBe(500);
    expect(r.lines[1]).toMatchObject({
      isCharge: true,
      lineDiscount: 0,
      documentDiscount: 0,
      base: 500,
    });
    // (50.00 + 5.00) × 1.2
    expect(r.total).toBe(6600);
  });
});

describe('calculate: credit notes (negative amounts)', () => {
  it('mirrors positive math exactly', () => {
    const r = calculate({
      lines: [{ id: 'a', quantity: -1000, unitPrice: 10000, taxes: [VAT20] }],
    });
    expect(r.lines[0]).toMatchObject({
      gross: -10000,
      base: -10000,
      total: -12000,
    });
    expect(r.total).toBe(-12000);
  });

  it('rounds half away from zero symmetrically', () => {
    const r = calculate({
      lines: [{ id: 'a', quantity: -500, unitPrice: 3333 }],
    });
    expect(r.lines[0]!.gross).toBe(-1667);
  });

  it('keeps negative amount discounts on negative lines', () => {
    const r = calculate({
      lines: [
        {
          id: 'a',
          quantity: -1000,
          unitPrice: 3000,
          discount: { type: 'AMOUNT', amount: 1000 },
        },
      ],
    });
    expect(r.lines[0]).toMatchObject({ lineDiscount: -1000, net: -2000 });
  });
});

describe('calculate: summaries', () => {
  it('merges duplicate taxes on one line', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 1000, taxes: [GST10, GST10] },
      ],
    });
    expect(r.taxes).toHaveLength(1);
    expect(r.taxes[0]!.amount).toBe(200);
  });

  it('treats the same tax id with a different rate as a separate row', () => {
    const r = calculate({
      lines: [
        { id: 'a', quantity: 1000, unitPrice: 1000, taxes: [tax('vat', 20)] },
        { id: 'b', quantity: 1000, unitPrice: 1000, taxes: [tax('vat', 5)] },
      ],
    });
    expect(r.taxes.map(t => t.amount)).toEqual([200, 50]);
  });

  it('keeps compound duplicates merged too', () => {
    const pst = tax('pst', 7, 'COMPOUND');
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 1000, taxes: [pst, pst] }],
    });
    expect(r.taxes[0]!.amount).toBe(140);
  });

  it('merges duplicate withholding entries', () => {
    const w = tax('ret', 10, 'WITHHOLDING');
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 1000, taxes: [w, w] }],
    });
    expect(r.withholdingTotal).toBe(200);
  });
});
