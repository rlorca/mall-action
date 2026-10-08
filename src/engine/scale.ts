export const SCREEN_W = 256;
export const SCREEN_H = 240;

export interface ScaleResult {
  /** Whole-number scale factor in DEVICE pixels (>= 1). */
  scale: number;
  /** Canvas backing-store size in device pixels. */
  backingW: number;
  backingH: number;
  /** Canvas CSS size (backing / devicePixelRatio). */
  cssW: number;
  cssH: number;
}

/**
 * Largest whole-number scale that fits the window. The integer factor is computed
 * in DEVICE pixels (window CSS size * devicePixelRatio) so it stays crisp on
 * high-DPI screens; the CSS size is then backing / dpr.
 */
export function computeScale(winCssW: number, winCssH: number, dpr = 1): ScaleResult {
  const d = dpr > 0 ? dpr : 1;
  const devW = Math.floor(winCssW * d);
  const devH = Math.floor(winCssH * d);
  const scale = Math.max(1, Math.floor(Math.min(devW / SCREEN_W, devH / SCREEN_H)));
  const backingW = SCREEN_W * scale;
  const backingH = SCREEN_H * scale;
  return { scale, backingW, backingH, cssW: backingW / d, cssH: backingH / d };
}
