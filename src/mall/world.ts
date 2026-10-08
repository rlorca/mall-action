// The side-scrolling mall. All state and rules; nothing here draws or plays sound.
import {
  AGENT_H,
  AGENT_W,
  CAR_W,
  ESCALATORS,
  ESCALATOR_W,
  FALL_SPEED,
  FLOOR_NAMES,
  JUMP_FRAMES,
  JUMP_PEAK,
  MALL_W,
  PLAYER_BULLET_SPEED,
  RAPID_COOLDOWN,
  SAFE_FALL_DISTANCE,
  SEC,
  SHAFTS,
  SHAFT_W,
  SHOT_COOLDOWN,
  SPY_BULLET_SPEED,
  VIEW_H,
  WALK_SPEED,
  WORLD_H,
  floorY,
} from '../core/constants';
import { FLOOR_ANNOUNCE, PA_LINES, SPY_ELEVATOR_LINES, SPY_LAST_WORDS, SPYGRAM_ARRIVAL } from '../core/copy';
import type { MallEvent, SfxName } from '../core/events';
import type { Pad, StepInput } from '../core/input';
import type { Difficulty } from '../core/difficulty';
import { POINTS } from '../core/scoring';
import { Rng } from '../core/rng';
import { PowerUps, type PowerUpId } from '../core/powerups';
import { Car, type CarEvent } from './elevator';
import {
  COP_CHASE_FRAMES,
  COP_FREEZE_FRAMES,
  KIOSK_COOLDOWN_FRAMES,
  KIOSK_SHOW_FRAMES,
  MOP_INTERVAL_FRAMES,
  SPY_DUCK_FRAMES,
  SPY_TELEGRAPH_FRAMES,
  WALKER_PUSH,
  WALKER_SPEED,
  WET_PATCH_FRAMES,
  WET_PATCH_W,
  copSpotsShot,
  nearestPackageStore,
  patchReachesShaft,
  rollVolleyDodge,
  spyMayFire,
} from './rules';
import { PROPS, STORES, STORE_DOOR_W, doorX, type StoreDef, PLAYER_START_X } from './layout';

export type PlayerMode = 'walk' | 'jump' | 'fall' | 'car' | 'roof' | 'escalator' | 'hidden' | 'frozen' | 'dead' | 'selfie';

export interface Player {
  x: number;
  y: number;
  floor: number;
  facing: -1 | 1;
  mode: PlayerMode;
  car: Car | null;
  ducking: boolean;
  jumpT: number;
  jumpKick: boolean;
  jumpDir: -1 | 0 | 1;
  fallFrom: number; // feet line where the fall began
  fallTarget: number;
  fallCar: Car | null;
  escT: number;
  escId: number;
  escUp: boolean;
  frozenT: number;
  invulnT: number;
  shootCd: number;
  standT: number; // frames standing still in a shaft opening (auto-call)
  moving: boolean; // walked this frame (drives the walk animation)
  slideDir: -1 | 0 | 1;
  lastSafe: { x: number; floor: number };
  alive: boolean;
}

export interface Bullet {
  owner: 'player' | 'spy' | 'cop';
  x: number;
  y: number;
  dx: -1 | 1;
  floor: number;
  volley: number;
  life: number;
}

export interface Spy {
  id: number;
  x: number;
  floor: number;
  facing: -1 | 1;
  mode: 'fresh' | 'wander' | 'wait' | 'aim' | 'dying';
  age: number;
  freshT: number;
  aimT: number;
  aimHigh: boolean;
  nextShot: number;
  waitT: number;
  lastVolley: number;
  ducking: number;
  deathT: number;
  lastWords: string | null;
}

export interface Walker {
  id: number;
  x: number;
  floor: number;
  dir: -1 | 1;
  minX: number;
  maxX: number;
  bubbleT: number;
}

export interface Janitor {
  x: number;
  dir: -1 | 1;
  floor: number;
  mopT: number;
  cooldownT: number;
}

export interface Cop {
  x: number;
  floor: number;
  facing: -1 | 1;
  chaseT: number;
  minX: number;
  maxX: number;
}

export interface Lamp {
  id: string;
  x: number;
  floor: number;
  state: 'hanging' | 'falling' | 'gone';
  fallT: number;
}

export interface Disco {
  id: string;
  x: number;
  floor: number;
  state: 'hanging' | 'dropping' | 'rolling' | 'gone';
  fallT: number;
  dir: -1 | 1;
}

export interface Fountain {
  id: string;
  x: number;
  floor: number;
  cool: number;
}

export interface Coin {
  x: number;
  y: number;
  vy: number;
  floor: number;
  gold: boolean;
  ttl: number;
}

export interface Item {
  id: PowerUpId;
  x: number;
  floor: number;
  ttl: number;
}

export interface WetPatch {
  x0: number;
  x1: number;
  t: number;
}

export interface Bubble {
  x: number;
  floor: number;
  text: string;
  t: number;
}

export type ArrivalPhase = 'slide' | 'drop' | 'land' | 'selfie' | 'done';

export interface WorldOptions {
  seed: number;
  difficulty: Difficulty;
  powerUps: PowerUps;
  /** Target stores that still hold a package. Read live. */
  remaining: () => ReadonlySet<string>;
  /** Whether a store's door is open for spies to come out of (open target stores, power-up shops). */
  doorOpen: (storeId: string) => boolean;
  arrival: boolean;
  photoTaken: boolean;
  /** When set, the mall begins with this player position instead of the roof. */
  start?: { x: number; floor: number };
}

const CHECK_SHOT_RANGE = 200;

export class MallWorld {
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  readonly powerUps: PowerUps;
  readonly cars: Car[];
  readonly spies: Spy[] = [];
  readonly bullets: Bullet[] = [];
  readonly walkers: Walker[] = [];
  readonly lamps: Lamp[] = [];
  readonly discos: Disco[] = [];
  readonly fountains: Fountain[] = [];
  readonly coins: Coin[] = [];
  readonly items: Item[] = [];
  readonly bubbles: Bubble[] = [];
  readonly darkZones: { x0: number; x1: number; floor: number; t: number }[] = [];
  readonly kioskCool = new Map<string, number>();
  readonly player: Player;
  readonly janitor: Janitor;
  readonly cop: Cop;
  wet: WetPatch | null = null;
  kioskShow: { storeId: string | null; t: number } | null = null;
  photoTaken: boolean;
  alarm = false;
  exited = false;
  frame = 0;
  cameraX = 0;
  cameraY = 0;
  arrival: { phase: ArrivalPhase; t: number } | null = null;
  private spyTimer = 5 * SEC;
  private nextId = 1;
  private volleyId = 0;
  private paTimer = 60 * SEC;
  private lastPa = -1;
  private events: MallEvent[] = [];
  private readonly opts: WorldOptions;

  constructor(opts: WorldOptions) {
    this.opts = opts;
    this.rng = new Rng(opts.seed);
    this.difficulty = opts.difficulty;
    this.powerUps = opts.powerUps;
    this.photoTaken = opts.photoTaken;
    this.cars = SHAFTS.map((s, i) => new Car(i, s.id === 'B' ? 1 : 0));

    const start = opts.start ?? { x: PLAYER_START_X, floor: 0 };
    this.player = {
      x: start.x,
      y: floorY(start.floor),
      floor: start.floor,
      facing: 1,
      mode: 'walk',
      car: null,
      ducking: false,
      jumpT: 0,
      jumpKick: false,
      jumpDir: 0,
      fallFrom: 0,
      fallTarget: 0,
      fallCar: null,
      escT: 0,
      escId: -1,
      escUp: true,
      frozenT: 0,
      invulnT: 0,
      shootCd: 0,
      standT: 0,
      moving: false,
      slideDir: 0,
      lastSafe: { x: start.x, floor: start.floor },
      alive: true,
    };

    this.janitor = { x: 360, dir: 1, floor: 4, mopT: 0, cooldownT: MOP_INTERVAL_FRAMES };
    this.cop = { x: 300, floor: 1 + this.rng.int(0, 3), facing: 1, chaseT: 0, minX: 40, maxX: 700 };

    // Walkers on 2F (floor index 3), patrolling stretches between the shafts.
    [
      { minX: 136, maxX: 300 },
      { minX: 368, maxX: 500 },
    ].forEach((r, i) =>
      this.walkers.push({ id: i + 1, x: r.minX + 20, floor: 3, dir: i === 0 ? 1 : -1, minX: r.minX, maxX: r.maxX, bubbleT: 0 }),
    );

    for (const p of PROPS) {
      if (p.kind === 'lamp') this.lamps.push({ id: p.id, x: p.x, floor: p.floor, state: 'hanging', fallT: 0 });
      if (p.kind === 'disco') this.discos.push({ id: p.id, x: p.x, floor: p.floor, state: 'hanging', fallT: 0, dir: 1 });
      if (p.kind === 'fountain') this.fountains.push({ id: p.id, x: p.x, floor: p.floor, cool: 0 });
    }

    if (opts.arrival) this.arrival = { phase: 'slide', t: 0 };
    this.updateCamera();
  }

  // ---------------------------------------------------------------- public API

  /** Advance one 60 Hz frame. Returns the events this frame produced. */
  step(input: StepInput): MallEvent[] {
    this.events = [];
    this.frame++;
    if (this.arrival) {
      this.stepArrival(input);
      this.updateCamera();
      return this.flush();
    }

    this.tickTimers();
    this.updatePlayer(input);
    this.updateCars(input);
    this.updateNpcs();
    this.updateSpies();
    this.updateBullets();
    this.updateLampsAndDiscos();
    this.updateFountainsAndCoins();
    this.updateAlarmAndPa();
    this.updateCamera();
    return this.flush();
  }

  /** The game calls this after the death animation. Lives are the game's business; this only places the agent. */
  respawn(): void {
    const p = this.player;
    p.mode = 'walk';
    p.car = null;
    p.fallCar = null;
    p.x = p.lastSafe.x;
    p.floor = p.lastSafe.floor;
    p.y = floorY(p.floor);
    p.alive = true;
    p.frozenT = 0;
    p.slideDir = 0;
    p.invulnT = 2 * SEC;
    this.spies.length = 0;
    this.bullets.length = 0;
    this.bubbles.length = 0;
    this.cars.forEach((c) => (c.occupied = false));
  }

  /** Continue: the agent comes back where he fell, with a short invulnerability. */
  respawnAt(spot: { x: number; floor: number }): void {
    this.respawn();
    this.player.x = Math.min(Math.max(spot.x, 0), MALL_W - AGENT_W);
    this.player.floor = spot.floor;
    this.player.y = floorY(spot.floor);
  }

  /** Returns the agent to the door of the store he just left. */
  returnFromStore(store: StoreDef): void {
    const p = this.player;
    p.mode = 'walk';
    p.floor = store.floor;
    p.y = floorY(store.floor);
    p.x = doorX(store);
    p.lastSafe = { x: p.x, floor: p.floor };
    p.invulnT = SEC / 2;
  }

  activateAlarm(): void {
    if (this.alarm) return;
    this.alarm = true;
    this.emit({ type: 'alarm' });
    this.emit({ type: 'banner', lines: ['ALARM! SECURITY ALERTED'], frames: 3 * SEC });
  }

  /** The floor the agent is on, following him into cars. Null while on a roof. */
  get playerFloor(): number | null {
    if (this.player.mode === 'car' && this.player.car) return this.player.car.floor;
    if (this.player.mode === 'roof') return null;
    return this.player.floor;
  }

  get spyCap(): number {
    return this.difficulty.maxSpies;
  }

  /** The height of the visible mall window in world coordinates. */
  get viewH(): number {
    return VIEW_H;
  }

  get worldH(): number {
    return WORLD_H;
  }

  // ---------------------------------------------------------------- helpers

  private emit(e: MallEvent): void {
    this.events.push(e);
  }

  private flush(): MallEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private sfx(name: SfxName): void {
    this.emit({ type: 'sfx', name });
  }

  private bubble(x: number, floor: number, text: string, frames = 2 * SEC): void {
    this.bubbles.push({ x, floor, text, t: frames });
    this.emit({ type: 'bubble', x, y: floorY(floor) - AGENT_H - 6, text });
  }

  private playerCenter(): number {
    return this.player.x + AGENT_W / 2;
  }

  /** Index of the shaft whose opening column contains x, serving this floor (or -1). */
  private shaftAt(x: number, floor: number): number {
    return SHAFTS.findIndex((s, i) => {
      const serves = floor >= s.minFloor && floor <= s.maxFloor;
      return serves && x >= s.x && x <= s.x + SHAFT_W && this.cars[i] !== undefined;
    });
  }

  /** A shaft opening where the car is below the floor: a pit. */
  private pitAt(x: number, floor: number): Car | null {
    const i = this.shaftAt(x, floor);
    if (i < 0) return null;
    const car = this.cars[i];
    return car.y > floorY(floor) ? car : null;
  }

  private hurt(cause: string, absorbable: boolean): void {
    const p = this.player;
    if (p.mode === 'dead' || p.mode === 'hidden' || p.mode === 'frozen' || p.mode === 'selfie') return;
    if (p.invulnT > 0 || this.powerUps.isInvincible) return;
    if (absorbable && this.powerUps.absorbHit()) {
      p.invulnT = SEC;
      this.emit({ type: 'hurt' });
      this.sfx('hurt');
      return;
    }
    this.kill(cause);
  }

  private kill(cause: string): void {
    const p = this.player;
    if (p.mode === 'dead') return;
    if (p.car) p.car.occupied = false;
    p.car = null;
    p.mode = 'dead';
    this.sfx('death');
    this.emit({ type: 'death', cause });
  }

  private score(points: number, x: number, floor: number): void {
    this.emit({ type: 'score', points, x, y: floorY(floor) - 28 });
  }

  // ---------------------------------------------------------------- timers

  private tickTimers(): void {
    const p = this.player;
    if (p.invulnT > 0) p.invulnT--;
    if (p.shootCd > 0) p.shootCd--;
    this.bubbles.forEach((b) => b.t--);
    this.bubbles.splice(0, this.bubbles.length, ...this.bubbles.filter((b) => b.t > 0));
    if (this.kioskShow && --this.kioskShow.t <= 0) this.kioskShow = null;
    this.darkZones.forEach((z) => z.t--);
    this.darkZones.splice(0, this.darkZones.length, ...this.darkZones.filter((z) => z.t > 0));
    for (const [id, t] of this.kioskCool) if (t > 0) this.kioskCool.set(id, t - 1);
    if (this.wet && --this.wet.t <= 0) this.wet = null;
    if (p.mode === 'frozen' && --p.frozenT <= 0) p.mode = 'walk';
    if (p.mode === 'hidden') {
      // Hidden inside the booth. Time out after 5 s.
      p.standT++;
      if (p.standT >= 5 * SEC) this.leaveBooth();
    }
    this.spyTimer--;
    if (this.spyTimer <= 0) {
      this.trySpawnSpy();
      this.resetSpyTimer();
    }
  }

  private resetSpyTimer(): void {
    const rate = this.difficulty.spawnRate * (this.alarm ? 1.5 : 1);
    const base = (6 * SEC) / rate;
    this.spyTimer = Math.round(base * (0.8 + 0.4 * this.rng.next()));
  }

  private updateAlarmAndPa(): void {
    if (--this.paTimer <= 0) {
      this.paTimer = 60 * SEC + this.rng.int(0, 20 * SEC);
      let i = this.rng.int(0, PA_LINES.length - 1);
      if (i === this.lastPa) i = (i + 1) % PA_LINES.length;
      this.lastPa = i;
      this.sfx('pa');
      this.emit({ type: 'banner', lines: PA_LINES[i], frames: 3 * SEC });
    }
  }

  // ---------------------------------------------------------------- arrival

  private stepArrival(input: StepInput): void {
    const a = this.arrival!;
    a.t++;
    if (a.phase === 'slide' && a.t === 1) this.sfx('zip');
    if (a.phase === 'slide' && a.t >= 150) {
      a.phase = 'drop';
      a.t = 0;
    } else if (a.phase === 'drop' && a.t >= 30) {
      a.phase = 'land';
      a.t = 0;
      this.sfx('thud');
    } else if (a.phase === 'land' && a.t >= 24) {
      a.phase = 'selfie';
      a.t = 0;
      this.sfx('flash');
      const post = this.rng.pick(SPYGRAM_ARRIVAL);
      this.emit({ type: 'spygram', post });
    } else if (a.phase === 'selfie') {
      if (input.pressed.length > 0 || a.t >= 2.5 * SEC) this.endArrival();
    }
    this.player.mode = a.phase === 'selfie' ? 'selfie' : 'frozen';
    this.player.frozenT = 0;
  }

  /** Ends the zip-line sequence and hands control to the player. */
  private endArrival(): void {
    this.arrival = null;
    const p = this.player;
    p.mode = 'walk';
    p.x = PLAYER_START_X;
    p.floor = 0;
    p.y = floorY(0);
    p.invulnT = 0;
    p.lastSafe = { x: p.x, floor: 0 };
    this.emit({ type: 'banner', lines: ['SPY ON THE ROOF', 'FIND 6 PACKAGES'], frames: 2 * SEC });
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(input: StepInput): void {
    const p = this.player;
    p.moving = false;
    const held = input.held;
    const pressed = new Set<Pad>(input.pressed);
    switch (p.mode) {
      case 'dead':
        return;
      case 'frozen':
        return;
      case 'hidden':
        if (pressed.has('up')) this.leaveBooth();
        return;
      case 'car':
        this.updateInCar(pressed);
        return;
      case 'roof':
        this.updateOnRoof(pressed);
        return;
      case 'escalator':
        this.updateEscalator();
        return;
      case 'fall':
        this.updateFall();
        return;
      case 'jump':
        this.updateJump(held);
        return;
      case 'walk':
        this.updateWalk(held, pressed);
        return;
      case 'selfie':
        return;
    }
  }

  private updateWalk(held: ReadonlySet<Pad>, pressed: ReadonlySet<Pad>): void {
    const p = this.player;

    // Wet floor: once in the patch, slide to its far side. Input can't stop or turn you.
    if (this.wet && this.insideWet(this.playerCenter())) {
      if (p.slideDir === 0) p.slideDir = p.facing;
      p.x += p.slideDir * WALK_SPEED;
      p.facing = p.slideDir;
      this.clampPlayerX();
      if (pressed.has('b')) this.startJump(held, true);
      return;
    }
    p.slideDir = 0;

    if (pressed.has('up') && this.tryUpAction()) return;
    if (pressed.has('down') && this.tryDownAction()) return;
    if (pressed.has('b') && !held.has('down')) {
      this.startJump(held, false);
      return;
    }
    p.ducking = held.has('down');

    if (pressed.has('a') || held.has('a')) this.tryFire(held.has('down'));

    if (!p.ducking) {
      const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      if (dx !== 0) {
        p.facing = dx as -1 | 1;
        p.x += dx * WALK_SPEED * this.powerUps.walkMultiplier;
        p.moving = true;
        this.clampPlayerX();
        p.standT = 0;
      }
    }
    this.afterFloorMove();
    this.autoCallStanding();
  }

  /** Standing still in a shaft opening for half a second calls the car. */
  private autoCallStanding(): void {
    const p = this.player;
    const i = this.shaftAt(this.playerCenter(), p.floor);
    const car = i >= 0 ? this.cars[i] : null;
    if (!car || p.mode !== 'walk' || car.floor === p.floor || car.occupied || p.ducking) {
      p.standT = 0;
      return;
    }
    if (++p.standT >= SEC / 2) {
      car.call(p.floor);
      p.standT = 0;
    }
  }

  /** Called after any floor movement: pits, shaft boarding, the safe spot. */
  private afterFloorMove(): void {
    const p = this.player;
    if (p.mode !== 'walk') return;
    const car = this.pitAt(this.playerCenter(), p.floor);
    if (car) {
      p.mode = 'fall';
      p.fallCar = car;
      p.fallTarget = car.top;
      p.fallFrom = floorY(p.floor);
      p.y = p.fallFrom;
      return;
    }
    const i = this.shaftAt(this.playerCenter(), p.floor);
    if (i >= 0) {
      const car = this.cars[i];
      const c = this.playerCenter();
      if (car.floor === p.floor && !car.moving && !car.occupied && c >= car.x && c <= car.x + CAR_W) {
        this.board(car);
        return;
      }
    }
    if (this.frame % 30 === 0 && p.mode === 'walk') p.lastSafe = { x: p.x, floor: p.floor };
  }

  private clampPlayerX(): void {
    this.player.x = Math.min(Math.max(this.player.x, 0), MALL_W - AGENT_W);
  }

  private insideWet(cx: number): boolean {
    return !!this.wet && cx >= this.wet.x0 && cx <= this.wet.x1;
  }

  private startJump(held: ReadonlySet<Pad>, fromSlide: boolean): void {
    const p = this.player;
    p.mode = 'jump';
    p.jumpT = 0;
    const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    p.jumpDir = fromSlide ? (p.slideDir as -1 | 1) : (dx as -1 | 0 | 1);
    p.jumpKick = fromSlide || dx !== 0;
    if (p.jumpDir !== 0) p.facing = p.jumpDir as -1 | 1;
    p.slideDir = 0;
    this.emit({ type: 'sfx', name: 'jump' });
  }

  private updateJump(held: ReadonlySet<Pad>): void {
    const p = this.player;
    p.jumpT++;
    const h = Math.max(0, JUMP_PEAK - 0.2 * (p.jumpT - 10) ** 2);
    p.y = floorY(p.floor) - h;
    if (p.jumpKick) {
      p.x += p.jumpDir * WALK_SPEED * 1.5;
    } else {
      const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      p.x += dx * WALK_SPEED;
    }
    this.clampPlayerX();
    if (p.jumpT >= JUMP_FRAMES) {
      p.y = floorY(p.floor);
      p.mode = 'walk';
      p.jumpKick = false;
      p.jumpDir = 0;
      this.afterFloorMove();
    }
  }

  private tryFire(ducking: boolean): void {
    const p = this.player;
    if (p.shootCd > 0) return;
    const limit = this.powerUps.maxBullets * (this.powerUps.weapon?.id === 'spread' ? 3 : 1);
    if (this.bullets.filter((b) => b.owner === 'player').length >= limit) return;
    if (p.mode === 'roof') return;
    const y = p.mode === 'car' && p.car ? p.car.y - 16 : floorY(p.floor) - (ducking ? 4 : 16);
    const floor = p.mode === 'car' && p.car ? (p.car.floor ?? 0) : p.floor;
    const volley = ++this.volleyId;
    const shots = this.powerUps.weapon?.id === 'spread' ? [-6, 0, 6] : [0];
    for (const dy of shots) {
      this.bullets.push({ owner: 'player', x: p.x + 8, y: y + dy, dx: p.facing, floor, volley, life: 60 });
    }
    p.shootCd = this.powerUps.weapon?.id === 'rapid' ? RAPID_COOLDOWN : SHOT_COOLDOWN;
    this.sfx('shot');
    // The cop only cares about shots fired in front of him on his floor.
    if (copSpotsShot(this.cop, { x: p.x + 8, floor })) this.copSpotted();
  }

  private copSpotted(): void {
    if (this.cop.chaseT > 0) {
      this.cop.chaseT = COP_CHASE_FRAMES;
      return;
    }
    this.cop.chaseT = COP_CHASE_FRAMES;
    this.sfx('whistle');
    this.bubble(this.cop.x, this.cop.floor, 'HEY! STOP RIGHT THERE!', 2 * SEC);
  }

  /** Up on a floor: door, car, escalator, kiosk, booth, wagon. Returns true if something happened. */
  private tryUpAction(): boolean {
    const p = this.player;
    if (p.mode !== 'walk') return false;
    const c = this.playerCenter();

    const store = this.doorAt(c, p.floor);
    if (store) {
      if (this.opts.doorOpen(store.id)) {
        this.emit({ type: 'enterStore', storeId: store.id });
        this.sfx('door');
      } else {
        this.sfx('buzzer');
      }
      return true;
    }
    if (this.tryCarButton()) return true;
    const e = ESCALATORS.find((x) => x.lowerFloor === p.floor && c >= x.x - 4 && c <= x.x + 12);
    if (e) {
      this.boardEscalator(e, true);
      return true;
    }
    return this.tryPropButton();
  }

  private tryDownAction(): boolean {
    const p = this.player;
    if (p.mode !== 'walk') return false;
    const c = this.playerCenter();
    const e = ESCALATORS.find((x) => x.upperFloor === p.floor && c >= x.x + ESCALATOR_W - 8 && c <= x.x + ESCALATOR_W + 8);
    if (e) {
      this.boardEscalator(e, false);
      return true;
    }
    if (this.tryCarButton()) return true;
    return this.tryPropButton();
  }

  /** Up/Down at a shaft: board a car that is level with us, or call one to this floor. */
  private tryCarButton(): boolean {
    const p = this.player;
    const c = this.playerCenter();
    const i = SHAFTS.findIndex((s, idx) => s.minFloor <= p.floor && p.floor <= s.maxFloor && c >= s.x - 8 && c <= s.x + SHAFT_W + 8 && this.cars[idx] !== undefined);
    if (i < 0) return false;
    const car = this.cars[i];
    if (car.floor === p.floor && !car.moving && !car.occupied && c >= car.x && c <= car.x + CAR_W) {
      this.board(car);
      return true;
    }
    if (car.floor !== p.floor && !car.occupied) {
      car.call(p.floor);
      this.sfx('blip');
      return true;
    }
    return false;
  }

  private tryPropButton(): boolean {
    const p = this.player;
    const c = this.playerCenter();
    for (const prop of PROPS) {
      if (prop.floor !== p.floor) continue;
      if (c < prop.x - 6 || c > prop.x + prop.w + 6) continue;
      if (prop.kind === 'kiosk') {
        if ((this.kioskCool.get(prop.id) ?? 0) > 0) return true;
        this.kioskCool.set(prop.id, KIOSK_COOLDOWN_FRAMES);
        const storeId = nearestPackageStore({ x: p.x, floor: p.floor }, this.opts.remaining());
        this.kioskShow = { storeId, t: KIOSK_SHOW_FRAMES };
        this.emit({ type: 'kiosk', storeId });
        this.sfx('blip');
        return true;
      }
      if (prop.kind === 'booth') {
        p.mode = 'hidden';
        p.standT = 0;
        this.sfx('pop');
        if (!this.photoTaken) {
          this.photoTaken = true;
          this.emit({ type: 'photo' });
        }
        return true;
      }
      if (prop.kind === 'wagon') {
        this.tryExit();
        return true;
      }
    }
    return false;
  }

  private tryExit(): void {
    if (this.exited) return;
    if (this.opts.remaining().size > 0) {
      this.emit({ type: 'pkgsLeft', n: this.opts.remaining().size });
      this.sfx('buzzer');
      return;
    }
    this.exited = true;
    this.emit({ type: 'levelClear' });
  }

  /** The store whose door the agent stands in front of on this floor, or null. */
  private doorAt(c: number, floor: number): StoreDef | null {
    for (const s of STORES) {
      if (s.floor !== floor) continue;
      const dx = doorX(s);
      if (c >= dx - 2 && c <= dx + STORE_DOOR_W + 2) return s;
    }
    return null;
  }

  private leaveBooth(): void {
    if (this.player.mode !== 'hidden') return;
    this.player.mode = 'walk';
    this.player.standT = 0;
    this.sfx('pop');
  }

  // ---------------------------------------------------------------- elevators

  private board(car: Car): void {
    const p = this.player;
    p.mode = 'car';
    p.car = car;
    car.occupied = true;
    p.x = car.x + (CAR_W - AGENT_W) / 2;
    p.y = car.y;
    p.floor = car.floor ?? p.floor;
    this.sfx('door');
  }

  private updateInCar(pressed: ReadonlySet<Pad>): void {
    const p = this.player;
    const car = p.car;
    if (!car) {
      p.mode = 'walk';
      return;
    }
    if (!car.moving && car.floor !== null) {
      if (pressed.has('left') || pressed.has('right')) {
        const left = pressed.has('left');
        car.occupied = false;
        p.car = null;
        p.mode = 'walk';
        p.floor = car.floor;
        p.y = floorY(car.floor);
        p.x = left ? car.x - AGENT_W : car.x + CAR_W;
        p.facing = left ? -1 : 1;
        this.clampPlayerX();
        this.sfx('door');
        this.afterFloorMove();
        return;
      }
    }
    // Cars are stepped in updateCars(); the occupant only chooses the direction.
    p.y = car.y;
    p.x = car.x + (CAR_W - AGENT_W) / 2;
    p.floor = car.floor ?? p.floor;
    p.standT = 0;
  }

  private updateOnRoof(pressed: ReadonlySet<Pad>): void {
    const p = this.player;
    const car = p.car;
    if (!car) {
      p.mode = 'walk';
      return;
    }
    p.x = car.x + (CAR_W - AGENT_W) / 2;
    p.y = car.top;
    if (car.floor !== null && !car.moving && (pressed.has('left') || pressed.has('right'))) {
      const left = pressed.has('left');
      p.mode = 'walk';
      p.car = null;
      p.floor = car.floor;
      p.y = floorY(car.floor);
      p.x = left ? car.x - AGENT_W : car.x + CAR_W;
      this.clampPlayerX();
      this.afterFloorMove();
    }
  }

  private boardEscalator(e: (typeof ESCALATORS)[number], up: boolean): void {
    const p = this.player;
    p.mode = 'escalator';
    p.escId = ESCALATORS.indexOf(e);
    p.escUp = up;
    p.escT = up ? 0 : ESCALATOR_W;
    this.sfx('blip');
  }

  private updateEscalator(): void {
    const p = this.player;
    const e = ESCALATORS[p.escId];
    const lowerY = floorY(e.lowerFloor);
    p.escT += p.escUp ? 1 : -1;
    p.x = e.x + p.escT;
    p.y = lowerY - p.escT;
    if (p.escUp && p.escT >= ESCALATOR_W) {
      p.mode = 'walk';
      p.floor = e.upperFloor;
      p.y = floorY(e.upperFloor);
      p.x = e.x + ESCALATOR_W;
    } else if (!p.escUp && p.escT <= 0) {
      p.mode = 'walk';
      p.floor = e.lowerFloor;
      p.y = floorY(e.lowerFloor);
      p.x = e.x;
    }
    this.clampPlayerX();
  }

  private updateFall(): void {
    const p = this.player;
    p.y += FALL_SPEED;
    if (p.y < p.fallTarget) return;
    const distance = p.fallTarget - p.fallFrom;
    p.y = p.fallTarget;
    if (distance > SAFE_FALL_DISTANCE || !p.fallCar || !this.carUnder(p.fallCar)) {
      this.kill('fell');
      return;
    }
    // Safe landing on the roof of the car below.
    p.mode = 'roof';
    p.car = p.fallCar;
    p.fallCar = null;
    this.sfx('thud');
  }

  private carUnder(car: Car): boolean {
    const c = this.playerCenter();
    return c >= car.x - 4 && c <= car.x + CAR_W + 4;
  }

  private updateCars(input: StepInput): void {
    const p = this.player;
    const drive: -1 | 0 | 1 = input.held.has('up') ? -1 : input.held.has('down') ? 1 : 0;
    this.cars.forEach((car, i) => {
      const drives = p.mode === 'car' && p.car === car ? drive : 0;
      const events: CarEvent[] = car.step(drives, this.rng);
      for (const ev of events) {
        if (ev.type !== 'ding') continue;
        const near = Math.abs(car.x - p.x) < 96;
        if (near || (p.mode === 'car' && p.car === car)) this.sfx('ding');
        if (p.mode === 'car' && p.car === car) {
          this.emit({ type: 'banner', lines: [FLOOR_ANNOUNCE[FLOOR_NAMES[ev.floor]]], frames: 2 * SEC });
        }
        if (near && this.rng.chance(0.3)) this.spawnFromElevator(i, ev.floor);
      }
    });
    // Keep riders with their cars, then check crushes.
    if (p.mode === 'car' && p.car) {
      p.y = p.car.y;
      p.x = p.car.x + (CAR_W - AGENT_W) / 2;
      p.floor = p.car.floor ?? p.floor;
    }
    if (p.mode === 'roof' && p.car) {
      p.x = p.car.x + (CAR_W - AGENT_W) / 2;
      p.y = p.car.top;
      if (p.car.y <= p.car.minY && p.car.moving) this.kill('crushed against the shaft roof');
    }
    this.cars.forEach((car) => {
      if (!car.moving || car.dir <= 0) return; // only a car coming down can crush
      if (p.mode !== 'walk' || p.floor < 0) return;
      const c = this.playerCenter();
      if (!(c >= car.x - 4 && c <= car.x + CAR_W + 4)) return;
      const overlap = car.y > p.y - AGENT_H && car.top < p.y;
      if (!overlap) return;
      if (car.calledFloor === p.floor) {
        this.board(car);
      } else {
        this.kill('crushed by an elevator');
      }
    });
  }

  /** A car that stops near the agent sometimes lets a spy out. */
  private spawnFromElevator(shaft: number, floor: number): void {
    if (this.spies.filter((s) => s.mode !== 'dying').length >= this.spyCap) return;
    const car = this.cars[shaft];
    const spy = this.makeSpy(car.x + 4, floor, this.rng.sign(), 0);
    spy.mode = 'fresh';
    spy.freshT = 20;
    this.bubble(spy.x, floor, this.rng.pick(SPY_ELEVATOR_LINES), 2 * SEC);
  }

  // ---------------------------------------------------------------- spies

  private makeSpy(x: number, floor: number, facing: -1 | 1, freshT: number): Spy {
    const spy: Spy = {
      id: this.nextId++,
      x,
      floor,
      facing,
      mode: freshT > 0 ? 'fresh' : 'wander',
      age: 0,
      freshT,
      aimT: 0,
      aimHigh: true,
      nextShot: 0,
      waitT: 0,
      lastVolley: -1,
      ducking: 0,
      deathT: 0,
      lastWords: null,
    };
    this.spies.push(spy);
    return spy;
  }

  private trySpawnSpy(): void {
    const p = this.player;
    if (p.mode === 'dead' || p.mode === 'selfie' || p.mode === 'roof' || this.arrival) return;
    const alive = this.spies.filter((s) => s.mode !== 'dying').length;
    if (alive >= this.spyCap) return;
    const pf = this.playerFloor;
    if (pf === null) return;
    const candidates = STORES.filter((s) => {
      if (!this.opts.doorOpen(s.id) || s.role === 'closed') return false;
      if (Math.abs(s.floor - pf) > 1) return false;
      const d = Math.abs(doorX(s) - p.x);
      return d >= 64 && d <= 200;
    });
    if (candidates.length === 0) return;
    const store = this.rng.pick(candidates);
    this.makeSpy(doorX(store), store.floor, store.x + 40 > p.x ? -1 : 1, 30);
    this.sfx('door');
  }

  private updateSpies(): void {
    const p = this.player;
    const speed = 0.6 * this.difficulty.spySpeed * (this.alarm ? 1.25 : 1);
    for (const spy of this.spies) {
      if (spy.mode === 'dying') {
        spy.deathT--;
        continue;
      }
      spy.age++;
      if (spy.ducking > 0) spy.ducking--;
      if (spy.mode === 'fresh') {
        spy.x += spy.facing * speed;
        if (--spy.freshT <= 0) spy.mode = 'wander';
        continue;
      }
      // Blind to hidden, dying, zipping and posing players.
      const blind = p.mode === 'hidden' || p.mode === 'dead' || p.mode === 'selfie' || p.mode === 'frozen' || this.arrival !== null;
      const pf = this.playerFloor;
      const dx = p.x + AGENT_W / 2 - (spy.x + AGENT_W / 2);
      const seen = !blind && pf === spy.floor && Math.abs(dx) <= 160;
      if (seen) {
        spy.facing = dx > 0 ? 1 : -1;
        if (spy.mode === 'aim') {
          if (--spy.aimT <= 0) this.fireSpy(spy);
          continue; // a spy holds still while aiming, so the shot is telegraphed
        }
        if (Math.abs(dx) > 40) this.stepSpy(spy, spy.facing, speed);
        if (spy.nextShot > 0) spy.nextShot--;
        // The first shot waits until spyMayFire (about 2 s after the spy appears).
        if (spy.nextShot <= 0 && spyMayFire(spy.age) && Math.abs(dx) <= CHECK_SHOT_RANGE) {
          spy.mode = 'aim';
          spy.aimT = SPY_TELEGRAPH_FRAMES;
          spy.aimHigh = this.rng.chance(0.5);
        }
        continue;
      }
      spy.mode = spy.mode === 'aim' ? 'wander' : spy.mode;
      if (spy.mode === 'wait') {
        if (--spy.waitT <= 0) spy.mode = 'wander';
        continue;
      }
      if (this.rng.chance(1 / 240)) spy.facing = this.rng.sign();
      if (this.rng.chance(1 / 600)) {
        spy.mode = 'wait';
        spy.waitT = 3 * SEC;
        continue;
      }
      this.stepSpy(spy, spy.facing, speed * 0.6);
    }
    // Interactions with the agent, cars, bullets and walkers.
    for (const spy of this.spies) {
      if (spy.mode === 'dying') continue;
      this.checkSpyTouch(spy);
      this.checkSpyCrush(spy);
    }
    this.spies.splice(0, this.spies.length, ...this.spies.filter((s) => s.mode !== 'dying' || s.deathT > 0));
  }

  private stepSpy(spy: Spy, dir: -1 | 1, speed: number): void {
    const next = spy.x + dir * speed;
    const cx = next + AGENT_W / 2;
    if (next < 0 || next > MALL_W - AGENT_W || this.pitAt(cx, spy.floor)) {
      spy.facing = (dir === 1 ? -1 : 1) as -1 | 1;
      return;
    }
    spy.x = next;
  }

  private fireSpy(spy: Spy): void {
    this.bullets.push({
      owner: 'spy',
      x: spy.x + 8,
      y: floorY(spy.floor) - (spy.aimHigh ? 20 : 6),
      dx: spy.facing,
      floor: spy.floor,
      volley: -1,
      life: 200,
    });
    this.sfx('enemyShot');
    spy.mode = 'wander';
    spy.nextShot = Math.round(this.difficulty.shotIntervalFrames * (0.8 + 0.4 * this.rng.next()));
  }

  private checkSpyTouch(spy: Spy): void {
    const p = this.player;
    if (p.mode === 'dead' || p.mode === 'hidden' || p.mode === 'frozen') return;
    if (this.pf() !== spy.floor) return;
    const overlap = Math.abs(p.x - spy.x) < AGENT_W - 2;
    if (!overlap) return;
    if (p.mode === 'jump' && p.jumpKick) {
      this.killSpy(spy, this.insideWet(this.playerCenter()) ? POINTS.spyWetSlideKill : POINTS.spyShot);
      return;
    }
    this.hurt('touched a spy', true);
  }

  private pf(): number | null {
    return this.playerFloor;
  }

  private checkSpyCrush(spy: Spy): void {
    for (const car of this.cars) {
      if (!car.moving || car.dir <= 0) continue;
      const cx = spy.x + AGENT_W / 2;
      if (cx < car.x - 4 || cx > car.x + CAR_W + 4) continue;
      const fy = floorY(spy.floor);
      if (car.y > fy - AGENT_H && car.top < fy) {
        this.killSpy(spy, POINTS.spyCrushed);
        this.emit({ type: 'sfx', name: 'crush' });
        return;
      }
    }
  }


  private killSpy(spy: Spy, points: number): void {
    spy.mode = 'dying';
    spy.deathT = 24;
    this.score(points, spy.x, spy.floor);
    this.sfx('death');
    if (this.rng.chance(0.35)) {
      spy.lastWords = this.rng.pick(SPY_LAST_WORDS);
      this.bubble(spy.x, spy.floor, spy.lastWords, 2 * SEC);
    }
    if (this.rng.chance(0.05)) {
      const food: PowerUpId[] = ['juli', 'cinnabomb', 'pretzel'];
      const other: PowerUpId[] = ['radar', 'rapid', 'spread', 'armor', 'sneakers', 'oneup'];
      const id = this.rng.chance(0.5) ? this.rng.pick(food) : this.rng.pick(other);
      this.items.push({ id, x: spy.x, floor: spy.floor, ttl: 10 * SEC });
    }
  }

  // ---------------------------------------------------------------- NPCs

  private updateNpcs(): void {
    const p = this.player;
    // Walkers: back and forth, push the agent along when touched.
    for (const w of this.walkers) {
      w.x += w.dir * WALKER_SPEED;
      if (w.x <= w.minX || w.x >= w.maxX) w.dir = (w.dir === 1 ? -1 : 1) as -1 | 1;
      if (w.bubbleT > 0) w.bubbleT--;
      if (p.mode === 'walk' && p.floor === w.floor && Math.abs(p.x + 8 - (w.x + 8)) < 14) {
        p.x += w.dir * WALKER_PUSH;
        this.clampPlayerX();
      }
    }
    // Janitor: harmless, mops periodically.
    const j = this.janitor;
    if (j.mopT > 0) {
      if (--j.mopT === 0) this.finishMop();
    } else {
      j.x += j.dir * WALKER_SPEED;
      const next = j.x + j.dir * 8 + 8;
      if (j.x < 24 || j.x > MALL_W - 40 || this.pitAt(next, j.floor)) j.dir = (j.dir === 1 ? -1 : 1) as -1 | 1;
      if (--j.cooldownT <= 0) {
        const x0 = j.x + 8 - WET_PATCH_W / 2;
        if (patchReachesShaft(x0, x0 + WET_PATCH_W, j.floor)) {
          j.cooldownT = 60;
        } else {
          j.mopT = 60;
          j.cooldownT = MOP_INTERVAL_FRAMES;
          this.sfx('mop');
        }
      }
    }
    // Cop on a Segway: patrols his floor, chases after a spotted shot.
    const cop = this.cop;
    if (cop.chaseT > 0) {
      cop.chaseT--;
      if (this.pf() === cop.floor) {
        cop.facing = p.x > cop.x ? 1 : -1;
        cop.x += cop.facing * WALK_SPEED;
        if (Math.abs(p.x - cop.x) < AGENT_W - 2 && p.mode === 'walk') {
          p.mode = 'frozen';
          p.frozenT = COP_FREEZE_FRAMES;
          this.score(POINTS.copCaught, p.x, p.floor);
          this.emit({ type: 'copCaught' });
          this.sfx('whistle');
          cop.chaseT = 0;
        }
      }
    } else {
      cop.x += cop.facing * WALKER_SPEED;
      if (cop.x < cop.minX || cop.x > cop.maxX || this.pitAt(cop.x + 8 + cop.facing * 8, cop.floor)) {
        cop.facing = (cop.facing === 1 ? -1 : 1) as -1 | 1;
      }
    }
    // Wet patch slide: once the agent is off the patch, the slide ends (handled in updateWalk).
  }

  private finishMop(): void {
    const j = this.janitor;
    const x0 = j.x + 8 - WET_PATCH_W / 2;
    this.wet = { x0, x1: x0 + WET_PATCH_W, t: WET_PATCH_FRAMES };
    this.sfx('mop');
  }

  // ---------------------------------------------------------------- bullets & props

  private updateBullets(): void {
    for (const b of this.bullets) {
      b.x += b.dx * (b.owner === 'player' ? PLAYER_BULLET_SPEED : SPY_BULLET_SPEED);
      b.life--;
    }
    for (const b of this.bullets) {
      if (b.life <= 0 || b.x < -8 || b.x > MALL_W + 8) {
        b.life = 0;
        continue;
      }
      if (b.owner === 'player') this.playerBulletHits(b);
      else this.spyBulletHits(b);
    }
    this.bullets.splice(0, this.bullets.length, ...this.bullets.filter((b) => b.life > 0));
  }

  private playerBulletHits(b: Bullet): void {
    // Spies.
    for (const spy of this.spies) {
      if (spy.mode === 'dying' || spy.floor !== b.floor) continue;
      if (b.y < floorY(spy.floor) - AGENT_H || b.y > floorY(spy.floor)) continue;
      if (b.x < spy.x || b.x > spy.x + AGENT_W) continue;
      // Each spy rolls once per volley to duck; a ducking spy lets the bullet pass.
      const roll = rollVolleyDodge(this.rng, spy.lastVolley, b.volley);
      if (roll.rolled) spy.lastVolley = b.volley;
      if (roll.ducks) {
        spy.ducking = SPY_DUCK_FRAMES;
        continue;
      }
      if (spy.ducking > 0) continue;
      this.killSpy(spy, POINTS.spyShot);
      b.life = 0;
      return;
    }
    // Walkers: the bullet stops, they never die. Shooting one costs points.
    for (const w of this.walkers) {
      if (w.floor !== b.floor) continue;
      if (b.x < w.x - 2 || b.x > w.x + AGENT_W + 2) continue;
      if (b.y < floorY(w.floor) - AGENT_H || b.y > floorY(w.floor)) continue;
      this.score(POINTS.walkerShot, w.x, w.floor);
      w.bubbleT = 2 * SEC;
      this.bubble(w.x, w.floor, 'HEY!', 2 * SEC);
      this.sfx('ping');
      b.life = 0;
      return;
    }
    // The cop's helmet pings.
    if (this.cop.floor === b.floor && b.x > this.cop.x && b.x < this.cop.x + AGENT_W && b.y > floorY(b.floor) - AGENT_H) {
      this.sfx('ping');
      b.life = 0;
      return;
    }
    // Lamps (cord and shade), discos, fountains.
    for (const lamp of this.lamps) {
      if (lamp.state !== 'hanging' || lamp.floor !== b.floor) continue;
      if (b.x >= lamp.x + 4 && b.x <= lamp.x + 12 && b.y >= floorY(lamp.floor) - 30 && b.y <= floorY(lamp.floor) - 12) {
        lamp.state = 'falling';
        lamp.fallT = 12;
        this.sfx('glass');
        b.life = 0;
        return;
      }
    }
    for (const d of this.discos) {
      if (d.state !== 'hanging' || d.floor !== b.floor) continue;
      if (b.x >= d.x + 4 && b.x <= d.x + 12 && b.y >= floorY(d.floor) - 30 && b.y <= floorY(d.floor) - 12) {
        d.state = 'dropping';
        d.fallT = 12;
        d.dir = b.dx;
        this.sfx('lamp');
        b.life = 0;
        return;
      }
    }
    for (const f of this.fountains) {
      if (f.floor !== b.floor || b.x < f.x || b.x > f.x + 24) continue;
      if (b.y < floorY(f.floor) - 24 || b.y > floorY(f.floor)) continue;
      if (f.cool === 0) this.sprayFountain(f);
      b.life = 0;
      return;
    }
  }

  private spyBulletHits(b: Bullet): void {
    const p = this.player;
    for (const w of this.walkers) {
      if (w.floor === b.floor && b.x >= w.x && b.x <= w.x + AGENT_W) {
        b.life = 0;
        return;
      }
    }
    if (p.mode === 'hidden' || p.mode === 'dead') return;
    if (b.floor !== this.playerFloorForBullets()) return;
    const duck = p.mode === 'walk' && p.ducking;
    const top = duck ? floorY(p.floor) - 14 : p.y - AGENT_H;
    if (b.y < top || b.y > p.y) return;
    if (b.x < p.x - 2 || b.x > p.x + AGENT_W + 2) return;
    b.life = 0;
    this.hurt('shot', true);
  }

  private playerFloorForBullets(): number {
    return this.player.mode === 'car' && this.player.car ? this.player.car.floor ?? this.player.floor : this.player.floor;
  }

  private sprayFountain(f: Fountain): void {
    f.cool = 15 * SEC;
    const n = this.rng.int(3, 5);
    const gold = this.rng.chance(0.05);
    for (let i = 0; i < n; i++) {
      this.coins.push({
        x: f.x + 12,
        y: floorY(f.floor) - 20,
        vy: -3 - this.rng.next() * 2,
        floor: f.floor,
        gold: gold && i === 0,
        ttl: 6 * SEC,
      });
    }
    this.sfx('coin');
  }

  private updateLampsAndDiscos(): void {
    const p = this.player;
    for (const lamp of this.lamps) {
      if (lamp.state !== 'falling') continue;
      if (--lamp.fallT > 0) continue;
      lamp.state = 'gone';
      this.darkZones.push({ x0: lamp.x - 8, x1: lamp.x + 24, floor: lamp.floor, t: 2 * SEC });
      this.sfx('lamp');
      for (const spy of this.spies) {
        if (spy.floor === lamp.floor && spy.mode !== 'dying' && spy.x + AGENT_W > lamp.x - 8 && spy.x < lamp.x + 24) this.killSpy(spy, POINTS.spyLampKill);
      }
      if (p.floor === lamp.floor && p.mode === 'walk' && p.x + AGENT_W > lamp.x - 8 && p.x < lamp.x + 24) this.kill('a falling lamp');
    }
    for (const d of this.discos) {
      if (d.state === 'dropping' && --d.fallT <= 0) {
        d.state = 'rolling';
        this.sfx('lamp');
      }
      if (d.state !== 'rolling') continue;
      d.x += d.dir * 1.5;
      for (const spy of this.spies) {
        if (spy.floor === d.floor && spy.mode !== 'dying' && spy.x + AGENT_W > d.x && spy.x < d.x + 16) this.killSpy(spy, POINTS.spyDiscoKill);
      }
      if (p.floor === d.floor && p.mode === 'walk' && p.x + AGENT_W > d.x && p.x < d.x + 16) this.kill('a rolling disco ball');
      const ahead = d.x + (d.dir > 0 ? 16 : 0);
      if (d.x <= 0 || d.x >= MALL_W - 16 || this.pitAt(ahead, d.floor)) d.state = 'gone';
    }
    this.items.forEach((i) => i.ttl--);
    this.items.splice(0, this.items.length, ...this.items.filter((i) => i.ttl > 0));
    const picked = this.items.find((i) => p.mode === 'walk' && p.floor === i.floor && Math.abs(p.x - i.x) < 12);
    if (picked) {
      this.items.splice(this.items.indexOf(picked), 1);
      this.emit({ type: 'pickup', id: picked.id });
      this.sfx('powerup');
    }
  }

  private updateFountainsAndCoins(): void {
    const p = this.player;
    for (const f of this.fountains) if (f.cool > 0) f.cool--;
    for (const c of this.coins) {
      c.vy += 0.3;
      c.y += c.vy;
      const floorLine = floorY(c.floor) - 4;
      if (c.y >= floorLine) {
        c.y = floorLine;
        c.vy *= -0.4;
      }
      c.ttl--;
      if (p.mode === 'walk' && p.floor === c.floor && Math.abs(p.x + 8 - c.x) < 10) {
        c.ttl = 0;
        this.score(POINTS.coin, c.x, c.floor);
        if (c.gold) this.emit({ type: 'extraLife' });
        this.sfx('coin');
      }
    }
    this.coins.splice(0, this.coins.length, ...this.coins.filter((c) => c.ttl > 0));
  }

  // ---------------------------------------------------------------- camera

  private updateCamera(): void {
    const p = this.player;
    const feet = p.y;
    const maxX = MALL_W - 256;
    this.cameraX = Math.min(Math.max(p.x + AGENT_W / 2 - 128, 0), maxX);
    this.cameraY = Math.min(Math.max(feet - 120, 0), WORLD_H - VIEW_H);
  }
}

