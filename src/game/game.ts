/**
 * Top-level game flow: splash -> title -> mall/stores -> level clear -> next loop, plus continue and game over.
 * Pure: step(g, input) advances exactly one 60 Hz frame and appends audio/visual events to g.events.
 */
import { BUTTONS, type Button, type PadFrame } from '../core/input';
import { C } from '../core/palette';
import { Rng } from '../core/rng';
import type { SongId } from '../audio/ids';
import type { StoreId } from '../art/manifest';
import { createSplash, stepSplash } from '../splash/logic';
import { BANNERS, HEADLINES, PA_LINES, PA_WRAP, SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE } from './copy';
import { wrap } from '../core/font';
import { POINTS, addScore, banner, sfx, tickPopups, timeBonus } from './common';
import { alarmFrames } from './difficulty';
import { KONAMI } from './konami';
import { newMall, respawnInMall, stepMall, storeDoorOf, updateCamera, DEATH_FRAMES } from './mall';
import { noPowers, powersAfterDeath, tickPowers } from './powerups';
import { setupStores } from './setup';
import { enterStore, respawnInStore, stepStore } from './store';
import { surf } from './layout';
import type { GameState, Level } from './state';

export const START_LIVES = 3;
export const START_CONTINUES = 3;
export const PA_INTERVAL = 3600;
export const PA_FIRST = 1500;
export const CONTINUE_SECONDS = 9;

export interface GameOptions {
  seed: number;
  skipSplash?: boolean;
}

export function createGame(opts: GameOptions): GameState {
  const g: GameState = {
    seed: opts.seed, rng: new Rng(opts.seed), frame: 0, scene: opts.skipSplash ? 'title' : 'splash', sceneT: 0,
    overlay: null, overlayT: 0, fade: null, splash: createSplash(), title: { bf: false, bfT: 0, konami: [] },
    hiScore: 0, score: 0, lives: START_LIVES, continues: START_CONTINUES, loop: 1, blackFriday: false,
    extraLifeGiven: false, inventory: [], photoTaken: false, easterDone: false, visited: [], level: null, banner: null,
    pa: null, shake: 0, events: [], clear: null, cont: null, over: null, nextId: 0,
  };
  return g;
}

export function startNewGame(g: GameState): void {
  g.score = 0;
  g.lives = START_LIVES;
  g.continues = START_CONTINUES;
  g.loop = 1;
  g.blackFriday = g.title.bf;
  g.extraLifeGiven = false;
  g.inventory = [];
  g.photoTaken = false;
  g.easterDone = false;
  g.visited = [];
  startLevel(g);
}

export function startLevel(g: GameState): void {
  const rng = g.rng.fork();
  const lvl: Level = {
    frames: 0, alarm: false, alarmAt: alarmFrames(g.loop), packages: 0, stores: setupStores(rng, g.blackFriday),
    exitFired: false, mall: null as unknown as Level['mall'], store: null, powers: noPowers(), paT: 0, paLast: -1,
    popups: [], bubbles: [], rng, arrivalPost: rng.pick(SPYGRAM_ARRIVAL), selfieT: 0,
  };
  lvl.mall = newMall(g, rng);
  updateCamera(lvl.mall, true);
  g.level = lvl;
  g.scene = 'mall';
  g.sceneT = 0;
  g.overlay = null;
  g.banner = null;
  g.pa = null;
  g.clear = null;
}

// ---------------------------------------------------------------- the frame

export function step(g: GameState, input: PadFrame): void {
  g.frame++;
  if (g.shake > 0) g.shake--;

  if (g.fade) {
    const f = g.fade;
    f.t++;
    if (f.t === Math.floor(f.total / 2)) runFadeAction(g, f.action, f.arg);
    if (f.t >= f.total) g.fade = null;
    return;
  }

  if (g.overlay) {
    g.overlayT++;
    if (g.overlay === 'map' && (input.pressed.has('select') || input.pressed.has('start'))) closeOverlay(g);
    else if (g.overlay === 'pause' && input.pressed.has('start')) closeOverlay(g);
    return;
  }

  g.sceneT++;
  if (g.banner && --g.banner.t <= 0) g.banner = null;

  switch (g.scene) {
    case 'splash': {
      const ev = stepSplash(g.splash, input.pressed.size > 0);
      if (ev === 'jingle') g.events.push({ t: 'splashJingle' });
      if (g.splash.done) {
        g.scene = 'title';
        g.sceneT = 0;
      }
      return;
    }
    case 'title':
      stepTitle(g, input);
      return;
    case 'mall':
    case 'store':
      stepPlay(g, input);
      return;
    case 'levelclear':
      stepLevelClear(g, input);
      return;
    case 'continue':
      stepContinue(g, input);
      return;
    case 'gameover':
      stepGameOver(g, input);
      return;
  }
}

function closeOverlay(g: GameState): void {
  g.overlay = null;
  sfx(g, 'pause');
}

function runFadeAction(g: GameState, action: string, arg?: string): void {
  const lvl = g.level;
  switch (action) {
    case 'enterStore':
      if (!lvl) return;
      lvl.store = enterStore(g, lvl, arg as StoreId);
      lvl.mall.bullets = [];
      g.scene = 'store';
      return;
    case 'exitStore': {
      if (!lvl) return;
      lvl.store = null;
      const d = storeDoorOf(arg!);
      const p = lvl.mall.player;
      p.mode = 'ground';
      p.x = d.x;
      p.y = surf(d.floor);
      p.duck = false;
      p.slide = 0;
      p.vx = 0;
      p.vy = 0;
      p.invuln = Math.max(p.invuln, 30);
      lvl.mall.bullets = [];
      // Spies right at the door would be unfair: move the fresh ones back.
      lvl.mall.spies = lvl.mall.spies.filter((s) => Math.abs(s.x - p.x) > 40 || Math.abs(s.y - p.y) > 4);
      updateCamera(lvl.mall, true);
      g.scene = 'mall';
      return;
    }
    case 'toTitle':
      g.scene = 'title';
      g.sceneT = 0;
      g.level = null;
      g.over = null;
      g.cont = null;
      g.title.bf = false;
      g.title.konami = [];
      return;
    case 'startLevel':
      startLevel(g);
      return;
  }
}

// ---------------------------------------------------------------- title

function stepTitle(g: GameState, input: PadFrame): void {
  if (g.title.bfT > 0) g.title.bfT--;
  for (const b of BUTTONS) {
    if (!input.pressed.has(b) || b === 'start' || b === 'select') continue;
    if (konamiPush(g, b)) {
      g.title.bf = true;
      g.title.bfT = 180;
      sfx(g, 'powerup');
    }
  }
  if (input.pressed.has('start')) {
    sfx(g, 'confirm');
    g.fade = { t: 0, total: 40, action: 'startLevel', done: false };
    startNewGameFlags(g);
  }
}

/** Game-wide values are reset right away; the level itself starts behind the fade. */
function startNewGameFlags(g: GameState): void {
  g.score = 0;
  g.lives = START_LIVES;
  g.continues = START_CONTINUES;
  g.loop = 1;
  g.blackFriday = g.title.bf;
  g.extraLifeGiven = false;
  g.inventory = [];
  g.photoTaken = false;
  g.easterDone = false;
  g.visited = [];
}

/** Konami detection over the recent presses; extra leading presses (e.g. more Ups) still match. */
export function konamiPush(g: GameState, b: Button): boolean {
  const buf = g.title.konami;
  buf.push(b);
  if (buf.length > KONAMI.length) buf.shift();
  if (buf.length === KONAMI.length && buf.every((x, i) => x === KONAMI[i])) {
    g.title.konami = [];
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- playing

function stepPlay(g: GameState, input: PadFrame): void {
  const lvl = g.level!;
  const p = lvl.mall.player;
  const arriving = p.mode === 'zip' || p.mode === 'drop' || p.mode === 'land' || p.mode === 'selfie';
  const dying = g.scene === 'mall' ? p.mode === 'dead' : (lvl.store?.dead ?? 0) > 0;

  if (!arriving && !dying) {
    if (input.pressed.has('select')) {
      g.overlay = 'map';
      g.overlayT = 0;
      sfx(g, 'pause');
      return;
    }
    if (input.pressed.has('start')) {
      g.overlay = 'pause';
      g.overlayT = 0;
      sfx(g, 'pause');
      return;
    }
  }

  if (!arriving) {
    lvl.frames++;
    tickPowers(lvl.powers);
    if (!lvl.alarm && lvl.frames >= lvl.alarmAt) {
      lvl.alarm = true;
      banner(g, BANNERS.alarm, 180, C.RED, true);
      sfx(g, 'buzzer');
    }
    // Mall PA: a chime and a banner about once a minute, never the same line twice in a row.
    lvl.paT++;
    if (lvl.paT >= (lvl.paLast < 0 ? PA_FIRST : PA_INTERVAL)) {
      lvl.paT = 0;
      const idx = pickIndexNot(lvl.rng, PA_LINES.length, lvl.paLast);
      lvl.paLast = idx;
      g.pa = { lines: wrap(PA_LINES[idx], PA_WRAP), t: 300, total: 300, color: C.YELLOW };
      sfx(g, 'chime');
    }
  }
  if (g.pa && --g.pa.t <= 0) g.pa = null;

  if (g.scene === 'mall') {
    stepMall(g, lvl, input);
    if (lvl.mall.player.mode === 'dead' && lvl.mall.player.deadT >= DEATH_FRAMES) loseLife(g);
  } else if (lvl.store) {
    stepStore(g, lvl, input);
    if (lvl.store && lvl.store.dead >= DEATH_FRAMES) loseLife(g);
  }

  tickPopups(lvl.popups);
  for (let i = lvl.bubbles.length - 1; i >= 0; i--) {
    const b = lvl.bubbles[i];
    if (b.follow !== undefined) {
      const m = lvl.mall;
      const e = m.spies.find((s) => s.id === b.follow) ?? m.walkers.find((w) => w.id === b.follow);
      if (e) {
        b.x = e.x;
        b.y = ('y' in e ? e.y : surf(e.floor)) - 28;
      } else if (m.cop.id === b.follow) {
        b.x = m.cop.x;
        b.y = surf(m.cop.floor) - 30;
      }
    }
    if (--b.t <= 0) lvl.bubbles.splice(i, 1);
  }
  if (lvl.store) {
    for (const b of lvl.store.bubbles) {
      if (b.follow === undefined) continue;
      const gd = lvl.store.guards.find((x) => x.id === b.follow);
      if (gd) {
        b.x = gd.x;
        b.y = gd.y - 12;
      }
    }
  }

  if (lvl.exitFired && g.scene === 'mall' && !g.clear) beginLevelClear(g);
}

function pickIndexNot(rng: Rng, n: number, avoid: number): number {
  const options: number[] = [];
  for (let i = 0; i < n; i++) if (i !== avoid) options.push(i);
  return rng.pick(options);
}

/** A life is lost: respawn, or continue screen, or game over. */
export function loseLife(g: GameState): void {
  const lvl = g.level!;
  g.lives--;
  lvl.powers = powersAfterDeath(lvl.powers);
  if (g.lives > 0) {
    respawn(g);
    return;
  }
  if (g.continues > 0) {
    g.scene = 'continue';
    g.cont = { t: 0 };
    g.sceneT = 0;
  } else gameOver(g);
}

function respawn(g: GameState): void {
  const lvl = g.level!;
  if (lvl.store) {
    respawnInStore(g, lvl);
    g.scene = 'store';
  } else {
    respawnInMall(lvl);
    g.scene = 'mall';
  }
}

function gameOver(g: GameState): void {
  g.scene = 'gameover';
  g.over = { t: 0 };
  g.sceneT = 0;
  g.overlay = null;
  sfx(g, 'chime');
}

// ---------------------------------------------------------------- continue & game over

function stepContinue(g: GameState, input: PadFrame): void {
  const c = g.cont!;
  if (c.t % 60 === 0) sfx(g, 'beep');
  c.t++;
  if (input.pressed.has('start') && c.t > 10) {
    g.continues--;
    g.lives = START_LIVES;
    g.level!.powers = noPowers();
    g.cont = null;
    sfx(g, 'confirm');
    respawn(g);
    return;
  }
  if (c.t >= (CONTINUE_SECONDS + 1) * 60) {
    g.cont = null;
    gameOver(g);
  }
}

/** The number shown on the continue screen. */
export function continueNumber(g: GameState): number {
  return Math.max(0, CONTINUE_SECONDS - Math.floor((g.cont?.t ?? 0) / 60));
}

export const GAMEOVER_TEXT_START = 40;
export const GAMEOVER_TYPE = 4;
export const GAMEOVER_SHOW = 330;
export const GAMEOVER_END = 780;

function stepGameOver(g: GameState, input: PadFrame): void {
  const o = g.over!;
  o.t++;
  const text = BANNERS.mallClosed.join('');
  const typed = Math.floor((o.t - GAMEOVER_TEXT_START) / GAMEOVER_TYPE);
  if (o.t >= GAMEOVER_TEXT_START && (o.t - GAMEOVER_TEXT_START) % GAMEOVER_TYPE === 0 && typed < text.length && text[typed] !== ' ') {
    sfx(g, 'blip');
  }
  if (o.t === GAMEOVER_SHOW) g.events.push({ t: 'jingle', id: 'jingle_gameover' });
  if ((o.t > GAMEOVER_SHOW && input.pressed.has('start')) || o.t >= GAMEOVER_END) {
    g.fade = { t: 0, total: 40, action: 'toTitle', done: false };
  }
}

// ---------------------------------------------------------------- level clear

export const CLEAR_PHASES = { drive: 270, tally: 260, news: 300, post: 300 } as const;

function beginLevelClear(g: GameState): void {
  const lvl = g.level!;
  const rng = lvl.rng;
  g.clear = {
    phase: 'drive', t: 0, timeBonus: timeBonus(lvl.frames), shown: 0, headline: rng.pick(HEADLINES),
    post: rng.pick(SPYGRAM_COMPLETE), packages: lvl.packages,
  };
  g.scene = 'levelclear';
  g.sceneT = 0;
  g.overlay = null;
  g.banner = null;
  g.pa = null;
}

function stepLevelClear(g: GameState, input: PadFrame): void {
  const c = g.clear!;
  c.t++;
  const skip = input.pressed.has('start');
  if (c.phase === 'drive') {
    if (c.t >= CLEAR_PHASES.drive || skip) nextClearPhase(g, 'tally');
  } else if (c.phase === 'tally') {
    if (c.t % 4 === 0 && c.shown < 4) {
      c.shown++;
      sfx(g, 'coin');
    }
    if (c.t >= CLEAR_PHASES.tally || skip) nextClearPhase(g, 'news');
  } else if (c.phase === 'news') {
    if (c.t >= CLEAR_PHASES.news || skip) nextClearPhase(g, 'post');
  } else if (c.phase === 'post') {
    if (c.t >= CLEAR_PHASES.post || skip) {
      g.loop++;
      g.clear = null;
      g.fade = { t: 0, total: 40, action: 'startLevel', done: false };
      g.scene = 'levelclear';
    }
  }
}

function nextClearPhase(g: GameState, phase: 'tally' | 'news' | 'post'): void {
  const c = g.clear!;
  if (phase === 'tally') {
    addScore(g, c.timeBonus + POINTS.levelClear);
    sfx(g, 'confirm');
  }
  if (phase === 'news' || phase === 'post') sfx(g, 'flash');
  c.phase = phase;
  c.t = 0;
}

// ---------------------------------------------------------------- audio selection

/** Which song should be playing now (null = silence / a jingle is playing). */
export function musicFor(g: GameState): SongId | null {
  switch (g.scene) {
    case 'splash':
      return null;
    case 'title':
      return 'title';
    case 'mall': {
      const lvl = g.level!;
      if (lvl.mall.player.mode === 'elevator') return 'muzak';
      if (lvl.mall.player.mode === 'dead') return null;
      return lvl.alarm ? 'alarm' : 'mall';
    }
    case 'store': {
      const s = g.level!.store;
      if (!s || s.dead) return null;
      if (s.boothOn) return 'bonus';
      return ('store_' + s.id) as SongId;
    }
    case 'levelclear':
      return g.clear && (g.clear.phase === 'news' || g.clear.phase === 'post') ? 'title' : null;
    default:
      return null;
  }
}

/** The low elevator hum plays while the agent rides a moving car. */
export function humOn(g: GameState): boolean {
  if (g.scene !== 'mall' || g.overlay || g.fade) return false;
  const p = g.level!.mall.player;
  return p.mode === 'elevator' && g.level!.mall.cars[p.car].moving;
}

export { startNewGame as newGame };
