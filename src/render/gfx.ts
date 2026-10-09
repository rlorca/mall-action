import { frameOf, spriteDef, toRGBA } from '../art/index';
import { FONT3, FONT5, FontDef, textWidth } from '../art/font';
import { nesCss } from '../art/palette';

export type Col = number | string;

export function css(c: Col): string {
  return typeof c === 'number' ? nesCss(c) : c;
}

export interface TextOpts {
  font?: 5 | 3;
  scale?: number;
  shadow?: Col;
  align?: 'left' | 'center' | 'right';
}

/**
 * Thin drawing layer over a 256x240 canvas. All coordinates are integers in NES pixels; sprites and glyphs are
 * pre-rendered into small canvases (cached) so a frame is just a few hundred drawImage calls.
 */
export class Gfx {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private spriteCache = new Map<string, HTMLCanvasElement>();
  private glyphCache = new Map<string, HTMLCanvasElement>();

  constructor(
    readonly w = 256,
    readonly h = 240,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(c: Col = 0x0f): void {
    this.ctx.fillStyle = css(c);
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
  rect(x: number, y: number, w: number, h: number, c: Col): void {
    this.ctx.fillStyle = css(c);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }
  px(x: number, y: number, c: Col): void {
    this.rect(x, y, 1, 1, c);
  }
  hline(x: number, y: number, w: number, c: Col): void {
    this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: Col): void {
    this.rect(x, y, 1, h, c);
  }
  /** Filled disc. */
  disc(cx: number, cy: number, r: number, c: Col): void {
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y + 0.5));
      this.rect(cx - w, cy + y, w * 2 + 1, 1, c);
    }
  }
  box(x: number, y: number, w: number, h: number, c: Col): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }
  alpha(a: number): void {
    this.ctx.globalAlpha = a;
  }
  /** Fill the whole screen with a translucent colour. */
  veil(c: Col, a: number): void {
    this.ctx.globalAlpha = a;
    this.rect(0, 0, this.w, this.h, c);
    this.ctx.globalAlpha = 1;
  }
  clip(x: number, y: number, w: number, h: number): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }
  unclip(): void {
    this.ctx.restore();
  }

  // ------------------------------------------------------------ sprites
  private canvasFor(name: string, frame: number, flip: boolean, tint?: readonly [number, number, number]): HTMLCanvasElement {
    const bm = frameOf(name, frame);
    const key = `${name}#${frame % spriteDef(name).frames.length}#${flip ? 1 : 0}${tint ? '#' + tint.join(',') : ''}`;
    let c = this.spriteCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = bm.w;
      c.height = bm.h;
      const cx = c.getContext('2d')!;
      const img = cx.createImageData(bm.w, bm.h);
      img.data.set(toRGBA(bm, flip, tint));
      cx.putImageData(img, 0, 0);
      this.spriteCache.set(key, c);
    }
    return c;
  }
  /** Same sprite with its 3 palette colours swapped (cinnabomb flash, ghost tints). */
  spriteTint(name: string, frame: number, x: number, y: number, flip: boolean, pal: readonly [number, number, number]): void {
    this.ctx.drawImage(this.canvasFor(name, frame, flip, pal), Math.floor(x), Math.floor(y));
  }
  /** Darken a rectangle (dim windows of cleared stores, pause overlay ...). */
  dim(x: number, y: number, w: number, h: number, a = 0.55): void {
    this.ctx.globalAlpha = a;
    this.rect(x, y, w, h, 0x0f);
    this.ctx.globalAlpha = 1;
  }
  sprite(name: string, frame: number, x: number, y: number, flip = false): void {
    this.ctx.drawImage(this.canvasFor(name, frame, flip), Math.floor(x), Math.floor(y));
  }
  /** Draw a sub-rectangle of a sprite. */
  spriteSub(name: string, frame: number, sx: number, sy: number, sw: number, sh: number, x: number, y: number, flip = false): void {
    const c = this.canvasFor(name, frame, flip);
    const w = c.width;
    const rsx = flip ? w - sx - sw : sx;
    this.ctx.drawImage(c, rsx, sy, sw, sh, Math.floor(x), Math.floor(y), sw, sh);
  }
  spriteAt(name: string, frame: number, cx: number, cy: number, flip = false): void {
    const d = spriteDef(name);
    this.sprite(name, frame, cx - d.w / 2, cy - d.h / 2, flip);
  }
  spriteScaled(name: string, frame: number, x: number, y: number, s: number, flip = false): void {
    const c = this.canvasFor(name, frame, flip);
    this.ctx.drawImage(c, Math.floor(x), Math.floor(y), c.width * s, c.height * s);
  }

  // ------------------------------------------------------------ text
  private fontOf(f: 5 | 3): FontDef {
    return f === 5 ? FONT5 : FONT3;
  }
  private glyph(font: FontDef, ch: string, color: string): HTMLCanvasElement | null {
    const g = font.glyphs.get(ch);
    if (!g) return null;
    const key = `${font.name}|${ch}|${color}`;
    let c = this.glyphCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = font.w;
      c.height = font.h;
      const cx = c.getContext('2d')!;
      cx.fillStyle = color;
      for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === '1') cx.fillRect(q, r, 1, 1);
      this.glyphCache.set(key, c);
    }
    return c;
  }
  measure(text: string, o: TextOpts = {}): number {
    return textWidth(this.fontOf(o.font ?? 5), text, o.scale ?? 1);
  }
  text(text: string, x: number, y: number, color: Col = 0x30, o: TextOpts = {}): void {
    const font = this.fontOf(o.font ?? 5);
    const s = o.scale ?? 1;
    const w = textWidth(font, text, s);
    let cx = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
    cx = Math.floor(cx);
    y = Math.floor(y);
    const draw = (col: Col, ox: number, oy: number) => {
      const cs = css(col);
      let px = cx + ox;
      for (const raw of text) {
        const g = this.glyph(font, raw.toUpperCase(), cs);
        if (g) this.ctx.drawImage(g, px, y + oy, font.w * s, font.h * s);
        px += font.advance * s;
      }
    };
    if (o.shadow !== undefined) draw(o.shadow, s, s);
    draw(color, 0, 0);
  }
  /** Two-tone text: top half one colour, bottom half another (title logo). */
  textTwoTone(text: string, x: number, y: number, top: Col, bottom: Col, scale: number, shadow?: Col): void {
    const font = FONT5;
    const w = textWidth(font, text, scale);
    const cx = Math.floor(x - w / 2);
    const split = y + Math.floor((font.h * scale) / 2) + 1;
    if (shadow !== undefined) this.text(text, cx + scale, y + scale, shadow, { scale });
    this.clip(0, 0, this.w, split);
    this.text(text, cx, y, top, { scale });
    this.unclip();
    this.clip(0, split, this.w, this.h - split);
    this.text(text, cx, y, bottom, { scale });
    this.unclip();
  }
}
