import { allocate, allocateExact, Fraction, toSafeNumber } from '../fraction';

describe('Fraction', () => {
  it('normalizes sign and reduces', () => {
    const f = Fraction.of(6, -8);
    expect(f.num).toBe(-3n);
    expect(f.den).toBe(4n);
  });

  it('rejects zero denominators and division by zero', () => {
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
    expect(() => Fraction.of(1).div(Fraction.ZERO)).toThrow(RangeError);
  });

  it('rejects unsafe numbers', () => {
    expect(() => Fraction.of(0.5)).toThrow(RangeError);
  });

  it('does arithmetic exactly', () => {
    const third = Fraction.of(1, 3);
    expect(third.add(third).add(third).compare(Fraction.of(1))).toBe(0);
    expect(
      Fraction.of(1, 2).sub(Fraction.of(1, 3)).compare(Fraction.of(1, 6)),
    ).toBe(0);
    expect(
      Fraction.of(2, 3).mul(Fraction.of(3, 4)).compare(Fraction.of(1, 2)),
    ).toBe(0);
    expect(
      Fraction.of(1, 2).div(Fraction.of(1, 4)).compare(Fraction.of(2)),
    ).toBe(0);
  });

  it('reports sign, zero and comparison', () => {
    expect(Fraction.of(-1, 2).sign()).toBe(-1);
    expect(Fraction.ZERO.sign()).toBe(0);
    expect(Fraction.of(1, 9).sign()).toBe(1);
    expect(Fraction.ZERO.isZero()).toBe(true);
    expect(Fraction.of(1, 3).compare(Fraction.of(1, 2))).toBe(-1);
    expect(Fraction.of(1, 2).compare(Fraction.of(1, 3))).toBe(1);
  });

  it.each([
    [5, 2, 'HALF_UP', 3n],
    [-5, 2, 'HALF_UP', -3n],
    [5, 2, 'HALF_EVEN', 2n],
    [7, 2, 'HALF_EVEN', 4n],
    [-5, 2, 'HALF_EVEN', -2n],
    [7, 3, 'HALF_UP', 2n],
    [8, 3, 'HALF_UP', 3n],
    [-8, 3, 'HALF_EVEN', -3n],
    [6, 3, 'HALF_UP', 2n],
  ] as const)('rounds %i/%i with %s to %s', (n, d, mode, expected) => {
    expect(Fraction.of(n, d).round(mode)).toBe(expected);
  });

  it('defaults to HALF_UP', () => {
    expect(Fraction.of(1, 2).round()).toBe(1n);
  });

  it('splits positive values into whole and remainder', () => {
    const { whole, remainder } = Fraction.of(7, 2).truncParts();
    expect(whole).toBe(3n);
    expect(remainder.compare(Fraction.of(1, 2))).toBe(0);
  });

  it('splits into whole and remainder', () => {
    const { whole, remainder } = Fraction.of(-7, 2).truncParts();
    expect(whole).toBe(-3n);
    expect(remainder.compare(Fraction.of(1, 2))).toBe(0);
  });
});

describe('toSafeNumber', () => {
  it('converts and guards range', () => {
    expect(toSafeNumber(42n)).toBe(42);
    expect(() => toSafeNumber(2n ** 60n)).toThrow(RangeError);
    expect(() => toSafeNumber(-(2n ** 60n))).toThrow(RangeError);
  });
});

describe('allocate', () => {
  it('splits proportionally and sums exactly', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [10000, 20000])).toEqual([333, 667]);
  });

  it('handles negative totals', () => {
    const parts = allocate(-100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-100);
    expect(parts).toEqual([-33, -33, -34]);
  });

  it('handles empty and zero weights', () => {
    expect(allocate(5, [])).toEqual([]);
    expect(allocate(5, [0, 0])).toEqual([5, 0]);
  });

  it('allocateExact distributes rounding remainder by largest fraction', () => {
    const exact = [
      Fraction.of(33, 10),
      Fraction.of(33, 10),
      Fraction.of(33, 10),
    ];
    expect(allocateExact(10, exact)).toEqual([4, 3, 3]);
  });

  it('allocateExact refuses totals that are not the rounded sum', () => {
    const exact = [Fraction.of(1, 2), Fraction.of(1, 2)];
    expect(() => allocateExact(5, exact)).toThrow(RangeError);
    expect(() => allocateExact(-1, exact)).toThrow(RangeError);
  });
});
