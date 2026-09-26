import type {
  PaymentFields,
  PaymentKind,
  PaymentMethod,
} from '@/domain/payments';

import type { Clock } from '../clock';
import { bool, reqNum, reqStr, str, type Executor, type Row } from '../db/types';
import { uuidv7 } from '../ids';

export type PaymentMethodInput = {
  kind: PaymentKind;
  label?: string | null;
  fields: PaymentFields;
  showQr?: boolean;
  isDefault?: boolean;
};

const map = (r: Row): PaymentMethod => ({
  id: reqStr(r.id),
  kind: reqStr(r.kind) as PaymentKind,
  label: str(r.label),
  fields: JSON.parse(reqStr(r.fields_json)) as PaymentFields,
  showQr: bool(r.show_qr),
  isDefault: bool(r.is_default),
  position: reqNum(r.position),
});

/** Trim values and drop empty ones, so a cleared field is really gone. */
const clean = (fields: PaymentFields): PaymentFields =>
  Object.fromEntries(
    Object.entries(fields)
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
      .filter(([, v]) => !!v),
  );

export async function listPaymentMethods(
  db: Executor,
): Promise<PaymentMethod[]> {
  const { rows } = await db.execute(
    'SELECT * FROM payment_methods WHERE deleted_at IS NULL ORDER BY position, created_at',
  );
  return rows.map(map);
}

export async function getPaymentMethod(
  db: Executor,
  id: string,
): Promise<PaymentMethod | null> {
  const { rows } = await db.execute(
    'SELECT * FROM payment_methods WHERE id = ?',
    [id],
  );
  return rows[0] ? map(rows[0]) : null;
}

export async function createPaymentMethod(
  db: Executor,
  clock: Clock,
  input: PaymentMethodInput,
): Promise<PaymentMethod> {
  const now = clock.now();
  const id = uuidv7(now);
  const { rows } = await db.execute(
    'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM payment_methods WHERE deleted_at IS NULL',
  );
  await db.execute(
    `INSERT INTO payment_methods (id, kind, label, fields_json, show_qr, is_default, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.kind,
      input.label?.trim() || null,
      JSON.stringify(clean(input.fields)),
      input.showQr ?? true ? 1 : 0,
      input.isDefault ?? true ? 1 : 0,
      reqNum(rows[0]!.p),
      now,
      now,
    ],
  );
  return (await getPaymentMethod(db, id))!;
}

export async function updatePaymentMethod(
  db: Executor,
  clock: Clock,
  id: string,
  input: PaymentMethodInput,
): Promise<PaymentMethod> {
  await db.execute(
    `UPDATE payment_methods SET kind = ?, label = ?, fields_json = ?, show_qr = ?, is_default = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.kind,
      input.label?.trim() || null,
      JSON.stringify(clean(input.fields)),
      input.showQr ?? true ? 1 : 0,
      input.isDefault ?? true ? 1 : 0,
      clock.now(),
      id,
    ],
  );
  return (await getPaymentMethod(db, id))!;
}

export const deletePaymentMethod = (db: Executor, clock: Clock, id: string) =>
  db.execute('UPDATE payment_methods SET deleted_at = ? WHERE id = ?', [
    clock.now(),
    id,
  ]);

export const restorePaymentMethod = (db: Executor, id: string) =>
  db.execute('UPDATE payment_methods SET deleted_at = NULL WHERE id = ?', [id]);
