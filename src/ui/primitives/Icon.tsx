import type { LucideIcon } from 'lucide-react-native';
import { useUnistyles } from 'react-native-unistyles';

import type { AppTheme } from '@/ui/theme';

export type IconTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'disabled'
  | 'accent'
  | 'danger'
  | 'onAccent'
  | 'success'
  | 'warning';

export type IconProps = {
  icon: LucideIcon;
  size?: number;
  tone?: IconTone;
  /** Overrides tone. */
  color?: string;
  /** Lucide default is 2; 1.75 matches Inter's stem weight at UI sizes. */
  strokeWidth?: number;
};

export const iconColor = (theme: AppTheme, tone: IconTone): string => {
  switch (tone) {
    case 'success':
      return theme.colors.status.success.text;
    case 'warning':
      return theme.colors.status.warning.text;
    case 'danger':
      return theme.colors.text.danger;
    default:
      return theme.colors.text[tone];
  }
};

/** Decorative by default: the pressable wrapping it carries the label. */
export function Icon({
  icon: Glyph,
  size = 20,
  tone = 'secondary',
  color,
  strokeWidth = 1.75,
}: IconProps) {
  const { theme } = useUnistyles();
  return (
    <Glyph
      size={size}
      color={color ?? iconColor(theme, tone)}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
