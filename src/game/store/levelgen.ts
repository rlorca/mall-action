import type { Rng } from '../../engine/rng';
import { FOOD_POWERS, NON_FOOD_POWERS, type PowerId } from '../../content/powerups';
import { OPEN_STORES, type StoreDef, type StoreId } from '../../content/stores';
import type { FixtureContent, LevelState, StoreState } from '../levelstate';
import { fixtureCount } from './room';

/**
 * Level setup: what every searchable fixture of the 10 open stores holds.
 *
 * Rules (tests enforce them):
 *  - exactly ONE package in each of the 6 target stores;
 *  - power-up shops hold only power-ups or nothing (never traps, never packages);
 *  - Black Friday: every non-package fixture (targets and shops) holds a power-up;
 *  - the same seed always generates the same level (each store draws from its own `rng.fork`).
 *
 * Normal mode, target stores: ~28% of the other fixtures are power-ups, ~28% (+4% per loop, capped at
 * 50%) are traps and the rest are empty, with at most 3 traps per store. Power-up shops: ~75% power-ups
 * and at least 2 of them. Food power-ups mostly come from Hot Spy on a Stick (brief section 7).
 */
export const MAX_TRAPS_PER_STORE = 3;
export const MIN_POWERUPS_PER_SHOP = 2;

/** Relative weights of each power-up. Food is rare everywhere except Hot Spy on a Stick. */
export function powerWeights(storeId: StoreId): Array<[PowerId, number]> {
  const foodWeight = storeId === 'hotspy' ? 7 : 0.5;
  const weights: Array<[PowerId, number]> = [];
  for (const id of NON_FOOD_POWERS) weights.push([id, id === 'oneup' ? 1 : id === 'radar' ? 2 : 3]);
  for (const id of FOOD_POWERS) weights.push([id, foodWeight]);
  return weights;
}

export function pickPower(rng: Rng, storeId: StoreId): PowerId {
  const weights = powerWeights(storeId);
  let total = 0;
  for (const [, w] of weights) total += w;
  let roll = rng.next() * total;
  for (const [id, w] of weights) {
    roll -= w;
    if (roll < 0) return id;
  }
  return weights[weights.length - 1]![0];
}

function powerContent(rng: Rng, storeId: StoreId): FixtureContent {
  return { kind: 'powerup', power: pickPower(rng, storeId) };
}

/** Contents of one store's fixtures, in the room's fixture (reading) order. */
export function storeContents(def: StoreDef, rng: Rng, loop: number, blackFriday: boolean): FixtureContent[] {
  const n = fixtureCount(def.id);
  const out: FixtureContent[] = [];
  if (def.role === 'powerup') {
    for (let i = 0; i < n; i++) {
      out.push(blackFriday || rng.chance(0.75) ? powerContent(rng, def.id) : { kind: 'nothing' });
    }
    // a shop with fewer than MIN_POWERUPS_PER_SHOP power-ups would be pointless: top it up
    let have = out.filter((c) => c.kind === 'powerup').length;
    for (let i = 0; i < n && have < MIN_POWERUPS_PER_SHOP; i++) {
      if (out[i]!.kind !== 'powerup') {
        out[i] = powerContent(rng, def.id);
        have++;
      }
    }
    return out;
  }
  // target store: one package, the rest power-ups / traps / nothing
  const packageAt = rng.int(n);
  const trapP = Math.min(0.5, 0.28 + 0.04 * Math.max(0, loop - 1));
  let traps = 0;
  for (let i = 0; i < n; i++) {
    if (i === packageAt) {
      out.push({ kind: 'package' });
      continue;
    }
    if (blackFriday) {
      out.push(powerContent(rng, def.id));
      continue;
    }
    const roll = rng.next();
    if (roll < 0.28) out.push(powerContent(rng, def.id));
    else if (roll < 0.28 + trapP && traps < MAX_TRAPS_PER_STORE) {
      traps++;
      out.push({ kind: 'trap' });
    } else out.push({ kind: 'nothing' });
  }
  return out;
}

/**
 * Generate the store contents of a whole level. Deterministic in (rng state, loop, blackFriday).
 * Advances `rng` by one step, so calling it again with the same Rng object gives the next level.
 */
export function generateLevel(rng: Rng, loop: number, blackFriday: boolean): LevelState {
  const seed = rng.getState();
  const base = rng.fork('level.stores');
  rng.next();
  const stores: Partial<Record<StoreId, StoreState>> = {};
  for (const def of OPEN_STORES) {
    const contents = storeContents(def, base.fork(`store.${def.id}`), loop, blackFriday);
    stores[def.id] = {
      id: def.id,
      fixtures: contents.map((content) => ({ content, opened: false })),
      packageTaken: false,
    };
  }
  return { seed, loop, blackFriday, stores };
}
