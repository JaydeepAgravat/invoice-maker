import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { DatabaseGate } from '@/data/DatabaseGate';
import { ProfileProvider } from '@/data/ProfileProvider';
import { ToastHost } from '@/ui/toast/ToastHost';

import { RootNavigator } from './RootNavigator';

export function App() {
  const { theme } = useUnistyles();

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.dark,
      colors: {
        ...base.colors,
        primary: theme.colors.accent.solid,
        background: theme.colors.bg.app,
        card: theme.colors.bg.app,
        text: theme.colors.text.primary,
        border: theme.colors.border.subtle,
        notification: theme.colors.status.danger.solid,
      },
    };
  }, [theme]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SystemBars style={theme.dark ? 'light' : 'dark'} />
        <NavigationContainer theme={navigationTheme}>
          <BottomSheetModalProvider>
            <DatabaseGate>
              <ProfileProvider>
                <RootNavigator />
              </ProfileProvider>
            </DatabaseGate>
            <ToastHost />
          </BottomSheetModalProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg.app,
  },
}));
