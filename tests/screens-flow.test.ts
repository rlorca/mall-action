import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { newProgress, timeBonus } from '../src/game/progress';
import { HEADLINES, LIMITS, SPYGRAM_COMPLETE, SPYGRAM_ARRIVAL, MISC } from '../src/data/copy';
import { ContinueState, drawContinue } from '../src/screens/continue';
import { GameOverState, drawGameOver, SHUTTERS_END, GAMEOVER_FRAMES } from '../src/screens/gameover';
import { LevelClearState, drawLevelClear, PHASE_FRAMES, RECEIPT_SHOUT } from '../src/screens/levelclear';
import { drawSpygramCard, likesAt, SPYGRAM_CARD_W } from '../src/screens/spygram';
import { drawMap, inventoryLines } from '../src/screens/map';
import { drawPause } from '../src/screens/pause';
import { createMall } from '../src/game/mall';
import { Driver, RecSurface, asSurface } from './screens-helpers';

function inBounds(r: RecSurface): void {
  // tiny-font texts include scrolling storefront signs that are legitimately clipped at the screen edge
  for (const x of r.texts.filter((q) => !q.small)) {
    expect(x.left, x.str).toBeGreaterThanOrEqual(0);
    expect(x.right, x.str).toBeLessThanOrEqual(256);
  }
  expect(r.clipDepth).toBe(0);
}

describe('continue', () => {
  it('counts 9 -> 0 in 540 frames with one beep per second', () => {
    const c = new ContinueState(newProgress(1));
    const d = new Driver();
    expect(c.count).toBe(9);
    d.run(c, 59);
    expect(c.count).toBe(9);
    d.run(c, 1);
    expect(c.count).toBe(8);
    d.run(c, 479);
    expect(c.expired).toBe(false);
    d.run(c, 1);
    expect(c.count).toBe(0);
    expect(c.expired).toBe(true);
    expect(c.accepted).toBe(false);
    expect(d.buf.sfxCount('beep')).toBe(9);
    d.run(c, 100);
    expect(d.buf.sfxCount('beep')).toBe(9);
  });
  it('Start accepts and stops the countdown', () => {
    const c = new ContinueState(newProgress(1));
    const d = new Driver();
    d.run(c, 100);
    d.tap(c, 'start');
    expect(c.accepted).toBe(true);
    const n = c.count;
    d.run(c, 200);
    expect(c.count).toBe(n);
    expect(c.expired).toBe(false);
  });
  it('shows continues left and draws in bounds', () => {
    const p = newProgress(1);
    p.continuesLeft = 2;
    const c = new ContinueState(p);
    new Driver().run(c, 200);
    const r = new RecSurface();
    drawContinue(asSurface(r), c);
    expect(r.strings).toContain(MISC.continuesLeft(2));
    inBounds(r);
  });
});

describe('game over', () => {
  it('phases and durations', () => {
    const g = new GameOverState(500, 900);
    const d = new Driver();
    expect(g.hiScore).toBe(900);
    d.run(g, 1);
    expect(d.buf.sfxCount('chime')).toBe(1);
    expect(g.phase).toBe('pa');
    d.run(g, 70);
    expect(g.phase).toBe('shutters');
    expect(g.shutterProgress(0)).toBeGreaterThan(0);
    d.run(g, SHUTTERS_END - g.frame - 1);
    expect(g.phase).toBe('shutters');
    d.run(g, 1);
    expect(g.phase).toBe('gameover');
    expect(d.buf.has((e) => e.t === 'music' && e.name === 'jingle:gameover')).toBe(true);
    d.run(g, GAMEOVER_FRAMES - 1);
    expect(g.done).toBe(false);
    d.run(g, 1);
    expect(g.done).toBe(true);
    // typewriter: a blip per non-space character
    const chars = (MISC.gameOverPA[0] + MISC.gameOverPA[1]).replace(/ /g, '').length;
    expect(d.buf.sfxCount('blip')).toBe(chars);
  });
  it('Start skips to game over, then finishes (after the guard)', () => {
    const g = new GameOverState(1000, 200);
    expect(g.hiScore).toBe(1000);
    const d = new Driver();
    d.run(g, 10);
    d.tap(g, 'start');
    expect(g.phase).toBe('gameover');
    d.tap(g, 'start');
    expect(g.done).toBe(false);
    d.run(g, 40);
    d.tap(g, 'start');
    expect(g.done).toBe(true);
  });
  it('draws every phase in bounds', () => {
    const g = new GameOverState(1, 2);
    const d = new Driver();
    for (let i = 0; i < 6; i++) {
      d.run(g, 60);
      const r = new RecSurface();
      drawGameOver(asSurface(r), g);
      inBounds(r);
    }
    const r = new RecSurface();
    drawGameOver(asSurface(r), g);
    expect(r.strings.join('|')).toContain('SCORE');
  });
});

describe('level clear', () => {
  it('phase order, exactly-once scoring, done', () => {
    const p = newProgress(1);
    p.packages = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'];
    p.levelFrames = 60 * 100;
    p.score = 1000;
    const lc = new LevelClearState(p, new Rng(5));
    const d = new Driver();
    const bonus = timeBonus(6000) + 1000;
    expect(lc.tally.timeBonus).toBe(timeBonus(6000));
    expect(lc.tally.clearBonus).toBe(1000);
    expect(lc.tally.packages).toBe(6);
    expect(lc.tally.loop).toBe(1);
    d.run(lc, 1);
    expect(d.buf.has((e) => e.t === 'music' && e.name === 'jingle:levelclear')).toBe(true);
    expect(lc.phase).toBe('drive');
    expect(p.score).toBe(1000);
    const order: string[] = [lc.phase];
    for (let i = 0; i < 2000 && !lc.done; i++) {
      d.run(lc, 1);
      if (order[order.length - 1] !== lc.phase) order.push(lc.phase);
    }
    expect(order).toEqual(['drive', 'tally', 'news', 'spygram']);
    expect(lc.done).toBe(true);
    expect(p.score).toBe(1000 + bonus);
    d.run(lc, 100);
    d.tap(lc, 'start');
    expect(p.score).toBe(1000 + bonus);
    expect(lc.frame).toBeLessThan(PHASE_FRAMES.drive + PHASE_FRAMES.tally + PHASE_FRAMES.news + PHASE_FRAMES.spygram + 5);
  });
  it('Start skips one phase at a time; skipping the tally keeps the score exactly once', () => {
    const p = newProgress(2);
    p.levelFrames = 0;
    const lc = new LevelClearState(p, new Rng(9), { push() {} });
    const d = new Driver();
    d.run(lc, 10);
    d.tap(lc, 'start');
    expect(lc.phase).toBe('tally');
    expect(p.score).toBe(3000 + 1000);
    d.tap(lc, 'start');
    expect(lc.phase).toBe('news');
    d.tap(lc, 'start');
    expect(lc.phase).toBe('spygram');
    d.tap(lc, 'start');
    expect(lc.done).toBe(true);
    expect(p.score).toBe(4000);
  });
  it('is deterministic per rng and picks valid indices', () => {
    const a = new LevelClearState(newProgress(1), new Rng(77));
    const b = new LevelClearState(newProgress(1), new Rng(77));
    expect(a.headlineIndex).toBe(b.headlineIndex);
    expect(a.spygramIndex).toBe(b.spygramIndex);
    expect(a.headlineIndex).toBeLessThan(HEADLINES.length);
    expect(a.spygramIndex).toBeLessThan(SPYGRAM_COMPLETE.length);
  });
  it('every headline / spygram draws within bounds and limits', () => {
    expect(RECEIPT_SHOUT.length).toBeLessThanOrEqual(LIMITS.bubble);
    for (let seed = 0; seed < 40; seed++) {
      const lc = new LevelClearState(newProgress(1), new Rng(seed));
      const d = new Driver();
      for (const phase of ['drive', 'tally', 'news', 'spygram']) {
        while (lc.phase !== phase) d.tap(lc, 'start');
        d.run(lc, 100);
        const r = new RecSurface();
        drawLevelClear(asSurface(r), lc);
        inBounds(r);
        if (phase === 'news') for (const l of HEADLINES[lc.headlineIndex]) expect(l.length).toBeLessThanOrEqual(LIMITS.headline);
      }
    }
  });
});

describe('spygram card', () => {
  it('likesAt starts at 0, is monotonic and climbs fast', () => {
    for (const seed of [0, 7, 12345]) {
      let prev = -1;
      for (let f = 0; f < 600; f++) {
        const v = likesAt(f, seed);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
      expect(likesAt(0, seed)).toBe(0);
      expect(likesAt(90, seed)).toBeGreaterThan(100);
    }
  });
  it('all posts draw inside the card width', () => {
    for (const e of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      const r = new RecSurface();
      drawSpygramCard(asSurface(r), e, { x: 10, y: 20, frames: 120 });
      for (const t of r.texts) {
        expect(t.left, t.str).toBeGreaterThanOrEqual(10);
        expect(t.right, t.str).toBeLessThanOrEqual(10 + SPYGRAM_CARD_W);
      }
      expect(r.strings).toContain(e.caption[0]);
      expect(r.clipDepth).toBe(0);
    }
  });
});

describe('map and pause', () => {
  it('draws with and without radar / in store, in bounds; inventory fits', () => {
    const p = newProgress(1);
    p.inventory = ['PET ROCK', 'EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'MOOD RING', '1 SHARE (DOWN 99%)'];
    p.photoStrip = true;
    for (const l of inventoryLines(p)) expect(l.length).toBeLessThanOrEqual(30);
    expect(inventoryLines(p).length).toBeLessThanOrEqual(2);
    expect(inventoryLines(newProgress(1))).toEqual(['ITEMS: NONE']);
    const snap = createMall({ seed: 1, progress: p, skipArrival: true }).mapSnapshot();
    for (const [radar, inStore] of [[false, null], [true, null], [true, 'kgbtoys']] as const) {
      p.power.radar = radar;
      const r = new RecSurface();
      drawMap(asSurface(r), snap, { progress: p, inStore, tick: 3 });
      inBounds(r);
      expect(r.strings).toContain('MALL DIRECTORY');
      expect(r.strings).toContain('SELECT: CLOSE');
      expect(r.strings.includes('! = PACKAGE (RADAR)')).toBe(radar);
    }
  });
  it('pause dims with alpha ~0.6', () => {
    const r = new RecSurface();
    drawPause(asSurface(r), 0);
    expect(r.alphaCalls[0]).toBeCloseTo(0.6);
    expect(r.alphaCalls[r.alphaCalls.length - 1]).toBe(1);
    expect(r.strings).toContain('PAUSE');
    inBounds(r);
  });
});
