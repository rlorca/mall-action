// Spy rules (section 5.5): spawning, wandering, chasing, aim/shoot, ducking, dying, drops.
import { FOOD_POWERUPS, NON_FOOD_POWERUPS, isInvincible, type PowerupKind } from '../progress';
import { SPY_LAST_WORDS } from '../../data/copy';
import { ALARM_SPEEDUP, MIN_SHOT_INTERVAL } from '../difficulty';
import { ENEMY_BULLET_SPEED, FLOOR_Y } from '../geometry';
import { walkBounds, shaftsOn, STORE_LAYOUTS } from './layout';
import { floorIdx, nearestFloor, surfaceSolid, bodyH, carOf } from './physics';
import { storeEnterable, hitPlayer } from './player';
import type { Ctx, Spy } from './types';

export const AIM_FRAMES = 30;
export const SEE_RANGE = 160;
export const STOP_DIST = 40;
export const FIRST_SHOT_MIN = 120;
export const EMERGE_FRAMES = 18;
export const SPY_DEATH_FRAMES = 24;
export const SPAWN_BASE = 240;
export const FIRST_SPAWN = 300; // ~5 s after control begins

export function aliveSpies(c: Ctx): number {
  return c.s.spies.filter((s) => s.state !== 'dying').length;
}

export function spawnSpy(c: Ctx, floor: import('../../data/stores').Floor, x: number, opts: { line?: string; emerge?: boolean } = {}): Spy | null {
  const p = c.s.player;
  const emerge = opts.emerge !== false;
  const sp: Spy = {
    id: ++c.s.idSeq,
    x,
    y: FLOOR_Y[floor],
    floor,
    facing: p.x >= x ? 1 : -1,
    state: emerge ? 'emerge' : 'stand',
    anim: emerge ? 'emerge' : 'stand',
    animFrame: 0,
    age: 0,
    aimFrames: 0,
    aimHigh: false,
    nextFireAge: FIRST_SHOT_MIN + c.rng.int(40),
    duckFrames: 0,
    lastVolley: 0,
    targetX: null,
    waitFrames: 0,
    toShaft: false,
    deathFrames: 0,
    bubble: null,
    shots: 0,
  };
  if (opts.line) c.say(sp, opts.line, 120);
  c.s.spies.push(sp);
  return sp;
}

export function killSpy(c: Ctx, sp: Spy, how: 'shot' | 'kick' | 'crush' | 'lamp' | 'ball' | 'slide' | 'invincible'): void {
  if (sp.state === 'dying') return;
  sp.state = 'dying';
  sp.anim = 'die';
  sp.deathFrames = 0;
  sp.aimFrames = 0;
  const pts = how === 'crush' || how === 'lamp' || how === 'ball' || how === 'slide' ? 300 : 100;
  c.award(pts, sp.x, sp.y - 24);
  c.sfx(how === 'crush' ? 'crush' : 'hurt');
  if (c.rng.chance(0.05)) {
    let kind: PowerupKind;
    if (c.rng.chance(0.5)) kind = c.rng.pick(FOOD_POWERUPS);
    else if (c.rng.chance(1 / 12)) kind = 'oneup';
    else kind = c.rng.pick(NON_FOOD_POWERUPS.filter((k) => k !== 'oneup'));
    c.s.pickups.push({ id: ++c.s.idSeq, x: sp.x, y: sp.y, floor: sp.floor, kind, life: 1200 });
  }
  if (c.rng.chance(0.35)) c.say(sp, c.rng.pick(SPY_LAST_WORDS), 90);
}

/** Is the player a valid target (not hidden / dying / arriving / posing / between floors)? */
export function playerTargetable(c: Ctx): boolean {
  const p = c.s.player;
  if (p.hidden) return false;
  if (c.s.phase !== 'play') return false;
  return (p.mode === 'walk' || p.mode === 'air' || p.mode === 'car') && p.floor !== null;
}

function canStandAt(c: Ctx, sp: Spy, nx: number): boolean {
  const b = walkBounds(sp.floor);
  return nx >= b.min && nx <= b.max && surfaceSolid(c.s, sp.floor, nx);
}

function considerDodge(c: Ctx, sp: Spy): void {
  for (const b of c.s.bullets) {
    if (b.owner !== 'player' || b.volley === sp.lastVolley) continue;
    const toward = (b.vx > 0 && b.x < sp.x) || (b.vx < 0 && b.x > sp.x);
    if (!toward || Math.abs(b.x - sp.x) > 100) continue;
    if (Math.abs(b.y - (sp.y - 14)) > 16 && Math.abs(b.y - (sp.y - 6)) > 12) continue;
    sp.lastVolley = b.volley; // decided ONCE per volley
    if (c.rng.chance(0.1)) sp.duckFrames = 30;
  }
}

function pickWander(c: Ctx, sp: Spy): void {
  const b = walkBounds(sp.floor);
  if (c.rng.chance(0.25)) {
    let best: number | null = null;
    let bd = Infinity;
    for (const sh of shaftsOn(sp.floor)) {
      if (carOf(c.s, sh.id).y > FLOOR_Y[sp.floor] + 0.01) continue; // pit
      const d = Math.abs(sh.cx - sp.x);
      if (d < bd) {
        bd = d;
        best = sh.cx;
      }
    }
    if (best !== null) {
      sp.targetX = best;
      sp.toShaft = true;
      return;
    }
  }
  sp.toShaft = false;
  sp.targetX = Math.min(b.max, Math.max(b.min, sp.x + c.rng.range(-120, 120)));
}

export function updateSpies(c: Ctx): void {
  const s = c.s;
  const p = s.player;
  const d = c.diff();
  const speed = d.spySpeedMul * (s.alarm ? ALARM_SPEEDUP : 1);
  const interval = Math.max(MIN_SHOT_INTERVAL, Math.round(d.shotIntervalFrames * (s.alarm ? 0.8 : 1)));
  const visible = playerTargetable(c);

  for (const sp of s.spies) {
    sp.age++;
    sp.animFrame++;
    if (sp.bubble && --sp.bubble.frames <= 0) sp.bubble = null;
    if (sp.state === 'dying') {
      sp.deathFrames++;
      continue;
    }
    if (!surfaceSolid(s, sp.floor, sp.x)) {
      // a car left from under him: he falls down the shaft
      sp.state = 'dying';
      sp.anim = 'die';
      sp.deathFrames = 0;
      continue;
    }
    if (sp.state === 'emerge') {
      if (sp.animFrame >= EMERGE_FRAMES) {
        sp.state = 'stand';
        sp.anim = 'stand';
      }
      continue;
    }
    considerDodge(c, sp);
    if (sp.duckFrames > 0) {
      sp.duckFrames--;
      sp.state = 'duck';
      sp.anim = 'duck';
      if (sp.duckFrames === 0) {
        sp.state = 'stand';
        sp.anim = 'stand';
      }
      continue;
    }
    const dx = p.x - sp.x;
    const sees = visible && p.floor === sp.floor && Math.abs(dx) <= SEE_RANGE;
    if (sees) {
      sp.facing = dx >= 0 ? 1 : -1;
      sp.targetX = null;
      sp.toShaft = false;
      sp.waitFrames = 0;
      if (sp.aimFrames > 0) {
        sp.aimFrames++;
        sp.state = 'aim';
        sp.anim = sp.aimHigh ? 'aimHigh' : 'aimLow';
        if (sp.aimFrames > AIM_FRAMES && sp.age >= sp.nextFireAge) {
          fire(c, sp);
          sp.nextFireAge = sp.age + interval;
          sp.aimFrames = 0;
          sp.state = 'stand';
          sp.anim = 'stand';
        }
      } else {
        if (Math.abs(dx) > STOP_DIST) {
          const nx = sp.x + sp.facing * speed;
          if (canStandAt(c, sp, nx)) {
            sp.x = nx;
            sp.state = 'walk';
            sp.anim = 'walk';
          } else {
            sp.state = 'stand';
            sp.anim = 'stand';
          }
        } else {
          sp.state = 'stand';
          sp.anim = 'stand';
        }
        if (sp.age >= sp.nextFireAge - AIM_FRAMES) {
          sp.aimFrames = 1;
          sp.aimHigh = c.rng.chance(0.5);
        }
      }
      continue;
    }
    sp.aimFrames = 0;
    // wander / wait in a shaft opening
    if (sp.state === 'wait') {
      if (--sp.waitFrames <= 0) {
        sp.state = 'stand';
        sp.anim = 'stand';
        sp.targetX = null;
      }
      continue;
    }
    if (sp.targetX === null) {
      if (sp.waitFrames > 0) {
        sp.waitFrames--;
        sp.state = 'stand';
        sp.anim = 'stand';
      } else pickWander(c, sp);
      continue;
    }
    const dir = sp.targetX >= sp.x ? 1 : -1;
    const nx = sp.x + dir * speed * 0.6;
    if (!canStandAt(c, sp, nx)) {
      sp.targetX = null;
      sp.toShaft = false;
      sp.waitFrames = 30;
      sp.state = 'stand';
      sp.anim = 'stand';
      continue;
    }
    sp.x = nx;
    sp.facing = dir;
    sp.state = 'walk';
    sp.anim = 'walk';
    if (Math.abs(sp.targetX - sp.x) <= 1.5) {
      if (sp.toShaft) {
        sp.state = 'wait';
        sp.anim = 'stand';
        sp.waitFrames = 180 + c.rng.int(300);
      } else sp.waitFrames = 30 + c.rng.int(90);
      sp.targetX = null;
      sp.toShaft = false;
    }
  }
  // remove finished / far-away spies
  s.spies = s.spies.filter((sp) => {
    if (sp.state === 'dying') return sp.deathFrames < SPY_DEATH_FRAMES;
    if (sp.age > 300 && (Math.abs(floorIdx(sp.floor) - floorIdx(p.floor ?? nearestFloor(p.y))) > 2 || Math.abs(sp.x - p.x) > 520)) return false;
    return true;
  });
}

function fire(c: Ctx, sp: Spy): void {
  c.s.bullets.push({
    id: ++c.s.idSeq,
    x: sp.x + sp.facing * 10,
    y: sp.y - (sp.aimHigh ? 18 : 6),
    vx: sp.facing * ENEMY_BULLET_SPEED,
    vy: 0,
    owner: 'spy',
    volley: 0,
    spent: false,
  });
  sp.shots++;
  c.sfx('enemyShot');
}

/** Spies touching the player: kick / cinnabomb kills them, otherwise it kills (or the armour absorbs) the player. */
export function spyContacts(c: Ctx): void {
  const p = c.s.player;
  if (!(p.mode === 'walk' || p.mode === 'air' || p.mode === 'car')) return;
  const top = p.y - bodyH(p.duck);
  for (const sp of c.s.spies) {
    if (sp.state === 'dying' || sp.state === 'emerge') continue;
    if (Math.abs(sp.x - p.x) > 10) continue;
    const sTop = sp.y - bodyH(sp.state === 'duck');
    if (p.y < sTop || top > sp.y) continue;
    if (p.kick) killSpy(c, sp, p.slide !== 0 ? 'slide' : 'kick');
    else if (isInvincible(c.progress)) killSpy(c, sp, 'invincible');
    else {
      hitPlayer(c, 'spy');
      break;
    }
  }
}

export function spawnTick(c: Ctx): void {
  const s = c.s;
  const p = s.player;
  const d = c.diff();
  if (s.playFrames < s.nextSpawnAt) return;
  if (aliveSpies(c) >= d.spyCap) {
    s.nextSpawnAt = s.playFrames + 30;
    return;
  }
  if (!(p.mode === 'walk' || p.mode === 'air' || p.mode === 'car' || p.mode === 'escalator' || p.mode === 'roof')) {
    s.nextSpawnAt = s.playFrames + 30;
    return;
  }
  const pf = p.floor ?? nearestFloor(p.y);
  const pi = floorIdx(pf);
  const cands = STORE_LAYOUTS.filter((st) => storeEnterable(c, st.id) && Math.abs(floorIdx(st.floor) - pi) <= 1 && Math.abs(st.doorX - p.x) >= 64 && Math.abs(st.doorX - p.x) <= 200);
  if (cands.length === 0) {
    s.nextSpawnAt = s.playFrames + 20;
    return;
  }
  const st = c.rng.pick(cands);
  spawnSpy(c, st.floor, st.doorX);
  c.sfx('door');
  const delay = Math.round(SPAWN_BASE / d.spawnRateMul / (s.alarm ? 1.4 : 1)) + c.rng.int(60);
  s.nextSpawnAt = s.playFrames + delay;
}
