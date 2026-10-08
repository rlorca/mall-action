import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_TINY, textWidth } from '../engine/font';
import { UI, wrapWords } from '../content/copy';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { grayRecolor, hash01, spriteOrNull, H, W } from './screenFx';

/**
 * Front page of THE DAILY MALL: masthead, a big random headline, a little halftone "photo" of the getaway
 * wagon and the chasing spy, and columns of greeked text. The page slides in from below over its first
 * NEWS_SLIDE_FRAMES frames. The headline is wrapped with wrapWords (copy.ts) at NEWS_HEADLINE_CHARS so that the
 * scale-2 headline always fits the page; every headline line is therefore also within the 26-char copy limit.
 */
export const NEWS_SLIDE_FRAMES = 22;
export const NEWS_HEADLINE_CHARS = 18;
const PAGE = { x: 8, y: 6, w: 240, h: 228 } as const;
const INK = C.BLACK;
const PAPER = C.PEACH;

export function headlineLines(headline: string): string[] {
  return wrapWords(headline, NEWS_HEADLINE_CHARS);
}

/** Rows of greyed-out "text" so the page looks like a page. */
function greek(fb: Framebuffer, x: number, y: number, w: number, rows: number, seed: number): void {
  for (let r = 0; r < rows; r++) {
    const last = r === rows - 1;
    const len = last ? Math.floor(w * (0.3 + hash01(seed, r) * 0.5)) : w - Math.floor(hash01(seed, r + 50) * 6);
    fb.hLine(x, y + r * 4, len, C.GRAY);
  }
}

/** The halftone newsprint photo: wagon pulling away, the spy running after it with a receipt. */
function drawPhoto(fb: Framebuffer, x: number, y: number, w: number, h: number, frame: number): void {
  fb.fillRect(x, y, w, h, C.LTGRAY);
  fb.dither(x, y, w, 40, C.WHITE);
  // garage ceiling + pillars + floor
  fb.fillRect(x, y, w, 8, C.GRAY);
  fb.dither(x, y + 8, w, 3, C.GRAY);
  for (const px of [x + 12, x + 62, x + 98]) {
    fb.fillRect(px, y + 8, 8, h - 22, C.MDGRAY);
    fb.vLine(px, y + 8, h - 22, C.GRAY);
  }
  fb.fillRect(x, y + h - 16, w, 16, C.GRAY);
  fb.dither(x, y + h - 16, w, 16, C.MDGRAY);
  for (let i = 0; i < 6; i++) fb.fillRect(x + 6 + i * 20, y + h - 9, 10, 1, C.LTGRAY);

  const wag = spriteOrNull('wagon');
  const spy = spriteOrNull('spy.walk');
  const wx = x + w - 72 - 2 - ((frame >> 3) % 3);
  if (wag) fb.sprite(wag, wx, y + h - 14 - wag.h + 6, { recolor: grayRecolor(wag) });
  else fb.strokeRect(wx, y + h - 36, 72, 28, C.BLACK);
  const sx = x + 8;
  const sy = y + h - 14 - 24 + 6;
  if (spy) fb.sprite(spy, sx, sy, { frame: (frame >> 3) & 3, recolor: grayRecolor(spy) });
  else fb.strokeRect(sx, sy, 16, 24, C.BLACK);
  // the receipt
  fb.fillRect(sx + 14, sy - 6, 5, 9, C.WHITE);
  fb.strokeRect(sx + 14, sy - 6, 5, 9, C.BLACK);
  fb.hLine(sx + 15, sy - 4, 3, C.GRAY);
  fb.hLine(sx + 15, sy - 2, 3, C.GRAY);
  // grain
  for (let i = 0; i < 40; i++) {
    const gx = x + Math.floor(hash01(i, 9) * w);
    const gy = y + Math.floor(hash01(i, 10) * h);
    fb.setPixel(gx, gy, hash01(i, 12) > 0.5 ? C.WHITE : C.GRAY);
  }
}

/** `frame` = frames since the newspaper phase began (drives the slide-in). */
export function drawNewspaper(fb: Framebuffer, headline: string, frame: number): void {
  // desk behind the page
  fb.fillRect(0, 0, W, H, C.DKBLUE);
  fb.dither(0, 0, W, H, C.BLACK);

  const t = Math.min(1, frame / NEWS_SLIDE_FRAMES);
  const slide = Math.round((1 - (1 - t) * (1 - t)) * 1000) / 1000; // ease-out
  const oy = Math.round((1 - slide) * (H - PAGE.y));
  const px = PAGE.x;
  const py = PAGE.y + oy;
  fb.fillRect(px + 3, py + 3, PAGE.w, PAGE.h, C.BLACK);
  fb.fillRect(px, py, PAGE.w, PAGE.h, PAPER);
  fb.strokeRect(px, py, PAGE.w, PAGE.h, INK);

  // top furniture
  drawText(fb, SCREEN_TEXT.news.edition, px + 8, py + 6, INK, { font: FONT_TINY });
  drawText(fb, SCREEN_TEXT.news.price, px + PAGE.w - 8, py + 6, INK, { font: FONT_TINY, align: 'right' });

  // masthead
  const mw = textWidth(UI.newspaperName, { scale: 2 });
  const mx = px + Math.floor((PAGE.w - mw) / 2);
  drawText(fb, UI.newspaperName, mx + 1, py + 15, INK, { scale: 2 });
  drawText(fb, UI.newspaperName, mx, py + 15, INK, { scale: 2 });
  for (const sx of [px + 8, px + PAGE.w - 8 - 24]) {
    for (let i = 0; i < 4; i++) fb.fillRect(sx + i * 6, py + 18 + (i % 2) * 2, 4, 4, INK);
  }
  fb.fillRect(px + 6, py + 35, PAGE.w - 12, 3, INK);
  fb.hLine(px + 6, py + 40, PAGE.w - 12, INK);
  drawText(fb, SCREEN_TEXT.news.tagline, px + PAGE.w / 2, py + 44, INK, { font: FONT_TINY, align: 'center' });
  fb.hLine(px + 6, py + 52, PAGE.w - 12, INK);

  // headline
  const lines = headlineLines(headline);
  let hy = py + 58;
  for (const l of lines) {
    const lw = textWidth(l, { scale: 2 });
    const lx = px + Math.floor((PAGE.w - lw) / 2);
    drawText(fb, l, lx, hy, INK, { scale: 2 });
    drawText(fb, l, lx + 1, hy, INK, { scale: 2 });
    hy += 16;
  }
  const bodyTop = hy + 5;
  fb.hLine(px + 6, bodyTop - 2, PAGE.w - 12, INK);

  // photo + caption bars (left), text column (right)
  const photoW = 112;
  const photoH = 70;
  const phx = px + 8;
  const phy = bodyTop + 4;
  fb.strokeRect(phx - 1, phy - 1, photoW + 2, photoH + 2, INK);
  fb.pushClip(phx, phy, photoW, photoH);
  drawPhoto(fb, phx, phy, photoW, photoH, frame);
  fb.popClip();
  greek(fb, phx, phy + photoH + 5, photoW, 2, 3);

  const colX = phx + photoW + 8;
  const colW = px + PAGE.w - 8 - colX;
  greek(fb, colX, phy, colW, Math.floor((photoH + 10) / 4), headline.length);

  // lower columns
  const lowY = phy + photoH + 18;
  fb.hLine(px + 6, lowY - 3, PAGE.w - 12, INK);
  const rows = Math.max(0, Math.floor((py + PAGE.h - 8 - lowY) / 4));
  const cw = Math.floor((PAGE.w - 16 - 8) / 3);
  for (let c = 0; c < 3; c++) {
    const cx = px + 8 + c * (cw + 4);
    greek(fb, cx, lowY, cw, rows, 20 + c);
    if (c < 2) fb.vLine(cx + cw + 1, lowY, rows * 4, C.GRAY);
  }

}
