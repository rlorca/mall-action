import { FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_4F } from './constants';

/**
 * The 13 storefronts, their roles, and the top-down room behind each open door.
 *
 * All names are puns. Never use a real logo, trade dress or exact brand name.
 */

export type StoreRole = 'target' | 'powerup' | 'closed';

export type RoomTheme =
  | 'fashion'
  | 'electronics'
  | 'toys'
  | 'foodcourt'
  | 'sports'
  | 'music'
  | 'gadgets'
  | 'novelty'
  | 'games';

/** What a storefront window shows. The display must read without the sign. */
export type WindowDisplay =
  | 'mannequins'
  | 'clothingRack'
  | 'tvStatic'
  | 'walkieTalkies'
  | 'massageChair'
  | 'gadgetPedestals'
  | 'consoleStack'
  | 'rocketPoster'
  | 'teddyBears'
  | 'robotRocket'
  | 'forLease'
  | 'vhsPoster'
  | 'lavaLamp'
  | 'plasmaBall'
  | 'tapesVinyl'
  | 'boombox'
  | 'robotVacuum'
  | 'glowingOrb'
  | 'lemonadeTub'
  | 'cornDogs'
  | 'deadTvs'
  | 'sneakerWall'
  | 'basketballs'
  | 'closingSale';

export interface StoreDef {
  id: string;
  /** Shown on the storefront sign and the store HUD marquee. */
  name: string;
  floor: number;
  /** Left edge in mall pixels. Storefronts are STOREFRONT_W wide. */
  x: number;
  role: StoreRole;
  /** Left and right window displays. */
  windows: readonly [WindowDisplay, WindowDisplay];
  /** Only meaningful for open stores. */
  theme?: RoomTheme;
  /** Music track id for the room. */
  music?: string;
  /** Tile layout, ROOM_H rows of ROOM_W chars. Only for open stores. */
  layout?: readonly string[];
}

export const STOREFRONT_W = 80;

/**
 * Room tile legend:
 *   '#' wall (solid)          '.' floor (walkable)
 *   'F' searchable fixture    'C' counter (solid, not searchable)
 *   'D' decor (solid)         'o' door (walkable, exits to the mall)
 *   'R' fitting room (searchable; Forever 12 special)
 *   'T' toy shelf (searchable; KGB Toys special, releases wind-up toys if shot)
 *   'L' listening booth (walkable; Sam Baddy special)
 *   'P' pedestal (walkable; GameStonk easter-egg item lands here)
 */
export const TILE_WALL = '#';
export const TILE_FLOOR = '.';
export const TILE_FIXTURE = 'F';
export const TILE_COUNTER = 'C';
export const TILE_DECOR = 'D';
export const TILE_DOOR = 'o';
export const TILE_FITTING = 'R';
export const TILE_TOYSHELF = 'T';
export const TILE_BOOTH = 'L';
export const TILE_PEDESTAL = 'P';

/** Tiles the agent and guards can walk on. */
export const WALKABLE = new Set([TILE_FLOOR, TILE_DOOR, TILE_BOOTH, TILE_PEDESTAL]);
/** Tiles a search can target. */
export const SEARCHABLE = new Set([TILE_FIXTURE, TILE_FITTING, TILE_TOYSHELF]);

export const STORES: readonly StoreDef[] = [
  // --- 4F -------------------------------------------------------------
  {
    id: 'forever12',
    name: 'FOREVER 12',
    floor: FLOOR_4F,
    x: 96,
    role: 'target',
    windows: ['mannequins', 'clothingRack'],
    theme: 'fashion',
    music: 'store_forever12',
    layout: [
      '################',
      '#..RR..FF..RR..#',
      '#..............#',
      '#.FF..CC..FF...#',
      '#..............#',
      '#....FF..FF....#',
      '#..............#',
      '#.FF..CC..FF...#',
      '#..............#',
      '#..............#',
      '#######oo#######',
    ],
  },
  {
    id: 'radioshock',
    name: 'RADIOSHOCK',
    floor: FLOOR_4F,
    x: 248,
    role: 'target',
    windows: ['tvStatic', 'walkieTalkies'],
    theme: 'electronics',
    music: 'store_radioshock',
    layout: [
      '################',
      '#FFFF....FFFF..#',
      '#..............#',
      '#..DD......DD..#',
      '#..............#',
      '#.FF..CCCC..FF.#',
      '#..............#',
      '#..DD......DD..#',
      '#..............#',
      '#..FF......FF..#',
      '#######oo#######',
    ],
  },
  {
    id: 'crookstone',
    name: 'CROOKSTONE',
    floor: FLOOR_4F,
    x: 420,
    role: 'powerup',
    windows: ['massageChair', 'gadgetPedestals'],
    theme: 'gadgets',
    music: 'store_crookstone',
    layout: [
      '################',
      '#..FF......FF..#',
      '#..............#',
      '#.F..DD..DD..F.#',
      '#.F..........F.#',
      '#......CC......#',
      '#.F..........F.#',
      '#.F..DD..DD..F.#',
      '#..............#',
      '#..FF......FF..#',
      '#######oo#######',
    ],
  },
  {
    id: 'gamestonk',
    name: 'GAMESTONK',
    floor: FLOOR_4F,
    x: 576,
    role: 'powerup',
    windows: ['consoleStack', 'rocketPoster'],
    theme: 'games',
    music: 'store_gamestonk',
    layout: [
      '################',
      '#..D......D....#',
      '#....P.........#',
      '#..............#',
      '#.FFF......FFF.#',
      '#..............#',
      '#.FFF......FFF.#',
      '#..............#',
      '#....CCCC......#',
      '#..............#',
      '#######oo#######',
    ],
  },

  // --- 3F -------------------------------------------------------------
  {
    id: 'kgbtoys',
    name: 'KGB TOYS',
    floor: FLOOR_3F,
    x: 96,
    role: 'target',
    windows: ['teddyBears', 'robotRocket'],
    theme: 'toys',
    music: 'store_kgbtoys',
    layout: [
      '################',
      '#TT..FF..FF..TT#',
      '#..............#',
      '#..............#',
      '#.FF..TT..FF...#',
      '#..............#',
      '#.....CC.......#',
      '#..............#',
      '#TT..FF..FF..TT#',
      '#..............#',
      '#######oo#######',
    ],
  },
  {
    id: 'blockbluster',
    name: 'BLOCKBLUSTER VIDEO',
    floor: FLOOR_3F,
    x: 248,
    role: 'closed',
    windows: ['forLease', 'vhsPoster'],
  },
  {
    id: 'spendersgifts',
    name: "SPENDER'S GIFTS",
    floor: FLOOR_3F,
    x: 420,
    role: 'powerup',
    windows: ['lavaLamp', 'plasmaBall'],
    theme: 'novelty',
    music: 'store_spendersgifts',
    layout: [
      '################',
      '#.F..F..F..F..F#',
      '#..............#',
      '#..DD......DD..#',
      '#..............#',
      '#.F.F..CC..F.F.#',
      '#..............#',
      '#..DD......DD..#',
      '#..............#',
      '#.F..F..F..F..F#',
      '#######oo#######',
    ],
  },

  // --- 2F -------------------------------------------------------------
  {
    id: 'sambaddy',
    name: 'SAM BADDY',
    floor: FLOOR_2F,
    x: 96,
    role: 'target',
    windows: ['tapesVinyl', 'boombox'],
    theme: 'music',
    music: 'store_sambaddy',
    layout: [
      '################',
      '#FF.FF.FF.FF.FF#',
      '#..............#',
      '#..............#',
      '#FF.FF.LL.FF.FF#',
      '#..............#',
      '#..............#',
      '#FF.FF.FF.FF.FF#',
      '#..............#',
      '#.CCC......CCC.#',
      '#######oo#######',
    ],
  },
  {
    id: 'sharperimagine',
    name: 'SHARPER IMAGINE',
    floor: FLOOR_2F,
    x: 248,
    role: 'powerup',
    windows: ['robotVacuum', 'glowingOrb'],
    theme: 'gadgets',
    music: 'store_sharperimagine',
    layout: [
      '################',
      '#..F.F.F.F.F...#',
      '#..............#',
      '#.DD........DD.#',
      '#..............#',
      '#..F..CCCC..F..#',
      '#..............#',
      '#.DD........DD.#',
      '#..............#',
      '#..F.F.F.F.F...#',
      '#######oo#######',
    ],
  },
  {
    id: 'hotspy',
    name: 'HOT SPY ON A STICK',
    floor: FLOOR_2F,
    x: 420,
    role: 'target',
    windows: ['lemonadeTub', 'cornDogs'],
    theme: 'foodcourt',
    music: 'store_hotspy',
    layout: [
      '################',
      '#CCCCCC..FFFFFF#',
      '#..............#',
      '#..............#',
      '#.DD.FF..FF.DD.#',
      '#..............#',
      '#..............#',
      '#.DD.FF..FF.DD.#',
      '#..............#',
      '#..FF......FF..#',
      '#######oo#######',
    ],
  },
  {
    id: 'circuitpity',
    name: 'CIRCUIT PITY',
    floor: FLOOR_2F,
    x: 576,
    role: 'closed',
    windows: ['deadTvs', 'deadTvs'],
  },

  // --- 1F -------------------------------------------------------------
  {
    id: 'footlockpicker',
    name: 'FOOT LOCKPICKER',
    floor: FLOOR_1F,
    x: 96,
    role: 'target',
    windows: ['sneakerWall', 'basketballs'],
    theme: 'sports',
    music: 'store_footlockpicker',
    layout: [
      '################',
      '#FFFFFF..FFFFFF#',
      '#..............#',
      '#..............#',
      '#.FF..DD..FF...#',
      '#..............#',
      '#.....CC.......#',
      '#..............#',
      '#FFF......FFF..#',
      '#..............#',
      '#######oo#######',
    ],
  },
  {
    id: 'borderlinebooks',
    name: 'BORDERLINE BOOKS',
    floor: FLOOR_1F,
    x: 248,
    role: 'closed',
    windows: ['closingSale', 'closingSale'],
  },
];

export const STORE_BY_ID: ReadonlyMap<string, StoreDef> = new Map(STORES.map((s) => [s.id, s]));

export const TARGET_STORES = STORES.filter((s) => s.role === 'target');
export const POWERUP_STORES = STORES.filter((s) => s.role === 'powerup');
export const OPEN_STORES = STORES.filter((s) => s.role !== 'closed');

/** The x of a storefront's door centre, in mall pixels. */
export function storeDoorX(def: StoreDef): number {
  return def.x + STOREFRONT_W / 2;
}
