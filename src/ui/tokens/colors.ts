/**
 * Color system.
 *
 * Raw 12-step scales (step 1 = app background … step 12 = high-contrast text),
 * modeled on the Radix scale semantics so every step has one job:
 *   1–2 backgrounds · 3–5 component fills (rest / hover / pressed)
 *   6–8 borders (subtle / default / strong) · 9–10 solid fills · 11–12 text
 *
 * Components never read raw scales. They read the semantic tokens below.
 */

const slateLight = {
  1: '#FCFCFD',
  2: '#F9F9FB',
  3: '#F0F0F3',
  4: '#E8E8EC',
  5: '#E0E1E6',
  6: '#D9D9E0',
  7: '#CDCED6',
  8: '#B9BBC6',
  9: '#8B8D98',
  10: '#80838D',
  11: '#60646C',
  12: '#1C2024',
} as const;

const slateDark = {
  1: '#111113',
  2: '#18191B',
  3: '#212225',
  4: '#272A2D',
  5: '#2E3135',
  6: '#363A3F',
  7: '#43484E',
  8: '#5A6169',
  9: '#696E77',
  10: '#777B84',
  11: '#B0B4BA',
  12: '#EDEEF0',
} as const;

// Placeholder brand accent (iris). Swapped in one place once the brand is chosen.
const accentLight = {
  3: '#F0F1FE',
  4: '#E6E7FF',
  5: '#DADCFF',
  6: '#CBCDFF',
  8: '#9B9EF0',
  9: '#5B5BD6',
  10: '#5151CD',
  11: '#5753C6',
  12: '#272962',
} as const;

const accentDark = {
  3: '#202248',
  4: '#262A65',
  5: '#303374',
  6: '#3D3E82',
  8: '#6061D0',
  9: '#5B5BD6',
  10: '#6E6ADE',
  11: '#B1A9FF',
  12: '#E0DFFE',
} as const;

const status = {
  light: {
    green: { bg: '#E6F6EB', border: '#B2DDB5', solid: '#30A46C', text: '#218358' },
    amber: { bg: '#FFF7C2', border: '#F3D673', solid: '#FFC53D', text: '#AB6400' },
    red: { bg: '#FEEBEC', border: '#FDBDBE', solid: '#E5484D', text: '#CE2C31' },
    blue: { bg: '#E6F4FE', border: '#ACD8FC', solid: '#0090FF', text: '#0D74CE' },
  },
  dark: {
    green: { bg: '#132D21', border: '#20573E', solid: '#30A46C', text: '#3DD68C' },
    amber: { bg: '#302008', border: '#5C3D05', solid: '#FFC53D', text: '#FFCA16' },
    red: { bg: '#3B1219', border: '#72232D', solid: '#E5484D', text: '#FF9592' },
    blue: { bg: '#0D2847', border: '#104D87', solid: '#0090FF', text: '#70B8FF' },
  },
} as const;

type StatusSet = { bg: string; border: string; solid: string; text: string };

export type ColorTokens = {
  bg: {
    app: string;
    surface: string;
    elevated: string;
    subtle: string;
    hover: string;
    pressed: string;
    selected: string;
    inverse: string;
  };
  border: { subtle: string; default: string; strong: string; focus: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    accent: string;
    onAccent: string;
    danger: string;
  };
  accent: {
    solid: string;
    solidPressed: string;
    subtle: string;
    subtlePressed: string;
    border: string;
    text: string;
  };
  status: {
    neutral: StatusSet;
    info: StatusSet;
    success: StatusSet;
    warning: StatusSet;
    danger: StatusSet;
  };
  overlay: { scrim: string; hairline: string };
  shadow: string;
};

export const lightColors: ColorTokens = {
  bg: {
    app: slateLight[1],
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    subtle: slateLight[2],
    hover: slateLight[3],
    pressed: slateLight[4],
    selected: accentLight[3],
    inverse: slateLight[12],
  },
  border: {
    subtle: slateLight[4],
    default: slateLight[6],
    strong: slateLight[8],
    focus: accentLight[8],
  },
  text: {
    primary: slateLight[12],
    secondary: slateLight[11],
    tertiary: slateLight[9],
    disabled: slateLight[8],
    inverse: slateLight[1],
    accent: accentLight[11],
    onAccent: '#FFFFFF',
    danger: status.light.red.text,
  },
  accent: {
    solid: accentLight[9],
    solidPressed: accentLight[10],
    subtle: accentLight[3],
    subtlePressed: accentLight[4],
    border: accentLight[6],
    text: accentLight[11],
  },
  status: {
    neutral: { bg: slateLight[3], border: slateLight[6], solid: slateLight[9], text: slateLight[11] },
    info: status.light.blue,
    success: status.light.green,
    warning: status.light.amber,
    danger: status.light.red,
  },
  overlay: { scrim: 'rgba(17, 17, 19, 0.32)', hairline: 'rgba(0, 0, 0, 0.06)' },
  shadow: '#101014',
};

export const darkColors: ColorTokens = {
  bg: {
    app: slateDark[1],
    surface: slateDark[2],
    elevated: slateDark[3],
    subtle: slateDark[2],
    hover: slateDark[4],
    pressed: slateDark[5],
    selected: accentDark[3],
    inverse: slateDark[12],
  },
  border: {
    subtle: slateDark[4],
    default: slateDark[6],
    strong: slateDark[8],
    focus: accentDark[8],
  },
  text: {
    primary: slateDark[12],
    secondary: slateDark[11],
    tertiary: slateDark[9],
    disabled: slateDark[7],
    inverse: slateDark[1],
    accent: accentDark[11],
    onAccent: '#FFFFFF',
    danger: status.dark.red.text,
  },
  accent: {
    solid: accentDark[9],
    solidPressed: accentDark[10],
    subtle: accentDark[3],
    subtlePressed: accentDark[4],
    border: accentDark[6],
    text: accentDark[11],
  },
  status: {
    neutral: { bg: slateDark[3], border: slateDark[6], solid: slateDark[9], text: slateDark[11] },
    info: status.dark.blue,
    success: status.dark.green,
    warning: status.dark.amber,
    danger: status.dark.red,
  },
  overlay: { scrim: 'rgba(0, 0, 0, 0.56)', hairline: 'rgba(255, 255, 255, 0.06)' },
  shadow: '#000000',
};
