import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { easing } from '@/ui/tokens';

/** Calm pulse, not a shimmer sweep. Static when reduce-motion is on. */
export function Skeleton({
  width = '100%',
  height = 12,
  radius = 6,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) {
      pulse.value = withRepeat(withTiming(1, { duration: 900, easing: easing.standard }), -1, true);
    }
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.45 }));

  return (
    <Animated.View
      accessible={false}
      style={[styles.block, { width, height, borderRadius: radius }, animated]}
    />
  );
}

const styles = StyleSheet.create(theme => ({
  block: {
    backgroundColor: theme.colors.bg.hover,
  },
}));
