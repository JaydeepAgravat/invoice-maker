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
  lastBackupAt: 'backup.lastAt',
  lastBackupKind: 'backup.lastKind',
  lastBackupDocs: 'backup.lastDocs',
  autoDriveBackup: 'backup.autoDrive',
  driveError: 'backup.driveError',
  nudgeDismissedAt: 'backup.nudgeDismissedAt',
  overdueReminders: 'reminders.overdue',
  appLock: 'security.appLock',
  crashReports: 'privacy.crashReports',
} as const;
