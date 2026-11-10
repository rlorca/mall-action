/** Fixed NES-like master palette (64 entries). Index 0x0F is black. T = transparent. */
export const T = 255;
const HEX = [
  '7C7C7C', '0000FC', '0000BC', '4428BC', '940084', 'A80020', 'A81000', '881400', '503000', '007800', '006800', '005800', '004058', '000000', '000000', '000000',
  'BCBCBC', '0078F8', '0058F8', '6844FC', 'D800CC', 'E40058', 'F83800', 'E45C10', 'AC7C00', '00B800', '00A800', '00A844', '008888', '000000', '000000', '000000',
  'F8F8F8', '3CBCFC', '6888FC', '9878F8', 'F878F8', 'F85898', 'F87858', 'FCA044', 'F8B800', 'B8F818', '58D854', '58F898', '00E8D8', '787878', '000000', '000000',
  'FCFCFC', 'A4E4FC', 'B8B8F8', 'D8B8F8', 'F8B8F8', 'F8A4C0', 'F0D0B0', 'FCE0A8', 'F8D878', 'D8F878', 'B8F8B8', 'B8F8D8', '00FCFC', 'F8D8F8', '000000', '000000',
];
export const PALETTE_RGB: number[] = HEX.map((h) => parseInt(h, 16));
/** RGBA (little-endian ABGR words) for fast framebuffer conversion. */
export const PALETTE_ABGR = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  const c = PALETTE_RGB[i];
  PALETTE_ABGR[i] = 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | (c >> 16);
}
export const BLACK = 0x0f;
export const WHITE = 0x30;

/** NES-style darkening: step a colour down one brightness row. */
export function darker(c: number): number {
  if (c === T) return T;
  const col = c & 0x0f;
  if (col >= 0x0d) return BLACK;
  if (c < 0x10) return BLACK;
  return c - 0x10;
}
/** DARK[level][colour]: precomputed darkening tables, level 0..4 (4 = black). */
export const DARK: Uint8Array[] = [];
for (let l = 0; l <= 4; l++) {
  const t = new Uint8Array(64);
  for (let c = 0; c < 64; c++) {
    let v = c;
    for (let k = 0; k < l; k++) v = darker(v);
    t[c] = v;
  }
  DARK.push(t);
}

/** Nearest palette index for an RGB colour (used by the splash adapter). */
const nearestCache = new Map<number, number>();
export function nearestIndex(rgb: number): number {
  const hit = nearestCache.get(rgb);
  if (hit !== undefined) return hit;
  const r = rgb >> 16, g = (rgb >> 8) & 255, b = rgb & 255;
  let best = BLACK, bd = Infinity;
  for (let i = 0; i < 64; i++) {
    if ((i & 0x0f) >= 0x0e) continue;
    const c = PALETTE_RGB[i];
    const d = (r - (c >> 16)) ** 2 + (g - ((c >> 8) & 255)) ** 2 + (b - (c & 255)) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  nearestCache.set(rgb, best);
  return best;
}
