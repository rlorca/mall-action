/** Speech bubbles, score popups and banners. Bubbles and popups are clamped so they always stay on screen. */
import { C } from '../core/palette';
import { MAIN_FONT, TINY_FONT, textWidth } from '../core/font';
import type { Banner, Bubble, Popup } from '../game/state';
import { Gfx, HUD_H, SCREEN_H, SCREEN_W } from './gfx';

export function bubbleBox(text: string, x: number, y: number, top = HUD_H + 1, bottom = SCREEN_H - 1): { bx: number; by: number; w: number; h: number } {
  const w = textWidth(MAIN_FONT, text) + 6;
  const h = 11;
  const bx = Math.max(6, Math.min(SCREEN_W - 6 - w, Math.round(x - w / 2)));
  const by = Math.max(top, Math.min(bottom - h - 4, Math.round(y - h - 4)));
  return { bx, by, w, h };
}

export function drawBubble(gx: Gfx, text: string, sx: number, sy: number, top = HUD_H + 1, bottom = SCREEN_H - 1): void {
  const { bx, by, w, h } = bubbleBox(text, sx, sy, top, bottom);
  gx.rect(bx - 1, by - 1, w + 2, h + 2, C.BLACK);
  gx.rect(bx, by, w, h, C.WHITE);
  // Tail toward the speaker.
  const tx = Math.max(bx + 3, Math.min(bx + w - 5, Math.round(sx) - 1));
  if (sy > by + h) {
    gx.rect(tx, by + h, 3, 2, C.WHITE);
    gx.rect(tx + 1, by + h + 2, 1, 2, C.WHITE);
  }
  gx.text(text, bx + 3, by + 2, C.BLACK);
}

export function drawBubbles(gx: Gfx, list: Bubble[], ox: number, oy: number, top = HUD_H + 1, bottom = SCREEN_H - 1): void {
  for (const b of list) drawBubble(gx, b.text, b.x - ox, b.y - oy, top, bottom);
}

export function drawPopups(gx: Gfx, list: Popup[], ox: number, oy: number): void {
  for (const p of list) {
    const w = textWidth(TINY_FONT, p.text);
    const x = Math.max(1, Math.min(SCREEN_W - w - 1, Math.round(p.x - ox - w / 2)));
    const y = Math.max(HUD_H + 1, Math.min(SCREEN_H - 7, Math.round(p.y - oy)));
    gx.text(p.text, x, y, p.text.startsWith('-') || p.text.startsWith('DETAINED') ? C.RED : C.WHITE, { font: TINY_FONT, shadow: C.BLACK });
  }
}

/** Centre-screen banner (with a dark plate). */
export function drawBanner(gx: Gfx, b: Banner, y: number, frame: number): void {
  if (b.big && b.total - b.t < 30 && Math.floor(frame / 3) % 2 === 0) return; // flash in
  const lines = b.lines;
  const w = Math.max(...lines.map((l) => textWidth(MAIN_FONT, l))) + 12;
  const h = lines.length * 9 + 5;
  const x = Math.round((SCREEN_W - w) / 2);
  gx.rect(x - 1, y - 1, w + 2, h + 2, b.color);
  gx.rect(x, y, w, h, C.BLACK);
  lines.forEach((l, i) => gx.textC(l, SCREEN_W / 2, y + 3 + i * 9, b.color));
}
