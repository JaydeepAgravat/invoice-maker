import type { TaxInput, TaxKind } from '@/domain/calc';

import type { Clock } from '../clock';
import {
  bool,
  reqNum,
  reqStr,
  str,
  type Executor,
  type Row,
} from '../db/types';
import { uuidv7 } from '../ids';

export type TaxRate = {
  id: string;
  name: string;
  rate: number;
  kind: TaxKind;
  isDefault: boolean;
  archived: boolean;
  position: number;
  presetKey: string | null;
};

const map = (r: Row): TaxRate => ({
  id: reqStr(r.id),
  name: reqStr(r.name),
  rate: reqNum(r.rate_ppm),
  kind: reqStr(r.kind) as TaxKind,
  isDefault: bool(r.is_default),
  archived: bool(r.archived),
  position: reqNum(r.position),
  presetKey: str(r.preset_key),
});

export const toTaxInput = (
  t: Pick<TaxRate, 'id' | 'name' | 'rate' | 'kind'>,
): TaxInput => ({
  id: t.id,
  name: t.name,
  rate: t.rate,
  kind: t.kind,
});

export async function listTaxRates(
  db: Executor,
  opts: { includeArchived?: boolean } = {},
): Promise<TaxRate[]> {
  const { rows } = await db.execute(
    `SELECT * FROM tax_rates ${
      opts.includeArchived ? '' : 'WHERE archived = 0'
    } ORDER BY position, name`,
  );
  return rows.map(map);
}

export async function getTaxRates(
  db: Executor,
  ids: readonly string[],
): Promise<TaxRate[]> {
  if (ids.length === 0) {
    return [];
  }
  const { rows } = await db.execute(
    `SELECT * FROM tax_rates WHERE id IN (${ids.map(() => '?').join(',')})`,
    [...ids],
  );
  const byId = new Map(rows.map(r => [reqStr(r.id), map(r)]));
  return ids
    .map(id => byId.get(id))
    .filter((t): t is TaxRate => t !== undefined);
}

export async function createTaxRate(
  db: Executor,
  clock: Clock,
  input: { name: string; rate: number; kind?: TaxKind; isDefault?: boolean },
): Promise<TaxRate> {
  if (
    !Number.isInteger(input.rate) ||
    input.rate < 0 ||
    input.rate >= 1_000_000
  ) {
    throw new RangeError('Tax rate must be between 0% and 100%');
  }
  const now = clock.now();
  const id = uuidv7(now);
  const { rows } = await db.execute(
    'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM tax_rates',
  );
  await db.execute(
    `INSERT INTO tax_rates (id, name, rate_ppm, kind, is_default, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.rate,
      input.kind ?? 'STANDARD',
      input.isDefault ? 1 : 0,
      reqNum(rows[0]!.p),
      now,
      now,
    ],
  );
  return (await getTaxRates(db, [id]))[0]!;
}

/**
 * Rates on existing documents are snapshotted per line, so editing or
 * archiving a rate never changes documents already written.
 */
export async function updateTaxRate(
  db: Executor,
  clock: Clock,
  id: string,
  patch: Partial<
    Pick<TaxRate, 'name' | 'rate' | 'kind' | 'isDefault' | 'archived'>
  >,
): Promise<void> {
  const current = (await getTaxRates(db, [id]))[0];
  if (!current) {
    throw new Error(`Tax rate ${id} not found`);
  }
  const next = { ...current, ...patch };
  await db.execute(
    'UPDATE tax_rates SET name = ?, rate_ppm = ?, kind = ?, is_default = ?, archived = ?, updated_at = ? WHERE id = ?',
    [
      next.name,
      next.rate,
      next.kind,
      next.isDefault ? 1 : 0,
      next.archived ? 1 : 0,
      clock.now(),
      id,
    ],
  );
}

export async function defaultTaxRates(db: Executor): Promise<TaxRate[]> {
  const { rows } = await db.execute(
    'SELECT * FROM tax_rates WHERE archived = 0 AND is_default = 1 ORDER BY position',
  );
  return rows.map(map);
}
