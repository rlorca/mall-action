/**
 * The pixel-art pipeline.
 *
 * A Sprite is an indexed bitmap with AT MOST 3 colours plus transparent. That
 * limit is structural, not a convention: `data` holds 0..3 where 0 means
 * transparent and 1..3 index a 3-entry colour table of master-palette indices.
 * A sprite therefore cannot exceed the NES-style limit even by accident.
 *
 * Everything is generated from source at module load. No external art files.
 */

export interface Sprite {
  w: number;
  h: number;
  /** length w*h, values 0..3. 0 = transparent. */
  data: Uint8Array;
  /** Master-palette indices for slots 1, 2, 3. */
  colors: [number, number, number];
}

export type ColorTriple = [number, number, number];

/** Build a sprite from ASCII art. '.' or ' ' is transparent; '1'..'3' pick a slot. */
export function sprite(colors: ColorTriple, rows: readonly string[]): Sprite {
  const h = rows.length;
  const w = h > 0 ? rows[0].length : 0;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) {
      throw new Error(`sprite row ${y} is ${row.length} wide, expected ${w}`);
    }
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const v = ch === '1' ? 1 : ch === '2' ? 2 : ch === '3' ? 3 : 0;
      data[y * w + x] = v;
    }
  }
  return { w, h, data, colors };
}

export function blank(w: number, h: number, colors: ColorTriple): Sprite {
  return { w, h, data: new Uint8Array(w * h), colors };
}

export function px(s: Sprite, x: number, y: number, c: number): void {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
  s.data[y * s.w + x] = c;
}

export function getPx(s: Sprite, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return 0;
  return s.data[y * s.w + x];
}

export function rect(s: Sprite, x: number, y: number, w: number, h: number, c: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(s, x + i, y + j, c);
}

export function frame(s: Sprite, x: number, y: number, w: number, h: number, c: number): void {
  for (let i = 0; i < w; i++) {
    px(s, x + i, y, c);
    px(s, x + i, y + h - 1, c);
  }
  for (let j = 0; j < h; j++) {
    px(s, x, y + j, c);
    px(s, x + w - 1, y + j, c);
  }
}

export function hline(s: Sprite, x: number, y: number, w: number, c: number): void {
  for (let i = 0; i < w; i++) px(s, x + i, y, c);
}

export function vline(s: Sprite, x: number, y: number, h: number, c: number): void {
  for (let j = 0; j < h; j++) px(s, x, y + j, c);
}

export function disc(s: Sprite, cx: number, cy: number, r: number, c: number): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) px(s, cx + x, cy + y, c);
    }
  }
}

export function ring(s: Sprite, cx: number, cy: number, r: number, c: number): void {
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    px(s, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), c);
  }
}

/** Mirror horizontally. Used so left/right facings are one source of truth. */
export function flipX(s: Sprite): Sprite {
  const out = blank(s.w, s.h, s.colors);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      out.data[y * s.w + (s.w - 1 - x)] = s.data[y * s.w + x];
    }
  }
  return out;
}

/** Stamp `src` into `dst`, keeping dst's colour slots. Transparent stays clear. */
export function stamp(dst: Sprite, src: Sprite, ox: number, oy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const v = src.data[y * src.w + x];
      if (v !== 0) px(dst, ox + x, oy + y, v);
    }
  }
}

/** How many distinct colour slots a sprite actually uses (0..3). */
export function usedColors(s: Sprite): number {
  const seen = new Set<number>();
  for (const v of s.data) if (v !== 0) seen.add(v);
  return seen.size;
}

/** True if every value is a legal slot. Guards against hand-built data. */
export function isValidSprite(s: Sprite): boolean {
  if (s.w <= 0 || s.h <= 0) return false;
  if (s.data.length !== s.w * s.h) return false;
  if (s.colors.length !== 3) return false;
  for (const v of s.data) if (v < 0 || v > 3) return false;
  for (const c of s.colors) if (!Number.isInteger(c) || c < 0 || c > 0x3f) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Indexed framebuffer
// ---------------------------------------------------------------------------

/**
 * A 256x240 buffer of master-palette indices. Drawing goes here; converting to
 * RGBA happens once per frame. 0xFF means "not drawn" and reads as black.
 */
export class Framebuffer {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  /** Clip rectangle, used to keep the playfield out of the HUD strip. */
  private clipY0 = 0;
  private clipY1: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h);
    this.clipY1 = h;
  }

  setClip(y0: number, y1: number): void {
    this.clipY0 = y0;
    this.clipY1 = y1;
  }

  clearClip(): void {
    this.clipY0 = 0;
    this.clipY1 = this.h;
  }

  clear(c: number): void {
    this.data.fill(c);
  }

  px(x: number, y: number, c: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= this.w || y < this.clipY0 || y >= this.clipY1) return;
    this.data[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    x |= 0;
    y |= 0;
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.clipY1, y + h);
    for (let j = Math.max(this.clipY0, y); j < y1; j++) {
      const row = j * this.w;
      for (let i = Math.max(0, x); i < x1; i++) this.data[row + i] = c;
    }
  }

  frame(x: number, y: number, w: number, h: number, c: number): void {
    for (let i = 0; i < w; i++) {
      this.px(x + i, y, c);
      this.px(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.px(x, y + j, c);
      this.px(x + w - 1, y + j, c);
    }
  }

  hline(x: number, y: number, w: number, c: number): void {
    for (let i = 0; i < w; i++) this.px(x + i, y, c);
  }

  vline(x: number, y: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) this.px(x, y + j, c);
  }

  /** Draw a sprite at whole-pixel coordinates. */
  blit(s: Sprite, ox: number, oy: number, flip = false): void {
    ox |= 0;
    oy |= 0;
    for (let y = 0; y < s.h; y++) {
      const dy = oy + y;
      if (dy < this.clipY0 || dy >= this.clipY1) continue;
      for (let x = 0; x < s.w; x++) {
        const v = s.data[y * s.w + x];
        if (v === 0) continue;
        const dx = ox + (flip ? s.w - 1 - x : x);
        if (dx < 0 || dx >= this.w) continue;
        this.data[dy * this.w + dx] = s.colors[v - 1];
      }
    }
  }

  /** Blit with the sprite's colours replaced, e.g. for a flashing power-up. */
  blitTinted(s: Sprite, ox: number, oy: number, colors: ColorTriple, flip = false): void {
    const original = s.colors;
    (s as { colors: ColorTriple }).colors = colors;
    this.blit(s, ox, oy, flip);
    (s as { colors: ColorTriple }).colors = original;
  }

  /** Darken a band of the screen by swapping to a dimmer palette entry. */
  darken(x: number, y: number, w: number, h: number, c: number, every = 2): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (((x + i + y + j) & (every - 1)) === 0) this.px(x + i, y + j, c);
      }
    }
  }

  /** Write the framebuffer into an RGBA byte array using the master palette. */
  toRGBA(paletteRGBA: Uint8Array, out: Uint8ClampedArray): void {
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) {
      const c = this.data[i] & 0x3f;
      const p = c * 4;
      const o = i * 4;
      out[o] = paletteRGBA[p];
      out[o + 1] = paletteRGBA[p + 1];
      out[o + 2] = paletteRGBA[p + 2];
      out[o + 3] = 255;
    }
  }
}
