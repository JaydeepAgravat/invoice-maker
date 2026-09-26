/** 4pt grid. Named by pixel value so intent reads directly in styles. */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
} as const;

export const size = {
  /** Minimum touch target (Material / WCAG). */
  hit: 48,
  rowCompact: 44,
  row: 56,
  rowTall: 68,
  control: 40,
  controlSmall: 32,
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  gutter: 16,
  /** Max readable width on tablets. */
  contentMax: 720,
} as const;

/** Border width. Hairline-thin borders carry structure instead of shadows. */
export const stroke = {
  hairline: 0.5,
  thin: 1,
  focus: 2,
} as const;
