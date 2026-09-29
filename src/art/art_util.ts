import type { SpriteDef } from '../core/pixelart';

/**
 * Authoring helpers for text-row sprites.
 * art(): rows may be shorter than w (padded right with '.'), and fewer than h (padded at the TOP,
 * so feet stay on the bottom row).
 */
export function art(w: number, h: number, colors: number[], rows: string[]): SpriteDef {
  const padded = rows.map((r) => (r.length > w ? r.slice(0, w) : r + '.'.repeat(w - r.length)));
  while (padded.length < h) padded.unshift('.'.repeat(w));
  return { w, h, colors, rows: padded.slice(padded.length - h) };
}

/** Left half mirrored to a symmetric sprite (width = 2 * half row length). */
export function sym(h: number, colors: number[], half: string[], halfW = 8): SpriteDef {
  const rows = half.map((r) => {
    const p = r + '.'.repeat(Math.max(0, halfW - r.length));
    return p + p.split('').reverse().join('');
  });
  return art(halfW * 2, h, colors, rows);
}

/** Overlay patch rows onto a copy of def at (x, y). '.' in the patch leaves the base pixel; '_' clears it. */
export function patch(def: SpriteDef, x: number, y: number, rows: string[], colors?: number[]): SpriteDef {
  const out = def.rows.map((r) => r.split(''));
  rows.forEach((r, dy) => {
    for (let dx = 0; dx < r.length; dx++) {
      const ch = r[dx];
      const yy = y + dy;
      const xx = x + dx;
      if (yy < 0 || yy >= def.h || xx < 0 || xx >= def.w) continue;
      if (ch === '.') continue;
      out[yy][xx] = ch === '_' ? '.' : ch;
    }
  });
  return { w: def.w, h: def.h, colors: colors ?? def.colors, rows: out.map((r) => r.join('')) };
}

/** Replace rows [y, y+rows.length) of def entirely. */
export function withRows(def: SpriteDef, y: number, rows: string[]): SpriteDef {
  const out = def.rows.slice();
  rows.forEach((r, i) => {
    out[y + i] = r.length >= def.w ? r.slice(0, def.w) : r + '.'.repeat(def.w - r.length);
  });
  return { ...def, rows: out };
}

/** Shift whole sprite down by n pixels (pad at top, drop bottom). */
export function shiftY(def: SpriteDef, n: number): SpriteDef {
  const blank = '.'.repeat(def.w);
  const rows = n >= 0 ? [...Array(n).fill(blank), ...def.rows].slice(0, def.h) : [...def.rows.slice(-n), ...Array(-n).fill(blank)];
  return { ...def, rows };
}

export function recolorDef(def: SpriteDef, colors: number[]): SpriteDef {
  return { ...def, colors };
}

/** Horizontal mirror of a def (text rows). */
export function mirror(def: SpriteDef): SpriteDef {
  return { ...def, rows: def.rows.map((r) => r.split('').reverse().join('')) };
}

/** Replace pixel values: map e.g. {'2':'3'}. */
export function remap(def: SpriteDef, map: Record<string, string>): SpriteDef {
  return { ...def, rows: def.rows.map((r) => r.replace(/[123]/g, (c) => map[c] ?? c)) };
}

/** Simple deterministic hash noise for procedural tiles. */
export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
