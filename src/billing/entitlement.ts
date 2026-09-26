import { useSyncExternalStore } from 'react';

import { prefs } from '@/lib/storage';

/**
 * Pro entitlement. Phase 7 wires this to RevenueCat with an offline cache;
 * until then it is a local flag (toggled from the developer tools) so the
 * free and Pro paths can both be exercised.
 */
const KEY = 'billing.pro';

export const isPro = (): boolean => prefs.getBoolean(KEY) ?? false;

export const setPro = (value: boolean) => prefs.set(KEY, value);

const subscribe = (onChange: () => void) => {
  const sub = prefs.addOnValueChangedListener(key => {
    if (key === KEY) {
      onChange();
    }
  });
  return () => sub.remove();
};

export const useIsPro = () => useSyncExternalStore(subscribe, isPro);
