/**
 * The mall (side-scrolling view): agent, elevators, escalators, spies, bullets, lights and the other people.
 * Pure rules. y is FEET, x is the centre. Units: pixels and frames.
 */
import type { PadFrame } from '../core/input';
import { C } from '../core/palette';
import {
  ANCHOR_POST, CABLE_START, CAR_H, DISCO_FLOOR, ESCALATORS, ESC_LEN, FLOORS, FLOOR_P, FOUNTAINS, JANITOR, KIOSKS,
  LAMPS, MALL_W, PHOTO_BOOTH, SHAFTS, STORES, WALKER_STRETCHES, WALL_L, WALL_R, WET_W, WORLD_H, cableY, doorX, floorAtY,
  floorBand, nearShaft, overShaft, serves, shaftCeiling, shaftCenter, solidSegments, storeById, surf, wagonCenter,
} from './layout';
import { callCar, carFloor, newCar, stepCar, stoppingFloor } from './elevator';
import {
  ALARM_SPAWN, ALARM_SPEED, AIM_FRAMES, DODGE_CHANCE, FIRST_SHOT_DELAY, FIRST_SPAWN, maxSpies, shotInterval,
  spawnInterval, spySpeed,
} from './difficulty';
import {
  absorbHit, applyPower, jumpVelocity, maxBullets, randomPower, shotCooldown, walkSpeed, type PowerKind,
} from './powerups';
import { BANNERS, FLOOR_ANNOUNCE, POWERUP_NAMES, SPY_ELEVATOR_LINES, SPY_LAST_WORDS } from './copy';
import { POINTS, addScore, banner, newId, popup, rectsOverlap, sfx } from './common';
import { isOpenStore } from './setup';
import type { Bullet, Car, GameState, Level, MallPlayer, MallState, Spy } from './state';

export const GRAVITY = 0.25;
export const MAX_FALL = 5;
/** Falls longer than this (more than one floor) are fatal. */
export const FATAL_FALL = 56;
export const STAND_H = 24;
export const DUCK_H = 14;
export const HALF_W = 5;
export const BULLET_SPEED = 4;
export const ENEMY_BULLET_SPEED = 2;
export const SHOT_HIGH = 17;
export const SHOT_LOW = 6;
export const VIEW_W = 256;
export const VIEW_H = 224;
export const AUTO_CALL_FRAMES = 30;
export const RESPAWN_INVULN = 120;
export const DEATH_FRAMES = 90;
export const SELFIE_FRAMES = 150;
export const HIDE_FRAMES = 300;
export const KIOSK_COOLDOWN = 1200;
export const FOUNTAIN_COOLDOWN = 900;
export const WET_FRAMES = 600;
export const COP_CHASE = 600;
export const COP_FREEZE = 180;
export const SEE_RANGE = 160;
export const KEEP_DISTANCE = 40;

// ---------------------------------------------------------------- construction

export function newPlayer(): MallPlayer {
  const x = CABLE_START.x + 8;
  return {
    x, y: Math.round(cableY(x)) + 22, vx: 0, vy: 0, facing: 1, mode: 'zip', duck: false, kick: false, shooting: 0,
    fallTop: 0, car: -1, standCar: -1, esc: null, invuln: 0, deadT: 0, cooldown: 0, frozen: 0, slide: 0, anim: 0,
    still: 0, modeT: 0, hideT: 0, safe: { x: ANCHOR_POST.x - 24, floor: 0 }, deathCause: '',
  };
}

export function newMall(g: GameState, lvlRng: { range(a: number, b: number): number; int(n: number): number }): MallState {
  const copFloor = 1 + lvlRng.int(4);
  const segs = solidSegments(copFloor).sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
  const seg = segs[0];
  return {
    player: newPlayer(),
    cars: SHAFTS.map((s, i) => newCar(i, s)),
    spies: [],
    bullets: [],
    lamps: LAMPS.map((l) => ({
      x: l.x, floor: l.floor, disco: l.floor === DISCO_FLOOR, state: 'hang' as const, y: lampY(l.floor), vy: 0, dir: 0, t: 0,
    })),
    walkers: WALKER_STRETCHES.map((w, i) => ({
      id: newId(g), x: i === 0 ? w.x0 + 20 : w.x1 - 20, floor: w.floor, dir: (i === 0 ? 1 : -1) as 1 | -1, x0: w.x0, x1: w.x1,
      anim: 0, heyT: 0,
    })),
    cop: {
      id: newId(g), x: Math.round((seg[0] + seg[1]) / 2), floor: copFloor, facing: 1, x0: seg[0] + 10, x1: seg[1] - 10,
      chase: 0, cool: 0, anim: 0,
    },
    janitor: { x: JANITOR.x0 + 40, dir: 1, mopT: 0, nextMop: 360, anim: 0 },
    wet: null,
    fountainCool: FOUNTAINS.map(() => 0),
    coins: [],
    pickups: [],
    shards: [],
    dark: [],
    spawnT: 0,
    kioskCool: 0,
    kioskPanel: null,
    photoPopup: 0,
    camX: 0,
    camY: 0,
    volley: 0,
    exitBuzzCool: 0,
    announce: null,
  };
}

/** Resting y (bottom of the shade) of a hanging lamp on a floor. */
export function lampY(floor: number): number {
  return surf(floor) - 16;
}

// ---------------------------------------------------------------- geometry

export interface Surface {
  y: number;
  car: number;
  kind: 'floor' | 'grate' | 'carfloor' | 'roof';
}

/** Index of the shaft whose opening is under x on floor f (only shafts serving f have openings), or -1. */
export function shaftAt(x: number, f: number): number {
  for (let i = 0; i < SHAFTS.length; i++) if (serves(SHAFTS[i], f) && overShaft(SHAFTS[i], x)) return i;
  return -1;
}

/** Every walkable surface at column x. */
export function surfacesAt(m: MallState, x: number): Surface[] {
  const out: Surface[] = [];
  for (let f = 0; f < FLOORS; f++) {
    const si = shaftAt(x, f);
    if (si < 0) out.push({ y: surf(f), car: -1, kind: 'floor' });
    else if (m.cars[si].y < surf(f)) out.push({ y: surf(f), car: -1, kind: 'grate' });
  }
  for (let i = 0; i < SHAFTS.length; i++) {
    if (!overShaft(SHAFTS[i], x)) continue;
    out.push({ y: m.cars[i].y, car: i, kind: 'carfloor' });
    out.push({ y: m.cars[i].y - CAR_H, car: i, kind: 'roof' });
  }
  return out;
}

/** The surface an entity with feet at y stands on, or null. */
export function groundAt(m: MallState, x: number, y: number): Surface | null {
  let best: Surface | null = null;
  for (const s of surfacesAt(m, x)) if (Math.abs(s.y - y) <= 0.5 && (!best || s.kind !== 'roof')) best = s;
  return best;
}

/** First surface crossed when moving feet from y0 down to y1. */
export function landingAt(m: MallState, x: number, y0: number, y1: number): Surface | null {
  let best: Surface | null = null;
  for (const s of surfacesAt(m, x)) {
    if (s.y >= y0 - 1.5 && s.y <= y1 && (!best || s.y < best.y)) best = s;
  }
  return best;
}

/** Would stepping to x on floor f put an entity over a pit (no grate, no car floor)? */
export function isPit(m: MallState, x: number, f: number): boolean {
  const si = shaftAt(x, f);
  if (si < 0) return false;
  return m.cars[si].y > surf(f);
}

export function playerHeight(p: MallPlayer): number {
  return p.duck ? DUCK_H : STAND_H;
}

function spyHeight(s: Spy): number {
  return s.mode === 'duck' ? DUCK_H : STAND_H;
}

/** The floor the player is standing on (ground on a real floor level), or -1. */
export function playerFloor(p: MallPlayer): number {
  if (p.mode === 'elevator' || p.mode === 'ground' || p.mode === 'hidden') return floorAtY(p.y);
  return -1;
}

/** Can spies see/target the player at all? (Hidden, dying, arriving and posing players are ignored.) */
export function playerTargetable(m: MallState): boolean {
  const p = m.player;
  if (p.mode === 'elevator') {
    const car = m.cars[p.car];
    return !car.moving;
  }
  return p.mode === 'ground' || p.mode === 'air' || p.mode === 'escalator';
}

function invulnerable(g: GameState, lvl: Level): boolean {
  return lvl.mall.player.invuln > 0 || lvl.powers.invincT > 0;
}

// ---------------------------------------------------------------- the step

export function stepMall(g: GameState, lvl: Level, input: PadFrame): void {
  const m = lvl.mall;
  const p = m.player;
  const rng = lvl.rng;

  stepCars(g, lvl, input);
  stepPlayer(g, lvl, input);
  stepSpies(g, lvl);
  stepBullets(g, lvl);
  stepLamps(g, lvl);
  stepPeople(g, lvl);
  stepCoinsAndPickups(g, lvl);
  checkCrushes(g, lvl);
  checkContacts(g, lvl);
  stepSpawning(g, lvl);

  if (m.kioskCool > 0) m.kioskCool--;
  if (m.kioskPanel && --m.kioskPanel.t <= 0) m.kioskPanel = null;
  if (m.photoPopup > 0) m.photoPopup--;
  if (m.exitBuzzCool > 0) m.exitBuzzCool--;
  if (m.announce && --m.announce.t <= 0) m.announce = null;
  for (let i = m.shards.length - 1; i >= 0; i--) if (--m.shards[i].t <= 0) m.shards.splice(i, 1);
  for (let i = m.dark.length - 1; i >= 0; i--) if (--m.dark[i].t <= 0) m.dark.splice(i, 1);
  for (let i = 0; i < m.fountainCool.length; i++) if (m.fountainCool[i] > 0) m.fountainCool[i]--;
  void rng;
  updateCamera(m, false);
  void p;
}

export function updateCamera(m: MallState, snap: boolean): void {
  const p = m.player;
  const tx = Math.max(0, Math.min(MALL_W - VIEW_W, Math.round(p.x - VIEW_W / 2)));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, Math.round(p.y - 128)));
  if (snap) {
    m.camX = tx;
    m.camY = ty;
    return;
  }
  m.camX = tx;
  const dy = ty - m.camY;
  m.camY += Math.max(-4, Math.min(4, dy));
}

// ---------------------------------------------------------------- elevators

function carOccupied(m: MallState, ci: number): boolean {
  const car = m.cars[ci];
  const s = SHAFTS[ci];
  const p = m.player;
  if (p.mode === 'elevator' && p.car === ci) return true;
  if (p.mode === 'ground' && overShaft(s, p.x) && p.y === car.y) return true;
  return m.spies.some((sp) => sp.mode !== 'dying' && overShaft(s, sp.x) && sp.y === car.y);
}

function stepCars(g: GameState, lvl: Level, input: PadFrame): void {
  const m = lvl.mall;
  const p = m.player;
  // Who stands on which car before it moves (to carry them along).
  const riders: { e: { x: number; y: number }; ci: number }[] = [];
  const onCar = (x: number, y: number): number => {
    for (let i = 0; i < SHAFTS.length; i++) {
      if (!overShaft(SHAFTS[i], x)) continue;
      const c = m.cars[i];
      if (Math.abs(c.y - CAR_H - y) <= 0.5 || (c.moving && Math.abs(c.y - y) <= 0.5)) return i;
    }
    return -1;
  };
  if (p.mode === 'ground') {
    const ci = onCar(p.x, p.y);
    if (ci >= 0) riders.push({ e: p, ci });
  }
  for (const s of m.spies) {
    if (s.mode === 'dying') continue;
    const ci = onCar(s.x, s.y);
    if (ci >= 0) riders.push({ e: s, ci });
  }

  m.cars.forEach((car, ci) => {
    const def = SHAFTS[ci];
    let drive: -1 | 0 | 1 | null = null;
    if (p.mode === 'elevator' && p.car === ci) {
      drive = input.held.has('up') ? -1 : input.held.has('down') ? 1 : 0;
    }
    const ev = stepCar(car, def, { drive, occupied: carOccupied(m, ci) }, lvl.rng);
    if (ev === 'ding') onCarStop(g, lvl, car, ci);
  });

  for (const r of riders) r.e.y += m.cars[r.ci].lastDy;
  if (p.mode === 'elevator') {
    const car = m.cars[p.car];
    p.y = car.y;
    p.x = shaftCenter(SHAFTS[p.car]);
  }
}

function onCarStop(g: GameState, lvl: Level, car: Car, ci: number): void {
  const m = lvl.mall;
  const p = m.player;
  const f = floorAtY(car.y);
  const cx = shaftCenter(SHAFTS[ci]);
  const inside = p.mode === 'elevator' && p.car === ci;
  const pf = floorBand(p.y);
  const near = inside || (Math.abs(f - pf) <= 1 && Math.abs(cx - p.x) < 200);
  if (near) sfx(g, 'ding');
  if (inside) {
    m.announce = { text: FLOOR_ANNOUNCE[f], t: 120 };
    return;
  }
  // Cars stopping near the player sometimes let a spy out.
  const dx = Math.abs(cx - p.x);
  const alive = m.spies.filter((s) => s.mode !== 'dying').length;
  if (
    f > 0 && f < FLOOR_P && Math.abs(f - pf) <= 1 && dx >= 48 && dx <= 220 && playerTargetable(m) &&
    lvl.frames > FIRST_SPAWN && alive < maxSpies(g.blackFriday) && lvl.rng.chance(0.3) && !carOccupied(m, ci)
  ) {
    const s = spawnSpy(g, lvl, cx, surf(f));
    lvl.bubbles.push({ text: lvl.rng.pick(SPY_ELEVATOR_LINES), x: s.x, y: s.y - 28, t: 110, follow: s.id });
  }
}

// ---------------------------------------------------------------- the agent

function stepPlayer(g: GameState, lvl: Level, input: PadFrame): void {
  const m = lvl.mall;
  const p = m.player;
  p.modeT++;
  if (p.invuln > 0) p.invuln--;
  if (p.cooldown > 0) p.cooldown--;
  if (p.shooting > 0) p.shooting--;

  switch (p.mode) {
    case 'zip': {
      if (p.modeT === 1) sfx(g, 'zip');
      p.x += 1.5;
      p.y = Math.round(cableY(p.x)) + 22;
      if (p.x >= ANCHOR_POST.x - 22) {
        p.mode = 'drop';
        p.modeT = 0;
        p.vy = 0;
        p.fallTop = p.y;
      }
      return;
    }
    case 'drop': {
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
      const ny = p.y + p.vy;
      const land = landingAt(m, p.x, p.y, ny);
      if (land) {
        p.y = land.y;
        p.mode = 'land';
        p.modeT = 0;
        sfx(g, 'thud');
      } else p.y = ny;
      return;
    }
    case 'land': {
      if (p.modeT >= 24) {
        p.mode = 'selfie';
        p.modeT = 0;
        lvl.selfieT = SELFIE_FRAMES;
        sfx(g, 'flash');
      }
      return;
    }
    case 'selfie': {
      lvl.selfieT--;
      if (lvl.selfieT <= 0 || (p.modeT > 10 && input.pressed.size > 0)) {
        lvl.selfieT = 0;
        p.mode = 'ground';
        p.modeT = 0;
        p.safe = { x: p.x, floor: 0 };
      }
      return;
    }
    case 'dead':
      p.deadT++;
      if (p.vy !== 0 || p.deathCause === 'fall') {
        // tumble / settle
      }
      return;
    case 'hidden': {
      p.hideT++;
      const leave = input.pressed.has('left') || input.pressed.has('right') || input.pressed.has('down') ||
        (p.hideT > 20 && input.pressed.has('up'));
      if (p.hideT >= HIDE_FRAMES || leave) {
        p.mode = 'ground';
        p.modeT = 0;
        sfx(g, 'door');
        if (!g.photoTaken) {
          g.photoTaken = true;
          g.inventory.push('PHOTO STRIP');
          m.photoPopup = 180;
          sfx(g, 'flash');
        }
      }
      return;
    }
    case 'escalator': {
      const e = ESCALATORS[p.esc!.i];
      const up = p.esc!.up;
      p.esc!.t++;
      const k = p.esc!.t / ESC_LEN;
      const from = up ? e.bottomX : e.topX;
      const to = up ? e.topX : e.bottomX;
      p.x = from + (to - from) * k;
      p.facing = to > from ? 1 : -1;
      p.y = up ? surf(e.lower) - p.esc!.t : surf(e.lower - 1) + p.esc!.t;
      if (p.esc!.t >= ESC_LEN) {
        p.x = to;
        p.y = up ? surf(e.lower - 1) : surf(e.lower);
        p.mode = 'ground';
        p.modeT = 0;
        p.esc = null;
      }
      if (input.pressed.has('a')) shoot(g, lvl);
      return;
    }
    case 'elevator': {
      const car = m.cars[p.car];
      p.duck = false;
      if (input.pressed.has('a')) shoot(g, lvl);
      const f = carFloor(car);
      const side = input.held.has('left') ? -1 : input.held.has('right') ? 1 : 0;
      if (f >= 0 && side !== 0 && !input.held.has('up') && !input.held.has('down')) {
        p.mode = 'ground';
        p.modeT = 0;
        p.facing = side as 1 | -1;
        p.car = -1;
        sfx(g, 'door');
      }
      return;
    }
    case 'air':
      stepAir(g, lvl, input);
      return;
    case 'ground':
      stepGround(g, lvl, input);
      return;
  }
}

function stepGround(g: GameState, lvl: Level, input: PadFrame): void {
  const m = lvl.mall;
  const p = m.player;
  const ground = groundAt(m, p.x, p.y);
  if (!ground) {
    startFall(p);
    stepAir(g, lvl, input);
    return;
  }
  p.standCar = ground.car;
  const f = floorAtY(p.y);
  const speed = walkSpeed(lvl.powers);

  if (ground.kind === 'floor' && f >= 0 && !onWet(m, p.x, f)) {
    const nearShaftEdge = SHAFTS.some((s) => serves(s, f) && p.x > s.x - 14 && p.x < s.x + 38);
    if (!nearShaftEdge) p.safe = { x: p.x, floor: f };
  }

  if (p.frozen > 0) {
    p.frozen--;
    p.duck = false;
    return;
  }

  // Wet floor: slide at walking speed; no stopping or turning until off the patch.
  if (f >= 0 && onWet(m, p.x, f)) {
    if (p.slide === 0) {
      const h = input.held.has('left') ? -1 : input.held.has('right') ? 1 : 0;
      p.slide = h !== 0 ? h : p.facing;
      sfx(g, 'slide');
    }
    p.facing = p.slide as 1 | -1;
    p.duck = false;
    moveX(p, p.slide * 1);
    if (input.pressed.has('a')) shoot(g, lvl);
    return;
  }
  if (p.slide !== 0) {
    p.slide = 0;
    p.kick = false;
  }
  p.kick = false;

  const up = input.pressed.has('up');
  const down = input.pressed.has('down');
  const left = input.held.has('left');
  const right = input.held.has('right');

  // Up / Down interactions.
  if ((up || down) && f >= 0 && tryInteract(g, lvl, f, up ? 'up' : 'down')) {
    p.still = 0;
    return;
  }

  p.duck = input.held.has('down') && !downIsInteraction(m, p, f);

  if (input.pressed.has('b') && !p.duck) {
    const dir = left ? -1 : right ? 1 : 0;
    p.vy = jumpVelocity(lvl.powers);
    p.vx = dir * speed;
    p.kick = dir !== 0;
    p.mode = 'air';
    p.modeT = 0;
    p.fallTop = p.y;
    p.duck = false;
    sfx(g, 'jump');
    if (input.pressed.has('a')) shoot(g, lvl);
    return;
  }
  if (input.pressed.has('a')) shoot(g, lvl);

  let moved = false;
  if (!p.duck && (left || right) && !(left && right)) {
    const dir = left ? -1 : 1;
    p.facing = dir;
    moveX(p, dir * speed);
    p.anim++;
    moved = true;
  }

  // Standing still at a shaft opening calls the car automatically.
  if (!moved && f >= 0) {
    p.still++;
    if (p.still === AUTO_CALL_FRAMES) {
      for (let i = 0; i < SHAFTS.length; i++) {
        const s = SHAFTS[i];
        if (serves(s, f) && nearShaft(s, p.x) && carFloor(m.cars[i]) !== f) {
          if (m.cars[i].call !== f && callCar(m.cars[i], s, f)) sfx(g, 'select');
        }
      }
    }
  } else p.still = 0;

  // Walked off an edge / into a pit?
  if (!groundAt(m, p.x, p.y)) startFall(p);
}

function downIsInteraction(m: MallState, p: MallPlayer, f: number): boolean {
  if (f < 0) return false;
  for (let i = 0; i < SHAFTS.length; i++) if (serves(SHAFTS[i], f) && nearShaft(SHAFTS[i], p.x)) return true;
  for (const e of ESCALATORS) if (e.lower - 1 === f && Math.abs(p.x - e.topX) <= 6) return true;
  void m;
  return false;
}

function moveX(p: MallPlayer, dx: number): void {
  p.x = Math.max(WALL_L + 4, Math.min(WALL_R - 4, p.x + dx));
}

function startFall(p: MallPlayer): void {
  p.mode = 'air';
  p.modeT = 0;
  p.vy = 0;
  p.vx = 0;
  p.kick = false;
  p.duck = false;
  p.fallTop = p.y;
  p.standCar = -1;
}

function onWet(m: MallState, x: number, f: number): boolean {
  const w = m.wet;
  return !!w && w.floor === f && x >= w.x0 && x <= w.x1;
}

function stepAir(g: GameState, lvl: Level, input: PadFrame): void {
  const m = lvl.mall;
  const p = m.player;
  if (input.pressed.has('a')) shoot(g, lvl);
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  moveX(p, p.vx);
  const ny = p.y + p.vy;
  p.fallTop = Math.min(p.fallTop, p.y);
  if (p.vy > 0) {
    const land = landingAt(m, p.x, p.y, ny);
    if (land) {
      p.y = land.y;
      const dist = land.y - p.fallTop;
      p.mode = 'ground';
      p.modeT = 0;
      p.vy = 0;
      p.standCar = land.car;
      if (dist > FATAL_FALL) {
        killPlayer(g, lvl, 'fall', true);
        return;
      }
      if (dist > 24) sfx(g, 'thud');
      const f = floorAtY(p.y);
      if (p.kick && f >= 0 && onWet(m, p.x, f)) {
        // A jump-kick landing on a wet floor keeps kicking while it slides.
        p.slide = p.vx > 0 ? 1 : p.vx < 0 ? -1 : p.facing;
      } else p.kick = false;
      p.vx = 0;
      return;
    }
  }
  p.y = ny;
  if (p.y > WORLD_H + 40) killPlayer(g, lvl, 'fall', true);
}

function tryInteract(g: GameState, lvl: Level, f: number, dir: 'up' | 'down'): boolean {
  const m = lvl.mall;
  const p = m.player;
  // Elevator: board a car standing here, or call one.
  for (let i = 0; i < SHAFTS.length; i++) {
    const s = SHAFTS[i];
    if (!serves(s, f)) continue;
    const car = m.cars[i];
    if (overShaft(s, p.x) && carFloor(car) === f) {
      p.mode = 'elevator';
      p.modeT = 0;
      p.car = i;
      p.x = shaftCenter(s);
      p.duck = false;
      sfx(g, 'door');
      return true;
    }
    if (nearShaft(s, p.x) && carFloor(car) !== f) {
      if (callCar(car, s, f)) sfx(g, 'select');
      return true;
    }
  }
  // Escalators.
  for (let i = 0; i < ESCALATORS.length; i++) {
    const e = ESCALATORS[i];
    if (dir === 'up' && e.lower === f && Math.abs(p.x - e.bottomX) <= 6) {
      p.mode = 'escalator';
      p.esc = { i, up: true, t: 0 };
      p.x = e.bottomX;
      return true;
    }
    if (dir === 'down' && e.lower - 1 === f && Math.abs(p.x - e.topX) <= 6) {
      p.mode = 'escalator';
      p.esc = { i, up: false, t: 0 };
      p.x = e.topX;
      return true;
    }
  }
  if (dir !== 'up') return false;
  // Store doors.
  for (const s of STORES) {
    if (s.floor !== f || Math.abs(p.x - doorX(s)) > 7) continue;
    const rt = lvl.stores[s.id];
    if (isOpenStore(s, rt)) {
      sfx(g, 'door');
      g.fade = { t: 0, total: 30, action: 'enterStore', arg: s.id, done: false };
    } else {
      banner(g, s.role === 'target' ? BANNERS.cleared : BANNERS.closed, 70, C.LGREY);
      sfx(g, 'buzzer');
    }
    return true;
  }
  // Directory kiosk.
  for (const k of KIOSKS) {
    if (k.floor !== f || Math.abs(p.x - k.x) > 9) continue;
    if (m.kioskCool > 0) {
      banner(g, BANNERS.kioskCool, 60, C.LGREY);
      return true;
    }
    m.kioskCool = KIOSK_COOLDOWN;
    m.kioskPanel = { t: 200, store: nearestPackageStore(lvl) };
    sfx(g, 'blip');
    return true;
  }
  // Photo booth.
  if (PHOTO_BOOTH.floor === f && Math.abs(p.x - PHOTO_BOOTH.x) <= 9) {
    p.mode = 'hidden';
    p.modeT = 0;
    p.hideT = 0;
    p.x = PHOTO_BOOTH.x;
    p.duck = false;
    sfx(g, 'door');
    return true;
  }
  // The getaway car.
  if (f === FLOOR_P && Math.abs(p.x - wagonCenter()) <= 30) {
    if (lvl.packages >= 6) {
      if (!lvl.exitFired) {
        lvl.exitFired = true;
        g.events.push({ t: 'jingle', id: 'jingle_clear' });
      }
    } else if (m.exitBuzzCool === 0) {
      m.exitBuzzCool = 30;
      banner(g, BANNERS.packagesLeft(6 - lvl.packages), 90, C.RED);
      sfx(g, 'buzzer');
    }
    return true;
  }
  return false;
}

/** The nearest store still holding a package (for kiosks). */
export function nearestPackageStore(lvl: Level): import('../art/manifest').StoreId | null {
  const p = lvl.mall.player;
  const pf = floorBand(p.y);
  let best: { id: import('../art/manifest').StoreId; d: number } | null = null;
  for (const s of STORES) {
    if (s.role !== 'target' || lvl.stores[s.id]?.cleared) continue;
    const d = Math.abs(s.floor - pf) * 400 + Math.abs(doorX(s) - p.x);
    if (!best || d < best.d) best = { id: s.id, d };
  }
  return best ? best.id : null;
}

// ---------------------------------------------------------------- shooting

export function shoot(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  if (p.cooldown > 0) return;
  const mine = m.bullets.filter((b) => b.mine).length;
  const max = maxBullets(lvl.powers);
  if (mine >= max) return;
  p.cooldown = shotCooldown(lvl.powers);
  p.shooting = 10;
  m.volley++;
  const y = p.y - (p.duck ? SHOT_LOW : SHOT_HIGH);
  const x = p.x + p.facing * 8;
  const vys = lvl.powers.weapon === 'spread' ? [-0.7, 0, 0.7] : [0];
  for (const vy of vys) {
    if (m.bullets.filter((b) => b.mine).length >= max + (vys.length - 1)) break;
    m.bullets.push({ x, y, vx: p.facing * BULLET_SPEED, vy, mine: true, volley: m.volley, dist: 0 });
  }
  sfx(g, 'shot');
  copNoticesShot(g, lvl);
}

function copNoticesShot(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  const cop = m.cop;
  if (cop.chase > 0 || cop.cool > 0) return;
  const f = floorBand(p.y);
  if (f !== cop.floor) return;
  const dx = p.x - cop.x;
  // "In front of him": same floor, he is facing the player, within ~128 px.
  if (Math.abs(dx) <= 128 && Math.sign(dx) === cop.facing) {
    cop.chase = COP_CHASE;
    sfx(g, 'whistle');
    lvl.bubbles.push({ text: BANNERS.copShout, x: cop.x, y: surf(cop.floor) - 30, t: 120, follow: cop.id });
  }
}

// ---------------------------------------------------------------- spies

export function spawnSpy(g: GameState, lvl: Level, x: number, y: number): Spy {
  const p = lvl.mall.player;
  const s: Spy = {
    id: newId(g), x, y, vy: 0, facing: p.x < x ? -1 : 1, mode: 'emerge', t: 0, age: 0, shotT: FIRST_SHOT_DELAY,
    aimHigh: true, dodgeVolley: -1, wanderX: x, slide: 0, anim: 0, fallTop: y, deathPts: 0,
  };
  lvl.mall.spies.push(s);
  return s;
}

function spyCanSee(m: MallState, s: Spy): boolean {
  if (!playerTargetable(m)) return false;
  const p = m.player;
  const dy = s.y - p.y;
  return dy >= -2 && dy <= 26 && Math.abs(p.x - s.x) <= SEE_RANGE;
}

function spyStepBlocked(m: MallState, s: Spy, nx: number): boolean {
  if (nx < WALL_L + 6 || nx > WALL_R - 6) return true;
  const f = floorAtY(s.y);
  if (f < 0) return false;
  // Never walk into pits (or into a car standing at the floor). Standing on grates is fine.
  const probe = nx + Math.sign(nx - s.x) * 5;
  const si = shaftAt(probe, f);
  if (si >= 0 && shaftAt(s.x, f) !== si) {
    if (m.cars[si].y >= surf(f)) return true;
  }
  return false;
}

function stepSpies(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const rng = lvl.rng;
  const speed = spySpeed(g.loop) * (lvl.alarm ? ALARM_SPEED : 1);
  for (let i = m.spies.length - 1; i >= 0; i--) {
    const s = m.spies[i];
    s.age++;
    s.t++;
    if (s.mode === 'dying') {
      if (s.t >= 24) m.spies.splice(i, 1);
      continue;
    }
    // Ground check (grates can vanish only by a car passing, which crushes; this is a safety net).
    if (s.mode !== 'fall' && !groundAt(m, s.x, s.y)) {
      s.mode = 'fall';
      s.vy = 0;
      s.fallTop = s.y;
    }
    if (s.mode === 'fall') {
      s.vy = Math.min(MAX_FALL, s.vy + GRAVITY);
      const ny = s.y + s.vy;
      const land = landingAt(m, s.x, s.y, ny);
      if (land) {
        s.y = land.y;
        s.mode = 'walk';
        s.t = 0;
        if (land.y - s.fallTop > FATAL_FALL) killSpy(g, lvl, s, 0);
      } else s.y = ny;
      if (s.y > WORLD_H + 40) m.spies.splice(i, 1);
      continue;
    }
    const f = floorAtY(s.y);
    // Wet floor sliding.
    if (f >= 0 && onWet(m, s.x, f)) {
      if (s.slide === 0) s.slide = s.facing;
      s.x = Math.max(WALL_L + 6, Math.min(WALL_R - 6, s.x + s.slide));
      s.anim++;
      continue;
    }
    s.slide = 0;

    if (s.mode === 'emerge') {
      if (s.t >= 24) {
        s.mode = 'walk';
        s.t = 0;
      }
      continue;
    }
    if (s.mode === 'duck') {
      if (s.t >= 24) {
        s.mode = 'walk';
        s.t = 0;
      }
      continue;
    }
    if (s.mode === 'aim') {
      const p = m.player;
      if (spyCanSee(m, s)) s.facing = p.x < s.x ? -1 : 1;
      if (s.t >= AIM_FRAMES) {
        const y = s.y - (s.aimHigh ? SHOT_HIGH : SHOT_LOW);
        m.bullets.push({ x: s.x + s.facing * 8, y, vx: s.facing * ENEMY_BULLET_SPEED, vy: 0, mine: false, volley: 0, dist: 0 });
        sfx(g, 'eshot');
        s.shotT = Math.round(shotInterval(g.loop) * (lvl.alarm ? 0.8 : 1)) - AIM_FRAMES;
        s.mode = 'walk';
        s.t = 0;
      }
      continue;
    }

    const sees = spyCanSee(m, s);
    if (sees) {
      const p = m.player;
      const dx = p.x - s.x;
      s.facing = dx < 0 ? -1 : 1;
      if (s.mode === 'wait') s.mode = 'walk';
      if (Math.abs(dx) > KEEP_DISTANCE) {
        const nx = s.x + s.facing * speed;
        if (!spyStepBlocked(m, s, nx)) {
          s.x = nx;
          s.anim++;
        }
      }
      if (s.shotT > 0) s.shotT--;
      if (s.shotT <= 0) {
        s.mode = 'aim';
        s.t = 0;
        s.aimHigh = rng.chance(0.5);
      }
      continue;
    }
    if (s.shotT > FIRST_SHOT_DELAY) s.shotT--;

    // Not seeing the player: wander, sometimes wait at a shaft opening.
    if (s.mode === 'wait') {
      if (s.t >= 240) {
        s.mode = 'walk';
        s.t = 0;
        s.wanderX = pickWander(m, s, rng);
      }
      continue;
    }
    if (Math.abs(s.wanderX - s.x) < 1) {
      const si = f >= 0 ? shaftAt(s.x, f) : -1;
      if (si >= 0 && m.cars[si].y < surf(f)) {
        s.mode = 'wait';
        s.t = 0;
        continue;
      }
      s.wanderX = pickWander(m, s, rng);
    }
    const dir = s.wanderX < s.x ? -1 : 1;
    s.facing = dir;
    const nx = s.x + dir * Math.min(speed, Math.abs(s.wanderX - s.x));
    if (spyStepBlocked(m, s, nx)) s.wanderX = pickWander(m, s, rng);
    else {
      s.x = nx;
      s.anim++;
    }
  }
}

function pickWander(m: MallState, s: Spy, rng: GameState['rng']): number {
  const f = floorAtY(s.y);
  if (f >= 0 && rng.chance(0.3)) {
    // Go and wait on a grate (a shaft opening whose car is above).
    const grates = SHAFTS.map((sh, i) => ({ sh, i })).filter(({ sh, i }) => serves(sh, f) && m.cars[i].y < surf(f));
    if (grates.length) return shaftCenter(rng.pick(grates).sh);
  }
  return Math.max(WALL_L + 10, Math.min(WALL_R - 10, s.x + (rng.chance(0.5) ? -1 : 1) * rng.range(30, 120)));
}

export function killSpy(g: GameState, lvl: Level, s: Spy, pts: number): void {
  if (s.mode === 'dying') return;
  s.mode = 'dying';
  s.t = 0;
  sfx(g, 'spyhit');
  if (pts) {
    addScore(g, pts);
    popup(lvl.popups, String(pts), s.x, s.y - 26);
  }
  const rng = lvl.rng;
  if (rng.chance(0.35)) {
    lvl.bubbles.push({ text: rng.pick(SPY_LAST_WORDS), x: s.x, y: s.y - 28, t: 90 });
  }
  if (rng.chance(0.05)) {
    const kind: PowerKind = randomPower(rng, { food: 0.5 });
    lvl.mall.pickups.push({ x: s.x, y: s.y, kind, t: 420 });
  }
}

// ---------------------------------------------------------------- bullets

function stepBullets(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  for (let i = m.bullets.length - 1; i >= 0; i--) {
    const b = m.bullets[i];
    const x0 = b.x;
    b.x += b.vx;
    b.y += b.vy;
    b.dist += Math.abs(b.vx);
    const xa = Math.min(x0, b.x) - 2;
    const xb = Math.max(x0, b.x) + 2;
    let hit = false;
    const offscreen = b.x < m.camX - 16 || b.x > m.camX + VIEW_W + 16 || b.dist > 260 || b.x < WALL_L || b.x > WALL_R;
    if (offscreen) {
      m.bullets.splice(i, 1);
      continue;
    }
    // People who block bullets from both sides: mall walkers, the Segway cop.
    for (const w of m.walkers) {
      if (rectsOverlap(xa, b.y - 1, xb, b.y + 1, w.x - 6, surf(w.floor) - 24, w.x + 6, surf(w.floor))) {
        hit = true;
        if (b.mine) {
          addScore(g, POINTS.walker);
          popup(lvl.popups, String(POINTS.walker), w.x, surf(w.floor) - 26);
          w.heyT = 60;
          lvl.bubbles.push({ text: BANNERS.hey, x: w.x, y: surf(w.floor) - 28, t: 60, follow: w.id });
          sfx(g, 'hurt');
        }
        break;
      }
    }
    const cop = m.cop;
    if (!hit && rectsOverlap(xa, b.y - 1, xb, b.y + 1, cop.x - 7, surf(cop.floor) - 24, cop.x + 7, surf(cop.floor))) {
      hit = true;
      sfx(g, 'ping');
    }
    if (!hit && b.mine) hit = playerBulletHits(g, lvl, b, xa, xb);
    if (!hit && !b.mine && p.mode !== 'dead' && p.mode !== 'hidden') {
      const h = p.mode === 'ground' || p.mode === 'air' ? playerHeight(p) : STAND_H;
      const targetable = p.mode === 'ground' || p.mode === 'air' || p.mode === 'escalator' ||
        (p.mode === 'elevator' && !m.cars[p.car].moving);
      if (targetable && rectsOverlap(xa, b.y - 1, xb, b.y + 1, p.x - HALF_W, p.y - h, p.x + HALF_W, p.y)) {
        hit = true;
        if (!invulnerable(g, lvl)) {
          if (absorbHit(lvl.powers)) {
            sfx(g, 'ping');
            p.invuln = 60;
            popup(lvl.popups, 'ARMOR!', p.x, p.y - 28);
          } else killPlayer(g, lvl, 'shot', false);
        }
      }
    }
    if (hit) m.bullets.splice(i, 1);
  }
}

function playerBulletHits(g: GameState, lvl: Level, b: Bullet, xa: number, xb: number): boolean {
  const m = lvl.mall;
  const rng = lvl.rng;
  // Spies (and their one-volley dodge decision).
  for (const s of m.spies) {
    if (s.mode === 'dying' || s.mode === 'emerge') continue;
    const approaching = Math.sign(s.x - b.x) === Math.sign(b.vx) && Math.abs(s.x - b.x) < 44 && Math.abs(s.y - b.y) < 26;
    if (approaching && s.dodgeVolley !== b.volley && (s.mode === 'walk' || s.mode === 'wait')) {
      s.dodgeVolley = b.volley;
      if (b.y < s.y - 12 && rng.chance(DODGE_CHANCE)) {
        s.mode = 'duck';
        s.t = 0;
      }
    }
    if (rectsOverlap(xa, b.y - 1, xb, b.y + 1, s.x - HALF_W, s.y - spyHeight(s), s.x + HALF_W, s.y)) {
      killSpy(g, lvl, s, POINTS.spyShot);
      return true;
    }
  }
  // Hanging lamps and disco balls (cord and shade).
  for (const l of m.lamps) {
    if (l.state !== 'hang') continue;
    const top = surf(l.floor) - 44;
    const shadeTop = l.y - (l.disco ? 14 : 10);
    const cord = rectsOverlap(xa, b.y - 1, xb, b.y + 1, l.x - 2, top, l.x + 2, shadeTop);
    const shade = rectsOverlap(xa, b.y - 1, xb, b.y + 1, l.x - 7, shadeTop, l.x + 7, l.y);
    if (cord || shade) {
      l.state = 'fall';
      l.vy = 0;
      l.dir = b.vx > 0 ? 1 : -1;
      sfx(g, 'lampfall');
      return true;
    }
  }
  // Fountains.
  for (let i = 0; i < FOUNTAINS.length; i++) {
    const fo = FOUNTAINS[i];
    if (!rectsOverlap(xa, b.y - 1, xb, b.y + 1, fo.x - 14, surf(fo.floor) - 20, fo.x + 14, surf(fo.floor))) continue;
    if (m.fountainCool[i] === 0) {
      m.fountainCool[i] = FOUNTAIN_COOLDOWN;
      sfx(g, 'splash');
      const n = rng.range(3, 5);
      const gold = rng.chance(1 / 20);
      for (let k = 0; k < n; k++) {
        m.coins.push({
          x: fo.x + rng.range(-6, 6), y: surf(fo.floor) - 18, vx: (rng.next() * 2 - 1) * 1.4, vy: -2.5 - rng.next() * 1.5,
          floor: fo.floor, gold: gold && k === 0, t: 480,
        });
      }
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- lamps & disco balls

function stepLamps(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  for (const l of m.lamps) {
    if (l.state === 'fall') {
      l.vy = Math.min(6, l.vy + 0.3);
      l.y += l.vy;
      lightKills(g, lvl, l.x, l.y - 10, l.y);
      if (l.y >= surf(l.floor)) {
        l.y = surf(l.floor);
        g.shake = Math.max(g.shake, 10);
        if (l.disco) {
          l.state = 'roll';
          l.t = 0;
          sfx(g, 'thud');
        } else {
          l.state = 'gone';
          sfx(g, 'glass');
          m.shards.push({ x: l.x, y: l.y, t: 240 });
          m.dark.push({ floor: l.floor, x0: l.x - 40, x1: l.x + 40, t: 120 });
        }
      }
    } else if (l.state === 'roll') {
      l.t++;
      l.x += l.dir * 2;
      lightKills(g, lvl, l.x, l.y - 14, l.y);
      if (l.x <= WALL_L + 8 || l.x >= WALL_R - 8) {
        l.state = 'gone';
        sfx(g, 'glass');
        g.shake = Math.max(g.shake, 6);
        m.shards.push({ x: l.x, y: l.y, t: 240 });
      } else if (isPit(m, l.x, l.floor)) {
        l.state = 'gone';
        sfx(g, 'crush');
      }
    }
  }
  void p;
}

function lightKills(g: GameState, lvl: Level, x: number, y0: number, y1: number): void {
  const m = lvl.mall;
  for (const s of m.spies) {
    if (s.mode === 'dying') continue;
    if (rectsOverlap(x - 7, y0, x + 7, y1, s.x - HALF_W, s.y - spyHeight(s), s.x + HALF_W, s.y)) {
      killSpy(g, lvl, s, POINTS.spySpecial);
    }
  }
  const p = m.player;
  if ((p.mode === 'ground' || p.mode === 'air') &&
    rectsOverlap(x - 7, y0, x + 7, y1, p.x - HALF_W, p.y - playerHeight(p), p.x + HALF_W, p.y)) {
    killPlayer(g, lvl, 'lamp', false);
  }
}

// ---------------------------------------------------------------- janitor, walkers, cop

function stepPeople(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  const rng = lvl.rng;
  // Janitor: patrols 1F and mops, leaving a wet patch that never reaches a shaft opening.
  const j = m.janitor;
  j.anim++;
  if (j.mopT > 0) {
    j.mopT--;
    if (j.mopT === 45) {
      const x0 = Math.max(JANITOR.x0 - 24, j.x - WET_W / 2);
      const x1 = Math.min(JANITOR.x1 + 24, x0 + WET_W);
      m.wet = { floor: JANITOR.floor, x0: x1 - WET_W, x1, t: WET_FRAMES };
    }
  } else {
    j.x += j.dir * 0.5;
    if (j.x <= JANITOR.x0) j.dir = 1;
    if (j.x >= JANITOR.x1) j.dir = -1;
    if (--j.nextMop <= 0) {
      j.mopT = 90;
      j.nextMop = rng.range(420, 640);
    }
  }
  if (m.wet && --m.wet.t <= 0) m.wet = null;

  // Mall walkers: power-walk their stretch and push the agent along.
  for (const w of m.walkers) {
    w.anim++;
    if (w.heyT > 0) w.heyT--;
    w.x += w.dir * 0.7;
    if (w.x >= w.x1) w.dir = -1;
    if (w.x <= w.x0) w.dir = 1;
    if (p.mode === 'ground' && floorAtY(p.y) === w.floor && Math.abs(p.x - w.x) < 11) {
      if ((p.x - w.x) * w.dir >= 0) moveX(p, w.x + w.dir * 11 - p.x);
    }
  }

  // Segway cop.
  const cop = m.cop;
  cop.anim++;
  if (cop.cool > 0) cop.cool--;
  const onCopFloor = (p.mode === 'ground' || p.mode === 'air') && floorBand(p.y) === cop.floor;
  if (cop.chase > 0) {
    cop.chase--;
    if (onCopFloor) {
      const dir = p.x < cop.x ? -1 : 1;
      cop.facing = dir;
      cop.x = Math.max(cop.x0, Math.min(cop.x1, cop.x + dir * 1.15));
      if (p.mode === 'ground' && Math.abs(p.x - cop.x) < 10 && p.frozen === 0 && !invulnerable(g, lvl)) {
        p.frozen = COP_FREEZE;
        p.duck = false;
        cop.chase = 0;
        cop.cool = 300;
        addScore(g, POINTS.copCatch);
        popup(lvl.popups, BANNERS.detained, p.x, p.y - 30, 90);
        sfx(g, 'whistle');
      }
    }
  } else {
    cop.x += cop.facing * 0.5;
    if (cop.x >= cop.x1) cop.facing = -1;
    if (cop.x <= cop.x0) cop.facing = 1;
  }
}

// ---------------------------------------------------------------- coins & dropped power-ups

function stepCoinsAndPickups(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  const canTouch = p.mode === 'ground' || p.mode === 'air';
  for (let i = m.coins.length - 1; i >= 0; i--) {
    const c = m.coins[i];
    c.vy += 0.2;
    c.x = Math.max(WALL_L, Math.min(WALL_R, c.x + c.vx));
    c.y += c.vy;
    const fy = surf(c.floor);
    if (c.y >= fy) {
      c.y = fy;
      c.vy = Math.abs(c.vy) > 0.8 ? -Math.abs(c.vy) * 0.55 : 0;
      c.vx *= 0.8;
    }
    if (--c.t <= 0) {
      m.coins.splice(i, 1);
      continue;
    }
    if (canTouch && rectsOverlap(c.x - 4, c.y - 8, c.x + 4, c.y, p.x - HALF_W, p.y - STAND_H, p.x + HALF_W, p.y)) {
      m.coins.splice(i, 1);
      addScore(g, POINTS.coin);
      popup(lvl.popups, String(POINTS.coin), c.x, c.y - 10);
      sfx(g, 'coin');
      if (c.gold) {
        g.lives++;
        banner(g, BANNERS.extraLife, 90, C.GOLD, true);
        sfx(g, 'powerup');
      }
    }
  }
  for (let i = m.pickups.length - 1; i >= 0; i--) {
    const u = m.pickups[i];
    if (--u.t <= 0) {
      m.pickups.splice(i, 1);
      continue;
    }
    if (canTouch && rectsOverlap(u.x - 7, u.y - 14, u.x + 7, u.y, p.x - HALF_W, p.y - STAND_H, p.x + HALF_W, p.y)) {
      m.pickups.splice(i, 1);
      collectPower(g, lvl, u.kind);
    }
  }
}

export function collectPower(g: GameState, lvl: Level, kind: PowerKind): void {
  const lives = applyPower(lvl.powers, kind);
  g.lives += lives;
  addScore(g, POINTS.powerup);
  sfx(g, 'powerup');
  banner(g, POWERUP_NAMES[kind], 90, C.CYAN);
}

// ---------------------------------------------------------------- crushes & contact

function checkCrushes(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  m.cars.forEach((car, ci) => {
    const def = SHAFTS[ci];
    if (car.lastDy > 0) {
      // Coming down onto someone standing below the car.
      const bottom = car.y;
      const hits = (x: number, feet: number, h: number) =>
        overShaft(def, x) && bottom > feet - h + 2 && bottom < feet - 0.5;
      for (const s of m.spies) {
        if (s.mode === 'dying') continue;
        if (hits(s.x, s.y, spyHeight(s))) {
          killSpy(g, lvl, s, POINTS.spySpecial);
          sfx(g, 'crush');
          g.shake = Math.max(g.shake, 10);
        }
      }
      if ((p.mode === 'ground' || p.mode === 'air') && hits(p.x, p.y, playerHeight(p))) {
        // A car coming because it was called here must pick the agent up, not crush him.
        const pickup = stoppingFloor(car) === floorAtY(p.y);
        if (!pickup && p.invuln === 0) {
          sfx(g, 'crush');
          g.shake = Math.max(g.shake, 12);
          killPlayer(g, lvl, 'crush', true);
        }
      }
    }
    if (car.lastDy < 0) {
      // Riding the roof up into the top of the shaft.
      const ceil = shaftCeiling(def);
      const roof = car.y - CAR_H;
      if (p.mode === 'ground' && overShaft(def, p.x) && Math.abs(p.y - roof) <= 0.5 && p.y - playerHeight(p) < ceil) {
        sfx(g, 'crush');
        g.shake = Math.max(g.shake, 12);
        killPlayer(g, lvl, 'crush', true);
      }
      for (const s of m.spies) {
        if (s.mode !== 'dying' && overShaft(def, s.x) && Math.abs(s.y - roof) <= 0.5 && s.y - STAND_H < ceil) {
          killSpy(g, lvl, s, POINTS.spySpecial);
          sfx(g, 'crush');
        }
      }
    }
  });
}

function checkContacts(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  if (p.mode !== 'ground' && p.mode !== 'air' && p.mode !== 'escalator') return;
  const h = playerHeight(p);
  const w = p.kick ? HALF_W + 3 : HALF_W;
  for (const s of m.spies) {
    if (s.mode === 'dying' || s.mode === 'emerge') continue;
    if (!rectsOverlap(p.x - w, p.y - h, p.x + w, p.y, s.x - 4, s.y - spyHeight(s), s.x + 4, s.y)) continue;
    if (p.kick) {
      const sliding = p.slide !== 0;
      killSpy(g, lvl, s, sliding ? POINTS.spySpecial : POINTS.spyShot);
      sfx(g, 'kick');
    } else if (lvl.powers.invincT > 0) {
      killSpy(g, lvl, s, POINTS.spyShot);
    } else if (p.invuln === 0) {
      killPlayer(g, lvl, 'spy', false);
      return;
    }
  }
}

export function killPlayer(g: GameState, lvl: Level, cause: string, ignoreInvuln: boolean): void {
  const p = lvl.mall.player;
  if (p.mode === 'dead') return;
  if (!ignoreInvuln && invulnerable(g, lvl)) return;
  if (cause === 'crush' && p.invuln > 0) return;
  p.mode = 'dead';
  p.deadT = 0;
  p.deathCause = cause;
  p.duck = false;
  p.kick = false;
  p.slide = 0;
  sfx(g, 'death');
}

/** Put the agent back at the last safe spot after losing a life: spies and bullets cleared, freeze removed. */
export function respawnInMall(lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  p.mode = 'ground';
  p.modeT = 0;
  p.x = p.safe.x;
  p.y = surf(p.safe.floor);
  p.vx = 0;
  p.vy = 0;
  p.duck = false;
  p.kick = false;
  p.slide = 0;
  p.frozen = 0;
  p.car = -1;
  p.esc = null;
  p.invuln = RESPAWN_INVULN;
  p.deadT = 0;
  m.spies = [];
  m.bullets = [];
  m.cop.chase = 0;
  m.spawnT = Math.min(m.spawnT, 60);
  updateCamera(m, true);
}

// ---------------------------------------------------------------- spawning

function stepSpawning(g: GameState, lvl: Level): void {
  const m = lvl.mall;
  const p = m.player;
  if (p.mode === 'zip' || p.mode === 'drop' || p.mode === 'land' || p.mode === 'selfie' || p.mode === 'dead') return;
  m.spawnT++;
  const first = lvl.frames < FIRST_SPAWN + 400 && m.spies.length === 0 && m.spawnT < FIRST_SPAWN;
  if (first) return;
  let interval = spawnInterval(g.loop, g.blackFriday);
  if (lvl.alarm) interval = Math.round(interval * ALARM_SPAWN);
  if (m.spawnT < interval && !(m.spawnT >= FIRST_SPAWN && lvl.frames < FIRST_SPAWN * 2 && m.spies.length === 0)) return;
  const alive = m.spies.filter((s) => s.mode !== 'dying').length;
  if (alive >= maxSpies(g.blackFriday)) {
    m.spawnT = Math.floor(interval * 0.7);
    return;
  }
  const pf = floorBand(p.y);
  const doors = STORES.filter((s) => isOpenStore(s, lvl.stores[s.id]) && Math.abs(s.floor - pf) <= 1)
    .map((s) => ({ s, x: doorX(s) }))
    .filter((d) => {
      const dx = Math.abs(d.x - p.x);
      return dx >= 64 && dx <= 200;
    });
  if (!doors.length) {
    m.spawnT = interval - 30;
    return;
  }
  const d = lvl.rng.pick(doors);
  spawnSpy(g, lvl, d.x, surf(d.s.floor));
  m.spawnT = 0;
}

export function storeDoorOf(id: string): { x: number; floor: number } {
  const s = storeById(id);
  return { x: doorX(s), floor: s.floor };
}
