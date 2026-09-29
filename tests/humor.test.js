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
    const selfie = ev.find((e) => e.type === 'selfie');
    expect(ARRIVAL_POSTS).toContainEqual(selfie.post);
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

import { LAST_WORDS, PA_LINES, PA_FRAMES, LIFT_LINES, HEADLINES, pickHeadline, ARRIVAL_POSTS, MISSION_POSTS } from '../src/game/humor.js';
import { createSpy, killSpy, spyFromCar } from '../src/game/spies.js';
import { STORES } from '../src/world/mallLevel.js';
import { roomFor } from '../src/world/storeRooms.js';
import { difficulty } from '../src/logic/rules.js';

describe('more funnies', () => {
  it('spies sometimes blurt last words when they go down', () => {
    const state = createGameState({ seed: 4 }); const world = createMallWorld(state);
    for (let i = 0; i < 200; i++) killSpy(world, createSpy(300, 1, 'door'), 'spyShot', state, []);
    const said = world.bubbles.map((b) => b.text);
    expect(said.length).toBeGreaterThan(40); expect(said.length).toBeLessThan(120);
    for (const t of said) expect(LAST_WORDS).toContain(t);
  });
  it('every store with guards has first-visit one-liners that fit in a bubble', () => {
    for (const s of STORES.filter((x) => x.role !== 'closed' && x.id !== 'gamestonk')) {
      const lines = QUIPS[s.id]; expect(lines, s.id).toBeDefined();
      for (const q of lines) {
        expect(q.text.length, q.text).toBeLessThanOrEqual(28);
        expect(q.guard).toBeLessThan(roomFor(s).guards.length);
      }
    }
  });
  it('the mall PA makes an announcement every PA_FRAMES', () => {
    const state = createGameState({ seed: 4 }); const world = createMallWorld(state);
    Object.assign(world.player, { mode: 'ground', floor: 1, y: feetY(1), x: 300 }); world.spawnT = 1e9;
    const ev = runMall(world, state, NONE, PA_FRAMES);
    const pa = ev.filter((e) => e.type === 'pa');
    expect(pa).toHaveLength(1); expect(PA_LINES).toContain(pa[0].text);
  });
  it('a spy stepping out of an elevator makes awkward small talk', () => {
    const state = createGameState({ seed: 4 }); const world = createMallWorld(state);
    Object.assign(world.player, { mode: 'ground', floor: 2, y: feetY(2), x: 600 });
    const c = world.cars.find((k) => k.id === 'C');
    let tries = 0;
    while (!world.spies.length && tries++ < 50) spyFromCar(world, c, 2, state.rng, difficulty(1));
    expect(world.bubbles.some((b) => LIFT_LINES.includes(b.text))).toBe(true);
  });
  it('headlines fit the newspaper (≤ 26 chars a line, ≤ 3 lines)', () => {
    for (const h of HEADLINES) {
      expect(h.split('\n').length).toBeLessThanOrEqual(3);
      for (const line of h.split('\n')) expect(line.length, line).toBeLessThanOrEqual(26);
    }
  });
  it('level clear headlines come from the list', () => {
    const state = createGameState({ seed: 4 });
    expect(HEADLINES).toContain(pickHeadline(state.rng));
  });
});

describe('SPYGRAM posts', () => {
  for (const [name, posts] of [['arrival', () => ARRIVAL_POSTS], ['mission', () => MISSION_POSTS]]) {
    it(`${name}: 10 different posts that fit the card`, () => {
      const list = posts();
      expect(list).toHaveLength(10);
      expect(new Set(list.map((p) => p.caption)).size).toBe(10);
      for (const p of list) {
        for (const line of p.caption.split('\n')) expect(line.length, line).toBeLessThanOrEqual(21);
        expect(p.caption.split('\n').length).toBeLessThanOrEqual(2);
        expect(p.comment.length, p.comment).toBeLessThanOrEqual(21);
      }
    });
  }
  it('arrival posts vary between games', () => {
    const captions = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const state = createGameState({ seed }); const world = createMallWorld(state);
      for (let i = 0; i < INTRO_FRAMES; i++) for (const e of stepMall(world, NONE, state, state.rng)) if (e.type === 'selfie') captions.add(e.post.caption);
    }
    expect(captions.size).toBeGreaterThanOrEqual(5);
  });
});
