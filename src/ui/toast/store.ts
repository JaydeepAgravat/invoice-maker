import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

import type { HapticKind } from '@/specs/NativeHaptics';
import { haptics } from '@/ui/haptics';

export type ToastTone = 'neutral' | 'success' | 'danger';

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onPress: () => void };
  durationMs: number;
};

type ToastState = {
  current: Toast | null;
  show: (
    toast: Omit<Toast, 'id' | 'durationMs' | 'tone'> & {
      tone?: ToastTone;
      durationMs?: number;
      haptic?: HapticKind;
    },
  ) => void;
  dismiss: (id?: number) => void;
};

let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * One toast at a time; a new one replaces the old. Toasts with an action
 * (usually Undo) stay longer so there's time to reach the button.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  current: null,
  show: ({ tone = 'neutral', durationMs, haptic, ...rest }) => {
    const toast: Toast = {
      id: nextId++,
      tone,
      durationMs: durationMs ?? (rest.action ? 6000 : 3500),
      ...rest,
    };
    if (timer) {
      clearTimeout(timer);
    }
    if (haptic) {
      haptics.play(haptic);
    }
    set({ current: toast });
    AccessibilityInfo.announceForAccessibility(
      rest.action
        ? `${rest.message}. ${rest.action.label} available.`
        : rest.message,
    );
    timer = setTimeout(() => get().dismiss(toast.id), toast.durationMs);
  },
  dismiss: id => {
    const current = get().current;
    if (!current || (id !== undefined && current.id !== id)) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    set({ current: null });
  },
}));

export const toast = {
  show: (...args: Parameters<ToastState['show']>) =>
    useToastStore.getState().show(...args),
  dismiss: () => useToastStore.getState().dismiss(),
};
