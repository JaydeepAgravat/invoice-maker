import { usePreventRemove } from '@react-navigation/native';
import {
  CalendarDays,
  Eye,
  Send,
  Check,
  Coins,
  FileText,
  Hash,
  Percent,
  Plus,
  ScrollText,
  StickyNote,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PixelRatio, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate, useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import { getClient, type Client } from '@/data/repositories/clients';
import {
  calculateDraft,
  defaultLineTaxes,
  deleteDraft,
  getDocument,
  saveDocument,
  toDraft,
  type DocumentDraft,
  type LineDraft,
  type LineTaxSnapshot,
} from '@/data/repositories/documents';
import { previewNumber } from '@/data/repositories/sequences';
import { addDays, daysBetween } from '@/domain/dates';
import { hasPrices } from '@/domain/docTypes';
import { rateToPercent } from '@/domain/money';
import { PRESETS } from '@/domain/presets';
import { docTypeKey, lineSummary } from '@/features/documents/statusMeta';
import { useFormat } from '@/lib/format';
import { CalendarSheet } from '@/ui/inputs/CalendarSheet';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Avatar,
  Button,
  Divider,
  Icon,
  IconButton,
  ListRow,
  SectionHeader,
  Surface,
  Switch,
  SwipeRow,
  Text,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

import { ClientPickerSheet } from './ClientPickerSheet';
import { CurrencySheet } from './CurrencySheet';
import { DiscountSheet } from './DiscountSheet';
import { LineSheet } from './LineSheet';
import { NumberingSheet } from './NumberingSheet';
import { PhotoStrip } from './PhotoStrip';
import { TextSheet } from './TextSheet';
import { PdfPages } from '../preview/PdfPages';
import { usePdfPreview } from '../preview/usePdfPreview';
import { ShareSheet, type ShareSheetRef } from '../share/ShareSheet';

const AUTOSAVE_MS = 400;

type TextField = 'notes' | 'terms' | 'reference' | 'title';
type DateField =
  | 'issueDate'
  | 'dueDate'
  | 'validUntil'
  | 'supplyDate'
  | 'statementFrom'
  | 'statementTo';

export function DocumentEditorScreen({
  navigation,
  route,
}: RootScreenProps<'DocumentEditor'>) {
  const { id, isNew } = route.params;
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Tablets: the real PDF updates beside the form as you type.
  const wide = width >= 1000;
  const today = clock.today();

  const { data: record } = useLiveQuery(db => getDocument(db, id), [id]);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [defaultTaxes, setDefaultTaxes] = useState<LineTaxSnapshot[]>([]);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dirty, setDirty] = useState(false);
  const [editingLine, setEditingLine] = useState<{
    index: number | null;
    line: LineDraft | null;
    nonce: number;
  }>({ index: null, line: null, nonce: 0 });
  const [textField, setTextField] = useState<TextField>('notes');
  const [dateField, setDateField] = useState<DateField>('issueDate');

  const lineSheet = useRef<SheetRef>(null);
  const clientSheet = useRef<SheetRef>(null);
  const discountSheet = useRef<SheetRef>(null);
  const textSheet = useRef<SheetRef>(null);
  const dateSheet = useRef<SheetRef>(null);
  const currencySheet = useRef<SheetRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<DocumentDraft | null>(null);
  const leaving = useRef(false);
  const numberingSheet = useRef<SheetRef>(null);
  const shareSheet = useRef<ShareSheetRef>(null);

  const isIssued = !!record && record.status !== 'DRAFT';
  const { data: numberPreview } = useLiveQuery(
    async db =>
      record && !record.number && draft
        ? previewNumber(db, record.type, draft.issueDate)
        : null,
    [record?.number, record?.type, draft?.issueDate],
  );

  // Load once. Later DB refreshes must not overwrite what the person is typing.
  useEffect(() => {
    if (record && !draft) {
      const d = toDraft(record);
      setDraft(d);
      latest.current = d;
      getDatabase().then(async db => {
        setDefaultTaxes(await defaultLineTaxes(db));
        if (d.clientId) {
          setClient(await getClient(db, d.clientId));
        }
      });
    }
  }, [record, draft]);

  const persist = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const d = latest.current;
    if (!d) {
      return;
    }
    setSaved('saving');
    await mutate(tx => saveDocument(tx, clock, d));
    setSaved('saved');
    setDirty(false);
  }, []);

  const update = useCallback(
    (patch: Partial<DocumentDraft> | ((d: DocumentDraft) => DocumentDraft)) => {
      setDraft(prev => {
        if (!prev) {
          return prev;
        }
        const next =
          typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        latest.current = next;
        return next;
      });
      setDirty(true);
      if (!isIssued) {
        if (timer.current) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(persist, AUTOSAVE_MS);
      }
    },
    [isIssued, persist],
  );

  const isEmptyNew = useCallback(
    () =>
      !!isNew &&
      !!latest.current &&
      !latest.current.clientId &&
      latest.current.lines.length === 0,
    [isNew],
  );

  // Leaving: flush the autosave; quietly drop a brand-new draft that was never filled in.
  usePreventRemove(
    !leaving.current && !!draft && (dirty || isEmptyNew()),
    ({ data }) => {
      leaving.current = true;
      (async () => {
        if (isEmptyNew() && !isIssued) {
          await mutate(tx => deleteDraft(tx, clock, id));
        } else if (dirty && !isIssued) {
          await persist();
        } else if (dirty && isIssued) {
          toast.show({ message: t('editor.changesDiscarded') });
        }
        navigation.dispatch(data.action);
      })();
    },
  );

  const totals = useMemo(() => {
    if (!draft) {
      return null;
    }
    try {
      return calculateDraft(draft, record?.totals.paid ?? 0);
    } catch {
      return null;
    }
  }, [draft, record?.totals.paid]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  styles.useVariants({ empty: !client });

  if (!draft || !record) {
    return <View style={styles.screen} />;
  }

  const type = draft.type;
  const priced = hasPrices(type);
  const isStatement = type === 'STATEMENT';
  const partyLabel =
    type === 'PURCHASE_ORDER' ? t('document.supplier') : t('document.client');
  const title =
    record.number ??
    t('editor.newTitle', {
      type: t(docTypeKey(type)),
      typeLower: t(docTypeKey(type)).toLowerCase(),
    });

  const openLine = (index: number | null) => {
    setEditingLine(prev => ({
      index,
      line: index === null ? null : draft.lines[index]!,
      nonce: prev.nonce + 1,
    }));
    lineSheet.current?.present();
  };

  const saveLine = (line: LineDraft) => {
    update(d => {
      const lines = [...d.lines];
      if (editingLine.index === null) {
        lines.push(line);
      } else {
        lines[editingLine.index] = line;
      }
      return { ...d, lines };
    });
    lineSheet.current?.dismiss();
  };

  const removeLine = (index: number) => {
    const removed = draft.lines[index]!;
    update(d => ({ ...d, lines: d.lines.filter((_, i) => i !== index) }));
    lineSheet.current?.dismiss();
    toast.show({
      message: t('editor.lineRemoved', { name: removed.name }),
      action: {
        label: t('common.undo'),
        onPress: () =>
          update(d => {
            const lines = [...d.lines];
            lines.splice(index, 0, removed);
            return { ...d, lines };
          }),
      },
    });
  };

  const openText = (field: TextField) => {
    setTextField(field);
    textSheet.current?.present();
  };
  const openDate = (field: DateField) => {
    setDateField(field);
    dateSheet.current?.present();
  };

  const setDate = (field: DateField, value: string) => {
    if (field === 'issueDate' && draft.termsDays !== null && draft.dueDate) {
      update({ issueDate: value, dueDate: addDays(value, draft.termsDays) });
    } else if (field === 'dueDate') {
      update({
        dueDate: value,
        termsDays: Math.max(0, daysBetween(draft.issueDate, value)),
      });
    } else {
      update({ [field]: value } as Partial<DocumentDraft>);
    }
  };

  const flush = async () => {
    if (timer.current || dirty) {
      await persist();
    }
  };

  const send = async () => {
    await flush();
    shareSheet.current?.present(id);
  };

  const preview = async () => {
    await flush();
    navigation.push('DocumentPreview', { id });
  };

  const saveIssued = async () => {
    await persist();
    toast.show({
      message: t('toast.revisionSaved'),
      tone: 'success',
      haptic: 'success',
    });
    leaving.current = true;
    navigation.goBack();
  };

  const dateRow = (
    field: DateField,
    label: string,
    value: string | null,
    hint?: string,
  ) => (
    <ListRow
      key={field}
      testID={`date-${field}`}
      title={label}
      leadingIcon={CalendarDays}
      value={value ? f.date(value) : t('editor.notSet')}
      meta={hint}
      onPress={() => openDate(field)}
    />
  );

  const textValue = draft[textField];
  const dateValue = (draft[dateField] as string | null) ?? today;
  const quickPicks =
    dateField === 'dueDate'
      ? [0, 7, 14, 30, 60].map(n => ({
          label:
            n === 0 ? t('terms.onReceipt') : t('terms.netDays', { count: n }),
          date: addDays(draft.issueDate, n),
        }))
      : dateField === 'validUntil'
      ? [14, 30, 60].map(n => ({
          label: t('terms.days', { count: n }),
          date: addDays(draft.issueDate, n),
        }))
      : [{ label: t('dates.today'), date: today }];

  const dateLabels: Record<DateField, string> = {
    issueDate: t('document.issueDate'),
    dueDate: t('document.dueDate'),
    validUntil: t('document.validUntil'),
    supplyDate: t('document.supplyDate'),
    statementFrom: t('document.periodFrom'),
    statementTo: t('document.periodTo'),
  };
  const showSupplyDate =
    PRESETS[profile.country].requiresSupplyDate || !!draft.supplyDate;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={title}
        scrollY={scrollY}
        left={
          <IconButton
            testID="editor-close"
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <>
            {saved === 'saved' && !isIssued ? (
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.saved}
              >
                <Icon icon={Check} size={14} tone="tertiary" />
                <Text variant="caption" tone="tertiary">
                  {t('editor.saved')}
                </Text>
              </Animated.View>
            ) : null}
            <IconButton
              testID="editor-preview"
              icon={Eye}
              label={t('preview.title')}
              onPress={preview}
            />
          </>
        }
      />

      <View style={wide ? styles.split : styles.flex}>
        <View style={styles.flex}>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 120 },
            ]}
          >
            {isIssued ? (
              <View style={styles.banner}>
                <Text variant="callout" tone="secondary">
                  {t('editor.issuedBanner', { revision: record.revision + 2 })}
                </Text>
              </View>
            ) : null}

            {/* Client */}
            <Touchable
              testID="editor-client"
              feedback="highlight"
              onPress={() => clientSheet.current?.present()}
              accessibilityRole="button"
              accessibilityLabel={
                client
                  ? `${partyLabel}: ${client.name}`
                  : t(
                      type === 'PURCHASE_ORDER'
                        ? 'editor.addParty.supplier'
                        : 'editor.addParty.client',
                    )
              }
              style={styles.clientCard}
            >
              {client ? (
                <>
                  <Avatar name={client.name} size={40} />
                  <View style={styles.flex}>
                    <Text variant="caption" tone="tertiary">
                      {partyLabel}
                    </Text>
                    <Text variant="headline" numberOfLines={1}>
                      {client.name}
                    </Text>
                    {client.emails[0] || client.company ? (
                      <Text
                        variant="caption"
                        tone="secondary"
                        numberOfLines={1}
                      >
                        {[client.company, client.emails[0]]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.addCircle}>
                    <Icon icon={UserPlus} size={20} tone="accent" />
                  </View>
                  <Text variant="bodyMedium" tone="accent">
                    {t(
                      type === 'PURCHASE_ORDER'
                        ? 'editor.addParty.supplier'
                        : 'editor.addParty.client',
                    )}
                  </Text>
                </>
              )}
            </Touchable>

            {/* Dates */}
            <Surface style={styles.card}>
              {isStatement ? (
                <>
                  {dateRow(
                    'statementFrom',
                    dateLabels.statementFrom,
                    draft.statementFrom,
                  )}
                  <Divider inset={52} />
                  {dateRow(
                    'statementTo',
                    dateLabels.statementTo,
                    draft.statementTo,
                  )}
                </>
              ) : (
                <>
                  {dateRow('issueDate', dateLabels.issueDate, draft.issueDate)}
                  {type === 'INVOICE' ? (
                    <>
                      <Divider inset={52} />
                      {dateRow(
                        'dueDate',
                        dateLabels.dueDate,
                        draft.dueDate,
                        draft.termsDays === 0
                          ? t('terms.onReceipt')
                          : draft.termsDays
                          ? t('terms.netDays', { count: draft.termsDays })
                          : undefined,
                      )}
                    </>
                  ) : null}
                  {type === 'ESTIMATE' || type === 'CHANGE_ORDER' ? (
                    <>
                      <Divider inset={52} />
                      {dateRow(
                        'validUntil',
                        dateLabels.validUntil,
                        draft.validUntil,
                      )}
                    </>
                  ) : null}
                  {showSupplyDate &&
                  (type === 'INVOICE' ||
                    type === 'RECEIPT' ||
                    type === 'DELIVERY_NOTE') ? (
                    <>
                      <Divider inset={52} />
                      {dateRow(
                        'supplyDate',
                        dateLabels.supplyDate,
                        draft.supplyDate,
                      )}
                    </>
                  ) : null}
                </>
              )}
            </Surface>

            {/* Lines */}
            {isStatement ? (
              <View style={styles.banner}>
                <Text variant="callout" tone="secondary">
                  {t('editor.statementNote')}
                </Text>
              </View>
            ) : (
              <>
                <SectionHeader title={t('editor.items')} />
                <Surface style={styles.card}>
                  {draft.lines.map((line, index) => {
                    const res = totals?.lines[index];
                    const sub = lineSummary(
                      t,
                      f.money,
                      f.locale,
                      line,
                      draft.currency,
                      {
                        prices: priced,
                      },
                    );
                    return (
                      <View key={line.id ?? index}>
                        {index > 0 ? <Divider inset={16} /> : null}
                        <SwipeRow
                          right={{
                            label: t('actions.delete'),
                            icon: Trash2,
                            tone: 'danger',
                            onTrigger: () => removeLine(index),
                          }}
                        >
                          <ListRow
                            testID={`line-row-${index}`}
                            title={line.name}
                            subtitle={sub}
                            value={
                              priced && res
                                ? f.money(
                                    draft.pricesIncludeTax
                                      ? res.taxable
                                      : res.net,
                                    draft.currency,
                                  )
                                : undefined
                            }
                            meta={
                              line.kind === 'CHARGE'
                                ? t('editor.charge')
                                : line.discount
                                ? t('editor.discounted')
                                : undefined
                            }
                            onPress={() => openLine(index)}
                          />
                        </SwipeRow>
                      </View>
                    );
                  })}
                  {draft.lines.length > 0 ? <Divider /> : null}
                  <ListRow
                    testID="add-line"
                    leading={
                      <View style={styles.plus}>
                        <Icon
                          icon={Plus}
                          size={16}
                          tone="accent"
                          strokeWidth={2}
                        />
                      </View>
                    }
                    title={t('editor.addItem')}
                    onPress={() => openLine(null)}
                  />
                  {priced ? (
                    <>
                      <Divider inset={52} />
                      <ListRow
                        leadingIcon={Truck}
                        title={t('editor.addCharge')}
                        subtitle={t('editor.addChargeHint')}
                        onPress={() => {
                          setEditingLine(prev => ({
                            nonce: prev.nonce + 1,
                            index: null,
                            line: {
                              name: t('editor.shipping'),
                              quantity: 1000,
                              unitPrice: 0,
                              taxes: defaultTaxes,
                              kind: 'CHARGE',
                            },
                          }));
                          lineSheet.current?.present();
                        }}
                      />
                    </>
                  ) : null}
                </Surface>
              </>
            )}

            {/* Totals */}
            {priced && totals && !isStatement ? (
              <Surface style={[styles.card, styles.totals]}>
                <TotalRow
                  label={t('totals.subtotal')}
                  value={f.money(totals.subtotal, draft.currency)}
                />
                <Touchable
                  feedback="highlight"
                  onPress={() => discountSheet.current?.present()}
                  style={styles.totalTouch}
                  accessibilityRole="button"
                >
                  <TotalRow
                    label={
                      draft.discount?.type === 'PERCENT'
                        ? `${t('document.discount')} ${rateToPercent(
                            draft.discount.rate,
                          )}%`
                        : t('document.discount')
                    }
                    value={
                      totals.documentDiscount
                        ? `−${f.money(totals.documentDiscount, draft.currency)}`
                        : t('editor.addDiscount')
                    }
                    accent={!totals.documentDiscount}
                  />
                </Touchable>
                {totals.chargesTotal ? (
                  <TotalRow
                    label={t('totals.charges')}
                    value={f.money(totals.chargesTotal, draft.currency)}
                  />
                ) : null}
                {totals.taxes
                  .filter(x => x.kind !== 'WITHHOLDING')
                  .map(x => (
                    <TotalRow
                      key={`${x.id}${x.rate}`}
                      label={`${x.name} ${rateToPercent(x.rate)}%`}
                      value={f.money(x.amount, draft.currency)}
                    />
                  ))}
                {draft.pricesIncludeTax && totals.taxTotal ? (
                  <Text
                    variant="caption"
                    tone="tertiary"
                    style={styles.included}
                  >
                    {t('totals.taxIncluded')}
                  </Text>
                ) : null}
                {totals.withholdingTotal ? (
                  <>
                    <TotalRow
                      label={t('totals.totalBeforeWithholding')}
                      value={f.money(
                        totals.totalBeforeWithholding,
                        draft.currency,
                      )}
                    />
                    {totals.taxes
                      .filter(x => x.kind === 'WITHHOLDING')
                      .map(x => (
                        <TotalRow
                          key={`${x.id}${x.rate}`}
                          label={`${x.name} ${rateToPercent(x.rate)}%`}
                          value={`−${f.money(x.amount, draft.currency)}`}
                        />
                      ))}
                  </>
                ) : null}
                <Divider />
                <TotalRow
                  label={t('totals.total')}
                  value={f.money(totals.total, draft.currency)}
                  strong
                />
                {totals.paid ? (
                  <>
                    <TotalRow
                      label={t('totals.paid')}
                      value={`−${f.money(totals.paid, draft.currency)}`}
                    />
                    <TotalRow
                      label={t('totals.balanceDue')}
                      value={f.money(totals.balanceDue, draft.currency)}
                      strong
                    />
                  </>
                ) : null}
              </Surface>
            ) : null}

            {!isStatement ? (
              <>
                <SectionHeader title={t('photos.title')} />
                <PhotoStrip documentId={id} />
              </>
            ) : null}

            {/* Options */}
            <SectionHeader title={t('editor.details')} />
            <Surface style={styles.card}>
              {priced ? (
                <>
                  <ListRow
                    leadingIcon={Percent}
                    title={t('editor.pricesIncludeTax')}
                    onPress={() =>
                      update({ pricesIncludeTax: !draft.pricesIncludeTax })
                    }
                    trailing={
                      <Switch
                        value={draft.pricesIncludeTax}
                        onValueChange={v => update({ pricesIncludeTax: v })}
                        accessibilityLabel={t('editor.pricesIncludeTax')}
                      />
                    }
                  />
                  <Divider inset={52} />
                  <ListRow
                    leadingIcon={Coins}
                    title={t('editor.currency')}
                    value={draft.currency}
                    showChevron
                    onPress={() => currencySheet.current?.present()}
                  />
                  <Divider inset={52} />
                </>
              ) : null}
              <ListRow
                leadingIcon={Hash}
                title={t('document.reference')}
                subtitle={draft.reference ?? t('document.referenceHint')}
                onPress={() => openText('reference')}
              />
              <Divider inset={52} />
              <ListRow
                leadingIcon={StickyNote}
                title={t('document.notes')}
                subtitle={draft.notes ?? t('editor.notSet')}
                onPress={() => openText('notes')}
              />
              <Divider inset={52} />
              <ListRow
                leadingIcon={ScrollText}
                title={t('document.terms')}
                subtitle={draft.terms ?? t('editor.notSet')}
                onPress={() => openText('terms')}
              />
            </Surface>
          </Animated.ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            {isIssued ? (
              <Button
                testID="editor-save-issued"
                variant="primary"
                size="lg"
                fullWidth
                label={dirty ? t('editor.saveChanges') : t('common.done')}
                onPress={dirty ? saveIssued : () => navigation.goBack()}
              />
            ) : (
              <>
                {numberPreview ? (
                  <View style={styles.numberHint}>
                    <Icon icon={FileText} size={14} tone="tertiary" />
                    <Text variant="caption" tone="tertiary" tabular>
                      {t('editor.willBeNumbered', { number: numberPreview })}
                    </Text>
                    <Touchable
                      testID="editor-numbering"
                      feedback="highlight"
                      hitSlop={10}
                      style={styles.change}
                      onPress={() => numberingSheet.current?.present()}
                      accessibilityRole="button"
                      accessibilityLabel={t('numbering.title')}
                    >
                      <Text variant="captionMedium" tone="accent">
                        {t('numbering.change')}
                      </Text>
                    </Touchable>
                  </View>
                ) : null}
                <View style={styles.footerRow}>
                  {wide ? null : (
                    <View style={styles.previewButton}>
                      <Button
                        testID="editor-preview-button"
                        variant="secondary"
                        size="lg"
                        fullWidth
                        leadingIcon={Eye}
                        label={t('preview.short')}
                        onPress={preview}
                      />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Button
                      testID="editor-issue"
                      variant="primary"
                      size="lg"
                      fullWidth
                      leadingIcon={Send}
                      label={t('share.send')}
                      onPress={send}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
        {wide ? (
          <View style={styles.previewPane}>
            <EditorPreview id={id} />
          </View>
        ) : null}
      </View>

      <NumberingSheet
        ref={numberingSheet}
        type={type}
        issueDate={draft.issueDate}
      />
      <ShareSheet
        ref={shareSheet}
        onShared={() => {
          leaving.current = true;
          navigation.replace('DocumentDetail', { id });
        }}
      />
      <LineSheet
        ref={lineSheet}
        line={editingLine.line}
        resetKey={editingLine.nonce}
        settings={draft}
        defaultTaxes={defaultTaxes}
        onSave={saveLine}
        onDelete={
          editingLine.index !== null
            ? () => removeLine(editingLine.index!)
            : undefined
        }
      />
      <ClientPickerSheet
        ref={clientSheet}
        title={partyLabel}
        selectedId={draft.clientId}
        onSelect={c => {
          setClient(c);
          update(d => ({
            ...d,
            clientId: c?.id ?? null,
            ...(c?.currency && d.lines.length === 0
              ? { currency: c.currency }
              : {}),
            ...(c?.language ? { language: c.language } : {}),
            ...(c?.defaultTermsDays !== null &&
            c?.defaultTermsDays !== undefined &&
            d.type === 'INVOICE'
              ? {
                  termsDays: c.defaultTermsDays,
                  dueDate: addDays(d.issueDate, c.defaultTermsDays),
                }
              : {}),
          }));
          clientSheet.current?.dismiss();
        }}
      />
      <DiscountSheet
        ref={discountSheet}
        value={draft.discount}
        currency={draft.currency}
        subtotal={totals?.subtotal ?? 0}
        onSave={discount => update({ discount })}
      />
      <TextSheet
        ref={textSheet}
        title={t(`document.${textField}`)}
        value={textValue}
        multiline={textField === 'notes' || textField === 'terms'}
        placeholder={
          textField === 'reference' ? t('document.referenceHint') : undefined
        }
        onSave={value =>
          update({ [textField]: value } as Partial<DocumentDraft>)
        }
      />
      <CalendarSheet
        ref={dateSheet}
        title={dateLabels[dateField]}
        value={dateValue}
        today={today}
        locale={f.locale}
        quickPicks={quickPicks}
        min={
          dateField === 'dueDate' || dateField === 'validUntil'
            ? draft.issueDate
            : undefined
        }
        onChange={value => setDate(dateField, value)}
      />
      <CurrencySheet
        ref={currencySheet}
        title={t('editor.currency')}
        value={draft.currency}
        locale={f.locale}
        onSelect={currency => {
          update({ currency });
          currencySheet.current?.dismiss();
        }}
      />
    </View>
  );
}

function TotalRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text
        variant={strong ? 'headline' : 'callout'}
        tone={strong ? 'primary' : 'secondary'}
        style={styles.flex}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        variant={strong ? 'headline' : 'callout'}
        tone={accent ? 'accent' : 'primary'}
        tabular
      >
        {value}
      </Text>
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
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: theme.space[2],
  },
  banner: {
    marginHorizontal: theme.size.gutter,
    marginBottom: theme.space[3],
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.hover,
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: 72,
    marginHorizontal: theme.size.gutter,
    marginBottom: theme.space[3],
    padding: theme.space[4],
    borderRadius: theme.radius.lg,
    borderWidth: theme.stroke.thin,
    variants: {
      empty: {
        true: {
          borderStyle: 'dashed',
          borderColor: theme.colors.accent.border,
          backgroundColor: theme.colors.bg.app,
        },
        false: {
          borderStyle: 'solid',
          borderColor: theme.colors.border.subtle,
          backgroundColor: theme.colors.bg.surface,
        },
      },
    },
  },
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
  plus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
  totals: {
    marginTop: theme.space[3],
    paddingVertical: theme.space[2],
  },
  totalTouch: {
    borderRadius: 0,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: 36,
    paddingHorizontal: theme.size.gutter,
  },
  included: {
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[1],
  },
  footerRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  previewButton: {
    flexBasis: '36%',
  },
  change: {
    paddingHorizontal: theme.space[1],
    borderRadius: theme.radius.xs,
  },
  numberHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[1.5],
  },
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  previewPane: {
    width: '46%',
    backgroundColor: theme.colors.bg.subtle,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.colors.border.subtle,
  },
  footer: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
}));

function EditorPreview({ id }: { id: string }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const preview = usePdfPreview(
    id,
    {},
    Math.min(1600, Math.round(width * 0.46 * PixelRatio.get())),
  );
  return (
    <PdfPages
      pages={preview.pages}
      paper={preview.model?.paper ?? 'A4'}
      pageLabel={(n, total) => t('preview.page', { n, total })}
    />
  );
}
