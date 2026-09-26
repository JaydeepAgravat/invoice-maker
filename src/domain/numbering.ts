import type { DocType } from './docTypes';

/**
 * Document numbers: per-type sequences that never reuse a value.
 *
 *   SEQUENTIAL  INV-0042
 *   YEARLY      INV-2026-0042  (counter restarts each year; common in ES/DE/FR/PT)
 */

export type NumberingStyle = 'SEQUENTIAL' | 'YEARLY';

export type NumberingFormat = {
  prefix: string;
  pad: number;
  style: NumberingStyle;
};

export const formatDocumentNumber = (
  fmt: NumberingFormat,
  value: number,
  year: number,
): string => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(
      `Sequence value must be a positive integer, got ${value}`,
    );
  }
  const digits = String(value).padStart(
    Math.max(1, Math.min(fmt.pad, 10)),
    '0',
  );
  const parts = [
    fmt.prefix.trim(),
    fmt.style === 'YEARLY' ? String(year) : '',
    digits,
  ].filter(Boolean);
  return parts.join('-');
};

/** Sequence key: yearly formats count per calendar year. */
export const sequenceKey = (
  type: DocType,
  style: NumberingStyle,
  year: number,
): string => (style === 'YEARLY' ? `${type}:${year}` : type);

/**
 * People migrating from another app may set the next number, but never at or
 * below a number already issued in the same sequence.
 */
export const validateNextValue = (
  requested: number,
  highestIssued: number,
): string | null => {
  if (!Number.isInteger(requested) || requested < 1) {
    return 'NEXT_NUMBER_INVALID';
  }
  if (requested <= highestIssued) {
    return 'NEXT_NUMBER_TOO_LOW';
  }
  return null;
};

type PrefixSet = Record<DocType, string>;

const EN: PrefixSet = {
  INVOICE: 'INV',
  ESTIMATE: 'EST',
  RECEIPT: 'REC',
  CREDIT_NOTE: 'CN',
  PROFORMA: 'PF',
  DELIVERY_NOTE: 'DN',
  CHANGE_ORDER: 'CO',
  PURCHASE_ORDER: 'PO',
  STATEMENT: 'ST',
};

export const DEFAULT_PREFIXES: Record<string, PrefixSet> = {
  en: EN,
  es: {
    INVOICE: 'FAC',
    ESTIMATE: 'PRE',
    RECEIPT: 'REC',
    CREDIT_NOTE: 'RECT',
    PROFORMA: 'PRO',
    DELIVERY_NOTE: 'ALB',
    CHANGE_ORDER: 'OC',
    PURCHASE_ORDER: 'PED',
    STATEMENT: 'EC',
  },
  pt: {
    INVOICE: 'FAT',
    ESTIMATE: 'ORC',
    RECEIPT: 'REC',
    CREDIT_NOTE: 'NC',
    PROFORMA: 'PF',
    DELIVERY_NOTE: 'GR',
    CHANGE_ORDER: 'AD',
    PURCHASE_ORDER: 'PC',
    STATEMENT: 'EXT',
  },
  fr: {
    INVOICE: 'FAC',
    ESTIMATE: 'DEV',
    RECEIPT: 'REC',
    CREDIT_NOTE: 'AV',
    PROFORMA: 'PRO',
    DELIVERY_NOTE: 'BL',
    CHANGE_ORDER: 'AVT',
    PURCHASE_ORDER: 'BC',
    STATEMENT: 'REL',
  },
  de: {
    INVOICE: 'RE',
    ESTIMATE: 'AN',
    RECEIPT: 'QU',
    CREDIT_NOTE: 'GS',
    PROFORMA: 'PR',
    DELIVERY_NOTE: 'LS',
    CHANGE_ORDER: 'NT',
    PURCHASE_ORDER: 'BE',
    STATEMENT: 'KA',
  },
};

export const defaultPrefix = (language: string, type: DocType): string =>
  (DEFAULT_PREFIXES[language] ?? EN)[type];
