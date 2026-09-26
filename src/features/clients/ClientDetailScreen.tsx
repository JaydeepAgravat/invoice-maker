import {
  ArrowLeft,
  FilePlus,
  Mail,
  MapPin,
  Pencil,
  Phone,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, mutate, useLiveQuery } from '@/data/live';
import { clientBalances, getClient } from '@/data/repositories/clients';
import { createDraft } from '@/data/repositories/documents';
import { listDocuments } from '@/data/repositories/inbox';
import { DocumentRow } from '@/features/inbox/DocumentRow';
import { useFormat } from '@/lib/format';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  SectionHeader,
  Surface,
  Text,
} from '@/ui/primitives';

export function ClientDetailScreen({
  navigation,
  route,
}: RootScreenProps<'ClientDetail'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const today = clock.today();

  const { data } = useLiveQuery(
    async db => ({
      client: await getClient(db, id),
      balances: await clientBalances(db, id),
      docs: await listDocuments(db, { today, clientId: id, limit: 100 }),
    }),
    [id, today],
  );

  if (!data?.client) {
    return <View style={styles.screen} />;
  }
  const { client, balances, docs } = data;
  const currencies = Object.entries(balances);

  const newInvoice = async () => {
    const doc = await mutate(tx =>
      createDraft(tx, clock, 'INVOICE', { clientId: id }),
    );
    navigation.push('DocumentEditor', { id: doc.id, isNew: true });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title=""
        left={
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <IconButton
            icon={Pencil}
            label={t('actions.edit')}
            onPress={() => navigation.push('ClientEditor', { id })}
          />
        }
      />
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
      >
        <View style={styles.hero}>
          <Avatar name={client.name} size={56} />
          <Text variant="title1" align="center">
            {client.name}
          </Text>
          {client.company ? (
            <Text variant="callout" tone="secondary" align="center">
              {client.company}
            </Text>
          ) : null}
        </View>

        {currencies.length ? (
          <View style={styles.stats}>
            {currencies.map(([currency, b]) => (
              <View key={currency} style={styles.stat}>
                <Text variant="caption" tone="secondary">
                  {t('client.outstanding')}
                </Text>
                <Text
                  variant="title2"
                  tabular
                  tone={b.outstanding > 0 ? 'primary' : 'tertiary'}
                >
                  {f.money(b.outstanding, currency)}
                </Text>
                <Text variant="caption" tone="tertiary" tabular>
                  {t('client.billed', { amount: f.money(b.billed, currency) })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {client.emails.length || client.phone || client.billingAddress ? (
          <Surface style={styles.card}>
            {client.emails.map((e, i) => (
              <View key={e}>
                {i > 0 ? <Divider inset={52} /> : null}
                <ListRow
                  leadingIcon={Mail}
                  title={e}
                  onPress={() => Linking.openURL(`mailto:${e}`)}
                />
              </View>
            ))}
            {client.phone ? (
              <>
                {client.emails.length ? <Divider inset={52} /> : null}
                <ListRow
                  leadingIcon={Phone}
                  title={client.phone}
                  onPress={() => Linking.openURL(`tel:${client.phone}`)}
                />
              </>
            ) : null}
            {client.billingAddress ? (
              <>
                {client.emails.length || client.phone ? (
                  <Divider inset={52} />
                ) : null}
                <ListRow
                  leadingIcon={MapPin}
                  title={client.billingAddress.split('\n')[0]!}
                  subtitle={
                    client.billingAddress.split('\n').slice(1).join(', ') ||
                    undefined
                  }
                />
              </>
            ) : null}
          </Surface>
        ) : null}

        <SectionHeader title={t('nav.inbox')} />
        {docs.length ? (
          docs.map((d, i) => (
            <View key={d.id}>
              {i > 0 ? <Divider inset={68} /> : null}
              <DocumentRow
                doc={d}
                today={today}
                onPress={docId =>
                  navigation.push(
                    d.status === 'DRAFT' ? 'DocumentEditor' : 'DocumentDetail',
                    { id: docId },
                  )
                }
              />
            </View>
          ))
        ) : (
          <EmptyState
            title={t('client.noDocuments')}
            body={t('client.noDocumentsBody')}
          />
        )}
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leadingIcon={FilePlus}
          label={t('client.newInvoice')}
          onPress={newInvoice}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  content: {
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[5],
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[4],
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    padding: theme.space[3],
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.surface,
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  footer: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
}));
