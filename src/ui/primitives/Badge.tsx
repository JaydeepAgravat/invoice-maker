import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'accent';

/**
 * Status pill with a leading dot. Color is never the only signal: the label
 * always states the status in words.
 */
export function Badge({
  label,
  tone = 'neutral',
  dot = true,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  styles.useVariants({ tone });
  return (
    <View style={styles.pill} accessibilityLabel={label}>
      {dot && <View style={styles.dot} />}
      <Text variant="captionMedium" style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create(theme => {
  const tone = (key: keyof typeof theme.colors.status) => ({
    backgroundColor: theme.colors.status[key].bg,
  });
  const text = (key: keyof typeof theme.colors.status) => ({
    color: theme.colors.status[key].text,
  });
  const dot = (key: keyof typeof theme.colors.status) => ({
    backgroundColor: theme.colors.status[key].solid,
  });
  return {
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      height: 22,
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radius.full,
      variants: {
        tone: {
          neutral: tone('neutral'),
          info: tone('info'),
          success: tone('success'),
          warning: tone('warning'),
          danger: tone('danger'),
          accent: { backgroundColor: theme.colors.accent.subtle },
        },
      },
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      variants: {
        tone: {
          neutral: dot('neutral'),
          info: dot('info'),
          success: dot('success'),
          warning: dot('warning'),
          danger: dot('danger'),
          accent: { backgroundColor: theme.colors.accent.solid },
        },
      },
    },
    label: {
      variants: {
        tone: {
          neutral: text('neutral'),
          info: text('info'),
          success: text('success'),
          warning: text('warning'),
          danger: text('danger'),
          accent: { color: theme.colors.accent.text },
        },
      },
    },
  };
});
