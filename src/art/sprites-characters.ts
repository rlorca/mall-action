// Character sprites: mall (side view, face RIGHT) and store (top-down, 16x16).
// Sprites are assembled from small hand-drawn parts with a tiny compositor, so poses stay consistent.
// Colour slots: 1 = outline/dark, 2 = main fill, 3 = skin/light (per-sprite palette below).
import { C } from '../core/palette';
import { defineSprite, type SpriteDef } from './pixel';

type Part = readonly [rows: string[], x: number, y: number];

function comp(w: number, h: number, ...parts: Part[]): string[] {
  const g: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [rows, px, py] of parts) {
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '.' || c === ' ') continue;
        const x = px + i;
        const y = py + j;
        if (y >= 0 && y < h && x >= 0 && x < w) g[y][x] = c;
      }
    });
  }
  return g.map((r) => r.join(''));
}
const flip = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(''));
const swap = (rows: string[], map: Record<string, string>): string[] => rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
const legs = (rows: string[], y: number): Part => [rows, 0, y];

// ---------------------------------------------------------------------------------------------
// AGENT (mall). slots: 1 black, 2 red coat, 3 skin
// ---------------------------------------------------------------------------------------------
const AG_COLORS = [C.BLACK, C.RED, C.TAN];

const AG_HEAD = ['.111111..', '11111111.', '11111333.', '11113313.', '111133333', '11113333.', '11111333.', '...33....'];
const AG_HEAD_OPEN = ['.111111..', '11111111.', '11111333.', '11113313.', '111133333', '11113133.', '11111333.', '...33....'];
const AG_HEAD_OOPS = ['.111111..', '11111111.', '11111333.', '11113133.', '111133333', '11113113.', '11111333.', '...33....'];
const AG_BODY = ['1122332211', '1222222221', '1222222221', '1222222221', '1111111111', '1222222221', '1222222221', '1222222221'];
const AG_FLARE = ['122222222221', '122222222221'];
const AG_ARM_DOWN = ['122', '122', '122', '122', '133', '133'];
const AG_ARM_FWD = ['111111.', '1222331', '111111.'];
const AG_ARM_BACK = flip(AG_ARM_FWD);
const AG_STUB_BACK = ['111', '133', '111'];
const AG_STUB_FWD = flip(AG_STUB_BACK);
const AG_ARM_UP = ['.111', '.131', '.131', '.121', '.121', '1221', '111.'];

const LEG_STAND = ['.....111.111....', '.....111.111....', '.....111.111....', '.....111.111....', '.....111.111....', '....1111.1111...'];
const LEG_A = ['......1111......', '.....111.111....', '....111...111...', '...111.....111..', '..111.......111.', '..1111......1111'];
// passing frames (body bobs up 1px, so 7 rows starting at y17)
const LEG_B = ['......1111......', '......1111......', '......1111......', '......1111......', '....111..11.....', '...11....11.....', '.........1111...'];
const LEG_D = ['......1111......', '......1111......', '......1111......', '......1111......', '.....11..111....', '.....11...111...', '....1111........'];

function agentBase(head: string[], hx: number, hy: number, extra: Part[] = [], dy = 0): Part[] {
  return [[head, hx, hy + dy], [AG_BODY, 3, 8 + dy], [AG_FLARE, 2, 16 + dy], ...extra];
}
const agStand = comp(16, 24, [AG_HEAD, 4, 0], [AG_BODY, 3, 8], [AG_FLARE, 2, 16], legs(LEG_STAND, 18), [AG_ARM_DOWN, 8, 9]);
const agWalk = [
  comp(16, 24, [AG_STUB_BACK, 0, 11], ...agentBase(AG_HEAD, 4, 0, [legs(LEG_A, 18), [AG_ARM_FWD, 8, 10]])),
  comp(16, 24, ...agentBase(AG_HEAD, 4, 0, [legs(LEG_B, 17), [AG_ARM_DOWN, 8, 9]], -1)),
  comp(16, 24, [AG_STUB_FWD, 13, 11], ...agentBase(AG_HEAD, 4, 0, [legs(LEG_A, 18), [AG_ARM_BACK, 1, 10]])),
  comp(16, 24, ...agentBase(AG_HEAD, 4, 0, [legs(LEG_D, 17), [AG_ARM_DOWN, 8, 9]], -1)),
];


const agJump = comp(16, 24, [AG_ARM_UP, 12, 3], ...agentBase(AG_HEAD_OPEN, 4, 0, [
  legs(['......1111......', '.....111.11111..', '....111.....11..', '...111.....1111.', '..111...........'], 18),
]));
const agKick = comp(16, 24, [AG_STUB_BACK, 0, 11], ...agentBase(AG_HEAD_OPEN, 4, 0, [
  legs(['......1111111111', '.....1111.111111', '....111.....1111', '...111......1111', '..111...........', '..1111..........'], 18),
  [AG_ARM_BACK, 1, 10],
]));

// duck: head lowered, coat squashed, feet on the floor
const AG_DUCK_BODY = ['1122332211', '1222222221', '1222222221', '1111111111'];
const AG_DUCK_FLARE = ['1222222222221', '1222222222221'];
const AG_DUCK_LEGS = ['.....1111.11111.', '....1111..111111'];
const agDuck = comp(16, 24, [AG_HEAD, 4, 8], [AG_DUCK_BODY, 3, 16], [AG_DUCK_FLARE, 2, 20], legs(AG_DUCK_LEGS, 22), [['33'], 11, 18]);
const agCrouch = comp(16, 24,
  [AG_HEAD, 4, 6], [AG_DUCK_BODY, 3, 14], [AG_DUCK_FLARE, 2, 18], [AG_STUB_FWD, 13, 15],
  legs(['....11111111....', '...111....111...', '..111......111..', '..1111.....1111.'], 20));

// shooting: arm out at chest height holding a pistol
const AG_GUN_ARM = ['....1111', '11111111', '12223311', '111111..'];
const agShoot = comp(16, 24, ...agentBase(AG_HEAD, 4, 0, [legs(LEG_STAND, 18), [AG_GUN_ARM, 8, 9]]));
const agShootDuck = comp(16, 24,
  [AG_HEAD, 4, 8], [AG_DUCK_BODY, 3, 16], [AG_DUCK_FLARE, 2, 20], legs(AG_DUCK_LEGS, 22), [AG_GUN_ARM, 8, 15]);

// death: hit, tumbling, lying flat
const agDie0 = comp(16, 24, [AG_STUB_BACK, 0, 9], ...agentBase(AG_HEAD_OOPS, 3, 1, [legs(LEG_A, 19), [AG_ARM_UP, 12, 4]], 1));
const AG_LIE_HEAD = ['.11111.', '1133331', '1313131', '1133331', '.11111.'];
const AG_LIE_TORSO = ['111111', '122221', '122221', '122221', '111111'];
const AG_LIE_LEGS = ['.11', '111', '111', '111'];
const agDie1 = comp(16, 24,
  [flip(AG_LIE_HEAD), 0, 14], [AG_LIE_TORSO, 6, 11], [AG_LIE_LEGS, 12, 8], [['11'], 13, 6], [['11'], 14, 4]);
const agDie2 = comp(16, 24, [AG_LIE_HEAD, 0, 19], [AG_LIE_TORSO, 7, 19], [AG_LIE_LEGS, 13, 20], [['11'], 14, 18]);

// hanging from the zip line by both hands (hands at the top, legs dangling)
const AG_HANG_ARM = ['.111', '.131', '.131', '.121', '.121', '.121', '.121', '.121', '.121', '.121', '1221', '111.'];
const agHang = (dx: number, legRows: string[]): string[] =>
  comp(16, 24, [AG_HEAD, 3, 3], [AG_BODY.slice(0, 6), 2, 11], [AG_FLARE.slice(0, 1), 1, 17], legs(legRows, 18 + dx), [AG_HANG_ARM, 11, 0]);
const agHang0 = agHang(0, ['.....111.111....', '.....111.111....', '.....111.111....', '....1111.1111...', '................']);
const agHang1 = agHang(0, ['....111..111....', '....111..111....', '...111....111...', '...1111...1111..', '................']);

// selfie: phone held up in front of the face
const PHONE = ['111', '131', '131', '131', '131', '111'];
const agSelfie0 = comp(16, 24, ...agentBase(AG_HEAD, 4, 0, [legs(LEG_STAND, 18), [AG_ARM_FWD, 8, 9], [PHONE, 13, 4]]));
const agSelfie1 = comp(16, 24, ...agentBase(['.111111..', '11111111.', '11111333.', '11113333.', '111133333', '11113133.', '11111333.', '...33....'], 4, 0, [legs(LEG_STAND, 18), [AG_ARM_FWD, 8, 9], [['111', '133', '133', '133', '133', '111'], 13, 4], [['3'], 15, 2]]));

// ---------------------------------------------------------------------------------------------
// SPY (mall). slots: 1 black, 2 dark grey suit, 3 skin
// ---------------------------------------------------------------------------------------------
const SP_COLORS = [C.BLACK, C.GRAY_DD, C.TAN];
const SP_HEAD = ['...11111...', '..1111111..', '..1222221..', '11111111111', '..11113333.', '..111111111', '..11113333.', '..11113313.', '....33.....'];
const SP_HEAD_MOUTH = ['...11111...', '..1111111..', '..1222221..', '11111111111', '..11113333.', '..111111111', '..11113333.', '..11113113.', '....33.....'];
const SP_BODY = ['1133333311', '1222132221', '1222132221', '1222232221', '1111111111', '1222222221', '1222222221', '1222222221'];
const SP_FLARE = ['1222222222221'];
const SP_ARM_DOWN = ['122', '122', '122', '122', '133', '133'];
const SP_ARM_FWD = ['111111.', '1222331', '111111.'];
const SP_ARM_BACK = flip(SP_ARM_FWD);
const SP_STUB_BACK = ['111', '133', '111'];
const SP_STUB_FWD = flip(SP_STUB_BACK);
function spyBase(head: string[], hx: number, hy: number, extra: Part[] = [], dy = 0): Part[] {
  return [[head, hx, hy + dy], [SP_BODY, 3, 9 + dy], [SP_FLARE, 2, 17 + dy], ...extra];
}
const SP_GUN = ['1111', '1233'];
const spStand = comp(16, 24, ...spyBase(SP_HEAD, 3, 0, [legs(LEG_STAND, 18), [SP_ARM_DOWN, 8, 10]]));
const spWalk = [
  comp(16, 24, [SP_STUB_BACK, 0, 12], ...spyBase(SP_HEAD, 3, 0, [legs(LEG_A, 18), [SP_ARM_FWD, 8, 11]])),
  comp(16, 24, ...spyBase(SP_HEAD, 3, 0, [legs(LEG_B, 17), [SP_ARM_DOWN, 8, 9]], -1)),
  comp(16, 24, [SP_STUB_FWD, 13, 12], ...spyBase(SP_HEAD, 3, 0, [legs(LEG_A, 18), [SP_ARM_BACK, 1, 11]])),
  comp(16, 24, ...spyBase(SP_HEAD, 3, 0, [legs(LEG_D, 17), [SP_ARM_DOWN, 8, 9]], -1)),
];
// aiming: arm raised diagonally with a pistol, pointing high or low
const SP_AIM_HIGH = ['.....11', '....111', '..12331', '.12221.', '12221..', '111....'];
const SP_AIM_LOW = ['111....', '12221..', '.12221.', '..12331', '....111', '.....11'];
const spAimHigh = comp(16, 24, ...spyBase(SP_HEAD_MOUTH, 3, 0, [legs(LEG_STAND, 18), [SP_AIM_HIGH, 9, 5]]));
const spAimLow = comp(16, 24, ...spyBase(SP_HEAD_MOUTH, 3, 0, [legs(LEG_STAND, 18), [SP_AIM_LOW, 9, 10]]));
const SP_DUCK_BODY = ['1133333311', '1222132221', '1222232221', '1111111111'];
const spDuck = comp(16, 24, [SP_HEAD, 3, 7], [SP_DUCK_BODY, 3, 16], [['1222222222221', '1222222222221'], 2, 20], legs(AG_DUCK_LEGS, 22), [['33'], 11, 17]);
// death: hit (arms flung), stagger, fall, flat
const SP_HEAD_DEAD = ['...11111...', '..1111111..', '..1222221..', '11111111111', '..11113333.', '..111111111', '..11113333.', '..11111313.', '....33.....'];
const spDie0 = comp(16, 24, [SP_STUB_BACK, 0, 10], ...spyBase(SP_HEAD_DEAD, 2, 0, [legs(LEG_STAND, 18), [['.111', '.131', '.131', '.121', '.121', '1221', '111.'], 12, 5]]));
const spDie1 = comp(16, 24, [SP_STUB_BACK, 0, 12],
  [SP_HEAD_DEAD, 0, 6], [SP_BODY.slice(0, 6), 2, 15], [['1222222222221'], 1, 21], [['.111.111'], 4, 22], [['.111.111'], 4, 23]);
const SP_LIE_HEAD = ['..11111....', '.1111111...', '11222221111', '11113333311', '.11113311..'];
const SP_LIE_TORSO = ['1111111', '1222221', '1222221', '1222221', '1111111'];
const SP_LIE_LEGS = ['.11', '111', '111', '111'];
const spDie2 = comp(16, 24, [['.11111.', '1133331', '1313131', '1133331', '.11111.'], 0, 19], [SP_LIE_TORSO, 7, 19], [SP_LIE_LEGS, 13, 20], [['11'], 14, 18], [['11111'], 0, 18]);
const spDie3 = comp(16, 24, [['.11111.', '1133331', '1313131', '1133331', '.11111.'], 0, 20], [['111111', '122221', '122221', '111111'], 7, 20], [['.11', '111', '111', '11.'], 13, 20], [['111'], 0, 19]);

const S: SpriteDef[] = [
  defineSprite('agent_stand', 16, 24, AG_COLORS, [agStand]),
  defineSprite('agent_walk', 16, 24, AG_COLORS, agWalk),
  defineSprite('agent_jump', 16, 24, AG_COLORS, [agJump]),
  defineSprite('agent_kick', 16, 24, AG_COLORS, [agKick]),
  defineSprite('agent_duck', 16, 24, AG_COLORS, [agDuck]),
  defineSprite('agent_crouch', 16, 24, AG_COLORS, [agCrouch]),
  defineSprite('agent_shoot', 16, 24, AG_COLORS, [agShoot]),
  defineSprite('agent_shoot_duck', 16, 24, AG_COLORS, [agShootDuck]),
  defineSprite('agent_die', 16, 24, AG_COLORS, [agDie0, agDie1, agDie2]),
  defineSprite('agent_hang', 16, 24, AG_COLORS, [agHang0, agHang1]),
  defineSprite('agent_selfie', 16, 24, AG_COLORS, [agSelfie0, agSelfie1]),
  defineSprite('spy_stand', 16, 24, SP_COLORS, [spStand]),
  defineSprite('spy_walk', 16, 24, SP_COLORS, spWalk),
  defineSprite('spy_aim_high', 16, 24, SP_COLORS, [spAimHigh]),
  defineSprite('spy_aim_low', 16, 24, SP_COLORS, [spAimLow]),
  defineSprite('spy_duck', 16, 24, SP_COLORS, [spDuck]),
  defineSprite('spy_die', 16, 24, SP_COLORS, [spDie0, spDie1, spDie2, spDie3]),
];


// ---------------------------------------------------------------------------------------------
// Shared helpers for the civilians below
// ---------------------------------------------------------------------------------------------
/** Give 3+ px wide black leg runs a coloured (slot 2) core, keeping the last row as black shoes. */
function fillLegs(rows: string[]): string[] {
  return rows.map((r, i) =>
    i === rows.length - 1
      ? r
      : r.replace(/1{3,}/g, (m) => '1' + '2'.repeat(m.length - 2) + '1'),
  );
}
function linePart(w: number, h: number, x0: number, y0: number, x1: number, y1: number, ch: string): Part {
  const g: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / (n || 1));
    const y = Math.round(y0 + ((y1 - y0) * i) / (n || 1));
    g[y][x] = ch;
  }
  return [g.map((r) => r.join('')), 0, 0];
}
/** Same walk cycle as the agent, with configurable parts. */
function walkCycle(
  w: number, ox: number, head: string[], hx: number, body: string[], flare: string[], arms: { down: string[]; fwd: string[]; back: string[]; stubB: string[]; stubF: string[] },
  legsA: string[], legsB: string[], legsD: string[],
): string[][] {
  void w; void ox;
  const mk = (extra: Part[], dy: number, l: string[], ly: number, armP: Part): string[] =>
    comp(16, 24, ...extra, [head, hx, dy], [body, 3, 8 + dy], [flare, 2, 16 + dy], legs(l, ly), armP);
  return [
    mk([[arms.stubB, 0, 11]], 0, legsA, 18, [arms.fwd, 8, 10]),
    mk([], -1, legsB, 17, [arms.down, 8, 9]),
    mk([[arms.stubF, 13, 11]], 0, legsA, 18, [arms.back, 1, 10]),
    mk([], -1, legsD, 17, [arms.down, 8, 9]),
  ];
}

// ---------------------------------------------------------------------------------------------
// JANITOR. slots: 1 black, 2 blue overalls, 3 skin
// ---------------------------------------------------------------------------------------------
const JN_COLORS = [C.BLACK, C.BLUE, C.TAN];
const JN_HEAD = ['.111111..', '12222221.', '111111111', '11113333.', '11113313.', '111133333', '11113111.', '...33....'];
const JN_HEAD_FULL = ['.111111..', '12222221.', '111111111', '11113333.', '11113313.', '111133333', '11113111.', '...33....'];
const JN_BODY = ['1133332211', '1212222121', '1212222121', '1221111221', '1222222221', '1222222221', '1222222221', '1222222221'];
const JN_FLARE = ['122222222221', '111111111111'];
const jnLegs = (r: string[]): string[] => fillLegs(r);
const JN_ARMS = {
  down: swap(AG_ARM_DOWN, { '2': '3' }),
  fwd: swap(AG_ARM_FWD, { '2': '3' }),
  back: swap(AG_ARM_BACK, { '2': '3' }),
  stubB: AG_STUB_BACK,
  stubF: AG_STUB_FWD,
};
const jnWalk = walkCycle(16, 0, JN_HEAD, 4, JN_BODY, JN_FLARE, JN_ARMS, jnLegs(LEG_A), jnLegs(LEG_B), jnLegs(LEG_D));
S.push(defineSprite('janitor_walk', 16, 24, JN_COLORS, jnWalk));

// mopping: leaning into the mop, 24x24. The mop head sweeps across the floor.
function janitorMop(head: string[], mopX: number, handX: number, handY: number): string[] {
  const mop: string[] = ['1111', '1333', '3333', '3333'];
  return comp(24, 24,
    linePart(24, 24, handX, handY, mopX + 1, 19, '1'),
    [head, 3, 3], [JN_BODY.slice(0, 7), 2, 11], [JN_FLARE.slice(0, 1), 1, 18],
    legs(jnLegs(['....1111..1111..', '...111.....111..', '...111.....111..', '...111.....111..', '..1111.....1111.']), 19),
    [swap(AG_ARM_FWD, { '2': '3' }), 8, 13], [mop, mopX, 20],
  );
}
S.push(defineSprite('janitor_mop', 24, 24, JN_COLORS, [janitorMop(JN_HEAD, 16, 13, 14), janitorMop(JN_HEAD, 20, 13, 14), janitorMop(JN_HEAD, 18, 13, 14)]));

// ---------------------------------------------------------------------------------------------
// MALL WALKERS: retirees in tracksuits, arms pumping. slots: 1 black, 2 tracksuit, 3 white (skin/hair/stripes)
// ---------------------------------------------------------------------------------------------
const WK_HEAD = ['.111111..', '13333331.', '122222221', '13333131.', '133333331', '13311331.', '.1333331.', '..1331...'];
const WK_HEAD_B = ['.111111..', '13333331.', '122222221', '13111131.', '133333331', '13311331.', '.1333331.', '..1331...'];
const WK_HEAD_HEY = ['.111111..', '13333331.', '121222121', '13313131.', '133333331', '13111131.', '.1311131.', '..1331...'];
const WK_BODY = ['1133332211', '1222122221', '1222122221', '1222122221', '1222122221', '1222122221', '1222222221', '1222222221'];
const WK_BODY_B = ['1133332211', '1223123221', '1223123221', '1223123221', '1223123221', '1223123221', '1222222221', '1222222221'];
const WK_FLARE = ['122222222221', '111111111111'];
const BENT_FWD = ['....111', '....131', '.111221', '.122221', '.111111'];
const BENT_BACK = flip(BENT_FWD);
const wkArms = {
  down: swap(AG_ARM_DOWN, { '3': '3' }),
  fwd: BENT_FWD,
  back: BENT_BACK,
  stubB: AG_STUB_BACK,
  stubF: AG_STUB_FWD,
};
function wkWalk(head: string[], body: string[]): string[][] {
  const cyc = walkCycle(16, 0, head, 4, body, WK_FLARE, wkArms, fillLegs(LEG_A), fillLegs(LEG_B), fillLegs(LEG_D));
  return cyc;
}
S.push(defineSprite('walker_a', 16, 24, [C.BLACK, C.SKY, C.WHITE], wkWalk(WK_HEAD, WK_BODY)));
S.push(defineSprite('walker_b', 16, 24, [C.BLACK, C.PINK, C.WHITE], wkWalk(WK_HEAD_B, WK_BODY_B)));
S.push(defineSprite('walker_hey', 16, 24, [C.BLACK, C.SKY, C.WHITE], [
  comp(16, 24, [WK_HEAD_HEY, 4, 0], [WK_BODY, 3, 8], [WK_FLARE, 2, 16], legs(fillLegs(LEG_STAND), 18), [AG_ARM_UP.map((r) => r.replace(/2/g, '2')), 12, 3], [AG_ARM_DOWN, 8, 9]),
]));

// ---------------------------------------------------------------------------------------------
// MALL COP on a Segway (24x24). slots: 1 black, 2 blue uniform, 3 skin
// ---------------------------------------------------------------------------------------------
const CP_COLORS = [C.BLACK, C.BLUE, C.TAN];
const SEG_WHEEL = ['..1111..', '.122221.', '12222221', '12212221', '12222221', '.122221.', '..1111..'];
const SEG_WHEEL2 = ['..1111..', '.122221.', '12222221', '12221221', '12222221', '.122221.', '..1111..'];
const COP_HEAD = ['.11111.', '1111111', '1111333', '1131313', '.113333', '..1333.'];
const COP_BODY = ['.122221.', '12322221', '12222221', '12212221', '.122221.'];
const COP_LEGS = ['.1221.121', '.1221.121', '.1221.121', '.1331.131'];
const SEG_PLATFORM = ['1111111111111', '1222222222221'];
const SEG_STALK = ['11', '12', '12', '12', '12', '12', '12', '12'];
function copSegway(bob: number, wheel: string[]): string[] {
  return comp(24, 24,
    [wheel, 8, 17], [SEG_PLATFORM, 5, 15], [SEG_STALK, 16, 8],
    [['1111'], 14, 7], [COP_HEAD, 7, bob], [COP_BODY, 6, 6 + bob], [COP_LEGS, 7, 11],
    [['..111', '.1331', '.111.'], 12, 7 + bob]);
}
S.push(defineSprite('cop_segway', 24, 24, CP_COLORS, [copSegway(0, SEG_WHEEL), copSegway(1, SEG_WHEEL2)]));
S.push(defineSprite('cop_whistle', 24, 24, CP_COLORS, [comp(24, 24,
  [SEG_WHEEL, 8, 17], [SEG_PLATFORM, 5, 15], [SEG_STALK, 16, 8],
  [COP_HEAD, 7, 0], [COP_BODY, 6, 6], [COP_LEGS, 7, 11],
  [['.111', '1331', '1331', '.11.'], 12, 3], [['3'], 11, 3])]));

// ---------------------------------------------------------------------------------------------
// STORE (top-down, 16x16). Agent: slots 1 black, 2 red coat, 3 skin
// ---------------------------------------------------------------------------------------------
const T_HEAD_DOWN = ['.111111.', '11111111', '11333311', '13133131', '13333331', '.133331.'];
const T_HEAD_UP = ['.111111.', '11111111', '11111111', '11111111', '11111111', '.113311.'];
const T_HEAD_SIDE = ['.111111.', '11111111', '11111333', '11111313', '11113333', '.111333.'];
const T_BODY_FRONT = ['....11222211....', '...1222222221...', '..122222222221..', '..132222222231..', '..112222222211..', '...1222222221...'];
const T_BODY_SIDE = ['.....112211.....', '....12222221....', '....12222221....', '....12222331....', '....12222221....', '....12222221....'];
const T_LEGS_FRONT_A = ['.....11..11.....', '.....11..11.....', '....111.........'];
const T_LEGS_FRONT_B = ['.....11..11.....', '.....11..11.....', '.........111....'];
const T_LEGS_FRONT_S = ['.....11..11.....', '.....11..11.....', '....111..111....'];
const T_LEGS_SIDE_A = ['.....11..11.....', '....11....11....', '...111....111...'];
const T_LEGS_SIDE_B = ['......1111......', '......1111......', '......1111......'];
const tFront = (head: string[], body: string[], lg: string[], extra: Part[] = [], dy = 0): string[] =>
  comp(16, 16, [head, 4, 1 + dy], [body, 0, 7 + dy], [lg, 0, 13 + dy], ...extra);
const tSide = (head: string[], body: string[], lg: string[], extra: Part[] = []): string[] =>
  comp(16, 16, [head, 4, 1], [body, 0, 7], [lg, 0, 13], ...extra);

S.push(defineSprite('agent_top_down', 16, 16, AG_COLORS, [tFront(T_HEAD_DOWN, T_BODY_FRONT, T_LEGS_FRONT_A), tFront(T_HEAD_DOWN, T_BODY_FRONT, T_LEGS_FRONT_B)]));
S.push(defineSprite('agent_top_up', 16, 16, AG_COLORS, [tFront(T_HEAD_UP, T_BODY_FRONT, T_LEGS_FRONT_A), tFront(T_HEAD_UP, T_BODY_FRONT, T_LEGS_FRONT_B)]));
S.push(defineSprite('agent_top_side', 16, 16, AG_COLORS, [tSide(T_HEAD_SIDE, T_BODY_SIDE, T_LEGS_SIDE_A), tSide(T_HEAD_SIDE, T_BODY_SIDE, T_LEGS_SIDE_B)]));

const T_ITEM = ['11111111', '13333331', '13111331', '11111111'];
S.push(defineSprite('agent_top_hold', 16, 16, AG_COLORS, [comp(16, 16,
  [T_ITEM, 4, 0], [T_HEAD_DOWN, 4, 4],
  [['13', '13', '12', '12', '12', '12'], 2, 3], [flip(['13', '13', '12', '12', '12', '12']), 12, 3],
  [T_BODY_FRONT.slice(0, 4), 0, 10],
  [['....11..11......', '....111..111....'], 0, 14])]));
S.push(defineSprite('agent_top_search', 16, 16, AG_COLORS, [
  comp(16, 16, [T_HEAD_UP, 4, 3], [T_BODY_FRONT, 0, 9], [['....11..11......'], 0, 15], [['13', '12', '12', '12'], 3, 5], [['13', '12', '12', '12'], 11, 3]),
  comp(16, 16, [T_HEAD_UP, 4, 2], [T_BODY_FRONT, 0, 8], [T_LEGS_FRONT_S.slice(0, 2), 0, 14], [['13', '12', '12', '12'], 11, 4], [['13', '12', '12', '12'], 3, 3]),
]));
const T_HEAD_XEYES = ['.111111.', '11111111', '11333311', '11313131', '13333331', '.133331.'];
const T_LIE_HEAD = ['..1111..', '.111111.', '11333311', '13131331', '13333331', '.111111.'];
S.push(defineSprite('agent_top_die', 16, 16, AG_COLORS, [
  comp(16, 16, [T_HEAD_XEYES, 4, 2], [T_BODY_FRONT.slice(0, 5), 0, 8], [['..13........31..'], 0, 8], [['....11..11......'], 0, 13], [['...111..111.....'], 0, 14]),
  comp(16, 16, [['.1111...', '111111..', '113331..', '131311..', '133331..', '.1111...'], 1, 8], [['11111111', '12222221', '12222221', '12222221', '11111111'], 7, 9], [['.111', '1111', '1111'], 12, 9], [['..1', '.11'], 13, 12]),
]));
S.push(defineSprite('agent_top_stun', 16, 16, AG_COLORS, [comp(16, 16,
  [['.3..3..3.'], 3, 0], [T_HEAD_XEYES, 4, 2], [T_BODY_FRONT.slice(0, 4), 0, 8], [['..112222222211..', '...1222222221...'], 0, 12],
  [['.....11..11.....', '....111..111....'], 0, 14])]));

// ---------------------------------------------------------------------------------------------
// SPY (top-down). slots: 1 black, 2 dark grey suit, 3 skin
// ---------------------------------------------------------------------------------------------
const ST_HAT_DOWN = ['..1111..', '.122221.', '11111111', '13333331', '11111111', '.133331.'];
const ST_HAT_UP = ['..1111..', '.122221.', '11111111', '11111111', '11111111', '.111111.'];
const ST_HAT_SIDE = ['..1111..', '.122221.', '11111111', '11111333', '11111111', '.111333.'];
const ST_BODY_FRONT = ['....11331111....', '...1222132221...', '..122221322221..', '..132221322231..', '..112222222211..', '...1222222221...'];
const ST_BODY_UP = ['....11111111....', '...1222222221...', '..122222222221..', '..132222222231..', '..112222222211..', '...1222222221...'];
const ST_BODY_SIDE = ['.....111111.....', '....12222221....', '....12212221....', '....12233221....', '....12222221....', '....12222221....'];
const sFront = (head: string[], body: string[], lg: string[], extra: Part[] = []): string[] =>
  comp(16, 16, [head, 4, 1], [body, 0, 7], [lg, 0, 13], ...extra);
S.push(defineSprite('spytop_down', 16, 16, SP_COLORS, [sFront(ST_HAT_DOWN, ST_BODY_FRONT, T_LEGS_FRONT_A), sFront(ST_HAT_DOWN, ST_BODY_FRONT, T_LEGS_FRONT_B)]));
S.push(defineSprite('spytop_up', 16, 16, SP_COLORS, [sFront(ST_HAT_UP, ST_BODY_UP, T_LEGS_FRONT_A), sFront(ST_HAT_UP, ST_BODY_UP, T_LEGS_FRONT_B)]));
S.push(defineSprite('spytop_side', 16, 16, SP_COLORS, [sFront(ST_HAT_SIDE, ST_BODY_SIDE, T_LEGS_SIDE_A), sFront(ST_HAT_SIDE, ST_BODY_SIDE, T_LEGS_SIDE_B)]));
S.push(defineSprite('spytop_aim_down', 16, 16, SP_COLORS, [sFront(ST_HAT_DOWN, ST_BODY_FRONT, T_LEGS_FRONT_S, [[['..1', '.13', '.13', '.11', '.11'], 11, 9]])]));
S.push(defineSprite('spytop_aim_up', 16, 16, SP_COLORS, [sFront(ST_HAT_UP, ST_BODY_UP, T_LEGS_FRONT_S, [[['.11', '.11', '.13', '.13', '.1.'], 12, 1]])]));
S.push(defineSprite('spytop_aim_side', 16, 16, SP_COLORS, [sFront(ST_HAT_SIDE, ST_BODY_SIDE, T_LEGS_SIDE_B, [[['....1111', '11113311', '11111...'], 8, 9]])]));
S.push(defineSprite('spytop_die', 16, 16, SP_COLORS, [
  comp(16, 16, [ST_HAT_DOWN, 4, 2], [ST_BODY_FRONT.slice(0, 5), 0, 8], [['..13........31..'], 0, 8], [['....11..11......'], 0, 13], [['...111..111.....'], 0, 14]),
  comp(16, 16, [['..1111..', '.122221.', '11111111', '13333331', '.111111.'], 1, 9], [['11111111', '12222221', '12222221', '11111111'], 7, 9], [['111', '111', '111'], 13, 10], [['..1', '.11'], 13, 12]),
]));

// ---------------------------------------------------------------------------------------------
// SECURITY BOT (top-down). slots: 1 black, 2 steel grey, 3 red eye
// ---------------------------------------------------------------------------------------------
const BOT_BODY = [
  '.......11.......',
  '.......13.......',
  '...1111111111...',
  '..122222222221..',
  '.11222222222211.',
  '.12211111111221.',
  '.12213333331221.',
  '.12211111111221.',
  '.12222222222221.',
  '.11222112112211.',
  '..122212212221..',
  '..111111111111..',
  '..111......111..',
  '.1111......1111.',
];
const BOT_B = BOT_BODY.map((r, i) => (i === 6 ? '.12211333331221.' : i === 12 ? '..111......111..' : i === 13 ? '.1111......1111.' : r));
S.push(defineSprite('bot_top', 16, 16, [C.BLACK, C.GRAY_M, C.RED], [
  comp(16, 16, [BOT_BODY, 0, 2]),
  comp(16, 16, [BOT_B, 0, 2], [['..11....11....'], 1, 15]),
]));
const BOT_HIT = BOT_BODY.map((r, i) => (i === 6 ? '.12213131311221.'.slice(0, 16) : i === 1 ? '.......11.......' : r));
S.push(defineSprite('bot_top_hit', 16, 16, [C.BLACK, C.WHITE, C.RED], [comp(16, 16, [BOT_HIT, 0, 2], [['.3.....3....3.'], 1, 0])]));

// ---------------------------------------------------------------------------------------------
// OLD CLERK (top-down, Zelda cave style). slots: 1 red robe/eyes, 2 skin, 3 white beard/hair
// ---------------------------------------------------------------------------------------------
S.push(defineSprite('clerk_top', 16, 16, [C.RED, C.TAN, C.WHITE], [comp(16, 16,
  [['....33333333....', '...3333333333...', '...3322222233...', '...3212222123...', '...3322222233...', '...3333333333...', '....33333333....', '...111133111....'], 0, 1],
  [['..111333333111..', '.11111111111111.', '.11111111111111.', '.12111111111121.', '.11111111111111.', '..111111111111..', '..111111111111..'], 0, 8],
)]));

// ---------------------------------------------------------------------------------------------
// WIND-UP TOY SOLDIER (8x8) - slots: 1 black, 2 red, 3 yellow (face + key)
// ---------------------------------------------------------------------------------------------
S.push(defineSprite('windup_toy', 8, 8, [C.BLACK, C.RED, C.YELLOW], [
  ['..1111..', '..3313..', '.122221.', '31122221', '31122221', '.122221.', '..11.11.', '..11..11'],
  ['..1111..', '..3313..', '.122221.', '3.122221', '33122221', '.122221.', '...1111.', '...1..1.'],
]));

// ---------------------------------------------------------------------------------------------
// SPY IN THE FITTING ROOM (16x16) - slots: 1 black, 2 pink Hawaiian shirt, 3 skin
// ---------------------------------------------------------------------------------------------
const FIT_HEAD = ['......1111......', '.....112211.....', '..111111111111..', '....13333331....', '....13133131....', '....13311331....', '.....133331.....'];
const FIT_SHIRT = ['1222222221', '1212212121', '1221221221', '1212212121', '1222222221', '1222222221'];
S.push(defineSprite('spy_fitting', 16, 16, [C.BLACK, C.PINK, C.TAN], [
  comp(16, 16, [FIT_HEAD, 0, 0], [FIT_SHIRT, 3, 7], [['3', '3'], 2, 8], [['3', '3'], 13, 8], [['.....33..33.....', '.....33..33.....', '....111..111....'], 0, 13]),
  comp(16, 16, [FIT_HEAD, 0, 0], [FIT_SHIRT, 3, 7], [['3', '3', '3'], 2, 5], [['3', '3', '3'], 13, 5], [['.....33..33.....', '....33....33....', '...111....111...'], 0, 13], [['.3.', '.3.', '...', '.3.'], 0, 0]),
]));

// thrown shoe (8x8) - slots: 1 black, 2 red, 3 white
S.push(defineSprite('shoe', 8, 8, [C.BLACK, C.RED, C.WHITE], [[
  '........', '.111....', '.1221...', '.12321..', '.1222211', '.1222221', '13333331', '.111111.',
]]));

//@@MORE
export const SPRITES_CHARACTERS: SpriteDef[] = S;
