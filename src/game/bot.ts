import { Btn } from '../engine/pad';
import { ESCALATORS, SHAFTS, floorY, type EscalatorDef } from '../content/layout';
import { DOOR_W, DOOR_X, storeDef, type StoreId } from '../content/stores';
import type { MallWorld } from './mall/world';
import { openingState } from './mall/geometry';
import type { StoreWorld } from './store/world';
import { TILE, isSolidKind, tileAt, type Room } from './store/room';

/**
 * A scripted PLAYER used by tests: it only presses buttons (walk, jump over pits, call and ride elevators,
 * escalators, doors, searching in stores), exactly like a human, so end-to-end tests prove that every route
 * in the mall and every store can really be played, with no softlocks.
 */
export interface BotRig {
  /** The mall world (it persists across store visits). */
  readonly w: MallWorld;
  hold(held: number, n?: number): void;
  tap(btn: number): void;
}

export class BotError extends Error {}

/** The player's mode as a plain string (keeps TypeScript from narrowing it across game steps). */
const modeOf = (r: BotRig): string => r.w.player.mode;

function must(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new BotError(msg);
}

/** Walk like a player: jump-kick over any open pit that is in the way, and over a mall walker that blocks the corridor. */
export function walkTo(r: BotRig, x: number, max = 3500): void {
  let stall = 0;
  let lastX = r.w.player.x;
  for (let i = 0; i < max; i++) {
    const p = r.w.player;
    const dx = x - p.x;
    if (Math.abs(dx) <= 0.6) break;
    const dir = dx > 0 ? 1 : -1;
    const btn = dir > 0 ? Btn.RIGHT : Btn.LEFT;
    if (p.mode === 'ground' && p.floor !== null) {
      for (const sh of SHAFTS) {
        if (p.floor < sh.top || p.floor > sh.bottom) continue;
        if (openingState(r.w.car(sh.id), p.floor) !== 'pit') continue;
        const edge = dir > 0 ? sh.x + 4 : sh.x + sh.w - 4;
        const gap = (edge - p.x) * dir;
        const beyond = dir > 0 ? x > sh.x + sh.w : x < sh.x;
        if (beyond && gap >= 0 && gap <= 7) {
          r.hold(btn | Btn.B, 1);
          for (let k = 0; k < 60 && r.w.player.mode === 'air'; k++) r.hold(btn, 1);
        }
      }
      // Not getting anywhere (a mall walker is shoving us back): a jump-kick carries us past his centre.
      stall = (p.x - lastX) * dir > 0.2 ? 0 : stall + 1;
      lastX = p.x;
      if (stall >= 12 && !nearOpenPit(r, p.x, p.floor, 40)) {
        r.hold(btn | Btn.B, 1);
        for (let k = 0; k < 60 && r.w.player.mode === 'air'; k++) r.hold(btn, 1);
        stall = 0;
      }
    }
    r.hold(btn, 1);
  }
  r.hold(0, 1);
}

function nearOpenPit(r: BotRig, x: number, floor: number, margin: number): boolean {
  for (const sh of SHAFTS) {
    if (floor < sh.top || floor > sh.bottom) continue;
    if (x > sh.x - margin && x < sh.x + sh.w + margin && openingState(r.w.car(sh.id), floor) === 'pit') return true;
  }
  return false;
}

/** Ride shaft `id` from the current floor to floor `to` and step out. */
export function ride(r: BotRig, id: 'A' | 'B' | 'C', to: number): void {
  const s = SHAFTS.find((k) => k.id === id)!;
  const car = r.w.car(id);
  const from = r.w.player.floor;
  must(from !== null, 'ride: not standing on a floor');
  // like a player: stand beside the opening and wait (standing still calls the car)
  const side = r.w.player.x < s.x ? s.x - 6 : s.x + s.w + 6;
  walkTo(r, side);
  for (let i = 0; i < 1800 && openingState(car, from) !== 'here'; i++) r.hold(0, 1);
  must(openingState(car, from) === 'here', `${id}: the car never came to floor ${from}`);
  walkTo(r, s.x + s.w / 2);
  r.tap(to > from ? Btn.DOWN : Btn.UP);
  must(modeOf(r) === 'ride', `${id}: could not board`);
  const target = floorY(to);
  const dir = to > from ? Btn.DOWN : Btn.UP;
  for (let i = 0; i < 1500; i++) {
    if (Math.abs(car.y - target) < 24 && car.dir !== 0) break;
    r.hold(dir, 1);
  }
  r.hold(0, 90);
  must(car.y === target && car.dir === 0, `${id}: did not stop level with floor ${to}`);
  r.hold(Btn.RIGHT, 30);
  must(modeOf(r) === 'ground' && r.w.player.floor === to, `${id}: could not step out at ${to}`);
}

export function escalate(r: BotRig, e: EscalatorDef, up: boolean): void {
  walkTo(r, up ? e.xLow : e.xHigh);
  r.tap(up ? Btn.UP : Btn.DOWN);
  must(modeOf(r) === 'escalator', `${e.id}: could not board`);
  r.hold(0, 60);
  must(r.w.player.floor === (up ? e.upper : e.lower), `${e.id}: did not arrive`);
}

/** Move to a floor from the current floor using whichever shaft / escalator is right (R -> everything). */
export function goToFloor(r: BotRig, to: number): void {
  const here = (): number => r.w.player.floor!;
  if (here() === to) return;
  const shafts: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  for (const id of shafts) {
    const s = SHAFTS.find((k) => k.id === id)!;
    if (here() >= s.top && here() <= s.bottom && to >= s.top && to <= s.bottom) {
      ride(r, id, to);
      return;
    }
  }
  // two hops: go to a floor served by both
  for (const a of SHAFTS) {
    if (!(here() >= a.top && here() <= a.bottom)) continue;
    for (const b of SHAFTS) {
      if (!(to >= b.top && to <= b.bottom)) continue;
      const lo = Math.max(a.top, b.top);
      const hi = Math.min(a.bottom, b.bottom);
      if (lo <= hi) {
        ride(r, a.id, lo);
        ride(r, b.id, to);
        return;
      }
    }
  }
  throw new BotError(`no route from ${here()} to ${to}`);
}

/** Walk to a store's door and press Up. */
export function enterStoreDoor(r: BotRig, id: StoreId): void {
  const st = storeDef(id);
  goToFloor(r, st.floor);
  walkTo(r, st.x + DOOR_X + DOOR_W / 2);
  r.tap(Btn.UP);
}

// ---------------------------------------------------------------- stores
type Cell = { col: number; row: number };

function walkable(room: Room, col: number, row: number): boolean {
  return !isSolidKind(tileAt(room, col, row));
}

/** BFS over the room's tiles (4-neighbour). Returns the path including start and goal, or null. */
export function tilePath(room: Room, from: Cell, goal: (c: Cell) => boolean): Cell[] | null {
  const key = (c: Cell): number => c.row * room.cols + c.col;
  const prev = new Map<number, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    if (goal(c)) {
      const path: Cell[] = [];
      for (let k: Cell | null = c; k; k = prev.get(key(k)) ?? null) path.unshift(k);
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { col: c.col + dc, row: c.row + dr };
      if (n.col < 0 || n.row < 0 || n.col >= room.cols || n.row >= room.rows) continue;
      if (!walkable(room, n.col, n.row) || prev.has(key(n))) continue;
      prev.set(key(n), c);
      queue.push(n);
    }
  }
  return null;
}

export interface StoreBot {
  readonly world: StoreWorld;
  hold(held: number, n?: number): void;
  tap(btn: number): void;
}

const cellOf = (x: number, y: number): Cell => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });

function waitFree(b: StoreBot, max = 400): void {
  for (let i = 0; i < max; i++) {
    const a = b.world.agent;
    if (a.stun <= 0 && !a.hold && !b.world.typewriter && b.world.search === null) return;
    b.hold(0, 1);
  }
}

function walkPath(b: StoreBot, path: Cell[]): void {
  for (const c of path.slice(1)) {
    const tx = c.col * TILE + TILE / 2;
    const ty = c.row * TILE + TILE / 2;
    for (let i = 0; i < 80; i++) {
      const a = b.world.agent;
      if (b.world.exited) return;
      if (a.stun > 0 || a.hold) {
        b.hold(0, 1);
        continue;
      }
      const dx = tx - a.x;
      const dy = ty - a.y;
      if (Math.abs(dx) <= 1.2 && Math.abs(dy) <= 1.2) break;
      if (Math.abs(dy) > 1.2 && Math.abs(dx) <= 3) b.hold(dy > 0 ? Btn.DOWN : Btn.UP, 1);
      else if (Math.abs(dx) > 1.2) b.hold(dx > 0 ? Btn.RIGHT : Btn.LEFT, 1);
      else b.hold(dy > 0 ? Btn.DOWN : Btn.UP, 1);
    }
  }
  b.hold(0, 1);
}

/**
 * Search the store like a player: walk next to each fixture (nearest first), tap B once, wait for the result,
 * until the package is found; then walk out of the door. Returns true when the package was taken.
 */
export function searchStoreForPackage(b: StoreBot): boolean {
  const w = b.world;
  const room = w.room;
  const order = [...room.fixtures].sort((p, q) => {
    const a = cellOf(w.agent.x, w.agent.y);
    return Math.abs(p.col - a.col) + Math.abs(p.row - a.row) - (Math.abs(q.col - a.col) + Math.abs(q.row - a.row));
  });
  for (const f of order) {
    if (w.store.packageTaken || w.exited) break;
    if (w.store.fixtures[f.index]!.opened) continue;
    waitFree(b);
    const here = cellOf(w.agent.x, w.agent.y);
    const path = tilePath(room, here, (c) => Math.abs(c.col - f.col) + Math.abs(c.row - f.row) === 1 && walkable(room, c.col, c.row));
    if (!path) continue;
    walkPath(b, path);
    // face the fixture with a fresh press, then tap B (the world also auto-faces touching fixtures)
    const last = path[path.length - 1]!;
    const toward = f.col > last.col ? Btn.RIGHT : f.col < last.col ? Btn.LEFT : f.row > last.row ? Btn.DOWN : Btn.UP;
    b.hold(toward, 2);
    b.hold(0, 1);
    b.tap(Btn.B);
    for (let i = 0; i < 90 && w.search !== null; i++) b.hold(0, 1);
    b.hold(0, 4);
    waitFree(b, 600);
  }
  return w.store.packageTaken;
}

/** Walk out of the door at the bottom of the room. */
export function leaveStore(b: StoreBot): void {
  const w = b.world;
  waitFree(b, 600);
  const door = w.room.door;
  const here = cellOf(w.agent.x, w.agent.y);
  const path = tilePath(w.room, here, (c) => c.row === door.row && c.col === door.col);
  if (path) walkPath(b, path);
  for (let i = 0; i < 120 && !w.exited; i++) b.hold(Btn.DOWN, 1);
  must(w.exited, 'could not leave the store');
}

// ---------------------------------------------------------------- a bot that plays stores like a sensible human
const DIR_BTN = { up: Btn.UP, down: Btn.DOWN, left: Btn.LEFT, right: Btn.RIGHT } as const;
type Dir4 = keyof typeof DIR_BTN;

function lineClear(room: Room, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
  for (let i = 1; i < steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    if (isSolidKind(tileAt(room, Math.floor(x / TILE), Math.floor(y / TILE)))) return false;
  }
  return true;
}

/**
 * One frame of reflexes: sidestep out of a guard's aim line / an incoming bullet, and shoot a guard that is lined up.
 * Returns the buttons to hold this frame, or null when nothing needs doing.
 */
function reflexes(b: StoreBot): number | null {
  const w = b.world;
  const a = w.agent;
  const room = w.room;
  // danger: an aiming spy whose line passes through us, or an enemy bullet heading at us
  for (const g of w.guards) {
    if (g.dead || g.kind !== 'spy' || g.aim <= 0) continue;
    const horiz = g.aimDir === 'left' || g.aimDir === 'right';
    const onLine = horiz ? Math.abs(g.y - a.y) < 11 : Math.abs(g.x - a.x) < 11;
    const ahead = horiz ? (g.aimDir === 'right' ? a.x > g.x : a.x < g.x) : g.aimDir === 'down' ? a.y > g.y : a.y < g.y;
    if (onLine && ahead) {
      const sides: Dir4[] = horiz ? ['up', 'down'] : ['left', 'right'];
      for (const s of sides) {
        const v = s === 'up' ? [0, -1] : s === 'down' ? [0, 1] : s === 'left' ? [-1, 0] : [1, 0];
        const tx = a.x + v[0]! * 12;
        const ty = a.y + v[1]! * 12;
        if (!isSolidKind(tileAt(room, Math.floor(tx / TILE), Math.floor(ty / TILE)))) return DIR_BTN[s];
      }
    }
  }
  for (const bl of w.bullets) {
    if (bl.kind !== 'enemy') continue;
    const horiz = Math.abs(bl.vx) > Math.abs(bl.vy);
    const onLine = horiz ? Math.abs(bl.y - a.y) < 9 : Math.abs(bl.x - a.x) < 9;
    const toward = horiz ? (bl.x - a.x) * bl.vx < 0 && Math.abs(bl.x - a.x) < 56 : (bl.y - a.y) * bl.vy < 0 && Math.abs(bl.y - a.y) < 56;
    if (onLine && toward) return horiz ? (a.y > room.rows * TILE / 2 ? Btn.UP : Btn.DOWN) : Btn.LEFT;
  }
  // offence: a guard lined up within range and in the clear: face it and fire
  for (const g of w.guards) {
    if (g.dead) continue;
    const dx = g.x - a.x;
    const dy = g.y - a.y;
    const horiz = Math.abs(dy) < 7 && Math.abs(dx) < 150;
    const vert = Math.abs(dx) < 7 && Math.abs(dy) < 120;
    if (!(horiz || vert) || !lineClear(room, a.x, a.y, g.x, g.y)) continue;
    const want: Dir4 = horiz ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (a.facing !== want) return DIR_BTN[want]; // turn toward him (a step, then we fire)
    return Btn.A;
  }
  return null;
}

/**
 * Play a store with reflexes: go for the nearest unsearched fixture, tap B beside it, react to danger every frame.
 * Returns true when the package was taken. Gives up after `maxFrames`.
 */
export function playStoreSmart(b: StoreBot, maxFrames = 4000): boolean {
  const w = b.world;
  const room = w.room;
  let t = 0;
  while (t < maxFrames && !w.exited && !w.died && !w.store.packageTaken) {
    const a = w.agent;
    if (a.stun > 0 || a.hold || w.typewriter || w.search !== null || a.dying > 0) {
      b.hold(0, 1);
      t++;
      continue;
    }
    const r = reflexes(b);
    if (r !== null) {
      b.hold(r, 1);
      t++;
      continue;
    }
    const here = cellOf(a.x, a.y);
    const targets = room.fixtures.filter((f) => !w.store.fixtures[f.index]!.opened);
    let best: { path: Cell[]; f: (typeof targets)[number] } | null = null;
    for (const f of targets) {
      const path = tilePath(room, here, (c) => Math.abs(c.col - f.col) + Math.abs(c.row - f.row) === 1 && walkable(room, c.col, c.row));
      if (path && (!best || path.length < best.path.length)) best = { path, f };
    }
    if (!best) break;
    const { path, f } = best;
    if (path.length === 1 || (path.length === 2 && Math.hypot(a.x - (path[1]!.col * TILE + 8), a.y - (path[1]!.row * TILE + 8)) < 2)) {
      // beside the fixture: face it, tap B, wait for the search
      const toward: Dir4 = f.col > here.col ? 'right' : f.col < here.col ? 'left' : f.row > here.row ? 'down' : 'up';
      b.hold(DIR_BTN[toward], 2);
      b.hold(0, 1);
      b.tap(Btn.B);
      for (let i = 0; i < 90 && w.search !== null; i++) {
        const rr = reflexes(b);
        b.hold(rr !== null && rr !== Btn.A ? rr : 0, 1);
      }
      t += 100;
      continue;
    }
    const next = path[1]!;
    const tx = next.col * TILE + TILE / 2;
    const ty = next.row * TILE + TILE / 2;
    const dx = tx - a.x;
    const dy = ty - a.y;
    if (Math.abs(dx) > 1.2 && (Math.abs(dy) <= 3 || Math.abs(dx) > Math.abs(dy))) b.hold(dx > 0 ? Btn.RIGHT : Btn.LEFT, 1);
    else b.hold(dy > 0 ? Btn.DOWN : Btn.UP, 1);
    t++;
  }
  return w.store.packageTaken;
}
