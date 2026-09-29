// Central sprite registry. Each sprites-*.ts group exports SpriteDef[]; names must be unique.
import type { SpriteDef } from './pixel';
import { SPRITES_CHARACTERS } from './sprites-characters';
import { SPRITES_OBJECTS } from './sprites-objects';
import { SPRITES_TILES } from './sprites-tiles';

export const ALL_SPRITES: SpriteDef[] = [...SPRITES_CHARACTERS, ...SPRITES_OBJECTS, ...SPRITES_TILES];

const byName = new Map<string, SpriteDef>();
for (const s of ALL_SPRITES) {
  if (byName.has(s.name)) throw new Error(`duplicate sprite name: ${s.name}`);
  byName.set(s.name, s);
}

export function hasSprite(name: string): boolean {
  return byName.has(name);
}

export function getSprite(name: string): SpriteDef {
  const s = byName.get(name);
  if (!s) throw new Error(`unknown sprite: ${name}`);
  return s;
}
