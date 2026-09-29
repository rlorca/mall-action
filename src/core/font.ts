/**
 * Bitmap fonts, defined in source. 'X' = ink.
 * MAIN: 5x7 glyphs on a 6x8 grid (NES-like text).  TINY: 3x5 glyphs on a 4x6 grid (store signs, LED panel).
 */
const MAIN_SRC: Record<string, string> = {
  A: '.XXX./X...X/X...X/XXXXX/X...X/X...X/X...X',
  B: 'XXXX./X...X/X...X/XXXX./X...X/X...X/XXXX.',
  C: '.XXX./X...X/X..../X..../X..../X...X/.XXX.',
  D: 'XXXX./X...X/X...X/X...X/X...X/X...X/XXXX.',
  E: 'XXXXX/X..../X..../XXXX./X..../X..../XXXXX',
  F: 'XXXXX/X..../X..../XXXX./X..../X..../X....',
  G: '.XXX./X...X/X..../X.XXX/X...X/X...X/.XXXX',
  H: 'X...X/X...X/X...X/XXXXX/X...X/X...X/X...X',
  I: '.XXX./..X../..X../..X../..X../..X../.XXX.',
  J: '..XXX/...X./...X./...X./...X./X..X./.XX..',
  K: 'X...X/X..X./X.X../XX.../X.X../X..X./X...X',
  L: 'X..../X..../X..../X..../X..../X..../XXXXX',
  M: 'X...X/XX.XX/X.X.X/X.X.X/X...X/X...X/X...X',
  N: 'X...X/X...X/XX..X/X.X.X/X..XX/X...X/X...X',
  O: '.XXX./X...X/X...X/X...X/X...X/X...X/.XXX.',
  P: 'XXXX./X...X/X...X/XXXX./X..../X..../X....',
  Q: '.XXX./X...X/X...X/X...X/X.X.X/X..X./.XX.X',
  R: 'XXXX./X...X/X...X/XXXX./X.X../X..X./X...X',
  S: '.XXXX/X..../X..../.XXX./....X/....X/XXXX.',
  T: 'XXXXX/..X../..X../..X../..X../..X../..X..',
  U: 'X...X/X...X/X...X/X...X/X...X/X...X/.XXX.',
  V: 'X...X/X...X/X...X/X...X/X...X/.X.X./..X..',
  W: 'X...X/X...X/X...X/X.X.X/X.X.X/X.X.X/.X.X.',
  X: 'X...X/X...X/.X.X./..X../.X.X./X...X/X...X',
  Y: 'X...X/X...X/.X.X./..X../..X../..X../..X..',
  Z: 'XXXXX/....X/...X./..X../.X.../X..../XXXXX',
  '0': '.XXX./X...X/X..XX/X.X.X/XX..X/X...X/.XXX.',
  '1': '..X../.XX../..X../..X../..X../..X../.XXX.',
  '2': '.XXX./X...X/....X/...X./..X../.X.../XXXXX',
  '3': 'XXXXX/...X./..X../...X./....X/X...X/.XXX.',
  '4': '...X./..XX./.X.X./X..X./XXXXX/...X./...X.',
  '5': 'XXXXX/X..../XXXX./....X/....X/X...X/.XXX.',
  '6': '..XX./.X.../X..../XXXX./X...X/X...X/.XXX.',
  '7': 'XXXXX/....X/...X./..X../.X.../.X.../.X...',
  '8': '.XXX./X...X/X...X/.XXX./X...X/X...X/.XXX.',
  '9': '.XXX./X...X/X...X/.XXXX/....X/...X./.XX..',
  '.': '...../...../...../...../...../.XX../.XX..',
  ',': '...../...../...../...../.XX../..X../.X...',
  '!': '..X../..X../..X../..X../..X../...../..X..',
  '?': '.XXX./X...X/....X/...X./..X../...../..X..',
  "'": '..X../..X../.X.../...../...../...../.....',
  '"': '.X.X./.X.X./...../...../...../...../.....',
  ':': '...../.XX../.XX../...../.XX../.XX../.....',
  ';': '...../.XX../.XX../...../.XX../..X../.X...',
  '-': '...../...../...../XXXXX/...../...../.....',
  '+': '...../..X../..X../XXXXX/..X../..X../.....',
  '/': '...../....X/...X./..X../.X.../X..../.....',
  '(': '...X./..X../.X.../.X.../.X.../..X../...X.',
  ')': '.X.../..X../...X./...X./...X./..X../.X...',
  '&': '.XX../X..X./X.X../.X.../X.X.X/X..X./.XX.X',
  '#': '.X.X./.X.X./XXXXX/.X.X./XXXXX/.X.X./.X.X.',
  $: '..X../.XXXX/X.X../.XXX./..X.X/XXXX./..X..',
  '%': 'XX.../XX..X/...X./..X../.X.../X..XX/...XX',
  '*': '...../..X../X.X.X/.XXX./X.X.X/..X../.....',
  '<': '...X./..X../.X.../X..../.X.../..X../...X.',
  '>': '.X.../..X../...X./....X/...X./..X../.X...',
  '=': '...../...../XXXXX/...../XXXXX/...../.....',
  _: '...../...../...../...../...../...../XXXXX',
  '@': '.XXX./X...X/X.XXX/X.X.X/X.XXX/X..../.XXXX',
  '♥': '...../.X.X./XXXXX/XXXXX/.XXX./..X../.....',
  '…': '...../...../...../...../...../...../X.X.X',
  '↑': '..X../.XXX./X.X.X/..X../..X../..X../.....',
  '↓': '...../..X../..X../..X../X.X.X/.XXX./..X..',
  '←': '...../..X../.X.../XXXXX/.X.../..X../.....',
  '→': '...../..X../...X./XXXXX/...X./..X../.....',
  '~': '...../...../.X.../X.X.X/...X./...../.....',
  ' ': '...../...../...../...../...../...../.....',
};

const TINY_SRC: Record<string, string> = {
  A: '.X./X.X/XXX/X.X/X.X', B: 'XX./X.X/XX./X.X/XX.', C: '.XX/X../X../X../.XX', D: 'XX./X.X/X.X/X.X/XX.',
  E: 'XXX/X../XX./X../XXX', F: 'XXX/X../XX./X../X..', G: '.XX/X../X.X/X.X/.XX', H: 'X.X/X.X/XXX/X.X/X.X',
  I: 'XXX/.X./.X./.X./XXX', J: '..X/..X/..X/X.X/.X.', K: 'X.X/X.X/XX./X.X/X.X', L: 'X../X../X../X../XXX',
  M: 'X.X/XXX/XXX/X.X/X.X', N: 'XX./X.X/X.X/X.X/X.X', O: '.X./X.X/X.X/X.X/.X.', P: 'XX./X.X/XX./X../X..',
  Q: '.X./X.X/X.X/XX./.XX', R: 'XX./X.X/XX./X.X/X.X', S: '.XX/X../.X./..X/XX.', T: 'XXX/.X./.X./.X./.X.',
  U: 'X.X/X.X/X.X/X.X/XXX', V: 'X.X/X.X/X.X/X.X/.X.', W: 'X.X/X.X/XXX/XXX/X.X', X: 'X.X/X.X/.X./X.X/X.X',
  Y: 'X.X/X.X/.X./.X./.X.', Z: 'XXX/..X/.X./X../XXX',
  '0': 'XXX/X.X/X.X/X.X/XXX', '1': '.X./XX./.X./.X./XXX', '2': 'XX./..X/.X./X../XXX', '3': 'XX./..X/.X./..X/XX.',
  '4': 'X.X/X.X/XXX/..X/..X', '5': 'XXX/X../XX./..X/XX.', '6': '.XX/X../XXX/X.X/XXX', '7': 'XXX/..X/.X./.X./.X.',
  '8': 'XXX/X.X/XXX/X.X/XXX', '9': 'XXX/X.X/XXX/..X/XX.',
  "'": '.X./.X./.../.../...', '&': '.X./X.X/.X./X.X/.XX', '-': '.../.../XXX/.../...', '!': '.X./.X./.X./.../.X.',
  '.': '.../.../.../.../.X.', '%': 'X.X/..X/.X./X../X.X', $: '.XX/XX./.X./.XX/XX.', '?': 'XX./..X/.X./.../.X.',
  ':': '.../.X./.../.X./...', '/': '..X/..X/.X./X../X..', '+': '.../.X./XXX/.X./...', ' ': '.../.../.../.../...',
};

export interface Font {
  glyphW: number;
  glyphH: number;
  advance: number;
  lineH: number;
  glyphs: Map<string, Uint8Array>;
}

function build(src: Record<string, string>, w: number, h: number, advance: number, lineH: number): Font {
  const glyphs = new Map<string, Uint8Array>();
  for (const [ch, s] of Object.entries(src)) {
    const rows = s.split('/');
    if (rows.length !== h || rows.some((r) => r.length !== w)) throw new Error(`bad glyph '${ch}'`);
    const g = new Uint8Array(w * h);
    rows.forEach((r, y) => {
      for (let x = 0; x < w; x++) g[y * w + x] = r[x] === 'X' ? 1 : 0;
    });
    glyphs.set(ch, g);
  }
  return { glyphW: w, glyphH: h, advance, lineH, glyphs };
}

export const MAIN_FONT: Font = build(MAIN_SRC, 5, 7, 6, 8);
export const TINY_FONT: Font = build(TINY_SRC, 3, 5, 4, 6);

/** Normalise text to what the font can draw (upper case; unknown glyphs become '?'). */
export function normalise(font: Font, s: string): string {
  let out = '';
  for (const ch0 of s.toUpperCase()) {
    out += font.glyphs.has(ch0) ? ch0 : '?';
  }
  return out;
}

export function textWidth(font: Font, s: string): number {
  const n = [...s].length;
  return n === 0 ? 0 : n * font.advance - (font.advance - font.glyphW);
}

/** True if every character of s has a glyph. */
export function canRender(font: Font, s: string): boolean {
  for (const ch of s.toUpperCase()) if (!font.glyphs.has(ch)) return false;
  return true;
}

/** Greedy word wrap to at most maxChars per line. */
export function wrap(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
