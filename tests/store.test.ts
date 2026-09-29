import { describe, expect, it } from 'vitest';
import {
  PACKAGES_TOTAL,
  SEARCH_FRAMES,
  TILE,
  TRAP_STUN_FRAMES,
  sec,
} from '../src/core/constants';
import { JOKE_ITEMS } from '../src/core/copy';
import { Button } from '../src/core/input';
import { canEnterStore, fixtureKey } from '../src/core/level';
import { newStoreState, searchTargetFor, stepStore } from '../src/core/store';
import { STORE_BY_ID } from '../src/core/storeDefs';
import type { Fixture, StoreState } from '../src/core/types';
import { harness, type Harness } from './helpers';

/** Enter a store immediately, skipping the mall fade. */
function enter(h: Harness, storeId: string): StoreState {
  const def = STORE_BY_ID.get(storeId)!;
  h.g.store = newStoreState(h.g, def);
  h.g.screen = 'store';
  h.g.screenFrames = 0;
  return h.g.store;
}

/** Stand the agent next to a fixture, facing it. */
function standBy(st: StoreState, f: Fixture): void {
  // Pick a walkable neighbour.
  const cands: [number, number, 0 | 1 | 2 | 3][] = [
    [f.tx, f.ty + 1, 3],
    [f.tx, f.ty - 1, 0],
    [f.tx + 1, f.ty, 1],
    [f.tx - 1, f.ty, 2],
  ];
  for (const [tx, ty, dir] of cands) {
    const row = st.tiles[ty];
    if (!row || !'.oLP'.includes(row[tx])) continue;
    st.player.x = tx * TILE + TILE / 2;
    st.player.y = ty * TILE + TILE / 2;
    st.player.dir = dir;
    return;
  }
  throw new Error(`no walkable neighbour for fixture ${f.tx},${f.ty}`);
}

function skipCutscene(h: Harness): void {
  const st = h.g.store!;
  st.cutscene = 'none';
  st.cutsceneFrames = 0;
  st.graceFrames = 0;
  st.guards.length = 0;
  st.player.searchLatch = false;
}

function packageFixture(st: StoreState): Fixture {
  return st.fixtures.find((f) => f.content === 'package')!;
}

describe('store rooms', () => {
  it('drops the agent in the doorway facing in', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    expect(st.player.y).toBeGreaterThan((st.tiles.length - 2) * TILE);
    expect(st.tiles[st.tiles.length - 1][Math.floor(st.player.x / TILE)]).toBe('o');
  });

  it('gives each store 1 to 3 guards', () => {
    for (const id of ['forever12', 'kgbtoys', 'hotspy', 'sambaddy']) {
      for (let seed = 1; seed < 20; seed++) {
        const h = harness(seed);
        const st = enter(h, id);
        expect(st.guards.length).toBeGreaterThanOrEqual(1);
        expect(st.guards.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('walls, fixtures, counters and decor are solid; the door is walkable', () => {
    const h = harness();
    const st = enter(h, 'radioshock');
    skipCutscene(h);
    // Walk into the top wall for a while; he must not leave the room.
    st.player.x = 2 * TILE + TILE / 2;
    st.player.y = 2 * TILE + TILE / 2;
    h.run(sec(4), Button.Up);
    expect(st.player.y).toBeGreaterThan(TILE);
  });
});

describe('searching', () => {
  it('a SINGLE tap of B runs the whole search on its own', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    // Tap once, then never touch B again.
    h.run(1, Button.B);
    expect(st.player.searchFrames).toBeGreaterThan(0);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(f.opened).toBe(true);
  });

  it('turns the agent to face the fixture he searches', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    st.player.dir = 0; // deliberately facing away
    h.run(1, Button.B);
    const cx = f.tx * TILE + TILE / 2;
    const cy = f.ty * TILE + TILE / 2;
    const expected = Math.abs(cy - st.player.y) >= Math.abs(cx - st.player.x)
      ? cy > st.player.y ? 0 : 3
      : cx > st.player.x ? 2 : 1;
    expect(st.player.dir).toBe(expected);
  });

  it('counts a fixture touched at a gap, not only the one straight ahead', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    // Slide sideways so the fixture is beside him, not in front.
    st.player.dir = 0;
    st.player.x += 5;
    expect(searchTargetFor(st)).not.toBeNull();
  });

  it('a fresh press of a different direction cancels the search', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    h.run(1, Button.B);
    h.run(5, 0);
    expect(st.player.searchFrames).toBeGreaterThan(0);
    h.run(1, Button.Left);
    expect(st.player.searchFrames).toBe(0);
    expect(f.opened).toBe(false);
  });

  it('shooting cancels the search', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    h.run(1, Button.B);
    h.run(1, Button.A);
    expect(st.player.searchFrames).toBe(0);
  });

  it('holding B after a search does NOT immediately search the next fixture', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    // Hold B down for the whole search and well beyond.
    h.run(SEARCH_FRAMES + 60, Button.B);
    expect(f.opened).toBe(true);
    const opened = st.fixtures.filter((x) => x.opened).length;
    expect(opened).toBe(1);
    expect(st.player.searchFrames).toBe(0);
  });

  it('a fresh tap after releasing B does search the next fixture', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    h.run(SEARCH_FRAMES + 10, Button.B);
    h.run(2, 0); // release
    f.opened = false; // pretend it is fresh again
    h.run(1, Button.B);
    expect(st.player.searchFrames).toBeGreaterThan(0);
  });

  it('keeps opened fixtures open when you leave and come back', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    standBy(st, f);
    h.run(1, Button.B);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(h.g.level.stores.forever12.opened[fixtureKey(f.tx, f.ty)]).toBe(true);

    const again = enter(h, 'forever12');
    const same = again.fixtures.find((x) => x.tx === f.tx && x.ty === f.ty)!;
    expect(same.opened).toBe(true);
  });
});

describe('what a fixture holds', () => {
  it('a package counts up and clears the store', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = packageFixture(st);
    standBy(st, f);
    h.run(1, Button.B);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(h.g.level.packages).toBe(1);
    expect(h.g.level.stores.forever12.cleared).toBe(true);
    expect(st.banners[0].lines[0]).toBe(`PACKAGE 1/${PACKAGES_TOTAL}`);
    expect(st.player.holdText).toBe('PACKAGE');
  });

  it('a cleared target store cannot be entered again', () => {
    const h = harness();
    const def = STORE_BY_ID.get('forever12')!;
    expect(canEnterStore(h.g.level, def)).toBe(true);
    h.g.level.stores.forever12.cleared = true;
    expect(canEnterStore(h.g.level, def)).toBe(false);
  });

  it('a trap stuns the agent for 1 s', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    f.content = 'trap';
    f.powerup = null;
    standBy(st, f);
    h.run(1, Button.B);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(st.player.stunFrames).toBeGreaterThan(TRAP_STUN_FRAMES - 10);
    expect(st.banners[0].lines[0]).toBe("IT'S A TRAP!");
  });

  it('a power-up is applied and announced', () => {
    const h = harness();
    const st = enter(h, 'crookstone');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.content === 'powerup')!;
    f.powerup = 'rapid';
    standBy(st, f);
    h.run(1, Button.B);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(h.g.powerups.weapon).toBe('rapid');
    expect(st.banners[0].lines[0]).toBe('RAPID FIRE');
  });

  it('announces an empty fixture too', () => {
    const h = harness();
    const st = enter(h, 'forever12');
    skipCutscene(h);
    const f = st.fixtures.find((x) => x.char === 'F')!;
    f.content = 'nothing';
    standBy(st, f);
    h.run(1, Button.B);
    h.run(SEARCH_FRAMES + 2, 0);
    expect(st.banners[0].lines[0]).toBe('NOTHING HERE');
  });
});

describe('store extras', () => {
  it('Forever 12 fitting rooms can reveal a spy, leaving the contents unsearched', () => {
    // Force the 25% roll by trying seeds until it fires.
    let fired = false;
    for (let seed = 1; seed < 60 && !fired; seed++) {
      const h = harness(seed);
      const st = enter(h, 'forever12');
      skipCutscene(h);
      const f = st.fixtures.find((x) => x.char === 'R')!;
      standBy(st, f);
      const guardsBefore = st.guards.length;
      h.run(1, Button.B);
      h.run(SEARCH_FRAMES + 2, 0);
      if (st.guards.length > guardsBefore) {
        fired = true;
        expect(f.opened, 'contents stay unsearched').toBe(false);
        expect(st.bubbles.some((b) => b.text === 'OCCUPIED!!')).toBe(true);
      }
    }
    expect(fired, 'the fitting-room spy fires for some seed').toBe(true);
  });

  it('KGB Toys shelves release 3 wind-up toys when shot', () => {
    const h = harness();
    const st = enter(h, 'kgbtoys');
    skipCutscene(h);
    // Stand just below a toy shelf, facing up.
    const shelfTy = 1;
    const shelfTx = 1;
    expect(st.tiles[shelfTy][shelfTx]).toBe('T');
    st.player.x = shelfTx * TILE + TILE / 2;
    st.player.y = (shelfTy + 1) * TILE + TILE / 2;
    st.player.dir = 3;
    h.run(1, Button.A);
    expect(st.toys).toHaveLength(3);
  });

  it('wind-up toys stun guards they touch', () => {
    const h = harness();
    const st = enter(h, 'kgbtoys');
    skipCutscene(h);
    st.toys.push({ x: 100, y: 100, dir: 0, frames: sec(10) });
    st.guards.push({
      id: 50,
      kind: 'spy',
      x: 102,
      y: 102,
      dir: 0,
      hp: 1,
      think: 999,
      shootTimer: 999,
      stunFrames: 0,
      deadFrames: 0,
      patrolDir: 1,
      patrolVertical: false,
      bubbleFrames: 0,
      bubbleText: '',
    });
    h.run(2, 0);
    expect(st.guards[0].stunFrames).toBeGreaterThan(0);
  });

  it('the Sam Baddy listening booth switches to the bonus track', () => {
    const h = harness();
    const st = enter(h, 'sambaddy');
    skipCutscene(h);
    const ty = st.tiles.findIndex((r) => r.includes('L'));
    const tx = st.tiles[ty].indexOf('L');
    st.player.x = tx * TILE + TILE / 2;
    st.player.y = ty * TILE + TILE / 2;
    h.g.bus.drain();
    h.run(2, 0);
    expect(st.onBooth).toBe(true);
    const music = h.g.bus.drain().filter((e) => e.t === 'music');
    expect(music.some((e) => e.t === 'music' && e.id === 'bonus')).toBe(true);
  });

  it('the GameStonk Zelda scene fires once per game and yields a useless item', () => {
    const h = harness();
    const st = enter(h, 'gamestonk');
    expect(st.cutscene).toBe('zelda');
    expect(h.g.zeldaEggUsed).toBe(true);
    // Run the typewriter out.
    h.run(sec(8), 0);
    expect(st.cutscene).toBe('none');
    expect(st.pedestalItem).not.toBeNull();
    expect(JOKE_ITEMS).toContain(st.pedestalItem!);

    // Walking onto the pedestal takes it.
    const ty = st.tiles.findIndex((r) => r.includes('P'));
    const tx = st.tiles[ty].indexOf('P');
    st.player.x = tx * TILE + TILE / 2;
    st.player.y = ty * TILE + TILE / 2;
    const score = h.g.score;
    h.run(2, 0);
    expect(h.g.inventory).toHaveLength(1);
    expect(h.g.score).toBe(score + 1);
    expect(st.clerkVisible).toBe(false);

    // Second visit this game: no scene.
    const st2 = enter(h, 'gamestonk');
    expect(st2.cutscene).not.toBe('zelda');
  });

  it('first-visit store lines play once per game', () => {
    const h = harness();
    const st = enter(h, 'kgbtoys');
    expect(st.cutscene).toBe('firstVisit');
    h.run(1, 0);
    expect(st.bubbles[0].text).toBe("DIMITRI, HE'S HERE!");
    h.run(sec(1), 0);
    expect(st.bubbles.some((b) => b.text === 'DA! HIDE THE TEDDIES!')).toBe(true);
    h.run(sec(4), 0);
    expect(st.cutscene).toBe('none');

    const again = enter(h, 'kgbtoys');
    expect(again.cutscene).toBe('none');
  });
});

describe('guards', () => {
  it('gives a grace period before shooting someone who just walked in', () => {
    const h = harness();
    const st = enter(h, 'radioshock');
    st.cutscene = 'none';
    expect(st.graceFrames).toBeGreaterThan(0);
    const g0 = st.graceFrames;
    h.run(10, 0);
    expect(st.graceFrames).toBe(g0 - 10);
  });

  it('security bots take 3 hits', () => {
    const h = harness();
    const st = enter(h, 'crookstone');
    skipCutscene(h);
    st.guards.push({
      id: 77,
      kind: 'bot',
      x: 120,
      y: 100,
      dir: 0,
      hp: 3,
      think: 999,
      shootTimer: 999,
      stunFrames: 999999,
      deadFrames: 0,
      patrolDir: 1,
      patrolVertical: false,
      bubbleFrames: 0,
      bubbleText: '',
    });
    const bot = st.guards[0];
    for (let i = 0; i < 2; i++) {
      st.bullets.push({ x: bot.x, y: bot.y, vx: 0, vy: 0, fromPlayer: true });
      stepStore(h.g, h.pad);
    }
    expect(bot.deadFrames).toBe(0);
    st.bullets.push({ x: bot.x, y: bot.y, vx: 0, vy: 0, fromPlayer: true });
    stepStore(h.g, h.pad);
    expect(bot.deadFrames).toBeGreaterThan(0);
  });

  it('guards come back when you re-enter a store whose package is still inside', () => {
    const h = harness();
    const st = enter(h, 'kgbtoys');
    expect(st.guards.length).toBeGreaterThan(0);
    st.guards.length = 0;
    const again = enter(h, 'kgbtoys');
    expect(again.guards.length).toBeGreaterThan(0);
  });
});

describe('the fitting-room ambush is survivable', () => {
  it('never kills the player outright: the shoe cannot land during the startle', () => {
    // Force the scare, then check the player survives the shoe at point blank.
    for (let seed = 1; seed < 80; seed++) {
      const h = harness(seed);
      const st = enter(h, 'forever12');
      skipCutscene(h);
      const f = st.fixtures.find((x) => x.char === 'R')!;
      standBy(st, f);
      const guardsBefore = st.guards.length;
      h.run(1, Button.B);
      h.run(SEARCH_FRAMES + 2, 0);
      if (st.guards.length === guardsBefore) continue; // scare did not fire
      expect(st.player.invulnFrames, 'startle window').toBeGreaterThan(0);
      h.run(sec(1), 0);
      // Still in the store, still alive.
      expect(h.g.screen).toBe('store');
      expect(h.g.lives).toBe(3);
      return;
    }
    throw new Error('the fitting-room scare never fired across 80 seeds');
  });

  it('lets a second search of the same fitting room reach its real contents', () => {
    for (let seed = 1; seed < 80; seed++) {
      const h = harness(seed);
      const st = enter(h, 'forever12');
      skipCutscene(h);
      const f = st.fixtures.find((x) => x.char === 'R')!;
      standBy(st, f);
      const guardsBefore = st.guards.length;
      h.run(1, Button.B);
      h.run(SEARCH_FRAMES + 2, 0);
      if (st.guards.length === guardsBefore) continue;
      expect(f.opened).toBe(false);
      // Search again: the scare is spent, so the contents resolve.
      st.guards.length = 0;
      st.bullets.length = 0;
      h.run(4, 0);
      h.run(1, Button.B);
      h.run(SEARCH_FRAMES + 4, 0);
      expect(f.opened, 'the second search resolves').toBe(true);
      return;
    }
    throw new Error('the fitting-room scare never fired across 80 seeds');
  });
});
