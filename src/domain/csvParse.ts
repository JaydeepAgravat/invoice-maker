/**
 * RFC 4180 CSV reader that copes with what spreadsheets and other invoicing
 * apps actually export: a UTF-8 BOM, `;` or tab separators (detected from
 * the header), quoted fields with embedded separators, quotes and newlines,
 * CRLF or LF line ends, and trailing blank lines.
 */
export type CsvTable = { headers: string[]; rows: string[][]; separator: string };

const SEPARATORS = [',', ';', '\t'] as const;

/** Most frequent separator outside quotes in the first line. */
export function detectSeparator(text: string): string {
  const firstLine: string[] = [];
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      break;
    } else if (!quoted) {
      firstLine.push(ch);
    }
  }
  let best: string = ',';
  let bestCount = 0;
  for (const sep of SEPARATORS) {
    const count = firstLine.filter(c => c === sep).length;
    if (count > bestCount) {
      best = sep;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, separator?: string): CsvTable {
  const text = input.replace(/^﻿/, '');
  const sep = separator ?? detectSeparator(text);
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === sep) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter(r => r.some(c => c.trim() !== ''));
  const [headers = [], ...rows] = nonEmpty;
  return {
    headers: headers.map(h => h.trim()),
    rows: rows.map(r => r.map(c => c.trim())),
    separator: sep,
  };
}
