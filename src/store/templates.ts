// Store room templates: 16 x 11 tiles of 16 px, door at the bottom centre.
// Legend:
//   # wall        . floor       D door (bottom centre, walkable)   F searchable fixture (solid)
//   L fitting room (a fixture; searching it can wake a spy)        C counter (solid)
//   R rack (solid decor)        T TV / screen (solid decor)        S toy shelf (solid, shoot it)
//   B listening booth (walkable trigger)                           P pedestal (walkable; easter egg)
//   K clerk (walkable spawn for the easter egg)                    G guard spawn (walkable)
import type { StoreTheme } from '../mall/layout';

export const TILE = 16;
export const ROOM_COLS = 16;
export const ROOM_ROWS = 11;

export interface StoreTemplate {
  id: string;
  theme: StoreTheme;
  rows: readonly string[];
  /** Kinds of guard to place; one entry per guard (1 to 3). */
  guards: readonly ('spy' | 'bot')[];
}

export const TEMPLATES: Record<string, StoreTemplate> = {
  forever12: {
    id: 'forever12',
    theme: 'fashion',
    guards: ['spy', 'spy'],
    rows: [
      '################',
      '#L.L..RRR..L.L.#',
      '#..............#',
      '#.F..F...F..F..#',
      '#..............#',
      '#..G.....G.....#',
      '#.RRR.......RRR#',
      '#..............#',
      '#.G..........G.#',
      '#..............#',
      '#######D########',
    ],
  },
  radioshock: {
    id: 'radioshock',
    theme: 'electronics',
    guards: ['bot', 'spy'],
    rows: [
      '################',
      '#TTTT..FF..TTTT#',
      '#..............#',
      '#.F....G....F..#',
      '#..CCCC..CCCC..#',
      '#..............#',
      '#.G.....F......#',
      '#..............#',
      '#F.............#',
      '#..............#',
      '#######D########',
    ],
  },
  crookstone: {
    id: 'crookstone',
    theme: 'gadgets',
    guards: ['bot'],
    rows: [
      '################',
      '#..............#',
      '#.F.F.....F.F..#',
      '#..............#',
      '#...G..........#',
      '#..RR....RR....#',
      '#..............#',
      '#.F....G.....F.#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
  gamestonk: {
    id: 'gamestonk',
    theme: 'games',
    guards: ['spy'],
    rows: [
      '################',
      '#TT..K..TT.....#',
      '#TT..........P.#',
      '#..............#',
      '#.F....G....F..#',
      '#..............#',
      '#.F......F.....#',
      '#..............#',
      '#...G..........#',
      '#..............#',
      '#######D########',
    ],
  },
  kgb: {
    id: 'kgb',
    theme: 'toys',
    guards: ['spy', 'spy', 'spy'],
    rows: [
      '################',
      '#..............#',
      '#.SSSS...SSSS..#',
      '#..............#',
      '#.F....G.....F.#',
      '#..............#',
      '#.SSSS...SSSS..#',
      '#..............#',
      '#.F....G.....F.#',
      '#..............#',
      '#######D########',
    ],
  },
  spenders: {
    id: 'spenders',
    theme: 'novelty',
    guards: ['spy'],
    rows: [
      '################',
      '#..............#',
      '#.F.F.....F.F..#',
      '#..............#',
      '#.....G........#',
      '#..............#',
      '#.F.F.....F.F..#',
      '#.........G....#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
  sambaddy: {
    id: 'sambaddy',
    theme: 'music',
    guards: ['spy', 'bot'],
    rows: [
      '################',
      '#..............#',
      '#.FF.....BB....#',
      '#.........BB...#',
      '#..............#',
      '#...G......F...#',
      '#.F............#',
      '#.........G....#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
  sharper: {
    id: 'sharper',
    theme: 'gadgets',
    guards: ['bot'],
    rows: [
      '################',
      '#..............#',
      '#.F......F.....#',
      '#..............#',
      '#.....G........#',
      '#.F..........F.#',
      '#..............#',
      '#...G......G...#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
  hotspy: {
    id: 'hotspy',
    theme: 'food',
    guards: ['spy', 'spy'],
    rows: [
      '################',
      '#CCCCCCCCCCCCCC#',
      '#..............#',
      '#.F.....G....F.#',
      '#..............#',
      '#..G.........G.#',
      '#..............#',
      '#.F....F.......#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
  footlock: {
    id: 'footlock',
    theme: 'sports',
    guards: ['spy', 'bot'],
    rows: [
      '################',
      '#RRRRRRRRRRRRRR#',
      '#..............#',
      '#.F....G....F..#',
      '#..............#',
      '#..RRRRR.RRRRR.#',
      '#..............#',
      '#.F..G.......F.#',
      '#..............#',
      '#..............#',
      '#######D########',
    ],
  },
};

/** Checks a template's shape. Returns a list of problems (empty when valid). */
export function checkTemplate(t: StoreTemplate): string[] {
  const problems: string[] = [];
  if (t.rows.length !== ROOM_ROWS) problems.push(`${t.id}: ${t.rows.length} rows`);
  t.rows.forEach((r, i) => {
    if (r.length !== ROOM_COLS) problems.push(`${t.id}: row ${i} has ${r.length} columns`);
  });
  const doors = t.rows.join('').split('').filter((c) => c === 'D').length;
  if (doors !== 1) problems.push(`${t.id}: ${doors} doors`);
  if (t.rows[ROOM_ROWS - 1][ROOM_COLS / 2 - 1] !== 'D') problems.push(`${t.id}: door not at bottom centre`);
  return problems;
}
