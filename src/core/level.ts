import {
  ALARM_TIME,
  ALARM_TIME_MIN,
  ALARM_TIME_PER_LOOP,
  LOOP_FIRE_CAP,
  LOOP_FIRE_MULT,
  LOOP_SPAWN_CAP,
  LOOP_SPAWN_MULT,
  LOOP_SPY_SPEED_CAP,
  LOOP_SPY_SPEED_MULT,
} from './constants';
import { NON_FOOD_POWERUP_IDS, FOOD_POWERUP_IDS, type PowerUpId } from './powerups';
import type { Rng } from './rng';
import { OPEN_STORES, SEARCHABLE, type StoreDef } from './storeDefs';
import type { FixtureContent, LevelState, StoreRuntime } from './types';

export const fixtureKey = (tx: number, ty: number): string => `${tx},${ty}`;

/** All searchable tile positions in a store layout, in reading order. */
export function searchableTiles(def: StoreDef): { tx: number; ty: number; char: string }[] {
  const out: { tx: number; ty: number; char: string }[] = [];
  if (!def.layout) return out;
  for (let ty = 0; ty < def.layout.length; ty++) {
    const row = def.layout[ty];
    for (let tx = 0; tx < row.length; tx++) {
      if (SEARCHABLE.has(row[tx])) out.push({ tx, ty, char: row[tx] });
    }
  }
  return out;
}

/** Power-ups that can be hidden in a fixture. 1-Up is rare; food is common in
 *  the food court. */
function rollPowerUp(rng: Rng, def: StoreDef): PowerUpId {
  // Food mostly comes from Hot Spy on a Stick.
  if (def.id === 'hotspy') {
    return rng.chance(0.8) ? rng.pick(FOOD_POWERUP_IDS) : rng.pick(NON_FOOD_POWERUP_IDS);
  }
  if (rng.chance(0.15)) return rng.pick(FOOD_POWERUP_IDS);
  const pool = NON_FOOD_POWERUP_IDS.filter((id) => id !== 'oneup');
  // 1-Up shows up occasionally.
  return rng.chance(0.08) ? 'oneup' : rng.pick(pool);
}

/**
 * Decide what every fixture in every open store holds, for one loop.
 *
 * Invariants (pinned by tests/level.test.ts):
 *   - each target store holds EXACTLY one package;
 *   - power-up shops never hold a trap and never hold a package;
 *   - in Black Friday Mode every non-package fixture holds a power-up.
 */
export function buildStoreRuntimes(
  rng: Rng,
  blackFriday: boolean,
): Record<string, StoreRuntime> {
  const out: Record<string, StoreRuntime> = {};

  for (const def of OPEN_STORES) {
    const tiles = searchableTiles(def);
    const contents: StoreRuntime['contents'] = {};

    // Exactly one package, in a target store only.
    const packageIdx = def.role === 'target' ? rng.int(tiles.length) : -1;

    tiles.forEach((tile, i) => {
      const key = fixtureKey(tile.tx, tile.ty);
      if (i === packageIdx) {
        contents[key] = { content: 'package', powerup: null };
        return;
      }
      if (blackFriday) {
        contents[key] = { content: 'powerup', powerup: rollPowerUp(rng, def) };
        return;
      }
      if (def.role === 'powerup') {
        // Power-up shops hold only power-ups or nothing. Never a trap.
        const c: FixtureContent = rng.chance(0.55) ? 'powerup' : 'nothing';
        contents[key] = { content: c, powerup: c === 'powerup' ? rollPowerUp(rng, def) : null };
        return;
      }
      const r = rng.next();
      if (r < 0.2) {
        contents[key] = { content: 'powerup', powerup: rollPowerUp(rng, def) };
      } else if (r < 0.38) {
        contents[key] = { content: 'trap', powerup: null };
      } else {
        contents[key] = { content: 'nothing', powerup: null };
      }
    });

    out[def.id] = {
      contents,
      opened: {},
      cleared: false,
      visited: false,
      fittingRoomUsed: false,
    };
  }

  return out;
}

/** Difficulty for a loop. All multipliers are capped. */
export function loopDifficulty(loop: number): {
  spySpeedMult: number;
  spawnMult: number;
  fireMult: number;
  alarmAt: number;
} {
  const n = Math.max(0, loop - 1);
  return {
    spySpeedMult: Math.min(LOOP_SPY_SPEED_CAP, Math.pow(LOOP_SPY_SPEED_MULT, n)),
    spawnMult: Math.min(LOOP_SPAWN_CAP, Math.pow(LOOP_SPAWN_MULT, n)),
    fireMult: Math.min(LOOP_FIRE_CAP, Math.pow(LOOP_FIRE_MULT, n)),
    alarmAt: Math.max(ALARM_TIME_MIN, ALARM_TIME - n * ALARM_TIME_PER_LOOP),
  };
}

export function newLevel(rng: Rng, loop: number, blackFriday: boolean): LevelState {
  const d = loopDifficulty(loop);
  return {
    loop,
    frames: 0,
    alarmAt: d.alarmAt,
    alarm: false,
    packages: 0,
    stores: buildStoreRuntimes(rng, blackFriday),
    spySpeedMult: d.spySpeedMult,
    spawnMult: d.spawnMult,
    fireMult: d.fireMult,
    zeldaEggUsed: false,
  };
}

/** Target stores that still hold their package. */
export function remainingPackageStores(level: LevelState): StoreDef[] {
  return OPEN_STORES.filter((s) => s.role === 'target' && !level.stores[s.id].cleared);
}

/** Open stores spies may come out of: uncleared targets and power-up shops. */
export function spySpawnStores(level: LevelState): StoreDef[] {
  return OPEN_STORES.filter((s) => s.role === 'powerup' || !level.stores[s.id].cleared);
}

/** A cleared target store cannot be entered again. */
export function canEnterStore(level: LevelState, def: StoreDef): boolean {
  if (def.role === 'closed') return false;
  if (def.role === 'target' && level.stores[def.id].cleared) return false;
  return true;
}
