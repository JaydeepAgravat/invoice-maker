import { open, type DB } from '@op-engineering/op-sqlite';

import type { Database, ExecResult, Executor, Row, SqlValue } from './types';

const wrap = async (
  db: Pick<DB, 'execute'>,
  sql: string,
  params?: readonly SqlValue[],
): Promise<ExecResult> => {
  const r = await db.execute(sql, params ? [...params] : undefined);
  return {
    rows: r.rows as Row[],
    rowsAffected: r.rowsAffected,
    insertId: r.insertId,
  };
};

/** Opens the app database (op-sqlite, JSI). */
export function openAppDatabase(name = 'invoice.db'): Database {
  const db = open({ name });
  return {
    execute: (sql, params) => wrap(db, sql, params),
    async transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await db.transaction(async tx => {
        result = await fn({ execute: (sql, params) => wrap(tx, sql, params) });
      });
      return result as T;
    },
    close: () => db.close(),
  };
}
