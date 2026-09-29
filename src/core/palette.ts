/**
 * Fixed NES-like master palette (64 entries, index 0x00-0x3F).
 * Everything on screen is drawn with colours from this table, referenced by index.
 */
export const NES_PALETTE: readonly string[] = [
  '#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000', '#881400',
  '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#000000', '#000000',
  '#bcbcbc', '#0078f8', '#0058f8', '#6844fc', '#d800cc', '#e40058', '#f83800', '#e45c10',
  '#ac7c00', '#00b800', '#00a800', '#00a844', '#008888', '#000000', '#000000', '#000000',
  '#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898', '#f87858', '#fca044',
  '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8', '#787878', '#000000', '#000000',
  '#fcfcfc', '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0', '#fce0a8',
  '#f8d878', '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc', '#f8d8f8', '#000000', '#000000',
];

/** Friendly names for palette indices. */
export const C = {
  BLACK: 0x0f,
  DGREY: 0x2d,
  GREY: 0x00,
  LGREY: 0x10,
  WHITE: 0x30,
  DBLUE: 0x02,
  NAVY: 0x01,
  BLUE: 0x12,
  MBLUE: 0x11,
  LBLUE: 0x21,
  SKY: 0x31,
  PERI: 0x22,
  CYAN: 0x2c,
  TEAL: 0x1c,
  DTEAL: 0x0c,
  AQUA: 0x3c,
  DPURPLE: 0x03,
  PURPLE: 0x13,
  VIOLET: 0x23,
  LAVENDER: 0x33,
  DMAGENTA: 0x04,
  MAGENTA: 0x14,
  PINK: 0x24,
  LPINK: 0x34,
  DRED: 0x06,
  CRIMSON: 0x05,
  RED: 0x16,
  ROSE: 0x15,
  SALMON: 0x26,
  HOTPINK: 0x25,
  DBROWN: 0x08,
  BROWN: 0x07,
  RUST: 0x17,
  OLIVE: 0x18,
  ORANGE: 0x27,
  GOLD: 0x28,
  YELLOW: 0x38,
  CREAM: 0x37,
  SKIN: 0x36,
  PEACH: 0x26,
  DGREEN: 0x0a,
  FOREST: 0x09,
  GREEN: 0x1a,
  MGREEN: 0x19,
  LGREEN: 0x2a,
  LIME: 0x29,
  MINT: 0x2b,
  PALEGREEN: 0x3a,
} as const;

export function colour(index: number): string {
  const c = NES_PALETTE[index];
  if (c === undefined) throw new Error(`palette index out of range: ${index}`);
  return c;
}

/** RGB triple for a palette index (used by pixel-level blits). */
export function rgb(index: number): [number, number, number] {
  const hex = colour(index);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
