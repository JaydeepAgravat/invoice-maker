/**
 * Product-level constants. The brand name is still a placeholder: it is set
 * once before the first store upload (Phase 8) and used everywhere from here.
 */
export const APP_NAME = 'Invoice Maker';

/**
 * RevenueCat public Android SDK key (starts with "goog_"). Empty until the
 * RevenueCat project exists: purchases then run in test mode in debug builds
 * and show "not available yet" in release builds.
 */
export const REVENUECAT_ANDROID_KEY = '';
/** Entitlement identifier configured in RevenueCat. */
export const PRO_ENTITLEMENT = 'pro';
/** Google Play in-app product (one-time, non-consumable). */
export const PRO_PRODUCT_ID = 'pro_lifetime';
/** Shown only until the store returns the localized price. */
export const PRO_PRICE_FALLBACK = '$9.99';
/** Free plan: documents shared per calendar month. */
export const FREE_SENDS_PER_MONTH = 5;

/** Filled in before launch (Phase 8). */
export const SUPPORT_EMAIL = '';
export const PRIVACY_URL = '';
export const TERMS_URL = '';

/**
 * Sentry project DSN for crash reports. Empty until the Sentry project
 * exists; crash reporting stays off while it is empty.
 */
export const SENTRY_DSN = '';
