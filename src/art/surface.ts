// Drawing surface: a 256x240 canvas wrapper. All drawing uses master palette indices and whole pixels.
import { pal } from '../core/palette';
import { frameToRGBA, type SpriteDef } from './pixel';
import { FONT3_ADVANCE, FONT8_ADVANCE, glyph3, glyph8 } from './font';
import { getSprite } from './registry';

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const spriteCache = new Map<string, HTMLCanvasElement>();
const glyphCache = new Map<string, HTMLCanvasElement>();

export interface SpriteOpts {
  frame?: number;
  flipX?: boolean;
  alpha?: number;
  /** Replace colour slots 1..3 with master palette indices (e.g. hit flash, tinting). */
  remap?: number[];
}

export interface TextOpts {
  small?: boolean; // tiny 3x5 font
  align?: 'left' | 'center' | 'right';
  shadow?: number; // palette index of a 1px drop shadow
  spacing?: number; // extra px between characters
}

export class Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
  constructor(readonly w = 256, readonly h = 240) {
    this.canvas = makeCanvas(w, h);
    const c = this.canvas.getContext('2d', { alpha: false });
    if (!c) throw new Error('2D canvas unavailable');
    this.ctx = c;
    this.ctx.imageSmoothingEnabled = false;
  }
  clear(color: number): void {
    this.ctx.fillStyle = pal(color);
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
  rect(x: number, y: number, w: number, h: number, color: number): void {
    this.ctx.fillStyle = pal(color);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  px(x: number, y: number, color: number): void {
    this.rect(x, y, 1, 1, color);
  }
  hline(x: number, y: number, w: number, color: number): void {
    this.rect(x, y, w, 1, color);
  }
  vline(x: number, y: number, h: number, color: number): void {
    this.rect(x, y, 1, h, color);
  }
  frame(x: number, y: number, w: number, h: number, color: number): void {
    this.hline(x, y, w, color);
    this.hline(x, y + h - 1, w, color);
    this.vline(x, y, h, color);
    this.vline(x + w - 1, y, h, color);
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
  setAlpha(a: number): void {
    this.ctx.globalAlpha = a;
  }
  private spriteCanvas(def: SpriteDef, o: SpriteOpts): HTMLCanvasElement {
    const frame = o.frame ?? 0;
    const flip = !!o.flipX;
    const key = `${def.name}|${frame % def.frames.length}|${flip ? 1 : 0}|${o.remap ? o.remap.join(',') : ''}`;
    let c = spriteCache.get(key);
    if (!c) {
      c = makeCanvas(def.w, def.h);
      const cx = c.getContext('2d')!;
      const tint = o.remap ? (slot: number) => o.remap![slot - 1] ?? def.colors[slot - 1] : undefined;
      cx.putImageData(new ImageData(frameToRGBA(def, frame, flip, tint) as unknown as Uint8ClampedArray<ArrayBuffer>, def.w, def.h), 0, 0);
      spriteCache.set(key, c);
    }
    return c;
  }
  sprite(s: SpriteDef | string, x: number, y: number, o: SpriteOpts = {}): void {
    const def = typeof s === 'string' ? getSprite(s) : s;
    const c = this.spriteCanvas(def, o);
    if (o.alpha !== undefined) this.ctx.globalAlpha = o.alpha;
    this.ctx.drawImage(c, Math.round(x), Math.round(y));
    if (o.alpha !== undefined) this.ctx.globalAlpha = 1;
  }
  /** Draw a sprite enlarged by an integer factor (nearest neighbour). Used by the gallery and big UI art. */
  spriteScaled(s: SpriteDef | string, x: number, y: number, scale: number, o: SpriteOpts = {}): void {
    const def = typeof s === 'string' ? getSprite(s) : s;
    const c = this.spriteCanvas(def, o);
    if (o.alpha !== undefined) this.ctx.globalAlpha = o.alpha;
    this.ctx.drawImage(c, Math.round(x), Math.round(y), def.w * scale, def.h * scale);
    if (o.alpha !== undefined) this.ctx.globalAlpha = 1;
  }
  textWidth(str: string, small = false, spacing = 0): number {
    return str.length * ((small ? FONT3_ADVANCE : FONT8_ADVANCE) + spacing) - (str.length ? spacing : 0);
  }
  text(str: string, x: number, y: number, color: number, o: TextOpts = {}): void {
    const adv = (o.small ? FONT3_ADVANCE : FONT8_ADVANCE) + (o.spacing ?? 0);
    const width = this.textWidth(str, !!o.small, o.spacing ?? 0);
    let px = Math.round(o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x);
    const py = Math.round(y);
    if (o.shadow !== undefined) {
      let sx = px + 1;
      for (const ch of str) {
        this.drawGlyph(ch, sx, py + 1, o.shadow, !!o.small);
        sx += adv;
      }
    }
    for (const ch of str) {
      this.drawGlyph(ch, px, py, color, !!o.small);
      px += adv;
    }
  }
  private drawGlyph(ch: string, x: number, y: number, color: number, small: boolean): void {
    const g = small ? glyph3(ch) : glyph8(ch);
    if (!g) return;
    const key = `${small ? 3 : 8}|${ch}|${color}`;
    let c = glyphCache.get(key);
    if (!c) {
      const h = g.length;
      const w = g[0].length;
      c = makeCanvas(w, h);
      const cx = c.getContext('2d')!;
      cx.fillStyle = pal(color);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (g[yy][xx] === '#') cx.fillRect(xx, yy, 1, 1);
      glyphCache.set(key, c);
    }
    this.ctx.drawImage(c, x, y);
  }
}
