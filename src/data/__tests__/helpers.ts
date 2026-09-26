import { addDays, type ISODate } from '@/domain/dates';

import type { Clock } from '../clock';
import { openNodeDatabase } from '../db/node';
import type { Database } from '../db/types';
import { migrate } from '../migrations';
import { applyCountryPreset } from '../repositories/profile';

/** A clock the test can move forward, starting at a fixed date. */
export class TestClock implements Clock {
  private ms: number;
  private date: ISODate;

  constructor(date: ISODate = '2026-09-26') {
    this.date = date;
    this.ms = Date.parse(`${date}T09:00:00Z`);
  }

  now() {
    return this.ms++;
  }

  today() {
    return this.date;
  }

  advanceDays(days: number) {
    this.date = addDays(this.date, days);
    this.ms += days * 86_400_000;
  }
}

export async function setupDb(
  country: Parameters<typeof applyCountryPreset>[2]['country'] = 'GB',
  region?: string,
): Promise<{ db: Database; clock: TestClock }> {
  const db = openNodeDatabase();
  await migrate(db);
  const clock = new TestClock();
  await applyCountryPreset(db, clock, { country, region, language: 'en' });
  return { db, clock };
}
