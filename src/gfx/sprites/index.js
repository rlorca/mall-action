import { DEFS as characters } from './characters.js';
import { DEFS as items } from './items.js';
import { DEFS as mall } from './mall.js';
import { DEFS as store } from './store.js';

export const ALL_DEFS = { ...characters, ...items, ...mall, ...store };

export async function registerAllSprites() {
  const { defineSprites } = await import('../textures.js');
  defineSprites(ALL_DEFS);
}
