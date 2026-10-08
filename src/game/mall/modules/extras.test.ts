import { describe, expect, it } from 'vitest';
import { FEATURES, LEVEL_W, floorY } from '../../../content/layout';
import { Btn } from '../../../engine/pad';
import { Rng } from '../../../engine/rng';
import { makeRig, place } from '../testutil';
import { installExtras } from './index';
import { makeXRig, type XRig } from './testrig';

const BUTTONS = [0, Btn.LEFT, Btn.RIGHT, Btn.UP, Btn.DOWN, Btn.A, Btn.B, Btn.LEFT | Btn.B, Btn.RIGHT | Btn.B, Btn.RIGHT | Btn.A, Btn.LEFT | Btn.A, Btn.UP | Btn.A, Btn.DOWN | Btn.A];

/** A compact, comparable picture of everything the extras expose. */
function snapshot(r: XRig): string {
  const x = r.x;
  return JSON.stringify([
    r.w.frame,
    r.run.score,
    r.run.lives,
    [r.w.player.x, r.w.player.y, r.w.player.mode, r.w.player.slide, r.w.player.frozen],
    x.lamps.lamps.map((l) => [l.mode, l.x, l.y]),
    x.lamps.dark,
    x.janitor.janitor,
    x.janitor.patch,
    x.walkers.walkers,
    x.cop.cop,
    x.kiosks.kiosks,
    x.kiosks.panel,
    x.booth.inside,
    x.booth.strip,
    x.fountains.fountains,
    x.fx.items,
    r.w.pickups.map((k) => [k.kind, k.x, k.y]),
  ]);
}

function fuzz(seed: number, frames: number): XRig {
  const r = makeXRig({ seed, floor: 1, x: 200, spies: true });
  r.run.lives = 9999;
  const rng = new Rng(seed * 7919);
  const spots: Array<[number, number]> = [];
  for (const f of FEATURES) if (f.kind === 'kiosk' || f.kind === 'booth' || f.kind === 'fountain') spots.push([f.floor, f.x + f.w / 2 + rng.between(-30, 30)]);
  for (let i = 0; i < frames; i++) {
    if (i % 400 === 0 && r.w.player.mode === 'ground') {
      const [fl, px] = rng.pick(spots);
      place(r, fl, px);
    }
    r.hold(i % 20 === 0 ? rng.pick(BUTTONS) : r.held, 1);
  }
  return r;
}

describe('installing the extras', () => {
  it('registers every module once, is idempotent and exposes the typed state', () => {
    const r = makeRig();
    const before = r.w.modules.length;
    const x = installExtras(r.w);
    expect(r.w.extras).toBe(x);
    expect(x.installed).toBe(true);
    const n = r.w.modules.length;
    expect(n).toBeGreaterThan(before);
    expect(installExtras(r.w)).toBe(x);
    expect(r.w.modules.length).toBe(n);
    expect(x.lamps.lamps.length).toBe(13);
    expect(x.walkers.walkers.length).toBe(2);
    expect(x.kiosks.kiosks.length).toBe(4);
    expect(x.fountains.fountains.length).toBe(2);
    expect(x.cop.cop.mode).toBe('patrol');
    expect(x.janitor.janitor.floor).toBe(4);
  });

  it('is deterministic: same seed and inputs give the same extras, different seeds differ', () => {
    const a = snapshot(fuzz(5, 3000));
    const b = snapshot(fuzz(5, 3000));
    expect(a).toBe(b);
    expect(snapshot(fuzz(6, 3000))).not.toBe(a);
  });

  it('uses its own random streams: the spies behave exactly as without the extras', () => {
    const run = (withExtras: boolean): string => {
      const r = withExtras ? makeXRig({ seed: 42, floor: 1, x: 300, spies: true }) : makeRig({ seed: 42, floor: 1, x: 300 });
      r.w.player.invuln = 99999;
      for (let f = 0; f < 2000; f++) {
        r.hold(f % 90 < 45 ? Btn.RIGHT : Btn.LEFT, 1);
        r.w.bullets.length = 0;
      }
      return JSON.stringify([r.w.player.x, r.w.spies.map((s) => [s.id, Math.round(s.x), s.mode]), r.w.cars.map((c) => c.y)]);
    };
    // The cop / janitor / walkers live on other floors than floor 1 only by chance, but none of them touches spies.
    expect(run(true)).toBe(run(false));
  });

  it('survives long random play near every gadget: no NaN, nobody leaves the mall, slides and freezes always end', () => {
    for (const seed of [1, 2, 3]) {
      const r = makeXRig({ seed, floor: 1, x: 200, spies: true });
      r.run.lives = 9999;
      const rng = new Rng(seed * 104729);
      const spots: Array<[number, number]> = [];
      for (const f of FEATURES) if (f.kind === 'kiosk' || f.kind === 'booth' || f.kind === 'fountain') spots.push([f.floor, f.x + f.w / 2 + rng.between(-30, 30)]);
      spots.push([4, 250]);
      let slideFrames = 0;
      let freezeMax = 0;
      for (let i = 0; i < 20000; i++) {
        if (i % 300 === 0 && r.w.player.mode === 'ground') {
          const [fl, px] = rng.pick(spots);
          place(r, fl, px);
          if (fl === 4 && i % 600 === 0) r.x.janitor.patch = { x: 250, t: 600 };
        }
        r.hold(i % 15 === 0 ? rng.pick(BUTTONS) : r.held, 1);
        const p = r.w.player;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(LEVEL_W);
        freezeMax = Math.max(freezeMax, p.frozen);
        if (p.mode === 'ground' && p.slide !== 0) {
          slideFrames++;
          expect(r.x.janitor.patch).not.toBeNull();
          expect(r.x.janitor.onPatch(p.x)).toBe(true);
        }
        for (const k of r.x.walkers.walkers) expect(Number.isFinite(k.x)).toBe(true);
        expect(Number.isFinite(r.x.cop.cop.x)).toBe(true);
        expect(Number.isFinite(r.x.janitor.janitor.x)).toBe(true);
        for (const l of r.x.lamps.lamps) expect(Number.isFinite(l.x) && Number.isFinite(l.y)).toBe(true);
        for (const k of r.w.pickups) expect(Number.isFinite(k.x) && Number.isFinite(k.y)).toBe(true);
      }
      expect(freezeMax).toBeLessThanOrEqual(180);
      expect(slideFrames).toBeGreaterThan(0);
      expect(floorY(1)).toBe(160);
    }
  });
});
