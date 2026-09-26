import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { HapticKind } from '@/specs/NativeHaptics';

import { Icon, type IconTone } from './Icon';
import { Text, type TextTone } from './Text';
import { Touchable } from './Touchable';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticKind;
  accessibilityHint?: string;
  testID?: string;
};

const tones: Record<ButtonVariant, TextTone & IconTone> = {
  primary: 'onAccent',
  secondary: 'primary',
  ghost: 'secondary',
  danger: 'danger',
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = 'light',
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { theme } = useUnistyles();
  styles.useVariants({ variant, size });
  const tone = tones[variant];
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      feedback={variant === 'ghost' ? 'both' : 'scale'}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={size === 'sm' ? 8 : 4}
      style={[styles.base, fullWidth && styles.fullWidth]}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {leadingIcon && <Icon icon={leadingIcon} size={iconSize} tone={tone} />}
        <Text variant={size === 'lg' ? 'bodyMedium' : 'calloutMedium'} tone={tone} numberOfLines={1}>
          {label}
        </Text>
        {trailingIcon && <Icon icon={trailingIcon} size={iconSize} tone={tone} />}
      </View>
      {loading && (
        <View style={styles.spinner}>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? theme.colors.text.onAccent : theme.colors.text.secondary}
          />
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  base: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: 'transparent',
    variants: {
      variant: {
        primary: {
          backgroundColor: theme.colors.accent.solid,
          borderColor: theme.colors.accent.solid,
        },
        secondary: {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        ghost: {
          backgroundColor: 'transparent',
        },
        danger: {
          backgroundColor: theme.colors.status.danger.bg,
          borderColor: theme.colors.status.danger.border,
        },
      },
      size: {
        sm: { minHeight: theme.size.controlSmall, paddingHorizontal: theme.space[3] },
        md: { minHeight: theme.size.control, paddingHorizontal: theme.space[4] },
        lg: { minHeight: theme.size.hit, paddingHorizontal: theme.space[5], borderRadius: theme.radius.lg },
      },
    },
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
  },
  hidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
