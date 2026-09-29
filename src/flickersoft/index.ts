// FLICKERSOFT studio splash: self-contained, deterministic, frame-based. See README.md.
import { glyphCells, GLYPH_H, GLYPH_W } from './letters';
import { DONE_FRAME, LETTER_COUNT, SETTLE_FRAME, letterVisible, presentsAlpha } from './timing';

export { letterVisible, presentsAlpha } from './timing';
export * from './timing';

export const WORD = 'FLICKERSOFT';
/** NES master palette colours (copied so this module needs no imports), red -> magenta. */
export const RAINBOW: readonly string[] = [
  '#FF7757', '#FA9E00', '#BDC700', '#7AE700', '#43F611', '#26EF7E', '#2CD5F6', '#53AEFF', '#9085FF', '#D365FF', '#FF57FF',
];
const WHITE = '#FFFFFF';
const GRAY = '#626262';
const LIGHT = '#ABABAB';
const BLACK = '#000000';

export interface FlickerSplashOptions {
  width: number;
  height: number;
  onJingle?: () => void;
  skipAllowed?: boolean;
}

export class FlickerSplash {
  frame = 0;
  done = false;
  private jingled = false;
  private readonly width: number;
  private readonly height: number;
  private readonly onJingle?: () => void;
  private readonly skipAllowed: boolean;

  constructor(opts: FlickerSplashOptions) {
    this.width = opts.width;
    this.height = opts.height;
    this.onJingle = opts.onJingle;
    this.skipAllowed = opts.skipAllowed ?? true;
  }

  /** Call once per 60 Hz frame. anyButtonPressed = a button was pressed this frame. */
  update(anyButtonPressed = false): void {
    if (this.done) return;
    if (anyButtonPressed && this.skipAllowed) {
      this.done = true;
      return;
    }
    this.frame++;
    if (!this.jingled && this.frame >= SETTLE_FRAME) {
      this.jingled = true;
      this.onJingle?.();
    }
    if (this.frame >= DONE_FRAME) this.done = true;
  }

  get settled(): boolean {
    return this.frame >= SETTLE_FRAME;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, this.width, this.height);
    const unit = Math.max(1, Math.floor(this.width / (LETTER_COUNT * GLYPH_W + (LETTER_COUNT - 1) * 2 + 6)));
    const gap = unit * 2;
    const lw = GLYPH_W * unit;
    const lh = GLYPH_H * unit;
    const total = LETTER_COUNT * lw + (LETTER_COUNT - 1) * gap;
    const x0 = Math.floor((this.width - total) / 2);
    const y0 = Math.floor(this.height / 2 - lh);
    for (let i = 0; i < LETTER_COUNT; i++) {
      if (!letterVisible(i, this.frame)) continue;
      ctx.fillStyle = RAINBOW[i % RAINBOW.length];
      this.glyph(ctx, WORD[i], x0 + i * (lw + gap), y0, unit);
    }
    if (this.settled) {
      for (let i = 0; i < LETTER_COUNT; i++) {
        ctx.fillStyle = RAINBOW[i % RAINBOW.length];
        ctx.fillRect(x0 + i * (lw + gap) - (i ? Math.floor(gap / 2) : 0), y0 + lh + unit * 2, lw + gap, Math.max(2, unit));
      }
    }
    const a = presentsAlpha(this.frame);
    if (a > 0) {
      const pu = Math.max(1, Math.floor(unit / 2));
      const text = 'PRESENTS';
      const pw = (text.length * GLYPH_W + (text.length - 1)) * pu;
      const px = Math.floor((this.width - pw) / 2);
      ctx.fillStyle = a < 0.4 ? GRAY : a < 0.8 ? LIGHT : WHITE;
      for (let i = 0; i < text.length; i++) this.glyph(ctx, text[i], px + i * (GLYPH_W + 1) * pu, y0 + lh + unit * 8, pu);
    }
  }

  private glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, unit: number): void {
    for (const [cx, cy] of glyphCells(ch)) ctx.fillRect(x + cx * unit, y + cy * unit, unit, unit);
  }
}
