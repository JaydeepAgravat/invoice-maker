import { Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethod,
  restorePaymentMethod,
  updatePaymentMethod,
} from '@/data/repositories/paymentMethods';
import {
  fieldsFor,
  isValidBic,
  isValidIban,
  kindsFor,
  type PaymentField,
  type PaymentFields,
  type PaymentKind,
} from '@/domain/payments';
import { pdfLabels } from '@/pdf/labels';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  Chip,
  Divider,
  IconButton,
  ListRow,
  Surface,
  Switch,
  TextField,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

const KEYBOARD: Partial<Record<PaymentField, 'number-pad' | 'email-address' | 'url'>> = {
  accountNumber: 'number-pad',
  routingNumber: 'number-pad',
  sortCode: 'number-pad',
  bsb: 'number-pad',
  institution: 'number-pad',
  transit: 'number-pad',
  clabe: 'number-pad',
  agency: 'number-pad',
  email: 'email-address',
  url: 'url',
};

export function PaymentMethodEditorScreen({
  navigation,
  route,
}: RootScreenProps<'PaymentMethodEditor'>) {
  const id = route.params?.id;
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const L = pdfLabels(i18n.language, profile.country);
  const kinds = kindsFor(profile.country);

  const [kind, setKind] = useState<PaymentKind>(kinds[0]!);
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<PaymentFields>({
    accountName: profile.legalName ?? profile.name ?? '',
  });
  const [showQr, setShowQr] = useState(true);
  const [isDefault, setIsDefault] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>({});

  useEffect(() => {
    if (!id) {
      return;
    }
    getDatabase().then(async db => {
      const m = await getPaymentMethod(db, id);
      if (m) {
        setKind(m.kind);
        setLabel(m.label ?? '');
        setFields(m.fields);
        setShowQr(m.showQr);
        setIsDefault(m.isDefault);
      }
    });
  }, [id]);

  const visible = fieldsFor(kind, profile.country);

  const validate = () => {
    const next: typeof errors = {};
    if (fields.iban && visible.includes('iban') && !isValidIban(fields.iban)) {
      next.iban = t('paymentDetails.ibanInvalid');
    }
    if (fields.bic && visible.includes('bic') && !isValidBic(fields.bic)) {
      next.bic = t('paymentDetails.bicInvalid');
    }
    if (
      fields.url &&
      visible.includes('url') &&
      !/^https?:\/\/\S+\.\S+/i.test(fields.url.trim())
    ) {
      next.url = t('paymentDetails.urlInvalid');
    }
    const filled = visible.some(f => fields[f]?.trim());
    if (!filled) {
      next[visible[0]!] = t('paymentDetails.required');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      return;
    }
    // Only keep the fields that belong to the chosen kind.
    const kept: PaymentFields = Object.fromEntries(
      visible.map(f => [f, fields[f]]),
    );
    const input = { kind, label, fields: kept, showQr, isDefault };
    await mutate(tx =>
      id
        ? updatePaymentMethod(tx, clock, id, input)
        : createPaymentMethod(tx, clock, input),
    );
    toast.show({ message: t('paymentDetails.saved'), tone: 'success' });
    navigation.goBack();
  };

  const qrHint =
    kind === 'BANK'
      ? t('paymentDetails.qrBank')
      : kind === 'PIX'
      ? t('paymentDetails.qrPix')
      : t('paymentDetails.qrLink');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={id ? t('paymentDetails.edit') : t('paymentDetails.add')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="payment-method-save"
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {kinds.map(k => (
            <Chip
              key={k}
              label={L.kind[k]}
              selected={kind === k}
              onPress={() => {
                setKind(k);
                setErrors({});
              }}
            />
          ))}
        </ScrollView>

        <View style={styles.fields}>
          {visible.map(f => (
            <TextField
              key={`${kind}-${f}`}
              testID={`payment-field-${f}`}
              label={L.field[f]}
              value={fields[f] ?? ''}
              onChangeText={v => {
                setFields(prev => ({ ...prev, [f]: v }));
                if (errors[f]) {
                  setErrors(e => ({ ...e, [f]: undefined }));
                }
              }}
              keyboardType={KEYBOARD[f]}
              autoCapitalize={
                f === 'iban' || f === 'bic'
                  ? 'characters'
                  : f === 'accountName' || f === 'bankName' || f === 'merchantCity'
                  ? 'words'
                  : 'none'
              }
              autoCorrect={false}
              multiline={f === 'instructions'}
              textAlignVertical={f === 'instructions' ? 'top' : undefined}
              error={errors[f]}
            />
          ))}
          <TextField
            label={t('paymentDetails.label')}
            hint={t('paymentDetails.labelHint')}
            value={label}
            placeholder={L.kind[kind]}
            onChangeText={setLabel}
          />
        </View>

        <Surface style={styles.card}>
          {kind !== 'OTHER' ? (
            <>
              <ListRow
                title={t('paymentDetails.showQr')}
                subtitle={qrHint}
                onPress={() => setShowQr(!showQr)}
                trailing={
                  <Switch
                    value={showQr}
                    onValueChange={setShowQr}
                    accessibilityLabel={t('paymentDetails.showQr')}
                  />
                }
              />
              <Divider inset={16} />
            </>
          ) : null}
          <ListRow
            title={t('paymentDetails.default')}
            subtitle={t('paymentDetails.defaultHint')}
            onPress={() => setIsDefault(!isDefault)}
            trailing={
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                accessibilityLabel={t('paymentDetails.default')}
              />
            }
          />
        </Surface>

        {id ? (
          <View style={styles.danger}>
            <Divider />
            <ListRow
              leadingIcon={Trash2}
              title={t('paymentDetails.delete')}
              destructive
              onPress={async () => {
                await mutate(tx => deletePaymentMethod(tx, clock, id));
                toast.show({
                  message: t('paymentDetails.deleted'),
                  action: {
                    label: t('common.undo'),
                    onPress: () => mutate(tx => restorePaymentMethod(tx, id)),
                  },
                });
                navigation.goBack();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
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
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[4],
  },
  fields: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[6],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  danger: {
    marginTop: theme.space[8],
  },
}));
