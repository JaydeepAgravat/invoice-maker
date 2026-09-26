import {
  ArrowLeft,
  Ban,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  FileDiff,
  FileMinus,
  FileText,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  PenLine,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, mutate, useLiveQuery } from '@/data/live';
import {
  applyAction,
  convertEstimateToInvoice,
  createChangeOrder,
  createCreditNote,
  deletePayment,
  duplicateDocument,
  getDocument,
  listActivity,
  listDerived,
  recordPayment,
  statusOf,
  type DocumentRecord,
} from '@/data/repositories/documents';
import { getClientSignature } from '@/data/repositories/attachments';
import { contractValue } from '@/domain/changeOrder';
import { allowedActions } from '@/domain/status';
import { useFormat } from '@/lib/format';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Badge,
  Button,
  ConfirmSheet,
  Divider,
  IconButton,
  ListRow,
  SectionHeader,
  Sheet,
  Surface,
  SwipeRow,
  Text,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import { DocumentThumbnail } from '../preview/DocumentThumbnail';
import { SignatureImage } from '../signature/SignatureImage';
import { ShareSheet, type ShareSheetRef } from '../share/ShareSheet';

import { RecordPaymentSheet, type PaymentInput } from './RecordPaymentSheet';
import {
  actionKey,
  docTypeKey,
  lineSummary,
  statusKey,
  STATUS_TONE,
  type UiAction,
} from './statusMeta';

type Loaded = {
  doc: DocumentRecord;
  derived: DocumentRecord[];
  source: DocumentRecord | null;
  activity: Awaited<ReturnType<typeof listActivity>>;
  signature: Awaited<ReturnType<typeof getClientSignature>>;
};

const ACTION_ICONS: Record<UiAction, LucideIcon> = {
  RECORD_PAYMENT: CircleDollarSign,
  ACCEPT: ThumbsUp,
  DECLINE: ThumbsDown,
  CONVERT_TO_INVOICE: FileText,
  CREATE_CHANGE_ORDER: FileDiff,
  CREATE_CREDIT_NOTE: FileMinus,
  DUPLICATE: Copy,
  VOID: Ban,
  MARK_DELIVERED: PackageCheck,
  MARK_RECEIVED: ClipboardCheck,
};

/** The one action that matters most right now, shown as the primary button. */
const PRIMARY_ORDER: UiAction[] = [
  'RECORD_PAYMENT',
  'ACCEPT',
  'CONVERT_TO_INVOICE',
  'MARK_DELIVERED',
  'MARK_RECEIVED',
];

export function DocumentDetailScreen({
  navigation,
  route,
}: RootScreenProps<'DocumentDetail'>) {
  const { id } = route.params;
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const today = clock.today();
  const paymentSheet = useRef<SheetRef>(null);
  const moreSheet = useRef<SheetRef>(null);
  const voidSheet = useRef<SheetRef>(null);
  const shareSheet = useRef<ShareSheetRef>(null);
  const [, force] = useState(0);

  const { data } = useLiveQuery<Loaded | null>(
    async db => {
      const doc = await getDocument(db, id);
      if (!doc) {
        return null;
      }
      return {
        doc,
        derived: await listDerived(db, id),
        source: doc.sourceDocumentId
          ? await getDocument(db, doc.sourceDocumentId)
          : null,
        activity: await listActivity(db, id),
        signature: await getClientSignature(db, id),
      };
    },
    [id],
  );

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  if (!data) {
    return <View style={styles.screen} />;
  }
  const { doc, derived, source, activity, signature } = data;
  const status = statusOf(doc, today);
  const signable =
    (doc.type === 'ESTIMATE' ||
      doc.type === 'CHANGE_ORDER' ||
      doc.type === 'DELIVERY_NOTE') &&
    !!doc.number &&
    status !== 'VOID' &&
    status !== 'DECLINED' &&
    status !== 'CONVERTED';
  const actions = allowedActions(doc.type, status).filter(
    (a): a is UiAction =>
      a !== 'SEND' && a !== 'EDIT' && a !== 'DELETE' && a !== 'MARK_SENT',
  );
  const primary = PRIMARY_ORDER.find(a => actions.includes(a));
  const secondary = actions.filter(a => a !== primary);
  const clientName =
    (doc.clientSnapshot?.name as string | undefined) ?? t('document.noClient');
  const unpaidInvoice =
    doc.type === 'INVOICE' && doc.totals.balanceDue > 0 && status !== 'VOID';
  const hero = unpaidInvoice ? doc.totals.balanceDue : doc.totals.total;

  const openDoc = (d: DocumentRecord) =>
    navigation.push(
      d.status === 'DRAFT' ? 'DocumentEditor' : 'DocumentDetail',
      { id: d.id },
    );

  const run = async (action: UiAction) => {
    moreSheet.current?.dismiss();
    switch (action) {
      case 'RECORD_PAYMENT':
        paymentSheet.current?.present();
        return;
      case 'VOID':
        voidSheet.current?.present();
        return;
      case 'ACCEPT':
      case 'DECLINE':
      case 'MARK_DELIVERED':
      case 'MARK_RECEIVED': {
        const transition = action;
        await mutate(tx => applyAction(tx, clock, id, transition));
        toast.show({
          message: t(`toast.action.${transition}`),
          tone: 'success',
          haptic: 'success',
        });
        return;
      }
      case 'CONVERT_TO_INVOICE': {
        const invoice = await mutate(tx =>
          convertEstimateToInvoice(tx, clock, id),
        );
        toast.show({
          message: t('toast.converted'),
          tone: 'success',
          haptic: 'success',
        });
        navigation.push('DocumentEditor', { id: invoice.id });
        return;
      }
      case 'CREATE_CHANGE_ORDER': {
        const co = await mutate(tx => createChangeOrder(tx, clock, id));
        navigation.push('DocumentEditor', { id: co.id, isNew: true });
        return;
      }
      case 'CREATE_CREDIT_NOTE': {
        const cn = await mutate(tx => createCreditNote(tx, clock, id));
        navigation.push('DocumentEditor', { id: cn.id });
        return;
      }
      case 'DUPLICATE': {
        const copy = await mutate(tx => duplicateDocument(tx, clock, id));
        navigation.push('DocumentEditor', { id: copy.id, isNew: true });
        return;
      }
    }
  };

  const savePayment = async (p: PaymentInput) => {
    paymentSheet.current?.dismiss();
    const updated = await mutate(tx => recordPayment(tx, clock, id, p));
    const paidInFull = updated.totals.balanceDue <= 0;
    toast.show({
      message: paidInFull
        ? t('toast.paidInFull', { number: doc.number })
        : t('toast.paymentRecorded', {
            amount: f.money(p.amount, doc.currency),
          }),
      tone: 'success',
      haptic: 'success',
    });
    force(n => n + 1);
  };

  const contract =
    doc.type === 'ESTIMATE' && derived.some(d => d.type === 'CHANGE_ORDER')
      ? contractValue(
          doc.totals.total,
          derived
            .filter(d => d.type === 'CHANGE_ORDER')
            .map(d => ({
              total: d.totals.total,
              status:
                d.status === 'ACCEPTED'
                  ? 'ACCEPTED'
                  : d.status === 'DECLINED'
                  ? 'DECLINED'
                  : d.status === 'VOID'
                  ? 'VOID'
                  : 'PENDING',
            })),
        )
      : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={doc.number ?? t(docTypeKey(doc.type))}
        scrollY={scrollY}
        left={
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <>
            {status !== 'VOID' ? (
              <IconButton
                testID="detail-edit"
                icon={Pencil}
                label={t('actions.edit')}
                onPress={() => navigation.push('DocumentEditor', { id })}
              />
            ) : null}
            {secondary.length ? (
              <IconButton
                testID="detail-more"
                icon={MoreHorizontal}
                label={t('actions.more')}
                onPress={() => moreSheet.current?.present()}
              />
            ) : null}
          </>
        }
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text variant="captionMedium" tone="secondary">
              {t(docTypeKey(doc.type))}
            </Text>
            <Badge label={t(statusKey(status))} tone={STATUS_TONE[status]} />
          </View>
          <Text
            variant="display"
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            tone={status === 'VOID' ? 'tertiary' : 'primary'}
          >
            {f.money(hero, doc.currency)}
          </Text>
          <Text variant="callout" tone="secondary">
            {unpaidInvoice
              ? doc.totals.paid
                ? t('detail.leftOf', {
                    total: f.money(doc.totals.total, doc.currency),
                  })
                : t('detail.due')
              : t('totals.total')}
            {doc.dueDate && unpaidInvoice
              ? ` · ${f.due(doc.dueDate, today)}`
              : ''}
          </Text>
        </View>

        <DocumentThumbnail
          id={id}
          onPress={() => navigation.push('DocumentPreview', { id })}
        />

        <Surface style={styles.card}>
          <ListRow
            title={clientName}
            subtitle={(doc.clientSnapshot?.emails as string[] | undefined)?.[0]}
            showChevron={!!doc.clientId}
            onPress={
              doc.clientId
                ? () => navigation.push('ClientDetail', { id: doc.clientId! })
                : undefined
            }
          />
          <Divider inset={16} />
          <ListRow
            title={t('document.issueDate')}
            value={f.date(doc.issueDate)}
          />
          {doc.dueDate ? (
            <>
              <Divider inset={16} />
              <ListRow
                title={t('document.dueDate')}
                value={f.date(doc.dueDate)}
              />
            </>
          ) : null}
          {doc.validUntil ? (
            <>
              <Divider inset={16} />
              <ListRow
                title={t('document.validUntil')}
                value={f.date(doc.validUntil)}
              />
            </>
          ) : null}
        </Surface>

        {contract ? (
          <>
            <SectionHeader title={t('detail.contract')} />
            <Surface style={styles.card}>
              <ListRow
                title={t('detail.original')}
                value={f.money(contract.original, doc.currency)}
              />
              <Divider inset={16} />
              <ListRow
                title={t('detail.approvedChanges')}
                value={f.money(contract.approvedChanges, doc.currency, {
                  signed: true,
                })}
              />
              {contract.pendingChanges ? (
                <>
                  <Divider inset={16} />
                  <ListRow
                    title={t('detail.pendingChanges')}
                    value={f.money(contract.pendingChanges, doc.currency, {
                      signed: true,
                    })}
                  />
                </>
              ) : null}
              <Divider inset={16} />
              <ListRow
                title={t('detail.revised')}
                value={f.money(contract.revised, doc.currency)}
              />
            </Surface>
          </>
        ) : null}

        {signature ? (
          <>
            <SectionHeader title={t('signature.section')} />
            <Surface style={styles.signed}>
              <SignatureImage path={signature.path} width={220} height={72} />
              <Text variant="caption" tone="secondary">
                {[
                  signature.name,
                  new Intl.DateTimeFormat(f.locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(signature.signedAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Surface>
          </>
        ) : signable ? (
          <Surface style={[styles.card, styles.gap]}>
            <ListRow
              testID="detail-sign"
              leadingIcon={PenLine}
              title={t('signature.collect')}
              subtitle={t('signature.collectHint')}
              showChevron
              onPress={() => navigation.push('Signature', { documentId: id })}
            />
          </Surface>
        ) : null}

        {doc.type === 'INVOICE' && doc.payments.length ? (
          <>
            <SectionHeader title={t('detail.payments')} />
            <Surface style={styles.card}>
              {doc.payments.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <Divider inset={52} /> : null}
                  <SwipeRow
                    right={{
                      label: t('actions.remove'),
                      icon: Trash2,
                      tone: 'danger',
                      onTrigger: async () => {
                        await mutate(tx => deletePayment(tx, clock, p.id));
                        toast.show({
                          message: t('toast.paymentRemoved'),
                          action: {
                            label: t('common.undo'),
                            onPress: () =>
                              mutate(tx =>
                                recordPayment(tx, clock, id, {
                                  amount: p.amount,
                                  paidOn: p.paidOn,
                                  method: p.method,
                                  note: p.note,
                                }),
                              ),
                          },
                        });
                      },
                    }}
                  >
                    <ListRow
                      leadingIcon={Check}
                      title={f.money(p.amount, doc.currency)}
                      subtitle={[
                        f.date(p.paidOn),
                        p.method
                          ? t(`paymentMethod.${p.method}`, {
                              defaultValue: p.method,
                            })
                          : null,
                        p.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </SwipeRow>
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        <SectionHeader title={t('editor.items')} />
        <Surface style={styles.card}>
          {doc.lines.map((l, i) => (
            <View key={l.id}>
              {i > 0 ? <Divider inset={16} /> : null}
              <ListRow
                title={l.name}
                subtitle={lineSummary(t, f.money, f.locale, l, doc.currency, {
                  prices: doc.type !== 'DELIVERY_NOTE',
                })}
                value={f.money(
                  doc.pricesIncludeTax ? l.total : l.net,
                  doc.currency,
                )}
              />
            </View>
          ))}
          <Divider />
          <ListRow
            title={t('totals.total')}
            value={f.money(doc.totals.total, doc.currency)}
          />
        </Surface>

        {source || derived.length ? (
          <>
            <SectionHeader title={t('detail.related')} />
            <Surface style={styles.card}>
              {[...(source ? [source] : []), ...derived].map((d, i) => (
                <View key={d.id}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <ListRow
                    title={`${t(docTypeKey(d.type))} ${d.number ?? ''}`.trim()}
                    subtitle={t(statusKey(statusOf(d, today)))}
                    value={f.money(d.totals.total, d.currency)}
                    showChevron
                    onPress={() => openDoc(d)}
                  />
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        <SectionHeader title={t('detail.activity')} />
        <View style={styles.timeline}>
          {[...activity].reverse().map(a => (
            <View key={a.id} style={styles.event}>
              <View style={styles.eventDot} />
              <Text variant="callout" style={styles.flex}>
                {t(`activity.${a.kind}`, {
                  defaultValue: a.kind,
                  ...(a.payload ?? {}),
                })}
              </Text>
              <Text variant="caption" tone="tertiary" tabular>
                {new Intl.DateTimeFormat(f.locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(a.at)}
              </Text>
            </View>
          ))}
        </View>
      </Animated.ScrollView>

      {status !== 'VOID' ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={primary ? styles.sendSecondary : styles.flex}>
            <Button
              testID="detail-send"
              variant={primary ? 'secondary' : 'primary'}
              size="lg"
              fullWidth
              leadingIcon={Send}
              label={t('share.send')}
              onPress={() => shareSheet.current?.present(id)}
            />
          </View>
          {primary ? (
            <View style={styles.flex}>
              <Button
                testID={`detail-${primary}`}
                variant="primary"
                size="lg"
                fullWidth
                leadingIcon={ACTION_ICONS[primary]}
                label={t(actionKey(primary))}
                onPress={() => run(primary)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <ShareSheet ref={shareSheet} />

      <RecordPaymentSheet
        ref={paymentSheet}
        balance={doc.totals.balanceDue}
        currency={doc.currency}
        today={today}
        onSave={savePayment}
      />

      <Sheet ref={moreSheet} title={t('actions.more')}>
        {secondary.map((a, i) => (
          <View key={a}>
            {i > 0 ? <Divider inset={52} /> : null}
            <ListRow
              testID={`action-${a}`}
              leadingIcon={ACTION_ICONS[a]}
              title={t(actionKey(a))}
              destructive={a === 'VOID' || a === 'DECLINE'}
              onPress={() => run(a)}
            />
          </View>
        ))}
      </Sheet>

      <ConfirmSheet
        ref={voidSheet}
        title={t('void.title', { number: doc.number })}
        body={t('void.body')}
        confirmLabel={t('actions.VOID')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={async () => {
          await mutate(tx => applyAction(tx, clock, id, 'VOID'));
          toast.show({ message: t('toast.voided', { number: doc.number }) });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  flex: {
    flex: 1,
  },
  content: {
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    gap: theme.space[1],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
    paddingBottom: theme.space[6],
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  timeline: {
    paddingHorizontal: theme.size.gutter,
    gap: theme.space[3],
  },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.border.strong,
  },
  signed: {
    marginHorizontal: theme.size.gutter,
    padding: theme.space[4],
    gap: theme.space[2],
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  gap: {
    marginTop: theme.space[4],
  },
  sendSecondary: {
    flexBasis: '38%',
  },
  footer: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
}));
