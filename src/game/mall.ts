/** Side-scrolling mall rules: physics, elevators, spies, lights, NPCs. Pure; frame units. */
import { Btn, DIRS, type PadFrame } from '../core/input';
import type { Bullet, Car, Game, Lamp, Level, Player, Spy } from './types';
import {
  BOOTH, CAR_H, ESCALATORS, FLOOR_H, FLOOR_Y, FOUNTAINS, F_1, F_2, F_3, F_P, JANITOR_RANGE, KIOSKS, SHAFTS, SHAFT_W, SLAB, STORES,
  VIEW_H, VIEW_W, WAGON_X, WALL_L, WALL_R, WET_MAX, WET_MIN, WET_W, WORLD_H, WORLD_W, doorX, floorOf, segmentAt, shaftColumn, shaftServes,
} from './level';
import { ELEVATOR_LINES, FLOOR_ANNOUNCE, LAST_WORDS, PA_LINES, TEXT } from './copy';
import { addScore, difficulty, grantPower, loseOnDeath, maxShots, randomPower, shotCooldown, walkSpeed } from './powers';
import { wrap } from '../gfx/font';

export const GRAV = 0.156;
export const JUMP_V = 2.5; // ~20 px high
export const JUMP_V_SNEAK = 2.9;
export const STEP_UP = 4;
export const PH = 24; // agent / spy height
export const FATAL_FALL = 48; // falling more than one floor kills
export const BULLET_V = 4;
export const SPY_BULLET_V = 2;
export const SPY_SPEED = 0.5;
export const SPY_SEE = 160;
export const SPY_STOP = 40;
export const SPY_FIRST_SHOT = 120; // no shot sooner than ~2 s after appearing
export const SPY_TELEGRAPH = 30; // aiming pose, ~0.5 s
export const SPY_REACT = 40; // must have seen the player this long before aiming
export const DODGE_CHANCE = 0.1;
export const SPY_DEATH = 24;
export const AUTO_WAIT = 120;
export const CALL_STILL = 30;
export const BOOTH_TIME = 300;
export const RESPAWN_INVULN = 120;
export const ALARM_SECS = 150;

const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);

// ---------------------------------------------------------------- geometry

/** Lowest-y support surface at or below feet height y (with step tolerance) in column x. */
export function groundBelow(L: Level, x: number, y: number, tol = STEP_UP): number {
  const lim = y - tol;
  const si = shaftColumn(x);
  let best = Infinity;
  if (si < 0) {
    for (const fy of FLOOR_Y) if (fy >= lim && fy < best) best = fy;
    return best;
  }
  const s = SHAFTS[si];
  const car = L.cars[si];
  for (let f = 0; f < FLOOR_Y.length; f++) {
    const fy = FLOOR_Y[f];
    if (fy < lim) continue;
    // solid floor outside the shaft's range; inside it, a grate (car above) or the car floor (car here)
    if (f < s.top || f > s.bottom || car.y <= fy) if (fy < best) best = fy;
  }
  const roof = car.y - CAR_H;
  if (roof >= lim && roof < best) best = roof;
  if (car.y >= lim && car.y < best) best = car.y; // the car floor itself (riders)
  return best;
}

/** Does the car body block walking into its column at feet height y? */
export function carBlocks(L: Level, si: number, y: number, h = PH): boolean {
  const car = L.cars[si];
  if (car.dir === 0 && car.y === y) return false; // doors open at this floor
  return car.y - CAR_H < y && car.y + SLAB > y - h;
}

/** Shaft walls only open at floor level. */
function atOpening(si: number, y: number): boolean {
  const s = SHAFTS[si];
  const f = floorOf(y);
  if (!shaftServes(s, f) && !(f > 0 && shaftServes(s, f - 1) && y - FLOOR_Y[f - 1] <= STEP_UP)) return true;
  for (let k = s.top; k <= s.bottom; k++) if (y >= FLOOR_Y[k] - 21 && y <= FLOOR_Y[k] + STEP_UP) return true;
  return false;
}

/** Horizontal move with walls, car bodies and shaft walls. Returns true if it moved. */
export function moveX(L: Level, e: { x: number; y: number }, dx: number, h = PH): boolean {
  let nx = e.x + dx;
  if (nx < WALL_L) nx = WALL_L;
  if (nx > WALL_R) nx = WALL_R;
  if (nx === e.x) return false;
  const a = shaftColumn(e.x);
  const b = shaftColumn(nx);
  if (a !== b) {
    if (b >= 0 && (carBlocks(L, b, e.y, h) || !atOpening(b, e.y))) return false;
    if (a >= 0 && !atOpening(a, e.y)) return false;
  }
  e.x = nx;
  return true;
}

/** Highest y the head may reach in this column. */
function ceilingAt(L: Level, x: number, y: number): number {
  const f = floorOf(y);
  const si = shaftColumn(x);
  if (si >= 0) {
    const s = SHAFTS[si];
    if (y <= FLOOR_Y[s.bottom] + STEP_UP && y > FLOOR_Y[s.top] - FLOOR_H) {
      let c = FLOOR_Y[s.top] - FLOOR_H + SLAB;
      const car = L.cars[si];
      if (car.y < y) c = Math.max(c, car.y + SLAB);
      return c;
    }
  }
  return f === 0 ? -1000 : FLOOR_Y[f - 1] + SLAB;
}

export function inWet(L: Level, x: number): boolean {
  for (const w of L.wets) if (x >= w.x0 && x <= w.x0 + WET_W) return true;
  return false;
}

export function say(L: Level, x: number, y: number, text: string, t = 110): void {
  L.bubbles = L.bubbles.filter((b) => Math.abs(b.x - x) > 40 || Math.abs(b.y - y) > 20);
  L.bubbles.push({ x, y, text, t });
}
export function popup(L: Level, x: number, y: number, text: string): void {
  L.popups.push({ x, y, text, t: 50 });
}
export function banner(L: Level, lines: string[], t = 150): void {
  L.banner = { lines, t };
}

// ---------------------------------------------------------------- elevators

function spyInside(L: Level, i: number): boolean {
  return L.spies.some((s) => s.state !== 'dead' && s.car === i);
}

function stopCar(g: Game, L: Level, i: number, f: number, inside: boolean): void {
  const c = L.cars[i];
  const s = SHAFTS[i];
  const P = L.player;
  c.dir = 0;
  c.target = -1;
  c.manual = false;
  c.pickup = false;
  c.timer = AUTO_WAIT;
  const cx = s.x + SHAFT_W / 2;
  const sameFloor = Math.abs(P.y - FLOOR_Y[f]) <= 24;
  const near = inside || (sameFloor && Math.abs(P.x - cx) < 170);
  // exactly one ding per stop
  if (near && L.mode === 'mall') g.sfx.push('ding');
  if (inside) banner(L, [FLOOR_ANNOUNCE[f]], 110);
  else if (near && L.mode === 'mall' && L.t > 360 && shaftColumn(P.x) !== i && Math.abs(P.x - cx) > 48) {
    const d = difficulty(g.loop, L.alarm, g.blackFriday);
    if (L.spies.filter((q) => q.state !== 'dead').length < d.spyCap && !spyInside(L, i) && g.rng.chance(0.25)) {
      const spy = spawnSpy(L, cx, FLOOR_Y[f], P.x < cx ? -1 : 1);
      spy.state = 'walk';
      spy.car = i;
      spy.pause = 50;
      say(L, cx, FLOOR_Y[f] - 30, g.rng.pick(ELEVATOR_LINES));
    }
  }
}

function crushSpy(g: Game, L: Level, s: Spy): void {
  killSpy(g, L, s, 300, false);
  L.shake = 10;
  g.sfx.push('crush');
}

export function stepCars(g: Game, L: Level, pad: PadFrame): void {
  const P = L.player;
  for (let i = 0; i < SHAFTS.length; i++) {
    const s = SHAFTS[i];
    const c = L.cars[i];
    const inside = !!P.ride && P.ride.shaft === i && P.ride.part === 'in' && P.dying === 0;
    const canDrive = inside && P.frozen === 0 && L.mode === 'mall';
    const up = canDrive && (pad.held & Btn.Up) !== 0;
    const down = canDrive && (pad.held & Btn.Down) !== 0 && !up;
    const prevY = c.y;
    if (c.dir === 0) {
      if (c.door < 8) c.door++;
      const f = FLOOR_Y.indexOf(c.y);
      let want = 0;
      if (up && f > s.top) want = -1;
      else if (down && f < s.bottom) want = 1;
      if (want) {
        c.dir = want; c.manual = true; c.target = -1; c.call = -1; c.pickup = false; c.door = 0;
      } else if (!inside && c.call >= 0) {
        if (c.call === f) c.call = -1;
        else {
          c.dir = c.call < f ? -1 : 1; c.target = c.call; c.manual = false; c.pickup = true; c.call = -1; c.door = 0;
        }
      } else if (s.auto && !inside && !spyInside(L, i)) {
        // The automatic car never leaves while anyone is standing inside it.
        if (--c.timer <= 0) {
          let t = f;
          while (t === f) t = s.top + g.rng.int(s.bottom - s.top + 1);
          c.dir = t < f ? -1 : 1; c.target = t; c.manual = false; c.pickup = false; c.door = 0;
        }
      }
    }
    if (c.dir !== 0) {
      if (c.manual && inside) {
        if (c.dir === -1 && down) c.dir = 1;
        else if (c.dir === 1 && up) c.dir = -1;
      }
      c.y += c.dir;
      const f = FLOOR_Y.indexOf(c.y);
      if (f >= 0) {
        let stop: boolean;
        if (c.manual) stop = !((c.dir === -1 && up) || (c.dir === 1 && down));
        else stop = f === c.target;
        if ((c.dir === -1 && f <= s.top) || (c.dir === 1 && f >= s.bottom)) stop = true;
        if (stop) stopCar(g, L, i, f, inside);
      }
    }
    const dy = c.y - prevY;
    if (dy !== 0) {
      if (P.ride && P.ride.shaft === i) P.y = P.ride.part === 'in' ? c.y : c.y - CAR_H;
      for (const q of L.spies) if (q.car === i && q.state !== 'dead') q.y = c.y;
    }
    // crush: a descending car lands on whoever stands on a grate
    if (dy > 0) {
      for (const q of L.spies) {
        if (q.state === 'dead' || q.car === i || shaftColumn(q.x) !== i) continue;
        if (c.y < q.y && c.y + SLAB > q.y - PH + 4) crushSpy(g, L, q);
      }
      if (P.dying === 0 && !(P.ride && P.ride.shaft === i) && shaftColumn(P.x) === i && P.hidden === 0) {
        const h = P.ducking ? 16 : PH;
        const picking = c.pickup && FLOOR_Y[c.target] === P.y;
        if (!picking && c.y < P.y && c.y + SLAB > P.y - h + 2) killPlayer(g, L, 'crush');
      }
    }
    // riding the roof into the top of the shaft
    if (dy < 0 && P.ride && P.ride.shaft === i && P.ride.part === 'roof' && P.dying === 0) {
      if (c.y - CAR_H - PH + 6 < FLOOR_Y[s.top] - FLOOR_H + SLAB) killPlayer(g, L, 'crush');
    }
  }
}

/** Ask a car to come to floor f. Returns true if a new call was placed. */
export function callCar(L: Level, i: number, f: number): boolean {
  const c = L.cars[i];
  if (!shaftServes(SHAFTS[i], f)) return false;
  if (c.y === FLOOR_Y[f] && c.dir === 0) return false;
  if (c.call === f || (c.target === f && c.pickup)) return false;
  c.call = f;
  return true;
}

function tryCall(g: Game, L: Level, reach: number): boolean {
  const P = L.player;
  const f = FLOOR_Y.indexOf(P.y);
  if (f < 0 || !P.onGround) return false;
  for (let i = 0; i < SHAFTS.length; i++) {
    const s = SHAFTS[i];
    if (!shaftServes(s, f)) continue;
    if (Math.abs(P.x - (s.x + SHAFT_W / 2)) > reach) continue;
    if (callCar(L, i, f)) {
      g.sfx.push('call');
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- player

export function killPlayer(g: Game, L: Level, cause: string): boolean {
  const P = L.player;
  if (P.dying > 0 || g.screen !== 'play') return false;
  const hard = cause === 'crush' || cause === 'fall';
  if (!hard) {
    if (P.invuln > 0 || L.powers.cinna > 0 || P.hidden > 0) return false;
    if (L.powers.armor) {
      L.powers.armor = false;
      P.invuln = 60;
      g.sfx.push('hurt');
      banner(L, [TEXT.armorSaved], 90);
      return false;
    }
  }
  P.dying = 70;
  P.cause = cause;
  P.vx = 0;
  P.vy = 0;
  P.esc = null;
  P.frozen = 0;
  P.kicking = false;
  g.sfx.push('death');
  if (cause === 'crush') {
    L.shake = 12;
    g.sfx.push('crush');
  }
  return true;
}

export function respawnPlayer(L: Level): void {
  const P = L.player;
  P.x = P.safeX; P.y = P.safeY; P.vx = 0; P.vy = 0;
  P.onGround = true; P.ducking = false; P.kicking = false; P.sliding = 0; P.esc = null; P.hidden = 0; P.frozen = 0;
  P.ride = null; P.dying = 0; P.invuln = RESPAWN_INVULN; P.stillT = 0;
  L.spies = [];
  L.bullets = [];
  L.cop.chase = 0;
}

/** Death animation finished: lose a life, then respawn / continue / game over. */
export function finishDeath(g: Game, L: Level): void {
  g.lives--;
  loseOnDeath(L.powers);
  if (g.lives <= 0) {
    g.lives = 0;
    g.screen = g.continues > 0 ? 'continue' : 'gameover';
    g.t = 0;
    if (g.screen === 'gameover') g.sfx.push('pa');
    return;
  }
  if (L.mode === 'mall') respawnPlayer(L);
}

function interactUp(g: Game, L: Level, f: number): boolean {
  const P = L.player;
  if (f < 0) return false;
  for (const st of L.stores) {
    if (st.def.floor !== f || Math.abs(P.x - doorX(st.def)) > 9) continue;
    if (st.def.role === 'closed' || (st.def.role === 'target' && st.cleared)) {
      g.sfx.push('buzz');
      return true;
    }
    L.trans = { kind: 'in', t: 0, store: st.def.id };
    g.sfx.push('door');
    return true;
  }
  for (let k = 0; k < KIOSKS.length; k++) {
    if (KIOSKS[k].floor !== f || Math.abs(P.x - KIOSKS[k].x) > 9) continue;
    if (L.kioskCd[k] > 0) { g.sfx.push('buzz'); return true; }
    const target = nearestPackageStore(L, f, P.x);
    L.kioskPanel = { t: 200, store: target };
    L.kioskCd[k] = 1200;
    g.sfx.push('blip');
    return true;
  }
  if (BOOTH.floor === f && Math.abs(P.x - BOOTH.x) <= 9 && P.boothCd === 0) {
    P.hidden = BOOTH_TIME;
    P.ducking = false;
    g.sfx.push('door');
    return true;
  }
  if (f === F_P && Math.abs(P.x - WAGON_X) <= 26) {
    if (g.pkgs >= 6) {
      // Level clear must trigger exactly once.
      if (!L.cleared) {
        L.cleared = true;
        g.clears++;
        g.screen = 'clear';
        g.t = 0;
      }
    } else if (L.exitCd === 0) {
      L.exitCd = 60;
      banner(L, [TEXT.packagesLeft + ' ' + (6 - g.pkgs)], 120);
      g.sfx.push('buzz');
    }
    return true;
  }
  return false;
}

/** Nearest store that still holds a package (by floors first, then distance); -1 if none. */
export function nearestPackageStore(L: Level, f: number, x: number): number {
  let best = -1, bd = Infinity;
  for (const st of L.stores) {
    if (st.def.role !== 'target' || st.cleared) continue;
    const d = Math.abs(st.def.floor - f) * 1000 + Math.abs(doorX(st.def) - x);
    if (d < bd) { bd = d; best = st.def.id; }
  }
  return best;
}

function boardEsc(L: Level, f: number, up: boolean): boolean {
  const P = L.player;
  for (let i = 0; i < ESCALATORS.length; i++) {
    const e = ESCALATORS[i];
    if (up && e.lower === f && Math.abs(P.x - e.xLow) <= 5) { P.esc = { i, up: true, t: 0 }; P.x = e.xLow; return true; }
    if (!up && e.upper === f && Math.abs(P.x - e.xHigh) <= 5) { P.esc = { i, up: false, t: 0 }; P.x = e.xHigh; return true; }
  }
  return false;
}

function shoot(g: Game, L: Level): void {
  const P = L.player;
  const shots = new Set(L.bullets.filter((b) => b.owner === 'p').map((b) => b.shot));
  if (P.shootCd > 0 || shots.size >= maxShots(L.powers)) return;
  P.shootCd = shotCooldown(L.powers);
  P.shootAnim = 10;
  if (L.t - L.lastShotT > 30) L.volleyId++;
  L.lastShotT = L.t;
  const shot = ++L.shotId;
  const y = P.y - (P.ducking ? 6 : 15);
  const mk = (vy: number): Bullet => ({ x: P.x + P.face * 8, y, vx: P.face * BULLET_V, vy, owner: 'p', shot, volley: L.volleyId, t: 0 });
  L.bullets.push(mk(0));
  if (L.powers.weapon === 'spread') L.bullets.push(mk(-0.8), mk(0.8));
  g.sfx.push('shot');
  // the mall cop objects to gunfire in front of him
  const cop = L.cop;
  if (cop.chase === 0 && cop.cool === 0 && Math.abs(P.y - FLOOR_Y[cop.floor]) <= 24 && Math.abs(P.x - cop.x) <= 128 && sign(P.x - cop.x) === cop.dir) {
    cop.chase = 600;
    g.sfx.push('whistle');
    say(L, cop.x, FLOOR_Y[cop.floor] - 30, TEXT.copStop, 100);
  }
}

export function stepPlayer(g: Game, L: Level, pad: PadFrame): void {
  const P = L.player;
  const pw = L.powers;
  if (P.invuln > 0) P.invuln--;
  if (P.shootCd > 0) P.shootCd--;
  if (P.shootAnim > 0) P.shootAnim--;
  if (P.boothCd > 0) P.boothCd--;
  if (P.landT > 0) P.landT--;
  if (L.exitCd > 0) L.exitCd--;
  if (P.dying > 0) {
    if (--P.dying === 0) finishDeath(g, L);
    return;
  }
  let held = pad.held;
  let pressed = pad.pressed;
  if (P.frozen > 0) {
    P.frozen--;
    held = 0;
    pressed = 0;
  }
  if (P.hidden > 0) {
    P.hidden--;
    if (P.hidden === 0 || (P.hidden < BOOTH_TIME - 20 && pressed & (DIRS | Btn.A | Btn.B))) {
      P.hidden = 0;
      P.boothCd = 90;
      g.sfx.push('door');
      if (!g.photoStrip) {
        // the first exit each game prints a photo strip
        g.photoStrip = true;
        L.photoStripT = 180;
        g.sfx.push('itemget');
      }
    }
    return;
  }
  if (P.esc) {
    const e = ESCALATORS[P.esc.i];
    P.esc.t++;
    const k = P.esc.t;
    if (P.esc.up) { P.x = e.xLow + k; P.y = FLOOR_Y[e.lower] - k; P.face = 1; }
    else { P.x = e.xHigh - k; P.y = FLOOR_Y[e.upper] + k; P.face = -1; }
    if (k >= FLOOR_H) { P.esc = null; P.onGround = true; }
    if (pressed & Btn.A && P.esc) shoot(g, L);
    return;
  }
  const speed = walkSpeed(pw);
  const carIn = P.ride && P.ride.part === 'in' ? L.cars[P.ride.shaft] : null;
  const carMoving = !!carIn && carIn.dir !== 0;
  let mx = 0;
  if (held & Btn.Left) mx = -1;
  else if (held & Btn.Right) mx = 1;

  if (P.onGround) {
    const f = FLOOR_Y.indexOf(P.y);
    const wet = f === F_1 && inWet(L, P.x);
    if (wet) {
      if (!P.sliding) { P.sliding = mx || P.face; g.sfx.push('slide'); }
    } else {
      P.sliding = 0;
      P.kicking = false;
    }
    let acted = false;
    if (!carMoving && !P.sliding) {
      if (pressed & Btn.Up) acted = interactUp(g, L, f);
      if (!acted && held & Btn.Up) acted = boardEsc(L, f, true);
      if (!acted && held & Btn.Down) acted = boardEsc(L, f, false);
      if (!acted && pressed & (Btn.Up | Btn.Down) && !carIn) acted = tryCall(g, L, 28);
    }
    if (g.screen !== 'play' || L.trans || P.esc || P.hidden) return;
    P.ducking = (held & Btn.Down) !== 0 && !carIn && !P.sliding;
    let moved = false;
    if (P.sliding) {
      P.face = P.sliding as 1 | -1;
      moved = moveX(L, P, P.sliding);
      if (!moved) P.sliding = 0;
    } else if (mx && !carMoving) {
      P.face = mx as 1 | -1;
      if (!P.ducking) moved = moveX(L, P, mx * speed);
    }
    P.walkT = moved ? P.walkT + 1 : 0;
    const gy = groundBelow(L, P.x, P.y);
    if (gy !== P.y) {
      if (Math.abs(gy - P.y) <= STEP_UP) P.y = gy;
      else { P.onGround = false; P.vy = 0; P.vx = 0; P.fallFrom = P.y; P.ducking = false; }
    }
    // standing still at an empty opening calls the car
    if (!moved && P.onGround && !carIn) {
      if (++P.stillT === CALL_STILL) tryCall(g, L, 20);
    } else P.stillT = 0;
    if (P.onGround && pressed & Btn.B && !carMoving && !P.sliding && !P.ducking) {
      P.onGround = false;
      P.vy = -(pw.speed === 'sneakers' ? JUMP_V_SNEAK : JUMP_V);
      P.vx = mx * speed * 1.5;
      P.kicking = mx !== 0; // a moving jump is a jump-kick
      P.fallFrom = P.y;
      P.ride = null;
      g.sfx.push('jump');
    }
  } else {
    const py = P.y;
    P.vy = Math.min(4, P.vy + GRAV);
    let ny = P.y + P.vy;
    if (P.vy < 0) {
      const c = ceilingAt(L, P.x, P.y);
      if (ny - PH < c) { ny = Math.max(P.y, c + PH); P.vy = 0; }
    }
    if (P.vx !== 0 && !moveX(L, P, P.vx)) P.vx = 0;
    if (ny < P.fallFrom) P.fallFrom = ny;
    if (P.vy >= 0) {
      const gy = groundBelow(L, P.x, py, 0);
      if (ny >= gy) {
        ny = gy;
        P.onGround = true;
        P.vy = 0;
        P.vx = 0;
        const fell = gy - P.fallFrom;
        const wet = gy === FLOOR_Y[F_1] && inWet(L, P.x);
        if (!wet) P.kicking = false; // a jump-kick landing on a wet floor keeps kicking
        if (fell > FATAL_FALL) { P.y = ny; killPlayer(g, L, 'fall'); return; }
        if (fell > 6) g.sfx.push('land');
      }
    }
    P.y = ny;
  }
  if (pressed & Btn.A && P.frozen === 0) shoot(g, L);

  // bookkeeping: what are we standing on, and is this a safe respawn spot?
  P.ride = null;
  if (P.onGround) {
    const si = shaftColumn(P.x);
    if (si >= 0) {
      const c = L.cars[si];
      if (P.y === c.y) P.ride = { shaft: si, part: 'in' };
      else if (P.y === c.y - CAR_H) P.ride = { shaft: si, part: 'roof' };
    }
    const f = FLOOR_Y.indexOf(P.y);
    if (f >= 0 && (si < 0 || !shaftServes(SHAFTS[si], f)) && !(f === F_1 && inWet(L, P.x))) {
      P.safeX = P.x;
      P.safeY = P.y;
    }
  }
}

// ---------------------------------------------------------------- spies

export function spawnSpy(L: Level, x: number, y: number, face: number): Spy {
  const s: Spy = {
    id: L.nextId++, x, y, face: face >= 0 ? 1 : -1, state: 'emerge', t: 0, shootT: SPY_FIRST_SHOT, aimLow: false,
    goalX: x, pause: 0, volley: -1, car: -1, far: 0, slide: 0, seen: 0,
  };
  L.spies.push(s);
  return s;
}

export function killSpy(g: Game, L: Level, s: Spy, points: number, mayTalk = true): void {
  if (s.state === 'dead') return;
  s.state = 'dead';
  s.t = 0;
  s.car = -1;
  addScore(g, points);
  popup(L, s.x, s.y - 28, String(points));
  g.sfx.push('spydie');
  if (mayTalk && g.rng.chance(0.35)) say(L, s.x, s.y - 30, g.rng.pick(LAST_WORDS), 90);
  // 5% drop a power-up, half of them food
  if (g.rng.chance(0.05)) L.pickups.push({ x: s.x, y: s.y, kind: randomPower(g.rng, 0.5), t: 600 });
}

function spyMove(L: Level, s: Spy, dx: number): boolean {
  const nx = s.x + dx;
  // spies never walk into pits
  if (groundBelow(L, nx, s.y, 0) !== s.y) return false;
  return moveX(L, s, dx);
}

export function stepSpies(g: Game, L: Level): void {
  const P = L.player;
  const d = difficulty(g.loop, L.alarm, g.blackFriday);
  const speed = SPY_SPEED * d.speedMul;
  // spies ignore a player who is hidden, dying, arriving or posing
  const visible = P.dying === 0 && P.hidden === 0 && L.mode === 'mall';
  for (const s of L.spies) {
    const ss = s;
    s.t++;
    if (s.state === 'dead') continue;
    if (s.state === 'emerge') {
      if (s.t >= 20) { s.state = 'walk'; s.t = 0; }
      continue;
    }
    if (s.shootT > 0) s.shootT--;
    const dx = P.x - s.x;
    const sees = visible && Math.abs(P.y - s.y) <= 24 && Math.abs(dx) <= SPY_SEE;
    ss.seen = sees ? ss.seen + 1 : 0;
    if (Math.abs(dx) > 330 || Math.abs(P.y - s.y) > 100) {
      if (++s.far > 300) { s.state = 'dead'; s.t = SPY_DEATH; continue; }
    } else s.far = 0;
    const si = shaftColumn(s.x);
    if (si >= 0 && s.y === L.cars[si].y) s.car = si;
    else if (s.car >= 0 && (si !== s.car || L.cars[s.car].dir === 0)) s.car = -1;
    if (s.car >= 0 && L.cars[s.car].dir !== 0) continue; // riding along
    if (s.y === FLOOR_Y[F_1] && inWet(L, s.x)) {
      if (!s.slide) s.slide = s.face;
      if (!spyMove(L, s, s.slide * speed)) s.slide = -s.slide;
      continue;
    }
    s.slide = 0;
    // may duck an incoming bullet: decided once per volley, 10% chance
    if (s.state === 'walk' || s.state === 'wait' || s.state === 'aim') {
      for (const b of L.bullets) {
        if (b.owner !== 'p' || b.volley === s.volley) continue;
        if (Math.abs(b.y - (s.y - 15)) < 6 && sign(b.vx) === sign(s.x - b.x) && Math.abs(b.x - s.x) < 72) {
          s.volley = b.volley;
          if (g.rng.chance(DODGE_CHANCE)) { s.state = 'duck'; s.t = 0; }
          break;
        }
      }
    }
    switch (s.state) {
      case 'duck':
        if (s.t >= 36) { s.state = 'walk'; s.t = 0; }
        break;
      case 'aim':
        if (s.t >= SPY_TELEGRAPH) {
          L.bullets.push({ x: s.x + s.face * 8, y: s.y - (s.aimLow ? 5 : 17), vx: s.face * SPY_BULLET_V, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
          g.sfx.push('eshot');
          s.state = 'walk';
          s.t = 0;
          s.shootT = d.shootInterval;
        }
        break;
      case 'walk':
      case 'wait':
        if (sees) {
          s.face = dx >= 0 ? 1 : -1;
          if (s.shootT <= 0 && ss.seen >= SPY_REACT) {
            s.state = 'aim'; s.t = 0; s.aimLow = g.rng.chance(0.5);
          } else if (Math.abs(dx) > SPY_STOP) spyMove(L, s, s.face * speed);
        } else if (s.pause > 0) s.pause--;
        else if (Math.abs(s.goalX - s.x) <= speed) {
          const f = FLOOR_Y.indexOf(s.y);
          const seg = segmentAt(f, s.x);
          s.pause = 30 + g.rng.int(60);
          s.state = 'walk';
          const shafts = SHAFTS.filter((q) => shaftServes(q, f) && Math.abs(q.x + 12 - s.x) < 200);
          if (shafts.length && g.rng.chance(0.3)) {
            // deliberately go and wait in a shaft opening
            s.goalX = g.rng.pick(shafts).x + SHAFT_W / 2;
            s.pause = 0;
          } else s.goalX = seg[0] + 10 + g.rng.int(Math.max(1, seg[1] - seg[0] - 20));
        } else {
          s.face = s.goalX > s.x ? 1 : -1;
          if (!spyMove(L, s, s.face * speed)) { s.goalX = s.x; s.pause = 40; }
          else if (Math.abs(s.goalX - s.x) <= speed && shaftColumn(s.x) >= 0) { s.state = 'wait'; s.pause = 240; }
        }
        break;
    }
  }
  L.spies = L.spies.filter((s) => !(s.state === 'dead' && s.t >= SPY_DEATH));
  // contact
  if (visible) {
    for (const s of L.spies) {
      if (s.state === 'dead' || s.state === 'emerge') continue;
      if (Math.abs(s.x - P.x) < 10 && Math.abs(s.y - P.y) < 20) {
        if (P.kicking) { killSpy(g, L, s, P.sliding ? 300 : 100); g.sfx.push('kick'); }
        else if (L.powers.cinna > 0) killSpy(g, L, s, 100);
        else killPlayer(g, L, 'spy');
      }
    }
  }
}

function stepSpawner(g: Game, L: Level): void {
  if (--L.spawnT > 0) return;
  const P = L.player;
  const d = difficulty(g.loop, L.alarm, g.blackFriday);
  const alive = L.spies.filter((s) => s.state !== 'dead').length;
  L.spawnT = 30;
  if (alive >= d.spyCap || P.dying > 0) return;
  const pf = floorOf(P.y);
  const cands = L.stores.filter((st) => {
    if (st.def.role === 'closed' || (st.def.role === 'target' && st.cleared)) return false;
    if (Math.abs(st.def.floor - pf) > 1) return false;
    const dist = Math.abs(doorX(st.def) - P.x);
    return dist >= 64 && dist <= 200;
  });
  if (!cands.length) return;
  const st = g.rng.pick(cands);
  const x = doorX(st.def);
  spawnSpy(L, x, FLOOR_Y[st.def.floor], P.x >= x ? 1 : -1);
  if (st.def.floor === pf) g.sfx.push('door');
  L.spawnT = Math.round((240 + g.rng.int(120)) / d.spawnMul);
}

// ---------------------------------------------------------------- bullets, lights, things

function dropLamp(g: Game, L: Level, lamp: Lamp, dir: number): void {
  if (lamp.state !== 'hang') return;
  lamp.state = 'fall';
  lamp.vy = 0;
  lamp.dir = dir || 1;
  g.sfx.push('lampfall');
}

function stepBullets(g: Game, L: Level): void {
  const P = L.player;
  const keep: Bullet[] = [];
  for (const b of L.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.t++;
    if (b.x < 8 || b.x > WORLD_W - 8 || Math.abs(b.x - (L.camX + VIEW_W / 2)) > 190 || b.t > 150) continue;
    const f = floorOf(b.y + 1);
    const fy = FLOOR_Y[f];
    if (b.y >= fy || b.y <= fy - FLOOR_H + SLAB) continue; // hit floor / ceiling
    let gone = false;
    // mall walkers block bullets from both sides
    if (f === F_2) {
      for (const w of L.walkers) {
        if (Math.abs(b.x - w.x) < 6 && b.y > fy - 22) {
          gone = true;
          if (b.owner === 'p') {
            w.heyT = 70;
            addScore(g, -200);
            popup(L, w.x, fy - 34, '-200');
            say(L, w.x, fy - 30, TEXT.hey, 60);
            g.sfx.push('hey');
          }
          break;
        }
      }
    }
    if (!gone && b.owner === 'p') {
      const cop = L.cop;
      if (f === cop.floor && Math.abs(b.x - cop.x) < 7 && b.y > fy - 24) {
        gone = true;
        g.sfx.push('ping');
      }
      if (!gone) for (const s of L.spies) {
        if (s.state === 'dead' || s.state === 'emerge' || Math.abs(s.y - fy) > 2) continue;
        const top = s.state === 'duck' ? s.y - 12 : s.y - 22;
        if (Math.abs(b.x - s.x) < 7 && b.y >= top && b.y <= s.y) {
          killSpy(g, L, s, 100);
          gone = true;
          break;
        }
      }
      if (!gone) for (const lamp of L.lamps) {
        if (lamp.state === 'hang' && lamp.floor === f && Math.abs(b.x - lamp.x) <= 4 && b.y <= fy - 13) {
          dropLamp(g, L, lamp, sign(b.vx));
          gone = true;
          break;
        }
      }
      if (!gone) for (let k = 0; k < FOUNTAINS.length; k++) {
        const ft = FOUNTAINS[k];
        if (ft.floor === f && L.fountainCd[k] === 0 && Math.abs(b.x - ft.x) < 12 && b.y > fy - 24) {
          L.fountainCd[k] = 900;
          const n = 3 + g.rng.int(3);
          const goldAt = g.rng.chance(1 / 20) ? g.rng.int(n) : -1;
          for (let c = 0; c < n; c++)
            L.coins.push({ x: ft.x, y: fy - 16, vx: (g.rng.next() * 2 - 1) * 1.3, vy: -(2 + g.rng.next() * 1.4), gold: c === goldAt, t: 0, fy });
          g.sfx.push('coins');
          gone = true;
          break;
        }
      }
    } else if (!gone && b.owner === 's') {
      if (P.dying === 0 && P.hidden === 0 && Math.abs(b.x - P.x) < 5) {
        const top = P.y - (P.ducking ? 12 : 22);
        if (b.y >= top && b.y <= P.y) {
          gone = true;
          killPlayer(g, L, 'bullet');
        }
      }
    }
    if (!gone) keep.push(b);
  }
  L.bullets = keep;
}

function stepLamps(g: Game, L: Level): void {
  const P = L.player;
  for (const lamp of L.lamps) {
    if (lamp.state === 'hang' || lamp.state === 'gone') continue;
    const fy = FLOOR_Y[lamp.floor];
    const hits = (ex: number, ey: number) => Math.abs(ex - lamp.x) < 9 && Math.abs(ey - fy) < 14;
    if (lamp.state === 'fall') {
      lamp.vy += 0.25;
      lamp.y += lamp.vy;
      const landed = lamp.y >= fy;
      for (const s of L.spies) if (s.state !== 'dead' && s.state !== 'emerge' && hits(s.x, s.y) && lamp.y >= s.y - PH) killSpy(g, L, s, 300, false);
      if (P.dying === 0 && P.hidden === 0 && hits(P.x, P.y) && lamp.y >= P.y - PH) killPlayer(g, L, 'lamp');
      if (landed) {
        lamp.y = fy;
        g.sfx.push('glass');
        L.shake = 10;
        const seg = segmentAt(lamp.floor, lamp.x);
        L.dark.push({ floor: lamp.floor, x0: seg[0], x1: seg[1], t: 120 });
        L.fx.push({ kind: 'glass', x: lamp.x, y: fy, t: 24 });
        lamp.state = lamp.disco ? 'roll' : 'gone';
      }
    } else {
      // disco ball: rolls the way the shot went, flattening everyone, until a wall or a pit
      lamp.x += lamp.dir * 2;
      for (const s of L.spies) if (s.state !== 'dead' && s.state !== 'emerge' && hits(s.x, s.y)) killSpy(g, L, s, 300, false);
      if (P.dying === 0 && P.hidden === 0 && hits(P.x, P.y)) killPlayer(g, L, 'lamp');
      let stop = lamp.x < 16 || lamp.x > WORLD_W - 16;
      const si = shaftColumn(lamp.x);
      if (si >= 0 && shaftServes(SHAFTS[si], lamp.floor) && L.cars[si].y >= fy) stop = true; // car here = wall, car below = pit
      if (stop) {
        lamp.state = 'gone';
        L.fx.push({ kind: 'puff', x: lamp.x, y: fy - 6, t: 20 });
        g.sfx.push('glass');
      }
    }
  }
  for (const dk of L.dark) dk.t--;
  L.dark = L.dark.filter((dk) => dk.t > 0);
}

function stepNpcs(g: Game, L: Level): void {
  const P = L.player;
  // mall walkers (2F): they just push you along
  for (const w of L.walkers) {
    w.x += w.dir * 0.75;
    if (w.x <= w.lo) { w.x = w.lo; w.dir = 1; }
    if (w.x >= w.hi) { w.x = w.hi; w.dir = -1; }
    if (w.heyT > 0) w.heyT--;
    if (P.dying === 0 && P.onGround && P.y === FLOOR_Y[F_2] && Math.abs(P.x - w.x) < 10 && !P.esc && P.hidden === 0) moveX(L, P, w.dir * 0.75);
  }
  // janitor (1F): mops now and then, leaving a wet patch that never reaches a shaft
  const j = L.janitor;
  if (j.mopT > 0) {
    j.mopT--;
  } else {
    j.x += j.dir * 0.4;
    if (j.x <= JANITOR_RANGE[0]) { j.x = JANITOR_RANGE[0]; j.dir = 1; }
    if (j.x >= JANITOR_RANGE[1]) { j.x = JANITOR_RANGE[1]; j.dir = -1; }
    if (--j.nextMop <= 0) {
      j.mopT = 90;
      j.nextMop = 900;
      const x0 = Math.max(WET_MIN, Math.min(WET_MAX - WET_W, Math.round(j.x - WET_W / 2)));
      L.wets = [{ x0, t: 600 }];
    }
  }
  for (const w of L.wets) w.t--;
  L.wets = L.wets.filter((w) => w.t > 0);
  // mall cop on a Segway
  const cop = L.cop;
  const cy = FLOOR_Y[cop.floor];
  if (cop.cool > 0) cop.cool--;
  const tryRoll = (dx: number) => {
    const nx = cop.x + dx;
    if (nx < 20 || nx > WORLD_W - 20 || groundBelow(L, nx, cy, 0) !== cy) return false;
    const si = shaftColumn(nx);
    if (si >= 0 && shaftServes(SHAFTS[si], cop.floor) && carBlocks(L, si, cy)) return false;
    cop.x = nx;
    return true;
  };
  if (cop.chase > 0) {
    cop.chase--;
    const same = Math.abs(P.y - cy) <= 24;
    if (same && P.hidden === 0) {
      cop.dir = P.x >= cop.x ? 1 : -1;
      if (Math.abs(P.x - cop.x) > 4) tryRoll(cop.dir * 1.25);
      if (Math.abs(P.x - cop.x) < 10 && P.onGround && P.dying === 0 && P.frozen === 0) {
        // caught: frozen for 3 s and -500 points, but no life lost
        P.frozen = 180;
        P.invuln = Math.max(P.invuln, 200);
        P.ducking = false;
        addScore(g, -500);
        banner(L, [TEXT.detained], 150);
        popup(L, P.x, P.y - 30, '-500');
        g.sfx.push('buzz');
        cop.chase = 0;
        cop.cool = 600;
      }
    }
  } else if (!tryRoll(cop.dir * 0.6)) cop.dir = -cop.dir;
  // fountains, kiosks
  for (let k = 0; k < L.fountainCd.length; k++) if (L.fountainCd[k] > 0) L.fountainCd[k]--;
  for (let k = 0; k < L.kioskCd.length; k++) if (L.kioskCd[k] > 0) L.kioskCd[k]--;
  if (L.kioskPanel && --L.kioskPanel.t <= 0) L.kioskPanel = null;
  if (L.photoStripT > 0) L.photoStripT--;
  // coins
  for (const c of L.coins) {
    c.t++;
    c.vy += 0.15;
    c.x += c.vx;
    c.y += c.vy;
    if (c.y >= c.fy) {
      c.y = c.fy;
      c.vy = Math.abs(c.vy) > 0.8 ? -c.vy * 0.55 : 0;
      c.vx *= 0.7;
    }
    if (c.x < 12 || c.x > WORLD_W - 12) c.vx = -c.vx;
    if (c.t > 12 && P.dying === 0 && Math.abs(c.x - P.x) < 9 && c.y > P.y - PH - 2 && c.y <= P.y + 2) {
      c.t = 9999;
      addScore(g, 50);
      popup(L, c.x, c.y - 12, c.gold ? '1UP' : '50');
      if (c.gold) { g.lives++; g.sfx.push('oneup'); }
      else g.sfx.push('coin');
    }
  }
  L.coins = L.coins.filter((c) => c.t < 420);
  for (const p of L.pickups) {
    p.t--;
    if (P.dying === 0 && Math.abs(p.x - P.x) < 10 && Math.abs(p.y - P.y) < 12) {
      p.t = 0;
      grantPower(g, L, p.kind);
    }
  }
  L.pickups = L.pickups.filter((p) => p.t > 0);
}

export function stepTimers(g: Game, L: Level): void {
  for (const p of L.popups) { p.t--; p.y -= 0.4; }
  L.popups = L.popups.filter((p) => p.t > 0);
  for (const b of L.bubbles) b.t--;
  L.bubbles = L.bubbles.filter((b) => b.t > 0);
  for (const f of L.fx) f.t--;
  L.fx = L.fx.filter((f) => f.t > 0);
  if (L.banner && --L.banner.t <= 0) L.banner = null;
  if (L.shake > 0) L.shake--;
  // alarm
  if (!L.alarm && L.t >= L.alarmAt) {
    L.alarm = true;
    banner(L, [TEXT.alarm1, TEXT.alarm2], 180);
    g.sfx.push('alarm');
  }
  // mall PA: about once a minute, never the same line twice in a row
  if (--L.paT <= 0) {
    L.paT = 3300 + g.rng.int(600);
    let k = g.rng.int(PA_LINES.length);
    if (k === L.lastPa) k = (k + 1) % PA_LINES.length;
    L.lastPa = k;
    if (L.mode === 'mall') {
      banner(L, wrap(PA_LINES[k], 28), 300);
      g.sfx.push('pa');
    }
  }
}

export function updateCamera(L: Level, snap = false): void {
  const P = L.player;
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, Math.round(P.x) - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, Math.round(P.y) - 136));
  L.camX = tx;
  if (snap) L.camY = ty;
  else if (P.onGround || P.esc || Math.abs(ty - L.camY) > 40) {
    const dy = ty - L.camY;
    L.camY += Math.abs(dy) <= 3 ? dy : 3 * sign(dy);
  }
}

/** One frame of mall play. */
export function stepMall(g: Game, L: Level, pad: PadFrame): void {
  stepCars(g, L, pad);
  stepPlayer(g, L, pad);
  if (g.screen !== 'play') return;
  stepSpies(g, L);
  stepSpawner(g, L);
  stepBullets(g, L);
  stepLamps(g, L);
  stepNpcs(g, L);
  stepTimers(g, L);
  updateCamera(L);
}
export { F_3 };
