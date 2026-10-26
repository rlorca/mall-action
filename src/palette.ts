// The fixed NES-like master palette. Sprites and tiles reference these by index.
// The classic 2C02 palette (64 entries) is used as the master; a handful of
// named aliases make the code readable.

export const PALETTE: string[] = [
  "#626262", "#001fb2", "#2404c8", "#5200b0", "#730076", "#800024", "#730b00",
  "#521a00", "#244400", "#005700", "#005c00", "#00524e", "#000000", "#000000",
  "#000000", "#000000", "#ababab", "#0d57ff", "#4a30ec", "#8a0cf0", "#cd0084",
  "#f00018", "#e63a00", "#b25e00", "#6b8800", "#0dab00", "#00b800", "#00a89e",
  "#000000", "#000000", "#000000", "#000000", "#ffffff", "#53aeff", "#8e8cff",
  "#c46cff", "#ff4cfc", "#ff4c70", "#ff8c3c", "#f2b23c", "#a2d13c", "#4cf23c",
  "#2cf2a2", "#2cf2f2", "#000000", "#000000", "#000000", "#000000", "#ffffff",
  "#a8e0ff", "#c4d4ff", "#d8c8ff", "#ffc8ff", "#ffc4c4", "#ffd4a8", "#ffe0a8",
  "#e8f0a8", "#b8f0a8", "#a8f0d4", "#a8f0f0", "#000000", "#000000", "#000000",
  "#000000",
];

// Named colour indices for readability.
export const C = {
  black: 0x0f,
  white: 0x30,
  grey: 0x00,
  lightGrey: 0x10,
  red: 0x16,
  darkRed: 0x06,
  orange: 0x27,
  yellow: 0x28,
  green: 0x1a,
  lightGreen: 0x2a,
  blue: 0x12,
  lightBlue: 0x21,
  cyan: 0x2c,
  purple: 0x13,
  pink: 0x24,
  brown: 0x17,
  tan: 0x27,
  skin: 0x36,
  darkBlue: 0x02,
  navy: 0x01,
} as const;

export type ColorIndex = number;
