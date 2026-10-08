import { C } from '../engine/palette';
import type { SpriteDef } from '../engine/sprite';
import { defineSprites } from './registry';

// OWNER: characters art. Defines every sprite listed for owner 'characters' in manifest.ts.
//
// Conventions: every mall character is drawn facing RIGHT, bottom-aligned and centred in its cell.
// Sprites are layered "paper dolls": `compose` stamps parts (head, coat, legs, arms...) onto a blank cell
// so animation frames share their pixels and never jitter. '.' in a stamp is transparent.
// Pixel ruler (16 wide):  0123456789ABCDEF

interface Stamp {
  rows: readonly string[];
  x: number;
  y: number;
}
const at = (rows: readonly string[], x: number, y: number): Stamp => ({ rows, x, y });

/** Stamp layers (later wins) onto a w x h transparent cell and return the rows. */
function compose(w: number, h: number, ...layers: Stamp[]): string[] {
  const grid: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const l of layers) {
    l.rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx]!;
        if (ch === '.' || ch === ' ') continue;
        const gx = l.x + rx;
        const gy = l.y + ry;
        if (gx < 0 || gy < 0 || gx >= w || gy >= h) throw new Error(`stamp out of bounds at ${gx},${gy}`);
        grid[gy]![gx] = ch;
      }
    });
  }
  return grid.map((r) => r.join(''));
}
const c16 = (...layers: Stamp[]): string[] => compose(16, 24, ...layers);
const c24 = (...layers: Stamp[]): string[] => compose(24, 24, ...layers);

/** Mirror a grid left-right. */
function flip(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/** A 1px Bresenham line as a char grid of the given size (for mop handles and the like). */
function lineRows(w: number, h: number, x0: number, y0: number, x1: number, y1: number, ch: string): string[] {
  const grid: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    grid[y]![x] = ch;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return grid.map((r) => r.join(''));
}

// ------------------------------------------------------------------ AGENT (red trench coat)
const AG = { K: C.BLACK, R: C.RED, P: C.PEACH };

// Profile parts (facing right). Stand layout: head rows 1-7, coat rows 8-17, legs rows 18-23.
const A_HEAD = [
  '.....KKKKKK.....',
  '....KKKKKKKKK...',
  '....KKKKKKPPP...',
  '....KKKKKPPKP...',
  '....KKKKPPPPPP..',
  '.....KKKPPPPP...',
  '.....KKKKPPP....',
];
const A_COAT = [
  '....KRRRPPRK....',
  '...KRRKPPKRRK...',
  '...KRRRKPKRRK...',
  '...KRRRRKKRRK...',
  '....KRRRKRRK....',
  '....KKKKPKKK....',
  '...KRRRRKRRRK...',
  '..KRRRRRKRRRRK..',
  '..KRRRRRKRRRRK..',
  '..KRRRRRKRRRRK..',
];
const A_LEGS_STAND = [
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '...KKKK.KKKK....',
  '...KKKK.KKKK....',
];
const A_LEGS_CONTACT = [
  '.....KKKKKK.....',
  '....KKK..KKK....',
  '...KKK....KKK...',
  '..KKK......KKK..',
  '..KKKK.....KKKK.',
];
const A_LEGS_PASS_A = [
  '.....KKKKKK.....',
  '....KKK.KKK.....',
  '...KKK..KKK.....',
  '..KKK...KKK.....',
  '..KK....KKK.....',
  '........KKKK....',
];
const A_LEGS_PASS_B = [
  '.....KKKKKK.....',
  '.....KKK.KKK....',
  '.....KKK..KKK...',
  '.....KKK..KKK...',
  '.....KKK...KKKK.',
  '....KKKK........',
];
const A_LEGS_JUMP = [
  '.....KKKKKK.....',
  '...KKKKKKKKKK...',
  '..KKK..KKKKKKK..',
  '.KKKK......KKK..',
  '.KKK.......KKKK.',
];
const A_ARM_FWD = ['RK...', 'RRK..', '.KRP.', '..KP.'];
const A_ARM_BACK = ['...KR', '..KRR', '.PRK.', '.PK..'];
const A_HAND_HIP = ['P', 'P'];
const A_ARM_UP_FWD = ['..PP', '..PP', '..RK', '..RK', '..RK', '.RRK', 'RRK.'];
const A_ARM_UP_BACK = ['PK..', 'KRK.', '.KRK'];

function agentBody(dy: number, legs: readonly string[], behind: Stamp[] = [], front: Stamp[] = []): string[] {
  const ly = 24 - legs.length;
  return c16(at(legs, 0, ly), ...behind, at(A_COAT, 0, 8 + dy), at(A_HEAD, 0, 1 + dy), ...front);
}

// kick: leans back, front leg stretched out forward at hip height
const A_KICK_LEG = ['..........KKKK..', '.......KKKKKKKKK', '.......KKKKKKKKK', '..........KKKK..'];
const A_KICK_REAR = ['....KKK.........', '...KKK..........', '..KKK...........', '.KKKK...........'];

// duck / crouch (profile): head + a compressed coat + folded legs, only the bottom ~14 rows
const A_DUCK_COAT = [A_COAT[0]!, A_COAT[1]!, A_COAT[2]!, A_COAT[3]!, A_COAT[6]!];
const A_DUCK_LEGS = ['....KKKKKKKKKK..', '....KKKK.KKKKK..', '....KKKK.KKKKKK.'];
const A_SHOOT_ARM = ['..KKKKK', '.RRRPKK', '.KKKKK.', '....K..'];

const A_CROUCH_COAT = [A_COAT[0]!, A_COAT[1]!, A_COAT[2]!, A_COAT[6]!, A_COAT[7]!];
const A_CROUCH_LEGS = ['...KKKKKKKKKK...', '...KKKK..KKKKK..', '..KKKK...KKKKKK.'];
const A_CROUCH_HAND = ['.PP.', 'KPPK'];

// selfie (body shifted left 2 px to leave room for the phone and the flash)
const A_PHONE = ['KKK', 'KPK', 'KKK', 'KKK', 'KKK'];
const A_PHONE_FLASH = ['P.P', 'KPK', 'PPP', 'KPK', 'KKK', 'KKK'];
const A_SELFIE_ARM = ['...PP', '.RRKP', 'RRK..'];
function selfieBody(flash: boolean): string[] {
  const phone = flash ? at(A_PHONE_FLASH, 13, 0) : at(A_PHONE, 13, 1);
  return c16(at(A_LEGS_STAND, -2, 18), at(A_COAT, -2, 8), at(A_HEAD, -2, 1), at(A_SELFIE_ARM, 9, 6), phone);
}

// Front view parts (ride / hold / hang / spin)
const AF_HEAD = [
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KPPPPPPK....',
  '....KPKPPKPK....',
  '....KPPPPPPK....',
  '.....KPPPPK.....',
  '......KPPK......',
];
const AF_HEAD_O = [AF_HEAD[0]!, AF_HEAD[1]!, AF_HEAD[2]!, AF_HEAD[3]!, AF_HEAD[4]!, '.....KPKKPK.....', AF_HEAD[6]!];
// ride: arms hang at the sides, hands at the hips
const AF_COAT = [
  '...KRRRPPRRRK...',
  '..KRRKPPPPKRRK..',
  '..KRRRKKKKRRRK..',
  '..KRRKRKKRKRRK..',
  '..KRRKRKKRKRRK..',
  '..KRRKKPPKKRRK..',
  '..KPPKRKKRKPPK..',
  '.KRRRRRKKRRRRRK.',
  '.KRRRRRKKRRRRRK.',
  '.KRRRRRKKRRRRRK.',
];
// arms-up torso (no sleeves at the sides)
const AF_TORSO = [
  '...KRRRPPRRRK...',
  '..KRRKPPPPKRRK..',
  '..KRRRKKKKRRRK..',
  '..KRRRRKKRRRRK..',
  '..KRRRRKKRRRRK..',
  '..KKKKKPPKKKKK..',
  '.KRRRRRKKRRRRRK.',
  '.KRRRRRKKRRRRRK.',
  '.KRRRRRKKRRRRRK.',
  '.KRRRRRKKRRRRRK.',
];
const AF_LEGS = [
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '...KKKK..KKKK...',
  '...KKKK..KKKK...',
];
const AF_LEGS_HANG = ['....KKK..KKK....', '....KKK..KKK....', '....KKK...KKK...', '...KKKK...KKKK..', '...KKK.....KKK..'];
const AF_LEGS_SPLAY = ['...KKKK..KKKK...', '..KKKK....KKKK..', '.KKKK......KKKK.'];
const AF_ARM_L = ['KPP', 'KPP', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR', 'KRR'];
const AF_ARM_R = flip(AF_ARM_L);
const AF_FLAIL_L = ['PP...', 'PP...', 'KRK..', '.KRK.', '.KRK.', '..KRK', '..KRK', '...KR'];
const AF_FLAIL_R = flip(AF_FLAIL_L);

// lying flat on the floor, head to the left (face up), feet to the right
const A_LYING = [
  '..KKK..KKKKKKK..',
  '.KKKKKKRRRRRRRK.',
  'KKPPPKRRRRRRRRKK',
  'KPPKPKRRKRRRRRKK',
  'KPKPPKRRKRRRRKKK',
  'KPPPPKRRRRRRRKKK',
  '.KKKKKKRRRRRRKK.',
  '..KKK..KKKKKK...',
];

const duckBody = (): string[] => compose(16, 24, at(A_DUCK_LEGS, -1, 21), at(A_DUCK_COAT, -1, 16), at(A_HEAD, -1, 10));

defineSprites([
  { name: 'agent.stand', w: 16, h: 24, pal: AG, rows: agentBody(0, A_LEGS_STAND, [], [at(A_HAND_HIP, 13, 14)]) },
  {
    name: 'agent.walk',
    w: 16,
    h: 24,
    pal: AG,
    frames: [
      agentBody(1, A_LEGS_CONTACT, [at(A_ARM_BACK, 0, 13)], [at(A_ARM_FWD, 11, 13)]),
      agentBody(0, A_LEGS_PASS_A),
      agentBody(1, A_LEGS_CONTACT, [at(A_ARM_FWD, 11, 13)], [at(A_ARM_BACK, 0, 13)]),
      agentBody(0, A_LEGS_PASS_B),
    ],
  },
  {
    name: 'agent.jump',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(at(A_LEGS_JUMP, 0, 17), at(A_ARM_BACK, 0, 11), at(A_COAT, 0, 7), at(A_HEAD, 0, 0), at(A_ARM_UP_FWD, 12, 1)),
  },
  {
    name: 'agent.kick',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(at(A_KICK_REAR, 0, 17), at(A_KICK_LEG, 0, 14), at(A_COAT, -1, 6), at(A_HEAD, -2, 0), at(A_ARM_BACK, -1, 11)),
  },
  { name: 'agent.duck', w: 16, h: 24, pal: AG, rows: duckBody() },
  { name: 'agent.shoot', w: 16, h: 24, pal: AG, rows: agentBody(0, A_LEGS_STAND, [], [at(A_SHOOT_ARM, 9, 9)]) },
  {
    name: 'agent.shootlow',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(at(A_DUCK_LEGS, -1, 21), at(A_DUCK_COAT, -1, 16), at(A_HEAD, -1, 10), at(A_SHOOT_ARM, 8, 17)),
  },
  {
    name: 'agent.die',
    w: 16,
    h: 24,
    pal: AG,
    frames: [
      c16(
        at(A_LEGS_PASS_B, 0, 18),
        at(A_ARM_UP_BACK, 0, 8),
        at(A_COAT, -1, 9),
        at(A_HEAD, -2, 3),
        at(A_ARM_UP_FWD, 12, 0),
      ),
      c16(
        at(AF_LEGS_SPLAY, 0, 18),
        at(AF_FLAIL_L, 0, 2),
        at(AF_FLAIL_R, 11, 2),
        at(AF_TORSO, 0, 8),
        at(AF_HEAD_O, 0, 1),
      ),
      c16(at(A_LYING, 0, 16)),
    ],
  },
  {
    name: 'agent.hang',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(
      at(AF_LEGS_HANG, 0, 19),
      at(AF_ARM_L, 1, 0),
      at(AF_ARM_R, 12, 0),
      at(AF_TORSO.slice(0, 8), 0, 11),
      at(AF_HEAD, 0, 4),
    ),
  },
  {
    name: 'agent.crouch',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(at(A_CROUCH_LEGS, 0, 21), at(A_ARM_BACK, 0, 15), at(A_CROUCH_COAT, 0, 16), at(A_HEAD, 0, 11), at(A_CROUCH_HAND, 11, 20)),
  },
  { name: 'agent.selfie', w: 16, h: 24, pal: AG, frames: [selfieBody(false), selfieBody(true)] },
  { name: 'agent.ride', w: 16, h: 24, pal: AG, rows: c16(at(AF_LEGS, 0, 18), at(AF_COAT, 0, 8), at(AF_HEAD, 0, 1)) },
  {
    name: 'agent.hold',
    w: 16,
    h: 24,
    pal: AG,
    rows: c16(at(AF_LEGS.slice(1), 0, 19), at(AF_ARM_L, 1, 0), at(AF_ARM_R, 12, 0), at(AF_TORSO, 0, 9), at(AF_HEAD, 0, 2)),
  },
] satisfies SpriteDef[]);

// ------------------------------------------------------------------ SPY (black suit, fedora, shades)
const SP = { K: C.BLACK, W: C.WHITE, P: C.PEACH };

const S_HEAD = [
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KWWWWWWK....',
  '..KKKKKKKKKKKK..',
  '....KKKKKKKWKK..',
  '....KKKKPPPPPP..',
  '....KKKKPPPPK...',
  '.....KKKKPPP....',
];
const S_HAT = S_HEAD.slice(0, 4);
const S_FACE = S_HEAD.slice(4);
const S_BODY = [
  '.....KWWWWK.....',
  '...KKKKWWKKKK...',
  '...KKKKKWKKKK...',
  '...KKWKKKKKWKK..',
  '...KKKKKKKKKK...',
  '...KKWKKKKKWKK..',
  '...KKKKKKKKPP...',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
];
const S_DUCK_BODY = [S_BODY[0]!, S_BODY[1]!, S_BODY[2]!];
const S_ARM_FWD = ['KK...', 'KKK..', '.KWP.', '..KP.'];
const S_ARM_BACK = ['...KK', '..KKK', '.PWK.', '.PK..'];
const S_AIM_HIGH = ['..KKK', 'KKWPK', 'KKWP.'];
const S_AIM_LOW = ['K....', 'KK...', '.KK..', '..KK.', '..WW.', '..PPK', '..KKK'];
const S_ARM_UP_FWD = ['..KP.', '.KKP.', 'KKK..'];
const S_ARM_UP_BACK = ['PK..', 'KKK.', '.KKK'];
// front view (spin)
const SF_HEAD = [
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KWWWWWWK....',
  '..KKKKKKKKKKKK..',
  '....KKWKKKKK....',
  '.....PPPPPP.....',
  '.....PPKKPP.....',
  '......PPPP......',
];
const SF_BODY = [
  '...KKKWWWWKKK...',
  '..KKKKWKKWKKKK..',
  '..KKKKKWWKKKKK..',
  '..KKWKKKKKKWKK..',
  '..KKKKKKKKKKKK..',
  '..KKWKKKKKKWKK..',
  '...KKKKKKKKKK...',
  '...KKKKKKKKKK...',
];
const SF_FLAIL_L = ['PP...', 'PP...', 'WWW..', '.KKK.', '.KKK.', '..KKK', '..KKK', '...KK'];
const SF_FLAIL_R = flip(SF_FLAIL_L);
const S_LYING = [
  '..KKKK..........',
  '.KWWWWK.KKKKKKK.',
  'KKKKKKKKKKKKKKKK',
  'KKPPKKKKWWKKKKKK',
  'KPPKKWKKKWKKKKKK',
  'KPPPPPKKKKKKKKKK',
  '.KKKKKKKKKKKKKK.',
  '..KKK...KKKKK...',
];

function spyBody(dy: number, legs: readonly string[], behind: Stamp[] = [], front: Stamp[] = [], dx = 0): string[] {
  const ly = 24 - legs.length;
  return c16(at(legs, dx, ly), ...behind, at(S_BODY, dx, 9 + dy), at(S_HEAD, dx, 1 + dy), ...front);
}

defineSprites([
  { name: 'spy.stand', w: 16, h: 24, pal: SP, rows: spyBody(0, A_LEGS_STAND) },
  {
    name: 'spy.walk',
    w: 16,
    h: 24,
    pal: SP,
    frames: [
      spyBody(1, A_LEGS_CONTACT, [at(S_ARM_BACK, 0, 13)], [at(S_ARM_FWD, 11, 13)]),
      spyBody(0, A_LEGS_PASS_A),
      spyBody(1, A_LEGS_CONTACT, [at(S_ARM_FWD, 11, 13)], [at(S_ARM_BACK, 0, 13)]),
      spyBody(0, A_LEGS_PASS_B),
    ],
  },
  { name: 'spy.aimhigh', w: 16, h: 24, pal: SP, rows: spyBody(0, A_LEGS_STAND, [], [at(S_AIM_HIGH, 11, 8)], -2) },
  { name: 'spy.aimlow', w: 16, h: 24, pal: SP, rows: spyBody(0, A_LEGS_STAND, [], [at(S_AIM_LOW, 11, 11)], -2) },
  {
    name: 'spy.duck',
    w: 16,
    h: 24,
    pal: SP,
    rows: c16(at(A_DUCK_LEGS, 0, 21), at(S_DUCK_BODY, 0, 18), at(S_HEAD, 0, 10)),
  },
  {
    name: 'spy.die',
    w: 16,
    h: 24,
    pal: SP,
    frames: [
      c16(
        at(A_LEGS_PASS_B, 0, 18),
        at(S_ARM_UP_BACK, 0, 9),
        at(S_BODY, -1, 10),
        at(S_FACE, -1, 6),
        at(S_HAT, -2, 0),
        at(S_ARM_UP_FWD, 11, 6),
      ),
      c16(
        at(AF_LEGS_SPLAY, 0, 18),
        at(SF_FLAIL_L, 0, 2),
        at(SF_FLAIL_R, 11, 2),
        at(SF_BODY, 0, 9),
        at(SF_HEAD, 0, 1),
      ),
      c16(at(S_LYING, 0, 16)),
    ],
  },
] satisfies SpriteDef[]);

// ------------------------------------------------------------------ MALL COP (24x24, helmet on a Segway)
const CP = { K: C.BLACK, U: C.SKY, P: C.PEACH };

// Segway wheel, 8x8: black tyre; blue hub dots swap between a '+' and an 'x' so it looks like it is turning.
const WHEEL_A = ['..KKKK..', '.KKUKKK.', 'KKKKKKKU', 'KKKKKKKK', 'KUKKKKKK', 'KKKKKKKK', '.KKKUKK.', '..KKKK..'];
const WHEEL_B = ['..KKKK..', '.KUKKUK.', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', 'KKKKKKKK', '.KUKKUK.', '..KKKK..'];

const CP_HEAD = [
  '.........KKKKK..........',
  '........KUUUUUUK........',
  '.......KUUUUUUUUK.......',
  '.......KUUKUUKUUUK......',
  '.......KKKKKKKKKKKKK....',
  '........KPPPPPPP........',
  '........KPPPPKPPP.......',
  '........KPPPPPPPPP......',
  '.........KPPPKKKP.......',
];
const CP_BODY = [
  '......KUUUUUUUUUUK......',
  '......KUUUUUUUPUUK......',
  '......KKKKKKKKKKKK......',
  '.......KUUUUUUUUK.......',
  '........KUUUUUUK........',
  '........KKKKKKKKKK......',
  '.....KKKKKKKKKKKKKKKK...',
];
const CP_ARM = ['KK.', 'UUK'];
const CP_HAND = ['PP'];
const CP_STEM = ['KKKKK', '.KK..', '.KK..', '.KK..'];
const CP_WHISTLE_ARM = ['..PP.', '.UPKK', 'UU...'];
const CP_TWEET = ['K..K', '.K.K', 'KKK.', '.K.K', 'K..K'];

function copFrame(dy: number, wheelRows: readonly string[]): string[] {
  return c24(
    at(wheelRows, 8, 16),
    at(CP_BODY.slice(5), 0, 14),
    at(CP_BODY.slice(0, 5), 0, 9 + dy),
    at(CP_HEAD, 0, 0 + dy),
    at(CP_STEM, 17, 11),
    at(CP_ARM, 17, 9 + dy),
    at(CP_HAND, 19, 10 + dy),
  );
}

defineSprites([
  { name: 'cop.segway', w: 24, h: 24, pal: CP, frames: [copFrame(0, WHEEL_A), copFrame(1, WHEEL_B)] },
  {
    name: 'cop.whistle',
    w: 24,
    h: 24,
    pal: CP,
    rows: c24(
      at(WHEEL_A, 8, 16),
      at(CP_BODY.slice(5), 0, 14),
      at(CP_BODY.slice(0, 5), 0, 9),
      at(CP_HEAD, 0, 0),
      at(CP_STEM, 17, 11),
      at(CP_WHISTLE_ARM, 16, 7),
      at(CP_TWEET, 20, 3),
    ),
  },
] satisfies SpriteDef[]);

// ------------------------------------------------------------------ JANITOR (teal coverall, cap, mop and bucket)
const JN = { K: C.BLACK, T: C.TEAL, P: C.PEACH };

const J_HEAD = [
  '.....TTTTTT.....',
  '....TTTTTTTT....',
  '....KKKKKKKKKK..',
  '....KPPPPPPP....',
  '....KPPPPKPP....',
  '.....PPPPPPPP...',
  '.....KPKKKPP....',
];
const J_BODY = [
  '....KTTTTTTK....',
  '...KTTTTTTTTK...',
  '...KTTTTTTTTK...',
  '...KTTTTTTTTK...',
  '...KTTTTTTTTK...',
  '...KKKKKKKKKK...',
  '...KTTTTTTTTK...',
  '...KTTTTTTTTK...',
  '....KTTTTTTK....',
];
const J_LEGS_STAND = ['....TTT..TTT....', '....TTT..TTT....', '....TTT..TTT....', '....TTT..TTT....', '...KKKK..KKKK...', '...KKKK..KKKK...'];
const J_LEGS_STEP = ['.....TTTTTT.....', '....TTT..TTT....', '...TTT....TTT...', '..KKK......KKK..', '..KKKK....KKKK..'];
const J_BUCKET = ['..KKK..', '.K...K.', 'KKKKKKK', 'KTTTTTK', '.KTTTK.', '..KKK..'];
// mop standing upright beside him (handle col 14), strands on the floor
const J_MOP_UP = [
  '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.', '..K.',
  '.KKK',
  'PPPP',
  'PKPP',
  'P.PP',
];
const J_ARM_HOLD = ['TTK..', '.TTP.', '..PP.'];
// mopping: leaning into the stroke, both hands on a diagonal handle, strands on the floor
const J_MOP_HEAD = ['KKKK', 'PPPP', 'PKPP'];
const J_HANDS = ['TTK..', '.TPP.', '..PP.'];

function janitorBody(dy: number, legs: readonly string[], front: Stamp[] = [], behind: Stamp[] = []): string[] {
  const ly = 24 - legs.length;
  return c16(at(legs, 0, ly), ...behind, at(J_BODY, 0, 9 + dy), at(J_HEAD, 0, 2 + dy), ...front);
}
function janitorMop(endX: number, legs: readonly string[]): string[] {
  const ly = 24 - legs.length;
  return c16(
    at(legs, 1, ly),
    at(J_BODY.slice(0, 4), 2, 9),
    at(J_BODY.slice(4), 1, 13),
    at(J_HEAD, 2, 3),
    at(lineRows(16, 24, 12, 14, endX, 21, 'K'), 0, 0),
    at(J_HANDS, 9, 11),
    at(['P'], 12, 16),
    at(J_MOP_HEAD, endX - 2, 21),
  );
}

// ------------------------------------------------------------------ MALL WALKER (retiree in a tracksuit)
// 'T' is the tracksuit colour; the renderer recolours it for the second walker, so it is used for nothing else.
const WK = { K: C.BLACK, T: C.TEAL, P: C.PEACH };

const W_HEAD = [
  '......PPPP......',
  '.....PPPPPP.....',
  '....KTTTTTTTTT..',
  '....KPPPPPPP....',
  '....KPPPPKPP....',
  '.....PPPPPPPP...',
  '......KPPPK.....',
];
const W_BODY = [
  '....KTTTTTK.....',
  '...KTTTTTTTK....',
  '...KTTTTTTKK....',
  '...KTTTTTTKK....',
  '...KTTTTTTKK....',
  '...KTTTTTTTK....',
  '...KTTTTTTTK....',
  '...KTTTTTTTK....',
  '..KTTTTTTTTTK...',
  '..KTTTTTTTTTK...',
];
/** Track-suit legs: the agent's leg shapes, but trousers (T) with black sneakers on the last two rows. */
const trackLegs = (legs: readonly string[]): string[] =>
  legs.map((r, i) => (i >= legs.length - 2 ? r : r.replace(/K/g, 'T')));
const W_ARM_FWD = ['.KTTK..', 'KTTKTP.', '.KKKPPP'];
const W_ARM_BACK = ['.KTTK', 'PPTTK', 'PP...'];

function walkerBody(dy: number, legs: readonly string[], behind: Stamp[] = [], front: Stamp[] = []): string[] {
  const ly = 24 - legs.length;
  return c16(at(trackLegs(legs), 0, ly), ...behind, at(W_BODY, 0, 8 + dy), at(W_HEAD, 0, 1 + dy), ...front);
}

defineSprites([
  {
    name: 'janitor.walk',
    w: 16,
    h: 24,
    pal: JN,
    frames: [
      janitorBody(1, J_LEGS_STEP, [at(J_ARM_HOLD, 10, 11), at(J_MOP_UP, 12, 3)], [at(J_BUCKET, 0, 15)]),
      janitorBody(0, J_LEGS_STAND, [at(J_ARM_HOLD, 10, 10), at(J_MOP_UP, 12, 3)], [at(J_BUCKET, 0, 14)]),
    ],
  },
  { name: 'janitor.mop', w: 16, h: 24, pal: JN, frames: [janitorMop(14, J_LEGS_STEP), janitorMop(10, J_LEGS_STEP)] },
  {
    name: 'walker.walk',
    w: 16,
    h: 24,
    pal: WK,
    frames: [
      walkerBody(1, A_LEGS_CONTACT, [at(W_ARM_BACK, 0, 11)], [at(W_ARM_FWD, 8, 9)]),
      walkerBody(0, A_LEGS_PASS_A),
      walkerBody(1, A_LEGS_CONTACT, [at(W_ARM_FWD, 8, 9)], [at(W_ARM_BACK, 0, 11)]),
      walkerBody(0, A_LEGS_PASS_B),
    ],
  },
  {
    name: 'sign.wet',
    w: 8,
    h: 12,
    pal: { K: C.BLACK, Y: C.YELLOW, O: C.ORANGE },
    rows: [
      '...KK...',
      '..KYYK..',
      '.KYYYYK.',
      '.KYKKYK.',
      '.KYKKYK.',
      '.KYKKYK.',
      'KYYYYYYK',
      'KYYKKYYK',
      'KYYYYYYK',
      'KOOOOOOK',
      'KOO..OOK',
      'KK....KK',
    ],
  },
] satisfies SpriteDef[]);

