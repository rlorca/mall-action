// Vocabulary shared by store room templates (rules) and tile art. A room template is an array of strings,
// one char per 16x16 tile. The door is at the bottom centre: row (h-1), column floor(w/2) is 'd'.
import type { ThemeId } from '../../data/stores';

export type TileKind =
  | 'floor' | 'wall' | 'fixture' | 'fixture2' | 'counter' | 'decor' | 'decor2'
  | 'fitting' | 'toyshelf' | 'booth' | 'demotv' | 'pedestal' | 'door';

export const TILE_CHARS: Readonly<Record<string, TileKind>> = {
  '.': 'floor',
  '#': 'wall',
  S: 'fixture', // searchable; themed; has closed and opened look
  T: 'fixture2', // searchable; second themed variant
  C: 'counter', // solid
  D: 'decor', // solid
  E: 'decor2', // solid
  F: 'fitting', // Forever 12 fitting room (searchable, special)
  K: 'toyshelf', // KGB Toys shelf (solid, shootable, releases wind-up toys)
  B: 'booth', // Sam Baddy listening booth (walkable, triggers bonus track)
  V: 'demotv', // GameStonk flickering demo TV (solid)
  P: 'pedestal', // GameStonk item pedestal (walkable trigger)
  d: 'door', // walkable
};

export const SOLID_KINDS: ReadonlySet<TileKind> = new Set<TileKind>(['wall', 'fixture', 'fixture2', 'counter', 'decor', 'decor2', 'fitting', 'toyshelf', 'demotv']);
export const SEARCHABLE_KINDS: ReadonlySet<TileKind> = new Set<TileKind>(['fixture', 'fixture2', 'fitting']);

/**
 * Tile sprite names (16x16, in the art registry):
 *  themed:   tile_<theme>_floor, _wall, _fixture, _fixture_open, _fixture2, _fixture2_open, _counter, _decor, _decor2
 *  unthemed: tile_fitting, tile_fitting_open, tile_toyshelf, tile_toyshelf_empty, tile_booth, tile_demotv (2+ frames),
 *            tile_pedestal, tile_door, tile_door_mat
 * Themes: fashion, electronics, toys, food, sports, music, gadgets, novelty, games
 */
export function tileSpriteName(theme: ThemeId, kind: 'floor' | 'wall' | 'fixture' | 'fixture_open' | 'fixture2' | 'fixture2_open' | 'counter' | 'decor' | 'decor2'): string {
  return `tile_${theme}_${kind}`;
}
