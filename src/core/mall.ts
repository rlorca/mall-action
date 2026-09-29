import {
  ALARM_SPY_SPEED_MULT,
  AUTO_CALL_DELAY,
  AUTO_CAR_WAIT,
  BULLET_SPEED,
  COP_ALERT_RANGE,
  COP_CHASE_FRAMES,
  COP_FREEZE_FRAMES,
  DUCK_HEIGHT,
  ELEVATOR_H,
  ELEVATOR_SPEED,
  ELEVATOR_W,
  FATAL_FALL_PX,
  FLOOR_ANNOUNCE,
  FLOOR_P,
  FLOOR_R,
  FLOOR_SPACING,
  FOUNTAIN_COOLDOWN,
  GOLD_COIN_CHANCE,
  GRAVITY,
  JUMP_VELOCITY,
  KIOSK_COOLDOWN,
  KIOSK_SHOW_FRAMES,
  LAMP_DARK_FRAMES,
  MALL_SPRITE_H,
  MALL_SPRITE_W,
  MALL_W,
  MAX_FALL_SPEED,
  MAX_PLAYER_BULLETS,
  MAX_PLAYER_BULLETS_RAPID,
  MOP_INTERVAL,
  OJ_WALK_SPEED,
  PA_INTERVAL,
  RESPAWN_INVULN,
  SCORE_COIN,
  SCORE_COP_PENALTY,
  SCORE_POWERUP,
  SCORE_SPY,
  SCORE_SPY_CRUSHED,
  SCORE_WALKER_PENALTY,
  SHOOT_COOLDOWN,
  SHOOT_COOLDOWN_RAPID,
  SHOT_Y_HIGH,
  SHOT_Y_LOW,
  SNEAKER_JUMP_VELOCITY,
  SNEAKER_WALK_SPEED,
  SPY_AIM_FRAMES,
  SPY_BULLET_SPEED,
  SPY_DEATH_FRAMES,
  SPY_DODGE_CHANCE,
  SPY_DROP_CHANCE,
  SPY_EMERGE_GRACE,
  SPY_FIRST_SHOT_DELAY,
  SPY_FIRST_SPAWN,
  SPY_LAST_WORDS_CHANCE,
  SPY_MAX_ON_SCREEN,
  SPY_SHOT_INTERVAL,
  SPY_SHOT_INTERVAL_MIN,
  SPY_SIGHT_RANGE,
  SPY_SPAWN_MAX_DIST,
  SPY_SPAWN_MIN_DIST,
  SPY_SPEED,
  SPY_STOP_DISTANCE,
  SCREEN_W,
  VIEW_H,
  WALK_SPEED,
  WET_PATCH_FRAMES,
  WET_PATCH_W,
  ZIPLINE_FRAMES,
  sec,
  floorY,
} from './constants';
import {
  COP_BUBBLE,
  COP_CAUGHT,
  PA_LINES,
  SPYGRAM_ARRIVAL,
  SPY_ELEVATOR_LINES,
  SPY_LAST_WORDS,
  WALKER_BUBBLE,
} from './copy';
import { Button, type Pad } from './input';
import { canEnterStore, remainingPackageStores, spySpawnStores } from './level';
import {
  ANCHOR_POST_X,
  COP_FLOORS,
  ESCALATORS,
  GETAWAY_CAR_X,
  JANITOR_FLOOR,
  JANITOR_RANGE,
  LAMPS,
  LAMP_HIT_BOTTOM,
  LAMP_HIT_TOP,
  SHAFTS,
  SHAFT_BY_ID,
  WALKER_FLOOR,
  WALKER_RANGES,
  clampX,
  escalatorAt,
  lampTopY,
  propAt,
  shaftAt,
  shaftLeft,
  shaftRight,
  shaftServes,
  storeAt,
  type ShaftDef,
  type ShaftId,
} from './mallLayout';
import {
  FOOD_POWERUP_IDS,
  NON_FOOD_POWERUP_IDS,
  POWERUPS,
  absorbHit,
  applyPowerUp,
  type PowerUpId,
} from './powerups';
import type { Rng } from './rng';
import { STOREFRONT_W } from './storeDefs';
import type {
  Banner,
  Bullet,
  Car,
  GameState,
  LampState,
  MallPlayer,
  MallState,
  Spy,
} from './types';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export const floorAtY = (y: number): number => Math.round((y - 32) / FLOOR_SPACING);

/** Half-width used for all mall actor collision. */
const HALF_W = MALL_SPRITE_W / 2;

/** The shaft top ceiling: the car's roof when level with the topmost floor. */
export function shaftCeiling(s: ShaftDef): number {
  return floorY(Math.min(...s.floors)) - ELEVATOR_H;
}

export function carOf(m: MallState, id: ShaftId): Car {
  return m.cars.find((c) => c.shaft === id)!;
}

/** Is this floor solid inside this shaft's column? */
function shaftGroundAt(s: ShaftDef, floor: number): boolean {
  // The bottom floor of the mall is always solid; a shaft never opens below it.
  if (floor === FLOOR_P) return !shaftServes(s, FLOOR_P);
  return !shaftServes(s, floor);
}

/**
 * The surface a falling actor inside `s` would land on, starting below `y`.
 * Returns null if there is nothing to land on (should not happen).
 */
export function shaftLanding(m: MallState, s: ShaftDef, y: number): number | null {
  let best: number | null = null;
  const car = carOf(m, s.id);
  const roof = car.y - ELEVATOR_H;
  if (roof > y + 0.5) best = roof;
  for (let f = 0; f <= FLOOR_P; f++) {
    const fy = floorY(f);
    if (fy <= y + 0.5) continue;
    if (!shaftGroundAt(s, f)) continue;
    if (best === null || fy < best) best = fy;
  }
  // Absolute floor of the mall.
  const bottom = floorY(FLOOR_P);
  if (bottom > y + 0.5 && (best === null || bottom < best)) best = bottom;
  return best;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function newMallState(rng: Rng): MallState {
  const cars: Car[] = SHAFTS.map((s) => {
    // Manual cars start at their topmost floor; the auto car starts low so the
    // three of them are not all in a row.
    const startFloor = s.auto ? s.floors[s.floors.length - 1] : s.floors[0];
    return {
      shaft: s.id,
      y: floorY(startFloor),
      dir: 0,
      targetFloor: null,
      waitFrames: AUTO_CAR_WAIT,
      doorsOpen: true,
      dinged: true,
      atFloor: startFloor,
      calledToFloor: null,
    };
  });

  const player: MallPlayer = {
    x: 24,
    y: floorY(FLOOR_R),
    vy: 0,
    facing: 1,
    floor: FLOOR_R,
    ducking: false,
    onGround: false,
    mode: 'zip',
    modeFrames: 0,
    ridingShaft: null,
    onRoofShaft: null,
    escalator: null,
    invulnFrames: 0,
    shootCooldown: 0,
    fallStartY: floorY(FLOOR_R),
    jumpKick: false,
    slideDir: 0,
    stillFrames: 0,
    driveLatch: false,
    lastSafe: { x: ANCHOR_POST_X + 16, y: floorY(FLOOR_R), floor: FLOOR_R },
    anim: 0,
  };

  return {
    player,
    bullets: [],
    spies: [],
    cars,
    lamps: LAMPS.map((_, idx): LampState => ({
      idx,
      fallen: false,
      fallY: 0,
      broken: false,
      rolling: 0,
      rollX: 0,
      darkFrames: 0,
    })),
    pickups: [],
    coins: [],
    wetPatches: [],
    janitor: { x: JANITOR_RANGE[0], dir: 1, floor: JANITOR_FLOOR, mopTimer: MOP_INTERVAL, mopping: 0 },
    walkers: WALKER_RANGES.map((r) => ({
      x: r[0],
      dir: 1 as const,
      floor: WALKER_FLOOR,
      lo: r[0],
      hi: r[1],
      bubbleFrames: 0,
    })),
    cop: {
      x: 300,
      floor: COP_FLOORS[rng.int(COP_FLOORS.length)],
      dir: 1,
      chaseFrames: 0,
      cooldown: 0,
    },
    banners: [],
    bubbles: [],
    popups: [],
    camX: 0,
    camY: 0,
    nextSpyId: 1,
    spawnTimer: SPY_FIRST_SPAWN,
    fountainCooldown: {},
    kioskCooldown: 0,
    kioskPanel: 0,
    boothFrames: 0,
    photoStripTaken: false,
    paTimer: PA_INTERVAL,
    lastPaIndex: -1,
    exitTriggered: false,
    shakeFrames: 0,
  };
}

// ---------------------------------------------------------------------------
// Small state helpers
// ---------------------------------------------------------------------------

export function banner(m: MallState, lines: string[], frames: number, kind: Banner['kind'] = 'info'): void {
  m.banners = [{ lines, frames, kind }];
}

export function bubble(m: MallState, x: number, y: number, text: string, frames = sec(1.6)): void {
  m.bubbles.push({ x, y, text, frames });
}

export function popup(m: MallState, x: number, y: number, text: string): void {
  m.popups.push({ x, y, text, frames: sec(0.8) });
}

export function addScore(g: GameState, n: number, x?: number, y?: number): void {
  g.score = Math.max(0, g.score + n);
  if (x !== undefined && y !== undefined && n !== 0) {
    popup(g.mall, x, y, (n > 0 ? '+' : '') + n);
  }
}

export function walkSpeed(g: GameState): number {
  if (g.powerups.speed === 'sneakers') return SNEAKER_WALK_SPEED;
  if (g.powerups.speed === 'oj') return OJ_WALK_SPEED;
  return WALK_SPEED;
}

/** Spies must not react to a player who is hidden, dying, arriving or posing. */
export function playerVisible(p: MallPlayer): boolean {
  return p.mode === 'play' || p.mode === 'frozen';
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export function stepMall(g: GameState, pad: Pad): void {
  const m = g.mall;
  const lvl = g.level;

  lvl.frames++;
  if (!lvl.alarm && lvl.frames >= lvl.alarmAt) {
    lvl.alarm = true;
    banner(m, ['ALARM! SECURITY ALERTED'], sec(2.5), 'alarm');
    g.bus.music('alarm');
    g.bus.sfx('buzzer');
  }

  stepPlayer(g, pad);
  stepCars(g, pad);
  stepSpies(g);
  stepBullets(g);
  stepLamps(g);
  stepPickups(g);
  stepCoins(g);
  stepNpcs(g);
  stepSpawning(g);
  stepPa(g);
  decayEphemera(m);
  updateCamera(m);
}

function decayEphemera(m: MallState): void {
  for (const b of m.banners) b.frames--;
  m.banners = m.banners.filter((b) => b.frames > 0);
  for (const b of m.bubbles) b.frames--;
  m.bubbles = m.bubbles.filter((b) => b.frames > 0);
  for (const p of m.popups) {
    p.frames--;
    p.y -= 0.5;
  }
  m.popups = m.popups.filter((p) => p.frames > 0);
  for (const w of m.wetPatches) w.frames--;
  m.wetPatches = m.wetPatches.filter((w) => w.frames > 0);
  if (m.kioskCooldown > 0) m.kioskCooldown--;
  if (m.kioskPanel > 0) m.kioskPanel--;
  for (const k of Object.keys(m.fountainCooldown)) {
    const n = Number(k);
    if (m.fountainCooldown[n] > 0) m.fountainCooldown[n]--;
  }
  if (m.shakeFrames > 0) m.shakeFrames--;
}

function updateCamera(m: MallState): void {
  const p = m.player;
  const targetX = p.x - SCREEN_W / 2;
  const targetY = p.y - VIEW_H / 2 - 8;
  m.camX = Math.max(0, Math.min(MALL_W - SCREEN_W, Math.round(targetX)));
  const maxY = floorY(FLOOR_P) + 32 - VIEW_H;
  m.camY = Math.max(0, Math.min(Math.max(0, maxY), Math.round(targetY)));
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function stepPlayer(g: GameState, pad: Pad): void {
  const m = g.mall;
  const p = m.player;
  p.anim++;
  if (p.invulnFrames > 0) p.invulnFrames--;
  if (p.shootCooldown > 0) p.shootCooldown--;

  switch (p.mode) {
    case 'zip':
      stepZip(g, pad);
      return;
    case 'land':
      p.modeFrames++;
      if (p.modeFrames >= sec(0.5)) {
        p.mode = 'selfie';
        p.modeFrames = 0;
        g.bus.sfx('camera');
        g.bus.flash(5);
        startArrivalSpygram(g);
      }
      return;
    case 'selfie':
      p.modeFrames++;
      // The SPYGRAM card itself is a screen overlay handled by game.ts.
      return;
    case 'dead':
      p.modeFrames++;
      p.y += 1;
      return;
    case 'hidden': {
      m.boothFrames--;
      if (m.boothFrames <= 0 || pad.pressed(Button.Down) || pad.pressed(Button.Up)) {
        p.mode = 'play';
        g.bus.sfx('door');
        if (!m.photoStripTaken) {
          m.photoStripTaken = true;
          g.hasPhotoStrip = true;
          banner(m, ['PHOTO STRIP ACQUIRED'], sec(2));
          g.bus.sfx('camera');
          g.bus.flash(5);
        }
      }
      return;
    }
    case 'frozen':
      p.modeFrames--;
      if (p.modeFrames <= 0) p.mode = 'play';
      return;
    case 'play':
      break;
  }

  if (p.escalator) {
    stepEscalatorRide(g);
    return;
  }
  if (p.ridingShaft) {
    stepRideInside(g, pad);
    return;
  }

  stepWalking(g, pad);
}

function stepZip(g: GameState, pad: Pad): void {
  const p = g.mall.player;
  p.modeFrames++;
  if (p.modeFrames === 1) g.bus.sfx('zip');
  const t = Math.min(1, p.modeFrames / ZIPLINE_FRAMES);
  // From the skyscraper at the left edge of the sky down to the anchor post.
  p.x = 8 + t * (ANCHOR_POST_X + 12 - 8);
  p.y = floorY(FLOOR_R) - 56 + t * 56;
  if (t >= 1 || pad.anyPressed()) {
    p.x = ANCHOR_POST_X + 12;
    p.y = floorY(FLOOR_R);
    p.mode = 'land';
    p.modeFrames = 0;
    p.onGround = true;
    p.floor = FLOOR_R;
    p.lastSafe = { x: p.x, y: p.y, floor: FLOOR_R };
    g.bus.sfx('thud');
    g.bus.shake(8, 1);
  }
}

function startArrivalSpygram(g: GameState): void {
  // Chosen here, not at render time, so a seed replays the same post.
  const post = g.rng.pick(SPYGRAM_ARRIVAL);
  g.spygram = { caption: post.caption, comment: post.comment, likes: 0, frames: 0, kind: 'arrival' };
}

function stepWalking(g: GameState, pad: Pad): void {
  const m = g.mall;
  const p = m.player;
  const speed = walkSpeed(g);

  // --- wet floor ---------------------------------------------------------
  const wet = m.wetPatches.find(
    (w) => w.floor === p.floor && p.x >= w.x && p.x <= w.x + w.w && p.onGround,
  );
  if (wet && p.slideDir === 0) {
    p.slideDir = p.facing;
    g.bus.sfx('zip');
  } else if (!wet && p.onGround) {
    p.slideDir = 0;
  }

  // --- horizontal --------------------------------------------------------
  let dx = 0;
  if (p.slideDir !== 0) {
    // No stopping, no turning, until off the patch.
    dx = p.slideDir * speed;
    p.facing = p.slideDir;
  } else {
    if (pad.down(Button.Left)) {
      dx = -speed;
      p.facing = -1;
    }
    if (pad.down(Button.Right)) {
      dx = speed;
      p.facing = 1;
    }
  }

  p.ducking = p.onGround && pad.down(Button.Down) && dx === 0 && p.slideDir === 0;
  if (p.ducking) dx = 0;

  // --- jump --------------------------------------------------------------
  if (pad.pressed(Button.B) && p.onGround && !p.ducking) {
    p.vy = g.powerups.speed === 'sneakers' ? SNEAKER_JUMP_VELOCITY : JUMP_VELOCITY;
    p.onGround = false;
    p.fallStartY = p.y;
    // A jump WITH forward momentum is a jump-kick.
    p.jumpKick = dx !== 0 || p.slideDir !== 0;
    p.onRoofShaft = null;
    g.bus.sfx('jump');
  }

  if (dx !== 0) p.x = clampX(p.x + dx, HALF_W);

  // --- shooting ----------------------------------------------------------
  if (pad.pressed(Button.A)) tryShoot(g);

  // --- vertical / gravity -------------------------------------------------
  applyGravity(g);

  // --- Up/Down contextual actions ----------------------------------------
  const wantsUp = pad.pressed(Button.Up);
  const wantsDown = pad.pressed(Button.Down);
  if (p.onGround && (wantsUp || wantsDown)) {
    if (tryContextAction(g, wantsUp)) return;
  }

  // --- auto-call an elevator by standing still in an opening --------------
  const shaft = shaftAt(p.floor, p.x);
  if (shaft && p.onGround && dx === 0 && !p.ridingShaft && p.onRoofShaft !== shaft.id) {
    p.stillFrames++;
    const car = carOf(m, shaft.id);
    if (p.stillFrames >= AUTO_CALL_DELAY && car.atFloor !== p.floor && car.calledToFloor === null) {
      callCar(g, shaft, p.floor);
    }
  } else {
    p.stillFrames = 0;
  }

  // --- landing / safe-spot bookkeeping ------------------------------------
  if (p.onGround && p.slideDir === 0 && !shaftAt(p.floor, p.x)) {
    p.lastSafe = { x: p.x, y: p.y, floor: p.floor };
  }

  // --- collisions ---------------------------------------------------------
  checkPlayerSpyCollisions(g);
  checkPlayerPickups(g);
  checkPlayerCoins(g);
  checkPlayerWalkers(g);
}

function applyGravity(g: GameState): void {
  const m = g.mall;
  const p = m.player;

  // Riding a car roof: track it.
  if (p.onRoofShaft) {
    const car = carOf(m, p.onRoofShaft);
    const roof = car.y - ELEVATOR_H;
    const shaft = SHAFT_BY_ID.get(p.onRoofShaft)!;
    if (Math.abs(p.x - shaft.x) > ELEVATOR_W / 2 + HALF_W) {
      p.onRoofShaft = null;
    } else {
      p.y = roof;
      p.onGround = true;
      p.vy = 0;
      p.fallStartY = p.y;
      // Rising into the top of the shaft crushes you.
      if (p.y - MALL_SPRITE_H < shaftCeiling(shaft) && car.dir === -1) {
        killPlayer(g, 'crushed');
      }
      return;
    }
  }

  const overShaft = shaftAt(p.floor, p.x);
  const inOpening =
    overShaft !== null && p.x >= shaftLeft(overShaft) - 2 && p.x <= shaftRight(overShaft) + 2;

  if (!p.onGround) {
    p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY);
    p.y += p.vy;

    // Find the surface below.
    let ground: number | null = null;
    if (inOpening && p.vy > 0) {
      ground = shaftLanding(m, overShaft!, p.fallStartY);
      // The car at this floor is a platform you land on.
      const car = carOf(m, overShaft!.id);
      if (car.atFloor >= 0 && floorY(car.atFloor) >= p.fallStartY && (ground === null || floorY(car.atFloor) < ground)) {
        ground = floorY(car.atFloor);
      }
    } else {
      // Normal floors: land on the next floor line at or below us.
      for (let f = 0; f <= FLOOR_P; f++) {
        const fy = floorY(f);
        if (fy < p.fallStartY - 1) continue;
        const sh = shaftAt(f, p.x);
        const isPit =
          sh !== null &&
          p.x >= shaftLeft(sh) &&
          p.x <= shaftRight(sh) &&
          carOf(m, sh.id).atFloor !== f &&
          f !== FLOOR_P;
        if (isPit) continue;
        if (fy >= p.y - 0.001 || (ground === null && fy >= p.fallStartY)) {
          if (ground === null || fy < ground) ground = fy;
          break;
        }
      }
    }

    if (ground !== null && p.y >= ground) {
      const fell = ground - p.fallStartY;
      p.y = ground;
      p.vy = 0;
      p.onGround = true;
      p.jumpKick = false;
      p.floor = floorAtY(ground);
      // Landing on a car roof inside a shaft.
      if (inOpening) {
        const car = carOf(m, overShaft!.id);
        if (Math.abs(car.y - ELEVATOR_H - ground) < 1.5) {
          p.onRoofShaft = overShaft!.id;
        }
      }
      if (fell > FATAL_FALL_PX) {
        killPlayer(g, 'fall');
        return;
      }
      if (fell > 4) g.bus.sfx('thud');
    }
    return;
  }

  // On ground: walk off a pit?
  if (inOpening) {
    const car = carOf(m, overShaft!.id);
    const atThisFloor = car.atFloor === p.floor;
    const carBelow = car.y > floorY(p.floor) + 1;
    if (!atThisFloor && carBelow && p.onRoofShaft === null) {
      // Open pit: fall in.
      p.onGround = false;
      p.vy = 0.5;
      p.fallStartY = p.y;
    }
  }
}

/** Up/Down at a door, elevator, escalator, kiosk, booth or the getaway car. */
function tryContextAction(g: GameState, up: boolean): boolean {
  const m = g.mall;
  const p = m.player;

  // Elevator: board a car standing at this floor.
  const shaft = shaftAt(p.floor, p.x);
  if (shaft) {
    const car = carOf(m, shaft.id);
    if (car.atFloor === p.floor && car.dir === 0) {
      p.ridingShaft = shaft.id;
      p.onRoofShaft = null;
      p.x = shaft.x;
      p.y = car.y;
      p.stillFrames = 0;
      p.driveLatch = true;
      car.doorsOpen = false;
      g.bus.sfx('door');
      g.bus.music('elevator');
      return true;
    }
    // Empty opening: call the car.
    callCar(g, shaft, p.floor);
    return true;
  }

  // Store door.
  const store = storeAt(p.floor, p.x);
  if (store) {
    if (!canEnterStore(g.level, store)) {
      if (store.role === 'closed') {
        banner(m, ['CLOSED'], sec(1));
        g.bus.sfx('buzzer');
      }
      return true;
    }
    enterStore(g, store.id);
    return true;
  }

  // Escalator.
  const esc = escalatorAt(p.floor, p.x);
  if (esc && ((up && esc.goingUp) || (!up && !esc.goingUp))) {
    p.escalator = { id: esc.def.id, goingUp: esc.goingUp, t: 0 };
    p.onGround = false;
    return true;
  }

  // Directory kiosk.
  if (up && propAt(p.floor, p.x, 'kiosk')) {
    if (m.kioskCooldown <= 0) {
      m.kioskCooldown = KIOSK_COOLDOWN;
      m.kioskPanel = KIOSK_SHOW_FRAMES;
      g.bus.sfx('blip');
      const rem = remainingPackageStores(g.level);
      banner(m, rem.length ? ['NEAREST PACKAGE:', nearestStoreName(g)] : ['ALL PACKAGES FOUND'], sec(2.5));
    } else {
      g.bus.sfx('buzzer');
    }
    return true;
  }

  // Photo booth.
  if (up && propAt(p.floor, p.x, 'booth')) {
    p.mode = 'hidden';
    m.boothFrames = sec(5);
    g.bus.sfx('door');
    return true;
  }

  // Getaway car.
  if (up && propAt(p.floor, p.x, 'car', 20)) {
    tryExit(g);
    return true;
  }

  return false;
}

function nearestStoreName(g: GameState): string {
  const p = g.mall.player;
  const rem = remainingPackageStores(g.level);
  let best = rem[0];
  let bestD = Infinity;
  for (const s of rem) {
    const d = Math.abs(s.x + STOREFRONT_W / 2 - p.x) + Math.abs(s.floor - p.floor) * 200;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best.name;
}

export function enterStore(g: GameState, storeId: string): void {
  g.returnDoorX = g.mall.player.x;
  g.returnFloor = g.mall.player.floor;
  g.bus.sfx('door');
  startFade(g, () => {
    beginStore(g, storeId);
  });
}

/** Wired up by game.ts to avoid a circular import. */
export let beginStore: (g: GameState, storeId: string) => void = () => {};
export function setBeginStore(fn: (g: GameState, storeId: string) => void): void {
  beginStore = fn;
}
export let startFade: (g: GameState, then: () => void) => void = () => {};
export function setStartFade(fn: (g: GameState, then: () => void) => void): void {
  startFade = fn;
}

export function tryExit(g: GameState): void {
  const m = g.mall;
  if (g.level.packages >= 6) {
    if (m.exitTriggered) return; // Level clear must fire EXACTLY once.
    m.exitTriggered = true;
    g.bus.sfx('packageFanfare');
    startFade(g, () => {
      beginLevelClear(g);
    });
  } else {
    banner(m, [`PACKAGES LEFT: ${6 - g.level.packages}`], sec(2));
    g.bus.sfx('buzzer');
  }
}

export let beginLevelClear: (g: GameState) => void = () => {};
export function setBeginLevelClear(fn: (g: GameState) => void): void {
  beginLevelClear = fn;
}

function stepEscalatorRide(g: GameState): void {
  const p = g.mall.player;
  const e = ESCALATORS.find((x) => x.id === p.escalator!.id)!;
  const ride = p.escalator!;
  ride.t += 1 / sec(1.4);
  const t = Math.min(1, ride.t);
  const fromX = ride.goingUp ? e.bottomX : e.topX;
  const toX = ride.goingUp ? e.topX : e.bottomX;
  const fromY = floorY(ride.goingUp ? e.bottomFloor : e.topFloor);
  const toY = floorY(ride.goingUp ? e.topFloor : e.bottomFloor);
  p.x = fromX + (toX - fromX) * t;
  p.y = fromY + (toY - fromY) * t;
  p.facing = toX > fromX ? 1 : -1;
  if (t >= 1) {
    p.escalator = null;
    p.onGround = true;
    p.vy = 0;
    p.floor = floorAtY(p.y);
    p.fallStartY = p.y;
    p.lastSafe = { x: p.x, y: p.y, floor: p.floor };
  }
}

/** Driving a car from inside it. */
function stepRideInside(g: GameState, pad: Pad): void {
  const m = g.mall;
  const p = m.player;
  const car = carOf(m, p.ridingShaft!);
  const shaft = SHAFT_BY_ID.get(p.ridingShaft!)!;
  p.x = shaft.x;
  p.y = car.y;
  p.floor = floorAtY(car.y);
  p.onGround = true;

  if (pad.pressed(Button.A)) tryShoot(g);

  // Step out sideways while stopped at a floor.
  if (car.dir === 0 && car.atFloor >= 0) {
    const out = pad.pressed(Button.Left) ? -1 : pad.pressed(Button.Right) ? 1 : 0;
    if (out !== 0) {
      p.ridingShaft = null;
      p.facing = out as 1 | -1;
      p.x = clampX(shaft.x + out * (ELEVATOR_W / 2 + HALF_W + 2), HALF_W);
      p.y = floorY(car.atFloor);
      p.floor = car.atFloor;
      p.fallStartY = p.y;
      p.lastSafe = { x: p.x, y: p.y, floor: p.floor };
      car.doorsOpen = true;
      g.bus.sfx('door');
      g.bus.music(g.level.alarm ? 'alarm' : 'mallAmbient');
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------

function tryShoot(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  const rapid = g.powerups.weapon === 'rapid';
  const max = rapid ? MAX_PLAYER_BULLETS_RAPID : MAX_PLAYER_BULLETS;
  const cooldown = rapid ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN;
  const mine = m.bullets.filter((b) => b.fromPlayer).length;
  if (p.shootCooldown > 0 || mine >= max) return;
  p.shootCooldown = cooldown;

  const y = p.y + (p.ducking ? SHOT_Y_LOW : SHOT_Y_HIGH);
  const x = p.x + p.facing * 8;
  const push = (vy: number) =>
    m.bullets.push({ x, y, vx: p.facing * BULLET_SPEED, vy, fromPlayer: true, high: !p.ducking });
  push(0);
  if (g.powerups.weapon === 'spread') {
    push(-1);
    push(1);
  }
  g.bus.sfx('shot');
  alertCop(g);
}

function alertCop(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  const cop = m.cop;
  if (cop.chaseFrames > 0 || cop.cooldown > 0) return;
  if (cop.floor !== p.floor) return;
  const dx = p.x - cop.x;
  if (Math.abs(dx) > COP_ALERT_RANGE) return;
  // He must be facing the player.
  if (Math.sign(dx) !== cop.dir) return;
  cop.chaseFrames = COP_CHASE_FRAMES;
  bubble(m, cop.x, floorY(cop.floor) - MALL_SPRITE_H, COP_BUBBLE, sec(2));
  g.bus.sfx('whistle');
}

// ---------------------------------------------------------------------------
// Bullets
// ---------------------------------------------------------------------------

function stepBullets(g: GameState): void {
  const m = g.mall;
  const keep: Bullet[] = [];

  outer: for (const b of m.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -8 || b.x > MALL_W + 8) continue;

    const bFloor = floorAtY(b.y + MALL_SPRITE_H);

    // Mall walkers block bullets from both sides and never die.
    for (const w of m.walkers) {
      if (w.floor !== bFloor) continue;
      if (Math.abs(b.x - w.x) < 8) {
        if (b.fromPlayer) {
          addScore(g, SCORE_WALKER_PENALTY, w.x, floorY(w.floor) - 28);
          w.bubbleFrames = sec(1.5);
          bubble(m, w.x, floorY(w.floor) - MALL_SPRITE_H, WALKER_BUBBLE, sec(1.5));
          g.bus.sfx('ping');
        }
        continue outer;
      }
    }

    // The mall cop cannot be killed; bullets ping off his helmet.
    if (m.cop.floor === bFloor && Math.abs(b.x - m.cop.x) < 8 && b.fromPlayer) {
      g.bus.sfx('ping');
      alertCop(g);
      continue;
    }

    if (b.fromPlayer) {
      if (hitLamp(g, b)) continue;
      if (hitFountain(g, b)) continue;
      let hit = false;
      for (const s of m.spies) {
        if (s.state === 'dead') continue;
        if (s.floor !== bFloor) continue;
        const head = s.y - (s.ducking ? DUCK_HEIGHT : MALL_SPRITE_H);
        if (Math.abs(b.x - s.x) < 8 && b.y >= head && b.y <= s.y) {
          killSpy(g, s, SCORE_SPY);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    } else {
      const p = m.player;
      if (playerVisible(p) && p.floor === bFloor && p.invulnFrames === 0) {
        const head = p.y - (p.ducking ? DUCK_HEIGHT : MALL_SPRITE_H);
        if (Math.abs(b.x - p.x) < 7 && b.y >= head && b.y <= p.y) {
          if (absorbHit(g.powerups)) {
            g.bus.sfx('ping');
            p.invulnFrames = sec(1);
            banner(m, ['ARMOR BROKEN'], sec(1));
          } else if (g.powerups.invulnFrames === 0) {
            killPlayer(g, 'shot');
          }
          continue;
        }
      }
    }

    keep.push(b);
  }

  m.bullets = keep;
}

function hitLamp(g: GameState, b: Bullet): boolean {
  const m = g.mall;
  for (let i = 0; i < m.lamps.length; i++) {
    const st = m.lamps[i];
    if (st.fallen) continue;
    const def = LAMPS[i];
    const bFloor = floorAtY(b.y + MALL_SPRITE_H);
    if (bFloor !== def.floor) continue;
    // The cord and shade: hittable by a standing shot, missed by a ducking one.
    const top = floorY(def.floor) - LAMP_HIT_TOP;
    const bottom = floorY(def.floor) - LAMP_HIT_BOTTOM;
    if (Math.abs(b.x - def.x) < 8 && b.y >= top && b.y <= bottom) {
      st.fallen = true;
      st.fallY = lampTopY(def.floor);
      st.rollX = def.x;
      g.bus.sfx('lampFall');
      return true;
    }
  }
  return false;
}

function hitFountain(g: GameState, b: Bullet): boolean {
  const m = g.mall;
  const bFloor = floorAtY(b.y + MALL_SPRITE_H);
  const f = propAt(bFloor, b.x, 'fountain', 14);
  if (!f) return false;
  if ((m.fountainCooldown[f.x] ?? 0) > 0) return true;
  m.fountainCooldown[f.x] = FOUNTAIN_COOLDOWN;
  const n = g.rng.range(3, 5);
  const gold = g.rng.chance(GOLD_COIN_CHANCE);
  for (let i = 0; i < n; i++) {
    m.coins.push({
      x: f.x,
      y: floorY(f.floor) - 16,
      vx: g.rng.float(-1.4, 1.4),
      vy: g.rng.float(-3.2, -1.8),
      floor: f.floor,
      gold: gold && i === 0,
      frames: sec(8),
    });
  }
  g.bus.sfx('coin');
  return true;
}

// ---------------------------------------------------------------------------
// Deaths
// ---------------------------------------------------------------------------

export function killSpy(g: GameState, s: Spy, points: number): void {
  const m = g.mall;
  if (s.state === 'dead') return;
  s.state = 'dead';
  s.stateFrames = SPY_DEATH_FRAMES;
  addScore(g, points, s.x, s.y - MALL_SPRITE_H);
  g.bus.sfx('death');
  if (g.rng.chance(SPY_LAST_WORDS_CHANCE)) {
    bubble(m, s.x, s.y - MALL_SPRITE_H, g.rng.pick(SPY_LAST_WORDS), sec(1.6));
  }
  if (g.rng.chance(SPY_DROP_CHANCE)) {
    const food = g.rng.chance(0.5);
    const id: PowerUpId = food ? g.rng.pick(FOOD_POWERUP_IDS) : g.rng.pick(NON_FOOD_POWERUP_IDS);
    m.pickups.push({ x: s.x, y: s.y, vy: 0, floor: s.floor, id, frames: sec(12) });
  }
}

export function killPlayer(g: GameState, cause: 'shot' | 'fall' | 'crushed' | 'touch' | 'lamp'): void {
  const m = g.mall;
  const p = m.player;
  if (p.mode === 'dead' || p.invulnFrames > 0) return;
  if (g.powerups.invulnFrames > 0 && cause !== 'crushed' && cause !== 'fall') return;
  p.mode = 'dead';
  p.modeFrames = 0;
  p.ridingShaft = null;
  p.onRoofShaft = null;
  p.escalator = null;
  p.slideDir = 0;
  g.bus.sfx(cause === 'crushed' ? 'crush' : 'hurt');
  if (cause === 'crushed') g.bus.shake(16, 3);
  g.bus.music('none');
}

/** Called by game.ts once the death animation is over. */
export function respawnPlayer(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  // All spies and bullets are cleared, and any temporary freeze is removed.
  m.spies.length = 0;
  m.bullets.length = 0;
  m.bubbles.length = 0;
  p.mode = 'play';
  p.modeFrames = 0;
  p.x = p.lastSafe.x;
  p.y = p.lastSafe.y;
  p.floor = p.lastSafe.floor;
  p.vy = 0;
  p.onGround = true;
  p.ducking = false;
  p.jumpKick = false;
  p.slideDir = 0;
  p.stillFrames = 0;
  p.driveLatch = false;
  p.fallStartY = p.y;
  p.invulnFrames = RESPAWN_INVULN;
  m.spawnTimer = SPY_FIRST_SPAWN;
  g.bus.music(g.level.alarm ? 'alarm' : 'mallAmbient');
}

// ---------------------------------------------------------------------------
// Elevators
// ---------------------------------------------------------------------------

function callCar(g: GameState, shaft: ShaftDef, floor: number): void {
  const m = g.mall;
  const car = carOf(m, shaft.id);
  if (car.atFloor === floor) return;
  // Do not steal a car the player is riding.
  if (m.player.ridingShaft === shaft.id) return;
  car.calledToFloor = floor;
  car.targetFloor = floor;
  car.dir = floorY(floor) > car.y ? 1 : -1;
  car.doorsOpen = false;
  car.dinged = false;
  car.atFloor = -1;
  g.bus.sfx('blip');
}

function stepCars(g: GameState, pad: Pad): void {
  const m = g.mall;
  const p = m.player;

  for (const car of m.cars) {
    const shaft = SHAFT_BY_ID.get(car.shaft)!;
    const minY = floorY(Math.min(...shaft.floors));
    const maxY = floorY(Math.max(...shaft.floors));
    const riddenByPlayer = p.ridingShaft === car.shaft;

    if (riddenByPlayer && p.mode === 'play') {
      driveManual(g, car, shaft, pad, minY, maxY);
    } else if (shaft.auto) {
      driveAuto(g, car, shaft);
    } else if (car.targetFloor !== null) {
      glideToTarget(car);
    } else {
      car.dir = 0;
    }

    // Move.
    if (car.dir !== 0) {
      const prevY = car.y;
      car.y = Math.max(minY, Math.min(maxY, car.y + car.dir * ELEVATOR_SPEED));
      car.doorsOpen = false;
      car.atFloor = -1;
      if (car.y === prevY) car.dir = 0; // hit the end of the shaft
      crushCheck(g, car, shaft);
    }

    // Arrive?
    if (car.targetFloor !== null && Math.abs(car.y - floorY(car.targetFloor)) < 0.5) {
      car.y = floorY(car.targetFloor);
      car.targetFloor = null;
      car.dir = 0;
    }

    const level = shaft.floors.find((f) => Math.abs(floorY(f) - car.y) < 0.5);
    if (car.dir === 0 && level !== undefined) {
      car.atFloor = level;
      car.doorsOpen = true;
      if (!car.dinged) {
        // EXACTLY one ding per stop. Cleared only when the car moves again.
        car.dinged = true;
        car.calledToFloor = null;
        if (Math.abs(p.x - shaft.x) < SCREEN_W / 2 && Math.abs(p.floor - level) <= 1) {
          g.bus.sfx('ding');
        }
        if (riddenByPlayer) {
          banner(m, [FLOOR_ANNOUNCE[level]], sec(2), 'floor');
        }
        maybeSpyFromCar(g, car, shaft, level);
        car.waitFrames = AUTO_CAR_WAIT;
      }
    } else if (car.dir !== 0) {
      car.dinged = false;
    }
  }
}

function driveManual(
  g: GameState,
  car: Car,
  shaft: ShaftDef,
  pad: Pad,
  minY: number,
  maxY: number,
): void {
  const p = g.mall.player;
  const up = pad.down(Button.Up);
  const down = pad.down(Button.Down);
  if (p.driveLatch) {
    // The press that boarded the car must not also drive it away.
    if (!up && !down) p.driveLatch = false;
    return;
  }
  const want: -1 | 0 | 1 = up && !down ? -1 : down && !up ? 1 : 0;

  if (want !== 0) {
    const blocked = (want === -1 && car.y <= minY) || (want === 1 && car.y >= maxY);
    if (blocked) {
      // Holding a direction at the end of the shaft must not repeat the ding.
      car.dir = 0;
      car.targetFloor = null;
    } else {
      car.dir = want;
      car.targetFloor = null;
    }
    return;
  }

  // Released between floors: glide on to the next floor in the same direction.
  if (car.dir !== 0 && car.targetFloor === null) {
    const next = nextFloorInDir(shaft, car.y, car.dir);
    car.targetFloor = next;
    if (next === null) car.dir = 0;
  }
  if (car.targetFloor !== null) glideToTarget(car);
}

function nextFloorInDir(shaft: ShaftDef, y: number, dir: -1 | 1): number | null {
  let best: number | null = null;
  for (const f of shaft.floors) {
    const fy = floorY(f);
    if (dir === 1 && fy > y + 0.5 && (best === null || fy < floorY(best))) best = f;
    if (dir === -1 && fy < y - 0.5 && (best === null || fy > floorY(best))) best = f;
  }
  // Already level with a floor, or past the last one.
  if (best === null) {
    for (const f of shaft.floors) if (Math.abs(floorY(f) - y) < 0.5) return f;
  }
  return best;
}

function glideToTarget(car: Car): void {
  if (car.targetFloor === null) {
    car.dir = 0;
    return;
  }
  const ty = floorY(car.targetFloor);
  if (Math.abs(ty - car.y) < 0.5) {
    car.y = ty;
    car.dir = 0;
    car.targetFloor = null;
  } else {
    car.dir = ty > car.y ? 1 : -1;
  }
}

/**
 * The automatic car. It waits ~2 s then picks a random OTHER served floor.
 *
 * Gotcha resolved here: it never departs of its own accord while the player is
 * inside it, otherwise boarding it would be a trap. When the player is inside,
 * driveManual() runs instead and the player steers it.
 */
function driveAuto(g: GameState, car: Car, shaft: ShaftDef): void {
  if (car.targetFloor !== null) {
    glideToTarget(car);
    return;
  }
  if (car.dir !== 0) return;
  if (car.calledToFloor !== null) return;

  // Anyone standing inside? Then hold the doors.
  const p = g.mall.player;
  if (p.ridingShaft === shaft.id) return;

  if (car.waitFrames > 0) {
    car.waitFrames--;
    return;
  }
  const others = shaft.floors.filter((f) => f !== car.atFloor);
  if (others.length === 0) return;
  car.targetFloor = g.rng.pick(others);
  car.waitFrames = AUTO_CAR_WAIT;
}

/** A descending car crushes whatever stands in the opening below it. */
function crushCheck(g: GameState, car: Car, shaft: ShaftDef): void {
  if (car.dir !== 1) return;
  const m = g.mall;

  for (const f of shaft.floors) {
    const fy = floorY(f);
    // The car's floor is between the victim's head and their feet.
    if (!(car.y > fy - MALL_SPRITE_H && car.y < fy)) continue;
    // A car coming BECAUSE it was called must pick you up, not crush you.
    const exempt = car.calledToFloor === f;

    const p = m.player;
    if (
      !exempt &&
      p.mode === 'play' &&
      p.ridingShaft === null &&
      p.onGround &&
      p.floor === f &&
      Math.abs(p.x - shaft.x) < ELEVATOR_W / 2 + 2
    ) {
      killPlayer(g, 'crushed');
    }

    for (const s of m.spies) {
      if (s.state === 'dead' || s.floor !== f) continue;
      if (Math.abs(s.x - shaft.x) < ELEVATOR_W / 2 + 2) {
        killSpy(g, s, SCORE_SPY_CRUSHED);
        g.bus.sfx('crush');
        g.bus.shake(10, 2);
      }
    }
  }
}

/** Cars stopping near the player sometimes let a spy out. */
function maybeSpyFromCar(g: GameState, car: Car, shaft: ShaftDef, floor: number): void {
  const m = g.mall;
  const p = m.player;
  if (!playerVisible(p)) return;
  if (m.spies.length >= spyCap(g)) return;
  if (Math.abs(p.x - shaft.x) > SCREEN_W) return;
  // Never drop one straight onto the player waiting at this opening.
  if (p.floor === floor && Math.abs(p.x - shaft.x) < 24) return;
  if (!g.rng.chance(0.35)) return;
  const s = spawnSpyAt(g, shaft.x, floor);
  bubble(m, s.x, s.y - MALL_SPRITE_H, g.rng.pick(SPY_ELEVATOR_LINES), sec(1.8));
  void car;
}

// ---------------------------------------------------------------------------
// Spies
// ---------------------------------------------------------------------------

export function spyCap(g: GameState): number {
  return g.blackFriday ? SPY_MAX_ON_SCREEN * 2 : SPY_MAX_ON_SCREEN;
}

export function spySpeed(g: GameState): number {
  let s = SPY_SPEED * g.level.spySpeedMult;
  if (g.level.alarm) s *= ALARM_SPY_SPEED_MULT;
  return s;
}

export function spyFireInterval(g: GameState): number {
  let base = SPY_SHOT_INTERVAL / g.level.fireMult;
  if (g.level.alarm) base /= 1.15;
  return Math.max(SPY_SHOT_INTERVAL_MIN, Math.round(base));
}

function spawnSpyAt(g: GameState, x: number, floor: number): Spy {
  const m = g.mall;
  const s: Spy = {
    id: m.nextSpyId++,
    x,
    y: floorY(floor),
    vy: 0,
    facing: m.player.x < x ? -1 : 1,
    floor,
    state: 'walk',
    stateFrames: 0,
    age: 0,
    aimHigh: true,
    shotTimer: SPY_FIRST_SHOT_DELAY,
    ducking: false,
    dodgeThisVolley: false,
    onRoofShaft: null,
    waitShaft: null,
    wanderDir: g.rng.chance(0.5) ? -1 : 1,
    wanderTimer: sec(1.5),
    speed: spySpeed(g),
  };
  m.spies.push(s);
  g.bus.sfx('door');
  return s;
}

function stepSpawning(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  if (!playerVisible(p)) return;
  if (m.spawnTimer > 0) {
    m.spawnTimer--;
    return;
  }
  if (m.spies.length >= spyCap(g)) return;

  // Spies come out of the doors of OPEN stores on the player's floor or one
  // floor away, 64..200 px from the player.
  const candidates = spySpawnStores(g.level).filter((s) => {
    if (Math.abs(s.floor - p.floor) > 1) return false;
    const d = Math.abs(s.x + STOREFRONT_W / 2 - p.x);
    return d >= SPY_SPAWN_MIN_DIST && d <= SPY_SPAWN_MAX_DIST;
  });

  const interval = Math.round(sec(3) / (g.level.spawnMult * (g.blackFriday ? 2 : 1) * (g.level.alarm ? 1.4 : 1)));
  m.spawnTimer = Math.max(sec(0.6), interval);

  if (candidates.length === 0) return;
  const store = g.rng.pick(candidates);
  spawnSpyAt(g, store.x + STOREFRONT_W / 2, store.floor);
}

function stepSpies(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  const keep: Spy[] = [];

  for (const s of m.spies) {
    s.age++;
    if (s.state === 'dead') {
      s.stateFrames--;
      if (s.stateFrames > 0) keep.push(s);
      continue;
    }

    // Ride a car roof if one is under us.
    if (s.onRoofShaft) {
      const car = carOf(m, s.onRoofShaft);
      s.y = car.y - ELEVATOR_H;
    }

    const sees =
      playerVisible(p) &&
      p.floor === s.floor &&
      Math.abs(p.x - s.x) <= SPY_SIGHT_RANGE &&
      p.mode !== 'hidden';

    if (s.state === 'aim') {
      s.stateFrames--;
      if (s.stateFrames <= 0) {
        fireSpyShot(g, s);
        s.state = 'walk';
        s.shotTimer = spyFireInterval(g);
        s.dodgeThisVolley = g.rng.chance(SPY_DODGE_CHANCE);
      }
      keep.push(s);
      continue;
    }

    if (sees) {
      s.facing = p.x < s.x ? -1 : 1;
      const dist = Math.abs(p.x - s.x);
      if (dist > SPY_STOP_DISTANCE) {
        moveSpy(g, s, s.facing * s.speed);
      }
      if (s.shotTimer > 0) s.shotTimer--;
      if (s.shotTimer <= 0 && s.age >= SPY_FIRST_SHOT_DELAY) {
        // A clear aiming pose comes first.
        s.state = 'aim';
        s.stateFrames = SPY_AIM_FRAMES;
        s.aimHigh = g.rng.chance(0.5);
      }
    } else {
      wanderSpy(g, s);
      if (s.shotTimer > 0) s.shotTimer--;
    }

    // Ducking an incoming bullet: decided once per volley, 10%.
    s.ducking = false;
    if (s.dodgeThisVolley) {
      for (const b of m.bullets) {
        if (!b.fromPlayer || !b.high) continue;
        if (floorAtY(b.y + MALL_SPRITE_H) !== s.floor) continue;
        const towards = Math.sign(b.vx) === Math.sign(s.x - b.x);
        if (towards && Math.abs(b.x - s.x) < 48) {
          s.ducking = true;
          break;
        }
      }
    }

    keep.push(s);
  }

  m.spies = keep;
}

function moveSpy(g: GameState, s: Spy, dx: number): void {
  const m = g.mall;
  const nx = s.x + dx;
  // Spies never walk into pits.
  const sh = shaftAt(s.floor, nx);
  if (sh) {
    const car = carOf(m, sh.id);
    const isPit = car.atFloor !== s.floor && car.y > floorY(s.floor) + 1;
    if (isPit && nx > shaftLeft(sh) - 2 && nx < shaftRight(sh) + 2) return;
  }
  s.x = clampX(nx, HALF_W);
}

function wanderSpy(g: GameState, s: Spy): void {
  const m = g.mall;
  s.wanderTimer--;

  // Sometimes go and wait in a shaft opening; that is where elevators crush.
  if (s.waitShaft) {
    const shaft = SHAFT_BY_ID.get(s.waitShaft)!;
    const d = shaft.x - s.x;
    if (Math.abs(d) < 2) {
      s.state = 'wait';
      if (s.wanderTimer <= 0) {
        s.waitShaft = null;
        s.state = 'walk';
        s.wanderTimer = sec(2);
      }
      return;
    }
    s.facing = d < 0 ? -1 : 1;
    // Deliberately walking INTO the opening, pit check bypassed at the lip.
    s.x = clampX(s.x + s.facing * s.speed, HALF_W);
    return;
  }

  if (s.wanderTimer <= 0) {
    s.wanderTimer = sec(g.rng.float(1, 3));
    if (g.rng.chance(0.25)) {
      const opts = SHAFTS.filter((sh) => shaftServes(sh, s.floor) && carOf(m, sh.id).atFloor !== s.floor);
      if (opts.length) {
        s.waitShaft = g.rng.pick(opts).id;
        s.wanderTimer = sec(4);
        return;
      }
    }
    s.wanderDir = g.rng.chance(0.5) ? -1 : 1;
  }
  s.facing = s.wanderDir;
  moveSpy(g, s, s.wanderDir * s.speed * 0.7);
  if (s.x <= HALF_W || s.x >= MALL_W - HALF_W) s.wanderDir = (-s.wanderDir) as -1 | 1;
}

function fireSpyShot(g: GameState, s: Spy): void {
  const m = g.mall;
  m.bullets.push({
    x: s.x + s.facing * 8,
    y: s.y + (s.aimHigh ? SHOT_Y_HIGH : SHOT_Y_LOW),
    vx: s.facing * SPY_BULLET_SPEED,
    vy: 0,
    fromPlayer: false,
    high: s.aimHigh,
  });
  g.bus.sfx('enemyShot');
}

function checkPlayerSpyCollisions(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  if (!playerVisible(p) || p.invulnFrames > 0) return;

  for (const s of m.spies) {
    if (s.state === 'dead' || s.floor !== p.floor) continue;
    // A spy that just stepped out of a door cannot kill by contact yet.
    if (s.age < SPY_EMERGE_GRACE) continue;
    if (Math.abs(s.x - p.x) > 12) continue;
    if (Math.abs(s.y - p.y) > MALL_SPRITE_H) continue;

    if (p.jumpKick && !p.onGround) {
      killSpy(g, s, SCORE_SPY);
      continue;
    }
    if (g.powerups.invulnFrames > 0) {
      // Cinnabomb: touching spies kills them.
      killSpy(g, s, SCORE_SPY);
      continue;
    }
    if (absorbHit(g.powerups)) {
      p.invulnFrames = sec(1);
      g.bus.sfx('ping');
      continue;
    }
    killPlayer(g, 'touch');
    return;
  }
}

// ---------------------------------------------------------------------------
// Lamps and disco balls
// ---------------------------------------------------------------------------

function stepLamps(g: GameState): void {
  const m = g.mall;
  for (let i = 0; i < m.lamps.length; i++) {
    const st = m.lamps[i];
    const def = LAMPS[i];
    if (st.darkFrames > 0) st.darkFrames--;
    if (!st.fallen || st.broken) continue;

    const groundY = floorY(def.floor);

    if (st.rolling !== 0) {
      // Disco ball rolling along the floor, flattening everything.
      st.rollX += st.rolling * 2;
      crushUnder(g, st.rollX, def.floor, true);
      const sh = shaftAt(def.floor, st.rollX);
      const intoPit =
        sh !== null &&
        st.rollX > shaftLeft(sh) &&
        st.rollX < shaftRight(sh) &&
        carOf(m, sh.id).atFloor !== def.floor;
      if (st.rollX < 8 || st.rollX > MALL_W - 8 || intoPit) {
        st.broken = true;
        st.darkFrames = LAMP_DARK_FRAMES;
        g.bus.sfx('glass');
      }
      continue;
    }

    st.fallY += 3;
    if (st.fallY >= groundY) {
      st.fallY = groundY;
      crushUnder(g, def.x, def.floor, false);
      g.bus.sfx('glass');
      g.bus.shake(10, 2);
      if (def.disco) {
        // Roll in the direction of the shot: use the player's facing as a proxy
        // for which side the shot came from.
        st.rolling = m.player.x < def.x ? 1 : -1;
        st.rollX = def.x;
      } else {
        st.broken = true;
        st.darkFrames = LAMP_DARK_FRAMES;
      }
    } else {
      crushUnder(g, def.x, def.floor, false, st.fallY);
    }
  }
}

function crushUnder(g: GameState, x: number, floor: number, rolling: boolean, atY?: number): void {
  const m = g.mall;
  for (const s of m.spies) {
    if (s.state === 'dead' || s.floor !== floor) continue;
    if (Math.abs(s.x - x) < 10) killSpy(g, s, SCORE_SPY_CRUSHED);
  }
  const p = m.player;
  if (!playerVisible(p) || p.invulnFrames > 0 || p.floor !== floor) return;
  if (Math.abs(p.x - x) >= 10) return;
  if (!rolling && atY !== undefined && atY < p.y - MALL_SPRITE_H) return;
  if (g.powerups.invulnFrames > 0) return;
  killPlayer(g, 'lamp');
}

// ---------------------------------------------------------------------------
// Pickups and coins
// ---------------------------------------------------------------------------

function stepPickups(g: GameState): void {
  const m = g.mall;
  for (const pu of m.pickups) pu.frames--;
  m.pickups = m.pickups.filter((pu) => pu.frames > 0);
}

function checkPlayerPickups(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  m.pickups = m.pickups.filter((pu) => {
    if (pu.floor !== p.floor || Math.abs(pu.x - p.x) > 12 || Math.abs(pu.y - p.y) > 20) return true;
    grantPowerUp(g, pu.id, p.x, p.y - MALL_SPRITE_H);
    return false;
  });
}

export function grantPowerUp(g: GameState, id: PowerUpId, x: number, y: number): void {
  const extra = applyPowerUp(g.powerups, id);
  if (extra) g.lives += extra;
  addScore(g, SCORE_POWERUP, x, y);
  banner(g.mall, [POWERUPS[id].name], sec(1.5));
  g.bus.sfx(id === 'oneup' ? 'itemGet' : 'powerup');
}

function stepCoins(g: GameState): void {
  const m = g.mall;
  for (const c of m.coins) {
    c.frames--;
    c.vy += GRAVITY;
    c.x += c.vx;
    c.y += c.vy;
    const groundY = floorY(c.floor);
    if (c.y >= groundY) {
      c.y = groundY;
      c.vy *= -0.5;
      c.vx *= 0.8;
      if (Math.abs(c.vy) < 0.6) c.vy = 0;
    }
  }
  m.coins = m.coins.filter((c) => c.frames > 0);
}

function checkPlayerCoins(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  m.coins = m.coins.filter((c) => {
    if (c.floor !== p.floor || Math.abs(c.x - p.x) > 12 || Math.abs(c.y - p.y) > 24) return true;
    addScore(g, SCORE_COIN, c.x, c.y - 8);
    g.bus.sfx('coin');
    if (c.gold) {
      g.lives++;
      banner(m, ['GOLD COIN! 1-UP'], sec(2));
      g.bus.sfx('itemGet');
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

function stepNpcs(g: GameState): void {
  const m = g.mall;
  const p = m.player;

  // --- janitor -----------------------------------------------------------
  const j = m.janitor;
  if (j.mopping > 0) {
    j.mopping--;
    if (j.mopping === 0) dropWetPatch(g);
  } else {
    j.x += j.dir * 0.4;
    if (j.x <= JANITOR_RANGE[0]) {
      j.x = JANITOR_RANGE[0];
      j.dir = 1;
    }
    if (j.x >= JANITOR_RANGE[1]) {
      j.x = JANITOR_RANGE[1];
      j.dir = -1;
    }
    if (--j.mopTimer <= 0) {
      j.mopTimer = MOP_INTERVAL;
      j.mopping = sec(1);
    }
  }

  // --- mall walkers ------------------------------------------------------
  for (const w of m.walkers) {
    if (w.bubbleFrames > 0) w.bubbleFrames--;
    w.x += w.dir * 0.7;
    if (w.x <= w.lo) {
      w.x = w.lo;
      w.dir = 1;
    }
    if (w.x >= w.hi) {
      w.x = w.hi;
      w.dir = -1;
    }
  }

  // --- mall cop ----------------------------------------------------------
  const cop = m.cop;
  if (cop.cooldown > 0) cop.cooldown--;
  if (cop.chaseFrames > 0) {
    cop.chaseFrames--;
    if (cop.floor === p.floor && playerVisible(p)) {
      cop.dir = p.x < cop.x ? -1 : 1;
      cop.x += cop.dir * 1.3;
      if (Math.abs(cop.x - p.x) < 10 && p.mode === 'play') {
        p.mode = 'frozen';
        p.modeFrames = COP_FREEZE_FRAMES;
        addScore(g, SCORE_COP_PENALTY, p.x, p.y - MALL_SPRITE_H);
        bubble(m, p.x, p.y - MALL_SPRITE_H - 8, COP_CAUGHT, sec(2));
        g.bus.sfx('buzzer');
        cop.chaseFrames = 0;
        cop.cooldown = sec(5);
      }
    }
    if (cop.chaseFrames === 0) cop.cooldown = sec(3);
  } else {
    cop.x += cop.dir * 0.6;
    if (cop.x <= 24) {
      cop.x = 24;
      cop.dir = 1;
    }
    if (cop.x >= MALL_W - 24) {
      cop.x = MALL_W - 24;
      cop.dir = -1;
    }
  }
}

function dropWetPatch(g: GameState): void {
  const m = g.mall;
  const j = m.janitor;
  let x = j.x - WET_PATCH_W / 2;
  // The patch must NEVER reach a shaft opening.
  for (const s of SHAFTS) {
    if (!shaftServes(s, j.floor)) continue;
    const l = shaftLeft(s) - 8;
    const r = shaftRight(s) + 8;
    if (x + WET_PATCH_W > l && x < r) {
      // Push it clear to whichever side has room.
      x = j.x < s.x ? l - WET_PATCH_W : r;
    }
  }
  x = Math.max(4, Math.min(MALL_W - WET_PATCH_W - 4, x));
  m.wetPatches.push({ floor: j.floor, x, w: WET_PATCH_W, frames: WET_PATCH_FRAMES });
}

function checkPlayerWalkers(g: GameState): void {
  const m = g.mall;
  const p = m.player;
  for (const w of m.walkers) {
    if (w.floor !== p.floor) continue;
    if (Math.abs(w.x - p.x) < 10) {
      // Touching one just pushes you along.
      p.x = clampX(p.x + w.dir * 0.7, HALF_W);
    }
  }
}

// ---------------------------------------------------------------------------
// Mall PA
// ---------------------------------------------------------------------------

function stepPa(g: GameState): void {
  const m = g.mall;
  if (--m.paTimer > 0) return;
  m.paTimer = PA_INTERVAL;
  // Never the same line twice in a row.
  let i = g.rng.int(PA_LINES.length);
  if (i === m.lastPaIndex) i = (i + 1) % PA_LINES.length;
  m.lastPaIndex = i;
  banner(m, [...PA_LINES[i]], sec(3.5));
  g.bus.sfx('paChime');
}

// ---------------------------------------------------------------------------
// Exit helper used by tests and the map overlay
// ---------------------------------------------------------------------------

export function atGetawayCar(m: MallState): boolean {
  const p = m.player;
  return p.floor === FLOOR_P && Math.abs(p.x - GETAWAY_CAR_X) <= 20;
}

export { FLOOR_R };
