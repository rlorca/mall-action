// Fixed NES-like master palette (64 entries, index = row*16 + column, like the 2C02).
export const MASTER_PALETTE: readonly string[] = [
  '#626262', '#001FB2', '#2404C8', '#5200B2', '#730076', '#800024', '#730B00', '#522800',
  '#244400', '#005700', '#005C00', '#005324', '#003C76', '#000000', '#000000', '#000000',
  '#ABABAB', '#0D57FF', '#4B30FF', '#8A13FF', '#BC08D6', '#D21269', '#C72E00', '#9D5400',
  '#607B00', '#209800', '#00A300', '#009942', '#007DB4', '#000000', '#000000', '#000000',
  '#FFFFFF', '#53AEFF', '#9085FF', '#D365FF', '#FF57FF', '#FF5DCF', '#FF7757', '#FA9E00',
  '#BDC700', '#7AE700', '#43F611', '#26EF7E', '#2CD5F6', '#4D4D4D', '#000000', '#000000',
  '#FFFFFF', '#B6E1FF', '#CED1FF', '#E9C3FF', '#FFBCFF', '#FFBDF4', '#FFC6C3', '#FFD59A',
  '#E9E681', '#CEF481', '#B6FB9A', '#A9FAC3', '#A9F0F4', '#B8B8B8', '#000000', '#000000',
];

/** Named palette indices used throughout the game so art stays readable. */
export const C = {
  BLACK: 0x0f,
  WHITE: 0x30,
  GRAY_D: 0x00,
  GRAY_M: 0x10,
  GRAY_L: 0x3d,
  GRAY_DD: 0x2d,
  RED: 0x16,
  RED_D: 0x06,
  RED_L: 0x26,
  PINK: 0x25,
  PINK_L: 0x35,
  ORANGE: 0x27,
  ORANGE_D: 0x17,
  BROWN: 0x07,
  BROWN_L: 0x17,
  TAN: 0x37,
  YELLOW: 0x28,
  YELLOW_L: 0x38,
  LIME: 0x29,
  GREEN: 0x1a,
  GREEN_D: 0x0a,
  GREEN_L: 0x2a,
  TEAL: 0x1c,
  CYAN: 0x2c,
  CYAN_L: 0x3c,
  SKY: 0x21,
  SKY_L: 0x31,
  BLUE: 0x11,
  BLUE_D: 0x01,
  INDIGO: 0x12,
  INDIGO_D: 0x02,
  PURPLE: 0x13,
  PURPLE_D: 0x03,
  MAGENTA: 0x14,
  MAGENTA_L: 0x24,
  VIOLET_L: 0x33,
} as const;

/** Hex colour string for a master palette index (0-63). */
export function pal(i: number): string {
  return MASTER_PALETTE[i & 63];
}

/** [r,g,b] bytes for a master palette index. */
export function palRGB(i: number): [number, number, number] {
  const s = MASTER_PALETTE[i & 63];
  return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
}

export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
/** Height of the playfield below the HUD. */
export const VIEW_H = SCREEN_H - HUD_H;
