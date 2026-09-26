import { Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { unitLabel } from '@/features/documents/statusMeta';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate, useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import {
  createItem,
  deleteItem,
  getItem,
  restoreItem,
  updateItem,
  type ItemInput,
} from '@/data/repositories/items';
import { listTaxRates } from '@/data/repositories/taxRates';
import { toEditableText } from '@/domain/expression';
import {
  currencyDigits,
  decimalSeparator,
  parseMoney,
  rateToPercent,
} from '@/domain/money';
import { unitsFor } from '@/domain/units';
import { useFormat } from '@/lib/format';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  Chip,
  ConfirmSheet,
  Divider,
  IconButton,
  ListRow,
  Text,
  TextField,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

export function ItemEditorScreen({
  navigation,
  route,
}: RootScreenProps<'ItemEditor'>) {
  const id = route.params?.id;
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const sep = decimalSeparator(f.locale);
  const [form, setForm] = useState<ItemInput>({
    name: '',
    description: null,
    unit: null,
    unitPrice: 0,
    sku: null,
    taxRateIds: [],
  });
  const [priceText, setPriceText] = useState('');
  const [error, setError] = useState<{ name?: string; price?: string }>({});
  const deleteSheet = useRef<SheetRef>(null);
  const { data: rates } = useLiveQuery(db => listTaxRates(db), []);

  useEffect(() => {
    if (!id) {
      return;
    }
    getDatabase().then(async db => {
      const item = await getItem(db, id);
      if (item) {
        setForm(item);
        setPriceText(
          toEditableText(item.unitPrice, currencyDigits(profile.currency), sep),
        );
      }
    });
  }, [id, profile.currency, sep]);

  const save = async () => {
    const price =
      priceText.trim() === ''
        ? 0
        : parseMoney(priceText, profile.currency, f.locale);
    const errors = {
      name: form.name.trim() ? undefined : t('items.nameRequired'),
      price: price === null ? t('items.invalidPrice') : undefined,
    };
    setError(errors);
    if (errors.name || errors.price) {
      return;
    }
    const input = { ...form, unitPrice: price! };
    await mutate(tx =>
      id ? updateItem(tx, clock, id, input) : createItem(tx, clock, input),
    );
    toast.show({ message: t('toast.itemSaved'), tone: 'success' });
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={id ? t('items.edit') : t('items.new')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="item-save"
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
        <View style={styles.fields}>
          <TextField
            label={t('line.name')}
            value={form.name}
            onChangeText={name => setForm(p => ({ ...p, name }))}
            autoFocus={!id}
            error={error.name}
            placeholder={t('line.namePlaceholder')}
          />
          <TextField
            label={t('line.description')}
            value={form.description ?? ''}
            onChangeText={description =>
              setForm(p => ({ ...p, description: description || null }))
            }
            multiline
            textAlignVertical="top"
          />
          <TextField
            label={t('line.unitPrice')}
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            tabular
            error={error.price}
            placeholder={
              toEditableText(0, currencyDigits(profile.currency), sep) || '0'
            }
            suffix={<Text tone="tertiary">{profile.currency}</Text>}
          />
          <TextField
            label={t('items.sku')}
            value={form.sku ?? ''}
            onChangeText={sku => setForm(p => ({ ...p, sku: sku || null }))}
            autoCapitalize="characters"
          />
        </View>

        <Text variant="label" tone="secondary" style={styles.label}>
          {t('line.unit')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {unitsFor(profile.measurement).map(u => (
            <Chip
              key={u.key}
              label={unitLabel(t, u.key)}
              selected={form.unit === u.key}
              onPress={() =>
                setForm(p => ({ ...p, unit: p.unit === u.key ? null : u.key }))
              }
            />
          ))}
        </ScrollView>

        {rates?.length ? (
          <>
            <Text variant="label" tone="secondary" style={styles.label}>
              {t('line.taxes')}
            </Text>
            <View style={styles.wrap}>
              {rates.map(r => (
                <Chip
                  key={r.id}
                  label={`${r.name} ${rateToPercent(r.rate)}%`}
                  selected={form.taxRateIds.includes(r.id)}
                  onPress={() =>
                    setForm(p => ({
                      ...p,
                      taxRateIds: p.taxRateIds.includes(r.id)
                        ? p.taxRateIds.filter(x => x !== r.id)
                        : [...p.taxRateIds, r.id],
                    }))
                  }
                />
              ))}
            </View>
          </>
        ) : null}

        {id ? (
          <View style={styles.danger}>
            <Divider />
            <ListRow
              leadingIcon={Trash2}
              title={t('items.delete')}
              destructive
              onPress={() => deleteSheet.current?.present()}
            />
          </View>
        ) : null}
      </ScrollView>
      <ConfirmSheet
        ref={deleteSheet}
        title={t('items.deleteTitle', { name: form.name })}
        body={t('items.deleteBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={async () => {
          await mutate(tx => deleteItem(tx, clock, id!));
          toast.show({
            message: t('toast.itemsDeleted', { count: 1 }),
            action: {
              label: t('common.undo'),
              onPress: () => mutate(tx => restoreItem(tx, id!)),
            },
          });
          navigation.goBack();
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
  content: {
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  fields: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
  },
  label: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[5],
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[2],
  },
  danger: {
    marginTop: theme.space[8],
  },
}));
