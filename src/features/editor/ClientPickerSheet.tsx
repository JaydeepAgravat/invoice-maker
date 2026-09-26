import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Plus, Search, UserX } from 'lucide-react-native';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  createClient,
  listClients,
  type Client,
} from '@/data/repositories/clients';
import {
  Avatar,
  Divider,
  Icon,
  ListRow,
  Sheet,
  type SheetRef,
} from '@/ui/primitives';

/**
 * Pick a client, or create one from what you typed without leaving the
 * invoice. Details like email and address can be added later.
 */
export function ClientPickerSheet({
  ref,
  selectedId,
  onSelect,
  title,
}: {
  ref?: Ref<SheetRef>;
  selectedId: string | null;
  onSelect: (client: Client | null) => void;
  title: string;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [query, setQuery] = useState('');
  const { data: clients } = useLiveQuery(
    db => listClients(db, { search: query, limit: 30 }),
    [query],
  );

  const exact = clients?.some(
    c => c.name.toLowerCase() === query.trim().toLowerCase(),
  );

  const createFromQuery = async () => {
    const client = await mutate(tx =>
      createClient(tx, clock, { name: query.trim() }),
    );
    onSelect(client);
    setQuery('');
  };

  return (
    <Sheet
      ref={ref}
      title={title}
      snapPoints={['80%']}
      scrollable
      onDismiss={() => setQuery('')}
    >
      <View style={styles.search}>
        <Icon icon={Search} size={18} tone="tertiary" />
        <BottomSheetTextInput
          testID="client-search"
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder={t('client.searchPlaceholder')}
          placeholderTextColor={theme.colors.text.tertiary}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() =>
            query.trim() && !exact ? createFromQuery() : undefined
          }
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={t('client.searchPlaceholder')}
        />
      </View>

      {query.trim() && !exact ? (
        <ListRow
          testID="client-create-inline"
          leading={
            <View style={styles.plus}>
              <Icon icon={Plus} size={18} tone="accent" />
            </View>
          }
          title={t('client.createNamed', { name: query.trim() })}
          onPress={createFromQuery}
        />
      ) : null}

      {(clients ?? []).map((c, i) => (
        <View key={c.id}>
          {i > 0 || (query.trim() && !exact) ? <Divider inset={60} /> : null}
          <ListRow
            leading={<Avatar name={c.name} />}
            title={c.name}
            subtitle={
              [c.company, c.emails[0]].filter(Boolean).join(' · ') || undefined
            }
            selected={c.id === selectedId}
            onPress={() => {
              onSelect(c);
              setQuery('');
            }}
          />
        </View>
      ))}

      {selectedId ? (
        <>
          <Divider />
          <ListRow
            leadingIcon={UserX}
            title={t('client.remove')}
            onPress={() => onSelect(null)}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 44,
    marginHorizontal: theme.size.gutter,
    marginBottom: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.hover,
  },
  input: {
    flex: 1,
    ...theme.type.body,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
}));
