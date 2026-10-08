// Pixel-art pipeline: indexed bitmaps built from code, checked for size and colour budget.
// Index 0 is transparent; indices 1..3 map to the sprite's three colours.

export const MAX_SPRITE_COLOURS = 3;

export class Bitmap {
  readonly px: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h);
  }

  set(x: number, y: number, c: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  outline(x: number, y: number, w: number, h: number, c: number): this {
    for (let i = 0; i < w; i++) {
      this.set(x + i, y, c);
      this.set(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.set(x, y + j, c);
      this.set(x + w - 1, y + j, c);
    }
    return this;
  }

  /** Copy another bitmap on top (transparent pixels of `src` are skipped). */
  blit(src: Bitmap, x: number, y: number): this {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const c = src.get(i, j);
        if (c) this.set(x + i, y + j, c);
      }
    return this;
  }

  /** Mirror horizontally into a new bitmap. */
  flipX(): Bitmap {
    const out = new Bitmap(this.w, this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) out.set(this.w - 1 - i, j, this.get(i, j));
    return out;
  }

  colourIndices(): number[] {
    const seen = new Set<number>();
    for (const c of this.px) if (c) seen.add(c);
    return [...seen].sort((a, b) => a - b);
  }
}

export interface SpriteDef {
  name: string;
  bitmap: Bitmap;
  /** Hex colour for index 1, 2, 3. */
  colours: readonly string[];
}

export function makeSprite(name: string, bitmap: Bitmap, colours: readonly string[]): SpriteDef {
  return { name, bitmap, colours };
}

export interface SpriteIssue {
  sprite: string;
  problem: string;
}

/** Returns human-readable problems with a sprite; empty when it is valid. */
export function checkSprite(s: SpriteDef, expectW?: number, expectH?: number): SpriteIssue[] {
  const issues: SpriteIssue[] = [];
  if (expectW !== undefined && s.bitmap.w !== expectW) issues.push({ sprite: s.name, problem: `width ${s.bitmap.w} != ${expectW}` });
  if (expectH !== undefined && s.bitmap.h !== expectH) issues.push({ sprite: s.name, problem: `height ${s.bitmap.h} != ${expectH}` });
  const used = s.bitmap.colourIndices();
  if (used.length > MAX_SPRITE_COLOURS) issues.push({ sprite: s.name, problem: `${used.length} colours` });
  for (const c of used) {
    if (c > s.colours.length) issues.push({ sprite: s.name, problem: `index ${c} has no colour` });
  }
  return issues;
}

/** Converts a sprite to RGBA bytes for a 2D canvas, with transparent pixels at alpha 0. */
export function spriteRGBA(s: SpriteDef, flip = false): Uint8ClampedArray {
  const bmp = flip ? s.bitmap.flipX() : s.bitmap;
  const out = new Uint8ClampedArray(bmp.w * bmp.h * 4);
  const rgb = s.colours.map(hexToRgb);
  for (let i = 0; i < bmp.px.length; i++) {
    const c = bmp.px[i];
    if (!c) continue;
    const [r, g, b] = rgb[c - 1];
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
