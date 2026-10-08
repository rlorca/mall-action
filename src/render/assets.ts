// Turns the generated sprites into offscreen canvases once, at start-up.
import { buildSprites } from '../core/sprites';
import { spriteRGBA, type SpriteDef } from '../core/pixels';

export type SpriteCanvas = HTMLCanvasElement;

export class Assets {
  readonly defs: Record<string, SpriteDef> = buildSprites();
  private cache = new Map<string, SpriteCanvas>();

  canvas(name: string, flip = false): SpriteCanvas {
    const key = flip ? `${name}:flip` : name;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const def = this.defs[name];
    if (!def) throw new Error(`unknown sprite ${name}`);
    const c = document.createElement('canvas');
    c.width = def.bitmap.w;
    c.height = def.bitmap.h;
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    img.data.set(spriteRGBA(def, flip));
    g.putImageData(img, 0, 0);
    this.cache.set(key, c);
    return c;
  }
}
