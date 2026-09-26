import { createClient } from '../repositories/clients';
import {
  addPhoto,
  getClientSignature,
  listPhotos,
  removePhoto,
  setClientSignature,
  setPhotoCaption,
} from '../repositories/attachments';
import {
  convertEstimateToInvoice,
  createDraft,
  issueDocument,
  applyAction,
  listActivity,
  recordPayment,
  saveDocument,
  toDraft,
} from '../repositories/documents';
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  recentVendors,
  restoreExpense,
  updateExpense,
  type ExpenseInput,
} from '../repositories/expenses';
import {
  createTrip,
  deleteTrip,
  listTrips,
  recentPlaces,
  restoreTrip,
  updateTrip,
  type TripInput,
} from '../repositories/mileage';
import { loadReport, reportCurrencies } from '../repositories/reports';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  restorePaymentMethod,
  updatePaymentMethod,
} from '../repositories/paymentMethods';
import { getProfile, updateProfile } from '../repositories/profile';

import { setupDb } from './helpers';

const expense = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  date: '2026-09-10',
  vendor: 'Screwfix',
  category: 'MATERIALS',
  amount: 4599,
  tax: 767,
  currency: 'GBP',
  clientId: null,
  note: null,
  receiptPath: null,
  ...over,
});

const trip = (over: Partial<TripInput> = {}): TripInput => ({
  date: '2026-09-11',
  from: 'Office',
  to: 'Site',
  distance: 12500,
  unit: 'mi',
  rate: 45,
  currency: 'GBP',
  purpose: 'Survey',
  clientId: null,
  ...over,
});

describe('expenses', () => {
  it('creates, filters, edits, deletes and restores', async () => {
    const { db, clock } = await setupDb();
    const a = await createExpense(db, clock, expense({ note: '  Pipes  ' }));
    expect(a.note).toBe('Pipes');
    await createExpense(db, clock, expense({ date: '2026-08-01', vendor: 'B&Q', category: 'TOOLS' }));
    expect((await listExpenses(db)).map(e => e.vendor)).toEqual(['Screwfix', 'B&Q']);
    expect(await listExpenses(db, { from: '2026-09-01', to: '2026-09-30' })).toHaveLength(1);
    expect(await listExpenses(db, { query: 'b&q' })).toHaveLength(1);
    expect(await listExpenses(db, { query: '100%' })).toHaveLength(0);
    const edited = await updateExpense(db, clock, a.id, expense({ amount: 5000, vendor: ' ' }));
    expect(edited.amount).toBe(5000);
    expect(edited.vendor).toBeNull();
    expect(await recentVendors(db)).toEqual(['B&Q']);
    await deleteExpense(db, clock, a.id);
    expect(await listExpenses(db)).toHaveLength(1);
    await restoreExpense(db, a.id);
    expect(await listExpenses(db)).toHaveLength(2);
    expect(await getExpense(db, 'missing')).toBeNull();
    await expect(createExpense(db, clock, expense({ amount: 0 }))).rejects.toThrow(RangeError);
    await expect(updateExpense(db, clock, a.id, expense({ amount: -1 }))).rejects.toThrow(RangeError);
  });
});

describe('mileage', () => {
  it('logs trips and remembers places', async () => {
    const { db, clock } = await setupDb();
    const t = await createTrip(db, clock, trip());
    await createTrip(db, clock, trip({ date: '2026-07-01', from: 'Home', to: ' ' }));
    expect(await listTrips(db)).toHaveLength(2);
    expect(await listTrips(db, { from: '2026-09-01' })).toHaveLength(1);
    const edited = await updateTrip(db, clock, t.id, trip({ distance: 20000, purpose: null }));
    expect(edited.distance).toBe(20000);
    expect(await recentPlaces(db)).toEqual(expect.arrayContaining(['Home', 'Office', 'Site']));
    await deleteTrip(db, clock, t.id);
    expect(await listTrips(db)).toHaveLength(1);
    await restoreTrip(db, t.id);
    expect(await listTrips(db)).toHaveLength(2);
    await expect(createTrip(db, clock, trip({ distance: 0 }))).rejects.toThrow(RangeError);
    await expect(createTrip(db, clock, trip({ rate: -1 }))).rejects.toThrow(RangeError);
  });

  it('stores mileage settings on the profile', async () => {
    const { db, clock } = await setupDb();
    expect((await getProfile(db)).mileageRate).toBeNull();
    await updateProfile(db, clock, { mileageRate: 50, mileageUnit: 'km' });
    const p = await getProfile(db);
    expect([p.mileageRate, p.mileageUnit]).toEqual([50, 'km']);
  });
});

describe('photos and signatures', () => {
  it('keeps photos on convert and only frees unused files', async () => {
    const { db, clock } = await setupDb();
    const client = await createClient(db, clock, { name: 'Acme' });
    const est = await createDraft(db, clock, 'ESTIMATE', { clientId: client.id });
    await saveDocument(db, clock, {
      ...toDraft(est),
      lines: [{ name: 'Work', quantity: 1000, unitPrice: 10000, taxes: [] }],
    });
    const p1 = await addPhoto(db, clock, est.id, { path: '/files/a.jpg', width: 800, height: 600 });
    await addPhoto(db, clock, est.id, { path: '/files/b.jpg' });
    await setPhotoCaption(db, p1, '  Before  ');
    const photos = await listPhotos(db, est.id);
    expect(photos.map(p => [p.path, p.position, p.caption])).toEqual([
      ['/files/a.jpg', 0, 'Before'],
      ['/files/b.jpg', 1, null],
    ]);
    await issueDocument(db, clock, est.id);
    await applyAction(db, clock, est.id, 'ACCEPT');
    const invoice = await convertEstimateToInvoice(db, clock, est.id);
    expect((await listPhotos(db, invoice.id)).map(p => p.path)).toEqual(['/files/a.jpg', '/files/b.jpg']);
    // Still used by the invoice: the file must stay.
    expect(await removePhoto(db, p1)).toBeNull();
    const invPhoto = (await listPhotos(db, invoice.id))[0]!;
    expect(await removePhoto(db, invPhoto.id)).toBe('/files/a.jpg');
    expect(await removePhoto(db, 'missing')).toBeNull();

    expect(await getClientSignature(db, est.id)).toBeNull();
    await setClientSignature(db, clock, est.id, { path: '/files/sig.svg', name: ' Ana ' });
    expect(await getClientSignature(db, est.id)).toMatchObject({ path: '/files/sig.svg', name: 'Ana' });
    await setClientSignature(db, clock, est.id, null);
    expect(await getClientSignature(db, est.id)).toBeNull();
    const kinds = (await listActivity(db, est.id)).map(a => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(['SIGNED', 'SIGNATURE_REMOVED']));
  });
});

describe('payment methods', () => {
  it('orders, trims, edits and soft-deletes', async () => {
    const { db, clock } = await setupDb();
    const a = await createPaymentMethod(db, clock, {
      kind: 'BANK',
      fields: { sortCode: ' 040004 ', iban: '  ' },
    });
    const b = await createPaymentMethod(db, clock, {
      kind: 'LINK',
      label: ' Stripe ',
      fields: { url: 'https://x.y' },
      showQr: false,
      isDefault: false,
    });
    expect(a.fields).toEqual({ sortCode: '040004' });
    expect([b.label, b.position, b.showQr, b.isDefault]).toEqual(['Stripe', 1, false, false]);
    const edited = await updatePaymentMethod(db, clock, a.id, {
      kind: 'OTHER',
      fields: { instructions: 'Cash' },
    });
    expect(edited.kind).toBe('OTHER');
    await deletePaymentMethod(db, clock, a.id);
    expect((await listPaymentMethods(db)).map(m => m.id)).toEqual([b.id]);
    await restorePaymentMethod(db, a.id);
    expect(await listPaymentMethods(db)).toHaveLength(2);
  });
});

describe('reports', () => {
  it('matches hand-computed figures', async () => {
    const { db, clock } = await setupDb();
    const client = await createClient(db, clock, { name: 'Acme' });
    const vat = (await db.execute("SELECT id, rate_ppm FROM tax_rates WHERE is_default = 1")).rows[0]!;
    const inv = await createDraft(db, clock, 'INVOICE', { clientId: client.id });
    await saveDocument(db, clock, {
      ...toDraft(inv),
      lines: [
        {
          name: 'Work',
          quantity: 1000,
          unitPrice: 10000,
          taxes: [{ taxRateId: String(vat.id), name: 'VAT', rate: Number(vat.rate_ppm), kind: 'STANDARD' }],
        },
      ],
    });
    await issueDocument(db, clock, inv.id);
    await recordPayment(db, clock, inv.id, { amount: 7000, paidOn: '2026-09-20' });
    await createExpense(db, clock, expense({ amount: 2000 }));
    await createExpense(db, clock, expense({ amount: 999, currency: 'EUR' }));
    await createTrip(db, clock, trip({ distance: 10000, rate: 45 }));

    const r = await loadReport(db, {
      currency: 'GBP',
      period: { from: '2026-09-01', to: '2026-09-30' },
      asOf: '2026-09-30',
    });
    expect(r.income).toBe(7000);
    expect(r.invoiced).toBe(12000);
    expect(r.taxCollected).toEqual([{ name: 'VAT', rate: 200000, amount: 2000, withholding: false }]);
    expect(r.expenses).toBe(2000);
    expect(r.mileage).toBe(450);
    expect(r.profit).toBe(7000 - 2000 - 450);
    expect(r.byClient).toEqual([{ clientId: client.id, name: 'Acme', income: 7000 }]);
    expect(r.outstanding).toBe(5000);
    expect(await reportCurrencies(db)).toEqual(['GBP', 'EUR']);
  });
});
