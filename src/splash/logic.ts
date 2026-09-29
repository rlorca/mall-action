/**
 * FLICKERSOFT splash: pure timing logic (no DOM). Timings are in 60 Hz frames.
 *
 *  0 .. flickerEnd     letters flicker on ALTERNATE frames, neighbours out of phase
 *                      (an NES scene with too many sprites on one scanline)
 *  flickerEnd          letters settle solid, underline draws, jingle plays
 *  presentsAt          "PRESENTS" appears
 *  endAt               done (hand over to the title screen)
 *  Any button skips.
 */
export interface SplashConfig {
  word: string;
  subtitle: string;
  flickerEnd: number;
  presentsAt: number;
  endAt: number;
}

export const DEFAULT_SPLASH: SplashConfig = {
  word: 'FLICKERSOFT',
  subtitle: 'PRESENTS',
  flickerEnd: 60,
  presentsAt: 105,
  endAt: 180,
};

export interface SplashState {
  t: number;
  done: boolean;
  jingled: boolean;
}

export function createSplash(): SplashState {
  return { t: 0, done: false, jingled: false };
}

/** Advance one frame. Returns 'jingle' on the frame the letters settle, else null. */
export function stepSplash(s: SplashState, anyPressed: boolean, cfg: SplashConfig = DEFAULT_SPLASH): 'jingle' | null {
  if (s.done) return null;
  if (anyPressed) {
    s.done = true;
    return null;
  }
  s.t++;
  let ev: 'jingle' | null = null;
  if (s.t >= cfg.flickerEnd && !s.jingled) {
    s.jingled = true;
    ev = 'jingle';
  }
  if (s.t >= cfg.endAt) s.done = true;
  return ev;
}

/** Is letter i drawn on this frame? During the flicker phase letters alternate frames, neighbours out of phase. */
export function letterVisible(s: SplashState, i: number, cfg: SplashConfig = DEFAULT_SPLASH): boolean {
  if (s.t >= cfg.flickerEnd) return true;
  return (s.t + i) % 2 === 0;
}

export function isSettled(s: SplashState, cfg: SplashConfig = DEFAULT_SPLASH): boolean {
  return s.t >= cfg.flickerEnd;
}

/** Underline progress 0..1 (draws over ~12 frames after settling). */
export function underlineProgress(s: SplashState, cfg: SplashConfig = DEFAULT_SPLASH): number {
  return Math.max(0, Math.min(1, (s.t - cfg.flickerEnd) / 12));
}

export function showSubtitle(s: SplashState, cfg: SplashConfig = DEFAULT_SPLASH): boolean {
  return s.t >= cfg.presentsAt;
}
