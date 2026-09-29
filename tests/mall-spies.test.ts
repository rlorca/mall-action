import { describe, it, expect } from 'vitest';
import { difficulty, MIN_SHOT_INTERVAL, ALARM_SPEEDUP } from '../src/game/difficulty';
import { FLOOR_Y } from '../src/game/geometry';
import { newProgress } from '../src/game/progress';
import { FOOD_POWERUPS } from '../src/game/progress';
import { SPY_LAST_WORDS } from '../src/data/copy';
import { AIM_FRAMES, aliveSpies } from '../src/game/mall/spies';
import { STORE_LAYOUT_BY_ID } from '../src/game/mall/layout';
import { makeWorld, parkCar, place, quiet, stepFrames } from './mall-helpers';

function invulnerable(w: ReturnType<typeof makeWorld>): void {
  w.s.player.invuln = 1e9;
}

describe('spy spawning', () => {
  it('the first spy appears ~5 s into the level, from an open store door 64..200 px away', () => {
    const w = makeWorld(21);
    place(w, '4F', 300);
    w.s.cop.floor = 'P';
    invulnerable(w);
    stepFrames(w, 290);
    expect(w.s.spies).toHaveLength(0);
    stepFrames(w, 60);
    expect(w.s.spies.length).toBeGreaterThan(0);
    const sp = w.s.spies[0];
    const doors = ['radioshock', 'gamestonk', 'forever12', 'crookstone'].map((id) => STORE_LAYOUT_BY_ID[id as 'radioshock']);
    const match = doors.find((d) => d.doorX === sp.x || Math.abs(d.doorX - sp.x) < 60);
    expect(match).toBeTruthy();
  });

  it('spawn positions are 64..200 px from the player, on his floor or one floor away, never from closed stores or cleared targets', () => {
    const w = makeWorld(22);
    place(w, '3F', 300);
    w.s.cop.floor = 'P';
    invulnerable(w);
    w.progress.packages.push('kgbtoys');
    const spawned: { id: number; floor: string; x: number; px: number }[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      w.s.player.x = 300;
      w.s.spies = w.s.spies.filter((s) => s.age < 25); // keep them from accumulating
      stepFrames(w, 1);
      for (const s of w.s.spies) if (s.age === 1 && !seen.has(s.id)) (seen.add(s.id), spawned.push({ id: s.id, floor: s.floor, x: s.x, px: 300 }));
    }
    expect(spawned.length).toBeGreaterThan(3);
    for (const s of spawned) {
      expect(Math.abs(s.x - s.px)).toBeGreaterThanOrEqual(64);
      expect(Math.abs(s.x - s.px)).toBeLessThanOrEqual(200);
      expect(['4F', '3F', '2F']).toContain(s.floor);
      // never blockbuster (closed 3F), never kgb (cleared)
      expect(Math.abs(s.x - STORE_LAYOUT_BY_ID.blockblustervideo.doorX) < 1 && s.floor === '3F').toBe(false);
      expect(Math.abs(s.x - STORE_LAYOUT_BY_ID.kgbtoys.doorX) < 1 && s.floor === '3F').toBe(false);
    }
  });

  it('at most 4 spies (8 in Black Friday); more often in Black Friday', () => {
    const run = (bf: boolean): { max: number; spawns: number } => {
      const w = makeWorld(23, { progress: newProgress(23, bf) });
      place(w, '4F', 300);
      w.s.cop.floor = 'P';
      invulnerable(w);
      let max = 0;
      const seen = new Set<number>();
      for (let i = 0; i < 3000; i++) {
        stepFrames(w, 1);
        w.s.player.x = 300;
        w.s.player.mode === 'walk' || (w.s.player.mode = 'walk');
        max = Math.max(max, aliveSpies(w));
        for (const s of w.s.spies) seen.add(s.id);
      }
      return { max, spawns: seen.size };
    };
    const normal = run(false);
    const bf = run(true);
    expect(normal.max).toBeLessThanOrEqual(4);
    expect(bf.max).toBeLessThanOrEqual(8);
    expect(bf.max).toBeGreaterThan(4);
    expect(bf.spawns).toBeGreaterThan(normal.spawns);
  });
});

describe('spy fairness', () => {
  function duel(seed: number, loop = 1): { w: ReturnType<typeof makeWorld>; shotFrames: number[]; aimSeen: number[] } {
    const w = makeWorld(seed);
    w.progress.loop = loop;
    quiet(w);
    place(w, '4F', 150);
    invulnerable(w);
    const sp = w.spawnSpy('4F', 250, { emerge: false })!;
    const shotFrames: number[] = [];
    const aimSeen: number[] = [];
    let lastShots = 0;
    let aimRun = 0;
    for (let f = 1; f <= 700; f++) {
      stepFrames(w, 1, {});
      w.s.player.x = 150;
      if (sp.aimFrames > 0) aimRun++;
      if (sp.shots > lastShots) {
        shotFrames.push(sp.age);
        aimSeen.push(aimRun);
        aimRun = 0;
        lastShots = sp.shots;
      }
    }
    return { w, shotFrames, aimSeen };
  }

  it('first shot comes no sooner than 120 frames after the spy appears, with a ~30 frame aiming telegraph', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { shotFrames, aimSeen } = duel(seed);
      expect(shotFrames.length).toBeGreaterThan(1);
      expect(shotFrames[0]).toBeGreaterThanOrEqual(120);
      for (const a of aimSeen) {
        expect(a).toBeGreaterThanOrEqual(AIM_FRAMES);
        expect(a).toBeLessThanOrEqual(AIM_FRAMES + 3);
      }
    }
  });

  it('afterwards one shot per shotIntervalFrames (150 on loop 1), never more often than once a second', () => {
    const { shotFrames } = duel(3);
    for (let i = 1; i < shotFrames.length; i++) expect(shotFrames[i] - shotFrames[i - 1]).toBe(difficulty(1).shotIntervalFrames);
    expect(difficulty(1).shotIntervalFrames).toBe(150);
    for (const loop of [2, 5, 20, 100]) {
      const { shotFrames: sf } = duel(3, loop);
      expect(difficulty(loop).shotIntervalFrames).toBeGreaterThanOrEqual(MIN_SHOT_INTERVAL);
      for (let i = 1; i < sf.length; i++) expect(sf[i] - sf[i - 1]).toBeGreaterThanOrEqual(60);
    }
    // faster on later loops
    expect(difficulty(4).shotIntervalFrames).toBeLessThan(difficulty(1).shotIntervalFrames);
  });

  it('an aimed straight shot that reaches a standing player kills; ducking dodges the high shot; jumping dodges the low one', () => {
    const shoot = (high: boolean, action: 'stand' | 'duck' | 'jump'): boolean => {
      const w = makeWorld(31);
      quiet(w);
      place(w, '4F', 300);
      w.s.bullets.push({ id: 900, x: 340, y: FLOOR_Y['4F'] - (high ? 18 : 6), vx: -2, vy: 0, owner: 'spy', volley: 0, spent: false });
      let died = false;
      for (let i = 0; i < 40; i++) {
        stepFrames(w, 1, action === 'duck' ? { down: true } : action === 'jump' && i === 12 ? { b: true } : {});
        if (w.s.player.mode === 'dying') died = true;
      }
      return died;
    };
    expect(shoot(true, 'stand')).toBe(true);
    expect(shoot(false, 'stand')).toBe(true);
    expect(shoot(true, 'duck')).toBe(false);
    expect(shoot(false, 'duck')).toBe(true);
    expect(shoot(false, 'jump')).toBe(false);
  });

  it('armour absorbs one bullet', () => {
    const w = makeWorld(32);
    quiet(w);
    place(w, '4F', 300);
    w.progress.power.armor = true;
    w.s.bullets.push({ id: 900, x: 320, y: FLOOR_Y['4F'] - 18, vx: -2, vy: 0, owner: 'spy', volley: 0, spent: false });
    stepFrames(w, 20);
    expect(w.s.player.mode).toBe('walk');
    expect(w.progress.power.armor).toBe(false);
    expect(w.progress.lives).toBe(3);
  });

  it('spies duck an incoming volley ~10% of the time (decided once per volley); most straight shots land', () => {
    let dodged = 0;
    let hit = 0;
    const N = 700;
    for (let seed = 1; seed <= N; seed++) {
      const w = makeWorld(seed * 7919);
      quiet(w);
      place(w, '4F', 400);
      invulnerable(w);
      const sp = w.spawnSpy('4F', 480, { emerge: false })!;
      sp.nextFireAge = 1e9;
      stepFrames(w, 1, { a: true });
      for (let i = 0; i < 40; i++) stepFrames(w, 1, {});
      if (sp.state === 'dying') hit++;
      else dodged++;
    }
    const rate = dodged / N;
    expect(rate).toBeGreaterThan(0.06);
    expect(rate).toBeLessThan(0.14);
    expect(hit).toBeGreaterThan(N * 0.85);
  });

  it('a spread volley is one decision per volley, not three', () => {
    let dodged = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const w = makeWorld(seed * 31);
      quiet(w);
      place(w, '4F', 400);
      invulnerable(w);
      w.progress.power.weapon = { kind: 'spread', frames: 1e6, total: 1e6 };
      const sp = w.spawnSpy('4F', 470, { emerge: false })!;
      sp.nextFireAge = 1e9;
      stepFrames(w, 1, { a: true });
      stepFrames(w, 40, {});
      if (sp.state !== 'dying') dodged++;
    }
    expect(dodged / N).toBeLessThan(0.16);
  });

  it('spies ignore a hidden player (photo booth) and never shoot', () => {
    const w = makeWorld(41);
    quiet(w);
    place(w, '3F', 588);
    const sp = w.spawnSpy('3F', 640, { emerge: false })!;
    stepFrames(w, 1, { up: true });
    expect(w.s.player.mode).toBe('booth');
    stepFrames(w, 200, {});
    expect(sp.shots).toBe(0);
    expect(sp.aimFrames).toBe(0);
  });

  it('spies ignore a player who is arriving or posing for the selfie', () => {
    const w = makeWorld(42, { skipArrival: false });
    const sp = w.spawnSpy('R', 200, { emerge: false })!;
    stepFrames(w, 200);
    expect(w.s.phase).toBe('selfie');
    expect(sp.shots).toBe(0);
    expect(sp.aimFrames).toBe(0);
  });

  it('spies walk toward a visible player and stop ~40 px away', () => {
    const w = makeWorld(43);
    quiet(w);
    place(w, '4F', 150);
    invulnerable(w);
    const sp = w.spawnSpy('4F', 300, { emerge: false })!;
    sp.nextFireAge = 1e9;
    stepFrames(w, 300);
    expect(Math.abs(sp.x - 150)).toBeGreaterThanOrEqual(38);
    expect(Math.abs(sp.x - 150)).toBeLessThanOrEqual(42);
  });

  it('spies never walk into a pit', () => {
    const w = makeWorld(44);
    quiet(w);
    parkCar(w, 'A', '2F'); // 4F opening is a pit
    place(w, '4F', 250); // player beyond the pit
    invulnerable(w);
    w.s.player.safeX = 250;
    const sp = w.spawnSpy('4F', 100, { emerge: false })!;
    sp.nextFireAge = 1e9;
    for (let i = 0; i < 800; i++) {
      stepFrames(w, 1);
      w.s.player.x = 250;
      if (sp.state === 'dying') break;
      expect(sp.x).toBeLessThanOrEqual(204.5);
    }
    expect(sp.state).not.toBe('dying');
  });

  it('wandering spies also avoid pits and sometimes wait in a shaft opening', () => {
    let waited = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const w = makeWorld(seed);
      quiet(w);
      parkCar(w, 'A', '4F');
      parkCar(w, 'B', '4F');
      place(w, 'P', 100);
      w.s.cop.floor = 'P';
      const sp = w.spawnSpy('4F', 250, { emerge: false })!;
      sp.nextFireAge = 1e9;
      for (let i = 0; i < 1500; i++) {
        stepFrames(w, 1);
        w.s.player.x = 100;
        if (sp.state === 'dying') break;
        if (sp.state === 'wait') waited++;
      }
      expect(sp.state).not.toBe('dying');
    }
    expect(waited).toBeGreaterThan(0);
  });

  it('a spy dies from one hit: +100, 24 frame death animation, then he is gone', () => {
    const w = makeWorld(45);
    quiet(w);
    place(w, '4F', 400);
    invulnerable(w);
    const sp = w.spawnSpy('4F', 470, { emerge: false })!;
    sp.nextFireAge = 1e9;
    const score = w.progress.score;
    for (let i = 0; i < 60 && sp.state !== 'dying'; i++) stepFrames(w, 1, i === 0 ? { a: true } : {});
    if (sp.state !== 'dying') return; // (10% duck)
    expect(w.progress.score).toBe(score + 100);
    stepFrames(w, 23);
    expect(w.s.spies).toContain(sp);
    stepFrames(w, 2);
    expect(w.s.spies).not.toContain(sp);
  });

  it('drops a power-up ~5% of kills (half food) and says last words ~35% of the time', () => {
    const w = makeWorld(46);
    quiet(w);
    place(w, '4F', 300);
    let drops = 0;
    let food = 0;
    let words = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const sp = w.spawnSpy('4F', 400, { emerge: false })!;
      w.killSpy(sp, 'shot');
      if (sp.bubble) {
        words++;
        expect(SPY_LAST_WORDS).toContain(sp.bubble.text);
      }
      w.s.spies.length = 0;
      if (w.s.pickups.length) {
        drops++;
        if (FOOD_POWERUPS.includes(w.s.pickups[0].kind)) food++;
        w.s.pickups.length = 0;
      }
    }
    expect(drops / N).toBeGreaterThan(0.03);
    expect(drops / N).toBeLessThan(0.075);
    expect(food / drops).toBeGreaterThan(0.3);
    expect(food / drops).toBeLessThan(0.7);
    expect(words / N).toBeGreaterThan(0.3);
    expect(words / N).toBeLessThan(0.4);
  });

  it('a dropped power-up is collected by walking over it (radar, food, ...)', () => {
    const w = makeWorld(47);
    quiet(w);
    place(w, '4F', 300);
    w.s.pickups.push({ id: 1, x: 310, y: FLOOR_Y['4F'], floor: '4F', kind: 'cinnabomb', life: 100 });
    stepFrames(w, 15, { right: true });
    expect(w.progress.power.invincible?.kind).toBe('cinnabomb');
    expect(w.s.pickups).toHaveLength(0);
    // touching spies kills them while invincible
    const sp = w.spawnSpy('4F', 330, { emerge: false })!;
    sp.nextFireAge = 1e9;
    stepFrames(w, 25, { right: true });
    expect(sp.state).toBe('dying');
    expect(w.progress.lives).toBe(3);
  });

  it('spies are 25% faster during the alarm, and faster on later loops', () => {
    const dist = (alarm: boolean, loop: number): number => {
      const w = makeWorld(48);
      w.progress.loop = loop;
      quiet(w);
      w.s.alarm = alarm;
      place(w, '4F', 100);
      invulnerable(w);
      const sp = w.spawnSpy('4F', 250, { emerge: false })!;
      sp.nextFireAge = 1e9;
      const x0 = sp.x;
      for (let i = 0; i < 40; i++) {
        stepFrames(w, 1);
        w.s.player.x = 100;
      }
      return x0 - sp.x;
    };
    expect(dist(true, 1) / dist(false, 1)).toBeCloseTo(ALARM_SPEEDUP, 1);
    expect(dist(false, 3) / dist(false, 1)).toBeCloseTo(1.2, 1);
  });
});
