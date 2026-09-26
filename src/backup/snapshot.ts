import type { Database, Executor, Row, SqlValue } from '@/data/db/types';
import { LATEST_VERSION } from '@/data/migrations';
import { rebuildSearchIndex } from '@/data/repositories/documents';

/**
 * Backup format: every table as rows, plus the private files they point to.
 * File paths are stored relative to the app's files folder (`@files/…`), so
 * a backup restores on another phone or after a reinstall.
 */

export const BACKUP_FORMAT = 'invoice-backup';
export const BACKUP_VERSION = 1;
export const FILES_TOKEN = '@files/';

/** Parents before children, so inserts satisfy foreign keys. */
export const BACKUP_TABLES = [
  'app_meta',
  'business_profile',
  'payment_methods',
  'clients',
  'client_emails',
  'tax_rates',
  'items',
  'item_taxes',
  'number_sequences',
  'documents',
  'document_lines',
  'document_line_taxes',
  'payments',
  'attachments',
  'activity_log',
  'document_revisions',
  'share_log',
  'expenses',
  'mileage',
  'recurring_schedules',
] as const;

export type TableName = (typeof BACKUP_TABLES)[number];

export type Snapshot = {
  format: typeof BACKUP_FORMAT;
  version: number;
  schema: number;
  createdAt: number;
  app: string;
  tables: Partial<Record<TableName, { columns: string[]; rows: SqlValue[][] }>>;
  /** Relative paths (under the files folder) to pack next to the JSON. */
  files: string[];
};

export type SnapshotSummary = {
  createdAt: number;
  businessName: string | null;
  documents: number;
  clients: number;
  items: number;
  expenses: number;
  trips: number;
  files: number;
  firstDate: string | null;
  lastDate: string | null;
};

export class BackupError extends Error {
  constructor(
    readonly code: 'NOT_A_BACKUP' | 'TOO_NEW' | 'CORRUPT',
    message: string = code,
  ) {
    super(message);
  }
}

const relativize = (v: SqlValue, filesDir: string): SqlValue =>
  typeof v === 'string' && v.includes(filesDir)
    ? v.split(filesDir.endsWith('/') ? filesDir : `${filesDir}/`).join(FILES_TOKEN)
    : v;

const absolutize = (v: SqlValue, filesDir: string): SqlValue =>
  typeof v === 'string' && v.includes(FILES_TOKEN)
    ? v.split(FILES_TOKEN).join(filesDir.endsWith('/') ? filesDir : `${filesDir}/`)
    : v;

export async function createSnapshot(
  db: Executor,
  opts: { filesDir: string; app: string; now: number },
): Promise<Snapshot> {
  const tables: Snapshot['tables'] = {};
  const files = new Set<string>();
  for (const name of BACKUP_TABLES) {
    const { rows } = await db.execute(`SELECT * FROM ${name}`);
    const columns = rows[0] ? Object.keys(rows[0]) : await columnsOf(db, name);
    tables[name] = {
      columns,
      rows: rows.map(r =>
        columns.map(c => {
          const v = relativize(r[c] ?? null, opts.filesDir);
          if (typeof v === 'string') {
            for (const m of v.matchAll(/@files\/([^"\s]+)/g)) {
              files.add(m[1]!);
            }
          }
          return v;
        }),
      ),
    };
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schema: LATEST_VERSION,
    createdAt: opts.now,
    app: opts.app,
    tables,
    files: [...files].sort(),
  };
}

const columnsOf = async (db: Executor, table: string) =>
  (await db.execute(`PRAGMA table_info(${table})`)).rows.map(r => String(r.name));

/** Validate a parsed backup before touching anything. */
export function readSnapshot(json: string): Snapshot {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupError('CORRUPT');
  }
  const s = data as Partial<Snapshot> | null;
  if (!s || s.format !== BACKUP_FORMAT || typeof s.tables !== 'object' || !s.tables) {
    throw new BackupError('NOT_A_BACKUP');
  }
  if ((s.version ?? 0) > BACKUP_VERSION || (s.schema ?? 0) > LATEST_VERSION) {
    throw new BackupError('TOO_NEW');
  }
  return s as Snapshot;
}

export function summarize(s: Snapshot): SnapshotSummary {
  const t = (name: TableName) => s.tables[name];
  const count = (name: TableName, where?: (row: Record<string, SqlValue>) => boolean) => {
    const table = t(name);
    if (!table) {
      return 0;
    }
    return table.rows
      .map(r => Object.fromEntries(table.columns.map((c, i) => [c, r[i] ?? null])))
      .filter(r => r.deleted_at === null || r.deleted_at === undefined)
      .filter(r => (where ? where(r) : true)).length;
  };
  const docs = t('documents');
  const dates = docs
    ? docs.rows
        .map(r => r[docs.columns.indexOf('issue_date')])
        .filter((d): d is string => typeof d === 'string')
        .sort()
    : [];
  const profile = t('business_profile');
  const name = profile?.rows[0]?.[profile.columns.indexOf('name')];
  return {
    createdAt: s.createdAt,
    businessName: typeof name === 'string' ? name : null,
    documents: count('documents', r => r.status !== 'DRAFT'),
    clients: count('clients'),
    items: count('items'),
    expenses: count('expenses'),
    trips: count('mileage'),
    files: s.files.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/**
 * Restore a backup in one transaction.
 *   replace  everything is wiped and replaced (exact copy of the backup)
 *   merge    records are added when their id is new; nothing is overwritten,
 *            the business profile is kept and number counters never go back
 */
export async function restoreSnapshot(
  db: Database,
  s: Snapshot,
  opts: { mode: 'replace' | 'merge'; filesDir: string },
): Promise<{ inserted: number }> {
  let inserted = 0;
  await db.transaction(async tx => {
    await tx.execute('PRAGMA defer_foreign_keys = ON');
    if (opts.mode === 'replace') {
      for (const name of [...BACKUP_TABLES].reverse()) {
        await tx.execute(`DELETE FROM ${name}`);
      }
    }
    for (const name of BACKUP_TABLES) {
      const table = s.tables[name];
      if (!table || table.rows.length === 0) {
        continue;
      }
      // Only columns this schema knows: older backups simply miss newer ones.
      const known = new Set(await columnsOf(tx, name));
      const cols = table.columns.filter(c => known.has(c));
      const idx = cols.map(c => table.columns.indexOf(c));
      const placeholders = cols.map(() => '?').join(', ');
      const merge = opts.mode === 'merge';
      const verb =
        merge && (name === 'business_profile' || name === 'app_meta')
          ? null
          : merge && name === 'number_sequences'
          ? 'SEQ'
          : merge
          ? 'INSERT OR IGNORE'
          : name === 'business_profile'
          ? 'INSERT OR REPLACE'
          : 'INSERT';
      if (!verb) {
        continue;
      }
      for (const row of table.rows) {
        const values = idx.map(i => absolutize(row[i] ?? null, opts.filesDir));
        if (verb === 'SEQ') {
          await tx.execute(
            `INSERT INTO number_sequences (${cols.join(', ')}) VALUES (${placeholders})
             ON CONFLICT(key) DO UPDATE SET next_value = MAX(next_value, excluded.next_value)`,
            values,
          );
          inserted++;
          continue;
        }
        const r = await tx.execute(
          `${verb} INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`,
          values,
        );
        inserted += r.rowsAffected;
      }
    }
    const fk = await tx.execute('PRAGMA foreign_key_check');
    if (fk.rows.length) {
      throw new BackupError('CORRUPT', `Broken references in ${String(fk.rows[0]!.table)}`);
    }
    await rebuildSearchIndex(tx);
  });
  return { inserted };
}

/**
 * Stable fingerprint of all data (row order and file locations aside), used
 * to prove a restore gives back exactly what was backed up.
 */
export async function fingerprint(db: Executor, filesDir: string): Promise<string> {
  const parts: string[] = [];
  for (const name of BACKUP_TABLES) {
    const { rows } = await db.execute(`SELECT * FROM ${name}`);
    const lines = rows
      .map((r: Row) =>
        JSON.stringify(
          Object.keys(r)
            .sort()
            .map(k => [k, relativize(r[k] ?? null, filesDir)]),
        ),
      )
      .sort();
    parts.push(`${name}:${lines.join('|')}`);
  }
  return fnv1a(parts.join('\n'));
}

/* eslint-disable no-bitwise -- 64-bit FNV-1a over two 32-bit halves */
const fnv1a = (s: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193 ^ 0x100) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
};
/* eslint-enable no-bitwise */
