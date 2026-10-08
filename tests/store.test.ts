import { describe, expect, it } from 'vitest';
import { StoreRoom, type StoreRoomOptions } from '../src/store/room';
import { TEMPLATES, TILE } from '../src/store/templates';
import { STORES, storeById } from '../src/mall/layout';
import { PowerUps } from '../src/core/powerups';
import { input } from './helpers';
import type { Pad } from '../src/core/input';

function room(id: string, over: Partial<StoreRoomOptions> = {}): StoreRoom {
  const store = storeById(id);
  return new StoreRoom({
    store,
    template: TEMPLATES[store.template!],
    seed: 42,
    blackFriday: false,
    powerUps: new PowerUps(),
    firstVisit: false,
    egg: false,
    opened: new Set(),
    packagesFound: 0,
    ...over,
  });
}

/** Moves the agent so it touches the given fixture from the left side. */
function standBesideFixture(r: StoreRoom, index: number): void {
  const f = r.fixtures[index];
  r.x = f.col * TILE - 14;
  r.y = f.row * TILE;
  r.guards.length = 0;
}

function step(r: StoreRoom, held: Pad[] = [], pressed: Pad[] = []) {
  return r.step(input(held, pressed));
}

describe('searching in a store', () => {
  it('a single tap of B starts a search that completes on its own', () => {
    const r = room('RADIOSHOCK');
    standBesideFixture(r, 0);
    step(r, [], ['b']);
    expect(r.mode).toBe('search');
    for (let i = 0; i < 60; i++) step(r);
    expect(r.fixtures[0].opened).toBe(true);
    expect(r.mode === 'walk' || r.mode === 'hold' || r.mode === 'stun').toBe(true);
  });

  it('turns the agent to face the fixture it is searching', () => {
    const r = room('RADIOSHOCK');
    standBesideFixture(r, 0); // fixture is to the right
    step(r, [], ['b']);
    expect(r.facing).toBe('r');
  });

  it('a fixture touched at a gap still counts (corner assist and margin)', () => {
    const r = room('KGB_TOYS');
    const f = r.fixtures.find((x) => x.kind === 'F')!;
    r.x = f.col * TILE - 14 + 2; // 2 px inside the margin
    r.y = f.row * TILE - 4;
    r.guards.length = 0;
    expect(r.canSearch).toBe(true);
  });

  it('a new direction cancels the search without opening the fixture', () => {
    const r = room('RADIOSHOCK');
    standBesideFixture(r, 0);
    step(r, [], ['b']);
    step(r, ['up'], ['up']);
    expect(r.mode).toBe('walk');
    expect(r.fixtures[0].opened).toBe(false);
  });

  it('holding B after a search does not immediately search the next fixture', () => {
    const r = room('RADIOSHOCK');
    standBesideFixture(r, 0);
    step(r, [], ['b']);
    for (let i = 0; i < 150; i++) step(r, ['b']); // long enough for any hold animation to finish
    expect(r.mode).toBe('walk');
    expect(r.fixtures.filter((f) => f.opened)).toHaveLength(1);
  });

  it('searched fixtures stay open when the agent returns on re-entry', () => {
    const opened = new Set<number>();
    const first = room('RADIOSHOCK', { opened });
    standBesideFixture(first, 0);
    step(first, [], ['b']);
    for (let i = 0; i < 60; i++) step(first);
    const again = room('RADIOSHOCK', { opened });
    expect(again.fixtures[0].opened).toBe(true);
  });

  it('a package is announced with its number', () => {
    const r = room('FOREVER12', { packagesFound: 2 });
    const pkg = r.fixtures.find((f) => f.contents === 'package')!;
    standBesideFixture(r, r.fixtures.indexOf(pkg));
    step(r, [], ['b']);
    const events: { type: string; lines?: readonly string[] }[] = [];
    for (let i = 0; i < 60; i++) events.push(...step(r));
    const banner = events.find((e) => e.type === 'banner');
    expect(banner?.lines).toEqual(['PACKAGE 3/6']);
  });
});

describe('store rules', () => {
  it('the door leads out: walking into it exits the store', () => {
    const r = room('RADIOSHOCK');
    r.x = 7 * TILE;
    r.y = 9 * TILE;
    r.guards.length = 0;
    let exited = false;
    for (let i = 0; i < 40 && !exited; i++) {
      const ev = step(r, ['down']);
      exited = ev.some((e) => e.type === 'exit') || r.exited;
    }
    expect(exited).toBe(true);
  });

  it('shooting a toy shelf releases three wind-up toys (KGB Toys)', () => {
    const r = room('KGB_TOYS');
    const shelf = r.rows.flatMap((row, rr) => [...row].map((ch, cc) => (ch === 'S' ? { rr, cc } : null))).find(Boolean)!;
    r.x = shelf.cc * TILE;
    r.y = (shelf.rr + 1) * TILE;
    r.facing = 'u';
    r.guards.length = 0;
    step(r, [], ['a']);
    for (let i = 0; i < 20; i++) step(r);
    expect(r.toys.length).toBe(3);
  });

  it('walking onto the listening booth (Sam Baddy) switches to side B once', () => {
    const r = room('SAM_BADDY');
    const b = r.rows.flatMap((row, rr) => [...row].map((ch, cc) => (ch === 'B' ? { rr, cc } : null))).find(Boolean)!;
    r.x = b.cc * TILE;
    r.y = b.rr * TILE;
    r.guards.length = 0;
    const first = step(r);
    expect(first.some((e) => e.type === 'sideB')).toBe(true);
    expect(step(r).some((e) => e.type === 'sideB')).toBe(false);
  });

  it('the GameStonk easter egg: a cave scene, then a pedestal item worth one point', () => {
    const r = room('GAMESTONK', { egg: true });
    expect(r.mode).toBe('egg');
    for (let i = 0; i < 160; i++) step(r);
    expect(r.eggPedestal).toBe(true);
    const pedestal = r.rows.flatMap((row, rr) => [...row].map((ch, cc) => (ch === 'P' ? { rr, cc } : null))).find(Boolean)!;
    r.x = pedestal.cc * TILE;
    r.y = pedestal.rr * TILE;
    const events = step(r);
    expect(events.some((e) => e.type === 'easterEgg')).toBe(true);
    expect(events.some((e) => e.type === 'score')).toBe(true);
  });

  it('Forever 12 fitting rooms wake a spy about a quarter of the time', () => {
    let ambushes = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) {
      const r = room('FOREVER12', { seed });
      const idx = r.fixtures.findIndex((f) => f.kind === 'L');
      standBesideFixture(r, idx);
      r.guards.length = 0;
      step(r, [], ['b']);
      for (let i = 0; i < 60; i++) step(r);
      if (r.fixtures[idx].ambushed) ambushes++;
    }
    expect(ambushes / N).toBeGreaterThan(0.12);
    expect(ambushes / N).toBeLessThan(0.4);
  });

  it('a power-up shop never holds a package or a trap', () => {
    for (const s of STORES.filter((st) => st.role === 'power')) {
      const r = room(s.id);
      expect(r.fixtures.every((f) => f.contents !== 'package' && f.contents !== 'trap')).toBe(true);
    }
  });

  it('Black Friday: every non-package fixture holds a power-up', () => {
    const r = room('HOT_SPY', { blackFriday: true });
    const nonPkg = r.fixtures.filter((f) => f.contents !== 'package');
    expect(nonPkg.length).toBeGreaterThan(0);
    expect(nonPkg.every((f) => f.contents === 'power' && f.power !== null)).toBe(true);
  });

  it('a guard touching the agent hurts him (the agent dies without armour)', () => {
    const r = room('KGB_TOYS');
    r.graceT = 0;
    const g = r.guards[0];
    r.x = g.x;
    r.y = g.y;
    const events = step(r);
    expect(events.some((e) => e.type === 'death')).toBe(true);
  });
});
