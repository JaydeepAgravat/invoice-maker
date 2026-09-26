import type { Database } from '../db/types';
import {
  clientBalances,
  createClient,
  deleteClient,
  getClient,
  listClients,
  restoreClient,
  updateClient,
} from '../repositories/clients';
import {
  createDraft,
  issueDocument,
  recordPayment,
  saveDocument,
  toDraft,
} from '../repositories/documents';
import {
  createItem,
  deleteItem,
  deleteItems,
  getItem,
  listItems,
  restoreItem,
  updateItem,
} from '../repositories/items';
import {
  applyCountryPreset,
  getProfile,
  markOnboarded,
  profileExists,
  updateProfile,
} from '../repositories/profile';
import {
  assignNumber,
  getSequence,
  NumberingError,
  previewNumber,
  updateSequence,
} from '../repositories/sequences';
import {
  createTaxRate,
  defaultTaxRates,
  getTaxRates,
  listTaxRates,
  toTaxInput,
  updateTaxRate,
} from '../repositories/taxRates';

import { setupDb, TestClock } from './helpers';

let db: Database;
let clock: TestClock;

afterEach(() => db.close());

describe('profile and presets', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('DE')));

  it('applies the country preset', async () => {
    const p = await getProfile(db);
    expect(p).toMatchObject({
      country: 'DE',
      currency: 'EUR',
      locale: 'de-DE',
      paperSize: 'A4',
      measurement: 'METRIC',
      taxIdLabel: 'USt-IdNr.',
      numberingStyle: 'YEARLY',
      defaultTermsDays: 14,
      isTaxRegistered: true,
      pricesIncludeTax: false,
    });
    expect((await listTaxRates(db)).map(t => t.rate)).toEqual([
      190_000, 70_000, 0,
    ]);
    expect((await getSequence(db, 'INVOICE')).prefix).toBe('INV');
  });

  it('is idempotent and restores archived preset taxes', async () => {
    const [first] = await listTaxRates(db);
    await updateTaxRate(db, clock, first!.id, { archived: true });
    await applyCountryPreset(db, clock, { country: 'DE', language: 'de' });
    const rates = await listTaxRates(db);
    expect(rates).toHaveLength(3);
    expect(rates.every(r => !r.archived)).toBe(true);
    expect((await getSequence(db, 'INVOICE')).prefix).toBe('INV');
  });

  it('uses localized prefixes on first setup', async () => {
    db.close();
    ({ db, clock } = await setupDb('FR'));
    await db.execute('DELETE FROM number_sequences');
    await applyCountryPreset(db, clock, {
      country: 'FR',
      language: 'fr',
      locale: 'fr-BE',
    });
    expect((await getSequence(db, 'INVOICE')).prefix).toBe('FAC');
    expect((await getProfile(db)).locale).toBe('fr-BE');
  });

  it('seeds regional taxes', async () => {
    db.close();
    ({ db, clock } = await setupDb('CA', 'QC'));
    expect((await defaultTaxRates(db)).map(t => t.name)).toEqual([
      'GST',
      'QST',
    ]);
  });

  it('updates fields and ignores empty patches', async () => {
    await updateProfile(db, clock, {});
    await updateProfile(db, clock, {
      name: 'Muster GmbH',
      isTaxRegistered: false,
      accentColor: null,
    });
    const p = await getProfile(db);
    expect(p.name).toBe('Muster GmbH');
    expect(p.isTaxRegistered).toBe(false);
  });

  it('tracks onboarding', async () => {
    expect(await profileExists(db)).toBe(false);
    await markOnboarded(db);
    await markOnboarded(db);
    expect(await profileExists(db)).toBe(true);
  });
});

describe('tax rates', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('US')));

  it('creates, updates, archives and resolves rates', async () => {
    const t = await createTaxRate(db, clock, {
      name: ' Austin sales tax ',
      rate: 82_500,
      isDefault: true,
    });
    expect(t).toMatchObject({
      name: 'Austin sales tax',
      rate: 82_500,
      kind: 'STANDARD',
      isDefault: true,
      position: 0,
    });
    const second = await createTaxRate(db, clock, {
      name: 'Withheld',
      rate: 10_000,
      kind: 'WITHHOLDING',
    });
    expect(second.position).toBe(1);
    await updateTaxRate(db, clock, t.id, { archived: true });
    expect(await listTaxRates(db)).toHaveLength(1);
    expect(await listTaxRates(db, { includeArchived: true })).toHaveLength(2);
    expect(
      (await getTaxRates(db, [second.id, 'nope', t.id])).map(x => x.id),
    ).toEqual([second.id, t.id]);
    expect(await getTaxRates(db, [])).toEqual([]);
    expect(toTaxInput(t)).toEqual({
      id: t.id,
      name: 'Austin sales tax',
      rate: 82_500,
      kind: 'STANDARD',
    });
  });

  it('validates rates and ids', async () => {
    await expect(
      createTaxRate(db, clock, { name: 'x', rate: 1_000_000 }),
    ).rejects.toThrow(RangeError);
    await expect(
      createTaxRate(db, clock, { name: 'x', rate: -1 }),
    ).rejects.toThrow(RangeError);
    await expect(
      createTaxRate(db, clock, { name: 'x', rate: 1.5 }),
    ).rejects.toThrow(RangeError);
    await expect(
      updateTaxRate(db, clock, 'nope', { name: 'y' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('numbering sequences', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('GB')));

  it('previews without consuming and assigns atomically', async () => {
    expect(await previewNumber(db, 'INVOICE', '2026-09-26')).toBe('INV-0001');
    expect(await previewNumber(db, 'INVOICE', '2026-09-26')).toBe('INV-0001');
    expect((await assignNumber(db, 'INVOICE', '2026-09-26')).number).toBe(
      'INV-0001',
    );
    expect(await previewNumber(db, 'INVOICE', '2026-09-26')).toBe('INV-0002');
  });

  it('restarts yearly counters each year', async () => {
    await updateSequence(
      db,
      'INVOICE',
      { style: 'YEARLY', prefix: 'R', pad: 3 },
      2026,
    );
    expect((await assignNumber(db, 'INVOICE', '2026-12-31')).number).toBe(
      'R-2026-001',
    );
    expect((await assignNumber(db, 'INVOICE', '2026-12-31')).number).toBe(
      'R-2026-002',
    );
    expect((await assignNumber(db, 'INVOICE', '2027-01-01')).number).toBe(
      'R-2027-001',
    );
  });

  it('lets users continue numbering from another app, never below issued numbers', async () => {
    await updateSequence(db, 'INVOICE', { nextValue: 250 }, 2026);
    const d = await createDraft(db, clock, 'INVOICE');
    expect((await issueDocument(db, clock, d.id)).number).toBe('INV-0250');
    await expect(
      updateSequence(db, 'INVOICE', { nextValue: 250 }, 2026),
    ).rejects.toBeInstanceOf(NumberingError);
    await expect(
      updateSequence(db, 'INVOICE', { nextValue: 0 }, 2026),
    ).rejects.toThrow('NEXT_NUMBER_INVALID');
    await updateSequence(db, 'INVOICE', { nextValue: 300 }, 2026);
    expect(await previewNumber(db, 'INVOICE', '2026-09-26')).toBe('INV-0300');
  });

  it('skips numbers already taken by imported documents', async () => {
    const d = await createDraft(db, clock, 'INVOICE');
    await db.execute("UPDATE documents SET number = 'INV-0001' WHERE id = ?", [
      d.id,
    ]);
    expect((await assignNumber(db, 'INVOICE', '2026-09-26')).number).toBe(
      'INV-0002',
    );
  });

  it('falls back to a default for unknown sequences and clamps padding', async () => {
    await db.execute("DELETE FROM number_sequences WHERE key = 'STATEMENT'");
    expect(await getSequence(db, 'STATEMENT')).toMatchObject({
      prefix: 'STA',
      pad: 4,
      nextValue: 1,
    });
    await updateSequence(db, 'STATEMENT', { pad: 99 }, 2026);
    expect((await getSequence(db, 'STATEMENT')).pad).toBe(10);
  });
});

describe('clients', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('GB')));

  it('creates with de-duplicated emails and updates', async () => {
    const c = await createClient(db, clock, {
      name: '  Acme Ltd ',
      company: ' ',
      isBusiness: true,
      emails: ['ap@acme.test', ' ap@acme.test', 'boss@acme.test', ''],
      billingAddress: '1 High St\nLondon',
    });
    expect(c).toMatchObject({
      name: 'Acme Ltd',
      company: null,
      isBusiness: true,
      kind: 'CLIENT',
    });
    expect(c.emails).toEqual(['ap@acme.test', 'boss@acme.test']);
    const u = await updateClient(db, clock, c.id, {
      name: 'Acme Group',
      emails: ['new@acme.test'],
    });
    expect(u.emails).toEqual(['new@acme.test']);
    const kept = await updateClient(db, clock, c.id, { name: 'Acme Group' });
    expect(kept.emails).toEqual(['new@acme.test']);
    await expect(createClient(db, clock, { name: '  ' })).rejects.toThrow(
      /required/,
    );
    expect(await getClient(db, 'missing')).toBeNull();
  });

  it('searches name, company and email; keeps suppliers separate', async () => {
    await createClient(db, clock, {
      name: 'Jordan Smith',
      company: 'Bloom 100%',
      emails: ['j@bloom.test'],
    });
    await createClient(db, clock, { name: 'Timber Supply', kind: 'SUPPLIER' });
    expect(
      (await listClients(db, { search: 'jord' })).map(c => c.name),
    ).toEqual(['Jordan Smith']);
    expect(await listClients(db, { search: '100%' })).toHaveLength(1);
    expect(await listClients(db, { search: '_' })).toHaveLength(0);
    expect(await listClients(db, { search: 'bloom.test' })).toHaveLength(1);
    expect(
      (await listClients(db, { kind: 'SUPPLIER' })).map(c => c.name),
    ).toEqual(['Timber Supply']);
    expect(await listClients(db)).toHaveLength(1);
  });

  it('soft-deletes and restores', async () => {
    const c = await createClient(db, clock, { name: 'Gone' });
    await deleteClient(db, clock, c.id);
    expect(await listClients(db)).toHaveLength(0);
    await restoreClient(db, c.id);
    expect(await listClients(db)).toHaveLength(1);
  });

  it('reports balances per currency', async () => {
    const c = await createClient(db, clock, { name: 'Payer' });
    const d = await createDraft(db, clock, 'INVOICE', { clientId: c.id });
    await saveDocument(db, clock, {
      ...toDraft(d),
      lines: [{ name: 'Work', quantity: 1000, unitPrice: 10000, taxes: [] }],
    });
    await issueDocument(db, clock, d.id);
    await recordPayment(db, clock, d.id, {
      amount: 4000,
      paidOn: '2026-09-26',
    });
    await createDraft(db, clock, 'INVOICE', { clientId: c.id });
    expect(await clientBalances(db, c.id)).toEqual({
      GBP: { billed: 10000, paid: 4000, outstanding: 6000, documents: 1 },
    });
  });
});

describe('items', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('GB')));

  it('creates, updates and ranks prefix matches first', async () => {
    const [vat] = await listTaxRates(db);
    await createItem(db, clock, {
      name: 'Wall tiling',
      description: null,
      unit: 'm2',
      unitPrice: 4500,
      sku: null,
      taxRateIds: [vat!.id, vat!.id],
    });
    const tap = await createItem(db, clock, {
      name: 'Tap replacement',
      description: 'Kitchen or bath',
      unit: 'item',
      unitPrice: 8000,
      sku: 'TAP-1',
      taxRateIds: [],
    });
    expect((await getItem(db, tap.id))!.sku).toBe('TAP-1');
    await createItem(db, clock, {
      name: 'Tiles (box)',
      description: null,
      unit: 'item',
      unitPrice: 2000,
      sku: null,
      taxRateIds: [],
    });
    await createItem(db, clock, {
      name: 'Anti-tiling coat',
      description: null,
      unit: 'l',
      unitPrice: 900,
      sku: null,
      taxRateIds: [],
    });
    // Prefix match first, then alphabetical substring matches.
    expect((await listItems(db, { search: 'til' })).map(i => i.name)).toEqual([
      'Tiles (box)',
      'Anti-tiling coat',
      'Wall tiling',
    ]);
    expect((await listItems(db, { search: 'bath' })).map(i => i.name)).toEqual([
      'Tap replacement',
    ]);
    expect(
      (await listItems(db)).find(i => i.name === 'Wall tiling')!.taxRateIds,
    ).toEqual([vat!.id]);
    const updated = await updateItem(db, clock, tap.id, {
      ...tap,
      unitPrice: 8500,
      taxRateIds: [vat!.id],
    });
    expect(updated).toMatchObject({ unitPrice: 8500, taxRateIds: [vat!.id] });
    await expect(createItem(db, clock, { ...tap, name: ' ' })).rejects.toThrow(
      /required/,
    );
    expect(await getItem(db, 'missing')).toBeNull();
  });

  it('deletes one or many and restores', async () => {
    const a = await createItem(db, clock, {
      name: 'A',
      description: null,
      unit: null,
      unitPrice: 1,
      sku: null,
      taxRateIds: [],
    });
    const b = await createItem(db, clock, {
      name: 'B',
      description: null,
      unit: null,
      unitPrice: 1,
      sku: null,
      taxRateIds: [],
    });
    const c = await createItem(db, clock, {
      name: 'C',
      description: null,
      unit: null,
      unitPrice: 1,
      sku: null,
      taxRateIds: [],
    });
    await deleteItem(db, clock, a.id);
    await deleteItems(db, clock, [b.id, c.id]);
    await deleteItems(db, clock, []);
    expect(await listItems(db)).toHaveLength(0);
    await restoreItem(db, a.id);
    expect((await listItems(db)).map(i => i.name)).toEqual(['A']);
  });
});

describe('transactions', () => {
  beforeEach(async () => ({ db, clock } = await setupDb('GB')));

  it('rolls back a failed save so no number is consumed', async () => {
    const d = await createDraft(db, clock, 'INVOICE');
    await expect(
      db.transaction(async tx => {
        await issueDocument(tx, clock, d.id);
        throw new Error('share sheet cancelled');
      }),
    ).rejects.toThrow('cancelled');
    expect(await previewNumber(db, 'INVOICE', '2026-09-26')).toBe('INV-0001');
  });

  it('serializes concurrent transactions', async () => {
    const drafts = await Promise.all(
      [1, 2, 3, 4, 5].map(() => createDraft(db, clock, 'INVOICE')),
    );
    const issued = await Promise.all(
      drafts.map(d =>
        db.transaction(tx => issueDocument(tx, new TestClock(), d.id)),
      ),
    );
    expect(issued.map(d => d.number).sort()).toEqual([
      'INV-0001',
      'INV-0002',
      'INV-0003',
      'INV-0004',
      'INV-0005',
    ]);
  });
});
