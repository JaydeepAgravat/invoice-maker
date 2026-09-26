import { hasPrices, isDocType, isPayable, isSupplierFacing } from '../docTypes';
import {
  defaultPrefix,
  formatDocumentNumber,
  sequenceKey,
  validateNextValue,
} from '../numbering';

describe('formatDocumentNumber', () => {
  it('formats sequential and yearly numbers', () => {
    expect(
      formatDocumentNumber(
        { prefix: 'INV', pad: 4, style: 'SEQUENTIAL' },
        42,
        2026,
      ),
    ).toBe('INV-0042');
    expect(
      formatDocumentNumber({ prefix: 'FAC', pad: 3, style: 'YEARLY' }, 7, 2026),
    ).toBe('FAC-2026-007');
  });

  it('handles empty prefixes, overflow and bounds padding', () => {
    expect(
      formatDocumentNumber(
        { prefix: '  ', pad: 4, style: 'SEQUENTIAL' },
        5,
        2026,
      ),
    ).toBe('0005');
    expect(
      formatDocumentNumber(
        { prefix: 'INV', pad: 2, style: 'SEQUENTIAL' },
        1234,
        2026,
      ),
    ).toBe('INV-1234');
    expect(
      formatDocumentNumber(
        { prefix: 'X', pad: 0, style: 'SEQUENTIAL' },
        3,
        2026,
      ),
    ).toBe('X-3');
    expect(
      formatDocumentNumber(
        { prefix: 'X', pad: 50, style: 'SEQUENTIAL' },
        3,
        2026,
      ),
    ).toBe('X-0000000003');
  });

  it('rejects invalid sequence values', () => {
    const fmt = { prefix: 'INV', pad: 4, style: 'SEQUENTIAL' as const };
    expect(() => formatDocumentNumber(fmt, 0, 2026)).toThrow(RangeError);
    expect(() => formatDocumentNumber(fmt, 1.5, 2026)).toThrow(RangeError);
  });
});

describe('sequences', () => {
  it('keys yearly sequences by year', () => {
    expect(sequenceKey('INVOICE', 'SEQUENTIAL', 2026)).toBe('INVOICE');
    expect(sequenceKey('INVOICE', 'YEARLY', 2026)).toBe('INVOICE:2026');
  });

  it('never allows reusing or going below issued numbers', () => {
    expect(validateNextValue(43, 42)).toBeNull();
    expect(validateNextValue(42, 42)).toBe('NEXT_NUMBER_TOO_LOW');
    expect(validateNextValue(0, 0)).toBe('NEXT_NUMBER_INVALID');
    expect(validateNextValue(2.5, 0)).toBe('NEXT_NUMBER_INVALID');
  });

  it('has localized default prefixes with an English fallback', () => {
    expect(defaultPrefix('de', 'INVOICE')).toBe('RE');
    expect(defaultPrefix('fr', 'ESTIMATE')).toBe('DEV');
    expect(defaultPrefix('xx', 'INVOICE')).toBe('INV');
  });
});

describe('docTypes', () => {
  it('classifies document types', () => {
    expect(isDocType('INVOICE')).toBe(true);
    expect(isDocType('NOPE')).toBe(false);
    expect(hasPrices('DELIVERY_NOTE')).toBe(false);
    expect(hasPrices('INVOICE')).toBe(true);
    expect(isPayable('INVOICE')).toBe(true);
    expect(isPayable('ESTIMATE')).toBe(false);
    expect(isSupplierFacing('PURCHASE_ORDER')).toBe(true);
    expect(isSupplierFacing('INVOICE')).toBe(false);
  });
});
