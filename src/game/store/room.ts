import type { StoreId } from '../../content/stores';
import { storeDef } from '../../content/stores';
import type { ThemeId } from '../../content/themes';

/**
 * Top-down store rooms: character-grid templates, their legend, the parsed `Room`
 * and a validator. Pure data + pure functions (no rng, no run state).
 *
 * LEGEND (one character per 16 px tile; every row of a template has the same length,
 * the grid may be any size; the door is always the 2 tiles at the bottom centre):
 *
 *   #  wall                      .  floor
 *   D  doorway (bottom row, the two centre tiles)   @  agent start (floor, directly above the door)
 *   s  shelf fixture    SEARCHABLE (st.<theme>.shelf / .shelf.open)
 *   r  rack fixture     SEARCHABLE (st.<theme>.rack / .rack.open)
 *   F  fitting room     SEARCHABLE (Forever 12; 25% chance of a spy when searched)
 *   c  counter (solid)  d  decor (solid)  V  demo TV (solid, GameStonk)
 *   T  toy shelf        solid, NOT searchable: shoot it to release 3 wind-up toys (KGB Toys)
 *   B  listening booth  walkable; standing on it switches the music (Sam Baddy)
 *   P  pedestal         walkable; the GameStonk easter-egg item stands on it (plain floor when the egg is not active)
 *   K  clerk spot       floor; the GameStonk easter-egg clerk stands here (absent when the egg is not active)
 *   y  spy spawn        floor
 *   b  security bot spawn, patrols left <-> right        v  security bot spawn, patrols up <-> down
 *
 * Searchable fixtures are numbered in reading order (rows top -> bottom, left -> right); that
 * number is the index into `StoreState.fixtures` (src/game/levelstate.ts).
 */
export const TILE = 16;

export type TileKind =
  | 'floor'
  | 'wall'
  | 'counter'
  | 'decor'
  | 'shelf'
  | 'rack'
  | 'fitting'
  | 'toyshelf'
  | 'booth'
  | 'tv'
  | 'pedestal'
  | 'door';

export type FixtureKind = 'shelf' | 'rack' | 'fitting';

const SOLID_KINDS: ReadonlySet<TileKind> = new Set<TileKind>(['wall', 'counter', 'decor', 'shelf', 'rack', 'fitting', 'toyshelf', 'tv']);

export function isSolidKind(k: TileKind): boolean {
  return SOLID_KINDS.has(k);
}

export interface FixtureSpot {
  /** Index into `StoreState.fixtures`. */
  index: number;
  col: number;
  row: number;
  kind: FixtureKind;
}

export interface GuardSpawn {
  kind: 'spy' | 'bot';
  col: number;
  row: number;
  /** Bots only: which way they patrol. */
  axis: 'h' | 'v';
}

export interface Cell {
  col: number;
  row: number;
}

export interface Room {
  id: string;
  theme: ThemeId;
  cols: number;
  rows: number;
  /** Row-major, `cols * rows` entries. */
  tiles: TileKind[];
  /** Searchable fixtures in reading order. */
  fixtures: FixtureSpot[];
  guards: GuardSpawn[];
  /** Left tile of the 2-tile doorway (always on the bottom row). */
  door: Cell;
  spawn: Cell;
  clerk: Cell | null;
  pedestal: Cell | null;
  toyShelves: Cell[];
  booths: Cell[];
}

export const DOOR_TILES = 2;

export function roomPxW(room: Room): number {
  return room.cols * TILE;
}
export function roomPxH(room: Room): number {
  return room.rows * TILE;
}

export function tileAt(room: Room, col: number, row: number): TileKind {
  if (col < 0 || row < 0 || col >= room.cols || row >= room.rows) return 'wall';
  return room.tiles[row * room.cols + col]!;
}

export function isDoorTile(room: Room, col: number, row: number): boolean {
  return row === room.door.row && col >= room.door.col && col < room.door.col + DOOR_TILES;
}

/** Walkable by guards, toys and bullets-that-must-not-leave: everything except solids and the doorway. */
export function guardWalkable(room: Room, col: number, row: number): boolean {
  const k = tileAt(room, col, row);
  return !isSolidKind(k) && k !== 'door';
}

const CHAR_TO_TILE: Readonly<Record<string, TileKind>> = {
  '#': 'wall',
  '.': 'floor',
  D: 'door',
  '@': 'floor',
  s: 'shelf',
  r: 'rack',
  F: 'fitting',
  c: 'counter',
  d: 'decor',
  V: 'tv',
  T: 'toyshelf',
  B: 'booth',
  P: 'pedestal',
  K: 'floor',
  y: 'floor',
  b: 'floor',
  v: 'floor',
};

/** Parse a character grid into a `Room`. Throws on ragged rows, unknown characters, or a missing/duplicate `@`. */
export function parseRoom(id: string, theme: ThemeId, rows: readonly string[]): Room {
  if (rows.length === 0) throw new Error(`room ${id}: empty template`);
  const cols = rows[0]!.length;
  const tiles: TileKind[] = [];
  const fixtures: FixtureSpot[] = [];
  const guards: GuardSpawn[] = [];
  const toyShelves: Cell[] = [];
  const booths: Cell[] = [];
  let door: Cell | null = null;
  let spawn: Cell | null = null;
  let clerk: Cell | null = null;
  let pedestal: Cell | null = null;
  rows.forEach((line, row) => {
    if (line.length !== cols) throw new Error(`room ${id}: row ${row} has ${line.length} chars, expected ${cols}`);
    for (let col = 0; col < cols; col++) {
      const ch = line[col]!;
      const kind = CHAR_TO_TILE[ch];
      if (kind === undefined) throw new Error(`room ${id}: unknown legend character '${ch}' at ${col},${row}`);
      tiles.push(kind);
      if (kind === 'shelf' || kind === 'rack' || kind === 'fitting') fixtures.push({ index: fixtures.length, col, row, kind });
      if (kind === 'toyshelf') toyShelves.push({ col, row });
      if (kind === 'booth') booths.push({ col, row });
      if (kind === 'door' && !door) door = { col, row };
      if (ch === '@') {
        if (spawn) throw new Error(`room ${id}: more than one '@'`);
        spawn = { col, row };
      }
      if (ch === 'K') clerk = { col, row };
      if (ch === 'P') pedestal = { col, row };
      if (ch === 'y') guards.push({ kind: 'spy', col, row, axis: 'h' });
      if (ch === 'b') guards.push({ kind: 'bot', col, row, axis: 'h' });
      if (ch === 'v') guards.push({ kind: 'bot', col, row, axis: 'v' });
    }
  });
  if (!spawn) throw new Error(`room ${id}: no '@' agent start`);
  if (!door) throw new Error(`room ${id}: no doorway 'D'`);
  return { id, theme, cols, rows: rows.length, tiles, fixtures, guards, door, spawn, clerk, pedestal, toyShelves, booths };
}

/** Distance (in tiles, 4-neighbour) from `from` over tiles that are not solid; -1 = unreachable. */
export function walkDistances(room: Room, from: Cell, allowDoor = true): Int16Array {
  const dist = new Int16Array(room.cols * room.rows).fill(-1);
  const q: number[] = [];
  const open = (c: number, r: number): boolean => {
    const k = tileAt(room, c, r);
    return !isSolidKind(k) && (allowDoor || k !== 'door');
  };
  if (!open(from.col, from.row)) return dist;
  dist[from.row * room.cols + from.col] = 0;
  q.push(from.row * room.cols + from.col);
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]!;
    const c = cur % room.cols;
    const r = Math.floor(cur / room.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= room.cols || nr >= room.rows) continue;
      const ni = nr * room.cols + nc;
      if (dist[ni] !== -1 || !open(nc, nr)) continue;
      dist[ni] = dist[cur]! + 1;
      q.push(ni);
    }
  }
  return dist;
}

export const MIN_FIXTURES = 4;
export const MAX_FIXTURES = 12;
/** Guards must start at least this many tiles (walking) from the agent's start. */
export const MIN_GUARD_DISTANCE = 4;

/** Every problem found with a room (empty = valid). Used by the template tests and by `getRoom`. */
export function validateRoom(room: Room): string[] {
  const problems: string[] = [];
  const { cols, rows } = room;
  if (cols < 8 || rows < 6) problems.push(`too small: ${cols}x${rows}`);
  // enclosed by walls, except the doorway
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) {
    const k = tileAt(room, c, r);
    if (k !== 'wall' && !(k === 'door' && r === rows - 1)) problems.push(`border (${c},${r}) is ${k}, expected wall`);
  }
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) {
    if (tileAt(room, c, r) !== 'wall') problems.push(`border (${c},${r}) is ${tileAt(room, c, r)}, expected wall`);
  }
  // door: exactly 2 tiles, bottom row, centred
  const doors: Cell[] = [];
  room.tiles.forEach((k, i) => {
    if (k === 'door') doors.push({ col: i % cols, row: Math.floor(i / cols) });
  });
  const wantCol = Math.floor(cols / 2) - 1;
  if (doors.length !== DOOR_TILES) problems.push(`expected ${DOOR_TILES} door tiles, found ${doors.length}`);
  else if (room.door.row !== rows - 1 || room.door.col !== wantCol) problems.push(`door must be bottom centre (col ${wantCol}), found ${room.door.col},${room.door.row}`);
  // the agent starts just above the door, on a free tile
  if (room.spawn.row !== rows - 2) problems.push(`spawn must be on the row above the door, found row ${room.spawn.row}`);
  if (tileAt(room, room.spawn.col, room.spawn.row) !== 'floor') problems.push('spawn tile is not floor');
  if (room.spawn.col < room.door.col || room.spawn.col >= room.door.col + DOOR_TILES) problems.push('spawn must be directly above the doorway');
  // fixtures
  if (room.fixtures.length < MIN_FIXTURES || room.fixtures.length > MAX_FIXTURES) problems.push(`fixture count ${room.fixtures.length} outside ${MIN_FIXTURES}..${MAX_FIXTURES}`);
  // reachability from the spawn: every non-solid tile, and a free neighbour for every fixture and toy shelf
  const dist = walkDistances(room, room.spawn);
  room.tiles.forEach((k, i) => {
    if (!isSolidKind(k) && dist[i] === -1) problems.push(`unreachable ${k} tile at ${i % cols},${Math.floor(i / cols)}`);
  });
  const reachableNeighbour = (c: number, r: number): boolean =>
    ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dc, dr]) => {
      const nc = c + dc;
      const nr = r + dr;
      return nc >= 0 && nr >= 0 && nc < cols && nr < rows && dist[nr * cols + nc]! >= 0 && tileAt(room, nc, nr) !== 'door';
    });
  for (const f of room.fixtures) if (!reachableNeighbour(f.col, f.row)) problems.push(`fixture ${f.index} at ${f.col},${f.row} cannot be reached`);
  for (const t of room.toyShelves) if (!reachableNeighbour(t.col, t.row)) problems.push(`toy shelf at ${t.col},${t.row} cannot be reached`);
  // guards
  if (room.guards.length < 1 || room.guards.length > 3) problems.push(`guard count ${room.guards.length} outside 1..3`);
  for (const g of room.guards) {
    if (tileAt(room, g.col, g.row) !== 'floor') problems.push(`guard spawn ${g.col},${g.row} is not on floor`);
    const d = dist[g.row * cols + g.col]!;
    if (d < MIN_GUARD_DISTANCE) problems.push(`guard spawn ${g.col},${g.row} is only ${d} tiles from the agent start`);
  }
  // doorway row above the door must be free so nobody is boxed in on entry
  for (let c = room.door.col; c < room.door.col + DOOR_TILES; c++) if (tileAt(room, c, rows - 2) !== 'floor') problems.push(`tile above the door at col ${c} is not floor`);
  return problems;
}

// ------------------------------------------------------------------ the 10 hand-designed rooms (16 x 11)
type OpenStoreId = 'forever12' | 'radioshock' | 'crookstone' | 'gamestonk' | 'kgbtoys' | 'spenders' | 'sambaddy' | 'sharper' | 'hotspy' | 'footlock';

// prettier-ignore
export const ROOM_GRIDS: Readonly<Record<OpenStoreId, readonly string[]>> = {
  // FOREVER 12 (fashion): a row of fitting rooms along the back wall, clothing racks, a checkout counter. 8 fixtures, 2 spies.
  forever12: [
    '################',
    '#.F..F..F..cccc#',
    '#..............#',
    '#..r..y..r.....#',
    '#..............#',
    '#.r..cc..cc..r.#',
    '#..............#',
    '#d..y......r..d#',
    '#..............#',
    '#......@.......#',
    '#######DD#######',
  ],
  // RADIOSHOCK (electronics): two long counters make a corridor that a security bot paces; shelves of parts on the walls. 7 fixtures, 1 spy + 1 bot.
  radioshock: [
    '################',
    '#.s.s.s....dd.d#',
    '#..............#',
    '#.cccc....cccc.#',
    '#s..b.........s#',
    '#dcccc....ccccd#',
    '#s............s#',
    '#..............#',
    '#...y.....dd...#',
    '#......@.......#',
    '#######DD#######',
  ],
  // KGB TOYS (toys): three toy shelves (shoot them!) along the back wall, play tables. 7 fixtures, 2 spies.
  kgbtoys: [
    '################',
    '#.T..T..T..s.s.#',
    '#..............#',
    '#.s.....y....s.#',
    '#..............#',
    '#..ddd....ddd.s#',
    '#..............#',
    '#.r........y.r.#',
    '#..............#',
    '#......@.......#',
    '#######DD#######',
  ],
  // SAM BADDY (music): record bins, a stage with speakers, the listening booth. 8 fixtures, 2 spies.
  sambaddy: [
    '################',
    '#.r.r.r....dddd#',
    '#..............#',
    '#..y.......BBr.#',
    '#..............#',
    '#.ccc...r..r...#',
    '#..............#',
    '#d.r......r...d#',
    '#..y...........#',
    '#......@.......#',
    '#######DD#######',
  ],
  // HOT SPY ON A STICK (food court): food stands and tables; a bot guards the back-right corner. 7 fixtures, 1 spy + 1 bot.
  hotspy: [
    '################',
    '#.s.s.s..ccccc.#',
    '#..............#',
    '#.dd...y...dd.r#',
    '#............v.#',
    '#.dd........dd.#',
    '#r.............#',
    '#.dd........dd.#',
    '#.s..........s.#',
    '#......@.......#',
    '#######DD#######',
  ],
  // FOOT LOCKPICKER (sports): shoe walls on both sides, benches, a patrolling bot. 7 fixtures, 2 spies + 1 bot.
  footlock: [
    '################',
    '#....cccccc....#',
    '#s............s#',
    '#..dd......dd..#',
    '#s............s#',
    '#..dd..r...dd..#',
    '#s....b.......s#',
    '#..............#',
    '#..y.......y...#',
    '#......@.......#',
    '#######DD#######',
  ],
  // CROOKSTONE (gadgets, lounge): massage-chair corners and a display table. 6 fixtures, 1 spy.
  crookstone: [
    '################',
    '#..ss......ss..#',
    '#..............#',
    '#..dd......dd..#',
    '#..dd......dd..#',
    '#......cc......#',
    '#..............#',
    '#.r..y.......r.#',
    '#..............#',
    '#......@.......#',
    '#######DD#######',
  ],
  // GAMESTONK (games): the easter-egg alcove (clerk between two TVs, pedestal below) on the back wall. 6 fixtures, 1 spy.
  gamestonk: [
    '################',
    '#.ss..VKV...ss.#',
    '#......P.......#',
    '#.....y........#',
    '#.dd........dd.#',
    '#.dd...cc...dd.#',
    '#..............#',
    '#.r..........r.#',
    '#..............#',
    '#......@.......#',
    '#######DD#######',
  ],
  // SPENDER'S GIFTS (novelty, black light): lava-lamp island and poster racks. 6 fixtures, 1 spy.
  spenders: [
    '################',
    '#.s.s.s....dd.d#',
    '#..............#',
    '#.d..y.........#',
    '#.d...cccc.....#',
    '#........r.....#',
    '#.r............#',
    '#.........r..d.#',
    '#..............#',
    '#......@.......#',
    '#######DD#######',
  ],
  // SHARPER IMAGINE (gadgets, clean showroom): a bot paces the middle aisle. 6 fixtures, 1 bot + 1 spy.
  sharper: [
    '################',
    '#..s........s..#',
    '#..............#',
    '#....cccccc....#',
    '#.r..........r.#',
    '#...b..........#',
    '#..............#',
    '#.s....dd....s.#',
    '#............y.#',
    '#......@.......#',
    '#######DD#######',
  ],
};

const ROOM_CACHE = new Map<string, Room>();

/** The parsed (and validated) hand-designed room of an open store. Throws for closed stores / invalid templates. */
export function getRoom(id: StoreId): Room {
  const hit = ROOM_CACHE.get(id);
  if (hit) return hit;
  const grid = (ROOM_GRIDS as Readonly<Record<string, readonly string[] | undefined>>)[id];
  const def = storeDef(id);
  if (!grid || !def.theme) throw new Error(`store ${id} has no room`);
  const room = parseRoom(id, def.theme, grid);
  const problems = validateRoom(room);
  if (problems.length) throw new Error(`room ${id} is invalid: ${problems.join('; ')}`);
  ROOM_CACHE.set(id, room);
  return room;
}

/** Number of searchable fixtures of an open store's room. */
export function fixtureCount(id: StoreId): number {
  return getRoom(id).fixtures.length;
}
