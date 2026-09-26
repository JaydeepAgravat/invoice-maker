import { contractValue } from '../changeOrder';
import {
  agingAsOf,
  buildStatement,
  type StatementInvoice,
  type StatementPayment,
} from '../statement';

const docs: StatementInvoice[] = [
  {
    id: 'i1',
    number: 'INV-0001',
    kind: 'INVOICE',
    date: '2026-06-01',
    dueDate: '2026-06-15',
    amount: 50000,
  },
  {
    id: 'i2',
    number: 'INV-0002',
    kind: 'INVOICE',
    date: '2026-08-01',
    dueDate: '2026-08-31',
    amount: 30000,
  },
  {
    id: 'i3',
    number: 'INV-0003',
    kind: 'INVOICE',
    date: '2026-09-10',
    dueDate: '2026-10-10',
    amount: 20000,
  },
  {
    id: 'c1',
    number: 'CN-0001',
    kind: 'CREDIT_NOTE',
    date: '2026-09-12',
    dueDate: null,
    amount: 5000,
  },
];
const payments: StatementPayment[] = [
  { id: 'p1', documentId: 'i1', date: '2026-06-20', amount: 50000 },
  { id: 'p2', documentId: 'i2', date: '2026-09-05', amount: 10000 },
];

describe('buildStatement', () => {
  const s = buildStatement({
    documents: docs,
    payments,
    from: '2026-08-01',
    to: '2026-09-30',
  });

  it('carries the opening balance from before the period', () => {
    // INV-0001 fully paid before August.
    expect(s.openingBalance).toBe(0);
  });

  it('lists entries chronologically with a running balance', () => {
    expect(
      s.entries.map(e => [e.reference, e.debit, e.credit, e.balance]),
    ).toEqual([
      ['INV-0002', 30000, 0, 30000],
      ['INV-0002', 0, 10000, 20000],
      ['INV-0003', 20000, 0, 40000],
      ['CN-0001', 0, 5000, 35000],
    ]);
    expect(s.totalDebits).toBe(50000);
    expect(s.totalCredits).toBe(15000);
    expect(s.closingBalance).toBe(35000);
  });

  it('ages unpaid invoices as of the end date', () => {
    expect(s.aging).toEqual({
      current: 20000,
      days1to30: 20000,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
    });
  });

  it('includes pre-period activity in the opening balance', () => {
    const later = buildStatement({
      documents: docs,
      payments,
      from: '2026-09-11',
      to: '2026-09-30',
    });
    expect(later.openingBalance).toBe(40000);
    expect(later.entries).toHaveLength(1);
  });

  it('orders same-day entries invoice before payment', () => {
    const r = buildStatement({
      documents: [
        {
          id: 'x',
          number: 'INV-9',
          kind: 'INVOICE',
          date: '2026-01-01',
          dueDate: null,
          amount: 100,
        },
      ],
      payments: [
        { id: 'y', documentId: 'x', date: '2026-01-01', amount: 100 },
        { id: 'z', documentId: 'missing', date: '2026-01-01', amount: 1 },
      ],
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(r.entries.map(e => e.kind)).toEqual([
      'INVOICE',
      'PAYMENT',
      'PAYMENT',
    ]);
    expect(r.entries[2]!.reference).toBe('');
  });

  it('rejects inverted periods', () => {
    expect(() =>
      buildStatement({
        documents: [],
        payments: [],
        from: '2026-02-01',
        to: '2026-01-01',
      }),
    ).toThrow(RangeError);
  });
});

describe('agingAsOf', () => {
  const inv = (
    id: string,
    dueDate: string | null,
    amount = 100,
  ): StatementInvoice => ({
    id,
    number: id,
    kind: 'INVOICE',
    date: '2026-01-01',
    dueDate,
    amount,
  });

  it('buckets by days past due', () => {
    const aging = agingAsOf(
      [
        inv('a', '2026-06-30'),
        inv('b', '2026-05-31'),
        inv('c', '2026-04-30'),
        inv('d', '2026-03-01'),
        inv('e', null),
        inv('f', '2026-06-01', 0),
      ],
      [],
      '2026-07-15',
    );
    expect(aging).toEqual({
      current: 100,
      days1to30: 100,
      days31to60: 100,
      days61to90: 100,
      days90plus: 100,
    });
  });

  it('ignores future invoices and later payments', () => {
    const aging = agingAsOf(
      [inv('a', '2026-01-10'), { ...inv('future', null), date: '2027-01-01' }],
      [{ id: 'p', documentId: 'a', date: '2026-12-01', amount: 100 }],
      '2026-01-31',
    );
    expect(aging.days1to30).toBe(100);
    expect(aging.current).toBe(0);
  });
});

describe('contractValue', () => {
  it('counts only accepted change orders in the revised total', () => {
    expect(
      contractValue(100000, [
        { total: 15000, status: 'ACCEPTED' },
        { total: -5000, status: 'ACCEPTED' },
        { total: 8000, status: 'PENDING' },
        { total: 50000, status: 'DECLINED' },
        { total: 1, status: 'VOID' },
      ]),
    ).toEqual({
      original: 100000,
      approvedChanges: 10000,
      pendingChanges: 8000,
      revised: 110000,
      projected: 118000,
    });
  });
});
