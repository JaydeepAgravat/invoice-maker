import {
  CircleAlert,
  CircleDashed,
  ClipboardList,
  FileText,
  Package,
  PackagePlus,
  ReceiptText,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, mutate, useLiveQuery } from '@/data/live';
import { listClients } from '@/data/repositories/clients';
import { createDraft } from '@/data/repositories/documents';
import { listDocuments } from '@/data/repositories/inbox';
import type { DocType } from '@/domain/docTypes';
import { DocumentRow } from '@/features/inbox/DocumentRow';
import { Avatar, Icon, IconButton, ListRow, Text } from '@/ui/primitives';

type Command = {
  key: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
};

type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'command'; key: string; command: Command }
  | {
      kind: 'doc';
      key: string;
      doc: Awaited<ReturnType<typeof listDocuments>>[number];
    }
  | {
      kind: 'client';
      key: string;
      client: Awaited<ReturnType<typeof listClients>>[number];
    };

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * One box to find anything and do anything: documents, clients and actions.
 * Enter runs the top result.
 */
export function CommandPaletteScreen({
  navigation,
}: RootScreenProps<'CommandPalette'>) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const today = clock.today();
  const q = query.trim();

  const { data } = useLiveQuery(
    async db => ({
      docs: q
        ? await listDocuments(db, { today, search: q, limit: 8 })
        : await listDocuments(db, { today, limit: 5 }),
      clients: q ? await listClients(db, { search: q, limit: 5 }) : [],
    }),
    [q, today],
  );

  const createDoc = async (type: DocType) => {
    const doc = await mutate(tx => createDraft(tx, clock, type));
    navigation.replace('DocumentEditor', { id: doc.id, isNew: true });
  };

  const commands = useMemo<Command[]>(
    () => [
      {
        key: 'new-invoice',
        label: t('palette.newInvoice'),
        icon: FileText,
        keywords: 'new invoice create',
        run: () => createDoc('INVOICE'),
      },
      {
        key: 'new-estimate',
        label: t('palette.newEstimate'),
        icon: ClipboardList,
        keywords: 'new estimate quote create',
        run: () => createDoc('ESTIMATE'),
      },
      {
        key: 'new-receipt',
        label: t('palette.newReceipt'),
        icon: ReceiptText,
        keywords: 'new receipt create',
        run: () => createDoc('RECEIPT'),
      },
      {
        key: 'new-client',
        label: t('client.new'),
        icon: UserPlus,
        keywords: 'new client customer add',
        run: () =>
          navigation.replace('ClientEditor', q ? { name: q } : undefined),
      },
      {
        key: 'new-item',
        label: t('items.new'),
        icon: PackagePlus,
        keywords: 'new item product service add',
        run: () => navigation.replace('ItemEditor'),
      },
      {
        key: 'unpaid',
        label: t('views.unpaid'),
        icon: CircleDashed,
        keywords: 'unpaid outstanding owed',
        run: () =>
          navigation.popTo('Main', {
            screen: 'Inbox',
            params: { view: 'unpaid' },
          }),
      },
      {
        key: 'overdue',
        label: t('views.overdue'),
        icon: CircleAlert,
        keywords: 'overdue late',
        run: () =>
          navigation.popTo('Main', {
            screen: 'Inbox',
            params: { view: 'overdue' },
          }),
      },
      {
        key: 'clients',
        label: t('nav.clients'),
        icon: Users,
        keywords: 'clients customers',
        run: () => navigation.popTo('Main', { screen: 'Clients' }),
      },
      {
        key: 'items',
        label: t('nav.items'),
        icon: Package,
        keywords: 'items catalog products',
        run: () => navigation.popTo('Main', { screen: 'Items' }),
      },
      {
        key: 'settings',
        label: t('nav.settings'),
        icon: Settings,
        keywords: 'settings preferences',
        run: () => navigation.popTo('Main', { screen: 'Settings' }),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, q],
  );

  const rows = useMemo<Row[]>(() => {
    const nq = normalize(q);
    const matched = q
      ? commands.filter(c => normalize(`${c.label} ${c.keywords}`).includes(nq))
      : commands.slice(0, 5);
    const out: Row[] = [];
    if (data?.docs.length) {
      out.push({
        kind: 'header',
        key: 'h-docs',
        title: q ? t('palette.documents') : t('palette.recent'),
      });
      data.docs.forEach(d =>
        out.push({ kind: 'doc', key: `d-${d.id}`, doc: d }),
      );
    }
    if (data?.clients.length) {
      out.push({ kind: 'header', key: 'h-clients', title: t('nav.clients') });
      data.clients.forEach(c =>
        out.push({ kind: 'client', key: `c-${c.id}`, client: c }),
      );
    }
    if (matched.length) {
      out.push({
        kind: 'header',
        key: 'h-actions',
        title: t('palette.actions'),
      });
      matched.forEach(c =>
        out.push({ kind: 'command', key: c.key, command: c }),
      );
    }
    return out;
  }, [commands, data, q, t]);

  const runFirst = () => {
    const first = rows.find(r => r.kind !== 'header');
    if (!first) {
      return;
    }
    if (first.kind === 'command') {
      first.command.run();
    } else if (first.kind === 'doc') {
      navigation.replace(
        first.doc.status === 'DRAFT' ? 'DocumentEditor' : 'DocumentDetail',
        { id: first.doc.id },
      );
    } else if (first.kind === 'client') {
      navigation.replace('ClientDetail', { id: first.client.id });
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={[styles.backdrop, { paddingTop: insets.top + 8 }]}
    >
      <Animated.View
        entering={SlideInUp.springify().damping(30).stiffness(320)}
        style={styles.panel}
      >
        <View style={styles.inputRow}>
          <Icon icon={Search} size={20} tone="tertiary" />
          <TextInput
            testID="palette-input"
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('palette.placeholder')}
            placeholderTextColor={theme.colors.text.tertiary}
            selectionColor={theme.colors.accent.solid}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={runFirst}
            autoCorrect={false}
            maxFontSizeMultiplier={1.6}
            accessibilityLabel={t('palette.placeholder')}
          />
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={r => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            switch (item.kind) {
              case 'header':
                return (
                  <Text
                    variant="overline"
                    tone="tertiary"
                    style={styles.header}
                  >
                    {item.title}
                  </Text>
                );
              case 'command':
                return (
                  <ListRow
                    leadingIcon={item.command.icon}
                    title={item.command.label}
                    onPress={item.command.run}
                  />
                );
              case 'doc':
                return (
                  <DocumentRow
                    doc={item.doc}
                    today={today}
                    onPress={id =>
                      navigation.replace(
                        item.doc.status === 'DRAFT'
                          ? 'DocumentEditor'
                          : 'DocumentDetail',
                        { id },
                      )
                    }
                  />
                );
              case 'client':
                return (
                  <ListRow
                    leading={<Avatar name={item.client.name} />}
                    title={item.client.name}
                    subtitle={item.client.emails[0]}
                    onPress={() =>
                      navigation.replace('ClientDetail', { id: item.client.id })
                    }
                  />
                );
            }
          }}
          ListEmptyComponent={
            q && data ? (
              <Text
                variant="callout"
                tone="secondary"
                align="center"
                style={styles.empty}
              >
                {t('palette.noResults', { query: q })}
              </Text>
            ) : undefined
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create(theme => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.scrim,
  },
  panel: {
    flex: 1,
    marginHorizontal: theme.space[2],
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.bg.elevated,
    overflow: 'hidden',
    ...theme.elevation.overlay,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    height: 60,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.subtle,
  },
  input: {
    flex: 1,
    ...theme.type.headline,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  header: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
    paddingBottom: theme.space[1],
  },
  empty: {
    padding: theme.space[8],
  },
}));
