import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../src/core/events';
import { FLOOR_ANNOUNCE } from '../src/data/copy';
import { FLOORS, type Floor } from '../src/data/stores';
import { FLOOR_Y } from '../src/game/geometry';
import { SHAFTS } from '../src/game/mall/layout';
import { banners, makeWorld, parkCar, place, quiet, sfxCount, stepFrames } from './mall-helpers';

const A = 0;
const C = 2;

describe('elevators: driving', () => {
  it('holding Down drives 1 px/frame; doors are closed while moving and open when stopped', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    stepFrames(w, 1, { down: true });
    expect(w.s.player.mode).toBe('car');
    const y0 = w.s.cars[A].y;
    stepFrames(w, 10, { down: true });
    expect(w.s.cars[A].y - y0).toBe(10);
    expect(w.s.cars[A].doorsOpen).toBe(false);
    expect(w.s.cars[A].moving).toBe(true);
    expect(w.s.player.y).toBe(w.s.cars[A].y);
    // release between floors: glides on in the same direction and stops exactly level
    stepFrames(w, 60, {});
    expect(w.s.cars[A].y).toBe(FLOOR_Y['4F']);
    expect(w.s.cars[A].doorsOpen).toBe(true);
    expect(w.s.cars[A].level).toBe('4F');
    expect(w.s.player.floor).toBe('4F');
  });

  it('releasing between floors while going UP glides up to the next floor', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '2F');
    place(w, '2F', 216);
    stepFrames(w, 1, { up: true });
    stepFrames(w, 20, { up: true });
    stepFrames(w, 100, {});
    expect(w.s.cars[A].y).toBe(FLOOR_Y['3F']);
  });

  it('emits exactly ONE ding per stop (riding a full trip and gliding)', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    const buf = new EventBuffer();
    stepFrames(w, 1, { down: true }, buf);
    stepFrames(w, 17, { down: true }, buf);
    stepFrames(w, 80, {}, buf);
    expect(w.s.cars[A].level).toBe('4F');
    expect(sfxCount(buf, 'ding')).toBe(1);
  });

  it('holding a direction at the shaft end does not repeat the ding', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    const buf = new EventBuffer();
    stepFrames(w, 600, { down: true }, buf); // R -> 2F (bottom) and keep holding
    expect(w.s.cars[A].level).toBe('2F');
    expect(sfxCount(buf, 'ding')).toBe(1);
    const buf2 = new EventBuffer();
    stepFrames(w, 300, { up: true }, buf2); // all the way up, keep holding at the top
    expect(w.s.cars[A].y).toBe(FLOOR_Y.R);
    expect(sfxCount(buf2, 'ding')).toBe(1);
    // the rider on top of an open car is fine (inside, not crushed)
    expect(w.progress.lives).toBe(3);
  });

  it('stopping exactly level (release on the floor) stops immediately with one ding', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    const buf = new EventBuffer();
    stepFrames(w, 1, { down: true }, buf);
    let i = 0;
    while (w.s.cars[A].y < FLOOR_Y['4F'] && i++ < 200) stepFrames(w, 1, { down: true }, buf);
    stepFrames(w, 1, {}, buf);
    stepFrames(w, 30, {}, buf);
    expect(w.s.cars[A].y).toBe(FLOOR_Y['4F']);
    expect(sfxCount(buf, 'ding')).toBe(1);
  });

  it('getting out: Left/Right only while stopped at a floor', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    stepFrames(w, 1, { down: true });
    stepFrames(w, 5, { down: true, left: true }); // moving: cannot exit
    expect(w.s.player.mode).toBe('car');
    stepFrames(w, 80, {});
    expect(w.s.cars[A].level).toBe('4F');
    stepFrames(w, 30, { left: true });
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.floor).toBe('4F');
    expect(w.s.player.x).toBeLessThan(200);
  });

  it('a floor announcement banner appears when a car stops with the player inside; music switches to elevator and back', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    const buf = new EventBuffer();
    stepFrames(w, 1, { down: true }, buf);
    stepFrames(w, 10, { down: true }, buf);
    expect(w.s.rideHum).toBe(true);
    stepFrames(w, 80, {}, buf);
    expect(banners(buf).some((l) => l[0] === FLOOR_ANNOUNCE['4F'])).toBe(true);
    expect(buf.events.some((e) => e.t === 'music' && e.name === 'elevator')).toBe(true);
    expect(w.s.rideHum).toBe(false);
    stepFrames(w, 30, { left: true }, buf);
    const musics = buf.events.filter((e) => e.t === 'music').map((e) => (e as { name: string }).name);
    expect(musics[musics.length - 1]).toBe('mall');
  });

  it('every stop near the player dings (a called car included)', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'B', 'P');
    place(w, '4F', 350);
    w.s.cars[C].waitFrames = 1e9; // keep the automatic car quiet
    const buf = stepFrames(w, 1, { up: true });
    stepFrames(w, 300, {}, buf);
    expect(w.s.cars[1].level).toBe('4F');
    expect(sfxCount(buf, 'ding')).toBe(1);
  });
});

describe('elevators: openings, crushing, roofs', () => {
  it('a car above the opening: you can stand on the grate, and it crushes you if it comes down', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '4F');
    place(w, '3F', 216);
    stepFrames(w, 10, {});
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.y).toBe(FLOOR_Y['3F']);
    // the car comes down (sent to 2F, so it is NOT the car we called)
    const car = w.s.cars[A];
    car.mode = 'called';
    car.calledFloor = '2F';
    car.targetY = FLOOR_Y['2F'];
    stepFrames(w, 60, {});
    expect(w.s.player.mode === 'dying' || w.progress.lives < 3).toBe(true);
    expect(w.s.player.deathCause).toBe('crush');
    expect(w.progress.lives).toBe(2);
  });

  it('a car coming down crushes a spy on the grate for 300 points', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '4F');
    place(w, '4F', 400);
    const sp = w.spawnSpy('3F', 216, { emerge: false })!;
    sp.nextFireAge = 1e9;
    sp.state = 'wait';
    sp.waitFrames = 1e6;
    const car = w.s.cars[A];
    car.mode = 'called';
    car.calledFloor = '2F';
    car.targetY = FLOOR_Y['2F'];
    const score = w.progress.score;
    stepFrames(w, 60, {});
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBe(score + 300);
  });

  it('riding the roof: a car rises into the shaft top and crushes you', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'C', '4F');
    place(w, '4F', 400);
    const c = w.s.cars[C];
    w.s.player.mode = 'roof';
    w.s.player.carId = 'C';
    w.s.player.x = 536;
    w.s.player.y = c.y - 36;
    w.s.player.floor = null;
    c.mode = 'auto';
    c.targetY = FLOOR_Y.R;
    stepFrames(w, 80, {});
    expect(w.s.player.deathCause).toBe('crush');
    expect(w.progress.lives).toBe(2);
  });

  it('standing on a car roof rides it down safely', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'C', '4F');
    const c = w.s.cars[C];
    w.s.player.mode = 'roof';
    w.s.player.carId = 'C';
    w.s.player.x = 536;
    w.s.player.y = c.y - 36;
    w.s.player.floor = null;
    w.s.player.safeX = 400;
    c.mode = 'auto';
    c.targetY = FLOOR_Y['2F'];
    stepFrames(w, 30, {});
    expect(w.s.player.mode).toBe('roof');
    expect(w.s.player.y).toBe(c.y - 36);
    expect(c.y).toBeGreaterThan(FLOOR_Y['4F']);
    stepFrames(w, 100, {});
    expect(c.y).toBe(FLOOR_Y['2F']);
    expect(w.s.player.mode).toBe('roof');
  });

  it('a roof rider can jump out onto the floor above', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '3F');
    const c = w.s.cars[A];
    w.s.player.mode = 'roof';
    w.s.player.carId = 'A';
    w.s.player.x = 216;
    w.s.player.y = c.y - 36;
    w.s.player.floor = null;
    stepFrames(w, 1, { b: true, right: true });
    stepFrames(w, 60, { right: true });
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.floor).toBe('4F');
    expect(w.progress.lives).toBe(3);
  });
});

describe('elevators: calling', () => {
  it('Up next to an empty opening (car above) calls the car; it arrives level', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, '3F', 190);
    stepFrames(w, 1, { up: true });
    stepFrames(w, 200, {});
    expect(w.s.cars[A].level).toBe('3F');
    expect(w.progress.lives).toBe(3);
  });

  it('Down next to a pit (car below) calls the car up', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '2F');
    place(w, '4F', 190);
    stepFrames(w, 1, { down: true });
    stepFrames(w, 200, {});
    expect(w.s.cars[A].level).toBe('4F');
    expect(w.s.player.mode).toBe('walk');
  });

  it('standing still ~30 frames near an opening calls a car automatically', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '2F');
    place(w, '3F', 190);
    stepFrames(w, 25, {});
    expect(w.s.cars[A].mode).toBe('idle');
    stepFrames(w, 10, {});
    expect(w.s.cars[A].mode).toBe('called');
    stepFrames(w, 100, {});
    expect(w.s.cars[A].level).toBe('3F');
  });

  it('a car called to you picks you up instead of crushing you (standing on the grate)', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, '3F', 216);
    stepFrames(w, 200, {}); // standing still on the grate: auto-call
    expect(w.s.cars[A].level).toBe('3F');
    expect(w.s.player.mode).toBe('walk');
    expect(w.progress.lives).toBe(3);
    // and now we can ride it
    stepFrames(w, 1, { down: true });
    expect(w.s.player.mode).toBe('car');
    stepFrames(w, 80, { down: true });
    expect(w.s.cars[A].level).toBe('2F');
  });

  it('Up while the car is level at your floor boards it', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'B', '3F');
    place(w, '3F', 350);
    stepFrames(w, 1, { down: true });
    expect(w.s.player.mode).toBe('car');
    expect(w.s.player.x).toBe(SHAFTS[1].cx);
  });
});

describe('elevators: automatic car C', () => {
  it('waits ~2 s then travels to a random other served floor (never the same, always a served floor)', () => {
    const served = new Set<Floor>(SHAFTS[2].floors);
    const targets = new Set<Floor>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = makeWorld(seed);
      quiet(w);
      const c = w.s.cars[C];
      parkCar(w, 'C', '2F');
      place(w, 'P', 100);
      stepFrames(w, 100, {});
      expect(c.level).toBe('2F'); // still waiting
      stepFrames(w, 40, {});
      expect(c.mode).toBe('auto');
      let guard = 0;
      while (c.mode !== 'idle' && guard++ < 400) stepFrames(w, 1, {});
      expect(c.level).not.toBe('2F');
      expect(c.level && served.has(c.level)).toBe(true);
      targets.add(c.level!);
    }
    expect(targets.size).toBeGreaterThan(1);
  });

  it('never leaves while the player is inside it', () => {
    const w = makeWorld(7);
    quiet(w);
    parkCar(w, 'C', '3F');
    place(w, '3F', 536); // standing inside the open car
    stepFrames(w, 900, {});
    expect(w.s.cars[C].y).toBe(FLOOR_Y['3F']);
    // riding it (car mode, not pressing) also keeps it there
    stepFrames(w, 1, { up: true });
    expect(w.s.player.mode).toBe('car');
    stepFrames(w, 1, {});
    w.s.cars[C].mode = 'idle';
    w.s.cars[C].moving = false;
    w.s.cars[C].y = FLOOR_Y['3F'];
    stepFrames(w, 600, {});
    expect(w.s.cars[C].y).toBe(FLOOR_Y['3F']);
  });

  it('keeps its timer when stranded: it always resumes trips', () => {
    const w = makeWorld(11);
    quiet(w);
    place(w, 'P', 100);
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      stepFrames(w, 1, {});
      seen.add(w.s.cars[C].y);
    }
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('elevators: never stranded', () => {
  const cases: { id: 'A' | 'B' | 'C'; car: number; floor: Floor; carAt: Floor }[] = [];
  for (const sh of SHAFTS) {
    const i = sh.id === 'A' ? 0 : sh.id === 'B' ? 1 : 2;
    for (const f of sh.floors) for (const g of sh.floors) cases.push({ id: sh.id, car: i, floor: f, carAt: g });
  }
  it('from every opening, with the car at every possible stop, pressing Up/Down calls it', () => {
    for (const cs of cases) {
      const sh = SHAFTS[cs.car];
      const w = makeWorld(5);
      quiet(w);
      parkCar(w, cs.id, cs.carAt);
      // keep the other cars out of the way
      place(w, cs.floor, sh.x - 8);
      let arrived = false;
      stepFrames(w, 1, { up: true });
      if (cs.floor === cs.carAt) {
        expect(w.s.player.mode, `${cs.id} boards a level car`).toBe('car'); // the press boards it
        continue;
      }
      for (let i = 0; i < 400 && !arrived; i++) {
        stepFrames(w, 1, {});
        if (w.s.cars[cs.car].level === cs.floor) arrived = true;
        expect(w.s.player.mode === 'dying').toBe(false);
      }
      expect(arrived, `${cs.id} car at ${cs.carAt}, caller at ${cs.floor}`).toBe(true);
    }
  });

  it('and just standing still calls it too', () => {
    for (const cs of cases) {
      const sh = SHAFTS[cs.car];
      const w = makeWorld(6);
      quiet(w);
      parkCar(w, cs.id, cs.carAt);
      place(w, cs.floor, sh.x + sh.w + 8);
      let arrived = false;
      for (let i = 0; i < 400 && !arrived; i++) {
        stepFrames(w, 1, {});
        if (w.s.cars[cs.car].level === cs.floor) arrived = true;
      }
      expect(arrived, `${cs.id} car at ${cs.carAt}, waiter at ${cs.floor}`).toBe(true);
    }
  });

  it('every floor of every shaft is reachable by riding (ride from each floor to each other floor)', () => {
    for (const sh of SHAFTS) {
      const i = sh.id === 'A' ? 0 : sh.id === 'B' ? 1 : 2;
      for (const from of sh.floors)
        for (const to of sh.floors) {
          if (from === to) continue;
          const w = makeWorld(9);
          quiet(w);
          parkCar(w, sh.id, from);
          place(w, from, sh.cx);
          const dir = FLOORS.indexOf(to) > FLOORS.indexOf(from) ? 'down' : 'up';
          stepFrames(w, 1, { [dir]: true });
          let n = 0;
          while (w.s.cars[i].y !== FLOOR_Y[to] && n++ < 500) stepFrames(w, 1, w.s.cars[i].y === FLOOR_Y[to] ? {} : { [dir]: true });
          stepFrames(w, 5, {});
          expect(w.s.cars[i].level, `${sh.id} ${from}->${to}`).toBe(to);
        }
    }
  });
});
