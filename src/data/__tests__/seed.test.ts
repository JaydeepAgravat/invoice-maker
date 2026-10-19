import { dashboard, listDocuments, viewCounts } from '../repositories/inbox';
import { seedSampleData } from '../seed';
import { seedStoryData } from '../seedStory';

import { setupDb } from './helpers';

describe('seedSampleData', () => {
  it('creates 1,000 consistent documents and inbox queries stay fast', async () => {
    const { db, clock } = await setupDb('GB');
    await seedSampleData(db, clock, { documents: 1000 });

    const counts = await viewCounts(db, clock.today());
    expect(counts.all).toBe(1000);
    expect(counts.drafts + counts.unpaid + counts.paid).toBeGreaterThan(0);

    // Every cached total matches the sum of its lines' stored totals.
    const mismatch = await db.execute(`
      SELECT COUNT(*) AS n FROM documents d
      WHERE d.total_minor + d.withholding_minor <> (SELECT COALESCE(SUM(total_minor), 0) FROM document_lines WHERE document_id = d.id)`);
    expect(mismatch.rows[0]!.n).toBe(0);

    // Numbers are unique and gap-free per type.
    const gaps = await db.execute(`
      SELECT doc_type, COUNT(*) AS n, MAX(sequence_value) AS mx FROM documents
      WHERE number IS NOT NULL GROUP BY doc_type`);
    gaps.rows.forEach(r => expect(r.n).toBe(r.mx));

    const started = Date.now();
    for (const view of ['all', 'unpaid', 'overdue', 'paid'] as const) {
      await listDocuments(db, { today: clock.today(), view, limit: 50 });
    }
    await listDocuments(db, { today: clock.today(), search: 'tap' });
    await dashboard(db, clock.today());
    await viewCounts(db, clock.today());
    expect(Date.now() - started).toBeLessThan(250);
    db.close();
  }, 60_000);
});

describe('seedStoryData', () => {
  it('builds a small business with paid, unpaid, overdue and draft work', async () => {
    const { db, clock } = await setupDb('US');
    await seedStoryData(db, clock);

    const counts = await viewCounts(db, clock.today());
    expect(counts.all).toBe(12);
    expect(counts.drafts).toBe(1);
    expect(counts.overdue).toBe(1);
    expect(counts.unpaid).toBeGreaterThanOrEqual(2);
    db.close();
  });
});
