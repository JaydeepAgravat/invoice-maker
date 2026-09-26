import { hashString, initials } from '../text';

describe('initials', () => {
  it('uses first and last word', () => {
    expect(initials('Acme Construction Ltd')).toBe('AL');
  });
  it('handles a single word', () => {
    expect(initials('bloom')).toBe('B');
  });
  it('ignores extra whitespace', () => {
    expect(initials('  Jordan   Smith ')).toBe('JS');
  });
  it('falls back for empty names', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('hashString', () => {
  it('is stable and non-negative', () => {
    expect(hashString('Acme')).toBe(hashString('Acme'));
    expect(
      hashString('a very long client name that overflows'),
    ).toBeGreaterThanOrEqual(0);
  });
});
