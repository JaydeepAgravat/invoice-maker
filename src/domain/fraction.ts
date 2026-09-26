/**
 * Exact rational arithmetic on BigInt.
 *
 * All money math runs on exact fractions and is rounded only at explicit,
 * documented points. This is what keeps totals, tax breakdowns and line
 * amounts consistent to the cent in every country preset.
 */

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN';

const toBig = (v: bigint | number): bigint => {
  if (typeof v === 'bigint') {
    return v;
  }
  if (!Number.isSafeInteger(v)) {
    throw new RangeError(`Expected a safe integer, got ${v}`);
  }
  return BigInt(v);
};

const abs = (v: bigint) => (v < 0n ? -v : v);

const gcd = (a: bigint, b: bigint): bigint => {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
};

export class Fraction {
  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    if (den === 0n) {
      throw new RangeError('Fraction denominator cannot be zero');
    }
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = gcd(num < 0n ? -num : num, den);
    this.num = g > 1n ? num / g : num;
    this.den = g > 1n ? den / g : den;
  }

  static of(num: bigint | number, den: bigint | number = 1n): Fraction {
    return new Fraction(toBig(num), toBig(den));
  }

  static readonly ZERO = Fraction.of(0n);

  add(other: Fraction): Fraction {
    return new Fraction(
      this.num * other.den + other.num * this.den,
      this.den * other.den,
    );
  }

  sub(other: Fraction): Fraction {
    return new Fraction(
      this.num * other.den - other.num * this.den,
      this.den * other.den,
    );
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.num * other.num, this.den * other.den);
  }

  div(other: Fraction): Fraction {
    if (other.num === 0n) {
      throw new RangeError('Division by zero');
    }
    return new Fraction(this.num * other.den, this.den * other.num);
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  sign(): -1 | 0 | 1 {
    return this.num === 0n ? 0 : this.num < 0n ? -1 : 1;
  }

  compare(other: Fraction): -1 | 0 | 1 {
    const d = this.num * other.den - other.num * this.den;
    return d === 0n ? 0 : d < 0n ? -1 : 1;
  }

  /** Round to an integer. HALF_UP rounds ties away from zero (symmetric for credit notes). */
  round(mode: RoundingMode = 'HALF_UP'): bigint {
    const negative = this.num < 0n;
    const n = negative ? -this.num : this.num;
    const q = n / this.den;
    const r = n % this.den;
    const twice = r * 2n;
    let result = q;
    if (twice > this.den) {
      result = q + 1n;
    } else if (twice === this.den) {
      result = mode === 'HALF_UP' ? q + 1n : q % 2n === 0n ? q : q + 1n;
    }
    return negative ? -result : result;
  }

  /** Integer part toward zero and the non-negative fractional remainder magnitude. */
  truncParts(): { whole: bigint; remainder: Fraction } {
    const whole = this.num / this.den;
    return {
      whole,
      remainder: new Fraction(abs(this.num % this.den), this.den),
    };
  }
}

/** BigInt → number, refusing values outside the safe integer range. */
export const toSafeNumber = (v: bigint): number => {
  if (
    v > BigInt(Number.MAX_SAFE_INTEGER) ||
    v < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError('Amount exceeds safe integer range');
  }
  return Number(v);
};

/**
 * Split an integer total into integer parts proportional to `weights`, so the
 * parts always sum exactly to `total` (largest-remainder method). Ties go to
 * the earliest index, which keeps results deterministic.
 */
export const allocate = (
  total: number,
  weights: readonly number[],
): number[] => {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) {
    return [];
  }
  if (sumW === 0) {
    const parts = weights.map(() => 0);
    parts[0] = total;
    return parts;
  }
  const exact = weights.map(w => Fraction.of(total).mul(Fraction.of(w, sumW)));
  return allocateExact(total, exact);
};

/**
 * Round a list of exact values to integers that sum exactly to `total`.
 * Used when a rounded total must be distributed back over its parts.
 */
export const allocateExact = (
  total: number,
  exact: readonly Fraction[],
): number[] => {
  const floors = exact.map(f => floorBig(f));
  // `total` is always the rounded sum of `exact`, so it lies in
  // [Σ floors, Σ floors + n): hand out the remainder one unit at a time,
  // largest fractional part first.
  const remaining = toSafeNumber(
    BigInt(total) - floors.reduce((a, b) => a + b, 0n),
  );
  if (remaining < 0 || remaining > exact.length) {
    throw new RangeError(
      'allocateExact: total is not the rounded sum of its parts',
    );
  }
  const order = exact
    .map((f, i) => ({ i, frac: f.sub(Fraction.of(floors[i]!)) }))
    .sort((a, b) => b.frac.compare(a.frac) || a.i - b.i);
  const result = [...floors];
  for (let k = 0; k < remaining; k++) {
    const target = order[k]!.i;
    result[target] = result[target]! + 1n;
  }
  return result.map(toSafeNumber);
};

const floorBig = (f: Fraction): bigint => {
  const q = f.num / f.den;
  return f.num < 0n && f.num % f.den !== 0n ? q - 1n : q;
};
