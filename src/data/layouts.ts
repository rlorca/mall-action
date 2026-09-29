// Store room layouts: 16 wide x 11 tall
// 0=floor, 1=wall, 2=fixture(searchable), 3=counter(solid), 4=decor(solid), 5=door
// 6=fitting_room (Forever 12), 7=toy_shelf (KGB Toys), 8=listening_booth (Sam Baddy)

export interface StoreLayout {
  tiles: number[][];
  fixtureContents: string[];
}

// Helper to create a 16x11 room with walls on edges and a door at bottom center
function makeRoom(interior: number[][]): number[][] {
  const room: number[][] = [];
  // Top wall
  room.push(Array(16).fill(1));
  // Interior rows (9 rows)
  for (let r = 0; r < 9; r++) {
    const row = [1, ...interior[r], 1];
    room.push(row);
  }
  // Bottom wall with door
  const bottom = Array(16).fill(1);
  bottom[7] = 5;
  bottom[8] = 5;
  room.push(bottom);
  return room;
}

// Each interior is 14 wide x 9 tall
const F = 0; // floor
const W = 1; // wall (used inside for partitions)
const X = 2; // searchable fixture
const C = 3; // counter
const D = 4; // decor

export const STORE_LAYOUTS: Record<string, StoreLayout> = {
  // FOREVER 12 - fashion store with fitting rooms
  forever12: {
    tiles: makeRoom([
      // row 1
      [X, F, X, F, F, F, F, F, F, F, F, X, F, X],
      // row 2
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      // row 3
      [F, F, C, C, F, F, F, F, F, F, C, C, F, F],
      // row 4
      [F, F, F, F, F, X, F, F, X, F, F, F, F, F],
      // row 5
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      // row 6
      [6, W, F, F, F, F, F, F, F, F, F, F, W, 6],
      // row 7
      [F, W, F, F, F, D, F, F, D, F, F, F, W, F],
      // row 8
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      // row 9
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    // Fixtures left-to-right, top-to-bottom: 4 racks + 2 center + 2 fitting rooms
    fixtureContents: ['empty', 'package', 'empty', 'trap', 'empty', 'empty', 'fitting_room', 'fitting_room'],
  },

  // RADIOSHOCK - electronics store
  radioshock: {
    tiles: makeRoom([
      [X, F, X, F, F, F, F, F, F, F, F, X, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, C, C, C, F, F, C, C, C, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, X, F, F, F, F, F, F, F, F, X, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, D, F, F, F, F, D, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['trap', 'empty', 'package', 'empty', 'empty', 'empty'],
  },

  // CROOKSTONE - power-up shop (gadgets)
  crookstone: {
    tiles: makeRoom([
      [X, F, F, F, F, F, F, F, F, F, F, F, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, X, F, F, X, F, F, D, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, C, C, C, F, F, F, F, C, C, C, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['powerup', 'powerup', 'empty', 'empty'],
  },

  // GAMESTONK - power-up shop (games)
  gamestonk: {
    tiles: makeRoom([
      [X, F, F, D, F, F, F, F, F, F, D, F, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, C, F, F, X, F, F, X, F, F, C, F, F],
      [F, F, C, F, F, F, F, F, F, F, F, C, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, D, F, F, D, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['powerup', 'empty', 'powerup', 'empty'],
  },

  // KGB TOYS - toy store with shootable toy shelves
  kgb_toys: {
    tiles: makeRoom([
      [7, F, X, F, F, F, F, F, F, F, F, X, F, 7],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, C, F, F, F, F, F, F, C, F, F, F],
      [F, F, F, F, F, X, F, F, X, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, F, F, F, F, F, F, D, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    // toy_shelf entries are special (shootable), not searched
    fixtureContents: ['toy_shelf', 'empty', 'package', 'toy_shelf', 'trap', 'empty'],
  },

  // SPENDER'S GIFTS - novelty / black-light store
  spenders: {
    tiles: makeRoom([
      [X, F, F, F, F, F, F, F, F, F, F, F, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, F, D, F, F, F, D, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, X, F, F, F, F, X, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, C, C, F, F, F, F, F, F, C, C, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['powerup', 'empty', 'powerup', 'empty'],
  },

  // SAM BADDY - music store with listening booth
  sam_baddy: {
    tiles: makeRoom([
      [X, F, X, F, F, F, F, F, F, F, F, X, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, C, C, F, F, F, F, C, C, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, X, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, 8, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    // listening_booth (8) is walkable, triggers music
    fixtureContents: ['empty', 'package', 'trap', 'empty', 'empty', 'empty'],
  },

  // SHARPER IMAGINE - gadget power-up shop
  sharper_imagine: {
    tiles: makeRoom([
      [X, F, F, F, F, F, F, F, F, F, F, F, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, C, F, F, F, F, C, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, X, F, F, F, D, F, F, F, F, X, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['powerup', 'empty', 'powerup', 'empty'],
  },

  // HOT SPY ON A STICK - food court
  hot_spy: {
    tiles: makeRoom([
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, C, C, C, C, C, C, C, C, C, C, C, C, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, X, F, F, X, F, F, X, F, F, X, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, F, F, F, F, F, F, D, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['empty', 'trap', 'package', 'empty'],
  },

  // FOOT LOCKPICKER - sports store
  foot_lockpicker: {
    tiles: makeRoom([
      [X, F, X, F, F, F, F, F, F, F, F, X, F, X],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, C, F, F, F, D, F, F, F, F, C, F, F],
      [F, F, C, F, F, F, F, F, F, F, F, C, F, F],
      [F, F, F, F, F, X, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    ]),
    fixtureContents: ['empty', 'package', 'trap', 'empty', 'empty'],
  },
};
