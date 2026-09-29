/**
 * Store rooms (top-down view). Rooms are tile grids of any size; the camera handles rooms bigger than one screen.
 *
 * Template legend:
 *   #  wall                 .  floor               D  door (bottom centre, walkable)
 *   F  searchable fixture   C  counter (solid)     d  decor (solid)
 *   R  fitting room (searchable; Forever 12)       T  toy shelf (searchable, shootable; KGB Toys)
 *   L  listening booth pad (walkable; Sam Baddy)   P  pedestal (walkable; GameStonk easter egg)
 *   K  clerk spot (GameStonk)                      V  demo TV (solid)
 *   s  spy guard start       b  bot, patrols left-right       v  bot, patrols up-down
 */
import type { StoreId } from '../art/manifest';

export const TILE = 16;

export const TEMPLATES: Partial<Record<StoreId, string[]>> = {
  forever12: [
    '################',
    '#RR.RR.RR...CCd#',
    '#.............s#',
    '#.FF..FF..FF...#',
    '#..............#',
    '#.FF..FF..FF...#',
    '#s.............#',
    '#...F.....F..d.#',
    '#d.............#',
    '#..............#',
    '#######DD#######',
  ],
  radioshock: [
    '################',
    '#FFFF.CCCC.FFFF#',
    '#..............#',
    '#.F..F....F..F.#',
    '#.F..F.s..F..F.#',
    '#..............#',
    '#.b............#',
    '#.FF..dd..FF...#',
    '#..............#',
    '#d............d#',
    '#######DD#######',
  ],
  crookstone: [
    '################',
    '#d.F..F..F..F.d#',
    '#..............#',
    '#.CCC......CCC.#',
    '#....F....F....#',
    '#.s............#',
    '#....F....F....#',
    '#.CCC......CCC.#',
    '#..............#',
    '#d............d#',
    '#######DD#######',
  ],
  gamestonk: [
    '################',
    '#FFF..VKV...FFF#',
    '#..............#',
    '#......P.......#',
    '#.F..........F.#',
    '#.F..........F.#',
    '#.F.......s..F.#',
    '#..............#',
    '#.CCCC....CCCC.#',
    '#d............d#',
    '#######DD#######',
  ],
  kgbtoys: [
    '################',
    '#TTT..FF..TTT..#',
    '#.............s#',
    '#.T..F....F..T.#',
    '#.T..F....F..T.#',
    '#..............#',
    '#s...TT..TT....#',
    '#..............#',
    '#.F..........F.#',
    '#d............d#',
    '#######DD#######',
  ],
  spenders: [
    '################',
    '#FF.d..FF..d.FF#',
    '#..............#',
    '#.F...CCC....F.#',
    '#.F..........F.#',
    '#......s.......#',
    '#.FF.F....F.FF.#',
    '#..............#',
    '#d.F........F.d#',
    '#..............#',
    '#######DD#######',
  ],
  sambaddy: [
    '################',
    '#FF.FF.dd.FF.FF#',
    '#..............#',
    '#.FF.FF..FF.LL.#',
    '#..........s...#',
    '#.FF.FF..FF....#',
    '#..............#',
    '#.CCC..b...CCC.#',
    '#..............#',
    '#d............d#',
    '#######DD#######',
  ],
  sharper: [
    '################',
    '#F.F.F.dd.F.F.F#',
    '#..............#',
    '#..FF.....FF...#',
    '#......b.......#',
    '#..FF.....FF...#',
    '#..............#',
    '#.CCCC....CCCC.#',
    '#.s............#',
    '#d............d#',
    '#######DD#######',
  ],
  hotspy: [
    '################',
    '#CCCCCC..CCCCCC#',
    '#.F..F....F..F.#',
    '#.......s......#',
    '#..FF......FF..#',
    '#..............#',
    '#.FF...dd...FF.#',
    '#..............#',
    '#..b...........#',
    '#d............d#',
    '#######DD#######',
  ],
  footlock: [
    '################',
    '#FFFFFF..FFFFFF#',
    '#..............#',
    '#.F.F.F..F.F.F.#',
    '#..........s...#',
    '#..s...........#',
    '#.FFF..dd..FFF.#',
    '#..............#',
    '#.F..........F.#',
    '#d............d#',
    '#######DD#######',
  ],
};

export type FixtureKind = 'fixture' | 'fitting' | 'toyshelf';
export interface Fixture {
  tx: number;
  ty: number;
  kind: FixtureKind;
}
export interface GuardStart {
  kind: 'spy' | 'bot';
  tx: number;
  ty: number;
  axis: 'h' | 'v';
}
export interface Room {
  w: number;
  h: number;
  /** Tile characters with spawn markers replaced by floor. */
  tiles: string[];
  fixtures: Fixture[];
  guards: GuardStart[];
  door: { tx: number; ty: number }[];
  /** Where the agent appears when walking in (pixel centre). */
  entry: { x: number; y: number };
  booth: { tx: number; ty: number }[];
  pedestal: { tx: number; ty: number } | null;
  clerk: { tx: number; ty: number } | null;
  tvs: { tx: number; ty: number }[];
}

const WALKABLE = new Set(['.', 'D', 'L', 'P']);
const SEARCHABLE: Record<string, FixtureKind> = { F: 'fixture', R: 'fitting', T: 'toyshelf' };

export function parseRoom(template: string[]): Room {
  const h = template.length;
  const w = template[0].length;
  const tiles: string[] = [];
  const fixtures: Fixture[] = [];
  const guards: GuardStart[] = [];
  const door: { tx: number; ty: number }[] = [];
  const booth: { tx: number; ty: number }[] = [];
  const tvs: { tx: number; ty: number }[] = [];
  let pedestal: Room['pedestal'] = null;
  let clerk: Room['clerk'] = null;
  template.forEach((row, ty) => {
    if (row.length !== w) throw new Error(`room row ${ty} has width ${row.length}, expected ${w}`);
    let out = '';
    for (let tx = 0; tx < w; tx++) {
      const ch = row[tx];
      if (ch === 's') guards.push({ kind: 'spy', tx, ty, axis: 'h' });
      else if (ch === 'b') guards.push({ kind: 'bot', tx, ty, axis: 'h' });
      else if (ch === 'v') guards.push({ kind: 'bot', tx, ty, axis: 'v' });
      else if (ch === 'D') door.push({ tx, ty });
      else if (ch === 'L') booth.push({ tx, ty });
      else if (ch === 'P') pedestal = { tx, ty };
      else if (ch === 'K') clerk = { tx, ty };
      else if (ch === 'V') tvs.push({ tx, ty });
      if (SEARCHABLE[ch]) fixtures.push({ tx, ty, kind: SEARCHABLE[ch] });
      out += 'sbv'.includes(ch) ? '.' : ch;
    }
    tiles.push(out);
  });
  if (door.length === 0) throw new Error('room has no door');
  const dx = (door[0].tx + door[door.length - 1].tx + 1) / 2;
  const entry = { x: dx * TILE, y: (door[0].ty - 1) * TILE + TILE / 2 };
  return { w, h, tiles, fixtures, guards, door, entry, booth, pedestal, clerk, tvs };
}

export function tileAt(room: Room, tx: number, ty: number): string {
  if (ty < 0 || ty >= room.h || tx < 0 || tx >= room.w) return '#';
  return room.tiles[ty][tx];
}

export function isWalkableChar(ch: string): boolean {
  return WALKABLE.has(ch);
}

/** Solid for movement. The clerk spot is solid only while the clerk stands there. */
export function isSolid(room: Room, tx: number, ty: number, clerkPresent = false): boolean {
  const ch = tileAt(room, tx, ty);
  if (ch === 'K') return clerkPresent;
  return !WALKABLE.has(ch);
}

export function fixtureIndexAt(room: Room, tx: number, ty: number): number {
  return room.fixtures.findIndex((f) => f.tx === tx && f.ty === ty);
}

/** Tiles reachable on foot from the entry (4-neighbour BFS over walkable tiles). */
export function reachableTiles(room: Room): Set<string> {
  const start = { tx: Math.floor(room.entry.x / TILE), ty: Math.floor(room.entry.y / TILE) };
  const seen = new Set<string>([`${start.tx},${start.ty}`]);
  const q = [start];
  while (q.length) {
    const { tx, ty } = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || isSolid(room, nx, ny, true)) continue;
      seen.add(k);
      q.push({ tx: nx, ty: ny });
    }
  }
  return seen;
}

/** Validation used by tests: returns a list of problems (empty = valid). */
export function validateRoom(room: Room): string[] {
  const errs: string[] = [];
  for (let tx = 0; tx < room.w; tx++) {
    if (tileAt(room, tx, 0) !== '#') errs.push(`top wall open at ${tx}`);
    const b = tileAt(room, tx, room.h - 1);
    if (b !== '#' && b !== 'D') errs.push(`bottom wall open at ${tx}`);
  }
  for (let ty = 0; ty < room.h; ty++) {
    if (tileAt(room, 0, ty) !== '#' || tileAt(room, room.w - 1, ty) !== '#') errs.push(`side wall open at row ${ty}`);
  }
  if (!room.door.every((d) => d.ty === room.h - 1)) errs.push('door not on bottom wall');
  const mid = room.w / 2;
  const cols = room.door.map((d) => d.tx);
  if (!(cols.includes(Math.floor(mid)) || cols.includes(Math.ceil(mid) - 1))) errs.push('door not centred');
  const reach = reachableTiles(room);
  for (const f of room.fixtures) {
    const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(`${f.tx + dx},${f.ty + dy}`));
    if (!ok) errs.push(`fixture at ${f.tx},${f.ty} unreachable`);
  }
  for (const g of room.guards) if (!reach.has(`${g.tx},${g.ty}`)) errs.push(`guard at ${g.tx},${g.ty} unreachable`);
  if (room.pedestal && !reach.has(`${room.pedestal.tx},${room.pedestal.ty}`)) errs.push('pedestal unreachable');
  if (room.guards.length < 1 || room.guards.length > 3) errs.push(`guard count ${room.guards.length} not in 1..3`);
  if (room.fixtures.length < 1) errs.push('no searchable fixtures');
  return errs;
}

const cache = new Map<string, Room>();
export function roomFor(id: StoreId): Room {
  let r = cache.get(id);
  if (!r) {
    const t = TEMPLATES[id];
    if (!t) throw new Error(`store ${id} has no room`);
    r = parseRoom(t);
    cache.set(id, r);
  }
  return r;
}
