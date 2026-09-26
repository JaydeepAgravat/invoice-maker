import { compareDates, daysBetween, type ISODate } from './dates';
import type { DocType } from './docTypes';

/**
 * Status is split in two:
 *  - StoredStatus is what the user did (sent it, voided it, client accepted).
 *  - DisplayStatus is derived from facts (payments, due date, today), so
 *    "Overdue" or "Paid" can never go stale in the database.
 */

export type StoredStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VOID'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CONVERTED'
  | 'DELIVERED'
  | 'RECEIVED';

export type DisplayStatus =
  | StoredStatus
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'EXPIRED';

export type StatusFacts = {
  type: DocType;
  stored: StoredStatus;
  total: number;
  paid: number;
  dueDate?: ISODate | null;
  /** Estimates and change orders: offer expiry. */
  validUntil?: ISODate | null;
  today: ISODate;
};

export function displayStatus(f: StatusFacts): DisplayStatus {
  if (f.stored === 'DRAFT' || f.stored === 'VOID') {
    return f.stored;
  }
  switch (f.type) {
    case 'INVOICE': {
      if (f.total > 0 && f.paid >= f.total) {
        return 'PAID';
      }
      if (
        f.dueDate &&
        compareDates(f.today, f.dueDate) > 0 &&
        f.total - f.paid > 0
      ) {
        return 'OVERDUE';
      }
      return f.paid > 0 ? 'PARTIAL' : 'SENT';
    }
    case 'RECEIPT':
      return 'PAID';
    case 'ESTIMATE':
    case 'CHANGE_ORDER':
      if (
        f.stored === 'SENT' &&
        f.validUntil &&
        compareDates(f.today, f.validUntil) > 0
      ) {
        return 'EXPIRED';
      }
      return f.stored;
    default:
      return f.stored;
  }
}

/** Days past due (0 when not overdue). */
export const daysOverdue = (
  dueDate: ISODate | null | undefined,
  today: ISODate,
): number => (dueDate ? Math.max(0, daysBetween(dueDate, today)) : 0);

export type DocAction =
  | 'EDIT'
  | 'SEND'
  | 'MARK_SENT'
  | 'RECORD_PAYMENT'
  | 'VOID'
  | 'DUPLICATE'
  | 'DELETE'
  | 'ACCEPT'
  | 'DECLINE'
  | 'CONVERT_TO_INVOICE'
  | 'CREATE_CHANGE_ORDER'
  | 'CREATE_CREDIT_NOTE'
  | 'MARK_DELIVERED'
  | 'MARK_RECEIVED';

/**
 * What can be done from each state. Drafts can be deleted; anything that was
 * ever sent keeps its number and can only be voided (numbers are never reused).
 */
export function allowedActions(
  type: DocType,
  status: DisplayStatus,
): DocAction[] {
  const common: DocAction[] = ['DUPLICATE'];
  if (status === 'DRAFT') {
    const draft: DocAction[] = [
      'EDIT',
      'SEND',
      'MARK_SENT',
      'DELETE',
      ...common,
    ];
    return type === 'RECEIPT' ? draft.filter(a => a !== 'MARK_SENT') : draft;
  }
  if (status === 'VOID') {
    return common;
  }
  const sent: DocAction[] = ['EDIT', 'SEND', ...common];
  switch (type) {
    case 'INVOICE':
      return status === 'PAID'
        ? [...sent, 'CREATE_CREDIT_NOTE', 'VOID']
        : [...sent, 'RECORD_PAYMENT', 'CREATE_CREDIT_NOTE', 'VOID'];
    case 'ESTIMATE':
      if (status === 'ACCEPTED') {
        return [...sent, 'CONVERT_TO_INVOICE', 'CREATE_CHANGE_ORDER', 'VOID'];
      }
      if (status === 'CONVERTED') {
        return [...sent, 'CREATE_CHANGE_ORDER'];
      }
      if (status === 'DECLINED') {
        return [...sent, 'VOID'];
      }
      return [...sent, 'ACCEPT', 'DECLINE', 'VOID'];
    case 'CHANGE_ORDER':
      return status === 'SENT' || status === 'EXPIRED'
        ? [...sent, 'ACCEPT', 'DECLINE', 'VOID']
        : [...sent, 'VOID'];
    case 'DELIVERY_NOTE':
      return status === 'DELIVERED'
        ? [...sent, 'VOID']
        : [...sent, 'MARK_DELIVERED', 'VOID'];
    case 'PURCHASE_ORDER':
      return status === 'RECEIVED'
        ? [...sent, 'VOID']
        : [...sent, 'MARK_RECEIVED', 'VOID'];
    default:
      return [...sent, 'VOID'];
  }
}

/** Stored status after an action, or null when the action does not change it. */
export function nextStoredStatus(
  action: DocAction,
  current: StoredStatus,
): StoredStatus | null {
  switch (action) {
    case 'SEND':
    case 'MARK_SENT':
      return current === 'DRAFT' ? 'SENT' : null;
    case 'VOID':
      return 'VOID';
    case 'ACCEPT':
      return 'ACCEPTED';
    case 'DECLINE':
      return 'DECLINED';
    case 'CONVERT_TO_INVOICE':
      return 'CONVERTED';
    case 'MARK_DELIVERED':
      return 'DELIVERED';
    case 'MARK_RECEIVED':
      return 'RECEIVED';
    default:
      return null;
  }
}
