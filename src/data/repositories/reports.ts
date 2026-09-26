import type { ISODate } from '@/domain/dates';
import { buildReport, type Period, type Report } from '@/domain/reports';

import { num, reqNum, reqStr, str, type Executor } from '../db/types';

/**
 * Reports for one currency. Mileage uses the rates stored on each trip, so a
 * rate change later never rewrites old deductions.
 */
export async function loadReport(
  db: Executor,
  opts: { currency: string; period: Period; asOf: ISODate },
): Promise<Report> {
  const { currency } = opts;
  const payments = await db.execute(
    `SELECT p.paid_on, p.amount_minor, p.document_id, d.client_id,
       COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client_name
     FROM payments p JOIN documents d ON d.id = p.document_id LEFT JOIN clients c ON c.id = d.client_id
     WHERE d.currency = ? AND d.status <> 'VOID' AND d.deleted_at IS NULL`,
    [currency],
  );
  const docs = await db.execute(
    `SELECT d.id, d.doc_type, d.number, d.issue_date, d.due_date, d.total_minor, d.client_id,
       COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client_name
     FROM documents d LEFT JOIN clients c ON c.id = d.client_id
     WHERE d.currency = ? AND d.doc_type IN ('INVOICE','CREDIT_NOTE')
       AND d.status NOT IN ('DRAFT','VOID') AND d.deleted_at IS NULL`,
    [currency],
  );
  const taxes = await db.execute(
    `SELECT l.document_id, t.name, t.rate_ppm, t.kind, SUM(t.amount_minor) AS amount
     FROM document_line_taxes t JOIN document_lines l ON l.id = t.line_id JOIN documents d ON d.id = l.document_id
     WHERE d.currency = ? AND d.doc_type IN ('INVOICE','CREDIT_NOTE')
       AND d.status NOT IN ('DRAFT','VOID') AND d.deleted_at IS NULL
     GROUP BY l.document_id, t.name, t.rate_ppm, t.kind`,
    [currency],
  );
  const taxesByDoc = new Map<string, { name: string; rate: number; amount: number; withholding: boolean }[]>();
  for (const r of taxes.rows) {
    const id = reqStr(r.document_id);
    taxesByDoc.set(id, [
      ...(taxesByDoc.get(id) ?? []),
      {
        name: reqStr(r.name),
        rate: reqNum(r.rate_ppm),
        amount: reqNum(r.amount),
        withholding: r.kind === 'WITHHOLDING',
      },
    ]);
  }
  const expenses = await db.execute(
    'SELECT date, amount_minor, tax_minor, category FROM expenses WHERE deleted_at IS NULL AND currency = ?',
    [currency],
  );
  const trips = await db.execute(
    'SELECT date, distance_milli, rate_minor FROM mileage WHERE deleted_at IS NULL AND currency = ?',
    [currency],
  );

  const paymentRows = payments.rows.map(r => ({
    date: reqStr(r.paid_on),
    amount: reqNum(r.amount_minor),
    documentId: reqStr(r.document_id),
    clientId: str(r.client_id),
    clientName: str(r.client_name),
  }));

  return buildReport({
    period: opts.period,
    asOf: opts.asOf,
    payments: paymentRows,
    documentPayments: paymentRows,
    documents: docs.rows.map(r => ({
      id: reqStr(r.id),
      kind: reqStr(r.doc_type) as 'INVOICE' | 'CREDIT_NOTE',
      number: str(r.number) ?? '',
      date: reqStr(r.issue_date),
      dueDate: str(r.due_date),
      total: reqNum(r.total_minor),
      clientId: str(r.client_id),
      clientName: str(r.client_name),
      taxes: taxesByDoc.get(reqStr(r.id)) ?? [],
    })),
    expenses: expenses.rows.map(r => ({
      date: reqStr(r.date),
      amount: reqNum(r.amount_minor),
      tax: num(r.tax_minor) ?? 0,
      category: str(r.category) ?? 'OTHER',
    })),
    trips: trips.rows.map(r => ({
      date: reqStr(r.date),
      distance: reqNum(r.distance_milli),
      rate: reqNum(r.rate_minor),
    })),
  });
}

/** Currencies with any activity, most used first (reports are per currency). */
export async function reportCurrencies(db: Executor): Promise<string[]> {
  const { rows } = await db.execute(
    `SELECT currency, SUM(n) AS n FROM (
       SELECT currency, COUNT(*) AS n FROM documents WHERE deleted_at IS NULL AND status <> 'DRAFT' GROUP BY currency
       UNION ALL SELECT currency, COUNT(*) FROM expenses WHERE deleted_at IS NULL GROUP BY currency
       UNION ALL SELECT currency, COUNT(*) FROM mileage WHERE deleted_at IS NULL GROUP BY currency
     ) GROUP BY currency ORDER BY n DESC`,
  );
  return rows.map(r => reqStr(r.currency));
}

