import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Bell, Building2, LayoutDashboard, LockKeyhole, Check, CloudUpload, CreditCard, Crown, LayoutGrid, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DrawerProps } from '@/app/navigation';
import { lastBackup } from '@/backup/service';
import { APP_NAME } from '@/config';
import NativeLock from '@/specs/NativeLock';
import NativeWidget from '@/specs/NativeWidget';
import { toast } from '@/ui/toast/store';
import { setPro, useIsPro } from '@/billing/entitlement';
import { ensureNotificationPermission } from '@/features/documents/RecurringSheet';
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
  const [overdue, setOverdue] = useState(
    prefs.getBoolean(PrefKeys.overdueReminders) ?? false,
  );
  // Re-read when returning from the Backup screen.
  useIsFocused();
  const backup = lastBackup();
  const [lock, setLock] = useState(prefs.getBoolean(PrefKeys.appLock) ?? false);
  const toggleLock = async (next: boolean) => {
    if (!NativeLock) {
      return;
    }
    if (next) {
      if ((await NativeLock.status()) !== 'available') {
        toast.show({ message: t('lock.noScreenLock'), tone: 'danger' });
        return;
      }
      // Prove it works before relying on it.
      if (!(await NativeLock.authenticate(t('lock.title', { app: APP_NAME }), t('lock.subtitle')))) {
        return;
      }
    }
    prefs.set(PrefKeys.appLock, next);
    NativeLock.setSecureRecents(next);
    setLock(next);
  };
  const toggleOverdue = async (next: boolean) => {
    if (next && !(await ensureNotificationPermission())) {
      return;
    }
    prefs.set(PrefKeys.overdueReminders, next);
    setOverdue(next);
  };
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

        <SectionHeader title={t('settings.data')} />
        <Surface style={styles.card}>
          <ListRow
            testID="settings-backup"
            leadingIcon={CloudUpload}
            title={t('backup.title')}
            subtitle={
              backup
                ? t('backup.lastShort', {
                    date: new Intl.DateTimeFormat(profile.locale, {
                      day: 'numeric',
                      month: 'short',
                    }).format(backup.at),
                  })
                : t('backup.never')
            }
            showChevron
            onPress={() => root.navigate('Backup')}
          />
          <Divider inset={52} />
          <ListRow
            testID="settings-overdue"
            leadingIcon={Bell}
            title={t('reminders.overdueSetting')}
            subtitle={t('reminders.overdueSettingHint')}
            onPress={() => toggleOverdue(!overdue)}
            trailing={
              <Switch
                value={overdue}
                onValueChange={toggleOverdue}
                accessibilityLabel={t('reminders.overdueSetting')}
              />
            }
          />
        </Surface>

        <SectionHeader title={t('settings.homeScreen')} />
        <Surface style={styles.card}>
          <ListRow
            testID="settings-widget"
            leadingIcon={LayoutDashboard}
            title={t('settings.addWidget')}
            subtitle={t('settings.addWidgetHint')}
            onPress={async () => {
              const ok = await NativeWidget?.requestPin().catch(() => false);
              if (!ok) {
                toast.show({ message: t('settings.widgetManual') });
              }
            }}
          />
        </Surface>

        <SectionHeader title={t('settings.security')} />
        <Surface style={styles.card}>
          <ListRow
            testID="settings-lock"
            leadingIcon={LockKeyhole}
            title={t('lock.setting')}
            subtitle={t('lock.settingHint')}
            onPress={() => toggleLock(!lock)}
            trailing={
              <Switch
                value={lock}
                onValueChange={toggleLock}
                accessibilityLabel={t('lock.setting')}
              />
            }
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
