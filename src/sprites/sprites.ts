export interface SpriteData {
  width: number;
  height: number;
  pixels: number[][];
  frames?: number[][][];
  palette: number[];
}

// Palette indices into NES_PALETTE:
// Common palettes
const PAL_AGENT = [0x16, 0x05, 0x0C];    // red coat, dark magenta, dark teal (skin via idx 2 area)
const PAL_SPY = [0x0D, 0x00, 0x10];       // black, dark grey, grey
const PAL_BULLET_P = [0x28, 0x17, 0x07];  // yellow-green, orange, brown
const PAL_BULLET_E = [0x16, 0x05, 0x0D];  // red, magenta, black
const PAL_ELEVATOR = [0x00, 0x10, 0x20];  // dark grey, grey, white
const PAL_ITEM = [0x28, 0x18, 0x08];      // yellow, green, dark green
const PAL_UI = [0x20, 0x16, 0x12];        // white, red, blue

// Helper: create a filled rect sprite
function solidRect(w: number, h: number, color: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(color));
}

// Helper: overlay pattern onto a base
function withPattern(base: number[][], pattern: [number, number, number][]): number[][] {
  const result = base.map(r => [...r]);
  for (const [y, x, c] of pattern) {
    if (y < result.length && x < result[0].length) result[y][x] = c;
  }
  return result;
}

// ---- AGENT (mall side-view, 16x24) ----
const agentStand: number[][] = [
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,3,2,2,3,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
  [0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0],
  [0,0,0,0,1,1,3,0,0,3,1,1,0,0,0,0],
  [0,0,0,0,1,3,3,0,0,3,3,1,0,0,0,0],
  [0,0,0,0,1,3,3,0,0,3,3,1,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0],
];

const agentWalk1: number[][] = agentStand.map((row, y) => {
  if (y >= 20 && y <= 22) {
    const r = [...row];
    if (y === 20) { r[4] = 0; r[5] = 1; r[10] = 1; r[11] = 0; }
    return r;
  }
  return [...row];
});

const agentWalk2: number[][] = agentStand.map((row, y) => {
  if (y >= 20 && y <= 22) {
    const r = [...row];
    if (y === 22) { r[4] = 2; r[5] = 2; r[10] = 2; r[11] = 2; }
    return r;
  }
  return [...row];
});

const agentWalk3 = agentWalk1;

const agentJump: number[][] = agentStand.map((row, y) => {
  const r = [...row];
  if (y >= 18 && y <= 20) {
    // legs bent
    if (y === 18) { r[4] = 1; r[5] = 3; r[10] = 3; r[11] = 1; }
    if (y === 19) { r[3] = 1; r[4] = 3; r[11] = 3; r[12] = 1; }
    if (y === 20) { r[3] = 0; r[4] = 2; r[11] = 2; r[12] = 0; }
  }
  if (y >= 21) r.fill(0);
  return r;
});

const agentDuck: number[][] = Array.from({ length: 24 }, (_, y) => {
  if (y < 8) return Array(16).fill(0);
  if (y < 16) return agentStand[y - 8].slice();
  if (y < 20) return agentStand[y - 2].slice();
  return agentStand[Math.min(y, 23)].slice();
});

const agentShoot: number[][] = agentStand.map((row, y) => {
  const r = [...row];
  if (y === 9 || y === 10) { r[13] = 1; r[14] = 3; r[15] = 3; }
  return r;
});

const agentShootDuck: number[][] = agentDuck.map((row, y) => {
  const r = [...row];
  if (y === 15 || y === 16) { r[13] = 1; r[14] = 3; r[15] = 3; }
  return r;
});

const agentDeath: number[][] = Array.from({ length: 24 }, (_, y) => {
  if (y < 8 || y > 16) return Array(16).fill(0);
  // sideways fallen agent
  const r = Array(16).fill(0);
  if (y >= 10 && y <= 14) {
    for (let x = 2; x < 14; x++) r[x] = 1;
    if (y === 10 || y === 14) { r[2] = 0; r[13] = 0; }
  }
  if (y === 12) { r[1] = 2; r[14] = 2; }
  return r;
});

const agentHoldItem: number[][] = agentStand.map((row, y) => {
  const r = [...row];
  if (y === 0) { r[6] = 3; r[7] = 3; r[8] = 3; r[9] = 3; }
  if (y === 1) { r[5] = 0; r[10] = 0; }
  return r;
});

// ---- AGENT (store top-down, 16x16) ----
const agentStoreDown: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,0,0,1,3,2,2,2,3,2,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,3,1,1,1,1,1,1,1,1,3,1,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,3,3,0,0,3,3,0,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const agentStoreUp: number[][] = agentStoreDown.map(r => [...r]);
const agentStoreLeft: number[][] = agentStoreDown.map(r => [...r]);
const agentStoreRight: number[][] = agentStoreDown.map(r => [...r]);

const agentStoreSearch: number[][] = agentStoreDown.map((row, y) => {
  const r = [...row];
  if (y === 6) { r[13] = 3; r[14] = 3; }
  return r;
});

// ---- SPY (mall side-view, 16x24) ----
const spyStand: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,3,2,2,3,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0],
];

const spyWalk1 = spyStand.map((row, y) => {
  const r = [...row];
  if (y === 22) { r[4] = 0; r[5] = 1; r[10] = 1; r[11] = 0; }
  return r;
});

const spyWalk2 = spyStand.map((row, y) => {
  const r = [...row];
  if (y === 23) { r[4] = 2; r[5] = 2; r[10] = 2; r[11] = 2; }
  return r;
});

const spyAim: number[][] = spyStand.map((row, y) => {
  const r = [...row];
  if (y === 9 || y === 10) { r[13] = 1; r[14] = 2; r[15] = 2; }
  return r;
});

const spyShootHigh = spyAim;

const spyShootLow: number[][] = spyStand.map((row, y) => {
  const r = [...row];
  if (y === 13 || y === 14) { r[13] = 1; r[14] = 2; r[15] = 2; }
  return r;
});

const spyDuck: number[][] = Array.from({ length: 24 }, (_, y) => {
  if (y < 8) return Array(16).fill(0);
  return spyStand[Math.min(y - 4, 23)].slice();
});

const spyDeath: number[][] = Array.from({ length: 24 }, (_, y) => {
  if (y < 8 || y > 16) return Array(16).fill(0);
  const r = Array(16).fill(0);
  if (y >= 10 && y <= 14) {
    for (let x = 2; x < 14; x++) r[x] = 1;
  }
  return r;
});

// ---- SPY (store top-down, 16x16) ----
const spyStoreDown: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,3,1,1,1,3,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,2,1,1,1,1,1,1,1,1,2,1,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ---- SECURITY BOT (store, 16x16) ----
const securityBot: number[][] = [
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,1,2,3,2,2,3,2,1,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
  [0,0,0,1,1,1,2,2,2,2,1,1,1,0,0,0],
  [0,0,0,1,3,1,2,2,2,2,1,3,1,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,2,1,0,0,1,2,1,0,0,0,0],
  [0,0,0,0,1,2,1,0,0,1,2,1,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ---- BULLETS ----
const bulletPlayer: number[][] = [
  [0,1,1,0],
  [1,2,2,1],
];

const bulletEnemy: number[][] = [
  [0,1,1,0],
  [1,2,2,1],
];

// ---- ELEVATOR CAR (24x48, closed) ----
const elevatorClosed: number[][] = Array.from({ length: 48 }, (_, y) => {
  const r = Array(24).fill(0);
  if (y === 0) { for (let x = 2; x < 22; x++) r[x] = 1; }
  else if (y === 47) { for (let x = 2; x < 22; x++) r[x] = 1; }
  else if (y >= 1 && y <= 46) {
    r[2] = 1; r[3] = 1; r[20] = 1; r[21] = 1;
    if (y >= 4 && y <= 43) {
      // door panels
      for (let x = 4; x < 12; x++) r[x] = 2;
      for (let x = 12; x < 20; x++) r[x] = 3;
    } else {
      for (let x = 4; x < 20; x++) r[x] = 1;
    }
  }
  return r;
});

const elevatorOpen: number[][] = Array.from({ length: 48 }, (_, y) => {
  const r = Array(24).fill(0);
  if (y === 0 || y === 47) { for (let x = 2; x < 22; x++) r[x] = 1; }
  else if (y >= 1 && y <= 46) {
    r[2] = 1; r[3] = 1; r[20] = 1; r[21] = 1;
    if (y >= 4 && y <= 43) {
      r[4] = 2; r[5] = 2;
      r[18] = 2; r[19] = 2;
      // open space in middle
    } else {
      for (let x = 4; x < 20; x++) r[x] = 1;
    }
  }
  return r;
});

// ---- ESCALATOR (32x48) ----
const escalatorFrame: number[][] = Array.from({ length: 48 }, (_, y) => {
  const r = Array(32).fill(0);
  // diagonal steps pattern
  const step = Math.floor(y / 6);
  const offset = step * 4;
  if (offset < 28) {
    for (let x = offset; x < offset + 6 && x < 32; x++) {
      r[x] = (y % 6 < 2) ? 1 : 2;
    }
  }
  // handrails
  r[0] = 3; r[31] = 3;
  return r;
});

// ---- MALL COP (16x24) ----
const mallCop: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(16).fill(0);
  // Head with helmet
  if (y >= 0 && y <= 2) { for (let x = 5; x <= 10; x++) r[x] = 2; }
  if (y >= 3 && y <= 5) { for (let x = 5; x <= 10; x++) r[x] = 3; r[6] = 1; r[9] = 1; }
  // Body (blue uniform)
  if (y >= 6 && y <= 14) { for (let x = 4; x <= 11; x++) r[x] = 2; }
  // Segway
  if (y >= 15 && y <= 19) { for (let x = 3; x <= 12; x++) r[x] = 1; }
  if (y >= 20 && y <= 21) { r[4] = 1; r[5] = 1; r[10] = 1; r[11] = 1; }
  if (y >= 22 && y <= 23) { r[3] = 2; r[4] = 2; r[5] = 2; r[10] = 2; r[11] = 2; r[12] = 2; }
  return r;
});

// ---- JANITOR (16x24) ----
const janitor: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(16).fill(0);
  if (y >= 0 && y <= 4) { for (let x = 6; x <= 9; x++) r[x] = 3; } // head
  if (y >= 5 && y <= 14) { for (let x = 5; x <= 10; x++) r[x] = 2; } // body overalls
  if (y >= 5 && y <= 14) { r[12] = 1; r[13] = 1; } // mop handle
  if (y >= 15 && y <= 17) { r[12] = 2; r[13] = 2; r[14] = 2; } // mop head
  if (y >= 15 && y <= 20) { for (let x = 5; x <= 6; x++) r[x] = 1; for (let x = 9; x <= 10; x++) r[x] = 1; }
  if (y >= 21 && y <= 23) { r[5] = 2; r[6] = 2; r[9] = 2; r[10] = 2; }
  return r;
});

// ---- MALL WALKER (16x24) ----
const mallWalker: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(16).fill(0);
  if (y >= 0 && y <= 4) { for (let x = 6; x <= 9; x++) r[x] = 3; } // head
  if (y >= 5 && y <= 15) { for (let x = 4; x <= 11; x++) r[x] = 2; } // tracksuit
  if (y === 8) { for (let x = 4; x <= 11; x++) r[x] = 1; } // stripe
  if (y >= 16 && y <= 20) { r[5] = 2; r[6] = 2; r[9] = 2; r[10] = 2; }
  if (y >= 21 && y <= 23) { r[5] = 1; r[6] = 1; r[9] = 1; r[10] = 1; }
  return r;
});

// ---- LAMP (8x16) ----
const lamp: number[][] = Array.from({ length: 16 }, (_, y) => {
  const r = Array(8).fill(0);
  if (y === 0) { r[3] = 1; r[4] = 1; } // mount
  if (y >= 1 && y <= 3) { r[3] = 1; r[4] = 1; } // cord
  if (y >= 4 && y <= 6) { r[2] = 2; r[3] = 2; r[4] = 2; r[5] = 2; } // shade top
  if (y >= 7 && y <= 10) { r[1] = 2; r[2] = 3; r[3] = 3; r[4] = 3; r[5] = 3; r[6] = 2; }
  if (y === 11) { r[2] = 2; r[3] = 2; r[4] = 2; r[5] = 2; }
  return r;
});

// ---- DISCO BALL (8x8) ----
const discoBall1: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,3,2,3,1,0],
  [1,3,2,3,2,3,2,1],
  [1,2,3,2,3,2,3,1],
  [1,3,2,3,2,3,2,1],
  [1,2,3,2,3,2,3,1],
  [0,1,3,2,3,2,1,0],
  [0,0,1,1,1,1,0,0],
];

const discoBall2: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,3,2,3,2,1,0],
  [1,2,3,2,3,2,3,1],
  [1,3,2,3,2,3,2,1],
  [1,2,3,2,3,2,3,1],
  [1,3,2,3,2,3,2,1],
  [0,1,2,3,2,3,1,0],
  [0,0,1,1,1,1,0,0],
];

// ---- FOUNTAIN (16x16) ----
const fountain1: number[][] = Array.from({ length: 16 }, (_, y) => {
  const r = Array(16).fill(0);
  if (y <= 2) { r[7] = 2; r[8] = 2; } // water jet
  if (y === 3) { r[6] = 3; r[7] = 2; r[8] = 2; r[9] = 3; }
  if (y >= 4 && y <= 6) { for (let x = 4; x <= 11; x++) r[x] = 3; } // basin
  if (y === 5) { for (let x = 5; x <= 10; x++) r[x] = 2; }
  if (y >= 7 && y <= 9) { for (let x = 6; x <= 9; x++) r[x] = 1; } // pedestal
  if (y >= 10 && y <= 12) { for (let x = 3; x <= 12; x++) r[x] = 1; } // base
  if (y >= 13 && y <= 15) { for (let x = 2; x <= 13; x++) r[x] = 1; }
  return r;
});

const fountain2: number[][] = fountain1.map((row, y) => {
  const r = [...row];
  if (y <= 1) { r[6] = 3; r[9] = 3; } // splash
  return r;
});

// ---- KIOSK (16x24) ----
const kiosk: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(16).fill(0);
  if (y >= 0 && y <= 3) { for (let x = 3; x <= 12; x++) r[x] = 2; } // header
  if (y >= 4 && y <= 16) { for (let x = 4; x <= 11; x++) r[x] = 3; r[3] = 1; r[12] = 1; } // screen
  if (y >= 17 && y <= 20) { for (let x = 5; x <= 10; x++) r[x] = 1; } // stand
  if (y >= 21 && y <= 23) { for (let x = 3; x <= 12; x++) r[x] = 1; } // base
  return r;
});

// ---- PHOTO BOOTH (16x24) ----
const photoBooth: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(16).fill(0);
  if (y >= 0 && y <= 2) { for (let x = 2; x <= 13; x++) r[x] = 1; } // top
  if (y >= 3 && y <= 20) {
    r[2] = 1; r[13] = 1;
    if (y >= 6 && y <= 18) { for (let x = 3; x <= 12; x++) r[x] = 2; } // interior
    else { for (let x = 3; x <= 12; x++) r[x] = 1; }
  }
  if (y >= 14 && y <= 18) { r[4] = 3; r[5] = 3; } // curtain
  if (y >= 21 && y <= 23) { for (let x = 2; x <= 13; x++) r[x] = 1; }
  return r;
});

// ---- STATION WAGON (48x24) ----
const stationWagon: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(48).fill(0);
  // car body
  if (y >= 4 && y <= 8) { for (let x = 8; x <= 40; x++) r[x] = 1; } // roof
  if (y >= 6 && y <= 8) { for (let x = 12; x <= 20; x++) r[x] = 2; for (let x = 24; x <= 36; x++) r[x] = 2; } // windows
  if (y >= 9 && y <= 16) { for (let x = 4; x <= 44; x++) r[x] = 1; } // body
  if (y >= 10 && y <= 15) { for (let x = 6; x <= 42; x++) r[x] = 3; } // wood paneling
  if (y >= 17 && y <= 18) { for (let x = 4; x <= 44; x++) r[x] = 1; } // bottom
  // wheels
  if (y >= 19 && y <= 22) { for (let x = 8; x <= 13; x++) r[x] = 1; for (let x = 34; x <= 39; x++) r[x] = 1; }
  if (y >= 20 && y <= 21) { for (let x = 9; x <= 12; x++) r[x] = 2; for (let x = 35; x <= 38; x++) r[x] = 2; }
  // headlights/taillights
  if (y >= 12 && y <= 14) { r[4] = 2; r[5] = 2; r[43] = 2; r[44] = 2; }
  return r;
});

// ---- COIN (8x8) ----
const coin1: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,2,3,3,2,2,1],
  [1,2,3,2,2,3,2,1],
  [1,2,3,2,2,3,2,1],
  [1,2,2,3,3,2,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
];

const coin2: number[][] = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,2,2,1,0,0],
  [0,0,1,3,3,1,0,0],
  [0,0,1,2,2,1,0,0],
  [0,0,1,2,2,1,0,0],
  [0,0,1,3,3,1,0,0],
  [0,0,1,2,2,1,0,0],
  [0,0,0,1,1,0,0,0],
];

// ---- WET FLOOR SIGN (8x16) ----
const wetFloorSign: number[][] = Array.from({ length: 16 }, (_, y) => {
  const r = Array(8).fill(0);
  if (y === 0) { r[3] = 1; r[4] = 1; }
  if (y >= 1 && y <= 4) {
    const w = y + 1;
    for (let x = 4 - w; x < 4 + w && x < 8; x++) if (x >= 0) r[x] = 2;
  }
  if (y >= 5 && y <= 10) {
    for (let x = 1; x <= 6; x++) r[x] = 2;
    if (y >= 6 && y <= 9) { r[2] = 3; r[3] = 3; r[4] = 3; r[5] = 3; } // "!" mark
  }
  if (y >= 11 && y <= 13) { r[2] = 1; r[3] = 0; r[4] = 0; r[5] = 1; } // legs
  return r;
});

// ---- POWER-UPS (8x8 each) ----
const powerUpRapid: number[][] = [
  [0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,0,0],
  [0,1,2,2,2,1,1,0],
  [0,1,2,3,3,3,3,1],
  [0,1,2,3,3,3,3,1],
  [0,1,2,2,2,1,1,0],
  [0,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0],
];

const powerUpSpread: number[][] = [
  [0,0,0,0,0,1,1,0],
  [0,0,0,1,1,2,0,0],
  [0,1,1,2,2,3,1,0],
  [1,2,2,3,3,2,0,0],
  [0,1,1,2,2,3,1,0],
  [0,0,0,1,1,2,0,0],
  [0,0,0,0,0,1,1,0],
  [0,0,0,0,0,0,0,0],
];

const powerUpArmor: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,3,2,2,3,2,1],
  [1,2,2,2,2,2,2,1],
  [1,2,2,3,3,2,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,2,2,1,0,0],
  [0,0,0,1,1,0,0,0],
];

const powerUpSneakers: number[][] = [
  [0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,2,2,2,2,2,0],
  [1,3,3,3,3,3,3,1],
  [1,2,2,2,2,2,2,1],
  [0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0],
];

const powerUpRadar: number[][] = [
  [0,0,1,1,1,0,0,0],
  [0,1,0,0,0,1,0,0],
  [1,0,1,1,0,0,1,0],
  [1,0,1,3,1,0,1,0],
  [1,0,1,1,0,0,1,0],
  [0,1,0,0,0,1,0,0],
  [0,0,1,1,1,0,0,0],
  [0,0,0,2,0,0,0,0],
];

const powerUp1Up: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,3,3,3,3,1,0],
  [1,3,2,3,3,2,3,1],
  [1,3,3,3,3,3,3,1],
  [0,1,3,3,3,3,1,0],
  [0,0,1,3,3,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0],
];

const powerUpCinnabomb: number[][] = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,3,3,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,3,2,2,3,2,1],
  [1,2,2,2,2,2,2,1],
  [1,2,2,3,3,2,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
];

const powerUpOrange: number[][] = [
  [0,0,0,1,0,0,0,0],
  [0,0,1,2,1,0,0,0],
  [0,1,3,3,3,3,1,0],
  [1,3,2,3,3,2,3,1],
  [1,3,3,3,3,3,3,1],
  [1,3,2,3,3,2,3,1],
  [0,1,3,3,3,3,1,0],
  [0,0,1,1,1,1,0,0],
];

const powerUpPretzel: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,0,0,2,1,0],
  [1,2,0,1,1,0,2,1],
  [0,1,1,2,2,1,1,0],
  [0,1,2,1,1,2,1,0],
  [1,2,0,0,0,0,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
];

// ---- PACKAGE (8x8) ----
const package1: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,2,3,3,2,2,1],
  [1,2,3,1,1,3,2,1],
  [1,2,3,1,1,3,2,1],
  [1,2,2,3,3,2,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
];

const package2: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,3,3,3,3,1,0],
  [1,3,3,2,2,3,3,1],
  [1,3,2,1,1,2,3,1],
  [1,3,2,1,1,2,3,1],
  [1,3,3,2,2,3,3,1],
  [0,1,3,3,3,3,1,0],
  [0,0,1,1,1,1,0,0],
];

// ---- BENCH (16x8) ----
const bench: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
];

// ---- PLANT (8x16) ----
const plant: number[][] = Array.from({ length: 16 }, (_, y) => {
  const r = Array(8).fill(0);
  if (y <= 1) { r[3] = 2; r[4] = 2; }
  if (y >= 2 && y <= 4) { r[2] = 2; r[3] = 2; r[4] = 2; r[5] = 2; }
  if (y >= 3 && y <= 6) { r[1] = 2; r[2] = 2; r[3] = 3; r[4] = 3; r[5] = 2; r[6] = 2; }
  if (y >= 7 && y <= 9) { r[2] = 2; r[3] = 2; r[4] = 2; r[5] = 2; }
  if (y >= 10 && y <= 11) { r[3] = 1; r[4] = 1; } // stem
  if (y >= 12 && y <= 15) { r[2] = 1; r[3] = 3; r[4] = 3; r[5] = 1; } // pot
  return r;
});

// ---- PILLAR (8x24) ----
const pillar: number[][] = Array.from({ length: 24 }, (_, y) => {
  const r = Array(8).fill(0);
  if (y === 0 || y === 23) { for (let x = 1; x <= 6; x++) r[x] = 1; }
  if (y >= 1 && y <= 22) { r[2] = 1; r[3] = 2; r[4] = 2; r[5] = 1; }
  if (y === 1 || y === 22) { r[1] = 1; r[6] = 1; }
  return r;
});

// ---- HEAD ICON (8x8) ----
const headIcon: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [0,1,2,2,2,2,1,0],
  [0,1,3,2,2,3,1,0],
  [0,0,1,2,2,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
];

// ---- STORE FIXTURES (16x16, closed and opened) ----
const fixtureClosed: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,3,3,2,2,2,2,2,2,3,3,2,1,0],
  [0,1,2,3,3,2,2,2,2,2,2,3,3,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const fixtureOpened: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
  [0,1,3,0,0,3,0,0,0,0,3,0,0,3,1,0],
  [0,1,3,0,0,3,0,0,0,0,3,0,0,3,1,0],
  [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
  [0,1,3,0,0,0,3,0,0,3,0,0,0,3,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,3,0,0,0,0,0,0,0,0,0,0,3,1,0],
  [0,1,3,0,0,0,0,0,0,0,0,0,0,3,1,0],
  [0,1,3,0,0,0,0,0,0,0,0,0,0,3,1,0],
  [0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0],
  [0,1,3,0,0,0,0,0,0,0,0,0,0,3,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ---- STOREFRONT tiles (sign area, 80x32-ish) ----
// These are generated procedurally by the renderer based on store data

export const SPRITES = {
  agent: {
    mall: {
      stand: { width: 16, height: 24, pixels: agentStand, palette: PAL_AGENT } as SpriteData,
      walk: {
        width: 16, height: 24, pixels: agentStand,
        frames: [agentStand, agentWalk1, agentStand, agentWalk2],
        palette: PAL_AGENT,
      } as SpriteData,
      jump: { width: 16, height: 24, pixels: agentJump, palette: PAL_AGENT } as SpriteData,
      duck: { width: 16, height: 24, pixels: agentDuck, palette: PAL_AGENT } as SpriteData,
      shoot: { width: 16, height: 24, pixels: agentShoot, palette: PAL_AGENT } as SpriteData,
      shootDuck: { width: 16, height: 24, pixels: agentShootDuck, palette: PAL_AGENT } as SpriteData,
      death: { width: 16, height: 24, pixels: agentDeath, palette: PAL_AGENT } as SpriteData,
      holdItem: { width: 16, height: 24, pixels: agentHoldItem, palette: PAL_AGENT } as SpriteData,
    },
    store: {
      down: { width: 16, height: 16, pixels: agentStoreDown, palette: PAL_AGENT } as SpriteData,
      up: { width: 16, height: 16, pixels: agentStoreUp, palette: PAL_AGENT } as SpriteData,
      left: { width: 16, height: 16, pixels: agentStoreLeft, palette: PAL_AGENT } as SpriteData,
      right: { width: 16, height: 16, pixels: agentStoreRight, palette: PAL_AGENT } as SpriteData,
      search: { width: 16, height: 16, pixels: agentStoreSearch, palette: PAL_AGENT } as SpriteData,
    },
  },
  spy: {
    mall: {
      stand: { width: 16, height: 24, pixels: spyStand, palette: PAL_SPY } as SpriteData,
      walk: {
        width: 16, height: 24, pixels: spyStand,
        frames: [spyStand, spyWalk1, spyStand, spyWalk2],
        palette: PAL_SPY,
      } as SpriteData,
      aim: { width: 16, height: 24, pixels: spyAim, palette: PAL_SPY } as SpriteData,
      shootHigh: { width: 16, height: 24, pixels: spyShootHigh, palette: PAL_SPY } as SpriteData,
      shootLow: { width: 16, height: 24, pixels: spyShootLow, palette: PAL_SPY } as SpriteData,
      duck: { width: 16, height: 24, pixels: spyDuck, palette: PAL_SPY } as SpriteData,
      death: { width: 16, height: 24, pixels: spyDeath, palette: PAL_SPY } as SpriteData,
    },
    store: {
      down: { width: 16, height: 16, pixels: spyStoreDown, palette: PAL_SPY } as SpriteData,
      up: { width: 16, height: 16, pixels: spyStoreDown, palette: PAL_SPY } as SpriteData,
      left: { width: 16, height: 16, pixels: spyStoreDown, palette: PAL_SPY } as SpriteData,
      right: { width: 16, height: 16, pixels: spyStoreDown, palette: PAL_SPY } as SpriteData,
    },
  },
  securityBot: { width: 16, height: 16, pixels: securityBot, palette: [0x10, 0x12, 0x2C] } as SpriteData,
  bullets: {
    player: { width: 4, height: 2, pixels: bulletPlayer, palette: PAL_BULLET_P } as SpriteData,
    enemy: { width: 4, height: 2, pixels: bulletEnemy, palette: PAL_BULLET_E } as SpriteData,
  },
  elevator: {
    closed: { width: 24, height: 48, pixels: elevatorClosed, palette: PAL_ELEVATOR } as SpriteData,
    open: { width: 24, height: 48, pixels: elevatorOpen, palette: PAL_ELEVATOR } as SpriteData,
  },
  escalator: { width: 32, height: 48, pixels: escalatorFrame, palette: [0x00, 0x10, 0x0D] } as SpriteData,
  mallCop: { width: 16, height: 24, pixels: mallCop, palette: [0x12, 0x2C, 0x38] } as SpriteData,
  janitor: { width: 16, height: 24, pixels: janitor, palette: [0x00, 0x1A, 0x38] } as SpriteData,
  mallWalker: { width: 16, height: 24, pixels: mallWalker, palette: [0x00, 0x22, 0x38] } as SpriteData,
  lamp: { width: 8, height: 16, pixels: lamp, palette: [0x00, 0x28, 0x38] } as SpriteData,
  discoBall: {
    width: 8, height: 8, pixels: discoBall1,
    frames: [discoBall1, discoBall2],
    palette: [0x10, 0x20, 0x30],
  } as SpriteData,
  fountain: {
    width: 16, height: 16, pixels: fountain1,
    frames: [fountain1, fountain2],
    palette: [0x00, 0x12, 0x31],
  } as SpriteData,
  kiosk: { width: 16, height: 24, pixels: kiosk, palette: [0x00, 0x12, 0x2C] } as SpriteData,
  photoBooth: { width: 16, height: 24, pixels: photoBooth, palette: [0x00, 0x16, 0x28] } as SpriteData,
  stationWagon: { width: 48, height: 24, pixels: stationWagon, palette: [0x07, 0x28, 0x17] } as SpriteData,
  coin: {
    width: 8, height: 8, pixels: coin1,
    frames: [coin1, coin2],
    palette: [0x07, 0x28, 0x38],
  } as SpriteData,
  wetFloorSign: { width: 8, height: 16, pixels: wetFloorSign, palette: [0x00, 0x28, 0x16] } as SpriteData,
  powerUps: {
    rapidFire: { width: 8, height: 8, pixels: powerUpRapid, palette: [0x16, 0x28, 0x20] } as SpriteData,
    spreadShot: { width: 8, height: 8, pixels: powerUpSpread, palette: [0x12, 0x22, 0x20] } as SpriteData,
    armorVest: { width: 8, height: 8, pixels: powerUpArmor, palette: [0x00, 0x10, 0x20] } as SpriteData,
    sneakers: { width: 8, height: 8, pixels: powerUpSneakers, palette: [0x16, 0x28, 0x20] } as SpriteData,
    radar: { width: 8, height: 8, pixels: powerUpRadar, palette: [0x1A, 0x2A, 0x20] } as SpriteData,
    oneUp: { width: 8, height: 8, pixels: powerUp1Up, palette: [0x1A, 0x2A, 0x38] } as SpriteData,
    cinnabomb: { width: 8, height: 8, pixels: powerUpCinnabomb, palette: [0x07, 0x17, 0x28] } as SpriteData,
    orangeJuliOoze: { width: 8, height: 8, pixels: powerUpOrange, palette: [0x07, 0x17, 0x28] } as SpriteData,
    softPretzel: { width: 8, height: 8, pixels: powerUpPretzel, palette: [0x07, 0x17, 0x27] } as SpriteData,
  },
  package: {
    width: 8, height: 8, pixels: package1,
    frames: [package1, package2],
    palette: [0x16, 0x28, 0x20],
  } as SpriteData,
  bench: { width: 16, height: 8, pixels: bench, palette: [0x07, 0x17, 0x00] } as SpriteData,
  plant: { width: 8, height: 16, pixels: plant, palette: [0x07, 0x1A, 0x2A] } as SpriteData,
  pillar: { width: 8, height: 24, pixels: pillar, palette: [0x00, 0x10, 0x20] } as SpriteData,
  headIcon: { width: 8, height: 8, pixels: headIcon, palette: PAL_AGENT } as SpriteData,
  fixtures: {
    closed: { width: 16, height: 16, pixels: fixtureClosed, palette: [0x07, 0x17, 0x27] } as SpriteData,
    opened: { width: 16, height: 16, pixels: fixtureOpened, palette: [0x07, 0x17, 0x27] } as SpriteData,
  },
};
