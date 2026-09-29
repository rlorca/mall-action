// PAUSE overlay: dims whatever is currently on the surface and shows a blinking PAUSE in a bordered box.
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import type { Surface } from '../art/surface';
import { blinkOn, dim, panel } from './util';

export function drawPause(s: Surface, tick: number): void {
  dim(s, 0.6);
  const w = 88;
  const h = 32;
  const x = (SCREEN_W - w) >> 1;
  const y = (SCREEN_H - h) >> 1;
  panel(s, x, y, w, h, C.BLACK, C.WHITE, C.GRAY_D);
  if (blinkOn(tick, 40)) s.text('PAUSE', SCREEN_W / 2, y + 12, C.YELLOW_L, { align: 'center', shadow: C.RED_D });
  s.text('START: RESUME', SCREEN_W / 2, y + h + 6, C.WHITE, { align: 'center', shadow: C.BLACK });
}
