// GAME OVER: PA chime + typewriter message while metal shutters roll down over the storefronts and the agent,
// then GAME OVER with score and (per-session) high score.
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import type { EventSink } from '../core/events';
import type { PadFrame } from '../core/pad';
import { MISC } from '../data/copy';
import type { Surface } from '../art/surface';
import { drawMallInterior, drawNightSky, drawShutter } from '../art/backdrops';
import { drawStorefrontRow } from '../art/logo';
import { STOREFRONT_H } from '../game/geometry';
import { bigText, blinkOn, pad6 } from './util';

export type GameOverPhase = 'pa' | 'shutters' | 'gameover';

/** Timeline (frames). */
export const PA_FRAMES = 60; // chime; the first shutter starts moving at the end of this phase
export const SHUTTER_FRAMES = 180; // full roll-down, per panel (panels are staggered by SHUTTER_STAGGER)
export const SHUTTER_STAGGER = 8;
export const SHUTTER_PANELS = 4;
export const SHUTTERS_END = PA_FRAMES + SHUTTER_FRAMES; // 240: GAME OVER appears
export const GAMEOVER_FRAMES = 300; // ~5 s on the GAME OVER card
export const TYPE_START = 15;
export const TYPE_FRAMES_PER_CHAR = 3;
/** Ignore Start for this many frames after GAME OVER appears (mashing at the death screen). */
export const START_GUARD = 30;

export class GameOverState {
  done = false;
  phase: GameOverPhase = 'pa';
  frame = 0;
  /** Frames since GAME OVER appeared. */
  overFrame = 0;
  /** Per-session best: the higher of this run's score and the stored high score. */
  readonly hiScore: number;
  readonly newHigh: boolean;
  private typed = 0;

  constructor(
    readonly score: number,
    readonly highScore: number,
  ) {
    this.hiScore = Math.max(score, highScore);
    this.newHigh = score > highScore;
  }

  /** Number of PA message characters typed so far (both lines, no separator). */
  get typedChars(): number {
    return this.typed;
  }

  /** Shutter progress 0..1 of panel i. */
  shutterProgress(i: number): number {
    const t = (this.frame - PA_FRAMES - i * SHUTTER_STAGGER) / (SHUTTER_FRAMES - SHUTTER_PANELS * SHUTTER_STAGGER);
    return Math.max(0, Math.min(1, t));
  }

  private enterGameOver(sink: EventSink): void {
    this.phase = 'gameover';
    this.overFrame = 0;
    sink.push({ t: 'music', name: 'jingle:gameover' });
  }

  update(pad: PadFrame, sink: EventSink): void {
    if (this.done) return;
    if (this.frame === 0) {
      sink.push({ t: 'sfx', name: 'chime' });
      sink.push({ t: 'music', name: 'jingle:pa' });
    }
    this.frame++;
    const total = MISC.gameOverPA[0].length + MISC.gameOverPA[1].length;
    if (this.phase !== 'gameover') {
      // typewriter: one char every few frames, a blip per visible char
      const want = Math.min(total, Math.max(0, Math.floor((this.frame - TYPE_START) / TYPE_FRAMES_PER_CHAR) + 1));
      while (this.typed < want) {
        this.typed++;
        const ch = this.charAt(this.typed - 1);
        if (ch !== ' ') sink.push({ t: 'sfx', name: 'blip' });
      }
      if (this.frame >= PA_FRAMES && this.phase === 'pa') this.phase = 'shutters';
      if (this.phase === 'shutters' && this.frame === PA_FRAMES + 2) sink.push({ t: 'sfx', name: 'elevatorMove' });
      if (this.frame >= SHUTTERS_END || pad.pressed.start) this.enterGameOver(sink);
      return;
    }
    this.overFrame++;
    if (this.overFrame === 1) sink.push({ t: 'sfx', name: 'door' });
    if ((pad.pressed.start && this.overFrame > START_GUARD) || this.overFrame >= GAMEOVER_FRAMES) this.done = true;
  }

  private charAt(i: number): string {
    const a = MISC.gameOverPA[0];
    return i < a.length ? a[i] : MISC.gameOverPA[1][i - a.length];
  }
}

// ---------------------------------------------------------------- drawing

const BAND_Y = 92; // top of the storefront row
const FLOOR_LINE = BAND_Y + STOREFRONT_H;

export function drawGameOver(s: Surface, st: GameOverState): void {
  if (st.phase === 'gameover') drawOver(s, st);
  else drawScene(s, st);
}

function drawScene(s: Surface, st: GameOverState): void {
  const f = st.frame;
  s.clear(C.BLACK);
  drawNightSky(s, 0, 0, SCREEN_W, 84, f);
  // floor below the shops
  drawMallInterior(s, 0, BAND_Y - 4, SCREEN_W, 48, 'shop', 0);
  drawStorefrontRow(s, BAND_Y, 40, f, false);
  s.rect(0, FLOOR_LINE, SCREEN_W, SCREEN_H - FLOOR_LINE, C.GRAY_DD);
  s.hline(0, FLOOR_LINE, SCREEN_W, C.GRAY_D);
  for (let x = 0; x < SCREEN_W; x += 32) s.vline(x, FLOOR_LINE + 1, SCREEN_H - FLOOR_LINE, C.GRAY_D);
  // the agent, standing sadly in front of the shops
  const shake = st.frame > PA_FRAMES + 120 && (f >> 2) % 2 === 0 ? 1 : 0;
  s.sprite('agent_stand', 120 + shake, FLOOR_LINE - 22);
  // shutters, four staggered panels, drawn OVER the storefronts and the agent
  const pw = SCREEN_W / SHUTTER_PANELS;
  const sh = FLOOR_LINE + 4 - (BAND_Y - 4);
  for (let i = 0; i < SHUTTER_PANELS; i++) drawShutter(s, i * pw, BAND_Y - 4, pw, sh, st.shutterProgress(i));
  // PA message on a speaker panel
  s.rect(16, 148, 224, 46, C.BLACK);
  s.frame(16, 148, 224, 46, C.GRAY_L);
  s.frame(18, 150, 220, 42, C.GRAY_D);
  s.text('PA', 22, 152, C.YELLOW, { small: true });
  const a = MISC.gameOverPA[0];
  const b = MISC.gameOverPA[1];
  const n = st.typedChars;
  s.text(a.slice(0, n), 128 - (a.length * 8) / 2, 160, C.YELLOW_L);
  if (n > a.length) s.text(b.slice(0, n - a.length), 128 - (b.length * 8) / 2, 174, C.WHITE);
  // typewriter cursor
  if (n < a.length + b.length && blinkOn(f, 12)) {
    const onFirst = n <= a.length;
    const lineStr = onFirst ? a : b;
    const off = onFirst ? n : n - a.length;
    s.rect(128 - (lineStr.length * 8) / 2 + off * 8, (onFirst ? 160 : 174) + 6, 6, 2, C.WHITE);
  }
  // little "sound waves" from a speaker in the ceiling while the chime plays
  if (f < PA_FRAMES) for (let k = 0; k < 3; k++) if (((f >> 3) + k) % 3 === 0) s.frame(112 - k * 4, 210 - k * 3 + 6, 32 + k * 8, 6 + k * 2, C.GRAY_L);
}

function drawOver(s: Surface, st: GameOverState): void {
  // fully closed shutters as the backdrop
  s.clear(C.BLACK);
  for (let x = 0; x < SCREEN_W; x += 64) drawShutter(s, x, 0, 64, SCREEN_H, 1);
  const f = st.overFrame;
  s.rect(12, 60, 232, 120, C.BLACK);
  s.frame(12, 60, 232, 120, C.RED);
  s.frame(14, 62, 228, 116, C.RED_D);
  bigText(s, 'GAME OVER', 128, 76, 3, C.RED_L, { align: 'center', shadow: C.RED_D });
  s.text('SCORE', 48, 122, C.WHITE);
  s.text(pad6(st.score), 208, 122, C.YELLOW_L, { align: 'right' });
  s.text('HI-SCORE', 48, 138, C.WHITE);
  s.text(pad6(st.hiScore), 208, 138, C.CYAN_L, { align: 'right' });
  if (st.newHigh && blinkOn(f, 24)) s.text('NEW HIGH SCORE!', 128, 158, C.GREEN_L, { align: 'center' });
  if (f > START_GUARD && blinkOn(f, 48)) s.text('PRESS START', 128, 200, C.WHITE, { align: 'center', shadow: C.BLACK });
}
