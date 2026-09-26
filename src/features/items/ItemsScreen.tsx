import { useNavigation } from '@react-navigation/native';
import {
  CheckSquare,
  Menu,
  Package,
  PackagePlus,
  Square,
  Trash2,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { unitLabel } from '@/features/documents/statusMeta';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { useProfile } from '@/data/ProfileProvider';
import { clock, mutate, useLiveQuery } from '@/data/live';
import { deleteItems, listItems, restoreItem } from '@/data/repositories/items';
import { useFormat } from '@/lib/format';
import { EmptyItems } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { SearchField } from '@/ui/layout/SearchField';
import {
  Button,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';
import { haptics } from '@/ui/haptics';

/** Item catalog. Long-press to select several and delete them at once. */
export function ItemsScreen({ navigation }: DrawerProps<'Items'>) {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useProfile();
  const root = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const { data } = useLiveQuery(
    db => listItems(db, { search: query }),
    [query],
  );

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev ?? []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next.size ? next : null;
    });

  const removeSelected = async () => {
    const ids = [...(selected ?? [])];
    await mutate(tx => deleteItems(tx, clock, ids));
    setSelected(null);
    toast.show({
      message: t('toast.itemsDeleted', { count: ids.length }),
      haptic: 'warning',
      action: {
        label: t('common.undo'),
        onPress: () =>
          mutate(async tx => {
            for (const id of ids) {
              await restoreItem(tx, id);
            }
          }),
      },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={
          selected
            ? t('items.selected', { count: selected.size })
            : t('nav.items')
        }
        left={
          selected ? (
            <IconButton
              icon={X}
              label={t('common.cancel')}
              onPress={() => setSelected(null)}
            />
          ) : width >= breakpoints.lg ? undefined : (
            <IconButton
              testID="open-menu"
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
        right={
          selected ? undefined : (
            <IconButton
              testID="new-item"
              icon={PackagePlus}
              label={t('items.new')}
              onPress={() => root.navigate('ItemEditor')}
            />
          )
        }
      />
      <FlatList
        data={data ?? []}
        keyExtractor={i => i.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          (data?.length ?? 0) > 0 || query ? (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('items.searchPlaceholder')}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <ListRow
            leading={
              selected ? (
                <Icon
                  icon={selected.has(item.id) ? CheckSquare : Square}
                  tone={selected.has(item.id) ? 'accent' : 'tertiary'}
                />
              ) : (
                <Icon icon={Package} tone="tertiary" />
              )
            }
            title={item.name}
            subtitle={
              [unitLabel(t, item.unit) || null, item.description]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            value={f.money(item.unitPrice, profile.currency)}
            selected={selected?.has(item.id)}
            onPress={() =>
              selected
                ? toggle(item.id)
                : root.navigate('ItemEditor', { id: item.id })
            }
            onLongPress={() => {
              haptics.play('medium');
              toggle(item.id);
            }}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          data ? (
            query ? (
              <EmptyState title={t('items.noMatches')} />
            ) : (
              <EmptyState
                illustration={<EmptyItems />}
                title={t('items.emptyTitle')}
                body={t('items.emptyBody')}
                action={{
                  label: t('items.new'),
                  leadingIcon: PackagePlus,
                  onPress: () => root.navigate('ItemEditor'),
                }}
              />
            )
          ) : undefined
        }
      />
      {selected ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            leadingIcon={Trash2}
            label={t('items.deleteSelected', { count: selected.size })}
            onPress={removeSelected}
          />
        </View>
      ) : null}
    </View>
  );
}

const Separator = () => <Divider inset={52} />;

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  list: {
    flexGrow: 1,
    paddingBottom: theme.space[12],
  },
  footer: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
}));
