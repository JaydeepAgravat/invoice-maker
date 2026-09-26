import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Badge,
  Icon,
  ListRow,
  SectionHeader,
  Sheet,
  Text,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';

import { useProGate } from '@/billing/useProGate';

import { DOC_TYPES, type DocType } from './docTypes';

type Props = {
  ref: RefObject<SheetRef | null>;
  onSelect: (type: DocType) => void;
};

/**
 * The three everyday types are big thumb-sized tiles; the specialist types sit
 * in a quiet list underneath so the sheet never feels like a wall of options.
 */
export function NewDocumentSheet({ ref, onSelect }: Props) {
  const { t } = useTranslation();
  const { isPro, gate } = useProGate();

  const pick = (type: DocType, pro = false) => {
    ref.current?.dismiss();
    if (pro && !gate('docTypes')) {
      return;
    }
    onSelect(type);
  };

  return (
    <Sheet ref={ref} title={t('new.title')}>
      <View style={styles.tiles}>
        {DOC_TYPES.filter(d => d.primary).map(d => (
          <Touchable
            key={d.type}
            feedback="both"
            scaleTo={0.96}
            haptic="light"
            onPress={() => pick(d.type)}
            accessibilityRole="button"
            accessibilityLabel={t(d.labelKey)}
            style={styles.tile}
          >
            <View style={styles.tileIcon}>
              <Icon icon={d.icon} size={22} tone="accent" />
            </View>
            <Text variant="calloutMedium" numberOfLines={1}>
              {t(d.labelKey)}
            </Text>
          </Touchable>
        ))}
      </View>
      <SectionHeader title={t('new.more')} />
      {DOC_TYPES.filter(d => !d.primary).map(d => (
        <ListRow
          key={d.type}
          title={t(d.labelKey)}
          leadingIcon={d.icon}
          trailing={
            d.pro && !isPro ? (
              <Badge label="Pro" tone="accent" dot={false} />
            ) : undefined
          }
          onPress={() => pick(d.type, d.pro)}
          accessibilityLabel={d.pro ? `${t(d.labelKey)}, Pro` : t(d.labelKey)}
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  tiles: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  tile: {
    flex: 1,
    minHeight: 96,
    padding: theme.space[3],
    justifyContent: 'space-between',
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.surface,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
}));
