import '../art/index';
import type { BlitOpts, Framebuffer } from '../engine/framebuffer';
import type { Sprite } from '../engine/sprite';
import { C, TRANSPARENT } from '../engine/palette';
import { drawText, textWidth, type TextOpts } from '../engine/font';
import { getSprite, hasSprite } from '../art/registry';

/** Shared drawing helpers for the screen views (title, level clear, game over, map, HUD...). Pure drawing, no state. */
export const W = 256;
export const H = 240;

/** The sprite, or null while an art module has not defined it yet (views then draw a placeholder). */
export function spriteOrNull(name: string): Sprite | null {
  return hasSprite(name) ? getSprite(name) : null;
}

/**
 * Draw a sprite by name at its top-left (x, y). If it is not registered a hot-pink outlined box of
 * `fallback` size is drawn instead so a missing sprite is obvious but never crashes a screen.
 * Returns true when the real sprite was drawn.
 */
export function drawSpriteByName(
  fb: Framebuffer,
  name: string,
  x: number,
  y: number,
  opts: BlitOpts = {},
  fallback: { w: number; h: number } = { w: 16, h: 24 },
): boolean {
  const s = spriteOrNull(name);
  if (!s) {
    fb.strokeRect(x, y, fallback.w, fallback.h, C.HOTPINK);
    return false;
  }
  fb.sprite(s, x, y, opts);
  return true;
}

export interface ScaledOpts {
  frame?: number;
  flipX?: boolean;
  /** Draw every opaque pixel in this single colour. */
  solid?: number;
}

/** Nearest-neighbour integer-scaled sprite blit (cutscene cards, photos). (x, y) is the top-left. */
export function blitScaled(fb: Framebuffer, s: Sprite, x: number, y: number, k: number, opts: ScaledOpts = {}): void {
  const f = (opts.frame ?? 0) % s.frames;
  const base = f * s.w * s.h;
  for (let sy = 0; sy < s.h; sy++) {
    for (let sx = 0; sx < s.w; sx++) {
      const v = s.data[base + sy * s.w + (opts.flipX ? s.w - 1 - sx : sx)]!;
      if (v === TRANSPARENT) continue;
      fb.fillRect(x + sx * k, y + sy * k, k, k, opts.solid ?? v);
    }
  }
}

/** Scaled sprite by name (skips silently when missing). Returns true when drawn. */
export function blitScaledByName(fb: Framebuffer, name: string, x: number, y: number, k: number, opts: ScaledOpts = {}): boolean {
  const s = spriteOrNull(name);
  if (!s) {
    return false;
  }
  blitScaled(fb, s, x, y, k, opts);
  return true;
}

export interface TwoToneOpts {
  scale: number;
  /** Colour of the upper `split` glyph rows and of the rest. */
  top: number;
  bottom: number;
  /** Glyph rows (of 7) that use `top`. */
  split?: number;
  outline?: number;
  shadow?: number;
  align?: 'left' | 'center' | 'right';
  font?: TextOpts['font'];
}

/** Big logo text with two colours stacked inside each letter (upper rows / lower rows). Returns the left x used. */
export function drawTwoTone(fb: Framebuffer, text: string, x: number, y: number, o: TwoToneOpts): number {
  const base: TextOpts = { scale: o.scale, align: o.align, font: o.font };
  if (o.outline !== undefined) {
    // the outline pass: draw once in the outline colour (drawText adds the 8-way outline around the glyphs)
    drawText(fb, text, x, y, o.outline, { ...base, outline: o.outline, shadow: o.shadow });
  } else if (o.shadow !== undefined) {
    drawText(fb, text, x, y, o.shadow, { ...base, shadow: o.shadow });
  }
  const w = textWidth(text, base);
  const left = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
  const split = (o.split ?? 4) * o.scale;
  const h = 7 * o.scale;
  fb.pushClip(left - 1, y - 1, w + 2, split + 1);
  drawText(fb, text, x, y, o.top, base);
  fb.popClip();
  fb.pushClip(left - 1, y + split, w + 2, h - split + 1);
  drawText(fb, text, x, y, o.bottom, base);
  fb.popClip();
  return left;
}

/** True for the "on" part of a blink: `period` frames per cycle, on for `on` of them. */
export function blinkOn(frame: number, period = 32, on = period / 2): boolean {
  return frame % period < on;
}

/** Centered text helper (centre x = 128 by default). */
export function centerText(fb: Framebuffer, text: string, y: number, color: number, opts: TextOpts = {}, cx = W / 2): void {
  drawText(fb, text, cx, y, color, { ...opts, align: 'center' });
}

/** Zero-padded score, clamped to 6 digits. */
export function pad6(n: number): string {
  return String(Math.max(0, Math.min(999999, Math.floor(n)))).padStart(6, '0');
}

/** A tiny deterministic hash-to-[0,1) so views can scatter stars/windows without any random source. */
export function hash01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * Recolour LUT that turns a sprite's colours into newsprint greys (darkest -> black, lightest -> light grey),
 * for the front-page photo. Based on the NES luminance row of each colour.
 */
export function grayRecolor(s: Sprite): Uint8Array {
  const lut = new Uint8Array(64);
  for (let i = 0; i < 64; i++) lut[i] = i;
  const cols = [...s.colors].sort((a, b) => (a >> 4) - (b >> 4));
  const greys = cols.length <= 1 ? [C.GRAY] : cols.length === 2 ? [C.BLACK, C.LTGRAY] : [C.BLACK, C.GRAY, C.LTGRAY];
  cols.forEach((c, i) => {
    lut[c] = greys[Math.min(i, greys.length - 1)]!;
  });
  return lut;
}

/** Number with thousands separators (no locale APIs: 1234 -> "1,234"). */
export function withCommas(n: number): string {
  const s = String(Math.max(0, Math.floor(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}
