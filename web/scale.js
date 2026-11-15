export const SCREEN_W = 256;
export const SCREEN_H = 240;
/**
 * Largest whole-number scale that fits the window. The integer factor is computed
 * in DEVICE pixels (window CSS size * devicePixelRatio) so it stays crisp on
 * high-DPI screens; the CSS size is then backing / dpr.
 */
export function computeScale(winCssW, winCssH, dpr = 1) {
    const d = dpr > 0 ? dpr : 1;
    const devW = Math.floor(winCssW * d);
    const devH = Math.floor(winCssH * d);
    const scale = Math.max(1, Math.floor(Math.min(devW / SCREEN_W, devH / SCREEN_H)));
    const backingW = SCREEN_W * scale;
    const backingH = SCREEN_H * scale;
    return { scale, backingW, backingH, cssW: backingW / d, cssH: backingH / d };
}
