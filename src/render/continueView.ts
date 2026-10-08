import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText } from '../engine/font';
import { UI, continuesLeft } from '../content/copy';
import { CONTINUE_FRAMES_PER_COUNT, CONTINUE_SECONDS } from '../game/screens/continue';
import { blinkOn, H, W } from './screenFx';

/** What the view reads from the ContinueScreen. */
export interface ContinueViewState {
  count: number;
  /** Frame inside the current second, 0..59. */
  tick: number;
  urgent: boolean;
  continuesLeft: number;
  frame: number;
}

const CX = W / 2;
const CY = 122;

/** A ring that unwinds once per second (clockwise from the top). */
function drawRing(fb: Framebuffer, remaining: number, color: number): void {
  const r = 62;
  const steps = 180;
  for (let i = 0; i < steps; i++) {
    if (i / steps > remaining) break;
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    fb.fillRect(Math.round(CX + Math.cos(a) * r), Math.round(CY + Math.sin(a) * r), 3, 3, color);
  }
}

export function drawContinue(fb: Framebuffer, s: ContinueViewState): void {
  fb.clear(C.BLACK);
  // faint perspective grid so the screen is not an empty void
  for (let y = 0; y < H; y += 16) fb.hLine(0, y, W, C.DKBLUE);
  for (let x = 0; x < W; x += 16) fb.vLine(x, 0, H, C.DKBLUE);
  fb.fillRect(0, 0, W, 40, C.BLACK);
  fb.fillRect(0, 196, W, 44, C.BLACK);

  drawText(fb, UI.continueQ, CX, 14, C.WHITE, { scale: 3, align: 'center', shadow: C.INDIGO });

  const col = s.urgent ? (blinkOn(s.frame, 16, 10) ? C.RED : C.SALMON) : C.YELLOW;
  const flash = s.tick < 5 ? C.WHITE : col;
  drawRing(fb, 1 - s.tick / CONTINUE_FRAMES_PER_COUNT, s.urgent ? C.RED : C.CYAN);
  const digit = String(Math.max(0, s.count));
  const scale = 12;
  const dy = CY - Math.floor((7 * scale) / 2);
  drawText(fb, digit, CX + 5, dy + 5, s.urgent ? C.MAROON : C.DKBLUE, { scale, align: 'center' });
  drawText(fb, digit, CX, dy, flash, { scale, align: 'center' });

  drawText(fb, continuesLeft(s.continuesLeft), CX, 196, C.PALEYELLOW, { align: 'center', shadow: C.BLACK });
  if (blinkOn(s.frame, 50, 32)) drawText(fb, UI.pressStart, CX, 212, C.WHITE, { scale: 2, align: 'center', shadow: C.GRAY });

  // time bar for the whole countdown
  const total = CONTINUE_SECONDS * CONTINUE_FRAMES_PER_COUNT;
  const left = Math.max(0, s.count * CONTINUE_FRAMES_PER_COUNT - s.tick);
  fb.fillRect(16, 234, W - 32, 3, C.MDGRAY);
  const w = Math.round(((W - 32) * left) / total);
  if (w > 0) fb.fillRect(16, 234, w, 3, s.urgent ? C.RED : C.CYAN);
}
