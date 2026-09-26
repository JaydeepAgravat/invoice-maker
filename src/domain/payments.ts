import type { CountryCode } from './presets';

/**
 * Structured payment details printed on documents, and the QR codes that
 * let clients pay by scanning: SEPA credit transfer (EPC069-12) for euro
 * IBANs, Pix "copia e cola" (BR Code, static) for Brazil, and plain links.
 */

export type PaymentKind = 'BANK' | 'PIX' | 'PAYPAL' | 'LINK' | 'OTHER';

export const PAYMENT_KINDS: readonly PaymentKind[] = [
  'BANK',
  'PIX',
  'PAYPAL',
  'LINK',
  'OTHER',
];

export type BankField =
  | 'accountName'
  | 'bankName'
  | 'iban'
  | 'bic'
  | 'accountNumber'
  | 'routingNumber'
  | 'sortCode'
  | 'bsb'
  | 'institution'
  | 'transit'
  | 'clabe'
  | 'agency';

export type PaymentField =
  | BankField
  | 'pixKey'
  | 'merchantCity'
  | 'url'
  | 'email'
  | 'instructions';

export type PaymentFields = Partial<Record<PaymentField, string>>;

export type PaymentMethod = {
  id: string;
  kind: PaymentKind;
  /** Optional name the person gives it, e.g. "Business account". */
  label: string | null;
  fields: PaymentFields;
  showQr: boolean;
  isDefault: boolean;
  position: number;
};

/** Bank details people in each country expect to see, in print order. */
export const BANK_FIELDS: Record<CountryCode, readonly BankField[]> = {
  US: ['accountName', 'bankName', 'routingNumber', 'accountNumber'],
  GB: ['accountName', 'sortCode', 'accountNumber', 'iban', 'bic'],
  CA: ['accountName', 'bankName', 'institution', 'transit', 'accountNumber'],
  AU: ['accountName', 'bsb', 'accountNumber'],
  ES: ['accountName', 'iban', 'bic'],
  MX: ['accountName', 'bankName', 'clabe'],
  BR: ['accountName', 'bankName', 'agency', 'accountNumber'],
  FR: ['accountName', 'iban', 'bic'],
  DE: ['accountName', 'iban', 'bic'],
  PT: ['accountName', 'iban', 'bic'],
  OTHER: ['accountName', 'bankName', 'iban', 'bic', 'accountNumber'],
};

/** Fields shown in the editor for each kind (bank fields depend on country). */
export const fieldsFor = (
  kind: PaymentKind,
  country: CountryCode,
): readonly PaymentField[] => {
  switch (kind) {
    case 'BANK':
      return BANK_FIELDS[country];
    case 'PIX':
      return ['pixKey', 'accountName', 'merchantCity'];
    case 'PAYPAL':
      return ['email', 'url'];
    case 'LINK':
      return ['url'];
    case 'OTHER':
      return ['instructions'];
  }
};

/** Payment kinds offered for a country, most useful first. */
export const kindsFor = (country: CountryCode): readonly PaymentKind[] =>
  country === 'BR'
    ? ['PIX', 'BANK', 'LINK', 'PAYPAL', 'OTHER']
    : ['BANK', 'LINK', 'PAYPAL', 'OTHER'];

/* ─────────────────────────────── IBAN ─────────────────────────────── */

export const normalizeIban = (input: string) =>
  input.replace(/[\s-]/g, '').toUpperCase();

/** ISO 13616 check: country code, check digits and mod-97 == 1. */
export const isValidIban = (input: string): boolean => {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const digits = code >= 65 ? String(code - 55) : ch;
    for (const d of digits) {
      remainder = (remainder * 10 + Number(d)) % 97;
    }
  }
  return remainder === 1;
};

/** "ES9121000418450200051332" → "ES91 2100 0418 4502 0005 1332". */
export const formatIban = (input: string) =>
  normalizeIban(input).replace(/(.{4})(?=.)/g, '$1 ');

export const isValidBic = (input: string) =>
  /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(
    input.replace(/\s/g, '').toUpperCase(),
  );

/* ──────────────────────────── QR payloads ─────────────────────────── */

const stripDiacritics = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const amountText = (minor: number, digits: number) =>
  (minor / 10 ** digits).toFixed(digits);

/**
 * SEPA credit transfer QR (EPC069-12 v2, UTF-8). Only valid for euros.
 * Most European banking apps prefill the transfer from it.
 */
export const epcPayload = (opts: {
  name: string;
  iban: string;
  bic?: string | null;
  amount?: number | null;
  reference?: string | null;
}): string | null => {
  const iban = normalizeIban(opts.iban);
  if (!isValidIban(iban) || !opts.name.trim()) {
    return null;
  }
  const amount = opts.amount ?? 0;
  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    (opts.bic ?? '').replace(/\s/g, '').toUpperCase(),
    opts.name.trim().slice(0, 70),
    iban,
    amount > 0 && amount <= 99_999_999_999 ? `EUR${amountText(amount, 2)}` : '',
    '',
    '',
    (opts.reference ?? '').trim().slice(0, 140),
  ];
  while (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
};

/* eslint-disable no-bitwise -- CRC arithmetic */
/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMV QR. */
export const crc16 = (input: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};
/* eslint-enable no-bitwise */

const tlv = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

/**
 * Static Pix BR Code ("Pix copia e cola"), per the Banco Central manual.
 * The amount is optional; the reference becomes the txid (alphanumeric).
 */
export const pixPayload = (opts: {
  key: string;
  name: string;
  city: string;
  amount?: number | null;
  reference?: string | null;
}): string | null => {
  const key = opts.key.trim();
  const name = stripDiacritics(opts.name).trim().slice(0, 25);
  const city = stripDiacritics(opts.city).trim().slice(0, 15);
  if (!key || key.length > 77 || !name || !city) {
    return null;
  }
  const txid =
    (opts.reference ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const amount = opts.amount ?? 0;
  const body =
    tlv('00', '01') +
    tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount > 0 ? tlv('54', amountText(amount, 2)) : '') +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', city) +
    tlv('62', tlv('05', txid)) +
    '6304';
  return body + crc16(body);
};

const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());

export type PaymentQr = { kind: 'EPC' | 'PIX' | 'LINK'; payload: string };

/** The QR for a payment method on a given document, when one makes sense. */
export const qrFor = (
  method: PaymentMethod,
  ctx: {
    currency: string;
    amount: number;
    reference: string | null;
    businessName: string;
  },
): PaymentQr | null => {
  if (!method.showQr) {
    return null;
  }
  const f = method.fields;
  switch (method.kind) {
    case 'BANK': {
      if (ctx.currency !== 'EUR' || !f.iban) {
        return null;
      }
      const payload = epcPayload({
        name: f.accountName || ctx.businessName,
        iban: f.iban,
        bic: f.bic,
        amount: ctx.amount,
        reference: ctx.reference,
      });
      return payload ? { kind: 'EPC', payload } : null;
    }
    case 'PIX': {
      if (ctx.currency !== 'BRL' || !f.pixKey) {
        return null;
      }
      const payload = pixPayload({
        key: f.pixKey,
        name: f.accountName || ctx.businessName,
        city: f.merchantCity || '',
        amount: ctx.amount,
        reference: ctx.reference,
      });
      return payload ? { kind: 'PIX', payload } : null;
    }
    case 'PAYPAL':
    case 'LINK':
      return f.url && isHttpUrl(f.url)
        ? { kind: 'LINK', payload: f.url.trim() }
        : null;
    case 'OTHER':
      return null;
  }
};

/** Display form of a field: grouped IBAN, dashed sort code and BSB. */
export const formatField = (field: PaymentField, value: string): string => {
  const v = value.trim();
  const digits = v.replace(/\D/g, '');
  if (field === 'iban') {
    return formatIban(v);
  }
  if (field === 'sortCode' && digits.length === 6) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
  }
  if (field === 'bsb' && digits.length === 6) {
    return digits.replace(/(\d{3})(\d{3})/, '$1-$2');
  }
  return v;
};

/** Whether a method has enough filled in to be worth printing. */
export const isComplete = (method: PaymentMethod): boolean =>
  Object.values(method.fields).some(v => !!v && v.trim().length > 0);
