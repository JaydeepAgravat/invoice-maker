import type { Database } from '../db/types';
import { createClient } from '../repositories/clients';
import {
  recordShare,
  documentsSharedInMonth,
  ActionNotAllowedError,
  applyAction,
  convertEstimateToInvoice,
  createChangeOrder,
  createCreditNote,
  createDraft,
  defaultLineTaxes,
  deleteDraft,
  deletePayment,
  duplicateDocument,
  getDocument,
  issueDocument,
  listActivity,
  listDerived,
  purgeDeleted,
  purgeEmptyDrafts,
  recordPayment,
  restoreDocument,
  saveDocument,
  snapshotTaxes,
  statusOf,
  toDraft,
  toFtsQuery,
  type LineDraft,
} from '../repositories/documents';
import {
  clientStatement,
  dashboard,
  listDocuments,
  viewCounts,
} from '../repositories/inbox';
import { listItems } from '../repositories/items';
import { listTaxRates, updateTaxRate } from '../repositories/taxRates';

import { setupDb, TestClock } from './helpers';

let db: Database;
let clock: TestClock;

beforeEach(async () => {
  ({ db, clock } = await setupDb('GB'));
});
afterEach(() => db.close());

const line = async (
  name: string,
  quantity: number,
  unitPrice: number,
  extra: Partial<LineDraft> = {},
): Promise<LineDraft> => ({
  name,
  quantity,
  unitPrice,
  taxes: await defaultLineTaxes(db),
  ...extra,
});

async function invoiceFor(clientName = 'Acme Ltd', lines?: LineDraft[]) {
  const client = await createClient(db, clock, {
    name: clientName,
    emails: ['ap@acme.test'],
  });
  const draft = await createDraft(db, clock, 'INVOICE', {
    clientId: client.id,
  });
  const saved = await saveDocument(db, clock, {
    ...toDraft(draft),
    lines: lines ?? [
      await line('Labour', 2000, 4500),
      await line('Parts', 1500, 6000),
    ],
  });
  return { client, doc: saved };
}

describe('drafts', () => {
  it('creates drafts with profile and client defaults but no number', async () => {
    const client = await createClient(db, clock, {
      name: 'Bloom',
      defaultTermsDays: 14,
      currency: 'EUR',
      language: 'fr',
    });
    const doc = await createDraft(db, clock, 'INVOICE', {
      clientId: client.id,
    });
    expect(doc).toMatchObject({
      status: 'DRAFT',
      number: null,
      issueDate: '2026-09-26',
      dueDate: '2026-10-10',
      termsDays: 14,
      currency: 'EUR',
      language: 'fr',
      templateId: 'classic',
    });
  });

  it('sets validity for estimates and a period for statements', async () => {
    const est = await createDraft(db, clock, 'ESTIMATE');
    expect(est.validUntil).toBe('2026-10-26');
    expect(est.dueDate).toBeNull();
    const st = await createDraft(db, clock, 'STATEMENT');
    expect([st.statementFrom, st.statementTo]).toEqual([
      '2026-06-28',
      '2026-09-26',
    ]);
  });

  it('saves lines, frozen taxes and totals', async () => {
    const { doc } = await invoiceFor();
    expect(doc.lines.map(l => [l.name, l.total, l.taxAmounts])).toEqual([
      ['Labour', 10800, [1800]],
      ['Parts', 10800, [1800]],
    ]);
    expect(doc.totals).toMatchObject({
      subtotal: 18000,
      taxTotal: 3600,
      total: 21600,
      balanceDue: 21600,
    });
    const row = await db.execute(
      'SELECT total_minor, tax_total_minor FROM documents WHERE id = ?',
      [doc.id],
    );
    expect(row.rows[0]).toEqual({ total_minor: 21600, tax_total_minor: 3600 });
  });

  it('keeps old documents unchanged when a tax rate is edited', async () => {
    const { doc } = await invoiceFor();
    const vat = (await listTaxRates(db)).find(t => t.isDefault)!;
    await updateTaxRate(db, clock, vat.id, { rate: 175_000 });
    const reread = await getDocument(db, doc.id);
    expect(reread!.totals.taxTotal).toBe(3600);
    expect(reread!.lines[0]!.taxes[0]!.rate).toBe(200_000);
  });

  it('stores tax amounts per tax even when compound taxes are listed first', async () => {
    const compound = {
      taxRateId: null,
      name: 'PST',
      rate: 70_000,
      kind: 'COMPOUND' as const,
    };
    const gst = {
      taxRateId: null,
      name: 'GST',
      rate: 50_000,
      kind: 'STANDARD' as const,
    };
    const d = await createDraft(db, clock, 'INVOICE');
    const saved = await saveDocument(db, clock, {
      ...toDraft(d),
      lines: [
        {
          name: 'Work',
          quantity: 1000,
          unitPrice: 10000,
          taxes: [compound, gst, gst],
        },
      ],
    });
    // Duplicate GST dropped; PST = 7% of 105.00 = 7.35
    expect(saved.lines[0]!.taxes.map(t => t.name)).toEqual(['PST', 'GST']);
    expect(saved.lines[0]!.taxAmounts).toEqual([735, 500]);
  });

  it('adds lines to the catalog only when asked', async () => {
    await invoiceFor('A', [
      await line('One-off', 1000, 100),
      await line('Standard visit', 1000, 8000, { saveToCatalog: true }),
    ]);
    const items = await listItems(db);
    expect(items.map(i => i.name)).toEqual(['Standard visit']);
    expect(items[0]!.taxRateIds).toHaveLength(1);
  });

  it('supports charges and document discounts', async () => {
    const d = await createDraft(db, clock, 'INVOICE');
    const saved = await saveDocument(db, clock, {
      ...toDraft(d),
      discount: { type: 'PERCENT', rate: 100_000 },
      lines: [
        await line('Work', 1000, 10000),
        await line('Delivery', 1000, 1000, { kind: 'CHARGE' }),
      ],
    });
    // (90.00 + 10.00) × 1.2
    expect(saved.totals.total).toBe(12000);
    expect(saved.totals.documentDiscount).toBe(1000);
    expect(saved.discount).toEqual({ type: 'PERCENT', rate: 100_000 });
  });

  it('round-trips amount discounts on lines and documents', async () => {
    const d = await createDraft(db, clock, 'INVOICE');
    const saved = await saveDocument(db, clock, {
      ...toDraft(d),
      discount: { type: 'AMOUNT', amount: 500 },
      lines: [
        await line('Work', 1000, 10000, {
          discount: { type: 'AMOUNT', amount: 1000 },
        }),
      ],
    });
    expect(saved.discount).toEqual({ type: 'AMOUNT', amount: 500 });
    expect(saved.lines[0]!.discount).toEqual({ type: 'AMOUNT', amount: 1000 });
    expect(saved.totals.baseTotal).toBe(8500);
  });

  it('refuses to change a document type', async () => {
    const d = await createDraft(db, clock, 'INVOICE');
    await expect(
      saveDocument(db, clock, { ...toDraft(d), type: 'ESTIMATE' }),
    ).rejects.toThrow(/type/);
  });

  it('snapshots taxes from ids', async () => {
    const [first] = await listTaxRates(db);
    expect(await snapshotTaxes(db, [first!.id])).toEqual([
      {
        taxRateId: first!.id,
        name: first!.name,
        rate: first!.rate,
        kind: first!.kind,
      },
    ]);
  });
});

describe('issuing and numbering', () => {
  it('assigns sequential numbers only when issued', async () => {
    const a = await invoiceFor('A');
    const b = await invoiceFor('B');
    await createDraft(db, clock, 'INVOICE'); // abandoned draft consumes nothing
    const issuedB = await issueDocument(db, clock, b.doc.id, {
      channel: 'email',
    });
    const issuedA = await issueDocument(db, clock, a.doc.id);
    expect([issuedB.number, issuedA.number]).toEqual(['INV-0001', 'INV-0002']);
    expect(issuedA.status).toBe('SENT');
  });

  it('keeps the number and first sent time when re-sent', async () => {
    const { doc } = await invoiceFor();
    const first = await issueDocument(db, clock, doc.id);
    const again = await issueDocument(db, clock, doc.id);
    expect(again.number).toBe(first.number);
    expect(again.sentAt).toBe(first.sentAt);
  });

  it('freezes client and business details at issue', async () => {
    const { doc, client } = await invoiceFor();
    const issued = await issueDocument(db, clock, doc.id);
    expect(issued.clientSnapshot).toMatchObject({
      id: client.id,
      name: 'Acme Ltd',
      emails: ['ap@acme.test'],
    });
    expect(issued.businessSnapshot).toMatchObject({
      country: 'GB',
      currency: 'GBP',
    });
  });

  it('numbers each type independently', async () => {
    const est = await createDraft(db, clock, 'ESTIMATE');
    const inv = await createDraft(db, clock, 'INVOICE');
    expect((await issueDocument(db, clock, est.id)).number).toBe('EST-0001');
    expect((await issueDocument(db, clock, inv.id)).number).toBe('INV-0001');
  });

  it('refuses to issue void or missing documents', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    await applyAction(db, clock, doc.id, 'VOID');
    await expect(issueDocument(db, clock, doc.id)).rejects.toThrow(/void/);
    await expect(issueDocument(db, clock, 'missing')).rejects.toThrow(
      /not found/,
    );
  });
});

describe('editing after sending', () => {
  it('keeps a revision and logs the change', async () => {
    const { doc } = await invoiceFor();
    const issued = await issueDocument(db, clock, doc.id);
    const edited = await saveDocument(db, clock, {
      ...toDraft(issued),
      notes: 'Thanks',
    });
    expect(edited.revision).toBe(1);
    expect(edited.notes).toBe('Thanks');
    const revisions = await db.execute(
      'SELECT revision, snapshot_json FROM document_revisions WHERE document_id = ?',
      [doc.id],
    );
    expect(revisions.rows).toHaveLength(1);
    expect(
      JSON.parse(String(revisions.rows[0]!.snapshot_json)).notes,
    ).toBeNull();
    const kinds = (await listActivity(db, doc.id)).map(a => a.kind);
    expect(kinds).toEqual(['CREATED', 'SENT', 'REVISED']);
  });

  it('keeps payments when an issued invoice is edited', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    const paid = await recordPayment(db, clock, doc.id, {
      amount: 1000,
      paidOn: '2026-09-26',
    });
    const edited = await saveDocument(db, clock, toDraft(paid));
    expect(edited.totals.paid).toBe(1000);
  });
});

describe('payments and status', () => {
  it('moves from sent to partial to paid', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    let d = await recordPayment(db, clock, doc.id, {
      amount: 10000,
      paidOn: '2026-09-26',
      method: 'BANK_TRANSFER',
    });
    expect(statusOf(d, clock.today())).toBe('PARTIAL');
    d = await recordPayment(db, clock, doc.id, {
      amount: 11600,
      paidOn: '2026-09-27',
    });
    expect(statusOf(d, clock.today())).toBe('PAID');
    expect(d.payments.map(p => p.amount)).toEqual([10000, 11600]);
    await expect(
      recordPayment(db, clock, doc.id, { amount: 1, paidOn: '2026-09-27' }),
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
  });

  it('becomes overdue after the due date', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    clock.advanceDays(31);
    expect(statusOf((await getDocument(db, doc.id))!, clock.today())).toBe(
      'OVERDUE',
    );
  });

  it('rejects payments on drafts and invalid amounts', async () => {
    const { doc } = await invoiceFor();
    await expect(
      recordPayment(db, clock, doc.id, { amount: 100, paidOn: '2026-09-26' }),
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
    await issueDocument(db, clock, doc.id);
    await expect(
      recordPayment(db, clock, doc.id, { amount: 0, paidOn: '2026-09-26' }),
    ).rejects.toThrow(RangeError);
    await expect(
      recordPayment(db, clock, 'missing', { amount: 1, paidOn: '2026-09-26' }),
    ).rejects.toThrow();
  });

  it('removes payments and recomputes', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    const d = await recordPayment(db, clock, doc.id, {
      amount: 21600,
      paidOn: '2026-09-26',
    });
    await deletePayment(db, clock, d.payments[0]!.id);
    await deletePayment(db, clock, 'missing');
    const after = (await getDocument(db, doc.id))!;
    expect(after.totals.paid).toBe(0);
    expect(statusOf(after, clock.today())).toBe('SENT');
  });
});

describe('estimates, change orders and conversion', () => {
  async function acceptedEstimate() {
    const client = await createClient(db, clock, { name: 'Homeowner' });
    const est = await createDraft(db, clock, 'ESTIMATE', {
      clientId: client.id,
    });
    await saveDocument(db, clock, {
      ...toDraft(est),
      lines: [await line('Kitchen refit', 1000, 500000)],
    });
    await issueDocument(db, clock, est.id);
    await applyAction(db, clock, est.id, 'ACCEPT');
    await db.execute(
      "INSERT INTO attachments (id, document_id, kind, path, position, created_at) VALUES ('ph1', ?, 'PHOTO', '/p.jpg', 0, 0)",
      [est.id],
    );
    return est.id;
  }

  it('converts an accepted estimate with accepted change orders and photos', async () => {
    const estId = await acceptedEstimate();
    const co = await createChangeOrder(db, clock, estId);
    expect(co.reference).toBe('EST-0001');
    await saveDocument(db, clock, {
      ...toDraft(co),
      lines: [await line('Extra socket', 1000, 12000)],
    });
    await issueDocument(db, clock, co.id);
    await applyAction(db, clock, co.id, 'ACCEPT');
    const pending = await createChangeOrder(db, clock, estId);
    await saveDocument(db, clock, {
      ...toDraft(pending),
      lines: [await line('Maybe', 1000, 99999)],
    });

    const invoice = await convertEstimateToInvoice(db, clock, estId);
    expect(invoice.type).toBe('INVOICE');
    expect(invoice.sourceDocumentId).toBe(estId);
    expect(invoice.lines.map(l => l.name)).toEqual([
      'Kitchen refit',
      'Extra socket',
    ]);
    const photos = await db.execute(
      'SELECT path FROM attachments WHERE document_id = ?',
      [invoice.id],
    );
    expect(photos.rows).toEqual([{ path: '/p.jpg' }]);
    const est = (await getDocument(db, estId))!;
    expect(est.status).toBe('CONVERTED');
    await expect(
      convertEstimateToInvoice(db, clock, estId),
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
    expect((await listDerived(db, estId)).map(d => d.type)).toEqual([
      'CHANGE_ORDER',
      'CHANGE_ORDER',
      'INVOICE',
    ]);
  });

  it('refuses conversion before acceptance and for non-estimates', async () => {
    const est = await createDraft(db, clock, 'ESTIMATE');
    await expect(
      convertEstimateToInvoice(db, clock, est.id),
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
    await expect(createChangeOrder(db, clock, est.id)).rejects.toBeInstanceOf(
      ActionNotAllowedError,
    );
    const inv = await createDraft(db, clock, 'INVOICE');
    await expect(convertEstimateToInvoice(db, clock, inv.id)).rejects.toThrow(
      /Estimate not found/,
    );
    await expect(createChangeOrder(db, clock, inv.id)).rejects.toThrow(
      /Estimate not found/,
    );
  });

  it('declines and voids through allowed actions only', async () => {
    const est = await createDraft(db, clock, 'ESTIMATE');
    await expect(
      applyAction(db, clock, est.id, 'ACCEPT'),
    ).rejects.toBeInstanceOf(ActionNotAllowedError);
    await issueDocument(db, clock, est.id);
    expect((await applyAction(db, clock, est.id, 'DECLINE')).status).toBe(
      'DECLINED',
    );
    await expect(applyAction(db, clock, 'missing', 'VOID')).rejects.toThrow(
      /not found/,
    );
  });
});

describe('credit notes and duplicates', () => {
  it('creates a linked credit note from an issued invoice', async () => {
    const { doc } = await invoiceFor();
    await expect(createCreditNote(db, clock, doc.id)).rejects.toBeInstanceOf(
      ActionNotAllowedError,
    );
    const issued = await issueDocument(db, clock, doc.id);
    const cn = await createCreditNote(db, clock, doc.id);
    expect(cn).toMatchObject({
      type: 'CREDIT_NOTE',
      sourceDocumentId: doc.id,
      reference: issued.number,
    });
    expect(cn.totals.total).toBe(21600);
    const est = await createDraft(db, clock, 'ESTIMATE');
    await expect(createCreditNote(db, clock, est.id)).rejects.toThrow(
      /Invoice not found/,
    );
  });

  it('duplicates as a fresh draft, optionally as another type', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    clock.advanceDays(10);
    const copy = await duplicateDocument(db, clock, doc.id);
    expect(copy).toMatchObject({
      status: 'DRAFT',
      number: null,
      issueDate: '2026-10-06',
      sourceDocumentId: null,
    });
    expect(copy.totals.total).toBe(21600);
    expect(copy.lines[0]!.id).not.toBe(doc.lines[0]!.id);
    const asEstimate = await duplicateDocument(db, clock, doc.id, {
      type: 'ESTIMATE',
    });
    expect(asEstimate).toMatchObject({
      type: 'ESTIMATE',
      sourceDocumentId: doc.id,
      dueDate: null,
    });
    await expect(duplicateDocument(db, clock, 'missing')).rejects.toThrow();
  });
});

describe('deleting', () => {
  it('soft-deletes drafts, restores them, and purges after 30 days', async () => {
    const { doc } = await invoiceFor();
    await deleteDraft(db, clock, doc.id);
    await deleteDraft(db, clock, 'missing');
    expect(
      (await listDocuments(db, { today: clock.today() })).map(d => d.id),
    ).toEqual([]);
    await expect(
      saveDocument(db, clock, toDraft((await getDocument(db, doc.id))!)),
    ).rejects.toThrow(/deleted/);
    await restoreDocument(db, doc.id);
    expect(
      await listDocuments(db, { today: clock.today(), search: 'labour' }),
    ).toHaveLength(1);
    await deleteDraft(db, clock, doc.id);
    clock.advanceDays(31);
    expect(await purgeDeleted(db, clock)).toBe(1);
    expect(await getDocument(db, doc.id)).toBeNull();
  });

  it('never deletes issued documents', async () => {
    const { doc } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    await expect(deleteDraft(db, clock, doc.id)).rejects.toBeInstanceOf(
      ActionNotAllowedError,
    );
  });
});

describe('inbox', () => {
  it('filters saved views and counts them', async () => {
    const draft = await invoiceFor('Draft Co');
    const sent = await invoiceFor('Sent Co');
    const overdue = await invoiceFor('Late Co');
    const paid = await invoiceFor('Paid Co');
    const est = await createDraft(db, clock, 'ESTIMATE');
    await issueDocument(db, clock, sent.doc.id);
    await issueDocument(db, clock, overdue.doc.id);
    await db.execute(
      "UPDATE documents SET due_date = '2026-09-01' WHERE id = ?",
      [overdue.doc.id],
    );
    await issueDocument(db, clock, paid.doc.id);
    await recordPayment(db, clock, paid.doc.id, {
      amount: 21600,
      paidOn: '2026-09-26',
    });
    const receipt = await createDraft(db, clock, 'RECEIPT');
    await issueDocument(db, clock, receipt.id);

    const ids = async (view: Parameters<typeof listDocuments>[1]['view']) =>
      (await listDocuments(db, { today: clock.today(), view }))
        .map(d => d.id)
        .sort();

    expect(await ids('drafts')).toEqual([draft.doc.id, est.id].sort());
    expect(await ids('unpaid')).toEqual([sent.doc.id, overdue.doc.id].sort());
    expect(await ids('overdue')).toEqual([overdue.doc.id]);
    expect(await ids('estimates')).toEqual([est.id]);
    expect(await ids('paid')).toEqual([paid.doc.id, receipt.id].sort());
    expect(await ids('all')).toHaveLength(6);

    expect(await viewCounts(db, clock.today())).toEqual({
      all: 6,
      drafts: 2,
      unpaid: 2,
      overdue: 1,
      estimates: 1,
      paid: 2,
    });

    const late = (
      await listDocuments(db, { today: clock.today(), view: 'overdue' })
    )[0]!;
    expect(late).toMatchObject({
      status: 'OVERDUE',
      clientName: 'Late Co',
      balance: 21600,
      number: 'INV-0002',
    });
  });

  it('searches number, client and line text with prefixes and accents', async () => {
    const { doc } = await invoiceFor('Café Müller', [
      await line('Plomberie salle de bain', 1000, 100),
    ]);
    await issueDocument(db, clock, doc.id);
    const find = async (search: string) =>
      (await listDocuments(db, { today: clock.today(), search })).length;
    expect(await find('INV-0001')).toBe(1);
    expect(await find('cafe')).toBe(1);
    expect(await find('mull')).toBe(1);
    expect(await find('plomb salle')).toBe(1);
    expect(await find('zzz')).toBe(0);
    expect(await find('   ')).toBe(0);
  });

  it('filters by client and type and pages', async () => {
    const a = await invoiceFor('A');
    await invoiceFor('B');
    await createDraft(db, clock, 'ESTIMATE', { clientId: a.client.id });
    expect(
      await listDocuments(db, { today: clock.today(), clientId: a.client.id }),
    ).toHaveLength(2);
    expect(
      await listDocuments(db, { today: clock.today(), type: 'ESTIMATE' }),
    ).toHaveLength(1);
    expect(
      await listDocuments(db, { today: clock.today(), limit: 1, offset: 1 }),
    ).toHaveLength(1);
  });

  it('builds dashboard totals per currency', async () => {
    const gbp = await invoiceFor('A');
    await issueDocument(db, clock, gbp.doc.id);
    await recordPayment(db, clock, gbp.doc.id, {
      amount: 1600,
      paidOn: '2026-09-10',
    });
    const eur = await createDraft(db, clock, 'INVOICE');
    await saveDocument(db, clock, {
      ...toDraft(eur),
      currency: 'EUR',
      lines: [await line('X', 1000, 1000)],
    });
    await issueDocument(db, clock, eur.id);
    await db.execute(
      "UPDATE documents SET due_date = '2026-09-01' WHERE id = ?",
      [eur.id],
    );
    expect(await dashboard(db, clock.today())).toEqual({
      outstanding: { GBP: 20000, EUR: 1200 },
      overdue: { EUR: 1200 },
      paidThisMonth: { GBP: 1600 },
    });
  });

  it('builds a client statement', async () => {
    const { doc, client } = await invoiceFor();
    await issueDocument(db, clock, doc.id);
    await recordPayment(db, clock, doc.id, {
      amount: 6600,
      paidOn: '2026-09-28',
    });
    const s = await clientStatement(db, {
      clientId: client.id,
      currency: 'GBP',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(s.entries.map(e => e.balance)).toEqual([21600, 15000]);
    expect(s.closingBalance).toBe(15000);
  });
});

describe('toFtsQuery', () => {
  it('quotes tokens as prefix matches', () => {
    expect(toFtsQuery('acme "INV-00')).toBe('"acme"* AND "INV"* AND "00"*');
    expect(toFtsQuery('***')).toBeNull();
  });
});

describe('purgeEmptyDrafts', () => {
  it('removes only old drafts with no client and no lines', async () => {
    const empty = await createDraft(db, clock, 'INVOICE');
    const withLine = await invoiceFor('Keep');
    const client = await createClient(db, clock, { name: 'Also keep' });
    const withClient = await createDraft(db, clock, 'INVOICE', {
      clientId: client.id,
    });
    expect(await purgeEmptyDrafts(db, clock)).toBe(0); // too recent
    clock.advanceDays(1);
    expect(await purgeEmptyDrafts(db, clock)).toBe(1);
    expect(await getDocument(db, empty.id)).toBeNull();
    expect(await getDocument(db, withLine.doc.id)).not.toBeNull();
    expect(await getDocument(db, withClient.id)).not.toBeNull();
  });
});

describe('sharing', () => {
  it('issues a draft on first share and only logs later shares', async () => {
    const env = await setupDb();
    const [sdb, sclock] = [env.db, env.clock];
    const draft = await createDraft(sdb, sclock, 'INVOICE');
    const shared = await recordShare(sdb, sclock, draft.id, 'whatsapp');
    expect(shared.number).toBe('INV-0001');
    expect(shared.status).toBe('SENT');
    const snapshot = shared.businessSnapshot;
    const again = await recordShare(sdb, sclock, draft.id, 'email');
    expect(again.businessSnapshot).toEqual(snapshot);
    const kinds = (await listActivity(sdb, draft.id)).map(a => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(['SENT', 'SHARED']));
    expect(await documentsSharedInMonth(sdb, '2026-09')).toBe(1);
    const other = await createDraft(sdb, sclock, 'ESTIMATE');
    await recordShare(sdb, sclock, other.id, 'print');
    expect(await documentsSharedInMonth(sdb, '2026-09')).toBe(2);
    expect(await documentsSharedInMonth(sdb, '2026-10')).toBe(0);
    await expect(recordShare(sdb, sclock, 'missing', 'x')).rejects.toThrow();
  });
});
