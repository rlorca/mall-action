import { NES } from './palette';

/**
 * The pixel-art pipeline. Every sprite is a Bitmap of palette slots 0..3 (0 = transparent) plus a 3-colour
 * NES palette. A sprite can therefore never use more than 3 colours + transparent. Bitmaps are drawn in code
 * (rect / line / ascii rows ...) so the game ships no image files.
 */
export type Slot = 0 | 1 | 2 | 3;
export type Pal3 = readonly [number, number, number];

export class Bitmap {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
    public pal: Pal3,
  ) {
    this.data = new Uint8Array(w * h);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  px(x: number, y: number, c: number): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  /** Rectangle outline. */
  box(x: number, y: number, w: number, h: number, c: number): this {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
    return this;
  }
  hline(x: number, y: number, w: number, c: number): this {
    return this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: number): this {
    return this.rect(x, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): this {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Filled ellipse. */
  oval(cx: number, cy: number, rx: number, ry: number, c: number): this {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) <= 1.05) this.px(cx + x, cy + y, c);
    return this;
  }
  /** Stamp ASCII rows: '.' or ' ' = transparent, '1'..'3' = palette slot; other chars use `map`. */
  rows(x: number, y: number, rows: string[], map: Record<string, number> = {}): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const v = map[ch] ?? (ch >= '0' && ch <= '3' ? Number(ch) : -1);
        if (v >= 0) this.px(x + i, y + j, v);
      }
    });
    return this;
  }
  /** Copy another bitmap (same palette slots) onto this one. */
  blit(src: Bitmap, x: number, y: number, flip = false): this {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const v = src.data[j * src.w + (flip ? src.w - 1 - i : i)];
        if (v) this.px(x + i, y + j, v);
      }
    return this;
  }
  flipped(): Bitmap {
    const o = new Bitmap(this.w, this.h, this.pal);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) o.data[j * this.w + i] = this.data[j * this.w + (this.w - 1 - i)];
    return o;
  }
  clone(): Bitmap {
    const o = new Bitmap(this.w, this.h, this.pal);
    o.data.set(this.data);
    return o;
  }
  /** Distinct non-transparent slots used. */
  usedSlots(): Set<number> {
    const s = new Set<number>();
    for (const v of this.data) if (v) s.add(v);
    return s;
  }
  /** Distinct NES colours actually used (<= 3). */
  usedColours(): number[] {
    return [...this.usedSlots()].map((s) => this.pal[s - 1]);
  }
}

// ---------------------------------------------------------------- registry
export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  frames: Bitmap[];
}

const REGISTRY = new Map<string, SpriteDef>();

/** Define a sprite (1+ frames). `paint(bitmap, frameIndex)` draws each frame. */
export function defSprite(name: string, w: number, h: number, pal: Pal3, paint: (b: Bitmap, f: number) => void, frames = 1): SpriteDef {
  const fr: Bitmap[] = [];
  for (let f = 0; f < frames; f++) {
    const b = new Bitmap(w, h, pal);
    paint(b, f);
    fr.push(b);
  }
  const d = { name, w, h, frames: fr };
  REGISTRY.set(name, d);
  return d;
}
export function spriteDef(name: string): SpriteDef {
  const d = REGISTRY.get(name);
  if (!d) throw new Error('missing sprite ' + name);
  return d;
}
export function hasSprite(name: string): boolean {
  return REGISTRY.has(name);
}
export function allSprites(): SpriteDef[] {
  return [...REGISTRY.values()];
}
export function frameOf(name: string, f: number): Bitmap {
  const d = spriteDef(name);
  return d.frames[((f % d.frames.length) + d.frames.length) % d.frames.length];
}

// ---------------------------------------------------------------- rasterising
/** RGBA pixels for a bitmap (pure data: works in tests and in the browser). */
export function toRGBA(b: Bitmap, flip = false, tint?: Pal3): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.w * b.h * 4);
  const pal = tint ?? b.pal;
  for (let j = 0; j < b.h; j++)
    for (let i = 0; i < b.w; i++) {
      const v = b.data[j * b.w + (flip ? b.w - 1 - i : i)];
      if (!v) continue;
      const [r, g, bl] = NES[pal[v - 1] & 63];
      const o = (j * b.w + i) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = bl;
      out[o + 3] = 255;
    }
  return out;
}

// ---------------------------------------------------------------- text into a bitmap (for baked signs / posters)
import { FontDef } from './font';
export function textInto(b: Bitmap, font: FontDef, text: string, x: number, y: number, slot: number): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = font.glyphs.get(ch);
    if (g) {
      for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '1') b.px(cx + c, y + r, slot);
    }
    cx += font.advance;
  }
}
