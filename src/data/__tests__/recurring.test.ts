import { createClient } from '../repositories/clients';
import {
  createDraft,
  getDocument,
  issueDocument,
  saveDocument,
  toDraft,
} from '../repositories/documents';
import {
  getSchedule,
  listSchedules,
  processDueSchedules,
  setSchedule,
  stopSchedule,
} from '../repositories/recurring';

import { setupDb } from './helpers';

async function monthlyInvoice() {
  const { db, clock } = await setupDb();
  const client = await createClient(db, clock, { name: 'Acme' });
  const d = await createDraft(db, clock, 'INVOICE', { clientId: client.id });
  await saveDocument(db, clock, {
    ...toDraft(d),
    lines: [{ name: 'Retainer', quantity: 1000, unitPrice: 50000, taxes: [] }],
  });
  const inv = await issueDocument(db, clock, d.id);
  return { db, clock, inv };
}

describe('recurring invoices', () => {
  it('creates drafts on schedule and moves to the next date', async () => {
    const { db, clock, inv } = await monthlyInvoice();
    await setSchedule(db, clock, inv.id, { frequency: 'MONTHLY', start: '2026-09-30' });
    expect(await processDueSchedules(db, clock)).toEqual([]);

    clock.advanceDays(4); // 30 Sep passed
    const [first] = await processDueSchedules(db, clock);
    const draft = await getDocument(db, first!);
    expect(draft).toMatchObject({ status: 'DRAFT', number: null, issueDate: '2026-09-30', dueDate: '2026-10-30' });
    expect(draft!.lines.map(l => l.name)).toEqual(['Retainer']);
    expect(draft!.sourceDocumentId).toBe(inv.id);
    expect((await getSchedule(db, inv.id))!.nextDate).toBe('2026-10-30');
    expect(await processDueSchedules(db, clock)).toEqual([]);
  });

  it('caps a long gap at three drafts and resumes in the future', async () => {
    const { db, clock, inv } = await monthlyInvoice();
    await setSchedule(db, clock, inv.id, { frequency: 'MONTHLY', start: '2026-01-31' });
    expect(await processDueSchedules(db, clock)).toHaveLength(3);
    expect((await getSchedule(db, inv.id))!.nextDate).toBe('2026-09-30');
  });

  it('stops at the end date and when stopped', async () => {
    const { db, clock, inv } = await monthlyInvoice();
    await setSchedule(db, clock, inv.id, { frequency: 'WEEKLY', start: '2026-09-20', endDate: '2026-09-25' });
    expect(await processDueSchedules(db, clock)).toHaveLength(1);
    expect(await listSchedules(db)).toEqual([]);

    await setSchedule(db, clock, inv.id, { frequency: 'YEARLY', interval: 0, start: '2026-09-26' });
    await stopSchedule(db, clock, inv.id);
    expect(await processDueSchedules(db, clock)).toEqual([]);
    expect((await getSchedule(db, inv.id))!.active).toBe(false);
    expect(await getSchedule(db, 'nope')).toBeNull();
  });
});
