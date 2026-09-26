import { usePreventRemove } from '@react-navigation/native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, getDatabase } from '@/data/database';
import { mutate } from '@/data/live';
import {
  createClient,
  deleteClient,
  getClient,
  restoreClient,
  updateClient,
  type ClientInput,
} from '@/data/repositories/clients';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { CurrencySheet } from '@/features/editor/CurrencySheet';
import { LANGUAGE_NAMES } from '@/features/onboarding/OnboardingScreen';
import { useFormat } from '@/lib/format';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  Chip,
  ConfirmSheet,
  Divider,
  IconButton,
  ListRow,
  SectionHeader,
  Surface,
  Switch,
  Text,
  TextField,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

const EMPTY: ClientInput = { name: '', emails: [''], isBusiness: false };
const TERMS = [null, 0, 7, 14, 30, 60] as const;

export function ClientEditorScreen({
  navigation,
  route,
}: RootScreenProps<'ClientEditor'>) {
  const id = route.params?.id;
  const { t } = useTranslation();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ClientInput>({
    ...EMPTY,
    name: route.params?.name ?? '',
  });
  const [dirty, setDirty] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discardSheet = useRef<SheetRef>(null);
  const deleteSheet = useRef<SheetRef>(null);
  const currencySheet = useRef<SheetRef>(null);
  const pending = useRef<(() => void) | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    getDatabase().then(async db => {
      const c = await getClient(db, id);
      if (c) {
        setForm({ ...c, emails: c.emails.length ? c.emails : [''] });
        setShowShipping(!!c.shippingAddress);
      }
    });
  }, [id]);

  usePreventRemove(dirty && !done.current, ({ data }) => {
    pending.current = () => navigation.dispatch(data.action);
    discardSheet.current?.present();
  });

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    if (key === 'name') {
      setError(null);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError(t('client.nameRequired'));
      return;
    }
    const input = {
      ...form,
      emails: (form.emails ?? []).filter(e => e.trim()),
    };
    const saved = await mutate(tx =>
      id ? updateClient(tx, clock, id, input) : createClient(tx, clock, input),
    );
    done.current = true;
    toast.show({
      message: id
        ? t('toast.clientSaved')
        : t('toast.clientCreated', { name: saved.name }),
      tone: 'success',
    });
    if (id) {
      navigation.goBack();
    } else {
      navigation.replace('ClientDetail', { id: saved.id });
    }
  };

  const emails = form.emails ?? [''];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={id ? t('client.edit') : t('client.new')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="client-save"
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
            testID="client-name"
            label={t('client.name')}
            value={form.name}
            onChangeText={v => set('name', v)}
            autoFocus={!id}
            autoCapitalize="words"
            error={error ?? undefined}
            placeholder={t('client.namePlaceholder')}
          />
          <TextField
            label={t('client.company')}
            value={form.company ?? ''}
            onChangeText={v => set('company', v)}
            autoCapitalize="words"
          />
        </View>

        <Surface style={styles.card}>
          <ListRow
            title={t('client.isBusiness')}
            subtitle={t('client.isBusinessHint')}
            onPress={() => set('isBusiness', !form.isBusiness)}
            trailing={
              <Switch
                value={!!form.isBusiness}
                onValueChange={v => set('isBusiness', v)}
                accessibilityLabel={t('client.isBusiness')}
              />
            }
          />
        </Surface>

        <SectionHeader title={t('client.contact')} />
        <View style={styles.fields}>
          {emails.map((email, i) => (
            <View key={i} style={styles.emailRow}>
              <View style={styles.flex}>
                <TextField
                  label={i === 0 ? t('client.email') : undefined}
                  value={email}
                  onChangeText={v =>
                    set(
                      'emails',
                      emails.map((e, j) => (j === i ? v : e)),
                    )
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="name@example.com"
                />
              </View>
              {emails.length > 1 ? (
                <IconButton
                  icon={X}
                  size="sm"
                  label={t('actions.remove')}
                  onPress={() =>
                    set(
                      'emails',
                      emails.filter((_, j) => j !== i),
                    )
                  }
                />
              ) : null}
            </View>
          ))}
          <View style={styles.addEmail}>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={Plus}
              label={t('client.addEmail')}
              onPress={() => set('emails', [...emails, ''])}
            />
          </View>
          <TextField
            label={t('client.phone')}
            value={form.phone ?? ''}
            onChangeText={v => set('phone', v)}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('client.taxId')}
            value={form.taxId ?? ''}
            onChangeText={v => set('taxId', v)}
            autoCapitalize="characters"
          />
          <TextField
            label={t('client.billingAddress')}
            value={form.billingAddress ?? ''}
            onChangeText={v => set('billingAddress', v)}
            multiline
            textAlignVertical="top"
          />
          {showShipping ? (
            <TextField
              label={t('client.shippingAddress')}
              value={form.shippingAddress ?? ''}
              onChangeText={v => set('shippingAddress', v)}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.addEmail}>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={Plus}
                label={t('client.addShipping')}
                onPress={() => setShowShipping(true)}
              />
            </View>
          )}
        </View>

        <SectionHeader title={t('client.defaults')} />
        <Text variant="caption" tone="tertiary" style={styles.hint}>
          {t('client.defaultsHint')}
        </Text>
        <Text variant="label" tone="secondary" style={styles.label}>
          {t('client.documentLanguage')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('client.businessDefault')}
            selected={!form.language}
            onPress={() => set('language', null)}
          />
          {SUPPORTED_LANGUAGES.map(l => (
            <Chip
              key={l}
              label={LANGUAGE_NAMES[l]}
              selected={form.language === l}
              onPress={() => set('language', l)}
            />
          ))}
        </ScrollView>
        <Text variant="label" tone="secondary" style={styles.label}>
          {t('client.paymentTerms')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {TERMS.map(n => (
            <Chip
              key={String(n)}
              label={
                n === null
                  ? t('client.businessDefault')
                  : n === 0
                  ? t('terms.onReceipt')
                  : t('terms.netDays', { count: n })
              }
              selected={(form.defaultTermsDays ?? null) === n}
              onPress={() => set('defaultTermsDays', n)}
            />
          ))}
        </ScrollView>
        <Surface style={[styles.card, styles.top]}>
          <ListRow
            title={t('editor.currency')}
            value={form.currency ?? t('client.businessDefault')}
            showChevron
            onPress={() => currencySheet.current?.present()}
          />
        </Surface>

        <View style={[styles.fields, styles.top]}>
          <TextField
            label={t('client.notes')}
            hint={t('client.notesHint')}
            value={form.notes ?? ''}
            onChangeText={v => set('notes', v)}
            multiline
            textAlignVertical="top"
          />
        </View>

        {id ? (
          <View style={styles.danger}>
            <Divider />
            <ListRow
              leadingIcon={Trash2}
              title={t('client.delete')}
              destructive
              onPress={() => deleteSheet.current?.present()}
            />
          </View>
        ) : null}
      </ScrollView>

      <CurrencySheet
        ref={currencySheet}
        title={t('editor.currency')}
        value={form.currency ?? ''}
        locale={f.locale}
        onSelect={c => {
          set('currency', c);
          currencySheet.current?.dismiss();
        }}
      />
      <ConfirmSheet
        ref={discardSheet}
        title={t('editor.discardTitle')}
        body={t('editor.discardBody')}
        confirmLabel={t('editor.discard')}
        cancelLabel={t('editor.keepEditing')}
        destructive
        onConfirm={() => {
          done.current = true;
          pending.current?.();
        }}
      />
      <ConfirmSheet
        ref={deleteSheet}
        title={t('client.deleteTitle', { name: form.name })}
        body={t('client.deleteBody')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={async () => {
          if (!id) {
            return;
          }
          await mutate(tx => deleteClient(tx, clock, id));
          done.current = true;
          toast.show({
            message: t('toast.clientDeleted'),
            action: {
              label: t('common.undo'),
              onPress: () => mutate(tx => restoreClient(tx, id)),
            },
          });
          navigation.pop(2);
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
    paddingTop: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  fields: {
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[4],
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  top: {
    marginTop: theme.space[4],
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space[1],
  },
  addEmail: {
    marginTop: -theme.space[2],
  },
  hint: {
    paddingHorizontal: theme.size.gutter,
    marginTop: -theme.space[1],
  },
  label: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[4],
  },
  chips: {
    gap: theme.space[2],
    paddingHorizontal: theme.size.gutter,
    paddingVertical: theme.space[2],
  },
  danger: {
    marginTop: theme.space[8],
  },
}));
