import { StoreId } from './copy';

/**
 * Top-down store rooms. Each template lists ONLY the interior (rows of `W-2` chars); `buildRoom` wraps it in
 * walls and cuts the 2-tile door at the bottom centre. Rooms can be any size: the renderer scrolls a camera
 * when a room is bigger than the 256x176 viewport (future anchor department stores).
 *
 * Legend:  .  floor            #  wall (added by the builder)
 *          f  searchable fixture (rack / shelf / bin ... themed)
 *          F  fitting room (Forever 12)      T  toy shelf (KGB Toys, shootable)
 *          c  counter (solid)                o  decor (solid)
 *          b  listening booth pad (Sam Baddy, walkable)
 *          v  demo TV (solid)  K  clerk (GameStonk)  e  pedestal (walkable trigger)
 *          S  spy start        B  security bot start
 */
export type Theme = 'fashion' | 'electronics' | 'toys' | 'food' | 'sports' | 'music' | 'gadgets' | 'novelty' | 'games';
export const THEMES: Theme[] = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'];

export const TILE = 16;
export const ROOM_W = 16;
export const ROOM_H = 11;

export interface StoreTemplate {
  id: StoreId;
  theme: Theme;
  /** Interior rows (each `w-2` chars, `h-2` rows). */
  interior: string[];
  /** Bot patrol axis. */
  botAxis?: 'h' | 'v';
}

export const TEMPLATES: Partial<Record<StoreId, StoreTemplate>> = {
  forever12: {
    id: 'forever12',
    theme: 'fashion',
    interior: [
      '.f.f.F....F.f.',
      '..S........S..',
      '.o..........o.',
      '.f..........f.',
      '.f...cccc....f',
      '..............',
      '.f..........f.',
      '..o........o..',
      '..............',
    ],
  },
  radioshock: {
    id: 'radioshock',
    theme: 'electronics',
    botAxis: 'h',
    interior: [
      '.f.f.f..f.f.f.',
      '..............',
      '.....B........',
      '.f..........f.',
      '.f..S.......f.',
      '.c..........c.',
      '.f..........f.',
      '.f...oooo...f.',
      '..............',
    ],
  },
  kgbtoys: {
    id: 'kgbtoys',
    theme: 'toys',
    interior: [
      '.T.T.T....T.T.',
      '..............',
      '..S........S..',
      '.f..........f.',
      '.f...oooo...f.',
      '..............',
      '.f..........f.',
      '.T..........T.',
      '..............',
    ],
  },
  hotspy: {
    id: 'hotspy',
    theme: 'food',
    interior: [
      '.f..f..f..f..f',
      '..............',
      '...cccccccc...',
      '..............',
      '.f....S.....f.',
      '.f..........f.',
      '...cccccccc...',
      '..............',
      '.f..........f.',
    ],
  },
  footlock: {
    id: 'footlock',
    theme: 'sports',
    interior: [
      '.ffff....ffff.',
      '..............',
      '..S........S..',
      '.....cccc.....',
      '.f..........f.',
      '.f...oooo...f.',
      '.f..........f.',
      '..............',
      '.o..........o.',
    ],
  },
  sambaddy: {
    id: 'sambaddy',
    theme: 'music',
    botAxis: 'h',
    interior: [
      '.f.f.f..f.f.f.',
      '..............',
      '..B...........',
      '.f..........f.',
      '.f....S.....f.',
      '..............',
      '.bb........cc.',
      '.o..........o.',
      '..............',
    ],
  },
  crookstone: {
    id: 'crookstone',
    theme: 'gadgets',
    interior: [
      '..f..f....f..f',
      '..............',
      '.o....S.....o.',
      '.f..........f.',
      '....oo..oo....',
      '.f..........f.',
      '..............',
      '..f........f..',
      '..............',
    ],
  },
  sharper: {
    id: 'sharper',
    theme: 'gadgets',
    botAxis: 'v',
    interior: [
      'f..f..f..f..f.',
      '..............',
      '..cc........cc',
      '..............',
      '.f....B.....f.',
      '..............',
      '..cc........cc',
      '.f..........f.',
      '..f........f..',
    ],
  },
  spenders: {
    id: 'spenders',
    theme: 'novelty',
    interior: [
      '.f..f..ff..f..',
      '..............',
      '.o....S.....o.',
      '.f..........f.',
      '.f...cccc...f.',
      '..............',
      '.f..........f.',
      '..o........o..',
      '..............',
    ],
  },
  gamestonk: {
    id: 'gamestonk',
    theme: 'games',
    interior: [
      '.f.f..vKv..f.f',
      '.......e......',
      '..S...........',
      '.f..........f.',
      '.f...cccc...f.',
      '..............',
      '.f..........f.',
      '..............',
      '..o........o..',
    ],
  },
};

/** Stores that have a room (the 10 open ones). */
export const OPEN_STORES = Object.keys(TEMPLATES) as StoreId[];

export interface RoomTile {
  ch: string;
}

export interface Room {
  id: StoreId;
  theme: Theme;
  w: number;
  h: number;
  /** Full grid including walls, rows of chars. */
  tiles: string[];
  /** Door tile columns on the bottom row. */
  doorCols: number[];
  spawn: { x: number; y: number }; // pixel position of the player's top-left at entry
  fixtures: { col: number; row: number; kind: 'f' | 'F' | 'T' }[];
  spies: { col: number; row: number }[];
  bots: { col: number; row: number; axis: 'h' | 'v' }[];
  booth: { col: number; row: number }[];
  clerk?: { col: number; row: number };
  pedestal?: { col: number; row: number };
}

const SOLID = new Set(['#', 'f', 'F', 'T', 'c', 'o', 'v', 'K']);
export function isSolidChar(ch: string): boolean {
  return SOLID.has(ch);
}

/** Wrap an interior in walls and extract entities. Works for any size. */
export function buildRoom(tpl: StoreTemplate): Room {
  const h = tpl.interior.length + 2;
  const w = tpl.interior[0].length + 2;
  const tiles: string[] = [];
  const room: Room = {
    id: tpl.id,
    theme: tpl.theme,
    w,
    h,
    tiles,
    doorCols: [],
    spawn: { x: 0, y: 0 },
    fixtures: [],
    spies: [],
    bots: [],
    booth: [],
  };
  tiles.push('#'.repeat(w));
  tpl.interior.forEach((row, ri) => {
    if (row.length !== w - 2) throw new Error(`${tpl.id}: row ${ri} has ${row.length} chars, expected ${w - 2}`);
    let out = '#';
    for (let ci = 0; ci < row.length; ci++) {
      const ch = row[ci];
      const col = ci + 1;
      const r = ri + 1;
      switch (ch) {
        case 'f':
        case 'F':
        case 'T':
          room.fixtures.push({ col, row: r, kind: ch });
          out += ch;
          break;
        case 'S':
          room.spies.push({ col, row: r });
          out += '.';
          break;
        case 'B':
          room.bots.push({ col, row: r, axis: tpl.botAxis ?? 'h' });
          out += '.';
          break;
        case 'b':
          room.booth.push({ col, row: r });
          out += 'b';
          break;
        case 'K':
          room.clerk = { col, row: r };
          out += 'K';
          break;
        case 'e':
          room.pedestal = { col, row: r };
          out += 'e';
          break;
        default:
          out += ch;
      }
    }
    out += '#';
    tiles.push(out);
  });
  // bottom wall with a 2-tile door at the centre
  const mid = Math.floor(w / 2);
  room.doorCols = [mid - 1, mid];
  let bottom = '';
  for (let c = 0; c < w; c++) bottom += room.doorCols.includes(c) ? 'D' : '#';
  tiles.push(bottom);
  room.spawn = { x: room.doorCols[0] * TILE + TILE / 2, y: (h - 2) * TILE };
  return room;
}

const ROOM_CACHE = new Map<StoreId, Room>();
export function roomFor(id: StoreId): Room {
  let r = ROOM_CACHE.get(id);
  if (!r) {
    const t = TEMPLATES[id];
    if (!t) throw new Error('store has no room: ' + id);
    r = buildRoom(t);
    ROOM_CACHE.set(id, r);
  }
  return r;
}
