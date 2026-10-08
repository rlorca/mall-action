/**
 * Fixed NES-like master palette (64 entries, RGB). The framebuffer stores palette
 * INDICES, never RGB. `TRANSPARENT` marks "no pixel" in sprites.
 */
export const TRANSPARENT = 255;

// prettier-ignore
export const NES_RGB: readonly number[] = [
  0x7c7c7c, 0x0000fc, 0x0000bc, 0x4428bc, 0x940084, 0xa80020, 0xa81000, 0x881400,
  0x503000, 0x007800, 0x006800, 0x005800, 0x004058, 0x000000, 0x000000, 0x000000,
  0xbcbcbc, 0x0078f8, 0x0058f8, 0x6844fc, 0xd800cc, 0xe40058, 0xf83800, 0xe45c10,
  0xac7c00, 0x00b800, 0x00a800, 0x00a844, 0x008888, 0x000000, 0x000000, 0x000000,
  0xf8f8f8, 0x3cbcfc, 0x6888fc, 0x9878f8, 0xf878f8, 0xf85898, 0xf87858, 0xfca044,
  0xf8b800, 0xb8f818, 0x58d854, 0x58f898, 0x00e8d8, 0x787878, 0x000000, 0x000000,
  0xfcfcfc, 0xa4e4fc, 0xb8b8f8, 0xd8b8f8, 0xf8b8f8, 0xf8a4c0, 0xf0d0b0, 0xfce0a8,
  0xf8d878, 0xd8f878, 0xb8f8b8, 0xb8f8d8, 0x00fcfc, 0xf8d8f8, 0x000000, 0x000000,
];

/** Named colours (NES palette indices). Use these instead of raw hex everywhere. */
export const C = {
  BLACK: 0x0f,
  WHITE: 0x30,
  OFFWHITE: 0x20,
  CREAM: 0x37,
  GRAY: 0x00,
  LTGRAY: 0x10,
  MDGRAY: 0x2d,
  // dark row
  DKBLUE: 0x02,
  BLUE0: 0x01,
  VIOLET: 0x03,
  PURPLE0: 0x04,
  CRIMSON: 0x05,
  MAROON: 0x06,
  BROWNRED: 0x07,
  BROWN: 0x08,
  DKGREEN: 0x0a,
  GREEN0: 0x09,
  FOREST: 0x0b,
  DKTEAL: 0x0c,
  // mid row
  SKY: 0x11,
  BLUE: 0x12,
  INDIGO: 0x13,
  MAGENTA: 0x14,
  PINKRED: 0x15,
  RED: 0x16,
  ORANGE: 0x17,
  OCHRE: 0x18,
  GREEN: 0x1a,
  LIME0: 0x19,
  SEA: 0x1b,
  TEAL: 0x1c,
  // light row
  LTBLUE: 0x21,
  PERI: 0x22,
  LAVENDER: 0x23,
  HOTPINK: 0x24,
  PINK: 0x25,
  SALMON: 0x26,
  AMBER: 0x27,
  YELLOW: 0x28,
  LIME: 0x29,
  LTGREEN: 0x2a,
  MINT: 0x2b,
  CYAN: 0x2c,
  // pale row
  PALEBLUE: 0x31,
  PALEPERI: 0x32,
  PALEVIOLET: 0x33,
  PALEPINK: 0x34,
  BLUSH: 0x35,
  PEACH: 0x36,
  PALEYELLOW: 0x38,
  PALELIME: 0x39,
  PALEGREEN: 0x3a,
  PALEMINT: 0x3b,
  AQUA: 0x3c,
  PALEMAGENTA: 0x3d,
} as const;

/** RGB for a palette index (out-of-range -> black). */
export function rgbOf(index: number): number {
  return NES_RGB[index & 0x3f] ?? 0;
}

/** Build the 64-entry RGBA LUT (little-endian packed 0xAABBGGRR) used to convert the framebuffer. */
export function buildRgbaLut(): Uint32Array {
  const lut = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    const rgb = NES_RGB[i]!;
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    lut[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
}

const darkCache = new Map<number, number>();

/**
 * NES-style fade: step the colour down its luminance column (each step darkens
 * by one row, bottoming out at black). 0 steps = unchanged.
 */
export function darken(index: number, steps = 1): number {
  if (steps <= 0) return index;
  const key = index * 8 + Math.min(steps, 7);
  const hit = darkCache.get(key);
  if (hit !== undefined) return hit;
  const hue = index & 0x0f;
  const row = index >> 4;
  let out: number;
  if (hue >= 0x0d) out = C.BLACK;
  else {
    const r = row - steps;
    out = r < 0 ? C.BLACK : (r << 4) | hue;
    // Row 0 grays/colours darker than the base row go to black.
    if (r === 0 && hue === 0) out = 0x00;
  }
  darkCache.set(key, out);
  return out;
}
