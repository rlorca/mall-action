/**
 * FLICKERSOFT splash - a self-contained, reusable module (no imports from the rest of the game).
 *
 * Black screen -> the word FLICKERSOFT appears in big rainbow letters that FLICKER ON ALTERNATE FRAMES,
 * neighbouring letters out of phase (the NES "too many sprites on one scanline" look) for about a second ->
 * the letters settle solid with an underline and a jingle -> "PRESENTS" -> done (~3 s total).
 *
 * The timeline is pure (frames in, booleans out) so it is unit-tested; `drawFlickersoft` paints it on any
 * 2D canvas context.
 */
export const SPLASH_TEXT = 'FLICKERSOFT';

/** Timeline, in 60 Hz frames. */
export const SPLASH = {
  blackUntil: 12, // black screen
  flickerUntil: 72, // ~1 s of flicker
  presentsAt: 120, // "PRESENTS" fades in
  end: 190, // ~3.2 s: the host switches to the title screen
} as const;

/** Is letter `i` drawn on frame `frame`? */
export function letterVisible(i: number, frame: number): boolean {
  if (frame < SPLASH.blackUntil) return false;
  if (frame < SPLASH.flickerUntil) {
    // alternate frames; neighbours are out of phase (i odd/even flip the parity)
    return (frame + i) % 2 === 0;
  }
  return true;
}

export class FlickersoftSplash {
  frame = 0;
  done = false;
  /** One-shot flags the host can turn into sound. */
  jingle = false;
  private jingled = false;

  /** Advance one frame. `skip` (any button) ends the splash immediately. */
  step(skip = false): void {
    if (this.done) return;
    this.jingle = false;
    this.frame++;
    if (!this.jingled && this.frame >= SPLASH.flickerUntil) {
      this.jingled = true;
      this.jingle = true;
    }
    if (skip || this.frame >= SPLASH.end) this.done = true;
  }

  get settled(): boolean {
    return this.frame >= SPLASH.flickerUntil;
  }
  get presents(): boolean {
    return this.frame >= SPLASH.presentsAt;
  }
}

// ---------------------------------------------------------------- drawing
const G: Record<string, string[]> = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
};

export const RAINBOW = ['#980000', '#d48820', '#a0aa00', '#4cd020', '#38b4cc', '#4c9aec', '#b062ec', '#ec58b4'];
const SHADOW = '#3c3c3c';

function glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, s: number, color: string): void {
  const g = G[ch];
  if (!g) return;
  ctx.fillStyle = color;
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '1') ctx.fillRect(x + c * s, y + r * s, s, s);
}

/** Total pixel width of the big word at scale 3. */
export const WORD_W = SPLASH_TEXT.length * 18 - 3;

export function drawFlickersoft(ctx: CanvasRenderingContext2D, s: FlickersoftSplash, w = 256, h = 240): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const x0 = Math.floor((w - WORD_W) / 2);
  const y0 = Math.floor(h / 2) - 22;
  for (let i = 0; i < SPLASH_TEXT.length; i++) {
    if (!letterVisible(i, s.frame)) continue;
    const x = x0 + i * 18;
    glyph(ctx, SPLASH_TEXT[i], x + 1, y0 + 1, 3, SHADOW);
    glyph(ctx, SPLASH_TEXT[i], x, y0, 3, RAINBOW[i % RAINBOW.length]);
  }
  if (s.settled) {
    // rainbow underline
    const segW = WORD_W / RAINBOW.length;
    for (let i = 0; i < RAINBOW.length; i++) {
      ctx.fillStyle = RAINBOW[i];
      ctx.fillRect(Math.floor(x0 + i * segW), y0 + 27, Math.ceil(segW), 3);
    }
  }
  if (s.presents) {
    const word = 'PRESENTS';
    const adv = 14;
    const px = Math.floor((w - (word.length * adv - 4)) / 2);
    for (let i = 0; i < word.length; i++) glyph(ctx, word[i], px + i * adv, y0 + 42, 2, '#eceeec');
  }
}
