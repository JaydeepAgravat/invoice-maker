import { csvSeparator, minorToDecimal, toCsv } from '../csv';
import { isExpenseCategory } from '../expenses';
import { convertDistance, mileageAmount, MILEAGE_PRESETS } from '../mileage';
import {
  buildReport,
  monthsIn,
  PERIOD_KEYS,
  periodFor,
  previousPeriod,
  type ReportDocument,
} from '../reports';

describe('periods', () => {
  it('resolves named periods', () => {
    expect(periodFor('THIS_MONTH', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodFor('LAST_MONTH', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodFor('LAST_MONTH', '2026-01-05')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodFor('THIS_QUARTER', '2026-08-15')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodFor('THIS_YEAR', '2024-02-29')).toEqual({ from: '2024-01-01', to: '2024-12-31' });
    expect(periodFor('LAST_YEAR', '2026-06-01')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(PERIOD_KEYS).toHaveLength(5);
  });
  it('lists months across a year boundary', () => {
    expect(monthsIn({ from: '2025-11-15', to: '2026-02-01' })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
  it('finds the previous period of the same length', () => {
    expect(previousPeriod({ from: '2026-09-01', to: '2026-09-30' })).toEqual({
      from: '2026-08-02',
      to: '2026-08-31',
    });
  });
});

describe('buildReport', () => {
  const inv = (over: Partial<ReportDocument>): ReportDocument => ({
    id: 'i1',
    kind: 'INVOICE',
    number: 'INV-1',
    date: '2026-09-01',
    dueDate: '2026-09-15',
    total: 12000,
    clientId: 'c1',
    clientName: 'Acme',
    taxes: [{ name: 'VAT', rate: 200000, amount: 2000, withholding: false }],
    ...over,
  });

  const report = buildReport({
    period: { from: '2026-08-01', to: '2026-09-30' },
    asOf: '2026-09-30',
    payments: [
      { date: '2026-09-02', amount: 5000, clientId: 'c1', clientName: 'Acme' },
      { date: '2026-08-20', amount: 8000, clientId: 'c2', clientName: 'Birch' },
      { date: '2026-09-25', amount: 1000, clientId: 'c1', clientName: 'Acme' },
      { date: '2026-07-31', amount: 999, clientId: 'c1', clientName: 'Acme' },
      { date: '2026-09-10', amount: 300, clientId: null, clientName: null },
    ],
    documents: [
      inv({}),
      inv({ id: 'i2', number: 'INV-2', date: '2026-08-10', dueDate: '2026-08-20', total: 6000,
        taxes: [
          { name: 'VAT', rate: 200000, amount: 1000, withholding: false },
          { name: 'IRPF', rate: 150000, amount: 750, withholding: true },
        ] }),
      inv({ id: 'cn', kind: 'CREDIT_NOTE', number: 'CN-1', date: '2026-09-05', total: 1200,
        taxes: [{ name: 'VAT', rate: 200000, amount: 200, withholding: false }] }),
      inv({ id: 'old', number: 'INV-0', date: '2026-06-01', dueDate: null, total: 500, taxes: [] }),
      inv({ id: 'z', number: 'INV-Z', date: '2026-09-03', total: 100,
        taxes: [{ name: 'Zero', rate: 0, amount: 0, withholding: false }] }),
    ],
    documentPayments: [
      { documentId: 'i1', date: '2026-09-02', amount: 6000 },
      { documentId: 'i2', date: '2026-08-25', amount: 6000 },
    ],
    expenses: [
      { date: '2026-09-03', amount: 2500, tax: 400, category: 'FUEL' },
      { date: '2026-08-03', amount: 1000, tax: 0, category: 'TOOLS' },
      { date: '2026-09-13', amount: 500, tax: 0, category: 'FUEL' },
      { date: '2026-10-01', amount: 9999, tax: 0, category: 'FUEL' },
    ],
    trips: [
      { date: '2026-09-04', distance: 12500, rate: 45 },
      { date: '2026-01-04', distance: 1000, rate: 45 },
    ],
  });

  it('totals cash income, expenses, mileage and profit', () => {
    expect(report.income).toBe(14300);
    expect(report.expenses).toBe(4000);
    expect(report.expenseTax).toBe(400);
    expect(report.mileage).toBe(563);
    expect(report.mileageDistance).toBe(12500);
    expect(report.profit).toBe(14300 - 4000 - 563);
    expect(report.invoiced).toBe(18100);
    expect(report.credited).toBe(1200);
  });
  it('splits by month', () => {
    expect(report.months).toEqual([
      { month: '2026-08', income: 8000, expenses: 1000 },
      { month: '2026-09', income: 6300, expenses: 3000 },
    ]);
  });
  it('ranks clients by income', () => {
    expect(report.byClient.map(c => [c.name, c.income])).toEqual([
      ['Birch', 8000],
      ['Acme', 6000],
      [null, 300],
    ]);
  });
  it('nets tax collected against credit notes, withholding last', () => {
    expect(report.taxCollected).toEqual([
      { name: 'VAT', rate: 200000, amount: 2800, withholding: false },
      { name: 'IRPF', rate: 150000, amount: 750, withholding: true },
    ]);
  });
  it('groups expenses by category and ages what is unpaid', () => {
    expect(report.expensesByCategory).toEqual([
      { category: 'FUEL', amount: 3000 },
      { category: 'TOOLS', amount: 1000 },
    ]);
    expect(report.aging.days1to30).toBe(6100);
    expect(report.aging.days90plus).toBe(0);
    expect(report.outstanding).toBe(6000 + 500 + 100);
  });
});

describe('mileage', () => {
  it('computes the allowance and converts units', () => {
    expect(mileageAmount(12345, 45)).toBe(556);
    expect(convertDistance(1000, 'mi', 'km')).toBe(1609);
    expect(convertDistance(1609, 'km', 'mi')).toBe(1000);
    expect(convertDistance(5000, 'km', 'km')).toBe(5000);
    expect(MILEAGE_PRESETS.US.unit).toBe('mi');
  });
});

describe('expenses', () => {
  it('recognises categories', () => {
    expect(isExpenseCategory('FUEL')).toBe(true);
    expect(isExpenseCategory('NOPE')).toBe(false);
    expect(isExpenseCategory(null)).toBe(false);
  });
});

describe('csv', () => {
  it('writes Excel-friendly CSV', () => {
    expect(
      toCsv([
        ['Date', 'Client', 'Amount'],
        ['2026-09-01', 'Harper, Lane & "Co"', 1234.5],
        ['2026-09-02', null, -3],
        ['=cmd()', ' padded', undefined],
      ]),
    ).toBe(
      '﻿Date,Client,Amount\r\n2026-09-01,"Harper, Lane & ""Co""",1234.5\r\n2026-09-02,,-3\r\n\'=cmd(),"  padded",\r\n'.replace(
        '"  padded"',
        '" padded"',
      ),
    );
  });
  it('uses semicolons and decimal commas where Excel expects them', () => {
    expect(csvSeparator(',')).toBe(';');
    expect(csvSeparator('.')).toBe(',');
    expect(toCsv([[1.5, 'a;b', '-12']], { separator: ';', decimalSeparator: ',' })).toBe(
      '﻿1,5;"a;b";-12\r\n',
    );
    expect(minorToDecimal(123456, 2)).toBe(1234.56);
    expect(minorToDecimal(500, 0)).toBe(500);
  });
});
