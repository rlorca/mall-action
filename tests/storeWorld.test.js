import { describe, it, expect } from 'vitest';
import { createStoreWorld, stepStore, fixtureInFront } from '../src/game/storeWorld.js';
import { createGameState } from '../src/game/state.js';
import { searchFrames } from '../src/logic/powerups.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepStore(w, pd, s, s.rng)); return ev; };
function setup(id = 'radioshock') {
  const state = createGameState({ seed: 5 });
  const w = createStoreWorld(id, state, state.rng); w.guards = [];
  return { state, w };
}
// put the player just below fixture i, facing up
function faceFixture(w, i) {
  const f = w.room.fixtures[i];
  Object.assign(w.player, { x: f.col * 16 + 2, y: (f.row + 1) * 16 + 1, facing: 'up' });
}

describe('store world', () => {
  it('spawns above the door and walls block movement', () => {
    const { state, w } = setup();
    expect(w.player.y).toBe(146);
    run(w, state, pad(['left']), 200);
    expect(w.player.x).toBe(16);
  });
  it('walking down onto the door exits', () => {
    const { state, w } = setup();
    expect(run(w, state, pad(['down']), 40)).toContainEqual({ type: 'exitStore', storeId: 'radioshock' });
  });
  it('searching takes searchFrames and reveals once', () => {
    const { state, w } = setup(); faceFixture(w, 0);
    expect(fixtureInFront(w)).toBe(0);
    run(w, state, pad(['b']), searchFrames(state.power) - 1);
    expect(w.fixtures[0].searched).toBe(false);
    run(w, state, pad(['b']), 1);
    expect(w.fixtures[0].searched).toBe(true);
  });
  it('finding the package collects and clears the store', () => {
    const { state, w } = setup();
    const i = w.fixtures.findIndex((f) => f.type === 'package'); faceFixture(w, i);
    run(w, state, pad(['b']), 60);
    expect(state.packages.has('radioshock')).toBe(true); expect(state.cleared.has('radioshock')).toBe(true); expect(state.score).toBe(500);
  });
  it('a trap stuns the player', () => {
    const { state, w } = setup(); w.fixtures[0].type = 'trap'; faceFixture(w, 0);
    run(w, state, pad(['b']), 45);
    const x = w.player.x; run(w, state, pad(['left']), 10);
    expect(w.player.x).toBe(x);
  });
  it('re-entry respawns guards but keeps searched fixtures', () => {
    const { state, w } = setup(); faceFixture(w, 0); run(w, state, pad(['b']), 45);
    const again = createStoreWorld('radioshock', state, state.rng);
    expect(again.fixtures[0].searched).toBe(true); expect(again.guards.length).toBe(2);
  });
  it('touching a bot without armor kills', () => {
    const { state, w } = setup();
    w.guards = [{ type: 'bot', x: w.player.x, y: w.player.y, w: 12, h: 12, dir: 'down', t: 0, fireT: 999, stunT: 0, dead: false, hp: 3 }];
    const ev = run(w, state, NONE, 120);
    expect(ev.some((e) => e.type === 'playerDied')).toBe(true);
  });
});
