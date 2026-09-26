import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

import { useIsPro } from './entitlement';

export type ProFeature =
  | 'sends'
  | 'templates'
  | 'colors'
  | 'photos'
  | 'signature'
  | 'reports'
  | 'expenses'
  | 'mileage'
  | 'docTypes'
  | 'autoBackup';

/**
 * `gate(feature)` returns true when the action may go ahead; otherwise it
 * opens the paywall (explaining that feature) and returns false.
 */
export function useProGate() {
  const isPro = useIsPro();
  const navigation = useNavigation();
  const gate = useCallback(
    (feature: ProFeature) => {
      if (isPro) {
        return true;
      }
      navigation.navigate('Paywall', { feature });
      return false;
    },
    [isPro, navigation],
  );
  return { isPro, gate };
}
