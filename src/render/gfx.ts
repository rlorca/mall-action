/**
 * Drawing primitives on the 256x240 NES-resolution frame buffer.
 * Colours are always NES palette indices; positions are rounded to whole pixels.
 */
import { NES_PALETTE, rgb } from '../core/palette';
import { parseSprite, flipX, type Sprite } from '../core/pixelart';
import { MAIN_FONT, TINY_FONT, textWidth, type Font } from '../core/font';
import { SPRITE_DEFS } from '../art/sprites';

export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;

type Canvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Gfx {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private sprites = new Map<string, Sprite>();
  private images = new Map<string, Canvas>();
  private glyphCache = new Map<string, Canvas>();
  private frameCounts = new Map<string, number>();
  /** Camera offset applied by world-space draws. */
  ox = 0;
  oy = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    for (const [name, def] of Object.entries(SPRITE_DEFS)) this.sprites.set(name, parseSprite(def, name));
  }

  has(name: string): boolean {
    return this.sprites.has(name);
  }

  sprite(name: string): Sprite | undefined {
    return this.sprites.get(name);
  }

  /** Number of animation frames <base>_0 .. <base>_{n-1}. */
  frames(base: string): number {
    let n = this.frameCounts.get(base);
    if (n === undefined) {
      n = 0;
      while (this.sprites.has(`${base}_${n}`)) n++;
      this.frameCounts.set(base, n);
    }
    return n;
  }

  /** Name of animation frame for a counter (ticks per frame = speed). */
  anim(base: string, t: number, speed = 8): string {
    const n = this.frames(base);
    if (n === 0) return base;
    return `${base}_${Math.floor(t / speed) % n}`;
  }

  private image(name: string, flip: boolean, colors?: number[]): Canvas | null {
    const key = `${name}|${flip ? 1 : 0}|${colors ? colors.join(',') : ''}`;
    let img = this.images.get(key);
    if (img) return img;
    let s = this.sprites.get(name);
    if (!s) return null;
    if (flip) s = flipX(s);
    const cols = colors ?? s.colors;
    img = makeCanvas(s.w, s.h);
    const c = img.getContext('2d') as CanvasRenderingContext2D;
    const data = c.createImageData(s.w, s.h);
    const rgbs = cols.map((i) => rgb(i));
    for (let i = 0; i < s.pixels.length; i++) {
      const v = s.pixels[i];
      if (!v) continue;
      const [r, g, b] = rgbs[v - 1] ?? rgbs[0];
      data.data[i * 4] = r;
      data.data[i * 4 + 1] = g;
      data.data[i * 4 + 2] = b;
      data.data[i * 4 + 3] = 255;
    }
    c.putImageData(data, 0, 0);
    this.images.set(key, img);
    return img;
  }

  /** Draw a sprite with its top-left at (x, y) in screen space. */
  spr(name: string, x: number, y: number, flip = false, colors?: number[]): void {
    const img = this.image(name, flip, colors);
    if (img) this.ctx.drawImage(img as CanvasImageSource, Math.round(x), Math.round(y));
  }

  /** Draw a sprite scaled up by a whole number (nearest neighbour). */
  sprScaled(name: string, x: number, y: number, scale: number, flip = false, colors?: number[]): void {
    const img = this.image(name, flip, colors);
    const s = this.sprites.get(name);
    if (!img || !s) return;
    this.ctx.drawImage(img as CanvasImageSource, 0, 0, s.w, s.h, Math.round(x), Math.round(y), s.w * scale, s.h * scale);
  }

  /** Draw a sprite in world space: (x, y) is bottom-centre (feet). */
  wspr(name: string, x: number, y: number, flip = false, colors?: number[]): void {
    const s = this.sprites.get(name);
    if (!s) return;
    this.spr(name, Math.round(x - s.w / 2) - this.ox, Math.round(y - s.h) - this.oy, flip, colors);
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    this.ctx.fillStyle = NES_PALETTE[c];
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  wrect(x: number, y: number, w: number, h: number, c: number): void {
    this.rect(x - this.ox, y - this.oy, w, h, c);
  }

  frame(x: number, y: number, w: number, h: number, c: number): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** Dim a region (used for dark zones, overlays). alpha 0..1 of black. */
  dim(x: number, y: number, w: number, h: number, alpha: number): void {
    this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private glyph(font: Font, ch: string, c: number): Canvas | null {
    const key = `${font === TINY_FONT ? 't' : 'm'}|${ch}|${c}`;
    let img = this.glyphCache.get(key);
    if (img) return img;
    const g = font.glyphs.get(ch);
    if (!g) return null;
    img = makeCanvas(font.glyphW, font.glyphH);
    const cx = img.getContext('2d') as CanvasRenderingContext2D;
    cx.fillStyle = NES_PALETTE[c];
    for (let y = 0; y < font.glyphH; y++) for (let x = 0; x < font.glyphW; x++) if (g[y * font.glyphW + x]) cx.fillRect(x, y, 1, 1);
    this.glyphCache.set(key, img);
    return img;
  }

  /** Draw text (upper-cased). Optional 1-px drop shadow colour. */
  text(s: string, x: number, y: number, c: number, opts: { font?: Font; shadow?: number } = {}): void {
    const font = opts.font ?? MAIN_FONT;
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch0 of s.toUpperCase()) {
      const ch = font.glyphs.has(ch0) ? ch0 : '?';
      if (ch !== ' ') {
        if (opts.shadow !== undefined) {
          const sh = this.glyph(font, ch, opts.shadow);
          if (sh) this.ctx.drawImage(sh as CanvasImageSource, cx + 1, cy + 1);
        }
        const img = this.glyph(font, ch, c);
        if (img) this.ctx.drawImage(img as CanvasImageSource, cx, cy);
      }
      cx += font.advance;
    }
  }

  textC(s: string, cx: number, y: number, c: number, opts: { font?: Font; shadow?: number } = {}): void {
    const font = opts.font ?? MAIN_FONT;
    this.text(s, Math.round(cx - textWidth(font, s.toUpperCase()) / 2), y, c, opts);
  }

  /** Big block text: each glyph pixel becomes a scale x scale block; rows split into two tones. */
  bigText(s: string, x: number, y: number, scale: number, top: number, bottom: number, shadow?: number, splitRow = 4): void {
    const font = MAIN_FONT;
    let cx = x;
    for (const ch0 of s.toUpperCase()) {
      const g = font.glyphs.get(ch0);
      if (g) {
        for (let gy = 0; gy < font.glyphH; gy++) {
          for (let gx = 0; gx < font.glyphW; gx++) {
            if (!g[gy * font.glyphW + gx]) continue;
            if (shadow !== undefined) this.rect(cx + gx * scale + 1, y + gy * scale + 1, scale, scale, shadow);
          }
        }
        for (let gy = 0; gy < font.glyphH; gy++) {
          for (let gx = 0; gx < font.glyphW; gx++) {
            if (!g[gy * font.glyphW + gx]) continue;
            this.rect(cx + gx * scale, y + gy * scale, scale, scale, gy < splitRow ? top : bottom);
          }
        }
      }
      cx += font.advance * scale;
    }
  }

  bigWidth(s: string, scale: number): number {
    return textWidth(MAIN_FONT, s) * scale;
  }

  clear(c: number): void {
    this.rect(0, 0, SCREEN_W, SCREEN_H, c);
  }
}

export { MAIN_FONT, TINY_FONT, textWidth };
