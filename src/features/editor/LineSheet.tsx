import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Check, Package, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { unitLabel } from '@/features/documents/statusMeta';
import { Keyboard, ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useLiveQuery } from '@/data/live';
import type { LineDraft, LineTaxSnapshot } from '@/data/repositories/documents';
import { calculateDraft, taxIdentity } from '@/data/repositories/documents';
import { listItems, type Item } from '@/data/repositories/items';
import { listTaxRates, type TaxRate } from '@/data/repositories/taxRates';
import { evaluate, toEditableText } from '@/domain/expression';
import {
  currencyDigits,
  decimalSeparator,
  QTY_SCALE,
  rateToPercent,
} from '@/domain/money';
import { isKnownUnit, unitsFor } from '@/domain/units';
import { useProfile } from '@/data/ProfileProvider';
import { useFormat } from '@/lib/format';
import { applyKey, Keypad, type KeypadKey } from '@/ui/inputs/Keypad';
import {
  Button,
  Chip,
  Divider,
  Icon,
  ListRow,
  SegmentedControl,
  Sheet,
  Switch,
  Text,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';

type Field = 'quantity' | 'unitPrice' | 'discount';

type DocSettings = {
  currency: string;
  pricesIncludeTax: boolean;
  rounding: 'PER_LINE' | 'PER_TOTAL';
  roundingMode: 'HALF_UP' | 'HALF_EVEN';
};

const EMPTY: LineDraft = {
  name: '',
  quantity: QTY_SCALE,
  unitPrice: 0,
  taxes: [],
  unit: null,
};

/**
 * Add or edit one line. Numbers use the in-sheet keypad (with arithmetic);
 * text uses the system keyboard. The line total updates as you type.
 */
export function LineSheet({
  ref,
  line,
  resetKey,
  settings,
  defaultTaxes,
  onSave,
  onDelete,
}: {
  ref?: Ref<SheetRef>;
  line: LineDraft | null;
  /** Changes every time the sheet is opened, so a new item always starts blank. */
  resetKey: number;
  settings: DocSettings;
  defaultTaxes: LineTaxSnapshot[];
  onSave: (line: LineDraft) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { profile } = useProfile();
  const f = useFormat();
  const sep = decimalSeparator(f.locale);
  const digits = currencyDigits(settings.currency);

  const [draft, setDraft] = useState<LineDraft>(
    line ?? { ...EMPTY, taxes: defaultTaxes },
  );
  const [active, setActive] = useState<Field | null>(null);
  const [expr, setExpr] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const isNew = !line;

  useEffect(() => {
    setDraft(line ?? { ...EMPTY, taxes: defaultTaxes });
    setActive(null);
    setExpr('');
    setNameFocused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const { data: catalog } = useLiveQuery(
    db =>
      nameFocused && !draft.itemId
        ? listItems(db, { search: draft.name, limit: 6 })
        : Promise.resolve([] as Item[]),
    [nameFocused, draft.name, draft.itemId],
  );
  const { data: rates } = useLiveQuery(db => listTaxRates(db), []);

  const scaleOf = (field: Field) =>
    field === 'quantity'
      ? 3
      : field === 'unitPrice'
      ? digits
      : draft.discount?.type === 'PERCENT'
      ? 4
      : digits;

  const valueOf = (field: Field): number =>
    field === 'quantity'
      ? draft.quantity
      : field === 'unitPrice'
      ? draft.unitPrice
      : draft.discount?.type === 'PERCENT'
      ? draft.discount.rate
      : draft.discount?.type === 'AMOUNT'
      ? draft.discount.amount
      : 0;

  const activate = (field: Field) => {
    Keyboard.dismiss();
    setActive(field);
    const v = valueOf(field);
    setExpr(v === 0 ? '' : toEditableText(v, scaleOf(field), sep));
  };

  const commit = (field: Field, text: string) => {
    const r = text === '' ? { value: 0 } : evaluate(text, scaleOf(field), sep);
    if (!r) {
      return;
    }
    setDraft(d => {
      if (field === 'quantity') {
        return { ...d, quantity: r.value };
      }
      if (field === 'unitPrice') {
        return { ...d, unitPrice: r.value };
      }
      if (d.discount?.type === 'PERCENT') {
        // Percent typed at 4 decimals is already parts-per-million (12.5 → 125000).
        return {
          ...d,
          discount: {
            type: 'PERCENT',
            rate: Math.min(Math.max(r.value, 0), 1_000_000),
          },
        };
      }
      return { ...d, discount: { type: 'AMOUNT', amount: r.value } };
    });
  };

  const onKey = (key: KeypadKey) => {
    if (!active) {
      return;
    }
    const next = applyKey(expr, key, sep);
    setExpr(next);
    commit(active, next);
  };

  const pickItem = (item: Item) => {
    const snap = (rates ?? [])
      .filter(r => item.taxRateIds.includes(r.id))
      .map(r => ({
        taxRateId: r.id,
        name: r.name,
        rate: r.rate,
        kind: r.kind,
      }));
    setDraft(d => ({
      ...d,
      itemId: item.id,
      name: item.name,
      description: item.description,
      unit: item.unit,
      unitPrice: item.unitPrice,
      taxes: item.taxRateIds.length ? snap : d.taxes,
    }));
    Keyboard.dismiss();
    setNameFocused(false);
    activate('quantity');
  };

  const toggleTax = (rate: TaxRate) => {
    const snap: LineTaxSnapshot = {
      taxRateId: rate.id,
      name: rate.name,
      rate: rate.rate,
      kind: rate.kind,
    };
    setDraft(d => {
      const has = d.taxes.some(x => taxIdentity(x) === taxIdentity(snap));
      return {
        ...d,
        taxes: has
          ? d.taxes.filter(x => taxIdentity(x) !== taxIdentity(snap))
          : [...d.taxes, snap],
      };
    });
  };

  const total = useMemo(() => {
    try {
      return (
        calculateDraft({
          ...settings,
          discount: null,
          lines: [{ ...draft, id: 'x' }],
        }).lines[0]?.total ?? 0
      );
    } catch {
      return 0;
    }
  }, [draft, settings]);

  const units = useMemo(
    () => unitsFor(profile.measurement),
    [profile.measurement],
  );
  const canSave = draft.name.trim().length > 0;

  const save = () => {
    if (!canSave) {
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
    });
  };

  const numberBox = (field: Field, label: string, text: string, flex = 1) => (
    <Touchable
      testID={`line-${field}`}
      feedback="highlight"
      onPress={() => activate(field)}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${text}`}
      style={[styles.box, { flex }, active === field && styles.boxActive]}
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="headline" tabular numberOfLines={1}>
        {active === field ? expr || '0' : text}
        {active === field ? (
          <Text variant="headline" tone="accent">
            ▏
          </Text>
        ) : null}
      </Text>
    </Touchable>
  );

  const qtyText = toEditableText(draft.quantity, 3, sep);
  const discountText =
    draft.discount?.type === 'PERCENT'
      ? `${toEditableText(draft.discount.rate, 4, sep)}%`
      : draft.discount?.type === 'AMOUNT'
      ? f.money(draft.discount.amount, settings.currency)
      : '—';

  return (
    <Sheet
      ref={ref}
      title={isNew ? t('line.addTitle') : t('line.editTitle')}
      snapPoints={['92%']}
      scrollable
      footer={
        <>
          {onDelete ? (
            <Button
              variant="danger"
              label={t('actions.delete')}
              leadingIcon={Trash2}
              onPress={onDelete}
              haptic="warning"
            />
          ) : null}
          <View style={styles.flex}>
            <Button
              testID="line-save"
              variant="primary"
              size="lg"
              fullWidth
              label={
                canSave
                  ? `${t('common.done')} · ${f.money(total, settings.currency)}`
                  : t('common.done')
              }
              leadingIcon={Check}
              disabled={!canSave}
              onPress={save}
            />
          </View>
        </>
      }
    >
      <View style={styles.pad}>
        <BottomSheetTextInput
          testID="line-name"
          value={draft.name}
          onChangeText={name =>
            setDraft(d => ({
              ...d,
              name,
              itemId: d.itemId && name !== d.name ? null : d.itemId,
            }))
          }
          onFocus={() => {
            setActive(null);
            setNameFocused(true);
          }}
          onBlur={() => setNameFocused(false)}
          placeholder={t('line.namePlaceholder')}
          placeholderTextColor={theme.colors.text.tertiary}
          style={styles.nameInput}
          autoFocus={isNew}
          returnKeyType="next"
          onSubmitEditing={() => activate('unitPrice')}
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={t('line.name')}
        />
        <BottomSheetTextInput
          value={draft.description ?? ''}
          onChangeText={description => setDraft(d => ({ ...d, description }))}
          onFocus={() => setActive(null)}
          placeholder={t('line.descriptionPlaceholder')}
          placeholderTextColor={theme.colors.text.tertiary}
          style={styles.descInput}
          multiline
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={t('line.description')}
        />
      </View>

      {catalog && catalog.length > 0 && nameFocused ? (
        <View style={styles.suggestions}>
          {catalog.map(item => (
            <ListRow
              key={item.id}
              leadingIcon={Package}
              title={item.name}
              subtitle={unitLabel(t, item.unit) || undefined}
              value={f.money(item.unitPrice, settings.currency)}
              onPress={() => pickItem(item)}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.pad, styles.row]}>
        {numberBox('quantity', t('line.quantity'), qtyText)}
        <Text variant="headline" tone="tertiary">
          ×
        </Text>
        {numberBox(
          'unitPrice',
          t('line.unitPrice'),
          f.money(draft.unitPrice, settings.currency),
          1.6,
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {draft.unit && !isKnownUnit(draft.unit) ? (
          <Chip label={draft.unit} selected />
        ) : null}
        {units.map(u => (
          <Chip
            key={u.key}
            label={unitLabel(t, u.key)}
            selected={draft.unit === u.key}
            onPress={() =>
              setDraft(d => ({ ...d, unit: d.unit === u.key ? null : u.key }))
            }
          />
        ))}
      </ScrollView>

      {active ? (
        <Keypad
          onKey={onKey}
          decimalSeparator={sep}
          allowDecimal={!(active !== 'quantity' && scaleOf(active) === 0)}
        />
      ) : null}

      {rates && rates.length > 0 ? (
        <>
          <Text variant="overline" tone="tertiary" style={styles.section}>
            {t('line.taxes')}
          </Text>
          <View style={[styles.pad, styles.wrap]}>
            {rates.map(r => (
              <Chip
                key={r.id}
                label={`${r.name} ${rateToPercent(r.rate)}%${
                  r.kind === 'WITHHOLDING' ? ' −' : ''
                }`}
                selected={draft.taxes.some(x => x.taxRateId === r.id)}
                onPress={() => toggleTax(r)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text variant="overline" tone="tertiary" style={styles.section}>
        {t('line.discount')}
      </Text>
      <View style={[styles.pad, styles.stack]}>
        <SegmentedControl<'NONE' | 'PERCENT' | 'AMOUNT'>
          value={draft.discount?.type ?? 'NONE'}
          onChange={type => {
            setDraft(d => ({
              ...d,
              discount:
                type === 'NONE'
                  ? null
                  : type === 'PERCENT'
                  ? { type, rate: 0 }
                  : { type, amount: 0 },
            }));
            if (type === 'NONE') {
              setActive(a => (a === 'discount' ? null : a));
            } else {
              setTimeout(() => activate('discount'), 0);
            }
          }}
          segments={[
            { value: 'NONE', label: t('line.noDiscount') },
            { value: 'PERCENT', label: '%' },
            { value: 'AMOUNT', label: t('line.amount') },
          ]}
        />
        {draft.discount
          ? numberBox('discount', t('line.discount'), discountText)
          : null}
      </View>

      {!draft.itemId ? (
        <>
          <Divider />
          <ListRow
            title={t('line.saveToCatalog')}
            subtitle={t('line.saveToCatalogHint')}
            onPress={() =>
              setDraft(d => ({ ...d, saveToCatalog: !d.saveToCatalog }))
            }
            trailing={
              <Switch
                value={!!draft.saveToCatalog}
                onValueChange={v => setDraft(d => ({ ...d, saveToCatalog: v }))}
                accessibilityLabel={t('line.saveToCatalog')}
              />
            }
          />
        </>
      ) : (
        <View style={[styles.pad, styles.linked]}>
          <Icon icon={Package} size={14} tone="tertiary" />
          <Text variant="caption" tone="tertiary">
            {t('line.fromCatalog')}
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: theme.size.gutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    marginTop: theme.space[3],
  },
  stack: {
    gap: theme.space[2],
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  nameInput: {
    ...theme.type.title2,
    color: theme.colors.text.primary,
    paddingVertical: theme.space[1],
    includeFontPadding: false,
  },
  descInput: {
    ...theme.type.callout,
    color: theme.colors.text.secondary,
    paddingVertical: theme.space[1],
    maxHeight: 120,
  },
  suggestions: {
    marginTop: theme.space[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
  },
  box: {
    minHeight: 60,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
  boxActive: {
    borderColor: theme.colors.border.focus,
    outlineWidth: 3,
    outlineColor: theme.colors.accent.subtlePressed,
    outlineStyle: 'solid',
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[3],
  },
  section: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[5],
    paddingBottom: theme.space[2],
  },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
    paddingTop: theme.space[4],
  },
}));
