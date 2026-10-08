import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';
import { UI, type SpygramPost } from '../content/copy';
import type { LevelClearPhase, TallyRowView } from '../game/screens/levelclear';
import { LC_DRIVE_FRAMES } from '../game/screens/levelclear';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { drawNewspaper } from './newspaperView';
import { drawSpygram, spygramLikes, SPYGRAM_CARD_H, type PhotoFn } from './spygramView';
import { drawBubble } from './widgets';
import { blinkOn, blitScaledByName, drawSpriteByName, hash01, spriteOrNull, H, W } from './screenFx';

/** What the view reads from the LevelClearScreen. */
export interface LevelClearViewState {
  phase: LevelClearPhase;
  phaseFrame: number;
  tally: TallyRowView[];
  headline: string;
  post: SpygramPost;
  likeSeed: number;
}

// ------------------------------------------------------------------ phase 0: the garage

const FLOOR = 196; // y of the garage floor line under the wheels
const WAGON_X0 = 92;
const WAGON_GO = 40; // frame the wagon starts rolling
const WAGON_ACC = 0.03;

/** Wagon left edge x after `pf` frames of the scene (pure; the tests use it). */
export function wagonX(pf: number): number {
  const t = Math.max(0, pf - WAGON_GO);
  return WAGON_X0 + 0.5 * WAGON_ACC * t * t;
}

/** Chasing spy's left edge x. He runs in from the left, never catches up, then pulls up and stops. */
export function spyX(pf: number): number {
  const START = 30;
  const SPEED = 1.8;
  const stopAt = 150; // frame he starts to give up
  const brake = 30; // frames to stop
  if (pf < START) return -24;
  if (pf <= stopAt) return -24 + SPEED * (pf - START);
  const t = Math.min(brake, pf - stopAt);
  return -24 + SPEED * (stopAt - START) + SPEED * (t - (t * t) / (2 * brake));
}

function drawGarageBackdrop(fb: Framebuffer, frame: number): void {
  // back wall
  fb.fillRect(0, 0, W, H, C.GRAY);
  fb.dither(0, 44, W, FLOOR - 44, C.MDGRAY);
  // ceiling slab with beams and pipes
  fb.fillRect(0, 0, W, 44, C.MDGRAY);
  fb.fillRect(0, 40, W, 4, C.BLACK);
  for (let x = 0; x < W; x += 64) {
    fb.fillRect(x, 0, 14, 52, C.GRAY);
    fb.vLine(x + 14, 0, 52, C.BLACK);
  }
  fb.hLine(0, 8, W, C.DKTEAL);
  fb.hLine(0, 9, W, C.TEAL);
  fb.hLine(0, 12, W, C.DKTEAL);
  // fluorescent tubes, one of them flickering
  for (let i = 0; i < 3; i++) {
    const lx = 40 + i * 80;
    const lit = i !== 1 || frame % 90 > 6;
    fb.fillRect(lx, 46, 36, 3, lit ? C.PALEBLUE : C.GRAY);
    fb.hLine(lx, 49, 36, C.BLACK);
    if (lit) fb.dither(lx - 4, 49, 44, 5, C.MDGRAY);
  }
  // pillars with hazard stripes at the foot
  for (const px of [18, 130, 236]) {
    fb.fillRect(px, 44, 20, FLOOR - 44, C.LTGRAY);
    fb.fillRect(px + 14, 44, 6, FLOOR - 44, C.GRAY);
    fb.vLine(px, 44, FLOOR - 44, C.BLACK);
    fb.vLine(px + 19, 44, FLOOR - 44, C.BLACK);
    for (let y = FLOOR - 16; y < FLOOR; y += 4) fb.fillRect(px, y, 20, 2, ((y - (FLOOR - 16)) / 4) % 2 === 0 ? C.YELLOW : C.BLACK);
  }
  // level sign "P" and the EXIT arrow
  fb.fillRect(68, 62, 22, 22, C.BLUE);
  fb.strokeRect(68, 62, 22, 22, C.WHITE);
  drawText(fb, SCREEN_TEXT.garage.level, 79, 67, C.WHITE, { scale: 2, align: 'center' });
  fb.fillRect(176, 66, 46, 14, C.GREEN);
  fb.strokeRect(176, 66, 46, 14, C.WHITE);
  drawText(fb, SCREEN_TEXT.garage.exit, 199, 70, C.WHITE, { align: 'center' });
  // floor, parking lines and wheel stops
  fb.fillRect(0, FLOOR, W, H - FLOOR, C.MDGRAY);
  fb.hLine(0, FLOOR, W, C.LTGRAY);
  fb.dither(0, FLOOR + 1, W, H - FLOOR - 1, C.GRAY);
  for (let x = -16; x < W; x += 72) {
    for (let k = 0; k < 24; k++) fb.setPixel(x + 28 - Math.floor(k / 2), FLOOR + 6 + k, C.WHITE); // slanted parking line
    fb.fillRect(x + 6, FLOOR + 3, 20, 3, C.YELLOW);
  }
}

function drawReceipt(fb: Framebuffer, x: number, y: number, frame: number): void {
  const wob = (frame >> 2) % 2;
  fb.fillRect(x, y, 7, 11, C.WHITE);
  fb.strokeRect(x, y, 7, 11, C.BLACK);
  for (let r = 2; r < 9; r += 2) fb.hLine(x + 1, y + r, 5, r === 4 ? C.RED : C.MDGRAY);
  // torn bottom edge
  fb.setPixel(x + 1, y + 11, C.WHITE);
  fb.setPixel(x + 3, y + 11 + wob, C.WHITE);
  fb.setPixel(x + 5, y + 11, C.WHITE);
}

function drawPuff(fb: Framebuffer, x: number, y: number, age: number): void {
  const s = spriteOrNull('fx.puff');
  if (s) fb.sprite(s, x, y, { frame: Math.floor(age / 6) % s.frames });
  else fb.fillCircle(x + 6, y + 6, 3 - Math.floor(age / 10), C.LTGRAY);
}

function drawDrive(fb: Framebuffer, pf: number): void {
  drawGarageBackdrop(fb, pf);

  // exhaust puffs trail behind the accelerating wagon
  for (let k = 0; k < 9; k++) {
    const born = WAGON_GO + 4 + k * 7;
    const age = pf - born;
    if (age < 0 || age > 26) continue;
    drawPuff(fb, Math.round(wagonX(born)) - 10, FLOOR - 16 - Math.floor(age / 3), age);
  }

  // the wagon
  const wx = Math.round(wagonX(pf));
  if (wx < W) {
    const lights = pf >= 18;
    fb.fillRect(wx + 4, FLOOR - 2, 64, 3, C.BLACK); // soft shadow under the car
    if (!drawSpriteByName(fb, 'wagon', wx, FLOOR - 28, { frame: lights ? 1 : 0 }, { w: 72, h: 28 })) fb.strokeRect(wx, FLOOR - 28, 72, 28, C.AMBER);
    // headlight glow in front of the car once the lights are on
    if (lights) fb.dither(wx + 72, FLOOR - 14, 12, 8, C.PALEYELLOW);
  }

  // the chasing spy waving his receipt
  const sx = Math.round(spyX(pf));
  if (pf >= 30 && sx < W) {
    const running = spyX(pf) - spyX(pf - 1) > 0.25;
    const sy = FLOOR - 24 + 1;
    const bob = running ? (pf >> 2) % 2 : 0;
    if (running) drawSpriteByName(fb, 'spy.walk', sx, sy - bob, { frame: (pf >> 2) & 3 });
    else drawSpriteByName(fb, 'spy.stand', sx, sy, {});
    const wave = Math.round(Math.sin(pf / 3) * 3);
    drawReceipt(fb, sx + 12, sy - 10 + wave - bob, pf);
    // the shout, while he runs
    if (pf >= 60 && pf <= 215) drawBubble(fb, SCREEN_TEXT.chase, sx + 8, sy - 14, 4);
    // sweat drops once he gives up
    if (pf > 175) {
      const d = (pf >> 3) % 3;
      fb.fillRect(sx - 2 + d, sy + 4 - d, 1, 2, C.CYAN);
      fb.fillRect(sx + 18 - d, sy + 2 + d, 1, 2, C.CYAN);
    }
  }

  // banner
  if (pf >= 12) {
    const col = [C.YELLOW, C.WHITE, C.ORANGE][Math.floor(pf / 6) % 3]!;
    drawText(fb, UI.levelClear, W / 2, 18, col, { scale: 2, align: 'center', shadow: C.BLACK });
  }

  // fade out at the end
  const fade = Math.floor((pf - (LC_DRIVE_FRAMES - 18)) / 5) + 1;
  if (fade > 0) fb.darkenAll(Math.min(4, fade));
}

// ------------------------------------------------------------------ phase 1: the receipt

function drawZigzag(fb: Framebuffer, x: number, y: number, w: number, up: boolean, color: number): void {
  // sawtooth teeth hanging off the paper edge (y is the paper's top / bottom edge)
  for (let i = 0; i < w; i += 6) {
    for (let r = 0; r < 3; r++) fb.fillRect(x + i + r, up ? y - 1 - r : y + r, 6 - 2 * r, 1, color);
  }
}

function drawTally(fb: Framebuffer, s: LevelClearViewState): void {
  const pf = s.phaseFrame;
  fb.fillRect(0, 0, W, H, C.DKBLUE);
  fb.dither(0, 0, W, H, C.INDIGO);
  const t = Math.min(1, pf / 22);
  const oy = Math.round((1 - (1 - (1 - t) * (1 - t))) * H);

  const px = 40;
  const pw = 176;
  const top = 12 + oy;
  const bottom = 226 + oy;
  fb.fillRect(px + 3, top + 3, pw, bottom - top, C.BLACK);
  fb.fillRect(px, top, pw, bottom - top, C.WHITE);
  drawZigzag(fb, px, top, pw, true, C.WHITE);
  drawZigzag(fb, px, bottom, pw, false, C.WHITE);

  drawText(fb, UI.levelClear, px + pw / 2, top + 10, C.BLACK, { scale: 2, align: 'center' });
  fb.hLine(px + 8, top + 28, pw - 16, C.BLACK);
  for (let x = px + 8; x < px + pw - 8; x += 4) fb.setPixel(x + 1, top + 30, C.GRAY);

  const rows = s.tally;
  const ys = [40, 62, 84, 108, 148];
  rows.forEach((r, i) => {
    if (!r.visible) return;
    const y = top + ys[i]!;
    const col = r.counting ? (blinkOn(pf, 6, 3) ? C.RED : C.MAROON) : C.BLACK;
    if (r.value === '') {
      // LOOP n: big and centred between stars
      drawText(fb, r.label, px + pw / 2, y, C.BLACK, { scale: 2, align: 'center' });
      drawText(fb, '*', px + 16, y + 3, C.BLACK);
      drawText(fb, '*', px + pw - 21, y + 3, C.BLACK);
      return;
    }
    if (r.total) {
      fb.hLine(px + 8, y - 8, pw - 16, C.BLACK);
      fb.hLine(px + 8, y - 6, pw - 16, C.BLACK);
      drawText(fb, r.label, px + 10, y + 4, C.BLACK);
      drawText(fb, r.value, px + pw - 10, y, col, { scale: 2, align: 'right' });
      return;
    }
    drawText(fb, r.label, px + 10, y, C.BLACK);
    const vw = textWidth(r.value, { scale: 2 });
    drawText(fb, r.value, px + pw - 10, y - 3, col, { scale: 2, align: 'right' });
    // dotted leader between label and value
    const lx = px + 10 + textWidth(r.label) + 4;
    for (let x = lx; x < px + pw - 10 - vw - 4; x += 3) fb.setPixel(x, y + 6, C.GRAY);
  });

  // barcode + thanks
  const by = top + 168;
  for (let x = px + 20; x < px + pw - 20; ) {
    const w = 1 + Math.floor(hash01(x, 3) * 3);
    fb.fillRect(x, by, w, 14, C.BLACK);
    x += w + 1 + Math.floor(hash01(x, 4) * 2);
  }
  drawText(fb, SCREEN_TEXT.tally.thanks, px + pw / 2, by + 20, C.MDGRAY, { align: 'center' });
}

// ------------------------------------------------------------------ phase 3: the SPYGRAM post

/** The post's photo: the agent grinning in front of the wood-panelled wagon in the garage. */
export const garagePhoto: PhotoFn = (fb, x, y, w, h, frame) => {
  fb.fillRect(x, y, w, h, C.GRAY);
  fb.dither(x, y + 14, w, h - 22, C.MDGRAY);
  fb.fillRect(x, y, w, 14, C.MDGRAY);
  fb.fillRect(x, y + 12, w, 2, C.BLACK);
  fb.fillRect(x + 6, y + 14, 12, h - 22, C.LTGRAY);
  fb.fillRect(x, y + h - 8, w, 8, C.MDGRAY);
  fb.hLine(x, y + h - 8, w, C.LTGRAY);
  if (!blitScaledByName(fb, 'wagon', x + 2, y + h - 8 - 56, 2, { frame: 0 })) fb.strokeRect(x + 2, y + h - 64, 144, 56, C.AMBER);
  if (!blitScaledByName(fb, 'agent.selfie', x + w - 56, y + h - 8 - 72, 3, { frame: frame % 120 < 4 ? 1 : 0 })) fb.strokeRect(x + w - 56, y + h - 80, 48, 72, C.HOTPINK);
};

function drawSpygramPhase(fb: Framebuffer, s: LevelClearViewState): void {
  const pf = s.phaseFrame;
  fb.fillRect(0, 0, W, H, C.PURPLE0);
  for (let y = 0; y < H; y += 24) fb.dither(0, y, W, 12, C.VIOLET);
  const t = Math.min(1, pf / 16);
  const ease = 1 - (1 - t) * (1 - t);
  const y = Math.round((H - SPYGRAM_CARD_H) / 2 + (1 - ease) * H);
  drawSpygram(fb, s.post, spygramLikes(pf, s.likeSeed), pf, { y, photo: garagePhoto });
}

export function drawLevelClear(fb: Framebuffer, s: LevelClearViewState): void {
  switch (s.phase) {
    case 0:
      drawDrive(fb, s.phaseFrame);
      break;
    case 1:
      drawTally(fb, s);
      break;
    case 2:
      drawNewspaper(fb, s.headline, s.phaseFrame);
      break;
    case 3:
      drawSpygramPhase(fb, s);
      break;
  }
}
