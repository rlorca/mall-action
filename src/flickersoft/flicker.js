// FLICKERSOFT boot splash timing (pure). The logo letters are drawn as individual sprites and, like an
// NES scene with too many sprites on one scanline, alternate on even/odd frames until the "load" drops.
export const SPLASH = {
  flickerFrom: 20,  // letters start appearing (flickering)
  settleAt: 80,     // flicker stops, logo solid + jingle
  presentsAt: 100,  // "PRESENTS" line
  length: 190,      // then on to the title screen
};

export function letterVisible(i, frame) {
  if (frame < SPLASH.flickerFrom) return false;
  if (frame >= SPLASH.settleAt) return true;
  return (i + frame) % 2 === 0;
}

export const splashDone = (frame) => frame >= SPLASH.length;
