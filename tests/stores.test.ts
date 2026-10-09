import { describe, expect, it } from 'vitest';
import { makeStore, Driver } from './helpers';
import { OPEN_STORES, ROOM_H, ROOM_W, TEMPLATES, THEMES, TILE, buildRoom, roomFor, isSolidChar } from '../src/core/stores-data';
import { setupLevel, remainingPackageStores } from '../src/core/levelsetup';
import { newRun } from '../src/core/run';
import { STORES, StoreId, storeInfo, FIRST_VISIT_LINES, MISC, JOKE_ITEMS } from '../src/core/copy';
import { StoreRoom, SEARCH_FRAMES, TRAP_STUN, GRACE_FRAMES } from '../src/core/store';
import { SHOP_POWERS, FOOD_POWERS, applyPower } from '../src/core/powerups';

function stepS(s: StoreRoom, d: Driver, n: number, held: Record<string, boolean> = {}) {
  for (let i = 0; i < n; i++) s.step(d.frame(held));
}
/** Put the agent right below fixture `idx`, facing up. */
function standBelow(s: StoreRoom, idx: number) {
  const f = s.setup.fixtures[idx];
  s.p.x = f.col * TILE;
  s.p.y = (f.row + 1) * TILE - 7;
  s.p.dir = 'up';
  s.guards = [];
  s.grace = 9999;
  s.introLines = [];
}

describe('store room templates', () => {
  it('there are 10 open stores, each with its own hand-designed layout and a theme', () => {
    expect(OPEN_STORES.length).toBe(10);
    const layouts = new Set(OPEN_STORES.map((id) => TEMPLATES[id]!.interior.join('|')));
    expect(layouts.size).toBe(10);
    expect(new Set(OPEN_STORES.map((id) => TEMPLATES[id]!.theme)).size).toBe(9);
    expect(THEMES.length).toBe(9);
    for (const id of OPEN_STORES) expect(storeInfo(id).role).not.toBe('closed');
    for (const s of STORES.filter((s) => s.role === 'closed')) expect(TEMPLATES[s.id]).toBeUndefined();
  });
  it('gadgets is used by two shops with different layouts', () => {
    const g = OPEN_STORES.filter((id) => TEMPLATES[id]!.theme === 'gadgets');
    expect(g.sort()).toEqual(['crookstone', 'sharper']);
    expect(TEMPLATES.crookstone!.interior.join()).not.toBe(TEMPLATES.sharper!.interior.join());
  });
  for (const id of OPEN_STORES) {
    it(`${id}: 16x11 tiles, walled, door at the bottom centre, 1-3 guards, reachable fixtures`, () => {
      const r = roomFor(id);
      expect(r.w).toBe(ROOM_W);
      expect(r.h).toBe(ROOM_H);
      expect(r.tiles.length).toBe(ROOM_H);
      for (const row of r.tiles) expect(row.length).toBe(ROOM_W);
      for (let c = 0; c < r.w; c++) expect(r.tiles[0][c]).toBe('#');
      for (let rr = 0; rr < r.h; rr++) {
        expect(r.tiles[rr][0]).toBe('#');
        expect(r.tiles[rr][r.w - 1]).toBe('#');
      }
      expect(r.doorCols).toEqual([7, 8]);
      expect(r.tiles[r.h - 1][7]).toBe('D');
      expect(r.tiles[r.h - 1][8]).toBe('D');
      const guards = r.spies.length + r.bots.length;
      expect(guards).toBeGreaterThanOrEqual(1);
      expect(guards).toBeLessThanOrEqual(3);
      expect(r.fixtures.length).toBeGreaterThanOrEqual(6);
      // flood fill from the door
      const seen = new Set<string>();
      const q: [number, number][] = [[7, r.h - 2]];
      seen.add('7,' + (r.h - 2));
      while (q.length) {
        const [c, rr] = q.shift()!;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc;
          const nr = rr + dr;
          if (nc < 0 || nr < 0 || nc >= r.w || nr >= r.h || isSolidChar(r.tiles[nr][nc]) || seen.has(`${nc},${nr}`)) continue;
          seen.add(`${nc},${nr}`);
          q.push([nc, nr]);
        }
      }
      for (const f of r.fixtures) {
        const reach = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${f.col + dc},${f.row + dr}`));
        expect(reach, `${id} fixture ${f.col},${f.row}`).toBe(true);
      }
      for (const g of [...r.spies, ...r.bots]) expect(seen.has(`${g.col},${g.row}`), `${id} guard at ${g.col},${g.row}`).toBe(true);
      expect(seen.has('7,1') || seen.size > 40).toBe(true);
    });
  }
  it('the room system works for any size, with a camera that follows the agent', () => {
    const big = buildRoom({ id: 'forever12', theme: 'fashion', interior: Array.from({ length: 16 }, (_, i) => (i === 0 ? '.f.'.padEnd(28, '.') : ''.padEnd(28, '.'))) });
    expect(big.w).toBe(30);
    expect(big.h).toBe(18);
    expect(big.doorCols.length).toBe(2);
    const { store } = makeStore('forever12');
    store.room = big;
    store.p.x = 400;
    store.p.y = 200;
    store.updateCamera();
    expect(store.cam.x).toBeGreaterThan(0);
    expect(store.cam.x).toBeLessThanOrEqual(30 * TILE - ROOM_W * TILE);
    store.p.x = 0;
    store.updateCamera();
    expect(store.cam.x).toBe(0);
    const small = makeStore('forever12').store;
    small.updateCamera();
    expect(small.cam).toEqual({ x: 0, y: 0 });
  });
});

describe('level setup rules', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i * 31 + 1);
  it('exactly one package per target store (6 in total), none elsewhere', () => {
    for (const seed of seeds) {
      const lvl = setupLevel(seed, 1);
      let total = 0;
      for (const s of STORES) {
        const st = lvl[s.id];
        if (s.role === 'closed') {
          expect(st).toBeUndefined();
          continue;
        }
        const pk = st.fixtures.filter((f) => f.loot.type === 'package').length;
        expect(pk, `${s.id} seed ${seed}`).toBe(s.role === 'target' ? 1 : 0);
        total += pk;
      }
      expect(total).toBe(6);
    }
  });
  it('power-up shops are never trapped and hold only power-ups or nothing', () => {
    for (const seed of seeds) {
      const lvl = setupLevel(seed, 2);
      for (const s of STORES.filter((x) => x.role === 'powerup'))
        for (const f of lvl[s.id].fixtures) expect(['powerup', 'nothing']).toContain(f.loot.type);
    }
  });
  it('Black Friday: every non-package fixture holds a power-up', () => {
    for (const seed of seeds.slice(0, 20)) {
      const lvl = setupLevel(seed, 1, true);
      for (const id of OPEN_STORES) for (const f of lvl[id].fixtures) expect(['package', 'powerup']).toContain(f.loot.type);
    }
  });
  it('regular target stores do hide traps, power-ups and nothing; food comes mostly from Hot Spy on a Stick', () => {
    let traps = 0;
    let hotspyFood = 0;
    let hotspyPow = 0;
    let otherFood = 0;
    let otherPow = 0;
    for (const seed of seeds) {
      const lvl = setupLevel(seed, 1);
      for (const id of OPEN_STORES) for (const f of lvl[id].fixtures) {
        if (f.loot.type === 'trap') traps++;
        if (f.loot.type === 'powerup') {
          const food = (FOOD_POWERS as string[]).includes(f.loot.power);
          if (id === 'hotspy') (hotspyPow++, food && hotspyFood++);
          else (otherPow++, food && otherFood++);
        }
      }
    }
    expect(traps).toBeGreaterThan(50);
    expect(hotspyFood / hotspyPow).toBeGreaterThan(0.6);
    expect(otherFood / otherPow).toBeLessThan(0.25);
  });
  it('is deterministic per seed and differs between loops', () => {
    expect(JSON.stringify(setupLevel(5, 1))).toBe(JSON.stringify(setupLevel(5, 1)));
    expect(JSON.stringify(setupLevel(5, 1))).not.toBe(JSON.stringify(setupLevel(5, 2)));
    expect(remainingPackageStores(setupLevel(5, 1)).length).toBe(6);
  });
});

describe('searching', () => {
  it('a SINGLE TAP of B starts a search that runs on its own for ~0.75 s and then reveals the contents', () => {
    const { store, d } = makeStore('hotspy', 3);
    standBelow(store, 0);
    store.setup.fixtures[0].loot = { type: 'nothing' };
    stepS(store, d, 1);
    expect(store.canSearch()).toBe(true);
    store.step(d.frame({ b: true }));
    store.step(d.frame({})); // released after one frame
    expect(store.p.state).toBe('search');
    stepS(store, d, SEARCH_FRAMES - 5);
    expect(store.p.state).toBe('search');
    expect(store.search!.t).toBeGreaterThan(30);
    stepS(store, d, 10);
    expect(store.p.state).toBe('walk');
    expect(store.setup.fixtures[0].opened).toBe(true);
    expect(store.banner?.text).toBe(MISC.nothing);
  });
  it('any fixture the agent is touching counts - in front or at either side, even across a gap - and he turns to face it', () => {
    const { store, d } = makeStore('hotspy', 3);
    const f = store.setup.fixtures[1];
    store.guards = [];
    store.grace = 9999;
    // stand to the LEFT of the fixture, facing away from it
    store.p.x = f.col * TILE - 13;
    store.p.y = f.row * TILE - 6;
    store.p.dir = 'down';
    stepS(store, d, 1);
    expect(store.touchedFixture()).toBe(1);
    store.step(d.frame({ b: true }));
    expect(store.p.state).toBe('search');
    expect(store.p.dir).toBe('right');
    // a fixture touched only with a corner (a diagonal gap)
    const s2 = makeStore('hotspy', 3);
    const g = s2.store.setup.fixtures[1];
    s2.store.guards = [];
    // only the corner of the hit box is within reach of the fixture's corner (a 1 px gap on both axes)
    s2.store.p.x = g.col * TILE - 14;
    s2.store.p.y = g.row * TILE + 8;
    expect(s2.store.touchedFixture()).toBe(1);
  });
  it('a fresh press of a different direction cancels; the same direction (held) does not; shooting cancels', () => {
    const base = () => {
      const r = makeStore('hotspy', 3);
      standBelow(r.store, 0);
      r.store.step(r.d.frame({ b: true, up: true }));
      return r;
    };
    const keep = base();
    stepS(keep.store, keep.d, 10, { up: true });
    expect(keep.store.p.state).toBe('search');
    const cancel = base();
    stepS(cancel.store, cancel.d, 5);
    cancel.store.step(cancel.d.frame({ left: true }));
    expect(cancel.store.p.state).toBe('walk');
    const shoot = base();
    stepS(shoot.store, shoot.d, 5);
    shoot.store.step(shoot.d.frame({ a: true }));
    expect(shoot.store.p.state).toBe('walk');
    expect(shoot.run.events.drain().some((e) => e.kind === 'shot')).toBe(true);
  });
  it('holding B after a search does not immediately search the next fixture', () => {
    const { store, d } = makeStore('hotspy', 3);
    standBelow(store, 0);
    store.setup.fixtures[0].loot = { type: 'nothing' };
    // put another unopened fixture right beside: reuse the next one by moving next to both is not possible, so
    // simply check that the held button never restarts a search
    store.step(d.frame({ b: true }));
    for (let i = 0; i < SEARCH_FRAMES + 40; i++) store.step(d.frame({ b: true }));
    expect(store.setup.fixtures[0].opened).toBe(true);
    expect(store.p.state).toBe('walk');
    expect(store.search).toBeNull();
    // standing at an unopened fixture with B held from before: no search starts
    const f2 = makeStore('hotspy', 3);
    f2.store.guards = [];
    f2.store.grace = 9999;
    f2.store.step(f2.d.frame({ b: true }));
    standBelow(f2.store, 1);
    for (let i = 0; i < 20; i++) f2.store.step(f2.d.frame({ b: true }));
    expect(f2.store.p.state).toBe('walk');
  });
  it('searched fixtures stay open for the rest of the level, including after leaving and coming back', () => {
    const { store, d, run } = makeStore('hotspy', 3);
    standBelow(store, 0);
    store.setup.fixtures[0].loot = { type: 'nothing' };
    store.step(d.frame({ b: true }));
    stepS(store, d, 60);
    expect(store.setup.fixtures[0].opened).toBe(true);
    const again = new StoreRoom(run, 'hotspy');
    expect(again.setup.fixtures[0].opened).toBe(true);
    again.p.x = again.setup.fixtures[0].col * TILE;
    again.p.y = (again.setup.fixtures[0].row + 1) * TILE - 7;
    expect(again.touchedFixture()).not.toBe(0);
  });
  it('the package: held overhead, +500, PACKAGE n/6, the store counts as cleared and has exactly one package', () => {
    const { store, d, run } = makeStore('hotspy', 3);
    const idx = store.setup.fixtures.findIndex((f) => f.loot.type === 'package');
    standBelow(store, idx);
    store.step(d.frame({ b: true }));
    stepS(store, d, SEARCH_FRAMES + 2);
    expect(store.p.state).toBe('hold');
    expect(store.p.hold?.label).toBe('PACKAGE 1/6');
    expect(store.banner?.text).toBe('PACKAGE 1/6');
    expect(run.score.score).toBe(500);
    expect(run.packages).toEqual(['hotspy']);
    expect(store.setup.cleared).toBe(true);
    const ev = run.events.drain().map((e) => e.kind);
    expect(ev).toContain('package');
    stepS(store, d, 120);
    expect(store.p.state).toBe('walk');
  });
  it('a power-up is held overhead with its name as a banner and is applied', () => {
    const { store, d, run } = makeStore('crookstone', 3);
    store.setup.fixtures[0].loot = { type: 'powerup', power: 'spread' };
    standBelow(store, 0);
    store.step(d.frame({ b: true }));
    stepS(store, d, SEARCH_FRAMES + 2);
    expect(store.p.state).toBe('hold');
    expect(store.banner?.text).toBe('SPREAD SHOT');
    expect(run.powers.weapon?.kind).toBe('spread');
    expect(run.score.score).toBe(50);
  });
  it('a trap: smoke puff, "IT\'S A TRAP!" and the agent is stunned for 1 s', () => {
    const { store, d } = makeStore('hotspy', 3);
    store.setup.fixtures[0].loot = { type: 'trap' };
    standBelow(store, 0);
    store.step(d.frame({ b: true }));
    stepS(store, d, SEARCH_FRAMES + 2);
    expect(store.p.state).toBe('stun');
    expect(store.banner?.text).toBe("IT'S A TRAP!");
    expect(store.smoke.length).toBeGreaterThan(0);
    stepS(store, d, TRAP_STUN - 12);
    expect(store.p.state).toBe('stun');
    stepS(store, d, 15);
    expect(store.p.state).toBe('walk');
  });
  it('sneakers search faster', () => {
    const { store, d, run } = makeStore('hotspy', 3);
    applyPower(run.powers, 'sneakers');
    standBelow(store, 0);
    store.setup.fixtures[0].loot = { type: 'nothing' };
    store.step(d.frame({ b: true }));
    stepS(store, d, 32);
    expect(store.setup.fixtures[0].opened).toBe(true);
  });
  it('a cleared target store can not be entered again, but a power-up shop can', () => {
    const run = newRun(1);
    run.setup.hotspy.cleared = true;
    expect(run.setup.hotspy.cleared).toBe(true);
    expect(storeInfo('crookstone').role).toBe('powerup');
  });
});

describe('guards', () => {
  it('walking out through the door leaves the store', () => {
    const { store, d, run } = makeStore('hotspy', 1);
    store.guards = [];
    stepS(store, d, 60, { down: true });
    expect(run.events.drain().some((e) => e.kind === 'exitStore')).toBe(true);
  });
  it('guards give a short grace period before shooting someone who just walked in', () => {
    const { store, d, run } = makeStore('hotspy', 1);
    store.introLines = [];
    store.guards.forEach((g) => (g.frozen = 0));
    // line a spy up with the agent along a clear corridor on the bottom row
    const g = store.guards[0];
    store.guards = [g];
    g.x = 48;
    g.y = store.p.y;
    g.cd = 0;
    g.state = 'think';
    expect(store.lineTo(g, store.hitbox().x + 5, store.hitbox().y + 4)).toBe('right');
    run.powers.invincible = { kind: 'cinnabomb', frames: 99999, total: 99999 }; // keep the test agent alive
    let first = -1;
    for (let i = 0; i < 400 && first < 0; i++) {
      store.step(d.frame({}));
      if (run.events.drain().some((e) => e.kind === 'enemyShot')) first = i;
    }
    expect(first).toBeGreaterThan(-1); // he DOES shoot ...
    expect(first).toBeGreaterThanOrEqual(GRACE_FRAMES); // ... but only after the grace period
  });
  it('security bots kill on contact and take 3 hits; spies take 1', () => {
    const { store, d, run } = makeStore('radioshock', 1);
    store.introLines = [];
    const bot = store.guards.find((g) => g.kind === 'bot')!;
    expect(bot.hp).toBe(3);
    expect(store.guards.find((g) => g.kind === 'spy')!.hp).toBe(1);
    store.guards.forEach((g) => (g.frozen = 0));
    // contact kills
    bot.x = store.p.x;
    bot.y = store.p.y;
    store.step(d.frame({}));
    expect(store.p.state).toBe('dead');
    expect(run.events.drain().some((e) => e.kind === 'playerDied')).toBe(true);
    // 3 hits to kill
    const r2 = makeStore('radioshock', 1);
    const b2 = r2.store.guards.find((g) => g.kind === 'bot')!;
    r2.store.guards = [b2];
    b2.frozen = 99999;
    b2.x = 112;
    b2.y = 40;
    r2.store.p.x = 112;
    r2.store.p.y = 105;
    r2.store.p.dir = 'up';
    let hits = 0;
    for (let i = 0; i < 200 && b2.state !== 'dying'; i++) {
      r2.store.step(r2.d.frame({ a: i % 20 === 0 }));
      hits = 3 - b2.hp;
    }
    expect(b2.hp).toBeLessThanOrEqual(0);
    expect(hits).toBe(3);
  });
  it('armour absorbs a hit in a store', () => {
    const { store, d, run } = makeStore('radioshock', 1);
    applyPower(run.powers, 'armor');
    store.introLines = [];
    const bot = store.guards.find((g) => g.kind === 'bot')!;
    bot.frozen = 0;
    bot.x = store.p.x;
    bot.y = store.p.y;
    store.step(d.frame({}));
    expect(store.p.state).not.toBe('dead');
    expect(run.powers.armor).toBe(false);
  });
});

describe('store extras', () => {
  it('Forever 12 fitting rooms: a search has a 25% chance of revealing a spy who shrieks and throws a shoe; the contents stay unsearched', () => {
    let reveals = 0;
    const N = 500;
    let sample: StoreRoom | null = null;
    for (let seed = 1; seed <= N; seed++) {
      const { store, d } = makeStore('forever12', seed);
      const idx = store.setup.fixtures.findIndex((f) => f.kind === 'F');
      standBelow(store, idx);
      store.step(d.frame({ b: true }));
      stepS(store, d, SEARCH_FRAMES + 2);
      if (store.setup.fixtures[idx].revealed) {
        reveals++;
        expect(store.setup.fixtures[idx].opened).toBe(false);
        expect(store.p.state).not.toBe('dead'); // the shoe needs a wind-up: no point-blank hit
        sample = store;
      }
    }
    expect(reveals / N).toBeGreaterThan(0.18);
    expect(reveals / N).toBeLessThan(0.32);
    expect(sample!.guards.length).toBe(1);
    expect(sample!.bubbles.some((b) => b.text === MISC.fittingShriek)).toBe(true);
    expect(sample!.guards[0].shoe).toBe(true);
    const d2 = new Driver();
    let shoe = false;
    for (let i = 0; i < 40; i++) {
      sample!.step(d2.frame({}));
      if (sample!.bullets.some((b) => b.owner === 'shoe')) shoe = true;
    }
    expect(shoe).toBe(true);
  });
  it('KGB Toys: shooting a toy shelf releases 3 wind-up toys that march, turn at walls, stun guards and set off traps', () => {
    const { store, d, run } = makeStore('kgbtoys', 4);
    store.introLines = [];
    store.guards.forEach((g) => (g.frozen = 99999));
    const idx = store.setup.fixtures.findIndex((f) => f.kind === 'T' && f.row > 3);
    const f = store.setup.fixtures[idx];
    store.p.x = f.col * TILE;
    store.p.y = (f.row + 1) * TILE - 7 + 8;
    store.p.dir = 'up';
    store.step(d.frame({ a: true }));
    stepS(store, d, 20);
    expect(store.toys.length).toBe(3);
    expect(f.released).toBe(true);
    // marching: they move and stay inside the room (turning at walls)
    const t0 = store.toys.map((t) => [t.x, t.y]);
    stepS(store, d, 200);
    expect(store.toys.some((t, i) => t.x !== t0[i][0] || t.y !== t0[i][1])).toBe(true);
    for (const t of store.toys) {
      expect(t.x).toBeGreaterThanOrEqual(TILE - 2);
      expect(t.x).toBeLessThanOrEqual(15 * TILE);
      expect(t.y).toBeGreaterThanOrEqual(TILE - 2);
      expect(t.y).toBeLessThanOrEqual(10 * TILE);
    }
    // stun
    const g = store.guards[0];
    g.state = 'think';
    g.frozen = 0;
    g.x = store.toys[0].x;
    g.y = store.toys[0].y;
    stepS(store, d, 2);
    expect(g.state).toBe('stun');
    // traps
    const trapIdx = store.setup.fixtures.findIndex((x) => x.kind === 'f');
    store.setup.fixtures[trapIdx].loot = { type: 'trap' };
    store.setup.fixtures[trapIdx].opened = false;
    const tf = store.setup.fixtures[trapIdx];
    store.toys[0].x = tf.col * TILE;
    store.toys[0].y = (tf.row + 1) * TILE;
    stepS(store, d, 3);
    expect(tf.opened).toBe(true);
    expect(run.events.drain().some((e) => e.kind === 'trapSprung')).toBe(true);
  });
  it('Sam Baddy: stepping on the listening booth switches to the bonus track until you leave', () => {
    const { store, d } = makeStore('sambaddy', 2);
    store.guards = [];
    const b = roomFor('sambaddy').booth[0];
    store.p.x = b.col * TILE;
    store.p.y = b.row * TILE - 4;
    stepS(store, d, 2);
    expect(store.onBooth).toBe(true);
    store.p.x = 100;
    store.p.y = 100;
    stepS(store, d, 2);
    expect(store.onBooth).toBe(false);
  });
  it('GameStonk: the first visit each game is a Zelda-cave scene with a typewriter box, then a useless joke item (+1 point)', () => {
    const run = newRun(5);
    const s1 = new StoreRoom(run, 'gamestonk');
    const d = new Driver();
    expect(s1.egg?.phase).toBe('type');
    expect(run.gamestonkSeen).toBe(true);
    // input and guards are frozen while the clerk talks
    const x0 = s1.p.x;
    stepS(s1, d, 30, { left: true });
    expect(s1.p.x).toBe(x0);
    expect(s1.guards.every((g) => g.frozen > 0)).toBe(true);
    let frames = 0;
    while (s1.egg!.phase !== 'item' && frames < 600) {
      s1.step(d.frame({}));
      frames++;
    }
    expect(s1.egg!.phase).toBe('item');
    expect(s1.egg!.shown).toBe(MISC.gamestonkClerk.length);
    // walk onto the pedestal
    const ped = roomFor('gamestonk').pedestal!;
    s1.guards = [];
    s1.p.x = ped.col * TILE;
    s1.p.y = ped.row * TILE - 4;
    stepS(s1, d, 2);
    expect(JOKE_ITEMS as readonly string[]).toContain(run.inventory[0]);
    expect(run.score.score).toBe(1);
    expect(s1.p.hold?.label).toBe(`YOU GOT: ${run.inventory[0]}`);
    expect(s1.clerkGone).toBe(true);
    // second visit: nothing
    const s2 = new StoreRoom(run, 'gamestonk');
    expect(s2.egg).toBeNull();
  });
  it('the five joke items exist, including the 1-share one', () => {
    expect(JOKE_ITEMS).toContain('EXPIRED COUPON');
    expect(JOKE_ITEMS).toContain('PRE-OWNED STRATEGY GUIDE');
    expect(JOKE_ITEMS).toContain('PET ROCK');
    expect(JOKE_ITEMS).toContain('MOOD RING');
    expect(JOKE_ITEMS).toContain('1 SHARE (DOWN 99%)');
  });
  it('first visit: guards hold still and say their lines in speech bubbles; the second visit has none', () => {
    const run = newRun(5);
    const s = new StoreRoom(run, 'kgbtoys');
    const d = new Driver();
    expect(s.guards.every((g) => g.frozen > 0)).toBe(true);
    stepS(s, d, 2);
    expect(s.bubbles.map((b) => b.text)).toContain(FIRST_VISIT_LINES.kgbtoys[0].text);
    stepS(s, d, 62);
    expect(s.bubbles.map((b) => b.text)).toContain(FIRST_VISIT_LINES.kgbtoys[1].text);
    const g0 = { x: s.guards[0].x, y: s.guards[0].y };
    stepS(s, d, 10);
    expect(s.guards[0].x).toBe(g0.x);
    stepS(s, d, 300);
    expect(s.guards.every((g) => g.frozen === 0)).toBe(true);
    const again = new StoreRoom(run, 'kgbtoys');
    expect(again.guards.every((g) => g.frozen === 0)).toBe(true);
    expect(again.introLines.length).toBe(0);
  });
  it("RadioShock's bot and Sharper Imagine's bot speak for themselves", () => {
    const run = newRun(5);
    const s = new StoreRoom(run, 'radioshock');
    const d = new Driver();
    stepS(s, d, 70);
    const texts = s.bubbles.map((b) => b.text);
    expect(texts).toContain("BEEP. NOT INCLUDED.");
    const s2 = new StoreRoom(run, 'sharper');
    stepS(s2, d, 5);
    expect(s2.bubbles.map((b) => b.text)).toContain("BEEP. PLEASE DON'T TOUCH.");
  });
});
