import { Rng, hashSeed } from './rng';
import { StoreId, STORES, storeInfo } from './copy';
import { FOOD_POWERS, PowerKind, SHOP_POWERS } from './powerups';
import { OPEN_STORES, roomFor } from './stores-data';

export type Loot = { type: 'package' } | { type: 'powerup'; power: PowerKind } | { type: 'trap' } | { type: 'nothing' };

export interface FixtureState {
  col: number;
  row: number;
  kind: 'f' | 'F' | 'T';
  loot: Loot;
  opened: boolean;
  /** Forever 12 fitting rooms: the shrieking spy has already jumped out once. */
  revealed?: boolean;
  /** KGB toy shelves: the wind-up toys were already released. */
  released?: boolean;
}

export interface StoreSetup {
  id: StoreId;
  fixtures: FixtureState[];
  cleared: boolean;
  /** Has the agent been here this game (first-visit lines)? */
  visited: boolean;
}

export type LevelSetup = Record<string, StoreSetup>;

/** Share of fixtures that hold each thing (before the package). */
const TRAP_RATE = 0.2;
const POWER_RATE_TARGET = 0.22;
const POWER_RATE_SHOP = 0.55;

function pickPower(rng: Rng, storeId: StoreId, blackFriday: boolean): PowerKind {
  if (storeId === 'hotspy') {
    // Food mostly from Hot Spy on a Stick.
    return rng.chance(0.8) ? rng.pick(FOOD_POWERS) : rng.pick(SHOP_POWERS);
  }
  if (storeId === 'gamestonk' || storeId === 'crookstone' || storeId === 'sharper' || storeId === 'spenders') {
    return rng.pick(SHOP_POWERS);
  }
  // Ordinary stores: mostly the six shop powers, occasionally food.
  return rng.chance(0.15) ? rng.pick(FOOD_POWERS) : rng.pick(SHOP_POWERS);
}

/**
 * Deterministic level setup: where each package sits, which fixtures are trapped, what power-ups are inside.
 * Rules (tested): exactly ONE package per target store; power-up shops are never trapped and hold only
 * power-ups or nothing; in Black Friday Mode every non-package fixture holds a power-up.
 */
export function setupLevel(seed: number, loop: number, blackFriday = false): LevelSetup {
  const out: LevelSetup = {};
  for (const id of OPEN_STORES) {
    const info = storeInfo(id);
    const room = roomFor(id);
    const rng = new Rng(hashSeed('store', seed, loop, id));
    const fixtures: FixtureState[] = room.fixtures.map((f) => ({ col: f.col, row: f.row, kind: f.kind, loot: { type: 'nothing' }, opened: false }));
    let packageIdx = -1;
    if (info.role === 'target') {
      packageIdx = rng.int(0, fixtures.length - 1);
    }
    fixtures.forEach((fx, i) => {
      if (i === packageIdx) {
        fx.loot = { type: 'package' };
        return;
      }
      if (blackFriday) {
        fx.loot = { type: 'powerup', power: pickPower(rng, id, true) };
        return;
      }
      const roll = rng.next();
      if (info.role === 'powerup') {
        fx.loot = roll < POWER_RATE_SHOP ? { type: 'powerup', power: pickPower(rng, id, false) } : { type: 'nothing' };
      } else if (roll < TRAP_RATE) {
        fx.loot = { type: 'trap' };
      } else if (roll < TRAP_RATE + POWER_RATE_TARGET) {
        fx.loot = { type: 'powerup', power: pickPower(rng, id, false) };
      } else {
        fx.loot = { type: 'nothing' };
      }
    });
    out[id] = { id, fixtures, cleared: false, visited: false };
  }
  return out;
}

/** Stores whose package is still to be found. */
export function remainingPackageStores(setup: LevelSetup): StoreId[] {
  return STORES.filter((s) => s.role === 'target' && !setup[s.id]?.cleared).map((s) => s.id);
}
