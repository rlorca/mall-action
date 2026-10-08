// Presents the 256x240 buffer on the page: whole-number nearest-neighbour scaling, plus an
// optional arcade-monitor effect (scanlines, slight curvature, vignette, noise). The effect never
// blanks or covers the picture; it only darkens rows and edges a little.
import { SCREEN_H, SCREEN_W } from '../core/constants';

export class Presenter {
  private out: CanvasRenderingContext2D;
  private scale = 1;
  private vignette: CanvasGradient | null = null;
  private vignetteFor = '';

  constructor(
    readonly canvas: HTMLCanvasElement,
  ) {
    this.out = canvas.getContext('2d')!;
    this.out.imageSmoothingEnabled = false;
  }

  /** Largest whole-number scale that fits the window. Never below 1. */
  fit(winW: number, winH: number): number {
    this.scale = Math.max(1, Math.floor(Math.min(winW / SCREEN_W, winH / SCREEN_H)));
    this.canvas.width = SCREEN_W * this.scale;
    this.canvas.height = SCREEN_H * this.scale;
    this.canvas.style.width = `${SCREEN_W * this.scale}px`;
    this.canvas.style.height = `${SCREEN_H * this.scale}px`;
    this.out.imageSmoothingEnabled = false;
    this.vignetteFor = '';
    return this.scale;
  }

  present(src: HTMLCanvasElement, crt: boolean, time: number): void {
    const o = this.out;
    const W = SCREEN_W * this.scale;
    const H = SCREEN_H * this.scale;
    o.fillStyle = '#000';
    o.fillRect(0, 0, W, H);
    if (!crt) {
      o.drawImage(src, 0, 0, W, H);
      return;
    }
    // Curvature: each row is drawn a little narrower toward the top and bottom edges.
    for (let y = 0; y < H; y++) {
      const v = (y / H) * 2 - 1;
      const inset = (1 - v * v) * 0.012 * W + 0.006 * W;
      const sy = Math.floor(y / this.scale);
      o.drawImage(src, 0, sy, SCREEN_W, 1, Math.round(inset), y, Math.round(W - inset * 2), 1);
    }
    // Scanlines: a dark line on every other row of the buffer.
    o.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += this.scale * 2) o.fillRect(0, y + this.scale - 1, W, Math.max(1, this.scale - 1) || 1);
    // Vignette.
    const key = `${W}x${H}`;
    if (!this.vignette || this.vignetteFor !== key) {
      const g = o.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      this.vignette = g;
      this.vignetteFor = key;
    }
    o.fillStyle = this.vignette;
    o.fillRect(0, 0, W, H);
    // Faint noise: a few random specks that change every frame.
    o.fillStyle = 'rgba(255,255,255,0.05)';
    const seed = Math.floor(time * 60);
    for (let i = 0; i < 40; i++) {
      const x = ((seed * 9301 + i * 49297) >>> 0) % W;
      const y = ((seed * 233 + i * 7919) >>> 0) % H;
      o.fillRect(x, y, this.scale, this.scale);
    }
  }
}
