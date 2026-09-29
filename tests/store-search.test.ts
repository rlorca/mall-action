import { describe, expect, it } from 'vitest';
import { newProgress, applyPowerup, tickPower } from '../src/game/progress';
import { MISC, POWERUP_NAMES } from '../src/data/copy';
import { canEnterStore, createStore, SEARCH_FRAMES, type StoreWorld } from '../src/game/store';
import { make, placeAdjacent, placeBelow, reachableBelow } from './store-helpers';

/** Find a seed where the given store has a fixture (reachable from a neighbour) with content matching pred. */
function findWorld(id: 'forever12' | 'crookstone' | 'hotspy' | 'kgbtoys', pred: (w: StoreWorld, i: number) => boolean, opts?: { bf?: boolean }) {
  for (let seed = 1; seed < 300; seed++) {
    const p = newProgress(seed, opts?.bf ?? false);
    p.visited.push(id); // skip first-visit script
    const m = make(id, seed, p);
    for (let i = 0; i < m.w.fixtures.length; i++) {
      if (pred(m.w, i) && placeAdjacent(m.w, i)) return { ...m, i };
    }
  }
  throw new Error('no world found');
}

describe('searching', () => {
  it('a single tap of B starts a search that completes by itself in ~45 frames', () => {
    const { w, d } = make('crookstone', 5);
    const i = reachableBelow(w);
    placeBelow(w, i);
    d.step({}, 2);
    expect(w.strip.mode).toBe('ready');
    d.step({ b: true }); // press
    expect(w.search).not.toBeNull();
    expect(w.player.anim).toBe('search');
    d.step({}, 20);
    expect(w.search!.progress).toBeGreaterThan(0.3);
    expect(w.fixtures[i].open).toBe(false);
    d.step({}, SEARCH_FRAMES);
    expect(w.fixtures[i].open).toBe(true);
    expect(w.search).toBeNull();
    expect(w.progress.opened.crookstone).toContain(i);
  });

  it('bottom strip: store name always; PRESS X TO SEARCH only when possible; SEARCHING... with bar', () => {
    const { w, d } = make('crookstone', 5);
    d.step({}, 2);
    expect(w.strip.title).toBe('CROOKSTONE');
    expect(w.strip.text).toBe('');
    const i = reachableBelow(w);
    placeBelow(w, i);
    d.step({}, 1);
    expect(w.strip.text).toBe(MISC.pressSearch);
    d.tap('b');
    d.step({}, 5);
    expect(w.strip.text).toBe(MISC.searching);
    expect(w.strip.bar).toBeGreaterThan(0);
  });

  it('holding B after a search does not start the next fixture (fresh press needed)', () => {
    const { w, d } = make('crookstone', 5);
    w.guards = []; // keep the agent alive
    // between S(2,2) and T(4,2): (3,3) touches both diagonally
    w.player.x = 48;
    w.player.y = 48;
    w.player.facing = 'up';
    d.step({}, 1);
    expect(w.findCandidate()).toBeGreaterThanOrEqual(0);
    d.step({ b: true }, 300); // hold B the whole time
    expect(w.fixtures.filter((f) => f.open).length).toBe(1);
    // a fresh press does open the second one
    d.step({}, 100); // wait out any hold pose
    d.step({ b: true }, 1);
    d.step({}, SEARCH_FRAMES + 2);
    expect(w.fixtures.filter((f) => f.open).length).toBe(2);
  });

  it('a fixture touched at a diagonal gap (and with a small gap) works', () => {
    const { w, d } = make('crookstone', 5);
    w.player.x = 48;
    w.player.y = 48;
    d.step({}, 1);
    expect(w.findCandidate()).toBeGreaterThanOrEqual(0);
    const { w: w2, d: d2 } = make('crookstone', 5);
    const i = reachableBelow(w2);
    placeBelow(w2, i);
    w2.player.y += 3; // 3px gap
    d2.step({}, 1);
    expect(w2.findCandidate()).toBe(i);
    d2.tap('b');
    d2.step({}, SEARCH_FRAMES + 2);
    expect(w2.fixtures[i].open).toBe(true);
  });

  it('fixtures behind the agent or far away are not searchable', () => {
    const { w, d } = make('crookstone', 5);
    const i = reachableBelow(w);
    placeBelow(w, i);
    w.player.facing = 'down'; // fixture now directly behind
    d.step({}, 1);
    expect(w.findCandidate()).toBe(-1);
    w.player.x = 8 * 16;
    w.player.y = 9 * 16;
    d.step({}, 1);
    expect(w.findCandidate()).toBe(-1);
    d.tap('b');
    expect(w.search).toBeNull();
  });

  it('the agent turns to face the fixture', () => {
    const { w, d } = make('crookstone', 5);
    const i = reachableBelow(w);
    placeBelow(w, i);
    w.player.facing = 'left'; // fixture is at his side (above)
    d.step({}, 1);
    d.tap('b');
    expect(w.player.facing).toBe('up');
  });

  it('holding a direction into the fixture does not cancel; a FRESH direction press does', () => {
    const { w, d } = make('crookstone', 5);
    const i = reachableBelow(w);
    placeBelow(w, i);
    d.step({ up: true }, 1);
    d.step({ up: true, b: true }, 1);
    d.step({ up: true }, 10);
    expect(w.search).not.toBeNull();
    const y0 = w.player.y;
    d.step({ up: true, left: true }, 1); // fresh left press
    expect(w.search).toBeNull();
    expect(w.fixtures[i].open).toBe(false);
    expect(w.player.y).toBeLessThanOrEqual(y0);
    d.step({}, 100);
    expect(w.fixtures[i].open).toBe(false);
  });

  it('shooting cancels a search', () => {
    const { w, d } = make('crookstone', 5);
    const i = reachableBelow(w);
    placeBelow(w, i);
    d.step({}, 1);
    d.tap('b');
    d.step({}, 10);
    expect(w.search).not.toBeNull();
    d.tap('a');
    expect(w.search).toBeNull();
    expect(w.bullets.length + d.sink.sfxCount('shot')).toBeGreaterThan(0);
    d.step({}, 100);
    expect(w.fixtures[i].open).toBe(false);
  });

  it('sneakers make searching faster', () => {
    const { w, d, p } = make('crookstone', 5);
    applyPowerup(p, 'sneakers');
    const i = reachableBelow(w);
    placeBelow(w, i);
    d.step({}, 1);
    d.tap('b');
    expect(w.search!.dur).toBeLessThan(SEARCH_FRAMES);
  });

  it('package: held overhead, fanfare + jingle, banner, +500, store cleared, cannot re-enter', () => {
    const { w, d, p, i } = findWorld('hotspy', (ww, k) => ww.debugContent(k).kind === 'package');
    d.step({}, 1);
    d.tap('b');
    d.step({}, SEARCH_FRAMES + 2);
    expect(w.fixtures[i].open).toBe(true);
    expect(w.player.anim).toBe('hold');
    expect(w.player.held?.kind).toBe('package');
    expect(d.sink.sfxCount('fanfare')).toBe(1);
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'jingle:package')).toBe(true);
    expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === MISC.packageGot(1))).toBe(true);
    expect(p.score).toBe(500);
    expect(p.packages).toEqual(['hotspy']);
    expect(w.cleared).toBe(true);
    expect(canEnterStore(p, 'hotspy')).toBe(false);
    const again = createStore({ id: 'hotspy', seed: 1, progress: p });
    expect(again.exited).toBe(true);
    expect(again.refused).toBe(true);
    // hold ends, store music resumes
    d.sink.drain?.call(d.sink);
    d.step({}, 130);
    expect(w.player.anim).not.toBe('hold');
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'store:hotspy')).toBe(true);
  });

  it('power-up: held overhead with its name as banner, applied, +50', () => {
    const { w, d, p, i } = findWorld('crookstone', (ww, k) => ww.debugContent(k).kind === 'powerup');
    const c = w.debugContent(i);
    d.step({}, 1);
    d.tap('b');
    d.step({}, SEARCH_FRAMES + 2);
    expect(c.kind).toBe('powerup');
    if (c.kind === 'powerup') {
      expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === POWERUP_NAMES[c.power])).toBe(true);
      expect(w.player.held?.name).toBe(c.power);
    }
    expect(p.score).toBe(50);
    expect(w.player.anim).toBe('hold');
    expect(d.sink.sfxCount('powerup')).toBe(1);
  });

  it('trap: smoke puff, banner, stun 60 frames, smoke sfx', () => {
    const { w, d, i } = findWorld('forever12', (ww, k) => ww.debugContent(k).kind === 'trap' && ww.fixtures[k].kind !== 'fitting');
    d.step({}, 1);
    d.tap('b');
    d.step({}, SEARCH_FRAMES + 2);
    expect(w.fixtures[i].open).toBe(true);
    expect(w.puffs.length).toBeGreaterThan(0);
    expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === MISC.trap)).toBe(true);
    expect(d.sink.sfxCount('smoke')).toBe(1);
    expect(w.player.stun).toBeGreaterThan(40);
    const y = w.player.y;
    d.step({ down: true }, 30);
    expect(w.player.y).toBe(y); // stunned
    d.step({}, 40);
    expect(w.player.stun).toBe(0);
  });

  it('nothing: puff + NOTHING HERE', () => {
    const { w, d, i } = findWorld('forever12', (ww, k) => ww.debugContent(k).kind === 'nothing' && ww.fixtures[k].kind !== 'fitting');
    d.step({}, 1);
    d.tap('b');
    d.step({}, SEARCH_FRAMES + 2);
    expect(w.fixtures[i].open).toBe(true);
    expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === MISC.nothing)).toBe(true);
    expect(w.puffs.length).toBeGreaterThan(0);
  });

  it('Black Friday: searching any non-package fixture gives a power-up', () => {
    const { w, d, i } = findWorld('crookstone', () => true, { bf: true });
    expect(w.debugContent(i).kind).toBe('powerup');
  });

  it('re-entry keeps opened fixtures and the identical layout', () => {
    const { w, d, p, i } = findWorld('hotspy', (ww, k) => ww.debugContent(k).kind !== 'package');
    d.step({}, 1);
    d.tap('b');
    d.step({}, SEARCH_FRAMES + 2);
    expect(w.fixtures[i].open).toBe(true);
    const contents = w.fixtures.map((_, k) => w.debugContent(k));
    const w2 = createStore({ id: 'hotspy', seed: 777, progress: p });
    expect(w2.fixtures[i].open).toBe(true);
    expect(w2.fixtures.filter((f) => f.open).length).toBe(1);
    expect(w2.fixtures.map((_, k) => w2.debugContent(k))).toEqual(contents);
    expect(w2.guards.length).toBeGreaterThan(0); // guards come back
    // opened fixture cannot be searched again
    placeBelow(w2, i);
    expect(w2.findCandidate()).not.toBe(i);
  });

  it('radar marks unopened package fixtures only', () => {
    const { w, d, p } = make('hotspy', 3);
    expect(w.fixtures.some((f) => f.mark)).toBe(false);
    p.power.radar = true;
    d.step({}, 1);
    const marked = w.fixtures.filter((f) => f.mark);
    expect(marked.length).toBe(1);
    expect(w.debugContent(marked[0].index).kind).toBe('package');
    expect(marked[0].content).toBeNull(); // content itself stays hidden
  });

  it('power-up timers are not touched by the store (Session ticks them)', () => {
    const { w, d, p } = make('crookstone', 5);
    applyPowerup(p, 'rapid');
    const total = p.power.weapon!.total;
    d.step({}, 200);
    expect(p.power.weapon!.frames).toBe(total);
    for (let i = 0; i < 200; i++) tickPower(p);
    expect(p.power.weapon!.frames).toBe(total - 200);
    expect(p.levelFrames).toBe(0);
  });
});
