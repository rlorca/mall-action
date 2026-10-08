import type { Pad } from '../engine/pad';
import type { Framebuffer } from '../engine/framebuffer';
import { C, darken } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';

/**
 * The FLICKERSOFT studio splash. SELF-CONTAINED and reusable: it only imports from `src/engine`
 * (framebuffer, font, palette, pad types) and knows nothing about the game, its audio or its
 * scenes. Sound is injected through `onJingle`. See README.md in this folder.
 *
 * Timeline (60 Hz frames, `frame` = steps taken so far):
 *   0 .. FLICKER_START      black screen
 *   FLICKER_START .. FLICKER_END   rainbow letters FLICKER on alternate frames, neighbouring letters
 *                           out of phase (imitating an NES scene with too many sprites on a scanline)
 *   FLICKER_END             letters settle solid, underline wipes in, a shine sweeps across, onJingle()
 *   PRESENTS_AT             "PRESENTS" fades in
 *   TOTAL_FRAMES            done (any button press skips earlier)
 */
export const STUDIO_NAME = 'FLICKERSOFT';
export const STUDIO_PRESENTS = 'PRESENTS';

export const FLICKER_START = 6;
export const FLICKER_END = 66; // the flicker lasts 60 frames = 1 s
export const UNDERLINE_FRAMES = 14;
export const SHINE_FRAMES = 30;
export const PRESENTS_AT = 100;
export const PRESENTS_FADE = 12;
export const TOTAL_FRAMES = 180; // 3 s

const SCALE = 3;
const GLYPH_W = 5 * SCALE;
const GLYPH_H = 7 * SCALE;
const PITCH = GLYPH_W + 5; // letter-to-letter advance
const SCREEN_W = 256;
const TOP = 94;
const UNDERLINE_Y = TOP + GLYPH_H + 6;

/** Per-letter NES colours (a full rainbow across 11 letters). */
const RAINBOW: readonly number[] = [C.RED, C.ORANGE, C.AMBER, C.YELLOW, C.LIME, C.GREEN, C.CYAN, C.SKY, C.INDIGO, C.MAGENTA, C.PINK];

export interface FlickerSplashOpts {
  /** Called exactly once, on the frame the letters settle (play your jingle here). Not called if skipped before that. */
  onJingle?: () => void;
  /** Studio word; defaults to FLICKERSOFT. */
  text?: string;
  /** Second line; defaults to PRESENTS. */
  presents?: string;
}

/**
 * Is letter `i` drawn on frame `frame`? Pure. Neighbouring letters are always in opposite phase
 * during the flicker; before it nothing shows; after it everything is solid.
 */
export function letterVisible(i: number, frame: number): boolean {
  if (frame < FLICKER_START) return false;
  if (frame >= FLICKER_END) return true;
  return (frame + i) % 2 === 0;
}

export class FlickerSplash {
  private readonly text: string;
  private readonly presents: string;
  private readonly onJingle?: () => void;
  private _frame = 0;
  private _done = false;
  private _skipped = false;

  constructor(opts: FlickerSplashOpts = {}) {
    this.text = (opts.text ?? STUDIO_NAME).toUpperCase();
    this.presents = (opts.presents ?? STUDIO_PRESENTS).toUpperCase();
    this.onJingle = opts.onJingle;
  }

  /** Steps taken so far (the frame that `draw` will show). */
  get frame(): number {
    return this._frame;
  }

  get done(): boolean {
    return this._done;
  }

  /** True when the player skipped the splash instead of watching it. */
  get skipped(): boolean {
    return this._skipped;
  }

  /** The letters have settled (the jingle has been requested). */
  get settled(): boolean {
    return this._frame >= FLICKER_END;
  }

  /** Is letter `i` visible right now? */
  visible(i: number): boolean {
    return letterVisible(i, this._frame);
  }

  /** Advance one 60 Hz frame. Any newly pressed button skips. */
  step(pad?: Pad): void {
    if (this._done) return;
    if (pad && pad.pressed !== 0) {
      this._skipped = true;
      this._done = true;
      return;
    }
    this._frame++;
    if (this._frame === FLICKER_END) this.onJingle?.();
    if (this._frame >= TOTAL_FRAMES) this._done = true;
  }

  /** Where letter `i` is drawn (for tests and for games that want to add effects). */
  letterBox(i: number): { x: number; y: number; w: number; h: number } {
    return { x: this.left() + i * PITCH, y: TOP, w: GLYPH_W, h: GLYPH_H };
  }

  private left(): number {
    const n = this.text.length;
    const w = (n - 1) * PITCH + GLYPH_W;
    return Math.floor((SCREEN_W - w) / 2);
  }

  /** Draw the current frame (clears the whole framebuffer to black first). */
  draw(fb: Framebuffer): void {
    fb.clear(C.BLACK);
    const f = this._frame;
    const n = this.text.length;
    const left = this.left();
    const totalW = (n - 1) * PITCH + GLYPH_W;

    for (let i = 0; i < n; i++) {
      if (!letterVisible(i, f)) continue;
      const ch = this.text[i]!;
      const col = RAINBOW[i % RAINBOW.length]!;
      drawText(fb, ch, left + i * PITCH, TOP, col, { scale: SCALE, shadow: darken(col, 1) });
    }

    // After settling: shine sweep (a diagonal-ish white band across the letters), underline wipe.
    if (f >= FLICKER_END) {
      const t = f - FLICKER_END;
      if (t < SHINE_FRAMES) {
        const sx = left - 8 + Math.round((t / SHINE_FRAMES) * (totalW + 16));
        fb.pushClip(sx, TOP, 7, GLYPH_H);
        for (let i = 0; i < n; i++) drawText(fb, this.text[i]!, left + i * PITCH, TOP, C.WHITE, { scale: SCALE });
        fb.popClip();
      }
      const wipe = Math.min(1, t / UNDERLINE_FRAMES);
      const uw = Math.round(totalW * wipe);
      for (let x = 0; x < uw; x++) {
        const li = Math.min(n - 1, Math.floor((x + (PITCH - GLYPH_W) / 2) / PITCH));
        const col = RAINBOW[li % RAINBOW.length]!;
        fb.fillRect(left + x, UNDERLINE_Y, 1, 3, col);
        fb.fillRect(left + x, UNDERLINE_Y + 3, 1, 1, darken(col, 2));
      }
    }

    if (f >= PRESENTS_AT) {
      const k = Math.min(2, Math.floor(((f - PRESENTS_AT) / PRESENTS_FADE) * 3));
      const col = [C.GRAY, C.LTGRAY, C.WHITE][k]!;
      const y = UNDERLINE_Y + 14;
      const w = textWidth(this.presents, { scale: 2 });
      drawText(fb, this.presents, Math.floor((SCREEN_W - w) / 2), y, col, { scale: 2 });
    }
  }
}
