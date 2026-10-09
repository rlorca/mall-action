import { Rng, hashSeed } from './rng';
import { PadFrame } from './pad';
import { RunState, award, collectPower } from './run';
import { FixtureState, StoreSetup } from './levelsetup';
import { Room, ROOM_H, ROOM_W, TILE, isSolidChar, roomFor } from './stores-data';
import { FIRST_VISIT_LINES, JOKE_ITEMS, MISC, StoreId, storeInfo } from './copy';
import { POINTS } from './scoring';
import { PACKAGE_COUNT } from './level';
import { fireProfile, sneakerBoost, speedMul } from './powerups';

export type Face = 'up' | 'down' | 'left' | 'right';
const DIRV: Record<Face, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const SEARCH_FRAMES = 45; // 0.75 s
export const TRAP_STUN = 60; // 1 s
export const GRACE_FRAMES = 90;
export const SPY_SPEED = 0.6;
export const BOT_SPEED = 0.7;
export const PLAYER_SPEED = 1;
export const BULLET_SPEED = 3;
export const GUARD_BULLET_SPEED = 1.6;
export const FITTING_CHANCE = 0.25;
export const TOY_COUNT = 3;

export interface SGuard {
  id: number;
  kind: 'spy' | 'bot';
  x: number;
  y: number;
  dir: Face;
  hp: number;
  state: 'think' | 'move' | 'aim' | 'stun' | 'dying';
  t: number;
  cd: number;
  tx: number;
  ty: number;
  frozen: number; // first-visit hold
  flash: number;
  anim: number;
  shoe: boolean;
}
export interface SBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'guard' | 'shoe';
  life: number;
}
export interface Toy {
  id: number;
  x: number;
  y: number;
  dir: Face;
  life: number;
  anim: number;
}
export interface Smoke {
  x: number;
  y: number;
  t: number;
}
export interface SBubble {
  owner: number | 'clerk' | 'player';
  text: string;
  life: number;
  x: number;
  y: number;
}
export interface HoldItem {
  kind: 'package' | 'powerup' | 'joke';
  label: string;
  power?: string;
}

export type SPlayerState = 'walk' | 'search' | 'stun' | 'hold' | 'dead';

export interface SPlayer {
  x: number;
  y: number;
  dir: Face;
  anim: number;
  state: SPlayerState;
  timer: number;
  hold: HoldItem | null;
  shootCd: number;
  moving: boolean;
}

export interface Egg {
  phase: 'type' | 'wait' | 'item' | 'taken' | 'done';
  t: number;
  shown: number;
  item: string;
}

export class StoreRoom {
  run: RunState;
  id: StoreId;
  room: Room;
  setup: StoreSetup;
  rng: Rng;
  frame = 0;
  p: SPlayer;
  guards: SGuard[] = [];
  bullets: SBullet[] = [];
  toys: Toy[] = [];
  smoke: Smoke[] = [];
  bubbles: SBubble[] = [];
  search: { idx: number; t: number; dir: Face } | null = null;
  banner: { text: string; life: number } | null = null;
  touched = -1;
  grace = GRACE_FRAMES;
  onBooth = false;
  egg: Egg | null = null;
  clerkGone = false;
  introT = 0;
  introLines: { who: number | 'bot'; text: string }[] = [];
  nextId = 1;
  exiting = false;
  cam = { x: 0, y: 0 };
  /** Radar flash timer. */
  flashT = 0;
  deathSent = false;
  /** Frames until the fitting-room spy throws his shoe (0 = none pending). */
  shoeIn = 0;
  shoeFrom = 0;

  constructor(run: RunState, id: StoreId) {
    this.run = run;
    this.id = id;
    this.room = roomFor(id);
    this.setup = run.setup[id];
    this.rng = new Rng(hashSeed('room', run.seed, run.loop, id, this.setup.visited ? 'again' : 'first', run.levelFrames));
    this.p = {
      x: this.room.spawn.x,
      y: this.room.spawn.y,
      dir: 'up',
      anim: 0,
      state: 'walk',
      timer: 0,
      hold: null,
      shootCd: 0,
      moving: false,
    };
    this.spawnGuards();
    // first visit: guards hold still and say their lines
    if (!this.setup.visited) {
      this.setup.visited = true;
      const lines = FIRST_VISIT_LINES[id];
      if (lines) {
        this.introLines = lines;
        this.introT = 0;
        for (const g of this.guards) g.frozen = lines.length * 60 + 40;
      }
    }
    if (id === 'gamestonk' && !run.gamestonkSeen) {
      run.gamestonkSeen = true;
      this.egg = { phase: 'type', t: 0, shown: 0, item: this.rng.pick(JOKE_ITEMS) };
      for (const g of this.guards) g.frozen = 9999;
    }
    this.updateCamera();
  }

  // ------------------------------------------------------------ setup
  private spawnGuards(): void {
    const mk = (kind: 'spy' | 'bot', col: number, row: number, dir: Face): SGuard => ({
      id: this.nextId++,
      kind,
      x: col * TILE,
      y: row * TILE,
      dir,
      hp: kind === 'bot' ? 3 : 1,
      state: 'think',
      t: 0,
      cd: 60 + this.rng.int(0, 60),
      tx: col * TILE,
      ty: row * TILE,
      frozen: 0,
      flash: 0,
      anim: 0,
      shoe: false,
    });
    for (const s of this.room.spies) this.guards.push(mk('spy', s.col, s.row, 'down'));
    for (const b of this.room.bots) this.guards.push(mk('bot', b.col, b.row, b.axis === 'h' ? 'right' : 'down'));
  }

  // ------------------------------------------------------------ tiles & geometry
  tileAt(col: number, row: number): string {
    if (row < 0 || col < 0 || row >= this.room.h || col >= this.room.w) return '#';
    return this.room.tiles[row][col];
  }
  /** Fixture tiles that have been "used up" stay solid. */
  solidAt(col: number, row: number): boolean {
    return isSolidChar(this.tileAt(col, row));
  }
  /** Rect overlaps solid tiles? */
  blocked(x: number, y: number, w: number, h: number): boolean {
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + h - 0.001) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solidAt(c, r)) return true;
    return false;
  }
  hitbox(): { x: number; y: number; w: number; h: number } {
    return { x: this.p.x + 3, y: this.p.y + 7, w: 10, h: 9 };
  }
  private tryMovePlayer(dx: number, dy: number): void {
    const p = this.p;
    const hb = (ox: number, oy: number) => ({ x: p.x + ox + 3, y: p.y + oy + 7 });
    const nx = p.x + dx;
    const ny = p.y + dy;
    let b = hb(dx, dy);
    if (!this.blocked(b.x, b.y, 10, 9)) {
      p.x = nx;
      p.y = ny;
      return;
    }
    // Zelda-style corner assist: slide around a corner of up to 5 px
    if (dx !== 0) {
      for (let n = 1; n <= 5; n++) {
        for (const s of [-1, 1]) {
          b = hb(dx, s * n);
          if (!this.blocked(b.x, b.y, 10, 9)) {
            p.y += s * Math.min(1, n);
            p.x = nx;
            return;
          }
        }
      }
    } else if (dy !== 0) {
      for (let n = 1; n <= 5; n++) {
        for (const s of [-1, 1]) {
          b = hb(s * n, dy);
          if (!this.blocked(b.x, b.y, 10, 9)) {
            p.x += s * Math.min(1, n);
            p.y = ny;
            return;
          }
        }
      }
    }
  }

  fixtureRect(f: FixtureState) {
    return { x: f.col * TILE, y: f.row * TILE, w: TILE, h: TILE };
  }

  /** Index of the searchable (unopened) fixture the agent is touching - in front or to either side. */
  touchedFixture(): number {
    const hb = this.hitbox();
    const exp = { x: hb.x - 2, y: hb.y - 2, w: hb.w + 4, h: hb.h + 4 };
    let best = -1;
    let bestD = 1e9;
    const pcx = hb.x + hb.w / 2;
    const pcy = hb.y + hb.h / 2;
    this.setup.fixtures.forEach((f, i) => {
      if (f.opened) return;
      const r = this.fixtureRect(f);
      if (r.x < exp.x + exp.w && r.x + r.w > exp.x && r.y < exp.y + exp.h && r.y + r.h > exp.y) {
        const d = Math.hypot(r.x + 8 - pcx, r.y + 8 - pcy);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  }

  private faceToward(cx: number, cy: number): Face {
    const hb = this.hitbox();
    const dx = cx - (hb.x + hb.w / 2);
    const dy = cy - (hb.y + hb.h / 2);
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
    return dx < 0 ? 'left' : 'right';
  }

  // ------------------------------------------------------------ main step
  step(pad: PadFrame): void {
    this.frame++;
    if (this.banner && --this.banner.life <= 0) this.banner = null;
    for (const b of this.bubbles) b.life--;
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    for (const s of this.smoke) s.t--;
    this.smoke = this.smoke.filter((s) => s.t > 0);
    if (this.grace > 0) this.grace--;
    this.updateIntro();
    if (this.shoeIn > 0 && --this.shoeIn === 0) this.throwShoe();

    const typing = this.egg && (this.egg.phase === 'type' || this.egg.phase === 'wait');
    if (this.egg) this.stepEgg();

    this.stepPlayer(typing ? emptyInput() : pad);
    if (this.p.state !== 'hold') {
      this.stepGuards();
      this.stepToys();
    }
    this.stepBullets();
    this.updateCamera();
    this.touched = this.p.state === 'walk' ? this.touchedFixture() : -1;
  }

  private updateIntro(): void {
    if (!this.introLines.length) return;
    const i = Math.floor(this.introT / 60);
    if (this.introT % 60 === 0 && i < this.introLines.length) {
      const l = this.introLines[i];
      const spies = this.guards.filter((g) => g.kind === 'spy');
      const bot = this.guards.find((g) => g.kind === 'bot');
      const g = l.who === 'bot' ? (bot ?? spies[0]) : (spies[l.who as number] ?? spies[0] ?? bot);
      if (g) {
        this.bubbles = this.bubbles.filter((b) => b.owner !== g.id);
        this.bubbles.push({ owner: g.id, text: l.text, life: 100, x: g.x + 8, y: g.y });
        this.run.events.emit('text');
      }
    }
    this.introT++;
    if (this.introT > this.introLines.length * 60 + 40) this.introLines = [];
  }

  // ------------------------------------------------------------ egg (GameStonk)
  private stepEgg(): void {
    const e = this.egg!;
    e.t++;
    if (e.phase === 'type') {
      if (e.t % 2 === 0) {
        e.shown = Math.min(MISC.gamestonkClerk.length, e.shown + 1);
        if (e.shown <= MISC.gamestonkClerk.length && MISC.gamestonkClerk[e.shown - 1] !== ' ') this.run.events.emit('blip');
      }
      if (e.shown >= MISC.gamestonkClerk.length) {
        e.phase = 'wait';
        e.t = 0;
      }
    } else if (e.phase === 'wait') {
      if (e.t > 70) {
        e.phase = 'item';
        e.t = 0;
        for (const g of this.guards) g.frozen = 0;
        this.run.events.emit('eggItem');
      }
    } else if (e.phase === 'item' && this.room.pedestal) {
      const hb = this.hitbox();
      const ped = this.room.pedestal;
      const cx = hb.x + hb.w / 2;
      const cy = hb.y + hb.h / 2;
      if (cx >= ped.col * TILE && cx < (ped.col + 1) * TILE && cy >= ped.row * TILE && cy < (ped.row + 1) * TILE) {
        e.phase = 'taken';
        e.t = 0;
        this.run.inventory.push(e.item);
        award(this.run, POINTS.jokeItem, { x: this.p.x + 8, y: this.p.y - 8, space: 'screen' });
        this.beginHold({ kind: 'joke', label: `YOU GOT: ${e.item}` });
        this.run.events.emit('itemGet');
        this.smoke.push({ x: this.room.clerk!.col * TILE + 8, y: this.room.clerk!.row * TILE + 8, t: 30 });
        this.clerkGone = true;
      }
    } else if (e.phase === 'taken') {
      if (e.t > 5) e.phase = 'done';
    }
  }

  // ------------------------------------------------------------ player
  private stepPlayer(pad: PadFrame): void {
    const p = this.p;
    if (p.shootCd > 0) p.shootCd--;
    p.moving = false;

    switch (p.state) {
      case 'dead':
        p.timer++;
        if (p.timer === 70 && !this.deathSent) {
          this.deathSent = true;
          this.run.events.emit('deathDone');
        }
        return;
      case 'stun':
        if (--p.timer <= 0) p.state = 'walk';
        return;
      case 'hold':
        if (--p.timer <= 0) {
          p.state = 'walk';
          p.hold = null;
        }
        return;
      case 'search':
        this.stepSearch(pad);
        return;
    }

    const h = pad.held;
    const sp = PLAYER_SPEED * speedMul(this.run.powers) * 1.0;
    let dx = 0;
    let dy = 0;
    // vertical input takes priority
    if (h.up && !h.down) dy = -sp;
    else if (h.down && !h.up) dy = sp;
    else if (h.left && !h.right) dx = -sp;
    else if (h.right && !h.left) dx = sp;
    if (dx !== 0 || dy !== 0) {
      p.dir = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';
      this.tryMovePlayer(dx, dy);
      p.anim++;
      p.moving = true;
    }

    // searching: a single tap of B starts an auto-running search of the touched fixture
    if (pad.pressed.b) {
      const idx = this.touchedFixture();
      if (idx >= 0) {
        const f = this.setup.fixtures[idx];
        p.dir = this.faceToward(f.col * TILE + 8, f.row * TILE + 8);
        this.search = { idx, t: 0, dir: p.dir };
        p.state = 'search';
        p.timer = 0;
        this.run.events.emit('searchStart');
        return;
      }
    }

    // shooting
    if (pad.pressed.a || (h.a && p.shootCd <= 0)) this.playerShoot();

    // booth pad (Sam Baddy): switches the music while standing on it
    this.onBooth = false;
    const hb = this.hitbox();
    const c = Math.floor((hb.x + hb.w / 2) / TILE);
    const r = Math.floor((hb.y + hb.h / 2) / TILE);
    if (this.tileAt(c, r) === 'b') this.onBooth = true;

    // leaving through the door
    if (!this.exiting && r >= this.room.h - 1 && this.room.doorCols.includes(c)) {
      this.exiting = true;
      this.run.events.emit('exitStore', { id: this.id });
    }
  }

  private playerShoot(): void {
    const p = this.p;
    const prof = fireProfile(this.run.powers);
    const mine = this.bullets.filter((b) => b.owner === 'player').length;
    if (mine >= prof.maxBullets * (prof.spread ? 3 : 1) || p.shootCd > 0) return;
    const [dx, dy] = DIRV[p.dir];
    const cx = p.x + 8 + dx * 8;
    const cy = p.y + 10 + dy * 8;
    const dirs: [number, number][] = [[dx, dy]];
    if (prof.spread) {
      const a = 0.35;
      const rot = (s: number): [number, number] => [dx * Math.cos(s) - dy * Math.sin(s), dx * Math.sin(s) + dy * Math.cos(s)];
      dirs.push(rot(a), rot(-a));
    }
    for (const [vx, vy] of dirs) this.bullets.push({ x: cx, y: cy, vx: vx * BULLET_SPEED, vy: vy * BULLET_SPEED, owner: 'player', life: 90 });
    p.shootCd = prof.cooldown;
    this.run.events.emit('shot', { spread: prof.spread });
  }

  private stepSearch(pad: PadFrame): void {
    const p = this.p;
    const s = this.search!;
    // Only a fresh press of a different direction, or shooting, cancels.
    const pr = pad.pressed;
    const dirs: [boolean, Face][] = [
      [pr.up, 'up'],
      [pr.down, 'down'],
      [pr.left, 'left'],
      [pr.right, 'right'],
    ];
    if (pr.a || dirs.some(([pressed, d]) => pressed && d !== s.dir)) {
      this.search = null;
      p.state = 'walk';
      this.run.events.emit('searchCancel');
      if (pr.a) this.playerShoot();
      return;
    }
    s.t += sneakerBoost(this.run.powers) ? 1.5 : 1;
    if (Math.floor(s.t) % 8 === 0) this.run.events.emit('searchTick');
    if (s.t >= SEARCH_FRAMES) {
      this.search = null;
      p.state = 'walk';
      this.completeSearch(s.idx);
    }
  }

  private completeSearch(idx: number): void {
    const f = this.setup.fixtures[idx];
    const ev = this.run.events;
    // Forever 12 fitting rooms: 25% chance of a spy mid-change. The real contents stay unsearched.
    if (f.kind === 'F' && !f.revealed && this.rng.chance(FITTING_CHANCE)) {
      f.revealed = true;
      this.revealFittingSpy(f);
      return;
    }
    f.opened = true;
    switch (f.loot.type) {
      case 'package': {
        if (!this.run.packages.includes(this.id)) this.run.packages.push(this.id);
        this.setup.cleared = true;
        award(this.run, POINTS.package, { x: this.p.x + 8, y: this.p.y - 12, space: 'screen' });
        const n = this.run.packages.length;
        this.beginHold({ kind: 'package', label: `PACKAGE ${n}/${PACKAGE_COUNT}` });
        ev.emit('package', { n });
        break;
      }
      case 'powerup': {
        const name = collectPower(this.run, f.loot.power, { x: this.p.x + 8, y: this.p.y - 12, space: 'screen' });
        this.beginHold({ kind: 'powerup', label: name, power: f.loot.power });
        ev.emit('powerup', { kind: f.loot.power });
        break;
      }
      case 'trap':
        this.puff(f);
        this.p.state = 'stun';
        this.p.timer = TRAP_STUN;
        this.setBanner(MISC.trap, 90);
        ev.emit('trap');
        break;
      default:
        this.puff(f);
        this.setBanner(MISC.nothing, 70);
        ev.emit('nothing');
    }
  }

  private beginHold(item: HoldItem): void {
    this.p.state = 'hold';
    this.p.timer = 95;
    this.p.hold = item;
    this.setBanner(item.label, 95);
  }

  setBanner(text: string, life: number): void {
    this.banner = { text, life };
  }

  private puff(f: FixtureState): void {
    this.smoke.push({ x: f.col * TILE + 8, y: f.row * TILE + 8, t: 24 });
    this.run.events.emit('smoke');
  }

  private revealFittingSpy(f: FixtureState): void {
    const spots: [number, number][] = [
      [f.col, f.row + 1],
      [f.col - 1, f.row],
      [f.col + 1, f.row],
      [f.col, f.row - 1],
      [f.col - 1, f.row + 1],
      [f.col + 1, f.row + 1],
    ];
    // never pop out ON TOP of the agent: prefer a tile that is not under him
    const hb = this.hitbox();
    const pcx = hb.x + hb.w / 2;
    const pcy = hb.y + hb.h / 2;
    const open = spots.filter(([c, r]) => !this.solidAt(c, r) && this.tileAt(c, r) !== 'D');
    const dist = ([c, r]: [number, number]) => Math.hypot(c * TILE + 8 - pcx, r * TILE + 8 - pcy);
    const free = open.slice().sort((a, b) => dist(b) - dist(a))[0];
    if (!free) return;
    const g: SGuard = {
      id: this.nextId++,
      kind: 'spy',
      x: free[0] * TILE,
      y: free[1] * TILE,
      dir: 'down',
      hp: 1,
      state: 'think',
      t: 0,
      cd: 90,
      tx: free[0] * TILE,
      ty: free[1] * TILE,
      frozen: 0,
      flash: 0,
      anim: 0,
      shoe: true,
    };
    this.guards.push(g);
    this.smoke.push({ x: f.col * TILE + 8, y: f.row * TILE + 8, t: 20 });
    this.bubbles.push({ owner: g.id, text: MISC.fittingShriek, life: 100, x: g.x + 8, y: g.y });
    this.run.events.emit('shriek');
    // he shrieks, then (after a wind-up the agent can react to) throws a shoe, then fights
    g.frozen = 30;
    this.shoeIn = 28;
    this.shoeFrom = g.id;
    g.cd = 120;
  }

  // ------------------------------------------------------------ guards
  private stepGuards(): void {
    const hb = this.hitbox();
    const pcx = hb.x + hb.w / 2;
    const pcy = hb.y + hb.h / 2;
    for (const g of this.guards) {
      g.anim++;
      if (g.flash > 0) g.flash--;
      if (g.state === 'dying') {
        g.t--;
        continue;
      }
      if (g.state === 'stun') {
        if (--g.t <= 0) g.state = 'think';
        continue;
      }
      if (g.frozen > 0) {
        g.frozen--;
        continue;
      }
      if (g.cd > 0) g.cd--;
      if (g.kind === 'bot') this.stepBot(g, hb);
      else this.stepSpyGuard(g, pcx, pcy);
    }
    this.guards = this.guards.filter((g) => !(g.state === 'dying' && g.t <= 0));
  }

  private stepBot(g: SGuard, hb: { x: number; y: number; w: number; h: number }): void {
    const [dx, dy] = DIRV[g.dir];
    const nx = g.x + dx * BOT_SPEED;
    const ny = g.y + dy * BOT_SPEED;
    if (this.blocked(nx + 1, ny + 1, 14, 14)) {
      g.dir = g.dir === 'left' ? 'right' : g.dir === 'right' ? 'left' : g.dir === 'up' ? 'down' : 'up';
    } else {
      g.x = nx;
      g.y = ny;
    }
    // touching kills
    if (this.p.state !== 'dead' && overlaps({ x: g.x + 2, y: g.y + 2, w: 12, h: 12 }, hb)) this.hurtPlayer('bot');
  }

  private stepSpyGuard(g: SGuard, pcx: number, pcy: number): void {
    if (g.state === 'aim') {
      if (--g.t <= 0) {
        this.guardShoot(g);
        g.state = 'think';
      }
      return;
    }
    if (g.state === 'think') {
      // line up and shoot?
      if (g.cd <= 0 && this.grace <= 0 && this.p.state !== 'dead') {
        const dir = this.lineTo(g, pcx, pcy);
        if (dir) {
          g.dir = dir;
          g.state = 'aim';
          g.t = 22;
          this.run.events.emit('spyAim');
          return;
        }
      }
      // choose the next tile, favouring the player
      const col = Math.round(g.x / TILE);
      const row = Math.round(g.y / TILE);
      const opts: Face[] = [];
      for (const d of ['up', 'down', 'left', 'right'] as Face[]) {
        const [dx, dy] = DIRV[d];
        const c = col + dx;
        const r = row + dy;
        if (this.solidAt(c, r) || this.tileAt(c, r) === 'D' || this.tileAt(c, r) === 'e') continue;
        if (this.guards.some((o) => o !== g && Math.round(o.x / TILE) === c && Math.round(o.y / TILE) === r)) continue;
        opts.push(d);
      }
      if (!opts.length) return;
      let pick: Face;
      if (this.rng.chance(0.7)) {
        const want = (d: Face) => {
          const [dx, dy] = DIRV[d];
          return Math.abs(pcx - ((col + dx) * TILE + 8)) + Math.abs(pcy - ((row + dy) * TILE + 8));
        };
        pick = opts.slice().sort((a, b) => want(a) - want(b))[0];
      } else pick = this.rng.pick(opts);
      g.dir = pick;
      const [dx, dy] = DIRV[pick];
      g.tx = (col + dx) * TILE;
      g.ty = (row + dy) * TILE;
      g.state = 'move';
      return;
    }
    if (g.state === 'move') {
      const dx = Math.sign(g.tx - g.x);
      const dy = Math.sign(g.ty - g.y);
      g.x += dx * Math.min(SPY_SPEED, Math.abs(g.tx - g.x));
      g.y += dy * Math.min(SPY_SPEED, Math.abs(g.ty - g.y));
      if (g.x === g.tx && g.y === g.ty) g.state = 'think';
    }
  }

  /** If the guard is lined up with the player along a clear straight line, the direction to shoot. */
  lineTo(g: SGuard, pcx: number, pcy: number): Face | null {
    const gx = g.x + 8;
    const gy = g.y + 8;
    let d: Face | null = null;
    if (Math.abs(pcx - gx) <= 7) d = pcy < gy ? 'up' : 'down';
    else if (Math.abs(pcy - gy) <= 7) d = pcx < gx ? 'left' : 'right';
    if (!d) return null;
    // clear path: no solid tile between
    const dist = Math.max(Math.abs(pcx - gx), Math.abs(pcy - gy));
    const [dx, dy] = DIRV[d];
    for (let s = 8; s < dist; s += 4) {
      if (this.solidAt(Math.floor((gx + dx * s) / TILE), Math.floor((gy + dy * s) / TILE))) return null;
    }
    return d;
  }

  private guardShoot(g: SGuard): void {
    const [dx, dy] = DIRV[g.dir];
    this.bullets.push({ x: g.x + 8 + dx * 8, y: g.y + 8 + dy * 8, vx: dx * GUARD_BULLET_SPEED, vy: dy * GUARD_BULLET_SPEED, owner: 'guard', life: 200 });
    g.cd = 100 + this.rng.int(0, 50);
    this.run.events.emit('enemyShot');
  }

  private throwShoe(): void {
    const g = this.guards.find((x) => x.id === this.shoeFrom);
    if (!g || g.state === 'dying') return;
    const hb = this.hitbox();
    const gx = g.x + 8;
    const gy = g.y + 8;
    const ang = Math.atan2(hb.y + hb.h / 2 - gy, hb.x + hb.w / 2 - gx);
    this.bullets.push({ x: gx, y: gy, vx: Math.cos(ang) * 1.4, vy: Math.sin(ang) * 1.4, owner: 'shoe', life: 140 });
    this.run.events.emit('enemyShot');
  }

  private hurtPlayer(cause: string): void {
    const p = this.p;
    if (p.state === 'dead') return;
    const pw = this.run.powers;
    if (pw.invincible) return;
    if (pw.armor) {
      pw.armor = false;
      this.run.events.emit('armorBreak');
      this.setBanner('ARMOR BROKE!', 40);
      return;
    }
    p.state = 'dead';
    p.timer = 0;
    this.search = null;
    this.bullets = this.bullets.filter((b) => b.owner === 'player');
    this.run.events.emit('playerDied', { cause, where: 'store' });
  }

  // ------------------------------------------------------------ bullets & toys
  private stepBullets(): void {
    const keep: SBullet[] = [];
    const hb = this.hitbox();
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0) continue;
      const col = Math.floor(b.x / TILE);
      const row = Math.floor(b.y / TILE);
      if (this.solidAt(col, row)) {
        if (b.owner === 'player' && this.tileAt(col, row) === 'T') this.releaseToys(col, row);
        continue;
      }
      if (b.owner === 'player') {
        let hit = false;
        for (const g of this.guards) {
          if (g.state === 'dying') continue;
          if (b.x >= g.x + 1 && b.x <= g.x + 15 && b.y >= g.y + 1 && b.y <= g.y + 15) {
            this.hitGuard(g);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      } else if (this.p.state !== 'dead' && b.x >= hb.x && b.x <= hb.x + hb.w && b.y >= hb.y && b.y <= hb.y + hb.h) {
        this.hurtPlayer(b.owner);
        continue;
      }
      keep.push(b);
    }
    this.bullets = keep;
  }

  private hitGuard(g: SGuard): void {
    g.hp--;
    g.flash = 6;
    if (g.hp <= 0) {
      g.state = 'dying';
      g.t = 20;
      award(this.run, POINTS.spyShot, { x: g.x + 8, y: g.y, space: 'screen' });
      this.run.events.emit('spyDie', { how: 'shot' });
    } else this.run.events.emit('ping');
  }

  private releaseToys(col: number, row: number): void {
    const f = this.setup.fixtures.find((x) => x.col === col && x.row === row);
    if (!f || f.released) return;
    f.released = true;
    const dirs: Face[] = ['down', 'left', 'right', 'up'];
    let made = 0;
    for (const [dc, dr] of [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [-1, 1],
      [1, 1],
    ]) {
      if (made >= TOY_COUNT) break;
      const c = col + dc;
      const r = row + dr;
      if (this.solidAt(c, r) || this.tileAt(c, r) === 'D') continue;
      this.toys.push({ id: this.nextId++, x: c * TILE, y: r * TILE, dir: this.rng.pick(dirs), life: 600, anim: 0 });
      made++;
    }
    this.run.events.emit('toys');
  }

  private stepToys(): void {
    for (const t of this.toys) {
      t.anim++;
      t.life--;
      const [dx, dy] = DIRV[t.dir];
      const nx = t.x + dx * 0.5;
      const ny = t.y + dy * 0.5;
      if (this.blocked(nx + 2, ny + 2, 12, 12)) {
        // turn at walls (clockwise, then random)
        const order: Face[] = ['up', 'right', 'down', 'left'];
        t.dir = order[(order.indexOf(t.dir) + 1 + (this.rng.chance(0.3) ? 1 : 0)) % 4];
      } else {
        t.x = nx;
        t.y = ny;
      }
      // they stun the guards they touch
      for (const g of this.guards) {
        if (g.state === 'dying') continue;
        if (overlaps({ x: t.x + 2, y: t.y + 2, w: 12, h: 12 }, { x: g.x + 2, y: g.y + 2, w: 12, h: 12 })) {
          if (g.state !== 'stun') {
            g.state = 'stun';
            g.t = 120;
            this.run.events.emit('toyStun');
          }
        }
      }
      // ...and set off traps
      this.setup.fixtures.forEach((f) => {
        if (f.opened || f.loot.type !== 'trap') return;
        if (overlaps({ x: t.x + 1, y: t.y + 1, w: 14, h: 14 }, { x: f.col * TILE - 2, y: f.row * TILE - 2, w: TILE + 4, h: TILE + 4 })) {
          f.opened = true;
          this.puff(f);
          for (const g of this.guards) {
            if (Math.hypot(g.x - f.col * TILE, g.y - f.row * TILE) < 56 && g.state !== 'dying') {
              g.state = 'stun';
              g.t = 150;
            }
          }
          this.run.events.emit('trapSprung');
        }
      });
    }
    this.toys = this.toys.filter((t) => t.life > 0);
  }

  // ------------------------------------------------------------ camera for rooms larger than the viewport
  updateCamera(): void {
    const vw = ROOM_W * TILE;
    const vh = ROOM_H * TILE;
    const rw = this.room.w * TILE;
    const rh = this.room.h * TILE;
    this.cam.x = rw <= vw ? 0 : Math.max(0, Math.min(rw - vw, Math.round(this.p.x + 8 - vw / 2)));
    this.cam.y = rh <= vh ? 0 : Math.max(0, Math.min(rh - vh, Math.round(this.p.y + 8 - vh / 2)));
  }

  /** The flashing "!" shows on package fixtures when the Radar is active. */
  radarOn(): boolean {
    return this.run.powers.radar;
  }

  get info() {
    return storeInfo(this.id);
  }
  /** "PRESS X TO SEARCH" shows while a search is possible. */
  canSearch(): boolean {
    return this.p.state === 'walk' && this.touched >= 0;
  }
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function emptyInput(): PadFrame {
  const f = { up: false, down: false, left: false, right: false, a: false, b: false, select: false, start: false };
  return { held: { ...f }, pressed: { ...f } };
}
