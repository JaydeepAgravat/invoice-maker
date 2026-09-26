import type { ViewStyle } from 'react-native';

/**
 * Elevation is used sparingly: floating elements only (the New button,
 * menus, toasts). Resting surfaces use borders. Shadow color comes from
 * the theme; opacity is tuned separately for light and dark.
 */
export const elevation = (shadowColor: string, dark: boolean) =>
  ({
    none: {},
    raised: {
      shadowColor,
      shadowOpacity: dark ? 0.4 : 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    floating: {
      shadowColor,
      shadowOpacity: dark ? 0.5 : 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    overlay: {
      shadowColor,
      shadowOpacity: dark ? 0.6 : 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 16,
    },
  } satisfies Record<string, ViewStyle>);
