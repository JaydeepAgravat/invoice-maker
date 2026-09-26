import { calculate } from '../calc';
import {
  COUNTRY_CODES,
  documentTitleKey,
  isValidABN,
  legalNotesFor,
  PRESETS,
  presetForLocale,
  taxesFor,
} from '../presets';
import { isKnownUnit, unitsFor } from '../units';

describe('presets', () => {
  it('every country has consistent defaults', () => {
    for (const code of COUNTRY_CODES) {
      const p = PRESETS[code];
      expect(p.code).toBe(code);
      expect(p.currency).toMatch(/^[A-Z]{3}$/);
      expect(
        p.taxes.filter(t => t.isDefault && t.kind !== 'WITHHOLDING').length,
      ).toBeLessThanOrEqual(1);
      for (const tax of p.taxes) {
        expect(Number.isInteger(tax.rate)).toBe(true);
        expect(tax.rate).toBeGreaterThanOrEqual(0);
        expect(tax.rate).toBeLessThan(1_000_000);
      }
    }
  });

  it('matches device locales to countries', () => {
    expect(presetForLocale('pt-BR').code).toBe('BR');
    expect(presetForLocale('en_AU').code).toBe('AU');
    expect(presetForLocale('en-UK').code).toBe('GB');
    expect(presetForLocale('en-IN').code).toBe('OTHER');
    expect(presetForLocale('en').code).toBe('OTHER');
  });

  it('narrows taxes by region', () => {
    expect(taxesFor('CA', 'ON').map(t => t.name)).toEqual(['HST']);
    expect(taxesFor('CA', 'QC').map(t => t.rate)).toEqual([50_000, 99_750]);
    expect(taxesFor('CA', 'XX')).toEqual(PRESETS.CA.taxes);
    expect(taxesFor('CA')).toEqual(PRESETS.CA.taxes);
    expect(taxesFor('ES', 'CN')[0]!.name).toBe('IGIC');
  });

  it('Québec preset produces the expected GST + QST total', () => {
    const taxes = taxesFor('CA', 'QC').map(t => ({
      id: t.key,
      name: t.name,
      rate: t.rate,
      kind: t.kind,
    }));
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 10000, taxes }],
    });
    expect(r.total).toBe(11498);
  });

  it('Mexico preset handles both withholdings', () => {
    const taxes = PRESETS.MX.taxes
      .filter(t => ['mx_iva16', 'mx_ret_isr', 'mx_ret_iva'].includes(t.key))
      .map(t => ({ id: t.key, name: t.name, rate: t.rate, kind: t.kind }));
    const r = calculate({
      lines: [{ id: 'a', quantity: 1000, unitPrice: 1000000, taxes }],
    });
    // 10,000 + 1,600 IVA − 1,000 ISR − 1,066.67 IVA retained
    expect(r.taxTotal).toBe(160000);
    expect(r.withholdingTotal).toBe(100000 + 106667);
    expect(r.total).toBe(1160000 - 206667);
  });

  it('selects legal notes by registration and client type', () => {
    expect(
      legalNotesFor('FR', {
        taxRegistered: false,
        clientIsBusiness: false,
      }).map(n => n.key),
    ).toEqual(['fr_293b']);
    expect(
      legalNotesFor('FR', { taxRegistered: true, clientIsBusiness: true }).map(
        n => n.key,
      ),
    ).toEqual(['fr_late_b2b']);
    expect(
      legalNotesFor('DE', { taxRegistered: true, clientIsBusiness: true }),
    ).toEqual([]);
    expect(
      legalNotesFor('US', { taxRegistered: false, clientIsBusiness: true }),
    ).toEqual([]);
  });

  it('titles documents per country rules', () => {
    expect(documentTitleKey('AU', 'INVOICE', { taxRegistered: true })).toBe(
      'TAX_INVOICE',
    );
    expect(documentTitleKey('AU', 'INVOICE', { taxRegistered: false })).toBe(
      'INVOICE',
    );
    expect(documentTitleKey('GB', 'ESTIMATE', { taxRegistered: true })).toBe(
      'QUOTE',
    );
    expect(documentTitleKey('US', 'ESTIMATE', { taxRegistered: true })).toBe(
      'ESTIMATE',
    );
    expect(documentTitleKey('US', 'RECEIPT', { taxRegistered: true })).toBe(
      'RECEIPT',
    );
  });

  it('validates ABNs with the ATO checksum', () => {
    expect(isValidABN('51 824 753 556')).toBe(true);
    expect(isValidABN('51824753557')).toBe(false);
    expect(isValidABN('1234')).toBe(false);
  });
});

describe('units', () => {
  it('orders shared units first, then the preferred system', () => {
    const metric = unitsFor('METRIC').map(u => u.key);
    expect(metric.slice(0, 8)).toEqual([
      'item',
      'unit',
      'pc',
      'project',
      'hr',
      'day',
      'week',
      'month',
    ]);
    expect(metric.indexOf('m2')).toBeLessThan(metric.indexOf('ft2'));
    const imperial = unitsFor('IMPERIAL').map(u => u.key);
    expect(imperial.indexOf('ft2')).toBeLessThan(imperial.indexOf('m2'));
  });

  it('recognises known units', () => {
    expect(isKnownUnit('hr')).toBe(true);
    expect(isKnownUnit('furlong')).toBe(false);
  });
});
