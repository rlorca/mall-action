import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_MAIN, textWidth } from '../engine/font';
import type { Banner, Bubble, Popup } from '../game/types';

/**
 * Shared UI widgets. Everything clamps to the 256x240 screen so bubbles and
 * banners can never run off the edge.
 */
export const SCREEN_W = 256;
export const SCREEN_H = 240;

export function drawBox(fb: Framebuffer, x: number, y: number, w: number, h: number, fill: number, border?: number): void {
  fb.fillRect(x, y, w, h, fill);
  if (border !== undefined) fb.strokeRect(x, y, w, h, border);
}

/** Horizontal progress/timer bar; frac 0..1. */
export function drawBar(fb: Framebuffer, x: number, y: number, w: number, h: number, frac: number, fg: number, bg: number = C.BLACK): void {
  fb.fillRect(x, y, w, h, bg);
  const n = Math.max(0, Math.min(w, Math.round(w * frac)));
  if (n > 0) fb.fillRect(x, y, n, h, fg);
}

/**
 * Speech bubble above an anchor point (the speaker's head, in SCREEN pixels).
 * White box, black text, little tail; clamped on screen.
 */
export function drawBubble(fb: Framebuffer, text: string, anchorX: number, anchorY: number, minY = 18): void {
  const tw = textWidth(text);
  const w = tw + 8;
  const h = 13;
  let x = Math.round(anchorX - w / 2);
  x = Math.max(2, Math.min(SCREEN_W - 2 - w, x));
  let y = Math.round(anchorY - h - 4);
  const flipBelow = y < minY;
  if (flipBelow) y = Math.round(anchorY + 6);
  fb.fillRect(x + 1, y, w - 2, h, C.WHITE);
  fb.fillRect(x, y + 1, w, h - 2, C.WHITE);
  fb.strokeRect(x, y, w, h, C.BLACK);
  fb.setPixel(x, y, C.BLACK);
  // tail
  const tx = Math.max(x + 3, Math.min(x + w - 4, Math.round(anchorX)));
  if (flipBelow) {
    fb.setPixel(tx, y - 1, C.BLACK);
    fb.setPixel(tx, y, C.WHITE);
  } else {
    fb.setPixel(tx, y + h, C.BLACK);
    fb.setPixel(tx - 1, y + h - 1, C.BLACK);
    fb.setPixel(tx + 1, y + h - 1, C.BLACK);
    fb.setPixel(tx, y + h - 1, C.WHITE);
  }
  drawText(fb, text, x + 4, y + 3, C.BLACK);
}

export function drawBubbles(fb: Framebuffer, bubbles: readonly Bubble[], camX: number, camY: number): void {
  for (const b of bubbles) if (b.t > 0) drawBubble(fb, b.text, b.x - camX, b.y - camY);
}

/**
 * Message banner: a dark plate with centred text (+ optional extra lines),
 * fading in/out over its first/last frames. `y` is the plate's top.
 */
export function drawBanner(fb: Framebuffer, b: Banner, y = 24): void {
  if (b.t <= 0) return;
  const lines = [b.text, ...(b.lines ?? [])];
  const widest = Math.max(...lines.map((l) => textWidth(l)));
  const w = Math.min(SCREEN_W - 4, widest + 12);
  const h = lines.length * 9 + 5;
  const x = Math.round((SCREEN_W - w) / 2);
  const age = b.total - b.t;
  const fade = Math.min(age < 6 ? 2 - Math.floor(age / 3) : 0, b.t < 12 ? 2 - Math.floor(b.t / 6) : 0);
  fb.fillRect(x, y, w, h, C.BLACK);
  fb.strokeRect(x, y, w, h, fade ? C.MDGRAY : C.WHITE);
  const col = fade >= 2 ? C.MDGRAY : (b.color ?? C.WHITE);
  lines.forEach((l, i) => drawText(fb, l, SCREEN_W / 2, y + 3 + i * 9, col, { align: 'center' }));
}

/** Floating score / text popups; world positions minus camera. */
export function drawPopups(fb: Framebuffer, popups: readonly Popup[], camX: number, camY: number): void {
  for (const p of popups) {
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y - camY);
    drawText(fb, p.text, x, y, p.color ?? C.YELLOW, { align: 'center', shadow: C.BLACK });
  }
}
