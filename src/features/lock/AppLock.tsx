import { LockKeyhole } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet as RNStyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { APP_NAME } from '@/config';
import { PrefKeys, prefs } from '@/lib/storage';
import NativeLock from '@/specs/NativeLock';
import { Button, Icon, Text } from '@/ui/primitives';

const GRACE_MS = 60_000;

export const appLockEnabled = () => prefs.getBoolean(PrefKeys.appLock) ?? false;

/**
 * Covers the app until the person unlocks with fingerprint, face or their
 * phone's PIN. Locks on launch and after a minute in the background; a
 * quick switch to another app and back never asks again.
 */
export function AppLock() {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(appLockEnabled);
  const busy = useRef(false);
  const backgroundAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy.current || !NativeLock) {
      return;
    }
    busy.current = true;
    try {
      const ok = await NativeLock.authenticate(t('lock.title', { app: APP_NAME }), t('lock.subtitle'));
      if (ok) {
        setLocked(false);
      }
    } finally {
      busy.current = false;
    }
  }, [t]);

  useEffect(() => {
    NativeLock?.setSecureRecents(appLockEnabled());
    if (locked) {
      unlock();
    }
    const sub = AppState.addEventListener('change', state => {
      if (!appLockEnabled()) {
        return;
      }
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active' && backgroundAt.current !== null) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (away > GRACE_MS) {
          setLocked(true);
          unlock();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) {
    return null;
  }
  return (
    <Animated.View exiting={FadeOut.duration(180)} style={[RNStyleSheet.absoluteFill, styles.cover]}>
      <View style={styles.icon}>
        <Icon icon={LockKeyhole} size={26} tone="accent" />
      </View>
      <Text variant="title2">{t('lock.locked', { app: APP_NAME })}</Text>
      <View style={styles.button}>
        <Button testID="lock-unlock" variant="primary" label={t('lock.unlock')} onPress={unlock} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create(theme => ({
  cover: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[3],
    backgroundColor: theme.colors.bg.app,
    zIndex: 1000,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.subtle,
  },
  button: {
    marginTop: theme.space[4],
  },
}));
