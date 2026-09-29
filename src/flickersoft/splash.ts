/**
 * The FLICKERSOFT studio splash.
 *
 * A self-contained, reusable module: future FLICKERSOFT games drop this folder
 * in as-is. It knows nothing about MALL ACTION. Its only dependencies are the
 * generic pixel-art primitives (Framebuffer, PixelFont) and a palette table.
 *
 * See README.md in this folder for how to reuse it.
 */

import { drawTextCentered, textWidth, type PixelFont } from '../render/font';
import type { Framebuffer } from '../render/pixels';

export const STUDIO_NAME = 'FLICKERSOFT';
export const PRESENTS = 'PRESENTS';

/** All timings in frames at 60 Hz. */
export const SPLASH_TIMING = {
  /** Letters flicker on alternate frames for about a second. */
  flicker: 60,
  /** Then they settle solid and the underline wipes in. */
  underline: 20,
  /** "PRESENTS" fades in after the jingle. */
  presentsAt: 110,
  /** Total length before handing over. */
  total: 192,
} as const;

export type SplashPhase = 'flicker' | 'settle' | 'presents' | 'done';

export interface SplashState {
  frame: number;
  /** Set once, when the letters settle: the cue to play the jingle. */
  jingleFired: boolean;
  skipped: boolean;
}

export function newSplash(): SplashState {
  return { frame: 0, jingleFired: false, skipped: false };
}

export function splashPhase(frame: number): SplashPhase {
  if (frame < SPLASH_TIMING.flicker) return 'flicker';
  if (frame < SPLASH_TIMING.presentsAt) return 'settle';
  if (frame < SPLASH_TIMING.total) return 'presents';
  return 'done';
}

/**
 * Is letter `index` drawn on this frame?
 *
 * During the flicker phase letters blink on ALTERNATE frames with neighbours
 * out of phase, imitating an NES scene with too many sprites on one scanline.
 * After the flicker phase every letter is solid.
 */
export function letterVisible(frame: number, index: number): boolean {
  if (frame >= SPLASH_TIMING.flicker) return true;
  return (frame + index) % 2 === 0;
}

export interface SplashStepResult {
  /** True on the frame the jingle should start. */
  playJingle: boolean;
  /** True once the splash is over (or was skipped). */
  finished: boolean;
}

/** One simulation step. `skip` is "any button was pressed". */
export function stepSplash(s: SplashState, skip: boolean): SplashStepResult {
  if (skip) s.skipped = true;
  s.frame++;
  const playJingle = !s.jingleFired && s.frame >= SPLASH_TIMING.flicker;
  if (playJingle) s.jingleFired = true;
  return {
    playJingle,
    finished: s.skipped || s.frame >= SPLASH_TIMING.total,
  };
}

export interface SplashPalette {
  /** Background. */
  black: number;
  /** Rainbow ramp for the studio letters; cycled per letter. */
  rainbow: readonly number[];
  /** Underline and "PRESENTS". */
  accent: number;
}

/**
 * Draw the splash. The caller owns the framebuffer and clears it; this only
 * ever draws inside it and never blanks or partially covers the screen.
 */
export function drawSplash(
  fb: Framebuffer,
  font: PixelFont,
  s: SplashState,
  pal: SplashPalette,
  screenW: number,
  screenH: number,
): void {
  fb.clear(pal.black);

  const scale = 3;
  const letters = [...STUDIO_NAME];
  const glyphW = font.advance * scale;
  const total = textWidth(font, STUDIO_NAME, scale);
  const x0 = Math.round((screenW - total) / 2);
  const y = Math.round(screenH / 2 - font.h * scale - 6);

  letters.forEach((ch, i) => {
    if (!letterVisible(s.frame, i)) return;
    const color = pal.rainbow[i % pal.rainbow.length];
    const bits = font.glyphs.get(ch);
    if (!bits) return;
    const lx = x0 + i * glyphW;
    for (let gy = 0; gy < font.h; gy++) {
      for (let gx = 0; gx < font.w; gx++) {
        if (!bits[gy * font.w + gx]) continue;
        fb.rect(lx + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
  });

  const phase = splashPhase(s.frame);

  // The underline wipes in from the centre once the letters settle.
  if (phase !== 'flicker') {
    const t = Math.min(1, (s.frame - SPLASH_TIMING.flicker) / SPLASH_TIMING.underline);
    const w = Math.round(total * t);
    const uy = y + font.h * scale + 4;
    fb.rect(Math.round(screenW / 2 - w / 2), uy, w, 2, pal.accent);
  }

  if (phase === 'presents' || phase === 'done') {
    // Blink it gently rather than popping it in.
    const age = s.frame - SPLASH_TIMING.presentsAt;
    if (age > 6 || Math.floor(age / 3) % 2 === 0) {
      drawTextCentered(fb, font, PRESENTS, screenW / 2, y + font.h * scale + 20, pal.accent, 1);
    }
  }
}
