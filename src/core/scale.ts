import { SCREEN_H, SCREEN_W } from './palette';

export interface ScaleResult {
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Largest whole-number scale of 256x240 fitting the window; result is in DEVICE pixels (window * dpr). */
export function computeScale(winW: number, winH: number, dpr = 1): ScaleResult {
  const d = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  const dw = Math.max(0, Math.floor(winW * d));
  const dh = Math.max(0, Math.floor(winH * d));
  const scale = Math.max(1, Math.floor(Math.min(dw / SCREEN_W, dh / SCREEN_H)));
  const w = SCREEN_W * scale;
  const h = SCREEN_H * scale;
  return { scale, x: Math.floor((dw - w) / 2), y: Math.floor((dh - h) / 2), w, h };
}
