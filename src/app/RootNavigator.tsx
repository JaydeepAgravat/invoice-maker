import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { KitchenSinkScreen } from '@/features/dev/KitchenSinkScreen';
import { InboxScreen } from '@/features/inbox/InboxScreen';
import { PlaceholderScreen } from '@/features/placeholder/PlaceholderScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { breakpoints } from '@/ui/theme';

import { AppDrawer } from './AppDrawer';
import type { DrawerParamList, RootStackParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const renderDrawer = (props: DrawerContentComponentProps) => (
  <AppDrawer {...props} />
);

function MainDrawer() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { width } = useWindowDimensions();
  const permanent = width >= breakpoints.lg;

  return (
    <Drawer.Navigator
      initialRouteName="Inbox"
      drawerContent={renderDrawer}
      screenOptions={{
        headerShown: false,
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? 280 : Math.min(width * 0.84, 320),
          backgroundColor: theme.colors.bg.subtle,
          borderRightWidth: permanent ? 1 : 0,
          borderRightColor: theme.colors.border.subtle,
        },
        overlayColor: theme.colors.overlay.scrim,
        swipeEdgeWidth: 32,
        sceneStyle: { backgroundColor: theme.colors.bg.app },
      }}
    >
      <Drawer.Screen name="Inbox" component={InboxScreen} />
      <Drawer.Screen name="Clients">
        {props => (
          <PlaceholderScreen
            title={t('nav.clients')}
            navigation={props.navigation}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="Items">
        {props => (
          <PlaceholderScreen
            title={t('nav.items')}
            navigation={props.navigation}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="Expenses">
        {props => (
          <PlaceholderScreen
            title={t('nav.expenses')}
            navigation={props.navigation}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="Mileage">
        {props => (
          <PlaceholderScreen
            title={t('nav.mileage')}
            navigation={props.navigation}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="Reports">
        {props => (
          <PlaceholderScreen
            title={t('nav.reports')}
            navigation={props.navigation}
          />
        )}
      </Drawer.Screen>
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useUnistyles();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'default',
        contentStyle: { backgroundColor: theme.colors.bg.app },
      }}
    >
      <Stack.Screen name="Main" component={MainDrawer} />
      {__DEV__ ? (
        <Stack.Screen name="KitchenSink" component={KitchenSinkScreen} />
      ) : null}
    </Stack.Navigator>
  );
}
