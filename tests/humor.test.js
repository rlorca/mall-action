import { describe, it, expect } from 'vitest';
import { createMallWorld, stepMall } from '../src/game/mallWorld.js';
import { createStoreWorld, stepStore } from '../src/game/storeWorld.js';
import { createGameState } from '../src/game/state.js';
import { INTRO_FRAMES, SELFIE_FRAMES } from '../src/game/mallPlayer.js';
import { QUIPS } from '../src/game/storeExtras.js';
import { feetY } from '../src/world/constants.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const runMall = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepMall(w, pd, s, s.rng)); return ev; };
const runStore = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepStore(w, pd, s, s.rng)); return ev; };
const landed = () => {
  const state = createGameState({ seed: 1 }); const world = createMallWorld(state);
  let ev = [];
  for (let i = 0; i < INTRO_FRAMES && world.player.mode === 'intro'; i++) ev = stepMall(world, NONE, state, state.rng);
  return { state, world, ev };
};

describe('selfie on arrival', () => {
  it('after landing the agent takes a SPYGRAM selfie, then gets control', () => {
    const { state, world, ev } = landed();
    expect(world.player.mode).toBe('selfie');
    expect(ev).toContainEqual({ type: 'selfie', caption: 'FEELING CUTE, MIGHT DELETE LATER' });
    runMall(world, state, NONE, SELFIE_FRAMES);
    expect(world.player).toMatchObject({ mode: 'ground', floor: 0, y: feetY(0) });
  });
  it('any button skips the selfie', () => {
    const { state, world } = landed();
    runMall(world, state, pad([], ['a']), 1);
    expect(world.player.mode).toBe('ground');
  });
});

describe('KGB Toys greeting', () => {
  it('first visit: the guards freeze and trade lines', () => {
    const state = createGameState({ seed: 1 });
    const w = createStoreWorld('kgbtoys', state, state.rng);
    expect(w.quips.map((q) => q.text)).toEqual(QUIPS.kgbtoys.map((q) => q.text));
    expect(QUIPS.kgbtoys[0].text).toBe("DIMITRI, HE'S HERE!");
    const g0 = { ...w.guards[0] };
    runStore(w, state, NONE, 30);
    expect([w.guards[0].x, w.guards[0].y]).toEqual([g0.x, g0.y]); // frozen while talking
    runStore(w, state, NONE, 200);
    expect(w.quips).toEqual([]);
  });
  it('only once per game', () => {
    const state = createGameState({ seed: 1 });
    createStoreWorld('kgbtoys', state, state.rng);
    expect(createStoreWorld('kgbtoys', state, state.rng).quips).toEqual([]);
  });
});
