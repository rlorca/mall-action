// The FLICKERSOFT studio splash. Self-contained and reusable: no game state, no globals.
// Drive it at 60 Hz: call step() once per frame, draw() into a 256x240 context, and drain events().
import { SCREEN_H, SCREEN_W, SEC } from '../core/constants';
import { NES } from '../core/palette';
import { drawText, textWidth } from '../render/text';

export const SPLASH_NAME = 'FLICKERSOFT';
export const FLICKER_FRAMES = SEC; // about one second of alternating-frame flicker
export const SETTLE_FRAMES = Math.round(0.5 * SEC); // solid letters, underline, jingle
export const PRESENTS_AT = FLICKER_FRAMES + SETTLE_FRAMES;
export const DONE_AT = 3 * SEC; // the title screen follows after about 3 seconds

export type SplashEvent = { type: 'jingle' } | { type: 'pop' } | { type: 'done' };

const RAINBOW = [NES.red, NES.orange, NES.yellow, NES.green, NES.cyan, NES.blue, NES.magenta, NES.pink];

export class FlickerSplash {
  private frame = 0;
  private skipped = false;
  private events: SplashEvent[] = [];
  private finished = false;

  /** Advance one frame. `anyButton` is true on a frame where any button was pressed. */
  step(anyButton: boolean): void {
    if (this.finished) return;
    if (anyButton && !this.skipped) this.skip();
    if (this.finished) return;
    this.frame++;
    if (this.frame === FLICKER_FRAMES) this.events.push({ type: 'pop' });
    if (this.frame === FLICKER_FRAMES + 1) this.events.push({ type: 'jingle' });
    if (this.frame >= DONE_AT) this.finish();
  }

  /** Any button skips the splash. */
  skip(): void {
    this.skipped = true;
    this.finish();
  }

  get done(): boolean {
    return this.finished;
  }

  /** Events since the last call (jingle, pop, done). */
  drainEvents(): SplashEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Draw the current frame. The background is always black. */
  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = NES.black;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const f = this.frame;
    const letterW = 12 * 2; // scale 2: 12 px per letter, 2 px spacing
    const total = SPLASH_NAME.length * letterW - 2 * 2;
    const x0 = Math.round(SCREEN_W / 2 - total / 2);
    const y = 100;
    const settled = f >= FLICKER_FRAMES;
    // Letters: during the flicker, alternate frames show alternate letters, so neighbours are out of phase.
    [...SPLASH_NAME].forEach((ch, i) => {
      const visible = settled || (f + i) % 2 === 0;
      if (!visible) return;
      drawText(g, ch, x0 + i * letterW, y, RAINBOW[i % RAINBOW.length], 2);
    });
    if (settled) {
      g.fillStyle = NES.white;
      g.fillRect(x0, y + 18, total, 2);
    }
    if (f >= PRESENTS_AT) {
      const fade = Math.min(1, (f - PRESENTS_AT) / 20);
      const text = 'PRESENTS';
      const x = Math.round(SCREEN_W / 2 - textWidth(text) / 2);
      drawText(g, text, x, y + 34, `rgba(252,252,252,${fade})`, 1);
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.events.push({ type: 'done' });
  }
}
