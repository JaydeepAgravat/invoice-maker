import { addDays, type ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';

import type { Clock } from './clock';
import type { Database } from './db/types';
import { createClient } from './repositories/clients';
import {
  applyAction,
  convertEstimateToInvoice,
  createDraft,
  issueDocument,
  recordPayment,
  saveDocument,
  toDraft,
  type LineDraft,
} from './repositories/documents';
import { createExpense } from './repositories/expenses';
import { createItem } from './repositories/items';
import { createTrip } from './repositories/mileage';
import { createPaymentMethod } from './repositories/paymentMethods';
import { updateProfile } from './repositories/profile';
import { SeedClock } from './seed';

/**
 * A small, believable US plumbing business for README and store screenshots:
 * a few weeks of real-looking work instead of 1,000 random documents.
 * Expects a fresh install with the US preset applied.
 */
export async function seedStoryData(db: Database, clock: Clock): Promise<void> {
  const today = clock.today();
  const start = addDays(today, -75);
  const sc = new SeedClock(start, Date.parse(`${start}T12:00:00Z`));
  const day = (offset: number): ISODate => addDays(today, offset);

  await db.transaction(async tx => {
    await updateProfile(tx, sc, {
      name: 'Rivera Plumbing',
      legalName: 'Rivera Plumbing LLC',
      email: 'sam@riveraplumbing.example',
      phone: '(503) 555-0142',
      address: '1820 SE Alder St\nPortland, OR 97214',
      templateId: 'modern',
      defaultNotes: 'Thank you for your business.',
    });
    await createPaymentMethod(tx, sc, {
      kind: 'BANK',
      label: 'Business checking',
      fields: {
        accountName: 'Rivera Plumbing LLC',
        bankName: 'Columbia Community Bank',
        routingNumber: '123456789',
        accountNumber: '000184 2291',
      },
      showQr: false,
      isDefault: true,
    });
    await createPaymentMethod(tx, sc, {
      kind: 'LINK',
      label: 'Pay by card',
      fields: { url: 'https://pay.example.com/rivera-plumbing' },
      showQr: true,
      isDefault: true,
    });

    const client = async (
      name: string,
      email: string,
      address: string,
      isBusiness = false,
    ) =>
      (
        await createClient(tx, sc, {
          name,
          isBusiness,
          emails: [email],
          billingAddress: address,
        })
      ).id;
    const bakery = await client(
      'Maple Row Bakery',
      'hello@maplerow.example',
      '412 NE Alberta St\nPortland, OR 97211',
      true,
    );
    const dana = await client(
      'Dana Whitfield',
      'dana.whitfield@example.com',
      '2715 SE Taylor St\nPortland, OR 97214',
    );
    const greenway = await client(
      'Greenway Apartments',
      'maintenance@greenway.example',
      '900 N Russell St\nPortland, OR 97227',
      true,
    );
    const luis = await client(
      'Luis Ortega',
      'luis.ortega@example.com',
      '5530 NE 30th Ave\nPortland, OR 97211',
    );
    const dental = await client(
      'Harbor Street Dental',
      'office@harborstdental.example',
      '1300 SW Harbor Way\nPortland, OR 97201',
      true,
    );
    const priya = await client(
      'Priya Raman',
      'priya.raman@example.com',
      '3021 SE Division St\nPortland, OR 97202',
    );

    const L = (
      name: string,
      unit: string,
      quantity: number,
      unitPrice: number,
      description: string | null = null,
    ): LineDraft => ({
      name,
      description,
      unit,
      quantity: Math.round(quantity * 1000),
      unitPrice,
      taxes: [],
    });
    for (const [name, unit, price] of [
      ['Labor', 'hr', 9000],
      ['Call-out fee', 'item', 4500],
      ['Kitchen faucet', 'item', 18000],
      ['Water heater, 50 gal', 'item', 89000],
      ['PEX pipe 1/2"', 'ft', 150],
      ['Drain cleaning', 'item', 16000],
      ['Toilet fill valve', 'item', 3200],
    ] as const) {
      await createItem(tx, sc, {
        name,
        description: null,
        unit,
        unitPrice: price,
        sku: null,
        taxRateIds: [],
      });
    }

    const doc = async (
      type: DocType,
      clientId: string,
      issued: number,
      lines: LineDraft[],
      opts: { due?: number; paid?: number | 'half'; draft?: boolean } = {},
    ) => {
      sc.at(day(issued));
      const d = await createDraft(tx, sc, type, { clientId });
      const saved = await saveDocument(tx, sc, {
        ...toDraft(d),
        dueDate: opts.due !== undefined ? day(opts.due) : toDraft(d).dueDate,
        lines,
      });
      if (opts.draft) {
        return saved;
      }
      const issuedDoc = await issueDocument(tx, sc, saved.id);
      if (opts.paid !== undefined) {
        const amount =
          opts.paid === 'half'
            ? Math.floor(issuedDoc.totals.total / 2)
            : issuedDoc.totals.total;
        const paidOn = day(opts.paid === 'half' ? issued + 2 : opts.paid);
        sc.at(paidOn);
        await recordPayment(tx, sc, saved.id, {
          amount,
          paidOn,
          method: 'BANK_TRANSFER',
        });
      }
      return issuedDoc;
    };

    // Older, paid work.
    await doc(
      'INVOICE',
      greenway,
      -70,
      [
        L('Drain cleaning', 'item', 3, 16000, 'Units 4B, 7A and 12C'),
        L('Labor', 'hr', 2, 9000),
      ],
      { paid: -58 },
    );
    await doc(
      'INVOICE',
      dental,
      -63,
      [
        L('Toilet fill valve', 'item', 2, 3200),
        L('Labor', 'hr', 1.5, 9000),
        L('Call-out fee', 'item', 1, 4500),
      ],
      { paid: -55 },
    );
    await doc(
      'INVOICE',
      priya,
      -52,
      [L('Kitchen faucet', 'item', 1, 18000), L('Labor', 'hr', 1, 9000)],
      { paid: -50 },
    );
    await doc('RECEIPT', luis, -45, [
      L('Emergency leak repair', 'item', 1, 22500, 'Saturday call-out'),
    ]);
    await doc(
      'INVOICE',
      greenway,
      -38,
      [
        L('PEX pipe 1/2"', 'ft', 60, 150),
        L('Labor', 'hr', 6, 9000, 'Re-pipe laundry room'),
      ],
      { paid: -20 },
    );

    // The estimate that became a job.
    const est = await doc('ESTIMATE', dana, -30, [
      L('Water heater, 50 gal', 'item', 1, 89000, 'Gas, 6-year warranty'),
      L('Labor', 'hr', 4, 9000, 'Remove old unit and install'),
      L('Haul-away and disposal', 'item', 1, 7500),
    ]);
    sc.at(day(-28));
    await applyAction(tx, sc, est.id, 'ACCEPT');
    sc.at(day(-21));
    const fromEstimate = await convertEstimateToInvoice(tx, sc, est.id);
    await issueDocument(tx, sc, fromEstimate.id);
    await recordPayment(tx, sc, fromEstimate.id, {
      amount: fromEstimate.totals.total,
      paidOn: day(-14),
      method: 'BANK_TRANSFER',
    });

    // Money still out there.
    await doc(
      'INVOICE',
      dental,
      -40,
      [
        L('Drain cleaning', 'item', 1, 16000),
        L('Call-out fee', 'item', 1, 4500),
      ],
      { due: -10 },
    );
    await doc(
      'INVOICE',
      greenway,
      -12,
      [
        L('Labor', 'hr', 3, 9000, 'Shut-off valve replacement, unit 3A'),
        L('Call-out fee', 'item', 1, 4500),
      ],
      { due: 18, paid: 'half' },
    );
    await doc('ESTIMATE', luis, -3, [
      L('Bathroom rough-in', 'item', 1, 145000, 'New shower and vanity'),
      L('PEX pipe 1/2"', 'ft', 80, 150),
      L('Labor', 'hr', 10, 9000),
    ]);
    await doc(
      'INVOICE',
      bakery,
      -1,
      [
        L(
          'Kitchen faucet',
          'item',
          1,
          18000,
          'Commercial pre-rinse, installed',
        ),
        L('Labor', 'hr', 1.5, 9000),
        L('Call-out fee', 'item', 1, 4500),
      ],
      { due: 13 },
    );
    await doc(
      'INVOICE',
      priya,
      0,
      [L('Toilet fill valve', 'item', 1, 3200), L('Labor', 'hr', 0.5, 9000)],
      { draft: true },
    );

    for (const [offset, vendor, category, amount] of [
      [-60, 'Ferguson Plumbing Supply', 'MATERIALS', 41280],
      [-33, 'Chevron', 'FUEL', 6420],
      [-29, 'Ferguson Plumbing Supply', 'MATERIALS', 61900],
      [-18, 'Home Depot', 'TOOLS', 12999],
      [-5, 'Chevron', 'FUEL', 5875],
    ] as const) {
      await createExpense(tx, sc, {
        date: day(offset),
        vendor,
        category,
        amount,
        tax: 0,
        currency: 'USD',
        clientId: null,
        note: null,
        receiptPath: null,
      });
    }
    for (const [offset, to, miles, clientId] of [
      [-30, 'Dana Whitfield, SE Taylor St', 4.2, dana],
      [-12, 'Greenway Apartments', 6.8, greenway],
      [-1, 'Maple Row Bakery', 5.1, bakery],
    ] as const) {
      await createTrip(tx, sc, {
        date: day(offset),
        from: 'Shop',
        to,
        distance: Math.round(miles * 1000),
        unit: 'mi',
        rate: 70,
        currency: 'USD',
        purpose: 'Job visit',
        clientId,
      });
    }
  });
}
