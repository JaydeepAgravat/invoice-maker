import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { Discount } from '@/domain/calc';
import { evaluate, toEditableText } from '@/domain/expression';
import { currencyDigits, decimalSeparator } from '@/domain/money';
import { useFormat } from '@/lib/format';
import { applyKey, Keypad, type KeypadKey } from '@/ui/inputs/Keypad';
import {
  Button,
  SegmentedControl,
  Sheet,
  Text,
  type SheetRef,
} from '@/ui/primitives';

type Mode = 'NONE' | 'PERCENT' | 'AMOUNT';

/** Whole-document discount: a percentage or a fixed amount, applied before tax. */
export function DiscountSheet({
  ref,
  value,
  currency,
  subtotal,
  onSave,
}: {
  ref?: Ref<SheetRef>;
  value: Discount | null;
  currency: string;
  subtotal: number;
  onSave: (d: Discount | null) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const sep = decimalSeparator(f.locale);
  const digits = currencyDigits(currency);
  const [mode, setMode] = useState<Mode>(value?.type ?? 'NONE');
  const [expr, setExpr] = useState('');

  useEffect(() => {
    setMode(value?.type ?? 'NONE');
    setExpr(
      value?.type === 'PERCENT'
        ? toEditableText(value.rate, 4, sep)
        : value?.type === 'AMOUNT'
        ? toEditableText(value.amount, digits, sep)
        : '',
    );
  }, [value, sep, digits]);

  const parsed =
    mode === 'NONE'
      ? null
      : evaluate(expr || '0', mode === 'PERCENT' ? 4 : digits, sep);
  const discount: Discount | null =
    mode === 'NONE' || !parsed || parsed.value <= 0
      ? null
      : mode === 'PERCENT'
      ? { type: 'PERCENT', rate: Math.min(parsed.value, 1_000_000) }
      : { type: 'AMOUNT', amount: parsed.value };
  const preview =
    discount?.type === 'PERCENT'
      ? Math.round((subtotal * discount.rate) / 1_000_000)
      : discount?.type === 'AMOUNT'
      ? Math.min(discount.amount, subtotal)
      : 0;

  return (
    <Sheet
      ref={ref}
      title={t('document.discount')}
      headerRight={
        <Button
          variant="primary"
          size="sm"
          label={t('common.done')}
          onPress={() => {
            onSave(discount);
            if (ref && typeof ref === 'object' && ref.current) {
              ref.current.dismiss();
            }
          }}
        />
      }
    >
      <View style={styles.pad}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={m => {
            setMode(m);
            setExpr('');
          }}
          segments={[
            { value: 'NONE', label: t('line.noDiscount') },
            { value: 'PERCENT', label: '%' },
            { value: 'AMOUNT', label: t('line.amount') },
          ]}
        />
        {mode !== 'NONE' ? (
          <View style={styles.display}>
            <Text
              variant="display"
              tabular
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {mode === 'PERCENT' ? `${expr || '0'}%` : expr || '0'}
            </Text>
            <Text variant="callout" tone="secondary" tabular>
              −{f.money(preview, currency)}
            </Text>
          </View>
        ) : null}
      </View>
      {mode !== 'NONE' ? (
        <Keypad
          decimalSeparator={sep}
          allowDecimal={mode === 'PERCENT' || digits > 0}
          onKey={(k: KeypadKey) => setExpr(e => applyKey(e, k, sep))}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  pad: {
    paddingHorizontal: theme.size.gutter,
    gap: theme.space[4],
  },
  display: {
    alignItems: 'center',
    gap: theme.space[1],
    paddingVertical: theme.space[2],
  },
}));
