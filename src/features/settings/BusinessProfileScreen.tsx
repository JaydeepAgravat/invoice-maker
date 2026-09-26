import { usePreventRemove } from '@react-navigation/native';
import { ImagePlus, Trash2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { clock, mutate } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import {
  updateProfile,
  type BusinessProfile,
} from '@/data/repositories/profile';
import { isValidABN, PRESETS } from '@/domain/presets';
import NativeMedia from '@/specs/NativeMedia';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Button,
  ConfirmSheet,
  IconButton,
  ListRow,
  SectionHeader,
  Surface,
  Switch,
  Text,
  TextField,
  Touchable,
  type SheetRef,
} from '@/ui/primitives';
import { toast } from '@/ui/toast/store';

type Form = Pick<
  BusinessProfile,
  | 'name'
  | 'legalName'
  | 'address'
  | 'email'
  | 'phone'
  | 'website'
  | 'taxIdLabel'
  | 'taxId'
  | 'isTaxRegistered'
  | 'logoPath'
>;

/** Everything printed in the "from" part of documents. */
export function BusinessProfileScreen({
  navigation,
}: RootScreenProps<'BusinessProfile'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { profile } = useProfile();
  const [form, setForm] = useState<Form>(() => ({
    name: profile.name,
    legalName: profile.legalName,
    address: profile.address,
    email: profile.email,
    phone: profile.phone,
    website: profile.website,
    taxIdLabel: profile.taxIdLabel,
    taxId: profile.taxId,
    isTaxRegistered: profile.isTaxRegistered,
    logoPath: profile.logoPath,
  }));
  const [dirty, setDirty] = useState(false);
  const done = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const discardSheet = useRef<SheetRef>(null);

  usePreventRemove(dirty && !done.current, ({ data }) => {
    pending.current = () => navigation.dispatch(data.action);
    discardSheet.current?.present();
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };
  const text = (key: keyof Form) => (v: string) =>
    set(key, (v.length ? v : null) as never);

  const pickLogo = async () => {
    try {
      const file = await NativeMedia?.pickImage({
        maxSize: 800,
        format: 'png',
        folder: 'logos',
      });
      if (file) {
        set('logoPath', file.path);
      }
    } catch {
      toast.show({ message: t('business.logoFailed'), tone: 'danger' });
    }
  };

  const abnWarning =
    profile.country === 'AU' && form.taxId && !isValidABN(form.taxId)
      ? t('business.abnInvalid')
      : undefined;

  const save = async () => {
    await mutate(tx =>
      updateProfile(tx, clock, {
        ...form,
        name: form.name?.trim() || null,
      }),
    );
    if (profile.logoPath && profile.logoPath !== form.logoPath) {
      NativeMedia?.deleteFile(profile.logoPath);
    }
    done.current = true;
    toast.show({ message: t('business.saved'), tone: 'success' });
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <ScreenHeader
        title={t('business.title')}
        left={
          <IconButton
            icon={X}
            label={t('common.close')}
            onPress={() => navigation.goBack()}
          />
        }
        right={
          <Button
            testID="business-save"
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
        <View style={styles.logoRow}>
          <Touchable
            testID="business-logo"
            feedback="scale"
            style={[styles.logo, !!form.logoPath && styles.logoFilled]}
            onPress={pickLogo}
            accessibilityRole="button"
            accessibilityLabel={
              form.logoPath ? t('business.changeLogo') : t('business.addLogo')
            }
          >
            {form.logoPath ? (
              <Image
                source={{ uri: `file://${form.logoPath}` }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <ImagePlus size={24} color={theme.colors.text.tertiary} />
            )}
          </Touchable>
          <View style={styles.logoText}>
            <Text variant="bodyMedium">
              {form.logoPath ? t('business.changeLogo') : t('business.addLogo')}
            </Text>
            <Text variant="caption" tone="tertiary">
              {t('business.logoHint')}
            </Text>
            {form.logoPath ? (
              <View style={styles.remove}>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={Trash2}
                  label={t('actions.remove')}
                  onPress={() => set('logoPath', null)}
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.fields}>
          <TextField
            testID="business-name"
            label={t('business.name')}
            value={form.name ?? ''}
            onChangeText={text('name')}
            autoCapitalize="words"
          />
          <TextField
            label={t('business.legalName')}
            hint={t('business.legalNameHint')}
            value={form.legalName ?? ''}
            onChangeText={text('legalName')}
            autoCapitalize="words"
          />
          <TextField
            testID="business-address"
            label={t('business.address')}
            value={form.address ?? ''}
            onChangeText={text('address')}
            multiline
            textAlignVertical="top"
          />
        </View>

        <SectionHeader title={t('client.contact')} />
        <View style={styles.fields}>
          <TextField
            label={t('client.email')}
            value={form.email ?? ''}
            onChangeText={text('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label={t('client.phone')}
            value={form.phone ?? ''}
            onChangeText={text('phone')}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('business.website')}
            value={form.website ?? ''}
            onChangeText={text('website')}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <SectionHeader title={t('business.tax')} />
        <Surface style={styles.card}>
          <ListRow
            title={t('business.registered')}
            subtitle={t('business.registeredHint')}
            onPress={() => set('isTaxRegistered', !form.isTaxRegistered)}
            trailing={
              <Switch
                value={form.isTaxRegistered}
                onValueChange={v => set('isTaxRegistered', v)}
                accessibilityLabel={t('business.registered')}
              />
            }
          />
        </Surface>
        <View style={[styles.fields, styles.top]}>
          <View style={styles.taxRow}>
            <View style={styles.taxLabel}>
              <TextField
                label={t('business.taxIdLabel')}
                value={form.taxIdLabel ?? ''}
                placeholder={PRESETS[profile.country].taxIdLabel}
                onChangeText={text('taxIdLabel')}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('client.taxId')}
                value={form.taxId ?? ''}
                onChangeText={text('taxId')}
                autoCapitalize="characters"
                error={abnWarning}
              />
            </View>
          </View>
        </View>
      </ScrollView>
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    paddingHorizontal: theme.size.gutter,
    paddingBottom: theme.space[5],
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.surface,
    borderWidth: theme.stroke.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.border.default,
    overflow: 'hidden',
  },
  logoFilled: {
    borderStyle: 'solid',
    borderColor: theme.colors.border.subtle,
  },
  logoImage: {
    width: 76,
    height: 76,
  },
  logoText: {
    flex: 1,
    gap: 2,
  },
  remove: {
    alignItems: 'flex-start',
    marginLeft: -theme.space[3],
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
  taxRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  taxLabel: {
    width: 120,
  },
}));
