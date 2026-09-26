import { createMMKV } from 'react-native-mmkv';

/**
 * Small key-value store for preferences and caches only.
 * Business data lives in SQLite, never here.
 */
export const prefs = createMMKV({ id: 'prefs' });

export const PrefKeys = {
  themePreference: 'ui.theme',
  hapticsEnabled: 'ui.haptics',
  language: 'i18n.language',
} as const;
