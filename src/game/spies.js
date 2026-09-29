import { feetY, WALL_L, WALL_R } from '../world/constants.js';
import { STORES, doorX } from '../world/mallLevel.js';
import { supportedAt } from '../logic/physics.js';
import { doorwayState, inShaftX } from '../logic/elevator.js';
import { slideStep } from '../logic/npcs.js';
import { addScore } from '../logic/rules.js';
import { rollSpyDrop } from '../logic/loot.js';
import { STAND_H, DUCK_H } from './mallPlayer.js';

export const AIM_FRAMES = 32;      // telegraph before a shot: time to duck, jump or shoot first
export const FIRST_SHOT_DELAY = 110; // frames after stepping out before a spy may start aiming

export function createSpy(x, floor, from) {
  return {
    kind: 'spy', x, y: feetY(floor), w: 10, h: STAND_H, vx: 0, vy: 0, facing: -1, floor,
    grounded: true, riding: null, onRoof: null, fallFromY: null, slideDir: 0,
    state: 'emerge', t: 20, fireT: 90, aimHigh: false, from, dodge: true, dodgeT: 0, wanderT: 180, waitX: null,
  };
}

export const alive = (s) => s.state !== 'dead';

export function killSpy(world, spy, scoreKey, state, events) {
  if (!alive(spy)) return false;
  Object.assign(spy, { state: 'dead', t: 24, h: STAND_H });
  if (scoreKey) {
    const { pts } = addScore(state, scoreKey);
    events.push({ type: 'score', pts, x: spy.x, y: spy.y - 30 }, { type: 'sfx', name: 'hurt' });
  }
  const drop = rollSpyDrop(state.rng);
  if (drop) world.pickups.push({ id: drop, x: spy.x, y: spy.y - 20, floor: spy.floor, vy: -2, t: 600 });
  return true;
}

function spawnSpy(world, state, rng, diff, events) {
  const p = world.player;
  if (p.floor === null || world.spies.filter(alive).length >= diff.spyCap) return;
  const doors = STORES.filter((s) => (s.role === 'powerup' || (s.role === 'target' && !state.cleared.has(s.id)))
    && Math.abs(s.floor - p.floor) <= 1 && Math.abs(doorX(s) - p.x) >= 64 && Math.abs(doorX(s) - p.x) <= 200);
  if (!doors.length) return;
  const s = rng.pick(doors);
  const spy = createSpy(doorX(s), s.floor, 'door');
  spy.fireT = FIRST_SHOT_DELAY + rng.int(0, 40);
  world.spies.push(spy);
  events.push({ type: 'sfx', name: 'door' });
}

// A car stopping near the player may let a spy out.
export function spyFromCar(world, car, floor, rng, diff) {
  const p = world.player;
  if (floor !== p.floor || Math.abs(car.x + car.w / 2 - p.x) > 200 || !rng.chance(0.4)) return;
  if (world.spies.filter(alive).length >= diff.spyCap) return;
  const spy = createSpy(car.x + car.w / 2, floor, 'car');
  spy.fireT = FIRST_SHOT_DELAY + rng.int(0, 40);
  world.spies.push(spy);
}

function tryMove(world, s, speed) {
  const nx = s.x + s.facing * speed;
  const blocked = nx < WALL_L + 8 || nx > WALL_R - 8 || !supportedAt(nx + s.facing * 6, s.floor, world.cars);
  if (blocked) { s.facing *= -1; return; }
  s.x = nx;
}

function bulletIncoming(world, s) {
  return world.bullets.some((b) => b.owner === 'player' && b.floor === s.floor && Math.sign(s.x - b.x) === Math.sign(b.vx) && Math.abs(s.x - b.x) < 40);
}

export function stepSpies(world, state, rng, diff) {
  const events = [];
  const p = world.player;
  if (--world.spawnT <= 0) { world.spawnT = diff.spawnInterval; spawnSpy(world, state, rng, diff, events); }

  for (const s of world.spies) {
    if (s.state === 'dead') { s.t--; continue; }
    if (!supportedAt(s.x, s.floor, world.cars)) { Object.assign(s, { state: 'dead', t: 24 }); continue; } // fell down a shaft
    if (s.state === 'emerge') { if (--s.t <= 0) s.state = 'walk'; continue; }
    if (slideStep(world.wet, s, diff.spySpeed)) { s.x = Math.min(WALL_R - 8, Math.max(WALL_L + 8, s.x + s.vx)); continue; }

    const sees = p.floor === s.floor && Math.abs(p.x - s.x) < 160 && !['hidden', 'dying', 'intro', 'selfie'].includes(p.mode);
    // one duck decision per incoming volley (10%), then a cooldown — most straight shots should land
    if (s.dodgeT > 0) s.dodgeT--;
    if (s.dodge && s.dodgeT === 0 && s.state === 'walk' && bulletIncoming(world, s)) {
      s.dodgeT = 90;
      if (rng.chance(0.1)) Object.assign(s, { state: 'duck', t: 30, h: DUCK_H });
    }
    switch (s.state) {
      case 'duck':
        if (--s.t <= 0) Object.assign(s, { state: 'walk', h: STAND_H });
        break;
      case 'aim':
        if (--s.t <= 0) {
          world.enemyBullets.push({ x: s.x + s.facing * 8 - (s.facing < 0 ? 4 : 0), y: s.y - (s.aimHigh ? 18 : 6), vx: 2 * s.facing, vy: 0, floor: s.floor, w: 4, h: 2, owner: 'enemy', life: 120 });
          events.push({ type: 'sfx', name: 'enemyShot' });
          Object.assign(s, { state: 'walk', fireT: diff.fireInterval });
        }
        break;
      case 'wait':
        if (--s.t <= 0) s.state = 'walk';
        break;
      case 'goWait':
        s.facing = Math.sign(s.waitX - s.x) || s.facing;
        if (Math.abs(s.waitX - s.x) <= diff.spySpeed) Object.assign(s, { x: s.waitX, state: 'wait', t: 180 });
        else s.x += s.facing * diff.spySpeed;
        break;
      default: // walk
        if (sees) {
          s.facing = p.x < s.x ? -1 : 1;
          if (Math.abs(p.x - s.x) > 40) tryMove(world, s, diff.spySpeed);
          if (--s.fireT <= 0) Object.assign(s, { state: 'aim', t: AIM_FRAMES, aimHigh: rng.chance(0.5) });
        } else {
          tryMove(world, s, diff.spySpeed);
          if (--s.wanderT <= 0) { s.wanderT = rng.int(120, 240); if (rng.chance(0.5)) s.facing *= -1; }
          if (rng.chance(0.01)) {
            const car = world.cars.find((c) => doorwayState(c, s.floor) === 'solid' && Math.abs(c.x + c.w / 2 - s.x) < 64 && !inShaftX(c, s.x));
            if (car) Object.assign(s, { state: 'goWait', waitX: car.x + car.w / 2 });
          }
        }
    }
  }
  world.spies = world.spies.filter((s) => s.state !== 'dead' || s.t > 0);
  return events;
}
