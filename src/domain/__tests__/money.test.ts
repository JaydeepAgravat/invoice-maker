import {
  currencyDigits,
  decimalSeparator,
  formatMoney,
  parseMoney,
  parseQuantity,
  percentToRate,
  rateToPercent,
} from '../money';

const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

describe('currency digits', () => {
  it('knows zero- and three-decimal currencies', () => {
    expect(currencyDigits('usd')).toBe(2);
    expect(currencyDigits('JPY')).toBe(0);
    expect(currencyDigits('KWD')).toBe(3);
  });
});

describe('rates', () => {
  it('converts percent and ppm both ways', () => {
    expect(percentToRate(9.975)).toBe(99_750);
    expect(percentToRate(20)).toBe(200_000);
    expect(percentToRate(10.6667)).toBe(106_667);
    expect(rateToPercent(99_750)).toBe(9.975);
  });
});

describe('formatMoney', () => {
  it('formats per locale and currency', () => {
    expect(formatMoney(123456, { locale: 'en-US', currency: 'USD' })).toBe(
      '$1,234.56',
    );
    expect(
      nbsp(formatMoney(123456, { locale: 'de-DE', currency: 'EUR' })),
    ).toBe('1.234,56 €');
    expect(formatMoney(1234, { locale: 'en-US', currency: 'JPY' })).toBe(
      '¥1,234',
    );
    expect(formatMoney(-500, { locale: 'en-GB', currency: 'GBP' })).toBe(
      '-£5.00',
    );
  });

  it('supports plain numbers and forced signs', () => {
    expect(
      formatMoney(123456, { locale: 'en-US', currency: 'USD', symbol: false }),
    ).toBe('1,234.56');
    expect(
      formatMoney(500, { locale: 'en-US', currency: 'USD', signed: true }),
    ).toBe('+$5.00');
    expect(
      formatMoney(0, { locale: 'en-US', currency: 'USD', signed: true }),
    ).toBe('$0.00');
  });
});

describe('decimalSeparator', () => {
  it('reads the locale', () => {
    expect(decimalSeparator('en-US')).toBe('.');
    expect(decimalSeparator('pt-BR')).toBe(',');
  });
});

describe('parseMoney', () => {
  it.each([
    ['12.50', 'USD', 'en-US', 1250],
    ['1,234.5', 'USD', 'en-US', 123450],
    ['$ 1,234.56', 'USD', 'en-US', 123456],
    ['12', 'USD', 'en-US', 1200],
    ['.5', 'USD', 'en-US', 50],
    ['-3.2', 'USD', 'en-US', -320],
    ['−3.2', 'USD', 'en-US', -320],
    ['12,50', 'EUR', 'de-DE', 1250],
    ['1.234,56 €', 'EUR', 'de-DE', 123456],
    ['12.5', 'EUR', 'de-DE', 1250],
    ['1.000', 'EUR', 'de-DE', 100000],
    ['1,5', 'USD', 'en-US', 150],
    ['1,000', 'USD', 'en-US', 100000],
    ['1 234,56', 'EUR', 'fr-FR', 123456],
    ['1,000', 'JPY', 'en-US', 1000],
    ['5', 'KWD', 'en-US', 5000],
  ] as const)(
    'parses %p (%s, %s) as %i',
    (input, currency, locale, expected) => {
      expect(parseMoney(input, currency, locale)).toBe(expected);
    },
  );

  it.each([[''], ['abc'], ['1.2.3,4,5'], ['1.234'], ['-'], ['.']])(
    'rejects %p',
    input => {
      expect(parseMoney(input, 'USD', 'en-US')).toBeNull();
    },
  );

  it('rejects too many decimals and unsafe values', () => {
    expect(parseMoney('1.999', 'USD', 'en-US')).toBeNull();
    expect(parseMoney('99999999999999999999', 'USD', 'en-US')).toBeNull();
  });
});

describe('parseQuantity', () => {
  it('parses to thousandths', () => {
    expect(parseQuantity('1.5', 'en-US')).toBe(1500);
    expect(parseQuantity('2,25', 'de-DE')).toBe(2250);
    expect(parseQuantity('0.125', 'en-US')).toBe(125);
    expect(parseQuantity('10', 'en-US')).toBe(10000);
  });
});
