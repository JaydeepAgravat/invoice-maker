import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type MediaFile = { path: string; width: number; height: number };

export type MediaOptions = {
  /** Longest edge in pixels after downscaling. */
  maxSize: number;
  /** 'jpeg' for photos, 'png' for logos with transparency. */
  format: string;
  /** Sub-folder of the app's private files, e.g. 'logos'. */
  folder: string;
};

export interface Spec extends TurboModule {
  /** System photo picker; resolves null when cancelled. No permission needed. */
  pickImage(options: MediaOptions): Promise<MediaFile | null>;
  /** Camera app capture; resolves null when cancelled. No permission needed. */
  takePhoto(options: MediaOptions): Promise<MediaFile | null>;
  /** Write text (e.g. an SVG signature) to a private file. */
  writeFile(folder: string, name: string, contents: string): Promise<string>;
  deleteFile(path: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('NativeMedia');
