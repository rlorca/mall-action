import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { GETAWAY_CAR } from '../src/world/mallLevel.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
function setup() {
  const state = createGameState({ seed: 6 }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; }); world.spawnT = 1e9; world.cop = null;
  Object.assign(world.player, { mode: 'ground', introT: 0, x: GETAWAY_CAR.x + 20, floor: 5, y: feetY(5) });
  return { state, world };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('level exit', () => {
  it('is blocked with packages left', () => {
    const { state, world } = setup(); state.packages.add('a');
    expect(run(world, state, pad([], ['up']), 1)).toContainEqual({ type: 'exitBlocked', left: 5 });
  });
  it('clears exactly once with all six packages', () => {
    const { state, world } = setup(); ['a', 'b', 'c', 'd', 'e', 'f'].forEach((p) => state.packages.add(p));
    const ev = [...run(world, state, pad([], ['up']), 1), ...run(world, state, pad([], ['up']), 1)];
    expect(ev.filter((e) => e.type === 'levelClear')).toHaveLength(1);
  });
});
