import { detectSeparator, parseCsv } from '../csvParse';
import {
  detectSource,
  guessClientMapping,
  guessItemMapping,
  toClients,
  toItems,
} from '../importMapping';
import { dueOccurrences, nextIndexAfter, occurrence } from '../recurrence';

describe('parseCsv', () => {
  it('handles BOM, quotes, embedded newlines and CRLF', () => {
    const t = parseCsv('﻿Name,Address\r\n"Hart, Amelia","2 Granary Sq\nLondon"\r\n"Say ""hi""",x\r\n\r\n');
    expect(t.headers).toEqual(['Name', 'Address']);
    expect(t.rows).toEqual([
      ['Hart, Amelia', '2 Granary Sq\nLondon'],
      ['Say "hi"', 'x'],
    ]);
    expect(t.separator).toBe(',');
  });
  it('detects semicolons and tabs, and a last line without newline', () => {
    expect(parseCsv('Nombre;Email\nAna;a@b.c').rows).toEqual([['Ana', 'a@b.c']]);
    expect(detectSeparator('a\tb\tc\n1,2')).toBe('\t');
    expect(detectSeparator('"a;b",c\n')).toBe(',');
    expect(detectSeparator('single\n')).toBe(',');
    expect(parseCsv('a,b\r1,2').rows).toEqual([['1', '2']]);
    expect(parseCsv('')).toEqual({ headers: [], rows: [], separator: ',' });
  });
});

describe('import mapping', () => {
  it('maps Zoho Invoice contact exports', () => {
    const headers = ['Contact ID', 'Display Name', 'Company Name', 'EmailID', 'Phone', 'Billing Address', 'Billing City', 'Billing Code', 'Billing Country', 'Notes'];
    expect(detectSource(headers)).toBe('Zoho Invoice');
    expect(guessClientMapping(headers)).toEqual([null, 'name', 'company', 'email', 'phone', 'address', 'city', 'postcode', 'country', 'notes']);
  });
  it('maps Invoice Simple, Bookipi and QuickBooks headers', () => {
    expect(detectSource(['Client Name', 'Client Email', 'Client Phone'])).toBe('Invoice Simple');
    expect(guessClientMapping(['Client Name', 'Client Email', 'Client Phone'])).toEqual(['name', 'email', 'phone']);
    expect(detectSource(['Business Name', 'Contact Name', 'ABN'])).toBe('Bookipi');
    expect(detectSource(['Customer', 'Billing Street'])).toBe('QuickBooks');
    expect(detectSource(['Foo'])).toBeNull();
  });
  it('understands other languages and never reuses a field', () => {
    expect(guessClientMapping(['Nombre', 'Correo electrónico', 'Teléfono', 'NIF', 'Nombre'])).toEqual(['name', 'email', 'phone', 'taxId', null]);
    expect(guessItemMapping(['Artikel', 'Beschreibung', 'Einzelpreis', 'Einheit', 'SKU', '?'])).toEqual(['name', 'description', 'price', 'unit', 'sku', null]);
  });
  it('builds clients with a joined address and skips nameless rows', () => {
    const mapping = guessClientMapping(['Name', 'Company', 'Email', 'Street', 'City', 'Zip', 'State', 'VAT']);
    const { clients, skipped } = toClients(
      [
        ['Amelia Hart', 'Harper & Lane', 'ACCOUNTS@HL.CO', '2 Granary Sq', 'London', 'N1C 4BH', '', ''],
        ['', 'Solo Co', 'not-an-email', '', '', '', '', 'GB123'],
        ['', '', '', '', '', '', '', ''],
        ['Ana', '', '', '', 'Austin', '78701', 'TX', ''],
      ],
      mapping,
    );
    expect(skipped).toBe(1);
    expect(clients[0]).toEqual({
      name: 'Amelia Hart',
      company: 'Harper & Lane',
      email: 'accounts@hl.co',
      phone: null,
      billingAddress: '2 Granary Sq\nN1C 4BH London',
      taxId: null,
      notes: null,
      isBusiness: true,
    });
    expect(clients[1]).toMatchObject({ name: 'Solo Co', company: null, email: null, isBusiness: true });
    expect(clients[2]).toMatchObject({ billingAddress: '78701 Austin TX', isBusiness: false });
  });
  it('builds items with a cleaned price', () => {
    const { items, skipped } = toItems(
      [['Labour', 'Per hour', '$45.00', 'hr', 'LAB'], ['', 'x', '1', '', '']],
      guessItemMapping(['Item', 'Description', 'Rate', 'Unit', 'SKU']),
    );
    expect(skipped).toBe(1);
    expect(items).toEqual([{ name: 'Labour', description: 'Per hour', priceText: '45.00', unit: 'hr', sku: 'LAB' }]);
    expect(toItems([['Thing', '', '']], ['name', null, 'price']).items[0]!.priceText).toBeNull();
  });
});

describe('recurrence', () => {
  it('never drifts at month end', () => {
    expect(occurrence('2026-01-31', 'MONTHLY', 1, 1)).toBe('2026-02-28');
    expect(occurrence('2026-01-31', 'MONTHLY', 1, 2)).toBe('2026-03-31');
    expect(occurrence('2026-01-15', 'QUARTERLY', 1, 1)).toBe('2026-04-15');
    expect(occurrence('2024-02-29', 'YEARLY', 1, 1)).toBe('2025-02-28');
    expect(occurrence('2026-01-01', 'WEEKLY', 2, 1)).toBe('2026-01-15');
    expect(occurrence('2026-01-01', 'WEEKLY', 0, 1)).toBe('2026-01-08');
  });
  it('lists due occurrences, capped and bounded by the end date', () => {
    const base = { anchor: '2026-01-10', frequency: 'MONTHLY' as const, interval: 1, from: 1, endDate: null };
    expect(dueOccurrences({ ...base, today: '2026-02-09' })).toEqual([]);
    expect(dueOccurrences({ ...base, today: '2026-03-10' })).toEqual([
      { index: 1, date: '2026-02-10' },
      { index: 2, date: '2026-03-10' },
    ]);
    expect(dueOccurrences({ ...base, today: '2027-01-01' })).toHaveLength(3);
    expect(dueOccurrences({ ...base, today: '2027-01-01', endDate: '2026-02-28' })).toHaveLength(1);
    expect(nextIndexAfter('2026-01-10', 'MONTHLY', 1, 1, '2026-06-10')).toBe(6);
  });
});
