import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/ui/primitives';

export type ScreenHeaderProps = {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Scroll offset: the hairline fades in once content scrolls under the header. */
  scrollY?: SharedValue<number>;
};

export function ScreenHeader({
  title,
  left,
  right,
  scrollY,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  const hairline = useAnimatedStyle(() => ({
    opacity: scrollY ? Math.min(Math.max(scrollY.value / 8, 0), 1) : 0,
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.side}>{left}</View>
        <Text
          variant="headline"
          numberOfLines={1}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
      <Animated.View style={[styles.hairline, hairline]} />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.bg.app,
    zIndex: 1,
  },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space[2],
    gap: theme.space[1],
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
    minWidth: 40,
  },
  right: {
    justifyContent: 'flex-end',
  },
  title: {
    flex: 1,
    marginLeft: theme.space[1],
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.default,
  },
}));
