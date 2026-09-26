/* Test/tooling adapter over Node's built-in SQLite. Never bundled into the app. */
import type { Database, ExecResult, Executor, Row, SqlValue } from './types';

type NodeStatement = {
  all(...params: SqlValue[]): unknown[];
  run(...params: SqlValue[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  columns(): unknown[];
};
type NodeDb = {
  prepare(sql: string): NodeStatement;
  exec(sql: string): void;
  close(): void;
};

export function openNodeDatabase(path = ':memory:'): Database {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (p: string) => NodeDb;
  };
  const db = new DatabaseSync(path);

  const execute = async (
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<ExecResult> => {
    const stmt = db.prepare(sql);
    if (stmt.columns().length > 0) {
      return { rows: stmt.all(...params) as Row[], rowsAffected: 0 };
    }
    const r = stmt.run(...params);
    return {
      rows: [],
      rowsAffected: Number(r.changes),
      insertId: Number(r.lastInsertRowid),
    };
  };

  let queue: Promise<unknown> = Promise.resolve();

  return {
    execute,
    transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
      const run = async () => {
        db.exec('BEGIN');
        try {
          const result = await fn({ execute });
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
    close: () => db.close(),
  };
}
