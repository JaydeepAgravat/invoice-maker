import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { addDays, type ISODate } from '@/domain/dates';
import { evaluate, toEditableText } from '@/domain/expression';
import { currencyDigits, decimalSeparator } from '@/domain/money';
import { useFormat } from '@/lib/format';
import { applyKey, Keypad } from '@/ui/inputs/Keypad';
import { Button, Chip, Sheet, Text, type SheetRef } from '@/ui/primitives';

export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CARD',
  'CASH',
  'CHEQUE',
  'PAYPAL',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentInput = {
  amount: number;
  paidOn: ISODate;
  method: PaymentMethod;
  note: string | null;
};

/**
 * Record money received. Defaults to the full balance, today, bank transfer:
 * the common case is one tap. Partial amounts and other dates are one step away.
 */
export function RecordPaymentSheet({
  ref,
  balance,
  currency,
  today,
  onSave,
}: {
  ref?: Ref<SheetRef>;
  balance: number;
  currency: string;
  today: ISODate;
  onSave: (p: PaymentInput) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const sep = decimalSeparator(f.locale);
  const digits = currencyDigits(currency);
  const [expr, setExpr] = useState(toEditableText(balance, digits, sep));
  const [paidOn, setPaidOn] = useState<ISODate>(today);
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [note, setNote] = useState('');

  useEffect(() => {
    setExpr(toEditableText(balance, digits, sep));
    setPaidOn(today);
  }, [balance, digits, sep, today]);

  const parsed = evaluate(expr || '0', digits, sep);
  const amount = parsed?.value ?? 0;
  const valid = amount > 0;
  const over = amount > balance;

  const dates: Array<[string, ISODate]> = [
    [t('dates.today'), today],
    [t('dates.yesterday'), addDays(today, -1)],
    [t('dates.daysAgo', { count: 7 }), addDays(today, -7)],
  ];

  return (
    <Sheet
      ref={ref}
      title={t('payment.title')}
      snapPoints={['90%']}
      scrollable
      footer={
        <View style={styles.flex}>
          <Button
            testID="payment-save"
            variant="primary"
            size="lg"
            fullWidth
            haptic="success"
            disabled={!valid}
            label={
              valid
                ? t('payment.save', { amount: f.money(amount, currency) })
                : t('payment.enterAmount')
            }
            onPress={() =>
              onSave({ amount, paidOn, method, note: note.trim() || null })
            }
          />
        </View>
      }
    >
      <View style={styles.display}>
        <Text variant="display" tabular numberOfLines={1} adjustsFontSizeToFit>
          {parsed?.isExpression ? expr : f.money(amount, currency)}
        </Text>
        {parsed?.isExpression ? (
          <Text variant="headline" tone="accent" tabular>
            = {f.money(amount, currency)}
          </Text>
        ) : null}
        <Text variant="caption" tone={over ? 'danger' : 'secondary'} tabular>
          {over
            ? t('payment.overBalance', { balance: f.money(balance, currency) })
            : t('payment.balance', { balance: f.money(balance, currency) })}
        </Text>
      </View>
      <View style={styles.quick}>
        <Chip
          label={t('payment.fullBalance')}
          selected={amount === balance}
          onPress={() => setExpr(toEditableText(balance, digits, sep))}
        />
        <Chip
          label={t('payment.half')}
          selected={amount === Math.round(balance / 2)}
          onPress={() =>
            setExpr(toEditableText(Math.round(balance / 2), digits, sep))
          }
        />
      </View>
      <Keypad
        decimalSeparator={sep}
        allowDecimal={digits > 0}
        onKey={k => setExpr(e => applyKey(e, k, sep))}
      />

      <Text variant="overline" tone="tertiary" style={styles.section}>
        {t('payment.date')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {dates.map(([label, d]) => (
          <Chip
            key={d}
            label={`${label} · ${f.date(d, 'short')}`}
            selected={paidOn === d}
            onPress={() => setPaidOn(d)}
          />
        ))}
      </ScrollView>

      <Text variant="overline" tone="tertiary" style={styles.section}>
        {t('payment.method')}
      </Text>
      <View style={styles.wrap}>
        {PAYMENT_METHODS.map(m => (
          <Chip
            key={m}
            label={t(`paymentMethod.${m}`)}
            selected={method === m}
            onPress={() => setMethod(m)}
          />
        ))}
      </View>

      <BottomSheetTextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('payment.notePlaceholder')}
        placeholderTextColor={theme.colors.text.tertiary}
        style={styles.note}
        maxFontSizeMultiplier={1.6}
        accessibilityLabel={t('payment.notePlaceholder')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create(theme => ({
  flex: {
    flex: 1,
  },
  display: {
    alignItems: 'center',
    gap: theme.space[1],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[2],
  },
  quick: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.space[2],
  },
  section: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[5],
    paddingBottom: theme.space[2],
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  note: {
    ...theme.type.body,
    lineHeight: undefined,
    color: theme.colors.text.primary,
    margin: theme.size.gutter,
    marginTop: theme.space[5],
    padding: theme.space[3],
    borderRadius: theme.radius.md,
    borderWidth: theme.stroke.thin,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.bg.surface,
  },
}));
