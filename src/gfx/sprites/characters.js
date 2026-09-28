import { C } from '../palette.js';
import { pad, stamp } from './util.js';

// ---------------------------------------------------------------------------
// Mall characters: 16×24, facing right, feet on the bottom row.
// Slots: 1 = outline/dark, 2 = clothes, 3 = skin.
// ---------------------------------------------------------------------------
const W = 16;

const HEAD_AGENT = [
  '',
  '......1111',
  '.....111111',
  '.....1113333',
  '.....1133313',
  '.....1133333',
  '......13333',
  '.......333',
];
const HEAD_SPY = [
  '......1111',
  '.....111111',
  '...1111111111',
  '.....1333333',
  '.....1311111',
  '.....1333333',
  '......13333',
  '.......333',
];
const TORSO = [
  '....22222222',
  '...2222222222',
  '...2222222222',
  '...2222222222',
  '...222222223',
  '....2222222',
  '....1111111',
  '....2222222',
];
const TORSO_SHOOT = [
  '....22222222',
  '...2222222223311',
  '...2222222222',
  '...222222222',
  '...222222222',
  '....2222222',
  '....1111111',
  '....2222222',
];
const LEGS_STAND = [
  '....222.222',
  '.....11.11',
  '.....11.11',
  '.....11.11',
  '.....11.11',
  '.....11.11',
  '....111.111',
  '....111.1111',
];
const LEGS_WALK1 = [
  '....222.222',
  '....11...11',
  '...11....11',
  '...11.....11',
  '..11......11',
  '..11.......11',
  '.111.......111',
  '.11.........11',
];
const LEGS_WALK2 = [
  '....222222',
  '.....1111',
  '.....111',
  '......11',
  '......11',
  '.....111',
  '.....11',
  '.....1111',
];
const LEGS_JUMP = ['....2222222', '...111111111', '..111....111', '..11......11', '..1........1'];
const LEGS_KICK = ['....2222222', '....11111111111', '....1111...1111', '....11', '....11', '...111'];

const body = (head, torso, legs) => pad([...head, ...torso, ...legs], W, 24);
const duck = (head, gun = false) => pad([
  ...Array(10).fill(''),
  ...head,
  '....22222222',
  gun ? '...2222222223311' : '...2222222223',
  '...2222222222',
  '..22222222222',
  '..1111...1111',
  '..111....1111',
], W, 24);
const LYING = pad(['.111', '13332222222111', '13312222222111', '.33..22222..1111'], W, 24, { bottom: true });

function mallSet(prefix, head) {
  const stand = body(head, TORSO, LEGS_STAND);
  const jump = body(head, TORSO, LEGS_JUMP);
  return {
    [`${prefix}Stand`]: [stand],
    [`${prefix}Walk`]: [body(head, TORSO, LEGS_WALK1), body(head, TORSO, LEGS_WALK2)],
    [`${prefix}Duck`]: [duck(head)],
    [`${prefix}Jump`]: [jump],
    [`${prefix}Die`]: [jump, duck(head), LYING],
    stand, jump,
  };
}

const agent = mallSet('agent', HEAD_AGENT);
const spy = mallSet('spy', HEAD_SPY);

const AGENT_ZIP = pad([
  '...3.....3',
  '...2.....2',
  '...22...22',
  ...HEAD_AGENT.slice(1),
  ...TORSO.slice(1),
  ...LEGS_JUMP, '', '',
], W, 24);

// spy aiming: high = gun at head height, low = crouched gun at knee height
const SPY_AIM_HIGH = body(HEAD_SPY, ['....22222222', '...2222222223311', ...TORSO.slice(2)], LEGS_STAND);
const SPY_AIM_LOW = duck(HEAD_SPY, true);

// ---------------------------------------------------------------------------
// Top-down characters: 16×16. Same slot meaning.
// ---------------------------------------------------------------------------
const TD_BODY = ['..2222222222', '.322222222223', '.322222222223', '..2222222222', '..2211111122', '...22222222'];
const TD_LEGS_A = ['...111..111', '...111..111', '...11....11'];
const TD_LEGS_B = ['...111...11', '...111...11', '...1.....11'];

const td = (head, legs) => pad([...head, ...TD_BODY, ...legs], W, 16);
const TD_HEAD_DOWN = ['....111111', '...11111111', '...11111111', '...13333331', '...13133131', '...13333331', '....333333'];
const TD_HEAD_UP = ['....111111', '...11111111', '...11111111', '...11111111', '...11111111', '...11111111', '....111111'];
const TD_HEAD_SIDE = ['....111111', '...11111111', '...1111133', '...1113313', '...1113333', '....11333', '.....333'];
const SPY_TD_DOWN = ['....111111', '..1111111111', '...11111111', '...13333331', '...11111111', '...13333331', '....333333'];
const SPY_TD_UP = ['....111111', '..1111111111', '...11111111', '...11111111', '...11111111', '...11111111', '....111111'];
const SPY_TD_SIDE = ['....111111', '...111111111', '...111111111', '...1113333', '...1111111', '....11333', '.....333'];

const TD_SIDE_BODY = ['....222222', '...22222223', '...2222222', '...2222222', '...2111111', '...2222222'];
const tdSide = (head, legs) => pad([...head, ...TD_SIDE_BODY, ...legs], W, 16);
const SIDE_LEGS = [['....11.11', '....11.11', '...111.111'], ['....111', '...11.11', '..111..111']];

const AGENT_HOLD = pad([
  '..3........3',
  '..2..1111..2',
  '..2111111112',
  '..2111111112',
  '...13333331',
  '...13133131',
  '...13333331',
  '....333333',
  '...22222222',
  '...22222222',
  '...22222222',
  '...21111112',
  '...22222222',
  '...111..111',
  '...111..111',
  '...11....11',
], W, 16);

const SPY_CHANGING = [
  pad(['.3..111111..3', '.3.11111111.3', '.33133333313', '..3131111313', '..3133333313', '...33333333', '..3333333333', '..3333333333', '..2222222222', '..2222222222', '...33333333', '...33...33', '...33...33', '...33...33', '..111...111'], W, 16),
  pad(['....111111', '3..11111111..3', '33.13333331.33', '.331311113133', '..3133333313', '...33333333', '..3333333333', '..3333333333', '..2222222222', '..2222222222', '...33333333', '...33...33', '...33...33', '...33...33', '..111...111'], W, 16),
];

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------
const BOT = [
  pad(['', '....11111111', '...1222222221', '..122222222221', '..123312213321', '..122222222221', '..121111111121', '..122222222221', '...1222222221', '....11111111', '...1222222221', '...1222222221', '...1111111111', '..11.1111.11', '..111....111', '...1......1'], W, 16),
  pad(['', '....11111111', '...1222222221', '..122222222221', '..122133122331', '..122222222221', '..121111111121', '..122222222221', '...1222222221', '....11111111', '...1222222221', '...1222222221', '...1111111111', '...11.11.11', '..1.111111.1', '..1........1'], W, 16),
];

const HEAD_JANITOR = ['', '.....222222', '....22222222', '....2222222222', '.....1333333', '.....1333133', '......33333', '.......333'];
const MOP_UP = ['..............1', '.............1.', '............1..', '...........1...'];
const janitorWalk = [
  stamp(body(HEAD_JANITOR, TORSO, LEGS_WALK1), pad([...Array(8).fill(''), ...MOP_UP, '..........1', '.........1', '........1', '.......1', '......1', '.....1', '....1', '...111', '..11111', '.1111111'], W, 24)),
  stamp(body(HEAD_JANITOR, TORSO, LEGS_WALK2), pad([...Array(8).fill(''), ...MOP_UP, '..........1', '.........1', '........1', '.......1', '......1', '.....1', '....1', '...111', '..11111', '.1111111'], W, 24)),
];
const janitorMop = [
  stamp(body(HEAD_JANITOR, TORSO_SHOOT, LEGS_STAND), pad([...Array(10).fill(''), '.............1', '.............1', '.............1', '.............1', '.............1', '.............1', '.............1', '.............1', '...........11111', '..........111111'], W, 24)),
  stamp(body(HEAD_JANITOR, TORSO_SHOOT, LEGS_STAND), pad([...Array(10).fill(''), '.............1', '............1', '...........1', '..........1', '.........1', '........1', '.......1', '......1', '....11111', '...111111'], W, 24)),
];

const HEAD_WALKER = ['', '......1111', '.....111111', '.....1113333', '.....1133313', '.....2222222', '......33333', '.......333'];
const walker = [body(HEAD_WALKER, TORSO, LEGS_WALK1), body(HEAD_WALKER, TORSO, LEGS_WALK2)].map((f) =>
  stamp(f, pad([...Array(22).fill(''), '..11........11', '..11........11'], W, 24)));

const HEAD_COP = ['', '.....222222', '....22222222', '...222222222', '.....1333333', '.....1333133', '......33333', '.......333'];
const segway = (spin) => pad([
  ...HEAD_COP, ...TORSO.slice(0, 6),
  '....22.22.....1',
  '....22.22....1',
  '....22.22...1',
  '....11.11..1',
  '...111111111',
  '..11111111111',
  spin ? '.1.1.....1.1' : '.11.......11',
  spin ? '.11.......11' : '.1.1.....1.1',
  '..11.....11',
  '',
], W, 24);

const OLD_MAN = pad([
  '',
  '.....333333',
  '....33333333',
  '....31333313',
  '....33333333',
  '....22222222',
  '...1222222221',
  '..111222222111',
  '..111122221111',
  '.11111122111111',
  '.11311111111311',
  '.1111111111111',
  '.1111111111111',
  '..111111111111',
  '..111111111111',
  '...1111..1111',
], W, 16);

const WINDUP = [
  pad(['...1', '.2221', '222223', '232323', '222223', '.2.2', '.3.3', ''], 8, 8),
  pad(['..1', '.22211', '222223', '232323', '222223', '..2.2', '..3.3', ''], 8, 8),
];

const HUD_LIFE = pad(['.1111', '111111', '113333', '113313', '113333', '.13333', '..333', ''], 8, 8);

export const DEFS = {
  agentStand: { pal: [C.black, C.red, C.skin], frames: agent.agentStand },
  agentWalk: { pal: [C.black, C.red, C.skin], frames: agent.agentWalk },
  agentDuck: { pal: [C.black, C.red, C.skin], frames: agent.agentDuck },
  agentJump: { pal: [C.black, C.red, C.skin], frames: agent.agentJump },
  agentKick: { pal: [C.black, C.red, C.skin], frames: [body(HEAD_AGENT, TORSO, LEGS_KICK)] },
  agentShoot: { pal: [C.black, C.red, C.skin], frames: [body(HEAD_AGENT, TORSO_SHOOT, LEGS_STAND)] },
  agentDuckShoot: { pal: [C.black, C.red, C.skin], frames: [duck(HEAD_AGENT, true)] },
  agentDie: { pal: [C.black, C.red, C.skin], frames: agent.agentDie },
  agentZip: { pal: [C.black, C.red, C.skin], frames: [AGENT_ZIP] },

  agentTopDown: { pal: [C.black, C.red, C.skin], frames: [td(TD_HEAD_DOWN, TD_LEGS_A), td(TD_HEAD_DOWN, TD_LEGS_B)] },
  agentTopUp: { pal: [C.black, C.red, C.skin], frames: [td(TD_HEAD_UP, TD_LEGS_A), td(TD_HEAD_UP, TD_LEGS_B)] },
  agentTopSide: { pal: [C.black, C.red, C.skin], frames: SIDE_LEGS.map((l) => tdSide(TD_HEAD_SIDE, l)) },
  agentTopHold: { pal: [C.black, C.red, C.skin], frames: [AGENT_HOLD] },

  spyStand: { pal: [C.black, C.darkGrey, C.skin], frames: spy.spyStand },
  spyWalk: { pal: [C.black, C.darkGrey, C.skin], frames: spy.spyWalk },
  spyDuck: { pal: [C.black, C.darkGrey, C.skin], frames: spy.spyDuck },
  spyAimHigh: { pal: [C.black, C.darkGrey, C.skin], frames: [SPY_AIM_HIGH] },
  spyAimLow: { pal: [C.black, C.darkGrey, C.skin], frames: [SPY_AIM_LOW] },
  spyDie: { pal: [C.black, C.darkGrey, C.skin], frames: spy.spyDie },
  spyTopDown: { pal: [C.black, C.darkGrey, C.skin], frames: [td(SPY_TD_DOWN, TD_LEGS_A), td(SPY_TD_DOWN, TD_LEGS_B)] },
  spyTopUp: { pal: [C.black, C.darkGrey, C.skin], frames: [td(SPY_TD_UP, TD_LEGS_A), td(SPY_TD_UP, TD_LEGS_B)] },
  spyTopSide: { pal: [C.black, C.darkGrey, C.skin], frames: SIDE_LEGS.map((l) => tdSide(SPY_TD_SIDE, l)) },
  spyChanging: { pal: [C.black, C.white, C.skin], frames: SPY_CHANGING },

  bot: { pal: [C.black, C.lightGrey, C.red], frames: BOT },
  janitorWalk: { pal: [C.black, C.teal, C.skin], frames: janitorWalk },
  janitorMop: { pal: [C.black, C.teal, C.skin], frames: janitorMop },
  walker: { pal: [C.lightGrey, C.purple, C.skin], frames: walker },
  copSegway: { pal: [C.black, C.navy, C.skin], frames: [segway(false), segway(true)] },
  oldMan: { pal: [C.darkRed, C.white, C.skin], frames: [OLD_MAN] },
  windupToy: { pal: [C.black, C.red, C.yellow], frames: WINDUP },
  hudLife: { pal: [C.black, C.red, C.skin], frames: [HUD_LIFE] },
};

