import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/ui/primitives/Icon';
import { Text } from '@/ui/primitives/Text';
import { spring } from '@/ui/tokens';

import { useToastStore } from './store';

/** Distance above the bottom inset, leaving room for the floating New button. */
const BOTTOM_OFFSET = 88;

export function ToastHost() {
  const current = useToastStore(s => s.current);
  const dismiss = useToastStore(s => s.dismiss);
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const dragY = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate(e => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd(e => {
      if (e.translationY > 40 || e.velocityY > 600) {
        scheduleOnRN(dismiss, undefined);
      }
      dragY.value = withSpring(0, spring.settle);
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    opacity: 1 - Math.min(dragY.value / 120, 0.6),
  }));

  if (!current) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + BOTTOM_OFFSET }]}
    >
      <GestureDetector gesture={pan}>
        {/* Layout animations and the drag transform live on separate views so
            Reanimated never has two owners for the same property. */}
        <Animated.View
          key={current.id}
          entering={SlideInDown.springify().damping(30).stiffness(320)}
          exiting={FadeOut.duration(150)}
          style={styles.slot}
        >
          <Animated.View
            style={[styles.toast, dragStyle]}
            accessibilityRole="alert"
          >
            {current.tone === 'success' && (
              <Icon
                icon={CircleCheck}
                size={18}
                color={theme.colors.status.success.solid}
              />
            )}
            {current.tone === 'danger' && (
              <Icon
                icon={CircleAlert}
                size={18}
                color={theme.colors.status.danger.solid}
              />
            )}
            <Text
              variant="calloutMedium"
              tone="inverse"
              style={styles.message}
              numberOfLines={2}
            >
              {current.message}
            </Text>
            {current.action ? (
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                onPress={() => {
                  current.action?.onPress();
                  dismiss(current.id);
                }}
                style={styles.action}
              >
                <Text variant="calloutMedium" style={styles.actionLabel}>
                  {current.action.label}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: theme.size.gutter,
  },
  slot: {
    width: '100%',
    maxWidth: 480,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: 48,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[2],
    paddingVertical: theme.space[2],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.inverse,
    ...theme.elevation.overlay,
  },
  message: {
    flex: 1,
  },
  action: {
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radius.md,
  },
  actionLabel: {
    color: theme.dark ? theme.colors.accent.solid : theme.colors.accent.border,
  },
}));
