import { openNodeDatabase } from '../db/node';
import { LATEST_VERSION, migrate, type Migration } from '../migrations';
import { uuidv7 } from '../ids';

describe('migrate', () => {
  it('creates the schema once and is idempotent', async () => {
    const db = openNodeDatabase();
    expect(await migrate(db)).toEqual([1, 2]);
    expect(await migrate(db)).toEqual([]);
    const { rows } = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const tables = rows.map(r => r.name);
    for (const t of [
      'documents',
      'document_lines',
      'payments',
      'clients',
      'items',
      'tax_rates',
      'documents_fts',
    ]) {
      expect(tables).toContain(t);
    }
    const profile = await db.execute(
      'SELECT id, currency FROM business_profile',
    );
    expect(profile.rows).toEqual([{ id: 1, currency: 'USD' }]);
    db.close();
  });

  it('applies later migrations in order', async () => {
    const db = openNodeDatabase();
    const extra: Migration[] = [
      { version: 1, name: 'a', statements: ['CREATE TABLE a (x INTEGER)'] },
      {
        version: 2,
        name: 'b',
        statements: ['ALTER TABLE a ADD COLUMN y INTEGER'],
      },
    ];
    expect(await migrate(db, extra.slice(0, 1))).toEqual([1]);
    expect(await migrate(db, extra)).toEqual([2]);
    db.close();
  });

  it('rolls back a failing migration', async () => {
    const db = openNodeDatabase();
    const bad: Migration[] = [
      {
        version: 1,
        name: 'bad',
        statements: ['CREATE TABLE ok (x)', 'NOT SQL'],
      },
    ];
    await expect(migrate(db, bad)).rejects.toThrow();
    const { rows } = await db.execute(
      "SELECT name FROM sqlite_master WHERE name = 'ok'",
    );
    expect(rows).toHaveLength(0);
    db.close();
  });

  it('refuses databases from a newer app', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await db.execute('INSERT INTO schema_migrations VALUES (?, ?, ?)', [
      LATEST_VERSION + 1,
      'future',
      0,
    ]);
    await expect(migrate(db)).rejects.toThrow(/newer/);
    db.close();
  });

  it('handles an empty migration list', async () => {
    const db = openNodeDatabase();
    expect(await migrate(db, [])).toEqual([]);
    db.close();
  });
});

describe('uuidv7', () => {
  it('is well-formed and time ordered', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a < b).toBe(true);
  });

  it('stays ordered within one millisecond', () => {
    const ids = Array.from({ length: 50 }, () => uuidv7(1_800_000_000_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
  });

  it('falls back to Math.random without Web Crypto', () => {
    const original = (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(uuidv7()).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: original,
        configurable: true,
      });
    }
  });
});
