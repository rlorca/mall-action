// Pixel-art sprites, all generated from source (no external assets).
// A sprite is a flat array of colour indices; 0 means transparent.
// The rule "at most 3 colours plus transparent per sprite" is enforced by a
// test that scans every sprite.

import { C } from "./palette";

export interface Sprite {
  w: number;
  h: number;
  /** Flat row-major array of palette indices; 0 = transparent. */
  px: Uint8Array;
}

/** Build a sprite from rows of characters. `.` is transparent. */
export function makeSprite(
  rows: string[],
  map: Record<string, number>,
): Sprite {
  const h = rows.length;
  const w = rows[0].length;
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? ".";
      px[y * w + x] = map[ch] ?? 0;
    }
  }
  return { w, h, px };
}

/** Count the distinct non-transparent colours in a sprite. */
export function distinctColors(s: Sprite): number {
  const set = new Set<number>();
  for (let i = 0; i < s.px.length; i++) {
    if (s.px[i] !== 0) set.add(s.px[i]);
  }
  return set.size;
}

// ---------------------------------------------------------------------------
// Character palettes (each sprite uses at most 3 colours + transparent).
// ---------------------------------------------------------------------------

// Agent: red trench coat (R), skin (S), black hair/boots (B).
const AGENT = {
  ".": 0,
  R: C.red,
  S: C.skin,
  B: C.black,
};

// Spy: black suit/fedora (B), skin (S), white shirt (W).
const SPY = {
  ".": 0,
  B: C.black,
  S: C.skin,
  W: C.white,
};

// ---------------------------------------------------------------------------
// Agent (mall, 16x24) — red trench coat, dark hair.
// ---------------------------------------------------------------------------

const AGENT_STAND = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_WALK1 = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_WALK2 = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_JUMP = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_DUCK = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
];

// ---------------------------------------------------------------------------
// Spy (mall, 16x24) — black suit, fedora, sunglasses.
// ---------------------------------------------------------------------------

const SPY_STAND = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....WWWWWWWW....",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
  "....BB....BB....",
];

const SPY_WALK1 = SPY_STAND;
const SPY_WALK2 = SPY_STAND;

// ---------------------------------------------------------------------------
// Store sprites (16x16) — top-down, 4 directions.
// ---------------------------------------------------------------------------

const AGENT_STORE_DOWN = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_STORE_UP = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
];

const AGENT_STORE_SIDE = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....RRRRRRRR....",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "...RRRRRRRRRR...",
  "....BB....BB....",
  "....BB....BB....",
];

const SPY_STORE = [
  "................",
  ".....BBBBBB.....",
  "....BBBBBBBB....",
  "....BBBBBBBB....",
  ".....SSSSSS.....",
  ".....SSSSSS.....",
  "....WWWWWWWW....",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "...BBBBBBBBBB...",
  "....BB....BB....",
  "....BB....BB....",
];

// ---------------------------------------------------------------------------
// Small items.
// ---------------------------------------------------------------------------

const PACKAGE = [
  "..RRRRRRRRRR..",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  ".RRRRRRRRRRRR.",
  "..RRRRRRRRRR..",
];

const BULLET = [
  "WW",
  "WW",
];

const COIN = [
  "..YY..",
  ".YYYY.",
  ".YYYY.",
  "..YY..",
];

// ---------------------------------------------------------------------------
// Sprite registry.
// ---------------------------------------------------------------------------

export interface SpriteSet {
  agentStand: Sprite;
  agentWalk1: Sprite;
  agentWalk2: Sprite;
  agentJump: Sprite;
  agentDuck: Sprite;
  spyStand: Sprite;
  spyWalk1: Sprite;
  spyWalk2: Sprite;
  agentStoreDown: Sprite;
  agentStoreUp: Sprite;
  agentStoreSide: Sprite;
  spyStore: Sprite;
  package: Sprite;
  bullet: Sprite;
  coin: Sprite;
}

export function buildSprites(): SpriteSet {
  return {
    agentStand: makeSprite(AGENT_STAND, AGENT),
    agentWalk1: makeSprite(AGENT_WALK1, AGENT),
    agentWalk2: makeSprite(AGENT_WALK2, AGENT),
    agentJump: makeSprite(AGENT_JUMP, AGENT),
    agentDuck: makeSprite(AGENT_DUCK, AGENT),
    spyStand: makeSprite(SPY_STAND, SPY),
    spyWalk1: makeSprite(SPY_WALK1, SPY),
    spyWalk2: makeSprite(SPY_WALK2, SPY),
    agentStoreDown: makeSprite(AGENT_STORE_DOWN, AGENT),
    agentStoreUp: makeSprite(AGENT_STORE_UP, AGENT),
    agentStoreSide: makeSprite(AGENT_STORE_SIDE, AGENT),
    spyStore: makeSprite(SPY_STORE, SPY),
    package: makeSprite(PACKAGE, { ".": 0, R: C.red }),
    bullet: makeSprite(BULLET, { ".": 0, W: C.white }),
    coin: makeSprite(COIN, { ".": 0, Y: C.yellow }),
  };
}
