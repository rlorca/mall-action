import { FloorId, StoreRole, type StoreInfo } from '../engine/types';

export const STORES: StoreInfo[] = [
  {
    id: 'forever12',
    name: 'FOREVER 12',
    parody: 'Forever 21',
    floor: FloorId.F4,
    role: StoreRole.Target,
    theme: 'fashion',
    windowDisplay: 'mannequins in outfits / a clothing rack',
  },
  {
    id: 'radioshock',
    name: 'RADIOSHOCK',
    parody: 'RadioShack',
    floor: FloorId.F4,
    role: StoreRole.Target,
    theme: 'electronics',
    windowDisplay: 'stacked TVs flickering with static / walkie-talkies',
  },
  {
    id: 'crookstone',
    name: 'CROOKSTONE',
    parody: 'Brookstone',
    floor: FloorId.F4,
    role: StoreRole.PowerUp,
    theme: 'gadgets',
    windowDisplay: 'a massage chair / gadgets on pedestals',
  },
  {
    id: 'gamestonk',
    name: 'GAMESTONK',
    parody: 'GameStop',
    floor: FloorId.F4,
    role: StoreRole.PowerUp,
    theme: 'games',
    windowDisplay: 'a console stack and cartridges / a "TO THE MOON" rocket poster and demo TV',
  },
  {
    id: 'kgb_toys',
    name: 'KGB TOYS',
    parody: 'KB Toys',
    floor: FloorId.F3,
    role: StoreRole.Target,
    theme: 'toys',
    windowDisplay: 'teddy bears in fur hats / a robot and a toy rocket',
  },
  {
    id: 'blockbluster',
    name: 'BLOCKBLUSTER VIDEO',
    parody: 'Blockbuster',
    floor: FloorId.F3,
    role: StoreRole.Closed,
    theme: 'electronics',
    windowDisplay: 'shutter, a "FOR LEASE" sign, a faded VHS poster',
  },
  {
    id: 'spenders',
    name: "SPENDER'S GIFTS",
    parody: "Spencer's",
    floor: FloorId.F3,
    role: StoreRole.PowerUp,
    theme: 'novelty',
    windowDisplay: 'an animated lava lamp / a plasma ball',
  },
  {
    id: 'sam_baddy',
    name: 'SAM BADDY',
    parody: 'Sam Goody',
    floor: FloorId.F2,
    role: StoreRole.Target,
    theme: 'music',
    windowDisplay: 'tapes and vinyl / a boombox with bouncing speakers',
  },
  {
    id: 'sharper_imagine',
    name: 'SHARPER IMAGINE',
    parody: 'Sharper Image',
    floor: FloorId.F2,
    role: StoreRole.PowerUp,
    theme: 'gadgets',
    windowDisplay: 'a robot vacuum / a pulsing glowing orb',
  },
  {
    id: 'hot_spy',
    name: 'HOT SPY ON A STICK',
    parody: 'Hot Dog on a Stick',
    floor: FloorId.F2,
    role: StoreRole.Target,
    theme: 'food',
    windowDisplay: 'a lemonade tub being pumped / corn dogs',
  },
  {
    id: 'circuit_pity',
    name: 'CIRCUIT PITY',
    parody: 'Circuit City',
    floor: FloorId.F2,
    role: StoreRole.Closed,
    theme: 'electronics',
    windowDisplay: 'shutter half down with dead TVs behind it',
  },
  {
    id: 'foot_lockpicker',
    name: 'FOOT LOCKPICKER',
    parody: 'Foot Locker',
    floor: FloorId.F1,
    role: StoreRole.Target,
    theme: 'sports',
    windowDisplay: 'a wall of sneakers / basketballs and a jersey',
  },
  {
    id: 'borderline_books',
    name: 'BORDERLINE BOOKS',
    parody: 'Borders',
    floor: FloorId.F1,
    role: StoreRole.Closed,
    theme: 'electronics',
    windowDisplay: 'shutter with a "CLOSING SALE" banner',
  },
];

export function getTargetStores(): StoreInfo[] {
  return STORES.filter(s => s.role === StoreRole.Target);
}

export function getPowerUpStores(): StoreInfo[] {
  return STORES.filter(s => s.role === StoreRole.PowerUp);
}

export function getClosedStores(): StoreInfo[] {
  return STORES.filter(s => s.role === StoreRole.Closed);
}

export function getStoresByFloor(floor: FloorId): StoreInfo[] {
  return STORES.filter(s => s.floor === floor);
}

export function getStoreById(id: string): StoreInfo | undefined {
  return STORES.find(s => s.id === id);
}
