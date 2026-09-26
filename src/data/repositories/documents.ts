import {
  calculate,
  type CalcResult,
  type Discount,
  type TaxKind,
} from '@/domain/calc';
import { addDays, type ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';
import type { RoundingMode } from '@/domain/fraction';
import {
  allowedActions,
  displayStatus,
  nextStoredStatus,
  type DisplayStatus,
  type DocAction,
  type StoredStatus,
} from '@/domain/status';

import type { Clock } from '../clock';
import {
  num,
  reqNum,
  reqStr,
  str,
  type Executor,
  type Row,
  type SqlValue,
} from '../db/types';
import { uuidv7 } from '../ids';

import { getClient } from './clients';
import { createItem } from './items';
import { getProfile } from './profile';
import { assignNumber } from './sequences';
import { defaultTaxRates, getTaxRates } from './taxRates';

/* ────────────────────────────── Types ────────────────────────────── */

/** A tax as frozen on a line. Editing the tax rate later never changes it. */
export type LineTaxSnapshot = {
  taxRateId: string | null;
  name: string;
  rate: number;
  kind: TaxKind;
};

export type LineDraft = {
  id?: string;
  kind?: 'ITEM' | 'CHARGE';
  itemId?: string | null;
  name: string;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: Discount | null;
  taxes: LineTaxSnapshot[];
  /** Add this line to the item catalog on save (off by default). */
  saveToCatalog?: boolean;
};

export type DocumentFields = {
  type: DocType;
  clientId: string | null;
  title: string | null;
  reference: string | null;
  issueDate: ISODate;
  dueDate: ISODate | null;
  supplyDate: ISODate | null;
  validUntil: ISODate | null;
  termsDays: number | null;
  statementFrom: ISODate | null;
  statementTo: ISODate | null;
  currency: string;
  language: string;
  pricesIncludeTax: boolean;
  rounding: 'PER_LINE' | 'PER_TOTAL';
  roundingMode: RoundingMode;
  discount: Discount | null;
  notes: string | null;
  terms: string | null;
  footer: string | null;
  templateId: string | null;
  accentColor: string | null;
  paperSize: 'A4' | 'LETTER' | null;
  paymentMethodIds: string[];
  sourceDocumentId: string | null;
};

export type DocumentDraft = DocumentFields & { id: string; lines: LineDraft[] };

export type LineRecord = Required<Omit<LineDraft, 'saveToCatalog'>> & {
  id: string;
  gross: number;
  net: number;
  base: number;
  total: number;
  taxAmounts: number[];
};

export type Payment = {
  id: string;
  documentId: string;
  amount: number;
  paidOn: ISODate;
  method: string | null;
  reference: string | null;
  note: string | null;
  createdAt: number;
};

export type DocumentRecord = DocumentFields & {
  id: string;
  number: string | null;
  status: StoredStatus;
  clientSnapshot: Record<string, unknown> | null;
  businessSnapshot: Record<string, unknown> | null;
  revision: number;
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  lines: LineRecord[];
  payments: Payment[];
  totals: CalcResult;
};

/* ─────────────────────────── Calculation ─────────────────────────── */

/** Stable identity of a tax across lines, used to group the tax breakdown. */
export const taxIdentity = (t: LineTaxSnapshot) =>
  t.taxRateId ?? `${t.name}|${t.rate}|${t.kind}`;

/** A tax applied twice to one line is a mistake; keep the first. */
const uniqueTaxes = (taxes: readonly LineTaxSnapshot[]) => {
  const seen = new Set<string>();
  return taxes.filter(t => {
    const key = `${taxIdentity(t)}|${t.rate}|${t.kind}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
};

export const calculateDraft = (
  d: Pick<
    DocumentDraft,
    'lines' | 'discount' | 'pricesIncludeTax' | 'rounding' | 'roundingMode'
  >,
  paid = 0,
): CalcResult => {
  const toInput = (l: LineDraft, i: number) => ({
    id: l.id ?? `line-${i}`,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount ?? null,
    taxes: uniqueTaxes(l.taxes).map(t => ({
      id: taxIdentity(t),
      name: t.name,
      rate: t.rate,
      kind: t.kind,
    })),
  });
  const items = d.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => (l.kind ?? 'ITEM') === 'ITEM');
  const charges = d.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.kind === 'CHARGE');
  return calculate({
    lines: items.map(({ l, i }) => toInput(l, i)),
    charges: charges.map(({ l, i }) => toInput(l, i)),
    discount: d.discount,
    pricesIncludeTax: d.pricesIncludeTax,
    rounding: d.rounding,
    roundingMode: d.roundingMode,
    paid,
  });
};

/* ────────────────────────────── Reads ────────────────────────────── */

const parseJson = <T>(v: SqlValue | undefined): T | null => {
  const s = str(v);
  return s ? (JSON.parse(s) as T) : null;
};

const discountOf = (
  type: SqlValue | undefined,
  value: SqlValue | undefined,
): Discount | null => {
  const t = str(type);
  if (t === 'PERCENT') {
    return { type: 'PERCENT', rate: reqNum(value) };
  }
  if (t === 'AMOUNT') {
    return { type: 'AMOUNT', amount: reqNum(value) };
  }
  return null;
};

const discountCols = (d: Discount | null): [string | null, number | null] =>
  !d
    ? [null, null]
    : d.type === 'PERCENT'
    ? ['PERCENT', d.rate]
    : ['AMOUNT', d.amount];

const fieldsOf = (r: Row): DocumentFields => ({
  type: reqStr(r.doc_type) as DocType,
  clientId: str(r.client_id),
  title: str(r.title),
  reference: str(r.reference),
  issueDate: reqStr(r.issue_date),
  dueDate: str(r.due_date),
  supplyDate: str(r.supply_date),
  validUntil: str(r.valid_until),
  termsDays: num(r.terms_days),
  statementFrom: str(r.statement_from),
  statementTo: str(r.statement_to),
  currency: reqStr(r.currency),
  language: reqStr(r.language),
  pricesIncludeTax: r.prices_include_tax === 1,
  rounding: reqStr(r.rounding) as DocumentFields['rounding'],
  roundingMode: reqStr(r.rounding_mode) as RoundingMode,
  discount: discountOf(r.discount_type, r.discount_value),
  notes: str(r.notes),
  terms: str(r.terms),
  footer: str(r.footer),
  templateId: str(r.template_id),
  accentColor: str(r.accent_color),
  paperSize: str(r.paper_size) as DocumentFields['paperSize'],
  paymentMethodIds: parseJson<string[]>(r.payment_method_ids_json) ?? [],
  sourceDocumentId: str(r.source_document_id),
});

const mapPayment = (r: Row): Payment => ({
  id: reqStr(r.id),
  documentId: reqStr(r.document_id),
  amount: reqNum(r.amount_minor),
  paidOn: reqStr(r.paid_on),
  method: str(r.method),
  reference: str(r.reference),
  note: str(r.note),
  createdAt: reqNum(r.created_at),
});

export async function getDocument(
  db: Executor,
  id: string,
): Promise<DocumentRecord | null> {
  const { rows } = await db.execute('SELECT * FROM documents WHERE id = ?', [
    id,
  ]);
  const r = rows[0];
  if (!r) {
    return null;
  }
  const lineRows = (
    await db.execute(
      'SELECT * FROM document_lines WHERE document_id = ? ORDER BY position',
      [id],
    )
  ).rows;
  const taxRows = (
    await db.execute(
      `SELECT t.* FROM document_line_taxes t JOIN document_lines l ON l.id = t.line_id
       WHERE l.document_id = ? ORDER BY t.line_id, t.position`,
      [id],
    )
  ).rows;
  const taxesByLine = new Map<string, Row[]>();
  taxRows.forEach(t => {
    const key = reqStr(t.line_id);
    taxesByLine.set(key, [...(taxesByLine.get(key) ?? []), t]);
  });

  const lines: LineRecord[] = lineRows.map(l => {
    const taxes = taxesByLine.get(reqStr(l.id)) ?? [];
    return {
      id: reqStr(l.id),
      kind: reqStr(l.kind) as 'ITEM' | 'CHARGE',
      itemId: str(l.item_id),
      name: reqStr(l.name),
      description: str(l.description),
      unit: str(l.unit),
      quantity: reqNum(l.quantity_milli),
      unitPrice: reqNum(l.unit_price_minor),
      discount: discountOf(l.discount_type, l.discount_value),
      taxes: taxes.map(t => ({
        taxRateId: str(t.tax_rate_id),
        name: reqStr(t.name),
        rate: reqNum(t.rate_ppm),
        kind: reqStr(t.kind) as TaxKind,
      })),
      taxAmounts: taxes.map(t => reqNum(t.amount_minor)),
      gross: reqNum(l.gross_minor),
      net: reqNum(l.net_minor),
      base: reqNum(l.base_minor),
      total: reqNum(l.total_minor),
    };
  });

  const payments = (
    await db.execute(
      'SELECT * FROM payments WHERE document_id = ? ORDER BY paid_on, created_at',
      [id],
    )
  ).rows.map(mapPayment);

  const fields = fieldsOf(r);
  return {
    ...fields,
    id,
    number: str(r.number),
    status: reqStr(r.status) as StoredStatus,
    clientSnapshot: parseJson(r.client_snapshot_json),
    businessSnapshot: parseJson(r.business_snapshot_json),
    revision: reqNum(r.revision),
    sentAt: num(r.sent_at),
    createdAt: reqNum(r.created_at),
    updatedAt: reqNum(r.updated_at),
    deletedAt: num(r.deleted_at),
    lines,
    payments,
    totals: calculateDraft({ ...fields, lines }, reqNum(r.paid_minor)),
  };
}

export const toDraft = (doc: DocumentRecord): DocumentDraft => {
  const fields: DocumentFields = {
    type: doc.type,
    clientId: doc.clientId,
    title: doc.title,
    reference: doc.reference,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    supplyDate: doc.supplyDate,
    validUntil: doc.validUntil,
    termsDays: doc.termsDays,
    statementFrom: doc.statementFrom,
    statementTo: doc.statementTo,
    currency: doc.currency,
    language: doc.language,
    pricesIncludeTax: doc.pricesIncludeTax,
    rounding: doc.rounding,
    roundingMode: doc.roundingMode,
    discount: doc.discount,
    notes: doc.notes,
    terms: doc.terms,
    footer: doc.footer,
    templateId: doc.templateId,
    accentColor: doc.accentColor,
    paperSize: doc.paperSize,
    paymentMethodIds: doc.paymentMethodIds,
    sourceDocumentId: doc.sourceDocumentId,
  };
  return {
    ...fields,
    id: doc.id,
    lines: doc.lines.map(l => ({
      id: l.id,
      kind: l.kind,
      itemId: l.itemId,
      name: l.name,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      taxes: l.taxes,
    })),
  };
};

/* ────────────────────────────── Writes ───────────────────────────── */

const log = (
  db: Executor,
  clock: Clock,
  documentId: string,
  kind: string,
  payload?: unknown,
) =>
  db.execute(
    'INSERT INTO activity_log (id, document_id, kind, payload_json, at) VALUES (?, ?, ?, ?, ?)',
    [
      uuidv7(clock.now()),
      documentId,
      kind,
      payload === undefined ? null : JSON.stringify(payload),
      clock.now(),
    ],
  );

/** Snapshot the business's current default taxes for a new line. */
export async function defaultLineTaxes(
  db: Executor,
): Promise<LineTaxSnapshot[]> {
  return (await defaultTaxRates(db))
    .filter(t => t.kind !== 'WITHHOLDING')
    .map(t => ({ taxRateId: t.id, name: t.name, rate: t.rate, kind: t.kind }));
}

/** Resolve tax rate ids (from the catalog) into line snapshots. */
export async function snapshotTaxes(
  db: Executor,
  ids: readonly string[],
): Promise<LineTaxSnapshot[]> {
  return (await getTaxRates(db, ids)).map(t => ({
    taxRateId: t.id,
    name: t.name,
    rate: t.rate,
    kind: t.kind,
  }));
}

/**
 * Create an empty draft with defaults from the business profile and client.
 * Drafts have no number: numbers are assigned when a document is issued, so
 * abandoned drafts never leave gaps in the sequence.
 */
export async function createDraft(
  db: Executor,
  clock: Clock,
  type: DocType,
  opts: { clientId?: string | null; sourceDocumentId?: string | null } = {},
): Promise<DocumentRecord> {
  const profile = await getProfile(db);
  const client = opts.clientId ? await getClient(db, opts.clientId) : null;
  const today = clock.today();
  const termsDays = client?.defaultTermsDays ?? profile.defaultTermsDays;
  const hasDue = type === 'INVOICE';
  const hasValidity = type === 'ESTIMATE' || type === 'CHANGE_ORDER';

  const draft: DocumentDraft = {
    id: uuidv7(clock.now()),
    type,
    clientId: client?.id ?? null,
    title: null,
    reference: null,
    issueDate: today,
    dueDate: hasDue ? addDays(today, termsDays) : null,
    supplyDate: null,
    validUntil: hasValidity ? addDays(today, 30) : null,
    termsDays: hasDue ? termsDays : null,
    statementFrom: type === 'STATEMENT' ? addDays(today, -90) : null,
    statementTo: type === 'STATEMENT' ? today : null,
    currency: client?.currency ?? profile.currency,
    language: client?.language ?? profile.language,
    pricesIncludeTax: profile.pricesIncludeTax,
    rounding: profile.rounding,
    roundingMode: profile.roundingMode,
    discount: null,
    notes: profile.defaultNotes,
    terms: profile.defaultTerms,
    footer: profile.defaultFooter,
    templateId: profile.templateId,
    accentColor: profile.accentColor,
    paperSize: profile.paperSize,
    paymentMethodIds: [],
    sourceDocumentId: opts.sourceDocumentId ?? null,
    lines: [],
  };
  return saveDocument(db, clock, draft);
}

const FIELD_COLUMNS = `doc_type, client_id, title, reference, issue_date, due_date, supply_date, valid_until, terms_days,
  statement_from, statement_to, currency, language, prices_include_tax, rounding, rounding_mode, discount_type,
  discount_value, notes, terms, footer, template_id, accent_color, paper_size, payment_method_ids_json,
  source_document_id, subtotal_minor, discount_minor, tax_total_minor, withholding_minor, total_minor`;

const fieldValues = (d: DocumentDraft, totals: CalcResult): SqlValue[] => {
  const [dt, dv] = discountCols(d.discount);
  return [
    d.type,
    d.clientId,
    d.title,
    d.reference,
    d.issueDate,
    d.dueDate,
    d.supplyDate,
    d.validUntil,
    d.termsDays,
    d.statementFrom,
    d.statementTo,
    d.currency,
    d.language,
    d.pricesIncludeTax ? 1 : 0,
    d.rounding,
    d.roundingMode,
    dt,
    dv,
    d.notes,
    d.terms,
    d.footer,
    d.templateId,
    d.accentColor,
    d.paperSize,
    JSON.stringify(d.paymentMethodIds),
    d.sourceDocumentId,
    totals.subtotal,
    totals.documentDiscount,
    totals.taxTotal,
    totals.withholdingTotal,
    totals.total,
  ];
};

/**
 * Save the whole document: header, lines, frozen taxes and cached totals.
 * Editing an issued document is allowed but recorded: the previous version
 * is kept as a revision and the activity log notes the change.
 */
export async function saveDocument(
  db: Executor,
  clock: Clock,
  draft: DocumentDraft,
): Promise<DocumentRecord> {
  const now = clock.now();
  const existing = await getDocument(db, draft.id);
  if (existing?.deletedAt) {
    throw new Error('Cannot edit a deleted document');
  }
  if (existing && existing.type !== draft.type) {
    throw new Error('Document type cannot change; duplicate instead');
  }

  // Save-to-catalog lines become items first so the line links to them.
  const lines: LineDraft[] = [];
  for (const line of draft.lines) {
    if (line.saveToCatalog && !line.itemId && line.name.trim()) {
      const item = await createItem(db, clock, {
        name: line.name,
        description: line.description ?? null,
        unit: line.unit ?? null,
        unitPrice: line.unitPrice,
        sku: null,
        taxRateIds: line.taxes
          .map(t => t.taxRateId)
          .filter((x): x is string => !!x),
      });
      lines.push({ ...line, itemId: item.id, saveToCatalog: false });
    } else {
      lines.push(line);
    }
  }
  const doc: DocumentDraft = {
    ...draft,
    lines: lines.map(l => ({
      ...l,
      id: l.id ?? uuidv7(now),
      taxes: uniqueTaxes(l.taxes),
    })),
  };
  const paid = existing ? existing.totals.paid : 0;
  const totals = calculateDraft(doc, paid);

  if (existing) {
    if (existing.status !== 'DRAFT') {
      await db.execute(
        'INSERT INTO document_revisions (id, document_id, revision, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          uuidv7(now),
          doc.id,
          existing.revision,
          JSON.stringify(toDraft(existing)),
          now,
        ],
      );
      await log(db, clock, doc.id, 'REVISED', {
        revision: existing.revision + 1,
      });
    }
    const assignments = FIELD_COLUMNS.split(',')
      .map(c => `${c.trim()} = ?`)
      .join(', ');
    await db.execute(
      `UPDATE documents SET ${assignments}, revision = revision + ?, updated_at = ? WHERE id = ?`,
      [
        ...fieldValues(doc, totals),
        existing.status === 'DRAFT' ? 0 : 1,
        now,
        doc.id,
      ],
    );
    await db.execute('DELETE FROM document_lines WHERE document_id = ?', [
      doc.id,
    ]);
  } else {
    await db.execute(
      `INSERT INTO documents (id, status, created_at, updated_at, ${FIELD_COLUMNS})
       VALUES (?, 'DRAFT', ?, ?, ${FIELD_COLUMNS.split(',')
         .map(() => '?')
         .join(', ')})`,
      [doc.id, now, now, ...fieldValues(doc, totals)],
    );
    await log(db, clock, doc.id, 'CREATED');
  }

  const resultById = new Map(totals.lines.map(l => [l.id, l]));
  for (const [position, line] of doc.lines.entries()) {
    const res = resultById.get(line.id!)!;
    const [dt, dv] = discountCols(line.discount ?? null);
    await db.execute(
      `INSERT INTO document_lines (id, document_id, position, kind, item_id, name, description, unit, quantity_milli,
         unit_price_minor, discount_type, discount_value, gross_minor, net_minor, base_minor, total_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.id!,
        doc.id,
        position,
        line.kind ?? 'ITEM',
        line.itemId ?? null,
        line.name,
        line.description ?? null,
        line.unit ?? null,
        line.quantity,
        line.unitPrice,
        dt,
        dv,
        res.gross,
        res.net,
        res.base,
        res.total,
      ],
    );
    for (const [i, tax] of line.taxes.entries()) {
      await db.execute(
        `INSERT INTO document_line_taxes (line_id, position, tax_rate_id, name, rate_ppm, kind, amount_minor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          line.id!,
          i,
          tax.taxRateId,
          tax.name,
          tax.rate,
          tax.kind,
          res.taxes.find(x => x.id === taxIdentity(tax))?.amount ?? 0,
        ],
      );
    }
  }

  await indexForSearch(db, doc.id);
  return (await getDocument(db, doc.id))!;
}

/** Issue a document: assign its number (first time), freeze client and business details, mark sent. */
export async function issueDocument(
  db: Executor,
  clock: Clock,
  id: string,
  opts: { channel?: string } = {},
): Promise<DocumentRecord> {
  const doc = await getDocument(db, id);
  if (!doc || doc.deletedAt) {
    throw new Error('Document not found');
  }
  if (doc.status === 'VOID') {
    throw new Error('A void document cannot be issued');
  }
  const now = clock.now();
  const assigned = doc.number
    ? null
    : await assignNumber(db, doc.type, doc.issueDate);
  const client = doc.clientId ? await getClient(db, doc.clientId) : null;
  const profile = await getProfile(db);
  const status = nextStoredStatus('SEND', doc.status) ?? doc.status;

  await db.execute(
    `UPDATE documents SET number = COALESCE(number, ?), sequence_key = COALESCE(sequence_key, ?),
       sequence_value = COALESCE(sequence_value, ?), status = ?, client_snapshot_json = ?,
       business_snapshot_json = ?, sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ?`,
    [
      assigned?.number ?? null,
      assigned?.key ?? null,
      assigned?.value ?? null,
      status,
      client ? JSON.stringify(client) : null,
      JSON.stringify(profile),
      now,
      now,
      id,
    ],
  );
  await log(db, clock, id, 'SENT', {
    channel: opts.channel ?? null,
    number: assigned?.number ?? doc.number,
  });
  await indexForSearch(db, id);
  return (await getDocument(db, id))!;
}

export class ActionNotAllowedError extends Error {
  constructor(readonly action: DocAction, readonly status: DisplayStatus) {
    super(`${action} is not allowed when the document is ${status}`);
  }
}

export const statusOf = (doc: DocumentRecord, today: ISODate): DisplayStatus =>
  displayStatus({
    type: doc.type,
    stored: doc.status,
    total: doc.totals.total,
    paid: doc.totals.paid,
    dueDate: doc.dueDate,
    validUntil: doc.validUntil,
    today,
  });

/** Accept, decline, void, mark delivered/received. */
export async function applyAction(
  db: Executor,
  clock: Clock,
  id: string,
  action: Extract<
    DocAction,
    'ACCEPT' | 'DECLINE' | 'VOID' | 'MARK_DELIVERED' | 'MARK_RECEIVED'
  >,
): Promise<DocumentRecord> {
  const doc = await getDocument(db, id);
  if (!doc) {
    throw new Error('Document not found');
  }
  const status = statusOf(doc, clock.today());
  if (!allowedActions(doc.type, status).includes(action)) {
    throw new ActionNotAllowedError(action, status);
  }
  const next = nextStoredStatus(action, doc.status)!;
  await db.execute(
    'UPDATE documents SET status = ?, updated_at = ? WHERE id = ?',
    [next, clock.now(), id],
  );
  await log(db, clock, id, action);
  return (await getDocument(db, id))!;
}

/* ───────────────────────────── Payments ──────────────────────────── */

const syncPaid = async (db: Executor, clock: Clock, documentId: string) => {
  await db.execute(
    `UPDATE documents SET paid_minor = (SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE document_id = ?),
       updated_at = ? WHERE id = ?`,
    [documentId, clock.now(), documentId],
  );
};

export async function recordPayment(
  db: Executor,
  clock: Clock,
  documentId: string,
  input: {
    amount: number;
    paidOn: ISODate;
    method?: string | null;
    reference?: string | null;
    note?: string | null;
  },
): Promise<DocumentRecord> {
  const doc = await getDocument(db, documentId);
  if (!doc) {
    throw new Error('Document not found');
  }
  const status = statusOf(doc, clock.today());
  if (!allowedActions(doc.type, status).includes('RECORD_PAYMENT')) {
    throw new ActionNotAllowedError('RECORD_PAYMENT', status);
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new RangeError('Payment amount must be positive');
  }
  const now = clock.now();
  await db.execute(
    `INSERT INTO payments (id, document_id, amount_minor, paid_on, method, reference, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv7(now),
      documentId,
      input.amount,
      input.paidOn,
      input.method ?? null,
      input.reference ?? null,
      input.note ?? null,
      now,
    ],
  );
  await syncPaid(db, clock, documentId);
  await log(db, clock, documentId, 'PAYMENT', {
    amount: input.amount,
    paidOn: input.paidOn,
  });
  return (await getDocument(db, documentId))!;
}

export async function deletePayment(
  db: Executor,
  clock: Clock,
  paymentId: string,
): Promise<void> {
  const { rows } = await db.execute(
    'SELECT document_id FROM payments WHERE id = ?',
    [paymentId],
  );
  if (!rows[0]) {
    return;
  }
  const documentId = reqStr(rows[0].document_id);
  await db.execute('DELETE FROM payments WHERE id = ?', [paymentId]);
  await syncPaid(db, clock, documentId);
  await log(db, clock, documentId, 'PAYMENT_REMOVED', { paymentId });
}

/* ───────────────────────── Derived documents ─────────────────────── */

const copyLines = (
  lines: readonly LineRecord[] | readonly LineDraft[],
): LineDraft[] =>
  lines.map(l => ({
    kind: l.kind ?? 'ITEM',
    itemId: l.itemId ?? null,
    name: l.name,
    description: l.description ?? null,
    unit: l.unit ?? null,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount ?? null,
    taxes: l.taxes,
  }));

const copyAttachments = async (
  db: Executor,
  clock: Clock,
  fromId: string,
  toId: string,
) => {
  const { rows } = await db.execute(
    "SELECT * FROM attachments WHERE document_id = ? AND kind = 'PHOTO'",
    [fromId],
  );
  for (const a of rows) {
    await db.execute(
      `INSERT INTO attachments (id, document_id, kind, path, width, height, caption, position, created_at)
       VALUES (?, ?, 'PHOTO', ?, ?, ?, ?, ?, ?)`,
      [
        uuidv7(clock.now()),
        toId,
        a.path!,
        a.width ?? null,
        a.height ?? null,
        a.caption ?? null,
        a.position ?? 0,
        clock.now(),
      ],
    );
  }
};

/** Copy into a fresh draft (today's dates, no number, no payments). */
export async function duplicateDocument(
  db: Executor,
  clock: Clock,
  id: string,
  opts: { type?: DocType } = {},
): Promise<DocumentRecord> {
  const source = await getDocument(db, id);
  if (!source) {
    throw new Error('Document not found');
  }
  const fresh = await createDraft(db, clock, opts.type ?? source.type, {
    clientId: source.clientId,
  });
  const base = toDraft(source);
  return saveDocument(db, clock, {
    ...base,
    id: fresh.id,
    type: fresh.type,
    issueDate: fresh.issueDate,
    dueDate: fresh.dueDate,
    validUntil: fresh.validUntil,
    termsDays: fresh.termsDays,
    supplyDate: null,
    sourceDocumentId: opts.type ? source.id : null,
    lines: copyLines(source.lines),
  });
}

/**
 * Estimate → invoice. The invoice carries the estimate's lines plus the lines
 * of every accepted change order, and its photos. The estimate is marked
 * converted and linked.
 */
export async function convertEstimateToInvoice(
  db: Executor,
  clock: Clock,
  estimateId: string,
): Promise<DocumentRecord> {
  const estimate = await getDocument(db, estimateId);
  if (!estimate || estimate.type !== 'ESTIMATE') {
    throw new Error('Estimate not found');
  }
  const status = statusOf(estimate, clock.today());
  if (!allowedActions('ESTIMATE', status).includes('CONVERT_TO_INVOICE')) {
    throw new ActionNotAllowedError('CONVERT_TO_INVOICE', status);
  }
  const changeOrders = await listDerived(db, estimateId, 'CHANGE_ORDER');
  const accepted = changeOrders.filter(c => c.status === 'ACCEPTED');

  const invoice = await createDraft(db, clock, 'INVOICE', {
    clientId: estimate.clientId,
    sourceDocumentId: estimateId,
  });
  const saved = await saveDocument(db, clock, {
    ...toDraft(invoice),
    currency: estimate.currency,
    language: estimate.language,
    pricesIncludeTax: estimate.pricesIncludeTax,
    discount: estimate.discount,
    notes: estimate.notes,
    reference: estimate.number,
    lines: [
      ...copyLines(estimate.lines),
      ...accepted.flatMap(c => copyLines(c.lines)),
    ],
  });
  await copyAttachments(db, clock, estimateId, saved.id);
  await db.execute(
    "UPDATE documents SET status = 'CONVERTED', updated_at = ? WHERE id = ?",
    [clock.now(), estimateId],
  );
  await log(db, clock, estimateId, 'CONVERTED', { invoiceId: saved.id });
  return (await getDocument(db, saved.id))!;
}

export async function createChangeOrder(
  db: Executor,
  clock: Clock,
  estimateId: string,
): Promise<DocumentRecord> {
  const estimate = await getDocument(db, estimateId);
  if (!estimate || estimate.type !== 'ESTIMATE') {
    throw new Error('Estimate not found');
  }
  const status = statusOf(estimate, clock.today());
  if (!allowedActions('ESTIMATE', status).includes('CREATE_CHANGE_ORDER')) {
    throw new ActionNotAllowedError('CREATE_CHANGE_ORDER', status);
  }
  const co = await createDraft(db, clock, 'CHANGE_ORDER', {
    clientId: estimate.clientId,
    sourceDocumentId: estimateId,
  });
  return saveDocument(db, clock, {
    ...toDraft(co),
    currency: estimate.currency,
    language: estimate.language,
    pricesIncludeTax: estimate.pricesIncludeTax,
    reference: estimate.number,
  });
}

/** Credit note for an invoice: same lines, positive amounts, linked. */
export async function createCreditNote(
  db: Executor,
  clock: Clock,
  invoiceId: string,
): Promise<DocumentRecord> {
  const invoice = await getDocument(db, invoiceId);
  if (!invoice || invoice.type !== 'INVOICE') {
    throw new Error('Invoice not found');
  }
  const status = statusOf(invoice, clock.today());
  if (!allowedActions('INVOICE', status).includes('CREATE_CREDIT_NOTE')) {
    throw new ActionNotAllowedError('CREATE_CREDIT_NOTE', status);
  }
  const cn = await createDraft(db, clock, 'CREDIT_NOTE', {
    clientId: invoice.clientId,
    sourceDocumentId: invoiceId,
  });
  return saveDocument(db, clock, {
    ...toDraft(cn),
    currency: invoice.currency,
    language: invoice.language,
    pricesIncludeTax: invoice.pricesIncludeTax,
    discount: invoice.discount,
    reference: invoice.number,
    lines: copyLines(invoice.lines),
  });
}

export async function listDerived(
  db: Executor,
  sourceId: string,
  type?: DocType,
): Promise<DocumentRecord[]> {
  const { rows } = await db.execute(
    `SELECT id FROM documents WHERE source_document_id = ? AND deleted_at IS NULL ${
      type ? 'AND doc_type = ?' : ''
    }
     ORDER BY created_at`,
    type ? [sourceId, type] : [sourceId],
  );
  const docs = await Promise.all(rows.map(r => getDocument(db, reqStr(r.id))));
  return docs.filter((d): d is DocumentRecord => d !== null);
}

/* ─────────────────────────── Delete / restore ────────────────────── */

/** Only drafts can be deleted (soft, restorable for 30 days). Issued documents are voided instead. */
export async function deleteDraft(
  db: Executor,
  clock: Clock,
  id: string,
): Promise<void> {
  const doc = await getDocument(db, id);
  if (!doc) {
    return;
  }
  if (doc.status !== 'DRAFT') {
    throw new ActionNotAllowedError('DELETE', statusOf(doc, clock.today()));
  }
  await db.execute('UPDATE documents SET deleted_at = ? WHERE id = ?', [
    clock.now(),
    id,
  ]);
  await db.execute('DELETE FROM documents_fts WHERE document_id = ?', [id]);
}

export async function restoreDocument(db: Executor, id: string): Promise<void> {
  await db.execute('UPDATE documents SET deleted_at = NULL WHERE id = ?', [id]);
  await indexForSearch(db, id);
}

/** Permanently remove drafts deleted more than 30 days ago. */
export async function purgeDeleted(
  db: Executor,
  clock: Clock,
): Promise<number> {
  const cutoff = clock.now() - 30 * 86_400_000;
  const r = await db.execute(
    "DELETE FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < ? AND status = 'DRAFT'",
    [cutoff],
  );
  return r.rowsAffected;
}

/* ───────────────────────────── Activity ──────────────────────────── */

export type Activity = {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  at: number;
};

export async function listActivity(
  db: Executor,
  documentId: string,
): Promise<Activity[]> {
  const { rows } = await db.execute(
    'SELECT * FROM activity_log WHERE document_id = ? ORDER BY at, id',
    [documentId],
  );
  return rows.map(r => ({
    id: reqStr(r.id),
    kind: reqStr(r.kind),
    payload: parseJson(r.payload_json),
    at: reqNum(r.at),
  }));
}

/* ────────────────────────────── Search ───────────────────────────── */

async function indexForSearch(db: Executor, id: string): Promise<void> {
  const { rows } = await db.execute(
    `SELECT d.number, d.title, d.reference, d.notes, d.deleted_at,
       COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client_name,
       COALESCE(json_extract(d.client_snapshot_json, '$.company'), c.company) AS client_company
     FROM documents d LEFT JOIN clients c ON c.id = d.client_id WHERE d.id = ?`,
    [id],
  );
  const r = rows[0];
  await db.execute('DELETE FROM documents_fts WHERE document_id = ?', [id]);
  if (!r || r.deleted_at !== null) {
    return;
  }
  const lines = await db.execute(
    'SELECT name, description FROM document_lines WHERE document_id = ?',
    [id],
  );
  const body = [
    r.title,
    r.reference,
    r.notes,
    ...lines.rows.flatMap(l => [l.name, l.description]),
  ]
    .filter(Boolean)
    .join(' ');
  await db.execute(
    'INSERT INTO documents_fts (document_id, number, client, body) VALUES (?, ?, ?, ?)',
    [
      id,
      str(r.number) ?? '',
      [str(r.client_name), str(r.client_company)].filter(Boolean).join(' '),
      body,
    ],
  );
}

/** Turn free text into a safe FTS5 prefix query: every word must match. */
export const toFtsQuery = (input: string): string | null => {
  const tokens = input
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return tokens.length ? tokens.map(t => `"${t}"*`).join(' AND ') : null;
};
