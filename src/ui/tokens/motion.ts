import { Easing } from 'react-native-reanimated';

/**
 * Motion is quick and quiet: 150–250ms, no overshoot on UI chrome.
 * Springs are near-critically damped. Every animation checks reduce-motion
 * through `useMotion()` and collapses to an instant change or a fade.
 */

export const duration = {
  instant: 0,
  fast: 150,
  base: 200,
  slow: 250,
  /** Sheets and page-level transitions. */
  page: 320,
} as const;

export const easing = {
  /** Standard: elements moving within the screen. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Enter: elements appearing. */
  decelerate: Easing.bezier(0, 0, 0, 1),
  /** Exit: elements leaving. */
  accelerate: Easing.bezier(0.3, 0, 1, 1),
} as const;

export const spring = {
  /** Press feedback, toggles, chips. */
  snappy: { damping: 28, stiffness: 420, mass: 0.8 },
  /** Layout changes, list reorders, sheets. */
  smooth: { damping: 32, stiffness: 260, mass: 1 },
  /** Swipe release and drag settle. */
  settle: { damping: 30, stiffness: 320, mass: 0.9, overshootClamping: true },
} as const;

/** Scale applied to pressable surfaces while pressed. */
export const pressScale = {
  button: 0.97,
  row: 0.985,
  card: 0.98,
} as const;
