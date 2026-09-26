import { useNavigation } from '@react-navigation/native';
import { Building2, Check, CreditCard, Crown, LayoutGrid, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { setPro, useIsPro } from '@/billing/entitlement';
import { useLiveQuery } from '@/data/live';
import { useProfile } from '@/data/ProfileProvider';
import { listPaymentMethods } from '@/data/repositories/paymentMethods';
import { DevDataTools } from '@/features/dev/DevDataTools';
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from '@/i18n';
import { PrefKeys, prefs } from '@/lib/storage';
import { haptics } from '@/ui/haptics';
import { ScreenHeader } from '@/ui/layout/ScreenHeader';
import {
  Divider,
  Icon,
  IconButton,
  ListRow,
  SectionHeader,
  SegmentedControl,
  Surface,
  Switch,
  Text,
} from '@/ui/primitives';
import {
  applyThemePreference,
  breakpoints,
  readThemePreference,
  type ThemePreference,
} from '@/ui/theme';

/** Language names are always shown in their own language. */
const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
};

export function SettingsScreen({ navigation }: DrawerProps<'Settings'>) {
  const { t } = useTranslation();
  const root = useNavigation();
  const { width } = useWindowDimensions();
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference);
  const [hapticsOn, setHapticsOn] = useState(haptics.isEnabled);
  const [language, setLang] = useState<Language | null>(
    () => (prefs.getString(PrefKeys.language) as Language | undefined) ?? null,
  );

  const { profile } = useProfile();
  const pro = useIsPro();
  const { data: methods } = useLiveQuery(db => listPaymentMethods(db), []);

  const chooseLanguage = (next: Language | null) => {
    haptics.play('selection');
    setLang(next);
    setLanguage(next);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('nav.settings')}
        left={
          width >= breakpoints.lg ? undefined : (
            <IconButton
              icon={Menu}
              label={t('common.openMenu')}
              onPress={navigation.openDrawer}
            />
          )
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title={t('settings.business')} />
        <Surface style={styles.card}>
          <ListRow
            testID="settings-business"
            leadingIcon={Building2}
            title={t('business.title')}
            subtitle={profile.name ?? t('editor.notSet')}
            showChevron
            onPress={() => root.navigate('BusinessProfile')}
          />
          <Divider inset={52} />
          <ListRow
            testID="settings-payments"
            leadingIcon={CreditCard}
            title={t('paymentDetails.title')}
            subtitle={
              methods?.length
                ? t('paymentDetails.count', { count: methods.length })
                : t('editor.notSet')
            }
            showChevron
            onPress={() => root.navigate('PaymentMethods')}
          />
        </Surface>

        <SectionHeader title={t('settings.appearance')} />
        <Surface style={styles.card}>
          <View style={styles.field}>
            <Text variant="bodyMedium">{t('settings.theme')}</Text>
            <SegmentedControl<ThemePreference>
              accessibilityLabel={t('settings.theme')}
              value={theme}
              onChange={next => {
                setTheme(next);
                applyThemePreference(next);
              }}
              segments={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />
          </View>
          <Divider inset={16} />
          <ListRow
            title={t('settings.haptics')}
            subtitle={t('settings.hapticsHint')}
            accessibilityLabel={t('settings.haptics')}
            onPress={() => {
              haptics.setEnabled(!hapticsOn);
              setHapticsOn(!hapticsOn);
            }}
            trailing={
              <Switch
                value={hapticsOn}
                accessibilityLabel={t('settings.haptics')}
                onValueChange={next => {
                  haptics.setEnabled(next);
                  setHapticsOn(next);
                }}
              />
            }
          />
        </Surface>

        <SectionHeader title={t('settings.language')} />
        <Surface style={styles.card}>
          <ListRow
            title={t('settings.languageSystem')}
            onPress={() => chooseLanguage(null)}
            trailing={
              language === null ? (
                <Icon icon={Check} size={18} tone="accent" />
              ) : undefined
            }
          />
          {SUPPORTED_LANGUAGES.map(code => (
            <View key={code}>
              <Divider inset={16} />
              <ListRow
                title={LANGUAGE_NAMES[code]}
                onPress={() => chooseLanguage(code)}
                trailing={
                  language === code ? (
                    <Icon icon={Check} size={18} tone="accent" />
                  ) : undefined
                }
              />
            </View>
          ))}
        </Surface>

        {__DEV__ ? (
          <>
            <SectionHeader title={t('settings.developer')} />
            <Surface style={styles.card}>
              <ListRow
                title={t('settings.kitchenSink')}
                leadingIcon={LayoutGrid}
                showChevron
                onPress={() => root.navigate('KitchenSink')}
              />
              <Divider inset={52} />
              <ListRow
                title={t('settings.devPro')}
                leadingIcon={Crown}
                onPress={() => setPro(!pro)}
                trailing={
                  <Switch
                    value={pro}
                    onValueChange={setPro}
                    accessibilityLabel={t('settings.devPro')}
                  />
                }
              />
              <Divider inset={52} />
              <DevDataTools />
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
  content: {
    paddingBottom: theme.space[12],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    marginHorizontal: theme.size.gutter,
  },
  field: {
    padding: theme.size.gutter,
    gap: theme.space[3],
  },
}));
