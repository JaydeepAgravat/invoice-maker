import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type Reminder = {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  title: string;
  body: string;
  /** Deep link opened on tap, e.g. invoiceapp://document/<id>. */
  url: string;
};

export interface Spec extends TurboModule {
  /** Replace every scheduled reminder with this set (survives reboots). */
  setAll(reminders: Reminder[]): Promise<void>;
  /** Whether the system lets the app post notifications. */
  enabled(): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('NativeReminders');
