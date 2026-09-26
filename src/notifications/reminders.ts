import i18n from '@/i18n';
import { getDatabase } from '@/data/database';
import { getProfile } from '@/data/repositories/profile';
import { listSchedules } from '@/data/repositories/recurring';
import { addDays, type ISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { PrefKeys, prefs } from '@/lib/storage';
import NativeReminders, { type Reminder } from '@/specs/NativeReminders';

const HOUR = 9;
const MAX_REMINDERS = 30;

/** 09:00 local time on a calendar date. */
const morningOf = (date: ISODate) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, HOUR, 0, 0).getTime();
};

const nextMonday = (today: ISODate) => {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(today, ((8 - dow) % 7) || 7);
};

/**
 * Rebuild every scheduled reminder from the data: one per invoice on the
 * morning after it falls due, a weekly digest while any are overdue, and a
 * heads-up on the morning a recurring invoice is ready.
 */
export async function syncReminders(today: ISODate): Promise<void> {
  if (!NativeReminders) {
    return;
  }
  const db = await getDatabase();
  const profile = await getProfile(db);
  const t = i18n.t.bind(i18n);
  const money = (minor: number, currency: string) =>
    formatMoney(minor, { locale: profile.locale, currency });
  const out: Reminder[] = [];

  if (prefs.getBoolean(PrefKeys.overdueReminders)) {
    const { rows } = await db.execute(
      `SELECT d.id, d.number, d.due_date, d.currency, d.total_minor - d.paid_minor AS open,
         COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client
       FROM documents d LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.doc_type = 'INVOICE' AND d.status = 'SENT' AND d.deleted_at IS NULL
         AND d.due_date IS NOT NULL AND d.total_minor - d.paid_minor > 0
       ORDER BY d.due_date`,
    );
    const late = rows.filter(r => String(r.due_date) < today);
    for (const r of rows.filter(x => String(x.due_date) >= today).slice(0, MAX_REMINDERS)) {
      out.push({
        id: `overdue-${String(r.id)}`,
        at: morningOf(addDays(String(r.due_date), 1)),
        title: t('reminders.overdueTitle', { number: r.number }),
        body: t('reminders.overdueBody', {
          amount: money(Number(r.open), String(r.currency)),
          client: r.client ?? t('document.noClient'),
        }),
        url: `invoiceapp://document/${String(r.id)}`,
      });
    }
    if (late.length) {
      const byCurrency = new Map<string, number>();
      late.forEach(r =>
        byCurrency.set(String(r.currency), (byCurrency.get(String(r.currency)) ?? 0) + Number(r.open)),
      );
      out.push({
        id: 'overdue-digest',
        at: morningOf(nextMonday(today)),
        title: t('reminders.digestTitle', { count: late.length }),
        body: t('reminders.digestBody', {
          amount: [...byCurrency.entries()].map(([c, v]) => money(v, c)).join(' + '),
        }),
        url: 'invoiceapp://inbox/overdue',
      });
    }
  }

  const schedules = await listSchedules(db);
  for (const s of schedules) {
    const { rows } = await db.execute(
      `SELECT COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client
       FROM documents d LEFT JOIN clients c ON c.id = d.client_id WHERE d.id = ?`,
      [s.templateId],
    );
    out.push({
      id: `recurring-${s.id}`,
      at: morningOf(s.nextDate),
      title: t('reminders.recurringTitle'),
      body: t('reminders.recurringBody', { client: rows[0]?.client ?? t('document.noClient') }),
      url: 'invoiceapp://inbox/drafts',
    });
  }

  await NativeReminders.setAll(out.filter(r => r.at > Date.now()));
}
