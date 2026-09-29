import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../src/core/events';
import { MISC, SPYGRAM_ARRIVAL } from '../src/data/copy';
import { difficulty } from '../src/game/difficulty';
import { FLOOR_Y } from '../src/game/geometry';
import { EXTRA_LIFE_SCORE, applyPowerup, newProgress } from '../src/game/progress';
import { MALL_COPY } from '../src/game/mall/copy';
import { LAYOUT, STORE_LAYOUT_BY_ID, SHAFTS } from '../src/game/mall/layout';
import { storeDoorState, type MallWorld } from '../src/game/mall';
import { banners, hashState, makeWorld, place, quiet, sfxCount, stepFrames, type Held } from './mall-helpers';

describe('arrival', () => {
  it('zip-line: hang and slide (zip sfx), let go near the post, drop, land crouch (thud), selfie ~2.5 s, then control', () => {
    const w = makeWorld(3, { skipArrival: false });
    const buf = new EventBuffer();
    const phases: string[] = [];
    let selfieFrames = 0;
    for (let i = 0; i < 600 && w.s.phase !== 'play'; i++) {
      stepFrames(w, 1, {}, buf);
      if (phases[phases.length - 1] !== w.s.phase) phases.push(w.s.phase);
      if (w.s.phase === 'selfie') selfieFrames++;
    }
    expect(phases).toEqual(['zip', 'drop', 'land', 'selfie', 'play']);
    expect(selfieFrames).toBeGreaterThanOrEqual(148);
    expect(selfieFrames).toBeLessThanOrEqual(152);
    expect(sfxCount(buf, 'zip')).toBeGreaterThan(1);
    expect(sfxCount(buf, 'thud')).toBe(1);
    expect(buf.events.some((e) => e.t === 'flash')).toBe(true);
    expect(w.s.spygramIndex).toBeGreaterThanOrEqual(0);
    expect(w.s.spygramIndex).toBeLessThan(SPYGRAM_ARRIVAL.length);
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.floor).toBe('R');
    expect(buf.events.filter((e) => e.t === 'music' && e.name === 'mall')).toHaveLength(1);
  });

  it('the zip drops near the anchor post, on the roof', () => {
    const w = makeWorld(3, { skipArrival: false });
    let dropX = -1;
    for (let i = 0; i < 300; i++) {
      stepFrames(w, 1, {});
      if (w.s.phase === 'drop' && dropX < 0) dropX = w.s.player.x;
    }
    expect(Math.abs(dropX - LAYOUT.zip.postX)).toBeLessThan(30);
    expect(w.s.player.y).toBe(FLOOR_Y.R);
  });

  it('any button skips the selfie; the chosen SPYGRAM is seeded', () => {
    const w = makeWorld(3, { skipArrival: false });
    for (let i = 0; i < 400 && w.s.phase !== 'selfie'; i++) stepFrames(w, 1, {});
    expect(w.s.phase).toBe('selfie');
    stepFrames(w, 20, {});
    expect(w.s.phase).toBe('selfie');
    stepFrames(w, 1, { a: true });
    expect(w.s.phase).toBe('play');
    const idx = (seed: number): number => makeWorld(seed, { skipArrival: false }).s.spygramIndex;
    expect(idx(5)).toBe(idx(5));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(idx)).size).toBeGreaterThan(3);
  });

  it('no control (and no spies) during the arrival', () => {
    const w = makeWorld(3, { skipArrival: false });
    stepFrames(w, 100, { right: true, a: true });
    expect(w.s.bullets).toHaveLength(0);
    expect(w.s.spies).toHaveLength(0);
  });
});

describe('exit rule (5.8)', () => {
  const six = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'] as const;
  it('with packages missing the car will not start: PACKAGES LEFT: n and a buzzer', () => {
    const w = makeWorld();
    quiet(w);
    for (const id of six.slice(0, 4)) w.progress.packages.push(id);
    place(w, 'P', LAYOUT.wagon.x);
    const buf = new EventBuffer();
    stepFrames(w, 1, { up: true }, buf);
    expect(sfxCount(buf, 'buzzer')).toBe(1);
    expect(banners(buf).some((l) => l[0] === MISC.packagesLeft(2))).toBe(true);
    expect(w.levelClear).toBe(false);
    expect(w.s.player.mode).toBe('walk');
    // spamming is throttled
    const b2 = new EventBuffer();
    for (let i = 0; i < 20; i++) stepFrames(w, 1, { up: i % 2 === 0 }, b2);
    expect(sfxCount(b2, 'buzzer')).toBeLessThanOrEqual(1);
    expect(w.levelClear).toBe(false);
  });

  it('with all 6 packages, Up at the wagon fires levelClear EXACTLY once, even if Up is spammed or held', () => {
    const w = makeWorld();
    quiet(w);
    for (const id of six) w.progress.packages.push(id);
    place(w, 'P', LAYOUT.wagon.x - 10);
    const buf = new EventBuffer();
    for (let i = 0; i < 120; i++) stepFrames(w, 1, { up: i % 2 === 0 || i > 80 }, buf);
    expect(w.levelClear).toBe(true);
    expect(banners(buf).filter((l) => l[0] === MALL_COPY.levelClear[0])).toHaveLength(1);
    expect(sfxCount(buf, 'buzzer')).toBe(0);
    let flips = 0;
    let prev = w.levelClear;
    for (let i = 0; i < 100; i++) {
      stepFrames(w, 1, { up: true });
      if (w.levelClear !== prev) flips++;
      prev = w.levelClear;
    }
    expect(flips).toBe(0);
    expect(w.levelClear).toBe(true);
  });

  it('Up away from the wagon does nothing', () => {
    const w = makeWorld();
    quiet(w);
    for (const id of six) w.progress.packages.push(id);
    place(w, 'P', 200);
    stepFrames(w, 5, { up: true });
    expect(w.levelClear).toBe(false);
  });
});

describe('stores: doors, return', () => {
  it('Up at an open store door sets pendingStore and hides the player; returnFromStore puts him back at the door', () => {
    const w = makeWorld();
    quiet(w);
    const door = STORE_LAYOUT_BY_ID.radioshock.doorX;
    place(w, '4F', door);
    stepFrames(w, 1, { up: true });
    expect(w.pendingStore).toBe('radioshock');
    expect(w.s.player.mode).toBe('entering');
    expect(w.s.player.hidden).toBe(true);
    const frame = w.s.frame;
    stepFrames(w, 5, {});
    expect(w.s.frame).toBe(frame + 5);
    expect(w.s.player.mode).toBe('entering'); // the mall does not run on while a store is pending
    w.clearPendingStore();
    expect(w.pendingStore).toBeNull();
    const buf = new EventBuffer();
    w.progress.packages.push('radioshock');
    w.returnFromStore('radioshock', buf);
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.x).toBe(door);
    expect(w.s.player.y).toBe(FLOOR_Y['4F']);
    expect(buf.events.some((e) => e.t === 'music' && e.name === 'mall')).toBe(true);
    // a cleared target store cannot be entered again
    stepFrames(w, 1, { up: true });
    expect(w.pendingStore).toBeNull();
    expect(storeDoorState('radioshock', w.progress)).toBe('cleared');
  });

  it('power-up shops are enterable, closed stores are not', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', STORE_LAYOUT_BY_ID.crookstone.doorX);
    stepFrames(w, 1, { up: true });
    expect(w.pendingStore).toBe('crookstone');
    const w2 = makeWorld();
    quiet(w2);
    place(w2, '3F', STORE_LAYOUT_BY_ID.blockblustervideo.doorX);
    stepFrames(w2, 1, { up: true });
    expect(w2.pendingStore).toBeNull();
    expect(w2.s.player.mode).toBe('walk');
    expect(storeDoorState('blockblustervideo', w2.progress)).toBe('closed');
    expect(storeDoorState('crookstone', w2.progress)).toBe('powerup');
    expect(storeDoorState('forever12', w2.progress)).toBe('target');
  });

  it('power-up timers are not touched by the mall (the Session ticks them): they run in stores too', () => {
    const w = makeWorld();
    applyPowerup(w.progress, 'rapid');
    const before = w.progress.power.weapon!.frames;
    stepFrames(w, 10, {});
    expect(w.progress.power.weapon!.frames).toBe(before - 10); // exactly one tick per frame, done by the helper standing in for the Session
  });
});

describe('deaths, respawn, lives, continues', () => {
  function killByBullet(w: MallWorld): void {
    w.s.bullets.push({ id: 900, x: w.s.player.x + 12, y: w.s.player.y - 18, vx: -2, vy: 0, owner: 'spy', volley: 0, spent: false });
  }

  it('an enemy bullet kills: lives--, ~1.5 s death animation, then respawn at the last safe spot, blinking ~2 s, spies and bullets cleared', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    stepFrames(w, 2, {});
    w.s.player.frozen = 100;
    w.spawnSpy('4F', 420, { emerge: false })!.nextFireAge = 1e9;
    stepFrames(w, 60, { right: true }); // walk to x=360 (safe spot)
    const safe = w.s.player.x;
    killByBullet(w);
    stepFrames(w, 6, {});
    expect(w.s.player.mode).toBe('dying');
    expect(w.progress.lives).toBe(2);
    w.spawnSpy('4F', 450, { emerge: false });
    stepFrames(w, 100, {});
    expect(w.s.player.mode).toBe('walk');
    expect(Math.abs(w.s.player.x - safe)).toBeLessThan(2);
    expect(w.s.player.invuln).toBeGreaterThan(0);
    expect(w.s.player.invuln).toBeLessThanOrEqual(120);
    expect(w.s.player.frozen).toBe(0);
    expect(w.s.spies).toHaveLength(0);
    expect(w.s.bullets).toHaveLength(0);
    expect(w.outOfLives).toBe(false);
    // invulnerable while blinking
    killByBullet(w);
    stepFrames(w, 5, {});
    expect(w.s.player.mode).toBe('walk');
    stepFrames(w, 130, {});
    expect(w.s.player.invuln).toBe(0);
  });

  it('on death everything is lost except Radar', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    for (const k of ['rapid', 'sneakers', 'armor', 'radar', 'cinnabomb'] as const) applyPowerup(w.progress, k);
    w.killPlayer('crush');
    expect(w.progress.power.radar).toBe(true);
    expect(w.progress.power.weapon).toBeNull();
    expect(w.progress.power.speed).toBeNull();
    expect(w.progress.power.armor).toBe(false);
    expect(w.progress.power.invincible).toBeNull();
  });

  it('the last life lost -> outOfLives after the death animation; continue respawns where he fell', () => {
    const w = makeWorld();
    quiet(w);
    w.progress.lives = 1;
    place(w, '3F', 300);
    stepFrames(w, 2, {});
    killByBullet(w);
    stepFrames(w, 10, {});
    expect(w.progress.lives).toBe(0);
    expect(w.outOfLives).toBe(false); // still dying
    stepFrames(w, 100, {});
    expect(w.outOfLives).toBe(true);
    const frame = w.s.frame;
    stepFrames(w, 10, {});
    expect(w.outOfLives).toBe(true);
    expect(w.s.player.mode).toBe('dying');
    void frame;
    // the Session grants fresh lives, then resumes
    w.progress.lives = 3;
    const buf = new EventBuffer();
    w.resumeAfterContinue(buf);
    expect(w.outOfLives).toBe(false);
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.floor).toBe('3F');
    expect(Math.abs(w.s.player.x - 300)).toBeLessThan(2);
    expect(w.s.player.invuln).toBeGreaterThan(60);
    expect(buf.events.some((e) => e.t === 'music')).toBe(true);
    stepFrames(w, 30, {});
    expect(w.s.player.mode).toBe('walk');
  });
});

describe('scoring through the world', () => {
  it('shooting a spy gives 100 with a popup; the 20,000 extra life comes exactly once', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 400);
    w.s.player.invuln = 1e9;
    w.progress.score = EXTRA_LIFE_SCORE - 50;
    const sp = w.spawnSpy('4F', 460, { emerge: false })!;
    sp.nextFireAge = 1e9;
    sp.lastVolley = 1; // no dodge
    const buf = stepFrames(w, 1, { a: true });
    stepFrames(w, 40, {}, buf);
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBe(EXTRA_LIFE_SCORE + 50);
    expect(w.progress.lives).toBe(4);
    expect(sfxCount(buf, 'extraLife')).toBe(1);
    expect(buf.events.some((e) => e.t === 'popup' && e.text === '+100')).toBe(true);
    w.killSpy(w.spawnSpy('4F', 460, { emerge: false })!, 'shot');
    w.killSpy(w.spawnSpy('4F', 460, { emerge: false })!, 'crush');
    expect(w.progress.lives).toBe(4);
  });
});

describe('alarm', () => {
  it('goes off at difficulty(loop).alarmFrames of level time (150 s on loop 1, sooner later): banner, alarm music, state flag', () => {
    for (const loop of [1, 2, 4]) {
      const w = makeWorld(3);
      w.progress.loop = loop;
      quiet(w);
      place(w, 'P', 100);
      const at = difficulty(loop).alarmFrames;
      w.progress.levelFrames = at - 5;
      const buf = new EventBuffer();
      stepFrames(w, 3, {}, buf);
      expect(w.s.alarm).toBe(false);
      stepFrames(w, 10, {}, buf);
      expect(w.s.alarm).toBe(true);
      expect(banners(buf).some((l) => l[0] === MISC.alarm[0])).toBe(true);
      expect(buf.events.some((e) => e.t === 'music' && e.name === 'alarm')).toBe(true);
      expect(sfxCount(buf, 'alarm')).toBe(1);
    }
    expect(difficulty(1).alarmFrames).toBe(150 * 60);
    expect(difficulty(2).alarmFrames).toBe(130 * 60);
    expect(difficulty(3).alarmFrames).toBeLessThan(difficulty(2).alarmFrames);
    expect(difficulty(99).alarmFrames).toBeGreaterThan(0);
  });

  it('alarm during a store visit fires on return; music returns to alarm after riding', () => {
    const w = makeWorld(3);
    quiet(w);
    place(w, '4F', STORE_LAYOUT_BY_ID.radioshock.doorX);
    stepFrames(w, 1, { up: true });
    w.clearPendingStore();
    w.progress.levelFrames = difficulty(1).alarmFrames + 10;
    const buf = new EventBuffer();
    w.returnFromStore('radioshock', buf);
    expect(w.s.alarm).toBe(true);
    expect(buf.events.some((e) => e.t === 'music' && e.name === 'alarm')).toBe(true);
  });

  it('spies appear more often during the alarm', () => {
    const count = (alarm: boolean): number => {
      const w = makeWorld(12);
      place(w, '4F', 300);
      w.s.cop.floor = 'P';
      w.s.player.invuln = 1e9;
      w.s.alarm = alarm;
      const seen = new Set<number>();
      for (let i = 0; i < 2500; i++) {
        stepFrames(w, 1, {});
        w.s.spies = w.s.spies.filter((s) => s.age < 40);
        w.s.player.x = 300;
        for (const s of w.s.spies) seen.add(s.id);
      }
      return seen.size;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });
});

describe('determinism', () => {
  function script(seed: number, frames: number): number {
    const w = makeWorld(seed, { skipArrival: false });
    let s = seed * 2654435761;
    const held: Held[] = [];
    for (let i = 0; i < 40; i++) {
      s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0;
      held.push({ left: (s & 1) === 1, right: (s & 2) === 2, up: (s & 4) === 4, down: (s & 8) === 8, a: (s & 16) === 16, b: (s & 32) === 32 });
    }
    stepFrames(w, frames, (i) => held[Math.floor(i / 20) % held.length]);
    return hashState(w);
  }
  it('same seed + same input => identical state; different seed => different', () => {
    const a = script(1234, 2500);
    expect(script(1234, 2500)).toBe(a);
    expect(script(4321, 2500)).not.toBe(a);
  });
  it('the state is plain JSON', () => {
    const w = makeWorld(1);
    stepFrames(w, 50);
    expect(() => JSON.stringify(w.s)).not.toThrow();
    expect(JSON.parse(JSON.stringify(w.s)).cars).toHaveLength(3);
  });
});

describe('map snapshot', () => {
  it('reports the player floor, cars, wagon and all stores', () => {
    const w = makeWorld();
    place(w, '3F', 300);
    const m = w.mapSnapshot();
    expect(m.playerFloor).toBe('3F');
    expect(m.playerX).toBe(300);
    expect(m.cars.map((c) => c.shaft)).toEqual(['A', 'B', 'C']);
    expect(m.cars[0].floor).toBe('R');
    expect(m.getawayCar.x).toBe(LAYOUT.wagon.x);
    expect(m.stores).toHaveLength(13);
    expect(SHAFTS).toHaveLength(3);
  });
});

describe('fairness: a new player reaches a 4F store door within 30 s', () => {
  function botHeld(w: MallWorld, target: 'radioshock' | 'forever12', tick: number): Held {
    const p = w.s.player;
    const s = w.s;
    if (s.phase !== 'play') return { b: tick % 2 === 0 };
    if (p.mode === 'dying' || p.mode === 'entering') return {};
    const doorX = STORE_LAYOUT_BY_ID[target].doorX;
    const h: Held = {};
    // shoot at spies that are lined up in front of us
    for (const sp of s.spies) {
      if (sp.state !== 'dying' && sp.floor === p.floor && Math.abs(sp.x - p.x) < 150 && (sp.x - p.x) * p.facing > 0 && tick % 6 === 0) h.a = true;
    }
    const face = (dx: number): void => {
      if (dx > 0) h.right = true;
      else h.left = true;
    };
    if (p.floor === 'R' && p.mode === 'walk') {
      const dx = SHAFTS[0].cx - p.x;
      if (Math.abs(dx) > 1.5) face(dx);
      else h.down = true;
      return h;
    }
    if (p.mode === 'car') {
      const car = s.cars[0];
      if (car.y < FLOOR_Y['4F']) h.down = true;
      else if (car.level === '4F') h.left = true;
      return h;
    }
    if (p.mode === 'walk' && p.floor === '4F') {
      const dx = doorX - p.x;
      if (Math.abs(dx) > 1) face(dx);
      else if (tick % 2 === 0) h.up = true;
      return h;
    }
    return h;
  }

  it('from the roof arrival: ride A to 4F and walk to a target door in under 1800 frames (10 seeds)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = makeWorld(seed * 101, { skipArrival: false });
      let tick = 0;
      let arrivedAt = -1;
      for (let i = 0; i < 1800 && !w.pendingStore; i++) {
        stepFrames(w, 1, botHeld(w, seed % 2 ? 'radioshock' : 'forever12', tick++));
        if (arrivedAt < 0 && w.s.phase === 'play') arrivedAt = i;
      }
      expect(w.pendingStore, `seed ${seed} at frame ${tick}`).toBe(seed % 2 ? 'radioshock' : 'forever12');
    }
  });
});
