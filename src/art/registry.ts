import { parseSprite, type Sprite, type SpriteDef } from '../engine/sprite';

/**
 * Global sprite registry. Art modules call `defineSprites([...])` at import time
 * (side effect); renderers look sprites up by name with `getSprite`. The manifest
 * test (manifest.test.ts) checks that every required name exists with the right
 * size, enough frames and at most 3 colours.
 */
const sprites = new Map<string, Sprite>();

export function defineSprites(defs: readonly SpriteDef[]): void {
  for (const d of defs) {
    if (sprites.has(d.name)) throw new Error(`duplicate sprite name: ${d.name}`);
    sprites.set(d.name, parseSprite(d));
  }
}

export function getSprite(name: string): Sprite {
  const s = sprites.get(name);
  if (!s) throw new Error(`unknown sprite: ${name}`);
  return s;
}

export function hasSprite(name: string): boolean {
  return sprites.has(name);
}

export function allSprites(): Sprite[] {
  return [...sprites.values()];
}
