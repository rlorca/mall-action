// A 5x7 pixel font generated from code. Glyph rows are '#' (ink) or '.' (empty), '/' between rows.
const GLYPHS: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '.###./#...#/....#/..##./....#/#...#/.###.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  ' ': '...../...../...../...../...../...../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  "'": '..#../..#../.#.../...../...../...../.....',
  '-': '...../...../...../####./...../...../.....',
  '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '=': '...../#####/...../#####/...../...../.....',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '♥': '.#.#./#####/#####/#####/.###./..#../.....',
};

const parsed = new Map<string, boolean[][]>();
for (const [ch, def] of Object.entries(GLYPHS)) {
  const rows = def.split('/');
  if (rows.length !== 7 || rows.some((r) => r.length !== 5)) throw new Error(`bad glyph ${ch}`);
  parsed.set(ch, rows.map((r) => [...r].map((c) => c === '#')));
}

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const ADVANCE = 6;

/** Whether the font has a glyph for every character of `text`. */
export function hasGlyphs(text: string): boolean {
  return [...text.toUpperCase()].every((c) => parsed.has(c));
}

/** Pixel width of `text` at a given scale. */
export function textWidth(text: string, scale = 1): number {
  return [...text].length * ADVANCE * scale - scale;
}

/** Draws text with whole-pixel glyphs (no anti-aliasing). Returns the x after the text. */
export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, scale = 1): number {
  g.fillStyle = colour;
  let cx = Math.round(x);
  for (const raw of text.toUpperCase()) {
    const glyph = parsed.get(raw) ?? parsed.get('?')!;
    for (let r = 0; r < GLYPH_H; r++)
      for (let c = 0; c < GLYPH_W; c++)
        if (glyph[r][c]) g.fillRect(cx + c * scale, Math.round(y) + r * scale, scale, scale);
    cx += ADVANCE * scale;
  }
  return cx;
}

/** Centred text helper. */
export function drawCentered(g: CanvasRenderingContext2D, text: string, cy: number, colour: string, scale = 1, cx = 128): void {
  drawText(g, text, cx - textWidth(text, scale) / 2, cy, colour, scale);
}

/** Wraps text onto lines of at most `max` characters (words kept whole where possible). */
export function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line.length) line = w;
    else if ((line + ' ' + w).length <= max) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}
