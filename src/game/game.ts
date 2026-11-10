/** Top-level game flow: splash -> title -> play -> clear -> next loop, continue, game over. */
import { Btn, type PadFrame } from '../core/input';
import { stepSplash } from '../flickersoft/splash';
import type { Game, Level } from './types';
import { CABLE, FLOOR_Y, F_R, POST_X, STORES, doorX } from './level';
import { ARRIVAL_POSTS, CLEAR_POSTS, HEADLINES } from './copy';
import { GRAV, respawnPlayer, stepMall, stepTimers, updateCamera } from './mall';
import { createRoom, respawnInRoom, stepStore } from './store';
import { addScore, newPowers, tickPowers } from './powers';
import { newLevel, startGame, START_LIVES } from './setup';

export const KONAMI = [Btn.Up, Btn.Up, Btn.Down, Btn.Down, Btn.Left, Btn.Right, Btn.Left, Btn.Right, Btn.B, Btn.A];
export const SLIDE_FRAMES = 110;
export const SELFIE_FRAMES = 150; // ~2.5 s
export const TRANS_FRAMES = 20;
export const CLEAR_PHASES = [420, 330, 330];
export const CONTINUE_SECS = 9;
export const CLEAR_BONUS = 1000;

/** Feed pressed buttons to the Konami detector; true once the full code was entered. */
export function konamiFeed(buf: number[], pressed: number): boolean {
  for (const b of [Btn.Up, Btn.Down, Btn.Left, Btn.Right, Btn.B, Btn.A, Btn.Select]) {
    if (pressed & b) {
      buf.push(b);
      if (buf.length > KONAMI.length) buf.shift();
    }
  }
  // comparing the LAST ten presses means extra leading Ups do not break detection
  return buf.length === KONAMI.length && buf.every((b, i) => b === KONAMI[i]);
}

export function cableY(x: number): number {
  const k = (x - CABLE.x0) / (CABLE.x1 - CABLE.x0);
  return CABLE.y0 + (CABLE.y1 - CABLE.y0) * k;
}

function stepArrive(g: Game, L: Level): void {
  const P = L.player;
  const t = ++L.arriveT;
  const endX = POST_X - 12;
  if (t === 1) g.sfx.push('zip');
  if (t <= SLIDE_FRAMES) {
    // hanging from the cable by both hands, sliding down
    const k = t / SLIDE_FRAMES;
    P.x = CABLE.x0 + (endX - CABLE.x0) * k * k * (3 - 2 * k) * 0.5 + (endX - CABLE.x0) * k * 0.5;
    P.y = cableY(P.x) + 26;
    P.onGround = false;
    P.vy = 0;
  } else if (!P.onGround) {
    P.vy += GRAV;
    P.y += P.vy;
    if (P.y >= FLOOR_Y[F_R]) {
      P.y = FLOOR_Y[F_R];
      P.onGround = true;
      P.vy = 0;
      P.landT = 26; // lands in a crouch
      P.safeX = P.x;
      P.safeY = P.y;
      g.sfx.push('thud');
    }
  } else if (--P.landT <= 0) {
    P.landT = 0;
    L.mode = 'selfie';
    L.selfie = { t: 0, post: g.rng.int(ARRIVAL_POSTS.length) };
    g.sfx.push('flash');
  }
  updateCamera(L, true);
}

function stepSelfie(g: Game, L: Level, pad: PadFrame): void {
  const s = L.selfie!;
  s.t++;
  if (s.t >= SELFIE_FRAMES || (s.t > 20 && pad.pressed)) {
    L.selfie = null;
    L.mode = 'mall';
  }
}

function stepTrans(g: Game, L: Level): void {
  const tr = L.trans!;
  tr.t++;
  if (tr.t === TRANS_FRAMES / 2) {
    L.bubbles = [];
    L.popups = [];
    L.fx = [];
    L.bullets = [];
    if (tr.kind === 'in') {
      L.room = createRoom(g, L, tr.store);
      L.mode = 'store';
      L.banner = null;
    } else {
      L.room = null;
      L.mode = 'mall';
      const P = L.player;
      P.x = doorX(STORES[tr.store]);
      P.invuln = Math.max(P.invuln, 60);
      P.ducking = false;
      updateCamera(L, true);
    }
  }
  if (tr.t >= TRANS_FRAMES) L.trans = null;
}

export function stepLevel(g: Game, L: Level, pad: PadFrame): void {
  if (L.trans) {
    stepTrans(g, L);
    return;
  }
  switch (L.mode) {
    case 'arrive':
      stepArrive(g, L);
      break;
    case 'selfie':
      stepSelfie(g, L, pad);
      break;
    case 'mall':
      L.t++;
      tickPowers(L.powers);
      stepMall(g, L, pad);
      break;
    case 'store':
      L.t++;
      tickPowers(L.powers);
      stepStore(g, L, pad);
      if (g.screen === 'play') stepTimers(g, L);
      break;
  }
}

function toTitle(g: Game): void {
  g.screen = 'title';
  g.t = 0;
  g.level = null;
  g.clear = null;
  g.konami = [];
  g.bfArmed = false;
  g.overlay = 'none';
}

/** Use a continue: 3 fresh lives where you fell; score, packages and loop kept; power-ups reset. */
export function useContinue(g: Game): void {
  const L = g.level!;
  g.continues--;
  g.lives = START_LIVES;
  L.powers = newPowers();
  g.screen = 'play';
  g.t = 0;
  if (L.mode === 'store' && L.room) respawnInRoom(L.room);
  else respawnPlayer(L);
}

/** One 60 Hz step of the whole game. Mutates g; sounds for this step end up in g.sfx. */
export function stepGame(g: Game, pad: PadFrame): void {
  g.sfx.length = 0;
  g.frame++;
  switch (g.screen) {
    case 'splash': {
      for (const ev of stepSplash(g.splash, pad.pressed !== 0)) {
        if (ev === 'jingle') g.sfx.push('j_splash');
        if (ev === 'done') { g.screen = 'title'; g.t = 0; }
      }
      break;
    }
    case 'title': {
      g.t++;
      if (!g.bfArmed && konamiFeed(g.konami, pad.pressed)) {
        g.bfArmed = true;
        g.sfx.push('fanfare');
      }
      if (pad.pressed & Btn.Start) {
        startGame(g, g.bfArmed);
        g.sfx.push('start');
      }
      break;
    }
    case 'play': {
      const L = g.level!;
      if (g.overlay !== 'none') {
        // all timers stop while the map or pause screen is open
        const close = g.overlay === 'map' ? pad.pressed & (Btn.Select | Btn.Start) : pad.pressed & Btn.Start;
        if (close) { g.overlay = 'none'; g.sfx.push('pause'); }
        break;
      }
      if ((L.mode === 'mall' || L.mode === 'store') && !L.trans) {
        if (pad.pressed & Btn.Select) { g.overlay = 'map'; g.sfx.push('pause'); break; }
        if (pad.pressed & Btn.Start) { g.overlay = 'pause'; g.sfx.push('pause'); break; }
      }
      g.t++;
      stepLevel(g, L, pad);
      break;
    }
    case 'clear': {
      const L = g.level!;
      if (!g.clear) {
        const secs = Math.floor(L.t / 60);
        const timeBonus = Math.max(0, 300 - secs) * 10;
        addScore(g, timeBonus + CLEAR_BONUS);
        g.clear = { phase: 0, t: 0, headline: g.rng.int(HEADLINES.length), post: g.rng.int(CLEAR_POSTS.length), timeBonus, secs };
        g.sfx.push('j_clear');
      }
      const c = g.clear;
      c.t++;
      if (c.t >= CLEAR_PHASES[c.phase] || (c.t > 30 && pad.pressed & Btn.Start)) {
        c.phase++;
        c.t = 0;
        if (c.phase < CLEAR_PHASES.length) g.sfx.push('blip');
        else {
          // the next loop starts, harder
          g.loop++;
          g.clear = null;
          g.level = newLevel(g);
          g.screen = 'play';
          g.t = 0;
        }
      }
      break;
    }
    case 'continue': {
      if (g.t % 60 === 0 && g.t < (CONTINUE_SECS + 1) * 60) g.sfx.push('beep');
      g.t++;
      if (pad.pressed & Btn.Start) useContinue(g);
      else if (g.t >= (CONTINUE_SECS + 1) * 60) { g.screen = 'gameover'; g.t = 0; g.sfx.push('pa'); }
      break;
    }
    case 'gameover': {
      g.t++;
      if (g.t === 300) g.sfx.push('j_over');
      if (g.t % 4 === 0 && g.t > 40 && g.t < 200) g.sfx.push('blip');
      if ((g.t > 320 && pad.pressed & Btn.Start) || g.t > 900) toTitle(g);
      break;
    }
  }
}

/** Number shown on the continue screen (9..0). */
export function continueCount(g: Game): number {
  return Math.max(0, CONTINUE_SECS - Math.floor(g.t / 60));
}

/** Which music track should be playing for this state. */
export function musicFor(g: Game): string {
  switch (g.screen) {
    case 'splash': return 'none';
    case 'title': return 'title';
    case 'clear': return g.clear && g.clear.phase === 0 && g.clear.t < 200 ? 'none' : 'title';
    case 'continue': return 'none';
    case 'gameover': return 'none';
    case 'play': {
      const L = g.level!;
      if (L.mode === 'store' && L.room) return L.room.sideB ? 'booth' : 'store_' + STORES[L.room.store].key;
      if (L.mode === 'mall' && L.player.ride && L.player.ride.part === 'in') return 'elevator';
      return L.alarm ? 'alarm' : 'mall';
    }
  }
}

/** True while the player is inside a moving car (drives the hum). */
export function humOn(g: Game): boolean {
  if (g.screen !== 'play' || g.overlay !== 'none' || !g.level || g.level.mode !== 'mall') return false;
  const r = g.level.player.ride;
  return !!r && r.part === 'in' && g.level.cars[r.shaft].dir !== 0;
}
export { newLevel };
