import { useCallback } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import type { HapticKind } from '@/specs/NativeHaptics';
import { haptics } from '@/ui/haptics';
import { duration, easing, pressScale, spring } from '@/ui/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /**
   * highlight: a soft tint fades in (rows, list items).
   * scale: the surface shrinks slightly (buttons, cards).
   * both: scale + tint (floating buttons).
   */
  feedback?: 'highlight' | 'scale' | 'both' | 'none';
  scaleTo?: number;
  haptic?: HapticKind;
};

/**
 * The single pressable primitive. Every tappable surface in the app goes
 * through here so press feedback feels identical everywhere.
 * No Android ripple: feedback is a tint and/or scale, like the rest of the UI.
 */
export function Touchable({
  feedback = 'highlight',
  scaleTo = pressScale.button,
  haptic,
  onPressIn,
  onPressOut,
  onPress,
  style,
  children,
  disabled,
  ...rest
}: TouchableProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const useScale = !reduceMotion && (feedback === 'scale' || feedback === 'both');
  const useTint = feedback === 'highlight' || feedback === 'both';

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = withTiming(1, { duration: duration.fast / 2, easing: easing.decelerate });
      onPressIn?.(e);
    },
    [onPressIn, pressed],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = withTiming(0, { duration: duration.base, easing: easing.standard });
      onPressOut?.(e);
    },
    [onPressOut, pressed],
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic) {
        haptics.play(haptic);
      }
      onPress?.(e);
    },
    [haptic, onPress],
  );

  const scaleStyle = useAnimatedStyle(() => {
    if (!useScale) {
      return {};
    }
    const target = 1 - (1 - scaleTo) * pressed.value;
    return { transform: [{ scale: withSpring(target, spring.snappy) }] };
  });

  const tintStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, useTint && styles.clip, scaleStyle, disabled && styles.disabled]}
    >
      {children}
      {useTint && (
        <Animated.View pointerEvents="none" style={[styles.tint, tintStyle]} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create(theme => ({
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(16,16,20,0.045)',
  },
  clip: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
}));
