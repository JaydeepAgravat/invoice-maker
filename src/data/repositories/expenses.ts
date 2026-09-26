import type { ISODate } from '@/domain/dates';

import type { Clock } from '../clock';
import { num, reqNum, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

export type Expense = {
  id: string;
  date: ISODate;
  vendor: string | null;
  category: string;
  amount: number;
  tax: number;
  currency: string;
  clientId: string | null;
  note: string | null;
  receiptPath: string | null;
  createdAt: number;
};

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

const map = (r: Row): Expense => ({
  id: reqStr(r.id),
  date: reqStr(r.date),
  vendor: str(r.vendor),
  category: str(r.category) ?? 'OTHER',
  amount: reqNum(r.amount_minor),
  tax: num(r.tax_minor) ?? 0,
  currency: reqStr(r.currency),
  clientId: str(r.client_id),
  note: str(r.note),
  receiptPath: str(r.receipt_path),
  createdAt: reqNum(r.created_at),
});

const values = (e: ExpenseInput) => [
  e.date,
  e.vendor?.trim() || null,
  e.category,
  e.amount,
  e.tax,
  e.currency,
  e.clientId,
  e.note?.trim() || null,
  e.receiptPath,
];

export async function listExpenses(
  db: Executor,
  opts: { from?: ISODate; to?: ISODate; query?: string } = {},
): Promise<Expense[]> {
  const where = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (opts.from) {
    where.push('date >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    where.push('date <= ?');
    params.push(opts.to);
  }
  if (opts.query?.trim()) {
    where.push("(vendor LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')");
    const q = `%${opts.query.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`;
    params.push(q, q);
  }
  const { rows } = await db.execute(
    `SELECT * FROM expenses WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC`,
    params,
  );
  return rows.map(map);
}

export async function getExpense(
  db: Executor,
  id: string,
): Promise<Expense | null> {
  const { rows } = await db.execute('SELECT * FROM expenses WHERE id = ?', [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function createExpense(
  db: Executor,
  clock: Clock,
  input: ExpenseInput,
): Promise<Expense> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new RangeError('Expense amount must be positive');
  }
  const now = clock.now();
  const id = uuidv7(now);
  await db.execute(
    `INSERT INTO expenses (date, vendor, category, amount_minor, tax_minor, currency, client_id, note, receipt_path,
       id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values(input), id, now, now],
  );
  return (await getExpense(db, id))!;
}

export async function updateExpense(
  db: Executor,
  clock: Clock,
  id: string,
  input: ExpenseInput,
): Promise<Expense> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new RangeError('Expense amount must be positive');
  }
  await db.execute(
    `UPDATE expenses SET date = ?, vendor = ?, category = ?, amount_minor = ?, tax_minor = ?, currency = ?,
       client_id = ?, note = ?, receipt_path = ?, updated_at = ? WHERE id = ?`,
    [...values(input), clock.now(), id],
  );
  return (await getExpense(db, id))!;
}

export const deleteExpense = (db: Executor, clock: Clock, id: string) =>
  db.execute('UPDATE expenses SET deleted_at = ? WHERE id = ?', [clock.now(), id]);

export const restoreExpense = (db: Executor, id: string) =>
  db.execute('UPDATE expenses SET deleted_at = NULL WHERE id = ?', [id]);

/** Vendors used before, most recent first, for one-tap entry. */
export async function recentVendors(db: Executor, limit = 8): Promise<string[]> {
  const { rows } = await db.execute(
    `SELECT vendor FROM expenses WHERE deleted_at IS NULL AND vendor IS NOT NULL
     GROUP BY vendor COLLATE NOCASE ORDER BY MAX(created_at) DESC LIMIT ?`,
    [limit],
  );
  return rows.map(r => reqStr(r.vendor));
}
