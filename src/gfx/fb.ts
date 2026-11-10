/** Software framebuffer of palette indices. Pure: usable in Node for tests and screenshots. */
import { T, DARK, PALETTE_ABGR } from './palette';
import type { Sprite } from './pixelart';
import { FONT, TINY, GLYPH_W, TINY_W } from './font';

export const SCREEN_W = 256;
export const SCREEN_H = 240;

export class Fb {
  readonly px: Uint8Array;
  // clip rect
  cx0 = 0; cy0 = 0; cx1: number; cy1: number;
  constructor(readonly w = SCREEN_W, readonly h = SCREEN_H) {
    this.px = new Uint8Array(w * h);
    this.cx1 = w;
    this.cy1 = h;
  }
  clip(x: number, y: number, w: number, h: number): void {
    this.cx0 = Math.max(0, x); this.cy0 = Math.max(0, y);
    this.cx1 = Math.min(this.w, x + w); this.cy1 = Math.min(this.h, y + h);
  }
  noClip(): void {
    this.cx0 = 0; this.cy0 = 0; this.cx1 = this.w; this.cy1 = this.h;
  }
  clear(c: number): void {
    this.px.fill(c);
  }
  pset(x: number, y: number, c: number): void {
    x |= 0; y |= 0;
    if (x < this.cx0 || y < this.cy0 || x >= this.cx1 || y >= this.cy1) return;
    this.px[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const x0 = Math.max(this.cx0, x), y0 = Math.max(this.cy0, y);
    const x1 = Math.min(this.cx1, x + w), y1 = Math.min(this.cy1, y + h);
    if (x1 <= x0) return;
    for (let yy = y0; yy < y1; yy++) this.px.fill(c, yy * this.w + x0, yy * this.w + x1);
  }
  frame(x: number, y: number, w: number, h: number, c: number): void {
    this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Draw a sprite. remap: optional 64-entry colour table (e.g. DARK[n]). */
  spr(s: Sprite, x: number, y: number, flip = false, remap?: Uint8Array | null, solid?: number): void {
    x = Math.floor(x); y = Math.floor(y);
    const { w, h, px } = s;
    for (let sy = 0; sy < h; sy++) {
      const dy = y + sy;
      if (dy < this.cy0 || dy >= this.cy1) continue;
      for (let sx = 0; sx < w; sx++) {
        const dx = x + sx;
        if (dx < this.cx0 || dx >= this.cx1) continue;
        let c = px[sy * w + (flip ? w - 1 - sx : sx)];
        if (c === T) continue;
        if (solid !== undefined) c = solid;
        else if (remap) c = remap[c];
        this.px[dy * this.w + dx] = c;
      }
    }
  }
  /** Darken a region by `level` palette rows (0..4). */
  shade(x: number, y: number, w: number, h: number, level: number): void {
    if (level <= 0) return;
    const t = DARK[Math.min(4, level)];
    const x0 = Math.max(this.cx0, x | 0), y0 = Math.max(this.cy0, y | 0);
    const x1 = Math.min(this.cx1, (x + w) | 0), y1 = Math.min(this.cy1, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      const o = yy * this.w;
      for (let xx = x0; xx < x1; xx++) this.px[o + xx] = t[this.px[o + xx] & 63];
    }
  }
  /** 8x8-cell text. Returns the x after the last glyph. */
  text(str: string, x: number, y: number, c: number, bg?: number): number {
    x |= 0; y |= 0;
    for (const ch of str) {
      if (bg !== undefined) this.rect(x, y, GLYPH_W, 8, bg);
      const g = FONT[ch] ?? FONT[ch.toUpperCase()];
      if (g) this.spr(g, x, y, false, null, c);
      x += GLYPH_W;
    }
    return x;
  }
  textC(str: string, cx: number, y: number, c: number, bg?: number): void {
    this.text(str, Math.round(cx - (str.length * GLYPH_W) / 2), y, c, bg);
  }
  /** Scaled text (for logos / countdowns). */
  bigText(str: string, x: number, y: number, scale: number, c: number): void {
    for (const ch of str) {
      const g = FONT[ch] ?? FONT[ch.toUpperCase()];
      if (g) {
        for (let gy = 0; gy < g.h; gy++)
          for (let gx = 0; gx < g.w; gx++)
            if (g.px[gy * g.w + gx] !== T) this.rect(x + gx * scale, y + gy * scale, scale, scale, c);
      }
      x += GLYPH_W * scale;
    }
  }
  /** Tiny 3x5 text (4 px advance) for store signs. */
  tiny(str: string, x: number, y: number, c: number): number {
    x |= 0; y |= 0;
    for (const ch of str) {
      const g = TINY[ch] ?? TINY[ch.toUpperCase()];
      if (g) this.spr(g, x, y, false, null, c);
      x += TINY_W;
    }
    return x;
  }
  tinyC(str: string, cx: number, y: number, c: number): void {
    this.tiny(str, Math.round(cx - (str.length * TINY_W - 1) / 2), y, c);
  }
  /** Convert to RGBA bytes (for WebGL upload / PNG dumps). */
  toRGBA(out: Uint8Array | Uint8ClampedArray): void {
    const o32 = new Uint32Array(out.buffer, out.byteOffset, this.w * this.h);
    const p = this.px;
    for (let i = 0; i < p.length; i++) o32[i] = PALETTE_ABGR[p[i] & 63];
  }
}
