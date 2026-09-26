import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { TypographyVariant } from '@/ui/tokens';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'disabled'
  | 'accent'
  | 'danger'
  | 'inverse'
  | 'onAccent';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Tabular figures: amounts, dates and numbers in columns never jitter. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

/**
 * Upper bound for system font scaling. Text grows up to 2x for accessibility;
 * layouts are tested at this size.
 */
const MAX_FONT_SCALE = 2;

export function Text({
  variant = 'body',
  tone = 'primary',
  tabular = false,
  align,
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...rest
}: TextProps) {
  styles.useVariants({ variant, tone });
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.text,
        tabular && styles.tabular,
        variant === 'overline' && styles.uppercase,
        align && { textAlign: align },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create(theme => ({
  text: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    variants: {
      variant: theme.type,
      tone: {
        primary: { color: theme.colors.text.primary },
        secondary: { color: theme.colors.text.secondary },
        tertiary: { color: theme.colors.text.tertiary },
        disabled: { color: theme.colors.text.disabled },
        accent: { color: theme.colors.text.accent },
        danger: { color: theme.colors.text.danger },
        inverse: { color: theme.colors.text.inverse },
        onAccent: { color: theme.colors.text.onAccent },
      },
    },
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  uppercase: {
    textTransform: 'uppercase',
  },
}));
