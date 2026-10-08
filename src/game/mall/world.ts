import { Btn, hasBtn, type Pad } from '../../engine/pad';
import { Rng } from '../../engine/rng';
import {
  ARRIVAL,
  CAR_H,
  ESCALATORS,
  FLOOR_GAP,
  FLOOR_NAMES,
  LEVEL_H,
  LEVEL_W,
  NUM_FLOORS,
  SHAFTS,
  WAGON,
  WALL_L,
  WALL_R,
  floorY,
  type EscalatorDef,
} from '../../content/layout';
import { DOOR_W, DOOR_X, STORES, STORE_W, type StoreDef, type StoreId } from '../../content/stores';
import { FLOOR_BANNERS, PA_LINES, SPYGRAM_ARRIVAL, UI, packagesLeft, wrapWords, LIMITS, type SpygramPost } from '../../content/copy';
import { difficulty, ALARM_SPEED_BONUS, ALARM_SPAWN_BONUS, type Difficulty } from '../difficulty';
import { canEnterStore } from '../levelstate';
import { POINTS, type Run } from '../run';
import { makeBanner, tickPopups, type Banner, type Bubble, type Popup } from '../types';
import type { MusicId } from '../../audio/ids';
import { callCar, makeCars, stepCar } from './cars';
import {
  MAX_SAFE_FALL,
  OPENING_EDGE,
  carRoofY,
  floorAtY,
  nearestFloor,
  openingState,
  shaftAtX,
  shaftCeilingY,
  shaftNear,
} from './geometry';
import {
  PLAYER_BULLET_SPEED,
  PLAYER_DUCK_H,
  PLAYER_H,
  PLAYER_HALF_W,
  type Bullet,
  type Car,
  type DeathCause,
  type OpeningState,
  type Pickup,
  type PlayerState,
  type ShaftDef,
  type Spy,
} from './types';
import { bulletHitsSpy, spawnSpyAtCar, stepSpies } from './spies';
import type { MallExtras } from './modules';

export const GRAVITY = 0.25;
export const JUMP_HEIGHT = 20;
export const WALK_SPEED = 1;
/** Shaft "door window": feet y within this much above a served floor's surface may pass through the shaft wall. */
const WINDOW_UP = 30;
const DEATH_FRAMES = 70;
const AUTO_CALL_FRAMES = 30;
const BOARD_REACH = 8;
const CALL_REACH = 14;
const INVULN_RESPAWN = 120;
const CROUCH_FRAMES = 22;
const SELFIE_FRAMES = 150;
const FLASH_FRAMES = 10;
const ZIP_SPEED = 1.6;
const PA_FIRST = 2400;
const PA_EVERY = 3600;

/** Plug-in behaviour (NPCs, lights, kiosks...) so the core stays small and each piece testable. */
export interface MallModule {
  /** Runs once per frame after the player, cars and spies have moved. */
  step(w: MallWorld): void;
  /** The player pressed Up (-1) or Down (+1) while standing on a floor; return true if handled. */
  interact?(w: MallWorld, dir: -1 | 1): boolean;
  /** Called for every live bullet before it moves; return true to consume it (blocked / absorbed). */
  onBullet?(w: MallWorld, b: Bullet): boolean;
  /** The world respawned the player: clear temporary effects (frozen, darkness...). */
  onRespawn?(w: MallWorld): void;
}

export interface IntroState {
  phase: 'zip' | 'drop' | 'crouch' | 'selfie';
  t: number;
  /** The SPYGRAM post shown during the selfie. */
  post: SpygramPost;
  /** Length of the zip-line path (px) for animation. */
  zipT: number;
}

export interface MallOptions {
  /** Skip the zip-line arrival and start in control on the roof (tests, debugging). */
  skipIntro?: boolean;
  /** Start position override (needs skipIntro). */
  startX?: number;
  startFloor?: number;
}

export type Outcome = null | 'continue' | 'gameover';

const dist = (a: number, b: number): number => Math.abs(a - b);

export class MallWorld {
  readonly run: Run;
  readonly rng: Rng;
  readonly spyRng: Rng;
  readonly modules: MallModule[] = [];
  /** Typed state of the installed extras (NPCs, lights, furniture) for the renderer; set by installExtras. */
  extras: MallExtras | null = null;
  diff: Difficulty;

  frame = 0;
  /** Frame at which the agent got control (spy clocks start here). */
  controlFrame = 0;
  player: PlayerState;
  cars: Car[] = makeCars();
  spies: Spy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  popups: Popup[] = [];
  bubbles: Bubble[] = [];
  banner: Banner | null = null;
  intro: IntroState | null = null;
  cam = { x: 0, y: 0 };
  shake = 0;
  /** Set when the agent opens a store door; the Game consumes it (fade into the room) and clears it. */
  enterStore: StoreId | null = null;
  /** Set exactly once when the agent drives away with all packages; the Game consumes it. */
  exitTriggered = false;
  private exitFired = false;
  outcome: Outcome = null;
  /** Frame counters for scheduled events. */
  nextSpy: number;
  nextPa = PA_FIRST;
  lastPa = -1;
  alarmShown = false;
  nextSpyId = 1;
  /** Frames the directory-style hum plays, etc. */
  humT = 0;
  /** True when the agent is on a floor next to a car that is exactly level (for tests/HUD). */
  lastFloorBanner = -1;

  constructor(run: Run, rng: Rng, opts: MallOptions = {}) {
    this.run = run;
    this.rng = rng;
    this.spyRng = rng.fork('spies');
    this.diff = difficulty(run.loop, run.blackFriday);
    const startFloor = opts.startFloor ?? 0;
    const startX = opts.startX ?? ARRIVAL.letGoX;
    this.player = newPlayer(startX, floorY(startFloor), startFloor);
    this.nextSpy = 300;
    if (opts.skipIntro) {
      this.controlFrame = 0;
    } else {
      this.intro = {
        phase: 'zip',
        t: 0,
        post: this.rng.fork('selfie').pick(SPYGRAM_ARRIVAL),
        zipT: 0,
      };
      this.player.x = ARRIVAL.cableStartX;
      this.player.y = ARRIVAL.cableStartY + 24;
      this.player.mode = 'air';
      this.player.floor = null;
      run.sfx('zip');
    }
    this.snapCamera();
  }

  // ------------------------------------------------------------------ queries
  car(id: string): Car {
    const c = this.cars.find((k) => k.id === id);
    if (!c) throw new Error(`no car ${id}`);
    return c;
  }

  /** The agent can be targeted by spies / hurt. */
  playerAlive(): boolean {
    const m = this.player.mode;
    return m !== 'dying' && m !== 'dead';
  }

  /** Spies ignore a player who is hidden, dying, arriving or posing for the selfie. */
  playerVisible(): boolean {
    const m = this.player.mode;
    return m !== 'hidden' && m !== 'dying' && m !== 'dead' && !this.intro;
  }

  /** Floor index the agent is on, or the nearest floor when riding / falling (null while arriving). */
  playerFloor(): number {
    const p = this.player;
    if (p.floor !== null) return p.floor;
    return nearestFloor(p.y);
  }

  hitboxTop(p = this.player): number {
    return p.y - (p.ducking ? PLAYER_DUCK_H : PLAYER_H);
  }

  /** What the HUD's LED panel should show: the floor index the agent is nearest. */
  hudFloor(): number {
    return this.playerFloor();
  }

  music(): MusicId {
    if (this.run.alarmOn) return 'alarm';
    if (this.player.mode === 'ride') return 'elevator';
    return 'mall';
  }

  // ------------------------------------------------------------------ helpers for modules
  say(x: number, y: number, text: string, frames = 110): void {
    this.bubbles.push({ text, x, y, t: frames });
  }

  popup(x: number, y: number, text: string, color?: number): void {
    this.popups.push({ x, y, text, t: 50, color });
  }

  showBanner(text: string, frames = 120, lines?: string[], color?: number): void {
    this.banner = makeBanner(text, frames, lines, color);
  }

  addShake(n: number): void {
    this.shake = Math.max(this.shake, n);
  }

  /** Kill (or score) a spy. `by` decides the points; returns false if already dying. */
  killSpy(spy: Spy, by: NonNullable<Spy['killedBy']>): boolean {
    if (spy.mode === 'dying') return false;
    spy.mode = 'dying';
    spy.killedBy = by;
    spy.deathT = 0;
    const pts = by === 'crush' || by === 'lamp' || by === 'disco' || by === 'slide' ? POINTS.spyCrushed : POINTS.spyShot;
    this.run.addScore(pts);
    this.popup(spy.x, spy.y - 26, String(pts));
    this.run.sfx(by === 'crush' ? 'crush' : 'death');
    if (by === 'crush') this.addShake(8);
    return true;
  }

  /**
   * The agent is hit. `armourable` hits (bullets, touching a spy) can be absorbed by armour; crushes, falls and
   * falling lamps always kill. Returns true if the agent died.
   */
  hurtPlayer(cause: DeathCause, armourable: boolean): boolean {
    const p = this.player;
    if (!this.playerAlive()) return false;
    const hard = cause === 'crush' || cause === 'roofcrush' || cause === 'fall';
    if (!hard && (p.invuln > 0 || this.run.invincible)) return false;
    if (hard && p.invuln > 0 && cause !== 'fall') return false;
    if (armourable && this.run.absorbHit()) {
      p.invuln = 60;
      this.popup(p.x, p.y - 28, 'ARMOR!', 0x2c);
      this.run.sfx('hurt');
      return false;
    }
    p.mode = 'dying';
    p.deathT = 0;
    p.cause = cause;
    p.vx = 0;
    p.vy = 0;
    p.kick = false;
    p.ducking = false;
    p.slide = 0;
    p.frozen = 0;
    this.run.sfx('death');
    if (cause === 'crush' || cause === 'roofcrush' || cause === 'lamp') this.addShake(10);
    return true;
  }

  /** Put the agent inside the photo booth (module API). */
  hidePlayer(frames: number): void {
    const p = this.player;
    p.mode = 'hidden';
    p.hideT = frames;
    p.vx = 0;
    p.ducking = false;
  }

  unhidePlayer(): void {
    const p = this.player;
    if (p.mode === 'hidden') {
      p.mode = 'ground';
      p.hideT = 0;
    }
  }

  spawnPickup(p: Pickup): void {
    this.pickups.push(p);
  }

  // ------------------------------------------------------------------ main step
  step(pad: Pad): void {
    this.frame++;
    const p = this.player;

    // timers
    if (p.invuln > 0) p.invuln--;
    if (p.frozen > 0) p.frozen--;
    if (p.shootCd > 0) p.shootCd--;
    if (p.shootPose > 0) p.shootPose--;
    if (this.shake > 0) this.shake--;
    tickPopups(this.popups);
    for (let i = this.bubbles.length - 1; i >= 0; i--) if (--this.bubbles[i]!.t <= 0) this.bubbles.splice(i, 1);
    if (this.banner && --this.banner.t <= 0) this.banner = null;

    this.checkAlarm();

    if (this.intro) {
      this.stepIntro(pad);
      this.stepCarsAndCrush(pad, true);
      this.updateCamera();
      return;
    }

    this.run.tickPowers();
    this.stepPlayer(pad);
    this.stepCarsAndCrush(pad, false);
    this.stepBullets();
    bulletHitsSpy(this);
    stepSpies(this);
    for (const m of this.modules) m.step(this);
    this.stepPickups();
    this.stepPa();
    this.recordSafeSpot();
    this.updateCamera();
    if (p.mode === 'dying') this.stepDeath();
  }

  // ------------------------------------------------------------------ arrival
  private stepIntro(pad: Pad): void {
    const intro = this.intro!;
    const p = this.player;
    intro.t++;
    switch (intro.phase) {
      case 'zip': {
        // Slide down the cable from the skyscraper to just before the anchor post.
        const sx = ARRIVAL.cableStartX;
        const sy = ARRIVAL.cableStartY;
        const ex = ARRIVAL.letGoX;
        const ey = sy + ((ARRIVAL.postTopY - sy) * (ex - sx)) / (ARRIVAL.postX - sx);
        const len = Math.hypot(ex - sx, ey - sy);
        intro.zipT += ZIP_SPEED;
        const f = Math.min(1, intro.zipT / len);
        p.x = sx + (ex - sx) * f;
        p.y = sy + (ey - sy) * f + 24;
        p.face = 1;
        if (f >= 1) {
          intro.phase = 'drop';
          intro.t = 0;
          p.vy = 0;
          p.peakY = p.y;
        }
        break;
      }
      case 'drop': {
        p.vy += GRAVITY * 2;
        p.y += p.vy;
        if (p.y >= floorY(0)) {
          p.y = floorY(0);
          p.vy = 0;
          p.floor = 0;
          p.mode = 'ground';
          intro.phase = 'crouch';
          intro.t = 0;
          this.run.sfx('thud');
          this.addShake(6);
        }
        break;
      }
      case 'crouch':
        if (intro.t >= CROUCH_FRAMES) {
          intro.phase = 'selfie';
          intro.t = 0;
          this.run.sfx('camera');
        }
        break;
      case 'selfie':
        if (intro.t >= SELFIE_FRAMES || (pad.pressed & ~0) !== 0) {
          this.intro = null;
          this.controlFrame = this.frame;
          this.run.sfx('select');
          this.showBanner(UI.mission, 220);
          p.safe = { x: p.x, floor: 0 };
        }
        break;
    }
  }

  // ------------------------------------------------------------------ alarm / PA
  private checkAlarm(): void {
    if (!this.run.alarmOn && this.run.levelFrames >= this.diff.alarmFrames) {
      this.run.alarmOn = true;
      this.showBanner(UI.alarmBanner, 180, undefined, 0x16);
      this.run.sfx('alarmOn');
    }
  }

  spySpeed(): number {
    return this.diff.spySpeed * (this.run.alarmOn ? ALARM_SPEED_BONUS : 1);
  }

  spawnRate(): number {
    return this.diff.spawnRate * (this.run.alarmOn ? ALARM_SPAWN_BONUS : 1);
  }

  private stepPa(): void {
    if (this.frame < this.nextPa) return;
    let i = this.rng.int(PA_LINES.length);
    if (i === this.lastPa) i = (i + 1) % PA_LINES.length;
    this.lastPa = i;
    const lines = wrapWords(PA_LINES[i]!, LIMITS.paLine);
    this.showBanner(lines[0]!, 240, lines.slice(1));
    this.run.sfx('paChime');
    this.nextPa = this.frame + PA_EVERY + this.rng.between(-600, 600);
  }

  // ------------------------------------------------------------------ player
  private shaftDefAt(id: string | null): ShaftDef | undefined {
    return SHAFTS.find((s) => s.id === id);
  }

  /** Is `y` (feet) inside the "door window" of a floor served by this shaft? */
  private inWindow(s: ShaftDef, y: number): boolean {
    for (let f = s.top; f <= s.bottom; f++) {
      const fy = floorY(f);
      if (y >= fy - WINDOW_UP && y <= fy + 1) return true;
    }
    return false;
  }

  private interiorOf(s: ShaftDef): [number, number] {
    return [s.x + OPENING_EDGE, s.x + s.w - OPENING_EDGE];
  }

  /**
   * Horizontal movement honouring walls and shaft walls: you may only cross a shaft wall at a floor's door window
   * (feet at/above that floor's surface), and never into a doorway a moving car is blocking.
   */
  tryMoveX(x: number, y: number, dx: number, forSpy = false, allowGrate = false): number {
    if (dx === 0) return x;
    let nx = x + dx;
    nx = Math.max(WALL_L + 4, Math.min(WALL_R - 4, nx));
    for (const s of SHAFTS) {
      const [lo, hi] = this.interiorOf(s);
      const was = x > lo && x < hi;
      const will = nx > lo && nx < hi;
      if (was === will) {
        if (was && !this.inWindow(s, y)) return x; // inside the shaft: can't leave through walls
        continue;
      }
      // crossing the boundary of the shaft interior
      if (!this.inWindow(s, y)) return x;
      if (will) {
        // entering: find the floor whose window we are in
        for (let f = s.top; f <= s.bottom; f++) {
          const fy = floorY(f);
          if (y >= fy - WINDOW_UP && y <= fy + 1) {
            const st = openingState(this.car(s.id), f);
            if (st === 'blocked') return x;
            if (forSpy && (st === 'pit' || (st === 'above' && !allowGrate))) return x;
          }
        }
      }
    }
    return nx;
  }

  private supportCheckGround(): void {
    const p = this.player;
    if (p.roof) return;
    if (p.floor === null) return;
    const s = shaftAtX(p.x, p.floor);
    if (s) {
      const st = openingState(this.car(s.id), p.floor);
      if (st === 'pit') this.startFall();
    }
  }

  private startFall(): void {
    const p = this.player;
    p.mode = 'air';
    p.floor = null;
    p.roof = null;
    p.peakY = Math.min(p.peakY, p.y);
    p.kick = false;
    p.vy = 0;
  }

  /** A surface the agent can land on while falling from yFrom to yTo (feet), or null. */
  private landingSurface(x: number, yFrom: number, yTo: number): { y: number; floor: number | null; roof: Car | null } | null {
    let best: { y: number; floor: number | null; roof: Car | null } | null = null;
    for (let f = 0; f < NUM_FLOORS; f++) {
      const fy = floorY(f);
      if (fy < yFrom - 0.01 || fy > yTo + 0.01) continue;
      const s = shaftAtX(x, f);
      if (s) {
        const st = openingState(this.car(s.id), f);
        if (st === 'pit' || st === 'blocked') continue;
      }
      if (!best || fy < best.y) best = { y: fy, floor: f, roof: null };
    }
    for (const car of this.cars) {
      if (x <= car.def.x + 2 || x >= car.def.x + car.def.w - 2) continue;
      const roofNow = carRoofY(car);
      const roofPrev = car.prevY - CAR_H;
      if (roofPrev >= yFrom - 0.5 && roofNow <= yTo + 0.5) {
        const ry = Math.max(roofNow, yFrom - 3);
        if (!best || ry < best.y) best = { y: ry, floor: null, roof: car };
      }
    }
    return best;
  }

  private stepPlayer(pad: Pad): void {
    const p = this.player;
    const run = this.run;
    p.anim++;
    if (p.mode !== 'air') p.landedKick = false;

    switch (p.mode) {
      case 'dying':
      case 'dead':
        return;
      case 'hidden':
        // The booth module owns the unhide logic; the core only counts down.
        if (--p.hideT <= 0) p.mode = 'ground';
        return;
      case 'escalator':
        this.stepEscalator();
        this.tryShoot(pad);
        return;
      case 'ride':
        this.stepRide(pad);
        this.tryShoot(pad);
        return;
    }

    if (p.frozen > 0) {
      // frozen by the mall cop: gravity still applies
      if (p.mode === 'air') this.stepAir();
      p.vx = 0;
      return;
    }

    if (p.mode === 'ground') {
      this.stepGround(pad);
    } else if (p.mode === 'air') {
      this.stepAir();
      this.tryShoot(pad);
    }
  }

  private stepGround(pad: Pad): void {
    const p = this.player;
    const run = this.run;
    const speed = WALK_SPEED * run.walkFactor();

    // --- interactions (Up / Down edges)
    if (pad.pressed & (Btn.UP | Btn.DOWN)) {
      const dir: -1 | 1 = pad.pressed & Btn.UP ? -1 : 1;
      if (this.tryInteract(dir)) return;
    }
    // Held Up/Down while standing in a level opening also boards (forgiving).
    if (pad.held & (Btn.UP | Btn.DOWN) && !hasBtn(pad.held, Btn.LEFT | Btn.RIGHT) && p.floor !== null) {
      if (this.tryBoardHeld()) return;
    }

    let dx = 0;
    if (p.slide !== 0) {
      dx = p.slide * speed;
      p.face = p.slide;
      p.ducking = false;
    } else {
      p.ducking = hasBtn(pad.held, Btn.DOWN) && !hasBtn(pad.held, Btn.LEFT | Btn.RIGHT) && !hasBtn(pad.held, Btn.UP);
      if (!p.ducking) {
        const l = hasBtn(pad.held, Btn.LEFT);
        const r = hasBtn(pad.held, Btn.RIGHT);
        if (l && !r) {
          dx = -speed;
          p.face = -1;
        } else if (r && !l) {
          dx = speed;
          p.face = 1;
        }
      }
    }
    p.vx = dx;

    // --- jump
    if (pad.pressed & Btn.B && !p.ducking) {
      const h = JUMP_HEIGHT * run.jumpFactor();
      p.vy = -Math.sqrt(2 * GRAVITY * h);
      p.mode = 'air';
      p.kick = dx !== 0 || p.slide !== 0;
      p.peakY = p.y;
      p.floor = null;
      p.roof = null;
      run.sfx('jump');
      p.idle = 0;
      this.tryShoot(pad);
      return;
    }

    const before = p.x;
    p.x = this.tryMoveX(p.x, p.y, dx);
    if (p.slide !== 0 && p.x === before) p.slide = 0; // hit a wall

    if (p.roof) {
      const car = this.car(p.roof);
      p.y = carRoofY(car);
    } else {
      this.supportCheckGround();
    }

    // --- auto-call: standing still in / beside an opening
    if (dx === 0 && !p.ducking && p.floor !== null) {
      const near = shaftNear(p.x, p.floor, CALL_REACH);
      if (near) {
        p.idle++;
        if (p.idle === AUTO_CALL_FRAMES) this.callFromHere(near);
      } else p.idle = 0;
    } else p.idle = 0;

    this.tryShoot(pad);
  }

  private stepAir(): void {
    const p = this.player;
    const prevY = p.y;
    p.vy += GRAVITY;
    let ny = p.y + p.vy;
    // horizontal carry
    let dx = p.vx;
    if (p.slide !== 0) dx = p.slide * WALK_SPEED * this.run.walkFactor();
    const nx = this.tryMoveX(p.x, prevY, dx);
    p.x = nx;
    if (p.vy > 0) {
      const hit = this.landingSurface(p.x, prevY, ny);
      if (hit) {
        ny = hit.y;
        this.land(hit, ny);
        return;
      }
    }
    p.y = ny;
    p.peakY = Math.min(p.peakY, p.y);
    // fell past the bottom of the world (should not happen)
    if (p.y > LEVEL_H + 40) this.hurtPlayer('fall', false);
  }

  private land(hit: { y: number; floor: number | null; roof: Car | null }, y: number): void {
    const p = this.player;
    p.y = y;
    const fall = y - p.peakY;
    p.vy = 0;
    p.landedKick = p.kick;
    p.mode = 'ground';
    p.floor = hit.floor;
    p.roof = hit.roof ? hit.roof.id : null;
    if (fall > MAX_SAFE_FALL) {
      this.hurtPlayer('fall', false);
      this.run.sfx('thud');
      this.addShake(6);
      return;
    }
    if (fall > 14) this.run.sfx('land');
    // a kick that lands on a wet patch keeps kicking while sliding (the janitor module decides); otherwise it ends
    if (p.slide === 0) p.kick = false;
    p.peakY = y;
  }

  // ------------------------------------------------------------------ shooting
  private tryShoot(pad: Pad): void {
    const p = this.player;
    const run = this.run;
    if (!hasBtn(pad.held, Btn.A) || p.shootCd > 0 || p.frozen > 0 || p.mode === 'hidden') return;
    const prof = run.fireProfile();
    let n = 0;
    for (const b of this.bullets) if (b.owner === 'player') n++;
    const toFire = prof.spread ? 3 : 1;
    if (n + toFire > prof.maxBullets) return;
    const y = p.y - (p.ducking ? 8 : 16);
    const x = p.x + p.face * 9;
    const spreads = prof.spread ? [-0.6, 0, 0.6] : [0];
    for (const vy of spreads) {
      this.bullets.push({ x, y, vx: p.face * PLAYER_BULLET_SPEED, vy, owner: 'player', age: 0 });
    }
    p.shootCd = prof.cooldown;
    p.shootPose = 8;
    run.sfx('shot');
  }

  private stepBullets(): void {
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      let consumed = false;
      for (const m of this.modules) if (m.onBullet && m.onBullet(this, b)) consumed = true;
      if (consumed) {
        this.bullets.splice(i, 1);
        continue;
      }
      b.x += b.vx;
      b.y += b.vy;
      b.age++;
      if (b.x < 0 || b.x > LEVEL_W || b.age > 200) {
        this.bullets.splice(i, 1);
        continue;
      }
      // a moving car that blocks a doorway stops bullets
      let blocked = false;
      const fl = nearestFloor(b.y + 12);
      for (const s of SHAFTS) {
        if (fl < s.top || fl > s.bottom) continue;
        if (b.x > s.x && b.x < s.x + s.w && openingState(this.car(s.id), fl) === 'blocked') blocked = true;
      }
      if (blocked) {
        this.bullets.splice(i, 1);
        continue;
      }
      if (b.owner === 'spy' && this.playerAlive() && this.playerVisible()) {
        const top = this.hitboxTop();
        if (b.x > p.x - PLAYER_HALF_W && b.x < p.x + PLAYER_HALF_W && b.y >= top && b.y <= p.y) {
          this.bullets.splice(i, 1);
          this.hurtPlayer('shot', true);
        }
      }
    }
  }

  // ------------------------------------------------------------------ cars
  private carOccupied(car: Car): boolean {
    const p = this.player;
    const level = floorAtY(car.y);
    if (level === null) return false;
    const inside = (x: number, y: number) => x > car.def.x && x < car.def.x + car.def.w && Math.abs(y - car.y) < 1;
    if (p.mode === 'ground' && p.roof === null && inside(p.x, p.y)) return true;
    if (p.mode === 'ride' && p.car === car.id) return true;
    for (const s of this.spies) if (s.mode !== 'dying' && inside(s.x, s.y)) return true;
    return false;
  }

  private driveInput(car: Car, pad: Pad): -1 | 0 | 1 | null {
    const p = this.player;
    const riding = p.mode === 'ride' && p.car === car.id;
    const roofing = p.mode === 'ground' && p.roof === car.id && car.def.manual;
    if (!riding && !roofing) return null;
    if (p.frozen > 0) return 0;
    const up = hasBtn(pad.held, Btn.UP);
    const dn = hasBtn(pad.held, Btn.DOWN);
    return up && !dn ? -1 : dn && !up ? 1 : 0;
  }

  private stepCarsAndCrush(pad: Pad, introActive: boolean): void {
    const p = this.player;
    for (const car of this.cars) {
      const drive = introActive ? null : this.driveInput(car, pad);
      const res = stepCar(car, drive, this.carOccupied(car), this.rng);
      if (res.stopped && res.floor !== null) this.onCarStopped(car, res.floor);
      // rider moves with the car
      if (p.mode === 'ride' && p.car === car.id) {
        p.y = car.y;
        p.floor = null;
        if (car.dir !== 0 && this.frame % 24 === 0) this.run.sfx('hum');
      }
      if (p.mode === 'ground' && p.roof === car.id) {
        p.y = carRoofY(car);
        // crushed against the ceiling at the top of the shaft
        const head = p.y - (p.ducking ? PLAYER_DUCK_H : PLAYER_H);
        if (head < shaftCeilingY(car.def)) this.hurtPlayer('roofcrush', false);
      }
    }
    if (introActive) return;
    this.crushCheck();
  }

  private onCarStopped(car: Car, floor: number): void {
    const p = this.player;
    const cx = car.def.x + car.def.w / 2;
    const nearPlayer = dist(cx, p.x) < 220 && Math.abs(floor - this.playerFloor()) <= 2;
    if (nearPlayer || (p.mode === 'ride' && p.car === car.id)) this.run.sfx('ding');
    if (p.mode === 'ride' && p.car === car.id && floor !== this.lastFloorBanner) {
      this.showBanner(FLOOR_BANNERS[floor] ?? FLOOR_NAMES[floor]!, 150);
    }
    this.lastFloorBanner = p.mode === 'ride' && p.car === car.id ? floor : -1;
    spawnSpyAtCar(this, car, floor);
  }

  /** A car coming down onto anyone standing on its grate crushes them (unless called for the agent). */
  private crushCheck(): void {
    const p = this.player;
    for (const car of this.cars) {
      for (let f = car.def.top; f <= car.def.bottom; f++) {
        const fy = floorY(f);
        const d = car.y - fy;
        if (d >= 0) continue; // only a car above is a threat
        // agent standing on the grate of floor f
        if (this.playerAlive() && p.mode === 'ground' && p.floor === f && !p.roof) {
          const s = shaftAtX(p.x, f);
          if (s && s.id === car.id) {
            const top = this.hitboxTop();
            const protectedByCall = car.protectFloor === f;
            if (car.y > top && !protectedByCall) this.hurtPlayer('crush', false);
          }
        }
        for (const sp of this.spies) {
          if (sp.mode === 'dying') continue;
          if (sp.floor !== f || Math.abs(sp.y - fy) > 0.5) continue;
          if (sp.x > car.def.x + OPENING_EDGE && sp.x < car.def.x + car.def.w - OPENING_EDGE) {
            if (car.y > sp.y - 24 + 2) this.killSpy(sp, 'crush');
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ riding
  private stepRide(pad: Pad): void {
    const p = this.player;
    const car = this.car(p.car!);
    p.floor = null;
    p.vx = 0;
    p.ducking = false;
    p.anim++;
    // get out: Left / Right while stopped level with a floor
    const lvl = floorAtY(car.y);
    if (car.dir === 0 && lvl !== null && (pad.held & (Btn.LEFT | Btn.RIGHT)) && !(pad.held & (Btn.UP | Btn.DOWN))) {
      p.mode = 'ground';
      p.car = null;
      p.floor = lvl;
      p.y = floorY(lvl);
      p.face = pad.held & Btn.LEFT ? -1 : 1;
      p.x = car.def.x + car.def.w / 2;
      p.idle = 0;
      return;
    }
  }

  private board(car: Car, floor: number): void {
    const p = this.player;
    p.mode = 'ride';
    p.car = car.id;
    p.floor = null;
    p.roof = null;
    p.x = car.def.x + car.def.w / 2;
    p.y = car.y;
    p.vx = 0;
    p.idle = 0;
    p.ducking = false;
    car.protectFloor = null;
    this.lastFloorBanner = floor;
  }

  /** Up/Down while standing at / beside a shaft opening: board a level car or call one. Returns true if handled. */
  private tryElevator(): boolean {
    const p = this.player;
    if (p.floor === null) return false;
    const f = p.floor;
    const s = shaftNear(p.x, f, CALL_REACH);
    if (!s) return false;
    const car = this.car(s.id);
    const st = openingState(car, f);
    if (st === 'here' && dist(p.x, s.x + s.w / 2) <= s.w / 2 + BOARD_REACH) {
      this.board(car, f);
      return true;
    }
    this.callFromHere(s);
    return true;
  }

  private tryBoardHeld(): boolean {
    const p = this.player;
    if (p.floor === null) return false;
    const s = shaftNear(p.x, p.floor, 0);
    if (!s) return false;
    const car = this.car(s.id);
    if (openingState(car, p.floor) === 'here' && p.idle >= 4) {
      this.board(car, p.floor);
      return true;
    }
    return false;
  }

  private callFromHere(s: ShaftDef): void {
    const p = this.player;
    if (p.floor === null) return;
    const car = this.car(s.id);
    if (p.mode === 'ride') return;
    if (openingState(car, p.floor) === 'here') return;
    // do not yank a car away from someone else riding it
    if (car.goal === floorY(p.floor)) return;
    callCar(car, p.floor, true);
  }

  // ------------------------------------------------------------------ interactions
  private tryInteract(dir: -1 | 1): boolean {
    const p = this.player;
    if (p.floor === null || p.roof || p.frozen > 0) return false;
    const f = p.floor;

    // 1. store door
    for (const st of STORES) {
      if (st.floor !== f) continue;
      const cx = st.x + DOOR_X + DOOR_W / 2;
      if (dist(p.x, cx) <= DOOR_W / 2 + 4) {
        if (canEnterStore(this.run.level, st.id)) {
          this.enterStore = st.id;
          this.run.sfx('door');
          return true;
        }
        return false;
      }
    }
    // 2. elevator
    if (this.tryElevator()) return true;
    // 3. escalator landings
    for (const e of ESCALATORS) {
      if (dir < 0 && f === e.lower && dist(p.x, e.xLow) <= 10) return this.boardEscalator(e, -1);
      if (dir > 0 && f === e.upper && dist(p.x, e.xHigh) <= 10) return this.boardEscalator(e, 1);
    }
    // 4. getaway car
    if (dir < 0 && f === NUM_FLOORS - 1 && p.x > WAGON.x - 6 && p.x < WAGON.x + WAGON.w + 6) {
      this.tryExit();
      return true;
    }
    // 5. modules (kiosk, photo booth ...)
    for (const m of this.modules) if (m.interact && m.interact(this, dir)) return true;
    return false;
  }

  private tryExit(): void {
    if (this.run.allPackages) {
      if (!this.exitFired) {
        this.exitFired = true;
        this.exitTriggered = true;
        this.run.sfx('door');
      }
    } else {
      this.showBanner(packagesLeft(6 - this.run.packages), 100);
      this.run.sfx('buzzer');
    }
  }

  // ------------------------------------------------------------------ escalators
  private boardEscalator(def: EscalatorDef, dir: 1 | -1): boolean {
    const p = this.player;
    // dir -1 = going UP (from the lower floor); dir 1 = going DOWN (from the upper floor)
    p.mode = 'escalator';
    p.escalator = { def, dir, t: 0 };
    p.floor = null;
    p.ducking = false;
    p.vx = 0;
    p.idle = 0;
    this.run.sfx('escalator');
    return true;
  }

  private stepEscalator(): void {
    const p = this.player;
    const e = p.escalator!;
    e.t++;
    const total = FLOOR_GAP;
    const t = Math.min(e.t, total);
    const goingUp = e.dir < 0;
    const x0 = goingUp ? e.def.xLow : e.def.xHigh;
    const x1 = goingUp ? e.def.xHigh : e.def.xLow;
    const y0 = floorY(goingUp ? e.def.lower : e.def.upper);
    const y1 = floorY(goingUp ? e.def.upper : e.def.lower);
    p.x = x0 + ((x1 - x0) * t) / total;
    p.y = y0 + ((y1 - y0) * t) / total;
    p.face = x1 > x0 ? 1 : -1;
    if (e.t >= total) {
      p.mode = 'ground';
      p.escalator = null;
      p.floor = goingUp ? e.def.upper : e.def.lower;
      p.y = y1;
      p.x = x1;
      p.peakY = p.y;
    }
  }

  // ------------------------------------------------------------------ pickups
  private stepPickups(): void {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]!;
      if (!k.onGround) {
        k.vy += GRAVITY;
        k.y += k.vy;
        k.x += k.vx;
        const f = nearestFloor(k.y);
        const fy = floorY(f);
        if (k.vy > 0 && k.y >= fy && k.y - k.vy <= fy + 1) {
          const s = shaftAtX(k.x, f);
          const pit = s ? openingState(this.car(s.id), f) === 'pit' : false;
          if (!pit) {
            k.y = fy;
            if (k.kind !== 'power' && Math.abs(k.vy) > 1.2) {
              k.vy = -k.vy * 0.5;
              this.run.sfx('bounce');
            } else {
              k.vy = 0;
              k.vx = 0;
              k.onGround = true;
            }
          }
        }
        if (k.y > LEVEL_H) {
          this.pickups.splice(i, 1);
          continue;
        }
      }
      if (--k.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (this.playerAlive() && p.mode !== 'hidden' && Math.abs(k.x - p.x) < 10 && k.y > p.y - 26 && k.y < p.y + 8) {
        this.pickups.splice(i, 1);
        if (k.kind === 'power' && k.power) {
          const name = this.run.givePower(k.power);
          this.run.addScore(POINTS.powerup);
          this.showBanner(name, 90);
          this.run.sfx('powerup');
        } else if (k.kind === 'goldcoin') {
          this.run.addLife();
          this.popup(k.x, k.y - 12, '1UP', 0x28);
        } else {
          this.run.addScore(POINTS.coin);
          this.popup(k.x, k.y - 12, '50');
          this.run.sfx('coin');
        }
      }
    }
  }

  // ------------------------------------------------------------------ safe spot / death
  private recordSafeSpot(): void {
    const p = this.player;
    if (p.mode !== 'ground' || p.floor === null || p.roof || p.slide !== 0) return;
    if (shaftNear(p.x, p.floor, 16)) return;
    // not right under a spy's nose either: only record when no living spy is within 40 px on this floor
    for (const s of this.spies) if (s.mode !== 'dying' && s.floor === p.floor && dist(s.x, p.x) < 40) return;
    p.safe = { x: p.x, floor: p.floor };
  }

  private stepDeath(): void {
    const p = this.player;
    p.deathT++;
    if (p.deathT < DEATH_FRAMES) return;
    p.mode = 'dead';
    const next = this.run.loseLife();
    if (next === 'respawn') this.respawn();
    else this.outcome = next;
  }

  /** Respawn at the last safe spot: spies and bullets cleared, blinking invulnerability. */
  respawn(): void {
    const p = this.player;
    p.mode = 'ground';
    p.x = p.safe.x;
    p.floor = p.safe.floor;
    p.y = floorY(p.safe.floor);
    p.vx = 0;
    p.vy = 0;
    p.roof = null;
    p.car = null;
    p.escalator = null;
    p.ducking = false;
    p.kick = false;
    p.frozen = 0;
    p.slide = 0;
    p.cause = null;
    p.deathT = 0;
    p.invuln = INVULN_RESPAWN;
    p.peakY = p.y;
    this.spies.length = 0;
    this.bullets.length = 0;
    this.bubbles.length = 0;
    this.outcome = null;
    this.nextSpy = this.frame + 180;
    for (const m of this.modules) m.onRespawn?.(this);
    this.snapCamera();
  }

  /** After CONTINUE: 3 fresh lives were granted by Run; put the agent back where he fell. */
  resume(): void {
    this.respawn();
  }

  // ------------------------------------------------------------------ camera
  private targetCam(): { x: number; y: number } {
    const p = this.player;
    const tx = Math.max(0, Math.min(LEVEL_W - 256, p.x - 128));
    const ty = Math.max(0, Math.min(LEVEL_H - 224, p.y - 150));
    return { x: tx, y: ty };
  }

  snapCamera(): void {
    const t = this.targetCam();
    this.cam.x = t.x;
    this.cam.y = t.y;
  }

  private updateCamera(): void {
    const t = this.targetCam();
    this.cam.x += (t.x - this.cam.x) * 0.25;
    this.cam.y += (t.y - this.cam.y) * 0.18;
    if (Math.abs(t.x - this.cam.x) < 0.5) this.cam.x = t.x;
    if (Math.abs(t.y - this.cam.y) < 0.5) this.cam.y = t.y;
  }

  // ------------------------------------------------------------------ store helpers for the Game
  /** Where the agent re-appears after leaving a store (at its door, facing out). */
  returnFromStore(id: StoreId): void {
    const def = STORES.find((s) => s.id === id)!;
    const p = this.player;
    p.mode = 'ground';
    p.floor = def.floor;
    p.y = floorY(def.floor);
    p.x = def.x + DOOR_X + DOOR_W / 2;
    p.vx = 0;
    p.vy = 0;
    p.roof = null;
    p.car = null;
    p.ducking = false;
    p.kick = false;
    p.peakY = p.y;
    p.safe = { x: p.x, floor: def.floor };
    p.invuln = Math.max(p.invuln, 60);
    this.enterStore = null;
    this.snapCamera();
  }

  storeAtDoor(): StoreDef | null {
    const p = this.player;
    if (p.floor === null) return null;
    for (const st of STORES) {
      if (st.floor !== p.floor) continue;
      if (p.x >= st.x && p.x <= st.x + STORE_W) return st;
    }
    return null;
  }

  /** Alive spy count (HUD/tests). */
  liveSpies(): number {
    let n = 0;
    for (const s of this.spies) if (s.mode !== 'dying') n++;
    return n;
  }
}

export function newPlayer(x: number, y: number, floor: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    face: 1,
    mode: 'ground',
    ducking: false,
    kick: false,
    floor,
    roof: null,
    car: null,
    peakY: y,
    escalator: null,
    invuln: 0,
    frozen: 0,
    shootCd: 0,
    idle: 0,
    hideT: 0,
    deathT: 0,
    cause: null,
    safe: { x, floor },
    anim: 0,
    slide: 0,
    landedKick: false,
    shootPose: 0,
  };
}

export type { OpeningState };
