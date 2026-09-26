/**
 * Development-only pseudo-locale: accented and about 40% longer than English,
 * so truncation and overflow show up before real translators find them.
 * Placeholders ({{name}}) are left untouched.
 */
const ACCENTS: Record<string, string> = {
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ö',
  u: 'ü',
  c: 'ç',
  n: 'ñ',
  y: 'ý',
  A: 'Å',
  E: 'É',
  I: 'Î',
  O: 'Ø',
  U: 'Ü',
  C: 'Ç',
  N: 'Ñ',
  Y: 'Ý',
};

export function pseudo(text: string): string {
  const parts = text.split(/(\{\{\w+\}\})/);
  const body = parts
    .map(p =>
      p.startsWith('{{') ? p : p.replace(/[a-zA-Z]/g, ch => ACCENTS[ch] ?? ch),
    )
    .join('');
  const pad = '·'.repeat(Math.ceil(text.length * 0.4));
  return `⟦${body}${pad}⟧`;
}

type Tree = { [key: string]: string | Tree };

export function pseudoTree(tree: Tree): Tree {
  const out: Tree = {};
  for (const [key, value] of Object.entries(tree)) {
    out[key] = typeof value === 'string' ? pseudo(value) : pseudoTree(value);
  }
  return out;
}
