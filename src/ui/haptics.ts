import { PrefKeys, prefs } from '@/lib/storage';
import NativeHaptics, { type HapticKind } from '@/specs/NativeHaptics';

/**
 * Haptic map (one meaning per kind, used consistently across the app):
 *   selection  scrolling through pickers, segmented control, keypad digits
 *   light      toggles, chips, checkbox, opening a menu
 *   medium     long-press, drag pick-up
 *   threshold  swipe action crosses its commit point
 *   success    payment recorded, document sent, Pro unlocked
 *   warning    destructive confirmation shown
 *   error      validation failure
 */

let enabled = prefs.getBoolean(PrefKeys.hapticsEnabled) ?? true;

export const haptics = {
  play(kind: HapticKind) {
    if (enabled) {
      NativeHaptics?.perform(kind);
    }
  },
  setEnabled(value: boolean) {
    enabled = value;
    prefs.set(PrefKeys.hapticsEnabled, value);
  },
  isEnabled: () => enabled,
};
