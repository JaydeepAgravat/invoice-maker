import type { LucideIcon } from 'lucide-react-native';
import { useRef } from 'react';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/ui/haptics';

import { Icon } from './Icon';
import { Text } from './Text';

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: 'success' | 'danger' | 'accent' | 'neutral';
  onTrigger: () => void;
};

const ACTION_WIDTH = 96;

function ActionPanel({
  action,
  side,
  progress,
}: {
  action: SwipeAction;
  side: 'left' | 'right';
  progress: SharedValue<number>;
}) {
  const { theme } = useUnistyles();
  const bg =
    action.tone === 'success'
      ? theme.colors.status.success.solid
      : action.tone === 'danger'
      ? theme.colors.status.danger.solid
      : action.tone === 'accent'
      ? theme.colors.accent.solid
      : theme.colors.text.tertiary;

  // Tick once as the swipe crosses the commit point, in either direction.
  useAnimatedReaction(
    () => progress.value >= 1,
    (armed, prev) => {
      if (prev !== null && armed !== prev) {
        scheduleOnRN(haptics.play, 'threshold');
      }
    },
  );

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.7], [0, 1], 'clamp'),
    transform: [
      { scale: interpolate(progress.value, [0.2, 1], [0.7, 1], 'clamp') },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.panel,
        { backgroundColor: bg },
        side === 'left' ? styles.alignStart : styles.alignEnd,
      ]}
    >
      <Animated.View style={[styles.action, contentStyle]}>
        <Icon icon={action.icon} size={20} tone="onAccent" />
        <Text variant="captionMedium" tone="onAccent" numberOfLines={1}>
          {action.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Row with one swipe action per side. Swiping past the action width arms it
 * (haptic tick); releasing there commits it and the row springs back.
 * Actions are also exposed to TalkBack as custom accessibility actions.
 */
export function SwipeRow({
  children,
  left,
  right,
}: {
  children: React.ReactNode;
  left?: SwipeAction;
  right?: SwipeAction;
}) {
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootFriction={8}
      leftThreshold={ACTION_WIDTH}
      rightThreshold={ACTION_WIDTH}
      dragOffsetFromLeft={24}
      dragOffsetFromRight={-24}
      renderLeftActions={
        left
          ? progress => (
              <ActionPanel action={left} side="left" progress={progress} />
            )
          : undefined
      }
      renderRightActions={
        right
          ? progress => (
              <ActionPanel action={right} side="right" progress={progress} />
            )
          : undefined
      }
      onSwipeableWillOpen={direction => {
        const action = direction === 'right' ? left : right;
        action?.onTrigger();
        ref.current?.close();
      }}
      childrenContainerStyle={styles.child}
    >
      <Animated.View
        accessibilityActions={[
          ...(left ? [{ name: 'left', label: left.label }] : []),
          ...(right ? [{ name: 'right', label: right.label }] : []),
        ]}
        onAccessibilityAction={e =>
          (e.nativeEvent.actionName === 'left' ? left : right)?.onTrigger()
        }
      >
        {children}
      </Animated.View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create(theme => ({
  // Fixed width: swipe progress is measured against it, so 1.0 = commit point.
  panel: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    gap: 4,
  },
  child: {
    backgroundColor: theme.colors.bg.app,
  },
}));
