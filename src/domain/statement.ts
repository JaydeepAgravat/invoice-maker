import { compareDates, daysBetween, type ISODate } from './dates';

/**
 * Statement of account for one client in one currency: opening balance,
 * every invoice / credit note / payment in the period with a running
 * balance, closing balance, and aging of what is still unpaid.
 */

export type StatementInvoice = {
  id: string;
  number: string;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  date: ISODate;
  dueDate: ISODate | null;
  /** Positive for invoices; credit notes are entered as positive and reduce the balance. */
  amount: number;
};

export type StatementPayment = {
  id: string;
  documentId: string;
  date: ISODate;
  amount: number;
};

export type StatementEntry = {
  id: string;
  date: ISODate;
  kind: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

export type AgingBuckets = {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
};

export type Statement = {
  from: ISODate;
  to: ISODate;
  openingBalance: number;
  entries: StatementEntry[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  aging: AgingBuckets;
};

const KIND_ORDER = { INVOICE: 0, CREDIT_NOTE: 1, PAYMENT: 2 } as const;

export function buildStatement(input: {
  documents: readonly StatementInvoice[];
  payments: readonly StatementPayment[];
  from: ISODate;
  to: ISODate;
}): Statement {
  const { from, to } = input;
  if (compareDates(from, to) > 0) {
    throw new RangeError('Statement start date is after its end date');
  }
  const numberOf = new Map(input.documents.map(d => [d.id, d.number]));

  type Raw = Omit<StatementEntry, 'balance'>;
  const raw: Raw[] = [
    ...input.documents.map(d => ({
      id: d.id,
      date: d.date,
      kind: d.kind,
      reference: d.number,
      debit: d.kind === 'INVOICE' ? d.amount : 0,
      credit: d.kind === 'CREDIT_NOTE' ? d.amount : 0,
    })),
    ...input.payments.map(p => ({
      id: p.id,
      date: p.date,
      kind: 'PAYMENT' as const,
      reference: numberOf.get(p.documentId) ?? '',
      debit: 0,
      credit: p.amount,
    })),
  ].sort(
    (a, b) =>
      compareDates(a.date, b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );

  const before = raw.filter(e => compareDates(e.date, from) < 0);
  const within = raw.filter(
    e => compareDates(e.date, from) >= 0 && compareDates(e.date, to) <= 0,
  );

  const openingBalance = before.reduce((a, e) => a + e.debit - e.credit, 0);
  let running = openingBalance;
  const entries = within.map(e => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });

  return {
    from,
    to,
    openingBalance,
    entries,
    totalDebits: within.reduce((a, e) => a + e.debit, 0),
    totalCredits: within.reduce((a, e) => a + e.credit, 0),
    closingBalance: running,
    aging: agingAsOf(input.documents, input.payments, to),
  };
}

/** Unpaid invoice balances by days past due, as of a date. */
export function agingAsOf(
  documents: readonly StatementInvoice[],
  payments: readonly StatementPayment[],
  asOf: ISODate,
): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  };
  for (const doc of documents) {
    if (doc.kind !== 'INVOICE' || compareDates(doc.date, asOf) > 0) {
      continue;
    }
    const paid = payments
      .filter(p => p.documentId === doc.id && compareDates(p.date, asOf) <= 0)
      .reduce((a, p) => a + p.amount, 0);
    const open = doc.amount - paid;
    if (open <= 0) {
      continue;
    }
    const late = doc.dueDate ? daysBetween(doc.dueDate, asOf) : 0;
    if (late <= 0) {
      buckets.current += open;
    } else if (late <= 30) {
      buckets.days1to30 += open;
    } else if (late <= 60) {
      buckets.days31to60 += open;
    } else if (late <= 90) {
      buckets.days61to90 += open;
    } else {
      buckets.days90plus += open;
    }
  }
  return buckets;
}
