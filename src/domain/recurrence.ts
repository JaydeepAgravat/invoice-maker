import { addDays, addMonths, compareDates, type ISODate } from './dates';

export type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export const FREQUENCIES: readonly Frequency[] = [
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
];

/**
 * The n-th occurrence (0 = the anchor). Always computed from the anchor, so
 * "monthly on the 31st" gives 28 Feb then 31 Mar, never drifting to the 28th.
 */
export function occurrence(
  anchor: ISODate,
  frequency: Frequency,
  interval: number,
  n: number,
): ISODate {
  const step = Math.max(1, Math.floor(interval)) * n;
  switch (frequency) {
    case 'WEEKLY':
      return addDays(anchor, step * 7);
    case 'MONTHLY':
      return addMonths(anchor, step);
    case 'QUARTERLY':
      return addMonths(anchor, step * 3);
    case 'YEARLY':
      return addMonths(anchor, step * 12);
  }
}

/**
 * Occurrences that are due by `today` starting from occurrence `from`,
 * capped so a long-dormant schedule never floods the inbox.
 */
export function dueOccurrences(opts: {
  anchor: ISODate;
  frequency: Frequency;
  interval: number;
  from: number;
  today: ISODate;
  endDate: ISODate | null;
  max?: number;
}): { index: number; date: ISODate }[] {
  const out: { index: number; date: ISODate }[] = [];
  const max = opts.max ?? 3;
  for (let n = opts.from; out.length < max; n++) {
    const date = occurrence(opts.anchor, opts.frequency, opts.interval, n);
    if (compareDates(date, opts.today) > 0) {
      break;
    }
    if (opts.endDate && compareDates(date, opts.endDate) > 0) {
      break;
    }
    out.push({ index: n, date });
  }
  return out;
}

/** Index of the first occurrence after `today` (where the schedule resumes). */
export function nextIndexAfter(
  anchor: ISODate,
  frequency: Frequency,
  interval: number,
  from: number,
  today: ISODate,
): number {
  let n = from;
  while (compareDates(occurrence(anchor, frequency, interval, n), today) <= 0) {
    n++;
  }
  return n;
}
