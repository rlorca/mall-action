// Small drawing / text helpers shared by the full-screen screens. Pure (only draw through Surface).
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import { glyph8 } from '../art/font';
import type { Surface } from '../art/surface';

/** Screen columns available to 8x8 text. */
export const COLS = SCREEN_W / 8;

/** True during the "on" half of a blink with the given full period (frames). */
export function blinkOn(tick: number, period = 32): boolean {
  return tick % period < period / 2;
}

/** 6-digit zero padded score. */
export function pad6(n: number): string {
  return String(Math.max(0, Math.min(999999, Math.floor(n)))).padStart(6, '0');
}

export function bigTextWidth(str: string, scale: number): number {
  return str.length * 8 * scale;
}

/**
 * Text drawn from the 8x8 font glyph data, enlarged by an integer factor using solid rects.
 * `x` is the left edge unless align is 'center' (x = centre).
 */
export function bigText(
  s: Surface,
  str: string,
  x: number,
  y: number,
  scale: number,
  color: number,
  o: { align?: 'left' | 'center' | 'right'; shadow?: number } = {},
): void {
  const w = bigTextWidth(str, scale);
  let px = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  const pass = (ox: number, oy: number, col: number): void => {
    let cx = px + ox;
    for (const ch of str) {
      const g = glyph8(ch);
      if (g) {
        for (let r = 0; r < g.length; r++) {
          const row = g[r];
          let c = 0;
          while (c < row.length) {
            if (row[c] !== '#') {
              c++;
              continue;
            }
            let e = c;
            while (e < row.length && row[e] === '#') e++;
            s.rect(cx + c * scale, y + oy + r * scale, (e - c) * scale, scale, col);
            c = e;
          }
        }
      }
      cx += 8 * scale;
    }
  };
  if (o.shadow !== undefined) pass(scale, scale, o.shadow);
  pass(0, 0, color);
  px += 0;
}

/** Bold text: double-strike 1px to the right (newspaper look). */
export function boldText(s: Surface, str: string, x: number, y: number, color: number, align: 'left' | 'center' | 'right' = 'left'): void {
  s.text(str, x + 1, y, color, { align });
  s.text(str, x, y, color, { align });
}

/** Bordered box: 1px dark outline, light inner highlight, filled body. */
export function panel(s: Surface, x: number, y: number, w: number, h: number, fill: number, border: number, inner?: number): void {
  s.rect(x, y, w, h, C.BLACK);
  s.rect(x + 1, y + 1, w - 2, h - 2, border);
  s.rect(x + 2, y + 2, w - 4, h - 4, inner ?? C.BLACK);
  s.rect(x + 3, y + 3, w - 6, h - 6, fill);
}

/** Greedy word wrap into at most `maxLines` lines of `cols` chars; the last line is truncated with '..'. */
export function wrapTruncate(text: string, cols: number, maxLines: number): string[] {
  const words = text.split(' ').filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    if (cur === '') cur = wd;
    else if (cur.length + 1 + wd.length <= cols) cur += ' ' + wd;
    else {
      lines.push(cur);
      cur = wd;
    }
  }
  if (cur !== '') lines.push(cur);
  const out = lines.slice(0, maxLines).map((l) => (l.length > cols ? l.slice(0, cols) : l));
  if (lines.length > maxLines) {
    const last = out[maxLines - 1];
    out[maxLines - 1] = (last.length > cols - 2 ? last.slice(0, cols - 2) : last) + '..';
  }
  return out;
}

/** Dim the whole screen: black at the given alpha. */
export function dim(s: Surface, alpha: number): void {
  s.setAlpha(alpha);
  s.rect(0, 0, SCREEN_W, SCREEN_H, C.BLACK);
  s.setAlpha(1);
}
