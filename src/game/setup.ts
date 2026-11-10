/** New game / new level construction, including what every fixture hides. */
import { Rng } from '../core/rng';
import { createSplash } from '../flickersoft/splash';
import type { Car, Fixture, Game, Level, Player, StoreState } from './types';
import { CABLE, FLOOR_Y, F_2, F_R, LAMPS, SHAFTS, STORES, WALKER_RANGES, JANITOR_RANGE, FOUNTAINS, KIOSKS, type StoreDef } from './level';
import { ROOMS } from './rooms';
import { difficulty, newPowers, randomPower } from './powers';
import type { PowerKind } from './copy';

export const START_LIVES = 3;
export const START_CONTINUES = 3;

export function newGame(seed: number): Game {
  return {
    seed,
    rng: new Rng(seed),
    frame: 0,
    screen: 'splash',
    t: 0,
    splash: createSplash(),
    konami: [],
    bfArmed: false,
    score: 0,
    hi: 0,
    lives: START_LIVES,
    continues: START_CONTINUES,
    loop: 1,
    blackFriday: false,
    extraGiven: false,
    pkgs: 0,
    inventory: [],
    photoStrip: false,
    visited: [],
    eggDone: false,
    overlay: 'none',
    level: null,
    clear: null,
    clears: 0,
    sfx: [],
  };
}

/** Start a fresh run from the title screen. */
export function startGame(g: Game, blackFriday: boolean): void {
  g.score = 0;
  g.lives = START_LIVES;
  g.continues = START_CONTINUES;
  g.loop = 1;
  g.blackFriday = blackFriday;
  g.extraGiven = false;
  g.inventory = [];
  g.photoStrip = false;
  g.visited = [];
  g.eggDone = false;
  g.overlay = 'none';
  g.clear = null;
  g.screen = 'play';
  g.t = 0;
  g.level = newLevel(g);
}

/**
 * Decide what each fixture of a store hides.
 * - target stores: exactly one package, a trap or two, a power-up, the rest nothing
 * - power-up shops: only power-ups or nothing (never trapped)
 * - Black Friday: every non-package fixture holds a power-up
 */
export function assignFixtures(rng: Rng, def: StoreDef, blackFriday: boolean): Fixture[] {
  const tpl = ROOMS[def.key];
  if (!tpl) return [];
  const fx: Fixture[] = tpl.fixtures.map((f) => ({ ...f, content: 'none', opened: false, revealed: false, toysOut: false }));
  const order = rng.shuffle(fx.map((_, i) => i));
  const food = def.key === 'hotspy' ? 0.8 : 0.12;
  let k = 0;
  if (def.role === 'target') {
    fx[order[k++]].content = 'package';
    const traps = fx.length >= 8 ? 2 : 1;
    for (let i = 0; i < traps; i++) fx[order[k++]].content = 'trap';
    const pows = def.key === 'hotspy' ? 2 : 1;
    for (let i = 0; i < pows && k < order.length; i++) fx[order[k++]].content = randomPower(rng, food);
  } else {
    const pows = Math.max(2, Math.ceil(fx.length / 3));
    for (let i = 0; i < pows && k < order.length; i++) fx[order[k++]].content = randomPower(rng, food);
  }
  if (blackFriday) for (const f of fx) if (f.content !== 'package') f.content = randomPower(rng, food) as PowerKind;
  return fx;
}

export function newPlayer(): Player {
  return {
    x: CABLE.x0, y: CABLE.y0 + 26, vx: 0, vy: 0, face: 1, onGround: false, ducking: false, kicking: false, sliding: 0,
    esc: null, hidden: 0, boothCd: 0, frozen: 0, dying: 0, invuln: 0, shootCd: 0, shootAnim: 0, landT: 0,
    fallFrom: 0, safeX: 112, safeY: FLOOR_Y[F_R], stillT: 0, walkT: 0, ride: null, cause: '',
  };
}

export function newLevel(g: Game): Level {
  const rng = g.rng;
  g.pkgs = 0;
  const d = difficulty(g.loop, false, g.blackFriday);
  const stores: StoreState[] = STORES.map((def) => ({ def, cleared: false, fixtures: assignFixtures(rng, def, g.blackFriday) }));
  // Cars start where the player needs them: A on the roof, B on 4F, C on 1F.
  const startFloor = [F_R, 1, 4];
  const cars: Car[] = SHAFTS.map((s, i) => ({ y: FLOOR_Y[startFloor[i]], dir: 0, target: -1, manual: false, door: 8, timer: 120, call: -1, pickup: false }));
  return {
    mode: 'arrive',
    t: 0,
    arriveT: 0,
    selfie: null,
    player: newPlayer(),
    cars,
    spies: [],
    bullets: [],
    lamps: LAMPS.map((l) => ({ x: l.x, floor: l.floor, disco: l.disco, state: 'hang', y: FLOOR_Y[l.floor] - 14, vy: 0, dir: 0 })),
    dark: [],
    coins: [],
    pickups: [],
    walkers: WALKER_RANGES.map(([lo, hi], i) => ({ x: lo + 20 + i * 30, dir: i ? -1 : 1, lo, hi, heyT: 0 })),
    janitor: { x: JANITOR_RANGE[0] + 30, dir: 1, mopT: 0, nextMop: 420 },
    wets: [],
    cop: { x: 230 + rng.int(120), floor: 1 + rng.int(4), dir: rng.chance(0.5) ? 1 : -1, chase: 0, cool: 0 },
    fountainCd: FOUNTAINS.map(() => 0),
    kioskCd: KIOSKS.map(() => 0),
    kioskPanel: null,
    photoStripT: 0,
    stores,
    room: null,
    powers: newPowers(),
    alarm: false,
    alarmAt: d.alarmAt,
    spawnT: 300,
    nextId: 1,
    shotId: 0,
    volleyId: 0,
    lastShotT: -999,
    popups: [],
    bubbles: [],
    fx: [],
    banner: null,
    paT: 1500 + rng.int(600),
    lastPa: -1,
    shake: 0,
    camX: 0,
    camY: 0,
    trans: null,
    exitCd: 0,
    cleared: false,
  };
}
export { F_2 };
