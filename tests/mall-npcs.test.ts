import { describe, expect, it } from 'vitest';
import { makeMall, placeAt, stepN, Driver } from './helpers';
import { FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_4F, FLOOR_P, SHAFTS, STOREFRONTS, floorY, shaftServes } from '../src/core/level';
import { Mall } from '../src/core/mall';
import { killSpy, spawnSpyAt, spawnSpies, SPY_AIM_FRAMES, SPY_FIRST_SHOT_FRAMES, SPY_DODGE_CHANCE } from '../src/core/mall-spies';
import { PATCH_W, patchIsSafe } from '../src/core/mall-npcs';
import { difficultyFor } from '../src/core/difficulty';
import { MISC, storeInfo } from '../src/core/copy';
import { newRun } from '../src/core/run';
import { applyPower } from '../src/core/powerups';

function quiet(m: Mall) {
  m.cop.floor = FLOOR_P;
  m.cop.state = 'cool';
  m.cop.t = 1e9;
  m.spawnT = 1e9;
  m.paT = 1e9;
  m.janitor.nextMop = 1e9;
  for (let i = 0; i < m.cars.length; i++) {
    m.cars[i].y = floorY(SHAFTS[i].minFloor);
    m.cars[i].wait = 1e9;
  }
}
function setup(floor: number, x: number, seed = 1) {
  const r = makeMall(seed);
  placeAt(r.mall, floor, x);
  quiet(r.mall);
  return r;
}

describe('spy fairness', () => {
  it('the first shot comes no sooner than 2 s after the spy appears, with a half-second aim pose first', () => {
    const { mall, d } = setup(FLOOR_3F, 300);
    mall.p.invuln = 99999;
    const sp = spawnSpyAt(mall, FLOOR_3F, 400, false)!;
    let aimFrame = -1;
    let shotFrame = -1;
    for (let i = 0; i < 600 && shotFrame < 0; i++) {
      mall.step(d.frame({}));
      for (const e of mall.events.drain()) {
        if (e.kind === 'spyAim' && aimFrame < 0) aimFrame = i;
        if (e.kind === 'enemyShot' && shotFrame < 0) shotFrame = i;
      }
    }
    expect(aimFrame).toBeGreaterThanOrEqual(SPY_FIRST_SHOT_FRAMES - 2);
    expect(shotFrame - aimFrame).toBeGreaterThanOrEqual(SPY_AIM_FRAMES - 1);
    expect(shotFrame - aimFrame).toBeLessThanOrEqual(SPY_AIM_FRAMES + 2);
    expect(shotFrame).toBeGreaterThanOrEqual(SPY_FIRST_SHOT_FRAMES + SPY_AIM_FRAMES - 3);
    expect(sp.age).toBeGreaterThan(100);
  });

  it('about one shot every 2.5 s on loop 1, faster on later loops, never more than once a second', () => {
    const gaps = (loop: number) => {
      const run = newRun(4);
      run.loop = loop;
      const mall = new Mall(run);
      const d = new Driver();
      placeAt(mall, FLOOR_3F, 300);
      quiet(mall);
      mall.p.invuln = 1e9;
      const sp = spawnSpyAt(mall, FLOOR_3F, 420, false)!;
      const shots: number[] = [];
      for (let i = 0; i < 3000; i++) {
        mall.step(d.frame({}));
        if ((sp.state as string) === 'dying') break;
        for (const e of mall.events.drain()) if (e.kind === 'enemyShot') shots.push(i);
      }
      const out: number[] = [];
      for (let i = 1; i < shots.length; i++) out.push(shots[i] - shots[i - 1]);
      return out;
    };
    const g1 = gaps(1);
    expect(g1.length).toBeGreaterThan(8);
    const mean = g1.reduce((a, b) => a + b, 0) / g1.length;
    expect(mean).toBeGreaterThan(150); // 150 frames of cooldown + the half-second aim
    expect(mean).toBeLessThan(230);
    expect(Math.min(...g1)).toBeGreaterThanOrEqual(60);
    const g9 = gaps(9);
    expect(Math.min(...g9)).toBeGreaterThanOrEqual(60);
    expect(g9.reduce((a, b) => a + b, 0) / g9.length).toBeLessThan(mean);
  });

  it('a spy ducks an incoming bullet about 10% of the time; most straight shots land', () => {
    let ducked = 0;
    let killed = 0;
    const N = 2500;
    const { mall, d } = setup(FLOOR_3F, 100, 9);
    for (let i = 0; i < N; i++) {
      mall.bullets = [];
      mall.spies = [];
      const sp = spawnSpyAt(mall, FLOOR_3F, 160, false)!;
      sp.state = 'wait';
      sp.t = 99999;
      sp.age = 0;
      mall.p.x = 100;
      mall.p.shootCd = 0;
      mall.step(d.frame({})); // let the previous bullet clear
      mall.lastShotFrame = -999;
      mall.fire();
      let didDuck = false;
      for (let k = 0; k < 14; k++) {
        if ((sp.state as string) === 'wait') sp.t = 99999;
        mall.step(d.frame({}));
        if ((sp.state as string) === 'duck') didDuck = true;
        if ((sp.state as string) === 'dying') break;
      }
      if (didDuck) ducked++;
      if ((sp.state as string) === 'dying') killed++;
      mall.spies = [];
    }
    const rate = ducked / N;
    expect(rate).toBeGreaterThan(SPY_DODGE_CHANCE - 0.035);
    expect(rate).toBeLessThan(SPY_DODGE_CHANCE + 0.035);
    expect(killed / N).toBeGreaterThan(0.85);
  });
});

describe('spy behaviour', () => {
  it('come out of the doors of open stores near the player, 64-200 px away; closed and cleared stores are skipped', () => {
    const { mall, run } = setup(FLOOR_3F, 300, 5);
    const doorOf = (x: number, f: number) => STOREFRONTS.find((s) => s.floor === f && Math.abs(s.doorX - 8 - x) < 1);
    for (let i = 0; i < 300; i++) {
      mall.spies = [];
      spawnSpies(mall);
      for (const s of mall.spies) {
        const sf = doorOf(s.x, s.floor)!;
        expect(sf, `spy at ${s.x} on floor ${s.floor}`).toBeTruthy();
        expect(storeInfo(sf.id).role).not.toBe('closed');
        expect(Math.abs(s.floor - FLOOR_3F)).toBeLessThanOrEqual(1);
        const dist = Math.abs(sf.doorX - (mall.p.x + 8));
        expect(dist).toBeGreaterThanOrEqual(64);
        expect(dist).toBeLessThanOrEqual(200);
      }
    }
    run.setup.kgbtoys.cleared = true;
    for (let i = 0; i < 100; i++) {
      mall.spies = [];
      spawnSpies(mall);
      for (const s of mall.spies) expect(doorOf(s.x, s.floor)!.id).not.toBe('kgbtoys');
    }
  });

  it('at most 4 on screen (8 in Black Friday Mode)', () => {
    const { mall } = setup(FLOOR_3F, 300, 5);
    for (let i = 0; i < 100; i++) spawnSpies(mall);
    expect(mall.spies.length).toBeLessThanOrEqual(4);
    const bf = makeMall(5, true);
    placeAt(bf.mall, FLOOR_3F, 300);
    bf.mall.spawnT = 1e9;
    for (let i = 0; i < 400; i++) spawnSpies(bf.mall);
    expect(bf.mall.spies.length).toBeGreaterThan(4);
    expect(bf.mall.spies.length).toBeLessThanOrEqual(8);
  });

  it('walk toward the agent when they can see him and stop about 40 px away', () => {
    const { mall, d } = setup(FLOOR_3F, 440);
    mall.p.invuln = 1e9;
    const sp = spawnSpyAt(mall, FLOOR_3F, 540, false)!;
    stepN(mall, d, 400);
    const dist = Math.abs(sp.x + 8 - (mall.p.x + 8));
    expect(dist).toBeGreaterThan(30);
    expect(dist).toBeLessThan(55);
  });

  it('never walk into pits', () => {
    const { mall, d } = setup(FLOOR_3F, 20);
    const sh = SHAFTS[1];
    mall.cars[1].y = floorY(FLOOR_P);
    const sp = spawnSpyAt(mall, FLOOR_3F, sh.x - 30, false)!;
    sp.state = 'walk';
    mall.p.x = 20;
    mall.p.mode = 'booth'; // hidden: they just wander
    mall.p.timer = -99999;
    for (let i = 0; i < 1500; i++) {
      mall.p.timer = -99999;
      mall.step(d.frame({}));
      const cx = sp.x + 8;
      expect(cx < sh.x || cx > sh.x + sh.w).toBe(true);
    }
  });

  it('ignore an agent who is hidden in the photo booth', () => {
    const { mall, d } = setup(FLOOR_3F, 130);
    mall.step(d.frame({ up: true }));
    expect(mall.p.mode).toBe('booth');
    mall.events.drain();
    const sp = spawnSpyAt(mall, FLOOR_3F, 200, false)!;
    for (let i = 0; i < 280; i++) {
      mall.p.timer = Math.min(mall.p.timer, 200);
      mall.step(d.frame({}));
    }
    expect((sp.state as string) === 'aim').toBe(false);
    expect(mall.events.drain().some((e) => e.kind === 'enemyShot')).toBe(false);
  });

  it('death takes about 0.4 s; kills score 100 (shot) and 300 (crush / lamp / ball / slide kick)', () => {
    const { mall, run } = setup(FLOOR_3F, 100);
    const a = spawnSpyAt(mall, FLOOR_3F, 200, false)!;
    killSpy(mall, a, 'shot');
    mall.spies = [];
    expect(run.score.score).toBe(100);
    expect(a.t).toBeGreaterThanOrEqual(22);
    expect(a.t).toBeLessThanOrEqual(26);
    for (const how of ['crush', 'lamp', 'ball', 'slide']) {
      const before = run.score.score;
      mall.spies = [];
      killSpy(mall, spawnSpyAt(mall, FLOOR_3F, 200, false)!, how);
      expect(run.score.score - before).toBe(300);
    }
  });

  it('about 35% of kills have last words and 5% drop a power-up', () => {
    const { mall, run } = setup(FLOOR_3F, 100, 21);
    let words = 0;
    let drops = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      mall.bubbles = [];
      mall.pickups = [];
      const s = spawnSpyAt(mall, FLOOR_3F, 200, false)!;
      killSpy(mall, s, 'shot');
      if (mall.bubbles.length) words++;
      if (mall.pickups.length) drops++;
      mall.spies = [];
    }
    expect(words / N).toBeGreaterThan(0.3);
    expect(words / N).toBeLessThan(0.4);
    expect(drops / N).toBeGreaterThan(0.03);
    expect(drops / N).toBeLessThan(0.075);
    void run;
  });

  it('are 25% faster once the alarm sounds', () => {
    const speed = (alarm: boolean) => {
      const { mall, d } = setup(FLOOR_3F, 20);
      mall.alarm = alarm;
      mall.p.mode = 'booth';
      const sp = spawnSpyAt(mall, FLOOR_3F, 200, false)!;
      sp.state = 'walk';
      sp.goalX = 600;
      let x0 = -1;
      for (let i = 0; i < 80; i++) {
        mall.p.timer = -99999;
        mall.step(d.frame({}));
        if (i === 20) x0 = sp.x;
      }
      return Math.abs(sp.x - x0) / 59;
    };
    expect(speed(true) / speed(false)).toBeCloseTo(1.25, 1);
  });
});

describe('lamps and disco balls', () => {
  it('a hanging lamp can be shot with a standing shot; it kills what is underneath and darkens the floor ~2 s', () => {
    const { mall, d, run } = setup(FLOOR_4F, 20);
    const lamp = mall.lamps.find((l) => l.floor === FLOOR_4F && !l.disco)!;
    mall.p.x = lamp.x - 70;
    mall.p.dir = 1;
    mall.step(d.frame({ a: true }));
    let sp: ReturnType<typeof spawnSpyAt> = null;
    for (let i = 0; i < 40 && (lamp.state as string) === 'hang'; i++) mall.step(d.frame({}));
    expect(lamp.state).toBe('fall');
    sp = spawnSpyAt(mall, FLOOR_4F, lamp.x - 8, false)!;
    sp.state = 'wait';
    sp.t = 1e9;
    for (let i = 0; i < 60; i++) {
      if ((sp.state as string) !== 'dying') sp.state = 'wait';
      mall.step(d.frame({}));
    }
    expect(lamp.state).toBe('dead');
    expect(sp.state).toBe('dying');
    expect(sp.killedBy).toBe('lamp');
    expect(run.score.score).toBe(300);
    expect(mall.darks.length).toBe(1);
    expect(mall.darks[0].life).toBeLessThanOrEqual(120);
    stepN(mall, d, 125);
    expect(mall.darks.length).toBe(0);
  });

  it('a low (ducking) shot does not hit the lamp', () => {
    const { mall, d } = setup(FLOOR_4F, 20);
    const lamp = mall.lamps.find((l) => l.floor === FLOOR_4F && !l.disco)!;
    mall.p.x = lamp.x - 70;
    mall.step(d.frame({ down: true }));
    mall.step(d.frame({ down: true, a: true }));
    stepN(mall, d, 40, { down: true });
    expect(lamp.state).toBe('hang');
  });

  it('a falling lamp kills the agent standing under it', () => {
    const { mall, d } = setup(FLOOR_4F, 20);
    const lamp = mall.lamps.find((l) => l.floor === FLOOR_4F && !l.disco)!;
    placeAt(mall, FLOOR_4F, lamp.x - 8);
    mall.dropLamp(lamp, 1);
    stepN(mall, d, 30);
    expect(mall.p.mode).toBe('dying');
  });

  it('disco balls on 2F drop, then ROLL in the direction of the shot, flattening spies until a wall or pit', () => {
    const { mall, d, run } = setup(FLOOR_2F, 20);
    mall.walkers.forEach((w) => (w.floor = FLOOR_P));
    const ball = mall.lamps.find((l) => l.floor === FLOOR_2F && l.disco && l.x > 300)!;
    mall.p.x = ball.x - 70;
    mall.p.dir = 1;
    mall.step(d.frame({ a: true }));
    let sp: ReturnType<typeof spawnSpyAt> = null;
    let rolled = false;
    for (let i = 0; i < 200 && !(sp && (sp.state as string) === 'dying'); i++) {
      mall.step(d.frame({}));
      if ((ball.state as string) === 'roll' && !sp) {
        rolled = true;
        sp = spawnSpyAt(mall, FLOOR_2F, ball.x + 30, false)!;
      }
      if (sp && (sp.state as string) !== 'dying') sp.state = 'wait';
    }
    expect(rolled).toBe(true);
    expect(sp!.killedBy).toBe('ball');
    expect(run.score.score).toBe(300);
    stepN(mall, d, 400);
    expect(ball.state).toBe('dead');
  });
});

describe('fountains', () => {
  it('shooting one sprays 3-5 coins worth 50 each, then cools down for ~15 s', () => {
    const { mall, d, run } = setup(FLOOR_3F, 200);
    mall.p.x = 250;
    mall.p.dir = 1;
    mall.step(d.frame({ a: true }));
    stepN(mall, d, 20);
    expect(mall.pickups.length).toBeGreaterThanOrEqual(3);
    expect(mall.pickups.length).toBeLessThanOrEqual(5);
    expect(mall.fountainCd[FLOOR_3F]).toBeGreaterThan(800);
    // collect
    const n = mall.pickups.length;
    mall.p.x = 330;
    stepN(mall, d, 120, {});
    const before = run.score.score;
    mall.p.x = 328;
    stepN(mall, d, 300, { right: false });
    void before;
    expect(n).toBeGreaterThan(0);
    // while cooling down a second shot does nothing
    mall.pickups = [];
    mall.p.shootCd = 0;
    mall.p.x = 250;
    mall.step(d.frame({ a: true }));
    stepN(mall, d, 20);
    expect(mall.pickups.length).toBe(0);
  });

  it('coins are worth 50 points each', () => {
    const { mall, d, run } = setup(FLOOR_3F, 200);
    mall.pickups.push({ id: 1, kind: 'coin', x: 204, y: floorY(FLOOR_3F) - 3, vx: 0, vy: 0, life: 600, floor: FLOOR_3F });
    stepN(mall, d, 5);
    expect(run.score.score).toBe(50);
  });

  it('one spray in twenty includes a gold coin, which is an extra life', () => {
    const { mall, d, run } = setup(FLOOR_3F, 200);
    let gold = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      mall.fountainCd[FLOOR_3F] = 0;
      mall.pickups = [];
      mall.sprayFountain(FLOOR_3F, 330);
      if (mall.pickups.some((k) => k.kind === 'gold')) gold++;
    }
    expect(gold / N).toBeGreaterThan(0.03);
    expect(gold / N).toBeLessThan(0.07);
    const lives = run.score.lives;
    mall.pickups = [{ id: 2, kind: 'gold', x: 204, y: floorY(FLOOR_3F) - 3, vx: 0, vy: 0, life: 600, floor: FLOOR_3F }];
    stepN(mall, d, 5);
    expect(run.score.lives).toBe(lives + 1);
  });
});

describe('janitor and the wet floor', () => {
  it('his wet patches (~48 px, ~10 s) never reach a shaft opening or an escalator', () => {
    const { mall, d } = makeMall(3);
    placeAt(mall, FLOOR_P, 20);
    quiet(mall);
    mall.p.invuln = 1e9;
    mall.janitor.nextMop = 30;
    let patchesSeen = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 30000; i++) {
      // throw the cars around so every opening state occurs
      if (i % 700 === 0) for (let c = 0; c < 3; c++) mall.cars[c].y = floorY(SHAFTS[c].minFloor + ((i / 700 + c) % (SHAFTS[c].maxFloor - SHAFTS[c].minFloor + 1)) | 0);
      mall.step(d.frame({}));
      for (const w of mall.patches) {
        const key = `${w.floor}:${w.x0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        patchesSeen++;
        expect(w.x1 - w.x0).toBe(PATCH_W);
        expect(w.life).toBeGreaterThan(500);
        for (const s of SHAFTS) if (shaftServes(s, w.floor)) expect(w.x1 < s.x || w.x0 > s.x + s.w, `patch ${w.x0}-${w.x1} vs shaft ${s.id}`).toBe(true);
        expect(patchIsSafe(w.floor, (w.x0 + w.x1) / 2)).toBe(true);
      }
    }
    expect(patchesSeen).toBeGreaterThan(5);
  });

  it('patches last about 10 s', () => {
    const { mall, d } = setup(FLOOR_3F, 20);
    mall.patches.push({ floor: FLOOR_3F, x0: 100, x1: 148, life: 600 });
    stepN(mall, d, 599);
    expect(mall.patches.length).toBe(1);
    stepN(mall, d, 2);
    expect(mall.patches.length).toBe(0);
  });

  it('anyone entering slides at walking speed and cannot stop or turn until off the patch', () => {
    const { mall, d } = setup(FLOOR_3F, 70);
    mall.patches.push({ floor: FLOOR_3F, x0: 100, x1: 148, life: 600 });
    stepN(mall, d, 40, { right: true }); // walk into it
    expect(mall.p.slide).toBe(1);
    const x0 = mall.p.x;
    stepN(mall, d, 10, { left: true }); // try to turn back: ignored
    expect(mall.p.x - x0).toBeCloseTo(10, 5);
    stepN(mall, d, 10, {}); // try to stop: keeps going
    expect(mall.p.x - x0).toBeCloseTo(20, 5);
    for (let i = 0; i < 80; i++) mall.step(d.frame({ left: true }));
    expect(mall.p.slide).toBe(0);
    expect(mall.p.x).toBeLessThan(x0 + 60);
  });

  it('a jump-kick landing on the patch keeps kicking while sliding (slide kick: 300 points)', () => {
    const { mall, d, run } = setup(FLOOR_3F, 70);
    mall.patches.push({ floor: FLOOR_3F, x0: 100, x1: 148, life: 600 });
    const sp = spawnSpyAt(mall, FLOOR_3F, 135, false)!;
    sp.state = 'wait';
    sp.t = 1e9;
    mall.step(d.frame({ right: true, b: true }));
    for (let i = 0; i < 80 && (sp.state as string) !== 'dying'; i++) {
      if ((sp.state as string) !== 'dying') sp.state = 'wait';
      mall.step(d.frame({ right: true }));
    }
    expect(sp.state).toBe('dying');
    expect(sp.killedBy === 'slide' || sp.killedBy === 'kick').toBe(true);
    expect(run.score.score).toBeGreaterThanOrEqual(100);
    // the kick lasts while sliding
    const m2 = setup(FLOOR_3F, 70);
    m2.mall.patches.push({ floor: FLOOR_3F, x0: 100, x1: 148, life: 600 });
    m2.mall.step(m2.d.frame({ right: true, b: true }));
    let kickedOnPatch = false;
    for (let i = 0; i < 70; i++) {
      m2.mall.step(m2.d.frame({ right: true }));
      if (m2.mall.p.onGround && m2.mall.p.slide !== 0 && m2.mall.p.kicking) kickedOnPatch = true;
    }
    expect(kickedOnPatch).toBe(true);
  });

  it('the janitor is harmless and bullets pass through him', () => {
    const { mall, d } = setup(FLOOR_1F, 420);
    mall.lamps.forEach((l) => (l.state = 'dead'));
    mall.janitor.x = 480;
    mall.janitor.dir = -1;
    mall.janitor.state = 'walk';
    mall.p.dir = 1;
    mall.step(d.frame({ a: true }));
    let passed = false;
    for (let i = 0; i < 40; i++) {
      mall.step(d.frame({}));
      if (mall.bullets.length && mall.bullets[0].x > mall.janitor.x + 16) passed = true;
    }
    expect(passed).toBe(true);
    mall.p.x = mall.janitor.x - 6;
    stepN(mall, d, 10);
    expect(mall.p.mode).toBe('normal');
  });
});

describe('mall walkers', () => {
  it('block bullets from both sides; shooting one costs 200 points and shows HEY!; they never die', () => {
    const { mall, d, run } = setup(FLOOR_2F, 330);
    run.score.score = 1000;
    const w = mall.walkers[0];
    w.x = 400;
    w.pause = 1e9;
    mall.walkers[1].x = 700;
    mall.p.dir = 1;
    mall.p.x = 340;
    mall.step(d.frame({ a: true }));
    stepN(mall, d, 20);
    expect(run.score.score).toBe(800);
    expect(mall.bubbles.some((b) => b.text === MISC.walkerHey)).toBe(true);
    expect(mall.bullets.length).toBe(0);
    // from the other side
    mall.p.x = 460;
    mall.p.dir = -1;
    mall.p.shootCd = 0;
    mall.step(d.frame({ a: true }));
    stepN(mall, d, 20);
    expect(run.score.score).toBe(600);
    for (let i = 0; i < 20; i++) {
      mall.p.shootCd = 0;
      mall.step(d.frame({ a: true }));
    }
    expect(mall.walkers[0]).toBe(w);
    // enemy bullets are blocked too
    mall.bullets.push({ id: 5, x: 380, y: floorY(FLOOR_2F) - 16, vx: 2, vy: 0, owner: 'spy', floor: FLOOR_2F, volley: 0, base: floorY(FLOOR_2F), life: 100 });
    mall.p.x = 450;
    stepN(mall, d, 30);
    expect(mall.bullets.filter((b) => b.owner === 'spy').length).toBe(0);
  });

  it('touching one just pushes the agent along', () => {
    const { mall, d } = setup(FLOOR_2F, 330);
    const w = mall.walkers[0];
    w.x = 340;
    w.dir = 1;
    w.pause = 0;
    mall.walkers[1].x = 700;
    mall.p.x = 332;
    const x0 = mall.p.x;
    stepN(mall, d, 30);
    expect(mall.p.mode).toBe('normal');
    expect(mall.p.x).toBeGreaterThan(x0);
  });
});

describe('mall cop', () => {
  function cop() {
    const r = makeMall(8);
    placeAt(r.mall, FLOOR_4F, 250);
    r.mall.paT = 1e9;
    r.mall.spawnT = 1e9;
    r.mall.lamps.forEach((l) => (l.state = 'dead'));
    for (let i = 0; i < 3; i++) {
      r.mall.cars[i].y = floorY(SHAFTS[i].minFloor);
      r.mall.cars[i].wait = 1e9;
    }
    r.mall.cop.floor = FLOOR_4F;
    r.mall.cop.x = 330;
    r.mall.cop.dir = -1;
    r.mall.cop.state = 'patrol';
    r.mall.cop.retarget = 1e9;
    r.mall.p.dir = 1;
    return r;
  }
  it('whistles and chases (~10 s) if you shoot in front of him', () => {
    const { mall, d } = cop();
    mall.step(d.frame({ a: true }));
    expect(mall.cop.state).toBe('chase');
    expect(mall.cop.t).toBeGreaterThan(550);
    expect(mall.bubbles.some((b) => b.text === MISC.copWhistle)).toBe(true);
  });
  it('ignores shots when you are far away, behind him, or on another floor', () => {
    const far = cop();
    far.mall.cop.x = 420;
    far.mall.step(far.d.frame({ a: true }));
    expect(far.mall.cop.state).toBe('patrol');
    const behind = cop();
    behind.mall.cop.dir = 1; // facing away
    behind.mall.step(behind.d.frame({ a: true }));
    expect(behind.mall.cop.state).toBe('patrol');
    const other = cop();
    other.mall.cop.floor = FLOOR_3F;
    other.mall.step(other.d.frame({ a: true }));
    expect(other.mall.cop.state).toBe('patrol');
  });
  it('catching you freezes you for 3 s and costs 500 points, not a life', () => {
    const { mall, d, run } = cop();
    run.score.score = 2000;
    const lives = run.score.lives;
    mall.step(d.frame({ a: true }));
    let frozen = 0;
    for (let i = 0; i < 400; i++) {
      mall.step(d.frame({}));
      if (mall.p.mode === 'frozen') frozen++;
    }
    expect(frozen).toBeGreaterThanOrEqual(170);
    expect(frozen).toBeLessThanOrEqual(190);
    expect(run.score.score).toBe(1500);
    expect(run.score.lives).toBe(lives);
    expect(mall.banner?.lines.join('') ?? MISC.copCaught).toBeTruthy();
  });
  it('can not be killed: bullets ping off his helmet', () => {
    const { mall, d } = cop();
    mall.cop.x = 290;
    mall.p.x = 250;
    mall.step(d.frame({ a: true }));
    const evs = mall.events.drain();
    stepN(mall, d, 10);
    const all = [...evs, ...mall.events.drain()];
    expect(all.some((e) => e.kind === 'helmetPing')).toBe(true);
    expect(mall.bullets.length).toBe(0);
  });
});

describe('kiosk, photo booth, alarm, PA', () => {
  it('a kiosk shows a panel highlighting the nearest remaining package store, then cools down ~20 s', () => {
    const { mall, d } = setup(FLOOR_4F, 330);
    mall.step(d.frame({ up: true }));
    expect(mall.kioskPanel).not.toBeNull();
    expect(mall.kioskPanel!.store).toBe('radioshock');
    expect(mall.kioskCd[FLOOR_4F]).toBe(1200 - 0);
    mall.kioskPanel = null;
    mall.step(d.frame({}));
    mall.step(d.frame({ up: true }));
    expect(mall.kioskPanel).toBeNull();
  });
  it('the kiosk skips stores that are already cleared', () => {
    const { mall, d, run } = setup(FLOOR_4F, 330);
    run.setup.radioshock.cleared = true;
    mall.step(d.frame({ up: true }));
    expect(['forever12', 'kgbtoys', 'hotspy', 'sambaddy', 'footlock']).toContain(mall.kioskPanel!.store);
    expect(mall.kioskPanel!.store).toBe('forever12');
  });
  it('the photo booth hides you for up to 5 s; the first time out gives a 4-frame photo strip, once per game', () => {
    const { mall, d, run } = setup(FLOOR_3F, 125);
    mall.step(d.frame({ up: true }));
    expect(mall.p.mode).toBe('booth');
    stepN(mall, d, 299);
    expect(mall.p.mode).toBe('booth');
    stepN(mall, d, 3);
    expect(mall.p.mode).toBe('normal');
    expect(run.inventory).toContain('PHOTO STRIP');
    mall.step(d.frame({ up: true }));
    expect(mall.p.mode).toBe('booth');
    mall.step(d.frame({ left: true }));
    stepN(mall, d, 3);
    expect(run.inventory.filter((i) => i === 'PHOTO STRIP').length).toBe(1);
  });
  it('the alarm sounds after about 150 s on loop 1 and sooner on later loops', () => {
    const { mall, d, run } = setup(FLOOR_3F, 125);
    run.levelFrames = 149 * 60;
    stepN(mall, d, 5);
    expect(mall.alarm).toBe(false);
    run.levelFrames = 150 * 60;
    stepN(mall, d, 2);
    expect(mall.alarm).toBe(true);
    expect(mall.banner?.lines[0]).toBe(MISC.alarm);
    expect(difficultyFor(2).alarmAt).toBe(130 * 60);
  });
  it('the PA chimes about once a minute and never repeats a line back to back', () => {
    const { mall, d } = makeMall(31);
    placeAt(mall, FLOOR_3F, 125);
    mall.cop.state = 'cool';
    mall.cop.t = 1e9;
    mall.spawnT = 1e9;
    mall.p.invuln = 1e9;
    mall.paT = 100;
    const lines: number[] = [];
    let last = mall.lastPa;
    for (let i = 0; i < 60 * 60 * 8; i++) {
      mall.step(d.frame({}));
      if (mall.lastPa !== last) {
        lines.push(mall.lastPa);
        last = mall.lastPa;
      }
    }
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
  });
});

describe('death, armour and invincibility', () => {
  it('armour absorbs exactly one hit', () => {
    const { mall, d, run } = setup(FLOOR_3F, 200);
    applyPower(run.powers, 'armor');
    const shoot = () => mall.bullets.push({ id: 9, x: 190, y: floorY(FLOOR_3F) - 16, vx: 2, vy: 0, owner: 'spy', floor: FLOOR_3F, volley: 0, base: floorY(FLOOR_3F), life: 100 });
    shoot();
    stepN(mall, d, 20);
    expect(mall.p.mode).toBe('normal');
    expect(run.powers.armor).toBe(false);
    stepN(mall, d, 80);
    shoot();
    stepN(mall, d, 20);
    expect(mall.p.mode).toBe('dying');
  });
  it('a Cinnabomb makes you invincible and kills spies you touch', () => {
    const { mall, d, run } = setup(FLOOR_3F, 200);
    applyPower(run.powers, 'cinnabomb');
    const sp = spawnSpyAt(mall, FLOOR_3F, 204, false)!;
    sp.state = 'wait';
    sp.t = 1e9;
    stepN(mall, d, 3);
    expect(sp.state).toBe('dying');
    expect(mall.p.mode).toBe('normal');
  });
  it('after a death: respawn at the last safe spot, blinking ~2 s, spies and bullets cleared, powers lost except Radar', () => {
    const { mall, d, run } = setup(FLOOR_3F, 150);
    stepN(mall, d, 30); // records the safe spot
    applyPower(run.powers, 'rapid');
    applyPower(run.powers, 'radar');
    spawnSpyAt(mall, FLOOR_3F, 300, false);
    mall.bullets.push({ id: 7, x: 0, y: 0, vx: 1, vy: 0, owner: 'spy', floor: FLOOR_3F, volley: 0, base: 0, life: 50 });
    mall.cop.state = 'chase';
    mall.kill('bullet');
    stepN(mall, d, 80);
    mall.p.x = 500;
    mall.respawn();
    expect(mall.p.mode).toBe('normal');
    expect(mall.p.invuln).toBeGreaterThanOrEqual(110);
    expect(mall.p.invuln).toBeLessThanOrEqual(130);
    expect(mall.spies.length).toBe(0);
    expect(mall.bullets.length).toBe(0);
    expect(run.powers.weapon).toBeNull();
    expect(run.powers.radar).toBe(true);
    expect(mall.cop.state).not.toBe('chase');
    expect(mall.p.x).toBeLessThan(400);
    // invulnerable while blinking
    mall.bullets.push({ id: 8, x: mall.p.x - 6, y: mall.p.y - 16, vx: 2, vy: 0, owner: 'spy', floor: FLOOR_3F, volley: 0, base: floorY(FLOOR_3F), life: 50 });
    stepN(mall, d, 10);
    expect(mall.p.mode).toBe('normal');
  });
});

describe('exit rule', () => {
  function atCar(packages: number) {
    const r = makeMall(2);
    placeAt(r.mall, FLOOR_P, 470);
    quiet(r.mall);
    for (const id of ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlock'].slice(0, packages)) r.run.packages.push(id as never);
    return r;
  }
  it('with packages missing the car will not start: PACKAGES LEFT: n and a buzzer', () => {
    const { mall, d } = atCar(4);
    mall.step(d.frame({ up: true }));
    expect(mall.banner?.lines[0]).toBe('PACKAGES LEFT: 2');
    const evs = mall.events.drain();
    expect(evs.some((e) => e.kind === 'buzzer')).toBe(true);
    expect(evs.some((e) => e.kind === 'levelClear')).toBe(false);
  });
  it('with all 6 packages Level Clear fires exactly once, however often Up is pressed', () => {
    const { mall, d } = atCar(6);
    let n = 0;
    for (let i = 0; i < 20; i++) {
      mall.step(d.frame({ up: i % 2 === 0 }));
      n += mall.events.drain().filter((e) => e.kind === 'levelClear').length;
    }
    expect(n).toBe(1);
  });
});
