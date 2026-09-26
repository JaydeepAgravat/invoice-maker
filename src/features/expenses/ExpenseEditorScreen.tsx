import { CalendarDays, Camera, Images, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate, useLiveQuery } from '@/data/live';
import {
  createExpense,
  deleteExpense,
  getExpense,
  recentVendors,
  restoreExpense,
  updateExpense,
} from '@/data/repositories/expenses';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/domain/expenses';
import { toEditableText } from '@/domain/expression';
import {
  currencyDigits,
  decimalSeparator,
  formatMoney,
  parseMoney,
} from '@/domain/money';
import { useFormat } from '@/lib/format';
import NativeMedia from '@/specs/NativeMedia';
import { CalendarSheet } from '@/ui/inputs/CalendarSheet';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  Chip,
  Divider,
  IconButton,
  ListRow,
  SectionHeader,
  Surface,
  Text,
  TextField,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

const RECEIPT = { maxSize: 1600, format: 'jpeg', folder: 'receipts' };

/** Log money out in seconds: amount first, then a tap for the category. */
export function ExpenseEditorScreen({
  navigation,
  route,
}: RootScreenProps<'ExpenseEditor'>) {
  const id = route.params?.id;
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const today = clock.today();
  const currency = f.currency;
  const sep = decimalSeparator(f.locale);
  const digits = currencyDigits(currency);

  const [amountText, setAmountText] = useState('');
  const [taxText, setTaxText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('MATERIALS');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenseCurrency, setExpenseCurrency] = useState(currency);
  const dateSheet = useRef<SheetRef>(null);
  const original = useRef<string | null>(null);
  const { data: vendors } = useLiveQuery(db => recentVendors(db), []);

  useEffect(() => {
    if (!id) {
      return;
    }
    getDatabase().then(async db => {
      const e = await getExpense(db, id);
      if (e) {
        const d = currencyDigits(e.currency);
        setAmountText(toEditableText(e.amount, d, sep));
        setTaxText(e.tax ? toEditableText(e.tax, d, sep) : '');
        setCategory(e.category as ExpenseCategory);
        setVendor(e.vendor ?? '');
        setDate(e.date);
        setNote(e.note ?? '');
        setReceipt(e.receiptPath);
        setExpenseCurrency(e.currency);
        original.current = e.receiptPath;
      }
    });
  }, [id, sep]);

  const attach = async (source: 'camera' | 'library') => {
    try {
      const file =
        source === 'camera'
          ? await NativeMedia?.takePhoto(RECEIPT)
          : await NativeMedia?.pickImage(RECEIPT);
      if (file) {
        if (receipt && receipt !== original.current) {
          NativeMedia?.deleteFile(receipt);
        }
        setReceipt(file.path);
      }
    } catch {
      toast.show({ message: t('expenses.photoFailed'), tone: 'danger' });
    }
  };

  const save = async () => {
    const amount = parseMoney(amountText, expenseCurrency, f.locale);
    const tax = taxText.trim() ? parseMoney(taxText, expenseCurrency, f.locale) : 0;
    if (!amount || amount <= 0) {
      setError(t('expenses.amountRequired'));
      return;
    }
    if (tax === null || tax < 0 || tax > amount) {
      setError(t('expenses.taxInvalid'));
      return;
    }
    const input = {
      date,
      vendor,
      category,
      amount,
      tax,
      currency: expenseCurrency,
      clientId: null,
      note,
      receiptPath: receipt,
    };
    await mutate(tx =>
      id ? updateExpense(tx, clock, id, input) : createExpense(tx, clock, input),
    );
    if (original.current && original.current !== receipt) {
      NativeMedia?.deleteFile(original.current);
    }
    toast.show({ message: t('expenses.saved'), tone: 'success' });
    navigation.goBack();
  };

  const symbol =
    formatMoney(0, { locale: f.locale, currency: expenseCurrency })
      .replace(/[\d\s.,  ]/g, '') || expenseCurrency;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={id ? t('expenses.edit') : t('expenses.new')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="expense-save"
            variant="primary"
            size="sm"
            label={t('common.save')}
            onPress={save}
          />
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
      >
        <View style={styles.amount}>
          <Text variant="title1" tone="tertiary">
            {symbol}
          </Text>
          <TextInput
            testID="expense-amount"
            value={amountText}
            onChangeText={v => {
              setAmountText(v.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            placeholder={toEditableText(0, digits, sep) || '0'}
            placeholderTextColor={theme.colors.text.disabled}
            keyboardType="decimal-pad"
            autoFocus={!id}
            style={[styles.amountInput, { color: theme.colors.text.primary }]}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel={t('expenses.amount')}
          />
        </View>
        {error ? (
          <Text variant="caption" tone="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <SectionHeader title={t('expenses.category')} />
        <View style={styles.chips}>
          {EXPENSE_CATEGORIES.map(c => (
            <Chip
              key={c}
              label={t(`expenseCategory.${c}`)}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>

        <View style={styles.fields}>
          <TextField
            testID="expense-vendor"
            label={t('expenses.vendor')}
            value={vendor}
            onChangeText={setVendor}
            autoCapitalize="words"
            placeholder={t('expenses.vendorPlaceholder')}
          />
          {vendors?.length && !vendor ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.recent}
            >
              {vendors.map(v => (
                <Chip key={v} label={v} onPress={() => setVendor(v)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <Surface style={styles.card}>
          <ListRow
            leadingIcon={CalendarDays}
            title={t('expenses.date')}
            value={f.date(date)}
            onPress={() => dateSheet.current?.present()}
          />
        </Surface>

        <View style={[styles.fields, styles.top]}>
          <TextField
            label={t('expenses.tax')}
            hint={t('expenses.taxHint')}
            value={taxText}
            onChangeText={v => {
              setTaxText(v.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('expenses.note')}
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
          />
        </View>

        <SectionHeader title={t('expenses.receipt')} />
        {receipt ? (
          <View style={styles.receiptRow}>
            <Touchable
              feedback="scale"
              onPress={() => attach('library')}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('expenses.changeReceipt')}
            >
              <Image
                source={{ uri: `file://${receipt}` }}
                style={styles.receipt}
                resizeMode="cover"
              />
            </Touchable>
            <View style={styles.receiptActions}>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={Camera}
                label={t('expenses.retake')}
                onPress={() => attach('camera')}
              />
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={Trash2}
                label={t('actions.remove')}
                onPress={() => setReceipt(null)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.attach}>
            <View style={styles.flex}>
              <Button
                testID="expense-camera"
                variant="secondary"
                fullWidth
                leadingIcon={Camera}
                label={t('expenses.takePhoto')}
                onPress={() => attach('camera')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                variant="secondary"
                fullWidth
                leadingIcon={Images}
                label={t('expenses.choosePhoto')}
                onPress={() => attach('library')}
              />
            </View>
          </View>
        )}

        {id ? (
          <View style={styles.danger}>
            <Divider />
            <ListRow
              leadingIcon={Trash2}
              title={t('expenses.delete')}
              destructive
              onPress={async () => {
                await mutate(tx => deleteExpense(tx, clock, id));
                toast.show({
                  message: t('expenses.deleted'),
                  action: {
                    label: t('common.undo'),
                    onPress: () => mutate(tx => restoreExpense(tx, id)),
                  },
                });
                navigation.goBack();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <CalendarSheet
        ref={dateSheet}
        title={t('expenses.date')}
        value={date}
        today={today}
        locale={f.locale}
        quickPicks={[{ label: t('dates.today'), date: today }]}
        onChange={d => {
          setDate(d);
          dateSheet.current?.dismiss();
        }}
      />
    </KeyboardAvoidingView>
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
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[1],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[2],
  },
  amountInput: {
    ...theme.type.display,
    fontSize: 44,
    lineHeight: undefined,
    minWidth: 80,
    paddingVertical: 0,
    textAlign: 'center',
  },
  error: {
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  fields: {
    gap: theme.space[3],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[6],
    paddingBottom: theme.space[4],
  },
  recent: {
    gap: theme.space[2],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  top: {
    paddingTop: theme.space[4],
  },
  attach: {
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
  },
  receiptRow: {
    flexDirection: 'row',
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
    alignItems: 'center',
  },
  receipt: {
    width: 96,
    height: 128,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.subtle,
  },
  receiptActions: {
    gap: theme.space[2],
    alignItems: 'flex-start',
  },
  danger: {
    marginTop: theme.space[8],
  },
}));
