import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { Check, ChevronRight, Info } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  KeyboardAvoidingView,
  ScrollView,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import type { RootScreenProps } from '@/app/navigation';
import { mutate } from '@/data/live';
import { clock } from '@/data/database';
import { createDraft } from '@/data/repositories/documents';
import {
  applyCountryPreset,
  markOnboarded,
  updateProfile,
} from '@/data/repositories/profile';
import {
  COUNTRY_CODES,
  PRESETS,
  presetForLocale,
  type CountryCode,
} from '@/domain/presets';
import {
  SUPPORTED_LANGUAGES,
  deviceLocale,
  resolveLanguage,
  setLanguage,
  type Language,
} from '@/i18n';
import { haptics } from '@/ui/haptics';
import {
  Button,
  Divider,
  Icon,
  ListRow,
  SectionHeader,
  Sheet,
  Surface,
  Text,
  TextField,
  type SheetRef,
} from '@/ui/primitives';

import { ComplianceNotice } from './ComplianceNotice';

const FLAGS: Record<CountryCode, string> = {
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  ES: '🇪🇸',
  MX: '🇲🇽',
  BR: '🇧🇷',
  FR: '🇫🇷',
  DE: '🇩🇪',
  PT: '🇵🇹',
  OTHER: '🌐',
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
};

/**
 * Two short steps, then straight into the first invoice. Everything is
 * pre-filled from the phone and every choice can be changed later.
 */
export function OnboardingScreen({
  navigation,
}: RootScreenProps<'Onboarding'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = deviceLocale();
  const detected = presetForLocale(locale).code;

  const [step, setStep] = useState<1 | 2>(1);
  const [country, setCountry] = useState<CountryCode>(detected);
  const [region, setRegion] = useState<string | null>(null);
  const [language, setLang] = useState<Language>(resolveLanguage());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const languageSheet = useRef<SheetRef>(null);

  const countries = useMemo(
    () => [
      detected,
      ...COUNTRY_CODES.filter(c => c !== detected && c !== 'OTHER'),
      ...(detected === 'OTHER' ? [] : ['OTHER' as const]),
    ],
    [detected],
  );
  const regions = PRESETS[country].regions;
  const needsRegion = country === 'CA' && !region;

  // Android back on step 2 returns to step 1.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 2) {
          setStep(1);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [step]),
  );

  const finish = async (withName: boolean) => {
    setBusy(true);
    try {
      const draft = await mutate(async tx => {
        await applyCountryPreset(tx, clock, {
          country,
          region,
          language,
          locale:
            locale.split('-')[1]?.toUpperCase() === country
              ? locale
              : PRESETS[country].locale,
        });
        if (withName && name.trim()) {
          await updateProfile(tx, clock, { name: name.trim() });
        }
        await markOnboarded(tx);
        return createDraft(tx, clock, 'INVOICE');
      });
      haptics.play('success');
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Main' },
            { name: 'DocumentEditor', params: { id: draft.id, isNew: true } },
          ],
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <View style={[styles.progress, { marginTop: insets.top + 12 }]}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, step === 2 && styles.dotActive]} />
      </View>

      {step === 1 ? (
        <Animated.View
          key="s1"
          entering={FadeIn.duration(200)}
          exiting={SlideOutLeft.duration(200)}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="title1" accessibilityRole="header">
              {t('onboarding.countryTitle')}
            </Text>
            <Text variant="callout" tone="secondary" style={styles.lead}>
              {t('onboarding.countryBody')}
            </Text>

            <Surface>
              {countries.map((code, i) => (
                <View key={code}>
                  {i > 0 && <Divider inset={56} />}
                  <ListRow
                    testID={`country-${code}`}
                    leading={<Text style={styles.flag}>{FLAGS[code]}</Text>}
                    title={t(`countries.${code}`)}
                    subtitle={
                      code === detected ? t('onboarding.detected') : undefined
                    }
                    selected={code === country}
                    onPress={() => {
                      haptics.play('selection');
                      setCountry(code);
                      setRegion(null);
                    }}
                    trailing={
                      code === country ? (
                        <Icon icon={Check} size={18} tone="accent" />
                      ) : undefined
                    }
                  />
                </View>
              ))}
            </Surface>

            {regions ? (
              <>
                <SectionHeader
                  title={t(
                    country === 'CA'
                      ? 'onboarding.province'
                      : 'onboarding.region',
                  )}
                />
                <Surface>
                  {(country === 'ES'
                    ? [{ code: '', name: t('onboarding.mainland') }, ...regions]
                    : regions
                  ).map((r, i) => (
                    <View key={r.code || 'main'}>
                      {i > 0 && <Divider inset={16} />}
                      <ListRow
                        title={r.name}
                        selected={(region ?? '') === r.code}
                        onPress={() => {
                          haptics.play('selection');
                          setRegion(r.code || null);
                        }}
                        trailing={
                          (region ?? '') === r.code ? (
                            <Icon icon={Check} size={18} tone="accent" />
                          ) : undefined
                        }
                      />
                    </View>
                  ))}
                </Surface>
              </>
            ) : null}

            <ComplianceNotice country={country} />

            <SectionHeader title={t('settings.language')} />
            <Surface>
              <ListRow
                title={LANGUAGE_NAMES[language]}
                subtitle={t('onboarding.languageHint')}
                showChevron
                onPress={() => languageSheet.current?.present()}
              />
            </Surface>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              testID="onboarding-continue"
              variant="primary"
              size="lg"
              fullWidth
              label={
                needsRegion
                  ? t('onboarding.chooseProvince')
                  : t('onboarding.continue')
              }
              trailingIcon={ChevronRight}
              disabled={needsRegion}
              onPress={() => setStep(2)}
            />
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          key="s2"
          entering={SlideInRight.duration(250)}
          exiting={FadeOut.duration(150)}
          style={styles.flex}
        >
          <View style={[styles.content, styles.flex]}>
            <Text variant="title1" accessibilityRole="header">
              {t('onboarding.nameTitle')}
            </Text>
            <Text variant="callout" tone="secondary" style={styles.lead}>
              {t('onboarding.nameBody')}
            </Text>
            <TextField
              testID="business-name"
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.namePlaceholder')}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => finish(true)}
              maxLength={120}
            />
            <View style={styles.hintRow}>
              <Icon icon={Info} size={14} tone="tertiary" />
              <Text variant="caption" tone="tertiary" style={styles.flex}>
                {t('onboarding.nameHint')}
              </Text>
            </View>
          </View>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              testID="onboarding-finish"
              variant="primary"
              size="lg"
              fullWidth
              loading={busy}
              label={t('onboarding.createFirst')}
              onPress={() => finish(true)}
              haptic="light"
            />
            <Button
              variant="ghost"
              fullWidth
              label={t('onboarding.skip')}
              onPress={() => finish(false)}
              disabled={busy}
            />
          </View>
        </Animated.View>
      )}

      <Sheet ref={languageSheet} title={t('settings.language')}>
        {SUPPORTED_LANGUAGES.map((code, i) => (
          <View key={code}>
            {i > 0 && <Divider inset={16} />}
            <ListRow
              title={LANGUAGE_NAMES[code]}
              onPress={() => {
                setLang(code);
                setLanguage(code);
                languageSheet.current?.dismiss();
              }}
              trailing={
                code === language ? (
                  <Icon icon={Check} size={18} tone="accent" />
                ) : undefined
              }
            />
          </View>
        ))}
      </Sheet>
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
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: theme.size.gutter,
  },
  dot: {
    height: 4,
    width: 24,
    borderRadius: 2,
    backgroundColor: theme.colors.border.default,
  },
  dotActive: {
    backgroundColor: theme.colors.accent.solid,
  },
  content: {
    padding: theme.size.gutter,
    paddingTop: theme.space[8],
    paddingBottom: theme.space[8],
    gap: theme.space[2],
    maxWidth: theme.size.contentMax,
    width: '100%',
    alignSelf: 'center',
  },
  lead: {
    marginBottom: theme.space[4],
  },
  flag: {
    fontSize: 22,
    lineHeight: 28,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1.5],
    marginTop: theme.space[1],
  },
  footer: {
    paddingHorizontal: theme.size.gutter,
    paddingTop: theme.space[3],
    gap: theme.space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.app,
  },
}));
