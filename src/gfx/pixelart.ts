/** Pixel-art pipeline: ASCII rows + a char->palette map become an indexed sprite. */
import { T } from './palette';

export interface Sprite {
  w: number;
  h: number;
  px: Uint8Array; // palette index or T
}

export type Pal = Record<string, number>;

/** Build a sprite from ASCII art. '.' and ' ' are transparent; other chars must be in pal. */
export function art(rows: string[] | string, pal: Pal): Sprite {
  const lines = typeof rows === 'string' ? rows.split('\n').map((l) => l.trim()).filter((l) => l.length > 0) : rows;
  const h = lines.length;
  const w = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const px = new Uint8Array(w * h).fill(T);
  for (let y = 0; y < h; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c === undefined) throw new Error(`pixelart: unknown colour char '${ch}' in row ${y}: "${line}"`);
      px[y * w + x] = c;
    }
  }
  return { w, h, px };
}

/** Stack sprites vertically (same width). */
export function stack(...parts: Sprite[]): Sprite {
  const w = parts[0].w;
  const h = parts.reduce((s, p) => s + p.h, 0);
  const px = new Uint8Array(w * h).fill(T);
  let y = 0;
  for (const p of parts) {
    if (p.w !== w) throw new Error('stack: width mismatch');
    px.set(p.px, y * w);
    y += p.h;
  }
  return { w, h, px };
}

export function flipX(s: Sprite): Sprite {
  const px = new Uint8Array(s.w * s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) px[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)];
  return { w: s.w, h: s.h, px };
}

/** Recolour: map palette index -> palette index. */
export function recolor(s: Sprite, map: Record<number, number>): Sprite {
  const px = new Uint8Array(s.px.length);
  for (let i = 0; i < px.length; i++) {
    const c = s.px[i];
    px[i] = c !== T && map[c] !== undefined ? map[c] : c;
  }
  return { w: s.w, h: s.h, px };
}

/** Distinct non-transparent colours used by a sprite. */
export function colorsOf(s: Sprite): number[] {
  const set = new Set<number>();
  for (const c of s.px) if (c !== T) set.add(c);
  return [...set];
}
