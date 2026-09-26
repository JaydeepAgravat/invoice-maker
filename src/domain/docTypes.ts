export const DOC_TYPES = [
  'INVOICE',
  'ESTIMATE',
  'RECEIPT',
  'CREDIT_NOTE',
  'PROFORMA',
  'DELIVERY_NOTE',
  'CHANGE_ORDER',
  'PURCHASE_ORDER',
  'STATEMENT',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export const isDocType = (value: string): value is DocType =>
  (DOC_TYPES as readonly string[]).includes(value);

/** Documents that carry prices and totals (a delivery note does not). */
export const hasPrices = (type: DocType) => type !== 'DELIVERY_NOTE';

/** Documents that can receive payments. */
export const isPayable = (type: DocType) => type === 'INVOICE';

/** Documents addressed to a supplier instead of a client. */
export const isSupplierFacing = (type: DocType) => type === 'PURCHASE_ORDER';
