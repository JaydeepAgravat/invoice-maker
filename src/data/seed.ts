/* eslint-disable no-bitwise -- bit-level UUID layout and PRNG math are intentional here */
import { addDays, type ISODate } from '@/domain/dates';
import type { DocType } from '@/domain/docTypes';

import type { Clock } from './clock';
import type { Database } from './db/types';
import { createClient } from './repositories/clients';
import {
  applyAction,
  createDraft,
  defaultLineTaxes,
  issueDocument,
  recordPayment,
  saveDocument,
  toDraft,
  type LineDraft,
} from './repositories/documents';
import { createItem } from './repositories/items';

/** Small deterministic PRNG (mulberry32) so seeded data is identical every run. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FIRST = [
  'Jordan',
  'Priya',
  'Liam',
  'Sofia',
  'Noah',
  'Amara',
  'Lucas',
  'Chloe',
  'Mateo',
  'Hannah',
  'Kenji',
  'Aisha',
];
const LAST = [
  'Smith',
  'Patel',
  'Garcia',
  'Nguyen',
  'Brown',
  'Okafor',
  'Müller',
  'Dubois',
  'Silva',
  'Kowalski',
];
const COMPANIES = [
  'Bloom Florists',
  'Northside Dental',
  'Acme Construction',
  'Harbour Café',
  'Pixel & Co',
  'Greenway Lettings',
];
const WORK: ReadonlyArray<[string, string, number]> = [
  ['Labour', 'hr', 6500],
  ['Call-out fee', 'item', 4500],
  ['Tap replacement', 'item', 12000],
  ['Wall tiling', 'm2', 4800],
  ['Garden maintenance', 'hr', 3800],
  ['Logo design', 'project', 85000],
  ['Consulting', 'hr', 12500],
  ['Deep clean', 'day', 22000],
  ['Copper pipe 15mm', 'm', 650],
  ['Paint (5L)', 'item', 4200],
];

type SeedOptions = { documents?: number; clients?: number; seed?: number };

/** Clock that follows the document being generated, so dates look real. */
export class SeedClock implements Clock {
  constructor(private date: ISODate, private ms: number) {}
  now() {
    return this.ms++;
  }
  today() {
    return this.date;
  }
  at(date: ISODate) {
    this.date = date;
    this.ms = Math.max(this.ms, Date.parse(`${date}T12:00:00Z`));
  }
}

/**
 * Generate realistic sample data: clients, catalog items and documents of
 * every type spread over the last 18 months, most issued and many paid.
 */
export async function seedSampleData(
  db: Database,
  clock: Clock,
  opts: SeedOptions = {},
): Promise<void> {
  const rand = rng(opts.seed ?? 42);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const today = clock.today();
  const sc = new SeedClock(
    addDays(today, -540),
    Date.parse(`${addDays(today, -540)}T12:00:00Z`),
  );

  await db.transaction(async tx => {
    const clients = [];
    for (let i = 0; i < (opts.clients ?? 60); i++) {
      const business = rand() < 0.4;
      const name = business
        ? `${pick(COMPANIES)} ${i}`
        : `${pick(FIRST)} ${pick(LAST)}`;
      clients.push(
        await createClient(tx, sc, {
          name,
          isBusiness: business,
          emails: [
            `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
          ],
          billingAddress: `${10 + i} Market Street\nSpringfield`,
        }),
      );
    }
    for (const [name, unit, price] of WORK) {
      await createItem(tx, sc, {
        name,
        description: null,
        unit,
        unitPrice: price,
        sku: null,
        taxRateIds: [],
      });
    }
    const taxes = await defaultLineTaxes(tx);

    const types: DocType[] = [
      'INVOICE',
      'INVOICE',
      'INVOICE',
      'INVOICE',
      'ESTIMATE',
      'ESTIMATE',
      'RECEIPT',
      'CREDIT_NOTE',
    ];
    const count = opts.documents ?? 1000;
    for (let i = 0; i < count; i++) {
      const issue = addDays(today, -Math.floor((540 * (count - i)) / count));
      sc.at(issue);
      const type = pick(types);
      const client = pick(clients);
      const draft = await createDraft(tx, sc, type, { clientId: client.id });
      const lines: LineDraft[] = Array.from(
        { length: 1 + Math.floor(rand() * 5) },
        () => {
          const [name, unit, price] = pick(WORK);
          return {
            name,
            unit,
            quantity: (1 + Math.floor(rand() * 8)) * 500,
            unitPrice: price,
            taxes,
          };
        },
      );
      const doc = await saveDocument(tx, sc, { ...toDraft(draft), lines });

      if (rand() < 0.08 && i > count - 40) {
        continue; // a few recent drafts
      }
      await issueDocument(tx, sc, doc.id);
      if (type === 'INVOICE') {
        const roll = rand();
        if (roll < 0.7) {
          sc.at(addDays(issue, Math.floor(rand() * 40)));
          await recordPayment(tx, sc, doc.id, {
            amount: doc.totals.total,
            paidOn: sc.today(),
            method: 'BANK_TRANSFER',
          });
        } else if (roll < 0.8) {
          await recordPayment(tx, sc, doc.id, {
            amount: Math.floor(doc.totals.total / 2),
            paidOn: addDays(issue, 5),
            method: 'CASH',
          });
        }
      } else if (type === 'ESTIMATE' && rand() < 0.5) {
        await applyAction(tx, sc, doc.id, rand() < 0.8 ? 'ACCEPT' : 'DECLINE');
      }
    }
  });
}
