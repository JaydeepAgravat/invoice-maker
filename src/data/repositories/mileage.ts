import type { ISODate } from '@/domain/dates';

import type { Clock } from '../clock';
import { reqNum, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

export type Trip = {
  id: string;
  date: ISODate;
  from: string | null;
  to: string | null;
  /** Thousandths of `unit`. */
  distance: number;
  unit: 'km' | 'mi';
  /** Minor units per unit of distance. */
  rate: number;
  currency: string;
  purpose: string | null;
  clientId: string | null;
  createdAt: number;
};

export type TripInput = Omit<Trip, 'id' | 'createdAt'>;

const map = (r: Row): Trip => ({
  id: reqStr(r.id),
  date: reqStr(r.date),
  from: str(r.from_place),
  to: str(r.to_place),
  distance: reqNum(r.distance_milli),
  unit: reqStr(r.unit) as Trip['unit'],
  rate: reqNum(r.rate_minor),
  currency: reqStr(r.currency),
  purpose: str(r.purpose),
  clientId: str(r.client_id),
  createdAt: reqNum(r.created_at),
});

const values = (t: TripInput) => [
  t.date,
  t.from?.trim() || null,
  t.to?.trim() || null,
  t.distance,
  t.unit,
  t.rate,
  t.currency,
  t.purpose?.trim() || null,
  t.clientId,
];

const check = (t: TripInput) => {
  if (!Number.isSafeInteger(t.distance) || t.distance <= 0) {
    throw new RangeError('Distance must be positive');
  }
  if (!Number.isSafeInteger(t.rate) || t.rate < 0) {
    throw new RangeError('Rate must not be negative');
  }
};

export async function listTrips(
  db: Executor,
  opts: { from?: ISODate; to?: ISODate } = {},
): Promise<Trip[]> {
  const { rows } = await db.execute(
    `SELECT * FROM mileage WHERE deleted_at IS NULL AND date >= ? AND date <= ?
     ORDER BY date DESC, created_at DESC`,
    [opts.from ?? '0000-01-01', opts.to ?? '9999-12-31'],
  );
  return rows.map(map);
}

export async function getTrip(db: Executor, id: string): Promise<Trip | null> {
  const { rows } = await db.execute('SELECT * FROM mileage WHERE id = ?', [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function createTrip(
  db: Executor,
  clock: Clock,
  input: TripInput,
): Promise<Trip> {
  check(input);
  const now = clock.now();
  const id = uuidv7(now);
  await db.execute(
    `INSERT INTO mileage (date, from_place, to_place, distance_milli, unit, rate_minor, currency, purpose, client_id,
       id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values(input), id, now, now],
  );
  return (await getTrip(db, id))!;
}

export async function updateTrip(
  db: Executor,
  clock: Clock,
  id: string,
  input: TripInput,
): Promise<Trip> {
  check(input);
  await db.execute(
    `UPDATE mileage SET date = ?, from_place = ?, to_place = ?, distance_milli = ?, unit = ?, rate_minor = ?,
       currency = ?, purpose = ?, client_id = ?, updated_at = ? WHERE id = ?`,
    [...values(input), clock.now(), id],
  );
  return (await getTrip(db, id))!;
}

export const deleteTrip = (db: Executor, clock: Clock, id: string) =>
  db.execute('UPDATE mileage SET deleted_at = ? WHERE id = ?', [clock.now(), id]);

export const restoreTrip = (db: Executor, id: string) =>
  db.execute('UPDATE mileage SET deleted_at = NULL WHERE id = ?', [id]);

/** Places used before, for quick entry of regular trips. */
export async function recentPlaces(db: Executor, limit = 8): Promise<string[]> {
  const { rows } = await db.execute(
    `SELECT place FROM (
       SELECT from_place AS place, created_at FROM mileage WHERE deleted_at IS NULL AND from_place IS NOT NULL
       UNION ALL
       SELECT to_place, created_at FROM mileage WHERE deleted_at IS NULL AND to_place IS NOT NULL
     ) GROUP BY place COLLATE NOCASE ORDER BY MAX(created_at) DESC LIMIT ?`,
    [limit],
  );
  return rows.map(r => reqStr(r.place));
}
