import {
  darkColors,
  elevation,
  lightColors,
  radius,
  size,
  space,
  stroke,
  typography,
  type ColorTokens,
} from '@/ui/tokens';

const build = (colors: ColorTokens, dark: boolean) => ({
  dark,
  colors,
  type: typography,
  space,
  radius,
  size,
  stroke,
  elevation: elevation(colors.shadow, dark),
});

export const lightTheme = build(lightColors, false);
export const darkTheme = build(darkColors, true);

export type AppTheme = typeof lightTheme;

export const breakpoints = {
  xs: 0,
  /** Large phones in landscape, small foldables. */
  md: 600,
  /** Tablets and unfolded foldables: two-pane layouts. */
  lg: 840,
  xl: 1200,
} as const;
