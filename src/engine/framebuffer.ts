import { buildRgbaLut, darken, TRANSPARENT } from './palette';
import type { Sprite } from './sprite';
import { SCREEN_H, SCREEN_W } from './scale';

export interface BlitOpts {
  frame?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Recolour LUT from makeRecolor(). */
  recolor?: Uint8Array;
  /** Draw every opaque pixel in this single colour (silhouette / hit flash). */
  solid?: number;
}

const RGBA_LUT = buildRgbaLut();

/**
 * Software framebuffer of NES palette indices (256x240). All game drawing goes
 * here; main.ts converts it to RGBA and uploads it to the WebGL texture. Being
 * pure TypeScript, the whole draw path is testable in Node.
 */
export class Framebuffer {
  readonly w = SCREEN_W;
  readonly h = SCREEN_H;
  readonly px = new Uint8Array(SCREEN_W * SCREEN_H);
  private clipX0 = 0;
  private clipY0 = 0;
  private clipX1 = SCREEN_W;
  private clipY1 = SCREEN_H;
  private clipStack: number[][] = [];

  clear(c: number): void {
    this.px.fill(c);
  }

  /** Restrict drawing to a rectangle (intersected with the screen). Pair with popClip(). */
  pushClip(x: number, y: number, w: number, h: number): void {
    this.clipStack.push([this.clipX0, this.clipY0, this.clipX1, this.clipY1]);
    this.clipX0 = Math.max(this.clipX0, x);
    this.clipY0 = Math.max(this.clipY0, y);
    this.clipX1 = Math.min(this.clipX1, x + w);
    this.clipY1 = Math.min(this.clipY1, y + h);
  }

  popClip(): void {
    const c = this.clipStack.pop();
    if (c) [this.clipX0, this.clipY0, this.clipX1, this.clipY1] = c as [number, number, number, number];
  }

  resetClip(): void {
    this.clipStack.length = 0;
    this.clipX0 = 0;
    this.clipY0 = 0;
    this.clipX1 = SCREEN_W;
    this.clipY1 = SCREEN_H;
  }

  setPixel(x: number, y: number, c: number): void {
    x |= 0;
    y |= 0;
    if (x < this.clipX0 || y < this.clipY0 || x >= this.clipX1 || y >= this.clipY1) return;
    this.px[y * SCREEN_W + x] = c;
  }

  getPixel(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= SCREEN_W || y >= SCREEN_H) return 0x0f;
    return this.px[y * SCREEN_W + x]!;
  }

  fillRect(x: number, y: number, w: number, h: number, c: number): void {
    x |= 0;
    y |= 0;
    const x0 = Math.max(x, this.clipX0);
    const y0 = Math.max(y, this.clipY0);
    const x1 = Math.min(x + (w | 0), this.clipX1);
    const y1 = Math.min(y + (h | 0), this.clipY1);
    for (let yy = y0; yy < y1; yy++) {
      this.px.fill(c, yy * SCREEN_W + x0, yy * SCREEN_W + x1);
    }
  }

  strokeRect(x: number, y: number, w: number, h: number, c: number): void {
    this.fillRect(x, y, w, 1, c);
    this.fillRect(x, y + h - 1, w, 1, c);
    this.fillRect(x, y, 1, h, c);
    this.fillRect(x + w - 1, y, 1, h, c);
  }

  hLine(x: number, y: number, w: number, c: number): void {
    this.fillRect(x, y, w, 1, c);
  }

  vLine(x: number, y: number, h: number, c: number): void {
    this.fillRect(x, y, 1, h, c);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.setPixel(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, c: number): void {
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(r * r - y * y + 0.5));
      this.fillRect(cx - span, cy + y, span * 2 + 1, 1, c);
    }
  }

  /** Checkerboard dither: sets every other pixel (parity 0/1) in a rect. */
  dither(x: number, y: number, w: number, h: number, c: number, parity = 0): void {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (((xx + yy + parity) & 1) === 0) this.setPixel(x + xx, y + yy, c);
      }
    }
  }

  /** Draw a sprite with its top-left corner at (x, y). */
  sprite(s: Sprite, x: number, y: number, opts: BlitOpts = {}): void {
    x |= 0;
    y |= 0;
    const f = (opts.frame ?? 0) % s.frames;
    const base = (f < 0 ? f + s.frames : f) * s.w * s.h;
    const { flipX, flipY, recolor, solid } = opts;
    for (let sy = 0; sy < s.h; sy++) {
      const dy = y + sy;
      if (dy < this.clipY0 || dy >= this.clipY1) continue;
      const srcRow = base + (flipY ? s.h - 1 - sy : sy) * s.w;
      for (let sx = 0; sx < s.w; sx++) {
        const dx = x + sx;
        if (dx < this.clipX0 || dx >= this.clipX1) continue;
        let v = s.data[srcRow + (flipX ? s.w - 1 - sx : sx)]!;
        if (v === TRANSPARENT) continue;
        if (solid !== undefined) v = solid;
        else if (recolor) v = recolor[v]!;
        this.px[dy * SCREEN_W + dx] = v;
      }
    }
  }

  /** Copy a rectangle from another framebuffer (no transparency). */
  blit(src: Framebuffer, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let yy = 0; yy < h; yy++) {
      const y = dy + yy;
      const syy = sy + yy;
      if (y < this.clipY0 || y >= this.clipY1 || syy < 0 || syy >= SCREEN_H) continue;
      for (let xx = 0; xx < w; xx++) {
        const x = dx + xx;
        const sxx = sx + xx;
        if (x < this.clipX0 || x >= this.clipX1 || sxx < 0 || sxx >= SCREEN_W) continue;
        this.px[y * SCREEN_W + x] = src.px[syy * SCREEN_W + sxx]!;
      }
    }
  }

  copyFrom(src: Framebuffer): void {
    this.px.set(src.px);
  }

  /** Darken everything in a rect by `steps` NES luminance rows (fades, pause dimming). */
  darkenRect(x: number, y: number, w: number, h: number, steps: number): void {
    if (steps <= 0) return;
    const x0 = Math.max(x | 0, this.clipX0);
    const y0 = Math.max(y | 0, this.clipY0);
    const x1 = Math.min((x | 0) + w, this.clipX1);
    const y1 = Math.min((y | 0) + h, this.clipY1);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = yy * SCREEN_W + xx;
        this.px[i] = darken(this.px[i]!, steps);
      }
    }
  }

  darkenAll(steps: number): void {
    if (steps <= 0) return;
    for (let i = 0; i < this.px.length; i++) this.px[i] = darken(this.px[i]!, steps);
  }

  /** Convert to RGBA bytes (for the WebGL texture / screenshots). `out` is 256*240*4 bytes. */
  toRGBA(out: Uint8ClampedArray | Uint8Array): void {
    const view = new Uint32Array(out.buffer, out.byteOffset, SCREEN_W * SCREEN_H);
    const px = this.px;
    for (let i = 0; i < px.length; i++) view[i] = RGBA_LUT[px[i]! & 0x3f]!;
  }

  /** Cheap content hash (determinism checks, "did anything change" tests). */
  hash(): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < this.px.length; i++) {
      h ^= this.px[i]!;
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Number of pixels that are not `bg`. */
  countNot(bg: number): number {
    let n = 0;
    for (let i = 0; i < this.px.length; i++) if (this.px[i] !== bg) n++;
    return n;
  }

  /** Debug: render a region as ASCII (one char per distinct colour). */
  dump(x = 0, y = 0, w = this.w, h = this.h): string {
    const chars = '.#@%&*+=-:;~^o0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const seen = new Map<number, string>();
    let out = '';
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const c = this.getPixel(xx, yy);
        if (!seen.has(c)) seen.set(c, chars[seen.size % chars.length]!);
        out += seen.get(c);
      }
      out += '\n';
    }
    return out;
  }
}
