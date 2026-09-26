import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EmptyState } from '@/ui/primitives';

import { getDatabase } from './database';

/**
 * Renders children once the database is open and migrated (a few ms).
 * Until then it shows the plain app background, matching the native window,
 * so there is no visible flash. Failure shows a calm, honest message.
 */
export function DatabaseGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    getDatabase().then(
      () => setState('ready'),
      () => setState('error'),
    );
  }, []);

  if (state === 'ready') {
    return <>{children}</>;
  }
  return (
    <View style={styles.screen}>
      {state === 'error' ? (
        <EmptyState
          title="Couldn’t open your data"
          body="Restart the app. If this keeps happening, contact support from the Play Store listing."
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.app,
  },
}));
