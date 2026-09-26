import { Fraction } from './fraction';

/**
 * Calculator for the smart keypad: + − × ÷ and parentheses over decimals,
 * evaluated exactly (no floating point, no eval). The result is scaled to an
 * integer with the requested number of decimals, e.g. 2.5 × 45 at scale 2
 * → 11250 (cents).
 */

type Token =
  | { kind: 'num'; value: Fraction }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' }
  | { kind: 'paren'; value: '(' | ')' };

const OPS: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  x: '*',
  '/': '/',
  '÷': '/',
};

const decimal = (text: string): Fraction => {
  const [whole = '0', frac = ''] = text.split('.');
  return Fraction.of(BigInt((whole || '0') + frac), 10n ** BigInt(frac.length));
};

const tokenize = (input: string, decimalSeparator: string): Token[] | null => {
  const s = input.replace(/\s+/g, '');
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/[0-9]/.test(c) || c === decimalSeparator || c === '.') {
      let j = i;
      let seenDot = false;
      let text = '';
      while (
        j < s.length &&
        (/[0-9]/.test(s[j]!) || s[j] === decimalSeparator || s[j] === '.')
      ) {
        if (s[j] === decimalSeparator || s[j] === '.') {
          if (seenDot) {
            return null;
          }
          seenDot = true;
          text += '.';
        } else {
          text += s[j];
        }
        j++;
      }
      if (text === '.') {
        return null;
      }
      tokens.push({ kind: 'num', value: decimal(text) });
      i = j;
    } else if (OPS[c]) {
      tokens.push({ kind: 'op', value: OPS[c]! });
      i++;
    } else if (c === '(' || c === ')') {
      tokens.push({ kind: 'paren', value: c });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
};

/** Recursive descent: expr = term (('+'|'-') term)*; term = factor (('*'|'/') factor)*; factor = ['-'] (num | '(' expr ')'). */
const parse = (tokens: Token[]): Fraction | null => {
  let pos = 0;
  const peek = () => tokens[pos];

  const factor = (): Fraction | null => {
    const t = peek();
    if (!t) {
      return null;
    }
    if (t.kind === 'op' && (t.value === '-' || t.value === '+')) {
      pos++;
      const inner = factor();
      return inner && (t.value === '-' ? Fraction.ZERO.sub(inner) : inner);
    }
    if (t.kind === 'num') {
      pos++;
      return t.value;
    }
    if (t.kind === 'paren' && t.value === '(') {
      pos++;
      const inner = expr();
      const close = peek();
      if (!inner || !close || close.kind !== 'paren' || close.value !== ')') {
        return null;
      }
      pos++;
      return inner;
    }
    return null;
  };

  const term = (): Fraction | null => {
    let left = factor();
    while (left) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.value !== '*' && t.value !== '/')) {
        break;
      }
      pos++;
      const right = factor();
      if (!right || (t.value === '/' && right.isZero())) {
        return null;
      }
      left = t.value === '*' ? left.mul(right) : left.div(right);
    }
    return left;
  };

  const expr = (): Fraction | null => {
    let left = term();
    while (left) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.value !== '+' && t.value !== '-')) {
        break;
      }
      pos++;
      const right = term();
      if (!right) {
        return null;
      }
      left = t.value === '+' ? left.add(right) : left.sub(right);
    }
    return left;
  };

  const result = expr();
  return result && pos === tokens.length ? result : null;
};

export type EvalResult = { value: number; isExpression: boolean } | null;

export function evaluate(
  input: string,
  scale: number,
  decimalSeparator = '.',
): EvalResult {
  const tokens = tokenize(input, decimalSeparator);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  const result = parse(tokens);
  if (!result) {
    return null;
  }
  const scaled = result.mul(Fraction.of(10n ** BigInt(scale))).round('HALF_UP');
  if (
    scaled > BigInt(Number.MAX_SAFE_INTEGER) ||
    scaled < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null;
  }
  return {
    value: Number(scaled),
    isExpression: tokens.some(t => t.kind !== 'num'),
  };
}

/** Integer at `scale` → plain decimal text for editing ("11250", 2 → "112.5"). */
export function toEditableText(
  value: number,
  scale: number,
  decimalSeparator = '.',
): string {
  const negative = value < 0;
  const digits = String(Math.abs(value)).padStart(scale + 1, '0');
  const whole = scale ? digits.slice(0, -scale) : digits;
  const frac = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${whole}${frac ? decimalSeparator + frac : ''}`;
}
