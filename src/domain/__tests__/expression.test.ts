import { evaluate, toEditableText } from '../expression';

describe('evaluate', () => {
  it.each([
    ['12', 2, 1200, false],
    ['12.5', 2, 1250, false],
    ['2.5×45', 2, 11250, true],
    ['2.5 x 45', 2, 11250, true],
    ['100 − 15%'.replace('%', ''), 2, 8500, true],
    ['1 + 2 * 3', 0, 7, true],
    ['(1 + 2) * 3', 0, 9, true],
    ['10 ÷ 3', 2, 333, true],
    ['2 / 3', 3, 667, true],
    ['-4 + 10', 0, 6, true],
    ['+4', 0, 4, true],
    ['--4', 0, 4, true],
    ['.5', 3, 500, false],
    ['0.125', 3, 125, false],
    ['1.005', 2, 101, false],
  ] as const)('%p at scale %i = %i', (input, scale, value, isExpression) => {
    expect(evaluate(input, scale)).toEqual({ value, isExpression });
  });

  it('accepts the locale decimal separator', () => {
    expect(evaluate('2,5×4', 2, ',')).toEqual({
      value: 1000,
      isExpression: true,
    });
  });

  it.each([
    [''],
    ['abc'],
    ['1..2'],
    ['1.2.3'],
    ['.'],
    ['1 +'],
    ['(1 + 2'],
    ['1 + 2)'],
    ['4 / 0'],
    ['*3'],
    ['()'],
    ['1 ++ '],
  ])('rejects %p', input => {
    expect(evaluate(input, 2)).toBeNull();
  });

  it('rejects results beyond safe integers', () => {
    expect(evaluate('99999999999999999', 2)).toBeNull();
    expect(evaluate('-99999999999999999', 2)).toBeNull();
  });
});

describe('toEditableText', () => {
  it('drops trailing zeros and keeps sign', () => {
    expect(toEditableText(11250, 2)).toBe('112.5');
    expect(toEditableText(1200, 2)).toBe('12');
    expect(toEditableText(5, 2)).toBe('0.05');
    expect(toEditableText(-150, 2, ',')).toBe('-1,5');
    expect(toEditableText(1500, 3)).toBe('1.5');
    expect(toEditableText(42, 0)).toBe('42');
  });
});
