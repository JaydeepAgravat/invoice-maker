import { listClients } from '../repositories/clients';
import { importClients, importItems, undoImport } from '../repositories/imports';
import { listItems } from '../repositories/items';

import { setupDb } from './helpers';

const client = (name: string, email: string | null = null) => ({
  name,
  company: null,
  email,
  phone: null,
  billingAddress: null,
  taxId: null,
  notes: null,
  isBusiness: false,
});

describe('imports', () => {
  it('adds clients once and can undo', async () => {
    const { db, clock } = await setupDb();
    const first = await importClients(db, clock, [client('Ana', 'a@x.co'), client('Ana', 'a@x.co'), client('Ben')]);
    expect(first).toMatchObject({ duplicates: 1, invalid: 0 });
    expect(first.created).toHaveLength(2);
    const again = await importClients(db, clock, [client('ANA', 'A@x.co'), client('Cy')]);
    expect(again.duplicates).toBe(1);
    expect((await listClients(db)).map(c => c.name).sort()).toEqual(['Ana', 'Ben', 'Cy']);
    await undoImport(db, clock, 'clients', again.created);
    expect(await listClients(db)).toHaveLength(2);
  });

  it('adds items with parsed prices and known units', async () => {
    const { db, clock } = await setupDb();
    const r = await importItems(
      db,
      clock,
      [
        { name: 'Labour', description: null, priceText: '45.50', unit: 'HR', sku: null },
        { name: 'labour', description: null, priceText: '1', unit: null, sku: null },
        { name: 'Bad', description: null, priceText: 'abc', unit: null, sku: null },
        { name: 'Pipe', description: 'Copper', priceText: null, unit: 'lengths', sku: 'P1' },
      ],
      { currency: 'GBP', locale: 'en-GB' },
    );
    expect(r).toMatchObject({ duplicates: 1, invalid: 1 });
    const items = await listItems(db);
    const labour = items.find(i => i.name === 'Labour')!;
    expect([labour.unitPrice, labour.unit]).toEqual([4550, 'hr']);
    expect(items.find(i => i.name === 'Pipe')).toMatchObject({ unitPrice: 0, unit: 'lengths', sku: 'P1' });
    await undoImport(db, clock, 'items', r.created);
    expect(await listItems(db)).toHaveLength(0);
  });
});
