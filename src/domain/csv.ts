/**
 * CSV that opens correctly in Excel, Numbers and Google Sheets: UTF-8 with a
 * byte-order mark, CRLF line ends, quoted where needed. Where the decimal
 * separator is a comma (most of Europe and Brazil), Excel expects `;`.
 */
export type Cell = string | number | null | undefined;

export const csvSeparator = (decimalSeparator: string) =>
  decimalSeparator === ',' ? ';' : ',';

const quote = (value: string, sep: string) =>
  /["\r\n]/.test(value) || value.includes(sep) || /^\s|\s$/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;

export function toCsv(
  rows: readonly (readonly Cell[])[],
  opts: { separator?: string; decimalSeparator?: string } = {},
): string {
  const sep = opts.separator ?? ',';
  const dec = opts.decimalSeparator ?? '.';
  const cell = (v: Cell) => {
    if (v === null || v === undefined) {
      return '';
    }
    if (typeof v === 'number') {
      return quote(String(v).replace('.', dec), sep);
    }
    // Guard against formula injection when opened in a spreadsheet.
    const safe = /^[=+\-@\t]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
    return quote(safe, sep);
  };
  return '﻿' + rows.map(r => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}

/** Minor units → plain decimal number for spreadsheets (no symbols, no grouping). */
export const minorToDecimal = (minor: number, digits: number) =>
  Number((minor / 10 ** digits).toFixed(digits));
