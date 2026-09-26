/** "Acme Construction Ltd" → "AL". Used for avatar monograms. */
export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
};

/** Stable non-negative hash, used to pick deterministic colors. */
export const hashString = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return h;
};
