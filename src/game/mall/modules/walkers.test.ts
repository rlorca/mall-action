import { describe, expect, it } from 'vitest';
import { floorY } from '../../../content/layout';
import { SHOUTS } from '../../../content/copy';
import { Btn } from '../../../engine/pad';
import { POINTS } from '../../run';
import { shaftNear } from '../geometry';
import { newSpy } from '../spies';
import { place } from '../testutil';
import { WALKER_DEFS, WALKER_FLOOR } from './walkers';
import { calmJanitor, makeXRig, parkCop, parkWalkers, type XRig } from './testrig';

const F = WALKER_FLOOR; // 2F

function rig(x = 250): XRig {
  const r = makeXRig({ floor: F, x });
  parkCop(r, 1, 60);
  calmJanitor(r);
  parkWalkers(r, 300, 500);
  r.run.score = 1000;
  return r;
}

function standingSpy(r: XRig, x: number) {
  const s = newSpy(r.w, x, F, 'walk');
  s.fireCd = 99999;
  s.wanderT = 99999;
  s.wanderDir = 0;
  r.w.spies.push(s);
  return s;
}

describe('mall walkers (2F)', () => {
  it('there are two, on 2F, with different speeds and stretches clear of every shaft opening', () => {
    const r = makeXRig();
    expect(r.x.walkers.walkers.length).toBe(2);
    expect(r.x.walkers.walkers.every((k) => k.floor === F)).toBe(true);
    expect(WALKER_DEFS[0]!.speed).not.toBe(WALKER_DEFS[1]!.speed);
    expect(WALKER_DEFS[0]!.max - WALKER_DEFS[0]!.min).not.toBe(WALKER_DEFS[1]!.max - WALKER_DEFS[1]!.min);
    for (const d of WALKER_DEFS) {
      for (let x = d.min; x <= d.max; x += 1) expect(shaftNear(x, F, 7)).toBeNull();
    }
  });

  it('they power-walk back and forth over a long time, staying in their stretches and off the shafts', () => {
    const r = makeXRig({ floor: 0, x: 100 });
    parkCop(r, 1, 60);
    const travelled = [0, 0];
    const last = r.x.walkers.walkers.map((k) => k.x);
    const dirs = new Set<string>();
    for (let f = 0; f < 6000; f++) {
      r.hold(0, 1);
      r.x.walkers.walkers.forEach((k, i) => {
        expect(k.x).toBeGreaterThanOrEqual(k.min);
        expect(k.x).toBeLessThanOrEqual(k.max);
        expect(shaftNear(k.x, F, 6)).toBeNull();
        travelled[i]! += Math.abs(k.x - last[i]!);
        dirs.add(`${i}:${k.face}`);
        last[i] = k.x;
      });
    }
    expect(travelled[0]!).toBeGreaterThan(1500);
    expect(travelled[1]!).toBeGreaterThan(travelled[0]!); // the second one is faster
    expect(dirs.size).toBe(4); // both turned around at least once
  });

  it('they block the agent\'s bullets from the left, so a spy behind them is safe', () => {
    const r = rig(250);
    const s = standingSpy(r, 340);
    r.hold(Btn.A, 1);
    r.hold(0, 40);
    expect(s.mode).not.toBe('dying');
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(0);
    // control: without the walker the same shot kills the spy
    const c = makeXRig({ floor: F, x: 250 });
    parkCop(c, 1, 60);
    parkWalkers(c, 700, 720);
    const s2 = newSpy(c.w, 340, F, 'walk');
    s2.fireCd = 99999;
    s2.volleyT = 999;
    c.w.spies.push(s2);
    c.hold(Btn.A, 1);
    c.hold(0, 40);
    expect(s2.mode).toBe('dying');
  });

  it('they block bullets from the right too', () => {
    const r = rig(360);
    const s = standingSpy(r, 250);
    r.w.player.face = -1;
    r.hold(Btn.LEFT, 1);
    r.w.player.x = 360;
    r.hold(Btn.A, 1);
    r.hold(0, 40);
    expect(s.mode).not.toBe('dying');
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(0);
  });

  it('they stop the spies\' bullets as well, at no cost to the agent', () => {
    const r = rig(250);
    r.run.score = 1000;
    r.w.bullets.push({ x: 340, y: floorY(F) - 16, vx: -2, vy: 0, owner: 'spy', age: 0 });
    r.w.bullets.push({ x: 260, y: floorY(F) - 16, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 60);
    expect(r.causes).toEqual([]);
    expect(r.w.bullets.length).toBe(0);
    expect(r.run.score).toBe(1000);
    expect(r.w.bubbles.some((b) => b.text === SHOUTS.walker)).toBe(false);
  });

  it('shooting one costs 200 points and shows a HEY! bubble; they never die', () => {
    expect(POINTS.walkerShot).toBe(-200);
    const r = rig(250);
    r.sfx.length = 0;
    r.hold(Btn.A, 1);
    r.hold(0, 40);
    expect(r.run.score).toBe(800);
    expect(r.w.bubbles.some((b) => b.text === 'HEY!')).toBe(true);
    expect(r.x.walkers.walkers.length).toBe(2);
    // keep shooting him: still there, just poorer
    for (let i = 0; i < 6; i++) {
      r.hold(Btn.A, 20);
      r.hold(0, 20);
    }
    expect(r.x.walkers.walkers.length).toBe(2);
    expect(r.run.score).toBeLessThan(800);
    expect(r.run.score).toBeGreaterThanOrEqual(0);
  });

  it('the score never goes below zero', () => {
    const r = rig(250);
    r.run.score = 100;
    r.hold(Btn.A, 1);
    r.hold(0, 40);
    expect(r.run.score).toBe(0);
  });

  it('touching one only pushes the agent along; nobody dies', () => {
    const r = makeXRig({ floor: F, x: 470 });
    parkCop(r, 1, 60);
    calmJanitor(r);
    const [, b] = r.x.walkers.walkers;
    b!.x = 500;
    b!.face = -1; // coming toward the agent
    r.w.player.invuln = 0;
    const x0 = r.w.player.x;
    r.hold(Btn.RIGHT, 70);
    expect(r.w.player.x).toBeLessThan(x0); // pushed back although he is walking right
    expect(r.w.player.x).toBeCloseTo(b!.x - 11, 3);
    expect(r.causes).toEqual([]);
    expect(r.w.player.mode).toBe('ground');
  });

  it('he can get past by jumping over a walker', () => {
    const r = rig(284);
    r.hold(Btn.RIGHT | Btn.B, 1);
    for (let i = 0; i < 40; i++) r.hold(Btn.RIGHT, 1);
    expect(r.w.player.x).toBeGreaterThanOrEqual(311);
  });

  it('they are never in the way on other floors', () => {
    const r = makeXRig({ floor: 1, x: 300 });
    parkCop(r, 4, 60);
    parkWalkers(r, 300, 500);
    r.hold(Btn.RIGHT, 20);
    expect(r.w.player.x).toBe(320);
  });
});
