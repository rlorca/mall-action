import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall, respawnPlayer } from '../src/game/mallWorld.js';
import { createStoreWorld, stepStore } from '../src/game/storeWorld.js';
import { createGameState } from '../src/game/state.js';
import { applyPowerup } from '../src/logic/powerups.js';
import { carFloor } from '../src/logic/elevator.js';
import { feetY } from '../src/world/constants.js';
import { SHAFTS, SHAFT_W } from '../src/world/mallLevel.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };
function setup(seed = 9) {
  const state = createGameState({ seed }); const world = createMallWorld(state);
  world.spawnT = 1e9; world.cop = null; world.walkers = []; world.janitor = null;
  Object.assign(world.player, { mode: 'ground', introT: 0, grounded: true });
  return { state, world, p: world.player };
}

describe('review fixes', () => {
  it('an AI car does not leave while the player stands inside it', () => {
    const { state, world, p } = setup();
    const c = world.cars.find((k) => k.id === 'C');
    c.aiTimer = 0;
    Object.assign(p, { x: c.x + 12, floor: carFloor(c), y: c.y });
    const ev = run(world, state, NONE, 200);
    expect(ev.some((e) => e.type === 'playerDied')).toBe(false);
    expect(p.mode).toBe('ground');
  });
  it('pressing up next to a shaft calls a manual car to your floor', () => {
    const { state, world, p } = setup();
    const b = world.cars.find((k) => k.id === 'B'); b.y = feetY(5);
    Object.assign(p, { x: b.x + SHAFT_W + 10, floor: 4, y: feetY(4) });
    run(world, state, pad([], ['up']), 1);
    run(world, state, NONE, 80);
    expect(carFloor(b)).toBe(4);
  });
  it('store visits keep power-up timers running', () => {
    const state = createGameState({ seed: 9 });
    applyPowerup(state.power, 'rapid');
    const w = createStoreWorld('radioshock', state, state.rng); w.guards = [];
    for (let i = 0; i < 1200; i++) stepStore(w, NONE, state, state.rng);
    expect(state.power.weapon).toBeNull();
  });
  it('janitor wet patches never reach shaft B on 1F', () => {
    const state = createGameState({ seed: 9 }); const world = createMallWorld(state);
    world.spawnT = 1e9;
    const B = SHAFTS.find((s) => s.id === 'B');
    Object.assign(world.janitor, { x: 1000, facing: 1, t: 1 });
    run(world, state, NONE, 70);
    expect(world.wet.length).toBe(1);
    expect(world.wet[0].x1).toBeLessThanOrEqual(B.x);
  });
  it('respawning clears the detain freeze and calms the mall cop', () => {
    const state = createGameState({ seed: 9 }); const world = createMallWorld(state);
    const p = world.player;
    Object.assign(p, { mode: 'dying', frozenT: 150, hiddenT: 20, slideDir: 1, lastSafe: { x: 60, floor: 1 } });
    world.cop.state = 'chase';
    respawnPlayer(world);
    expect(p).toMatchObject({ mode: 'ground', frozenT: 0, slideDir: 0, floor: 1, x: 60 });
    expect(world.cop.state).toBe('patrol');
    expect(world.spies).toEqual([]);
  });
});
