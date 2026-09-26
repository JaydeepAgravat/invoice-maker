/**
 * Money is always an integer count of the currency's minor unit (cents, pence,
 * centavos). Quantities are integer thousandths (1500 = 1.5). Tax rates are
 * integer parts-per-million (1_000_000 = 100%), which represents rates like
 * Quebec QST 9.975% (99_750) or Mexico's IVA retention 10.6667% (106_667) exactly.
 */

export type Minor = number;

export const QTY_SCALE = 1000;
export const RATE_SCALE = 1_000_000;

/** ISO 4217 minor-unit digits for currencies that differ from 2. */
const DIGITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  CLP: 0,
  ISK: 0,
  VND: 0,
  XOF: 0,
  XAF: 0,
  HUF: 2,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

export const currencyDigits = (currency: string): number =>
  DIGITS[currency.toUpperCase()] ?? 2;

/** Percent (e.g. 9.975) → parts-per-million, rounded to the nearest ppm. */
export const percentToRate = (percent: number): number =>
  Math.round(percent * 10_000);

/** Parts-per-million → percent for display (99750 → 9.975). */
export const rateToPercent = (rate: number): number => rate / 10_000;

export type FormatOptions = {
  locale: string;
  currency: string;
  /** Show the currency symbol (default) or just the number. */
  symbol?: boolean;
  /** Always show a sign, e.g. for adjustments. */
  signed?: boolean;
};

const formatterCache = new Map<string, Intl.NumberFormat>();

const formatter = (
  locale: string,
  currency: string,
  symbol: boolean,
  signed: boolean,
) => {
  const key = `${locale}|${currency}|${symbol}|${signed}`;
  let f = formatterCache.get(key);
  if (!f) {
    const digits = currencyDigits(currency);
    f = new Intl.NumberFormat(locale, {
      style: symbol ? 'currency' : 'decimal',
      currency: symbol ? currency : undefined,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    formatterCache.set(key, f);
  }
  return f;
};

export const formatMoney = (
  minor: Minor,
  { locale, currency, symbol = true, signed = false }: FormatOptions,
): string => {
  const digits = currencyDigits(currency);
  return formatter(locale, currency, symbol, signed).format(
    minor / 10 ** digits,
  );
};

/** Decimal separator used by a locale ("." for en-US, "," for de-DE). */
export const decimalSeparator = (locale: string): string =>
  new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find(p => p.type === 'decimal')?.value ?? '.';

/**
 * Parse what a person typed into an integer minor amount.
 *
 * Accepts the locale's decimal separator, ignores grouping, spaces and
 * currency symbols, and tolerates the "other" separator when it can only be a
 * decimal (e.g. "12.5" on a German keyboard). Returns null when the input is
 * not a number or has more decimals than the currency allows.
 */
export const parseMoney = (
  input: string,
  currency: string,
  locale: string,
): Minor | null => {
  return parseDecimal(input, locale, currencyDigits(currency));
};

/** Parse a quantity ("1.5", "1,5") into thousandths. */
export const parseQuantity = (input: string, locale: string): number | null =>
  parseDecimal(input, locale, 3);

const parseDecimal = (
  input: string,
  locale: string,
  maxDecimals: number,
): number | null => {
  const dec = decimalSeparator(locale);
  let s = input.replace(/[\s  ]/g, '').replace(/[^\d.,\-−]/g, '');
  const negative = /^[-−]/.test(s);
  s = s.replace(/[-−]/g, '');
  if (s === '') {
    return null;
  }

  const other = dec === '.' ? ',' : '.';
  const lastDec = s.lastIndexOf(dec);
  const lastOther = s.lastIndexOf(other);

  let decimalIndex = lastDec;
  if (lastDec === -1 && lastOther !== -1) {
    // Only the other separator present: treat it as decimal when it appears
    // once and is followed by 1..maxDecimals digits ("12.5" in de-DE).
    // Exactly three digits is read as grouping ("1.500" in de-DE is 1500),
    // matching how people in that locale write numbers.
    const after = s.length - lastOther - 1;
    const count = s.split(other).length - 1;
    if (count === 1 && after > 0 && after <= maxDecimals && after !== 3) {
      decimalIndex = lastOther;
    }
  }

  let whole = s;
  let frac = '';
  if (decimalIndex !== -1) {
    whole = s.slice(0, decimalIndex);
    frac = s.slice(decimalIndex + 1);
  }
  whole = whole.replace(/[.,]/g, '');
  if (/[.,]/.test(frac) || frac.length > maxDecimals) {
    return null;
  }
  if (whole === '' && frac === '') {
    return null;
  }
  const scaled = Number((whole || '0') + frac.padEnd(maxDecimals, '0'));
  if (!Number.isSafeInteger(scaled)) {
    return null;
  }
  return negative ? -scaled : scaled;
};
