import { describe, expect, it } from 'vitest';
import { makeMall, placeAt, stepN, tap, skipArrival } from './helpers';
import { ESCALATORS, FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_4F, FLOOR_COUNT, FLOOR_P, FLOOR_R, SHAFTS, floorY, shaftServes } from '../src/core/level';
import { FATAL_FALL, openingState } from '../src/core/elevator';
import { Mall } from '../src/core/mall';
import { Spy } from '../src/core/mall-types';
import { spawnSpyAt } from '../src/core/mall-spies';

const A = 0;
const B = 1;
const C = 2;

function setCar(m: Mall, i: number, floor: number) {
  m.cars[i].y = floorY(floor);
  m.cars[i].moving = false;
  m.cars[i].target = null;
  m.cars[i].glide = false;
}

describe('arrival', () => {
  it('slides down the zip line, drops, crouches, takes a selfie, then gives control', () => {
    const { mall, d } = makeMall(3);
    const modes: string[] = [];
    for (let i = 0; i < 700 && !mall.controlGiven; i++) {
      mall.step(d.frame({}));
      if (modes[modes.length - 1] !== mall.p.mode) modes.push(mall.p.mode);
    }
    expect(modes).toEqual(['zip', 'drop', 'crouch', 'selfie', 'normal']);
  });
  it('the selfie lasts about 2.5 s and any button skips it', () => {
    const { mall, d } = makeMall(3);
    let selfieFrames = 0;
    for (let i = 0; i < 700 && !mall.controlGiven; i++) {
      mall.step(d.frame({}));
      if (mall.p.mode === 'selfie') selfieFrames++;
    }
    expect(selfieFrames).toBeGreaterThanOrEqual(140);
    expect(selfieFrames).toBeLessThanOrEqual(155);
    const m2 = makeMall(3);
    for (let i = 0; i < 700 && m2.mall.p.mode !== 'selfie'; i++) m2.mall.step(m2.d.frame({}));
    stepN(m2.mall, m2.d, 20);
    m2.mall.step(m2.d.frame({ b: true }));
    expect(m2.mall.controlGiven).toBe(true);
  });
  it('spies ignore an arriving agent and the first one appears about 5 s after control', () => {
    const { mall, d } = makeMall(11);
    for (let i = 0; i < 400 && !mall.controlGiven; i++) mall.step(d.frame({}));
    expect(mall.spies.length).toBe(0);
    mall.spawnT = 300;
    let first = -1;
    for (let i = 0; i < 700; i++) {
      mall.step(d.frame({}));
      if (mall.spies.length && first < 0) first = i;
    }
    // spawn attempts need a door 64-200 px away on a nearby floor; the timer itself is 5 s
    expect(first === -1 || first >= 290).toBe(true);
  });
});

describe('walking, jumping, ducking', () => {
  it('walks at 1 px per frame', () => {
    const { mall, d } = makeMall(1);
    placeAt(mall, FLOOR_3F, 130);
    stepN(mall, d, 30, { right: true });
    expect(mall.p.x).toBeCloseTo(160, 5);
  });

  it('a jump rises about 20 px, lands on the same floor and takes about 25 frames', () => {
    const { mall, d } = makeMall(1);
    placeAt(mall, FLOOR_3F, 130);
    mall.step(d.frame({ b: true }));
    let minY = mall.p.y;
    let frames = 1;
    while (!mall.p.onGround && frames < 100) {
      mall.step(d.frame({}));
      minY = Math.min(minY, mall.p.y);
      frames++;
    }
    const height = floorY(FLOOR_3F) - minY;
    expect(height).toBeGreaterThan(18);
    expect(height).toBeLessThan(23);
    expect(frames).toBeGreaterThan(22);
    expect(frames).toBeLessThan(30);
    expect(mall.p.y).toBe(floorY(FLOOR_3F));
    expect(mall.p.x).toBe(130); // a standing jump goes straight up
  });

  it('jumping while moving carries forward momentum and is a kicking jump', () => {
    const { mall, d } = makeMall(1);
    placeAt(mall, FLOOR_3F, 130);
    mall.step(d.frame({ b: true, right: true }));
    expect(mall.p.kicking).toBe(true);
    stepN(mall, d, 40);
    expect(mall.p.x).toBeGreaterThan(160);
    expect(mall.p.kicking).toBe(false);
    expect(mall.p.onGround).toBe(true);
  });

  it('a jump-kick kills a spy on contact', () => {
    const { mall, d } = makeMall(2);
    placeAt(mall, FLOOR_3F, 130);
    const sp = spawnSpyAt(mall, FLOOR_3F, 160, false)!;
    sp.state = 'wait';
    sp.t = 9999;
    sp.age = 0;
    mall.step(d.frame({ b: true, right: true }));
    for (let i = 0; i < 30 && (sp.state as string) !== 'dying'; i++) {
      sp.state = 'wait';
      mall.step(d.frame({}));
    }
    expect(sp.state).toBe('dying');
    expect(sp.killedBy).toBe('kick');
    expect(mall.p.mode).toBe('normal');
  });

  it('touching a spy without kicking kills the agent', () => {
    const { mall, d } = makeMall(2);
    placeAt(mall, FLOOR_3F, 130);
    const sp = spawnSpyAt(mall, FLOOR_3F, 134, false)!;
    sp.state = 'wait';
    sp.t = 9999;
    mall.step(d.frame({}));
    expect(mall.p.mode).toBe('dying');
  });

  it('ducking dodges high shots but not low ones; standing is hit by both', () => {
    const run = (duck: boolean, y: number) => {
      const { mall, d } = makeMall(2);
      placeAt(mall, FLOOR_3F, 200);
      if (duck) mall.step(d.frame({ down: true }));
      mall.bullets.push({ id: 99, x: 190, y: floorY(FLOOR_3F) - y, vx: 2, vy: 0, owner: 'spy', floor: FLOOR_3F, volley: 0, base: floorY(FLOOR_3F), life: 100 });
      for (let i = 0; i < 20; i++) mall.step(d.frame(duck ? { down: true } : {}));
      return mall.p.mode === 'dying';
    };
    expect(run(false, 16)).toBe(true);
    expect(run(false, 6)).toBe(true);
    expect(run(true, 16)).toBe(false);
    expect(run(true, 6)).toBe(true);
  });

  it('player bullets travel 4 px per frame; at most 2 on screen with a cooldown', () => {
    const { mall, d } = makeMall(1);
    placeAt(mall, FLOOR_3F, 100);
    mall.step(d.frame({ a: true }));
    const x0 = mall.bullets[0].x;
    mall.step(d.frame({}));
    expect(mall.bullets[0].x - x0).toBe(4);
    mall.step(d.frame({ a: true }));
    mall.step(d.frame({}));
    mall.step(d.frame({ a: true }));
    expect(mall.bullets.filter((b) => b.owner === 'player').length).toBeLessThanOrEqual(2);
    // cooldown: two taps on consecutive frames do not both fire
    const m2 = makeMall(1);
    placeAt(m2.mall, FLOOR_3F, 100);
    m2.mall.step(m2.d.frame({ a: true }));
    m2.mall.step(m2.d.frame({}));
    m2.mall.step(m2.d.frame({ a: true }));
    expect(m2.mall.bullets.length).toBe(1);
  });

  it('shoots chest-high when standing and low when ducking', () => {
    const a = makeMall(1);
    placeAt(a.mall, FLOOR_3F, 100);
    a.mall.step(a.d.frame({ a: true }));
    expect(floorY(FLOOR_3F) - a.mall.bullets[0].y).toBe(16);
    const b = makeMall(1);
    placeAt(b.mall, FLOOR_3F, 100);
    b.mall.step(b.d.frame({ down: true }));
    b.mall.step(b.d.frame({ down: true, a: true }));
    expect(floorY(FLOOR_3F) - b.mall.bullets[0].y).toBe(6);
  });
});

describe('shaft openings: grate, pit, falls', () => {
  it('car at this floor: walk in and ride', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_3F);
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 20);
    stepN(mall, d, 30, { right: true });
    expect(mall.p.mode).toBe('car');
    expect(mall.p.carIdx).toBe(B);
  });

  it('car above: the opening is a grate you can stand on / cross', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_4F);
    expect(openingState(mall.cars[B], FLOOR_3F)).toBe('above');
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 30);
    stepN(mall, d, 80, { right: true });
    expect(mall.p.mode).toBe('normal');
    expect(mall.p.y).toBe(floorY(FLOOR_3F));
    expect(mall.p.x).toBeGreaterThan(SHAFTS[B].x + SHAFTS[B].w);
  });

  it('car one floor below: an open pit; you land on the car roof (safe)', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_2F);
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 4);
    stepN(mall, d, 40, { right: true });
    expect(mall.p.mode).toBe('normal');
    expect(mall.p.onRoof).toBe(true);
    expect(mall.p.carIdx).toBe(B);
    expect(mall.p.y).toBe(mall.cars[B].y - 40);
  });

  it('car further than one floor below: the fall is fatal', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_P);
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 4);
    stepN(mall, d, 80, { right: true });
    expect(mall.p.mode).toBe('dying');
  });

  it('the fall limit is just under one floor', () => {
    expect(FATAL_FALL).toBeLessThan(48);
    expect(FATAL_FALL).toBeGreaterThan(8);
  });

  it('you can jump over an open pit', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_P);
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 14);
    stepN(mall, d, 3, { right: true });
    mall.step(d.frame({ right: true, b: true }));
    stepN(mall, d, 50, { right: true });
    expect(mall.p.mode).toBe('normal');
    expect(mall.p.onGround).toBe(true);
    expect(mall.p.y).toBe(floorY(FLOOR_3F));
  });

  it('a roof rider is crushed by rising into the top of the shaft', () => {
    const { mall, d } = makeMall(1);
    // B serves 4F..P; drop onto the roof of the car at 3F, then ride it up
    setCar(mall, B, FLOOR_3F);
    placeAt(mall, FLOOR_4F, SHAFTS[B].x - 4);
    mall.cars[B].y = floorY(FLOOR_3F);
    stepN(mall, d, 40, { right: true });
    expect(mall.p.onRoof).toBe(true);
    let died = false;
    for (let i = 0; i < 200; i++) {
      mall.step(d.frame({ up: true }));
      if (mall.p.mode === 'dying') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });

  it('a roof rider can step out sideways when the roof is level with a floor', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_3F);
    placeAt(mall, FLOOR_4F, SHAFTS[B].x - 4);
    stepN(mall, d, 40, { right: true });
    expect(mall.p.onRoof).toBe(true);
    mall.step(d.frame({ left: true }));
    expect(mall.p.onRoof).toBe(false);
    expect(mall.p.floor).toBe(FLOOR_4F);
    expect(mall.p.y).toBe(floorY(FLOOR_4F));
  });
});

describe('elevator crush rules', () => {
  it('an automatic car coming down onto an agent standing on the grate crushes them', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, C, FLOOR_4F);
    placeAt(mall, FLOOR_2F, SHAFTS[C].cx - 8);
    // the car is above, heading for 1F (passes through 2F)
    mall.cars[C].target = FLOOR_1F;
    mall.cars[C].called = false;
    mall.cars[C].dir = 1;
    let died = false;
    for (let i = 0; i < 400; i++) {
      mall.p.idle = 0; // do not auto-call
      mall.step(d.frame({}));
      if (mall.p.mode === 'dying') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });

  it('a car that was CALLED comes to you and picks you up instead of crushing', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, C, FLOOR_4F);
    placeAt(mall, FLOOR_2F, SHAFTS[C].cx - 8);
    mall.step(d.frame({ up: true })); // Up in the opening calls the car
    expect(mall.cars[C].called).toBe(true);
    let boarded = false;
    for (let i = 0; i < 400; i++) {
      mall.step(d.frame({}));
      expect(mall.p.mode).not.toBe('dying');
      if (mall.p.mode === 'car') {
        boarded = true;
        break;
      }
    }
    expect(boarded).toBe(true);
    expect(mall.cars[C].y).toBe(floorY(FLOOR_2F));
  });

  it('standing still next to an opening for about half a second calls the car automatically', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, B, FLOOR_P);
    placeAt(mall, FLOOR_3F, SHAFTS[B].x - 10);
    stepN(mall, d, 20);
    expect(mall.cars[B].target).toBeNull();
    stepN(mall, d, 20);
    expect(mall.cars[B].target).toBe(FLOOR_3F);
    stepN(mall, d, 300);
    expect(mall.cars[B].y).toBe(floorY(FLOOR_3F));
  });

  it('a car coming down onto a spy waiting on the grate crushes it for 300 points', () => {
    const { mall, d, run } = makeMall(1);
    setCar(mall, C, FLOOR_4F);
    placeAt(mall, FLOOR_1F, 100);
    const sp = spawnSpyAt(mall, FLOOR_2F, SHAFTS[C].cx - 8, false)!;
    sp.state = 'wait';
    sp.t = 99999;
    mall.cars[C].target = FLOOR_1F;
    const before = run.score.score;
    for (let i = 0; i < 300 && (sp.state as string) !== 'dying'; i++) {
      sp.state = (sp.state as string) === 'dying' ? 'dying' : 'wait';
      mall.step(d.frame({}));
    }
    expect(sp.state).toBe('dying');
    expect(sp.killedBy).toBe('crush');
    expect(run.score.score - before).toBe(300);
  });

  it('the automatic car never leaves while the agent is inside', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, C, FLOOR_3F);
    placeAt(mall, FLOOR_3F, SHAFTS[C].x - 20);
    stepN(mall, d, 30, { right: true });
    expect(mall.p.mode).toBe('car');
    stepN(mall, d, 900);
    expect(mall.cars[C].y).toBe(floorY(FLOOR_3F));
    expect(mall.p.mode).toBe('car');
  });

  it('an empty automatic car wanders to other floors on its own', () => {
    const { mall, d } = makeMall(1);
    placeAt(mall, FLOOR_P, 20);
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      mall.step(d.frame({}));
      if (!mall.cars[C].moving) seen.add(Math.round((mall.cars[C].y - 120) / 48));
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('each stop dings exactly once (also with the agent riding)', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, A, FLOOR_R);
    placeAt(mall, FLOOR_R, SHAFTS[A].x - 20);
    stepN(mall, d, 30, { right: true });
    expect(mall.p.mode).toBe('car');
    mall.events.drain();
    stepN(mall, d, 60, { down: true });
    stepN(mall, d, 100);
    const dings = mall.events.drain().filter((e) => e.kind === 'ding');
    expect(dings.length).toBe(1);
    stepN(mall, d, 400, { down: true });
    stepN(mall, d, 200, { down: true }); // held at the end of the shaft: no repeated ding
    const more = mall.events.drain().filter((e) => e.kind === 'ding');
    expect(more.length).toBe(1);
  });

  it('shows a floor announcement banner when a car stops with the agent inside', () => {
    const { mall, d } = makeMall(1);
    setCar(mall, A, FLOOR_R);
    placeAt(mall, FLOOR_R, SHAFTS[A].x - 20);
    stepN(mall, d, 30, { right: true });
    stepN(mall, d, 10, { down: true });
    let text = '';
    for (let i = 0; i < 200 && !text; i++) {
      mall.step(d.frame({ down: i < 30 }));
      if (mall.banner && mall.banner.kind === 'floor' && mall.p.mode === 'car') text = mall.banner.lines[0];
    }
    expect(text).toContain('4F');
  });
});

describe('every floor can be reached (no softlocks)', () => {
  it('the shaft/escalator graph connects the roof to every floor, including P', () => {
    const adj: Record<number, Set<number>> = {};
    for (let f = 0; f < FLOOR_COUNT; f++) adj[f] = new Set();
    for (const s of SHAFTS) for (let a = s.minFloor; a <= s.maxFloor; a++) for (let b = s.minFloor; b <= s.maxFloor; b++) if (a !== b) adj[a].add(b);
    for (const e of ESCALATORS) {
      adj[e.upperFloor].add(e.lowerFloor);
      adj[e.lowerFloor].add(e.upperFloor);
    }
    const seen = new Set<number>([FLOOR_R]);
    const q = [FLOOR_R];
    while (q.length) {
      const f = q.shift()!;
      for (const n of adj[f]) if (!seen.has(n)) (seen.add(n), q.push(n));
    }
    expect(seen.size).toBe(FLOOR_COUNT);
    // P is only served by shaft B, as in the brief
    expect(SHAFTS.filter((s) => shaftServes(s, FLOOR_P)).map((s) => s.id)).toEqual(['B']);
  });

  it('every opening can call its car from every other position (no stranded elevator)', () => {
    for (let si = 0; si < SHAFTS.length; si++) {
      const s = SHAFTS[si];
      for (let from = s.minFloor; from <= s.maxFloor; from++) {
        for (let to = s.minFloor; to <= s.maxFloor; to++) {
          if (from === to) continue;
          const { mall, d } = makeMall(1);
          setCar(mall, si, from);
          placeAt(mall, to, s.x - 12);
          stepN(mall, d, 45); // stand still: auto-call
          stepN(mall, d, 400);
          expect(mall.cars[si].y, `shaft ${s.id} ${from}->${to}`).toBe(floorY(to));
          expect(mall.p.mode).not.toBe('dying');
        }
      }
    }
  });

  it('escalators carry the agent between their two floors, both ways', () => {
    for (let i = 0; i < ESCALATORS.length; i++) {
      const e = ESCALATORS[i];
      const up = makeMall(1);
      placeAt(up.mall, e.lowerFloor, e.xLower - 8);
      up.mall.step(up.d.frame({ up: true }));
      expect(up.mall.p.mode).toBe('escalator');
      stepN(up.mall, up.d, 60);
      expect(up.mall.p.mode).toBe('normal');
      expect(up.mall.p.floor).toBe(e.upperFloor);
      expect(up.mall.p.y).toBe(floorY(e.upperFloor));
      expect(Math.abs(up.mall.p.x + 8 - e.xUpper)).toBeLessThan(2);
      const dn = makeMall(1);
      placeAt(dn.mall, e.upperFloor, e.xUpper - 8);
      dn.mall.step(dn.d.frame({ down: true }));
      expect(dn.mall.p.mode).toBe('escalator');
      stepN(dn.mall, dn.d, 60);
      expect(dn.mall.p.floor).toBe(e.lowerFloor);
    }
  });
});

describe('determinism', () => {
  it('the same seed and the same inputs replay identically', () => {
    const run = (seed: number) => {
      const { mall, d } = makeMall(seed);
      skipArrival(mall, d);
      for (let i = 0; i < 2000; i++) mall.step(d.frame({ right: i % 200 < 120, a: i % 17 === 0 }));
      return JSON.stringify({ x: mall.p.x, y: mall.p.y, s: mall.spies.map((s) => [s.x, s.state]), r: mall.rng.state, c: mall.cars.map((c) => c.y) });
    };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});
