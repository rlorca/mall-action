/**
 * FLICKERSOFT studio splash - self-contained and reusable (no imports).
 * See README.md in this folder. Pure state + a draw function onto a tiny surface interface.
 */
export interface SplashSurface {
  width: number;
  height: number;
  /** Fill a rectangle with a 0xRRGGBB colour. */
  fillRect(x: number, y: number, w: number, h: number, rgb: number): void;
}
export interface SplashState {
  t: number; // frames since start (60 Hz)
  done: boolean;
}
export type SplashEvent = 'jingle' | 'done';

export const SPLASH_TIMING = {
  /** Letters flicker (sprite-overflow style) until this frame, then settle. */
  flickerEnd: 60,
  /** "PRESENTS" appears. */
  presentsAt: 105,
  /** The splash ends about 3 s after settling. */
  end: 60 + 180,
};
export const SPLASH_WORD = 'FLICKERSOFT';
const RAINBOW = [0xf83800, 0xfca044, 0xf8b800, 0xb8f818, 0x58d854, 0x00e8d8, 0x3cbcfc, 0x6888fc, 0x9878f8, 0xf878f8, 0xf85898];

/** Jingle as [midiNote, startFrame, lengthFrames]; the host plays it on its own synth. */
export const SPLASH_JINGLE: [number, number, number][] = [
  [72, 0, 6], [76, 6, 6], [79, 12, 6], [84, 18, 10], [79, 30, 5], [84, 36, 22],
];

const GLYPHS: Record<string, string[]> = {
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
};

export function createSplash(): SplashState {
  return { t: 0, done: false };
}

/** Advance one frame. Any button press skips. Returns events for the host (sound / next screen). */
export function stepSplash(s: SplashState, anyPressed: boolean): SplashEvent[] {
  if (s.done) return [];
  const ev: SplashEvent[] = [];
  if (anyPressed || s.t >= SPLASH_TIMING.end) {
    s.done = true;
    ev.push('done');
    return ev;
  }
  if (s.t === SPLASH_TIMING.flickerEnd) ev.push('jingle');
  s.t++;
  return ev;
}

/**
 * While flickering, each letter shows on alternate frames and neighbours are out of phase -
 * like an NES scene with too many sprites on one scanline.
 */
export function letterVisible(s: SplashState, i: number): boolean {
  if (s.t >= SPLASH_TIMING.flickerEnd) return true;
  return (s.t + i) % 2 === 0;
}

function drawWord(surf: SplashSurface, word: string, x: number, y: number, scale: number, color: (i: number) => number | null): void {
  for (let i = 0; i < word.length; i++) {
    const g = GLYPHS[word[i]];
    const c = color(i);
    if (g && c !== null) {
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++) if (g[gy][gx] === '#') surf.fillRect(x + gx * scale, y + gy * scale, scale, scale, c);
    }
    x += 6 * scale;
  }
}

export function drawSplash(s: SplashState, surf: SplashSurface): void {
  surf.fillRect(0, 0, surf.width, surf.height, 0x000000);
  const scale = Math.max(1, Math.floor(surf.width / (SPLASH_WORD.length * 6 + 4)));
  const w = (SPLASH_WORD.length * 6 - 1) * scale;
  const x = Math.floor((surf.width - w) / 2);
  const y = Math.floor(surf.height / 2) - 7 * scale;
  drawWord(surf, SPLASH_WORD, x, y, scale, (i) => (letterVisible(s, i) ? RAINBOW[i % RAINBOW.length] : null));
  if (s.t >= SPLASH_TIMING.flickerEnd) {
    const grow = Math.min(1, (s.t - SPLASH_TIMING.flickerEnd) / 12);
    const uw = Math.floor(w * grow);
    surf.fillRect(x + Math.floor((w - uw) / 2), y + 8 * scale + 1, uw, Math.max(1, scale - 1), 0xf8f8f8);
  }
  if (s.t >= SPLASH_TIMING.presentsAt) {
    const pw = 8 * 6 - 1;
    drawWord(surf, 'PRESENTS', Math.floor((surf.width - pw) / 2), y + 12 * scale + 2, 1, () => 0xbcbcbc);
  }
}
