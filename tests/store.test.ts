import { describe, expect, it } from 'vitest';
import { step, musicFor } from '../src/game/game';
import { frameOf } from '../src/core/input';
import { roomFor, TILE } from '../src/game/rooms';
import { EASTER_EGG_TEXT, JOKE_ITEMS } from '../src/game/copy';
import { findSearchTarget, enterStore } from '../src/game/store';
import { inStore, lvl, playing, press, run } from './helpers';

/** Stand on the floor tile below fixture i (or beside it), facing it. */
function standBy(g: ReturnType<typeof playing>, i: number) {
  const s = lvl(g).store!;
  const room = roomFor(s.id);
  const f = room.fixtures[i];
  const free = (tx: number, ty: number) => '.DLP'.includes(room.tiles[ty]?.[tx] ?? '#');
  if (free(f.tx, f.ty + 1)) Object.assign(s, { x: f.tx * TILE + 8, y: (f.ty + 1) * TILE + 8, facing: 'up' });
  else if (free(f.tx - 1, f.ty)) Object.assign(s, { x: (f.tx - 1) * TILE + 8, y: f.ty * TILE + 8, facing: 'right' });
  else Object.assign(s, { x: (f.tx + 1) * TILE + 8, y: f.ty * TILE + 8, facing: 'left' });
}

describe('searching', () => {
  it('a single tap of B searches on its own (~0.75 s) and the result is announced', () => {
    const g = playing();
    inStore(g, 'radioshock');
    standBy(g, 0);
    press(g, 'b');
    const s = lvl(g).store!;
    expect(s.search).not.toBeNull();
    run(g, 44);
    expect(lvl(g).stores.radioshock.opened[0]).toBe(false);
    run(g, 2);
    expect(lvl(g).stores.radioshock.opened[0]).toBe(true);
    expect(g.banner).not.toBeNull();
  });
  it('a fixture touched at the side (at a gap) counts, and the agent turns to face it', () => {
    const g = playing();
    inStore(g, 'radioshock');
    const s = lvl(g).store!;
    const room = roomFor('radioshock');
    // Row 3: '#.F..F....F..F.#' — the gap tile (3,3) has a fixture at (2,3) to its left.
    s.x = 3 * TILE + 8;
    s.y = 3 * TILE + 8;
    s.facing = 'up';
    const t = findSearchTarget(room, lvl(g).stores.radioshock, s.x, s.y, s.facing);
    expect(t).not.toBeNull();
    press(g, 'b');
    expect(String(s.facing) === 'left' || String(s.facing) === 'right').toBe(true);
    expect(s.search).not.toBeNull();
  });
  it('touching a fixture when half-aligned with a gap still counts', () => {
    const g = playing();
    inStore(g, 'radioshock');
    const s = lvl(g).store!;
    s.x = 3 * TILE + 3; // straddling tiles 2 and 3 below row 3
    s.y = 4 * TILE + 8 + 6;
    s.facing = 'up';
    press(g, 'b');
    expect(s.search).not.toBeNull();
  });
  it('only a fresh press of a different direction, or shooting, cancels', () => {
    const g = playing();
    inStore(g, 'radioshock');
    standBy(g, 0);
    const s = lvl(g).store!;
    press(g, 'b');
    run(g, 5, [s.facing]); // holding the facing direction does not cancel
    expect(s.search).not.toBeNull();
    press(g, s.facing === 'up' ? 'left' : 'up');
    expect(s.search).toBeNull();
    press(g, 'b');
    press(g, 'a');
    expect(s.search).toBeNull();
  });
  it('holding B after a search does not immediately search the next fixture', () => {
    const g = playing();
    inStore(g, 'footlock');
    standBy(g, 0);
    press(g, 'b');
    run(g, 150, ['b']);
    expect(lvl(g).stores.footlock.opened.filter(Boolean).length).toBe(1);
  });
  it('searched fixtures stay open after leaving and coming back', () => {
    const g = playing();
    inStore(g, 'crookstone');
    standBy(g, 2);
    press(g, 'b');
    run(g, 120);
    expect(lvl(g).stores.crookstone.opened[2]).toBe(true);
    lvl(g).store = null;
    g.scene = 'mall';
    inStore(g, 'crookstone');
    expect(lvl(g).stores.crookstone.opened[2]).toBe(true);
  });
  it('finding the package clears the store and counts toward 6', () => {
    const g = playing();
    inStore(g, 'hotspy');
    const i = lvl(g).stores.hotspy.contents.findIndex((c) => c.t === 'package');
    standBy(g, i);
    press(g, 'b');
    run(g, 60);
    expect(lvl(g).packages).toBe(1);
    expect(lvl(g).stores.hotspy.cleared).toBe(true);
    expect(g.events.some((e) => e.t === 'jingle' && e.id === 'jingle_fanfare')).toBe(true);
  });
  it('a trap stuns the agent for 1 s', () => {
    const g = playing();
    inStore(g, 'kgbtoys');
    const rt = lvl(g).stores.kgbtoys;
    const i = rt.contents.findIndex((c, k) => c.t === 'trap' && roomFor('kgbtoys').fixtures[k].kind === 'fixture');
    if (i < 0) return;
    standBy(g, i);
    press(g, 'b');
    run(g, 46);
    expect(lvl(g).store!.stun).toBeGreaterThan(50);
  });
  it('walks 4 ways with vertical priority, and the corner assist slips into gaps', () => {
    const g = playing();
    inStore(g, 'radioshock');
    const s = lvl(g).store!;
    const x0 = s.x;
    run(g, 10, ['up', 'right']);
    expect(s.x).toBe(x0);
    expect(s.facing).toBe('up');
    // Slightly misaligned below the 1-tile gap at (4,4) between fixtures (2..) — corner assist nudges in.
    s.x = 4 * TILE + 8 + 4;
    s.y = 5 * TILE + 8;
    run(g, 20, ['up']);
    expect(s.y).toBeLessThan(5 * TILE + 8);
  });
});

describe('store extras', () => {
  it('GameStonk easter egg: frozen typewriter text, item on the pedestal, useless item +1, once per game', () => {
    const g = playing();
    inStore(g, 'gamestonk');
    const s = lvl(g).store!;
    expect(s.easter?.phase).toBe('text');
    const x = s.x;
    run(g, 30, ['up']);
    expect(s.x === x && s.y === roomFor('gamestonk').entry.y).toBe(true); // input frozen
    run(g, EASTER_EGG_TEXT.length * 3 + 60);
    expect(s.easter?.phase).toBe('item');
    const ped = roomFor('gamestonk').pedestal!;
    const before = g.score;
    s.x = ped.tx * TILE + 8;
    s.y = (ped.ty + 1) * TILE + 8;
    run(g, 20, ['up']);
    expect(s.easter?.phase).toBe('got');
    expect(g.score - before).toBe(1);
    expect(JOKE_ITEMS).toContain(g.inventory[g.inventory.length - 1]);
    expect(g.easterDone).toBe(true);
    expect(s.clerkPresent).toBe(false);
    lvl(g).store = enterStore(g, lvl(g), 'gamestonk');
    expect(lvl(g).store!.easter).toBeNull();
  });
  it('Forever 12 fitting rooms: ~25% hold a spy mid-change; the real contents stay unsearched', () => {
    let popped = 0;
    let tries = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = playing(seed);
      inStore(g, 'forever12');
      const room = roomFor('forever12');
      const i = room.fixtures.findIndex((f) => f.kind === 'fitting');
      standBy(g, i);
      press(g, 'b');
      run(g, 46);
      tries++;
      const s = lvl(g).store!;
      if (s.guards.some((gd) => gd.changing > 0 || gd.kind === 'spy')) {
        popped++;
        expect(lvl(g).stores.forever12.opened[i]).toBe(false);
        expect(s.bubbles.some((b) => b.text === 'OCCUPIED!!')).toBe(true);
      }
    }
    expect(popped / tries).toBeGreaterThan(0.1);
    expect(popped / tries).toBeLessThan(0.45);
  });
  it('KGB Toys: shooting a toy shelf releases 3 wind-up toys that stun guards', () => {
    const g = playing();
    inStore(g, 'kgbtoys', true);
    const s = lvl(g).store!;
    const room = roomFor('kgbtoys');
    const i = room.fixtures.findIndex((f) => f.kind === 'toyshelf' && f.ty > 1);
    standBy(g, i);
    s.guards.forEach((gd) => (gd.stun = 9999));
    press(g, 'a');
    run(g, 10);
    expect(s.toys.length).toBe(3);
    const gd = s.guards[0];
    gd.stun = 0;
    gd.x = s.toys[0].x;
    gd.y = s.toys[0].y;
    gd.tx = Math.floor(gd.x / TILE);
    gd.ty = Math.floor(gd.y / TILE);
    run(g, 1);
    expect(gd.stun).toBeGreaterThan(0);
  });
  it('KGB Toys: toys set off traps (smoke stuns nearby guards)', () => {
    const g = playing();
    inStore(g, 'kgbtoys', true);
    const s = lvl(g).store!;
    const rt = lvl(g).stores.kgbtoys;
    const room = roomFor('kgbtoys');
    rt.contents = rt.contents.map((c) => (c.t === 'package' ? c : { t: 'trap' }));
    const f = room.fixtures.find((x) => x.kind === 'fixture')!;
    s.toys.push({ x: f.tx * TILE + 8, y: (f.ty + 1) * TILE + 8, dir: 'up', t: 900, anim: 0 });
    run(g, 20);
    expect(rt.opened.some(Boolean)).toBe(true);
  });
  it('Sam Baddy listening booth switches to the bonus track until you leave', () => {
    const g = playing();
    inStore(g, 'sambaddy');
    expect(musicFor(g)).toBe('store_sambaddy');
    const b = roomFor('sambaddy').booth[0];
    const s = lvl(g).store!;
    s.x = b.tx * TILE + 8;
    s.y = b.ty * TILE + 8;
    step(g, frameOf());
    expect(musicFor(g)).toBe('bonus');
    expect(g.banner?.lines[0]).toBe('NOW PLAYING: SIDE B');
  });
  it('first visit: guards hold still and say their lines, second line ~1 s later', () => {
    const g = playing();
    const L = lvl(g);
    L.store = enterStore(g, L, 'kgbtoys');
    g.scene = 'store';
    const s = L.store;
    const pos = s.guards.map((gd) => [gd.x, gd.y]);
    run(g, 2);
    expect(s.bubbles.length).toBe(1);
    run(g, 60);
    expect(s.bubbles.length).toBe(2);
    expect(s.guards.map((gd) => [gd.x, gd.y])).toEqual(pos);
    L.store = enterStore(g, L, 'kgbtoys');
    expect(L.store.lines).toBeNull(); // only the first time per game
  });
  it('a cleared target store cannot be entered again', () => {
    const g = playing();
    const L = lvl(g);
    L.stores.footlock.cleared = true;
    const p = L.mall.player;
    p.mode = 'ground';
    p.x = 184;
    p.y = 336;
    press(g, 'up');
    expect(g.fade).toBeNull();
  });
});
