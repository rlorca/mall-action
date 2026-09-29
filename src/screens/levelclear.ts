// Level clear sequence: drive-off cutscene -> bonus tally -> THE DAILY MALL front page -> SPYGRAM post.
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import type { EventSink } from '../core/events';
import type { PadFrame } from '../core/pad';
import type { Rng } from '../core/rng';
import { HEADLINES, MISC, SPYGRAM_COMPLETE } from '../data/copy';
import { PACKAGES_TOTAL } from '../data/stores';
import { LEVEL_CLEAR_BONUS, addScore, timeBonus, type Progress } from '../game/progress';
import type { Surface } from '../art/surface';
import { GARAGE, drawGarageBackdrop } from '../art/backdrops';
import { drawBubble } from '../render/bubble';
import { SPYGRAM_CARD_H, SPYGRAM_CARD_W, drawSpygramCard } from './spygram';
import { blinkOn, bigText, boldText, pad6 } from './util';

export type LevelClearPhase = 'drive' | 'tally' | 'news' | 'spygram';
export const PHASES: readonly LevelClearPhase[] = ['drive', 'tally', 'news', 'spygram'];
export const PHASE_FRAMES: Readonly<Record<LevelClearPhase, number>> = { drive: 240, tally: 240, news: 300, spygram: 300 };

/** Screen-only line (not in data/copy.ts because it is drawn by this screen alone); must fit a bubble. */
export const RECEIPT_SHOUT = 'SIR! YOUR RECEIPT!';

/** Frames between count-up rows and how long each count-up takes. */
const ROW_START = 24;
const ROW_STEP = 40;
const COUNT_FRAMES = 30;

export interface Tally {
  packages: number;
  timeBonus: number;
  clearBonus: number;
  loop: number;
}

export class LevelClearState {
  done = false;
  phase: LevelClearPhase = 'drive';
  /** Total frames since the sequence began. */
  frame = 0;
  /** Frames spent in the current phase. */
  phaseFrame = 0;
  tally: Tally;
  headlineIndex: number;
  spygramIndex: number;
  /** Cutscene actors (px, updated per frame). */
  wagonX = 40;
  wagonV = 0;
  spyX = -30;
  private tallyApplied = false;
  private started = false;

  constructor(
    readonly progress: Progress,
    rng: Rng,
    sink?: EventSink,
  ) {
    this.headlineIndex = rng.int(HEADLINES.length);
    this.spygramIndex = rng.int(SPYGRAM_COMPLETE.length);
    this.tally = { packages: progress.packages.length, timeBonus: timeBonus(progress.levelFrames), clearBonus: LEVEL_CLEAR_BONUS, loop: progress.loop };
    if (sink) this.start(sink);
  }

  private start(sink: EventSink): void {
    if (this.started) return;
    this.started = true;
    sink.push({ t: 'music', name: 'jingle:levelclear' });
  }

  private enter(phase: LevelClearPhase, sink: EventSink): void {
    this.phase = phase;
    this.phaseFrame = 0;
    if (phase === 'tally' && !this.tallyApplied) {
      this.tallyApplied = true;
      addScore(this.progress, this.tally.timeBonus + this.tally.clearBonus, sink);
    }
  }

  private advance(sink: EventSink): void {
    const i = PHASES.indexOf(this.phase);
    if (i >= PHASES.length - 1) {
      this.done = true;
      return;
    }
    this.enter(PHASES[i + 1], sink);
  }

  /** Score value shown for the count-up of row `k` (0 packages, 1 time, 2 clear) at the current phase frame. */
  countShown(k: number, target: number): number {
    if (this.phase !== 'tally') return this.phase === 'drive' ? 0 : target;
    const t = (this.phaseFrame - (ROW_START + k * ROW_STEP)) / COUNT_FRAMES;
    return Math.floor(target * Math.max(0, Math.min(1, t)));
  }

  update(pad: PadFrame, sink: EventSink): void {
    this.start(sink);
    if (this.done) return;
    this.frame++;
    this.phaseFrame++;
    if (this.phase === 'drive') this.stepCutscene();
    if (this.phase === 'tally') this.tickTallySfx(sink);
    if (pad.pressed.start) {
      this.advance(sink);
      return;
    }
    if (this.phaseFrame >= PHASE_FRAMES[this.phase]) this.advance(sink);
  }

  private stepCutscene(): void {
    const f = this.phaseFrame;
    if (f > 50) {
      this.wagonV = Math.min(3.2, this.wagonV + 0.035);
      this.wagonX += this.wagonV;
    }
    // the spy sprints in from the left, chases at a steady pace, and falls behind
    if (f > 20) this.spyX = Math.min(this.spyX + 2.3, 214, this.wagonX - 38);
  }

  private tickTallySfx(sink: EventSink): void {
    const f = this.phaseFrame;
    for (let k = 0; k < 3; k++) {
      const t = f - (ROW_START + k * ROW_STEP);
      if (t >= 0 && t < COUNT_FRAMES && t % 3 === 0) sink.push({ t: 'sfx', name: 'tick' });
      if (t === COUNT_FRAMES) sink.push({ t: 'sfx', name: 'coin' });
    }
  }
}

// ---------------------------------------------------------------- drawing

export function drawLevelClear(s: Surface, st: LevelClearState): void {
  switch (st.phase) {
    case 'drive':
      drawDrive(s, st);
      break;
    case 'tally':
      drawTally(s, st);
      break;
    case 'news':
      drawNews(s, st);
      break;
    case 'spygram':
      drawSpygramScreen(s, st);
      break;
  }
}

function drawReceipt(s: Surface, x: number, y: number, f: number): void {
  const flap = (f >> 2) & 1;
  const w = flap ? 9 : 11;
  s.rect(x, y, w, 15, C.BLACK);
  s.rect(x + 1, y + 1, w - 2, 13, C.WHITE);
  for (let r = 0; r < 4; r++) s.hline(x + 2, y + 3 + r * 3, w - 4 - (r === 3 ? 3 : 0), C.GRAY_M);
  // zig-zag torn bottom edge
  for (let k = 0; k < w; k += 2) s.px(x + k, y + 15 + ((k + flap) & 1), C.WHITE);
}

function drawDrive(s: Surface, st: LevelClearState): void {
  const f = st.phaseFrame;
  drawGarageBackdrop(s, st.frame);
  // headline banner on the ceiling
  if (blinkOn(f, 30) || f < 20) s.text('LEVEL CLEAR!', 128, 20, C.YELLOW_L, { align: 'center', shadow: C.RED_D });
  const roadY = GARAGE.ROAD_Y;
  const wagonY = roadY - 48;
  // exhaust puffs behind the wagon once it moves
  if (f > 50) {
    for (let k = 0; k < 4; k++) {
      const px = st.wagonX - 6 - k * 12;
      const r = 3 + k;
      s.setAlpha(0.7 - k * 0.15);
      s.rect(px, roadY - 12 - k * 2, r, r, C.GRAY_L);
      s.setAlpha(1);
    }
  }
  const lights = f > 30;
  s.spriteScaled(lights ? 'getaway_wagon_lights' : 'getaway_wagon', st.wagonX, wagonY, 2, { frame: f > 50 ? (f >> 2) & 1 : 0 });
  // the spy with the receipt
  if (f > 20) {
    const running = st.spyX < 214;
    const sy = roadY - 48;
    s.spriteScaled('spy_walk', st.spyX, sy, 2, { frame: running ? (f >> 2) % 2 : 0 });
    drawReceipt(s, st.spyX + 24, sy + 3 - ((f >> 2) & 1) * 2, f);
    if (f > 60) drawBubble(s, RECEIPT_SHOUT, Math.min(st.spyX + 16, 200), sy - 14);
  }
  s.text('START: SKIP', 250, 230, C.GRAY_L, { align: 'right', small: true });
}

function drawTally(s: Surface, st: LevelClearState): void {
  const f = st.phaseFrame;
  s.clear(C.BLACK);
  s.rect(8, 8, 240, 224, C.INDIGO_D);
  s.frame(8, 8, 240, 224, C.YELLOW);
  s.frame(10, 10, 236, 220, C.GRAY_D);
  bigText(s, 'BONUS TALLY', 128, 22, 2, C.YELLOW_L, { align: 'center', shadow: C.RED_D });
  const t = st.tally;
  const x0 = 24;
  const x1 = 232;
  const rowY = [64, 88, 112];
  // packages: label, 6 icons, n/6 (already scored, not added again)
  const shownPk = f >= ROW_START ? t.packages : 0;
  s.text('PACKAGES', x0, rowY[0], C.WHITE);
  for (let i = 0; i < PACKAGES_TOTAL; i++) s.sprite('icon_pkg', 100 + i * 10, rowY[0], { alpha: i < shownPk ? 1 : 0.25 });
  s.text(`${shownPk}/${PACKAGES_TOTAL}`, x1, rowY[0], C.GREEN_L, { align: 'right' });
  s.text('TIME BONUS', x0, rowY[1], C.WHITE);
  s.text(String(st.countShown(1, t.timeBonus)), x1, rowY[1], C.CYAN_L, { align: 'right' });
  s.text('CLEAR BONUS', x0, rowY[2], C.WHITE);
  s.text(String(st.countShown(2, t.clearBonus)), x1, rowY[2], C.CYAN_L, { align: 'right' });
  s.hline(x0, 130, x1 - x0, C.GRAY_M);
  s.text(MISC.loop(t.loop), 128, 144, C.ORANGE, { align: 'center' });
  s.text('SCORE', x0, 172, C.WHITE);
  s.text(pad6(st.progress.score), x1, 172, C.YELLOW_L, { align: 'right' });
  if (f > ROW_START + 2 * ROW_STEP + COUNT_FRAMES && blinkOn(f, 40)) s.text('NEXT LOOP IS HARDER', 128, 200, C.RED_L, { align: 'center' });
  s.text('START: SKIP', 240, 218, C.GRAY_L, { align: 'right', small: true });
}

function drawNews(s: Surface, st: LevelClearState): void {
  const PAPER = C.YELLOW_L;
  const INK = C.BLACK;
  s.clear(C.GRAY_DD);
  // paper with a soft shadow
  s.rect(16, 12, 232, 224, C.BLACK);
  s.rect(12, 8, 232, 224, PAPER);
  s.frame(12, 8, 232, 224, C.GRAY_M);
  // masthead
  s.text('*', 22, 14, INK);
  s.text('*', 226, 14, INK);
  s.text('THE', 128, 13, INK, { align: 'center' });
  bigText(s, 'DAILY MALL', 128, 22, 2, INK, { align: 'center' });
  bigText(s, 'DAILY MALL', 129, 22, 2, INK, { align: 'center' });
  s.hline(18, 40, 220, INK);
  s.hline(18, 42, 220, INK);
  s.text(`VOL. ${st.progress.loop}  LATE EDITION  25C`, 128, 46, INK, { align: 'center' });
  s.hline(18, 56, 220, INK);
  // headline
  const lines = HEADLINES[st.headlineIndex];
  lines.forEach((l, i) => boldText(s, l, 128, 62 + i * 10, INK, 'center'));
  const hb = 62 + lines.length * 10 + 4;
  s.hline(18, hb, 220, INK);
  // fake photo box + caption
  const px = 20;
  const py = hb + 6;
  s.rect(px, py, 84, 62, C.GRAY_DD);
  for (let y = 0; y < 62; y += 2) for (let x = (y >> 1) & 1; x < 84; x += 2) s.px(px + x, py + y, C.GRAY_M);
  s.rect(px, py + 46, 84, 16, C.GRAY_D);
  s.spriteScaled('getaway_wagon', px + 4, py + 26, 1, { remap: [C.BLACK, C.GRAY_L, C.WHITE] });
  s.spriteScaled('agent_stand', px + 56, py + 30, 1, { remap: [C.BLACK, C.GRAY_M, C.WHITE] });
  s.frame(px - 1, py - 1, 86, 64, INK);
  s.text('AGENT LEAVES MALL', px + 42, py + 66, INK, { small: true, align: 'center' });
  // grey text columns beside the photo, deterministic widths
  const cx = px + 94;
  const cw = 232 - cx - 8;
  let seed = st.headlineIndex * 7 + 3;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let r = 0; r < 8; r++) {
    const w = r === 7 ? Math.floor(cw * 0.5) : cw - Math.floor(rnd() * 14);
    s.rect(cx, py + 2 + r * 8, w, 3, C.GRAY_M);
  }
  // two lower columns
  const by = py + 78;
  for (let col = 0; col < 2; col++) {
    const bx = 20 + col * 108;
    for (let r = 0; r < 6; r++) {
      const w = 100 - (r === 5 ? 44 : Math.floor(rnd() * 10));
      s.rect(bx, by + r * 8, w, 3, C.GRAY_M);
    }
  }
  s.vline(127, by - 2, 50, INK);
  s.text('START: SKIP', 238, 222, C.GRAY_D, { align: 'right', small: true });
}

function drawSpygramScreen(s: Surface, st: LevelClearState): void {
  s.clear(C.PURPLE_D);
  for (let y = 0; y < SCREEN_H; y += 8) for (let x = ((y >> 3) & 1) * 8; x < SCREEN_W; x += 16) s.rect(x, y, 2, 2, C.INDIGO_D);
  const f = st.phaseFrame;
  bigText(s, 'MISSION COMPLETE!', 128, 14, 1, blinkOn(f, 30) ? C.YELLOW_L : C.WHITE, { align: 'center', shadow: C.BLACK });
  const x = (SCREEN_W - SPYGRAM_CARD_W) >> 1;
  const y = ((SCREEN_H - SPYGRAM_CARD_H) >> 1) + 4;
  // card slides up quickly
  const slide = Math.max(0, 12 - f);
  drawSpygramCard(s, SPYGRAM_COMPLETE[st.spygramIndex], { x, y: y + slide * 3, frames: f });
  s.text('START: NEXT LOOP', 128, 214, blinkOn(f, 48) ? C.WHITE : C.GRAY_M, { align: 'center' });
}
