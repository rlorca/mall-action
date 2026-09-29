// PURE timing for the FLICKERSOFT splash. All values are frames at 60 Hz.
export const FLICKER_FRAMES = 60;
export const SETTLE_FRAME = 60; // letters solid + jingle
export const PRESENTS_FRAME = 90; // PRESENTS starts to appear
export const PRESENTS_FADE_FRAMES = 20;
export const DONE_FRAME = 180;
export const LETTER_COUNT = 11;

/** During the flicker, even letters show on even frames and odd letters on odd frames. */
export function letterVisible(letterIndex: number, frame: number): boolean {
  if (frame >= FLICKER_FRAMES) return true;
  return letterIndex % 2 === frame % 2;
}

/** 0..1 fade level of PRESENTS (0 = hidden). */
export function presentsAlpha(frame: number): number {
  if (frame < PRESENTS_FRAME) return 0;
  return Math.min(1, (frame - PRESENTS_FRAME + 1) / PRESENTS_FADE_FRAMES);
}
