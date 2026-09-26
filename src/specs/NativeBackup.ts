import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type ZipResult = { path: string; bytes: number };
export type OpenedZip = { json: string; files: number };

export interface Spec extends TurboModule {
  /** Absolute path of the app's private files folder. */
  getFilesDir(): string;
  /** backup.json plus the listed files (relative to the files folder) → cache zip. */
  writeZip(json: string, files: string[], name: string): Promise<ZipResult>;
  /** System file picker; resolves a content URI or null when cancelled. */
  pickFile(mimeTypes: string[]): Promise<string | null>;
  /** Read a picked text file (CSV import). Max 20 MB. */
  readText(uri: string): Promise<string>;
  /** Unpack a backup zip into a staging folder; returns its JSON. */
  openZip(uri: string): Promise<OpenedZip>;
  /** Move staged files into the files folder after the data restore succeeded. */
  commitStaged(): Promise<number>;
}

export default TurboModuleRegistry.get<Spec>('NativeBackup');
