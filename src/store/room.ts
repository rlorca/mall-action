// The top-down store room: movement, searching, fixtures, guards and the easter egg. Pure rules.
import { SEC } from '../core/constants';
import { EASTER_EGG_ITEMS, EASTER_EGG_LINES, STORE_FIRST_VISIT, TRAP_BANNER, NOTHING_BANNER, pkgBanner } from '../core/copy';
import type { StoreEvent } from '../core/events';
import type { Pad, StepInput } from '../core/input';
import { POINTS } from '../core/scoring';
import { Rng } from '../core/rng';
import { PowerUps, type PowerUpId } from '../core/powerups';
import type { StoreDef } from '../mall/layout';
import { ROOM_COLS, ROOM_ROWS, TILE, type StoreTemplate } from './templates';

export type Contents = 'package' | 'power' | 'trap' | 'nothing';

export interface Fixture {
  index: number;
  col: number;
  row: number;
  kind: 'F' | 'L';
  contents: Contents;
  power: PowerUpId | null;
  opened: boolean;
  ambushed: boolean;
}

export interface Guard {
  id: number;
  kind: 'spy' | 'bot';
  x: number;
  y: number;
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  hp: number;
  alive: boolean;
  stunT: number;
  cool: number;
  moveT: number;
  pauseT: number;
  lineAxis: 'h' | 'v'; // bot patrol axis
}

export interface Bullet {
  owner: 'player' | 'guard';
  x: number;
  y: number;
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  life: number;
}

export interface Toy {
  x: number;
  y: number;
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  life: number;
}

export interface Puff {
  x: number;
  y: number;
  t: number;
}

export type Facing = 'u' | 'd' | 'l' | 'r';

export interface StoreRoomOptions {
  store: StoreDef;
  template: StoreTemplate;
  seed: number;
  blackFriday: boolean;
  powerUps: PowerUps;
  firstVisit: boolean;
  egg: boolean;
  /** Indices of fixtures already searched this level (persisted by the game). */
  opened: Set<number>;
  packagesFound: number;
  /** Where the agent enters (tile col of the door). Defaults to the door. */
  entryCol?: number;
}

const SOLID = new Set(['#', 'F', 'L', 'C', 'R', 'T', 'S']);
const GUARD_SPEED = 1;
const GUARD_STEP = 16;
const GUARD_PAUSE = 10;
const GUARD_COOLDOWN = Math.round(1.5 * SEC);
const GRACE = Math.round(1 * SEC);
const TALK_LINE_GAP = SEC;
const HOLD_PACKAGE = SEC;
const HOLD_POWER = Math.round(0.7 * SEC);
const SEARCH_FRAMES = Math.round(0.75 * SEC);
const PLAYER_SIZE = 16;
const HITBOX = { ox: 2, oy: 2, w: 12, h: 12 };
const PLAYER_WALK = 1;

export class StoreRoom {
  readonly rng: Rng;
  readonly rows: string[];
  readonly fixtures: Fixture[] = [];
  readonly guards: Guard[] = [];
  readonly bullets: Bullet[] = [];
  readonly toys: Toy[] = [];
  readonly puffs: Puff[] = [];
  readonly shelvesShot = new Set<string>();
  readonly bubbles: { x: number; y: number; text: string; t: number }[] = [];
  x: number;
  y: number;
  facing: Facing = 'u';
  mode: 'walk' | 'search' | 'hold' | 'stun' | 'talk' | 'egg' | 'dead' = 'walk';
  searchT = 0;
  searchOf: Fixture | null = null;
  holdT = 0;
  holdText = '';
  stunT = 0;
  shootCd = 0;
  frame = 0;
  graceT = GRACE;
  talkT = 0;
  talkLines: readonly string[] = [];
  eggT = 0;
  eggPedestal = false;
  eggDone = false;
  sideB = false;
  exited = false;
  private events: StoreEvent[] = [];
  private nextId = 1;
  private readonly opts: StoreRoomOptions;

  constructor(opts: StoreRoomOptions) {
    this.opts = opts;
    this.rng = new Rng(opts.seed);
    this.rows = [...opts.template.rows];
    // Find the fixtures, in reading order, and assign their contents.
    this.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === 'F' || ch === 'L') {
          const idx = this.fixtures.length;
          this.fixtures.push({
            index: idx,
            col: c,
            row: r,
            kind: ch,
            contents: 'nothing',
            power: null,
            opened: opts.opened.has(idx),
            ambushed: false,
          });
        }
      }),
    );
    this.assignContents();

    // Guards stand on the G markers; a random subset of markers is used.
    const markers: { col: number; row: number }[] = [];
    this.rows.forEach((row, r) => [...row].forEach((ch, c) => ch === 'G' && markers.push({ col: c, row: r })));
    const kinds = opts.template.guards;
    const count = Math.min(kinds.length, markers.length);
    const picks = [...markers];
    for (let i = picks.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [picks[i], picks[j]] = [picks[j], picks[i]];
    }
    for (let i = 0; i < count; i++) {
      const m = picks[i];
      this.guards.push({
        id: this.nextId++,
        kind: kinds[i],
        x: m.col * TILE,
        y: m.row * TILE,
        dx: 0,
        dy: 0,
        hp: kinds[i] === 'bot' ? 3 : 1,
        alive: true,
        stunT: 0,
        cool: GUARD_COOLDOWN / 2,
        moveT: 0,
        pauseT: 0,
        lineAxis: i % 2 === 0 ? 'h' : 'v',
      });
    }

    // Enter at the door, one tile in.
    const entryCol = opts.entryCol ?? Math.floor(ROOM_COLS / 2) - 1;
    this.x = entryCol * TILE;
    this.y = (ROOM_ROWS - 2) * TILE;
    this.facing = 'u';

    if (opts.egg) {
      this.mode = 'egg';
      this.eggT = 0;
    } else if (opts.firstVisit && STORE_FIRST_VISIT[opts.store.id]) {
      this.mode = 'talk';
      this.talkLines = STORE_FIRST_VISIT[opts.store.id];
      this.talkT = 0;
    }
  }

  // ------------------------------------------------------------ public API

  step(input: StepInput): StoreEvent[] {
    this.events = [];
    this.frame++;
    this.tickTimers();
    switch (this.mode) {
      case 'egg':
        this.stepEgg(input);
        break;
      case 'talk':
        this.stepTalk(input);
        break;
      case 'hold':
        if (--this.holdT <= 0) this.mode = 'walk';
        break;
      case 'stun':
        if (--this.stunT <= 0) this.mode = 'walk';
        this.updateWorld();
        break;
      case 'search':
        this.stepSearch(input);
        this.updateWorld();
        break;
      case 'walk':
        this.stepWalk(input);
        this.updateWorld();
        break;
      case 'dead':
        break;
    }
    return this.flush();
  }

  /** The door tile position in pixels, for the fade back to the mall. */
  get doorCol(): number {
    return Math.floor(ROOM_COLS / 2) - 1;
  }

  get packageMessage(): string {
    return pkgBanner(this.opts.packagesFound + 1);
  }

  /** The easter-egg line the clerk is typing (typewriter reveal). */
  get eggText(): string {
    const total = EASTER_EGG_LINES.join(' ').length;
    const shown = Math.min(total, Math.floor((this.eggT / (SEC * 2.5)) * total));
    return EASTER_EGG_LINES.join(' ').slice(0, shown);
  }

  /** Whether a search could start right now (for the bottom strip prompt). */
  get canSearch(): boolean {
    return this.mode === "walk" && this.touchingFixture() !== null;
  }

  get searchProgress(): number {
    return this.searchOf ? Math.min(1, this.searchT / this.searchDuration()) : 0;
  }

  /** Everything the renderer needs to know. */
  get store(): StoreDef {
    return this.opts.store;
  }

  get template(): StoreTemplate {
    return this.opts.template;
  }

  get playerBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.x + HITBOX.ox, y: this.y + HITBOX.oy, w: HITBOX.w, h: HITBOX.h };
  }

  /** Whether the room has a guard still standing. */
  get guardsAlive(): number {
    return this.guards.filter((g) => g.alive).length;
  }

  solidAt(px: number, py: number): boolean {
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return true;
    return SOLID.has(this.rows[row][col]);
  }

  // ------------------------------------------------------------ internals

  private flush(): StoreEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private emit(e: StoreEvent): void {
    this.events.push(e);
  }

  private tickTimers(): void {
    if (this.shootCd > 0) this.shootCd--;
    if (this.graceT > 0) this.graceT--;
    this.puffs.forEach((p) => p.t--);
    this.puffs.splice(0, this.puffs.length, ...this.puffs.filter((p) => p.t > 0));
    this.bubbles.forEach((b) => b.t--);
    this.bubbles.splice(0, this.bubbles.length, ...this.bubbles.filter((b) => b.t > 0));
  }

  private assignContents(): void {
    const isTarget = this.opts.store.role === 'target';
    const isPower = this.opts.store.role === 'power';
    const f = this.fixtures;
    if (f.length === 0) return;
    if (isTarget) {
      const pkg = this.rng.int(0, f.length - 1);
      f.forEach((fx, i) => {
        if (i === pkg) {
          fx.contents = 'package';
          return;
        }
        const roll = this.rng.next();
        fx.contents = roll < 0.3 ? 'trap' : roll < 0.6 ? 'power' : 'nothing';
      });
    } else if (isPower) {
      f.forEach((fx) => (fx.contents = this.rng.chance(0.6) ? 'power' : 'nothing'));
    }
    for (const fx of f) {
      if (fx.contents === 'power' || (this.opts.blackFriday && fx.contents !== 'package')) {
        fx.contents = 'power';
        fx.power = this.randomPower();
      }
    }
  }

  private randomPower(): PowerUpId {
    const pool: PowerUpId[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'juli', 'pretzel'];
    return this.rng.pick(pool);
  }

  private searchDuration(): number {
    return this.opts.powerUps.speed?.id === 'sneakers' ? Math.round(SEARCH_FRAMES / 1.5) : SEARCH_FRAMES;
  }

  // ------------------------------------------------------------ talk & egg

  private stepTalk(input: StepInput): void {
    this.talkT++;
    if (this.talkT === 1) this.bubbleOn(0, this.talkLines[0]);
    if (this.talkT === TALK_LINE_GAP && this.talkLines[1]) this.bubbleOn(Math.min(1, this.guards.length - 1), this.talkLines[1]);
    this.stepWalk(input, false);
    if (this.talkT >= SEC * 3) this.mode = 'walk';
    this.updateWorld({ freezeGuards: true });
  }

  private bubbleOn(guardIndex: number, text: string): void {
    const g = this.guards[guardIndex];
    if (!g) return;
    this.bubbles.push({ x: g.x, y: g.y - 8, text, t: 2 * SEC });
    this.emit({ type: 'bubble', x: g.x, y: g.y - 8, text });
  }

  private stepEgg(input: StepInput): void {
    if (!this.eggPedestal) {
      this.eggT++;
      if (this.eggT === 1) this.emit({ type: 'sfx', name: 'blip' });
      if (this.eggT >= SEC * 2.5) {
        this.eggPedestal = true;
        this.emit({ type: 'sfx', name: 'pop' });
      }
      return;
    }
    // Walk freely now; step on the pedestal to take the item.
    this.stepWalk(input, false);
    const pedestal = this.tileRect('P');
    if (pedestal && this.overlaps(this.playerBox, pedestal) && !this.eggDone) {
      this.eggDone = true;
      const item = this.rng.pick(EASTER_EGG_ITEMS);
      this.emit({ type: 'easterEgg', item });
      this.emit({ type: 'score', points: POINTS.jokeItem, x: this.x, y: this.y - 4 });
      this.mode = 'walk';
    }
  }

  // ------------------------------------------------------------ walking

  private stepWalk(input: StepInput, allowSearch = true): void {
    const held = input.held;
    const pressed = new Set<Pad>(input.pressed);
    const dir = this.directionFrom(held);

    if (allowSearch && pressed.has('b')) {
      const target = this.touchingFixture();
      if (target) {
        this.startSearch(target);
        return;
      }
    }

    if (pressed.has('a') && this.shootCd === 0) this.shoot();

    if (dir) {
      this.facing = dir;
      const step = this.opts.powerUps.speed ? PLAYER_WALK * 1.5 : PLAYER_WALK;
      this.move(dir, step);
    }
    this.checkWorldTouches();
  }

  private directionFrom(held: ReadonlySet<Pad>): Facing | null {
    // Vertical input takes priority.
    if (held.has('up')) return 'u';
    if (held.has('down')) return 'd';
    if (held.has('left')) return 'l';
    if (held.has('right')) return 'r';
    return null;
  }

  private move(dir: Facing, step: number): void {
    let dx = 0;
    let dy = 0;
    if (dir === 'u') dy = -1;
    if (dir === 'd') dy = 1;
    if (dir === 'l') dx = -1;
    if (dir === 'r') dx = 1;
    for (let s = 0; s < step; s++) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (this.boxFree(nx, ny)) {
        this.x = nx;
        this.y = ny;
        continue;
      }
      // Zelda-style corner assist: slide sideways up to 3 px to slip past a corner.
      let moved = false;
      for (let off = 1; off <= 3 && !moved; off++) {
        for (const sgn of [1, -1]) {
          const ax = dx !== 0 ? this.x : this.x + sgn * off;
          const ay = dy !== 0 ? this.y : this.y + sgn * off;
          const tx = dx !== 0 ? this.x + dx : ax;
          const ty = dy !== 0 ? this.y + dy : ay;
          if (this.boxFree(tx, ty) && this.boxFree(ax, ay) && (dx !== 0 ? ay !== this.y : ax !== this.x)) {
            this.x = tx;
            this.y = ty;
            moved = true;
            break;
          }
        }
      }
      if (!moved) break;
    }
    this.x = Math.min(Math.max(this.x, 0), (ROOM_COLS - 1) * TILE);
    this.y = Math.min(Math.max(this.y, 0), (ROOM_ROWS - 1) * TILE);
  }

  private boxFree(x: number, y: number): boolean {
    const x0 = x + HITBOX.ox;
    const y0 = y + HITBOX.oy;
    const x1 = x0 + HITBOX.w - 1;
    const y1 = y0 + HITBOX.h - 1;
    return !this.solidAt(x0, y0) && !this.solidAt(x1, y0) && !this.solidAt(x0, y1) && !this.solidAt(x1, y1);
  }

  private overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private tileRect(ch: string): { x: number; y: number; w: number; h: number } | null {
    for (let r = 0; r < ROOM_ROWS; r++)
      for (let c = 0; c < ROOM_COLS; c++)
        if (this.rows[r][c] === ch) return { x: c * TILE, y: r * TILE, w: TILE, h: TILE };
    return null;
  }

  /** Fixtures the agent is touching (front or either side), within a 3 px margin. */
  private touchingFixture(): Fixture | null {
    const box = this.playerBox;
    const near = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 };
    let best: Fixture | null = null;
    let bestD = Infinity;
    for (const f of this.fixtures) {
      if (f.opened || f.ambushed) continue;
      const rect = { x: f.col * TILE, y: f.row * TILE, w: TILE, h: TILE };
      if (!this.overlaps(near, rect)) continue;
      const d = Math.abs(rect.x + 8 - (box.x + 6)) + Math.abs(rect.y + 8 - (box.y + 6));
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  private faceTowards(f: Fixture): void {
    const box = this.playerBox;
    const fx = f.col * TILE + 8;
    const fy = f.row * TILE + 8;
    const dx = fx - (box.x + 6);
    const dy = fy - (box.y + 6);
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'r' : 'l';
    else this.facing = dy > 0 ? 'd' : 'u';
  }

  private startSearch(f: Fixture): void {
    this.faceTowards(f);
    this.mode = 'search';
    this.searchOf = f;
    this.searchT = 0;
    this.emit({ type: 'sfx', name: 'search' });
  }

  private stepSearch(input: StepInput): void {
    const pressed = input.pressed;
    const cancel = pressed.some((p) => p === 'up' || p === 'down' || p === 'left' || p === 'right' || p === 'a');
    if (cancel || !this.searchOf) {
      this.mode = 'walk';
      this.searchOf = null;
      return;
    }
    this.searchT++;
    if (this.searchT % 6 === 0) this.emit({ type: 'sfx', name: 'search' });
    if (this.searchT >= this.searchDuration()) {
      const f = this.searchOf;
      this.searchOf = null;
      this.mode = 'walk';
      this.resolveFixture(f);
    }
  }

  private resolveFixture(f: Fixture): void {
    // Forever 12 fitting rooms: a quarter of the time a spy is changing in there.
    if (f.kind === 'L' && this.rng.chance(0.25)) {
      f.ambushed = true;
      this.emit({ type: 'banner', lines: ['OCCUPIED!!'], frames: SEC });
      this.emit({ type: 'sfx', name: 'shriek' });
      this.bubbles.push({ x: f.col * TILE, y: f.row * TILE - 8, text: 'OCCUPIED!!', t: 2 * SEC });
      this.guards.push({
        id: this.nextId++,
        kind: 'spy',
        x: f.col * TILE,
        y: Math.min(f.row + 1, ROOM_ROWS - 2) * TILE,
        dx: 0,
        dy: 0,
        hp: 1,
        alive: true,
        stunT: 0,
        cool: GUARD_COOLDOWN,
        moveT: 0,
        pauseT: 0,
        lineAxis: 'h',
      });
      return;
    }
    f.opened = true;
    this.opts.opened.add(f.index);
    this.emit({ type: 'sfx', name: 'search' });
    const cx = f.col * TILE;
    const cy = f.row * TILE;
    switch (f.contents) {
      case 'package': {
        this.holdT = HOLD_PACKAGE;
        this.mode = 'hold';
        this.holdText = this.packageMessage;
        this.emit({ type: 'packageFound', storeId: this.opts.store.id, index: this.opts.packagesFound + 1 });
        this.emit({ type: 'banner', lines: [this.packageMessage], frames: 2 * SEC });
        this.emit({ type: 'sfx', name: 'package' });
        this.emit({ type: 'score', points: POINTS.package, x: cx, y: cy });
        break;
      }
      case 'power': {
        const id = f.power ?? this.randomPower();
        this.holdT = HOLD_POWER;
        this.mode = 'hold';
        this.holdText = id;
        this.emit({ type: 'powerUp', id });
        this.emit({ type: 'banner', lines: [id.toUpperCase()], frames: SEC });
        this.emit({ type: 'sfx', name: 'powerup' });
        break;
      }
      case 'trap': {
        this.puff(cx, cy);
        this.emit({ type: 'banner', lines: [TRAP_BANNER], frames: SEC });
        this.stunT = SEC;
        this.mode = 'stun';
        break;
      }
      case 'nothing': {
        this.puff(cx, cy);
        this.emit({ type: 'banner', lines: [NOTHING_BANNER], frames: SEC });
        break;
      }
    }
  }

  private checkWorldTouches(): void {
    const box = this.playerBox;
    // Door: walking out through it leaves the store.
    const door = { x: this.doorCol * TILE, y: (ROOM_ROWS - 1) * TILE, w: TILE, h: TILE };
    if (this.overlaps(box, door) && this.mode === 'walk') {
      this.exited = true;
      this.emit({ type: 'exit' });
      return;
    }
    const booth = this.tileRect('B');
    if (booth && this.overlaps(box, booth) && !this.sideB) {
      this.sideB = true;
      this.emit({ type: 'sideB' });
    }
  }

  // ------------------------------------------------------------ shooting

  private shoot(): void {
    const live = this.bullets.filter((b) => b.owner === 'player').length;
    if (live >= this.opts.powerUps.maxBullets) return;
    if (this.mode === 'search') this.mode = 'walk';
    const [dx, dy] = this.vector(this.facing);
    const box = this.playerBox;
    this.bullets.push({ owner: 'player', x: box.x + 6, y: box.y + 6, dx, dy, life: 90 });
    this.shootCd = this.opts.powerUps.weapon?.id === 'rapid' ? 6 : 12;
    this.emit({ type: 'sfx', name: 'shot' });
  }

  private vector(f: Facing): [-1 | 0 | 1, -1 | 0 | 1] {
    switch (f) {
      case 'u':
        return [0, -1];
      case 'd':
        return [0, 1];
      case 'l':
        return [-1, 0];
      case 'r':
        return [1, 0];
    }
  }

  // ------------------------------------------------------------ world update

  private updateWorld(opts: { freezeGuards?: boolean } = {}): void {
    this.updateBullets();
    this.updateToys();
    this.updateGuards(!!opts.freezeGuards || this.mode === 'egg');
  }

  private updateBullets(): void {
    for (const b of this.bullets) {
      const speed = b.owner === 'player' ? 4 : 2;
      for (let s = 0; s < speed; s++) {
        b.x += b.dx;
        b.y += b.dy;
        if (this.solidAtBulletTile(b)) {
          b.life = 0;
          break;
        }
        if (b.owner === 'player') {
          if (this.hitGuard(b)) {
            b.life = 0;
            break;
          }
        } else if (this.hitPlayer(b)) {
          b.life = 0;
          break;
        }
      }
      b.life--;
    }
    this.bullets.splice(0, this.bullets.length, ...this.bullets.filter((b) => b.life > 0));
  }

  private solidAtBulletTile(b: Bullet): boolean {
    const col = Math.floor(b.x / TILE);
    const row = Math.floor(b.y / TILE);
    if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return true;
    const ch = this.rows[row][col];
    if (ch === 'S' && b.owner === 'player') {
      // Shooting a toy shelf opens it once and releases its wind-up toys; the bullet stops.
      const key = `${col},${row}`;
      if (!this.shelvesShot.has(key)) {
        this.shelvesShot.add(key);
        this.rows[row] = this.rows[row].slice(0, col) + '.' + this.rows[row].slice(col + 1);
        this.releaseToys(col * TILE + 8, row * TILE + 8);
      }
      return true;
    }
    return SOLID.has(ch);
  }

  private hitGuard(b: Bullet): boolean {
    for (const g of this.guards) {
      if (!g.alive) continue;
      if (b.x >= g.x && b.x < g.x + PLAYER_SIZE && b.y >= g.y && b.y < g.y + PLAYER_SIZE) {
        if (g.kind === 'bot') {
          g.hp--;
          this.emit({ type: 'sfx', name: 'ping' });
          if (g.hp > 0) return true;
        }
        g.alive = false;
        this.emit({ type: 'score', points: POINTS.spyShot, x: g.x, y: g.y });
        this.emit({ type: 'sfx', name: 'death' });
        this.bubbles.push({ x: g.x, y: g.y - 8, text: this.rng.pick(['NOT THE FACE!', 'WORTH IT. 70% OFF.', 'I WAS ON MY LUNCH BREAK!']), t: 2 * SEC });
        return true;
      }
    }
    return false;
  }

  private hitPlayer(b: Bullet): boolean {
    const box = this.playerBox;
    if (b.x >= box.x && b.x < box.x + box.w && b.y >= box.y && b.y < box.y + box.h) {
      this.hurt('shot');
      return true;
    }
    return false;
  }

  private hurt(cause: string): void {
    if (this.mode === 'dead' || this.opts.powerUps.isInvincible) return;
    if (this.opts.powerUps.absorbHit()) {
      this.emit({ type: 'sfx', name: 'hurt' });
      return;
    }
    this.mode = 'dead';
    this.emit({ type: 'sfx', name: 'death' });
    this.emit({ type: 'death', cause });
  }

  private releaseToys(x: number, y: number): void {
    const dirs: [-1 | 0 | 1, -1 | 0 | 1][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
    ];
    for (const [dx, dy] of dirs) this.toys.push({ x, y, dx, dy, life: 20 * SEC });
    this.emit({ type: 'sfx', name: 'pop' });
  }

  private updateToys(): void {
    for (const t of this.toys) {
      t.life--;
      const nx = t.x + t.dx * 1;
      const ny = t.y + t.dy * 1;
      if (this.solidAt(nx, ny)) {
        // Turn at walls: rotate 90 degrees.
        [t.dx, t.dy] = [-t.dy as -1 | 0 | 1, t.dx as -1 | 0 | 1];
        continue;
      }
      t.x = nx;
      t.y = ny;
      for (const g of this.guards) {
        if (g.alive && Math.abs(g.x - t.x) < 12 && Math.abs(g.y - t.y) < 12) g.stunT = 2 * SEC;
      }
      const f = this.fixtures.find((fx) => !fx.opened && fx.contents === 'trap' && Math.abs(fx.col * TILE - t.x) < 12 && Math.abs(fx.row * TILE - t.y) < 12);
      if (f) {
        f.opened = true;
        this.opts.opened.add(f.index);
        this.puff(f.col * TILE, f.row * TILE);
      }
    }
    this.toys.splice(0, this.toys.length, ...this.toys.filter((t) => t.life > 0));
  }

  /** A puff of smoke stuns guards close to it for a moment. */
  private puff(x: number, y: number): void {
    this.puffs.push({ x, y, t: 40 });
    this.emit({ type: 'sfx', name: 'smoke' });
    for (const g of this.guards) {
      if (g.alive && Math.abs(g.x - x) < 24 && Math.abs(g.y - y) < 24) g.stunT = Math.max(g.stunT, 60);
    }
  }

  private updateGuards(frozen: boolean): void {
    if (frozen) return;
    const box = this.playerBox;
    const px = box.x + 6;
    const py = box.y + 6;
    for (const g of this.guards) {
      if (!g.alive) continue;
      if (g.stunT > 0) {
        g.stunT--;
        continue;
      }
      if (g.kind === 'bot') {
        this.patrolBot(g);
      } else {
        this.moveSpy(g, px, py);
        if (this.graceT === 0) this.maybeShoot(g, px, py);
      }
      // Touching a guard hurts the agent, unless a Cinnabomb makes the guard the one that dies.
      if (Math.abs(g.x + 8 - px) < 12 && Math.abs(g.y + 8 - py) < 12) {
        if (this.opts.powerUps.isInvincible) {
          g.alive = false;
          this.emit({ type: 'score', points: POINTS.spyShot, x: g.x, y: g.y });
        } else {
          this.hurt('touched a guard');
        }
      }
    }
  }

  /** Spies move tile by tile, favouring the agent's side. */
  private moveSpy(g: Guard, px: number, py: number): void {
    if (g.moveT > 0) {
      g.x += g.dx * GUARD_SPEED;
      g.y += g.dy * GUARD_SPEED;
      g.moveT--;
      if (g.moveT === 0) g.pauseT = GUARD_PAUSE;
      return;
    }
    if (g.pauseT > 0) {
      g.pauseT--;
      return;
    }
    const gx = g.x + 8;
    const gy = g.y + 8;
    let dir: [-1 | 0 | 1, -1 | 0 | 1];
    const preferX = Math.abs(px - gx) > Math.abs(py - gy);
    if (this.rng.chance(0.3)) {
      dir = this.rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as [-1 | 0 | 1, -1 | 0 | 1][]);
    } else if (preferX) {
      dir = [px > gx ? 1 : -1, 0];
    } else {
      dir = [0, py > gy ? 1 : -1];
    }
    const nx = g.x + dir[0] * GUARD_STEP;
    const ny = g.y + dir[1] * GUARD_STEP;
    if (!this.solidAt(nx + 8, ny + 8) && !this.solidAt(nx, ny) && !this.solidAt(nx + 15, ny + 15)) {
      g.dx = dir[0];
      g.dy = dir[1];
      g.moveT = GUARD_STEP;
    } else {
      g.pauseT = GUARD_PAUSE;
    }
  }

  private patrolBot(g: Guard): void {
    const sp = 0.5;
    const ux = g.lineAxis === 'h' ? (g.dx === 0 ? 1 : g.dx) : 0;
    const uy = g.lineAxis === 'v' ? (g.dy === 0 ? 1 : g.dy) : 0;
    const nx = g.x + ux * sp;
    const ny = g.y + uy * sp;
    if (this.solidAt(nx + 8, ny + 8) || this.solidAt(nx + 15, ny + 15) || this.solidAt(nx, ny)) {
      // Turn around at a wall.
      g.dx = (g.lineAxis === 'h' ? -ux : 0) as -1 | 0 | 1;
      g.dy = (g.lineAxis === 'v' ? -uy : 0) as -1 | 0 | 1;
      return;
    }
    g.x = nx;
    g.y = ny;
    g.dx = ux as -1 | 0 | 1;
    g.dy = uy as -1 | 0 | 1;
  }

  /** Spies shoot along straight lines when they are lined up with the agent and the path is clear. */
  private maybeShoot(g: Guard, px: number, py: number): void {
    if (g.cool > 0) {
      g.cool--;
      return;
    }
    const gx = g.x + 8;
    const gy = g.y + 8;
    let dir: [-1 | 0 | 1, -1 | 0 | 1] | null = null;
    if (Math.abs(gy - py) < 8) dir = [px > gx ? 1 : -1, 0];
    else if (Math.abs(gx - px) < 8) dir = [0, py > gy ? 1 : -1];
    if (!dir || !this.clearLine(gx, gy, px, py)) return;
    this.bullets.push({ owner: 'guard', x: gx, y: gy, dx: dir[0], dy: dir[1], life: 120 });
    this.emit({ type: 'sfx', name: 'enemyShot' });
    g.cool = GUARD_COOLDOWN;
  }

  private clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 1; s < steps; s += 4) {
      const t = s / steps;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

}

