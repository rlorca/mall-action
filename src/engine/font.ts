import type { Framebuffer } from './framebuffer';

/**
 * Two bitmap fonts, both uppercase-only (lowercase is drawn as uppercase):
 *  - MAIN: 5x7 glyphs, 6 px advance, 8 px line height. HUD, banners, bubbles.
 *  - TINY: 3x5 glyphs, 4 px advance, 6 px line height. Storefront signs (an 18-char
 *    store name = 71 px, which fits an ~80 px sign).
 */
export interface Font {
  name: string;
  glyphW: number;
  glyphH: number;
  advance: number;
  lineHeight: number;
  glyphs: Map<string, number[]>;
}

function parseFont(name: string, glyphW: number, glyphH: number, advance: number, lineHeight: number, table: string): Font {
  const glyphs = new Map<string, number[]>();
  for (const l of table.split('\n')) {
    if (l.trim() === '') continue;
    // Format: "<char>=<hex rows separated by spaces>"; the char may be ' ' or '=' itself.
    const ch = l[0]!;
    const rest = l.slice(2).trim();
    glyphs.set(ch, rest.split(/\s+/).map((h) => parseInt(h, 16)));
  }
  return { name, glyphW, glyphH, advance, lineHeight, glyphs };
}

// prettier-ignore
const MAIN_TABLE = `
A=0E 11 11 1F 11 11 11
B=1E 11 11 1E 11 11 1E
C=0E 11 10 10 10 11 0E
D=1C 12 11 11 11 12 1C
E=1F 10 10 1E 10 10 1F
F=1F 10 10 1E 10 10 10
G=0E 11 10 17 11 11 0F
H=11 11 11 1F 11 11 11
I=0E 04 04 04 04 04 0E
J=07 02 02 02 02 12 0C
K=11 12 14 18 14 12 11
L=10 10 10 10 10 10 1F
M=11 1B 15 15 11 11 11
N=11 11 19 15 13 11 11
O=0E 11 11 11 11 11 0E
P=1E 11 11 1E 10 10 10
Q=0E 11 11 11 15 12 0D
R=1E 11 11 1E 14 12 11
S=0F 10 10 0E 01 01 1E
T=1F 04 04 04 04 04 04
U=11 11 11 11 11 11 0E
V=11 11 11 11 11 0A 04
W=11 11 11 15 15 15 0A
X=11 11 0A 04 0A 11 11
Y=11 11 11 0A 04 04 04
Z=1F 01 02 04 08 10 1F
0=0E 11 13 15 19 11 0E
1=04 0C 04 04 04 04 0E
2=0E 11 01 02 04 08 1F
3=1F 02 04 02 01 11 0E
4=02 06 0A 12 1F 02 02
5=1F 10 1E 01 01 11 0E
6=06 08 10 1E 11 11 0E
7=1F 01 02 04 08 08 08
8=0E 11 11 0E 11 11 0E
9=0E 11 11 0F 01 02 0C
 =00 00 00 00 00 00 00
!=04 04 04 04 04 00 04
"=0A 0A 0A 00 00 00 00
#=0A 0A 1F 0A 1F 0A 0A
$=04 0F 14 0E 05 1E 04
%=18 19 02 04 08 13 03
&=0C 12 14 08 15 12 0D
'=04 04 08 00 00 00 00
(=02 04 08 08 08 04 02
)=08 04 02 02 02 04 08
*=00 04 15 0E 15 04 00
+=00 04 04 1F 04 04 00
,=00 00 00 00 0C 04 08
-=00 00 00 1F 00 00 00
.=00 00 00 00 00 0C 0C
/=01 01 02 04 08 10 10
:=00 0C 0C 00 0C 0C 00
;=00 0C 0C 00 0C 04 08
<=02 04 08 10 08 04 02
==00 00 1F 00 1F 00 00
>=08 04 02 01 02 04 08
?=0E 11 01 02 04 00 04
@=0E 11 01 0D 15 15 0E
[=0E 08 08 08 08 08 0E
]=0E 02 02 02 02 02 0E
_=00 00 00 00 00 00 1F
^=04 0E 15 04 04 04 04
♥=0A 1F 1F 1F 0E 04 00
•=00 0E 1F 1F 1F 0E 00
`;

// prettier-ignore
const TINY_TABLE = `
A=2 5 7 5 5
B=6 5 6 5 6
C=3 4 4 4 3
D=6 5 5 5 6
E=7 4 6 4 7
F=7 4 6 4 4
G=3 4 5 5 3
H=5 5 7 5 5
I=7 2 2 2 7
J=1 1 1 5 2
K=5 5 6 5 5
L=4 4 4 4 7
M=5 7 7 5 5
N=6 5 5 5 5
O=2 5 5 5 2
P=6 5 6 4 4
Q=2 5 5 6 3
R=6 5 6 5 5
S=3 4 2 1 6
T=7 2 2 2 2
U=5 5 5 5 7
V=5 5 5 5 2
W=5 5 7 7 5
X=5 5 2 5 5
Y=5 5 2 2 2
Z=7 1 2 4 7
0=7 5 5 5 7
1=2 6 2 2 7
2=6 1 2 4 7
3=6 1 2 1 6
4=5 5 7 1 1
5=7 4 6 1 6
6=3 4 7 5 7
7=7 1 2 2 2
8=7 5 7 5 7
9=7 5 7 1 6
 =0 0 0 0 0
.=0 0 0 0 2
,=0 0 0 2 4
-=0 0 7 0 0
!=2 2 2 0 2
?=6 1 2 0 2
'=2 2 0 0 0
&=2 5 2 5 3
%=5 1 2 4 5
+=0 2 7 2 0
:=0 2 0 2 0
/=1 1 2 4 4
*=5 2 7 2 5
$=3 6 2 3 6
♥=5 7 7 2 0
`;

export const FONT_MAIN: Font = parseFont('main', 5, 7, 6, 8, MAIN_TABLE);
export const FONT_TINY: Font = parseFont('tiny', 3, 5, 4, 6, TINY_TABLE);

export interface TextOpts {
  font?: Font;
  /** Integer pixel scale (2 = chunky headings). */
  scale?: number;
  /** Drop shadow colour (1 px * scale down-right). */
  shadow?: number;
  /** 1-px outline colour (drawn around every glyph). */
  outline?: number;
  /** Anchor: x is the left (default), centre or right edge of the text. */
  align?: 'left' | 'center' | 'right';
}

const normalize = (s: string): string => s.toUpperCase();

export function textWidth(str: string, opts: TextOpts = {}): number {
  const font = opts.font ?? FONT_MAIN;
  const scale = opts.scale ?? 1;
  if (str.length === 0) return 0;
  return (str.length * font.advance - (font.advance - font.glyphW)) * scale;
}

function drawGlyphs(fb: Framebuffer, str: string, x: number, y: number, color: number, font: Font, scale: number): void {
  let cx = x;
  for (const ch of str) {
    const g = font.glyphs.get(ch) ?? font.glyphs.get('?')!;
    for (let ry = 0; ry < font.glyphH; ry++) {
      const bits = g[ry] ?? 0;
      for (let rx = 0; rx < font.glyphW; rx++) {
        if (bits & (1 << (font.glyphW - 1 - rx))) {
          if (scale === 1) fb.setPixel(cx + rx, y + ry, color);
          else fb.fillRect(cx + rx * scale, y + ry * scale, scale, scale, color);
        }
      }
    }
    cx += font.advance * scale;
  }
}

/** Draw single-line text. Returns the x of the left edge actually used. */
export function drawText(fb: Framebuffer, str: string, x: number, y: number, color: number, opts: TextOpts = {}): number {
  const font = opts.font ?? FONT_MAIN;
  const scale = opts.scale ?? 1;
  const s = normalize(str);
  const w = textWidth(s, opts);
  let left = x;
  if (opts.align === 'center') left = x - Math.floor(w / 2);
  else if (opts.align === 'right') left = x - w;
  if (opts.outline !== undefined) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
      drawGlyphs(fb, s, left + ox * scale, y + oy * scale, opts.outline, font, scale);
    }
  }
  if (opts.shadow !== undefined) drawGlyphs(fb, s, left + scale, y + scale, opts.shadow, font, scale);
  drawGlyphs(fb, s, left, y, color, font, scale);
  return left;
}

/** Greedy word wrap to a pixel width. Explicit "\n" is honoured. */
export function wrapText(str: string, maxWidth: number, opts: TextOpts = {}): string[] {
  const out: string[] = [];
  for (const para of normalize(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const trial = line ? `${line} ${word}` : word;
      if (line && textWidth(trial, opts) > maxWidth) {
        out.push(line);
        line = word;
      } else line = trial;
    }
    out.push(line);
  }
  return out;
}

/** Characters the main font can draw (used by copy tests to catch unsupported glyphs). */
export function fontSupports(font: Font, str: string): boolean {
  for (const ch of normalize(str)) if (!font.glyphs.has(ch)) return false;
  return true;
}
