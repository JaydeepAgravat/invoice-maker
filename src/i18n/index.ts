import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { PrefKeys, prefs } from '@/lib/storage';

import de from './locales/de';
import en, { type Messages } from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import pt from './locales/pt';
import { pseudoTree } from './pseudo';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt', 'fr', 'de'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const isSupported = (code: string): code is Language =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(code);

/** Device locale via Hermes Intl (e.g. "pt-BR"). No extra native module needed. */
export const deviceLocale = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
};

export const resolveLanguage = (): Language => {
  const saved = prefs.getString(PrefKeys.language);
  if (saved && isSupported(saved)) {
    return saved;
  }
  const base = deviceLocale().split('-')[0]?.toLowerCase() ?? 'en';
  return isSupported(base) ? base : 'en';
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    pt: { translation: pt },
    fr: { translation: fr },
    de: { translation: de },
    ...(__DEV__ ? { qps: { translation: pseudoTree(en as never) } } : {}),
  },
  lng: resolveLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** `null` returns to the phone's language. */
export const setLanguage = (language: Language | null) => {
  if (language) {
    prefs.set(PrefKeys.language, language);
  } else {
    prefs.remove(PrefKeys.language);
  }
  i18n.changeLanguage(resolveLanguage());
};

/** Development only: switch the UI to the pseudo-locale until the next restart. */
export const setPseudoLocale = (on: boolean) => {
  i18n.changeLanguage(on ? 'qps' : resolveLanguage());
};

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Messages };
  }
}

export default i18n;
