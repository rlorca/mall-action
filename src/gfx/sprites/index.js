import { DEFS as characters } from './characters.js';
import { DEFS as items } from './items.js';

export const ALL_DEFS = { ...characters, ...items };

export async function registerAllSprites() {
  const { defineSprites } = await import('../textures.js');
  defineSprites(ALL_DEFS);
}
