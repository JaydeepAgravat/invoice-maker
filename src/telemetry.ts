import * as Sentry from '@sentry/react-native';

import { SENTRY_DSN } from '@/config';
import { PrefKeys, prefs } from '@/lib/storage';

/**
 * Crash reports only: no performance tracing, no session replay, no
 * screenshots, no user identity. Business data never leaves the phone, so
 * console output (which can echo it) is dropped from breadcrumbs.
 *
 * Off in development, off until a DSN is configured, and off when the
 * person turns it off in Settings (takes effect on the next launch).
 */
export function crashReportsEnabled(): boolean {
  return prefs.getBoolean(PrefKeys.crashReports) ?? true;
}

export function setCrashReportsEnabled(enabled: boolean) {
  prefs.set(PrefKeys.crashReports, enabled);
  if (!enabled) {
    Sentry.close();
  }
}

export function initTelemetry() {
  if (__DEV__ || !SENTRY_DSN || !crashReportsEnabled()) {
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableAutoSessionTracking: true,
    beforeBreadcrumb: crumb =>
      crumb.category === 'console' || crumb.category === 'touch' ? null : crumb,
    beforeSend: event => {
      delete event.user;
      delete event.server_name;
      return event;
    },
  });
}
