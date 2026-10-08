import { describe, expect, it } from 'vitest';
import { Btn } from '../../engine/pad';
import { SHAFTS, floorY } from '../../content/layout';
import { PA_LINES } from '../../content/copy';
import { makeRig, place, setCar, type Rig } from './testutil';
import { AIM_FRAMES, DODGE_CHANCE, FIRST_SHOT_DELAY, newSpy } from './spies';
import { difficulty } from '../difficulty';

const A = SHAFTS[0]!;

function spawn(r: Rig, x: number, floor: number, mode: 'walk' | 'emerge' = 'walk') {
  const s = newSpy(r.w, x, floor, mode);
  r.w.spies.push(s);
  return s;
}

/** Make the agent immortal for scenario tests that observe the spies. */
function immortal(r: Rig): void {
  r.w.player.invuln = 99999;
}

describe('spy shooting fairness', () => {
  it('the first shot comes no sooner than ~2 s after a spy appears', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = makeRig({ seed, floor: 1, x: 300 });
      immortal(r);
      r.w.nextSpy = 1e9;
      const s = spawn(r, 380, 1);
      let firstShot = -1;
      for (let f = 1; f <= 400 && firstShot < 0; f++) {
        r.hold(0, 1);
        if (r.w.bullets.some((b) => b.owner === 'spy')) firstShot = f;
      }
      expect(firstShot).toBeGreaterThanOrEqual(FIRST_SHOT_DELAY);
      expect(s.age).toBeGreaterThan(0);
    }
  });
  it('shows a clear aiming pose for about half a second before each shot', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    r.w.nextSpy = 1e9;
    const s = spawn(r, 380, 1);
    let aimStart = -1;
    let shotAt = -1;
    for (let f = 1; f < 500 && shotAt < 0; f++) {
      r.hold(0, 1);
      if (s.mode === 'aim' && aimStart < 0) aimStart = f;
      if (r.w.bullets.some((b) => b.owner === 'spy') && shotAt < 0) shotAt = f;
    }
    expect(aimStart).toBeGreaterThan(0);
    expect(shotAt - aimStart).toBeGreaterThanOrEqual(AIM_FRAMES - 1);
    expect(shotAt - aimStart).toBeLessThanOrEqual(AIM_FRAMES + 2);
  });
  it('after the first shot a spy fires about every 2.5 s on loop 1 and never more than once a second', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    r.w.nextSpy = 1e9; // only the one spy
    spawn(r, 380, 1);
    const shots: number[] = [];
    let seen = 0;
    for (let f = 1; f < 1500; f++) {
      r.hold(0, 1);
      const n = r.sfx.filter((x) => x === 'enemyShot').length;
      if (n > seen) {
        shots.push(f);
        seen = n;
      }
      r.w.bullets.length = 0;
    }
    expect(shots.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]! - shots[i - 1]!).toBeGreaterThanOrEqual(60);
      expect(shots[i]! - shots[i - 1]!).toBeLessThan(260);
    }
    expect(difficulty(1).shotInterval).toBe(150);
    expect(difficulty(50).shotInterval).toBeGreaterThanOrEqual(60);
  });
  it('spy bullets are slower (2 px/frame) than the agent\'s (4 px/frame)', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    spawn(r, 380, 1);
    for (let f = 0; f < 300 && !r.w.bullets.some((b) => b.owner === 'spy'); f++) r.hold(0, 1);
    const b = r.w.bullets.find((k) => k.owner === 'spy')!;
    expect(Math.abs(b.vx)).toBe(2);
  });
  it('a spy dodges an incoming volley with ~10% chance; most straight shots land', () => {
    expect(DODGE_CHANCE).toBe(0.1);
    let ducked = 0;
    let survived = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const r = makeRig({ seed, floor: 1, x: 300 });
      immortal(r);
      const s = spawn(r, 360, 1);
      s.fireCd = 99999; // do not shoot back
      r.hold(Btn.A, 1);
      let didDuck = false;
      for (let f = 0; f < 60; f++) {
        r.hold(0, 1);
        if (s.mode === 'duck') didDuck = true;
        if (s.mode === 'dying') break;
      }
      if (didDuck) ducked++;
      if (s.mode !== 'dying' && !r.w.spies.every((k) => k.mode === 'dying') && r.w.spies.includes(s)) survived++;
    }
    const rate = ducked / N;
    expect(rate).toBeGreaterThan(0.04);
    expect(rate).toBeLessThan(0.17);
    expect(survived / N).toBeLessThan(0.2);
  });
  it('a spy hit by a straight shot dies, scores 100, and the death animation lasts ~0.4 s', () => {
    const r = makeRig({ floor: 1, x: 300 });
    const s = spawn(r, 360, 1);
    s.fireCd = 99999;
    // Make sure it cannot dodge: no roll
    s.volleyT = 999;
    r.hold(Btn.A, 1);
    for (let f = 0; f < 40 && s.mode !== 'dying'; f++) r.hold(0, 1);
    expect(s.mode).toBe('dying');
    expect(r.run.score).toBe(100);
    let frames = 0;
    while (r.w.spies.includes(s) && frames < 100) {
      r.hold(0, 1);
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(20);
    expect(frames).toBeLessThanOrEqual(30);
  });
  it('spies ignore a hidden agent', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    const s = spawn(r, 340, 1);
    r.w.hidePlayer(600);
    for (let f = 0; f < 300; f++) r.hold(0, 1);
    expect(r.w.bullets.some((b) => b.owner === 'spy')).toBe(false);
    expect(s.mode).not.toBe('aim');
  });
  it('a spy never walks into a pit', () => {
    const r = makeRig({ floor: 1, x: 100 });
    immortal(r);
    setCar(r, 'A', 3); // A's 4F opening is a deep pit
    const s = spawn(r, A.x - 10, 1);
    s.fireCd = 99999;
    for (let f = 0; f < 3000; f++) {
      r.w.player.x = 40; // far enough that he wanders rather than approaches
      r.hold(0, 1);
      if (!r.w.spies.includes(s)) break;
      expect(s.x < A.x + 4 || s.x > A.x + A.w - 4).toBe(true);
    }
  });
  it('a car coming down onto a spy waiting on its grate crushes him for 300 points', () => {
    const r = makeRig({ floor: 1, x: 100 });
    immortal(r);
    setCar(r, 'A', 0);
    const s = spawn(r, A.x + 12, 1);
    s.fireCd = 99999;
    s.mode = 'wait'; // waiting in the shaft opening, as spies do
    r.w.car('A').goal = floorY(1);
    for (let f = 0; f < 80; f++) r.hold(0, 1);
    expect(s.killedBy).toBe('crush');
    expect(r.run.score).toBe(300);
  });
  it('touching a spy kills the agent; Cinnabomb kills the spy instead', () => {
    const r = makeRig({ floor: 1, x: 300 });
    spawn(r, 304, 1);
    r.hold(0, 4);
    expect(r.causes).toEqual(['touch']);
    const r2 = makeRig({ floor: 1, x: 300 });
    r2.run.givePower('cinnabomb');
    const s = spawn(r2, 304, 1);
    r2.hold(0, 4);
    expect(r2.causes).toEqual([]);
    expect(s.killedBy).toBe('cinna');
  });
});

describe('spy spawning', () => {
  it('the first spy appears about 5 s into the level, from a store door 64-200 px away', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    let first = -1;
    for (let f = 1; f < 1200 && first < 0; f++) {
      r.hold(0, 1);
      if (r.w.spies.length > 0) first = f;
    }
    expect(first).toBeGreaterThanOrEqual(295);
    expect(first).toBeLessThanOrEqual(420);
    const s = r.w.spies[0]!;
    const d = Math.abs(s.x - 300);
    expect(d).toBeGreaterThanOrEqual(64);
    expect(d).toBeLessThanOrEqual(200);
  });
  it('never more than 4 on screen (8 in Black Friday)', () => {
    const r = makeRig({ floor: 1, x: 300 });
    immortal(r);
    let max = 0;
    for (let f = 0; f < 6000; f++) {
      r.hold(0, 1);
      r.w.bullets.length = 0;
      max = Math.max(max, r.w.liveSpies());
    }
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThanOrEqual(2);
  });
  it('spawns only from open stores: cleared targets and closed shops never release spies', () => {
    const r = makeRig({ floor: 3, x: 200 });
    immortal(r);
    for (const s of Object.values(r.run.level.stores)) s!.packageTaken = true;
    // 2F stores: sambaddy (cleared), sharper (power-up shop: open), hotspy (cleared), circuitpity (closed)
    const froms = new Set<string>();
    for (let f = 0; f < 4000; f++) {
      r.hold(0, 1);
      r.w.bullets.length = 0;
      for (const s of r.w.spies) if (s.emergeFrom) froms.add(s.emergeFrom);
    }
    for (const id of froms) expect(['sharper', 'gamestonk', 'crookstone', 'spenders']).toContain(id);
  });
  it('later loops spawn spies more often, and the alarm makes them faster', () => {
    const count = (loop: number): number => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const r = makeRig({ seed, floor: 1, x: 300, loop });
        immortal(r);
        const seen = new Set<number>();
        for (let f = 0; f < 6000; f++) {
          r.hold(0, 1);
          r.w.bullets.length = 0;
          for (const s of r.w.spies) {
            if (s.mode === 'walk') s.fireCd = 9999;
            if (!seen.has(s.id)) seen.add(s.id);
          }
          // kill them as they appear so the cap never limits the count
          for (const s of r.w.spies) if (s.mode === 'walk' || s.mode === 'emerge') s.mode = 'dying';
        }
        total += seen.size;
      }
      return total;
    };
    expect(count(4)).toBeGreaterThan(count(1));
    const r = makeRig();
    const base = r.w.spySpeed();
    r.run.alarmOn = true;
    expect(r.w.spySpeed() / base).toBeCloseTo(1.25, 5);
    expect(difficulty(2).spySpeed / difficulty(1).spySpeed).toBeCloseTo(1.1, 5);
  });
  it('the alarm goes off after ~150 s on loop 1 (sooner on later loops)', () => {
    const r = makeRig();
    r.run.levelFrames = 150 * 60 - 1;
    r.hold(0, 1);
    expect(r.run.alarmOn).toBe(false);
    r.run.levelFrames = 150 * 60;
    r.hold(0, 1);
    expect(r.run.alarmOn).toBe(true);
    expect(r.w.banner?.text).toBe('ALARM! SECURITY ALERTED');
    expect(r.w.music()).toBe('alarm');
    const r3 = makeRig({ loop: 3 });
    expect(r3.w.diff.alarmFrames).toBe(110 * 60);
  });
  it('the mall PA announces about once a minute and never the same line twice in a row', () => {
    const r = makeRig();
    immortal(r);
    const seen: string[] = [];
    let last = '';
    for (let f = 0; f < 60 * 60 * 8; f++) {
      r.hold(0, 1);
      r.w.spies.length = 0;
      const b = r.w.banner;
      if (b && b.t === b.total - 1 && b.total === 240) {
        const text = [b.text, ...(b.lines ?? [])].join(' ');
        seen.push(text);
        expect(text).not.toBe(last);
        last = text;
      }
    }
    expect(seen.length).toBeGreaterThanOrEqual(6);
    expect(seen.length).toBeLessThanOrEqual(10);
    for (const t of seen) expect(PA_LINES).toContain(t);
  });
  it('determinism: same seed and inputs give the same world', () => {
    const run = (): string => {
      const r = makeRig({ seed: 42, floor: 1, x: 300 });
      immortal(r);
      for (let f = 0; f < 2000; f++) {
        r.hold(f % 90 < 45 ? Btn.RIGHT : Btn.LEFT, 1);
        r.w.bullets.length = 0;
      }
      return JSON.stringify([r.w.player.x, r.w.spies.map((s) => [s.id, Math.round(s.x), s.mode]), r.w.cars.map((c) => c.y)]);
    };
    expect(run()).toBe(run());
  });
});
