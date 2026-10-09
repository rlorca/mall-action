import { Rng, hashSeed } from './rng';
import { StoreId } from './copy';
import { LevelSetup, setupLevel } from './levelsetup';
import { PACKAGE_COUNT } from './level';
import { PowerKind, PowerState, applyPower, newPowers, powerName } from './powerups';
import { POINTS, ScoreState, addScore, newScoreState, START_CONTINUES } from './scoring';
import { EventQueue } from './events';

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  /** world (mall) or screen coordinates. */
  space: 'mall' | 'screen';
}

/** Everything that survives across mall <-> store <-> continue. */
export interface RunState {
  seed: number;
  rng: Rng;
  loop: number;
  blackFriday: boolean;
  score: ScoreState;
  hiScore: number;
  continuesLeft: number;
  powers: PowerState;
  setup: LevelSetup;
  packages: StoreId[];
  inventory: string[];
  photoStripGiven: boolean;
  gamestonkSeen: boolean;
  /** Frames the agent has spent on this level (time bonus). */
  levelFrames: number;
  events: EventQueue;
}

export function newRun(seed: number, blackFriday = false, hiScore = 0): RunState {
  return {
    seed,
    rng: new Rng(hashSeed('run', seed)),
    loop: 1,
    blackFriday,
    score: newScoreState(),
    hiScore,
    continuesLeft: START_CONTINUES,
    powers: newPowers(),
    setup: setupLevel(seed, 1, blackFriday),
    packages: [],
    inventory: [],
    photoStripGiven: false,
    gamestonkSeen: false,
    levelFrames: 0,
    events: new EventQueue(),
  };
}

/** Start the next loop (harder): fresh packages / store contents, score and lives carried. */
export function nextLoop(run: RunState): void {
  run.loop++;
  run.setup = setupLevel(run.seed, run.loop, run.blackFriday);
  run.packages = [];
  run.levelFrames = 0;
  run.gamestonkSeen = false;
  for (const k of Object.keys(run.setup)) run.setup[k].visited = false;
  run.photoStripGiven = false;
  run.inventory = [];
  run.powers.radar = false; // Radar lasts "the rest of the level"
}

export function award(run: RunState, pts: number, popup?: { x: number; y: number; space: 'mall' | 'screen' }): void {
  const gotLife = addScore(run.score, pts);
  if (run.score.score > run.hiScore) run.hiScore = run.score.score;
  if (popup && pts !== 0) run.events.emit('popup', { ...popup, text: (pts > 0 ? '+' : '') + pts });
  if (gotLife) run.events.emit('extraLife', { why: 'score' });
}

export function addLife(run: RunState): void {
  run.score.lives++;
  run.events.emit('extraLife', { why: 'item' });
}

export function packageCount(run: RunState): number {
  return run.packages.length;
}
export function packagesLeft(run: RunState): number {
  return PACKAGE_COUNT - run.packages.length;
}

/** Pick up a power-up: apply it, +50 points, and return its display name. */
export function collectPower(run: RunState, kind: PowerKind, popup?: { x: number; y: number; space: 'mall' | 'screen' }): string {
  const res = applyPower(run.powers, kind);
  if (res.extraLife) addLife(run);
  award(run, POINTS.powerup, popup);
  return powerName(kind);
}
