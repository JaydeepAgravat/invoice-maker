import { addDays, compareDates, type ISODate } from './dates';
import { mileageAmount } from './mileage';
import { agingAsOf, type AgingBuckets } from './statement';

/**
 * Business reports for one currency and period. Income is cash received
 * (payments), which is what most small businesses are taxed on; invoiced
 * totals are shown alongside. Pure: callers pass plain rows.
 */

export type PeriodKey =
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'LAST_YEAR';

export const PERIOD_KEYS: readonly PeriodKey[] = [
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_QUARTER',
  'THIS_YEAR',
  'LAST_YEAR',
];

export type Period = { from: ISODate; to: ISODate };

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthRange = (y: number, m1: number, m2: number): Period => ({
  from: `${y}-${pad(m1)}-01`,
  to: `${y}-${pad(m2)}-${pad(lastDay(y, m2))}`,
});

export function periodFor(key: PeriodKey, today: ISODate): Period {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (key) {
    case 'THIS_MONTH':
      return monthRange(y, m, m);
    case 'LAST_MONTH':
      return m === 1 ? monthRange(y - 1, 12, 12) : monthRange(y, m - 1, m - 1);
    case 'THIS_QUARTER': {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return monthRange(y, q, q + 2);
    }
    case 'THIS_YEAR':
      return monthRange(y, 1, 12);
    case 'LAST_YEAR':
      return monthRange(y - 1, 1, 12);
  }
}

/** "2026-01" … for every month touching the period. */
export function monthsIn({ from, to }: Period): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${pad(m)}`;
    out.push(key);
    if (key >= end) {
      return out;
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
}

export type ReportPayment = {
  date: ISODate;
  amount: number;
  clientId: string | null;
  clientName: string | null;
};

export type ReportDocument = {
  id: string;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  number: string;
  date: ISODate;
  dueDate: ISODate | null;
  total: number;
  clientId: string | null;
  clientName: string | null;
  taxes: { name: string; rate: number; amount: number; withholding: boolean }[];
};

export type ReportPaymentLink = { documentId: string; date: ISODate; amount: number };

export type ReportExpense = {
  date: ISODate;
  amount: number;
  tax: number;
  category: string;
};

export type ReportTrip = {
  date: ISODate;
  distance: number;
  rate: number;
};

export type Report = {
  period: Period;
  months: { month: string; income: number; expenses: number }[];
  income: number;
  invoiced: number;
  credited: number;
  expenses: number;
  expenseTax: number;
  mileage: number;
  mileageDistance: number;
  profit: number;
  byClient: { clientId: string | null; name: string | null; income: number }[];
  taxCollected: { name: string; rate: number; amount: number; withholding: boolean }[];
  expensesByCategory: { category: string; amount: number }[];
  aging: AgingBuckets;
  outstanding: number;
};

const within = (d: ISODate, p: Period) =>
  compareDates(d, p.from) >= 0 && compareDates(d, p.to) <= 0;

const sum = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0);

export function buildReport(input: {
  period: Period;
  asOf: ISODate;
  payments: readonly ReportPayment[];
  documents: readonly ReportDocument[];
  /** All payments against the documents, for aging. */
  documentPayments: readonly ReportPaymentLink[];
  expenses: readonly ReportExpense[];
  trips: readonly ReportTrip[];
}): Report {
  const { period } = input;
  const payments = input.payments.filter(p => within(p.date, period));
  const docs = input.documents.filter(d => within(d.date, period));
  const expenses = input.expenses.filter(e => within(e.date, period));
  const trips = input.trips.filter(t => within(t.date, period));

  const months = monthsIn(period).map(month => ({
    month,
    income: sum(payments.filter(p => p.date.startsWith(month)).map(p => p.amount)),
    expenses: sum(expenses.filter(e => e.date.startsWith(month)).map(e => e.amount)),
  }));

  const clients = new Map<string, { clientId: string | null; name: string | null; income: number }>();
  for (const p of payments) {
    const key = p.clientId ?? '';
    const c = clients.get(key) ?? { clientId: p.clientId, name: p.clientName, income: 0 };
    c.income += p.amount;
    clients.set(key, c);
  }

  const taxes = new Map<string, Report['taxCollected'][number]>();
  for (const d of docs) {
    const sign = d.kind === 'CREDIT_NOTE' ? -1 : 1;
    for (const t of d.taxes) {
      const key = `${t.name}|${t.rate}|${t.withholding}`;
      const row = taxes.get(key) ?? { name: t.name, rate: t.rate, amount: 0, withholding: t.withholding };
      row.amount += sign * t.amount;
      taxes.set(key, row);
    }
  }

  const categories = new Map<string, number>();
  for (const e of expenses) {
    categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);
  }

  const income = sum(payments.map(p => p.amount));
  const expenseTotal = sum(expenses.map(e => e.amount));
  const mileage = sum(trips.map(t => mileageAmount(t.distance, t.rate)));
  const aging = agingAsOf(
    input.documents.map(d => ({
      id: d.id,
      number: d.number,
      kind: d.kind,
      date: d.date,
      dueDate: d.dueDate,
      amount: d.total,
    })),
    input.documentPayments.map((p, i) => ({
      id: String(i),
      documentId: p.documentId,
      date: p.date,
      amount: p.amount,
    })),
    input.asOf,
  );

  return {
    period,
    months,
    income,
    invoiced: sum(docs.filter(d => d.kind === 'INVOICE').map(d => d.total)),
    credited: sum(docs.filter(d => d.kind === 'CREDIT_NOTE').map(d => d.total)),
    expenses: expenseTotal,
    expenseTax: sum(expenses.map(e => e.tax)),
    mileage,
    mileageDistance: sum(trips.map(t => t.distance)),
    profit: income - expenseTotal - mileage,
    byClient: [...clients.values()].sort((a, b) => b.income - a.income),
    taxCollected: [...taxes.values()]
      .filter(t => t.amount !== 0)
      .sort((a, b) => Number(a.withholding) - Number(b.withholding) || b.amount - a.amount),
    expensesByCategory: [...categories.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    aging,
    outstanding: sum(Object.values(aging)),
  };
}

/** The same-length period just before, for "vs last period" comparisons. */
export const previousPeriod = ({ from, to }: Period): Period => {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const end = addDays(from, -1);
  return { from: addDays(end, -days), to: end };
};
