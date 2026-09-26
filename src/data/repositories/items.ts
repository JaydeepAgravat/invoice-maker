import type { Clock } from '../clock';
import { reqNum, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

export type Item = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: number;
  sku: string | null;
  taxRateIds: string[];
};

export type ItemInput = Omit<Item, 'id'>;

const taxesFor = async (db: Executor, ids: string[]) => {
  const out = new Map<string, string[]>(ids.map(id => [id, []]));
  if (ids.length === 0) {
    return out;
  }
  const { rows } = await db.execute(
    `SELECT item_id, tax_rate_id FROM item_taxes WHERE item_id IN (${ids
      .map(() => '?')
      .join(',')}) ORDER BY position`,
    ids,
  );
  rows.forEach(r => out.get(reqStr(r.item_id))!.push(reqStr(r.tax_rate_id)));
  return out;
};

const map = (r: Row, taxRateIds: string[]): Item => ({
  id: reqStr(r.id),
  name: reqStr(r.name),
  description: str(r.description),
  unit: str(r.unit),
  unitPrice: reqNum(r.unit_price_minor),
  sku: str(r.sku),
  taxRateIds,
});

const writeTaxes = async (
  db: Executor,
  itemId: string,
  taxIds: readonly string[],
) => {
  await db.execute('DELETE FROM item_taxes WHERE item_id = ?', [itemId]);
  for (const [i, taxId] of [...new Set(taxIds)].entries()) {
    await db.execute(
      'INSERT INTO item_taxes (item_id, tax_rate_id, position) VALUES (?, ?, ?)',
      [itemId, taxId, i],
    );
  }
};

export async function createItem(
  db: Executor,
  clock: Clock,
  input: ItemInput,
): Promise<Item> {
  if (!input.name.trim()) {
    throw new Error('Item name is required');
  }
  const now = clock.now();
  const id = uuidv7(now);
  await db.execute(
    `INSERT INTO items (id, name, description, unit, unit_price_minor, sku, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.description ?? null,
      input.unit ?? null,
      input.unitPrice,
      input.sku ?? null,
      now,
      now,
    ],
  );
  await writeTaxes(db, id, input.taxRateIds);
  return (await getItem(db, id))!;
}

export async function updateItem(
  db: Executor,
  clock: Clock,
  id: string,
  input: ItemInput,
): Promise<Item> {
  await db.execute(
    'UPDATE items SET name = ?, description = ?, unit = ?, unit_price_minor = ?, sku = ?, updated_at = ? WHERE id = ?',
    [
      input.name.trim(),
      input.description ?? null,
      input.unit ?? null,
      input.unitPrice,
      input.sku ?? null,
      clock.now(),
      id,
    ],
  );
  await writeTaxes(db, id, input.taxRateIds);
  return (await getItem(db, id))!;
}

export async function getItem(db: Executor, id: string): Promise<Item | null> {
  const { rows } = await db.execute('SELECT * FROM items WHERE id = ?', [id]);
  return rows[0] ? map(rows[0], (await taxesFor(db, [id])).get(id)!) : null;
}

/** Catalog search for the line editor: prefix matches rank above substring matches. */
export async function listItems(
  db: Executor,
  opts: { search?: string; limit?: number } = {},
): Promise<Item[]> {
  const q = opts.search?.trim();
  const params: (string | number)[] = [];
  let where = 'deleted_at IS NULL';
  let order = 'name COLLATE NOCASE';
  if (q) {
    const escaped = q.replace(/[\\%_]/g, m => `\\${m}`);
    where += ` AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\')`;
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    order = `CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, ${order}`;
    params.push(`${escaped}%`);
  }
  params.push(opts.limit ?? 500);
  const { rows } = await db.execute(
    `SELECT * FROM items WHERE ${where} ORDER BY ${order} LIMIT ?`,
    params,
  );
  const ids = rows.map(r => reqStr(r.id));
  const taxes = await taxesFor(db, ids);
  return rows.map(r => map(r, taxes.get(reqStr(r.id))!));
}

export const deleteItem = (db: Executor, clock: Clock, id: string) =>
  db.execute('UPDATE items SET deleted_at = ? WHERE id = ?', [clock.now(), id]);

export const restoreItem = (db: Executor, id: string) =>
  db.execute('UPDATE items SET deleted_at = NULL WHERE id = ?', [id]);

/** Bulk delete (a common request: clean out one-off items). */
export async function deleteItems(
  db: Executor,
  clock: Clock,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await db.execute(
    `UPDATE items SET deleted_at = ? WHERE id IN (${ids
      .map(() => '?')
      .join(',')})`,
    [clock.now(), ...ids],
  );
}
