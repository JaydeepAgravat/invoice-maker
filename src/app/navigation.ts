import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type InboxView =
  | 'all'
  | 'drafts'
  | 'unpaid'
  | 'overdue'
  | 'estimates'
  | 'paid';

export type DrawerParamList = {
  Inbox: { view?: InboxView } | undefined;
  Clients: undefined;
  Items: undefined;
  Expenses: undefined;
  Mileage: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<DrawerParamList> | undefined;
  KitchenSink: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
export type DrawerProps<T extends keyof DrawerParamList> = DrawerScreenProps<
  DrawerParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
