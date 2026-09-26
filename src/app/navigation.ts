import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { DocType } from '@/domain/docTypes';

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
  Onboarding: undefined;
  Main: NavigatorScreenParams<DrawerParamList> | undefined;
  DocumentEditor: { id: string; isNew?: boolean };
  DocumentDetail: { id: string };
  DocumentPreview: { id: string };
  ClientDetail: { id: string };
  ClientEditor: { id?: string; name?: string; phone?: string } | undefined;
  ItemEditor: { id?: string } | undefined;
  CommandPalette: undefined;
  BusinessProfile: undefined;
  Backup: undefined;
  Import: { target: 'clients' | 'items' };
  ExpenseEditor: { id?: string } | undefined;
  TripEditor: { id?: string } | undefined;
  Signature: { documentId?: string };
  PaymentMethods: undefined;
  PaymentMethodEditor: { id?: string } | undefined;
  KitchenSink: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
export type DrawerProps<T extends keyof DrawerParamList> = DrawerScreenProps<
  DrawerParamList,
  T
>;

export type NewDocumentType = DocType;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
