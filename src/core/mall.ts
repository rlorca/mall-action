import { Rng, hashSeed } from './rng';
import { PadFrame } from './pad';
import { RunState, award, addLife, collectPower } from './run';
import { Difficulty, difficultyFor } from './difficulty';
import {
  ARRIVAL_X,
  ESCALATORS,
  FLOOR_1F,
  FLOOR_2F,
  FLOOR_4F,
  FLOOR_P,
  FLOOR_R,
  FLOOR_COUNT,
  FURNITURE,
  GETAWAY,
  JANITOR_RANGE,
  LAMPS,
  MALL_H,
  MALL_W,
  SHAFTS,
  STOREFRONTS,
  STORE_W,
  VIEW_H,
  SCREEN_W,
  WALKER_RANGE,
  WALK_MAX,
  WALK_MIN,
  WALL_L,
  WALL_R,
  ZIP_POST_X,
  doorHit,
  floorAt,
  floorY,
  shaftServes,
  furnitureOf,
} from './level';
import {
  Car,
  CAR_H,
  FATAL_FALL,
  callCar,
  carRoofY,
  doorsOpen,
  makeCar,
  openingState,
  stepCar,
} from './elevator';
import {
  Banner,
  Bubble,
  Bullet,
  Cop,
  Dir,
  Janitor,
  KioskPanel,
  LampState,
  Pickup,
  Player,
  Spy,
  Walker,
  WetPatch,
} from './mall-types';
import { FLOOR_BANNERS, HEADLINES, MISC, PA_LINES, SPYGRAM_ARRIVAL, SpygramPost, SPY_ELEVATOR_LINES, SPY_LAST_WORDS, StoreId, storeInfo, wrapLines, LIMITS } from './copy';
import { FOOD_POWERS, PowerKind, SHOP_POWERS, applyPower, fireProfile, powerName, resetPowersOnDeath, sneakerBoost, speedMul } from './powerups';
import { POINTS } from './scoring';
import { remainingPackageStores } from './levelsetup';
import { stepSpies, spawnSpyAt, spawnSpies, spyRect, killSpy } from './mall-spies';
import { stepNpcs } from './mall-npcs';

export const PW = 16;
export const PH = 24;
export const DUCK_H = 14;
export const HB_X = 3;
export const HB_W = 10;
export const BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;
export const JUMP_V = -3.2;
export const GRAVITY = 0.25;
export const ZIP_FRAMES = 150;
export const CROUCH_FRAMES = 24;
export const SELFIE_FRAMES = 150;
export const INVULN_RESPAWN = 120;
export const AUTO_CALL_FRAMES = 30;
export const BOOTH_MAX = 300;
export const KIOSK_COOLDOWN = 1200;
export const FOUNTAIN_COOLDOWN = 900;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Mall {
  run: RunState;
  rng: Rng;
  diff: Difficulty;
  frame = 0;
  p: Player;
  cars: Car[];
  spies: Spy[] = [];
  bullets: Bullet[] = [];
  lamps: LampState[];
  pickups: Pickup[] = [];
  patches: WetPatch[] = [];
  bubbles: Bubble[] = [];
  banner: Banner | null = null;
  janitor: Janitor;
  walkers: Walker[];
  cop: Cop;
  kioskCd: number[] = new Array(FLOOR_COUNT).fill(0);
  fountainCd: number[] = new Array(FLOOR_COUNT).fill(0);
  kioskPanel: KioskPanel | null = null;
  darks: { floor: number; x0: number; x1: number; life: number }[] = [];
  shake = 0;
  alarm = false;
  spawnT = 300;
  paT = 3000;
  lastPa = -1;
  nextId = 1;
  post: SpygramPost;
  cam = { x: 0, y: 0 };
  safe = { x: ARRIVAL_X, floor: FLOOR_R };
  levelClearFired = false;
  volley = 0;
  lastShotFrame = -999;
  boothT = 0;
  tookPhoto = false;
  /** Frames the level has been playable (after the selfie). */
  playFrames = 0;
  controlGiven = false;
  /** Packages/Level-clear gating */
  leftStoreLock = 0;
  copCatches = 0;
  /** floor index the mall music mood needs. */
  ridingCar = false;
  /** Latest floor announcement (render hook). */
  lastAnnounce = -1;
  /** Last frame the agent walked (animation hook). */
  lastMoveFrame = 0;
  /** Store the agent is in / last entered (map overlay). */
  lastStoreEntered: StoreId | null = null;

  constructor(run: RunState) {
    this.run = run;
    this.rng = new Rng(hashSeed('mall', run.seed, run.loop));
    this.diff = difficultyFor(run.loop, run.blackFriday);
    this.cars = SHAFTS.map((s) => makeCar(s, s.id === 'A' ? FLOOR_R : s.id === 'B' ? FLOOR_P : FLOOR_2F));
    this.lamps = LAMPS.map((l, i) => ({ idx: i, floor: l.floor, x: l.x, disco: l.disco, state: 'hang', y: floorY(l.floor) - 18, vy: 0, vx: 0, rollDir: 1 }));
    this.post = this.rng.pick(SPYGRAM_ARRIVAL);
    this.janitor = { floor: FLOOR_1F, x: 280, dir: 1, state: 'walk', t: 0, nextMop: 240 };
    this.walkers = [
      { floor: FLOOR_2F, x: 262, dir: 1, speed: 0.8, pause: 0, sprite: 0 },
      { floor: FLOOR_2F, x: 520, dir: -1, speed: 0.7, pause: 120, sprite: 1 },
    ];
    this.cop = { floor: this.rng.int(FLOOR_4F, FLOOR_1F), x: this.rng.int(120, 640), dir: 1, state: 'patrol', t: 0, retarget: 1500, whistle: 0 };
    this.p = this.newPlayer();
    this.paT = 2400 + this.rng.int(0, 1200);
    this.updateCamera(true);
  }

  private newPlayer(): Player {
    return {
      mode: 'zip',
      x: -8,
      y: 60,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: false,
      ducking: false,
      kicking: false,
      floor: FLOOR_R,
      carIdx: -1,
      onRoof: false,
      fallStart: null,
      shootCd: 0,
      walkAnim: 0,
      timer: 0,
      invuln: 0,
      slide: 0,
      idle: 0,
      esc: null,
      shooting: 0,
      jumpedFrom: 0,
    };
  }

  // ---------------------------------------------------------------- helpers
  get events() {
    return this.run.events;
  }
  id(): number {
    return this.nextId++;
  }
  /** Player body rect used for hits. */
  playerRect(): Rect {
    const p = this.p;
    const h = p.ducking ? DUCK_H : PH;
    return { x: p.x + HB_X, y: p.y - h, w: HB_W, h };
  }
  walkSpeed(): number {
    return speedMul(this.run.powers);
  }
  visibleToSpies(): boolean {
    const m = this.p.mode;
    return m === 'normal' || m === 'escalator' || (m === 'car' && !this.cars[this.p.carIdx]?.moving);
  }
  say(owner: string, x: number, y: number, text: string, floor: number, life = 100): void {
    this.bubbles = this.bubbles.filter((b) => b.owner !== owner);
    this.bubbles.push({ id: this.id(), owner, x, y, text, life, floor });
  }
  showBanner(lines: string[], life: number, kind: Banner['kind'] = 'info'): void {
    this.banner = { lines, life, kind };
  }

  /** True when the opening is a pit/blocked for walkers (anything but a grate). */
  isPit(floor: number, cx: number, margin = 0): boolean {
    for (let i = 0; i < SHAFTS.length; i++) {
      const s = SHAFTS[i];
      if (!shaftServes(s, floor)) continue;
      if (cx >= s.x - margin && cx <= s.x + s.w + margin && openingState(this.cars[i], floor) !== 'above') return true;
    }
    return false;
  }
  shaftAt(cx: number, floor: number, margin = 0): number {
    for (let i = 0; i < SHAFTS.length; i++) {
      const s = SHAFTS[i];
      if (shaftServes(s, floor) && cx >= s.x - margin && cx <= s.x + s.w + margin) return i;
    }
    return -1;
  }

  // ================================================================ main step
  step(pad: PadFrame): void {
    this.frame++;
    this.tickTimers();
    const p = this.p;
    if (p.mode === 'store') return;

    this.stepCars(pad);
    this.stepPlayer(pad);
    this.stepBullets();
    stepSpies(this);
    stepNpcs(this);
    this.stepLamps();
    this.stepPickups();
    this.stepHazards();
    this.stepAmbient();
    this.updateCamera(false);
  }

  private tickTimers(): void {
    if (this.banner && --this.banner.life <= 0) this.banner = null;
    for (const b of this.bubbles) b.life--;
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    if (this.shake > 0) this.shake--;
    for (const d of this.darks) d.life--;
    this.darks = this.darks.filter((d) => d.life > 0);
    for (let i = 0; i < FLOOR_COUNT; i++) {
      if (this.kioskCd[i] > 0) this.kioskCd[i]--;
      if (this.fountainCd[i] > 0) this.fountainCd[i]--;
    }
    if (this.kioskPanel && --this.kioskPanel.life <= 0) this.kioskPanel = null;
    if (this.leftStoreLock > 0) this.leftStoreLock--;
  }

  // ================================================================ cars
  private stepCars(pad: PadFrame): void {
    const p = this.p;
    this.ridingCar = false;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const rider = p.carIdx === i && (p.mode === 'car' || (p.onRoof && p.mode === 'normal'));
      let drive: -1 | 0 | 1 = 0;
      if (rider) {
        drive = pad.held.up ? -1 : pad.held.down ? 1 : 0;
        if (p.mode !== 'car' && p.mode !== 'normal') drive = 0;
      }
      const prevY = car.y;
      const res = stepCar(car, { rider, drive, rng: this.rng });
      if (rider && car.moving) this.ridingCar = true;
      if (rider && p.mode === 'car') p.y = car.y;
      if (rider && p.onRoof) p.y = carRoofY(car);
      if (res.stopped !== null) this.onCarStopped(i, res.stopped, rider);
      if (res.departed && rider) this.events.emit('carStart', { shaft: i });
      void prevY;
    }
  }

  private onCarStopped(i: number, floor: number, rider: boolean): void {
    const car = this.cars[i];
    const s = car.shaft;
    const cx = s.cx;
    const pcx = this.p.x + 8;
    const near = Math.abs(cx - pcx) < 200 && Math.abs(floor - floorAt(this.p.y)) <= 2;
    if (near || rider) this.events.emit('ding', { shaft: i, floor });
    if (rider && this.p.mode === 'car') {
      this.showBanner([FLOOR_BANNERS[floor]], 120, 'floor');
      this.lastAnnounce = floor;
    }
    // Cars stopping near the player sometimes let a spy out.
    if (!rider && near && Math.abs(floor - floorAt(this.p.y)) <= 1 && this.spies.length < this.diff.spyCap && this.controlGiven && this.rng.chance(0.25)) {
      const spy = spawnSpyAt(this, floor, cx - 8, true);
      if (spy) this.say('spy' + spy.id, spy.x + 8, spy.y - 28, this.rng.pick(SPY_ELEVATOR_LINES), floor, 100);
    }
  }

  // ================================================================ player
  private stepPlayer(pad: PadFrame): void {
    const p = this.p;
    if (p.invuln > 0) p.invuln--;
    switch (p.mode) {
      case 'zip':
        return this.stepZip();
      case 'drop':
        return this.stepDrop();
      case 'crouch':
        if (++p.timer >= CROUCH_FRAMES) {
          p.mode = 'selfie';
          p.timer = 0;
          this.events.emit('flash');
        }
        return;
      case 'selfie': {
        p.timer++;
        const anyPress = Object.values(pad.pressed).some(Boolean);
        if (p.timer >= SELFIE_FRAMES || (p.timer > 6 && anyPress)) this.giveControl();
        return;
      }
      case 'dying':
        // hop, fall, lie there; the game calls respawn() (or shows CONTINUE?) after 'deathDone'
        p.timer++;
        if (p.timer === 1) p.vy = -2;
        if (p.timer < 40) {
          p.vy += 0.15;
          p.y = Math.min(p.y + p.vy, floorY(p.floor));
        }
        if (p.timer === 70) this.events.emit('deathDone');
        return;
      case 'frozen':
        p.timer--;
        if (p.timer <= 0) p.mode = 'normal';
        this.stepShootOnly(pad);
        return;
      case 'escalator':
        return this.stepEscalator(pad);
      case 'booth':
        return this.stepBooth(pad);
      case 'car':
        return this.stepInCar(pad);
      case 'normal':
        return this.stepNormal(pad);
      case 'store':
        return;
    }
  }

  private giveControl(): void {
    const p = this.p;
    p.mode = 'normal';
    p.timer = 0;
    this.controlGiven = true;
    this.spawnT = 300; // first spy ~5 s into the level
    this.events.emit('controlGiven');
    this.showBanner([FLOOR_BANNERS[FLOOR_R]], 100, 'floor');
  }

  private stepZip(): void {
    const p = this.p;
    p.timer++;
    if (p.timer === 1) this.events.emit('zip');
    const t = Math.min(1, p.timer / ZIP_FRAMES);
    const cx = 6 + t * (ZIP_POST_X - 8 - 6);
    const cableY = 44 + t * (floorY(FLOOR_R) - 44 - 44);
    p.x = cx - 8;
    p.y = cableY + 24;
    p.dir = 1;
    this.cam.x = Math.max(0, Math.min(MALL_W - SCREEN_W, cx - 100));
    if (p.timer >= ZIP_FRAMES) {
      p.mode = 'drop';
      p.vx = 0.7;
      p.vy = 0;
      p.timer = 0;
    }
  }

  private stepDrop(): void {
    const p = this.p;
    p.vy += GRAVITY;
    p.y += p.vy;
    p.x += p.vx;
    if (p.y >= floorY(FLOOR_R)) {
      p.y = floorY(FLOOR_R);
      p.vy = 0;
      p.vx = 0;
      p.mode = 'crouch';
      p.timer = 0;
      p.onGround = true;
      p.floor = FLOOR_R;
      this.events.emit('thud');
      this.shake = 6;
    }
  }

  // ---- shooting
  private stepShootOnly(pad: PadFrame): void {
    const p = this.p;
    if (p.shootCd > 0) p.shootCd--;
    if (p.shooting > 0) p.shooting--;
    void pad;
  }

  fire(): boolean {
    const p = this.p;
    const prof = fireProfile(this.run.powers);
    const mine = this.bullets.filter((b) => b.owner === 'player');
    const volleys = new Set(mine.map((b) => b.volley));
    if (volleys.size >= prof.maxBullets) return false;
    if (p.shootCd > 0) return false;
    if (this.frame - this.lastShotFrame > 40) this.volley++;
    this.lastShotFrame = this.frame;
    const y = p.ducking ? p.y - 6 : p.y - 16;
    const x = p.dir > 0 ? p.x + 16 : p.x - 2;
    const base = floorY(floorAt(p.y));
    const vys = prof.spread ? [-0.45, 0, 0.45] : [0];
    for (const vy of vys) {
      this.bullets.push({ id: this.id(), x, y, vx: p.dir * BULLET_SPEED, vy, owner: 'player', floor: floorAt(p.y), volley: this.volley, base, life: 90 });
    }
    p.shootCd = prof.cooldown;
    p.shooting = 10;
    this.events.emit('shot', { spread: prof.spread });
    this.events.emit('playerShot', { floor: floorAt(p.y), x: p.x, dir: p.dir });
    return true;
  }

  // ---- store interaction
  tryEnterStore(id: StoreId): boolean {
    const info = storeInfo(id);
    const setup = this.run.setup[id];
    if (info.role === 'closed' || !setup) {
      this.events.emit('locked', { why: 'closed' });
      return false;
    }
    if (info.role === 'target' && setup.cleared) {
      this.events.emit('locked', { why: 'cleared' });
      return false;
    }
    this.lastStoreEntered = id;
    this.p.mode = 'store';
    this.p.ducking = false;
    this.p.vx = 0;
    this.events.emit('enterStore', { id });
    return true;
  }

  /** Called by the game when the agent walks out of a store: back at that door. */
  returnFromStore(id: StoreId): void {
    const p = this.p;
    const sf = STOREFRONTS.find((s) => s.id === id)!;
    p.mode = 'normal';
    p.floor = sf.floor;
    p.x = sf.doorX - 8;
    p.y = floorY(sf.floor);
    p.onGround = true;
    p.onRoof = false;
    p.carIdx = -1;
    p.vx = p.vy = 0;
    p.invuln = 60;
    p.slide = 0;
    p.kicking = false;
    p.esc = null;
    this.spies = [];
    this.bullets = [];
    this.leftStoreLock = 20;
    this.spawnT = Math.max(this.spawnT, 180);
    this.safe = { x: p.x, floor: p.floor };
    this.updateCamera(true);
  }

  // ---- death
  kill(cause: string): boolean {
    const p = this.p;
    if (p.mode === 'dying' || p.mode === 'store') return false;
    if (p.invuln > 0) return false;
    const pw = this.run.powers;
    if (pw.invincible && cause !== 'fall' && cause !== 'crush') return false;
    if (pw.armor && cause !== 'fall' && cause !== 'crush') {
      pw.armor = false;
      p.invuln = 60;
      this.events.emit('armorBreak');
      return false;
    }
    p.mode = 'dying';
    p.timer = 0;
    p.vy = 0;
    p.ducking = false;
    p.kicking = false;
    p.slide = 0;
    p.esc = null;
    p.onRoof = false;
    this.bullets = this.bullets.filter((b) => b.owner !== 'spy');
    this.events.emit('playerDied', { cause });
    if (cause === 'crush' || cause === 'lamp' || cause === 'ball') this.shake = 14;
    return true;
  }

  /** After a death: respawn at the last safe spot with ~2 s of blinking invulnerability. */
  respawn(): void {
    const p = this.p;
    resetPowersOnDeath(this.run.powers);
    p.mode = 'normal';
    p.floor = this.safe.floor;
    p.x = this.safe.x;
    p.y = floorY(this.safe.floor);
    p.vx = p.vy = 0;
    p.onGround = true;
    p.onRoof = false;
    p.carIdx = -1;
    p.fallStart = null;
    p.ducking = false;
    p.kicking = false;
    p.slide = 0;
    p.timer = 0;
    p.invuln = INVULN_RESPAWN;
    p.esc = null;
    this.spies = [];
    this.bullets = [];
    this.copFree();
    this.spawnT = Math.max(this.spawnT, 240);
    if (!this.controlGiven) this.giveControl();
    this.updateCamera(true);
  }

  private copFree(): void {
    this.cop.state = 'cool';
    this.cop.t = 240;
  }

  // ---- grounded movement
  private stepNormal(pad: PadFrame): void {
    const p = this.p;
    const held = pad.held;
    if (p.shootCd > 0) p.shootCd--;
    if (p.shooting > 0) p.shooting--;
    p.walkAnim++;

    if (p.onRoof) return this.stepRoof(pad);

    if (!p.onGround) return this.stepAir(pad);

    // --- actions on a fresh Up/Down press
    let acted = false;
    if (this.leftStoreLock <= 0) acted = this.tryAction(pad);
    if (p.mode !== 'normal') return;

    // --- ducking
    p.ducking = held.down && !acted && p.slide === 0;

    // --- wet floor: slide at walking speed, can't stop or turn
    const patch = this.patchAt(p.floor, p.x + 8);
    if (patch && p.slide === 0) {
      p.slide = held.left ? -1 : held.right ? 1 : p.dir;
      p.dir = p.slide as Dir;
      this.events.emit('slip');
    }
    if (p.slide !== 0 && !patch) {
      p.slide = 0;
      p.kicking = false;
    }

    // --- walking
    const sp = this.walkSpeed();
    let moved = false;
    if (p.slide !== 0) {
      p.x += p.slide * 1;
      moved = true;
    } else if (!p.ducking) {
      if (held.left && !held.right) {
        p.x -= sp;
        p.dir = -1;
        moved = true;
      } else if (held.right && !held.left) {
        p.x += sp;
        p.dir = 1;
        moved = true;
      }
    }
    p.x = Math.max(WALL_L, Math.min(WALL_R - PW, p.x));

    // --- jump
    if (pad.pressed.b && !p.ducking && p.onGround) {
      const boosted = sneakerBoost(this.run.powers);
      p.vy = boosted ? JUMP_V * 1.12 : JUMP_V;
      p.onGround = false;
      p.fallStart = null;
      p.jumpedFrom = p.y;
      p.vx = p.slide !== 0 ? p.slide * 1.5 : held.left && !held.right ? -1.5 : held.right && !held.left ? 1.5 : 0;
      p.kicking = p.vx !== 0 || p.slide !== 0;
      this.events.emit('jump');
    }

    // --- shoot
    if (pad.pressed.a || (held.a && p.shootCd <= 0)) this.fire();

    // --- elevator calling: Up/Down beside the opening, or standing still for ~0.5 s
    if (p.onGround && p.mode === 'normal') {
      const still = !moved && !pad.pressed.b && !held.a;
      p.idle = still ? p.idle + 1 : 0;
      if (p.idle >= AUTO_CALL_FRAMES && !held.down) {
        this.callNearbyCar();
        p.idle = 0;
      }
      this.checkShaftContact();
    }

    // safe spot bookkeeping
    if (p.onGround && p.mode === 'normal' && p.slide === 0 && this.shaftAt(p.x + 8, p.floor, 14) < 0 && p.floor !== -1 && this.frame % 20 === 0) {
      this.safe = { x: p.x, floor: p.floor };
    }
    if (moved && p.onGround) {
      this.lastMoveFrame = this.frame;
      this.events.emit('step', { f: p.walkAnim });
    }
  }

  patchAt(floor: number, cx: number): WetPatch | null {
    for (const w of this.patches) if (w.floor === floor && cx >= w.x0 && cx <= w.x1) return w;
    return null;
  }

  /** Walk into a shaft opening: board a waiting car or fall into a pit. */
  private checkShaftContact(): void {
    const p = this.p;
    const cx = p.x + 8;
    const si = this.shaftAt(cx, p.floor);
    if (si < 0) return;
    const car = this.cars[si];
    const st = openingState(car, p.floor);
    if (st === 'here' && doorsOpen(car)) {
      this.boardCar(si);
    } else if (st === 'below') {
      p.onGround = false;
      p.fallStart = floorY(p.floor);
      p.vy = 0;
      p.vx = 0;
      p.slide = 0;
      p.kicking = false;
      p.ducking = false;
    }
  }

  private boardCar(si: number): void {
    const p = this.p;
    const car = this.cars[si];
    p.mode = 'car';
    p.carIdx = si;
    p.x = SHAFTS[si].cx - 8;
    p.y = car.y;
    p.vx = p.vy = 0;
    p.onGround = true;
    p.onRoof = false;
    p.ducking = false;
    p.kicking = false;
    p.slide = 0;
    p.idle = 0;
    this.events.emit('board', { shaft: si });
  }

  private stepInCar(pad: PadFrame): void {
    const p = this.p;
    const car = this.cars[p.carIdx];
    const s = car.shaft;
    p.x = s.cx - 8;
    p.y = car.y;
    if (p.shootCd > 0) p.shootCd--;
    if (p.shooting > 0) p.shooting--;
    if (doorsOpen(car)) {
      const f = Math.round((car.y - floorY(0)) / 48);
      p.floor = f;
      // a fresh press (not a held key from walking in) steps out
      if (pad.pressed.left) this.exitCar(-1);
      else if (pad.pressed.right) this.exitCar(1);
      else if (pad.pressed.a || (pad.held.a && p.shootCd <= 0)) this.fire();
    }
  }

  private exitCar(dir: Dir): void {
    const p = this.p;
    const car = this.cars[p.carIdx];
    const s = car.shaft;
    p.mode = 'normal';
    p.dir = dir;
    p.x = dir < 0 ? s.x - 10 : s.x + s.w - 6;
    p.y = car.y;
    p.floor = Math.round((car.y - floorY(0)) / 48);
    p.onGround = true;
    p.carIdx = -1;
    p.idle = 0;
    this.events.emit('exitCar');
    this.safe = { x: p.x + dir * 14, floor: p.floor };
  }

  // ---- roof riding
  private stepRoof(pad: PadFrame): void {
    const p = this.p;
    const car = this.cars[p.carIdx];
    const s = car.shaft;
    const roof = carRoofY(car);
    p.y = roof;
    p.ducking = false;
    const held = pad.held;
    const cxMin = s.x + 6;
    const cxMax = s.x + s.w - 6;
    // step out sideways when the roof is within reach of a floor
    let exitFloor = -1;
    for (let f = s.minFloor; f <= s.maxFloor; f++) if (Math.abs(roof - floorY(f)) <= 12) exitFloor = f;
    if (exitFloor >= 0 && (pad.pressed.left || pad.pressed.right) && !car.moving) {
      const dir: Dir = pad.pressed.left ? -1 : 1;
      p.onRoof = false;
      p.carIdx = -1;
      p.floor = exitFloor;
      p.y = floorY(exitFloor);
      p.x = dir < 0 ? s.x - 10 : s.x + s.w - 6;
      p.dir = dir;
      p.onGround = true;
      this.safe = { x: p.x + dir * 14, floor: p.floor };
      return;
    }
    if (held.left && !held.right) {
      p.dir = -1;
      p.x = Math.max(cxMin - 8, p.x - 1);
    } else if (held.right && !held.left) {
      p.dir = 1;
      p.x = Math.min(cxMax - 8, p.x + 1);
    }
    if (pad.pressed.b) {
      p.onRoof = false;
      p.onGround = false;
      p.vy = JUMP_V;
      p.vx = 0;
      p.fallStart = null;
      p.floor = floorAt(roof);
      this.events.emit('jump');
    }
    if (pad.pressed.a || (held.a && p.shootCd <= 0)) this.fire();
  }

  // ---- airborne
  private stepAir(pad: PadFrame): void {
    const p = this.p;
    const prevY = p.y;
    p.vy += GRAVITY;
    p.y += p.vy;
    p.x += p.vx;
    p.x = Math.max(WALL_L, Math.min(WALL_R - PW, p.x));
    const cx = p.x + 8;
    const si = this.shaftAt(cx, p.floor, -2);

    // inside a shaft column
    if (si >= 0) {
      const car = this.cars[si];
      const s = car.shaft;
      const st = openingState(car, p.floor);
      const roof = carRoofY(car);
      // falling past the floor line into a pit: keep the agent inside the shaft walls
      if (st === 'below' && p.y > floorY(p.floor) + 1) {
        if (p.fallStart === null) p.fallStart = floorY(p.floor);
        p.x = Math.max(s.x + 3 - 8, Math.min(s.x + s.w - 3 - 8, p.x));
        p.vx = 0;
      }
      if (p.vy > 0 && prevY <= roof && p.y >= roof) {
        const dist = roof - (p.fallStart ?? roof);
        p.y = roof;
        p.vy = 0;
        p.vx = 0;
        if (p.fallStart !== null && dist > FATAL_FALL) {
          p.onGround = true;
          this.kill('fall');
          return;
        }
        p.onGround = true;
        p.onRoof = true;
        p.carIdx = si;
        p.kicking = false;
        p.fallStart = null;
        p.floor = floorAt(roof);
        this.events.emit('thud');
        return;
      }
      if (st === 'above' || st === 'here') {
        // grate / car floor: land on the floor line
        if (p.vy > 0 && prevY <= floorY(p.floor) && p.y >= floorY(p.floor)) return this.landOnFloor(pad);
        return;
      }
      // pit: no floor line; keep falling
      return;
    }

    if (p.vy > 0 && prevY <= floorY(p.floor) && p.y >= floorY(p.floor)) this.landOnFloor(pad);
  }

  private landOnFloor(pad: PadFrame): void {
    const p = this.p;
    p.y = floorY(p.floor);
    p.vy = 0;
    p.onGround = true;
    p.vx = 0;
    p.fallStart = null;
    const patch = this.patchAt(p.floor, p.x + 8);
    if (patch) {
      // A jump-kick landing on a wet patch keeps kicking while sliding.
      p.slide = p.dir;
    } else {
      p.kicking = false;
    }
    this.events.emit('land');
    void pad;
    this.checkShaftContact();
  }

  // ---- escalators
  private startEscalator(idx: number, dir: 1 | -1): void {
    const p = this.p;
    p.mode = 'escalator';
    p.esc = { idx, t: 0, dir };
    p.ducking = false;
    p.slide = 0;
    this.events.emit('escalatorBoard');
  }

  private stepEscalator(pad: PadFrame): void {
    const p = this.p;
    const esc = p.esc!;
    const e = ESCALATORS[esc.idx];
    esc.t++;
    const ESC_FRAMES = 48;
    const t = Math.min(1, esc.t / ESC_FRAMES);
    const fromX = esc.dir < 0 ? e.xLower : e.xUpper;
    const toX = esc.dir < 0 ? e.xUpper : e.xLower;
    const fromF = esc.dir < 0 ? e.lowerFloor : e.upperFloor;
    const toF = esc.dir < 0 ? e.upperFloor : e.lowerFloor;
    const cx = fromX + (toX - fromX) * t;
    p.x = cx - 8;
    p.y = floorY(fromF) + (floorY(toF) - floorY(fromF)) * t;
    p.dir = toX >= fromX ? 1 : -1;
    if (p.shootCd > 0) p.shootCd--;
    if (p.shooting > 0) p.shooting--;
    if (pad.pressed.a) this.fire();
    if (esc.t >= ESC_FRAMES) {
      p.mode = 'normal';
      p.floor = toF;
      p.y = floorY(toF);
      p.onGround = true;
      p.esc = null;
      p.idle = 0;
      this.safe = { x: p.x, floor: p.floor };
      this.events.emit('escalatorLeave');
    }
  }

  // ---- booth
  private stepBooth(pad: PadFrame): void {
    const p = this.p;
    p.timer++;
    const leave = pad.pressed.down || pad.pressed.left || pad.pressed.right || pad.pressed.b || p.timer >= BOOTH_MAX;
    if (leave) {
      p.mode = 'normal';
      p.idle = 0;
      this.events.emit('boothOut');
      if (!this.run.photoStripGiven) {
        this.run.photoStripGiven = true;
        this.run.inventory.push('PHOTO STRIP');
        this.events.emit('photoStrip');
        this.showBanner([MISC.photoStrip], 150, 'info');
      }
    }
  }

  // ---- fresh Up / Down presses
  private tryAction(pad: PadFrame): boolean {
    const p = this.p;
    const up = pad.pressed.up;
    const dn = pad.pressed.down;
    if (!up && !dn) return false;
    const cx = p.x + 8;
    // escalators
    for (let i = 0; i < ESCALATORS.length; i++) {
      const e = ESCALATORS[i];
      if (up && p.floor === e.lowerFloor && Math.abs(cx - e.xLower) <= 10) {
        this.startEscalator(i, -1);
        return true;
      }
      if (dn && p.floor === e.upperFloor && Math.abs(cx - e.xUpper) <= 10) {
        this.startEscalator(i, 1);
        return true;
      }
    }
    if (up) {
      const door = doorHit(cx, p.floor);
      if (door) {
        this.tryEnterStore(door.id);
        return true;
      }
      for (const k of furnitureOf('kiosk', p.floor)) {
        if (cx >= k.x - 6 && cx <= k.x + k.w + 6) {
          this.useKiosk(p.floor);
          return true;
        }
      }
      for (const b of furnitureOf('booth', p.floor)) {
        if (cx >= b.x - 4 && cx <= b.x + b.w + 4) {
          p.mode = 'booth';
          p.timer = 0;
          p.x = b.x + b.w / 2 - 8;
          this.events.emit('boothIn');
          return true;
        }
      }
      if (p.floor === FLOOR_P && cx >= GETAWAY.x - 6 && cx <= GETAWAY.x + GETAWAY.w + 6) {
        this.useGetaway();
        return true;
      }
    }
    // calling an elevator: Up or Down while standing in / right beside an opening
    if (this.callNearbyCar()) return true;
    return false;
  }

  /** Call the car of a nearby shaft to this floor. */
  callNearbyCar(): boolean {
    const p = this.p;
    const cx = p.x + 8;
    for (let i = 0; i < SHAFTS.length; i++) {
      const s = SHAFTS[i];
      if (!shaftServes(s, p.floor)) continue;
      if (cx < s.x - 16 || cx > s.x + s.w + 16) continue;
      const car = this.cars[i];
      if (openingState(car, p.floor) === 'here') continue;
      if (car.target === p.floor && car.called) return true;
      if (callCar(car, p.floor)) {
        this.events.emit('call', { shaft: i });
        return true;
      }
    }
    return false;
  }

  private useKiosk(floor: number): void {
    if (this.kioskCd[floor] > 0) {
      this.events.emit('locked', { why: 'kiosk' });
      return;
    }
    this.kioskCd[floor] = KIOSK_COOLDOWN;
    const left = remainingPackageStores(this.run.setup);
    let best: StoreId | null = null;
    let bestD = 1e9;
    for (const id of left) {
      const sf = STOREFRONTS.find((s) => s.id === id)!;
      const d = Math.abs(sf.floor - floor) * 400 + Math.abs(sf.doorX - (this.p.x + 8));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    this.kioskPanel = { store: best, life: 240 };
    this.events.emit('kiosk', { store: best });
  }

  private useGetaway(): void {
    const left = 6 - this.run.packages.length;
    if (left > 0) {
      this.showBanner([`PACKAGES LEFT: ${left}`], 120, 'warn');
      this.events.emit('buzzer');
      return;
    }
    if (this.levelClearFired) return;
    this.levelClearFired = true;
    this.events.emit('levelClear');
  }

  // ================================================================ bullets
  private stepBullets(): void {
    const keep: Bullet[] = [];
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0 || b.x < WALL_L - 4 || b.x > WALL_R + 4 || Math.abs(b.y - (b.base - 12)) > 40) continue;
      if (this.bulletBlocked(b)) continue;
      if (b.owner === 'player') {
        if (this.playerBulletHit(b)) continue;
      } else if (this.spyBulletHit(b)) continue;
      keep.push(b);
    }
    this.bullets = keep;
  }

  private bulletRect(b: Bullet): Rect {
    return { x: b.x - 2, y: b.y - 1, w: 4, h: 3 };
  }

  /** Mall walkers and the cop's helmet stop bullets; the janitor does not. */
  private bulletBlocked(b: Bullet): boolean {
    const r = this.bulletRect(b);
    for (const w of this.walkers) {
      if (w.floor !== b.floor) continue;
      if (overlap(r, { x: w.x + 2, y: floorY(w.floor) - 24, w: 12, h: 24 })) {
        if (b.owner === 'player') {
          this.say('walker' + w.sprite, w.x + 8, floorY(w.floor) - 30, MISC.walkerHey, w.floor, 70);
          award(this.run, POINTS.walkerShot, { x: w.x + 8, y: floorY(w.floor) - 34, space: 'mall' });
          this.events.emit('walkerHit');
        } else this.events.emit('ping');
        return true;
      }
    }
    const c = this.cop;
    if (c.floor === b.floor && overlap(r, { x: c.x, y: floorY(c.floor) - 26, w: 20, h: 26 })) {
      this.events.emit('helmetPing');
      return true;
    }
    return false;
  }

  private playerBulletHit(b: Bullet): boolean {
    const r = this.bulletRect(b);
    for (const s of this.spies) {
      if (s.state === 'dying' || s.floor !== b.floor) continue;
      const sr = spyRect(s);
      if (overlap(r, sr)) {
        killSpy(this, s, 'shot');
        return true;
      }
    }
    // lamps and disco balls
    for (const l of this.lamps) {
      if (l.state !== 'hang' || l.floor !== b.floor) continue;
      const fy = floorY(l.floor);
      if (overlap(r, { x: l.x - 5, y: fy - 44, w: 10, h: 30 })) {
        this.dropLamp(l, b.vx > 0 ? 1 : -1);
        return true;
      }
    }
    // fountains
    for (const f of furnitureOf('fountain', b.floor)) {
      const fy = floorY(b.floor);
      if (overlap(r, { x: f.x, y: fy - 22, w: f.w, h: 22 })) {
        this.sprayFountain(b.floor, f.x + f.w / 2);
        return true;
      }
    }
    return false;
  }

  private spyBulletHit(b: Bullet): boolean {
    const p = this.p;
    if (p.mode === 'dying' || p.mode === 'booth' || p.mode === 'store') return false;
    if (b.floor !== floorAt(p.y) && p.mode !== 'escalator') return false;
    if (p.mode === 'car' && !doorsOpen(this.cars[p.carIdx])) return false;
    if (overlap(this.bulletRect(b), this.playerRect())) {
      this.kill('bullet');
      return true;
    }
    return false;
  }

  // ================================================================ lamps / disco balls / fountains
  dropLamp(l: LampState, dir: Dir): void {
    l.state = 'fall';
    l.vy = 0;
    l.rollDir = dir;
    this.events.emit('lampFall', { disco: l.disco });
  }

  private stepLamps(): void {
    for (const l of this.lamps) {
      const fy = floorY(l.floor);
      if (l.state === 'fall') {
        l.vy += 0.3;
        l.y += l.vy;
        this.lampKills(l);
        if (l.y >= fy - 6) {
          l.y = fy - 6;
          if (l.disco) {
            l.state = 'roll';
            l.vx = l.rollDir * 2;
            l.vy = 0;
            this.events.emit('crushHit');
            this.shake = 10;
          } else {
            this.shatter(l);
          }
        }
      } else if (l.state === 'roll') {
        l.x += l.vx;
        this.lampKills(l);
        const edge = l.x <= WALL_L + 6 || l.x >= WALL_R - 6;
        if (edge || this.isPitRoll(l)) {
          this.shatter(l);
        }
      }
    }
  }

  private isPitRoll(l: LampState): boolean {
    return this.isPit(l.floor, l.x + l.vx * 6, 0);
  }

  private shatter(l: LampState): void {
    l.state = 'dead';
    this.events.emit('glass', { x: l.x, floor: l.floor });
    this.shake = Math.max(this.shake, 8);
    if (!l.disco) this.darks.push({ floor: l.floor, x0: l.x - 56, x1: l.x + 56, life: 120 });
  }

  private lampKills(l: LampState): void {
    const fy = floorY(l.floor);
    const r: Rect = { x: l.x - 6, y: l.y - 6, w: 12, h: 12 };
    void fy;
    for (const s of this.spies) {
      if (s.state === 'dying' || s.floor !== l.floor) continue;
      if (overlap(r, spyRect(s))) killSpy(this, s, l.disco ? 'ball' : 'lamp');
    }
    const p = this.p;
    if (p.mode === 'normal' && floorAt(p.y) === l.floor && overlap(r, this.playerRect())) this.kill(l.disco ? 'ball' : 'lamp');
  }

  sprayFountain(floor: number, cx: number): void {
    if (this.fountainCd[floor] > 0) return;
    this.fountainCd[floor] = FOUNTAIN_COOLDOWN;
    const n = this.rng.int(3, 5);
    const gold = this.rng.chance(1 / 20) ? this.rng.int(0, n - 1) : -1;
    const fy = floorY(floor);
    for (let i = 0; i < n; i++) {
      this.pickups.push({
        id: this.id(),
        kind: i === gold ? 'gold' : 'coin',
        x: cx - 3,
        y: fy - 20,
        vx: (this.rng.next() - 0.5) * 2.4,
        vy: -2.4 - this.rng.next() * 1.4,
        life: 600,
        floor,
      });
    }
    this.events.emit('fountain', { x: cx, floor });
  }

  // ================================================================ pickups
  dropPickup(kind: Pickup['kind'], x: number, floor: number): void {
    this.pickups.push({ id: this.id(), kind, x, y: floorY(floor) - 4, vx: 0, vy: -1.6, life: 900, floor });
  }

  private stepPickups(): void {
    const keep: Pickup[] = [];
    const pr = this.playerRect();
    const alive = this.p.mode === 'normal' || this.p.mode === 'car';
    for (const k of this.pickups) {
      k.life--;
      if (k.life <= 0) continue;
      const fy = floorY(k.floor);
      k.vy += 0.2;
      k.y += k.vy;
      k.x += k.vx;
      k.vx *= 0.98;
      if (k.y >= fy - 3) {
        k.y = fy - 3;
        k.vy = Math.abs(k.vy) > 1 ? -k.vy * 0.5 : 0;
        k.vx *= 0.8;
      }
      k.x = Math.max(WALL_L, Math.min(WALL_R - 8, k.x));
      if (alive && floorAt(this.p.y) === k.floor && overlap(pr, { x: k.x, y: k.y - 8, w: 8, h: 10 })) {
        this.collectPickup(k);
        continue;
      }
      keep.push(k);
    }
    this.pickups = keep;
  }

  private collectPickup(k: Pickup): void {
    if (k.kind === 'coin') {
      award(this.run, POINTS.coin, { x: k.x, y: k.y - 8, space: 'mall' });
      this.events.emit('coin');
    } else if (k.kind === 'gold') {
      addLife(this.run);
      this.showBanner(['EXTRA LIFE!'], 100, 'info');
      this.events.emit('powerup', { kind: 'oneup' });
    } else {
      this.grantPower(k.kind);
    }
  }

  grantPower(kind: PowerKind): void {
    const name = collectPower(this.run, kind, { x: this.p.x + 8, y: this.p.y - 28, space: 'mall' });
    this.showBanner([name], 100, 'info');
    this.events.emit('powerup', { kind });
  }

  // ================================================================ hazards
  private stepHazards(): void {
    const p = this.p;
    // --- elevator crushes
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car.moving || car.dir !== 1) {
        // a car moving UP crushes a roof rider against the top of the shaft
      }
      this.crushChecks(i, car);
    }
    // --- spies touching the player
    if (p.mode === 'normal' && !p.onRoof) {
      for (const s of this.spies) {
        if (s.state === 'dying' || s.state === 'emerge' || s.floor !== floorAt(p.y)) continue;
        if (overlap(spyRect(s), this.playerRect())) {
          if (p.kicking || this.run.powers.invincible) {
            killSpy(this, s, p.slide !== 0 ? 'slide' : this.run.powers.invincible ? 'cinna' : 'kick');
          } else if (this.visibleToSpies()) {
            this.kill('spy');
          }
        }
      }
    }
  }

  private crushChecks(i: number, car: Car): void {
    const p = this.p;
    const s = car.shaft;
    const descending = car.moving && car.dir === 1;
    const rising = car.moving && car.dir === -1;
    // --- player on a grate while a car comes down
    if (p.mode === 'normal' && p.onGround && !p.onRoof && this.shaftAt(p.x + 8, p.floor) === i && descending) {
      const fy = floorY(p.floor);
      const head = fy - (p.ducking ? DUCK_H : PH);
      const protectedCall = car.target === p.floor;
      if (!protectedCall && car.y >= head && car.y <= fy + 4 && openingState(car, p.floor) === 'above') {
        this.kill('crush');
      }
    }
    // --- roof rider hits the top of the shaft
    if (p.onRoof && p.carIdx === i && p.mode === 'normal') {
      const ceiling = floorY(s.minFloor) - 44;
      if (carRoofY(car) - PH < ceiling && rising) this.kill('crush');
      else if (carRoofY(car) - PH < ceiling && car.y <= floorY(s.minFloor)) this.kill('crush');
    }
    // --- spies on a grate
    if (descending) {
      for (const sp of this.spies) {
        if (sp.state === 'dying' || sp.floor < s.minFloor || sp.floor > s.maxFloor) continue;
        const cx = sp.x + 8;
        if (cx < s.x || cx > s.x + s.w) continue;
        const fy = floorY(sp.floor);
        if (car.y >= fy - 24 && car.y <= fy + 4 && sp.y === fy) killSpy(this, sp, 'crush');
      }
    }
  }

  // ================================================================ ambient: alarm, PA, spawns, safe
  private stepAmbient(): void {
    const p = this.p;
    if (!this.controlGiven) return;
    this.playFrames++;
    if (!this.alarm && this.run.levelFrames >= this.diff.alarmAt) {
      this.alarm = true;
      this.showBanner([MISC.alarm], 150, 'alarm');
      this.events.emit('alarm');
    }
    // PA announcements about once a minute
    if (--this.paT <= 0) {
      this.paT = 3400 + this.rng.int(0, 400);
      let i = this.rng.int(0, PA_LINES.length - 1);
      if (i === this.lastPa) i = (i + 1) % PA_LINES.length;
      this.lastPa = i;
      this.showBanner(wrapLines(PA_LINES[i], LIMITS.paLine), 300, 'pa');
      this.events.emit('pa');
    }
    // spy spawns
    if (p.mode === 'normal' || p.mode === 'car' || p.mode === 'escalator') {
      if (--this.spawnT <= 0) {
        const every = this.alarm ? this.diff.spawnEvery * 0.7 : this.diff.spawnEvery;
        this.spawnT = Math.round(every * (0.8 + this.rng.next() * 0.4));
        spawnSpies(this);
      }
    }
  }

  // ================================================================ camera
  updateCamera(snap: boolean): void {
    const p = this.p;
    if (p.mode === 'zip') return;
    const tx = Math.max(0, Math.min(MALL_W - SCREEN_W, p.x + 8 - SCREEN_W / 2));
    const feetTarget = p.y - 56;
    const ty = Math.max(0, Math.min(MALL_H - VIEW_H, feetTarget - VIEW_H / 2 + 56));
    if (snap) {
      this.cam.x = Math.round(tx);
      this.cam.y = Math.round(ty);
      return;
    }
    this.cam.x += Math.round((tx - this.cam.x) * 0.2);
    this.cam.y += Math.round((ty - this.cam.y) * 0.12);
    if (Math.abs(tx - this.cam.x) < 1) this.cam.x = Math.round(tx);
    if (Math.abs(ty - this.cam.y) < 1) this.cam.y = Math.round(ty);
  }

  // ================================================================ helpers for the map / HUD
  currentFloor(): number {
    return floorAt(this.p.y);
  }
  /** Is the agent inside a mall spot where the music should be elevator muzak? */
  inElevator(): boolean {
    return this.p.mode === 'car' || (this.p.onRoof && this.p.mode === 'normal');
  }
}

export { STORE_W, HEADLINES, FOOD_POWERS, SHOP_POWERS, JANITOR_RANGE, WALKER_RANGE, WALK_MAX, WALK_MIN, FURNITURE, FLOOR_COUNT };
