import { describe, expect, it } from 'vitest';
import { POWER_IDS, POWERUPS } from '../../content/powerups';
import { storeDef } from '../../content/stores';
import { UI, packageBanner } from '../../content/copy';
import { Rng } from '../../engine/rng';
import { POINTS } from '../run';
import { HALF } from './collision';
import { getRoom, TILE } from './room';
import { DEATH_FRAMES, HOLD_PACKAGE, STUN_FRAMES, StoreWorld, VIEW_H, VIEW_W } from './world';
import { emptyRoom, makeWorld, setContent } from './testutil';

/** Step until `pred` holds (max n frames); returns the frames it took. */
function until(pilot: { step: () => void }, pred: () => boolean, max = 600): number {
  for (let i = 0; i < max; i++) {
    if (pred()) return i;
    pilot.step();
  }
  throw new Error('condition never met');
}

describe('agent movement', () => {
  it('walks about 1.25 px per frame, facing where he walks', () => {
    const { world, pilot } = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    const x0 = world.agent.x;
    pilot.hold(10, 'RIGHT');
    expect(world.agent.x - x0).toBeCloseTo(12.5, 5);
    expect(world.agent.facing).toBe('right');
    pilot.hold(4, 'UP');
    expect(world.agent.facing).toBe('up');
    pilot.hold(2, 'LEFT');
    expect(world.agent.facing).toBe('left');
    pilot.hold(2, 'DOWN');
    expect(world.agent.facing).toBe('down');
  });

  it('moves with sub-pixel precision', () => {
    const { world, pilot } = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    pilot.step('RIGHT');
    expect(world.agent.x % 1).not.toBe(0);
  });

  it('walks faster with Sneakers (1.25x) and Orange Juli-Ooze (1.5x)', () => {
    const base = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    const x0 = base.world.agent.x;
    base.pilot.hold(8, 'RIGHT');
    const slow = base.world.agent.x - x0;
    const sn = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    sn.run.givePower('sneakers');
    sn.pilot.hold(8, 'RIGHT');
    const fast = sn.world.agent.x - x0;
    expect(fast / slow).toBeCloseTo(1.25, 5);
    const oz = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    oz.run.givePower('ooze');
    oz.pilot.hold(8, 'RIGHT');
    expect((oz.world.agent.x - x0) / slow).toBeCloseTo(1.5, 5);
  });

  it('gives vertical input priority over horizontal input', () => {
    const { world, pilot } = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    const x0 = world.agent.x;
    const y0 = world.agent.y;
    pilot.hold(10, 'UP', 'RIGHT');
    expect(world.agent.x).toBe(x0);
    expect(world.agent.y).toBeLessThan(y0);
    expect(world.agent.facing).toBe('up');
  });

  it('walls are solid: he stops flush against them', () => {
    const { world, pilot } = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    pilot.hold(200, 'LEFT');
    expect(world.agent.x).toBe(TILE + HALF);
    pilot.hold(200, 'UP');
    expect(world.agent.y).toBe(TILE + HALF);
  });

  it('fixtures, counters and decor are solid', () => {
    const { world, pilot } = makeWorld('crookstone');
    world.teleportAgent(3, 2); // below the shelf at (3,1)
    const x0 = world.agent.x;
    pilot.hold(30, 'UP');
    expect(world.agent.y).toBe(2 * TILE + HALF);
    expect(world.agent.x).toBe(x0);
    // decor block at (3,3): walk into it from above
    world.teleportAgent(3, 2);
    pilot.hold(30, 'DOWN');
    expect(world.agent.y).toBe(3 * TILE - HALF);
  });

  it('slips through a 1-tile gap with Zelda-style corner assist', () => {
    const gapRoom = emptyRoom(16, 11, { 5: '######.#######' });
    for (const dx of [-5, -3, 0, 3, 5]) {
      const { world, pilot } = makeWorld('crookstone', { room: gapRoom });
      world.teleportAgent(7, 7, dx);
      pilot.hold(80, 'UP');
      expect(world.agent.y, `offset ${dx}`).toBeLessThan(5 * TILE);
    }
  });

  it('corner assist does not push through a gap that is too far away', () => {
    const gapRoom = emptyRoom(16, 11, { 5: '######.#######' });
    const { world, pilot } = makeWorld('crookstone', { room: gapRoom });
    world.teleportAgent(7, 7, 12);
    pilot.hold(80, 'UP');
    expect(world.agent.y).toBeGreaterThan(6 * TILE);
  });

  it('walking onto the door sets `exited` exactly once (and plays the door sound once)', () => {
    const { run, world, pilot } = makeWorld('crookstone');
    expect(world.exited).toBe(false);
    pilot.hold(30, 'DOWN');
    expect(world.exited).toBe(true);
    pilot.hold(30, 'DOWN');
    expect(run.drainSfx().filter((s) => s === 'door')).toHaveLength(1);
  });

  it('does not exit while standing inside the room', () => {
    const { world, pilot } = makeWorld('crookstone');
    pilot.hold(120, 'LEFT');
    pilot.hold(120, 'UP');
    expect(world.exited).toBe(false);
    expect(world.died).toBe(false);
  });
});

describe('rooms of any size and the camera', () => {
  it('a 16 x 11 room fits the 256 x 176 view exactly', () => {
    const { world } = makeWorld('crookstone');
    expect(VIEW_W).toBe(256);
    expect(VIEW_H).toBe(176);
    expect(world.camX).toBe(0);
    expect(world.camY).toBe(0);
  });

  it('a room smaller than the view is centred', () => {
    const { world } = makeWorld('crookstone', { room: emptyRoom(10, 7) });
    expect(world.camX).toBe(-Math.floor((256 - 160) / 2));
    expect(world.camY).toBe(-Math.floor((176 - 112) / 2));
  });

  it('a big room scrolls: the camera follows the agent and stays inside the room', () => {
    const room = emptyRoom(40, 24);
    const { world, pilot } = makeWorld('crookstone', { room });
    const maxX = 40 * TILE - VIEW_W;
    const maxY = 24 * TILE - VIEW_H;
    expect(world.camY).toBe(maxY);
    expect(world.camX).toBeGreaterThan(0);
    const startCamX = world.camX;
    for (let i = 0; i < 400; i++) {
      pilot.step('LEFT');
      expect(world.camX).toBeGreaterThanOrEqual(0);
      expect(world.camX).toBeLessThanOrEqual(maxX);
      const sx = world.agent.x - world.camX;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThan(VIEW_W);
    }
    expect(world.camX).toBeLessThan(startCamX);
    expect(world.camX).toBe(0);
    for (let i = 0; i < 400; i++) pilot.step('UP');
    expect(world.camY).toBe(0);
    const sy = world.agent.y - world.camY;
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(sy).toBeLessThan(VIEW_H);
  });
});

describe('searching', () => {
  /** crookstone: shelves at (3,1) idx 0, (4,1) idx 1, ... */
  const nearShelf = (opts = {}) => {
    const m = makeWorld('crookstone', opts);
    m.world.teleportAgent(3, 2);
    return m;
  };

  it('a SINGLE TAP of B starts a search that runs on its own for searchFrames() frames', () => {
    const m = nearShelf();
    expect(m.world.canSearch).toBe(true);
    m.pilot.step('B'); // the tap: pressed this frame...
    expect(m.world.search).not.toBeNull();
    expect(m.world.searchProgress).toBe(0);
    const startFrame = m.world.frame;
    let opened = -1;
    for (let i = 1; i <= 200 && opened < 0; i++) {
      m.pilot.step(); // ...and released: the search keeps going
      if (m.world.fixtureOpened(0)) opened = m.world.frame - startFrame;
      else expect(m.world.search).not.toBeNull();
    }
    expect(opened).toBe(m.run.searchFrames());
    expect(opened).toBe(45);
    expect(m.world.search).toBeNull();
  });

  it('shows a progress fraction that climbs from 0 to 1', () => {
    const m = nearShelf();
    m.pilot.step('B');
    const fracs: number[] = [];
    for (let i = 0; i < 44; i++) {
      m.pilot.step();
      fracs.push(m.world.searchProgress);
    }
    expect(fracs[0]).toBeGreaterThan(0);
    expect(fracs[fracs.length - 1]).toBeGreaterThan(0.9);
    for (let i = 1; i < fracs.length; i++) expect(fracs[i]!).toBeGreaterThan(fracs[i - 1]!);
  });

  it('is faster with Sneakers (30 frames)', () => {
    const m = nearShelf();
    m.run.givePower('sneakers');
    m.pilot.step('B');
    const start = m.world.frame;
    until(m.pilot, () => m.world.fixtureOpened(0));
    expect(m.world.frame - start).toBe(30);
  });

  it('does nothing when no fixture is touched', () => {
    const m = makeWorld('crookstone');
    m.world.teleportAgent(7, 8);
    expect(m.world.canSearch).toBe(false);
    m.pilot.tap('B');
    expect(m.world.search).toBeNull();
  });

  it('a fixture touched from the SIDE counts, and the agent turns to face it', () => {
    const m = makeWorld('crookstone');
    m.world.teleportAgent(5, 1); // right of the shelf at (4,1)
    m.world.agent.facing = 'up';
    expect(m.world.searchTarget).toBe(1);
    m.pilot.tap('B');
    expect(m.world.search?.fixture).toBe(1);
    expect(m.world.agent.facing).toBe('left');
  });

  it('a fixture touched from behind-the-corner / below counts too (auto-facing up)', () => {
    const m = nearShelf();
    m.world.agent.facing = 'down';
    m.pilot.tap('B');
    expect(m.world.search?.fixture).toBe(0);
    expect(m.world.agent.facing).toBe('up');
  });

  it('a fixture touched at a gap between two fixtures works', () => {
    const room = emptyRoom(16, 11, { 3: '.....s.s......' });
    const m = makeWorld('crookstone', { room });
    expect(room.fixtures.map((f) => f.col)).toEqual([6, 8]);
    m.world.teleportAgent(7, 3); // standing in the 1-tile gap
    m.world.agent.facing = 'up';
    expect(m.world.canSearch).toBe(true);
    m.pilot.tap('B');
    expect(m.world.search).not.toBeNull();
    expect(['left', 'right']).toContain(m.world.agent.facing);
  });

  it('prefers the fixture the agent is facing when he touches several', () => {
    const room = emptyRoom(16, 11, { 3: '.....s.s......' });
    const m = makeWorld('crookstone', { room });
    m.world.teleportAgent(7, 3);
    m.world.agent.facing = 'right';
    m.pilot.tap('B');
    expect(m.world.search?.fixture).toBe(1);
    const n = makeWorld('crookstone', { room });
    n.world.teleportAgent(7, 3);
    n.world.agent.facing = 'left';
    n.pilot.tap('B');
    expect(n.world.search?.fixture).toBe(0);
  });

  it('works while pressing into the fixture too (touching is enough, no exact alignment needed)', () => {
    const m = makeWorld('crookstone');
    m.world.teleportAgent(3, 2, 7); // 7 px right of centre: still under the shelf pair
    m.pilot.hold(20, 'UP');
    expect(m.world.canSearch).toBe(true);
    m.pilot.tap('B');
    expect(m.world.search).not.toBeNull();
  });

  it('a fresh press of a DIFFERENT direction cancels the search', () => {
    const m = nearShelf();
    m.pilot.tap('B'); // faces up
    m.pilot.idle(10);
    expect(m.world.search).not.toBeNull();
    m.pilot.step('LEFT');
    expect(m.world.search).toBeNull();
    m.pilot.idle(80);
    expect(m.world.fixtureOpened(0)).toBe(false);
  });

  it('pressing the direction he is already facing (into the fixture) does NOT cancel', () => {
    const m = nearShelf();
    m.pilot.tap('B');
    m.pilot.idle(5);
    m.pilot.step('UP');
    expect(m.world.search).not.toBeNull();
    m.pilot.hold(60, 'UP');
    expect(m.world.fixtureOpened(0)).toBe(true);
  });

  it('shooting cancels the search', () => {
    const m = nearShelf();
    m.pilot.tap('B');
    m.pilot.idle(10);
    expect(m.world.search).not.toBeNull();
    m.pilot.step('A');
    expect(m.world.search).toBeNull();
    expect(m.run.drainSfx()).toContain('shot');
    expect(m.world.agent.shootCd).toBeGreaterThan(0);
    m.pilot.idle(80);
    expect(m.world.fixtureOpened(0)).toBe(false);
  });

  it('holding a direction that was already down does not cancel', () => {
    const m = nearShelf();
    m.pilot.step('LEFT'); // already walking...
    m.world.teleportAgent(3, 2);
    m.pilot.step('LEFT', 'B'); // ...then B pressed while LEFT is merely held
    expect(m.world.search).not.toBeNull();
    m.pilot.hold(10, 'LEFT');
    expect(m.world.search).not.toBeNull();
  });

  it('after a cancel, a new tap searches again from zero', () => {
    const m = nearShelf();
    m.pilot.tap('B');
    m.pilot.idle(20);
    m.pilot.step('RIGHT'); // cancel (moves a little)
    m.world.teleportAgent(3, 2);
    m.pilot.idle(2);
    m.pilot.tap('B');
    expect(m.world.search?.t).toBeLessThan(5);
    until(m.pilot, () => m.world.fixtureOpened(0));
  });

  it('HOLDING B after a search does NOT immediately search the next fixture', () => {
    const room = emptyRoom(16, 11, { 3: '.....s.s......' });
    const m = makeWorld('crookstone', { room });
    m.world.teleportAgent(7, 3);
    m.world.agent.facing = 'left';
    m.pilot.hold(300, 'B');
    const opened = [0, 1].filter((i) => m.world.fixtureOpened(i));
    expect(opened).toEqual([0]);
    expect(m.world.search).toBeNull();
    // a fresh press does search the other one
    m.pilot.idle(130);
    m.pilot.tap('B');
    expect(m.world.search?.fixture).toBe(1);
  });

  it('searched fixtures cannot be searched again, and stay open', () => {
    const m = nearShelf();
    m.pilot.tap('B');
    until(m.pilot, () => m.world.fixtureOpened(0));
    m.pilot.idle(130);
    expect(m.world.searchTarget).not.toBe(0);
    m.pilot.tap('B');
    // fixture 1 at (4,1) may be touched from here; fixture 0 must not restart
    expect(m.world.search?.fixture ?? -1).not.toBe(0);
  });

  it('re-entering the store keeps opened fixtures (state lives in run.level)', () => {
    const m = nearShelf();
    m.pilot.tap('B');
    until(m.pilot, () => m.world.fixtureOpened(0));
    expect(m.run.level.stores.crookstone!.fixtures[0]!.opened).toBe(true);
    const again = makeWorld('crookstone');
    // a brand new world on the same run (the Game rebuilds the world on every entry)
    const w2 = new StoreWorld(m.run, 'crookstone', new Rng(5));
    expect(w2.fixtureOpened(0)).toBe(true);
    expect(w2.fixtureOpened(1)).toBe(false);
    w2.teleportAgent(3, 2);
    w2.agent.facing = 'up';
    expect(w2.searchTarget).not.toBe(0);
    expect(again.world.fixtureOpened(0)).toBe(false);
  });

  it('search target prompt (canSearch) is false while stunned or holding an item', () => {
    const m = nearShelf();
    setContent(m, 0, { kind: 'trap' });
    m.pilot.tap('B');
    until(m.pilot, () => m.world.fixtureOpened(0));
    expect(m.world.agent.stun).toBeGreaterThan(0);
    expect(m.world.canSearch).toBe(false);
  });
});

describe('fixture contents', () => {
  const at = (storeId: 'radioshock' | 'crookstone' | 'forever12' = 'radioshock', col = 2, row = 2, opts = {}) => {
    const m = makeWorld(storeId, opts);
    m.world.teleportAgent(col, row);
    return m;
  };
  const search = (m: ReturnType<typeof at>, i = 0): void => {
    m.pilot.tap('B');
    until(m.pilot, () => m.world.fixtureOpened(i));
  };

  it('PACKAGE: +500, held overhead, fanfare, "PACKAGE n/6", the store is cleared', () => {
    const m = at();
    setContent(m, 0, { kind: 'package' });
    search(m);
    expect(m.run.score).toBe(POINTS.package);
    expect(POINTS.package).toBe(500);
    expect(m.world.store.packageTaken).toBe(true);
    expect(m.run.level.stores.radioshock!.packageTaken).toBe(true);
    expect(m.world.banner?.text).toBe(packageBanner(1));
    expect(m.world.banner?.text).toBe('PACKAGE 1/6');
    expect(m.run.drainSfx()).toContain('fanfare');
    expect(m.world.agent.hold?.kind).toBe('package');
    expect(m.run.packages).toBe(1);
  });

  it('PACKAGE count includes the packages already taken ("PACKAGE 3/6")', () => {
    const m = at();
    m.run.level.stores.kgbtoys!.packageTaken = true;
    m.run.level.stores.hotspy!.packageTaken = true;
    setContent(m, 0, { kind: 'package' });
    search(m);
    expect(m.world.banner?.text).toBe('PACKAGE 3/6');
  });

  it('freezes the agent while he holds the item overhead, then he can move again', () => {
    const m = at();
    setContent(m, 0, { kind: 'package' });
    search(m);
    const x0 = m.world.agent.x;
    m.pilot.hold(HOLD_PACKAGE - 10, 'RIGHT');
    expect(m.world.agent.x).toBe(x0);
    m.pilot.hold(40, 'RIGHT');
    expect(m.world.agent.x).toBeGreaterThan(x0);
    expect(m.world.agent.hold).toBeNull();
  });

  it('POWER-UP: applies the slot, +50, banner with its name, powerup sound, held overhead', () => {
    for (const id of POWER_IDS) {
      const m = at('radioshock');
      setContent(m, 0, { kind: 'powerup', power: id });
      const lives = m.run.lives;
      search(m);
      expect(m.world.banner?.text, id).toBe(POWERUPS[id].name);
      expect(m.run.score, id).toBe(POINTS.powerup);
      expect(m.run.drainSfx(), id).toContain('powerup');
      expect(m.world.agent.hold?.kind, id).toBe('power');
      if (id === 'rapid') expect(m.run.power.weapon?.id).toBe('rapid');
      if (id === 'spread') expect(m.run.power.weapon?.id).toBe('spread');
      if (id === 'armor' || id === 'pretzel') expect(m.run.power.armor).toBe(id);
      if (id === 'sneakers' || id === 'ooze') expect(m.run.power.speed?.id).toBe(id);
      if (id === 'radar') expect(m.run.power.radar).toBe(true);
      if (id === 'cinnabomb') expect(m.run.invincible).toBe(true);
      if (id === 'oneup') expect(m.run.lives).toBe(lives + 1);
    }
  });

  it('a power-up from a shop applies to the existing slots (weapon replaced, armour stacks)', () => {
    const m = at('radioshock');
    m.run.givePower('rapid');
    m.run.givePower('armor');
    setContent(m, 0, { kind: 'powerup', power: 'spread' });
    search(m);
    expect(m.run.power.weapon?.id).toBe('spread');
    expect(m.run.power.armor).toBe('armor');
  });

  it('TRAP: smoke puff, "IT\'S A TRAP!", stunned for exactly 1 s, smoke sound', () => {
    const m = at();
    setContent(m, 0, { kind: 'trap' });
    search(m);
    expect(m.world.banner?.text).toBe(UI.trap);
    expect(m.world.puffs.length).toBeGreaterThan(0);
    expect(m.run.drainSfx()).toContain('smoke');
    expect(m.world.agent.stun).toBe(STUN_FRAMES);
    expect(STUN_FRAMES).toBe(60);
    const x0 = m.world.agent.x;
    m.pilot.hold(59, 'RIGHT');
    expect(m.world.agent.x).toBe(x0);
    m.pilot.hold(3, 'RIGHT');
    expect(m.world.agent.x).toBeGreaterThan(x0);
  });

  it('NOTHING: a puff and "NOTHING HERE", no stun, no score', () => {
    const m = at();
    setContent(m, 0, { kind: 'nothing' });
    search(m);
    expect(m.world.banner?.text).toBe(UI.nothing);
    expect(m.world.puffs.length).toBeGreaterThan(0);
    expect(m.world.agent.stun).toBe(0);
    expect(m.run.score).toBe(0);
  });

  it('every search is announced in a banner', () => {
    for (const content of [{ kind: 'package' }, { kind: 'trap' }, { kind: 'nothing' }, { kind: 'powerup', power: 'radar' }] as const) {
      const m = at();
      setContent(m, 0, content);
      search(m);
      expect(m.world.banner).not.toBeNull();
      expect(m.world.banner!.t).toBeGreaterThan(30);
    }
  });

  it('Radar flags the fixture holding the package (until it is searched)', () => {
    const m = at();
    const idx = m.run.level.stores.radioshock!.fixtures.findIndex((f) => f.content.kind === 'package');
    for (let i = 0; i < m.world.room.fixtures.length; i++) expect(m.world.radarMarked(i)).toBe(false);
    m.run.givePower('radar');
    const marked = m.world.room.fixtures.map((_, i) => i).filter((i) => m.world.radarMarked(i));
    expect(marked).toEqual([idx]);
    m.world.store.fixtures[idx]!.opened = true;
    expect(m.world.radarMarked(idx)).toBe(false);
  });

  it('power-up timers keep running inside stores (tickPowers once per step); the world never touches levelFrames', () => {
    const m = makeWorld('crookstone');
    m.run.givePower('rapid');
    m.run.givePower('cinnabomb');
    const left = m.run.power.weapon!.left;
    m.pilot.idle(10);
    expect(m.run.power.weapon!.left).toBe(left - 10);
    expect(m.run.power.invincible).toBe(6 * 60 - 10);
    expect(m.run.levelFrames).toBe(0);
  });

  it('does not run after it has finished (exited / died)', () => {
    const m = makeWorld('crookstone');
    m.pilot.hold(30, 'DOWN');
    expect(m.world.exited).toBe(true);
    m.run.givePower('rapid');
    const left = m.run.power.weapon!.left;
    m.pilot.idle(10);
    expect(m.run.power.weapon!.left).toBe(left);
  });

  it('uses the theme and name of the store', () => {
    const m = makeWorld('hotspy');
    expect(m.world.name).toBe(storeDef('hotspy').name);
    expect(m.world.room.theme).toBe('food');
    expect(m.world.music()).toBe('store.hotspy');
    expect(getRoom('hotspy')).toBe(m.world.room);
  });

  it('death sequence: died is only set after the death animation', () => {
    const m = makeWorld('crookstone');
    m.world.bullets.push({ kind: 'enemy', x: m.world.agent.x, y: m.world.agent.y, vx: 0, vy: 1, age: 0, noclip: 0 });
    m.pilot.step();
    expect(m.world.agent.dying).toBeGreaterThan(0);
    expect(m.world.died).toBe(false);
    m.pilot.idle(DEATH_FRAMES - 5);
    expect(m.world.died).toBe(false);
    m.pilot.idle(10);
    expect(m.world.died).toBe(true);
    expect(m.run.drainSfx()).toContain('death');
    expect(m.run.lives).toBe(3); // the Game calls run.loseLife(), not the world
  });
});
