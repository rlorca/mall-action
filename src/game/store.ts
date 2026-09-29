/**
 * Stores (top-down, Zelda-style rooms). Pure rules.
 * Coordinates are room pixels; the agent's x,y is the centre of his 16x16 sprite.
 */
import type { PadFrame, Button } from '../core/input';
import { C } from '../core/palette';
import type { StoreId } from '../art/manifest';
import { TILE, fixtureIndexAt, isSolid, roomFor, tileAt, type Room } from './rooms';
import { spySpeed, shotInterval } from './difficulty';
import { absorbHit, maxBullets, searchFrames, shotCooldown, walkSpeed } from './powerups';
import { BANNERS, EASTER_EGG_TEXT, FIRST_VISIT_LINES, JOKE_ITEMS, JOKE_ITEM_SPRITES, POWERUP_NAMES, SPY_LAST_WORDS } from './copy';
import { POINTS, addScore, banner, jingle, newId, popup, rectsOverlap, sfx } from './common';
import { collectPower } from './mall';
import type { Dir, GameState, Guard, Level, StoreSession } from './state';

export const VIEW_W = 256;
export const VIEW_H = 176;
export const HALF = 6;
export const STORE_BULLET = 3;
export const STORE_ENEMY_BULLET = 2;
export const GRACE = 60;
export const LINE_GAP = 60;
export const LINES_HOLD = 110;
export const TRAP_STUN = 60;
export const FITTING_SPY_CHANCE = 0.25;
export const TYPE_FRAMES = 3;
export const CORNER_ASSIST = 6;

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LEFT_OF: Record<Dir, Dir> = { up: 'left', left: 'down', down: 'right', right: 'up' };
const RIGHT_OF: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };

function newGuards(g: GameState, room: Room): Guard[] {
  return room.guards.map((s) => ({
    id: newId(g), kind: s.kind, x: s.tx * TILE + 8, y: s.ty * TILE + 8, dir: 'down' as Dir, tx: s.tx, ty: s.ty,
    hp: s.kind === 'bot' ? 3 : 1, stun: 0, aim: 0, shotT: 30, dying: 0, hitFlash: 0, axis: s.axis, anim: 0, changing: 0,
  }));
}

export function enterStore(g: GameState, lvl: Level, id: StoreId): StoreSession {
  const room = roomFor(id);
  const s: StoreSession = {
    id, x: room.entry.x, y: room.entry.y, facing: 'up', anim: 0, guards: newGuards(g, room), bullets: [], toys: [],
    puffs: [], search: null, stun: 0, hold: null, grace: GRACE, lines: null, easter: null, clerkPresent: false,
    boothOn: false, camX: 0, camY: 0, cooldown: 0, dead: 0, invuln: 0, exiting: false, popups: [], bubbles: [],
  };
  if (!g.visited.includes(id)) {
    g.visited.push(id);
    const lines = FIRST_VISIT_LINES[id];
    if (lines) s.lines = { t: 0, queue: lines.map((l, i) => ({ who: l.who, text: l.text, at: i * LINE_GAP })) };
  }
  if (id === 'gamestonk' && !g.easterDone && room.clerk) {
    s.clerkPresent = true;
    s.easter = { phase: 'text', chars: 0, t: 0, item: lvl.rng.pick(JOKE_ITEMS) };
  }
  updateStoreCamera(s, room);
  return s;
}

export function updateStoreCamera(s: StoreSession, room: Room): void {
  s.camX = Math.max(0, Math.min(room.w * TILE - VIEW_W, Math.round(s.x - VIEW_W / 2)));
  s.camY = Math.max(0, Math.min(room.h * TILE - VIEW_H, Math.round(s.y - VIEW_H / 2)));
}

/** Is the whole box (centre x,y, half-size h) free of solid tiles? */
export function boxFree(room: Room, x: number, y: number, h: number, clerk: boolean): boolean {
  const x0 = Math.floor((x - h) / TILE);
  const x1 = Math.floor((x + h - 0.001) / TILE);
  const y0 = Math.floor((y - h) / TILE);
  const y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(room, tx, ty, clerk)) return false;
  return true;
}

/**
 * Move the agent one step in a direction with Zelda-style corner assist:
 * if blocked, but a small sideways nudge would line him up with a gap, nudge instead.
 */
export function moveWithAssist(room: Room, s: { x: number; y: number }, dir: Dir, speed: number, clerk: boolean): boolean {
  const [dx, dy] = DIRS[dir];
  let moved = false;
  let remaining = speed;
  while (remaining > 0) {
    const step = Math.min(1, remaining);
    remaining -= step;
    const nx = s.x + dx * step;
    const ny = s.y + dy * step;
    if (boxFree(room, nx, ny, HALF, clerk)) {
      s.x = nx;
      s.y = ny;
      moved = true;
      continue;
    }
    // Corner assist: look for the smallest perpendicular offset that frees the move.
    let best = 0;
    for (let k = 1; k <= CORNER_ASSIST && best === 0; k++) {
      for (const sgn of [-1, 1]) {
        const ox = dy !== 0 ? sgn * k : 0;
        const oy = dx !== 0 ? sgn * k : 0;
        if (boxFree(room, s.x + ox, s.y + oy, HALF, clerk) && boxFree(room, s.x + ox + dx, s.y + oy + dy, HALF, clerk)) {
          best = sgn;
          break;
        }
      }
    }
    if (best !== 0) {
      const ox = dy !== 0 ? best : 0;
      const oy = dx !== 0 ? best : 0;
      if (boxFree(room, s.x + ox, s.y + oy, HALF, clerk)) {
        s.x += ox;
        s.y += oy;
        moved = true;
      }
    }
    break;
  }
  return moved;
}

/** Unopened searchable fixtures the agent is touching on one side, best overlap first. */
function touchingOnSide(room: Room, rt: { opened: boolean[] }, x: number, y: number, dir: Dir): number {
  const [dx, dy] = DIRS[dir];
  const reach = 3;
  // A thin strip just outside the agent's box on that side.
  const x0 = dx > 0 ? x + HALF : dx < 0 ? x - HALF - reach : x - HALF;
  const x1 = dx > 0 ? x + HALF + reach : dx < 0 ? x - HALF : x + HALF;
  const y0 = dy > 0 ? y + HALF : dy < 0 ? y - HALF - reach : y - HALF;
  const y1 = dy > 0 ? y + HALF + reach : dy < 0 ? y - HALF : y + HALF;
  let best = -1;
  let bestOverlap = 0;
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y1 - 0.001) / TILE); ty++) {
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x1 - 0.001) / TILE); tx++) {
      const i = fixtureIndexAt(room, tx, ty);
      if (i < 0 || rt.opened[i]) continue;
      const ox = Math.min(x1, tx * TILE + TILE) - Math.max(x0, tx * TILE);
      const oy = Math.min(y1, ty * TILE + TILE) - Math.max(y0, ty * TILE);
      const overlap = Math.max(0, ox) * Math.max(0, oy);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = i;
      }
    }
  }
  return best;
}

/** The fixture a search would use: front first, then either side. Returns fixture index and the side. */
export function findSearchTarget(room: Room, rt: { opened: boolean[] }, x: number, y: number, facing: Dir): { i: number; dir: Dir } | null {
  for (const d of [facing, LEFT_OF[facing], RIGHT_OF[facing]]) {
    const i = touchingOnSide(room, rt, x, y, d);
    if (i >= 0) return { i, dir: d };
  }
  return null;
}

// ---------------------------------------------------------------- step

export function stepStore(g: GameState, lvl: Level, input: PadFrame): void {
  const s = lvl.store!;
  const room = roomFor(s.id);
  const rt = lvl.stores[s.id];
  s.anim++;
  for (let i = s.puffs.length - 1; i >= 0; i--) if (++s.puffs[i].t >= 24) s.puffs.splice(i, 1);
  for (let i = s.popups.length - 1; i >= 0; i--) {
    s.popups[i].y -= 0.5;
    if (--s.popups[i].t <= 0) s.popups.splice(i, 1);
  }
  for (let i = s.bubbles.length - 1; i >= 0; i--) if (--s.bubbles[i].t <= 0) s.bubbles.splice(i, 1);

  if (s.dead > 0) {
    s.dead++;
    return;
  }
  if (s.invuln > 0) s.invuln--;
  if (s.cooldown > 0) s.cooldown--;

  // GameStonk easter egg: guards and input freeze while the old clerk's text types out.
  if (s.easter && s.easter.phase === 'text') {
    const e = s.easter;
    e.t++;
    if (e.t % TYPE_FRAMES === 0 && e.chars < EASTER_EGG_TEXT.length) {
      e.chars++;
      if (EASTER_EGG_TEXT[e.chars - 1] !== ' ') sfx(g, 'blip');
    }
    if (e.chars >= EASTER_EGG_TEXT.length && e.t > EASTER_EGG_TEXT.length * TYPE_FRAMES + 50) {
      e.phase = 'item';
      e.t = 0;
      sfx(g, 'powerup');
    }
    updateStoreCamera(s, room);
    return;
  }

  // First-visit lines: guards hold still and talk.
  let guardsFrozen = false;
  if (s.lines) {
    const L = s.lines;
    for (const q of L.queue) {
      if (L.t === q.at) {
        const speaker = pickSpeaker(s, q.who);
        if (speaker) s.bubbles.push({ text: q.text, x: speaker.x, y: speaker.y - 12, t: LINES_HOLD + LINE_GAP * (L.queue.length - 1) - q.at, follow: speaker.id });
        sfx(g, 'blip');
      }
    }
    L.t++;
    const end = L.queue[L.queue.length - 1].at + LINES_HOLD;
    if (L.t >= end) s.lines = null;
    else guardsFrozen = true;
  }
  if (!guardsFrozen && s.grace > 0) s.grace--;

  stepAgent(g, lvl, s, room, rt, input);
  if (lvl.store !== s || s.exiting) return;
  if (!guardsFrozen) stepGuards(g, lvl, s, room);
  stepStoreBullets(g, lvl, s, room, rt);
  stepToys(g, s, room, rt);
  storeContacts(g, lvl, s);
  updateStoreCamera(s, room);
}

function pickSpeaker(s: StoreSession, who: 'spy' | 'spy2' | 'bot'): Guard | undefined {
  const spies = s.guards.filter((g) => g.kind === 'spy');
  const bots = s.guards.filter((g) => g.kind === 'bot');
  if (who === 'bot') return bots[0] ?? s.guards[0];
  if (who === 'spy2') return spies[1] ?? spies[0] ?? s.guards[0];
  return spies[0] ?? s.guards[0];
}

const DIR_BUTTONS: [Button, Dir][] = [['up', 'up'], ['down', 'down'], ['left', 'left'], ['right', 'right']];

function stepAgent(g: GameState, lvl: Level, s: StoreSession, room: Room, rt: Level['stores'][string], input: PadFrame): void {
  if (s.hold) {
    if (--s.hold.t <= 0) s.hold = null;
    return;
  }
  if (s.stun > 0) {
    s.stun--;
    return;
  }

  // An active search runs on its own; only a fresh press of a different direction, or shooting, cancels it.
  if (s.search) {
    if (input.pressed.has('a')) {
      s.search = null;
      storeShoot(g, lvl, s);
      return;
    }
    const fresh = DIR_BUTTONS.find(([b, d]) => input.pressed.has(b) && d !== s.facing);
    if (fresh) {
      s.search = null;
    } else {
      s.search.t++;
      if (s.search.t % 9 === 0) sfx(g, 'searchtick');
      if (s.search.t >= s.search.dur) {
        const i = s.search.fixture;
        s.search = null;
        resolveSearch(g, lvl, s, room, rt, i);
      }
      return;
    }
  }

  if (input.pressed.has('b')) {
    const t = findSearchTarget(room, rt, s.x, s.y, s.facing);
    if (t) {
      s.facing = t.dir;
      s.search = { fixture: t.i, t: 0, dur: searchFrames(lvl.powers) };
      sfx(g, 'searchtick');
      return;
    }
  }
  if (input.pressed.has('a')) storeShoot(g, lvl, s);

  // Movement: 4 directions, vertical input takes priority.
  let dir: Dir | null = null;
  if (input.held.has('up')) dir = 'up';
  else if (input.held.has('down')) dir = 'down';
  else if (input.held.has('left')) dir = 'left';
  else if (input.held.has('right')) dir = 'right';
  if (dir) {
    s.facing = dir;
    if (moveWithAssist(room, s, dir, walkSpeed(lvl.powers), s.clerkPresent)) s.anim++;
  }

  const tx = Math.floor(s.x / TILE);
  const ty = Math.floor(s.y / TILE);
  const here = tileAt(room, tx, ty);

  // Sam Baddy's listening booth.
  if (here === 'L' && !s.boothOn) {
    s.boothOn = true;
    banner(g, BANNERS.sideB, 120, C.PINK);
  }

  // GameStonk: the item on the pedestal.
  if (s.easter && s.easter.phase === 'item' && room.pedestal && tx === room.pedestal.tx && ty === room.pedestal.ty) {
    const item = s.easter.item;
    s.easter.phase = 'got';
    s.hold = { sprite: JOKE_ITEM_SPRITES[item], t: 110 };
    jingle(g, 'jingle_itemget');
    banner(g, BANNERS.youGot(item), 150, C.GOLD);
    addScore(g, POINTS.joke);
    g.inventory.push(item);
    g.easterDone = true;
    if (room.clerk) s.puffs.push({ x: room.clerk.tx * TILE + 8, y: room.clerk.ty * TILE + 8, t: 0 });
    s.clerkPresent = false;
    sfx(g, 'smoke');
  }

  // Walking out through the door.
  if (here === 'D' && s.y > ty * TILE + 4 && dir === 'down') {
    s.exiting = true;
    sfx(g, 'door');
    g.fade = { t: 0, total: 30, action: 'exitStore', arg: s.id, done: false };
  }
}

function resolveSearch(g: GameState, lvl: Level, s: StoreSession, room: Room, rt: Level['stores'][string], i: number): void {
  const f = room.fixtures[i];
  const fx = f.tx * TILE + 8;
  const fy = f.ty * TILE + 8;
  // Forever 12 fitting rooms: sometimes a spy mid-change. The room's real contents stay unsearched.
  if (f.kind === 'fitting' && !s.guards.some((gd) => gd.changing > 0) && lvl.rng.chance(FITTING_SPY_CHANCE)) {
    const spy: Guard = {
      id: newId(g), kind: 'spy', x: fx, y: fy, dir: 'down', tx: f.tx, ty: f.ty, hp: 1, stun: 0, aim: 0, shotT: 90,
      dying: 0, hitFlash: 0, axis: 'h', anim: 0, changing: 60,
    };
    s.guards.push(spy);
    s.bubbles.push({ text: BANNERS.occupied, x: fx, y: fy - 12, t: 70, follow: spy.id });
    sfx(g, 'shriek');
    return;
  }
  rt.opened[i] = true;
  const c = rt.contents[i];
  switch (c.t) {
    case 'package':
      lvl.packages++;
      rt.cleared = true;
      addScore(g, POINTS.package);
      s.popups.push({ text: String(POINTS.package), x: s.x, y: s.y - 20, t: 50 });
      s.hold = { sprite: 'package', t: 100 };
      jingle(g, 'jingle_fanfare');
      banner(g, BANNERS.package(lvl.packages), 150, lvl.packages >= 6 ? C.LGREEN : C.GOLD, true);
      break;
    case 'power':
      collectPower(g, lvl, c.k);
      s.hold = { sprite: 'pu_' + c.k, t: 60 };
      banner(g, POWERUP_NAMES[c.k], 100, C.CYAN);
      break;
    case 'trap':
      s.puffs.push({ x: s.x, y: s.y, t: 0 });
      s.stun = TRAP_STUN;
      sfx(g, 'smoke');
      banner(g, BANNERS.trap, 90, C.RED);
      break;
    case 'nothing':
      s.puffs.push({ x: fx, y: fy, t: 0 });
      sfx(g, 'smoke');
      banner(g, BANNERS.nothing, 70, C.LGREY);
      break;
  }
}

function storeShoot(g: GameState, lvl: Level, s: StoreSession): void {
  if (s.cooldown > 0) return;
  const mine = s.bullets.filter((b) => b.mine).length;
  const max = maxBullets(lvl.powers);
  if (mine >= max) return;
  s.cooldown = shotCooldown(lvl.powers);
  const [dx, dy] = DIRS[s.facing];
  const spreads = lvl.powers.weapon === 'spread' ? [-0.6, 0, 0.6] : [0];
  for (const k of spreads) {
    s.bullets.push({ x: s.x + dx * 8, y: s.y + dy * 8, vx: dx * STORE_BULLET + (dy !== 0 ? k * STORE_BULLET : 0), vy: dy * STORE_BULLET + (dx !== 0 ? k * STORE_BULLET : 0), mine: true });
  }
  sfx(g, 'shot');
}

// ---------------------------------------------------------------- guards

function tileCenter(t: number): number {
  return t * TILE + 8;
}

function clearLine(room: Room, x0: number, y0: number, x1: number, y1: number, clerk: boolean): boolean {
  const tx0 = Math.floor(x0 / TILE);
  const ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE);
  const ty1 = Math.floor(y1 / TILE);
  if (ty0 === ty1) {
    for (let tx = Math.min(tx0, tx1) + 1; tx < Math.max(tx0, tx1); tx++) if (isSolid(room, tx, ty0, clerk)) return false;
    return true;
  }
  if (tx0 === tx1) {
    for (let ty = Math.min(ty0, ty1) + 1; ty < Math.max(ty0, ty1); ty++) if (isSolid(room, tx0, ty, clerk)) return false;
    return true;
  }
  return false;
}

function stepGuards(g: GameState, lvl: Level, s: StoreSession, room: Room): void {
  const rng = lvl.rng;
  const speed = (spySpeed(g.loop) / 0.62) * 0.7 * (lvl.alarm ? 1.15 : 1);
  for (let i = s.guards.length - 1; i >= 0; i--) {
    const gd = s.guards[i];
    gd.anim++;
    if (gd.hitFlash > 0) gd.hitFlash--;
    if (gd.dying > 0) {
      if (++gd.dying > 24) s.guards.splice(i, 1);
      continue;
    }
    if (gd.stun > 0) {
      gd.stun--;
      continue;
    }
    if (gd.changing > 0) {
      gd.changing--;
      if (gd.changing === 20) {
        // Throws a shoe at the agent.
        const dx = s.x - gd.x;
        const dy = s.y - gd.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        s.bullets.push({ x: gd.x, y: gd.y, vx: (dx / d) * 2.2, vy: (dy / d) * 2.2, mine: false, shoe: true });
        sfx(g, 'throw');
      }
      continue;
    }
    if (gd.kind === 'bot') {
      const dir: Dir = gd.axis === 'h' ? (gd.dir === 'left' ? 'left' : 'right') : gd.dir === 'up' ? 'up' : 'down';
      const [dx, dy] = DIRS[dir];
      const nx = gd.x + dx * 0.6;
      const ny = gd.y + dy * 0.6;
      if (boxFree(room, nx, ny, 7, s.clerkPresent)) {
        gd.x = nx;
        gd.y = ny;
        gd.dir = dir;
      } else gd.dir = gd.axis === 'h' ? (dir === 'left' ? 'right' : 'left') : dir === 'up' ? 'down' : 'up';
      continue;
    }
    // Spy guard.
    if (gd.shotT > 0) gd.shotT--;
    if (gd.aim > 0) {
      gd.aim--;
      if (gd.aim === 0) {
        const [dx, dy] = DIRS[gd.dir];
        s.bullets.push({ x: gd.x + dx * 8, y: gd.y + dy * 8, vx: dx * STORE_ENEMY_BULLET, vy: dy * STORE_ENEMY_BULLET, mine: false });
        sfx(g, 'eshot');
        gd.shotT = Math.round(shotInterval(g.loop) * 0.75);
      }
      continue;
    }
    const cx = tileCenter(gd.tx);
    const cy = tileCenter(gd.ty);
    const atCenter = Math.abs(gd.x - cx) < 0.01 && Math.abs(gd.y - cy) < 0.01;
    if (atCenter) {
      gd.x = cx;
      gd.y = cy;
      // Shoot along straight lines when lined up with a clear path.
      const rowAligned = Math.abs(s.y - gd.y) < 6;
      const colAligned = Math.abs(s.x - gd.x) < 6;
      if (s.grace === 0 && gd.shotT === 0 && s.dead === 0 && (rowAligned || colAligned) &&
        clearLine(room, gd.x, gd.y, s.x, s.y, s.clerkPresent)) {
        gd.dir = rowAligned ? (s.x < gd.x ? 'left' : 'right') : s.y < gd.y ? 'up' : 'down';
        gd.aim = 18;
        continue;
      }
      // Choose the next tile, favouring the agent.
      const options: { d: Dir; tx: number; ty: number; dist: number }[] = [];
      for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
        const [dx, dy] = DIRS[d];
        const ntx = gd.tx + dx;
        const nty = gd.ty + dy;
        if (isSolid(room, ntx, nty, s.clerkPresent)) continue;
        if (s.guards.some((o) => o !== gd && o.dying === 0 && o.tx === ntx && o.ty === nty)) continue;
        options.push({ d, tx: ntx, ty: nty, dist: Math.abs(tileCenter(ntx) - s.x) + Math.abs(tileCenter(nty) - s.y) });
      }
      if (options.length) {
        options.sort((a, b) => a.dist - b.dist);
        const pick = rng.chance(0.65) ? options[0] : rng.pick(options);
        // Keep a little distance instead of walking into the agent.
        if (pick.dist < 20 && options.length > 1 && rng.chance(0.7)) {
          const alt = options[options.length - 1];
          gd.tx = alt.tx;
          gd.ty = alt.ty;
          gd.dir = alt.d;
        } else {
          gd.tx = pick.tx;
          gd.ty = pick.ty;
          gd.dir = pick.d;
        }
      }
    }
    const tx = tileCenter(gd.tx);
    const ty = tileCenter(gd.ty);
    gd.x += Math.max(-speed, Math.min(speed, tx - gd.x));
    gd.y += Math.max(-speed, Math.min(speed, ty - gd.y));
  }
}

function killGuard(g: GameState, lvl: Level, s: StoreSession, gd: Guard, pts: number): void {
  gd.dying = 1;
  addScore(g, pts);
  s.popups.push({ text: String(pts), x: gd.x, y: gd.y - 12, t: 50 });
  sfx(g, gd.kind === 'bot' ? 'bothit' : 'spyhit');
  if (gd.kind === 'spy' && lvl.rng.chance(0.35)) {
    s.bubbles.push({ text: lvl.rng.pick(SPY_LAST_WORDS), x: gd.x, y: gd.y - 12, t: 80 });
  }
}

// ---------------------------------------------------------------- bullets, toys, contact

function stepStoreBullets(g: GameState, lvl: Level, s: StoreSession, room: Room, rt: Level['stores'][string]): void {
  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    const tx = Math.floor(b.x / TILE);
    const ty = Math.floor(b.y / TILE);
    let hit = false;
    if (isSolid(room, tx, ty, s.clerkPresent)) {
      hit = true;
      // KGB Toys: shooting a toy shelf releases three wind-up toys.
      if (b.mine && s.id === 'kgbtoys') {
        const fi = fixtureIndexAt(room, tx, ty);
        if (fi >= 0 && room.fixtures[fi].kind === 'toyshelf' && !rt.toysReleased[fi]) {
          rt.toysReleased[fi] = true;
          releaseToys(g, lvl, s, room, tx, ty);
        }
      }
    }
    if (!hit && b.mine) {
      for (const gd of s.guards) {
        if (gd.dying > 0) continue;
        if (Math.abs(b.x - gd.x) < 7 && Math.abs(b.y - gd.y) < 7) {
          hit = true;
          if (gd.kind === 'bot') {
            gd.hp--;
            gd.hitFlash = 8;
            sfx(g, 'bothit');
            if (gd.hp <= 0) killGuard(g, lvl, s, gd, 200);
          } else killGuard(g, lvl, s, gd, POINTS.spyShot);
          break;
        }
      }
    }
    if (!hit && !b.mine && s.dead === 0 && Math.abs(b.x - s.x) < 6 && Math.abs(b.y - s.y) < 6) {
      hit = true;
      if (b.shoe) {
        s.stun = Math.max(s.stun, 30);
        s.search = null;
        sfx(g, 'hurt');
      } else if (s.invuln === 0 && lvl.powers.invincT === 0) {
        if (absorbHit(lvl.powers)) {
          s.invuln = 60;
          sfx(g, 'ping');
          s.popups.push({ text: 'ARMOR!', x: s.x, y: s.y - 14, t: 50 });
        } else killInStore(g, s);
      }
    }
    if (hit) s.bullets.splice(i, 1);
  }
}

function releaseToys(g: GameState, lvl: Level, s: StoreSession, room: Room, tx: number, ty: number): void {
  const spots: { x: number; y: number; dir: Dir }[] = [];
  for (const d of ['down', 'left', 'right', 'up'] as Dir[]) {
    const [dx, dy] = DIRS[d];
    if (!isSolid(room, tx + dx, ty + dy, s.clerkPresent)) spots.push({ x: tileCenter(tx + dx), y: tileCenter(ty + dy), dir: d });
  }
  if (!spots.length) return;
  for (let k = 0; k < 3; k++) {
    const sp = spots[k % spots.length];
    s.toys.push({ x: sp.x + (k - 1) * 3, y: sp.y, dir: sp.dir, t: 900, anim: 0 });
  }
  sfx(g, 'powerup');
  s.popups.push({ text: 'WIND-UP TOYS!', x: tileCenter(tx), y: tileCenter(ty) - 10, t: 60 });
  void lvl;
}

function stepToys(g: GameState, s: StoreSession, room: Room, rt: Level['stores'][string]): void {
  for (let i = s.toys.length - 1; i >= 0; i--) {
    const t = s.toys[i];
    t.anim++;
    if (--t.t <= 0) {
      s.toys.splice(i, 1);
      continue;
    }
    const [dx, dy] = DIRS[t.dir];
    const nx = t.x + dx * 0.5;
    const ny = t.y + dy * 0.5;
    if (boxFree(room, nx, ny, 3, s.clerkPresent)) {
      t.x = nx;
      t.y = ny;
    } else t.dir = RIGHT_OF[t.dir]; // turn at walls
    for (const gd of s.guards) {
      if (gd.dying === 0 && gd.stun === 0 && Math.abs(gd.x - t.x) < 9 && Math.abs(gd.y - t.y) < 9) {
        gd.stun = 120;
        gd.aim = 0;
        sfx(g, 'bothit');
      }
    }
    // Toys set off traps they bump into: smoke that stuns nearby guards.
    const ftx = Math.floor((t.x + dx * 6) / TILE);
    const fty = Math.floor((t.y + dy * 6) / TILE);
    const fi = fixtureIndexAt(room, ftx, fty);
    if (fi >= 0 && !rt.opened[fi] && rt.contents[fi].t === 'trap') {
      rt.opened[fi] = true;
      const px = tileCenter(ftx);
      const py = tileCenter(fty);
      s.puffs.push({ x: px, y: py, t: 0 });
      sfx(g, 'smoke');
      for (const gd of s.guards) if (gd.dying === 0 && Math.hypot(gd.x - px, gd.y - py) < 40) gd.stun = 150;
    }
  }
}

function storeContacts(g: GameState, lvl: Level, s: StoreSession): void {
  if (s.dead > 0) return;
  for (const gd of s.guards) {
    if (gd.dying > 0 || gd.changing > 0) continue;
    if (!rectsOverlap(s.x - 5, s.y - 5, s.x + 5, s.y + 5, gd.x - 6, gd.y - 6, gd.x + 6, gd.y + 6)) continue;
    if (lvl.powers.invincT > 0) {
      killGuard(g, lvl, s, gd, gd.kind === 'bot' ? 200 : POINTS.spyShot);
      continue;
    }
    if (gd.stun > 0 && gd.kind === 'spy') continue;
    if (s.invuln === 0) killInStore(g, s);
    return;
  }
}

function killInStore(g: GameState, s: StoreSession): void {
  if (s.dead > 0) return;
  s.dead = 1;
  s.search = null;
  s.hold = null;
  sfx(g, 'death');
}

export function respawnInStore(g: GameState, lvl: Level): void {
  const s = lvl.store!;
  const room = roomFor(s.id);
  s.x = room.entry.x;
  s.y = room.entry.y;
  s.facing = 'up';
  s.dead = 0;
  s.invuln = 120;
  s.grace = GRACE;
  s.bullets = [];
  s.toys = [];
  s.search = null;
  s.stun = 0;
  s.hold = null;
  s.guards = newGuards(g, room);
  updateStoreCamera(s, room);
}

export { popup };
