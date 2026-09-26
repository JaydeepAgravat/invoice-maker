import type { TFunction } from 'i18next';

import type { DocType } from '@/domain/docTypes';
import type { DisplayStatus, DocAction } from '@/domain/status';
import { toEditableText } from '@/domain/expression';
import { decimalSeparator, rateToPercent } from '@/domain/money';
import { isKnownUnit, type UnitKey } from '@/domain/units';
import type { BadgeTone } from '@/ui/primitives';

export const STATUS_TONE: Record<DisplayStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SENT: 'info',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'neutral',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  CONVERTED: 'accent',
  EXPIRED: 'warning',
  DELIVERED: 'success',
  RECEIVED: 'success',
};

export const statusKey = (s: DisplayStatus) =>
  `status.${s.toLowerCase() as Lowercase<DisplayStatus>}` as const;
export const docTypeKey = (t: DocType) => `docType.${t}` as const;

/** Actions shown in the UI (the rest are internal transitions). */
export type UiAction = Exclude<
  DocAction,
  'EDIT' | 'SEND' | 'MARK_SENT' | 'DELETE'
>;
export const actionKey = (a: UiAction) => `actions.${a}` as const;

/** Localized unit label; custom units typed by the user are shown as-is. */
export const unitLabel = (
  t: TFunction,
  unit: string | null | undefined,
): string =>
  !unit ? '' : isKnownUnit(unit) ? t(`units.${unit as UnitKey}`) : unit;

/** "2 hr × £45.00 · VAT 20%" — one line summary used by the editor and detail views. */
export const lineSummary = (
  t: TFunction,
  money: (minor: number, currency: string) => string,
  locale: string,
  line: {
    quantity: number;
    unit?: string | null;
    unitPrice: number;
    taxes: ReadonlyArray<{ name: string; rate: number }>;
  },
  currency: string,
  opts: { prices?: boolean } = {},
): string => {
  const qty = toEditableText(line.quantity, 3, decimalSeparator(locale));
  const unit = line.unit ? ` ${unitLabel(t, line.unit)}` : '';
  if (opts.prices === false) {
    return `${qty}${unit}`;
  }
  const taxes = line.taxes
    .map(x => `${x.name} ${rateToPercent(x.rate)}%`)
    .join(', ');
  return `${qty}${unit} × ${money(line.unitPrice, currency)}${
    taxes ? ` · ${taxes}` : ''
  }`;
};
