import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type DriveFile = { id: string; name: string; size: number; modified: string };

export interface Spec extends TurboModule {
  /**
   * Access token for the app's private Drive folder (drive.appdata scope).
   * With `interactive` false, resolves null instead of showing consent.
   */
  authorize(interactive: boolean): Promise<string | null>;
  upload(token: string, path: string, name: string): Promise<DriveFile>;
  list(token: string): Promise<DriveFile[]>;
  /** Download to the app cache; returns a file:// URI. */
  download(token: string, id: string): Promise<string>;
  remove(token: string, id: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativeDrive');
