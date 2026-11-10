/** Top-down store rooms: searching, guards, and the per-store extras. Pure; frame units. */
import { Btn, DIRS, type PadFrame } from '../core/input';
import type { Facing, Fixture, Game, Guard, Level, Room } from './types';
import { STORES } from './level';
import { ROOMS, TILE, solidAt, solidTile, tileAt, type RoomTpl } from './rooms';
import { JOKE_ITEMS, LAST_WORDS, POWER_NAMES, STORE_LINES, TEXT, type PowerKind } from './copy';
import { addScore, difficulty, grantPower, maxShots, searchFrames, shotCooldown, walkSpeed } from './powers';
import { banner, finishDeath, say } from './mall';

export const GRACE = 90; // guards hold fire this long after you walk in
export const GUARD_TELEGRAPH = 30; // a visible half-second warning
export const GUARD_BULLET_V = 1.25;
export const GUARD_KEEP_AWAY = 3; // tiles: guard spies do not crowd the agent
export const GUARD_SPEED = 0.5;
export const BOT_SPEED = 0.75;
export const STUN_TRAP = 60;
export const FITTING_CHANCE = 0.25;
export const INTRO_FRAMES = 150;
export const EGG_TEXT = TEXT.egg1 + ' ' + TEXT.egg2;
export const EGG_TALK_FRAMES = EGG_TEXT.length * 3 + 50;
export const PEDESTAL = { x: 120, y: 48 };
export const CLERK = { x: 120, y: 16 };

const VEC: Record<Facing, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

/** Player body box inside the 16x16 sprite cell (feet-biased, Zelda style). */
export const HB = { x0: 3, y0: 6, x1: 13, y1: 15 };

function newGuard(kind: 'spy' | 'bot', tx: number, ty: number, axis: 'h' | 'v', shootT: number): Guard {
  return {
    kind, x: tx * TILE, y: ty * TILE, face: 'd', tx, ty, moving: false, axis, pdir: 1, hp: kind === 'bot' ? 3 : 1,
    stun: 0, shootT, aimT: 0, dead: 0, alive: true, hitT: 0, walkT: 0,
  };
}

export function createRoom(g: Game, L: Level, storeId: number): Room {
  const def = STORES[storeId];
  const tpl = ROOMS[def.key];
  const R: Room = {
    store: storeId, tpl, x: tpl.startX, y: tpl.startY, face: 'u', walkT: 0,
    guards: tpl.guards.map((q) => newGuard(q.kind, q.tx, q.ty, q.axis, 60 + g.rng.int(60))),
    bullets: [], toys: [], search: null, prompt: -1, hold: null, stun: 0, grace: GRACE,
    intro: null, egg: null, sideB: false, dying: 0, invuln: 0, shootCd: 0, t: 0,
  };
  // the first visit to each store per game: guards hold still and say their lines
  if (!g.visited.includes(def.key)) {
    g.visited.push(def.key);
    if (STORE_LINES[def.key]) R.intro = { t: 0 };
  }
  if (def.key === 'gamestonk' && !g.eggDone) {
    g.eggDone = true;
    R.egg = { phase: 'talk', t: 0, item: g.rng.pick(JOKE_ITEMS) };
  }
  return R;
}

function boxFree(tpl: RoomTpl, x: number, y: number): boolean {
  return !(solidAt(tpl, x + HB.x0, y + HB.y0) || solidAt(tpl, x + HB.x1 - 1, y + HB.y0) || solidAt(tpl, x + HB.x0, y + HB.y1 - 1) || solidAt(tpl, x + HB.x1 - 1, y + HB.y1 - 1));
}

/** Move one pixel in a direction, with a gentle corner-assist so gaps are easy to slip through. */
export function roomMove(tpl: RoomTpl, R: { x: number; y: number }, dx: number, dy: number): boolean {
  if (boxFree(tpl, R.x + dx, R.y + dy)) {
    R.x += dx;
    R.y += dy;
    return true;
  }
  for (let k = 1; k <= 6; k++) {
    for (const s of [-1, 1]) {
      const ox = dy !== 0 ? s * k : 0;
      const oy = dx !== 0 ? s * k : 0;
      if (boxFree(tpl, R.x + ox + dx, R.y + oy + dy) && boxFree(tpl, R.x + Math.sign(ox), R.y + Math.sign(oy))) {
        R.x += Math.sign(ox);
        R.y += Math.sign(oy);
        return true;
      }
    }
  }
  return false;
}

/** Unopened fixtures the agent is touching (front or either side), best candidate first. */
export function touchingFixtures(R: Room, fixtures: Fixture[]): number[] {
  const x0 = R.x + HB.x0 - 4, x1 = R.x + HB.x1 + 4, y0 = R.y + HB.y0 - 4, y1 = R.y + HB.y1 + 4;
  const cx = R.x + 8, cy = R.y + 10;
  const [fx, fy] = VEC[R.face];
  const out: { i: number; score: number }[] = [];
  fixtures.forEach((f, i) => {
    if (f.opened) return;
    const tx0 = f.tx * TILE, ty0 = f.ty * TILE;
    if (x1 <= tx0 || x0 >= tx0 + TILE || y1 <= ty0 || y0 >= ty0 + TILE) return;
    // must touch along an edge, not just a corner
    const ox = Math.min(R.x + HB.x1, tx0 + TILE) - Math.max(R.x + HB.x0, tx0);
    const oy = Math.min(R.y + HB.y1, ty0 + TILE) - Math.max(R.y + HB.y0, ty0);
    if (ox <= 0 && oy <= 0) return;
    const ddx = tx0 + 8 - cx, ddy = ty0 + 8 - cy;
    const dist = Math.abs(ddx) + Math.abs(ddy);
    const front = ddx * fx + ddy * fy > 4 ? -100 : 0;
    out.push({ i, score: dist + front });
  });
  return out.sort((a, b) => a.score - b.score).map((o) => o.i);
}

function faceToward(R: Room, f: Fixture): void {
  const ddx = f.tx * TILE + 8 - (R.x + 8), ddy = f.ty * TILE + 8 - (R.y + 10);
  R.face = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'r' : 'l') : ddy > 0 ? 'd' : 'u';
}

function smoke(L: Level, x: number, y: number): void {
  L.fx.push({ kind: 'smoke', x, y, t: 40 });
}

/** A free floor tile next to (tx,ty), preferring ones away from the agent. */
function freeTileNear(R: Room, tx: number, ty: number): [number, number] {
  const ptx = Math.floor((R.x + 8) / TILE), pty = Math.floor((R.y + 10) / TILE);
  let best: [number, number] = [tx, ty + 1];
  let bd = -1;
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1], [2, 1], [-2, 1], [0, 2], [2, 0], [-2, 0]]) {
    const x = tx + dx, y = ty + dy;
    if (tileAt(R.tpl, x, y) !== '.') continue;
    const d = Math.abs(x - ptx) + Math.abs(y - pty);
    if (d > bd) { bd = d; best = [x, y]; }
  }
  return best;
}

function resolveSearch(g: Game, L: Level, R: Room, fi: number): void {
  const st = L.stores[R.store];
  const f = st.fixtures[fi];
  const fxX = f.tx * TILE + 8, fxY = f.ty * TILE + 8;
  // Forever 12 fitting rooms: 25% chance of a spy mid-change. The real contents stay unsearched.
  if (f.kind === 'R' && !f.revealed && g.rng.chance(FITTING_CHANCE)) {
    f.revealed = true;
    const [tx, ty] = freeTileNear(R, f.tx, f.ty);
    const spy = newGuard('spy', tx, ty, 'h', 150);
    R.guards.push(spy);
    say(L, fxX, fxY - 6, TEXT.occupied, 80);
    g.sfx.push('shriek');
    const dx = R.x - spy.x, dy = R.y - spy.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    R.bullets.push({ x: spy.x + 8, y: spy.y + 8, vx: (dx / len) * 1.5, vy: (dy / len) * 1.5, owner: 'g', shoe: true, shot: 0 });
    return;
  }
  f.opened = true;
  if (f.content === 'package') {
    g.pkgs++;
    st.cleared = true;
    addScore(g, 500);
    R.hold = { t: 70, icon: 'package' };
    banner(L, g.pkgs >= 6 ? ['PACKAGE 6/6', TEXT.cleared] : ['PACKAGE ' + g.pkgs + '/6'], 150);
    g.sfx.push('fanfare');
  } else if (f.content === 'trap') {
    smoke(L, fxX, fxY);
    banner(L, [TEXT.trap], 90);
    R.stun = STUN_TRAP;
    g.sfx.push('smoke');
  } else if (f.content === 'none') {
    L.fx.push({ kind: 'puff', x: fxX, y: fxY, t: 16 });
    banner(L, [TEXT.nothing], 60);
    g.sfx.push('nothing');
  } else {
    const kind = f.content as PowerKind;
    grantPower(g, L, kind);
    banner(L, [POWER_NAMES[kind]], 120);
    R.hold = { t: 50, icon: kind };
  }
}

function killInRoom(g: Game, L: Level, R: Room): void {
  if (R.dying > 0 || R.invuln > 0 || L.powers.cinna > 0) return;
  if (L.powers.armor) {
    L.powers.armor = false;
    R.invuln = 60;
    g.sfx.push('hurt');
    banner(L, [TEXT.armorSaved], 90);
    return;
  }
  R.dying = 70;
  R.search = null;
  R.hold = null;
  g.sfx.push('death');
}

/** Put the agent back at the door after a death (or a continue) inside a store. */
export function respawnInRoom(R: Room): void {
  R.x = R.tpl.startX;
  R.y = R.tpl.startY;
  R.face = 'u';
  R.dying = 0;
  R.invuln = 120;
  R.stun = 0;
  R.search = null;
  R.bullets = [];
  for (const q of R.guards) { q.stun = Math.max(q.stun, 120); q.aimT = 0; }
}

function clearLine(tpl: RoomTpl, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 4;
  for (let i = 1; i < n; i++) if (solidAt(tpl, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
  return true;
}

function guardTileFree(R: Room, me: Guard, tx: number, ty: number): boolean {
  if (tileAt(R.tpl, tx, ty) !== '.') return false;
  for (const q of R.guards) if (q !== me && q.alive && q.kind === 'spy' && q.tx === tx && q.ty === ty) return false;
  return true;
}

function stepGuards(g: Game, L: Level, R: Room, frozen: boolean): void {
  const d = difficulty(g.loop, L.alarm, g.blackFriday);
  const pcx = R.x + 8, pcy = R.y + 10;
  for (const q of R.guards) {
    if (!q.alive) { if (q.dead > 0) q.dead--; continue; }
    if (q.hitT > 0) q.hitT--;
    if (frozen) continue;
    if (q.stun > 0) { q.stun--; continue; }
    if (q.kind === 'bot') {
      // security bot: patrols back and forth, kills on contact
      const dx = q.axis === 'h' ? q.pdir * BOT_SPEED : 0;
      const dy = q.axis === 'v' ? q.pdir * BOT_SPEED : 0;
      const nx = q.x + dx, ny = q.y + dy;
      const lead = q.pdir > 0 ? 15 : 0;
      const hitWall = q.axis === 'h'
        ? tileAt(R.tpl, Math.floor((nx + lead) / TILE), Math.floor((q.y + 8) / TILE)) !== '.'
        : tileAt(R.tpl, Math.floor((q.x + 8) / TILE), Math.floor((ny + lead) / TILE)) !== '.';
      if (hitWall) q.pdir = -q.pdir;
      else { q.x = nx; q.y = ny; }
      q.face = q.axis === 'h' ? (q.pdir > 0 ? 'r' : 'l') : q.pdir > 0 ? 'd' : 'u';
      q.walkT++;
      if (R.dying === 0 && Math.abs(q.x + 8 - pcx) < 10 && Math.abs(q.y + 8 - pcy) < 10) killInRoom(g, L, R);
      continue;
    }
    if (q.shootT > 0) q.shootT--;
    if (q.aimT > 0) {
      if (--q.aimT === 0) {
        const [vx, vy] = VEC[q.face];
        R.bullets.push({ x: q.x + 8 + vx * 8, y: q.y + 8 + vy * 8, vx: vx * GUARD_BULLET_V, vy: vy * GUARD_BULLET_V, owner: 'g', shoe: false, shot: 0 });
        g.sfx.push('eshot');
      }
      continue;
    }
    if (q.moving) {
      const gx = q.tx * TILE, gy = q.ty * TILE;
      q.x += Math.sign(gx - q.x) * GUARD_SPEED;
      q.y += Math.sign(gy - q.y) * GUARD_SPEED;
      q.walkT++;
      if (q.x === gx && q.y === gy) q.moving = false;
      continue;
    }
    // lined up with a clear path? aim (a visible telegraph), then shoot
    const gcx = q.x + 8, gcy = q.y + 8;
    const ddx = pcx - gcx, ddy = pcy - gcy;
    if (q.shootT === 0 && R.grace === 0 && R.dying === 0 && (Math.abs(ddx) < 7 || Math.abs(ddy) < 7) && Math.hypot(ddx, ddy) < 150 && clearLine(R.tpl, gcx, gcy, pcx, pcy)) {
      q.face = Math.abs(ddx) < 7 ? (ddy > 0 ? 'd' : 'u') : ddx > 0 ? 'r' : 'l';
      q.aimT = GUARD_TELEGRAPH;
      q.shootT = d.shootInterval;
      continue;
    }
    // tile-by-tile movement, favouring the player
    const ptx = Math.floor(pcx / TILE), pty = Math.floor(pcy / TILE);
    const opts: [number, number, Facing][] = [];
    const toward: [number, number, Facing][] = [];
    if (ddx > 4) toward.push([1, 0, 'r']);
    if (ddx < -4) toward.push([-1, 0, 'l']);
    if (ddy > 4) toward.push([0, 1, 'd']);
    if (ddy < -4) toward.push([0, -1, 'u']);
    if (Math.abs(ddy) > Math.abs(ddx)) toward.reverse();
    const near = Math.abs(q.tx - ptx) + Math.abs(q.ty - pty) <= GUARD_KEEP_AWAY;
    if (!near && g.rng.chance(0.7)) opts.push(...toward);
    const all: [number, number, Facing][] = [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']];
    opts.push(...g.rng.shuffle(all));
    for (const [ox, oy, face] of opts) {
      const tx = q.tx + ox, ty = q.ty + oy;
      if (Math.abs(tx - ptx) + Math.abs(ty - pty) < 2) continue; // never step right next to the agent
      if (!guardTileFree(R, q, tx, ty)) continue;
      q.tx = tx; q.ty = ty; q.face = face; q.moving = true;
      break;
    }
  }
}

function hitGuard(g: Game, L: Level, R: Room, q: Guard): void {
  q.hp--;
  q.hitT = 8;
  if (q.hp > 0) { g.sfx.push('ping'); return; }
  q.alive = false;
  q.dead = 24;
  addScore(g, 100);
  L.popups.push({ x: q.x + 8, y: q.y, text: '100', t: 50 });
  g.sfx.push('spydie');
  if (q.kind === 'spy' && g.rng.chance(0.35)) say(L, q.x + 8, q.y - 4, g.rng.pick(LAST_WORDS), 90);
}

function releaseToys(g: Game, R: Room, f: Fixture): void {
  f.toysOut = true;
  const [tx, ty] = freeTileNear(R, f.tx, f.ty);
  const dirs: [number, number][] = [[-1, 0], [0, 1], [1, 0]];
  for (const [dx, dy] of dirs) R.toys.push({ x: tx * TILE, y: ty * TILE, dx, dy, t: 600 });
  g.sfx.push('toys');
}

function stepToys(g: Game, L: Level, R: Room): void {
  const fixtures = L.stores[R.store].fixtures;
  for (const t of R.toys) {
    t.t--;
    // wind-up toys march straight and turn at walls
    for (let k = 0; k < 4; k++) {
      const nx = t.x + t.dx * 0.5, ny = t.y + t.dy * 0.5;
      const blocked = solidAt(R.tpl, nx + 3, ny + 3) || solidAt(R.tpl, nx + 12, ny + 3) || solidAt(R.tpl, nx + 3, ny + 12) || solidAt(R.tpl, nx + 12, ny + 12)
        || tileAt(R.tpl, Math.floor((nx + 8) / TILE), Math.floor((ny + 8) / TILE)) === 'D';
      if (!blocked) { t.x = nx; t.y = ny; break; }
      const odx = t.dx;
      t.dx = -t.dy; t.dy = odx; // turn clockwise
    }
    for (const q of R.guards) if (q.alive && Math.abs(q.x - t.x) < 11 && Math.abs(q.y - t.y) < 11 && q.stun < 100) { q.stun = 120; g.sfx.push('ping'); }
    // toys set off traps: smoke that stuns nearby guards
    for (const f of fixtures) {
      if (f.opened || f.content !== 'trap') continue;
      const cx = f.tx * TILE + 8, cy = f.ty * TILE + 8;
      if (Math.abs(cx - (t.x + 8)) < 18 && Math.abs(cy - (t.y + 8)) < 18) {
        f.opened = true;
        smoke(L, cx, cy);
        g.sfx.push('smoke');
        for (const q of R.guards) if (q.alive && Math.hypot(q.x + 8 - cx, q.y + 8 - cy) < 56) q.stun = 180;
      }
    }
  }
  R.toys = R.toys.filter((t) => t.t > 0);
}

function stepRoomBullets(g: Game, L: Level, R: Room): void {
  const fixtures = L.stores[R.store].fixtures;
  const keep = [];
  for (const b of R.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    let gone = false;
    const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
    if (solidTile(R.tpl, tx, ty) || b.x < 0 || b.y < 0 || b.x >= R.tpl.w * TILE || b.y >= R.tpl.h * TILE) {
      gone = true;
      if (b.owner === 'p' && tileAt(R.tpl, tx, ty) === 'T') {
        const f = fixtures.find((q) => q.tx === tx && q.ty === ty);
        if (f && !f.toysOut) releaseToys(g, R, f);
      }
    }
    if (!gone && b.owner === 'p') {
      for (const q of R.guards) {
        if (q.alive && b.x >= q.x + 1 && b.x <= q.x + 15 && b.y >= q.y + 1 && b.y <= q.y + 15) {
          hitGuard(g, L, R, q);
          gone = true;
          break;
        }
      }
    } else if (!gone && R.dying === 0) {
      if (b.x > R.x + HB.x0 - 1 && b.x < R.x + HB.x1 + 1 && b.y > R.y + 2 && b.y < R.y + HB.y1 + 1) {
        gone = true;
        if (b.shoe) { if (R.invuln === 0) { R.stun = Math.max(R.stun, 30); g.sfx.push('hurt'); } }
        else killInRoom(g, L, R);
      }
    }
    if (!gone) keep.push(b);
  }
  R.bullets = keep;
}

/** Speech bubble position for a guard (room pixel coords). */
function guardSay(L: Level, q: Guard | undefined, text: string): void {
  if (q) say(L, q.x + 8, q.y - 4, text, 100);
}

export function stepStore(g: Game, L: Level, pad: PadFrame): void {
  const R = L.room!;
  const st = L.stores[R.store];
  const tpl = R.tpl;
  R.t++;
  if (R.invuln > 0) R.invuln--;
  if (R.shootCd > 0) R.shootCd--;
  if (R.grace > 0) R.grace--;
  if (R.dying > 0) {
    if (--R.dying === 0) {
      finishDeath(g, L);
      if (g.screen === 'play') respawnInRoom(R);
    }
    return;
  }
  // first-visit lines
  let guardsFrozen = false;
  if (R.intro) {
    const lines = STORE_LINES[st.def.key] ?? [];
    const spies = R.guards.filter((q) => q.kind === 'spy');
    const bot = R.guards.find((q) => q.kind === 'bot');
    const who = (w: string) => (w === 'bot' ? bot : w === 'spy2' ? spies[1] ?? spies[0] : spies[0]) ?? R.guards[0];
    if (R.intro.t === 10 && lines[0]) { guardSay(L, who(lines[0].who), lines[0].text); g.sfx.push('blip'); }
    if (R.intro.t === 70 && lines[1]) { guardSay(L, who(lines[1].who), lines[1].text); g.sfx.push('blip'); }
    guardsFrozen = true;
    if (++R.intro.t >= INTRO_FRAMES) R.intro = null;
  }
  // GameStonk easter egg
  let inputFrozen = false;
  if (R.egg) {
    const e = R.egg;
    e.t++;
    if (e.phase === 'talk') {
      guardsFrozen = true;
      inputFrozen = true;
      if (e.t % 6 === 0 && e.t < EGG_TEXT.length * 3) g.sfx.push('blip');
      if (e.t >= EGG_TALK_FRAMES) { e.phase = 'item'; e.t = 0; }
    } else if (e.phase === 'item') {
      if (Math.abs(R.x + 8 - (PEDESTAL.x + 8)) < 10 && Math.abs(R.y + 10 - (PEDESTAL.y + 8)) < 10) {
        e.phase = 'got';
        e.t = 0;
        addScore(g, 1);
        g.inventory.push(e.item);
        R.hold = { t: 90, icon: 'joke' };
        banner(L, [TEXT.youGot, e.item], 150);
        g.sfx.push('itemget');
      }
    } else if (e.phase === 'got') {
      guardsFrozen = true;
      if (e.t >= 90) {
        e.phase = 'done';
        smoke(L, CLERK.x + 8, CLERK.y + 8);
        g.sfx.push('smoke');
      }
    }
  }
  if (R.hold) {
    inputFrozen = true;
    if (--R.hold.t <= 0) R.hold = null;
  }
  if (R.stun > 0) { R.stun--; inputFrozen = true; }
  const held = inputFrozen ? 0 : pad.held;
  const pressed = inputFrozen ? 0 : pad.pressed;

  // searching: a single tap of B runs on its own
  const touching = touchingFixtures(R, st.fixtures);
  R.prompt = touching.length ? touching[0] : -1;
  if (R.search) {
    const dirBit: Record<Facing, number> = { u: Btn.Up, d: Btn.Down, l: Btn.Left, r: Btn.Right };
    const other = pressed & DIRS & ~dirBit[R.face];
    if (other || pressed & Btn.A || inputFrozen) R.search = null; // only a fresh different direction or shooting cancels
    else {
      R.search.t++;
      if (R.search.t % 9 === 1) g.sfx.push('tick');
      if (R.search.t >= R.search.dur) {
        const fi = R.search.fi;
        R.search = null;
        resolveSearch(g, L, R, fi);
      }
    }
  } else if (pressed & Btn.B && R.prompt >= 0) {
    R.search = { fi: R.prompt, t: 0, dur: searchFrames(L.powers) };
    faceToward(R, st.fixtures[R.prompt]);
  }
  // moving: 4 directions, vertical input has priority
  if (!R.search && !inputFrozen) {
    let dir: Facing | null = null;
    if (held & Btn.Up) dir = 'u';
    else if (held & Btn.Down) dir = 'd';
    else if (held & Btn.Left) dir = 'l';
    else if (held & Btn.Right) dir = 'r';
    if (dir) {
      R.face = dir;
      const sp = walkSpeed(L.powers);
      const steps = sp > 1 ? (R.t % 2 ? 2 : 1) : 1;
      let moved = false;
      for (let k = 0; k < steps; k++) moved = roomMove(tpl, R, VEC[dir][0], VEC[dir][1]) || moved;
      R.walkT = moved ? R.walkT + 1 : 0;
    } else R.walkT = 0;
  }
  // shooting, in the facing direction
  if (pressed & Btn.A && R.shootCd === 0) {
    const shots = new Set(R.bullets.filter((b) => b.owner === 'p').map((b) => b.shot));
    if (shots.size < maxShots(L.powers)) {
      R.shootCd = shotCooldown(L.powers);
      const shot = ++L.shotId;
      const [vx, vy] = VEC[R.face];
      const mk = (sx: number, sy: number) => ({ x: R.x + 8 + vx * 6, y: R.y + 9 + vy * 6, vx: vx * 3 + sx, vy: vy * 3 + sy, owner: 'p' as const, shoe: false, shot });
      R.bullets.push(mk(0, 0));
      if (L.powers.weapon === 'spread') R.bullets.push(mk(vy * 0.9, vx * 0.9), mk(-vy * 0.9, -vx * 0.9));
      g.sfx.push('shot');
    }
  }
  stepGuards(g, L, R, guardsFrozen);
  stepRoomBullets(g, L, R);
  stepToys(g, L, R);
  // Sam Baddy listening booth
  const onBooth = tileAt(tpl, Math.floor((R.x + 8) / TILE), Math.floor((R.y + 11) / TILE)) === 'B';
  if (onBooth && !R.sideB) banner(L, [TEXT.sideB], 120);
  R.sideB = onBooth;
  // walking out through the door
  if (tileAt(tpl, Math.floor((R.x + 8) / TILE), Math.floor((R.y + HB.y1 - 2) / TILE)) === 'D' && R.dying === 0 && !L.trans) {
    L.trans = { kind: 'out', t: 0, store: R.store };
    g.sfx.push('door');
  }
}
