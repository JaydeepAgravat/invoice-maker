import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type HapticKind =
  | 'selection'
  | 'light'
  | 'medium'
  | 'threshold'
  | 'success'
  | 'warning'
  | 'error';

export interface Spec extends TurboModule {
  perform(kind: string): void;
}

export default TurboModuleRegistry.get<Spec>('NativeHaptics');
