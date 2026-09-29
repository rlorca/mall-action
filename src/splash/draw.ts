/**
 * FLICKERSOFT splash renderer. Self-contained: its own 5x7 capital-letter font and NES colours,
 * so any future FLICKERSOFT game can drop this folder in and draw onto a 2D canvas context.
 */
import { DEFAULT_SPLASH, isSettled, letterVisible, showSubtitle, underlineProgress, type SplashConfig, type SplashState } from './logic';

const GLYPHS: Record<string, string> = {
  A: '.XXX.X...XX...XXXXXXX...XX...XX...X', B: 'XXXX.X...XX...XXXXX.X...XX...XXXXX.',
  C: '.XXX.X...XX....X....X....X...X.XXX.', D: 'XXXX.X...XX...XX...XX...XX...XXXXX.',
  E: 'XXXXXX....X....XXXX.X....X....XXXXX', F: 'XXXXXX....X....XXXX.X....X....X....',
  G: '.XXX.X...XX....X.XXXX...XX...X.XXXX', H: 'X...XX...XX...XXXXXXX...XX...XX...X',
  I: '.XXX...X....X....X....X....X...XXX.', J: '..XXX...X....X....X....X.X..X..XX..',
  K: 'X...XX..X.X.X..XX...X.X..X..X.X...X', L: 'X....X....X....X....X....X....XXXXX',
  M: 'X...XXX.XXX.X.XX.X.XX...XX...XX...X', N: 'X...XX...XXX..XX.X.XX..XXX...XX...X',
  O: '.XXX.X...XX...XX...XX...XX...X.XXX.', P: 'XXXX.X...XX...XXXXX.X....X....X....',
  Q: '.XXX.X...XX...XX...XX.X.XX..X..XX.X', R: 'XXXX.X...XX...XXXXX.X.X..X..X.X...X',
  S: '.XXXXX....X.....XXX.....X....XXXXX.', T: 'XXXXX..X....X....X....X....X....X..',
  U: 'X...XX...XX...XX...XX...XX...X.XXX.', V: 'X...XX...XX...XX...XX...X.X.X...X..',
  W: 'X...XX...XX...XX.X.XX.X.XX.X.X.X.X.', X: 'X...XX...X.X.X...X...X.X.X...XX...X',
  Y: 'X...XX...X.X.X...X....X....X....X..', Z: 'XXXXX....X...X...X...X...X....XXXXX',
};

/** NES rainbow for the letters. */
const RAINBOW = ['#f83800', '#fca044', '#f8b800', '#b8f818', '#58d854', '#00e8d8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898'];

function drawGlyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, scale: number, color: string): void {
  const g = GLYPHS[ch];
  if (!g) return;
  ctx.fillStyle = color;
  for (let i = 0; i < 35; i++) if (g[i] === 'X') ctx.fillRect(x + (i % 5) * scale, y + Math.floor(i / 5) * scale, scale, scale);
}

/** Draw the splash for the current state on a canvas of size w x h (NES: 256 x 240). */
export function drawSplash(ctx: CanvasRenderingContext2D, s: SplashState, w = 256, h = 240, cfg: SplashConfig = DEFAULT_SPLASH): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const word = cfg.word.toUpperCase();
  const scale = Math.max(1, Math.min(3, Math.floor((w - 16) / (word.length * 6))));
  const adv = 6 * scale;
  const total = word.length * adv - scale;
  const x0 = Math.floor((w - total) / 2);
  const y0 = Math.floor(h / 2) - 7 * scale;
  const settled = isSettled(s, cfg);
  for (let i = 0; i < word.length; i++) {
    if (!letterVisible(s, i, cfg)) continue;
    // Once settled, the rainbow slowly rolls through the letters.
    const shift = settled ? Math.floor((s.t - cfg.flickerEnd) / 6) : 0;
    drawGlyph(ctx, word[i], x0 + i * adv, y0, scale, RAINBOW[(i + shift) % RAINBOW.length]);
  }
  if (settled) {
    const len = Math.round(total * underlineProgress(s, cfg));
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(x0, y0 + 8 * scale + 2, len, 2);
    ctx.fillStyle = '#f83800';
    ctx.fillRect(x0, y0 + 8 * scale + 5, len, 1);
  }
  if (showSubtitle(s, cfg)) {
    const sub = cfg.subtitle.toUpperCase();
    const sx = Math.floor((w - (sub.length * 6 - 1)) / 2);
    for (let i = 0; i < sub.length; i++) drawGlyph(ctx, sub[i], sx + i * 6, y0 + 8 * scale + 16, 1, '#bcbcbc');
  }
}
