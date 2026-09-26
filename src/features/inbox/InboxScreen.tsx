import { useNavigation } from '@react-navigation/native';
import {
  Check,
  Copy,
  Menu,
  Search,
  ThumbsUp,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps, InboxView } from '@/app/navigation';
import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  applyAction,
  createDraft,
  deleteDraft,
  deletePayment,
  duplicateDocument,
  recordPayment,
  restoreDocument,
} from '@/data/repositories/documents';
import {
  dashboard,
  listDocuments,
  viewCounts,
  type DocumentSummary,
} from '@/data/repositories/inbox';
import type { DocType } from '@/domain/docTypes';
import { NewDocumentSheet } from '@/features/documents/NewDocumentSheet';
import { useFormat } from '@/lib/format';
import { EmptyDocuments } from '@/ui/illustrations';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Chip,
  Divider,
  EmptyState,
  IconButton,
  SwipeRow,
  Text,
  Touchable,
  type SheetRef,
  type SwipeAction,
} from '@/ui/primitives';
import { breakpoints } from '@/ui/theme';
import { toast } from '@/ui/toast/store';

import { DocumentRow } from './DocumentRow';
import { BackupNudge } from './BackupNudge';
import { NewButton } from './NewButton';

const VIEWS: readonly InboxView[] = [
  'all',
  'drafts',
  'unpaid',
  'overdue',
  'estimates',
  'paid',
];
const PAGE = 50;

export function InboxScreen({ navigation, route }: DrawerProps<'Inbox'>) {
  const { t } = useTranslation();
  const f = useFormat();
  const root = useNavigation();
  const { width } = useWindowDimensions();
  const permanentDrawer = width >= breakpoints.lg;
  const view = route.params?.view ?? 'all';
  const sheet = useRef<SheetRef>(null);
  const [limit, setLimit] = useState(PAGE);
  const today = clock.today();

  const { data } = useLiveQuery(
    async db => ({
      docs: await listDocuments(db, { today, view, limit }),
      counts: await viewCounts(db, today),
      totals: await dashboard(db, today),
    }),
    [today, view, limit],
  );

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const open = useCallback(
    (id: string) => {
      const doc = data?.docs.find(d => d.id === id);
      root.navigate(
        doc?.status === 'DRAFT' ? 'DocumentEditor' : 'DocumentDetail',
        { id },
      );
    },
    [data?.docs, root],
  );

  const create = async (type: DocType) => {
    const doc = await mutate(tx => createDraft(tx, clock, type));
    root.navigate('DocumentEditor', { id: doc.id, isNew: true });
  };

  const leftAction = (doc: DocumentSummary): SwipeAction | undefined => {
    if (
      doc.type === 'INVOICE' &&
      ['SENT', 'PARTIAL', 'OVERDUE'].includes(doc.status) &&
      doc.balance > 0
    ) {
      return {
        label: t('actions.markPaid'),
        icon: Check,
        tone: 'success',
        onTrigger: async () => {
          const updated = await mutate(tx =>
            recordPayment(tx, clock, doc.id, {
              amount: doc.balance,
              paidOn: clock.today(),
            }),
          );
          const payment = updated.payments[updated.payments.length - 1]!;
          toast.show({
            message: t('toast.markedPaid', { number: doc.number }),
            tone: 'success',
            haptic: 'success',
            action: {
              label: t('common.undo'),
              onPress: () => mutate(tx => deletePayment(tx, clock, payment.id)),
            },
          });
        },
      };
    }
    if (
      (doc.type === 'ESTIMATE' || doc.type === 'CHANGE_ORDER') &&
      (doc.status === 'SENT' || doc.status === 'EXPIRED')
    ) {
      return {
        label: t('actions.accept'),
        icon: ThumbsUp,
        tone: 'success',
        onTrigger: async () => {
          await mutate(tx => applyAction(tx, clock, doc.id, 'ACCEPT'));
          toast.show({
            message: t('toast.accepted', { number: doc.number }),
            tone: 'success',
            haptic: 'success',
          });
        },
      };
    }
    return undefined;
  };

  const rightAction = (doc: DocumentSummary): SwipeAction =>
    doc.status === 'DRAFT'
      ? {
          label: t('actions.delete'),
          icon: Trash2,
          tone: 'danger',
          onTrigger: async () => {
            await mutate(tx => deleteDraft(tx, clock, doc.id));
            toast.show({
              message: t('toast.draftDeleted'),
              haptic: 'warning',
              action: {
                label: t('common.undo'),
                onPress: () => mutate(tx => restoreDocument(tx, doc.id)),
              },
            });
          },
        }
      : {
          label: t('actions.duplicate'),
          icon: Copy,
          tone: 'accent',
          onTrigger: async () => {
            const copy = await mutate(tx =>
              duplicateDocument(tx, clock, doc.id),
            );
            root.navigate('DocumentEditor', { id: copy.id, isNew: true });
          },
        };

  const summary = useMemo(() => {
    if (!data) {
      return null;
    }
    const pick = (m: Record<string, number>) => {
      const entries = Object.entries(m);
      const main =
        entries.find(([c]) => c === Object.keys(data.totals.outstanding)[0]) ??
        entries[0];
      return main
        ? { text: f.money(main[1], main[0]), more: entries.length - 1 }
        : null;
    };
    const outstanding = pick(data.totals.outstanding);
    if (!outstanding) {
      return null;
    }
    return {
      outstanding,
      overdue: pick(data.totals.overdue),
      paid: pick(data.totals.paidThisMonth),
    };
  }, [data, f]);

  const renderItem = useCallback(
    ({ item }: { item: DocumentSummary }) => (
      <SwipeRow left={leftAction(item)} right={rightAction(item)}>
        <DocumentRow doc={item} today={today} onPress={open} />
      </SwipeRow>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, today, t],
  );

  const isEmpty = data && data.docs.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.inbox')}
        scrollY={scrollY}
        left={
          permanentDrawer ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
        right={
          <IconButton
            testID="open-search"
            icon={Search}
            label={t('common.search')}
            onPress={() => root.navigate('CommandPalette')}
          />
        }
      />

      <Animated.FlatList
        data={data?.docs ?? []}
        keyExtractor={d => d.id}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ItemSeparatorComponent={Separator}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (data && data.docs.length >= limit) {
            setLimit(l => l + PAGE);
          }
        }}
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        ListHeaderComponent={
          <View>
            <BackupNudge />
            {summary ? (
              <View style={styles.summary}>
                <Touchable
                  feedback="highlight"
                  style={styles.stat}
                  onPress={() => navigation.setParams({ view: 'unpaid' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('inbox.outstanding')}, ${
                    summary.outstanding.text
                  }`}
                >
                  <Text variant="caption" tone="secondary">
                    {t('inbox.outstanding')}
                  </Text>
                  <Text
                    variant="title2"
                    tabular
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {summary.outstanding.text}
                  </Text>
                  {summary.outstanding.more > 0 ? (
                    <Text variant="caption" tone="tertiary">
                      {t('inbox.moreCurrencies', {
                        count: summary.outstanding.more,
                      })}
                    </Text>
                  ) : null}
                </Touchable>
                <Touchable
                  feedback="highlight"
                  style={styles.stat}
                  onPress={() => navigation.setParams({ view: 'overdue' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('inbox.overdue')}, ${
                    summary.overdue?.text ?? f.money(0)
                  }`}
                >
                  <Text variant="caption" tone="secondary">
                    {t('inbox.overdue')}
                  </Text>
                  <Text
                    variant="title2"
                    tabular
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    tone={summary.overdue ? 'danger' : 'tertiary'}
                  >
                    {summary.overdue?.text ?? f.money(0)}
                  </Text>
                </Touchable>
                <Touchable
                  feedback="highlight"
                  style={styles.stat}
                  onPress={() => navigation.setParams({ view: 'paid' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('inbox.paidThisMonth')}, ${
                    summary.paid?.text ?? f.money(0)
                  }`}
                >
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {t('inbox.paidThisMonth')}
                  </Text>
                  <Text
                    variant="title2"
                    tabular
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    tone={summary.paid ? 'primary' : 'tertiary'}
                  >
                    {summary.paid?.text ?? f.money(0)}
                  </Text>
                </Touchable>
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              accessibilityRole="tablist"
            >
              {VIEWS.map(v => (
                <Chip
                  key={v}
                  label={t(`views.${v}`)}
                  count={v === 'all' ? undefined : data?.counts[v] || undefined}
                  selected={v === view}
                  onPress={() => {
                    setLimit(PAGE);
                    navigation.setParams({ view: v });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          data ? (
            view === 'all' ? (
              <EmptyState
                illustration={<EmptyDocuments />}
                title={t('inbox.emptyTitle')}
                body={t('inbox.emptyBody')}
                action={{
                  label: t('inbox.emptyAction'),
                  onPress: () => create('INVOICE'),
                }}
              />
            ) : (
              <EmptyState
                title={t(`inbox.empty.${view}.title`)}
                body={t(`inbox.empty.${view}.body`)}
              />
            )
          ) : undefined
        }
      />

      <NewButton onPress={() => sheet.current?.present()} />
      <NewDocumentSheet ref={sheet} onSelect={create} />
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
    paddingBottom: 120,
  },
  listEmpty: {
    flexGrow: 1,
  },
  summary: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[2],
  },
  stat: {
    flex: 1,
    gap: 2,
    padding: theme.space[3],
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.surface,
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[3],
  },
}));
