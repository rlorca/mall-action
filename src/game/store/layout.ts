// Deterministic fixture-content layout for a store. Same progress seed + store + loop => identical layout on re-entry.
import { Rng, hashString } from '../../core/rng';
import type { StoreId } from '../../core/events';
import { STORE_BY_ID } from '../../data/stores';
import { FOOD_POWERUPS, type PowerupKind } from '../progress';
import type { FixtureContent } from './types';

/** Non-food power-ups, weighted (duplicates = weight). 1-up is rare. */
const NON_FOOD_POOL: readonly PowerupKind[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup'];

function pickPower(rng: Rng, food: boolean): PowerupKind {
  if (food) return rng.pick(FOOD_POWERUPS);
  return rng.pick(NON_FOOD_POOL);
}

export function layoutSeed(progressSeed: number, id: StoreId, loop: number): number {
  return (progressSeed ^ hashString(id) ^ Math.imul(loop, 0x9e3779b1)) >>> 0;
}

/**
 * Sample the content of every searchable fixture (index = row-major order of fixtures in the template).
 * - target store: EXACTLY ONE package; others: trap / power-up / nothing. Black Friday: every non-package is a power-up.
 * - power-up shop: only power-ups or nothing (never a trap, never a package). Black Friday: all power-ups.
 */
export function generateContents(id: StoreId, count: number, progressSeed: number, loop: number, blackFriday: boolean): FixtureContent[] {
  const def = STORE_BY_ID[id];
  const rng = new Rng(layoutSeed(progressSeed, id, loop));
  const out: FixtureContent[] = [];
  if (count <= 0) return out;
  const pkg = def.role === 'target' ? rng.int(count) : -1;
  const foodStore = id === 'hotspy';
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const foodRoll = rng.next();
    const power = (): FixtureContent => {
      const food = blackFriday ? foodRoll < 0.2 : foodStore && foodRoll < 0.65;
      return { kind: 'powerup', power: pickPower(rng, food) };
    };
    if (i === pkg) {
      out.push({ kind: 'package' });
    } else if (blackFriday) {
      out.push(power());
    } else if (def.role === 'powerup') {
      out.push(roll < 0.65 ? power() : { kind: 'nothing' });
    } else {
      out.push(roll < 0.25 ? { kind: 'trap' } : roll < 0.55 ? power() : { kind: 'nothing' });
    }
  }
  // A power-up shop always holds at least one power-up.
  if (def.role === 'powerup' && !out.some((c) => c.kind === 'powerup')) {
    out[rng.int(count)] = { kind: 'powerup', power: pickPower(rng, false) };
  }
  return out;
}
