// Elevator rules (section 5.4): manual cars A/B, the automatic timer car C, calling, crushing, dings, announcements.
import type { PadFrame } from '../../core/pad';
import { FLOORS, type Floor } from '../../data/stores';
import { FLOOR_Y } from '../geometry';
import { FLOOR_ANNOUNCE, SPY_ELEVATOR_LINES } from '../../data/copy';
import { SHAFT_BY_ID, type ShaftLayout } from './layout';
import { bodyH, floorAtY, inColumn, roofY } from './physics';
import type { Car, Ctx } from './types';

export const AUTO_WAIT_FRAMES = 120; // ~2 s
export const CALLED_SPEED = 2;

export function makeCars(): Car[] {
  const mk = (id: 'A' | 'B' | 'C', floor: Floor): Car => ({
    id,
    x: SHAFT_BY_ID[id].x,
    y: FLOOR_Y[floor],
    mode: 'idle',
    moving: false,
    doorsOpen: true,
    level: floor,
    targetY: null,
    calledFloor: null,
    glideDir: 0,
    dy: 0,
    waitFrames: AUTO_WAIT_FRAMES,
    animFrame: 0,
  });
  return [mk('A', 'R'), mk('B', '4F'), mk('C', '2F')];
}

/** Y of the next floor stop in a direction (-1 up, +1 down) strictly beyond y (or y itself if already level). */
export function nextFloorY(sh: ShaftLayout, y: number, dir: -1 | 1): number {
  const ys = sh.floors.map((f) => FLOOR_Y[f]).sort((a, b) => a - b);
  if (dir > 0) {
    for (const fy of ys) if (fy >= y - 0.01) return fy;
    return ys[ys.length - 1];
  }
  for (let i = ys.length - 1; i >= 0; i--) if (ys[i] <= y + 0.01) return ys[i];
  return ys[0];
}

function playerStanding(c: Ctx, car: Car): boolean {
  const p = c.s.player;
  const sh = SHAFT_BY_ID[car.id];
  return p.mode === 'walk' && p.floor !== null && car.level === p.floor && inColumn(sh, p.x, 0);
}

function passesPlayer(c: Ctx, car: Car, ty: number): boolean {
  const p = c.s.player;
  const sh = SHAFT_BY_ID[car.id];
  if (p.mode !== 'walk' || !p.floor || !inColumn(sh, p.x)) return false;
  const py = FLOOR_Y[p.floor];
  return ty > car.y && py > car.y && py <= ty + 0.01 && car.y < py;
}

function near(c: Ctx, car: Car): boolean {
  const p = c.s.player;
  if (p.mode === 'car' && p.carId === car.id) return true;
  const sh = SHAFT_BY_ID[car.id];
  return Math.abs(sh.cx - p.x) <= 300 && Math.abs(car.y - p.y) <= 120;
}

function onStop(c: Ctx, car: Car, rider: boolean): void {
  const sh = SHAFT_BY_ID[car.id];
  car.moving = false;
  car.level = floorAtY(car.y);
  car.doorsOpen = car.level !== null;
  if (near(c, car)) c.sfx('ding');
  if (rider && car.level) {
    const lines = [FLOOR_ANNOUNCE[car.level]];
    c.s.announce = { lines, frames: 150 };
    c.ev({ t: 'banner', lines, frames: 150, kind: 'floor' });
  }
  // cars stopping near the player sometimes release a spy
  const p = c.s.player;
  if (!rider && car.level && p.floor && Math.abs(FLOORS.indexOf(car.level) - FLOORS.indexOf(p.floor)) <= 1 && Math.abs(sh.cx - p.x) <= 200 && c.s.playFrames > 300) {
    if (c.rng.chance(0.22) && c.s.spies.length < c.diff().spyCap) {
      c.spawnSpy(car.level, sh.cx, { line: c.rng.pick(SPY_ELEVATOR_LINES), emerge: false });
    }
  }
}

export function updateCars(c: Ctx, pad: PadFrame): void {
  const s = c.s;
  const p = s.player;
  for (const car of s.cars) {
    const sh = SHAFT_BY_ID[car.id];
    const prevY = car.y;
    const rider = p.mode === 'car' && p.carId === car.id;
    const occupied = rider || playerStanding(c, car);
    const calledTo = car.mode === 'called' ? car.calledFloor : null;
    car.animFrame++;

    if (rider) {
      const up = pad.held.up;
      const down = pad.held.down;
      const dir: -1 | 0 | 1 = up && !down ? -1 : down && !up ? 1 : 0;
      if (dir !== 0) {
        car.mode = 'manual';
        car.glideDir = dir;
        car.targetY = null;
        car.calledFloor = null;
      } else if (car.mode === 'manual') {
        if (floorAtY(car.y) !== null) {
          car.mode = 'idle';
          car.glideDir = 0;
          car.targetY = null;
        } else {
          car.mode = 'glide';
          car.targetY = nextFloorY(sh, car.y, car.glideDir === 0 ? 1 : car.glideDir);
        }
      }
    }

    // nobody driving any more (rider left or died mid-trip): finish gliding to the next floor
    if (!rider && car.mode === 'manual') {
      if (floorAtY(car.y) !== null) {
        car.mode = 'idle';
        car.glideDir = 0;
      } else {
        car.mode = 'glide';
        car.targetY = nextFloorY(sh, car.y, car.glideDir === 0 ? 1 : car.glideDir);
      }
    }

    // the automatic car: waits ~2 s, never leaves on its own while anyone is inside, then picks a random other floor
    if (car.id === 'C' && car.mode === 'idle') {
      if (occupied) car.waitFrames = AUTO_WAIT_FRAMES;
      else if (--car.waitFrames <= 0) {
        const options = sh.floors.filter((f) => car.level !== f && !passesPlayer(c, car, FLOOR_Y[f]));
        if (options.length > 0) {
          const f = c.rng.pick(options);
          car.mode = 'auto';
          car.targetY = FLOOR_Y[f];
          car.calledFloor = null;
        } else car.waitFrames = 30;
      }
    }

    let dy = 0;
    if (car.mode === 'manual') dy = car.glideDir;
    else if (car.mode === 'glide' && car.targetY !== null) {
      const d = car.targetY - car.y;
      dy = Math.sign(d) * Math.min(1, Math.abs(d));
    } else if ((car.mode === 'called' || car.mode === 'auto') && car.targetY !== null) {
      const d = car.targetY - car.y;
      dy = Math.sign(d) * Math.min(CALLED_SPEED, Math.abs(d));
    }
    car.y = Math.min(sh.bottomY, Math.max(sh.topY, car.y + dy));
    car.dy = car.y - prevY;
    if ((car.mode === 'glide' || car.mode === 'called' || car.mode === 'auto') && car.targetY !== null && Math.abs(car.y - car.targetY) < 0.01) {
      car.y = car.targetY;
      car.mode = 'idle';
      car.targetY = null;
      car.calledFloor = null;
      car.glideDir = 0;
      if (car.id === 'C') car.waitFrames = AUTO_WAIT_FRAMES;
    }
    const moved = Math.abs(car.y - prevY) > 0;
    const isMoving = moved && car.mode !== 'idle';
    if (isMoving) {
      if (!car.moving) {
        car.moving = true;
        if (rider) c.sfx('hum');
      }
      car.doorsOpen = false;
      car.level = null;
    } else if (car.moving) {
      onStop(c, car, rider);
    } else {
      car.level = floorAtY(car.y);
      car.doorsOpen = car.level !== null;
    }

    // riders follow the car
    if (rider) {
      p.y = car.y;
      p.floor = car.level;
    } else if (p.mode === 'roof' && p.carId === car.id) {
      p.y = roofY(car);
    }

    if (car.dy > 0) crushBelow(c, car, sh, calledTo);
  }
}

/** A car moving down crushes whoever stands on the grate underneath (unless it was called to that person). */
function crushBelow(c: Ctx, car: Car, sh: ShaftLayout, calledTo: Floor | null): void {
  const p = c.s.player;
  if ((p.mode === 'walk' || p.mode === 'air') && p.floor && inColumn(sh, p.x) && sh.floors.includes(p.floor)) {
    const head = p.y - bodyH(p.duck);
    const suppressed = calledTo !== null && calledTo === p.floor;
    if (!suppressed && car.y > head && car.y <= p.y + 2 && FLOOR_Y[p.floor] - car.y < 60) {
      c.killPlayer('crush');
    }
  }
  for (const sp of c.s.spies) {
    if (sp.state === 'dying' || !inColumn(sh, sp.x) || !sh.floors.includes(sp.floor)) continue;
    const head = sp.y - bodyH(sp.state === 'duck');
    if (car.y > head && car.y <= sp.y + 2 && Math.abs(FLOOR_Y[sp.floor] - sp.y) < 1) {
      c.killSpy(sp, 'crush');
      c.ev({ t: 'shake', frames: 12, mag: 2 });
    }
  }
}
