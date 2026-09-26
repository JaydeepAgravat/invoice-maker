import type { TFunction } from 'i18next';

import { getDatabase } from '@/data/database';
import { num, reqNum, reqStr, str } from '@/data/db/types';
import { csvSeparator, minorToDecimal, toCsv, type Cell } from '@/domain/csv';
import type { Period } from '@/domain/reports';
import { isExpenseCategory } from '@/domain/expenses';
import { currencyDigits, decimalSeparator } from '@/domain/money';
import NativeMedia from '@/specs/NativeMedia';
import NativeShare from '@/specs/NativeShare';

export type ExportKind = 'payments' | 'invoices' | 'expenses' | 'mileage';

export const EXPORT_KINDS: readonly ExportKind[] = [
  'payments',
  'invoices',
  'expenses',
  'mileage',
];

/**
 * Spreadsheet exports for the accountant: one row per record, plain numbers
 * (no currency symbols) so formulas work, separator matched to the locale.
 */
export async function exportCsv(opts: {
  kind: ExportKind;
  period: Period;
  locale: string;
  t: TFunction;
}): Promise<void> {
  const { kind, period, t } = opts;
  const db = await getDatabase();
  const dec = decimalSeparator(opts.locale);
  const amount = (minor: number, currency: string) =>
    minorToDecimal(minor, currencyDigits(currency));
  let rows: Cell[][] = [];

  if (kind === 'payments') {
    const r = await db.execute(
      `SELECT p.paid_on, d.number, COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client,
         p.method, p.amount_minor, d.currency, p.note
       FROM payments p JOIN documents d ON d.id = p.document_id LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.deleted_at IS NULL AND d.status <> 'VOID' AND p.paid_on BETWEEN ? AND ?
       ORDER BY p.paid_on`,
      [period.from, period.to],
    );
    rows = [
      [t('csv.date'), t('csv.document'), t('csv.client'), t('csv.method'), t('csv.amount'), t('csv.currency'), t('csv.note')],
      ...r.rows.map(x => [
        reqStr(x.paid_on),
        str(x.number),
        str(x.client),
        x.method ? t(`paymentMethod.${reqStr(x.method)}`, { defaultValue: reqStr(x.method) }) : '',
        amount(reqNum(x.amount_minor), reqStr(x.currency)),
        reqStr(x.currency),
        str(x.note),
      ]),
    ];
  } else if (kind === 'invoices') {
    const r = await db.execute(
      `SELECT d.issue_date, d.due_date, d.doc_type, d.number, COALESCE(json_extract(d.client_snapshot_json, '$.name'), c.name) AS client,
         d.subtotal_minor, d.tax_total_minor, d.withholding_minor, d.total_minor, d.paid_minor, d.currency, d.status
       FROM documents d LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.deleted_at IS NULL AND d.doc_type IN ('INVOICE','CREDIT_NOTE') AND d.status <> 'DRAFT'
         AND d.issue_date BETWEEN ? AND ?
       ORDER BY d.issue_date, d.number`,
      [period.from, period.to],
    );
    rows = [
      [t('csv.date'), t('csv.dueDate'), t('csv.type'), t('csv.number'), t('csv.client'), t('csv.net'),
        t('csv.tax'), t('csv.withholding'), t('csv.total'), t('csv.paid'), t('csv.currency'), t('csv.status')],
      ...r.rows.map(x => {
        const cur = reqStr(x.currency);
        return [
          reqStr(x.issue_date),
          str(x.due_date),
          t(`docType.${reqStr(x.doc_type)}`, { defaultValue: reqStr(x.doc_type) }),
          str(x.number),
          str(x.client),
          amount(reqNum(x.subtotal_minor), cur),
          amount(reqNum(x.tax_total_minor), cur),
          amount(num(x.withholding_minor) ?? 0, cur),
          amount(reqNum(x.total_minor), cur),
          amount(reqNum(x.paid_minor), cur),
          cur,
          x.status === 'VOID' ? t('status.void') : '',
        ];
      }),
    ];
  } else if (kind === 'expenses') {
    const r = await db.execute(
      `SELECT date, vendor, category, amount_minor, tax_minor, currency, note, receipt_path FROM expenses
       WHERE deleted_at IS NULL AND date BETWEEN ? AND ? ORDER BY date`,
      [period.from, period.to],
    );
    rows = [
      [t('csv.date'), t('csv.vendor'), t('csv.category'), t('csv.amount'), t('csv.tax'), t('csv.currency'),
        t('csv.note'), t('csv.receipt')],
      ...r.rows.map(x => {
        const cur = reqStr(x.currency);
        const cat = str(x.category) ?? 'OTHER';
        return [
          reqStr(x.date),
          str(x.vendor),
          isExpenseCategory(cat) ? t(`expenseCategory.${cat}`) : cat,
          amount(reqNum(x.amount_minor), cur),
          amount(num(x.tax_minor) ?? 0, cur),
          cur,
          str(x.note),
          x.receipt_path ? t('csv.yes') : '',
        ];
      }),
    ];
  } else {
    const r = await db.execute(
      `SELECT date, from_place, to_place, purpose, distance_milli, unit, rate_minor, currency FROM mileage
       WHERE deleted_at IS NULL AND date BETWEEN ? AND ? ORDER BY date`,
      [period.from, period.to],
    );
    rows = [
      [t('csv.date'), t('csv.from'), t('csv.to'), t('csv.purpose'), t('csv.distance'), t('csv.unit'),
        t('csv.rate'), t('csv.amount'), t('csv.currency')],
      ...r.rows.map(x => {
        const cur = reqStr(x.currency);
        const d = reqNum(x.distance_milli);
        const rate = reqNum(x.rate_minor);
        return [
          reqStr(x.date),
          str(x.from_place),
          str(x.to_place),
          str(x.purpose),
          d / 1000,
          reqStr(x.unit),
          amount(rate, cur),
          amount(Math.round((d * rate) / 1000), cur),
          cur,
        ];
      }),
    ];
  }

  const csv = toCsv(rows, { separator: csvSeparator(dec), decimalSeparator: dec });
  const name = `${t(`reports.export.${kind}`)} ${period.from} ${period.to}.csv`;
  const path = await NativeMedia!.writeExport(name, csv);
  await NativeShare!.share({
    path,
    mime: 'text/csv',
    target: 'any',
    subject: name.replace(/\.csv$/, ''),
    text: '',
    emails: [],
    phone: '',
    chooserTitle: t('reports.exportTitle'),
  });
}
