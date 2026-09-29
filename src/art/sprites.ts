import type { SpriteDef } from '../core/pixelart';
import { CHAR_SPRITES } from './art_chars';
import { DISPLAY_SPRITES } from './art_displays';
import { ITEM_SPRITES } from './art_items';
import { TILE_SPRITES } from './art_tiles';

/**
 * Every sprite in the game, by name (see manifest.ts for the required set).
 * All art is authored in code: text rows in art_chars / art_items, procedural + text rows in
 * art_tiles, and a small paint API in art_displays.
 */
export const SPRITE_DEFS: Record<string, SpriteDef> = {
  ...CHAR_SPRITES,
  ...ITEM_SPRITES,
  ...TILE_SPRITES,
  ...DISPLAY_SPRITES,
};
