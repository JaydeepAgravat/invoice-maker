/**
 * Calendar dates as ISO strings ("2026-09-26"). Invoice dates are days, not
 * instants: they never shift with time zones or daylight saving. All math is
 * done in UTC on date-only values.
 */

export type ISODate = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const isISODate = (value: string): value is ISODate => {
  const m = RE.exec(value);
  if (!m) {
    return false;
  }
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return (
    d.getUTCFullYear() === +m[1]! &&
    d.getUTCMonth() === +m[2]! - 1 &&
    d.getUTCDate() === +m[3]!
  );
};

const toUTC = (date: ISODate): number => {
  if (!isISODate(date)) {
    throw new RangeError(`Invalid ISO date: ${date}`);
  }
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

const fromUTC = (ms: number): ISODate =>
  new Date(ms).toISOString().slice(0, 10);

/** The local calendar date of an instant (what the person sees on their phone). */
export const localDate = (instant: Date = new Date()): ISODate => {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, '0');
  const d = String(instant.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDays = (date: ISODate, days: number): ISODate =>
  fromUTC(toUTC(date) + days * DAY_MS);

/**
 * Add calendar months, clamping to the month's last day
 * (Jan 31 + 1 month = Feb 28/29). Used by recurring schedules.
 */
export const addMonths = (date: ISODate, months: number): ISODate => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  toUTC(date);
  const targetMonth = m - 1 + months;
  const ty = y + Math.floor(targetMonth / 12);
  const tm = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fromUTC(Date.UTC(ty, tm, Math.min(d, lastDay)));
};

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: ISODate, b: ISODate): number =>
  Math.round((toUTC(b) - toUTC(a)) / DAY_MS);

export const compareDates = (a: ISODate, b: ISODate): -1 | 0 | 1 => {
  const d = toUTC(a) - toUTC(b);
  return d === 0 ? 0 : d < 0 ? -1 : 1;
};

export const yearOf = (date: ISODate): number => {
  toUTC(date);
  return Number(date.slice(0, 4));
};

/** Payment terms in days → due date. 0 means "due on receipt". */
export const dueDateFromTerms = (
  issueDate: ISODate,
  termsDays: number,
): ISODate => {
  if (!Number.isInteger(termsDays) || termsDays < 0) {
    throw new RangeError(`Invalid payment terms: ${termsDays}`);
  }
  return addDays(issueDate, termsDays);
};
