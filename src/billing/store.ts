import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import {
  PRO_ENTITLEMENT,
  PRO_PRICE_FALLBACK,
  PRO_PRODUCT_ID,
  REVENUECAT_ANDROID_KEY,
} from '@/config';

import { setPro } from './entitlement';

/**
 * One-time Pro purchase through RevenueCat + Google Play.
 *
 * The entitlement is cached locally (MMKV) so Pro works offline; RevenueCat
 * refreshes it on launch and pushes changes (restore, refund). A refund only
 * switches Pro features off again: the person's data is never touched.
 */

export type BuyResult = 'purchased' | 'cancelled' | 'unavailable' | 'failed';

let configured = false;
let product: PurchasesStoreProduct | null = null;

const live = () => REVENUECAT_ANDROID_KEY.length > 0;

const apply = (info: CustomerInfo) => {
  setPro(!!info.entitlements.active[PRO_ENTITLEMENT]);
};

export function initBilling() {
  if (!live() || configured) {
    return;
  }
  configured = true;
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
  }
  Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });
  Purchases.addCustomerInfoUpdateListener(apply);
  Purchases.getCustomerInfo().then(apply).catch(() => undefined);
}

async function loadProduct(): Promise<PurchasesStoreProduct | null> {
  if (!live()) {
    return null;
  }
  if (!product) {
    const [p] = await Purchases.getProducts([PRO_PRODUCT_ID], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    product = p ?? null;
  }
  return product;
}

/** Localized price from Google Play ("9,99 €"), or the fallback. */
export async function proPrice(): Promise<string> {
  try {
    return (await loadProduct())?.priceString ?? PRO_PRICE_FALLBACK;
  } catch {
    return PRO_PRICE_FALLBACK;
  }
}

export async function buyPro(): Promise<BuyResult> {
  if (!live()) {
    // Test mode until the RevenueCat key is set: debug builds unlock locally.
    if (__DEV__) {
      setPro(true);
      return 'purchased';
    }
    return 'unavailable';
  }
  try {
    const p = await loadProduct();
    if (!p) {
      return 'unavailable';
    }
    const { customerInfo } = await Purchases.purchaseStoreProduct(p);
    apply(customerInfo);
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] ? 'purchased' : 'failed';
  } catch (e) {
    const code = (e as { code?: string })?.code;
    return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ? 'cancelled' : 'failed';
  }
}

/** Restore on a new phone or after reinstall. Resolves whether Pro is active. */
export async function restorePro(): Promise<boolean | null> {
  if (!live()) {
    return null;
  }
  try {
    const info = await Purchases.restorePurchases();
    apply(info);
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch {
    return null;
  }
}
