/**
 * STORE WORLD (top-down room). Pure, deterministic, 60 Hz. No DOM / canvas / audio imports.
 *
 * Usage:   const w = createStore({ id, seed, progress });   // once per store visit
 *          w.step(pad, sink);                                // once per unpaused frame
 * The Session ticks tickPower()/tickLevelClock() itself (never done here). Session handles fades: when `exited`
 * becomes true fade back to the mall; when `outOfLives` becomes true run Continue / Game Over. A store that cannot
 * be entered (closed, or a target whose package is taken) is created already `exited` with `refused` true (check
 * `canEnterStore(progress, id)` before creating one). The first step() emits music `store:<id>`.
 *
 * PUBLIC STATE FOR RENDERERS (all plain data; full field docs in ./types.ts and ./README.md). Coordinates are
 * room pixels (top-left origin, +y down); sprites are 16x16 with the top-left at (x,y), positions may be fractional.
 *   room        {w,h,pxW,pxH,theme,rows[],doorCol,doorRow}   tile chars per tilekinds.ts
 *   camera      {x,y}         viewport top-left (VIEW_W x VIEW_H = 256x176); follows the player, clamped to the room
 *   player      {x,y,facing,anim: walk|search|hold|stun|die|hidden|idle, animT, blink, invuln, stun, held, heldT}
 *   guards[]    {type spy|bot, x,y, facing, anim, animT, hp, maxHp, alive, stunT, hurtT}  (anim 'gone' = do not draw)
 *   bullets[]   {x,y (centre), vx,vy, from: player|spy|shoe}
 *   fixtures[]  {index,tx,ty,kind,open,mark (radar '!'),content (only once open),revealed,revealT}
 *   toys[], toyShelves[], puffs[], particles[], bubbles[] (guard index + text), banner {lines,t,ttl,kind}|null
 *   search      {fixture,t,dur,progress 0..1}|null           strip {title,text,mode,bar}  (bottom strip)
 *   egg         GameStonk cave scene state | null            booth {tx,ty,active,nowPlaying}|null
 *   frame, cleared, exited, outOfLives, refused
 * Test helpers: stateHash() (deterministic hash of the whole world + progress), snapshot().
 */
import { Rng, hashString } from '../../core/rng';
import type { EventSink, MusicName, StoreId } from '../../core/events';
import type { PadFrame } from '../../core/pad';
import { STORE_BY_ID, type StoreDef } from '../../data/stores';
import { FIRST_VISIT, GAMESTONK_EGG, MISC, POWERUP_NAMES } from '../../data/copy';
import { TILE } from '../geometry';
import { difficulty, type Difficulty } from '../difficulty';
import { absorbHit, addScore, applyPowerup, isInvincible, loseOnDeath, walkSpeedMul, type Progress } from '../progress';
import type { StoreWorldApi } from '../api';
import { SEARCHABLE_KINDS, SOLID_KINDS, TILE_CHARS, type TileKind } from './tilekinds';
import { EMPTY_TEMPLATE, TEMPLATES } from './templates';
import { generateContents } from './layout';
import {
  DIR_VEC, VIEW_H, VIEW_W,
  type BannerState, type BoothState, type BubbleState, type BulletKind, type BulletState, type CameraState, type Dir, type EggState,
  type FixtureContent, type FixtureState, type GuardStart, type GuardState, type HeldItem, type ParticleState, type PlayerState,
  type PuffState, type RoomInfo, type SearchState, type StoreTemplate, type StripState, type ToyShelfState, type ToyState,
} from './types';
import type { OpenStoreId } from '../../core/events';

export * from './types';
export { TEMPLATES } from './templates';
export { generateContents, layoutSeed } from './layout';

// ---- tuning (px, frames) ----
export const PLAYER_SPEED = 1.25;
export const PLAYER_BULLET_SPEED = 3;
export const RAPID_BULLET_SPEED = 4;
export const ENEMY_BULLET_SPEED = 2;
export const SHOE_SPEED = 1.6;
export const SEARCH_FRAMES = 45;
export const TRAP_STUN_FRAMES = 60;
export const RESPAWN_INVULN = 120;
export const DEATH_FRAMES = 60;
export const GRACE_FRAMES = 90; // guards hold fire this long after the player walked in / respawned
export const SPY_AIM_FRAMES = 30; // telegraph pose before a shot
export const TOY_COUNT = 3;
export const FITTING_SPY_CHANCE = 0.25;
const HB = 12;
const INSET = 2;
const CORNER_ASSIST = 6;
const TOUCH_MARGIN = 6;
const SPY_SPEED = 0.8;
const BOT_SPEED = 0.7;
const TOY_SPEED = 0.5;
const TOY_LIFE = 900;
const STUN_TOY = 120;
const STUN_SMOKE = 150;

export interface StoreOptions {
  id: StoreId;
  /** Seed for guard behaviour (fitting rolls, spy decisions). Fixture layout uses progress.seed. */
  seed: number;
  progress: Progress;
  /** Override the room (tests / future big anchor stores). Door must be 'd' at bottom centre. */
  template?: StoreTemplate;
}

/** A target store whose package was taken cannot be entered again; closed stores never open. */
export function canEnterStore(progress: Progress, id: StoreId): boolean {
  const def = STORE_BY_ID[id];
  if (!def || def.role === 'closed') return false;
  if (def.role === 'target' && progress.packages.includes(id)) return false;
  return true;
}

const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
const CW: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };
const CCW: Record<Dir, Dir> = { up: 'left', left: 'down', down: 'right', right: 'up' };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export class StoreWorld implements StoreWorldApi {
  readonly storeId: StoreId;
  readonly progress: Progress;
  readonly def: StoreDef;
  exited = false;
  outOfLives = false;
  cleared: boolean;
  /** True when created for a store that cannot be entered (already exited). */
  refused = false;
  frame = 0;

  readonly room: RoomInfo;
  camera: CameraState = { x: 0, y: 0 };
  player: PlayerState;
  guards: GuardState[] = [];
  bullets: BulletState[] = [];
  fixtures: FixtureState[] = [];
  toys: ToyState[] = [];
  toyShelves: ToyShelfState[] = [];
  puffs: PuffState[] = [];
  particles: ParticleState[] = [];
  bubbles: BubbleState[] = [];
  banner: BannerState | null = null;
  search: SearchState | null = null;
  strip: StripState;
  egg: EggState | null = null;
  booth: BoothState | null = null;
  /** Player is in the death animation. */
  dying = false;

  private readonly tiles: TileKind[][];
  private readonly rng: Rng;
  private readonly diff: Difficulty;
  private readonly contents: FixtureContent[];
  private readonly fixIdx = new Map<number, number>();
  private readonly spawn: { x: number; y: number };
  private musicStarted = false;
  private deathT = 0;
  private shotCd = 0;
  private toyId = 0;
  private moved = false;
  private guardFreezeUntil = 0;
  private shootAfter = GRACE_FRAMES;
  private script: { at: number; guard: number; text: string }[] = [];
  private eggTyping = { line: 0, ch: 0, wait: 0 };

  constructor(opts: StoreOptions) {
    this.storeId = opts.id;
    this.progress = opts.progress;
    this.def = STORE_BY_ID[opts.id];
    const p = opts.progress;
    const enterable = canEnterStore(p, opts.id);
    const tpl = opts.template ?? TEMPLATES[opts.id as OpenStoreId] ?? EMPTY_TEMPLATE;
    const rows = tpl.rows;
    const h = rows.length;
    const w = rows[0].length;
    this.tiles = rows.map((r) => {
      if (r.length !== w) throw new Error('store template rows must have equal length');
      return [...r].map((c) => {
        const k = TILE_CHARS[c];
        if (!k) throw new Error(`unknown tile char '${c}'`);
        return k;
      });
    });
    const doorCol = Math.floor(w / 2);
    this.room = { w, h, pxW: w * TILE, pxH: h * TILE, theme: this.def?.theme ?? 'novelty', rows, doorCol, doorRow: h - 1 };
    this.rng = new Rng((opts.seed ^ hashString(opts.id) ^ Math.imul(p.loop, 0x85ebca6b)) >>> 0);
    this.diff = difficulty(p.loop, p.blackFriday);
    this.cleared = !!this.def && this.def.role === 'target' && p.packages.includes(opts.id);
    this.spawn = { x: doorCol * TILE, y: (h - 2) * TILE };
    this.player = {
      x: this.spawn.x, y: this.spawn.y, facing: 'up', anim: 'idle', animT: 0, blink: false, invuln: 0, stun: 0, held: null, heldT: 0,
    };
    this.strip = { title: this.def?.name ?? '', text: '', mode: 'none', bar: null };

    // fixtures (row-major)
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const k = this.tiles[ty][tx];
        if (SEARCHABLE_KINDS.has(k)) {
          const index = this.fixtures.length;
          this.fixIdx.set(ty * w + tx, index);
          this.fixtures.push({ index, tx, ty, kind: k as FixtureState['kind'], open: false, mark: false, content: null, revealed: false, revealT: 0, rolled: false });
        } else if (k === 'toyshelf') {
          this.toyShelves.push({ tx, ty, released: false });
        } else if (k === 'booth' && !this.booth) {
          this.booth = { tx, ty, active: false, nowPlaying: null };
        }
      }
    }
    this.contents = this.def && this.def.role !== 'closed' ? generateContents(opts.id, this.fixtures.length, p.seed, p.loop, p.blackFriday) : this.fixtures.map(() => ({ kind: 'nothing' as const }));
    for (const idx of p.opened[opts.id] ?? []) {
      const fx = this.fixtures[idx];
      if (fx) fx.open = true;
    }
    this.refreshFixtures();

    if (!enterable) {
      this.refused = true;
      this.exited = true;
      this.updateCamera();
      return;
    }

    // guards
    const [gmin, gmax] = this.def.guardCount;
    const n = Math.min(tpl.guards.length, this.rng.range(gmin, Math.max(gmin, gmax)));
    for (let i = 0; i < n; i++) this.addGuard(tpl.guards[i]);
    const vl = FIRST_VISIT[opts.id];
    if (vl && vl.some((l) => l.who === 'bot') && !this.guards.some((g) => g.type === 'bot')) this.addFallbackBot();

    // first visit lines (once per GAME)
    if (!p.visited.includes(opts.id)) {
      p.visited.push(opts.id);
      if (vl && this.guards.length > 0) this.buildScript(vl);
    }

    // GameStonk easter egg (once per GAME)
    if (opts.id === 'gamestonk' && !p.gamestonkEggDone) this.buildEgg();
    this.updateCamera();
  }

  // ------------------------------------------------------------------ setup helpers

  private addGuard(s: GuardStart): void {
    const type = s.type;
    this.guards.push({
      index: this.guards.length, type, x: s.col * TILE, y: s.row * TILE, facing: 'down', anim: 'idle', animT: 0,
      hp: type === 'bot' ? 3 : 1, maxHp: type === 'bot' ? 3 : 1, alive: true, stunT: 0, hurtT: 0,
      startX: s.col * TILE, startY: s.row * TILE, axis: s.axis ?? 'h', dirSign: 1, moveTo: null, wait: this.rng.range(10, 40),
      aimT: 0, aimDir: 'down', aimKind: 'bullet', cooldown: 0,
    });
  }

  private addFallbackBot(): void {
    for (let ty = 2; ty < this.room.h - 3; ty++) {
      let run = 0;
      for (let tx = 1; tx < this.room.w - 1; tx++) {
        run = this.tiles[ty][tx] === 'floor' ? run + 1 : 0;
        if (run >= 4) {
          this.addGuard({ type: 'bot', col: tx - 3, row: ty, axis: 'h' });
          return;
        }
      }
    }
  }

  private buildScript(lines: readonly { who: 'spy' | 'bot'; text: string }[]): void {
    const spies = this.guards.filter((g) => g.type === 'spy').map((g) => g.index);
    const bots = this.guards.filter((g) => g.type === 'bot').map((g) => g.index);
    let spyN = 0;
    let last = 0;
    lines.forEach((ln, k) => {
      let gi: number;
      if (ln.who === 'bot') gi = bots.length ? bots[0] : spies[0] ?? 0;
      else gi = spies.length ? spies[spyN++ % spies.length] : bots[0] ?? 0;
      const at = 20 + 60 * k;
      this.script.push({ at, guard: gi, text: ln.text });
      last = at;
    });
    this.guardFreezeUntil = last + 80;
    this.shootAfter = this.guardFreezeUntil + 60;
  }

  private buildEgg(): void {
    const vs: { tx: number; ty: number }[] = [];
    let ped: { tx: number; ty: number } | null = null;
    for (let ty = 0; ty < this.room.h; ty++)
      for (let tx = 0; tx < this.room.w; tx++) {
        if (this.tiles[ty][tx] === 'demotv') vs.push({ tx, ty });
        if (this.tiles[ty][tx] === 'pedestal' && !ped) ped = { tx, ty };
      }
    if (vs.length < 2 || !ped) return;
    const a = vs[0];
    const b = vs[vs.length - 1];
    this.progress.gamestonkEggDone = true;
    this.egg = {
      phase: 'talk',
      clerk: { x: ((a.tx + b.tx) / 2) * TILE, y: a.ty * TILE, visible: true },
      tvs: [a, b],
      pedestal: ped,
      lines: [''],
      item: this.rng.pick(GAMESTONK_EGG.items),
      itemVisible: false,
      t: 0,
    };
    this.eggTyping = { line: 0, ch: 0, wait: 20 };
  }

  // ------------------------------------------------------------------ tile helpers

  private kindAt(tx: number, ty: number): TileKind | null {
    if (tx < 0 || ty < 0 || tx >= this.room.w || ty >= this.room.h) return null;
    return this.tiles[ty][tx];
  }
  private solidTile(tx: number, ty: number): boolean {
    const k = this.kindAt(tx, ty);
    return k === null || SOLID_KINDS.has(k);
  }
  private floorTile(tx: number, ty: number): boolean {
    const k = this.kindAt(tx, ty);
    return k === 'floor' || k === 'booth' || k === 'pedestal';
  }
  private rectHits(x: number, y: number, w: number, h: number, pred: (tx: number, ty: number) => boolean): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (pred(tx, ty)) return true;
    return false;
  }
  private playerBlocked(x: number, y: number): boolean {
    return this.rectHits(x + INSET, y + INSET, HB, HB, (tx, ty) => this.solidTile(tx, ty));
  }
  private guardBlocked(x: number, y: number): boolean {
    return this.rectHits(x + INSET, y + INSET, HB, HB, (tx, ty) => !this.floorTile(tx, ty));
  }
  private tileKindAtPx(px: number, py: number): TileKind | null {
    return this.kindAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  // ------------------------------------------------------------------ events / fx helpers

  private say(sink: EventSink, lines: string[], kind: BannerState['kind'], frames: number): void {
    this.banner = { lines, t: 0, ttl: frames, kind };
    sink.push({ t: 'banner', lines, frames, kind });
  }
  private puff(x: number, y: number, kind: PuffState['kind'] = 'smoke'): void {
    this.puffs.push({ x, y, t: 0, ttl: 26, kind });
  }
  private sparks(x: number, y: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.next();
      this.particles.push({ x, y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, t: 0, ttl: 14, kind: 'spark' });
    }
  }
  private currentMusic(): MusicName {
    return this.booth?.active ? 'booth' : (`store:${this.storeId}` as MusicName);
  }

  // ------------------------------------------------------------------ main step

  step(pad: PadFrame, sink: EventSink): void {
    if (this.exited || this.outOfLives) return;
    this.frame++;
    if (!this.musicStarted) {
      this.musicStarted = true;
      sink.push({ t: 'music', name: this.currentMusic() });
    }
    this.tickFx();
    if (this.egg && this.egg.phase === 'talk') {
      this.tickEggTalk(sink);
      this.finishFrame();
      return;
    }
    if (this.dying) {
      this.tickDeath(sink);
      this.finishFrame();
      return;
    }
    this.tickScript(sink);
    this.tickPlayerTimers(sink);
    this.playerControl(pad, sink);
    this.tickBooth(sink);
    this.tickEggPickup(sink);
    this.updateGuards(sink);
    this.updateToys(sink);
    this.updateBullets(sink);
    this.contact(sink);
    if (!this.dying && !this.exited) this.checkExit(sink);
    this.finishFrame();
  }

  private tickFx(): void {
    if (this.banner && ++this.banner.t >= this.banner.ttl) this.banner = null;
    for (const p of this.puffs) p.t++;
    this.puffs = this.puffs.filter((p) => p.t < p.ttl);
    for (const q of this.particles) {
      q.t++;
      q.x += q.vx;
      q.y += q.vy;
    }
    this.particles = this.particles.filter((q) => q.t < q.ttl);
    for (const b of this.bubbles) b.t++;
    this.bubbles = this.bubbles.filter((b) => b.t < b.ttl);
    for (const f of this.fixtures) if (f.revealed && f.revealT < 60) f.revealT++;
  }

  private finishFrame(): void {
    const pl = this.player;
    pl.blink = pl.invuln > 0 && ((this.frame >> 2) & 1) === 1;
    let anim: PlayerState['anim'];
    if (this.dying) anim = 'die';
    else if (pl.stun > 0) anim = 'stun';
    else if (pl.heldT > 0) anim = 'hold';
    else if (this.search) anim = 'search';
    else if (this.moved) anim = 'walk';
    else anim = 'idle';
    if (anim === pl.anim) pl.animT++;
    else {
      pl.anim = anim;
      pl.animT = 0;
    }
    this.refreshFixtures();
    this.updateStrip();
    this.updateCamera();
  }

  private refreshFixtures(): void {
    for (const f of this.fixtures) {
      const c = this.contents[f.index];
      f.content = f.open ? c : null;
      f.mark = this.progress.power.radar && !f.open && c.kind === 'package';
    }
  }

  private updateStrip(): void {
    const s = this.strip;
    s.title = this.def.name;
    if (this.search) {
      s.mode = 'searching';
      s.text = MISC.searching;
      s.bar = this.search.progress;
    } else if (this.canAct() && this.findCandidate() >= 0) {
      s.mode = 'ready';
      s.text = MISC.pressSearch;
      s.bar = null;
    } else {
      s.mode = 'none';
      s.text = '';
      s.bar = null;
    }
  }

  private updateCamera(): void {
    const cx = this.player.x + TILE / 2 - VIEW_W / 2;
    const cy = this.player.y + TILE / 2 - VIEW_H / 2;
    this.camera.x = Math.round(Math.max(0, Math.min(cx, Math.max(0, this.room.pxW - VIEW_W))));
    this.camera.y = Math.round(Math.max(0, Math.min(cy, Math.max(0, this.room.pxH - VIEW_H))));
  }

  private canAct(): boolean {
    const p = this.player;
    return !this.dying && !this.exited && p.stun <= 0 && p.heldT <= 0 && !(this.egg && this.egg.phase === 'talk');
  }

  // ------------------------------------------------------------------ first-visit script

  private tickScript(sink: EventSink): void {
    for (const s of this.script) {
      if (s.at === this.frame) {
        this.bubbles.push({ guard: s.guard, text: s.text, t: 0, ttl: 90 });
        sink.push({ t: 'sfx', name: 'blip' });
      }
    }
  }

  // ------------------------------------------------------------------ player

  private tickPlayerTimers(sink: EventSink): void {
    const p = this.player;
    if (p.invuln > 0) p.invuln--;
    if (p.stun > 0) p.stun--;
    if (this.shotCd > 0) this.shotCd--;
    if (p.heldT > 0 && --p.heldT === 0) {
      p.held = null;
      if (this.egg && this.egg.phase === 'get') {
        this.egg.phase = 'done';
        this.egg.clerk.visible = false;
        this.puff(this.egg.clerk.x + 8, this.egg.clerk.y + 8, 'poof');
        sink.push({ t: 'sfx', name: 'smoke' });
        this.shootAfter = Math.max(this.shootAfter, this.frame + 60);
      }
      sink.push({ t: 'music', name: this.currentMusic() });
    }
  }

  private startHold(item: HeldItem, frames: number): void {
    this.player.held = item;
    this.player.heldT = frames;
    this.search = null;
  }

  private playerControl(pad: PadFrame, sink: EventSink): void {
    this.moved = false;
    if (!this.canAct()) return;
    const pr = pad.pressed;
    const held = pad.held;
    if (this.search) {
      if (pr.up || pr.down || pr.left || pr.right || pr.a) {
        this.search = null; // fresh direction press or shooting cancels
      } else {
        const s = this.search;
        s.t++;
        s.progress = Math.min(1, s.t / s.dur);
        if (s.t % 10 === 0 && s.t < s.dur) sink.push({ t: 'sfx', name: 'tick' });
        if (s.t >= s.dur) this.finishSearch(sink);
        return;
      }
    }
    // shooting
    const w = this.progress.power.weapon;
    const rapid = w?.kind === 'rapid';
    const spread = w?.kind === 'spread';
    if ((pr.a || (rapid && held.a)) && this.shotCd <= 0) {
      const max = rapid ? 4 : spread ? 6 : 2;
      if (this.bullets.filter((b) => b.from === 'player').length < max) this.shoot(spread, rapid ? RAPID_BULLET_SPEED : PLAYER_BULLET_SPEED, sink);
      this.shotCd = rapid ? 6 : 14;
    }
    // search: fresh press of B only
    if (pr.b) {
      const c = this.findCandidate();
      if (c >= 0) {
        const fx = this.fixtures[c];
        this.player.facing = dirOf(fx.tx * TILE + 8 - (this.player.x + 8), fx.ty * TILE + 8 - (this.player.y + 8));
        const dur = Math.max(20, Math.round(SEARCH_FRAMES / walkSpeedMul(this.progress)));
        this.search = { fixture: c, t: 0, dur, progress: 0 };
        sink.push({ t: 'sfx', name: 'tick' });
        return;
      }
    }
    // movement: vertical input has priority
    let d: Dir | null = null;
    if (held.up !== held.down) d = held.up ? 'up' : 'down';
    else if (held.left !== held.right) d = held.left ? 'left' : 'right';
    if (d) {
      this.player.facing = d;
      this.moved = true;
      this.movePlayer(d, PLAYER_SPEED * walkSpeedMul(this.progress));
    }
  }

  private movePlayer(d: Dir, speed: number): void {
    const v = DIR_VEC[d];
    const p = this.player;
    const nx = p.x + v.x * speed;
    const ny = p.y + v.y * speed;
    if (!this.playerBlocked(nx, ny)) {
      p.x = nx;
      p.y = ny;
      return;
    }
    // slide up to the wall
    for (let a = speed - 0.25; a > 0; a -= 0.25) {
      const sx = p.x + v.x * a;
      const sy = p.y + v.y * a;
      if (!this.playerBlocked(sx, sy)) {
        p.x = sx;
        p.y = sy;
        break;
      }
    }
    // Zelda-style corner assist: nudge sideways past a nearby corner
    const px = v.x === 0 ? 1 : 0; // perpendicular axis vector
    const py = v.x === 0 ? 0 : 1;
    for (let off = 1; off <= CORNER_ASSIST; off++) {
      for (const sg of [-1, 1]) {
        const ox = p.x + px * sg * off;
        const oy = p.y + py * sg * off;
        if (!this.playerBlocked(ox, oy) && !this.playerBlocked(ox + v.x * speed, oy + v.y * speed)) {
          const m = Math.min(speed, off);
          p.x += px * sg * m;
          p.y += py * sg * m;
          return;
        }
      }
    }
  }

  private checkExit(sink: EventSink): void {
    if (this.player.y >= (this.room.h - 1) * TILE - INSET) {
      this.exited = true;
      this.search = null;
      sink.push({ t: 'sfx', name: 'door' });
    }
  }

  // ------------------------------------------------------------------ shooting

  private shoot(spread: boolean, speed: number, sink: EventSink): void {
    const p = this.player;
    const v = DIR_VEC[p.facing];
    const cx = p.x + 8 + v.x * 8;
    const cy = p.y + 8 + v.y * 8;
    const mk = (vx: number, vy: number): void => {
      this.bullets.push({ x: cx, y: cy, vx: vx * speed, vy: vy * speed, from: 'player', ttl: 200 });
    };
    mk(v.x, v.y);
    if (spread) {
      // 3-way fan: +-30 degrees around the facing direction
      const c = 0.866;
      const s = 0.5;
      mk(v.x * c - v.y * s, v.y * c + v.x * s);
      mk(v.x * c + v.y * s, v.y * c - v.x * s);
    }
    sink.push({ t: 'sfx', name: 'shot' });
  }

  // ------------------------------------------------------------------ searching

  /** Index of the searchable fixture the agent touches (front or either side, 6px tolerance, diagonals count), or -1. */
  findCandidate(): number {
    const p = this.player;
    const fv = DIR_VEC[p.facing];
    const ex0 = p.x + INSET - TOUCH_MARGIN;
    const ey0 = p.y + INSET - TOUCH_MARGIN;
    const ex1 = p.x + INSET + HB + TOUCH_MARGIN;
    const ey1 = p.y + INSET + HB + TOUCH_MARGIN;
    let best = -1;
    let bestScore = 0;
    for (const f of this.fixtures) {
      if (f.open) continue;
      const tx0 = f.tx * TILE;
      const ty0 = f.ty * TILE;
      const ox = Math.min(ex1, tx0 + TILE) - Math.max(ex0, tx0);
      const oy = Math.min(ey1, ty0 + TILE) - Math.max(ey0, ty0);
      if (ox <= 0 || oy <= 0) continue;
      const dx = tx0 + 8 - (p.x + 8);
      const dy = ty0 + 8 - (p.y + 8);
      const dot = dx * fv.x + dy * fv.y;
      if (dot < -8) continue; // behind the agent
      const score = ox * oy + (dot > 0 ? 6 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = f.index;
      }
    }
    return best;
  }

  private markOpen(fx: FixtureState): void {
    fx.open = true;
    const list = (this.progress.opened[this.storeId] ??= []);
    if (!list.includes(fx.index)) list.push(fx.index);
  }

  private finishSearch(sink: EventSink): void {
    const s = this.search!;
    this.search = null;
    const fx = this.fixtures[s.fixture];
    const p = this.player;
    // fitting rooms: one 25% roll for a spy mid-change; real contents stay unsearched
    if (fx.kind === 'fitting' && !fx.rolled) {
      fx.rolled = true;
      if (this.rng.chance(FITTING_SPY_CHANCE)) {
        this.revealSpy(fx, sink);
        return;
      }
    }
    this.markOpen(fx);
    const c = this.contents[fx.index];
    const cx = fx.tx * TILE + 8;
    const cy = fx.ty * TILE + 8;
    switch (c.kind) {
      case 'package': {
        if (!this.progress.packages.includes(this.storeId)) this.progress.packages.push(this.storeId);
        this.cleared = true;
        addScore(this.progress, 500, sink);
        sink.push({ t: 'sfx', name: 'fanfare' });
        sink.push({ t: 'music', name: 'jingle:package' });
        this.say(sink, [MISC.packageGot(this.progress.packages.length)], 'package', 150);
        this.startHold({ kind: 'package', name: 'package' }, 110);
        break;
      }
      case 'powerup': {
        applyPowerup(this.progress, c.power, sink);
        this.say(sink, [POWERUP_NAMES[c.power]], 'item', 120);
        this.startHold({ kind: 'powerup', name: c.power }, 90);
        break;
      }
      case 'trap':
        this.puff(cx, cy);
        sink.push({ t: 'sfx', name: 'smoke' });
        this.say(sink, [MISC.trap], 'info', 100);
        p.stun = TRAP_STUN_FRAMES;
        break;
      case 'nothing':
        this.puff(cx, cy);
        sink.push({ t: 'sfx', name: 'smoke' });
        this.say(sink, [MISC.nothing], 'info', 80);
        break;
    }
  }

  private revealSpy(fx: FixtureState, sink: EventSink): void {
    fx.revealed = true;
    fx.revealT = 0;
    const p = this.player;
    const occupied = (tx: number, ty: number): boolean =>
      this.guards.some((g) => g.alive && Math.abs(g.x - tx * TILE) < TILE && Math.abs(g.y - ty * TILE) < TILE) ||
      (Math.abs(p.x - tx * TILE) < TILE - 1 && Math.abs(p.y - ty * TILE) < TILE - 1);
    let spot: { tx: number; ty: number } | null = null;
    outer: for (let r = 1; r <= 3; r++) {
      for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const tx = fx.tx + dx * r;
        const ty = fx.ty + dy * r;
        if (this.floorTile(tx, ty) && this.kindAt(tx, ty) === 'floor' && !occupied(tx, ty)) {
          spot = { tx, ty };
          break outer;
        }
      }
    }
    if (!spot) spot = { tx: fx.tx, ty: fx.ty };
    this.addGuard({ type: 'spy', col: spot.tx, row: spot.ty });
    const g = this.guards[this.guards.length - 1];
    g.wait = 0;
    g.aimT = 34;
    g.aimKind = 'shoe';
    g.facing = dirOf(p.x - g.x, p.y - g.y);
    g.cooldown = 90;
    this.bubbles.push({ guard: g.index, text: MISC.fitting, t: 0, ttl: 70 });
    sink.push({ t: 'sfx', name: 'shriek' });
    this.puff(fx.tx * TILE + 8, fx.ty * TILE + 8, 'poof');
  }

  // ------------------------------------------------------------------ guards

  private tileOf(px: number, py: number): { tx: number; ty: number } {
    return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
  }

  private updateGuards(sink: EventSink): void {
    const frozen = this.frame < this.guardFreezeUntil;
    for (const g of this.guards) {
      if (g.anim === 'gone') continue;
      if (!g.alive) {
        g.animT++;
        if (g.animT >= 24) g.anim = 'gone';
        continue;
      }
      if (g.hurtT > 0) g.hurtT--;
      if (g.stunT > 0) {
        g.stunT--;
        g.anim = g.stunT > 0 ? 'stun' : 'idle';
        g.aimT = 0;
        continue;
      }
      if (frozen) {
        g.anim = 'idle';
        continue;
      }
      if (g.type === 'bot') this.updateBot(g);
      else this.updateSpy(g, sink);
    }
  }

  private updateBot(g: GuardState): void {
    const vx = g.axis === 'h' ? g.dirSign : 0;
    const vy = g.axis === 'v' ? g.dirSign : 0;
    const nx = g.x + vx * BOT_SPEED * this.diff.spySpeedMul;
    const ny = g.y + vy * BOT_SPEED * this.diff.spySpeedMul;
    if (this.guardBlocked(nx, ny)) {
      g.dirSign = (g.dirSign === 1 ? -1 : 1) as 1 | -1;
    } else {
      g.x = nx;
      g.y = ny;
    }
    g.facing = g.axis === 'h' ? (g.dirSign > 0 ? 'right' : 'left') : g.dirSign > 0 ? 'down' : 'up';
    g.anim = 'walk';
    g.animT++;
  }

  /** Direction from guard to player if lined up on a row/column with a clear path, else null. */
  private lineToPlayer(g: GuardState): Dir | null {
    const p = this.player;
    const gcx = g.x + 8;
    const gcy = g.y + 8;
    const pcx = p.x + 8;
    const pcy = p.y + 8;
    const gt = this.tileOf(gcx, gcy);
    if (Math.abs(gcx - pcx) <= 7 && Math.abs(gcy - pcy) > 8) {
      const dir: Dir = pcy > gcy ? 'down' : 'up';
      const pt = Math.floor(pcy / TILE);
      const step = dir === 'down' ? 1 : -1;
      for (let ty = gt.ty + step; ty !== pt; ty += step) if (this.solidTile(gt.tx, ty)) return null;
      return dir;
    }
    if (Math.abs(gcy - pcy) <= 7 && Math.abs(gcx - pcx) > 8) {
      const dir: Dir = pcx > gcx ? 'right' : 'left';
      const pt = Math.floor(pcx / TILE);
      const step = dir === 'right' ? 1 : -1;
      for (let tx = gt.tx + step; tx !== pt; tx += step) if (this.solidTile(tx, gt.ty)) return null;
      return dir;
    }
    return null;
  }

  private tileTaken(g: GuardState, tx: number, ty: number): boolean {
    return this.guards.some((o) => {
      if (o === g || !o.alive) return false;
      const a = this.tileOf(o.x + 8, o.y + 8);
      if (a.tx === tx && a.ty === ty) return true;
      if (o.moveTo) {
        const b = this.tileOf(o.moveTo.x + 8, o.moveTo.y + 8);
        return b.tx === tx && b.ty === ty;
      }
      return false;
    });
  }

  private updateSpy(g: GuardState, sink: EventSink): void {
    g.animT++;
    if (g.cooldown > 0) g.cooldown--;
    if (g.aimT > 0) {
      g.anim = g.aimKind === 'shoe' ? 'throw' : 'aim';
      if (--g.aimT === 0) {
        this.fireGuard(g, sink);
        g.anim = 'idle';
        g.wait = 20;
      }
      return;
    }
    if (g.moveTo) {
      const spd = SPY_SPEED * this.diff.spySpeedMul;
      const dx = g.moveTo.x - g.x;
      const dy = g.moveTo.y - g.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      g.anim = 'walk';
      if (dist <= spd) {
        g.x = g.moveTo.x;
        g.y = g.moveTo.y;
        g.moveTo = null;
        g.wait = this.rng.range(8, 22);
        g.anim = 'idle';
      } else {
        g.x += Math.sign(dx) * Math.min(spd, Math.abs(dx));
        g.y += Math.sign(dy) * Math.min(spd, Math.abs(dy));
      }
      return;
    }
    if (g.wait > 0) {
      g.wait--;
      g.anim = 'idle';
      return;
    }
    // at rest on a tile: shoot if lined up, else move
    const line = this.lineToPlayer(g);
    const canShoot = this.frame >= this.shootAfter && g.cooldown <= 0 && this.player.invuln <= 0 && !this.dying;
    if (line && canShoot) {
      g.aimT = SPY_AIM_FRAMES;
      g.aimDir = line;
      g.aimKind = 'bullet';
      g.facing = line;
      g.anim = 'aim';
      return;
    }
    this.chooseSpyMove(g);
  }

  private chooseSpyMove(g: GuardState): void {
    const p = this.player;
    const pt = this.tileOf(p.x + 8, p.y + 8);
    const gt = this.tileOf(g.x + 8, g.y + 8);
    const opts: { d: Dir; tx: number; ty: number; score: number }[] = [];
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      const tx = gt.tx + DIR_VEC[d].x;
      const ty = gt.ty + DIR_VEC[d].y;
      if (!this.floorTile(tx, ty) || this.kindAt(tx, ty) === 'pedestal' || this.tileTaken(g, tx, ty)) continue;
      const dist = Math.abs(tx - pt.tx) + Math.abs(ty - pt.ty);
      if (dist < 2) continue; // keep a little distance
      let score = dist;
      if (tx === pt.tx || ty === pt.ty) score -= 1.5; // favour lining up
      if (d === OPP[g.facing]) score += 2; // avoid dithering
      opts.push({ d, tx, ty, score });
    }
    if (!opts.length) {
      g.wait = 12;
      g.anim = 'idle';
      return;
    }
    let pick = opts[0];
    if (this.rng.chance(0.7)) {
      for (const o of opts) if (o.score < pick.score) pick = o;
    } else {
      pick = this.rng.pick(opts);
    }
    g.facing = pick.d;
    g.moveTo = { x: pick.tx * TILE, y: pick.ty * TILE };
    g.anim = 'walk';
  }

  private fireGuard(g: GuardState, sink: EventSink): void {
    const cx = g.x + 8;
    const cy = g.y + 8;
    const p = this.player;
    if (g.aimKind === 'shoe') {
      const dx = p.x + 8 - cx;
      const dy = p.y + 8 - cy;
      const len = Math.max(1, Math.hypot(dx, dy));
      this.bullets.push({ x: cx, y: cy, vx: (dx / len) * SHOE_SPEED, vy: (dy / len) * SHOE_SPEED, from: 'shoe', ttl: 300 });
      g.aimKind = 'bullet';
      sink.push({ t: 'sfx', name: 'enemyShot' });
      return;
    }
    const v = DIR_VEC[g.aimDir];
    this.bullets.push({ x: cx + v.x * 8, y: cy + v.y * 8, vx: v.x * ENEMY_BULLET_SPEED, vy: v.y * ENEMY_BULLET_SPEED, from: 'spy', ttl: 300 });
    g.cooldown = this.diff.shotIntervalFrames + this.rng.range(0, 30);
    sink.push({ t: 'sfx', name: 'enemyShot' });
  }

  private hitGuard(g: GuardState, sink: EventSink): void {
    if (!g.alive) return;
    g.hp--;
    g.hurtT = 8;
    this.sparks(g.x + 8, g.y + 8);
    if (g.hp <= 0) this.killGuard(g, sink);
    else sink.push({ t: 'sfx', name: 'ping' });
  }

  private killGuard(g: GuardState, sink: EventSink): void {
    g.hp = 0;
    g.alive = false;
    g.anim = 'dead';
    g.animT = 0;
    g.aimT = 0;
    g.moveTo = null;
    addScore(this.progress, 100, sink);
    sink.push({ t: 'sfx', name: 'death' });
    sink.push({ t: 'popup', x: g.x, y: g.y, text: '100' });
    this.puff(g.x + 8, g.y + 8, 'poof');
  }

  // ------------------------------------------------------------------ bullets

  private updateBullets(sink: EventSink): void {
    const keep: BulletState[] = [];
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      if (--b.ttl <= 0) continue;
      if (b.x < 0 || b.y < 0 || b.x > this.room.pxW || b.y > this.room.pxH) continue;
      const tx = Math.floor(b.x / TILE);
      const ty = Math.floor(b.y / TILE);
      if (this.solidTile(tx, ty)) {
        if (b.from === 'player' && this.kindAt(tx, ty) === 'toyshelf') this.releaseToys(tx, ty, sink);
        this.sparks(b.x, b.y, 2);
        continue;
      }
      if (b.from === 'player') {
        let hit = false;
        for (const g of this.guards) {
          if (!g.alive) continue;
          if (Math.abs(b.x - (g.x + 8)) < 8 && Math.abs(b.y - (g.y + 8)) < 8) {
            this.hitGuard(g, sink);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      } else {
        const p = this.player;
        const r = b.from === 'shoe' ? 5 : 4;
        if (!this.dying && Math.abs(b.x - (p.x + 8)) < 6 + r / 2 && Math.abs(b.y - (p.y + 8)) < 6 + r / 2) {
          if (p.invuln > 0 || isInvincible(this.progress)) {
            // passes harmlessly through an invulnerable agent
          } else {
            this.hurtPlayer(sink);
            continue;
          }
        }
      }
      keep.push(b);
    }
    this.bullets = keep;
  }

  // ------------------------------------------------------------------ toys

  private releaseToys(tx: number, ty: number, sink: EventSink): void {
    const shelf = this.toyShelves.find((s) => s.tx === tx && s.ty === ty);
    if (!shelf || shelf.released) return;
    shelf.released = true;
    let away: Dir = 'down';
    let spot = { tx, ty: ty + 1 };
    for (const d of ['down', 'left', 'right', 'up'] as Dir[]) {
      const nx = tx + DIR_VEC[d].x;
      const ny = ty + DIR_VEC[d].y;
      if (this.kindAt(nx, ny) === 'floor') {
        away = d;
        spot = { tx: nx, ty: ny };
        break;
      }
    }
    const dirs: Dir[] = [away, CW[away], CCW[away]];
    for (let i = 0; i < TOY_COUNT; i++) {
      this.toys.push({ id: this.toyId++, x: spot.tx * TILE, y: spot.ty * TILE, dir: dirs[i], animT: 0, ttl: TOY_LIFE });
    }
    this.puff(tx * TILE + 8, ty * TILE + 8, 'poof');
    sink.push({ t: 'sfx', name: 'chime' });
  }

  private toyBlocked(x: number, y: number): boolean {
    return this.rectHits(x + 3, y + 3, 10, 10, (tx, ty) => !this.floorTile(tx, ty));
  }

  private updateToys(sink: EventSink): void {
    for (const t of this.toys) {
      t.animT++;
      t.ttl--;
      const v = DIR_VEC[t.dir];
      const nx = t.x + v.x * TOY_SPEED;
      const ny = t.y + v.y * TOY_SPEED;
      if (this.toyBlocked(nx, ny)) {
        for (const d of [CW[t.dir], CCW[t.dir], OPP[t.dir]]) {
          const w = DIR_VEC[d];
          if (!this.toyBlocked(t.x + w.x * TOY_SPEED, t.y + w.y * TOY_SPEED)) {
            t.dir = d;
            break;
          }
        }
      } else {
        t.x = nx;
        t.y = ny;
      }
      // stun guards
      for (const g of this.guards) {
        if (!g.alive || g.stunT > 0) continue;
        if (Math.abs(g.x - t.x) < 12 && Math.abs(g.y - t.y) < 12) {
          g.stunT = STUN_TOY;
          g.moveTo = null;
          g.anim = 'stun';
          this.sparks(g.x + 8, g.y + 8, 3);
          sink.push({ t: 'sfx', name: 'ping' });
        }
      }
      // set off traps
      for (const f of this.fixtures) {
        if (f.open || this.contents[f.index].kind !== 'trap') continue;
        const tx0 = f.tx * TILE;
        const ty0 = f.ty * TILE;
        if (t.x + 13 + 2 > tx0 && t.x + 3 - 2 < tx0 + TILE && t.y + 13 + 2 > ty0 && t.y + 3 - 2 < ty0 + TILE) this.setOffTrap(f, sink);
      }
    }
    if (this.toys.some((t) => t.ttl <= 0)) {
      for (const t of this.toys) if (t.ttl <= 0) this.puff(t.x + 8, t.y + 8, 'poof');
      this.toys = this.toys.filter((t) => t.ttl > 0);
    }
  }

  private setOffTrap(f: FixtureState, sink: EventSink): void {
    this.markOpen(f);
    const cx = f.tx * TILE + 8;
    const cy = f.ty * TILE + 8;
    this.puff(cx, cy);
    sink.push({ t: 'sfx', name: 'smoke' });
    for (const g of this.guards) {
      if (g.alive && Math.hypot(g.x + 8 - cx, g.y + 8 - cy) <= 48) {
        g.stunT = Math.max(g.stunT, STUN_SMOKE);
        g.moveTo = null;
        g.aimT = 0;
        g.anim = 'stun';
      }
    }
  }

  // ------------------------------------------------------------------ contact / death

  private contact(sink: EventSink): void {
    if (this.dying) return;
    const p = this.player;
    const frozen = this.frame < this.guardFreezeUntil;
    for (const g of this.guards) {
      if (!g.alive || Math.abs(g.x - p.x) >= 12 || Math.abs(g.y - p.y) >= 12) continue;
      if (isInvincible(this.progress)) {
        this.killGuard(g, sink);
        continue;
      }
      if (g.stunT > 0 || frozen) continue;
      this.hurtPlayer(sink);
      if (this.dying) return;
    }
  }

  private hurtPlayer(sink: EventSink): void {
    const p = this.player;
    if (this.dying || p.invuln > 0 || isInvincible(this.progress)) return;
    if (absorbHit(this.progress)) {
      p.invuln = 45;
      sink.push({ t: 'sfx', name: 'hurt' });
      this.puff(p.x + 8, p.y + 8);
      return;
    }
    this.dying = true;
    this.deathT = 0;
    this.search = null;
    this.progress.lives = Math.max(0, this.progress.lives - 1);
    loseOnDeath(this.progress);
    sink.push({ t: 'sfx', name: 'death' });
    sink.push({ t: 'shake', frames: 12, mag: 2 });
  }

  private tickDeath(_sink: EventSink): void {
    this.deathT++;
    if (this.deathT >= DEATH_FRAMES) {
      if (this.progress.lives <= 0) this.outOfLives = true;
      else this.respawn();
    }
  }

  private respawn(): void {
    const p = this.player;
    this.dying = false;
    p.x = this.spawn.x;
    p.y = this.spawn.y;
    p.facing = 'up';
    p.invuln = RESPAWN_INVULN;
    p.stun = 0;
    p.heldT = 0;
    p.held = null;
    this.search = null;
    this.bullets = [];
    this.moved = false;
    for (const g of this.guards) {
      if (!g.alive) continue;
      g.x = g.startX;
      g.y = g.startY;
      g.moveTo = null;
      g.aimT = 0;
      g.stunT = 0;
      g.wait = this.rng.range(10, 40);
      g.cooldown = 0;
      g.anim = 'idle';
    }
    this.shootAfter = this.frame + GRACE_FRAMES;
  }

  resumeAfterContinue(_sink: EventSink): void {
    this.outOfLives = false;
    this.respawn();
    this.updateCamera();
  }

  // ------------------------------------------------------------------ booth / easter egg

  private tickBooth(sink: EventSink): void {
    if (!this.booth) return;
    const on = this.tileKindAtPx(this.player.x + 8, this.player.y + 8) === 'booth';
    const b = this.booth;
    if (on && !b.active) {
      b.active = true;
      b.nowPlaying = MISC.nowPlaying;
      sink.push({ t: 'music', name: 'booth' });
      this.say(sink, [MISC.nowPlaying], 'info', 120);
    } else if (!on && b.active) {
      b.active = false;
      b.nowPlaying = null;
      sink.push({ t: 'music', name: this.currentMusic() });
    }
  }

  private tickEggTalk(sink: EventSink): void {
    const e = this.egg!;
    e.t++;
    const ty = this.eggTyping;
    const lines = GAMESTONK_EGG.clerk;
    if (ty.wait > 0) {
      ty.wait--;
      if (ty.wait === 0 && ty.line >= lines.length) {
        e.phase = 'item';
        e.itemVisible = true;
        sink.push({ t: 'sfx', name: 'chime' });
        this.shootAfter = Math.max(this.shootAfter, this.frame + 60);
      }
      return;
    }
    const cur = lines[ty.line];
    if (ty.ch < cur.length) {
      if (e.t % 2 === 0) {
        ty.ch++;
        e.lines[ty.line] = cur.slice(0, ty.ch);
        if (cur[ty.ch - 1] !== ' ') sink.push({ t: 'sfx', name: 'blip' });
      }
    } else {
      ty.line++;
      ty.ch = 0;
      if (ty.line < lines.length) {
        e.lines.push('');
        ty.wait = 24;
      } else {
        ty.wait = 45;
      }
    }
  }

  private tickEggPickup(sink: EventSink): void {
    const e = this.egg;
    if (!e || e.phase !== 'item' || !this.canAct()) return;
    const t = this.tileOf(this.player.x + 8, this.player.y + 8);
    if (t.tx !== e.pedestal.tx || t.ty !== e.pedestal.ty) return;
    e.phase = 'get';
    e.itemVisible = false;
    const item = e.item ?? GAMESTONK_EGG.items[0];
    sink.push({ t: 'music', name: 'jingle:itemget' });
    this.say(sink, [`${GAMESTONK_EGG.got} ${item}`], 'item', 150);
    addScore(this.progress, 1, sink);
    this.progress.inventory.push(item);
    this.startHold({ kind: 'item', name: item }, 120);
  }

  // ------------------------------------------------------------------ debug / tests

  snapshot(): unknown {
    const p = this.progress;
    return {
      frame: this.frame, player: this.player, guards: this.guards, bullets: this.bullets, fixtures: this.fixtures, toys: this.toys,
      toyShelves: this.toyShelves, puffs: this.puffs, particles: this.particles, bubbles: this.bubbles, banner: this.banner,
      search: this.search, egg: this.egg, booth: this.booth, exited: this.exited, outOfLives: this.outOfLives, cleared: this.cleared,
      dying: this.dying, rng: this.rng.state,
      progress: { score: p.score, lives: p.lives, packages: p.packages, opened: p.opened, visited: p.visited, inventory: p.inventory, power: p.power, egg: p.gamestonkEggDone },
    };
  }

  /** Deterministic hash of the whole world + progress (for replay tests). */
  stateHash(): number {
    return hashString(JSON.stringify(this.snapshot()));
  }

  /** Content of a fixture (tests / debug only; renderers must use fixtures[].content / mark). */
  debugContent(index: number): FixtureContent {
    return this.contents[index];
  }
}

export function createStore(opts: StoreOptions): StoreWorld {
  return new StoreWorld(opts);
}

export type StoreBulletKind = BulletKind;
