import {
  crc16,
  epcPayload,
  fieldsFor,
  formatField,
  formatIban,
  isComplete,
  isValidBic,
  isValidIban,
  kindsFor,
  pixPayload,
  qrFor,
  type PaymentMethod,
} from '../payments';

const method = (over: Partial<PaymentMethod>): PaymentMethod => ({
  id: 'm1',
  kind: 'BANK',
  label: null,
  fields: {},
  showQr: true,
  isDefault: true,
  position: 0,
  ...over,
});

describe('IBAN', () => {
  it('accepts valid IBANs with or without spaces', () => {
    expect(isValidIban('ES91 2100 0418 4502 0005 1332')).toBe(true);
    expect(isValidIban('de89370400440532013000')).toBe(true);
    expect(isValidIban('GB29NWBK60161331926819')).toBe(true);
  });
  it('rejects bad check digits and malformed input', () => {
    expect(isValidIban('ES9121000418450200051333')).toBe(false);
    expect(isValidIban('12')).toBe(false);
    expect(isValidIban('')).toBe(false);
  });
  it('formats in groups of four', () => {
    expect(formatIban('es9121000418450200051332')).toBe(
      'ES91 2100 0418 4502 0005 1332',
    );
  });
  it('validates BIC', () => {
    expect(isValidBic('CAIXESBBXXX')).toBe(true);
    expect(isValidBic('deut de ff')).toBe(true);
    expect(isValidBic('CAIX')).toBe(false);
  });
});

describe('EPC QR', () => {
  it('builds a SEPA credit transfer payload', () => {
    expect(
      epcPayload({
        name: 'Taller Núñez',
        iban: 'ES91 2100 0418 4502 0005 1332',
        bic: 'CAIXESBBXXX',
        amount: 123456,
        reference: 'FAC-2026-0007',
      }),
    ).toBe(
      'BCD\n002\n1\nSCT\nCAIXESBBXXX\nTaller Núñez\nES9121000418450200051332\nEUR1234.56\n\n\nFAC-2026-0007',
    );
  });
  it('drops trailing empty fields and optional BIC', () => {
    expect(
      epcPayload({ name: 'A', iban: 'DE89370400440532013000', amount: 0 }),
    ).toBe('BCD\n002\n1\nSCT\n\nA\nDE89370400440532013000');
  });
  it('refuses invalid IBANs and empty names', () => {
    expect(epcPayload({ name: 'A', iban: 'DE00' })).toBeNull();
    expect(epcPayload({ name: ' ', iban: 'DE89370400440532013000' })).toBeNull();
  });
});

describe('Pix BR Code', () => {
  it('matches the Banco Central reference example', () => {
    expect(
      pixPayload({
        key: '123e4567-e12b-12d1-a456-426655440000',
        name: 'Fulano de Tal',
        city: 'BRASILIA',
      }),
    ).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });
  it('adds the amount, strips accents and uses the reference as txid', () => {
    const p = pixPayload({
      key: 'ana@exemplo.com.br',
      name: 'Ana Conceição',
      city: 'São Paulo',
      amount: 15050,
      reference: 'REC-0003',
    })!;
    expect(p).toContain('5406150.50');
    expect(p).toContain('5913Ana Conceicao');
    expect(p).toContain('6009Sao Paulo');
    expect(p).toContain('0507REC0003');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it('refuses missing data', () => {
    expect(pixPayload({ key: '', name: 'A', city: 'B' })).toBeNull();
    expect(pixPayload({ key: 'k', name: '', city: 'B' })).toBeNull();
    expect(pixPayload({ key: 'x'.repeat(78), name: 'A', city: 'B' })).toBeNull();
  });
});

describe('qrFor', () => {
  const ctx = {
    currency: 'EUR',
    amount: 1000,
    reference: 'INV-1',
    businessName: 'Biz',
  };
  it('gives an EPC code for euro bank accounts', () => {
    const qr = qrFor(
      method({ fields: { iban: 'DE89370400440532013000' } }),
      ctx,
    );
    expect(qr?.kind).toBe('EPC');
    expect(qr?.payload).toContain('\nBiz\n');
  });
  it('gives nothing for other currencies, missing IBAN or QR turned off', () => {
    expect(
      qrFor(method({ fields: { iban: 'DE89370400440532013000' } }), {
        ...ctx,
        currency: 'USD',
      }),
    ).toBeNull();
    expect(qrFor(method({ fields: {} }), ctx)).toBeNull();
    expect(
      qrFor(
        method({ showQr: false, fields: { iban: 'DE89370400440532013000' } }),
        ctx,
      ),
    ).toBeNull();
    expect(
      qrFor(method({ fields: { iban: 'DE00', accountName: 'X' } }), ctx),
    ).toBeNull();
  });
  it('gives a Pix code for BRL', () => {
    const pix = method({
      kind: 'PIX',
      fields: { pixKey: 'k@x.com', merchantCity: 'Rio' },
    });
    expect(qrFor(pix, { ...ctx, currency: 'BRL' })?.kind).toBe('PIX');
    expect(qrFor(pix, ctx)).toBeNull();
    expect(
      qrFor(method({ kind: 'PIX', fields: { pixKey: 'k' } }), {
        ...ctx,
        currency: 'BRL',
      }),
    ).toBeNull();
    expect(
      qrFor(method({ kind: 'PIX', fields: {} }), { ...ctx, currency: 'BRL' }),
    ).toBeNull();
  });
  it('gives link codes only for web links', () => {
    expect(
      qrFor(
        method({ kind: 'LINK', fields: { url: 'https://pay.me/abc' } }),
        ctx,
      ),
    ).toEqual({ kind: 'LINK', payload: 'https://pay.me/abc' });
    expect(
      qrFor(method({ kind: 'PAYPAL', fields: { email: 'a@b.c' } }), ctx),
    ).toBeNull();
    expect(
      qrFor(method({ kind: 'OTHER', fields: { instructions: 'x' } }), ctx),
    ).toBeNull();
  });
});

describe('fields and kinds', () => {
  it('uses local bank fields', () => {
    expect(fieldsFor('BANK', 'US')).toContain('routingNumber');
    expect(fieldsFor('BANK', 'AU')).toContain('bsb');
    expect(fieldsFor('BANK', 'ES')).toEqual(['accountName', 'iban', 'bic']);
    expect(fieldsFor('PIX', 'BR')).toContain('pixKey');
    expect(fieldsFor('PAYPAL', 'US')).toEqual(['email', 'url']);
    expect(fieldsFor('LINK', 'US')).toEqual(['url']);
    expect(fieldsFor('OTHER', 'US')).toEqual(['instructions']);
  });
  it('offers Pix first in Brazil only', () => {
    expect(kindsFor('BR')[0]).toBe('PIX');
    expect(kindsFor('US')).not.toContain('PIX');
  });
  it('knows when a method is filled in', () => {
    expect(isComplete(method({ fields: { iban: ' ' } }))).toBe(false);
    expect(isComplete(method({ fields: { iban: 'x' } }))).toBe(true);
  });
});

describe('formatField', () => {
  it('formats bank numbers the way they are printed locally', () => {
    expect(formatField('sortCode', '040004')).toBe('04-00-04');
    expect(formatField('sortCode', '04-00-04')).toBe('04-00-04');
    expect(formatField('bsb', '062000')).toBe('062-000');
    expect(formatField('iban', 'de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
    expect(formatField('accountNumber', ' 123 ')).toBe('123');
    expect(formatField('sortCode', '0400')).toBe('0400');
  });
});
