import { systemClock } from './clock';
import { openAppDatabase } from './db/opsqlite';
import type { Database } from './db/types';
import { migrate } from './migrations';
import { purgeDeleted, purgeEmptyDrafts } from './repositories/documents';

let ready: Promise<Database> | null = null;

/**
 * The app's single database connection, opened and migrated once.
 * WAL keeps reads fast while a write is in progress.
 */
export function getDatabase(): Promise<Database> {
  if (!ready) {
    ready = (async () => {
      const db = openAppDatabase();
      await db.execute('PRAGMA journal_mode = WAL');
      await db.execute('PRAGMA synchronous = NORMAL');
      await migrate(db);
      await purgeEmptyDrafts(db, systemClock);
      await purgeDeleted(db, systemClock);
      return db;
    })();
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

export const clock = systemClock;
