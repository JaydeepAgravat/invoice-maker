import { useNavigation } from '@react-navigation/native';
import { Menu, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { useLiveQuery } from '@/data/live';
import { listClients } from '@/data/repositories/clients';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import { SearchField } from '@/ui/layout/SearchField';
import {
  Avatar,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';

export function ClientsScreen({ navigation }: DrawerProps<'Clients'>) {
  const { t } = useTranslation();
  const root = useNavigation();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const { data } = useLiveQuery(
    db => listClients(db, { search: query }),
    [query],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.clients')}
        left={
          width >= breakpoints.lg ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
        right={
          <IconButton
            testID="new-client"
            icon={UserPlus}
            label={t('client.new')}
            onPress={() => root.navigate('ClientEditor')}
          />
        }
      />
      <FlatList
        data={data ?? []}
        keyExtractor={c => c.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          (data?.length ?? 0) > 0 || query ? (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('client.searchPlaceholder')}
            />
          ) : undefined
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <ListRow
            leading={<Avatar name={item.name} size={36} />}
            title={item.name}
            subtitle={
              [item.company, item.emails[0]].filter(Boolean).join(' · ') ||
              undefined
            }
            showChevron
            onPress={() => root.navigate('ClientDetail', { id: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          data ? (
            query ? (
              <EmptyState
                title={t('client.noMatches')}
                body={t('client.noMatchesBody', { query })}
              />
            ) : (
              <EmptyState
                title={t('client.emptyTitle')}
                body={t('client.emptyBody')}
                action={{
                  label: t('client.new'),
                  leadingIcon: UserPlus,
                  onPress: () => root.navigate('ClientEditor'),
                }}
              />
            )
          ) : undefined
        }
      />
    </View>
  );
}

const Separator = () => <Divider inset={68} />;

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  list: {
    flexGrow: 1,
    paddingBottom: theme.space[12],
  },
}));
