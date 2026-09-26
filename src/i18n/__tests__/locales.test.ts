import de from '../locales/de';
import en from '../locales/en';
import es from '../locales/es';
import fr from '../locales/fr';
import pt from '../locales/pt';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      out[prefix + key] = value;
    } else {
      Object.assign(out, flatten(value, `${prefix}${key}.`));
    }
  }
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1] ?? '').sort();

const english = flatten(en as unknown as Tree);

/**
 * Keys whose call site passes extra values so languages with grammatical
 * gender can pick a different phrasing ("New invoice" → "Factura").
 */
const EXTRA_VALUES: Record<string, string[]> = {
  'editor.newTitle': ['type', 'typeLower'],
};

describe.each([
  ['es', es],
  ['pt', pt],
  ['fr', fr],
  ['de', de],
])('%s', (_, messages) => {
  const translated = flatten(messages as unknown as Tree);

  it('has every English key', () => {
    const missing = Object.keys(english).filter(k => !(k in translated));
    expect(missing).toEqual([]);
  });

  it('keeps the same placeholders as English', () => {
    // Plural forms may drop {{count}} ("one item" style), so only require a subset there.
    const broken = Object.keys(english).filter(k => {
      const want = placeholders(english[k]!);
      const got = placeholders(translated[k] ?? '');
      if (EXTRA_VALUES[k]) {
        return got.some(p => !EXTRA_VALUES[k]!.includes(p!));
      }
      return k.endsWith('_one')
        ? got.some(p => !want.includes(p))
        : want.join() !== got.join();
    });
    expect(broken).toEqual([]);
  });

  it('has no empty strings', () => {
    expect(Object.keys(translated).filter(k => !translated[k]!.trim())).toEqual(
      [],
    );
  });
});
