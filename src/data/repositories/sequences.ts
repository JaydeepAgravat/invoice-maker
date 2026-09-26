import { yearOf, type ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';
import {
  formatDocumentNumber,
  sequenceKey,
  validateNextValue,
  type NumberingFormat,
  type NumberingStyle,
} from '@/domain/numbering';

import { reqNum, reqStr, type Executor } from '../db/types';

export type Sequence = NumberingFormat & {
  docType: DocType;
  nextValue: number;
};

/** The per-type settings row (key = doc type). Yearly counters branch off it. */
export async function getSequence(
  db: Executor,
  type: DocType,
): Promise<Sequence> {
  const { rows } = await db.execute(
    'SELECT * FROM number_sequences WHERE key = ?',
    [type],
  );
  const r = rows[0];
  if (!r) {
    return {
      docType: type,
      prefix: type.slice(0, 3),
      pad: 4,
      style: 'SEQUENTIAL',
      nextValue: 1,
    };
  }
  return {
    docType: type,
    prefix: reqStr(r.prefix),
    pad: reqNum(r.pad),
    style: reqStr(r.style) as NumberingStyle,
    nextValue: reqNum(r.next_value),
  };
}

const counterFor = async (
  db: Executor,
  type: DocType,
  style: NumberingStyle,
  year: number,
) => {
  const key = sequenceKey(type, style, year);
  const { rows } = await db.execute(
    'SELECT next_value FROM number_sequences WHERE key = ?',
    [key],
  );
  return {
    key,
    next: rows[0] ? reqNum(rows[0].next_value) : 1,
    exists: rows.length > 0,
  };
};

/** What the next number will look like, without consuming it. */
export async function previewNumber(
  db: Executor,
  type: DocType,
  issueDate: ISODate,
): Promise<string> {
  const seq = await getSequence(db, type);
  const year = yearOf(issueDate);
  const { next } = await counterFor(db, type, seq.style, year);
  return formatDocumentNumber(seq, next, year);
}

/**
 * Consume the next number. Must run inside the transaction that saves the
 * document, so a number is never assigned twice or skipped on failure.
 */
export async function assignNumber(
  tx: Executor,
  type: DocType,
  issueDate: ISODate,
): Promise<{ number: string; key: string; value: number }> {
  const seq = await getSequence(tx, type);
  const year = yearOf(issueDate);
  const counter = await counterFor(tx, type, seq.style, year);
  let value = counter.next;
  // Skip values already taken (e.g. imported documents) so numbers stay unique.
  for (;;) {
    const number = formatDocumentNumber(seq, value, year);
    const taken = await tx.execute(
      'SELECT 1 FROM documents WHERE doc_type = ? AND number = ?',
      [type, number],
    );
    if (taken.rows.length === 0) {
      break;
    }
    value++;
  }
  if (counter.exists) {
    await tx.execute(
      'UPDATE number_sequences SET next_value = ? WHERE key = ?',
      [value + 1, counter.key],
    );
  } else {
    await tx.execute(
      'INSERT INTO number_sequences (key, doc_type, prefix, pad, style, next_value) VALUES (?, ?, ?, ?, ?, ?)',
      [counter.key, type, seq.prefix, seq.pad, seq.style, value + 1],
    );
  }
  return {
    number: formatDocumentNumber(seq, value, year),
    key: counter.key,
    value,
  };
}

export class NumberingError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Update prefix/padding/style and, optionally, the next number of the current counter. */
export async function updateSequence(
  db: Executor,
  type: DocType,
  patch: Partial<NumberingFormat> & { nextValue?: number },
  currentYear: number,
): Promise<void> {
  const current = await getSequence(db, type);
  const next = { ...current, ...patch };
  await db.execute(
    `INSERT INTO number_sequences (key, doc_type, prefix, pad, style, next_value) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET prefix = excluded.prefix, pad = excluded.pad, style = excluded.style`,
    [
      type,
      type,
      next.prefix.trim(),
      Math.max(1, Math.min(next.pad, 10)),
      next.style,
    ],
  );
  await db.execute(
    'UPDATE number_sequences SET prefix = ?, pad = ? WHERE doc_type = ?',
    [next.prefix.trim(), Math.max(1, Math.min(next.pad, 10)), type],
  );

  if (patch.nextValue !== undefined) {
    const key = sequenceKey(type, next.style, currentYear);
    const { rows } = await db.execute(
      'SELECT COALESCE(MAX(sequence_value), 0) AS m FROM documents WHERE sequence_key = ?',
      [key],
    );
    const error = validateNextValue(patch.nextValue, reqNum(rows[0]!.m));
    if (error) {
      throw new NumberingError(error);
    }
    await db.execute(
      `INSERT INTO number_sequences (key, doc_type, prefix, pad, style, next_value) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET next_value = excluded.next_value`,
      [key, type, next.prefix.trim(), next.pad, next.style, patch.nextValue],
    );
  }
}
