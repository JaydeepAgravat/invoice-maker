import { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { haptics } from '@/ui/haptics';
import { spring } from '@/ui/tokens';

import { Text } from './Text';

export type Segment<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

const INSET = 2;

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex(s => s.value === value));
  const segmentWidth = width > 0 ? (width - INSET * 2) / segments.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = index * segmentWidth;
    x.value = reduceMotion || segmentWidth === 0 ? target : withSpring(target, spring.snappy);
  }, [index, reduceMotion, segmentWidth, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segmentWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
      {segments.map(segment => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            style={styles.segment}
            onPress={() => {
              if (!selected) {
                haptics.play('selection');
                onChange(segment.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
          >
            <Text
              variant="label"
              tone={selected ? 'primary' : 'secondary'}
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  track: {
    flexDirection: 'row',
    height: 36,
    padding: INSET,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.hover,
  },
  indicator: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: theme.radius.md - INSET,
    backgroundColor: theme.dark ? theme.colors.bg.pressed : theme.colors.bg.surface,
    borderWidth: theme.dark ? 0 : theme.stroke.hairline,
    borderColor: theme.colors.border.default,
    ...theme.elevation.raised,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[2],
  },
}));
