import { Btn, type Pad } from '../../engine/pad';
import type { Rng } from '../../engine/rng';
import type { MusicId } from '../../audio/ids';
import { storeDef, type StoreDef, type StoreId } from '../../content/stores';
import type { PowerId } from '../../content/powerups';
import { EASTER_EGG, FIRST_VISIT, LAST_WORDS, SHOUTS, UI, packageBanner, youGot, type BubbleLine } from '../../content/copy';
import { POINTS, type Run } from '../run';
import type { FixtureState, StoreState } from '../levelstate';
import { difficulty } from '../difficulty';
import { makeBanner, tickPopups, type Banner, type Bubble, type Popup } from '../types';
import { HALF, boxFree, boxesOverlap, moveAxis, type SolidFn } from './collision';
import {
  TILE,
  getRoom,
  guardWalkable,
  isDoorTile,
  isSolidKind,
  roomPxH,
  roomPxW,
  tileAt,
  walkDistances,
  type Cell,
  type Room,
} from './room';

/**
 * One visit to a store: the top-down room, the agent, the guards and everything that
 * happens in there. Pure rules (no drawing, no DOM, no Math.random/Date): `step(pad)` advances
 * the world by one 60 Hz frame; renderers (src/render/storeView.ts) read the public state.
 *
 * Persistent state (opened fixtures, packageTaken) lives in `run.level.stores[id]`, NOT here:
 * the world is rebuilt on every entry, so guards come back and per-visit flags reset.
 */

// ------------------------------------------------------------------ tuning (all in px and 60 Hz frames)
export const VIEW_W = 256;
export const VIEW_H = 176;
/** Screen y of the room's top edge (below the 16 px HUD). */
export const ROOM_TOP = 16;
export const AGENT_SPEED = 1.25;
export const STUN_FRAMES = 60;
export const HOLD_PACKAGE = 100;
export const HOLD_POWER = 70;
export const HOLD_JOKE = 150;
export const DEATH_FRAMES = 60;
export const HURT_FRAMES = 60;
/** Fixtures within this many px of the agent's box count as touched (in front or to either side). */
export const TOUCH_MARGIN = 3;
export const BULLET_SPEED = 3.5;
export const ENEMY_BULLET_SPEED = 2;
/** Spies may not shoot before this many frames after the agent walks in. */
export const GRACE_FRAMES = 90;
/** Telegraph before a spy shot (the aim line blinks; stepping out of the line dodges it). */
export const AIM_FRAMES = 30;
export const BOT_HP = 3;
export const TOY_STUN = 180;
export const TOY_LIFE = 600;
export const TOY_SPEED = 0.8;
export const FITTING_CHANCE = 0.25;
export const FITTING_CHANGE_FRAMES = 50;
export const INTRO_START = 12;
/** Frames between the first-visit lines ("about 1 s"). */
export const INTRO_GAP = 60;
export const INTRO_TAIL = 60;
export const BUBBLE_FRAMES = 90;
export const EGG_TYPE_RATE = 3;
export const EGG_WAIT = 50;

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIR_VEC: Readonly<Record<Dir, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const DIR_BIT: Readonly<Record<Dir, number>> = { up: Btn.UP, down: Btn.DOWN, left: Btn.LEFT, right: Btn.RIGHT };
const DIR_MASK = Btn.UP | Btn.DOWN | Btn.LEFT | Btn.RIGHT;
const DIR_ORDER: readonly Dir[] = ['up', 'right', 'down', 'left'];

function opposite(d: Dir): Dir {
  return d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left';
}

// ------------------------------------------------------------------ public state shapes
export interface HeldItem {
  kind: 'package' | 'power' | 'joke';
  power?: PowerId;
  label: string;
  t: number;
  total: number;
}

export interface Agent {
  /** Centre of the 12 x 12 collision box, in room pixels. */
  x: number;
  y: number;
  facing: Dir;
  moving: boolean;
  /** Frames spent walking (drives the walk cycle). */
  anim: number;
  stun: number;
  /** Invulnerability frames left after armour absorbed a hit. */
  hurt: number;
  hold: HeldItem | null;
  /** 0 = alive; otherwise frames since the fatal hit. */
  dying: number;
  shootCd: number;
}

export interface SearchState {
  fixture: number;
  t: number;
  total: number;
}

export interface Guard {
  id: number;
  kind: 'spy' | 'bot';
  /** Centre of the box, in room pixels. */
  x: number;
  y: number;
  /** Spies: the tile they are on / walking into. */
  col: number;
  row: number;
  moving: boolean;
  tx: number;
  ty: number;
  /** Bots: patrol direction. */
  dir: Dir;
  facing: Dir;
  hp: number;
  stun: number;
  /** Frames left of the aim telegraph (0 = not aiming). */
  aim: number;
  aimDir: Dir;
  cooldown: number;
  /** Spies wait this many frames before choosing their next tile. */
  think: number;
  /** No shots before this world frame. */
  armedAt: number;
  hitFlash: number;
  dead: boolean;
  deadT: number;
  anim: number;
  /** Fitting-room spy: frames left of the "mid-change" shriek (0 = normal). */
  change: number;
  prevCol: number;
  prevRow: number;
}

export interface Bullet {
  kind: 'agent' | 'enemy' | 'shoe';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Frames during which tile collisions are ignored (a shoe leaving its cubicle). */
  noclip: number;
}

export interface Toy {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  age: number;
  turns: number;
  /** Frames before this toy can stun / bounce off a guard again. */
  cool: number;
}

export interface Puff {
  x: number;
  y: number;
  kind: 'smoke' | 'spark';
  t: number;
  total: number;
}

export type EggPhase = 'type' | 'wait' | 'item' | 'get' | 'done';
export interface EggState {
  phase: EggPhase;
  t: number;
  /** Characters of the clerk line printed so far. */
  shown: number;
  item: string;
}

interface Intro {
  lines: readonly BubbleLine[];
  t: number;
  next: number;
  active: boolean;
}

const HALF_STEP = 0.5;

export class StoreWorld {
  readonly run: Run;
  readonly storeId: StoreId;
  readonly def: StoreDef;
  readonly room: Room;
  /** The persistent per-level state of this store (`run.level.stores[id]`). */
  readonly store: StoreState;
  /** True the first time this store is entered in the game (its guards say their lines). */
  readonly firstVisit: boolean;

  frame = 0;
  exited = false;
  died = false;

  agent: Agent;
  guards: Guard[] = [];
  bullets: Bullet[] = [];
  toys: Toy[] = [];
  puffs: Puff[] = [];
  popups: Popup[] = [];
  bubbles: Bubble[] = [];
  banner: Banner | null = null;
  search: SearchState | null = null;
  /** Fixture the "PRESS X TO SEARCH" prompt refers to (-1 = nothing in reach). Updated every step. */
  searchTarget = -1;
  onBooth = false;
  /** Camera: top-left of the view in room pixels (negative when the room is smaller than the view: centred). */
  camX = 0;
  camY = 0;
  egg: EggState | null = null;
  /** Fitting rooms whose curtain was pulled by a spy (drawn open, contents still unsearched). */
  readonly peeked = new Set<number>();
  /** Fitting rooms already rolled for the 25% spy this visit. */
  private readonly fitRolled = new Set<number>();
  private readonly shelvesReleased = new Set<number>();
  private intro: Intro | null = null;
  private shotsFrom = GRACE_FRAMES;
  private nextId = 1;
  private readonly rngAi: Rng;
  private readonly rngFit: Rng;
  private readonly rngToy: Rng;
  private readonly rngEgg: Rng;
  private readonly rngWords: Rng;
  private distKey = -1;
  private distMap: Int16Array = new Int16Array(0);

  /**
   * @param room optional room override (tests use it to prove rooms of any size and a camera work);
   *   its fixture count must match `run.level.stores[storeId].fixtures`.
   */
  constructor(run: Run, storeId: StoreId, rng: Rng, room: Room = getRoom(storeId)) {
    this.run = run;
    this.storeId = storeId;
    this.def = storeDef(storeId);
    this.room = room;
    const store = run.level.stores[storeId];
    if (!store) throw new Error(`store ${storeId} is not open in this level`);
    this.store = store;
    // fork every sub-stream up front, in a fixed order
    this.rngAi = rng.fork('guards');
    this.rngFit = rng.fork('fitting');
    this.rngToy = rng.fork('toys');
    this.rngEgg = rng.fork('egg');
    this.rngWords = rng.fork('words');

    this.agent = {
      // the doorway is 2 tiles wide: start on the line between them, just above it
      x: room.door.col * TILE + TILE,
      y: room.spawn.row * TILE + TILE / 2,
      facing: 'up',
      moving: false,
      anim: 0,
      stun: 0,
      hurt: 0,
      hold: null,
      dying: 0,
      shootCd: 0,
    };

    for (const g of room.guards) this.guards.push(this.makeGuard(g.kind, g.col, g.row, g.axis));

    this.firstVisit = !run.seenStores.has(storeId);
    run.seenStores.add(storeId);
    const lines = this.firstVisit ? FIRST_VISIT[storeId] : undefined;
    if (lines && lines.length > 0) {
      this.intro = { lines, t: 0, next: 0, active: true };
      this.shotsFrom = Math.max(GRACE_FRAMES, this.introEnd() + 45);
    }

    if (storeId === 'gamestonk' && !run.easterEggDone && room.clerk && room.pedestal) {
      run.easterEggDone = true;
      this.egg = { phase: 'type', t: 0, shown: 0, item: this.rngEgg.pick(EASTER_EGG.items) };
    }
    this.updateCamera();
    this.searchTarget = this.findSearchTarget();
  }

  // ------------------------------------------------------------------ public read API (renderers, HUD, Game)
  /** The store's own song, `'booth'` on the Sam Baddy listening booth, `'itemget'` while the easter-egg item is held. */
  music(): MusicId {
    if (this.egg?.phase === 'get') return 'itemget';
    if (this.onBooth) return 'booth';
    return this.def.song ?? 'mall';
  }

  get name(): string {
    return this.def.name;
  }

  /** "NOW PLAYING: SIDE B" is showing (the agent stands on the listening booth). */
  get nowPlaying(): boolean {
    return this.onBooth;
  }

  get searchProgress(): number {
    return this.search ? Math.min(1, this.search.t / this.search.total) : 0;
  }

  /** A search can start right now (touching an unsearched fixture, free to act). */
  get canSearch(): boolean {
    return !this.search && this.searchTarget >= 0 && !this.inputFrozen() && this.agent.stun === 0;
  }

  fixtureOpened(i: number): boolean {
    return this.store.fixtures[i]?.opened ?? false;
  }

  /** Radar power-up: this fixture holds the package and has not been searched (renderer flashes a "!"). */
  radarMarked(i: number): boolean {
    const f = this.store.fixtures[i];
    return !!f && this.run.power.radar && !f.opened && f.content.kind === 'package';
  }

  toyShelfReleased(col: number, row: number): boolean {
    return this.shelvesReleased.has(row * this.room.cols + col);
  }

  /** Easter egg: text printed so far by the typewriter (null when no box is showing). */
  get typewriter(): string | null {
    const e = this.egg;
    if (!e || (e.phase !== 'type' && e.phase !== 'wait')) return null;
    return EASTER_EGG.clerk.slice(0, e.shown);
  }

  get clerkVisible(): boolean {
    return !!this.egg && this.egg.phase !== 'done';
  }

  /** The easter-egg item currently standing on the pedestal (null when none). */
  get pedestalItem(): string | null {
    return this.egg?.phase === 'item' ? this.egg.item : null;
  }

  get viewW(): number {
    return VIEW_W;
  }
  get viewH(): number {
    return VIEW_H;
  }

  /** Testing / debug helper: put the agent at the centre of a tile. */
  teleportAgent(col: number, row: number, dx = 0, dy = 0): void {
    this.agent.x = col * TILE + TILE / 2 + dx;
    this.agent.y = row * TILE + TILE / 2 + dy;
    this.updateCamera();
    this.searchTarget = this.findSearchTarget();
  }

  // ------------------------------------------------------------------ the frame
  step(pad: Pad): void {
    if (this.exited || this.died) return;
    this.frame++;
    this.run.tickPowers();
    this.tickCosmetics();
    const a = this.agent;
    if (a.dying > 0) {
      a.dying++;
      if (a.dying > DEATH_FRAMES) this.died = true;
      this.updateCamera();
      return;
    }
    this.updateEgg();
    this.updateIntro();
    if (a.hold && --a.hold.t <= 0) a.hold = null;

    if (!this.inputFrozen()) this.updateAgent(pad);
    else a.moving = false;

    if (!this.worldFrozen()) {
      this.updateGuards();
      this.updateToys();
      this.updateBullets();
      this.updateContacts();
    }

    if (a.dying === 0) {
      const col = Math.floor(a.x / TILE);
      const row = Math.floor(a.y / TILE);
      this.onBooth = tileAt(this.room, col, row) === 'booth';
      if (isDoorTile(this.room, col, row) && !this.inputFrozen()) {
        this.exited = true;
        this.search = null;
        this.run.sfx('door');
      }
    }
    this.updateCamera();
    this.searchTarget = this.search ? this.search.fixture : this.findSearchTarget();
  }

  private inputFrozen(): boolean {
    const e = this.egg;
    return this.agent.dying > 0 || !!this.agent.hold || (!!e && (e.phase === 'type' || e.phase === 'wait' || e.phase === 'get'));
  }

  private worldFrozen(): boolean {
    return this.inputFrozen();
  }

  private tickCosmetics(): void {
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    for (let i = this.bubbles.length - 1; i >= 0; i--) if (--this.bubbles[i]!.t <= 0) this.bubbles.splice(i, 1);
    tickPopups(this.popups);
    for (let i = this.puffs.length - 1; i >= 0; i--) if (--this.puffs[i]!.t <= 0) this.puffs.splice(i, 1);
  }

  // ------------------------------------------------------------------ solidity
  private clerkAt(col: number, row: number): boolean {
    const c = this.room.clerk;
    return !!c && this.clerkVisible && c.col === col && c.row === row;
  }

  private readonly solidForAgent: SolidFn = (col, row) => isSolidKind(tileAt(this.room, col, row)) || this.clerkAt(col, row);
  /** Guards, toys and shoes cannot leave through the doorway. */
  private readonly solidForGuard: SolidFn = (col, row) => this.solidForAgent(col, row) || tileAt(this.room, col, row) === 'door';

  // ------------------------------------------------------------------ the agent
  private updateAgent(pad: Pad): void {
    const a = this.agent;
    if (a.shootCd > 0) a.shootCd--;
    if (a.hurt > 0) a.hurt--;
    if (a.stun > 0) {
      a.stun--;
      a.moving = false;
      this.search = null;
      return;
    }
    if (this.search && !this.updateSearch(pad)) {
      a.moving = false;
      return;
    }
    const fired = this.tryShoot(pad);
    if (!fired && (pad.pressed & Btn.B) !== 0) {
      const target = this.findSearchTarget();
      if (target >= 0) {
        this.faceFixture(target);
        this.search = { fixture: target, t: 0, total: this.run.searchFrames() };
        this.run.sfx('searchTick');
        a.moving = false;
        return;
      }
    }
    // movement: vertical input has priority
    const held = pad.held;
    const up = (held & Btn.UP) !== 0;
    const down = (held & Btn.DOWN) !== 0;
    const left = (held & Btn.LEFT) !== 0;
    const right = (held & Btn.RIGHT) !== 0;
    let axis: 'x' | 'y' | null = null;
    let sign = 0;
    if (up || down) {
      if (up !== down) {
        axis = 'y';
        sign = up ? -1 : 1;
      }
    } else if (left !== right) {
      axis = 'x';
      sign = left ? -1 : 1;
    }
    if (!axis) {
      a.moving = false;
      return;
    }
    a.facing = axis === 'y' ? (sign < 0 ? 'up' : 'down') : sign < 0 ? 'left' : 'right';
    const speed = AGENT_SPEED * this.run.walkFactor();
    const moved = moveAxis(this.solidForAgent, a, axis, sign * speed, { assist: true });
    a.moving = moved;
    if (moved) a.anim++;
  }

  /** Progress the running search. Returns true only if it was CANCELLED this frame (the agent may then act normally). */
  private updateSearch(pad: Pad): boolean {
    const s = this.search!;
    const a = this.agent;
    const fx = this.store.fixtures[s.fixture];
    if (!fx || fx.opened) {
      this.search = null;
      return true;
    }
    const freshDir = pad.pressed & DIR_MASK;
    if ((pad.pressed & Btn.A) !== 0 || (freshDir & ~DIR_BIT[a.facing]) !== 0) {
      // a fresh press of a different direction, or shooting, cancels the search (and acts on the same frame)
      this.search = null;
      return true;
    }
    s.t++;
    if (s.t % 10 === 0) this.run.sfx('searchTick');
    if (s.t >= s.total) {
      this.search = null;
      this.completeSearch(s.fixture);
      return false;
    }
    return false;
  }

  private tryShoot(pad: Pad): boolean {
    const a = this.agent;
    if (a.shootCd > 0 || ((pad.pressed | pad.held) & Btn.A) === 0) return false;
    const prof = this.run.fireProfile();
    const alive = this.bullets.reduce((n, b) => n + (b.kind === 'agent' ? 1 : 0), 0);
    const n = prof.spread ? 3 : 1;
    if (alive + n > prof.maxBullets) return false;
    const [ux, uy] = DIR_VEC[a.facing];
    const angles = prof.spread ? [-0.32, 0, 0.32] : [0];
    for (const ang of angles) {
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const vx = (ux * cos - uy * sin) * BULLET_SPEED;
      const vy = (ux * sin + uy * cos) * BULLET_SPEED;
      this.bullets.push({ kind: 'agent', x: a.x + ux * (HALF + 3), y: a.y + uy * (HALF + 3), vx, vy, age: 0, noclip: 0 });
    }
    a.shootCd = prof.cooldown;
    this.run.sfx('shot');
    return true;
  }

  // ------------------------------------------------------------------ searching
  /** The best unsearched fixture the agent is touching (front or either side), or -1. */
  findSearchTarget(): number {
    const a = this.agent;
    if (a.dying > 0) return -1;
    let best = -1;
    let bestScore = -Infinity;
    for (const f of this.room.fixtures) {
      if (this.store.fixtures[f.index]?.opened) continue;
      const l = f.col * TILE;
      const t = f.row * TILE;
      const r = l + TILE;
      const b = t + TILE;
      const gx = Math.max(l - (a.x + HALF), a.x - HALF - r, 0);
      const gy = Math.max(t - (a.y + HALF), a.y - HALF - b, 0);
      if (gx > TOUCH_MARGIN || gy > TOUCH_MARGIN) continue;
      const ox = Math.min(a.x + HALF, r) - Math.max(a.x - HALF, l);
      const oy = Math.min(a.y + HALF, b) - Math.max(a.y - HALF, t);
      const side = this.sideOf(f.col, f.row);
      const score = (side === a.facing ? 1000 : 0) + Math.max(0, ox) + Math.max(0, oy) - f.index * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = f.index;
      }
    }
    return best;
  }

  /** Which side of the agent a tile is on (dominant axis of the centre-to-centre vector). */
  private sideOf(col: number, row: number): Dir {
    const dx = col * TILE + TILE / 2 - this.agent.x;
    const dy = row * TILE + TILE / 2 - this.agent.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  private faceFixture(i: number): void {
    const f = this.room.fixtures[i]!;
    this.agent.facing = this.sideOf(f.col, f.row);
  }

  private fixtureCentre(i: number): { x: number; y: number } {
    const f = this.room.fixtures[i]!;
    return { x: f.col * TILE + TILE / 2, y: f.row * TILE + TILE / 2 };
  }

  private completeSearch(i: number): void {
    const spot = this.room.fixtures[i]!;
    const fx: FixtureState = this.store.fixtures[i]!;
    if (spot.kind === 'fitting' && !this.fitRolled.has(i)) {
      this.fitRolled.add(i);
      if (this.rngFit.chance(FITTING_CHANCE)) {
        this.fittingSpy(i);
        return; // the fitting room's real contents stay unsearched
      }
    }
    fx.opened = true;
    const c = this.fixtureCentre(i);
    const content = fx.content;
    const a = this.agent;
    switch (content.kind) {
      case 'package': {
        this.store.packageTaken = true;
        this.run.addScore(POINTS.package);
        const n = this.run.packages;
        this.hold({ kind: 'package', label: 'PACKAGE', t: HOLD_PACKAGE, total: HOLD_PACKAGE });
        this.banner = makeBanner(packageBanner(n), HOLD_PACKAGE + 40);
        this.popup(c.x, c.y - 10, `+${POINTS.package}`);
        this.run.sfx('fanfare');
        break;
      }
      case 'powerup': {
        const name = this.run.givePower(content.power);
        this.run.addScore(POINTS.powerup);
        this.hold({ kind: 'power', power: content.power, label: name, t: HOLD_POWER, total: HOLD_POWER });
        this.banner = makeBanner(name, HOLD_POWER + 40);
        this.popup(c.x, c.y - 10, `+${POINTS.powerup}`);
        this.run.sfx('powerup');
        break;
      }
      case 'trap':
        this.puff(c.x, c.y, 'smoke');
        this.banner = makeBanner(UI.trap, 90);
        a.stun = STUN_FRAMES;
        this.run.sfx('smoke');
        break;
      case 'nothing':
        this.puff(c.x, c.y, 'smoke');
        this.banner = makeBanner(UI.nothing, 80);
        this.run.sfx('smoke');
        break;
    }
  }

  private hold(item: HeldItem): void {
    this.agent.hold = item;
    this.agent.facing = 'down';
    this.agent.moving = false;
  }

  // ------------------------------------------------------------------ Forever 12 fitting room
  private fittingSpy(i: number): void {
    const spot = this.room.fixtures[i]!;
    this.peeked.add(i);
    const g = this.makeGuard('spy', spot.col, spot.row, 'h');
    g.change = FITTING_CHANGE_FRAMES;
    g.armedAt = this.frame + FITTING_CHANGE_FRAMES + 60;
    this.guards.push(g);
    this.bubbles.push({ text: SHOUTS.fitting, x: g.x, y: g.y - 10, t: 70 });
    this.run.sfx('shriek');
  }

  private throwShoe(g: Guard): void {
    const a = this.agent;
    let dx = a.x - g.x;
    let dy = a.y - g.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    this.bullets.push({ kind: 'shoe', x: g.x + dx * 9, y: g.y + dy * 9, vx: dx * ENEMY_BULLET_SPEED, vy: dy * ENEMY_BULLET_SPEED, age: 0, noclip: 8 });
    this.run.sfx('enemyShot');
  }

  // ------------------------------------------------------------------ guards
  private makeGuard(kind: 'spy' | 'bot', col: number, row: number, axis: 'h' | 'v'): Guard {
    return {
      id: this.nextId++,
      kind,
      x: col * TILE + TILE / 2,
      y: row * TILE + TILE / 2,
      col,
      row,
      moving: false,
      tx: col * TILE + TILE / 2,
      ty: row * TILE + TILE / 2,
      dir: axis === 'v' ? 'down' : 'right',
      facing: 'down',
      hp: kind === 'bot' ? BOT_HP : 1,
      stun: 0,
      aim: 0,
      aimDir: 'down',
      cooldown: 0,
      think: 0,
      armedAt: 0,
      hitFlash: 0,
      dead: false,
      deadT: 0,
      anim: 0,
      change: 0,
      prevCol: col,
      prevRow: row,
    };
  }

  private spySpeed(): number {
    return Math.min(1.2, 0.7 + 0.07 * Math.max(0, this.run.loop - 1));
  }

  private shotCooldown(): number {
    return Math.max(50, Math.round(difficulty(this.run.loop, this.run.blackFriday).shotInterval * 0.75));
  }

  private aimFrames(): number {
    return Math.max(18, AIM_FRAMES - 3 * Math.max(0, this.run.loop - 1));
  }

  private updateGuards(): void {
    // first-visit chatter: the guards hold still while they talk (they can still be shot)
    const talking = !!this.intro?.active;
    for (let i = this.guards.length - 1; i >= 0; i--) {
      const g = this.guards[i]!;
      if (g.dead) {
        if (++g.deadT > 16) this.guards.splice(i, 1);
        continue;
      }
      if (g.hitFlash > 0) g.hitFlash--;
      if (g.cooldown > 0) g.cooldown--;
      if (talking) continue;
      if (g.stun > 0) {
        g.stun--;
        continue;
      }
      if (g.kind === 'spy') this.updateSpy(g);
      else this.updateBot(g);
    }
  }

  private spyCanShoot(g: Guard): boolean {
    return g.cooldown <= 0 && this.frame >= Math.max(this.shotsFrom, g.armedAt);
  }

  private updateSpy(g: Guard): void {
    if (g.change > 0) {
      g.change--;
      g.facing = 'down';
      if (g.change === 14) this.throwShoe(g);
      return;
    }
    if (g.aim > 0) {
      if (--g.aim === 0) this.spyFire(g);
      return;
    }
    if (g.moving) {
      g.anim++;
      const sp = this.spySpeed();
      const dx = g.tx - g.x;
      const dy = g.ty - g.y;
      if (Math.abs(dx) <= sp && Math.abs(dy) <= sp) {
        g.x = g.tx;
        g.y = g.ty;
        g.moving = false;
        g.think = 4;
      } else {
        if (Math.abs(dx) > sp) g.x += Math.sign(dx) * sp;
        else g.x = g.tx;
        if (Math.abs(dy) > sp) g.y += Math.sign(dy) * sp;
        else g.y = g.ty;
      }
      return;
    }
    if (g.think > 0) {
      g.think--;
      return;
    }
    // at a tile centre: shoot if lined up with a clear path, otherwise take one step
    if (this.spyCanShoot(g)) {
      const dir = this.lineOfFire(g);
      if (dir) {
        g.aim = this.aimFrames();
        g.aimDir = dir;
        g.facing = dir;
        return;
      }
    }
    this.spyStep(g);
  }

  private spyFire(g: Guard): void {
    const [ux, uy] = DIR_VEC[g.aimDir];
    this.bullets.push({
      kind: 'enemy',
      x: g.x + ux * 9,
      y: g.y + uy * 9,
      vx: ux * this.enemyBulletSpeed(),
      vy: uy * this.enemyBulletSpeed(),
      age: 0,
      noclip: 0,
    });
    g.cooldown = this.shotCooldown();
    g.think = 10;
    this.run.sfx('enemyShot');
  }

  private enemyBulletSpeed(): number {
    return Math.min(2.8, ENEMY_BULLET_SPEED + 0.1 * Math.max(0, this.run.loop - 1));
  }

  /** Direction a spy at this tile centre could shoot the agent along a clear row/column, or null. */
  lineOfFire(g: Guard): Dir | null {
    const a = this.agent;
    const reach = HALF + 1;
    const gc = Math.floor(g.x / TILE);
    const gr = Math.floor(g.y / TILE);
    const ac = Math.floor(a.x / TILE);
    const ar = Math.floor(a.y / TILE);
    if (Math.abs(a.y - g.y) < reach && Math.abs(a.x - g.x) > 4) {
      const step = ac > gc ? 1 : -1;
      let clear = true;
      for (let c = gc + step; c !== ac + step && clear; c += step) if (this.solidForGuard(c, gr)) clear = false;
      if (clear) return a.x > g.x ? 'right' : 'left';
    }
    if (Math.abs(a.x - g.x) < reach && Math.abs(a.y - g.y) > 4) {
      const step = ar > gr ? 1 : -1;
      let clear = true;
      for (let r = gr + step; r !== ar + step && clear; r += step) if (this.solidForGuard(gc, r)) clear = false;
      if (clear) return a.y > g.y ? 'down' : 'up';
    }
    return null;
  }

  private agentDistances(): Int16Array {
    const col = Math.max(0, Math.min(this.room.cols - 1, Math.floor(this.agent.x / TILE)));
    const row = Math.max(0, Math.min(this.room.rows - 1, Math.floor(this.agent.y / TILE)));
    const key = row * this.room.cols + col;
    if (key !== this.distKey) {
      this.distKey = key;
      this.distMap = walkDistances(this.room, { col, row }, false);
    }
    return this.distMap;
  }

  private tileTaken(col: number, row: number, except: Guard): boolean {
    for (const o of this.guards) if (o !== except && !o.dead && o.col === col && o.row === row) return true;
    return false;
  }

  /** Spies move tile by tile, favouring the player (shortest walk), with some wandering. */
  private spyStep(g: Guard): void {
    const dist = this.agentDistances();
    const cands: Array<{ dir: Dir; col: number; row: number; d: number }> = [];
    for (const dir of DIR_ORDER) {
      const [dx, dy] = DIR_VEC[dir];
      const col = g.col + dx;
      const row = g.row + dy;
      if (!guardWalkable(this.room, col, row) || this.clerkAt(col, row) || this.tileTaken(col, row, g)) continue;
      const d = dist[row * this.room.cols + col]!;
      cands.push({ dir, col, row, d: d < 0 ? 99 : d });
    }
    if (cands.length === 0) {
      g.think = 15;
      return;
    }
    const here = dist[g.row * this.room.cols + g.col]!;
    // within two tiles of the agent: hold the range, strafing about half the time
    if (here >= 0 && here <= 2 && this.rngAi.chance(0.5)) {
      g.think = 20;
      return;
    }
    let pick = cands[0]!;
    if (this.rngAi.chance(0.25)) pick = this.rngAi.pick(cands);
    else {
      let best = Infinity;
      for (const c of cands) {
        const back = c.col === g.prevCol && c.row === g.prevRow && cands.length > 1;
        const score = c.d + (back ? 1.5 : 0) + this.rngAi.next() * 0.5;
        if (score < best) {
          best = score;
          pick = c;
        }
      }
    }
    g.prevCol = g.col;
    g.prevRow = g.row;
    g.col = pick.col;
    g.row = pick.row;
    g.tx = pick.col * TILE + TILE / 2;
    g.ty = pick.row * TILE + TILE / 2;
    g.facing = pick.dir;
    g.moving = true;
  }

  /** Security bots patrol back and forth, turning at walls, fixtures and each other. */
  private updateBot(g: Guard): void {
    const speed = Math.min(1.2, 0.7 + 0.05 * Math.max(0, this.run.loop - 1));
    const [dx, dy] = DIR_VEC[g.dir];
    const nx = g.x + dx * speed;
    const ny = g.y + dy * speed;
    let blocked = !boxFree(this.solidForGuard, nx, ny, HALF);
    if (!blocked) {
      for (const o of this.guards) {
        if (o !== g && !o.dead && o.kind === 'bot' && boxesOverlap(nx, ny, HALF, o.x, o.y, HALF)) blocked = true;
      }
    }
    if (blocked) {
      g.dir = opposite(g.dir);
      g.facing = g.dir;
      return;
    }
    g.x = nx;
    g.y = ny;
    g.facing = g.dir;
    g.moving = true;
    g.anim++;
  }

  private hitGuard(g: Guard): void {
    if (g.dead) return;
    if (g.kind === 'bot' && --g.hp > 0) {
      g.hitFlash = 8;
      this.puff(g.x, g.y, 'spark');
      this.run.sfx('helmetPing');
      return;
    }
    this.killGuard(g);
  }

  private killGuard(g: Guard): void {
    g.dead = true;
    g.deadT = 0;
    g.aim = 0;
    g.change = 0;
    g.moving = false;
    this.run.addScore(POINTS.spyShot);
    this.popup(g.x, g.y - 10, `+${POINTS.spyShot}`);
    this.puff(g.x, g.y, 'smoke');
    this.run.sfx(g.kind === 'bot' ? 'crush' : 'hurt');
    if (g.kind === 'spy' && this.rngWords.chance(0.35)) {
      this.bubbles.push({ text: this.rngWords.pick(LAST_WORDS), x: g.x, y: g.y - 10, t: 70 });
    }
  }

  // ------------------------------------------------------------------ bullets
  private updateBullets(): void {
    const a = this.agent;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!;
      b.age++;
      let gone = b.age > 400;
      for (let sub = 0; sub < 2 && !gone; sub++) {
        b.x += b.vx * HALF_STEP;
        b.y += b.vy * HALF_STEP;
        if (b.kind === 'agent') {
          const g = this.guards.find((o) => !o.dead && Math.abs(o.x - b.x) < HALF + 1 && Math.abs(o.y - b.y) < HALF + 1);
          if (g) {
            this.hitGuard(g);
            gone = true;
            break;
          }
        } else if (Math.abs(a.x - b.x) < HALF + 1 && Math.abs(a.y - b.y) < HALF + 1) {
          this.hurtAgent();
          gone = true;
          break;
        }
        if (b.noclip > 0) continue;
        const col = Math.floor(b.x / TILE);
        const row = Math.floor(b.y / TILE);
        if (this.solidForAgent(col, row)) {
          if (b.kind === 'agent' && tileAt(this.room, col, row) === 'toyshelf') this.releaseToys(col, row);
          this.puff(b.x - b.vx * HALF_STEP, b.y - b.vy * HALF_STEP, 'spark');
          gone = true;
        }
      }
      if (b.noclip > 0) b.noclip--;
      if (gone) this.bullets.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ being hurt
  private hurtAgent(): boolean {
    const a = this.agent;
    if (a.dying > 0 || a.hurt > 0 || this.run.invincible) return false;
    if (this.run.absorbHit()) {
      a.hurt = HURT_FRAMES;
      this.run.sfx('hurt');
      this.puff(a.x, a.y, 'spark');
      return false;
    }
    a.dying = 1;
    a.moving = false;
    this.search = null;
    this.run.sfx('death');
    return true;
  }

  /** Bot contact kills (or is absorbed); a Cinnabomb agent kills whatever he touches. */
  private updateContacts(): void {
    const a = this.agent;
    for (const g of this.guards) {
      if (g.dead || !boxesOverlap(a.x, a.y, HALF, g.x, g.y, HALF - 1)) continue;
      if (this.run.invincible) {
        this.killGuard(g);
      } else if (g.kind === 'bot' && g.stun === 0) {
        const wasHurt = a.hurt;
        const killed = this.hurtAgent();
        if (!killed && wasHurt === 0 && a.hurt > 0) g.stun = 90;
      }
      if (a.dying > 0) return;
    }
  }

  // ------------------------------------------------------------------ KGB Toys
  private releaseToys(col: number, row: number): void {
    const key = row * this.room.cols + col;
    if (this.shelvesReleased.has(key)) return;
    this.shelvesReleased.add(key);
    this.run.sfx('bounce');
    const open: Dir[] = [];
    for (const d of ['down', 'left', 'right', 'up'] as const) {
      const [dx, dy] = DIR_VEC[d];
      if (!this.solidForGuard(col + dx, row + dy)) open.push(d);
    }
    if (open.length === 0) return;
    for (let i = 0; i < 3; i++) {
      const d = open[i % open.length]!;
      const [dx, dy] = DIR_VEC[d];
      // when fewer than 3 sides are open, the extra toys start a few px further along the same side
      const extra = Math.floor(i / open.length) * 5;
      this.toys.push({
        id: this.nextId++,
        x: (col + dx) * TILE + TILE / 2 + dx * extra,
        y: (row + dy) * TILE + TILE / 2 + dy * extra,
        dir: d,
        age: 0,
        turns: 0,
        cool: 0,
      });
    }
  }

  private updateToys(): void {
    for (let i = this.toys.length - 1; i >= 0; i--) {
      const t = this.toys[i]!;
      t.age++;
      if (t.cool > 0) t.cool--;
      if (t.age >= TOY_LIFE) {
        this.puff(t.x, t.y, 'smoke');
        this.toys.splice(i, 1);
        continue;
      }
      const [dx, dy] = DIR_VEC[t.dir];
      const nx = t.x + dx * TOY_SPEED;
      const ny = t.y + dy * TOY_SPEED;
      if (boxFree(this.solidForGuard, nx, ny, 4)) {
        t.x = nx;
        t.y = ny;
      } else {
        // turn at walls: left or right at random, else straight back
        const idx = DIR_ORDER.indexOf(t.dir);
        const cw = DIR_ORDER[(idx + 1) % 4]!;
        const ccw = DIR_ORDER[(idx + 3) % 4]!;
        const options: Dir[] = this.rngToy.chance(0.5) ? [cw, ccw, opposite(t.dir)] : [ccw, cw, opposite(t.dir)];
        for (const d of options) {
          const [ox, oy] = DIR_VEC[d];
          if (boxFree(this.solidForGuard, t.x + ox * TOY_SPEED, t.y + oy * TOY_SPEED, 4)) {
            t.dir = d;
            break;
          }
        }
        t.turns++;
      }
      // stun guards
      for (const g of this.guards) {
        if (g.dead || t.cool > 0 || !boxesOverlap(t.x, t.y, 4, g.x, g.y, HALF)) continue;
        if (g.stun < 30) {
          g.stun = TOY_STUN;
          g.aim = 0;
          this.puff(g.x, g.y - 6, 'spark');
        }
        t.dir = opposite(t.dir);
        t.cool = 20;
      }
      // set off traps
      for (const f of this.room.fixtures) {
        const fx = this.store.fixtures[f.index]!;
        if (fx.opened || fx.content.kind !== 'trap') continue;
        const cx = f.col * TILE + TILE / 2;
        const cy = f.row * TILE + TILE / 2;
        if (Math.abs(t.x - cx) < TILE / 2 + 4 + 2 && Math.abs(t.y - cy) < TILE / 2 + 4 + 2) this.springTrap(f.index);
      }
    }
  }

  /** A toy set off a trap: smoke that stuns nearby guards (and opens the fixture). */
  private springTrap(i: number): void {
    const fx = this.store.fixtures[i]!;
    fx.opened = true;
    const c = this.fixtureCentre(i);
    this.puff(c.x, c.y, 'smoke');
    this.run.sfx('smoke');
    for (const g of this.guards) {
      if (g.dead || Math.hypot(g.x - c.x, g.y - c.y) > 56) continue;
      g.stun = Math.max(g.stun, TOY_STUN);
      g.aim = 0;
    }
  }

  // ------------------------------------------------------------------ first-visit lines
  private introStart(k: number): number {
    return INTRO_START + k * INTRO_GAP;
  }

  private introEnd(): number {
    const n = this.intro?.lines.length ?? 0;
    return n === 0 ? 0 : this.introStart(n - 1) + INTRO_TAIL;
  }

  private updateIntro(): void {
    const it = this.intro;
    if (!it || !it.active) return;
    it.t++;
    if (it.next < it.lines.length && it.t >= this.introStart(it.next)) {
      const line = it.lines[it.next]!;
      it.next++;
      const speaker = this.speaker(line.who);
      if (speaker) {
        // a speaker's new line replaces his old bubble
        this.bubbles = this.bubbles.filter((b) => Math.abs(b.x - speaker.x) > 1 || Math.abs(b.y - (speaker.y - 10)) > 1);
        this.bubbles.push({ text: line.text, x: speaker.x, y: speaker.y - 10, t: BUBBLE_FRAMES });
      }
    }
    if (it.t >= this.introEnd()) it.active = false;
  }

  /** Is the first-visit chatter still going (guards hold still)? */
  get introActive(): boolean {
    return !!this.intro?.active;
  }

  private speaker(who: 'spy' | 'bot'): Guard | undefined {
    return this.guards.find((g) => !g.dead && g.kind === who) ?? this.guards.find((g) => !g.dead);
  }

  // ------------------------------------------------------------------ GameStonk easter egg
  private updateEgg(): void {
    const e = this.egg;
    if (!e || e.phase === 'done') return;
    const a = this.agent;
    switch (e.phase) {
      case 'type': {
        e.t++;
        const text = EASTER_EGG.clerk;
        const shown = Math.min(text.length, Math.floor(e.t / EGG_TYPE_RATE));
        if (shown > e.shown) {
          if (text[shown - 1] !== ' ') this.run.sfx('blip');
          e.shown = shown;
        }
        if (shown >= text.length) {
          e.phase = 'wait';
          e.t = 0;
        }
        break;
      }
      case 'wait':
        if (++e.t >= EGG_WAIT) {
          e.phase = 'item';
          e.t = 0;
        }
        break;
      case 'item': {
        const ped = this.room.pedestal!;
        if (a.stun === 0 && Math.floor(a.x / TILE) === ped.col && Math.floor(a.y / TILE) === ped.row) {
          e.phase = 'get';
          e.t = 0;
          this.run.addJoke(e.item);
          this.hold({ kind: 'joke', label: e.item, t: HOLD_JOKE, total: HOLD_JOKE });
          this.banner = makeBanner(youGot(e.item), HOLD_JOKE);
        }
        break;
      }
      case 'get':
        if (++e.t >= HOLD_JOKE) {
          e.phase = 'done';
          const c = this.room.clerk!;
          this.puff(c.col * TILE + TILE / 2, c.row * TILE + TILE / 2, 'smoke');
          this.run.sfx('smoke');
        }
        break;
    }
  }

  // ------------------------------------------------------------------ small helpers
  private puff(x: number, y: number, kind: 'smoke' | 'spark'): void {
    const total = kind === 'smoke' ? 24 : 9;
    this.puffs.push({ x, y, kind, t: total, total });
  }

  private popup(x: number, y: number, text: string, color?: number): void {
    this.popups.push({ x, y, text, t: 50, color });
  }

  private updateCamera(): void {
    const w = roomPxW(this.room);
    const h = roomPxH(this.room);
    const a = this.agent;
    this.camX = w <= VIEW_W ? 0 - Math.floor((VIEW_W - w) / 2) : Math.max(0, Math.min(w - VIEW_W, Math.round(a.x - VIEW_W / 2)));
    this.camY = h <= VIEW_H ? 0 - Math.floor((VIEW_H - h) / 2) : Math.max(0, Math.min(h - VIEW_H, Math.round(a.y - VIEW_H / 2)));
  }

  /** Room cell under a world pixel position (for renderers / tests). */
  cellAt(x: number, y: number): Cell {
    return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
  }
}
