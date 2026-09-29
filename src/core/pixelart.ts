/**
 * Pixel-art pipeline: sprites are authored as text rows in source code.
 *   '.' or ' ' = transparent, '1' '2' '3' = the sprite's three palette colours.
 * A sprite may use at most 3 colours plus transparent (NES rule).
 */
export interface SpriteDef {
  w: number;
  h: number;
  /** Palette indices for pixel values 1, 2 and 3. */
  colors: number[];
  rows: string[];
}

export interface Sprite {
  w: number;
  h: number;
  colors: number[];
  /** Row-major pixel values: 0 = transparent, 1..3 = colors[v-1]. */
  pixels: Uint8Array;
}

export function parseSprite(def: SpriteDef, name = '?'): Sprite {
  if (def.colors.length < 1 || def.colors.length > 3) {
    throw new Error(`sprite ${name}: needs 1-3 colours, has ${def.colors.length}`);
  }
  if (def.rows.length !== def.h) throw new Error(`sprite ${name}: expected ${def.h} rows, got ${def.rows.length}`);
  const pixels = new Uint8Array(def.w * def.h);
  def.rows.forEach((row, y) => {
    if (row.length !== def.w) throw new Error(`sprite ${name}: row ${y} has width ${row.length}, expected ${def.w}`);
    for (let x = 0; x < def.w; x++) {
      const ch = row[x];
      let v = 0;
      if (ch === '1') v = 1;
      else if (ch === '2') v = 2;
      else if (ch === '3') v = 3;
      else if (ch !== '.' && ch !== ' ') throw new Error(`sprite ${name}: bad pixel '${ch}' at ${x},${y}`);
      if (v > def.colors.length) throw new Error(`sprite ${name}: pixel ${v} at ${x},${y} has no colour`);
      pixels[y * def.w + x] = v;
    }
  });
  return { w: def.w, h: def.h, colors: def.colors.slice(), pixels };
}

/** Number of distinct opaque palette colours actually used. */
export function countColors(s: Sprite): number {
  const used = new Set<number>();
  for (const v of s.pixels) if (v) used.add(s.colors[v - 1]);
  return used.size;
}

export function flipX(s: Sprite): Sprite {
  const pixels = new Uint8Array(s.w * s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) pixels[y * s.w + x] = s.pixels[y * s.w + (s.w - 1 - x)];
  return { ...s, pixels };
}

/** Same shape, different colours (palette swap, as on the NES). */
export function recolor(s: Sprite, colors: number[]): Sprite {
  return { ...s, colors: colors.slice() };
}

/** Build a sprite from a function (for procedural tiles). f returns 0..3. */
export function spriteFromFn(w: number, h: number, colors: number[], f: (x: number, y: number) => number): SpriteDef {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const v = f(x, y);
      r += v === 0 ? '.' : String(v);
    }
    rows.push(r);
  }
  return { w, h, colors, rows };
}
