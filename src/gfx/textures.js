import { Texture, Sprite } from 'pixi.js';
import { gridToRGBA } from './grid.js';

const registry = new Map(); // name → Texture[]

export function textureFromGrid(rows, pal) {
  const { w, h, data } = gridToRGBA(rows, pal);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}

export function defineSprites(defs) {
  for (const [name, def] of Object.entries(defs)) {
    registry.set(name, def.frames.map((f) => textureFromGrid(f, def.pal)));
  }
}
export function hasSprite(name) { return registry.has(name); }
export function spriteNames() { return [...registry.keys()]; }
export function frames(name) {
  const f = registry.get(name);
  if (!f) throw new Error(`unknown sprite ${name}`);
  return f;
}
export const tex = (name, frame = 0) => frames(name)[frame % frames(name).length];
export function makeSprite(name, frame = 0) { const s = new Sprite(tex(name, frame)); s.roundPixels = true; return s; }
export function setFrame(sprite, name, frame = 0) { sprite.texture = tex(name, frame); }
// frame index for a looping animation: `ticks` frames per image
export const animFrame = (t, ticks, count) => Math.floor(t / ticks) % count;
