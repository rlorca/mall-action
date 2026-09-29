import { feetY, MALL_H, WALL_L, WALL_R, FLOORS } from '../world/constants.js';
import { ESCALATORS, ESC_RUN, STORES, doorX, ROOF_ENTRY_X } from '../world/mallLevel.js';
import { stepAir, supportedAt, findLanding, MAX_SAFE_FALL } from '../logic/physics.js';
import { carFloor, doorwayState, inShaftX, CAR_H } from '../logic/elevator.js';
import { walkSpeed, jumpVelocity, resolveHit } from '../logic/powerups.js';
import { slideStep, onWet } from '../logic/npcs.js';

export const STAND_H = 24;
export const DUCK_H = 14;
// Elevator Action entrance: a zip line from the neighbouring skyscraper down to a post on the roof.
// (x0, y0) is where the cable leaves the tower, (x1, y1) where the agent lets go; the agent hangs by the hands,
// so feet are 24 px below the cable.
export const ZIP = { x0: 36, y0: 10, x1: ROOF_ENTRY_X, y1: feetY(0) - 40, slideFrames: 80, landFrames: 14 };
export const INTRO_FRAMES = 120; // upper bound: slide + drop + landing crouch
const HANG = 24;

const clampX = (x) => Math.min(WALL_R - 6, Math.max(WALL_L + 6, x));
export const carById = (world, id) => world.cars.find((c) => c.id === id);

export function createPlayer() {
  return {
    kind: 'player', x: ZIP.x0, y: ZIP.y0 + HANG, w: 10, h: STAND_H, vx: 0, vy: 0, facing: 1,
    floor: null, grounded: false, riding: null, onRoof: null, fallFromY: null,
    mode: 'intro', introPhase: 'slide', introT: 0, duck: false, kick: false, esc: null,
    frozenT: 0, invulnT: 0, hiddenT: 0, dieT: 0, deathCause: null, slideDir: 0, shootT: 0, poseT: 0,
    lastSafe: { x: ROOF_ENTRY_X, floor: 0 },
  };
}

export function placeOnFloor(p, x, floor) {
  Object.assign(p, { x, floor, y: feetY(floor), mode: 'ground', grounded: true, onRoof: null, riding: null, vx: 0, vy: 0, duck: false, kick: false, h: STAND_H, esc: null });
}

function startFall(p) {
  Object.assign(p, { mode: 'air', grounded: false, vy: 0, fallFromY: p.y, floor: null, onRoof: null });
}

// Kill or hurt the player. Shots and contact respect armor / invincibility; crushes, falls and lights always kill.
export function killPlayer(p, cause, state, events) {
  if (p.mode === 'dying' || p.mode === 'intro') return false;
  if (cause === 'shot' || cause === 'contact') {
    if (p.invulnT > 0 || p.mode === 'hidden') return false;
    const r = resolveHit(state.power);
    if (r === 'ignored') return false;
    if (r === 'absorbed') { p.invulnT = 60; events.push({ type: 'sfx', name: 'hurt' }); return false; }
  }
  Object.assign(p, { mode: 'dying', dieT: 90, deathCause: cause, vx: 0, riding: null, duck: false, h: STAND_H });
  events.push({ type: 'sfx', name: cause === 'crush' ? 'crush' : 'death' });
  if (cause === 'crush' || cause === 'light') events.push({ type: 'shake', frames: 12 });
  return true;
}

// Up/Down-pressed interactions while standing. Returns events if something happened, else null.
function tryActions(p, world, state, up) {
  for (const c of world.cars) {
    if (p.floor !== null && inShaftX(c, p.x) && doorwayState(c, p.floor) === 'car') {
      Object.assign(p, { mode: 'car', riding: c.id, x: c.x + c.w / 2, duck: false, h: STAND_H, vx: 0 });
      world.playerCarCmd = 0;
      return [{ type: 'music', name: 'muzak' }];
    }
  }
  if (p.floor === null) return null;
  // call button: standing beside a shaft summons its car to this floor (Elevator Action style)
  for (const c of world.cars) {
    const mid = c.x + c.w / 2;
    if (inShaftX(c, p.x) || Math.abs(p.x - mid) > c.w / 2 + 12 || p.floor < c.minFloor || p.floor > c.maxFloor || carFloor(c) === p.floor) continue;
    if (c.ai) { c.target = p.floor; c.aiTimer = 0; } else c.callTarget = p.floor;
    return [{ type: 'sfx', name: 'blip' }];
  }
  for (const e of ESCALATORS) {
    if (up && p.floor === e.bottomFloor && Math.abs(p.x - e.x) <= 6) {
      Object.assign(p, { mode: 'esc', esc: { e, dir: -1 }, x: e.x, facing: 1, duck: false, h: STAND_H });
      return [];
    }
    if (!up && p.floor === e.topFloor && Math.abs(p.x - (e.x + ESC_RUN)) <= 6) {
      Object.assign(p, { mode: 'esc', esc: { e, dir: 1 }, x: e.x + ESC_RUN, facing: -1, duck: false, h: STAND_H });
      return [];
    }
  }
  if (!up) return null;
  for (const s of STORES) {
    if (s.floor !== p.floor || Math.abs(p.x - doorX(s)) > 8) continue;
    const open = s.role === 'powerup' || (s.role === 'target' && !state.cleared.has(s.id));
    if (open) return [{ type: 'enterStore', storeId: s.id }, { type: 'sfx', name: 'door' }];
  }
  for (const hook of world.upHooks) {
    const r = hook(p, world, state);
    if (r) return r;
  }
  return null;
}

function stepGround(p, pad, world, state, ev) {
  p.grounded = true;
  if (p.frozenT > 0) { p.frozenT--; p.vx = 0; return; }
  const speed = walkSpeed(state.power);
  const cars = world.cars;
  if (p.onRoof) p.y = carById(world, p.onRoof).y - CAR_H;

  const sliding = p.floor !== null && slideStep(world.wet, p, speed);
  if (!sliding) {
    p.kick = false;
    p.vx = pad.held('left') ? -speed : pad.held('right') ? speed : 0;
    if (p.vx) p.facing = Math.sign(p.vx);
  }

  const up = pad.pressed('up'), down = pad.pressed('down');
  if (up || down) {
    const r = tryActions(p, world, state, up);
    if (r) { ev.push(...r); return; }
  }

  p.duck = pad.held('down') && !sliding;
  if (p.duck) p.vx = 0;
  p.h = p.duck ? DUCK_H : STAND_H;

  if (pad.pressed('b') && !p.duck) {
    p.vy = jumpVelocity(state.power);
    p.vx *= 1.5;
    p.kick = p.vx !== 0;
    Object.assign(p, { mode: 'air', grounded: false, fallFromY: p.y, floor: null, onRoof: null, slideDir: 0 });
    ev.push({ type: 'sfx', name: 'jump' });
    return;
  }

  p.x = clampX(p.x + p.vx);
  if (p.onRoof) {
    const car = carById(world, p.onRoof);
    if (!inShaftX(car, p.x)) {
      // step off the roof onto a floor level with it (the roof sits 8 px below the floor above the car)
      let f = -1;
      for (let i = 0; i < FLOORS; i++) if (feetY(i) <= p.y && feetY(i) >= p.y - 8 && supportedAt(p.x, i, cars)) f = i;
      if (f >= 0) Object.assign(p, { onRoof: null, floor: f, y: feetY(f) });
      else startFall(p);
    }
  } else if (!supportedAt(p.x, p.floor, cars)) {
    startFall(p);
  } else if (!cars.some((c) => inShaftX(c, p.x) && doorwayState(c, p.floor) !== 'none')) {
    p.lastSafe = { x: p.x, floor: p.floor };
  }
}

function stepAirMode(p, world, state, ev) {
  const prevY = p.y;
  stepAir(p);
  p.x = clampX(p.x);
  if (p.vy > 0) {
    const land = findLanding(p.x, prevY, p.y, world.cars);
    if (land) {
      p.y = land.y;
      if (p.y - p.fallFromY > MAX_SAFE_FALL) { killPlayer(p, 'fall', state, ev); return; }
      // a jump-kick that lands on a wet patch keeps the kick active while sliding
      const keepKick = p.kick && land.floor !== null && onWet(world.wet, { x: p.x, floor: land.floor });
      Object.assign(p, { mode: 'ground', grounded: true, floor: land.floor, onRoof: land.roof, vx: 0, vy: 0, kick: keepKick, slideDir: keepKick ? p.facing : 0 });
      return;
    }
  }
  if (p.y > MALL_H) killPlayer(p, 'fall', state, ev);
}

function stepCar(p, pad, world, ev) {
  const car = carById(world, p.riding);
  world.playerCarCmd = pad.held('up') ? -1 : pad.held('down') ? 1 : 0;
  p.y = car.y;
  p.floor = carFloor(car);
  if (p.floor !== null && (pad.pressed('left') || pad.pressed('right'))) {
    const dir = pad.pressed('left') ? -1 : 1;
    Object.assign(p, { mode: 'ground', grounded: true, riding: null, x: car.x + car.w / 2 + dir * 16, facing: dir });
    world.playerCarCmd = 0;
    ev.push({ type: 'music', name: world.alarm ? 'mallAlarm' : 'mall' });
  }
}

function stepEscalator(p) {
  const { e, dir } = p.esc;
  p.x -= dir; p.y += dir;
  const top = e.x + ESC_RUN;
  if (dir < 0 && p.x >= top) placeOnFloor(p, top, e.topFloor);
  if (dir > 0 && p.x <= e.x) placeOnFloor(p, e.x, e.bottomFloor);
}

// slide down the cable (hanging by the hands) → let go and drop onto the roof → landing crouch → control
function stepIntro(p, ev) {
  if (p.introPhase === 'slide') {
    if (p.introT === 0) ev.push({ type: 'sfx', name: 'slide' });
    const k = p.introT / ZIP.slideFrames;
    p.x = ZIP.x0 + (ZIP.x1 - ZIP.x0) * k;
    p.y = ZIP.y0 + (ZIP.y1 - ZIP.y0) * k + HANG;
    if (++p.introT > ZIP.slideFrames) Object.assign(p, { introPhase: 'drop', vy: 0, vx: 0.5 });
  } else if (p.introPhase === 'drop') {
    p.vy = Math.min(p.vy + 0.25, 4); p.y += p.vy; p.x += p.vx;
    if (p.y >= feetY(0)) {
      Object.assign(p, { y: feetY(0), introPhase: 'land', introT: ZIP.landFrames, duck: true, h: DUCK_H });
      ev.push({ type: 'sfx', name: 'jump' });
    }
  } else if (--p.introT <= 0) {
    placeOnFloor(p, Math.round(p.x), 0);
    p.lastSafe = { x: p.x, floor: 0 };
  }
}

export function stepPlayer(p, pad, world, state) {
  const ev = [];
  if (p.invulnT > 0) p.invulnT--;
  switch (p.mode) {
    case 'intro': stepIntro(p, ev); break;
    case 'ground': stepGround(p, pad, world, state, ev); break;
    case 'air': stepAirMode(p, world, state, ev); break;
    case 'car': stepCar(p, pad, world, ev); break;
    case 'esc': stepEscalator(p); break;
    case 'dying':
      if (p.dieT > 0 && --p.dieT === 0) ev.push({ type: 'playerDied', cause: p.deathCause });
      break;
    case 'hidden': {
      const leave = ['left', 'right', 'up', 'down'].some((b) => pad.pressed(b));
      if (--p.hiddenT <= 0 || leave) {
        p.mode = 'ground';
        if (!state.photoTaken) { state.photoTaken = true; state.inventory.push('PHOTO STRIP'); ev.push({ type: 'photo' }); }
      }
      break;
    }
    default: break;
  }
  return ev;
}
