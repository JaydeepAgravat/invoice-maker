import type { Clock } from '../clock';
import { bool, num, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

export type ClientKind = 'CLIENT' | 'SUPPLIER';

export type Client = {
  id: string;
  kind: ClientKind;
  name: string;
  company: string | null;
  isBusiness: boolean;
  emails: string[];
  phone: string | null;
  taxId: string | null;
  notes: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  language: string | null;
  currency: string | null;
  defaultTermsDays: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ClientInput = { name: string } & Partial<
  Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'name'>
>;

const map = (r: Row, emails: string[]): Client => ({
  id: reqStr(r.id),
  kind: reqStr(r.kind) as ClientKind,
  name: reqStr(r.name),
  company: str(r.company),
  isBusiness: bool(r.is_business),
  emails,
  phone: str(r.phone),
  taxId: str(r.tax_id),
  notes: str(r.notes),
  billingAddress: str(r.billing_address),
  shippingAddress: str(r.shipping_address),
  language: str(r.language),
  currency: str(r.currency),
  defaultTermsDays: num(r.default_terms_days),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

const emailsFor = async (
  db: Executor,
  ids: string[],
): Promise<Map<string, string[]>> => {
  const out = new Map<string, string[]>(ids.map(id => [id, []]));
  if (ids.length === 0) {
    return out;
  }
  const { rows } = await db.execute(
    `SELECT client_id, email FROM client_emails WHERE client_id IN (${ids
      .map(() => '?')
      .join(',')})
     ORDER BY is_primary DESC, position`,
    ids,
  );
  rows.forEach(r => out.get(reqStr(r.client_id))!.push(reqStr(r.email)));
  return out;
};

const writeEmails = async (
  db: Executor,
  clientId: string,
  emails: readonly string[],
  now: number,
) => {
  await db.execute('DELETE FROM client_emails WHERE client_id = ?', [clientId]);
  const clean = [...new Set(emails.map(e => e.trim()).filter(Boolean))];
  for (const [i, email] of clean.entries()) {
    await db.execute(
      'INSERT INTO client_emails (id, client_id, email, is_primary, position) VALUES (?, ?, ?, ?, ?)',
      [uuidv7(now), clientId, email, i === 0 ? 1 : 0, i],
    );
  }
};

const values = (c: ClientInput) => [
  c.kind ?? 'CLIENT',
  c.name.trim(),
  c.company?.trim() || null,
  c.isBusiness ? 1 : 0,
  c.phone?.trim() || null,
  c.taxId?.trim() || null,
  c.notes ?? null,
  c.billingAddress ?? null,
  c.shippingAddress ?? null,
  c.language ?? null,
  c.currency ?? null,
  c.defaultTermsDays ?? null,
];

export async function createClient(
  db: Executor,
  clock: Clock,
  input: ClientInput,
): Promise<Client> {
  if (!input.name.trim()) {
    throw new Error('Client name is required');
  }
  const now = clock.now();
  const id = uuidv7(now);
  await db.execute(
    `INSERT INTO clients (kind, name, company, is_business, phone, tax_id, notes, billing_address, shipping_address,
       language, currency, default_terms_days, id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values(input), id, now, now],
  );
  await writeEmails(db, id, input.emails ?? [], now);
  return (await getClient(db, id))!;
}

export async function updateClient(
  db: Executor,
  clock: Clock,
  id: string,
  input: ClientInput,
): Promise<Client> {
  const now = clock.now();
  await db.execute(
    `UPDATE clients SET kind = ?, name = ?, company = ?, is_business = ?, phone = ?, tax_id = ?, notes = ?,
       billing_address = ?, shipping_address = ?, language = ?, currency = ?, default_terms_days = ?, updated_at = ?
     WHERE id = ?`,
    [...values(input), now, id],
  );
  if (input.emails) {
    await writeEmails(db, id, input.emails, now);
  }
  return (await getClient(db, id))!;
}

export async function getClient(
  db: Executor,
  id: string,
): Promise<Client | null> {
  const { rows } = await db.execute('SELECT * FROM clients WHERE id = ?', [id]);
  if (!rows[0]) {
    return null;
  }
  return map(rows[0], (await emailsFor(db, [id])).get(id)!);
}

export async function listClients(
  db: Executor,
  opts: { search?: string; kind?: ClientKind; limit?: number } = {},
): Promise<Client[]> {
  const params: (string | number)[] = [opts.kind ?? 'CLIENT'];
  let where = 'deleted_at IS NULL AND kind = ?';
  const q = opts.search?.trim();
  if (q) {
    where += ` AND (name LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR id IN
      (SELECT client_id FROM client_emails WHERE email LIKE ? ESCAPE '\\'))`;
    const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 500);
  const { rows } = await db.execute(
    `SELECT * FROM clients WHERE ${where} ORDER BY name COLLATE NOCASE LIMIT ?`,
    params,
  );
  const ids = rows.map(r => reqStr(r.id));
  const emails = await emailsFor(db, ids);
  return rows.map(r => map(r, emails.get(reqStr(r.id))!));
}

/** Soft delete. Documents keep their frozen client snapshot. */
export const deleteClient = (db: Executor, clock: Clock, id: string) =>
  db.execute('UPDATE clients SET deleted_at = ? WHERE id = ?', [
    clock.now(),
    id,
  ]);

export const restoreClient = (db: Executor, id: string) =>
  db.execute('UPDATE clients SET deleted_at = NULL WHERE id = ?', [id]);

export type ClientBalance = {
  billed: number;
  paid: number;
  outstanding: number;
  documents: number;
};

/** Totals per currency across sent, non-void invoices. */
export async function clientBalances(
  db: Executor,
  clientId: string,
): Promise<Record<string, ClientBalance>> {
  const { rows } = await db.execute(
    `SELECT currency, COUNT(*) AS n, SUM(total_minor) AS billed, SUM(paid_minor) AS paid
     FROM documents
     WHERE client_id = ? AND doc_type = 'INVOICE' AND status NOT IN ('DRAFT','VOID') AND deleted_at IS NULL
     GROUP BY currency`,
    [clientId],
  );
  return Object.fromEntries(
    rows.map(r => {
      const billed = Number(r.billed);
      const paid = Number(r.paid);
      return [
        reqStr(r.currency),
        { billed, paid, outstanding: billed - paid, documents: Number(r.n) },
      ];
    }),
  );
}
