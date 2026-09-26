import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ChevronRight } from 'lucide-react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned primary value (e.g. an amount). Rendered tabular. */
  value?: string;
  /** Right-aligned secondary line under `value` (e.g. a status or date). */
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  leadingIcon?: LucideIcon;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  destructive?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  subtitle,
  value,
  meta,
  leading,
  leadingIcon,
  trailing,
  showChevron = false,
  onPress,
  onLongPress,
  selected = false,
  destructive = false,
  testID,
  accessibilityLabel,
}: ListRowProps) {
  const body = (
    <>
      {leading ??
        (leadingIcon && (
          <View style={styles.leadingIcon}>
            <Icon icon={leadingIcon} tone={destructive ? 'danger' : 'secondary'} />
          </View>
        ))}
      <View style={styles.main}>
        <Text variant="bodyMedium" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {(value || meta) && (
        <View style={styles.side}>
          {value ? (
            <Text variant="bodyMedium" tabular numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {typeof meta === 'string' ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : (
            meta
          )}
        </View>
      )}
      {trailing}
      {showChevron && <Icon icon={ChevronRight} size={16} tone="tertiary" />}
    </>
  );

  if (!onPress && !onLongPress) {
    return (
      <View testID={testID} style={[styles.row, selected && styles.selected]}>
        {body}
      </View>
    );
  }

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      feedback="highlight"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.row, selected && styles.selected]}
    >
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.size.row,
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
    gap: theme.space[3],
  },
  selected: {
    backgroundColor: theme.colors.bg.selected,
  },
  leadingIcon: {
    width: 24,
    alignItems: 'center',
  },
  main: {
    flex: 1,
    gap: 2,
  },
  side: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: '45%',
  },
}));
