// The 13 storefronts. Shared by mall rules, store rules, map, art and audio.
// (Names are puns; never use real logos or exact brand names.)
import type { StoreId, OpenStoreId } from '../core/events';

export type StoreRole = 'target' | 'powerup' | 'closed';
export type Floor = 'R' | '4F' | '3F' | '2F' | '1F' | 'P';
export const FLOORS: readonly Floor[] = ['R', '4F', '3F', '2F', '1F', 'P'];
export type ThemeId = 'fashion' | 'electronics' | 'toys' | 'food' | 'sports' | 'music' | 'gadgets' | 'novelty' | 'games';

export interface StoreDef {
  id: StoreId;
  /** Full sign text (may be split over `signLines` when too wide for the tiny font). */
  name: string;
  signLines: string[];
  parody: string;
  floor: Exclude<Floor, 'R' | 'P'>;
  role: StoreRole;
  theme: ThemeId | null; // null for closed stores
  /** Window display ids (left, right); art module renders them. */
  windowL: string;
  windowR: string;
  /** Sign/door colour role is derived from `role`. */
  guardCount: [number, number]; // min,max guards
}

export const STORES: readonly StoreDef[] = [
  { id: 'forever12', name: 'FOREVER 12', signLines: ['FOREVER 12'], parody: 'Forever 21', floor: '4F', role: 'target', theme: 'fashion', windowL: 'mannequins', windowR: 'clothesrack', guardCount: [2, 3] },
  { id: 'radioshock', name: 'RADIOSHOCK', signLines: ['RADIOSHOCK'], parody: 'RadioShack', floor: '4F', role: 'target', theme: 'electronics', windowL: 'staticTvs', windowR: 'walkieTalkies', guardCount: [2, 3] },
  { id: 'crookstone', name: 'CROOKSTONE', signLines: ['CROOKSTONE'], parody: 'Brookstone', floor: '4F', role: 'powerup', theme: 'gadgets', windowL: 'massageChair', windowR: 'gadgetPedestals', guardCount: [1, 1] },
  { id: 'gamestonk', name: 'GAMESTONK', signLines: ['GAMESTONK'], parody: 'GameStop', floor: '4F', role: 'powerup', theme: 'games', windowL: 'consoleStack', windowR: 'moonPoster', guardCount: [1, 1] },
  { id: 'kgbtoys', name: 'KGB TOYS', signLines: ['KGB TOYS'], parody: 'KB Toys', floor: '3F', role: 'target', theme: 'toys', windowL: 'furHatBears', windowR: 'robotRocket', guardCount: [2, 3] },
  { id: 'blockblustervideo', name: 'BLOCKBLUSTER VIDEO', signLines: ['BLOCKBLUSTER', 'VIDEO'], parody: 'Blockbuster', floor: '3F', role: 'closed', theme: null, windowL: 'forLease', windowR: 'fadedVhsPoster', guardCount: [0, 0] },
  { id: 'spendersgifts', name: "SPENDER'S GIFTS", signLines: ["SPENDER'S", 'GIFTS'], parody: "Spencer's", floor: '3F', role: 'powerup', theme: 'novelty', windowL: 'lavaLamp', windowR: 'plasmaBall', guardCount: [1, 1] },
  { id: 'sambaddy', name: 'SAM BADDY', signLines: ['SAM BADDY'], parody: 'Sam Goody', floor: '2F', role: 'target', theme: 'music', windowL: 'tapesVinyl', windowR: 'boombox', guardCount: [2, 3] },
  { id: 'sharperimagine', name: 'SHARPER IMAGINE', signLines: ['SHARPER', 'IMAGINE'], parody: 'Sharper Image', floor: '2F', role: 'powerup', theme: 'gadgets', windowL: 'robotVacuum', windowR: 'glowOrb', guardCount: [1, 1] },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', signLines: ['HOT SPY ON', 'A STICK'], parody: 'Hot Dog on a Stick', floor: '2F', role: 'target', theme: 'food', windowL: 'lemonadeTub', windowR: 'corndogs', guardCount: [2, 3] },
  { id: 'circuitpity', name: 'CIRCUIT PITY', signLines: ['CIRCUIT PITY'], parody: 'Circuit City', floor: '2F', role: 'closed', theme: null, windowL: 'deadTvsShutter', windowR: 'deadTvsShutter', guardCount: [0, 0] },
  { id: 'footlockpicker', name: 'FOOT LOCKPICKER', signLines: ['FOOT', 'LOCKPICKER'], parody: 'Foot Locker', floor: '1F', role: 'target', theme: 'sports', windowL: 'sneakerWall', windowR: 'basketballsJersey', guardCount: [2, 3] },
  { id: 'borderlinebooks', name: 'BORDERLINE BOOKS', signLines: ['BORDERLINE', 'BOOKS'], parody: 'Borders', floor: '1F', role: 'closed', theme: null, windowL: 'closingSale', windowR: 'closingSale', guardCount: [0, 0] },
];

export const STORE_BY_ID: Readonly<Record<StoreId, StoreDef>> = Object.fromEntries(STORES.map((s) => [s.id, s])) as Record<StoreId, StoreDef>;
export const TARGET_STORES = STORES.filter((s) => s.role === 'target').map((s) => s.id);
export const POWERUP_STORES = STORES.filter((s) => s.role === 'powerup').map((s) => s.id);
export const CLOSED_STORES = STORES.filter((s) => s.role === 'closed').map((s) => s.id);
export const OPEN_STORES = STORES.filter((s) => s.role !== 'closed').map((s) => s.id) as OpenStoreId[];
export const PACKAGES_TOTAL = 6;

export const THEMES: readonly ThemeId[] = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'];
