import type { ImportedClient, ImportedItem } from '@/domain/importMapping';
import { parseMoney } from '@/domain/money';
import { isKnownUnit } from '@/domain/units';

import type { Clock } from '../clock';
import { reqStr, str, type Executor } from '../db/types';

import { createClient } from './clients';
import { createItem } from './items';

export type ImportResult = { created: string[]; duplicates: number; invalid: number };

const key = (name: string, email: string | null) =>
  `${name.trim().toLowerCase()}|${(email ?? '').trim().toLowerCase()}`;

/** Add clients, skipping ones already here (same name and email). */
export async function importClients(
  db: Executor,
  clock: Clock,
  clients: readonly ImportedClient[],
): Promise<ImportResult> {
  const { rows } = await db.execute(
    `SELECT c.name, (SELECT email FROM client_emails e WHERE e.client_id = c.id ORDER BY position LIMIT 1) AS email
     FROM clients c WHERE c.deleted_at IS NULL`,
  );
  const seen = new Set(rows.map(r => key(reqStr(r.name), str(r.email))));
  const created: string[] = [];
  let duplicates = 0;
  for (const c of clients) {
    const k = key(c.name, c.email);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    const saved = await createClient(db, clock, {
      name: c.name,
      company: c.company,
      isBusiness: c.isBusiness,
      emails: c.email ? [c.email] : [],
      phone: c.phone,
      billingAddress: c.billingAddress,
      taxId: c.taxId,
      notes: c.notes,
    });
    created.push(saved.id);
  }
  return { created, duplicates, invalid: 0 };
}

/** Add catalog items; prices are read in the business locale and currency. */
export async function importItems(
  db: Executor,
  clock: Clock,
  items: readonly ImportedItem[],
  opts: { currency: string; locale: string },
): Promise<ImportResult> {
  const { rows } = await db.execute('SELECT name FROM items WHERE deleted_at IS NULL');
  const seen = new Set(rows.map(r => reqStr(r.name).trim().toLowerCase()));
  const created: string[] = [];
  let duplicates = 0;
  let invalid = 0;
  for (const item of items) {
    const k = item.name.trim().toLowerCase();
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    const price = item.priceText ? parseMoney(item.priceText, opts.currency, opts.locale) : 0;
    if (price === null) {
      invalid++;
      continue;
    }
    seen.add(k);
    const unit = item.unit?.trim().toLowerCase() ?? null;
    const saved = await createItem(db, clock, {
      name: item.name,
      description: item.description,
      unit: unit && isKnownUnit(unit) ? unit : item.unit,
      unitPrice: price,
      sku: item.sku,
      taxRateIds: [],
    });
    created.push(saved.id);
  }
  return { created, duplicates, invalid };
}

/** Undo an import right after it happened. */
export async function undoImport(
  db: Executor,
  clock: Clock,
  target: 'clients' | 'items',
  ids: readonly string[],
): Promise<void> {
  const table = target === 'clients' ? 'clients' : 'items';
  for (const id of ids) {
    await db.execute(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [clock.now(), id]);
  }
}
