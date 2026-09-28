import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createGameState } from '../src/game/state.js';
import { feetY } from '../src/world/constants.js';
import { KIOSKS, PHOTO_BOOTH, FOUNTAINS } from '../src/world/mallLevel.js';
import { createWetPatch } from '../src/logic/npcs.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
function setup(seed = 4) {
  const state = createGameState({ seed }); const world = createMallWorld(state);
  world.cars.forEach((c) => { c.ai = false; }); world.spawnT = 1e9;
  const p = world.player; Object.assign(p, { mode: 'ground', introT: 0 });
  return { state, world, p };
}
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };
const at = (p, x, floor) => Object.assign(p, { x, floor, y: feetY(floor) });

describe('mall NPCs', () => {
  it('player slides across a wet patch without stopping', () => {
    const { state, world, p } = setup(); world.janitor = null; world.cop = null;
    at(p, 60, 4); p.facing = 1; world.wet.push(createWetPatch(62, 4));
    run(world, state, pad(['right']), 3);           // 60→61→62, third frame enters the patch → 63
    run(world, state, pad(['left']), 20);           // input ignored, keeps sliding right
    expect(p.x).toBe(83);
  });
  it('shooting in front of the cop starts a chase; being caught freezes and costs 500', () => {
    const { state, world, p } = setup(); state.score = 1000;
    Object.assign(world.cop, { floor: 1, x: 300, y: feetY(1), facing: -1, state: 'patrol' });
    at(p, 250, 1); p.facing = -1;
    run(world, state, pad([], ['a']), 1);
    expect(world.cop.state).toBe('chase');
    run(world, state, NONE, 60);
    expect(p.frozenT).toBeGreaterThan(0); expect(state.score).toBe(500);
  });
  it('kiosk points to a target store and then cools down', () => {
    const { state, world, p } = setup(); world.cop = null;
    const k = KIOSKS[0]; at(p, k.x, k.floor);
    const ev = run(world, state, pad([], ['up']), 1);
    expect(ev.find((e) => e.type === 'kiosk').storeId).toBeTruthy();
    expect(run(world, state, pad([], ['up']), 1).some((e) => e.type === 'kiosk')).toBe(false);
  });
  it('photo booth hides the player and awards the strip once', () => {
    const { state, world, p } = setup(); world.cop = null;
    at(p, PHOTO_BOOTH.x + 12, PHOTO_BOOTH.floor);
    run(world, state, pad([], ['up']), 1); expect(p.mode).toBe('hidden');
    const ev = run(world, state, NONE, 301);
    expect(p.mode).toBe('ground'); expect(ev.some((e) => e.type === 'photo')).toBe(true);
    expect(state.inventory).toEqual(['PHOTO STRIP']);
  });
  it('shooting a fountain sprays 3–5 coins', () => {
    const { state, world, p } = setup(); world.cop = null; world.walkers = [];
    const f = FOUNTAINS[1]; at(p, f.x - 60, f.floor); p.facing = 1;
    run(world, state, pad([], ['a']), 1); run(world, state, NONE, 40);
    expect(world.coins.length).toBeGreaterThanOrEqual(3); expect(world.coins.length).toBeLessThanOrEqual(5);
  });
  it('alarm switches on at the loop-1 threshold', () => {
    const { state, world } = setup(); world.cop = null; state.levelFrames = 8998;
    const ev = run(world, state, NONE, 2);
    expect(world.alarm).toBe(true); expect(ev).toContainEqual({ type: 'music', name: 'mallAlarm' });
  });
});
