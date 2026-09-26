import { addDays, type ISODate } from '@/domain/dates';
import {
  dueOccurrences,
  nextIndexAfter,
  occurrence,
  type Frequency,
} from '@/domain/recurrence';

import type { Clock } from '../clock';
import { bool, reqNum, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

import {
  duplicateDocument,
  getDocument,
  saveDocument,
  toDraft,
} from './documents';

export type Schedule = {
  id: string;
  templateId: string;
  frequency: Frequency;
  interval: number;
  anchor: ISODate;
  nextIndex: number;
  nextDate: ISODate;
  endDate: ISODate | null;
  active: boolean;
};

const map = (r: Row): Schedule => ({
  id: reqStr(r.id),
  templateId: reqStr(r.template_document_id),
  frequency: reqStr(r.frequency) as Frequency,
  interval: reqNum(r.interval),
  anchor: str(r.anchor_date) ?? reqStr(r.next_date),
  nextIndex: reqNum(r.next_index),
  nextDate: reqStr(r.next_date),
  endDate: str(r.end_date),
  active: bool(r.active),
});

export async function getSchedule(
  db: Executor,
  templateId: string,
): Promise<Schedule | null> {
  const { rows } = await db.execute(
    'SELECT * FROM recurring_schedules WHERE template_document_id = ? ORDER BY created_at DESC LIMIT 1',
    [templateId],
  );
  return rows[0] ? map(rows[0]) : null;
}

export async function listSchedules(db: Executor): Promise<Schedule[]> {
  const { rows } = await db.execute(
    `SELECT s.* FROM recurring_schedules s JOIN documents d ON d.id = s.template_document_id
     WHERE s.active = 1 AND d.deleted_at IS NULL ORDER BY s.next_date`,
  );
  return rows.map(map);
}

/**
 * Repeat a document: the first copy is made on `start`, then every period.
 * Setting a schedule again replaces the previous one.
 */
export async function setSchedule(
  db: Executor,
  clock: Clock,
  templateId: string,
  input: { frequency: Frequency; interval?: number; start: ISODate; endDate?: ISODate | null },
): Promise<Schedule> {
  const now = clock.now();
  await db.execute('DELETE FROM recurring_schedules WHERE template_document_id = ?', [templateId]);
  const id = uuidv7(now);
  await db.execute(
    `INSERT INTO recurring_schedules (id, template_document_id, frequency, interval, next_date, end_date, active,
       anchor_date, next_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
    [
      id,
      templateId,
      input.frequency,
      Math.max(1, input.interval ?? 1),
      input.start,
      input.endDate ?? null,
      input.start,
      now,
      now,
    ],
  );
  return (await getSchedule(db, templateId))!;
}

export const stopSchedule = (db: Executor, clock: Clock, templateId: string) =>
  db.execute(
    'UPDATE recurring_schedules SET active = 0, updated_at = ? WHERE template_document_id = ?',
    [clock.now(), templateId],
  );

/**
 * Create the drafts that are due today (at most three per schedule, so a
 * phone left in a drawer for months doesn't flood the inbox) and move each
 * schedule to its next date. Returns the new draft ids.
 */
export async function processDueSchedules(
  db: Executor,
  clock: Clock,
): Promise<string[]> {
  const today = clock.today();
  const created: string[] = [];
  for (const s of await listSchedules(db)) {
    const template = await getDocument(db, s.templateId);
    if (!template) {
      continue;
    }
    const due = dueOccurrences({
      anchor: s.anchor,
      frequency: s.frequency,
      interval: s.interval,
      from: s.nextIndex,
      today,
      endDate: s.endDate,
    });
    for (const o of due) {
      const copy = await duplicateDocument(db, clock, template.id);
      const terms = copy.termsDays;
      const saved = await saveDocument(db, clock, {
        ...toDraft(copy),
        issueDate: o.date,
        dueDate: terms !== null && copy.dueDate ? addDays(o.date, terms) : copy.dueDate,
        sourceDocumentId: template.id,
      });
      await db.execute(
        'INSERT INTO activity_log (id, document_id, kind, payload_json, at) VALUES (?, ?, ?, ?, ?)',
        [uuidv7(clock.now()), saved.id, 'RECURRING', JSON.stringify({ from: template.number }), clock.now()],
      );
      created.push(saved.id);
    }
    if (due.length) {
      const next = nextIndexAfter(s.anchor, s.frequency, s.interval, s.nextIndex, today);
      const nextDate = occurrence(s.anchor, s.frequency, s.interval, next);
      const finished = s.endDate !== null && nextDate > s.endDate;
      await db.execute(
        'UPDATE recurring_schedules SET next_index = ?, next_date = ?, active = ?, updated_at = ? WHERE id = ?',
        [next, nextDate, finished ? 0 : 1, clock.now(), s.id],
      );
    }
  }
  return created;
}
