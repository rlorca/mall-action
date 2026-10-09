/** The fixed NES-like master palette (64 entries; $0D/$0E/$0F... are black). */
const RAW: [number, number, number][] = [
  // $00-$0F
  [84, 84, 84], [0, 30, 116], [8, 16, 144], [48, 0, 136], [68, 0, 100], [92, 0, 48], [84, 4, 0], [60, 24, 0], [32, 42, 0], [8, 58, 0], [0, 64, 0], [0, 60, 0], [0, 50, 60], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  // $10-$1F
  [152, 150, 152], [8, 76, 196], [48, 50, 236], [92, 30, 228], [136, 20, 176], [160, 20, 100], [152, 34, 32], [120, 60, 0], [84, 90, 0], [40, 114, 0], [8, 124, 0], [0, 118, 40], [0, 102, 120], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  // $20-$2F
  [236, 238, 236], [76, 154, 236], [120, 124, 236], [176, 98, 236], [228, 84, 236], [236, 88, 180], [236, 106, 100], [212, 136, 32], [160, 170, 0], [116, 196, 0], [76, 208, 32], [56, 204, 108], [56, 180, 204], [60, 60, 60], [0, 0, 0], [0, 0, 0],
  // $30-$3F
  [236, 238, 236], [168, 204, 236], [188, 188, 236], [212, 178, 236], [236, 174, 236], [236, 174, 212], [236, 180, 176], [228, 196, 144], [204, 210, 120], [180, 222, 120], [168, 226, 144], [152, 226, 180], [160, 214, 228], [160, 162, 160], [0, 0, 0], [0, 0, 0],
];

export const NES: ReadonlyArray<readonly [number, number, number]> = RAW;

export function nesRgb(i: number): [number, number, number] {
  return RAW[i & 63];
}
export function nesCss(i: number): string {
  const [r, g, b] = nesRgb(i);
  return `rgb(${r},${g},${b})`;
}

/** Named palette entries (NES colour indexes) used all over the art. */
export const C = {
  black: 0x0f,
  white: 0x30,
  grey: 0x00,
  lgrey: 0x10,
  vlgrey: 0x3d,
  dgrey: 0x2d,
  red: 0x16,
  lred: 0x26,
  dred: 0x06,
  orange: 0x27,
  brown: 0x17,
  dbrown: 0x07,
  tan: 0x37,
  skin: 0x37,
  yellow: 0x28,
  lyellow: 0x38,
  green: 0x1a,
  lgreen: 0x2a,
  pgreen: 0x3a,
  dgreen: 0x0a,
  teal: 0x1c,
  cyan: 0x2c,
  pcyan: 0x3c,
  blue: 0x12,
  lblue: 0x21,
  dblue: 0x02,
  navy: 0x01,
  purple: 0x13,
  lpurple: 0x23,
  pink: 0x25,
  ppink: 0x35,
  magenta: 0x24,
  dpurple: 0x03,
  maroon: 0x05,
  olive: 0x18,
  lime: 0x29,
  gold: 0x27,
} as const;
