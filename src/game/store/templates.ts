// Ten hand-designed 16x11 rooms, one per open store. Chars: see tilekinds.ts. Door 'd' at bottom centre (row 10, col 8).
// Guard starts are tile (col,row). Bots are listed early so a store's first-visit bot line always has a bot.
import type { OpenStoreId } from '../../core/events';
import type { StoreTemplate } from './types';

const R = (rows: string[]): string[] => rows;

export const TEMPLATES: Readonly<Record<OpenStoreId, StoreTemplate>> = {
  // Fitting rooms along the top wall (F), clothing racks, a cash counter and mannequins.
  forever12: {
    rows: R([
      '################',
      '#..F.F....F.F..#',
      '#..............#',
      '#.S..T.DD.T..S.#',
      '#..............#',
      '#....S....S....#',
      '#..............#',
      '#.CCCC.....DD..#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 12, row: 6 },
      { type: 'spy', col: 3, row: 6 },
      { type: 'spy', col: 8, row: 2 },
    ],
  },
  // Shelf wall on top, central service counter, one patrolling bot.
  radioshock: {
    rows: R([
      '################',
      '#.S.T.S..S.T.S.#',
      '#..............#',
      '#.E..........E.#',
      '#..............#',
      '#.S..CCCCCC..S.#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 4, row: 4 },
      { type: 'bot', col: 2, row: 6, axis: 'h' },
      { type: 'spy', col: 12, row: 4 },
    ],
  },
  // Power-up shop: massage chairs (decor) in the middle, gadget pedestals.
  crookstone: {
    rows: R([
      '################',
      '#..............#',
      '#.S.T..EE..T.S.#',
      '#..............#',
      '#.D..........D.#',
      '#....T....T....#',
      '#..............#',
      '#.CCC......CCC.#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [{ type: 'spy', col: 8, row: 4 }],
  },
  // Power-up shop, Zelda-cave easter egg: clerk between two demo TVs (V), pedestal P in front.
  gamestonk: {
    rows: R([
      '################',
      '#..............#',
      '#.S.T..V.V.T.S.#',
      '#..............#',
      '#......CPC.....#',
      '#.S..........S.#',
      '#....T....T....#',
      '#..............#',
      '#.D..........D.#',
      '#..............#',
      '########d#######',
    ]),
    guards: [{ type: 'spy', col: 12, row: 7 }],
  },
  // Toy shelves (K) that release wind-up toys when shot, bins to search.
  kgbtoys: {
    rows: R([
      '################',
      '#KKK..S..S..KKK#',
      '#..............#',
      '#.T..D....D..T.#',
      '#..............#',
      '#.S...T..T...S.#',
      '#..............#',
      '#.K..........K.#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 4, row: 4 },
      { type: 'spy', col: 11, row: 4 },
      { type: 'spy', col: 5, row: 7 },
    ],
  },
  // Novelty (black-light) power-up shop.
  spendersgifts: {
    rows: R([
      '################',
      '#..S..E..E..S..#',
      '#..............#',
      '#.T.....CC...T.#',
      '#..............#',
      '#.S..D....D..S.#',
      '#..............#',
      '#...T......T...#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [{ type: 'spy', col: 8, row: 5 }],
  },
  // Record bins, tape racks and a listening booth (B) top centre.
  sambaddy: {
    rows: R([
      '################',
      '#S.S.S..B..S.S.#',
      '#..............#',
      '#..T........T..#',
      '#..............#',
      '#.E..S....S..E.#',
      '#..............#',
      '#.CCC......CCC.#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 4, row: 4 },
      { type: 'spy', col: 11, row: 6 },
      { type: 'spy', col: 5, row: 7 },
    ],
  },
  // Power-up shop, gadgets with a different layout than Crookstone; a lone patrolling bot.
  sharperimagine: {
    rows: R([
      '################',
      '#.E..........E.#',
      '#..S...TT....S.#',
      '#..............#',
      '#.C..S....S..C.#',
      '#..............#',
      '#.T....DD....T.#',
      '#..............#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [{ type: 'bot', col: 2, row: 5, axis: 'h' }],
  },
  // Food court: kitchen counter, tables, crates.
  hotspy: {
    rows: R([
      '################',
      '#S.S.CCCCCC.S.S#',
      '#..............#',
      '#.T..DD..DD..T.#',
      '#..............#',
      '#.S..E....E..S.#',
      '#..............#',
      '#..T........T..#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 4, row: 4 },
      { type: 'spy', col: 11, row: 6 },
      { type: 'spy', col: 8, row: 2 },
    ],
  },
  // Shoe walls along the top, benches in the middle.
  footlockpicker: {
    rows: R([
      '################',
      '#S.S.S....S.S.S#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#....DDDDDD....#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '#..............#',
      '########d#######',
    ]),
    guards: [
      { type: 'spy', col: 3, row: 4 },
      { type: 'spy', col: 12, row: 4 },
      { type: 'spy', col: 6, row: 6 },
    ],
  },
};

/** A trivial empty room used only when a closed/unknown store id is refused. */
export const EMPTY_TEMPLATE: StoreTemplate = {
  rows: [
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '########d#######',
  ],
  guards: [],
};
