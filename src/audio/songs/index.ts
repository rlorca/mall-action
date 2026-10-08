/**
 * Registry of every composition, keyed by MusicId. `SONG_DEFS` is the authoring data; `getSong(id)` compiles
 * lazily (and caches), so the browser only pays for the tracks it actually plays. Adding a MusicId in ids.ts
 * without a song here is a type error (and fails the coverage test).
 */
import type { MusicId } from '../ids';
import { type CompiledSong, type SongDef, compileSong } from '../song';
import { alarm, booth, continueSong, elevator, mall, newspaper, title } from './core';
import { gameover, itemget, levelclear, selfie, splash } from './jingles';
import { footlock, forever12, hotspy, kgbtoys, radioshock } from './stores1';
import { crookstone, gamestonk, sambaddy, sharper, spenders } from './stores2';

export const SONG_DEFS: Readonly<Record<MusicId, SongDef>> = {
  title,
  mall,
  alarm,
  elevator,
  booth,
  continue: continueSong,
  newspaper,
  'store.forever12': forever12,
  'store.radioshock': radioshock,
  'store.kgbtoys': kgbtoys,
  'store.hotspy': hotspy,
  'store.footlock': footlock,
  'store.sambaddy': sambaddy,
  'store.crookstone': crookstone,
  'store.sharper': sharper,
  'store.spenders': spenders,
  'store.gamestonk': gamestonk,
  splash,
  levelclear,
  gameover,
  itemget,
  selfie,
};

const cache = new Map<MusicId, CompiledSong>();

/** The compiled song for an id (compiled on first use). Throws if the authoring data is malformed. */
export function getSong(id: MusicId): CompiledSong {
  let s = cache.get(id);
  if (!s) {
    s = compileSong(SONG_DEFS[id]);
    cache.set(id, s);
  }
  return s;
}
