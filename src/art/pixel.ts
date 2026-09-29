// Pixel-art pipeline: sprites are authored as rows of characters and converted to indexed data.
// Every sprite has at most 3 colours plus transparent. Pure data - no DOM - so it is testable in node.
import { pal } from '../core/palette';

/** Row characters: '.' or ' ' = transparent, '1' '2' '3' = colour slot 1..3. */
export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  /** Master palette indices for colour slots 1..3 (slot 0 is transparent). Length 1..3. */
  colors: number[];
  /** frames[f][y*w + x] in 0..3 (0 = transparent). */
  frames: Uint8Array[];
}

export function parseFrame(rows: string[], w: number, h: number, name = '?'): Uint8Array {
  if (rows.length !== h) throw new Error(`sprite ${name}: expected ${h} rows, got ${rows.length}`);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    if (r.length !== w) throw new Error(`sprite ${name}: row ${y} has width ${r.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') out[y * w + x] = 0;
      else if (ch >= '1' && ch <= '3') out[y * w + x] = ch.charCodeAt(0) - 48;
      else throw new Error(`sprite ${name}: bad char '${ch}' at ${x},${y}`);
    }
  }
  return out;
}

/** Define a sprite from one or more frames of character rows. */
export function defineSprite(name: string, w: number, h: number, colors: number[], frames: string[][]): SpriteDef {
  if (colors.length < 1 || colors.length > 3) throw new Error(`sprite ${name}: needs 1-3 colours`);
  return { name, w, h, colors, frames: frames.map((f) => parseFrame(f, w, h, name)) };
}

export function flipFrameX(data: Uint8Array, w: number, h: number): Uint8Array {
  const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + (w - 1 - x)] = data[y * w + x];
  return o;
}

/** Distinct colour slots actually used by a sprite (never more than 3). */
export function usedColors(s: SpriteDef): number {
  const used = new Set<number>();
  for (const f of s.frames) for (const v of f) if (v) used.add(v);
  return used.size;
}

/** RGBA bytes for one frame (for canvas ImageData). */
export function frameToRGBA(s: SpriteDef, frame: number, flipX = false, tint?: (slot: number) => number): Uint8ClampedArray {
  const data = flipX ? flipFrameX(s.frames[frame % s.frames.length], s.w, s.h) : s.frames[frame % s.frames.length];
  const out = new Uint8ClampedArray(s.w * s.h * 4);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!v) continue;
    const c = pal(tint ? tint(v) : s.colors[v - 1]);
    out[i * 4] = parseInt(c.slice(1, 3), 16);
    out[i * 4 + 1] = parseInt(c.slice(3, 5), 16);
    out[i * 4 + 2] = parseInt(c.slice(5, 7), 16);
    out[i * 4 + 3] = 255;
  }
  return out;
}
