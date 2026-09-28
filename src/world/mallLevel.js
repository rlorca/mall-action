export const SHAFT_W = 24;
export const SHAFTS = [
  { id: 'A', x: 112, minFloor: 0, maxFloor: 3, startFloor: 0, ai: false },
  { id: 'B', x: 376, minFloor: 1, maxFloor: 5, startFloor: 1, ai: false },
  { id: 'C', x: 632, minFloor: 0, maxFloor: 4, startFloor: 2, ai: true },
];

export const ESC_RUN = 48; // escalator rises 48 px over 48 px, rising to the right
export const ESCALATORS = [
  { id: 'E1', x: 280, bottomFloor: 2, topFloor: 1 }, // 3F (x=280) ↔ 4F (x=328)
  { id: 'E2', x: 480, bottomFloor: 4, topFloor: 3 }, // 1F (x=480) ↔ 2F (x=528)
];

export const STORE_W = 80;
export const STORES = [
  { id: 'forever12', name: 'FOREVER 12', floor: 1, x: 16, role: 'target', theme: 'fashion' },
  { id: 'radioshock', name: 'RADIOSHOCK', floor: 1, x: 176, role: 'target', theme: 'electronics' },
  { id: 'crookstone', name: 'CROOKSTONE', floor: 1, x: 416, role: 'powerup', theme: 'gadgets', layout: 'gadgetsA' },
  { id: 'gamestonk', name: 'GAMESTONK', floor: 1, x: 520, role: 'powerup', theme: 'games' },
  { id: 'kgbtoys', name: 'KGB TOYS', floor: 2, x: 16, role: 'target', theme: 'toys' },
  { id: 'blockbluster', name: 'BLOCKBLUSTER VIDEO', floor: 2, x: 480, role: 'closed', theme: null },
  { id: 'spenders', name: "SPENDER'S GIFTS", floor: 2, x: 672, role: 'powerup', theme: 'novelty' },
  { id: 'sambaddy', name: 'SAM BADDY', floor: 3, x: 16, role: 'target', theme: 'music' },
  { id: 'sharperimagine', name: 'SHARPER IMAGINE', floor: 3, x: 176, role: 'powerup', theme: 'gadgets', layout: 'gadgetsB' },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', floor: 3, x: 544, role: 'target', theme: 'food' },
  { id: 'circuitpity', name: 'CIRCUIT PITY', floor: 3, x: 672, role: 'closed', theme: null },
  { id: 'footlockpicker', name: 'FOOT LOCKPICKER', floor: 4, x: 16, role: 'target', theme: 'sports' },
  { id: 'borderline', name: 'BORDERLINE BOOKS', floor: 4, x: 176, role: 'closed', theme: null },
];
export const doorX = (s) => s.x + STORE_W / 2;

// hanging lights (ceiling), one per ~screen on each shopping floor; 2F = disco balls
// placed in corridor gaps so they don't hide storefront signs
const LIGHT_X = { 1: [160, 300, 720], 2: [256, 356, 600], 3: [160, 320, 480], 4: [160, 356, 600] };
export const LIGHTS = [1, 2, 3, 4].flatMap((floor) =>
  LIGHT_X[floor].map((x) => ({ floor, x, kind: floor === 3 ? 'disco' : 'lamp' })));

export const KIOSKS = [{ floor: 1, x: 690 }, { floor: 2, x: 150 }, { floor: 3, x: 440 }, { floor: 4, x: 420 }];
export const FOUNTAINS = [{ floor: 2, x: 408, w: 48 }, { floor: 4, x: 272, w: 48 }];
export const PHOTO_BOOTH = { floor: 2, x: 200, w: 24 };
export const GETAWAY_CAR = { floor: 5, x: 680, w: 48 };
export const ROOF_ENTRY_X = 200;
export const JANITOR_FLOOR = 4;
export const WALKER_FLOOR = 3;
export const COP_FLOORS = [1, 2, 3, 4];
export const FLOOR_ANNOUNCE = [
  'R - ROOF. MIND THE HELICOPTER',
  "4F - FASHION & GADGETS, SPIES",
  "3F - TOYS & GIFTS, MORE SPIES",
  '2F - MUSIC & FOOD COURT',
  '1F - SPORTS. NO RUNNING',
  'P - PARKING. DRIVE SAFE',
];
