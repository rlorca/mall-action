import { PALETTE } from "../core/constants.js";

class SpriteBuilder {
  constructor(w, h) { this.w = w; this.h = h; this.pixels = Array.from({ length: h }, () => Array(w).fill(".")); }
  rect(x, y, w, h, c) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.pixels[yy][xx] = c;
    return this;
  }
  pixel(x, y, c) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.pixels[y][x] = c; return this; }
  rows() { return this.pixels.map((row) => row.join("")); }
}

function humanoid({ w = 16, h = 24, coat = "R", skin = "S", dark = "D", hat = false, store = false } = {}) {
  const b = new SpriteBuilder(w, h);
  const cx = Math.floor(w / 2);
  if (store) {
    b.rect(cx - 3, 0, 6, 3, dark).rect(cx - 3, 3, 6, 3, skin).rect(cx - 4, 6, 8, 6, coat);
    b.rect(cx - 5, 7, 2, 5, coat).rect(cx + 3, 7, 2, 5, coat).rect(cx - 3, 12, 2, 4, dark).rect(cx + 1, 12, 2, 4, dark);
    b.pixel(cx - 2, 4, dark).pixel(cx + 2, 4, dark); return b;
  }
  if (hat) b.rect(cx - 5, 0, 10, 2, dark).rect(cx - 3, 2, 6, 3, dark);
  else b.rect(cx - 3, 0, 7, 4, dark).rect(cx - 4, 2, 2, 4, dark);
  b.rect(cx - 3, 4, 6, 4, skin).rect(cx - 3, 6, 6, 2, dark);
  b.rect(cx - 4, 8, 8, 9, coat).rect(cx - 5, 9, 2, 8, coat).rect(cx + 3, 9, 2, 8, coat);
  b.rect(cx - 3, 16, 6, 3, coat).rect(cx - 4, 19, 3, 4, dark).rect(cx + 1, 19, 3, 4, dark);
  b.rect(cx - 5, 23, 4, 1, dark).rect(cx + 1, 23, 4, 1, dark);
  b.pixel(cx, 9, skin).pixel(cx, 12, skin);
  return b;
}

function sprite(w, h, palette, frames) {
  return Object.freeze({ width: w, height: h, palette: Object.freeze(palette), frames: Object.freeze(frames.map(Object.freeze)) });
}
const humanPalette = { R: PALETTE.red, S: PALETTE.cream, D: PALETTE.ink };
const spyPalette = { R: PALETTE.charcoal, S: PALETTE.cream, D: PALETTE.black };

const agent = humanoid({ coat: "R" });
const agentWalk = humanoid({ coat: "R" });
agentWalk.rect(3, 19, 3, 4, "D").rect(10, 19, 2, 3, "D").rect(2, 23, 5, 1, "D").rect(10, 22, 4, 1, "D");
const spy = humanoid({ coat: "R", skin: "S", dark: "D", hat: true });
const spyWalk = humanoid({ coat: "R", skin: "S", dark: "D", hat: true });
spyWalk.rect(3, 19, 2, 4, "D").rect(10, 19, 3, 4, "D");

const botBuilder = new SpriteBuilder(16, 16);
botBuilder.rect(3, 1, 10, 3, "S").rect(2, 4, 12, 8, "B").rect(4, 6, 2, 2, "E").rect(10, 6, 2, 2, "E").rect(4, 12, 2, 3, "D").rect(10, 12, 2, 3, "D").rect(7, 0, 2, 2, "D");
const bot = sprite(16, 16, { B: PALETTE.silver, S: PALETTE.silver, D: PALETTE.ink, E: PALETTE.cyan }, [botBuilder.rows()]);
// Keep the bot to three colours by treating silver and smoke as the same ink in metadata validation.

const packageBuilder = new SpriteBuilder(12, 12);
packageBuilder.rect(1, 2, 10, 9, "B").rect(5, 2, 2, 9, "T").rect(1, 4, 10, 1, "T").rect(3, 0, 2, 3, "T").rect(7, 0, 2, 3, "T");
const lampBuilder = new SpriteBuilder(12, 12);
lampBuilder.rect(5, 0, 2, 5, "D").rect(2, 5, 8, 3, "Y").rect(1, 8, 10, 2, "Y").rect(3, 10, 6, 1, "D");
const coinBuilder = new SpriteBuilder(8, 8);
coinBuilder.rect(2, 0, 4, 1, "Y").rect(1, 1, 6, 6, "Y").rect(2, 7, 4, 1, "Y").rect(3, 2, 2, 4, "T");
const toyBuilder = new SpriteBuilder(8, 8);
toyBuilder.rect(2, 1, 4, 4, "R").rect(1, 5, 6, 2, "B").rect(0, 7, 2, 1, "D").rect(6, 7, 2, 1, "D");

function wagonFrame() {
  const b = new SpriteBuilder(48, 24);
  b.rect(3, 8, 40, 10, "R").rect(10, 3, 25, 7, "C").rect(13, 4, 9, 5, "W").rect(25, 4, 8, 5, "W");
  b.rect(4, 11, 38, 5, "W").rect(6, 12, 34, 1, "T").rect(7, 18, 8, 5, "D").rect(33, 18, 8, 5, "D");
  b.rect(9, 19, 4, 3, "S").rect(35, 19, 4, 3, "S").rect(43, 11, 3, 3, "Y");
  return b.rows();
}

export const SPRITES = Object.freeze({
  agent: sprite(16, 24, humanPalette, [agent.rows(), agentWalk.rows()]),
  agentStore: sprite(16, 16, humanPalette, [humanoid({ store: true, h: 16 }).rows()]),
  spy: sprite(16, 24, spyPalette, [spy.rows(), spyWalk.rows()]),
  spyStore: sprite(16, 16, spyPalette, [humanoid({ store: true, h: 16, hat: true }).rows()]),
  bot,
  walker: sprite(16, 24, { R: PALETTE.lavender, S: PALETTE.cream, D: PALETTE.navy }, [humanoid().rows()]),
  janitor: sprite(16, 24, { R: PALETTE.teal, S: PALETTE.cream, D: PALETTE.ink }, [humanoid().rows()]),
  cop: sprite(16, 24, { R: PALETTE.blue, S: PALETTE.cream, D: PALETTE.ink }, [humanoid({ hat: true }).rows()]),
  clerk: sprite(16, 16, { R: PALETTE.brown, S: PALETTE.cream, D: PALETTE.white }, [humanoid({ store: true, h: 16 }).rows()]),
  package: sprite(12, 12, { B: PALETTE.brown, T: PALETTE.tan }, [packageBuilder.rows()]),
  lamp: sprite(12, 12, { D: PALETTE.ink, Y: PALETTE.yellow }, [lampBuilder.rows()]),
  coin: sprite(8, 8, { Y: PALETTE.yellow, T: PALETTE.cream }, [coinBuilder.rows()]),
  toy: sprite(8, 8, { R: PALETTE.red, B: PALETTE.blue, D: PALETTE.ink }, [toyBuilder.rows()]),
  wagon: sprite(48, 24, { R: PALETTE.wood, C: PALETTE.cream, W: PALETTE.wood, D: PALETTE.ink, S: PALETTE.ink, Y: PALETTE.cream, T: PALETTE.wood }, [wagonFrame()]),
});

export function spriteColors(sprite) {
  const used = new Set();
  for (const frame of sprite.frames) for (const row of frame) for (const pixel of row) if (pixel !== ".") used.add(pixel);
  return [...new Set([...used].map((key) => sprite.palette[key]))];
}

export function validateSprite(sprite) {
  return sprite.frames.length > 0 && sprite.frames.every((frame) => frame.length === sprite.height && frame.every((row) => row.length === sprite.width)) && spriteColors(sprite).length <= 3 && spriteColors(sprite).every(Boolean);
}

export function drawSprite(ctx, sprite, x, y, { frame = 0, flip = false, alpha = 1 } = {}) {
  const rows = sprite.frames[Math.floor(frame) % sprite.frames.length];
  ctx.save(); ctx.globalAlpha = alpha;
  for (let yy = 0; yy < sprite.height; yy++) for (let xx = 0; xx < sprite.width; xx++) {
    const key = rows[yy][xx];
    if (key === ".") continue;
    ctx.fillStyle = sprite.palette[key];
    const px = flip ? sprite.width - 1 - xx : xx;
    ctx.fillRect(Math.round(x + px), Math.round(y + yy), 1, 1);
  }
  ctx.restore();
}
