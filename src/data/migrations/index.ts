import type { Database } from '../db/types';

import { migration001 } from './001_initial';
import { migration002 } from './002_money';
import { migration003 } from './003_recurring';

export type Migration = {
  version: number;
  name: string;
  statements: readonly string[];
};

/** Forward-only. Never edit a released migration; add a new one. */
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'initial', statements: migration001 },
  { version: 2, name: 'money', statements: migration002 },
  { version: 3, name: 'recurring', statements: migration003 },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/**
 * Applies pending migrations, each in its own transaction, and returns the
 * versions applied. A database from a newer app version is refused rather
 * than silently misread.
 */
export async function migrate(
  db: Database,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number[]> {
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  const { rows } = await db.execute(
    'SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations',
  );
  const current = Number(rows[0]?.v ?? 0);
  const latest = migrations[migrations.length - 1]?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `Database version ${current} is newer than this app supports (${latest})`,
    );
  }

  const applied: number[] = [];
  for (const m of migrations.filter(x => x.version > current)) {
    await db.transaction(async tx => {
      for (const sql of m.statements) {
        await tx.execute(sql);
      }
      await tx.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [m.version, m.name, Date.now()],
      );
    });
    applied.push(m.version);
  }
  return applied;
}
