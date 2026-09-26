import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type WidgetData = {
  outstandingLabel: string;
  outstanding: string;
  overdue: string;
  overdueTone: string;
  newLabel: string;
};

export interface Spec extends TurboModule {
  /** Store the pre-formatted numbers and refresh every placed widget. */
  update(data: WidgetData): void;
  /** Ask the launcher to place the widget (Android 8+ launchers that support it). */
  requestPin(): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('NativeWidget');
