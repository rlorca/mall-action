import { describe, it, expect } from 'vitest';
import { createStoreWorld, stepStore } from '../src/game/storeWorld.js';
import { EGG_TEXT, releaseToys } from '../src/game/storeExtras.js';
import { createGameState } from '../src/game/state.js';
import { JOKE_ITEMS } from '../src/logic/secrets.js';

const pad = (held = [], pressed = []) => ({ held: (b) => held.includes(b) || pressed.includes(b), pressed: (b) => pressed.includes(b) });
const NONE = pad();
const run = (w, s, pd, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepStore(w, pd, s, s.rng)); return ev; };

describe('GameStonk easter egg', () => {
  it('types the line, offers a joke item, awards it once', () => {
    const state = createGameState({ seed: 8 });
    const w = createStoreWorld('gamestonk', state, state.rng);
    expect(w.frozen).toBe(true);
    const ev = run(w, state, NONE, EGG_TEXT.length * 3 + 2);
    expect(ev.filter((e) => e.type === 'sfx' && e.name === 'blip').length).toBe(EGG_TEXT.length);
    expect(w.egg.phase).toBe('offer');
    const ped = w.room.pedestal; Object.assign(w.player, { x: ped.col * 16 + 2, y: ped.row * 16 + 2 });
    run(w, state, NONE, 100);
    expect(state.gameStonkDone).toBe(true); expect(JOKE_ITEMS).toContain(state.inventory[0]);
    expect(state.score).toBe(1); expect(w.frozen).toBe(false);
    const again = createStoreWorld('gamestonk', state, state.rng);
    expect(again.egg).toBeNull();
  });
});

describe('store extras', () => {
  it('toy shelves release three toys once', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('kgbtoys', state, state.rng);
    const idx = w.room.fixtures.findIndex((f) => f.kind === 'T');
    releaseToys(w, idx, state.rng); releaseToys(w, idx, state.rng);
    expect(w.toys).toHaveLength(3);
  });
  it('listening booth switches music once per visit', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('sambaddy', state, state.rng); w.guards = [];
    const b = w.room.booth; Object.assign(w.player, { x: b.col * 16 + 2, y: b.row * 16 + 2 });
    const ev = run(w, state, NONE, 10);
    expect(ev.filter((e) => e.type === 'music' && e.name === 'booth')).toHaveLength(1);
  });
  it('fitting room surprise keeps the contents unsearched', () => {
    const state = createGameState({ seed: 8 }); const w = createStoreWorld('forever12', state, state.rng); w.guards = [];
    const idx = w.room.fixtures.findIndex((f) => f.kind === 'R');
    const f = w.room.fixtures[idx]; Object.assign(w.player, { x: f.col * 16 + 2, y: (f.row + 1) * 16 + 1, facing: 'up' });
    let surprised = false;
    for (let tries = 0; tries < 40 && !surprised; tries++) {
      w.fixtures[idx].searched = false; w.fixtures[idx].surprised = false; w.guards = [];
      run(w, state, pad(['b']), 46);
      surprised = w.fixtures[idx].surprised === true;
    }
    expect(surprised).toBe(true); expect(w.fixtures[idx].searched).toBe(false); expect(w.guards.length).toBe(1);
  });
});
