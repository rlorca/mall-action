import { ELEVATOR_EXIT_LINES, LAST_WORDS } from '../../content/copy';
import { SHAFTS, floorY } from '../../content/layout';
import { DOOR_W, DOOR_X, STORES, type StoreDef } from '../../content/stores';
import { FOOD_POWERS, NON_FOOD_POWERS } from '../../content/powerups';
import { canEnterStore } from '../levelstate';
import { POINTS } from '../run';
import type { Car, Spy } from './types';
import { PLAYER_H, PLAYER_HALF_W, SPY_BULLET_SPEED, SPY_H, SPY_HALF_W } from './types';
import { nearestFloor, openingState, shaftNear } from './geometry';
import type { MallWorld } from './world';

/** First shot no sooner than ~2 s after a spy appears. */
export const FIRST_SHOT_DELAY = 120;
/** The aiming pose (telegraph) lasts about half a second. */
export const AIM_FRAMES = 30;
/** Chance a spy ducks an incoming volley (decided once per volley). */
export const DODGE_CHANCE = 0.1;
export const SIGHT_RANGE = 160;
export const STOP_DISTANCE = 40;
export const EMERGE_FRAMES = 24;
export const DEATH_ANIM_FRAMES = 24; // ~0.4 s
const DUCK_FRAMES = 26;
const VOLLEY_WINDOW = 45;
const LAST_WORDS_CHANCE = 0.35;
const DROP_CHANCE = 0.05;
const CAR_SPAWN_CHANCE = 0.25;
const WAIT_CHANCE = 0.12;

export function newSpy(w: MallWorld, x: number, floor: number, mode: Spy['mode'], from: StoreDef | null = null): Spy {
  const rng = w.spyRng;
  return {
    id: w.nextSpyId++,
    x,
    y: floorY(floor),
    face: rng.chance(0.5) ? 1 : -1,
    floor,
    mode,
    t: 0,
    fireCd: FIRST_SHOT_DELAY + rng.between(0, 60),
    aimHigh: rng.chance(0.5),
    anim: 0,
    wanderDir: 0,
    wanderT: 0,
    duckT: 0,
    volleyT: 0,
    emergeFrom: from ? from.id : null,
    deathT: 0,
    killedBy: null,
    waitShaft: null,
    age: 0,
  };
}

/** Cars stopping near the player sometimes let a spy out. */
export function spawnSpyAtCar(w: MallWorld, car: Car, floor: number): void {
  if (w.intro || !w.playerAlive()) return;
  if (w.liveSpies() >= w.diff.spyCap) return;
  if (floor < 1 || floor > 5) return;
  const cx = car.def.x + car.def.w / 2;
  const p = w.player;
  if (Math.abs(cx - p.x) > 200 || Math.abs(floor - w.playerFloor()) > 1) return;
  if (p.mode === 'ride' && p.car === car.id) return;
  if (!w.spyRng.chance(CAR_SPAWN_CHANCE * Math.min(2, w.spawnRate()))) return;
  const s = newSpy(w, cx, floor, 'emerge');
  s.face = p.x < cx ? -1 : 1;
  w.spies.push(s);
  w.say(cx, s.y - 28, w.spyRng.pick(ELEVATOR_EXIT_LINES), 100);
}

function spawnFromDoor(w: MallWorld): void {
  const p = w.player;
  const pf = w.playerFloor();
  const cands: Array<{ st: StoreDef; x: number }> = [];
  for (const st of STORES) {
    if (Math.abs(st.floor - pf) > 1) continue;
    if (!canEnterStore(w.run.level, st.id)) continue;
    const x = st.x + DOOR_X + DOOR_W / 2;
    const d = Math.abs(x - p.x);
    if (d >= 64 && d <= 200) cands.push({ st, x });
  }
  if (cands.length === 0) return;
  const c = w.spyRng.pick(cands);
  const s = newSpy(w, c.x, c.st.floor, 'emerge', c.st);
  s.face = p.x < c.x ? -1 : 1;
  w.spies.push(s);
}

/** Spies are hit by bullets inside this box. */
export function spyHitTop(s: Spy): number {
  return s.y - (s.mode === 'duck' ? SPY_H / 2 : SPY_H);
}

function playerFloorForSight(w: MallWorld): number | null {
  const p = w.player;
  if (p.mode === 'ground' && p.floor !== null) return p.floor;
  if (p.mode === 'air' && p.floor === null) {
    const f = nearestFloor(p.y);
    return Math.abs(p.y - floorY(f)) < 30 ? f : null;
  }
  return null;
}

/** Walk toward x; returns true if blocked. */
function walk(w: MallWorld, s: Spy, dir: -1 | 1, speed: number, allowGrate = false): boolean {
  const nx = w.tryMoveX(s.x, s.y, dir * speed, true, allowGrate);
  const moved = nx !== s.x;
  if (moved) {
    s.x = nx;
    s.anim++;
  }
  return !moved;
}

/** Find a shaft opening on the spy's floor that is safe to wait in (a car level or above). */
function pickWaitShaft(w: MallWorld, s: Spy): { id: Spy['waitShaft']; x: number } | null {
  const cands: Array<{ id: Spy['waitShaft']; x: number }> = [];
  for (const sh of SHAFTS) {
    if (s.floor < sh.top || s.floor > sh.bottom) continue;
    const st = openingState(w.car(sh.id), s.floor);
    if (st !== 'here' && st !== 'above') continue;
    const cx = sh.x + sh.w / 2;
    if (Math.abs(cx - s.x) < 140) cands.push({ id: sh.id, x: cx });
  }
  return cands.length ? w.spyRng.pick(cands) : null;
}

export function stepSpies(w: MallWorld): void {
  const p = w.player;
  const run = w.run;
  const rng = w.spyRng;
  const speed = w.spySpeed();
  const pFloor = playerFloorForSight(w);
  const visible = w.playerVisible() && w.playerAlive();

  // ---- spawning
  if (!w.intro && w.frame >= w.nextSpy && visible && w.frame - w.controlFrame >= 300) {
    if (w.liveSpies() < w.diff.spyCap) spawnFromDoor(w);
    const base = 270;
    w.nextSpy = w.frame + Math.max(60, Math.round((base + rng.between(-60, 60)) / w.spawnRate()));
  }

  for (let i = w.spies.length - 1; i >= 0; i--) {
    const s = w.spies[i]!;
    s.t++;
    s.age++;

    // despawn when far away
    if (s.mode !== 'dying' && (Math.abs(s.floor - w.playerFloor()) >= 2 || Math.abs(s.x - p.x) > 420)) {
      w.spies.splice(i, 1);
      continue;
    }

    if (s.mode === 'dying') {
      s.deathT++;
      if (s.deathT === 1 && s.killedBy !== 'crush') {
        // last words (about 35% of kills) and the occasional drop
        if (rng.chance(LAST_WORDS_CHANCE)) w.say(s.x, s.y - 28, rng.pick(LAST_WORDS), 90);
        if (rng.chance(DROP_CHANCE)) dropPowerup(w, s);
      }
      if (s.deathT >= DEATH_ANIM_FRAMES) w.spies.splice(i, 1);
      continue;
    }

    // Left standing over a pit (the car was called away): he falls out of the picture.
    if (s.mode !== 'emerge') {
      for (const sh of SHAFTS) {
        if (s.floor < sh.top || s.floor > sh.bottom) continue;
        if (s.x > sh.x + 4 && s.x < sh.x + sh.w - 4 && openingState(w.car(sh.id), s.floor) === 'pit') {
          w.spies.splice(i, 1);
          s.mode = 'dying';
          break;
        }
      }
      if (s.mode === 'dying' && s.deathT === 0 && !w.spies.includes(s)) continue;
    }

    if (s.mode === 'emerge') {
      if (s.t >= EMERGE_FRAMES) {
        s.mode = 'walk';
        s.t = 0;
      }
      continue;
    }

    if (s.duckT > 0) {
      s.duckT--;
      if (s.duckT === 0 && s.mode === 'duck') s.mode = 'walk';
    }
    if (s.volleyT > 0) s.volleyT--;
    if (s.fireCd > 0) s.fireCd--;

    const dx = p.x - s.x;
    const sees = visible && pFloor === s.floor && Math.abs(dx) <= SIGHT_RANGE;

    // ---- dodge: roll once per incoming volley
    maybeDodge(w, s);

    // ---- touching the agent
    if (visible && s.mode !== 'duck' && Math.abs(p.x - s.x) < SPY_HALF_W + PLAYER_HALF_W && p.y - PLAYER_H < s.y && p.y > s.y - SPY_H) {
      if (p.kick && p.mode === 'air') {
        w.killSpy(s, 'kick');
        continue;
      }
      if (p.kick && p.slide !== 0) {
        w.killSpy(s, 'slide'); // a jump-kick landing on a wet patch keeps kicking while sliding
        continue;
      }
      if (run.invincible) {
        w.killSpy(s, 'cinna');
        continue;
      }
      if (p.invuln === 0) w.hurtPlayer('touch', true);
    }

    switch (s.mode) {
      case 'aim': {
        // telegraph: stand still, face the agent, then fire
        if (visible) s.face = dx < 0 ? -1 : 1;
        if (s.t >= AIM_FRAMES) {
          fire(w, s);
          s.mode = 'walk';
          s.t = 0;
          s.fireCd = Math.round(w.diff.shotInterval * rng.range(0.9, 1.15));
        }
        break;
      }
      case 'duck':
        break;
      case 'wait': {
        if (sees && s.fireCd <= 0 && s.age > FIRST_SHOT_DELAY) startAim(w, s);
        else if (s.t > 240) {
          s.mode = 'walk';
          s.waitShaft = null;
          s.t = 0;
        }
        break;
      }
      case 'walk': {
        if (sees) {
          s.face = dx < 0 ? -1 : 1;
          if (Math.abs(dx) > STOP_DISTANCE) {
            const dir: -1 | 1 = dx < 0 ? -1 : 1;
            if (walk(w, s, dir, speed)) {
              // blocked by a pit / shaft wall: stay put
            }
          }
          if (s.fireCd <= 0 && s.age > FIRST_SHOT_DELAY) startAim(w, s);
        } else {
          wander(w, s, speed);
        }
        break;
      }
    }
  }
}

function startAim(w: MallWorld, s: Spy): void {
  s.mode = 'aim';
  s.t = 0;
  s.aimHigh = w.spyRng.chance(0.5);
}

function fire(w: MallWorld, s: Spy): void {
  const y = s.y - (s.aimHigh ? 17 : 5);
  w.bullets.push({ x: s.x + s.face * 9, y, vx: s.face * SPY_BULLET_SPEED, vy: 0, owner: 'spy', age: 0 });
  w.run.sfx('enemyShot');
}

function wander(w: MallWorld, s: Spy, speed: number): void {
  const rng = w.spyRng;
  if (--s.wanderT <= 0) {
    s.wanderT = rng.between(40, 150);
    const r = rng.next();
    s.wanderDir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
    // sometimes go and wait in a shaft opening
    if (rng.chance(WAIT_CHANCE)) {
      const c = pickWaitShaft(w, s);
      if (c) s.waitShaft = c.id;
    }
  }
  if (s.waitShaft) {
    const sh = SHAFTS.find((k) => k.id === s.waitShaft)!;
    const cx = sh.x + sh.w / 2;
    const dx = cx - s.x;
    if (Math.abs(dx) < 2) {
      s.mode = 'wait';
      s.t = 0;
      return;
    }
    // Deliberately step onto the grate / into the open car: allowed for this walk only.
    const dir: -1 | 1 = dx < 0 ? -1 : 1;
    s.face = dir;
    if (walk(w, s, dir, speed, true)) s.waitShaft = null;
    return;
  }
  if (s.wanderDir !== 0) {
    s.face = s.wanderDir;
    if (walk(w, s, s.wanderDir, speed * 0.6)) {
      s.wanderDir = (s.wanderDir * -1) as -1 | 1;
    }
  }
}

/** A spy ducks an incoming volley with a 10% chance, decided once per volley. */
function maybeDodge(w: MallWorld, s: Spy): void {
  if (s.mode === 'aim' || s.mode === 'dying' || s.mode === 'emerge') return;
  for (const b of w.bullets) {
    if (b.owner !== 'player') continue;
    const toward = (s.x - b.x) * b.vx > 0;
    const d = Math.abs(s.x - b.x);
    if (!toward || d > 110) continue;
    if (b.y < s.y - SPY_H || b.y > s.y) continue;
    if (s.volleyT <= 0) {
      // a new volley: roll the dice once
      if (w.spyRng.chance(DODGE_CHANCE)) {
        s.mode = 'duck';
        s.duckT = DUCK_FRAMES;
      }
    }
    s.volleyT = VOLLEY_WINDOW; // later bullets in the same volley do not re-roll
    return;
  }
}

/** Player bullets vs spies; called by the world each frame via the bullet loop module hook (see MallWorld.step). */
export function bulletHitsSpy(w: MallWorld): void {
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i]!;
    if (b.owner !== 'player') continue;
    for (const s of w.spies) {
      if (s.mode === 'dying') continue;
      if (b.x > s.x - SPY_HALF_W - 1 && b.x < s.x + SPY_HALF_W + 1 && b.y >= spyHitTop(s) && b.y <= s.y) {
        w.bullets.splice(i, 1);
        w.killSpy(s, 'shot');
        break;
      }
    }
  }
}

function dropPowerup(w: MallWorld, s: Spy): void {
  const rng = w.spyRng;
  const food = rng.chance(0.5);
  const pool = food ? FOOD_POWERS : NON_FOOD_POWERS.filter((id) => id !== 'oneup');
  w.spawnPickup({ x: s.x, y: s.y - 14, kind: 'power', power: rng.pick(pool), vx: 0, vy: -1.5, onGround: false, life: 60 * 12 });
}

export { POINTS };
