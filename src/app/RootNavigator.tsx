import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useWindowDimensions } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useProfile } from '@/data/ProfileProvider';
import { ClientDetailScreen } from '@/features/clients/ClientDetailScreen';
import { ClientEditorScreen } from '@/features/clients/ClientEditorScreen';
import { ClientsScreen } from '@/features/clients/ClientsScreen';
import { KitchenSinkScreen } from '@/features/dev/KitchenSinkScreen';
import { DocumentDetailScreen } from '@/features/documents/DocumentDetailScreen';
import { DocumentEditorScreen } from '@/features/editor/DocumentEditorScreen';
import { InboxScreen } from '@/features/inbox/InboxScreen';
import { ItemEditorScreen } from '@/features/items/ItemEditorScreen';
import { ItemsScreen } from '@/features/items/ItemsScreen';
import { PreviewScreen } from '@/features/preview/PreviewScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { CommandPaletteScreen } from '@/features/palette/CommandPaletteScreen';
import { ExpenseEditorScreen } from '@/features/expenses/ExpenseEditorScreen';
import { ExpensesScreen } from '@/features/expenses/ExpensesScreen';
import { MileageScreen } from '@/features/mileage/MileageScreen';
import { TripEditorScreen } from '@/features/mileage/TripEditorScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { SignatureScreen } from '@/features/signature/SignatureScreen';
import { BusinessProfileScreen } from '@/features/settings/BusinessProfileScreen';
import { PaymentMethodEditorScreen } from '@/features/settings/PaymentMethodEditorScreen';
import { PaymentMethodsScreen } from '@/features/settings/PaymentMethodsScreen';
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
      <Drawer.Screen name="Clients" component={ClientsScreen} />
      <Drawer.Screen name="Items" component={ItemsScreen} />
      <Drawer.Screen name="Expenses" component={ExpensesScreen} />
      <Drawer.Screen name="Mileage" component={MileageScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useUnistyles();
  const { onboarded } = useProfile();
  return (
    <Stack.Navigator
      initialRouteName={onboarded ? 'Main' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
        animation: 'default',
        contentStyle: { backgroundColor: theme.colors.bg.app },
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen name="Main" component={MainDrawer} />
      <Stack.Screen
        name="DocumentEditor"
        component={DocumentEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <Stack.Screen name="DocumentPreview" component={PreviewScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen
        name="ClientEditor"
        component={ClientEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="ItemEditor"
        component={ItemEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen
        name="ExpenseEditor"
        component={ExpenseEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="TripEditor"
        component={TripEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Signature"
        component={SignatureScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="PaymentMethodEditor"
        component={PaymentMethodEditorScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="CommandPalette"
        component={CommandPaletteScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      {__DEV__ ? (
        <Stack.Screen name="KitchenSink" component={KitchenSinkScreen} />
      ) : null}
    </Stack.Navigator>
  );
}
