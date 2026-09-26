/**
 * Type scale.
 *
 * Inter Display is used at 20px and above (tighter spacing, optical sizing for
 * headlines); Inter everywhere below. Each weight is its own static font file,
 * so styles set `fontFamily` and never `fontWeight` (Android would otherwise
 * fake-bold the regular face).
 *
 * Letter spacing follows Inter's dynamic metrics: tighter as size grows.
 */

export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  displayMedium: 'InterDisplay-Medium',
  displaySemibold: 'InterDisplay-SemiBold',
  displayBold: 'InterDisplay-Bold',
} as const;

export type TextStyleToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

const style = (
  family: string,
  fontSize: number,
  lineHeight: number,
  letterSpacing: number,
): TextStyleToken => ({ fontFamily: family, fontSize, lineHeight, letterSpacing });

export const typography = {
  /** Hero numbers: outstanding totals, amount due. */
  display: style(fontFamily.displaySemibold, 34, 40, -0.8),
  title1: style(fontFamily.displaySemibold, 26, 32, -0.5),
  title2: style(fontFamily.displaySemibold, 21, 26, -0.3),
  headline: style(fontFamily.semibold, 17, 22, -0.2),
  body: style(fontFamily.regular, 15, 22, -0.1),
  bodyMedium: style(fontFamily.medium, 15, 22, -0.1),
  callout: style(fontFamily.regular, 14, 20, -0.05),
  calloutMedium: style(fontFamily.medium, 14, 20, -0.05),
  label: style(fontFamily.medium, 13, 18, 0),
  caption: style(fontFamily.regular, 12, 16, 0),
  captionMedium: style(fontFamily.medium, 12, 16, 0),
  /** Section headers in lists and settings. Rendered uppercase. */
  overline: style(fontFamily.semibold, 11, 14, 0.4),
} as const;

export type TypographyVariant = keyof typeof typography;
