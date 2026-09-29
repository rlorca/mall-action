// Speech bubble: white box, black text, tail pointing down at (cx, bottomY). Always clamped inside `view`.
import { C } from '../core/palette';
import type { Surface } from '../art/surface';

export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FULL_VIEW: ViewRect = { x: 0, y: 16, w: 256, h: 224 };

/** Returns the drawn box rect. `bottomY` is where the tail tip points (the speaker's head). */
export function drawBubble(s: Surface, text: string, cx: number, bottomY: number, view: ViewRect = FULL_VIEW): ViewRect {
  const w = text.length * 8 + 6;
  const h = 12;
  let x = Math.round(cx - w / 2);
  x = Math.max(view.x + 1, Math.min(view.x + view.w - w - 1, x));
  const tail = 4;
  let y = Math.round(bottomY - tail - h);
  y = Math.max(view.y + 1, Math.min(view.y + view.h - h - tail - 1, y));
  s.rect(x, y, w, h, C.BLACK);
  s.rect(x + 1, y + 1, w - 2, h - 2, C.WHITE);
  // tail (clamped so it never leaves the box horizontally)
  const tx = Math.max(x + 3, Math.min(x + w - 7, Math.round(cx) - 2));
  s.rect(tx, y + h, 5, 1, C.BLACK);
  s.rect(tx + 1, y + h + 1, 3, 1, C.BLACK);
  s.rect(tx + 2, y + h + 2, 1, 1, C.BLACK);
  s.rect(tx + 1, y + h - 1, 3, 1, C.WHITE);
  s.text(text, x + 3, y + 2, C.BLACK);
  return { x, y, w, h: h + tail };
}
