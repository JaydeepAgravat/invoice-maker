import type { ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';
import {
  displayStatus,
  type DisplayStatus,
  type StoredStatus,
} from '@/domain/status';
import { buildStatement, type Statement } from '@/domain/statement';

import {
  num,
  reqNum,
  reqStr,
  str,
  type Executor,
  type SqlValue,
} from '../db/types';

import { toFtsQuery } from './documents';

export type InboxView =
  | 'all'
  | 'drafts'
  | 'unpaid'
  | 'overdue'
  | 'estimates'
  | 'paid';

export type DocumentSummary = {
  id: string;
  type: DocType;
  number: string | null;
  status: DisplayStatus;
  clientId: string | null;
  clientName: string | null;
  issueDate: ISODate;
  dueDate: ISODate | null;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  updatedAt: number;
};

/**
 * SQL predicates for each saved view. "Overdue" and "Paid" are derived from
 * facts, so they are computed here with `today` rather than stored.
 */
const VIEW_SQL: Record<InboxView, string> = {
  all: '1 = 1',
  drafts: "d.status = 'DRAFT'",
  unpaid:
    "d.doc_type = 'INVOICE' AND d.status = 'SENT' AND d.paid_minor < d.total_minor",
  overdue:
    "d.doc_type = 'INVOICE' AND d.status = 'SENT' AND d.paid_minor < d.total_minor AND d.due_date IS NOT NULL AND d.due_date < :today",
  estimates: "d.doc_type IN ('ESTIMATE','CHANGE_ORDER') AND d.status <> 'VOID'",
  paid: "((d.doc_type = 'INVOICE' AND d.status = 'SENT' AND d.total_minor > 0 AND d.paid_minor >= d.total_minor) OR (d.doc_type = 'RECEIPT' AND d.status = 'SENT'))",
};

const bindToday = (sql: string, today: ISODate): [string, SqlValue[]] => {
  const params: SqlValue[] = [];
  const out = sql.replace(/:today/g, () => {
    params.push(today);
    return '?';
  });
  return [out, params];
};

const SUMMARY_SELECT = `SELECT d.id, d.doc_type, d.number, d.status, d.client_id, d.issue_date, d.due_date,
  d.valid_until, d.currency, d.total_minor, d.paid_minor, d.updated_at,
  COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client_name
  FROM documents d LEFT JOIN clients c ON c.id = d.client_id`;

export async function listDocuments(
  db: Executor,
  opts: {
    today: ISODate;
    view?: InboxView;
    search?: string;
    clientId?: string;
    type?: DocType;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentSummary[]> {
  const [viewSql, params] = bindToday(VIEW_SQL[opts.view ?? 'all'], opts.today);
  const where = ['d.deleted_at IS NULL', viewSql];
  if (opts.clientId) {
    where.push('d.client_id = ?');
    params.push(opts.clientId);
  }
  if (opts.type) {
    where.push('d.doc_type = ?');
    params.push(opts.type);
  }
  const fts = opts.search ? toFtsQuery(opts.search) : null;
  if (opts.search && !fts) {
    return [];
  }
  if (fts) {
    where.push(
      'd.id IN (SELECT document_id FROM documents_fts WHERE documents_fts MATCH ?)',
    );
    params.push(fts);
  }
  params.push(opts.limit ?? 50, opts.offset ?? 0);

  const { rows } = await db.execute(
    `${SUMMARY_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY CASE WHEN d.status = 'DRAFT' THEN d.updated_at END DESC, d.issue_date DESC, d.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  return rows.map(r => {
    const total = reqNum(r.total_minor);
    const paid = reqNum(r.paid_minor);
    const type = reqStr(r.doc_type) as DocType;
    return {
      id: reqStr(r.id),
      type,
      number: str(r.number),
      status: displayStatus({
        type,
        stored: reqStr(r.status) as StoredStatus,
        total,
        paid,
        dueDate: str(r.due_date),
        validUntil: str(r.valid_until),
        today: opts.today,
      }),
      clientId: str(r.client_id),
      clientName: str(r.client_name),
      issueDate: reqStr(r.issue_date),
      dueDate: str(r.due_date),
      currency: reqStr(r.currency),
      total,
      paid,
      balance: type === 'INVOICE' ? total - paid : 0,
      updatedAt: reqNum(r.updated_at),
    };
  });
}

export async function viewCounts(
  db: Executor,
  today: ISODate,
): Promise<Record<InboxView, number>> {
  const views = Object.keys(VIEW_SQL) as InboxView[];
  const parts: string[] = [];
  const params: SqlValue[] = [];
  for (const v of views) {
    const [sql, p] = bindToday(VIEW_SQL[v], today);
    parts.push(`SUM(CASE WHEN ${sql} THEN 1 ELSE 0 END) AS "${v}"`);
    params.push(...p);
  }
  const { rows } = await db.execute(
    `SELECT ${parts.join(', ')} FROM documents d WHERE d.deleted_at IS NULL`,
    params,
  );
  const r = rows[0] ?? {};
  return Object.fromEntries(views.map(v => [v, num(r[v]) ?? 0])) as Record<
    InboxView,
    number
  >;
}

export type MoneyByCurrency = Record<string, number>;

export type Dashboard = {
  outstanding: MoneyByCurrency;
  overdue: MoneyByCurrency;
  paidThisMonth: MoneyByCurrency;
};

/** Header totals. Grouped by currency; never summed across currencies. */
export async function dashboard(
  db: Executor,
  today: ISODate,
): Promise<Dashboard> {
  const [overdueSql, overdueParams] = bindToday(VIEW_SQL.overdue, today);
  const open = await db.execute(
    `SELECT d.currency,
       SUM(d.total_minor - d.paid_minor) AS outstanding,
       SUM(CASE WHEN ${overdueSql} THEN d.total_minor - d.paid_minor ELSE 0 END) AS overdue
     FROM documents d WHERE d.deleted_at IS NULL AND ${VIEW_SQL.unpaid} GROUP BY d.currency`,
    overdueParams,
  );
  const monthStart = `${today.slice(0, 7)}-01`;
  const paid = await db.execute(
    `SELECT d.currency, SUM(p.amount_minor) AS amount FROM payments p JOIN documents d ON d.id = p.document_id
     WHERE d.deleted_at IS NULL AND d.status <> 'VOID' AND p.paid_on >= ? AND p.paid_on <= ? GROUP BY d.currency`,
    [monthStart, today],
  );
  const toMap = (rows: typeof open.rows, key: string): MoneyByCurrency =>
    Object.fromEntries(
      rows
        .filter(r => Number(r[key]) !== 0)
        .map(r => [reqStr(r.currency), Number(r[key])]),
    );
  return {
    outstanding: toMap(open.rows, 'outstanding'),
    overdue: toMap(open.rows, 'overdue'),
    paidThisMonth: toMap(paid.rows, 'amount'),
  };
}

/** Statement of account for a client in one currency. */
export async function clientStatement(
  db: Executor,
  opts: { clientId: string; currency: string; from: ISODate; to: ISODate },
): Promise<Statement> {
  const docs = await db.execute(
    `SELECT id, number, doc_type, issue_date, due_date, total_minor FROM documents
     WHERE client_id = ? AND currency = ? AND doc_type IN ('INVOICE','CREDIT_NOTE')
       AND status NOT IN ('DRAFT','VOID') AND deleted_at IS NULL`,
    [opts.clientId, opts.currency],
  );
  const payments = await db.execute(
    `SELECT p.id, p.document_id, p.paid_on, p.amount_minor FROM payments p JOIN documents d ON d.id = p.document_id
     WHERE d.client_id = ? AND d.currency = ? AND d.status <> 'VOID' AND d.deleted_at IS NULL`,
    [opts.clientId, opts.currency],
  );
  return buildStatement({
    documents: docs.rows.map(r => ({
      id: reqStr(r.id),
      number: str(r.number) ?? '',
      kind: reqStr(r.doc_type) as 'INVOICE' | 'CREDIT_NOTE',
      date: reqStr(r.issue_date),
      dueDate: str(r.due_date),
      amount: reqNum(r.total_minor),
    })),
    payments: payments.rows.map(r => ({
      id: reqStr(r.id),
      documentId: reqStr(r.document_id),
      date: reqStr(r.paid_on),
      amount: reqNum(r.amount_minor),
    })),
    from: opts.from,
    to: opts.to,
  });
}
