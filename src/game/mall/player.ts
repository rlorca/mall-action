// Player rules: walking, jumping, ducking, shooting, contextual Up/Down actions, deaths and respawn.
import type { StoreId } from '../../core/events';
import type { PadFrame } from '../../core/pad';
import { PACKAGES_TOTAL, STORE_BY_ID, type Floor, FLOORS } from '../../data/stores';
import { MISC, POWERUP_NAMES } from '../../data/copy';
import { CAR_H, FLOOR_SPACING, FLOOR_Y, WALK_SPEED } from '../geometry';
import { packagesLeft, walkSpeedMul, isInvincible, absorbHit, loseOnDeath } from '../progress';
import { ESCALATORS, KIOSKS, BOOTH, WAGON, SHAFT_BY_ID, ROOF_MIN, WALK_MAX, WALK_MIN, shaftsOn, storesOn, STORE_LAYOUT_BY_ID } from './layout';
import { MALL_COPY } from './copy';
import { BODY_H, GRAVITY, JUMP_V, MAX_FALL_V, SNEAKER_JUMP_V, FATAL_FALL, carOf, floorAtY, inColumn, nearestFloor, surfaceSolid, roofY, floorIdx } from './physics';
import type { Car, Ctx, Player } from './types';

export const RESPAWN_INVULN = 120;
export const DEATH_FRAMES = 90;
export const CALL_ZONE = 16; // px beside the opening in which Up/Down/standing still calls a car
export const AUTO_CALL_FRAMES = 30;
export const KIOSK_COOLDOWN = 1200;
export const BOOTH_MAX = 300;

export function makePlayer(): Player {
  return {
    x: 36,
    y: 64,
    vx: 0,
    vy: 0,
    facing: 1,
    mode: 'zip',
    anim: 'hang',
    animFrame: 0,
    floor: null,
    duck: false,
    kick: false,
    slide: 0,
    carId: null,
    escId: null,
    escT: 0,
    escUp: true,
    invuln: 0,
    frozen: 0,
    hidden: false,
    boothFrames: 0,
    deathCause: null,
    deathFrames: 0,
    apexY: 0,
    shootCd: 0,
    still: 0,
    safeX: 112,
    safeFloor: 'R',
    actionCd: 0,
  };
}

/** Open store = target with its package still inside, or a power-up shop. */
export function storeEnterable(c: Ctx, id: StoreId): boolean {
  const d = STORE_BY_ID[id];
  if (d.role === 'closed') return false;
  if (d.role === 'target') return !c.progress.packages.includes(id);
  return true;
}

export function hitboxTop(p: Player): number {
  return p.y - (p.duck ? 12 : BODY_H);
}

export function callCar(car: Car, f: Floor): void {
  if (car.level === f && !car.moving) return;
  if (car.mode === 'called' && car.calledFloor === f) return;
  car.mode = 'called';
  car.calledFloor = f;
  car.targetY = FLOOR_Y[f];
  car.glideDir = 0;
}

function playerVolleys(c: Ctx): number {
  const set = new Set<number>();
  for (const b of c.s.bullets) if (b.owner === 'player') set.add(b.volley);
  return set.size;
}

function tryShoot(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  if (p.shootCd > 0) return;
  const w = c.progress.power.weapon;
  const rapid = w?.kind === 'rapid';
  const spread = w?.kind === 'spread';
  const wants = rapid ? pad.held.a : pad.pressed.a;
  if (!wants) return;
  const maxVolleys = rapid ? 4 : 2;
  if (playerVolleys(c) >= maxVolleys) return;
  const y = p.y - (p.duck ? 6 : 18);
  const vol = ++c.s.volleySeq;
  const push = (vy: number): void => {
    c.s.bullets.push({ id: ++c.s.idSeq, x: p.x + p.facing * 10, y, vx: p.facing * 4, vy, owner: 'player', volley: vol, spent: false });
  };
  push(0);
  if (spread) {
    push(-1.2);
    push(1.2);
  }
  p.shootCd = rapid ? 6 : 14;
  c.sfx('shot');
  c.onPlayerShot();
}

function inWetPatch(c: Ctx, f: Floor, x: number): boolean {
  return c.s.wetPatches.some((w) => w.floor === f && x >= w.x0 && x <= w.x1);
}

export function playerMinX(p: Player): number {
  return p.y < FLOOR_Y['4F'] - 10 ? ROOF_MIN : WALK_MIN;
}

export function beginFall(p: Player): void {
  p.mode = 'air';
  p.vy = 0;
  p.vx = 0;
  p.apexY = p.y;
  p.duck = false;
}

function land(c: Ctx, p: Player, kind: 'floor' | 'roof' | 'plane', y: number, f: Floor | null, car: Car | null): void {
  const fall = y - p.apexY;
  p.y = y;
  p.vy = 0;
  if (fall > FATAL_FALL + 0.01) {
    p.floor = f;
    c.killPlayer('fall');
    return;
  }
  if (fall > 6) c.sfx('land');
  if (kind === 'floor' && f) {
    p.mode = 'walk';
    p.floor = f;
    if (f === '1F' && p.vx !== 0 && inWetPatch(c, f, p.x)) {
      p.slide = p.vx > 0 ? 1 : -1;
      p.facing = p.slide;
    } else {
      p.slide = 0;
      p.kick = false;
    }
    p.vx = 0;
  } else if (kind === 'roof' && car) {
    p.mode = 'roof';
    p.carId = car.id;
    p.floor = null;
    p.kick = false;
    p.slide = 0;
    p.vx = 0;
  } else if (car) {
    p.mode = 'car';
    p.carId = car.id;
    p.floor = car.level;
    p.kick = false;
    p.slide = 0;
    p.vx = 0;
  }
}

/** Air physics (jump arcs, falls, landings on floors / grates / car roofs). */
function airStep(c: Ctx): void {
  const p = c.s.player;
  p.vy = Math.min(MAX_FALL_V, p.vy + GRAVITY);
  const nx = Math.min(WALK_MAX, Math.max(playerMinX(p), p.x + p.vx));
  const ny = p.y + p.vy;
  p.x = nx;
  if (p.vy > 0) {
    let bestY = Infinity;
    let kind: 'floor' | 'roof' | 'plane' = 'floor';
    let bf: Floor | null = null;
    let bcar: Car | null = null;
    for (const f of FLOORS) {
      const fy = FLOOR_Y[f];
      if (p.y <= fy + 0.01 && ny >= fy && surfaceSolid(c.s, f, nx) && fy < bestY) {
        bestY = fy;
        kind = 'floor';
        bf = f;
        bcar = null;
      }
    }
    for (const car of c.s.cars) {
      const sh = SHAFT_BY_ID[car.id];
      if (!inColumn(sh, nx)) continue;
      const ry = roofY(car);
      if (p.y <= ry + 0.01 && ny >= ry && ry < bestY) {
        bestY = ry;
        kind = 'roof';
        bf = null;
        bcar = car;
      }
      const py = car.y;
      if (car.level === null && p.y <= py + 0.01 && ny >= py && py < bestY) {
        bestY = py;
        kind = 'plane';
        bf = null;
        bcar = car;
      }
    }
    if (bestY < Infinity) {
      land(c, p, kind, bestY, bf, bcar);
      return;
    }
  }
  p.y = ny;
  if (p.y < p.apexY) p.apexY = p.y;
  if (p.y > 420) c.killPlayer('fall');
}

function exitBooth(c: Ctx): void {
  const p = c.s.player;
  p.hidden = false;
  p.mode = 'walk';
  p.boothFrames = 0;
  p.anim = 'stand';
  c.sfx('door');
  if (!c.progress.photoStrip) {
    c.progress.photoStrip = true;
    if (!c.progress.inventory.includes(MALL_COPY.photoStripItem)) c.progress.inventory.push(MALL_COPY.photoStripItem);
    c.s.photoStrip = { frames: 180 };
    c.ev({ t: 'sfx', name: 'flash' });
    c.ev({ t: 'flash', frames: 12 });
    c.ev({ t: 'banner', lines: [...MALL_COPY.photoStrip], kind: 'item' });
  }
}

function nearestRemainingPackageStore(c: Ctx, f: Floor, x: number): StoreId | null {
  let best: StoreId | null = null;
  let bd = Infinity;
  for (const st of STORE_BY_ID ? Object.values(STORE_BY_ID) : []) {
    if (st.role !== 'target' || c.progress.packages.includes(st.id)) continue;
    const lay = STORE_LAYOUT_BY_ID[st.id];
    const d = Math.abs(floorIdx(st.floor) - floorIdx(f)) * 1000 + Math.abs(lay.doorX - x);
    if (d < bd) {
      bd = d;
      best = st.id;
    }
  }
  return best;
}

/** Contextual Up/Down actions. Returns true if the press was consumed. */
function interact(c: Ctx, pad: PadFrame): boolean {
  const p = c.s.player;
  const f = p.floor;
  if (!f) return false;
  const up = pad.pressed.up;
  const down = pad.pressed.down;
  if (!up && !down) return false;

  // escalators
  for (const e of ESCALATORS) {
    if (up && p.floor === e.lower && Math.abs(p.x - e.bottomX) <= 8) {
      p.mode = 'escalator';
      p.escId = e.id;
      p.escT = 0;
      p.escUp = true;
      p.x = e.bottomX;
      p.duck = false;
      p.slide = 0;
      c.sfx('step');
      return true;
    }
    if (down && p.floor === e.upper && Math.abs(p.x - e.topX) <= 8) {
      p.mode = 'escalator';
      p.escId = e.id;
      p.escT = 0;
      p.escUp = false;
      p.x = e.topX;
      p.duck = false;
      p.slide = 0;
      c.sfx('step');
      return true;
    }
  }
  if (up) {
    // store doors
    for (const st of storesOn(f)) {
      if (Math.abs(p.x - st.doorX) <= 8) {
        if (storeEnterable(c, st.id)) {
          p.mode = 'entering';
          p.hidden = true;
          p.anim = 'hidden';
          p.duck = false;
          p.slide = 0;
          p.kick = false;
          p.x = st.doorX;
          c.sfx('door');
          c.enterStore(st.id);
        } else {
          c.sfx('blip');
        }
        return true;
      }
    }
    // kiosks
    for (const k of c.s.kiosks) {
      if (k.floor === f && Math.abs(p.x - k.x) <= k.w / 2 + 2) {
        if (k.cooldown > 0) {
          c.sfx('blip');
          c.ev({ t: 'banner', lines: [MALL_COPY.kioskCooling], frames: 90, kind: 'info' });
        } else {
          k.cooldown = KIOSK_COOLDOWN;
          const sid = nearestRemainingPackageStore(c, f, p.x);
          c.s.kioskPanel = { frames: 300, kioskFloor: f, storeId: sid, storeFloor: sid ? STORE_BY_ID[sid].floor : null };
          c.sfx('select');
          if (!sid) c.ev({ t: 'banner', lines: [MALL_COPY.kioskNone], frames: 90, kind: 'info' });
        }
        return true;
      }
    }
    // photo booth
    if (f === BOOTH.floor && Math.abs(p.x - BOOTH.x) <= BOOTH.w / 2) {
      p.mode = 'booth';
      p.hidden = true;
      p.boothFrames = BOOTH_MAX;
      p.x = BOOTH.x;
      p.anim = 'hidden';
      p.duck = false;
      p.slide = 0;
      c.sfx('door');
      return true;
    }
    // getaway car
    if (f === WAGON.floor && Math.abs(p.x - WAGON.x) <= WAGON.w / 2 + 2) {
      if (c.s.levelClearFired) return true;
      if (packagesLeft(c.progress) === 0) {
        c.s.levelClearFired = true;
        c.s.phase = 'clear';
        c.s.phaseFrames = 0;
        p.mode = 'gone';
        p.hidden = true;
        p.anim = 'hidden';
        c.sfx('door');
        c.ev({ t: 'banner', lines: [...MALL_COPY.levelClear], kind: 'info' });
        c.levelClearNow();
      } else if (p.actionCd <= 0) {
        p.actionCd = 60;
        c.sfx('buzzer');
        c.ev({ t: 'banner', lines: [MISC.packagesLeft(PACKAGES_TOTAL - c.progress.packages.length)], frames: 90, kind: 'info' });
      }
      return true;
    }
  }
  return false;
}

/** Elevator interaction (boarding / calling). */
function elevatorAction(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  const f = p.floor;
  if (!f || p.mode !== 'walk') return;
  let best: { sh: ReturnType<typeof shaftsOn>[number]; d: number } | null = null;
  for (const sh of shaftsOn(f)) {
    const d = Math.abs(p.x - sh.cx);
    if (d <= sh.w / 2 + CALL_ZONE && (!best || d < best.d)) best = { sh, d };
  }
  if (!best) return;
  const car = carOf(c.s, best.sh.id);
  const pressed = pad.pressed.up || pad.pressed.down;
  const held = pad.held.up || pad.held.down;
  const col = inColumn(best.sh, p.x, 0);
  if (car.level === f && !car.moving) {
    if ((col && held) || pressed) {
      p.mode = 'car';
      p.carId = car.id;
      p.x = best.sh.cx;
      p.y = car.y;
      p.vx = 0;
      p.duck = false;
      p.slide = 0;
      p.kick = false;
      p.anim = 'ride';
    }
    return;
  }
  if (pressed || p.still >= AUTO_CALL_FRAMES) {
    callCar(car, f);
    if (p.still >= AUTO_CALL_FRAMES) p.still = 0;
  }
}

function walkStep(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  const held = pad.held;
  const f = p.floor as Floor;
  const spd = WALK_SPEED * walkSpeedMul(c.progress);
  p.duck = false;

  if (p.frozen > 0) {
    p.frozen--;
    p.anim = 'frozen';
    p.still = 0;
    return;
  }

  const anyMove = held.left || held.right || held.up || held.down || pad.pressed.a || pad.pressed.b;
  p.still = anyMove ? 0 : p.still + 1;

  const consumed = interact(c, pad);
  if (consumed || p.mode !== 'walk') return;
  elevatorAction(c, pad);
  if (p.mode !== 'walk') return;

  const dirIn = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  let dx = 0;
  if (p.slide !== 0) {
    dx = p.slide * spd;
    p.facing = p.slide;
  } else if (held.down) {
    p.duck = true;
  } else if (dirIn !== 0) {
    dx = dirIn * spd;
    p.facing = dirIn > 0 ? 1 : -1;
  }
  // jump
  if (pad.pressed.b && !p.duck) {
    const sneak = c.progress.power.speed?.kind === 'sneakers';
    p.mode = 'air';
    p.vy = sneak ? SNEAKER_JUMP_V : JUMP_V;
    p.vx = dx;
    p.kick = dx !== 0;
    p.apexY = p.y;
    p.anim = p.kick ? 'kick' : 'jump';
    c.sfx('jump');
    if (p.slide === 0) p.kick = dx !== 0;
    airStep(c);
    tryShoot(c, pad);
    return;
  }
  if (dx !== 0) {
    const nx = Math.min(WALK_MAX, Math.max(playerMinX(p), p.x + dx));
    p.x = nx;
    p.animFrame++;
    if (!surfaceSolid(c.s, f, nx)) {
      beginFall(p);
      p.anim = 'jump';
      return;
    }
    if (f === '1F' && p.slide === 0 && inWetPatch(c, f, nx)) {
      p.slide = dx > 0 ? 1 : -1;
    }
  }
  if (p.slide !== 0 && !inWetPatch(c, f, p.x)) {
    p.slide = 0;
    p.kick = false;
  }
  p.anim = p.duck ? 'duck' : p.slide !== 0 ? 'slide' : dx !== 0 ? 'walk' : 'stand';
  // remember the last safe standing spot
  if (surfaceSolid(c.s, f, p.x) && !SHAFT_NEAR(f, p.x) && p.slide === 0) {
    p.safeX = p.x;
    p.safeFloor = f;
  }
  tryShoot(c, pad);
}

function SHAFT_NEAR(f: Floor, x: number): boolean {
  return shaftsOn(f).some((sh) => x > sh.x - 12 && x < sh.x + sh.w + 12);
}

function carStep(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  const car = carOf(c.s, p.carId!);
  p.y = car.y;
  p.floor = car.level;
  p.duck = false;
  p.anim = 'ride';
  const held = pad.held;
  if (!car.moving && car.level && car.doorsOpen && !held.up && !held.down && (held.left || held.right)) {
    p.mode = 'walk';
    p.floor = car.level;
    p.facing = held.right ? 1 : -1;
    p.carId = null;
    p.still = 0;
    p.x += p.facing * 2;
  } else if (held.left || held.right) {
    p.facing = held.right ? 1 : -1;
  }
  if (p.mode === 'car') tryShoot(c, pad);
}

function roofStep(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  const car = carOf(c.s, p.carId!);
  const sh = SHAFT_BY_ID[car.id];
  p.y = roofY(car);
  p.floor = null;
  p.anim = 'stand';
  const held = pad.held;
  const dirIn = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  p.duck = held.down;
  if (dirIn !== 0) {
    p.facing = dirIn > 0 ? 1 : -1;
    p.x = Math.min(sh.x + sh.w - 8, Math.max(sh.x + 8, p.x + dirIn * WALK_SPEED * walkSpeedMul(c.progress)));
    p.anim = 'walk';
  }
  if (pad.pressed.b && !held.down) {
    p.mode = 'air';
    p.vy = JUMP_V;
    p.vx = dirIn * WALK_SPEED;
    p.kick = false;
    p.apexY = p.y;
    p.carId = null;
    c.sfx('jump');
    airStep(c);
    return;
  }
  if (p.y - BODY_H < sh.ceilingY) {
    c.killPlayer('crush');
    return;
  }
  tryShoot(c, pad);
}

function escalatorStep(c: Ctx): void {
  const p = c.s.player;
  const e = ESCALATORS.find((q) => q.id === p.escId)!;
  p.escT++;
  p.animFrame++;
  p.anim = 'ride';
  if (p.escUp) {
    p.x = e.bottomX + e.dir * p.escT;
    p.y = FLOOR_Y[e.lower] - p.escT;
  } else {
    p.x = e.topX - e.dir * p.escT;
    p.y = FLOOR_Y[e.upper] + p.escT;
  }
  p.floor = null;
  if (p.escT >= e.rideFrames) {
    p.mode = 'walk';
    p.floor = p.escUp ? e.upper : e.lower;
    p.x = p.escUp ? e.topX : e.bottomX;
    p.y = FLOOR_Y[p.floor];
    p.escId = null;
    p.still = 0;
  }
}

/** Advance the player one frame during the 'play' phase. */
export function updatePlayer(c: Ctx, pad: PadFrame): void {
  const p = c.s.player;
  if (p.shootCd > 0) p.shootCd--;
  if (p.invuln > 0) p.invuln--;
  if (p.actionCd > 0) p.actionCd--;
  switch (p.mode) {
    case 'walk':
      walkStep(c, pad);
      break;
    case 'air':
      airStep(c);
      p.anim = p.kick ? 'kick' : 'jump';
      if (p.mode === 'air') tryShoot(c, pad);
      break;
    case 'car':
      carStep(c, pad);
      break;
    case 'roof':
      roofStep(c, pad);
      break;
    case 'escalator':
      escalatorStep(c);
      break;
    case 'booth':
      p.boothFrames--;
      if (p.boothFrames <= 0 || pad.pressed.down || pad.pressed.left || pad.pressed.right || pad.pressed.b) exitBooth(c);
      break;
    case 'dying':
      dyingStep(c);
      break;
    default:
      break;
  }
  if (p.mode !== 'dying') p.animFrame++;
}

export function damagesPlayer(c: Ctx): boolean {
  const p = c.s.player;
  if (p.invuln > 0 || isInvincible(c.progress)) return false;
  return p.mode === 'walk' || p.mode === 'air' || p.mode === 'car' || p.mode === 'roof';
}

export function hitPlayer(c: Ctx, cause: 'bullet' | 'spy' | 'lamp' | 'ball'): void {
  const p = c.s.player;
  if (!damagesPlayer(c)) return;
  if ((cause === 'bullet' || cause === 'spy') && absorbHit(c.progress)) {
    p.invuln = 60;
    c.sfx('hurt');
    return;
  }
  killPlayer(c, cause);
}

export function killPlayer(c: Ctx, cause: import('./types').DeathCause): void {
  const p = c.s.player;
  if (p.mode === 'dying' || p.mode === 'gone' || p.mode === 'entering') return;
  p.mode = 'dying';
  p.deathCause = cause;
  p.deathFrames = 0;
  p.hidden = false;
  p.anim = 'dying';
  p.vx = 0;
  p.vy = -3;
  p.frozen = 0;
  p.slide = 0;
  p.kick = false;
  p.carId = null;
  c.progress.lives = Math.max(0, c.progress.lives - 1);
  loseOnDeath(c.progress);
  c.sfx('death');
  if (cause === 'crush' || cause === 'lamp' || cause === 'ball') {
    c.sfx('crush');
    c.ev({ t: 'shake', frames: 20, mag: 3 });
  }
}

function dyingStep(c: Ctx): void {
  const p = c.s.player;
  p.deathFrames++;
  if (p.deathFrames >= DEATH_FRAMES) {
    if (c.progress.lives <= 0) {
      c.s.outOfLives = true;
      p.deathFrames = DEATH_FRAMES;
      return;
    }
    respawnPlayer(c);
  }
}

/** Respawn at the last safe spot: clears spies, bullets and any freeze; blinking invulnerability. */
export function respawnPlayer(c: Ctx): void {
  const p = c.s.player;
  const f = p.safeFloor;
  p.mode = 'walk';
  p.x = p.safeX;
  p.y = FLOOR_Y[f];
  p.floor = f;
  p.vx = 0;
  p.vy = 0;
  p.duck = false;
  p.kick = false;
  p.slide = 0;
  p.frozen = 0;
  p.hidden = false;
  p.carId = null;
  p.deathCause = null;
  p.deathFrames = 0;
  p.invuln = RESPAWN_INVULN;
  p.anim = 'stand';
  p.still = 0;
  c.s.spies.length = 0;
  c.s.bullets.length = 0;
  c.s.cop.mode = c.s.cop.mode === 'chase' ? 'patrol' : c.s.cop.mode;
  c.s.cop.chaseFrames = 0;
}

export function pickupName(kind: string): string {
  return POWERUP_NAMES[kind] ?? kind;
}

export { floorAtY, nearestFloor, CAR_H, FLOOR_SPACING, KIOSKS, WALK_MAX };
