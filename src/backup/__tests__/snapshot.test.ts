import { setupDb } from '@/data/__tests__/helpers';
import { openNodeDatabase } from '@/data/db/node';
import { migrate } from '@/data/migrations';
import { addPhoto } from '@/data/repositories/attachments';
import { createClient, listClients } from '@/data/repositories/clients';
import {
  createDraft,
  issueDocument,
  recordPayment,
  saveDocument,
  toDraft,
} from '@/data/repositories/documents';
import { createExpense } from '@/data/repositories/expenses';
import { listDocuments } from '@/data/repositories/inbox';
import { seedSampleData } from '@/data/seed';
import { getProfile, updateProfile } from '@/data/repositories/profile';

import {
  BackupError,
  createSnapshot,
  fingerprint,
  readSnapshot,
  restoreSnapshot,
  summarize,
} from '../snapshot';

const OLD_DIR = '/data/user/0/com.invoiceapp.dev/files';
const NEW_DIR = '/data/user/10/com.invoiceapp.dev/files';

async function sample() {
  const { db, clock } = await setupDb();
  await updateProfile(db, clock, {
    name: 'Smith Plumbing',
    logoPath: `${OLD_DIR}/logos/logo.png`,
  });
  const client = await createClient(db, clock, { name: 'Acme Ltd', emails: ['a@acme.co'] });
  const draft = await createDraft(db, clock, 'INVOICE', { clientId: client.id });
  await saveDocument(db, clock, {
    ...toDraft(draft),
    lines: [{ name: 'Boiler service', quantity: 1000, unitPrice: 12000, taxes: [] }],
  });
  const inv = await issueDocument(db, clock, draft.id);
  await recordPayment(db, clock, inv.id, { amount: 5000, paidOn: '2026-09-20' });
  await addPhoto(db, clock, inv.id, { path: `${OLD_DIR}/photos/p1.jpg` });
  await createExpense(db, clock, {
    date: '2026-09-10',
    vendor: 'Screwfix',
    category: 'MATERIALS',
    amount: 999,
    tax: 0,
    currency: 'GBP',
    clientId: null,
    note: null,
    receiptPath: `${OLD_DIR}/receipts/r1.jpg`,
  });
  return { db, clock, inv };
}

describe('backup snapshot', () => {
  it('round-trips every row and moves file paths to the new install', async () => {
    const { db } = await sample();
    const snap = await createSnapshot(db, { filesDir: OLD_DIR, app: 'test', now: 1 });
    expect(snap.files).toEqual(['logos/logo.png', 'photos/p1.jpg', 'receipts/r1.jpg']);
    const json = JSON.stringify(snap);
    expect(json).not.toContain(OLD_DIR);

    const fresh = openNodeDatabase();
    await migrate(fresh);
    await restoreSnapshot(fresh, readSnapshot(json), { mode: 'replace', filesDir: NEW_DIR });
    expect(await fingerprint(fresh, NEW_DIR)).toBe(await fingerprint(db, OLD_DIR));
    expect((await getProfile(fresh)).logoPath).toBe(`${NEW_DIR}/logos/logo.png`);
    // Search works after restore.
    const found = await listDocuments(fresh, { view: 'all', today: '2026-09-26', search: 'boiler' });
    expect(found).toHaveLength(1);
  });

  it('summarizes what a backup contains', async () => {
    const { db } = await sample();
    const s = summarize(await createSnapshot(db, { filesDir: OLD_DIR, app: 'test', now: 42 }));
    expect(s).toMatchObject({
      createdAt: 42,
      businessName: 'Smith Plumbing',
      documents: 1,
      clients: 1,
      expenses: 1,
      trips: 0,
      files: 3,
      firstDate: '2026-09-26',
    });
  });

  it('merges without overwriting, keeping the profile and the higher counter', async () => {
    const { db } = await sample();
    const snap = await createSnapshot(db, { filesDir: OLD_DIR, app: 'test', now: 1 });

    const other = await setupDb();
    await updateProfile(other.db, other.clock, { name: 'Other Business' });
    await createClient(other.db, other.clock, { name: 'Zed' });
    await other.db.execute("UPDATE number_sequences SET next_value = 9 WHERE key = 'INVOICE'");
    await restoreSnapshot(other.db, snap, { mode: 'merge', filesDir: NEW_DIR });
    // Merging twice is harmless.
    await restoreSnapshot(other.db, snap, { mode: 'merge', filesDir: NEW_DIR });

    expect((await listClients(other.db)).map(c => c.name).sort()).toEqual(['Acme Ltd', 'Zed']);
    expect((await getProfile(other.db)).name).toBe('Other Business');
    const seq = await other.db.execute("SELECT next_value FROM number_sequences WHERE key = 'INVOICE'");
    expect(seq.rows[0]!.next_value).toBe(9);
  });

  it('refuses files that are not backups or come from a newer app', () => {
    expect(() => readSnapshot('nope')).toThrow(BackupError);
    expect(() => readSnapshot('{"format":"x"}')).toThrow('NOT_A_BACKUP');
    expect(() => readSnapshot('null')).toThrow('NOT_A_BACKUP');
    expect(() =>
      readSnapshot(JSON.stringify({ format: 'invoice-backup', version: 99, schema: 1, tables: {} })),
    ).toThrow('TOO_NEW');
  });

  it('rolls back a restore with broken references', async () => {
    const { db } = await sample();
    const snap = await createSnapshot(db, { filesDir: OLD_DIR, app: 'test', now: 1 });
    delete snap.tables.clients;
    delete snap.tables.client_emails;
    const fresh = openNodeDatabase();
    await migrate(fresh);
    await fresh.execute('PRAGMA foreign_keys = ON');
    await expect(
      restoreSnapshot(fresh, snap, { mode: 'replace', filesDir: NEW_DIR }),
    ).rejects.toThrow(BackupError);
    expect((await fresh.execute('SELECT COUNT(*) AS n FROM documents')).rows[0]!.n).toBe(0);
  });
});

describe('backup at scale', () => {
  it('backs up and restores 1,000 documents quickly', async () => {
    const { db, clock } = await setupDb();
    await seedSampleData(db, clock, { documents: 1000 });
    const t0 = Date.now();
    const snap = await createSnapshot(db, { filesDir: OLD_DIR, app: 'test', now: 1 });
    const json = JSON.stringify(snap);
    const fresh = openNodeDatabase();
    await migrate(fresh);
    await restoreSnapshot(fresh, readSnapshot(json), { mode: 'replace', filesDir: NEW_DIR });
    const ms = Date.now() - t0;
    expect(await fingerprint(fresh, NEW_DIR)).toBe(await fingerprint(db, OLD_DIR));
    expect(ms).toBeLessThan(10_000);
  }, 60_000);
});
