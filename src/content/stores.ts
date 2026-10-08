import type { ThemeId } from './themes';
import type { MusicId } from '../audio/ids';

export type StoreRole = 'target' | 'powerup' | 'closed';

export const STORE_IDS = [
  'forever12',
  'radioshock',
  'crookstone',
  'gamestonk',
  'kgbtoys',
  'blockbluster',
  'spenders',
  'sambaddy',
  'sharper',
  'hotspy',
  'circuitpity',
  'footlock',
  'borderline',
] as const;
export type StoreId = (typeof STORE_IDS)[number];

export interface StoreDef {
  id: StoreId;
  /** Sign text (<= 18 chars so it fits the tiny font on an 80 px sign). Puns, never real brands. */
  name: string;
  /** What it parodies (for README/comments only; never drawn in game). */
  parody: string;
  /** Floor index: 1 = 4F, 2 = 3F, 3 = 2F, 4 = 1F. */
  floor: number;
  /** Left edge of the ~80 px storefront in mall pixels. */
  x: number;
  role: StoreRole;
  /** Top-down room theme; null for closed stores. */
  theme: ThemeId | null;
  /** Store song; null for closed stores. */
  song: MusicId | null;
}

export const STORE_W = 80;
/** Door is centred; walkable trigger is x + 32 .. x + 48. */
export const DOOR_X = 32;
export const DOOR_W = 16;

export const STORES: readonly StoreDef[] = [
  { id: 'forever12', name: 'FOREVER 12', parody: 'Forever 21', floor: 1, x: 24, role: 'target', theme: 'fashion', song: 'store.forever12' },
  { id: 'radioshock', name: 'RADIOSHOCK', parody: 'RadioShack', floor: 1, x: 208, role: 'target', theme: 'electronics', song: 'store.radioshock' },
  { id: 'crookstone', name: 'CROOKSTONE', parody: 'Brookstone', floor: 1, x: 432, role: 'powerup', theme: 'gadgets', song: 'store.crookstone' },
  { id: 'gamestonk', name: 'GAMESTONK', parody: 'GameStop', floor: 1, x: 640, role: 'powerup', theme: 'games', song: 'store.gamestonk' },
  { id: 'kgbtoys', name: 'KGB TOYS', parody: 'KB Toys', floor: 2, x: 24, role: 'target', theme: 'toys', song: 'store.kgbtoys' },
  { id: 'blockbluster', name: 'BLOCKBLUSTER VIDEO', parody: 'Blockbuster', floor: 2, x: 208, role: 'closed', theme: null, song: null },
  { id: 'spenders', name: "SPENDER'S GIFTS", parody: "Spencer's", floor: 2, x: 432, role: 'powerup', theme: 'novelty', song: 'store.spenders' },
  { id: 'sambaddy', name: 'SAM BADDY', parody: 'Sam Goody', floor: 3, x: 24, role: 'target', theme: 'music', song: 'store.sambaddy' },
  { id: 'sharper', name: 'SHARPER IMAGINE', parody: 'Sharper Image', floor: 3, x: 200, role: 'powerup', theme: 'gadgets', song: 'store.sharper' },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', parody: 'Hot Dog on a Stick', floor: 3, x: 296, role: 'target', theme: 'food', song: 'store.hotspy' },
  { id: 'circuitpity', name: 'CIRCUIT PITY', parody: 'Circuit City', floor: 3, x: 432, role: 'closed', theme: null, song: null },
  { id: 'footlock', name: 'FOOT LOCKPICKER', parody: 'Foot Locker', floor: 4, x: 40, role: 'target', theme: 'sports', song: 'store.footlock' },
  { id: 'borderline', name: 'BORDERLINE BOOKS', parody: 'Borders', floor: 4, x: 232, role: 'closed', theme: null, song: null },
];

const BY_ID = new Map<StoreId, StoreDef>(STORES.map((s) => [s.id, s]));

export function storeDef(id: StoreId): StoreDef {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown store ${id}`);
  return s;
}

export const TARGET_STORES: readonly StoreDef[] = STORES.filter((s) => s.role === 'target');
export const POWERUP_STORES: readonly StoreDef[] = STORES.filter((s) => s.role === 'powerup');
export const CLOSED_STORES: readonly StoreDef[] = STORES.filter((s) => s.role === 'closed');
export const OPEN_STORES: readonly StoreDef[] = STORES.filter((s) => s.role !== 'closed');
export const PACKAGES_TOTAL = 6;
