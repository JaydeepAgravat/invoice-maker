import { darkColors, lightColors, type ColorTokens } from '../colors';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r = 0, g = 0, b = 0] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// WCAG AA: 4.5:1 for body text. Disabled text is exempt by definition.
describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as Array<[string, ColorTokens]>)('%s text contrast', (_, c) => {
  const text = [
    'primary',
    'secondary',
    'tertiary',
    'accent',
    'danger',
  ] as const;
  const backgrounds = ['app', 'surface', 'elevated'] as const;

  it.each(text.flatMap(t => backgrounds.map(bg => [t, bg] as const)))(
    '%s on %s meets AA',
    (t, bg) => {
      expect(contrast(c.text[t], c.bg[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    '%s badge text meets AA on its fill',
    tone => {
      expect(
        contrast(c.status[tone].text, c.status[tone].bg),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('white text on the accent fill meets AA', () => {
    expect(contrast(c.text.onAccent, c.accent.solid)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
