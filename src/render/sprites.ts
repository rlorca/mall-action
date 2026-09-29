import { C } from './palette';
import {
  blank,
  disc,
  frame,
  hline,
  px,
  rect,
  ring,
  sprite,
  vline,
  type ColorTriple,
  type Sprite,
} from './pixels';

/**
 * The sprite catalogue. Everything is generated from source at module load:
 * characters as ASCII art (legibility matters most there), props and items
 * procedurally (far more compact, and easy to retune).
 *
 * Every Sprite is at most 3 colours plus transparent by construction.
 * tests/sprites.test.ts checks the required set exists at the right size.
 */

// Colour triples. Slot 1 / 2 / 3 map to these master-palette entries.
const AGENT: ColorTriple = [C.BLACK, C.RED, C.TAN]; // 1 dark, 2 coat, 3 skin
const AGENT_HURT: ColorTriple = [C.BLACK, C.WHITE, C.WHITE];
const SPY: ColorTriple = [C.BLACK, C.GREY, C.TAN];
const BOT: ColorTriple = [C.DARKGREY, C.LIGHTGREY, C.RED];

// ---------------------------------------------------------------------------
// The agent, mall view (16x24). Red trench coat, dark hair.
// ---------------------------------------------------------------------------

const A_HEAD = [
  '................',
  '................',
  '.....1111.......',
  '....111111......',
  '....133331......',
  '....133331......',
  '.....3333.......',
  '.....3333.......',
];

const agentIdle = sprite(AGENT, [
  ...A_HEAD,
  '....222222......',
  '...2222222......',
  '...22222223.....',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

const agentWalk1 = sprite(AGENT, [
  ...A_HEAD,
  '....222222......',
  '...2222222......',
  '..322222223.....',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....11.11......',
  '....11...11.....',
  '....11...11.....',
  '...11.....11....',
  '..111.....111...',
  '................',
]);

const agentWalk2 = sprite(AGENT, [
  ...A_HEAD,
  '....222222......',
  '...2222222......',
  '...22222223.....',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....22222.......',
  '.....2222.......',
  '......1111......',
  '......11.11.....',
  '.....11...11....',
  '....11.....11...',
  '...111.....111..',
  '................',
]);

const agentDuck = sprite(AGENT, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....1111.......',
  '....111111......',
  '....133331......',
  '.....3333.......',
  '....222222......',
  '...22222223.....',
  '..2222222222....',
  '..2222222222....',
  '..2222222222....',
  '...222222222....',
  '...222222222....',
  '...22222222.....',
  '...11....11.....',
  '...11....11.....',
  '..111....111....',
  '..111....111....',
  '................',
]);

const agentJump = sprite(AGENT, [
  ...A_HEAD,
  '....222222......',
  '..32222222......',
  '..32222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...22222222.....',
  '....2222222.....',
  '.....111.11.....',
  '....11....11....',
  '...11......11...',
  '..111.......1...',
  '..11............',
  '................',
]);

const agentShoot = sprite(AGENT, [
  ...A_HEAD,
  '....222222......',
  '...2222222......',
  '...222222233311.',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

const agentShootDuck = sprite(AGENT, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....1111.......',
  '....111111......',
  '....133331......',
  '.....3333.......',
  '....222222......',
  '...2222222......',
  '..2222222222....',
  '..222222222233..',
  '..2222222222....',
  '...222222222....',
  '...222222222....',
  '...22222222.....',
  '...11....11.....',
  '...11....11.....',
  '..111....111....',
  '..111....111....',
  '................',
]);

const agentDead = sprite(AGENT, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......3333......',
  '.....133331.....',
  '.....111111.....',
  '..1222222222....',
  '.122222222221...',
  '.122222222221...',
  '..2222222222....',
  '..11........11..',
  '.111........111.',
  '................',
  '................',
  '................',
]);

/** Hanging from the zip-line cable by both hands. */
const agentZip = sprite(AGENT, [
  '.....1.....1....',
  '.....3.....3....',
  '.....3.....3....',
  '....1111111.....',
  '....111111......',
  '....133331......',
  '.....3333.......',
  '....222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....2222.......',
  '.....11.11......',
  '....11...11.....',
  '....11...11.....',
  '...111...111....',
  '................',
  '................',
  '................',
  '................',
]);

/** Landed in a crouch. */
const agentLand = agentDuck;

/** Posing for the SPYGRAM selfie, phone held up. */
const agentSelfie = sprite(AGENT, [
  '................',
  '................',
  '.....1111...11..',
  '....111111..33..',
  '....133331..33..',
  '....133331..11..',
  '.....3333...3...',
  '.....3333..3....',
  '....222222233...',
  '...22222222.....',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

/** Holding a package overhead. */
const agentHold = sprite(AGENT, [
  '...1111111111...',
  '...1333333331...',
  '...1333333331...',
  '...1111111111...',
  '.....1111.......',
  '....111111......',
  '....133331......',
  '.....3333.......',
  '..2.222222.2....',
  '..2.2222222.2...',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

// ---------------------------------------------------------------------------
// Spies, mall view (16x24). Black suit, fedora, sunglasses.
// ---------------------------------------------------------------------------

const S_HEAD = [
  '................',
  '...1111111......',
  '..111111111.....',
  '....11111.......',
  '....33333.......',
  '....11111.......', // sunglasses
  '....33333.......',
  '.....333........',
];

const spyIdle = sprite(SPY, [
  ...S_HEAD,
  '....111111......',
  '...1122111......',
  '...1122111......',
  '...1122111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '....11111.......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

const spyWalk = sprite(SPY, [
  ...S_HEAD,
  '....111111......',
  '...1122111......',
  '..31122111......',
  '...1122111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '....11111.......',
  '.....11.11......',
  '....11...11.....',
  '....11...11.....',
  '...11.....11....',
  '..111.....111...',
  '................',
]);

/** The clear aiming pose: arm straight out, gun level. */
const spyAim = sprite(SPY, [
  ...S_HEAD,
  '....111111......',
  '...1122111......',
  '...112211133311.',
  '...1122111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '....11111.......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

const spyAimLow = sprite(SPY, [
  ...S_HEAD,
  '....111111......',
  '...1122111......',
  '...1122111......',
  '...1122111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...111111133311.',
  '...1111111......',
  '....11111.......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
]);

const spyDuck = sprite(SPY, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...1111111......',
  '..111111111.....',
  '....11111.......',
  '....33333.......',
  '....11111.......',
  '.....333........',
  '....111111......',
  '..111111111.....',
  '..111111111.....',
  '..111111111.....',
  '...11111111.....',
  '...11111111.....',
  '...11....11.....',
  '...11....11.....',
  '..111....111....',
  '..111....111....',
  '................',
  '................',
]);

const spyDead = sprite(SPY, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..1111..........',
  '.111111.........',
  '...333..........',
  '...111..........',
  '..11111111111...',
  '.1111111111111..',
  '.1111111111111..',
  '..11111111111...',
  '..11........11..',
  '.111........111.',
  '................',
  '................',
  '................',
  '................',
]);

// ---------------------------------------------------------------------------
// Store view (top-down, 16x16)
// ---------------------------------------------------------------------------

const sAgentDown = sprite(AGENT, [
  '................',
  '.....111111.....',
  '....11111111....',
  '....13333331....',
  '....13333331....',
  '.....333333.....',
  '...2222222222...',
  '..32222222223...',
  '..32222222223...',
  '...2222222222...',
  '...2222222222...',
  '....22222222....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sAgentUp = sprite(AGENT, [
  '................',
  '.....111111.....',
  '....11111111....',
  '....11111111....',
  '....11111111....',
  '.....111111.....',
  '...2222222222...',
  '..32222222223...',
  '..32222222223...',
  '...2222222222...',
  '...2222222222...',
  '....22222222....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sAgentRight = sprite(AGENT, [
  '................',
  '......111111....',
  '.....11111111...',
  '.....11333331...',
  '.....11333331...',
  '......133333....',
  '....22222222....',
  '....2222222223..',
  '....2222222223..',
  '....22222222....',
  '....22222222....',
  '.....2222222....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sAgentDown2 = sprite(AGENT, [
  '................',
  '.....111111.....',
  '....11111111....',
  '....13333331....',
  '....13333331....',
  '.....333333.....',
  '...2222222222...',
  '..32222222223...',
  '..32222222223...',
  '...2222222222...',
  '...2222222222...',
  '....22222222....',
  '....11......11..',
  '....11......11..',
  '...111......111.',
  '................',
]);

const sAgentUp2 = sprite(AGENT, [
  '................',
  '.....111111.....',
  '....11111111....',
  '....11111111....',
  '....11111111....',
  '.....111111.....',
  '...2222222222...',
  '..32222222223...',
  '..32222222223...',
  '...2222222222...',
  '...2222222222...',
  '....22222222....',
  '....11......11..',
  '....11......11..',
  '...111......111.',
  '................',
]);

const sAgentRight2 = sprite(AGENT, [
  '................',
  '......111111....',
  '.....11111111...',
  '.....11333331...',
  '.....11333331...',
  '......133333....',
  '....22222222....',
  '....2222222223..',
  '....2222222223..',
  '....22222222....',
  '....22222222....',
  '.....2222222....',
  '....11....11....',
  '...11......11...',
  '..111......111..',
  '................',
]);

/** Holding something overhead in the store view. */
const sAgentHold = sprite(AGENT, [
  '...1111111111...',
  '...1333333331...',
  '...1111111111...',
  '.....111111.....',
  '....11111111....',
  '....13333331....',
  '.....333333.....',
  '..2.22222222.2..',
  '..2.22222222.2..',
  '...2222222222...',
  '...2222222222...',
  '....22222222....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sSpyDown = sprite(SPY, [
  '................',
  '...1111111111...',
  '..111111111111..',
  '.....111111.....',
  '....33333333....',
  '....11111111....',
  '.....333333.....',
  '...1111111111...',
  '..311122211113..',
  '..311122211113..',
  '...1112221111...',
  '....11111111....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sSpyUp = sprite(SPY, [
  '................',
  '...1111111111...',
  '..111111111111..',
  '.....111111.....',
  '....11111111....',
  '....11111111....',
  '.....111111.....',
  '...1111111111...',
  '..311111111113..',
  '..311111111113..',
  '...1111111111...',
  '....11111111....',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sSpyRight = sprite(SPY, [
  '................',
  '....1111111111..',
  '...111111111111.',
  '......111111....',
  '.....113333333..',
  '.....111111111..',
  '......1333333...',
  '....1111111111..',
  '....1112221111.3',
  '....1112221111.3',
  '....1111111111..',
  '.....111111111..',
  '.....11..11.....',
  '.....11..11.....',
  '....111..111....',
  '................',
]);

const sBot = sprite(BOT, [
  '................',
  '....3......3....',
  '....1......1....',
  '..111111111111..',
  '..133333333331..',
  '..131113111131..',
  '..133333333331..',
  '..111111111111..',
  '.11133333333111.',
  '.11133333333111.',
  '..111111111111..',
  '...1111111111...',
  '....11....11....',
  '...111....111...',
  '..1111....1111..',
  '................',
]);

const sBot2 = sprite(BOT, [
  '................',
  '....1......1....',
  '....3......3....',
  '..111111111111..',
  '..133333333331..',
  '..131113111131..',
  '..133333333331..',
  '..111111111111..',
  '.11133333333111.',
  '.11133333333111.',
  '..111111111111..',
  '...1111111111...',
  '...11........11.',
  '..111........111',
  '..111........111',
  '................',
]);

/** A wind-up toy from the KGB Toys shelves. */
const windUpToy = sprite([C.YELLOW, C.RED, C.BLACK], [
  '................',
  '................',
  '................',
  '.....33333......',
  '....3111113.....',
  '....3131313.....',
  '....3111113.....',
  '....3222223.....',
  '...33222223.....',
  '....3222223.....',
  '....33333.......',
  '.....3...3......',
  '....33...33.....',
  '................',
  '................',
  '................',
]);

// ---------------------------------------------------------------------------
// Other mall people
// ---------------------------------------------------------------------------

const janitor = sprite([C.DARKBLUE, C.PALEBLUE, C.TAN], [
  '................',
  '................',
  '.....1111.......',
  '....113311......',
  '....133331......',
  '.....3333.......',
  '.....3333...1...',
  '....222222..1...',
  '...2222222..1...',
  '...22222223.1...',
  '...2222222..1...',
  '...2222222..1...',
  '...2222222..1...',
  '...2222222.111..',
  '...2222222.222..',
  '...2222222.222..',
  '....222222......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
  '................',
]);

const walker = sprite([C.TEAL, C.PALECYAN, C.TAN], [
  '................',
  '................',
  '.....2222.......',
  '....233332......',
  '....333333......',
  '.....3333.......',
  '.....3333.......',
  '....111111......',
  '...1111111......',
  '..31111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...2222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....22.22......',
  '....22...22.....',
  '....22...22.....',
  '...111...111....',
  '...111...111....',
  '................',
  '................',
]);

const copSegway = sprite([C.NAVY, C.PALEYELLOW, C.TAN], [
  '................',
  '.....2222.......',
  '....222222......',
  '....133331......',
  '....133331......',
  '.....3333.......',
  '....111111......',
  '...11111112.....',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '...1111111......',
  '....111111......',
  '.....1111.......',
  '.....1111.......',
  '.....1111.......',
  '....111111......',
  '.....2222.......',
  '.....1111.......',
  '...11111111.....',
  '..1111111111....',
  '..1111111111....',
  '...11111111.....',
  '................',
]);

/** The old clerk in the GameStonk cave scene. */
const clerk = sprite([C.WHITE, C.RED, C.TAN], [
  '................',
  '.....1111.......',
  '....111111......',
  '....133331......',
  '....133331......',
  '.....3333.......',
  '....111111......',
  '...1111111......',
  '...2222222......',
  '..22222222......',
  '..22222222......',
  '..22222222......',
  '..22222222......',
  '..22222222......',
  '...2222222......',
  '...2222222......',
  '....222222......',
  '.....2222.......',
  '.....11.11......',
  '.....11.11......',
  '....111.111.....',
  '................',
  '................',
  '................',
]);

// ---------------------------------------------------------------------------
// Procedural props, items and effects
// ---------------------------------------------------------------------------

function makeBullet(): Sprite {
  const s = blank(4, 3, [C.PALEYELLOW, C.ORANGE, C.WHITE]);
  rect(s, 0, 1, 4, 1, 2);
  rect(s, 1, 0, 2, 3, 1);
  px(s, 3, 1, 3);
  return s;
}

function makeEnemyBullet(): Sprite {
  const s = blank(4, 3, [C.PALERED, C.RED, C.WHITE]);
  rect(s, 0, 1, 4, 1, 2);
  rect(s, 1, 0, 2, 3, 1);
  return s;
}

/** The elevator car: a platform with doors that close while it moves. */
function makeCar(doorsOpen: boolean): Sprite {
  const s = blank(32, 40, [C.DARKGREY, C.LIGHTGREY, C.YELLOW]);
  frame(s, 0, 0, 32, 40, 1);
  rect(s, 1, 1, 30, 38, 2);
  // Interior shadow.
  rect(s, 2, 2, 28, 36, 1);
  if (doorsOpen) {
    rect(s, 2, 2, 5, 36, 2);
    rect(s, 25, 2, 5, 36, 2);
  } else {
    rect(s, 2, 2, 13, 36, 2);
    rect(s, 17, 2, 13, 36, 2);
    vline(s, 15, 2, 36, 1);
    vline(s, 16, 2, 36, 1);
  }
  // Floor plate and ceiling light.
  rect(s, 1, 37, 30, 2, 1);
  rect(s, 13, 1, 6, 2, 3);
  return s;
}

/** The grate you can stand on when the car is above. */
function makeGrate(): Sprite {
  const s = blank(32, 6, [C.DARKGREY, C.GREY, C.LIGHTGREY]);
  rect(s, 0, 0, 32, 6, 1);
  for (let x = 0; x < 32; x += 4) rect(s, x + 1, 1, 2, 4, 2);
  hline(s, 0, 0, 32, 3);
  return s;
}

/** An open pit: the dark shaft below. */
function makePit(): Sprite {
  const s = blank(32, 8, [C.BLACK, C.DARKGREY, C.GREY]);
  rect(s, 0, 0, 32, 8, 1);
  hline(s, 0, 0, 32, 2);
  hline(s, 0, 1, 32, 3);
  return s;
}

function makeLamp(): Sprite {
  const s = blank(14, 20, [C.DARKGREY, C.YELLOW, C.PALEYELLOW]);
  vline(s, 7, 0, 8, 1);
  // Shade.
  for (let y = 0; y < 6; y++) rect(s, 4 - y + 3, 8 + y, 2 * y + 2, 1, 1);
  rect(s, 2, 14, 10, 2, 2);
  rect(s, 4, 16, 6, 2, 3);
  return s;
}

function makeDiscoBall(): Sprite {
  const s = blank(14, 20, [C.DARKGREY, C.LIGHTGREY, C.WHITE]);
  vline(s, 7, 0, 5, 1);
  disc(s, 7, 12, 6, 2);
  // Facets.
  for (let y = 7; y <= 17; y += 2) for (let x = 2; x < 13; x += 3) px(s, x + (y & 2 ? 1 : 0), y, 3);
  ring(s, 7, 12, 6, 1);
  return s;
}

function makeBrokenLamp(): Sprite {
  const s = blank(16, 6, [C.DARKGREY, C.YELLOW, C.WHITE]);
  for (let i = 0; i < 16; i += 3) {
    px(s, i, 4, 2);
    px(s, i + 1, 5, 1);
    px(s, i + 2, 3, 3);
  }
  hline(s, 0, 5, 16, 1);
  return s;
}

function makeCoin(gold: boolean): Sprite {
  const s = blank(8, 8, gold ? [C.ORANGE, C.PALEYELLOW, C.WHITE] : [C.OLIVE, C.YELLOW, C.PALEYELLOW]);
  disc(s, 3, 3, 3, 2);
  ring(s, 3, 3, 3, 1);
  px(s, 2, 2, 3);
  px(s, 3, 2, 3);
  return s;
}

function makePackage(): Sprite {
  const s = blank(12, 10, [C.BROWN, C.TAN, C.DARKRED]);
  rect(s, 0, 0, 12, 10, 2);
  frame(s, 0, 0, 12, 10, 1);
  rect(s, 5, 0, 2, 10, 1);
  hline(s, 0, 4, 12, 1);
  px(s, 1, 1, 3);
  px(s, 10, 8, 3);
  return s;
}

/** Power-up pickup icons, 12x12. */
function makePowerUpIcon(id: string): Sprite {
  switch (id) {
    case 'rapid': {
      const s = blank(12, 12, [C.BLACK, C.ORANGE, C.PALEYELLOW]);
      rect(s, 1, 4, 10, 4, 2);
      frame(s, 1, 4, 10, 4, 1);
      rect(s, 8, 1, 3, 2, 3);
      rect(s, 8, 9, 3, 2, 3);
      return s;
    }
    case 'spread': {
      const s = blank(12, 12, [C.BLACK, C.CYAN, C.WHITE]);
      for (const dy of [-3, 0, 3]) {
        for (let i = 0; i < 8; i++) px(s, 2 + i, 6 + Math.round((dy * i) / 8), 2);
      }
      disc(s, 2, 6, 2, 3);
      frame(s, 0, 0, 12, 12, 1);
      return s;
    }
    case 'armor': {
      const s = blank(12, 12, [C.BLACK, C.GREY, C.LIGHTGREY]);
      for (let y = 0; y < 10; y++) {
        const w = y < 6 ? 10 : 10 - (y - 5) * 2;
        rect(s, 1 + (10 - w) / 2, 1 + y, w, 1, 2);
      }
      rect(s, 5, 3, 2, 5, 3);
      rect(s, 3, 4, 6, 2, 3);
      return s;
    }
    case 'sneakers': {
      const s = blank(12, 12, [C.BLACK, C.WHITE, C.RED]);
      rect(s, 1, 6, 10, 4, 2);
      rect(s, 1, 9, 10, 1, 1);
      rect(s, 2, 3, 5, 4, 2);
      rect(s, 3, 4, 3, 1, 3);
      rect(s, 3, 6, 3, 1, 3);
      return s;
    }
    case 'radar': {
      const s = blank(12, 12, [C.BLACK, C.LIGHTGREEN, C.WHITE]);
      ring(s, 6, 6, 5, 2);
      ring(s, 6, 6, 3, 2);
      px(s, 6, 6, 3);
      for (let i = 0; i < 5; i++) px(s, 6 + i, 6 - i, 3);
      return s;
    }
    case 'oneup': {
      const s = blank(12, 12, [C.BLACK, C.LIGHTGREEN, C.WHITE]);
      rect(s, 0, 1, 12, 10, 2);
      frame(s, 0, 1, 12, 10, 1);
      // A tiny "1U".
      rect(s, 3, 4, 1, 4, 3);
      px(s, 2, 5, 3);
      rect(s, 7, 4, 1, 4, 3);
      rect(s, 9, 4, 1, 4, 3);
      rect(s, 7, 7, 3, 1, 3);
      return s;
    }
    case 'cinnabomb': {
      const s = blank(12, 12, [C.BROWN, C.LIGHTORANGE, C.WHITE]);
      disc(s, 6, 6, 5, 2);
      // Spiral.
      for (let a = 0; a < 26; a++) {
        const t = (a / 26) * Math.PI * 3;
        const r = 1 + (a / 26) * 4;
        px(s, Math.round(6 + Math.cos(t) * r), Math.round(6 + Math.sin(t) * r), 1);
      }
      px(s, 4, 3, 3);
      return s;
    }
    case 'oj': {
      const s = blank(12, 12, [C.RED, C.LIGHTORANGE, C.WHITE]);
      rect(s, 2, 3, 8, 8, 2);
      rect(s, 2, 3, 8, 1, 3);
      rect(s, 5, 0, 2, 4, 1);
      px(s, 4, 6, 3);
      return s;
    }
    case 'pretzel':
    default: {
      const s = blank(12, 12, [C.DARKBROWN, C.TAN, C.WHITE]);
      ring(s, 4, 7, 3, 2);
      ring(s, 8, 7, 3, 2);
      for (let i = 0; i < 6; i++) {
        px(s, 3 + i, 2 + Math.abs(3 - i), 2);
      }
      px(s, 2, 5, 3);
      px(s, 9, 9, 3);
      return s;
    }
  }
}

/** The wood-panelled getaway station wagon. */
function makeStationWagon(): Sprite {
  const s = blank(48, 24, [C.DARKBROWN, C.TAN, C.PALEBLUE]);
  // Body.
  rect(s, 2, 10, 44, 9, 1);
  rect(s, 4, 12, 40, 5, 2); // wood panelling
  for (let x = 6; x < 44; x += 4) vline(s, x, 12, 5, 1);
  // Cabin and windows.
  rect(s, 10, 4, 28, 7, 1);
  rect(s, 12, 6, 11, 4, 3);
  rect(s, 25, 6, 11, 4, 3);
  // Wheels.
  disc(s, 11, 20, 3, 1);
  disc(s, 37, 20, 3, 1);
  px(s, 11, 20, 2);
  px(s, 37, 20, 2);
  // Headlight.
  rect(s, 45, 12, 2, 2, 2);
  return s;
}

function makeKiosk(): Sprite {
  const s = blank(20, 28, [C.DARKTEAL, C.PALECYAN, C.WHITE]);
  rect(s, 8, 18, 4, 10, 1);
  rect(s, 2, 2, 16, 17, 1);
  rect(s, 4, 4, 12, 13, 2);
  // A tiny map on the screen.
  for (let y = 0; y < 5; y++) hline(s, 5, 6 + y * 2, 10, 3);
  rect(s, 2, 0, 16, 2, 3);
  return s;
}

function makePhotoBooth(): Sprite {
  const s = blank(24, 36, [C.PURPLE, C.MAGENTA, C.PALEYELLOW]);
  rect(s, 0, 0, 24, 36, 1);
  rect(s, 2, 4, 20, 30, 2);
  // Curtain.
  for (let x = 3; x < 21; x += 3) vline(s, x, 6, 26, 1);
  rect(s, 2, 0, 20, 4, 3);
  rect(s, 17, 10, 5, 6, 3);
  return s;
}

function makeFountain(): Sprite {
  const s = blank(28, 24, [C.GREY, C.LIGHTBLUE, C.WHITE]);
  // Basin.
  rect(s, 0, 16, 28, 8, 1);
  rect(s, 2, 18, 24, 4, 2);
  // Column and spray.
  rect(s, 12, 6, 4, 11, 1);
  disc(s, 14, 5, 3, 2);
  for (const dx of [-6, -3, 3, 6]) {
    for (let i = 0; i < 5; i++) px(s, 14 + dx + Math.sign(dx) * i, 4 + i * 2, 3);
  }
  return s;
}

function makeBench(): Sprite {
  const s = blank(28, 14, [C.DARKBROWN, C.BROWN, C.GREY]);
  rect(s, 0, 4, 28, 3, 2);
  rect(s, 0, 0, 28, 2, 2);
  hline(s, 0, 4, 28, 1);
  rect(s, 2, 7, 3, 7, 3);
  rect(s, 23, 7, 3, 7, 3);
  return s;
}

function makePlant(): Sprite {
  const s = blank(20, 24, [C.BROWN, C.GREEN, C.LIGHTGREEN]);
  rect(s, 5, 16, 10, 8, 1);
  rect(s, 4, 16, 12, 2, 1);
  disc(s, 10, 10, 6, 2);
  disc(s, 6, 8, 3, 3);
  disc(s, 14, 12, 3, 3);
  vline(s, 10, 12, 5, 1);
  return s;
}

function makePillar(): Sprite {
  const s = blank(20, 48, [C.DARKGREY, C.GREY, C.LIGHTGREY]);
  rect(s, 2, 0, 16, 48, 2);
  vline(s, 3, 0, 48, 3);
  vline(s, 16, 0, 48, 1);
  rect(s, 0, 0, 20, 3, 1);
  rect(s, 0, 44, 20, 4, 1);
  return s;
}

/** The zip-line anchor post on the roof. */
function makeAnchorPost(): Sprite {
  const s = blank(12, 28, [C.DARKGREY, C.LIGHTGREY, C.YELLOW]);
  rect(s, 4, 0, 4, 28, 2);
  rect(s, 1, 24, 10, 4, 1);
  rect(s, 2, 0, 8, 3, 3);
  return s;
}

/** The wet-floor sign the janitor leaves. */
function makeWetSign(): Sprite {
  const s = blank(12, 16, [C.ORANGE, C.YELLOW, C.BLACK]);
  for (let y = 0; y < 14; y++) {
    const w = 2 + Math.round((y / 13) * 8);
    rect(s, 6 - w / 2, y + 2, w, 1, 2);
  }
  rect(s, 5, 6, 2, 4, 3);
  px(s, 5, 11, 3);
  px(s, 6, 11, 3);
  return s;
}

function makeMop(): Sprite {
  const s = blank(8, 10, [C.BROWN, C.PALEYELLOW, C.WHITE]);
  vline(s, 4, 0, 6, 1);
  rect(s, 1, 6, 7, 4, 2);
  for (let x = 1; x < 8; x += 2) px(s, x, 9, 3);
  return s;
}

/** Smoke puff, used for traps, "nothing here" and the vanishing clerk. */
function makePuff(n: number): Sprite {
  const s = blank(16, 16, [C.GREY, C.LIGHTGREY, C.WHITE]);
  const r = 2 + n * 2;
  disc(s, 8, 8, r, 2);
  ring(s, 8, 8, r, 1);
  disc(s, 5, 6, Math.max(1, r - 3), 3);
  return s;
}

/** The shattering-glass burst. */
function makeShatter(): Sprite {
  const s = blank(16, 12, [C.WHITE, C.PALECYAN, C.LIGHTBLUE]);
  for (let i = 0; i < 16; i++) {
    px(s, i, 6 + ((i * 5) % 6) - 3, (i % 3) + 1);
    px(s, i, 6 - ((i * 3) % 5) + 2, ((i + 1) % 3) + 1);
  }
  return s;
}

/** HUD icons. */
function makeHeadIcon(): Sprite {
  const s = blank(8, 8, [C.BLACK, C.RED, C.TAN]);
  rect(s, 1, 0, 6, 2, 1);
  rect(s, 1, 2, 6, 3, 3);
  rect(s, 1, 2, 6, 1, 1);
  rect(s, 0, 5, 8, 3, 2);
  return s;
}

function makeArmorIcon(): Sprite {
  const s = blank(8, 8, [C.GREY, C.LIGHTGREY, C.WHITE]);
  for (let y = 0; y < 8; y++) {
    const w = y < 5 ? 8 : 8 - (y - 4) * 2;
    rect(s, (8 - w) / 2, y, w, 1, 2);
  }
  rect(s, 3, 1, 2, 5, 3);
  return s;
}

function makeRadarIcon(): Sprite {
  const s = blank(8, 8, [C.DARKGREEN, C.LIGHTGREEN, C.WHITE]);
  ring(s, 4, 4, 3, 2);
  px(s, 4, 4, 3);
  for (let i = 0; i < 3; i++) px(s, 4 + i, 4 - i, 3);
  return s;
}

/** The SPYGRAM phone-flash burst. */
function makeFlash(): Sprite {
  const s = blank(16, 16, [C.WHITE, C.PALEYELLOW, C.YELLOW]);
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    for (let r = 2; r < 8; r++) {
      px(s, Math.round(8 + Math.cos(t) * r), Math.round(8 + Math.sin(t) * r), r < 5 ? 1 : 2);
    }
  }
  disc(s, 8, 8, 2, 3);
  return s;
}

/** A 4-frame photo strip, the photo-booth souvenir. */
function makePhotoStrip(): Sprite {
  const s = blank(16, 40, [C.BLACK, C.WHITE, C.RED]);
  rect(s, 0, 0, 16, 40, 2);
  for (let i = 0; i < 4; i++) {
    frame(s, 2, 2 + i * 9, 12, 8, 1);
    rect(s, 4, 4 + i * 9, 8, 4, 3);
    px(s, 6, 5 + i * 9, 1);
    px(s, 9, 5 + i * 9, 1);
  }
  return s;
}

/** Flickering demo TV for the GameStonk cave. */
function makeDemoTv(on: boolean): Sprite {
  const s = blank(16, 16, [C.DARKGREY, C.LIGHTGREY, on ? C.PALECYAN : C.DARKGREY]);
  rect(s, 0, 1, 16, 13, 1);
  rect(s, 2, 3, 12, 9, 3);
  rect(s, 0, 14, 16, 2, 2);
  if (on) for (let y = 3; y < 12; y += 2) hline(s, 2, y, 12, 1);
  return s;
}

function makePedestal(): Sprite {
  const s = blank(16, 12, [C.DARKGREY, C.GREY, C.PALEYELLOW]);
  rect(s, 3, 4, 10, 8, 2);
  rect(s, 1, 2, 14, 3, 1);
  rect(s, 5, 0, 6, 3, 3);
  return s;
}

/** A shutter, for closed stores and the game-over roll-down. */
export function makeShutter(w: number, h: number): Sprite {
  const s = blank(w, h, [C.DARKGREY, C.GREY, C.LIGHTGREY]);
  rect(s, 0, 0, w, h, 2);
  for (let y = 0; y < h; y += 3) hline(s, 0, y, w, 1);
  hline(s, 0, 0, w, 3);
  return s;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SPRITES = {
  // Agent, mall
  agentIdle,
  agentWalk1,
  agentWalk2,
  agentDuck,
  agentJump,
  agentShoot,
  agentShootDuck,
  agentDead,
  agentZip,
  agentLand,
  agentSelfie,
  agentHold,
  // Spy, mall
  spyIdle,
  spyWalk,
  spyAim,
  spyAimLow,
  spyDuck,
  spyDead,
  // Store view
  sAgentDown,
  sAgentDown2,
  sAgentUp,
  sAgentUp2,
  sAgentRight,
  sAgentRight2,
  sAgentHold,
  sSpyDown,
  sSpyUp,
  sSpyRight,
  sBot,
  sBot2,
  windUpToy,
  // Other people
  janitor,
  walker,
  copSegway,
  clerk,
  // Projectiles
  bullet: makeBullet(),
  enemyBullet: makeEnemyBullet(),
  // Elevators
  carOpen: makeCar(true),
  carClosed: makeCar(false),
  grate: makeGrate(),
  pit: makePit(),
  // Lights
  lamp: makeLamp(),
  discoBall: makeDiscoBall(),
  brokenLamp: makeBrokenLamp(),
  // Items
  coin: makeCoin(false),
  goldCoin: makeCoin(true),
  packageBox: makePackage(),
  puRapid: makePowerUpIcon('rapid'),
  puSpread: makePowerUpIcon('spread'),
  puArmor: makePowerUpIcon('armor'),
  puSneakers: makePowerUpIcon('sneakers'),
  puRadar: makePowerUpIcon('radar'),
  puOneup: makePowerUpIcon('oneup'),
  puCinnabomb: makePowerUpIcon('cinnabomb'),
  puOj: makePowerUpIcon('oj'),
  puPretzel: makePowerUpIcon('pretzel'),
  // Props
  stationWagon: makeStationWagon(),
  kiosk: makeKiosk(),
  photoBooth: makePhotoBooth(),
  fountain: makeFountain(),
  bench: makeBench(),
  plant: makePlant(),
  pillar: makePillar(),
  anchorPost: makeAnchorPost(),
  wetSign: makeWetSign(),
  mop: makeMop(),
  pedestal: makePedestal(),
  demoTvOn: makeDemoTv(true),
  demoTvOff: makeDemoTv(false),
  photoStrip: makePhotoStrip(),
  // Effects
  puff1: makePuff(1),
  puff2: makePuff(2),
  puff3: makePuff(3),
  shatter: makeShatter(),
  flash: makeFlash(),
  // HUD
  headIcon: makeHeadIcon(),
  armorIcon: makeArmorIcon(),
  radarIcon: makeRadarIcon(),
} as const;

export type SpriteName = keyof typeof SPRITES;

/** Power-up id -> icon, for pickups and the HUD. */
export const POWERUP_ICONS: Record<string, Sprite> = {
  rapid: SPRITES.puRapid,
  spread: SPRITES.puSpread,
  armor: SPRITES.puArmor,
  sneakers: SPRITES.puSneakers,
  radar: SPRITES.puRadar,
  oneup: SPRITES.puOneup,
  cinnabomb: SPRITES.puCinnabomb,
  oj: SPRITES.puOj,
  pretzel: SPRITES.puPretzel,
};

/** Palettes used to flash the agent while invulnerable. */
export const AGENT_FLASH: ColorTriple = AGENT_HURT;
