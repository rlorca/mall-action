// Shared camera helpers for the mall renderer. World px -> screen px (the view is 256x224 below the 16 px HUD).
import type { Surface } from '../art/surface';

export const VIEW_TOP = 16;
export const VIEW_W = 256;
export const VIEW_H = 224;
/** How many px the actors' feet sink into the 6 px floor strip (depth cue; 0 = feet exactly on the floor line). */
export const FOOT_DROP = 1;

/** Camera of the frame being drawn (set once per drawMall call; whole pixels). */
export const cam = { x: 0, y: 0 };

export function setCamera(x: number, y: number): void {
  cam.x = Math.round(x);
  cam.y = Math.round(y);
}
export const sx = (wx: number): number => Math.round(wx) - cam.x;
export const sy = (wy: number): number => Math.round(wy) - cam.y + VIEW_TOP;

/** Is the world rect (at least partly) inside the view, with `pad` slack? */
export function inView(x0: number, x1: number, y0: number, y1: number, pad = 0): boolean {
  return x1 > cam.x - pad && x0 < cam.x + VIEW_W + pad && y1 > cam.y - pad && y0 < cam.y + VIEW_H + pad;
}

export type S = Surface;
