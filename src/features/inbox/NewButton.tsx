import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Text, Touchable } from '@/ui/primitives';

/** Extended floating button, bottom-right: always in thumb reach. */
export function NewButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Touchable
      testID="new-document"
      onPress={onPress}
      feedback="both"
      scaleTo={0.95}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t('new.button')}
      style={[styles.fab, { bottom: insets.bottom + 16 }]}
    >
      <Icon icon={Plus} size={20} tone="onAccent" strokeWidth={2} />
      <Text variant="bodyMedium" tone="onAccent">
        {t('new.button')}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create(theme => ({
  fab: {
    position: 'absolute',
    right: theme.size.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 52,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[5],
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.accent.solid,
    ...theme.elevation.floating,
  },
}));
