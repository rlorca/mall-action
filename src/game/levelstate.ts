import type { PowerId } from '../content/powerups';
import { storeDef, type StoreId } from '../content/stores';

/**
 * Per-level state of the store contents. Generated at level start by
 * `generateLevel` (src/game/store/levelgen.ts) from a seeded Rng.
 */
export type FixtureContent =
  | { kind: 'package' }
  | { kind: 'powerup'; power: PowerId }
  | { kind: 'trap' }
  | { kind: 'nothing' };

export interface FixtureState {
  content: FixtureContent;
  /** Searched fixtures stay open for the rest of the level (even after leaving and re-entering). */
  opened: boolean;
}

export interface StoreState {
  id: StoreId;
  /** In the order of the room template's searchable fixtures (reading order: rows top->bottom, left->right). */
  fixtures: FixtureState[];
  /** Target stores: the package has been taken (store is now cleared and cannot be entered). */
  packageTaken: boolean;
}

export interface LevelState {
  seed: number;
  loop: number;
  blackFriday: boolean;
  /** Open stores only (6 targets + 4 power-up shops). */
  stores: Partial<Record<StoreId, StoreState>>;
}

export type StoreStatus = 'package' | 'cleared' | 'powerup' | 'closed';

export function storeStatus(level: LevelState, id: StoreId): StoreStatus {
  const def = storeDef(id);
  if (def.role === 'closed') return 'closed';
  if (def.role === 'powerup') return 'powerup';
  return level.stores[id]?.packageTaken ? 'cleared' : 'package';
}

/** Can the agent walk into this store right now? */
export function canEnterStore(level: LevelState, id: StoreId): boolean {
  const s = storeStatus(level, id);
  return s === 'package' || s === 'powerup';
}

/** Number of packages already taken this level. */
export function packagesTaken(level: LevelState): number {
  let n = 0;
  for (const s of Object.values(level.stores)) if (s?.packageTaken) n++;
  return n;
}
