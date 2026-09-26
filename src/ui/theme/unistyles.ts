import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { PrefKeys, prefs } from '@/lib/storage';

import { breakpoints, darkTheme, lightTheme } from './themes';

type AppThemes = { light: typeof lightTheme; dark: typeof darkTheme };
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

export type ThemePreference = 'system' | 'light' | 'dark';

export const readThemePreference = (): ThemePreference => {
  const value = prefs.getString(PrefKeys.themePreference);
  return value === 'light' || value === 'dark' ? value : 'system';
};

const preference = readThemePreference();

StyleSheet.configure({
  themes: { light: lightTheme, dark: darkTheme },
  breakpoints,
  settings:
    preference === 'system'
      ? { adaptiveThemes: true }
      : { initialTheme: preference },
});

export const applyThemePreference = (next: ThemePreference) => {
  prefs.set(PrefKeys.themePreference, next);
  if (next === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true);
    return;
  }
  UnistylesRuntime.setAdaptiveThemes(false);
  UnistylesRuntime.setTheme(next);
};
