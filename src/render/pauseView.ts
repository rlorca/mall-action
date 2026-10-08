import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';
import { UI } from '../content/copy';
import { blinkOn, H, W } from './screenFx';

/** Dim steps applied to the frozen game picture behind the PAUSE plate. */
export const PAUSE_DIM_STEPS = 2;

/**
 * Pause overlay: the whole screen is dimmed (NES-style luminance steps) and a framed PAUSE blinks in the
 * middle. Draw it on top of the frozen game picture; `frame` is any ever-increasing frame counter.
 */
export function drawPauseOverlay(fb: Framebuffer, frame: number): void {
  fb.darkenAll(PAUSE_DIM_STEPS);
  if (!blinkOn(frame, 60, 40)) return;
  const scale = 3;
  const tw = textWidth(UI.pause, { scale });
  const w = tw + 24;
  const h = 7 * scale + 18;
  const x = Math.floor((W - w) / 2);
  const y = Math.floor((H - h) / 2);
  fb.fillRect(x, y, w, h, C.BLACK);
  fb.strokeRect(x, y, w, h, C.WHITE);
  fb.strokeRect(x + 3, y + 3, w - 6, h - 6, C.MDGRAY);
  drawText(fb, UI.pause, W / 2, y + 9, C.WHITE, { scale, shadow: C.GRAY, align: 'center' });
}
