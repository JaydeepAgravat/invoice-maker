import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { haptics } from '@/ui/haptics';
import { spring } from '@/ui/tokens';

const TRACK_W = 40;
const TRACK_H = 24;
const THUMB = 18;
const PAD = (TRACK_H - THUMB) / 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required for TalkBack when the switch is not inside a labelled row. */
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

export function Switch({ value, onValueChange, accessibilityLabel, disabled, testID }: SwitchProps) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion ? (value ? 1 : 0) : withSpring(value ? 1 : 0, spring.snappy);
  }, [progress, reduceMotion, value]);

  const off = theme.colors.border.default;
  const on = theme.colors.accent.solid;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [off, on]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        haptics.play('light');
        onValueChange(!value);
      }}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create(theme => ({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    ...theme.elevation.raised,
  },
  disabled: {
    opacity: 0.45,
  },
}));
