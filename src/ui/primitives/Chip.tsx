import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';
import { Touchable } from './Touchable';

export function Chip({
  label,
  selected = false,
  onPress,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  styles.useVariants({ selected });
  return (
    <Touchable
      onPress={onPress}
      feedback="scale"
      scaleTo={0.95}
      haptic="selection"
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.chip}
    >
      <Text variant="label" tone={selected ? 'primary' : 'secondary'} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" tone="tertiary" tabular maxFontSizeMultiplier={1.5}>
          {count}
        </Text>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
    height: 32,
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.full,
    borderWidth: theme.stroke.thin,
    variants: {
      selected: {
        true: {
          backgroundColor: theme.colors.bg.pressed,
          borderColor: theme.colors.border.default,
        },
        false: {
          backgroundColor: 'transparent',
          borderColor: theme.colors.border.subtle,
        },
      },
    },
  },
}));
