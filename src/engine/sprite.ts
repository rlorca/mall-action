import { TRANSPARENT } from './palette';

/**
 * Pixel-art pipeline: sprites are written as character grids in source code and
 * parsed into palette-index bitmaps. A sprite may use at most 3 colours plus
 * transparent (the NES limit); `parseSprite` throws if it breaks that or if the
 * grid is not exactly w x h.
 */
export interface Sprite {
  name: string;
  w: number;
  h: number;
  frames: number;
  /** Palette indices, TRANSPARENT (255) for empty pixels. Frame-major, then row-major. */
  data: Uint8Array;
  /** Distinct opaque colours used (<= 3). */
  colors: number[];
}

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  /** Character -> NES palette index. '.' and ' ' are always transparent. At most 3 distinct colours. */
  pal: Record<string, number>;
  /** One frame (rows of exactly w chars). */
  rows?: readonly string[];
  /** Or several animation frames. */
  frames?: ReadonlyArray<readonly string[]>;
}

export const MAX_SPRITE_COLORS = 3;

export function parseSprite(def: SpriteDef): Sprite {
  const { name, w, h, pal } = def;
  const frameRows: ReadonlyArray<readonly string[]> = def.frames ?? (def.rows ? [def.rows] : []);
  if (frameRows.length === 0) throw new Error(`sprite ${name}: no rows/frames`);
  const data = new Uint8Array(frameRows.length * w * h).fill(TRANSPARENT);
  const used = new Set<number>();
  frameRows.forEach((rows, f) => {
    if (rows.length !== h) throw new Error(`sprite ${name} frame ${f}: expected ${h} rows, got ${rows.length}`);
    rows.forEach((row, y) => {
      if (row.length !== w) throw new Error(`sprite ${name} frame ${f} row ${y}: expected ${w} chars, got ${row.length} ("${row}")`);
      for (let x = 0; x < w; x++) {
        const ch = row[x]!;
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c === undefined) throw new Error(`sprite ${name} frame ${f} (${x},${y}): char '${ch}' not in palette`);
        data[f * w * h + y * w + x] = c;
        used.add(c);
      }
    });
  });
  if (used.size > MAX_SPRITE_COLORS) {
    throw new Error(`sprite ${name}: uses ${used.size} colours (max ${MAX_SPRITE_COLORS})`);
  }
  return { name, w, h, frames: frameRows.length, data, colors: [...used] };
}

/** Build a sprite from raw data (procedural sprites). Validates the colour limit. */
export function spriteFromData(name: string, w: number, h: number, frames: number, data: Uint8Array): Sprite {
  if (data.length !== w * h * frames) throw new Error(`sprite ${name}: data length mismatch`);
  const used = new Set<number>();
  for (const v of data) if (v !== TRANSPARENT) used.add(v);
  if (used.size > MAX_SPRITE_COLORS) throw new Error(`sprite ${name}: uses ${used.size} colours (max ${MAX_SPRITE_COLORS})`);
  return { name, w, h, frames, data, colors: [...used] };
}

/** A recolour LUT (index -> index) for palette swaps (variants, hit-flash). */
export function makeRecolor(map: Record<number, number>): Uint8Array {
  const lut = new Uint8Array(64);
  for (let i = 0; i < 64; i++) lut[i] = i;
  for (const [from, to] of Object.entries(map)) lut[Number(from)] = to;
  return lut;
}

export function spritePixel(s: Sprite, x: number, y: number, frame = 0): number {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return TRANSPARENT;
  return s.data[(frame % s.frames) * s.w * s.h + y * s.w + x]!;
}
