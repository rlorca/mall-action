import { GETAWAY_CAR } from '../world/mallLevel.js';
import { canExit, packagesLeft } from '../logic/rules.js';

// Up at the getaway car on P: leave with all packages, or get told how many are left.
export function exitHook(p, world, state) {
  if (p.floor !== GETAWAY_CAR.floor || p.x < GETAWAY_CAR.x || p.x > GETAWAY_CAR.x + GETAWAY_CAR.w) return null;
  if (world.exiting) return [];
  if (!canExit(state)) return [{ type: 'exitBlocked', left: packagesLeft(state) }, { type: 'sfx', name: 'buzzer' }];
  world.exiting = true;
  Object.assign(p, { mode: 'exit', vx: 0 });
  return [{ type: 'levelClear' }];
}
