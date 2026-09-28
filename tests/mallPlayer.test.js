import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { STORES, doorX, ESCALATORS, ESC_RUN } from '../src/world/mallLevel.js';
import { CAR_H } from '../src/logic/elevator.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup() {
  const state = createGameState({ seed: 1 });
  const world = createMallWorld(state);
  world.cars.find((c) => c.id === 'C').ai = false; // deterministic tests
  const p = world.player; p.mode = 'ground'; p.introT = 0;
  return { state, world, p, rng: state.rng };
}
const place = (p, x, floor) => Object.assign(p, { x, floor, y: feetY(floor), mode: 'ground', onRoof: null, riding: null });
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };

describe('mall player', () => {
  it('intro zipline lands on the roof', () => {
    const state = createGameState({ seed: 1 }); const world = createMallWorld(state);
    run(world, state, NONE, 61);
    expect(world.player).toMatchObject({ mode: 'ground', floor: 0, y: feetY(0) });
  });
  it('walks and is clamped by walls', () => {
    const { state, world, p } = setup(); place(p, 20, 1);
    run(world, state, pad(['left']), 30);
    expect(p.x).toBe(14);
  });
  it('jump returns to the same floor', () => {
    const { state, world, p } = setup(); place(p, 60, 1);
    run(world, state, pad([], ['b']), 1); expect(p.mode).toBe('air');
    run(world, state, NONE, 60);
    expect(p).toMatchObject({ mode: 'ground', floor: 1, y: feetY(1) });
  });
  it('walking into a pit with the car one floor below lands on the roof', () => {
    const { state, world, p } = setup();
    const carA = world.cars.find((c) => c.id === 'A'); carA.y = feetY(2); // A at 3F
    place(p, 100, 1);
    run(world, state, pad(['right']), 30); run(world, state, NONE, 30);
    expect(p.mode).toBe('ground'); expect(p.onRoof).toBe('A'); expect(p.y).toBe(feetY(2) - CAR_H);
  });
  it('walking into a pit with the car two floors below kills', () => {
    const { state, world, p } = setup();
    world.cars.find((c) => c.id === 'A').y = feetY(3);
    place(p, 100, 1);
    const ev = run(world, state, pad(['right']), 200);
    expect(ev.some((e) => e.type === 'playerDied' && e.cause === 'fall')).toBe(true);
  });
  it('enters a car with up, rides it, and exits at another floor', () => {
    const { state, world, p } = setup();
    const carB = world.cars.find((c) => c.id === 'B'); // at 4F
    place(p, 388, 1);
    run(world, state, pad([], ['up']), 1); expect(p.mode).toBe('car');
    run(world, state, pad(['down']), 48); run(world, state, NONE, 5);
    expect(carB.y).toBe(feetY(2)); expect(p.y).toBe(feetY(2));
    run(world, state, pad([], ['right']), 1);
    expect(p).toMatchObject({ mode: 'ground', floor: 2, riding: null });
  });
  it('rides an escalator up in 48 frames', () => {
    const { state, world, p } = setup(); const e = ESCALATORS[0];
    place(p, e.x, e.bottomFloor);
    run(world, state, pad([], ['up']), 1); run(world, state, NONE, 48);
    expect(p).toMatchObject({ mode: 'ground', floor: e.topFloor, x: e.x + ESC_RUN, y: feetY(e.topFloor) });
  });
  it('up at an open target door enters; closed or cleared stores stay shut', () => {
    const { state, world, p } = setup();
    const t = STORES.find((s) => s.id === 'radioshock'); place(p, doorX(t), t.floor);
    expect(run(world, state, pad([], ['up']), 1)).toContainEqual({ type: 'enterStore', storeId: 'radioshock' });
    state.cleared.add('radioshock');
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'enterStore')).toBe(false);
    const closed = STORES.find((s) => s.role === 'closed'); place(p, doorX(closed), closed.floor);
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'enterStore')).toBe(false);
  });
  it('a descending car crushes the player standing in the doorway below', () => {
    const { state, world, p } = setup();
    const carA = world.cars.find((c) => c.id === 'A'); carA.y = feetY(1) + 1; carA.dir = 1; // gliding down toward 3F
    place(p, 124, 2); // in A's doorway at 3F, car above → solid grate
    world.playerCarCmd = 0;
    const ev = run(world, state, NONE, 150);
    expect(ev.some((e) => e.type === 'playerDied' && e.cause === 'crush')).toBe(true);
  });
});
