import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { HapticKind } from '@/specs/NativeHaptics';

import { Icon, type IconTone } from './Icon';
import { Touchable } from './Touchable';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls must be labelled for TalkBack. */
  label: string;
  onPress?: () => void;
  tone?: IconTone;
  variant?: 'ghost' | 'outline' | 'filled';
  size?: 'sm' | 'md';
  disabled?: boolean;
  haptic?: HapticKind;
  testID?: string;
};

/** Visual size is 32/40dp; touch target is always at least 48dp via hitSlop. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'secondary',
  variant = 'ghost',
  size = 'md',
  disabled,
  haptic,
  testID,
}: IconButtonProps) {
  styles.useVariants({ variant, size });
  const hit = size === 'sm' ? 8 : 4;
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      feedback="both"
      scaleTo={0.92}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: hit, bottom: hit, left: hit, right: hit }}
      style={styles.base}
    >
      <Icon icon={icon} size={size === 'sm' ? 18 : 20} tone={tone} />
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    variants: {
      variant: {
        ghost: {},
        outline: {
          borderWidth: theme.stroke.thin,
          borderColor: theme.colors.border.default,
          backgroundColor: theme.colors.bg.surface,
        },
        filled: {
          backgroundColor: theme.colors.bg.hover,
        },
      },
      size: {
        sm: { width: theme.size.controlSmall, height: theme.size.controlSmall },
        md: { width: theme.size.control, height: theme.size.control },
      },
    },
  },
}));
