import {
  CONTINUES_PER_GAME,
  CONTINUE_LIVES,
  CONTINUE_SECONDS,
  DEATH_FREEZE,
  EXTRA_LIFE_SCORE,
  FADE_FRAMES,
  FLOOR_P,
  PACKAGES_TOTAL,
  SCORE_LEVEL_CLEAR,
  SELFIE_FRAMES,
  SPLASH_TOTAL_FRAMES,
  START_LIVES,
  TIME_BONUS_LIMIT,
  TIME_BONUS_PER_SEC,
  TOAST_FRAMES,
  sec,
  floorY,
} from './constants';
import { HEADLINES, SPYGRAM_COMPLETE } from './copy';
import { EventBus } from './events';
import { Button, type Pad } from './input';
import { KonamiDetector } from './konami';
import { newLevel } from './level';
import {
  newMallState,
  respawnPlayer,
  setBeginLevelClear,
  setBeginStore,
  setStartFade,
  stepMall,
} from './mall';
import { GETAWAY_CAR_X } from './mallLayout';
import {
  newPowerUpState,
  resetPowerUpsOnContinue,
  resetPowerUpsOnDeath,
  tickPowerUps,
} from './powerups';
import { Rng } from './rng';
import { STORE_BY_ID } from './storeDefs';
import { newStoreState, setExitStore, setPlayerDiedInStore, stepStore } from './store';
import type { GameState } from './types';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface NewGameOptions {
  seed: number;
  highScore?: number;
  blackFriday?: boolean;
  skipSplash?: boolean;
  debug?: boolean;
}

export function newGame(opts: NewGameOptions): GameState {
  const rng = new Rng(opts.seed);
  const blackFriday = opts.blackFriday ?? false;
  const level = newLevel(rng, 1, blackFriday);

  const g: GameState = {
    rng,
    seed: opts.seed,
    bus: new EventBus(),
    screen: opts.skipSplash ? 'title' : 'splash',
    screenFrames: 0,
    overlay: 'none',
    score: 0,
    highScore: opts.highScore ?? 0,
    lives: START_LIVES,
    continues: CONTINUES_PER_GAME,
    extraLivesAwarded: 0,
    blackFriday,
    konamiArmed: false,
    powerups: newPowerUpState(),
    level,
    mall: newMallState(rng),
    store: null,
    returnDoorX: 0,
    returnFloor: 0,
    inventory: [],
    hasPhotoStrip: false,
    visitedStores: {},
    zeldaEggUsed: false,
    spygram: null,
    headline: null,
    clearTally: null,
    continueCountdown: CONTINUE_SECONDS,
    continueFrames: 0,
    fade: 0,
    fadeDir: 0,
    fadeThen: null,
    toast: null,
    splashDone: opts.skipSplash ?? false,
    debug: opts.debug ?? false,
  };

  return g;
}

const konami = new KonamiDetector();

// ---------------------------------------------------------------------------
// Fades (also used by mall.ts via the setter indirection)
// ---------------------------------------------------------------------------

export function startFade(g: GameState, then: () => void): void {
  g.fadeDir = 1;
  g.fadeThen = then;
}

function stepFade(g: GameState): boolean {
  if (g.fadeDir === 1) {
    g.fade++;
    if (g.fade >= FADE_FRAMES) {
      g.fade = FADE_FRAMES;
      g.fadeDir = -1;
      const then = g.fadeThen;
      g.fadeThen = null;
      then?.();
    }
    return true;
  }
  if (g.fadeDir === -1) {
    g.fade--;
    if (g.fade <= 0) {
      g.fade = 0;
      g.fadeDir = 0;
    }
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Wiring: the rules modules call back into here without importing it.
// ---------------------------------------------------------------------------

setStartFade(startFade);
setBeginStore((g, storeId) => {
  const def = STORE_BY_ID.get(storeId)!;
  g.store = newStoreState(g, def);
  g.screen = 'store';
  g.screenFrames = 0;
  g.bus.music(def.music ?? 'mallAmbient');
});
setBeginLevelClear((g) => {
  beginLevelClear(g);
});
setExitStore((g) => {
  startFade(g, () => {
    g.store = null;
    g.screen = 'mall';
    g.screenFrames = 0;
    const p = g.mall.player;
    p.x = g.returnDoorX;
    p.floor = g.returnFloor;
    p.y = floorY(g.returnFloor);
    p.onGround = true;
    p.vy = 0;
    p.fallStartY = p.y;
    p.mode = 'play';
    p.lastSafe = { x: p.x, y: p.y, floor: p.floor };
    g.bus.music(g.level.alarm ? 'alarm' : 'mallAmbient');
  });
});
setPlayerDiedInStore((g) => {
  g.bus.sfx('hurt');
  startFade(g, () => {
    g.store = null;
    g.screen = 'mall';
    g.mall.player.mode = 'dead';
    g.mall.player.modeFrames = 0;
  });
});

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export function stepGame(g: GameState, pad: Pad): void {
  g.screenFrames++;
  if (g.toast) {
    g.toast.frames--;
    if (g.toast.frames <= 0) g.toast = null;
  }

  const fading = stepFade(g);
  if (fading) return;

  switch (g.screen) {
    case 'splash':
      stepSplash(g, pad);
      return;
    case 'title':
      stepTitle(g, pad);
      return;
    case 'mall':
    case 'store':
      stepPlay(g, pad);
      return;
    case 'levelClear':
      stepLevelClear(g, pad);
      return;
    case 'news':
      stepNews(g, pad);
      return;
    case 'spygram':
      stepSpygramScreen(g, pad);
      return;
    case 'continue':
      stepContinue(g, pad);
      return;
    case 'gameOver':
      stepGameOver(g, pad);
      return;
  }
}

// ---------------------------------------------------------------------------
// Splash / title
// ---------------------------------------------------------------------------

function stepSplash(g: GameState, pad: Pad): void {
  if (g.screenFrames === 1) g.bus.music('splash');
  if (g.screenFrames >= SPLASH_TOTAL_FRAMES || pad.anyPressed()) {
    gotoTitle(g);
  }
}

export function gotoTitle(g: GameState): void {
  g.screen = 'title';
  g.screenFrames = 0;
  g.splashDone = true;
  konami.reset();
  g.konamiArmed = false;
  g.bus.music('title');
}

function stepTitle(g: GameState, pad: Pad): void {
  for (const b of [Button.Up, Button.Down, Button.Left, Button.Right, Button.A, Button.B]) {
    if (pad.pressed(b) && konami.push(b)) {
      g.konamiArmed = true;
      g.bus.sfx('itemGet');
      g.bus.flash(8);
    }
  }
  if (pad.pressed(Button.Start)) {
    g.bus.sfx('select');
    startNewRun(g);
  }
}

/** Start a fresh run from the title (keeps the session high score). */
export function startNewRun(g: GameState): void {
  const bf = g.konamiArmed;
  const fresh = newGame({ seed: g.seed, highScore: g.highScore, blackFriday: bf, skipSplash: true });
  Object.assign(g, fresh, { bus: g.bus, screen: 'mall', screenFrames: 0, splashDone: true });
  g.blackFriday = bf;
  g.bus.music('mallAmbient');
}

// ---------------------------------------------------------------------------
// Play (mall + store), pause and map overlays
// ---------------------------------------------------------------------------

function stepPlay(g: GameState, pad: Pad): void {
  // --- overlays: ALL timers stop while the map or pause screen is open ----
  if (g.overlay !== 'none') {
    const close =
      (g.overlay === 'map' && pad.pressed(Button.Select)) ||
      (g.overlay === 'pause' && pad.pressed(Button.Start)) ||
      pad.pressed(Button.B);
    if (close) {
      g.overlay = 'none';
      g.bus.sfx('pause');
      g.bus.music(currentMusic(g));
    }
    return;
  }
  if (pad.pressed(Button.Select)) {
    g.overlay = 'map';
    g.bus.sfx('select');
    return;
  }
  if (pad.pressed(Button.Start)) {
    g.overlay = 'pause';
    g.bus.sfx('pause');
    return;
  }

  // --- the arrival SPYGRAM card is shown over the mall -------------------
  if (g.spygram && g.spygram.kind === 'arrival') {
    g.spygram.frames++;
    g.spygram.likes += g.spygram.frames < sec(1.5) ? 7 : 1;
    if (g.spygram.frames % 10 === 0) g.bus.sfx('like');
    if (g.spygram.frames >= SELFIE_FRAMES || pad.anyPressed()) {
      g.spygram = null;
      g.mall.player.mode = 'play';
      g.mall.player.modeFrames = 0;
      g.bus.music('mallAmbient');
    }
    return;
  }

  tickPowerUps(g.powerups);
  checkExtraLife(g);

  if (g.screen === 'store') {
    stepStore(g, pad);
    return;
  }

  stepMall(g, pad);

  // --- death -------------------------------------------------------------
  const p = g.mall.player;
  if (p.mode === 'dead' && p.modeFrames >= DEATH_FREEZE) {
    loseLife(g);
  }
}

export function currentMusic(g: GameState): string {
  if (g.screen === 'store' && g.store) {
    const def = STORE_BY_ID.get(g.store.storeId);
    return g.store.onBooth ? 'bonus' : (def?.music ?? 'mallAmbient');
  }
  if (g.mall.player.ridingShaft) return 'elevator';
  return g.level.alarm ? 'alarm' : 'mallAmbient';
}

function checkExtraLife(g: GameState): void {
  const due = Math.floor(g.score / EXTRA_LIFE_SCORE);
  if (due > g.extraLivesAwarded) {
    g.lives += due - g.extraLivesAwarded;
    g.extraLivesAwarded = due;
    g.bus.sfx('itemGet');
    g.mall.banners = [{ lines: ['EXTRA LIFE!'], frames: sec(2), kind: 'info' }];
  }
}

function loseLife(g: GameState): void {
  g.lives--;
  resetPowerUpsOnDeath(g.powerups);
  if (g.lives > 0) {
    respawnPlayer(g);
    return;
  }
  if (g.continues > 0) {
    g.screen = 'continue';
    g.screenFrames = 0;
    g.continueCountdown = CONTINUE_SECONDS;
    g.continueFrames = 0;
    g.bus.music('none');
    return;
  }
  gotoGameOver(g);
}

// ---------------------------------------------------------------------------
// Level clear -> news -> spygram -> next loop
// ---------------------------------------------------------------------------

export function beginLevelClear(g: GameState): void {
  const timeBonus = Math.max(
    0,
    Math.floor((TIME_BONUS_LIMIT - g.level.frames) / 60) * TIME_BONUS_PER_SEC,
  );
  g.screen = 'levelClear';
  g.screenFrames = 0;
  g.overlay = 'none';
  g.clearTally = {
    packages: g.level.packages,
    timeBonus,
    clearBonus: SCORE_LEVEL_CLEAR,
    loop: g.level.loop,
    step: 0,
    frames: 0,
  };
  g.bus.music('clear');
}

function stepLevelClear(g: GameState, pad: Pad): void {
  const t = g.clearTally!;
  t.frames++;
  const skip = pad.pressed(Button.Start);

  // The station wagon drives off while a spy chases it waving a receipt, then
  // the bonus tally counts up step by step.
  if (t.frames < sec(2.5) && !skip) return;

  if (skip) {
    if (t.step < 3) {
      g.score += t.packages * 0 + t.timeBonus + t.clearBonus;
      t.step = 3;
      t.frames = sec(2.5);
      return;
    }
    gotoNews(g);
    return;
  }

  if (t.step < 3 && (t.frames - sec(2.5)) % sec(0.7) === 0) {
    if (t.step === 1) g.score += t.timeBonus;
    if (t.step === 2) g.score += t.clearBonus;
    t.step++;
    g.bus.sfx('blip');
  }
  if (t.step >= 3 && t.frames > sec(2.5) + sec(3.2)) gotoNews(g);
}

function gotoNews(g: GameState): void {
  g.screen = 'news';
  g.screenFrames = 0;
  g.headline = g.rng.pick(HEADLINES);
  g.bus.sfx('paChime');
}

function stepNews(g: GameState, pad: Pad): void {
  if (g.screenFrames > sec(4) || pad.pressed(Button.Start)) {
    const post = g.rng.pick(SPYGRAM_COMPLETE);
    g.spygram = { caption: post.caption, comment: post.comment, likes: 0, frames: 0, kind: 'complete' };
    g.screen = 'spygram';
    g.screenFrames = 0;
    g.bus.sfx('camera');
  }
}

function stepSpygramScreen(g: GameState, pad: Pad): void {
  const s = g.spygram!;
  s.frames++;
  s.likes += s.frames < sec(1.8) ? 9 : 1;
  if (s.frames % 10 === 0) g.bus.sfx('like');
  if (s.frames > sec(4) || pad.pressed(Button.Start)) {
    g.spygram = null;
    nextLoop(g);
  }
}

function nextLoop(g: GameState): void {
  const loop = g.level.loop + 1;
  g.level = newLevel(g.rng, loop, g.blackFriday);
  g.mall = newMallState(g.rng);
  g.store = null;
  g.powerups.radar = false;
  g.screen = 'mall';
  g.screenFrames = 0;
  g.mall.banners = [{ lines: [`LOOP ${loop}`], frames: sec(2), kind: 'info' }];
  g.bus.music('mallAmbient');
}

// ---------------------------------------------------------------------------
// Continue / game over
// ---------------------------------------------------------------------------

function stepContinue(g: GameState, pad: Pad): void {
  g.continueFrames++;
  if (g.continueFrames % 60 === 1) {
    g.bus.sfx('blip');
  }
  if (g.continueFrames >= 60) {
    g.continueFrames = 0;
    g.continueCountdown--;
    if (g.continueCountdown < 0) {
      gotoGameOver(g);
      return;
    }
  }
  if (pad.pressed(Button.Start)) {
    // Fresh lives where you fell. Score, packages and loop are kept;
    // power-ups are reset.
    g.continues--;
    g.lives = CONTINUE_LIVES;
    resetPowerUpsOnContinue(g.powerups);
    g.screen = 'mall';
    g.screenFrames = 0;
    g.bus.sfx('select');
    respawnPlayer(g);
  }
}

export function gotoGameOver(g: GameState): void {
  g.screen = 'gameOver';
  g.screenFrames = 0;
  g.overlay = 'none';
  g.highScore = Math.max(g.highScore, g.score);
  g.bus.sfx('paChime');
  g.bus.music('gameover');
}

function stepGameOver(g: GameState, pad: Pad): void {
  if (g.screenFrames > sec(9) || (g.screenFrames > sec(3) && pad.pressed(Button.Start))) {
    gotoTitle(g);
  }
}

// ---------------------------------------------------------------------------
// Toasts (CRT / sound confirmations)
// ---------------------------------------------------------------------------

export function showToast(g: GameState, text: string): void {
  g.toast = { text, frames: TOAST_FRAMES };
}

// ---------------------------------------------------------------------------
// Debug helpers, exposed by main.ts under ?debug=1
// ---------------------------------------------------------------------------

/** Put the player at the getaway car with every package, for playtesting. */
export function debugReadyToExit(g: GameState): void {
  g.level.packages = PACKAGES_TOTAL;
  for (const id of Object.keys(g.level.stores)) g.level.stores[id].cleared = true;
  const p = g.mall.player;
  p.mode = 'play';
  p.floor = FLOOR_P;
  p.y = floorY(FLOOR_P);
  p.x = GETAWAY_CAR_X;
  p.onGround = true;
  p.ridingShaft = null;
  g.screen = 'mall';
  g.store = null;
}
