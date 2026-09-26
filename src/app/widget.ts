import i18n from '@/i18n';
import { getDatabase } from '@/data/database';
import { dashboard } from '@/data/repositories/inbox';
import { getProfile } from '@/data/repositories/profile';
import type { ISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import NativeWidget from '@/specs/NativeWidget';

/** Push the latest totals to the home-screen widget (main currency). */
export async function updateWidget(today: ISODate): Promise<void> {
  if (!NativeWidget) {
    return;
  }
  const db = await getDatabase();
  const [totals, profile] = await Promise.all([dashboard(db, today), getProfile(db)]);
  const currency = profile.currency;
  const money = (minor: number) => formatMoney(minor, { locale: profile.locale, currency });
  const overdue = totals.overdue[currency] ?? 0;
  NativeWidget.update({
    outstandingLabel: i18n.t('inbox.outstanding'),
    outstanding: money(totals.outstanding[currency] ?? 0),
    overdue: overdue
      ? i18n.t('widget.overdue', { amount: money(overdue) })
      : i18n.t('widget.nothingOverdue'),
    overdueTone: overdue ? 'danger' : 'neutral',
    newLabel: i18n.t('client.newInvoice'),
  });
}
