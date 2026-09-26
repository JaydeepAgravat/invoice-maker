import { useState, type ComponentRef, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { duration, easing } from '@/ui/tokens';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Render value in tabular figures (amounts, quantities). */
  tabular?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({
  label,
  hint,
  error,
  prefix,
  suffix,
  tabular,
  onFocus,
  onBlur,
  editable = true,
  ref,
  ...rest
}: TextFieldProps) {
  const { theme } = useUnistyles();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const rest_ = theme.colors.border.default;
  const active = error ? theme.colors.status.danger.solid : theme.colors.border.focus;

  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [error ? active : rest_, active]),
  }));

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="label" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.frame,
          frameStyle,
          focused && styles.frameFocused,
          !editable && styles.frameDisabled,
        ]}
      >
        {prefix}
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={theme.colors.text.tertiary}
          selectionColor={theme.colors.accent.solid}
          cursorColor={theme.colors.accent.solid}
          maxFontSizeMultiplier={2}
          onFocus={e => {
            setFocused(true);
            focus.value = withTiming(1, { duration: duration.fast, easing: easing.standard });
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            focus.value = withTiming(0, { duration: duration.base, easing: easing.standard });
            onBlur?.(e);
          }}
          style={[styles.input, tabular && styles.tabular]}
        />
        {suffix}
      </Animated.View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  wrapper: {
    gap: theme.space[1.5],
  },
  label: {
    marginLeft: 2,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: theme.space[3],
    gap: theme.space[2],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    backgroundColor: theme.colors.bg.surface,
  },
  frameFocused: {
    // Outline sits outside the border box, so focus never shifts layout.
    outlineWidth: 3,
    outlineColor: theme.colors.accent.subtlePressed,
    outlineStyle: 'solid',
  },
  frameDisabled: {
    backgroundColor: theme.colors.bg.subtle,
  },
  input: {
    flex: 1,
    paddingVertical: theme.space[2],
    color: theme.colors.text.primary,
    ...theme.type.body,
    lineHeight: undefined,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}));
