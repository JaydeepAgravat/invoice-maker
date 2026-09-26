import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** 'available' | 'none' (no fingerprint/face/screen lock set) | 'unsupported' */
  status(): Promise<string>;
  /** Fingerprint, face or the phone's own PIN/pattern/password. */
  authenticate(title: string, subtitle: string): Promise<boolean>;
  /** Hide app content in the recent-apps preview (Android 13+). */
  setSecureRecents(enabled: boolean): void;
}

export default TurboModuleRegistry.get<Spec>('NativeLock');
