import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type ShareRequest = {
  path: string;
  mime: string;
  /** 'whatsapp' | 'whatsapp_business' | 'email' | 'sms' | 'any' */
  target: string;
  subject: string;
  text: string;
  emails: string[];
  phone: string;
  chooserTitle: string;
};

export type SavedFile = { uri: string; name: string };

export interface Spec extends TurboModule {
  /** Share targets installed on this phone. */
  availableTargets(): Promise<string[]>;
  /** Hand the file to another app. Resolves once that app is opened. */
  share(request: ShareRequest): Promise<boolean>;
  /** Copy the file to Downloads (Android 10+) or a folder the person picks. */
  saveToDownloads(path: string, name: string, mime: string): Promise<SavedFile>;
  /** Open a saved file in the default viewer. */
  open(uri: string, mime: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('NativeShare');
