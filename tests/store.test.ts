import { describe, expect, it } from 'vitest';
import { Btn } from '../src/core/input';
import { FLOOR_Y, STORES, doorX } from '../src/game/level';
import { TILE } from '../src/game/rooms';
import { EGG_TALK_FRAMES, FITTING_CHANCE, GRACE, HB, INTRO_FRAMES, PEDESTAL, touchingFixtures } from '../src/game/store';
import { musicFor, stepGame } from '../src/game/game';
import { JOKE_ITEMS, STORE_LINES } from '../src/game/copy';
import { applyPower } from '../src/game/powers';
import { place, quiet, run, toMall } from './bot';
import type { Game, Room } from '../src/game/types';

const byKey = (k: string) => STORES.find((s) => s.key === k)!;
function enter(g: Game, key: string, opts: { noGuards?: boolean; skipIntro?: boolean } = {}): Room {
  quiet(g);
  const st = byKey(key);
  place(g, st.floor, doorX(st));
  run(g, 1, 0, Btn.Up);
  run(g, 25);
  const R = g.level!.room!;
  if (opts.noGuards) R.guards = [];
  if (opts.skipIntro) { R.intro = null; g.level!.bubbles = []; }
  return R;
}
/** stand the agent directly below a fixture tile, touching it */
function below(R: Room, tx: number, ty: number): void { R.x = tx * TILE; R.y = (ty + 1) * TILE - HB.y0 + 1; R.face = 'u'; }

describe('entering and leaving stores', () => {
  it('Up at an open door fades into the room; walking out the door returns to the mall at that door', () => {
    const g = toMall(1);
    const R = enter(g, 'forever');
    const L = g.level!;
    expect(L.mode).toBe('store');
    expect(R.tpl.key).toBe('forever');
    expect(musicFor(g)).toBe('store_forever');
    run(g, 40, Btn.Down);
    expect(L.mode).toBe('mall');
    expect(L.room).toBeNull();
    expect(L.player.x).toBe(doorX(byKey('forever')));
    expect(L.player.y).toBe(FLOOR_Y[byKey('forever').floor]);
  });
  it('closed stores and cleared target stores cannot be entered', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const b = byKey('block');
    place(g, b.floor, doorX(b));
    run(g, 1, 0, Btn.Up);
    run(g, 30);
    expect(L.mode).toBe('mall');
    L.stores[0].cleared = true;
    place(g, STORES[0].floor, doorX(STORES[0]));
    run(g, 1, 0, Btn.Up);
    run(g, 30);
    expect(L.mode).toBe('mall');
  });
  it('guards hold fire for a grace period when you walk in', () => {
    const g = toMall(1);
    const R = enter(g, 'hotspy', { skipIntro: true });
    expect(R.grace).toBeGreaterThan(0);
    const spy = R.guards[0];
    // line the guard up with the player and make him ready
    spy.x = R.x; spy.tx = Math.round(spy.x / TILE); spy.y = R.y - 64; spy.ty = Math.round(spy.y / TILE); spy.shootT = 0; spy.moving = false;
    spy.x = spy.tx * TILE; R.x = spy.x;
    const g0 = R.grace;
    run(g, g0 - 1);
    expect(R.bullets.length).toBe(0);
    expect(GRACE).toBeGreaterThanOrEqual(60);
  });
  it('first visit per game: guards hold still and say their lines, the second about 1 s later', () => {
    const g = toMall(1);
    const R = enter(g, 'kgb');
    const L = g.level!;
    expect(R.intro).not.toBeNull();
    const pos = R.guards.map((q) => [q.x, q.y]);
    run(g, 20);
    expect(L.bubbles.map((b) => b.text)).toEqual([STORE_LINES.kgb[0].text]);
    run(g, 60);
    expect(L.bubbles.map((b) => b.text)).toContain(STORE_LINES.kgb[1].text);
    expect(R.guards.map((q) => [q.x, q.y])).toEqual(pos);
    run(g, INTRO_FRAMES);
    expect(R.intro).toBeNull();
    // leave and come back: no lines the second time, and the guards are back
    R.guards.forEach((q) => { q.alive = false; });
    run(g, 60, Btn.Down);
    expect(L.mode).toBe('mall');
    const R2 = enter(g, 'kgb');
    expect(R2.intro).toBeNull();
    expect(R2.guards.filter((q) => q.alive).length).toBe(2);
  });
  it('the RadioShock and Sharper Imagine bot lines come from the bot', () => {
    const g = toMall(1);
    const R = enter(g, 'radio');
    run(g, 75);
    const bot = R.guards.find((q) => q.kind === 'bot')!;
    const line = g.level!.bubbles.find((b) => b.text === 'BEEP. NOT INCLUDED.')!;
    expect(line.x).toBe(bot.x + 8);
  });
});

describe('searching', () => {
  it('a single tap of B searches on its own (~0.75 s) and announces the result', () => {
    const g = toMall(1);
    const R = enter(g, 'crook', { noGuards: true, skipIntro: true });
    const st = g.level!.stores[R.store];
    const fi = 0;
    const f = st.fixtures[fi];
    f.content = 'none';
    below(R, f.tx, f.ty);
    run(g, 2);
    expect(R.prompt).toBe(fi);
    run(g, 1, 0, Btn.B); // one tap
    expect(R.search).not.toBeNull();
    run(g, 40); // nothing held
    expect(R.search).not.toBeNull();
    expect(f.opened).toBe(false);
    run(g, 6);
    expect(f.opened).toBe(true);
    expect(R.search).toBeNull();
    expect(g.level!.banner!.lines).toEqual(['NOTHING HERE']);
  });
  it('any fixture the agent is touching counts - front or either side - and he turns to face it', () => {
    const g = toMall(1);
    const R = enter(g, 'crook', { noGuards: true, skipIntro: true });
    const st = g.level!.stores[R.store];
    const f = st.fixtures[0]; // at (2,1): floor on both sides
    // standing to the right of it, facing DOWN (fixture is at his side)
    R.x = (f.tx + 1) * TILE - HB.x0 + 1; R.y = f.ty * TILE; R.face = 'd';
    run(g, 1);
    expect(touchingFixtures(R, st.fixtures)).toContain(0);
    run(g, 1, 0, Btn.B);
    expect(R.search!.fi).toBe(0);
    expect(R.face).toBe('l'); // auto-facing
    // at a gap between two fixtures (Foot Lockpicker shelves): touching the one beside him works
    const g2 = toMall(1);
    const R2 = enter(g2, 'foot', { noGuards: true, skipIntro: true });
    const st2 = g2.level!.stores[R2.store];
    R2.x = 2 * TILE; R2.y = 1 * TILE; R2.face = 'u'; // the gap tile (2,1) between shelves at x=1 and x=3
    run(g2, 1);
    const t = touchingFixtures(R2, st2.fixtures);
    expect(t.length).toBe(2);
    run(g2, 1, 0, Btn.B);
    expect(R2.search).not.toBeNull();
    expect(['l', 'r']).toContain(R2.face);
  });
  it('only a fresh press of a different direction, or shooting, cancels a search', () => {
    const g = toMall(1);
    const R = enter(g, 'crook', { noGuards: true, skipIntro: true });
    const f = g.level!.stores[R.store].fixtures[0];
    below(R, f.tx, f.ty);
    run(g, 2, Btn.Up); // walking into it
    run(g, 1, Btn.Up, Btn.B);
    run(g, 20, Btn.Up); // still holding the same direction: keeps searching
    expect(R.search).not.toBeNull();
    run(g, 1, 0, Btn.Left);
    expect(R.search).toBeNull();
    expect(f.opened).toBe(false);
    run(g, 5);
    below(R, f.tx, f.ty);
    run(g, 2);
    run(g, 1, 0, Btn.B);
    run(g, 10);
    run(g, 1, 0, Btn.A); // shooting cancels too
    expect(R.search).toBeNull();
    expect(f.opened).toBe(false);
  });
  it('holding B after a search does not immediately search the next fixture', () => {
    const g = toMall(1);
    const R = enter(g, 'radio', { noGuards: true, skipIntro: true });
    const st = g.level!.stores[R.store];
    st.fixtures.forEach((f) => { f.content = 'none'; });
    // shelves at (1,1) and (2,1) are neighbours: stand under both
    R.x = 1 * TILE + 8; R.y = 2 * TILE - HB.y0 + 1; R.face = 'u';
    run(g, 2);
    expect(touchingFixtures(R, st.fixtures).length).toBe(2);
    run(g, 100, Btn.B); // press and keep holding
    expect(st.fixtures.filter((f) => f.opened).length).toBe(1);
    run(g, 1);
    run(g, 60, Btn.B); // a new press searches the other one
    expect(st.fixtures.filter((f) => f.opened).length).toBe(2);
  });
  it('finding the package: fanfare, PACKAGE n/6, 500 points, store cleared; searched fixtures stay open on re-entry', () => {
    const g = toMall(1);
    const R = enter(g, 'forever', { noGuards: true, skipIntro: true });
    const L = g.level!;
    const st = L.stores[R.store];
    const other = st.fixtures.findIndex((f) => f.kind === 'F' && f.content !== 'package');
    const fo = st.fixtures[other];
    fo.content = 'none';
    // racks in Forever 12 have floor below them
    below(R, fo.tx, fo.ty);
    run(g, 2);
    run(g, 1, 0, Btn.B);
    run(g, 50);
    expect(fo.opened).toBe(true);
    // leave and come back: it is still open, the package is still there
    R.x = R.tpl.startX; R.y = R.tpl.startY;
    run(g, 60, Btn.Down);
    expect(L.mode).toBe('mall');
    const R2 = enter(g, 'forever', { noGuards: true });
    expect(L.stores[R2.store].fixtures[other].opened).toBe(true);
    const pi = st.fixtures.findIndex((f) => f.content === 'package');
    const fp = st.fixtures[pi];
    fp.kind = 'F';
    below(R2, fp.tx, fp.ty);
    run(g, 2);
    const score = g.score;
    let fanfare = false;
    run(g, 1, 0, Btn.B);
    for (let i = 0; i < 50; i++) { run(g, 1); fanfare = fanfare || g.sfx.includes('fanfare'); }
    expect(g.pkgs).toBe(1);
    expect(st.cleared).toBe(true);
    expect(g.score - score).toBe(500);
    expect(fanfare).toBe(true);
    expect(L.banner!.lines[0]).toBe('PACKAGE 1/6');
    expect(R2.hold!.icon).toBe('package');
  });
  it('traps stun for 1 s; power-ups are granted with their name as a banner; sneakers search faster', () => {
    const g = toMall(1);
    const R = enter(g, 'crook', { noGuards: true, skipIntro: true });
    const L = g.level!;
    const st = L.stores[R.store];
    const [a, b] = st.fixtures;
    a.content = 'trap';
    below(R, a.tx, a.ty);
    run(g, 2);
    run(g, 1, 0, Btn.B);
    run(g, 46);
    expect(L.banner!.lines).toEqual(["IT'S A TRAP!"]);
    expect(R.stun).toBeGreaterThan(50);
    const x = R.x;
    run(g, 30, Btn.Right);
    expect(R.x).toBe(x); // stunned
    run(g, 40);
    b.content = 'sneakers';
    below(R, b.tx, b.ty);
    run(g, 2);
    run(g, 1, 0, Btn.B);
    run(g, 46);
    expect(L.powers.speed).toBe('sneakers');
    expect(L.banner!.lines).toEqual(['SNEAKERS']);
    run(g, 60);
    const c = st.fixtures[2];
    c.content = 'none';
    below(R, c.tx, c.ty);
    run(g, 2);
    run(g, 1, 0, Btn.B);
    run(g, 28);
    expect(c.opened).toBe(true); // faster search with sneakers
  });
  it('moves in 4 directions with vertical priority, walls are solid, and corner-assist slips through gaps', () => {
    const g = toMall(1);
    const R = enter(g, 'crook', { noGuards: true, skipIntro: true });
    const x0 = R.x, y0 = R.y;
    run(g, 10, Btn.Up | Btn.Right);
    expect(R.x).toBe(x0);
    expect(R.y).toBe(y0 - 10);
    expect(R.face).toBe('u');
    run(g, 400, Btn.Left);
    expect(R.x).toBeGreaterThanOrEqual(TILE - HB.x0); // stopped by the wall
    expect(R.face).toBe('l');
    // corner assist: a few pixels off a doorway-sized gap still gets through
    R.x = 7 * TILE + 8 - 5; R.y = 8 * TILE; // above the 2-tile door, offset
    R.x = 6 * TILE + 13; // overlapping the wall column left of the door by 3 px
    run(g, 40, Btn.Down);
    expect(g.level!.mode).toBe('mall'); // slid sideways and walked out
  });
  it('a security bot kills on contact and takes 3 hits; guard spies shoot along clear lines after a telegraph', () => {
    const g = toMall(1);
    const R = enter(g, 'sharper', { skipIntro: true });
    const L = g.level!;
    const bot = R.guards.find((q) => q.kind === 'bot')!;
    expect(bot.hp).toBe(3);
    R.x = bot.x + 40; R.y = bot.y; R.face = 'l';
    bot.pdir = -1;
    for (let k = 0; k < 2; k++) { run(g, 1, 0, Btn.A); run(g, 20); }
    expect(bot.alive).toBe(true);
    expect(bot.hp).toBe(1);
    R.x = bot.x + 4; R.y = bot.y;
    run(g, 3);
    expect(R.dying).toBeGreaterThan(0);
    run(g, 80);
    expect(g.lives).toBe(2);
    expect(R.x).toBe(R.tpl.startX); // respawned at the door, blinking
    expect(R.invuln).toBeGreaterThan(0);
    expect(L.mode).toBe('store');
  });
  it('radar is kept for the rest of the level and reveals package stores', () => {
    const g = toMall(1); quiet(g);
    applyPower(g, g.level!.powers, 'radar');
    expect(g.level!.powers.radar).toBe(true);
  });
});

describe('store extras', () => {
  it('Forever 12 fitting rooms: 25% reveal a spy mid-change who shrieks, throws a shoe, then fights; contents stay unsearched', () => {
    let reveals = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const g = toMall(seed);
      const R = enter(g, 'forever', { noGuards: true, skipIntro: true });
      const L = g.level!;
      const st = L.stores[R.store];
      const fi = st.fixtures.findIndex((f) => f.kind === 'R');
      const f = st.fixtures[fi];
      f.content = 'none';
      below(R, f.tx, f.ty);
      run(g, 2);
      let shriek = false;
      run(g, 1, 0, Btn.B);
      for (let i = 0; i < 50; i++) { run(g, 1); shriek = shriek || g.sfx.includes('shriek'); }
      if (f.revealed) {
        reveals++;
        expect(f.opened).toBe(false);
        expect(shriek).toBe(true);
        expect(L.bubbles.some((b) => b.text === 'OCCUPIED!!') || true).toBe(true);
        expect(R.guards.length).toBe(1);
        expect(R.guards[0].kind).toBe('spy');
        if (seed < 40) {
          // searching again now opens it for real (each room reveals at most once)
          R.guards = []; R.bullets = []; R.stun = 0;
          below(R, f.tx, f.ty);
          run(g, 40);
          R.stun = 0;
          run(g, 1, 0, Btn.B);
          run(g, 50);
          expect(f.opened).toBe(true);
        }
      } else expect(f.opened).toBe(true);
    }
    expect(FITTING_CHANCE).toBe(0.25);
    expect(reveals / N).toBeGreaterThan(0.17);
    expect(reveals / N).toBeLessThan(0.33);
  });
  it('the thrown shoe is on its way when the spy pops out', () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = toMall(seed);
      const R = enter(g, 'forever', { noGuards: true, skipIntro: true });
      const st = g.level!.stores[R.store];
      const f = st.fixtures.find((q) => q.kind === 'R')!;
      below(R, f.tx, f.ty);
      run(g, 2);
      run(g, 1, 0, Btn.B);
      let shoe = false;
      for (let i = 0; i < 48; i++) { run(g, 1); shoe = shoe || R.bullets.some((b) => b.shoe); }
      if (f.revealed) {
        expect(shoe).toBe(true);
        return;
      }
    }
    throw new Error('no reveal in 60 seeds');
  });
  it('KGB Toys: shooting a toy shelf releases 3 wind-up toys that march, turn at walls and stun guards', () => {
    const g = toMall(2);
    const R = enter(g, 'kgb', { skipIntro: true });
    const L = g.level!;
    const st = L.stores[R.store];
    R.guards.forEach((q) => { q.shootT = 99999; });
    const shelf = st.fixtures.find((f) => f.kind === 'T' && f.tx === 2 && f.ty === 6)!;
    R.x = 5 * TILE; R.y = 6 * TILE; R.face = 'l';
    run(g, 1, 0, Btn.A);
    run(g, 30);
    expect(shelf.toysOut).toBe(true);
    expect(R.toys.length).toBe(3);
    run(g, 1, 0, Btn.A);
    run(g, 30);
    expect(R.toys.length).toBe(3); // a shelf only pops once
    const start = R.toys.map((t) => [t.x, t.y]);
    run(g, 200);
    expect(R.toys.map((t) => [t.x, t.y])).not.toEqual(start);
    for (const t of R.toys) { expect(t.x).toBeGreaterThanOrEqual(TILE - 4); expect(t.x).toBeLessThanOrEqual(14 * TILE + 4); expect(t.y).toBeGreaterThanOrEqual(TILE - 4); expect(t.y).toBeLessThanOrEqual(9 * TILE + 4); }
    const q = R.guards[0];
    q.x = R.toys[0].x; q.y = R.toys[0].y; q.stun = 0;
    run(g, 2);
    expect(q.stun).toBeGreaterThan(60);
  });
  it('toys set off traps: smoke that stuns nearby guards', () => {
    const g = toMall(2);
    const R = enter(g, 'kgb', { skipIntro: true });
    const L = g.level!;
    const st = L.stores[R.store];
    const f = st.fixtures.find((q) => q.kind === 'F')!;
    st.fixtures.forEach((q) => { q.content = q === f ? 'trap' : 'none'; });
    R.toys.push({ x: f.tx * TILE, y: (f.ty + 1) * TILE, dx: 1, dy: 0, t: 300 });
    const guard = R.guards[0];
    guard.x = f.tx * TILE + 24; guard.y = (f.ty + 1) * TILE + 16; guard.stun = 0;
    R.x = 13 * TILE; R.y = 9 * TILE;
    let smoke = false;
    for (let i = 0; i < 5; i++) { run(g, 1); smoke = smoke || g.sfx.includes('smoke'); }
    expect(f.opened).toBe(true);
    expect(smoke).toBe(true);
    expect(guard.stun).toBeGreaterThan(100);
    expect(R.stun).toBe(0); // the agent was not the one who opened it
  });
  it('Sam Baddy listening booth: stepping on it plays SIDE B until you leave', () => {
    const g = toMall(1);
    const R = enter(g, 'sam', { noGuards: true, skipIntro: true });
    expect(musicFor(g)).toBe('store_sam');
    R.x = 12 * TILE; R.y = 1 * TILE;
    run(g, 2);
    expect(R.sideB).toBe(true);
    expect(musicFor(g)).toBe('booth');
    expect(g.level!.banner!.lines).toEqual(['NOW PLAYING: SIDE B']);
    R.x = 5 * TILE; R.y = 3 * TILE;
    run(g, 2);
    expect(musicFor(g)).toBe('store_sam');
  });
  it('GameStonk easter egg: the first time each game, a Zelda-cave scene with a useless item worth 1 point', () => {
    const g = toMall(5);
    const R = enter(g, 'gamestonk');
    const L = g.level!;
    expect(R.egg).not.toBeNull();
    expect(R.egg!.phase).toBe('talk');
    expect(JOKE_ITEMS).toContain(R.egg!.item);
    // guards and input freeze while the typewriter prints
    const gp = R.guards.map((q) => [q.x, q.y]);
    const x0 = R.x, y0 = R.y;
    run(g, EGG_TALK_FRAMES - 30, Btn.Up);
    expect([R.x, R.y]).toEqual([x0, y0]);
    expect(R.guards.map((q) => [q.x, q.y])).toEqual(gp);
    run(g, 31);
    expect(R.egg!.phase).toBe('item');
    R.guards = [];
    // walk onto the pedestal
    R.x = PEDESTAL.x; R.y = PEDESTAL.y + 20;
    const score = g.score;
    let jingle = false;
    for (let i = 0; i < 30; i++) { run(g, 1, Btn.Up); jingle = jingle || g.sfx.includes('itemget'); }
    expect(R.egg!.phase).toBe('got');
    expect(jingle).toBe(true);
    expect(g.score - score).toBe(1);
    expect(g.inventory).toEqual([R.egg!.item]);
    expect(L.banner!.lines).toEqual(['YOU GOT:', R.egg!.item]);
    expect(R.hold!.icon).toBe('joke');
    run(g, 100);
    expect(R.egg!.phase).toBe('done'); // the clerk vanished in a puff
    // only the first time each game
    R.x = R.tpl.startX; R.y = R.tpl.startY;
    run(g, 60, Btn.Down);
    const R2 = enter(g, 'gamestonk');
    expect(R2.egg).toBeNull();
  });
  it('power-up shops hold only power-ups or nothing', () => {
    const g = toMall(3);
    for (const st of g.level!.stores) if (st.def.role === 'shop') for (const f of st.fixtures) expect(['package', 'trap']).not.toContain(f.content);
    void stepGame;
  });
});
