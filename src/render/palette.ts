/**
 * A fixed NES-like master palette (the 2C02's 64 entries, $00-$3F).
 *
 * Every colour in the game is an index into this table. Nothing anywhere may
 * invent an RGB value: that is what keeps the whole game looking like one
 * machine drew it.
 */
export const MASTER_PALETTE: readonly number[] = [
  // $00-$0F
  0x656565, 0x002d69, 0x131f7f, 0x3c137c, 0x600b62, 0x730a37, 0x710f07, 0x5a1a00,
  0x342800, 0x0b3400, 0x003c00, 0x003d10, 0x003840, 0x000000, 0x000000, 0x000000,
  // $10-$1F
  0xaeaeae, 0x0f63b3, 0x4051d0, 0x7841cc, 0xa736a9, 0xc03470, 0xbd3c30, 0x9f4a00,
  0x6d5c00, 0x366d00, 0x077704, 0x00793d, 0x00727d, 0x000000, 0x000000, 0x000000,
  // $20-$2F
  0xfefeff, 0x5db3ff, 0x8fa1ff, 0xc890ff, 0xf785fa, 0xff83c0, 0xff8b7f, 0xef9a49,
  0xbdac2c, 0x85bc2f, 0x55c753, 0x3cc98c, 0x3ec2cd, 0x4e4e4e, 0x000000, 0x000000,
  // $30-$3F
  0xfefeff, 0xbcdfff, 0xd1d8ff, 0xe8cfff, 0xfbc9ff, 0xffc9df, 0xffcfc4, 0xf7d7a9,
  0xe3e197, 0xc8e89c, 0xb0efaf, 0xa3efcb, 0xa2eae8, 0xb8b8b8, 0x000000, 0x000000,
];

/** Handy named indices. Use these, not raw numbers, so palettes stay editable. */
export const C = {
  BLACK: 0x0f,
  DARKGREY: 0x00,
  GREY: 0x10,
  LIGHTGREY: 0x3d,
  WHITE: 0x30,

  DARKBLUE: 0x01,
  BLUE: 0x11,
  LIGHTBLUE: 0x21,
  PALEBLUE: 0x31,
  NAVY: 0x02,
  INDIGO: 0x12,

  PURPLE: 0x13,
  VIOLET: 0x14,
  MAGENTA: 0x24,
  PINK: 0x25,
  PALEPINK: 0x35,

  DARKRED: 0x06,
  RED: 0x16,
  SALMON: 0x26,
  PALERED: 0x36,
  MAROON: 0x05,
  CRIMSON: 0x15,

  BROWN: 0x07,
  ORANGE: 0x17,
  LIGHTORANGE: 0x27,
  TAN: 0x37,
  DARKBROWN: 0x08,

  OLIVE: 0x18,
  YELLOW: 0x28,
  PALEYELLOW: 0x38,

  DARKGREEN: 0x0a,
  GREEN: 0x1a,
  LIGHTGREEN: 0x2a,
  PALEGREEN: 0x3a,
  FOREST: 0x09,
  LIME: 0x19,

  TEAL: 0x1b,
  CYAN: 0x2c,
  PALECYAN: 0x3c,
  DARKTEAL: 0x0c,
  SEAGREEN: 0x2b,
} as const;

/** Pre-expanded RGBA bytes, for blitting an indexed framebuffer to ImageData. */
export const PALETTE_RGBA: Uint8Array = (() => {
  const out = new Uint8Array(MASTER_PALETTE.length * 4);
  MASTER_PALETTE.forEach((rgb, i) => {
    out[i * 4 + 0] = (rgb >> 16) & 0xff;
    out[i * 4 + 1] = (rgb >> 8) & 0xff;
    out[i * 4 + 2] = rgb & 0xff;
    out[i * 4 + 3] = 255;
  });
  return out;
})();

/** The rainbow used by the FLICKERSOFT splash letters. */
export const RAINBOW: readonly number[] = [
  C.RED,
  C.ORANGE,
  C.YELLOW,
  C.LIGHTGREEN,
  C.CYAN,
  C.LIGHTBLUE,
  C.VIOLET,
  C.MAGENTA,
  C.PINK,
  C.SALMON,
  C.LIGHTORANGE,
];
