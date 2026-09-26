import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useProfile } from '@/data/ProfileProvider';
import { daysBetween, type ISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';

const dateCache = new Map<string, Intl.DateTimeFormat>();
const dateFormatter = (locale: string, opts: Intl.DateTimeFormatOptions) => {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
    dateCache.set(key, f);
  }
  return f;
};

/** ISO calendar date → localized text. Always UTC so the day never shifts. */
export const formatDate = (
  date: ISODate,
  locale: string,
  style: 'short' | 'medium' | 'long' = 'medium',
): string => {
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : style === 'medium'
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
  return dateFormatter(locale, opts).format(new Date(`${date}T00:00:00Z`));
};

/**
 * Formatters bound to the business locale. Numbers and dates follow the
 * business's country conventions; words follow the app language.
 */
export function useFormat() {
  const { profile } = useProfile();
  const { t } = useTranslation();
  return useMemo(() => {
    const locale = profile.locale;
    return {
      locale,
      currency: profile.currency,
      money: (
        minor: number,
        currency = profile.currency,
        opts: { signed?: boolean } = {},
      ) => formatMoney(minor, { locale, currency, signed: opts.signed }),
      date: (date: ISODate, style?: 'short' | 'medium' | 'long') =>
        formatDate(date, locale, style),
      /** "Due today", "Due in 3 days", "5 days overdue". */
      due: (dueDate: ISODate, today: ISODate) => {
        const days = daysBetween(today, dueDate);
        if (days === 0) {
          return t('due.today');
        }
        return days > 0
          ? t('due.inDays', { count: days })
          : t('due.overdueDays', { count: -days });
      },
    };
  }, [profile.currency, profile.locale, t]);
}
