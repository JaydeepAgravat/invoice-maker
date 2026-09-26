/**
 * Minimal async database interface. Repositories depend only on this, so the
 * same SQL runs on op-sqlite in the app and on Node's built-in SQLite in tests.
 */

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export type ExecResult = {
  rows: Row[];
  rowsAffected: number;
  insertId?: number;
};

export interface Executor {
  execute(sql: string, params?: readonly SqlValue[]): Promise<ExecResult>;
}

export interface Database extends Executor {
  /** Runs `fn` in a transaction; rolls back if it throws. Transactions are serialized. */
  transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>;
  close(): void;
}

/** Typed row helpers: SQLite gives back loose scalars. */
export const str = (v: SqlValue | undefined): string | null =>
  v === null || v === undefined ? null : String(v);
export const num = (v: SqlValue | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
export const bool = (v: SqlValue | undefined): boolean => v === 1 || v === '1';
export const reqStr = (v: SqlValue | undefined): string => {
  if (v === null || v === undefined) {
    throw new Error('Expected a non-null string column');
  }
  return String(v);
};
export const reqNum = (v: SqlValue | undefined): number => {
  if (v === null || v === undefined) {
    throw new Error('Expected a non-null numeric column');
  }
  return Number(v);
};
