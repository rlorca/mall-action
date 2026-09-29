import {
  CONTINUE_SECONDS,
  FLOOR_NAMES,
  FLOOR_P,
  FLOOR_R,
  HUD_H,
  MALL_W,
  PACKAGES_TOTAL,
  SCREEN_H,
  SCREEN_W,
  VIEW_H,
  sec,
} from '../core/constants';
import { BLACK_FRIDAY_LINES, GAMEOVER_PA } from '../core/copy';
import { hudTimer } from '../core/powerups';
import { ESCALATORS, GETAWAY_CAR_X, SHAFTS } from '../core/mallLayout';
import { STORES, STOREFRONT_W } from '../core/storeDefs';
import type { GameState } from '../core/types';
import { displayFrames } from './displays';
import { FONT, TINY, drawText, drawTextCentered, drawTextCenteredOutlined, textWidth } from './font';
import { C } from './palette';
import type { Framebuffer } from './pixels';
import { POWERUP_ICONS, SPRITES, makeShutter } from './sprites';
import { STORE_BY_ID } from '../core/storeDefs';

// ---------------------------------------------------------------------------
// HUD: the 16 px status strip
// ---------------------------------------------------------------------------

export function drawHud(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  fb.rect(0, 0, SCREEN_W, HUD_H, C.BLACK);
  fb.hline(0, HUD_H - 1, SCREEN_W, C.DARKGREY);

  // Score, 6 digits.
  drawText(fb, FONT, String(Math.min(999999, g.score)).padStart(6, '0'), 2, 3, C.WHITE);

  // Lives, with a head icon.
  fb.blit(SPRITES.headIcon, 42, 4);
  drawText(fb, TINY, `X${Math.max(0, g.lives)}`, 52, 6, C.WHITE);

  // Packages: red until all 6 are found, then green.
  const done = g.level.packages >= PACKAGES_TOTAL;
  drawText(fb, TINY, `PKG ${g.level.packages}/${PACKAGES_TOTAL}`, 66, 6, done ? C.LIGHTGREEN : C.RED);

  // Active timed power-up, with a draining bar.
  const timer = hudTimer(g.powerups);
  if (timer) {
    drawText(fb, TINY, timer.name.slice(0, 13), 100, 1, C.PALEYELLOW);
    fb.frame(100, 8, 52, 5, C.GREY);
    fb.rect(101, 9, Math.max(0, Math.round(50 * timer.frac)), 3, C.LIGHTGREEN);
  }

  // Armour and radar icons.
  if (g.powerups.armor) fb.blit(SPRITES.armorIcon, 156, 4);
  if (g.powerups.radar) fb.blit(SPRITES.radarIcon, 166, 4);

  // Blinking ALARM.
  if (g.level.alarm && Math.floor(clock / 20) % 2 === 0) {
    drawText(fb, TINY, 'ALARM', 178, 6, C.RED);
  }

  drawFloorPanel(fb, g, clock);
}

/** An elevator-style LED floor panel: R / 4F ... P, or a store marquee. */
function drawFloorPanel(fb: Framebuffer, g: GameState, clock: number): void {
  const x0 = 206;
  const w = SCREEN_W - x0 - 2;
  fb.rect(x0, 2, w, 12, C.DARKGREY);
  fb.frame(x0, 2, w, 12, C.GREY);

  if (g.screen === 'store' && g.store) {
    // Inside a store the panel scrolls the store name like a marquee.
    const name = `${STORE_BY_ID.get(g.store.storeId)?.name ?? ''}  -  `;
    const tw = textWidth(TINY, name);
    const off = Math.floor(clock / 4) % Math.max(1, tw);
    // Draw twice so it wraps seamlessly; the panel clips it.
    for (const dx of [0, tw]) {
      // Drawn twice so the loop is seamless; drawClipped keeps it in the panel.
      drawClipped(fb, name, x0 + 2 - off + dx, 5, x0 + 1, x0 + w - 1, C.LIGHTGREEN);
    }
    return;
  }

  const cell = Math.floor(w / FLOOR_NAMES.length);
  const here = g.mall.player.floor;
  FLOOR_NAMES.forEach((name, f) => {
    const cx = x0 + f * cell + cell / 2;
    const on = f === here;
    if (on) fb.rect(x0 + f * cell + 1, 3, cell - 1, 10, C.MAROON);
    drawTextCentered(fb, TINY, name, cx, 6, on ? C.PALEYELLOW : C.GREY);
  });
}

/** Draw text clipped to an x range, for the marquee. */
function drawClipped(
  fb: Framebuffer,
  text: string,
  x: number,
  y: number,
  clipL: number,
  clipR: number,
  color: number,
): void {
  let cx = x;
  for (const raw of text) {
    const ch = raw.toUpperCase();
    const bits = TINY.glyphs.get(ch);
    if (bits) {
      for (let gy = 0; gy < TINY.h; gy++) {
        for (let gx = 0; gx < TINY.w; gx++) {
          if (!bits[gy * TINY.w + gx]) continue;
          const dx = cx + gx;
          if (dx < clipL || dx >= clipR) continue;
          fb.px(dx, y + gy, color);
        }
      }
    }
    cx += TINY.advance;
  }
}

// ---------------------------------------------------------------------------
// Map overlay: the MALL DIRECTORY
// ---------------------------------------------------------------------------

const MAP_X = 20;
const MAP_W = 216;
const MAP_SCALE = MAP_W / MALL_W;
const MAP_TOP = 34;
const MAP_ROW = 24;

const mapX = (x: number): number => Math.round(MAP_X + x * MAP_SCALE);
const mapY = (f: number): number => MAP_TOP + f * MAP_ROW;

export function drawMap(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  fb.rect(0, 0, SCREEN_W, SCREEN_H, C.DARKBLUE);
  drawTextCentered(fb, FONT, 'MALL DIRECTORY', SCREEN_W / 2, 10, C.PALEYELLOW);

  // Floors.
  for (let f = FLOOR_R; f <= FLOOR_P; f++) {
    const y = mapY(f);
    fb.rect(MAP_X, y + 8, MAP_W, 2, C.GREY);
    drawText(fb, TINY, FLOOR_NAMES[f], 6, y + 3, C.WHITE);
  }

  // Escalators.
  for (const e of ESCALATORS) {
    const x0 = mapX(e.bottomX);
    const y0 = mapY(e.bottomFloor) + 8;
    const x1 = mapX(e.topX);
    const y1 = mapY(e.topFloor) + 8;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      fb.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), C.LIGHTGREEN);
    }
  }

  // Shafts, with each car's current position.
  for (const s of SHAFTS) {
    const x = mapX(s.x);
    const top = mapY(Math.min(...s.floors));
    const bot = mapY(Math.max(...s.floors)) + 8;
    fb.vline(x, top, bot - top, C.LIGHTGREY);
    drawText(fb, TINY, s.id, x - 1, top - 7, C.PALEYELLOW);
    const car = g.mall.cars.find((c) => c.shaft === s.id)!;
    const cf = (car.y - 32) / 48;
    const cy = Math.round(MAP_TOP + cf * MAP_ROW) + 4;
    fb.rect(x - 3, cy, 7, 5, C.PALEYELLOW);
    fb.frame(x - 3, cy, 7, 5, C.BLACK);
  }

  // Stores, colour-coded.
  for (const def of STORES) {
    const rt = g.level.stores[def.id];
    const x = mapX(def.x);
    const w = Math.max(4, Math.round(STOREFRONT_W * MAP_SCALE));
    const y = mapY(def.floor) - 1;
    let col: number = C.RED;
    let outlineOnly = false;
    if (def.role === 'closed') {
      col = C.DARKGREY;
      outlineOnly = true;
    } else if (def.role === 'powerup') col = C.LIGHTBLUE;
    else if (rt?.cleared) col = C.GREY;

    if (outlineOnly) fb.frame(x, y, w, 9, col);
    else fb.rect(x, y, w, 9, col);

    // With Radar, a "!" marks each remaining package store.
    if (g.powerups.radar && def.role === 'target' && !rt?.cleared) {
      drawText(fb, TINY, '!', x + w / 2 - 1, y - 6, C.PALEYELLOW);
    }
  }

  // The getaway car.
  fb.rect(mapX(GETAWAY_CAR_X) - 5, mapY(FLOOR_P) - 1, 11, 9, C.LIGHTGREEN);
  drawText(fb, TINY, 'CAR', mapX(GETAWAY_CAR_X) - 6, mapY(FLOOR_P) + 10, C.LIGHTGREEN);

  // The player's position blinks; inside a store, the store blinks instead.
  if (Math.floor(clock / 10) % 2 === 0) {
    if (g.screen === 'store' && g.store) {
      const def = STORE_BY_ID.get(g.store.storeId)!;
      const x = mapX(def.x);
      const w = Math.max(4, Math.round(STOREFRONT_W * MAP_SCALE));
      fb.frame(x - 2, mapY(def.floor) - 3, w + 4, 13, C.WHITE);
    } else {
      const p = g.mall.player;
      fb.rect(mapX(p.x) - 2, mapY(p.floor) + 1, 5, 7, C.WHITE);
    }
  }

  // Legend.
  const ly = SCREEN_H - 30;
  const legend: [number, string][] = [
    [C.RED, 'PACKAGE'],
    [C.GREY, 'CLEARED'],
    [C.LIGHTBLUE, 'SHOP'],
    [C.DARKGREY, 'CLOSED'],
  ];
  let lx = 6;
  for (const [col, label] of legend) {
    fb.rect(lx, ly, 5, 5, col);
    drawText(fb, TINY, label, lx + 7, ly, C.WHITE);
    lx += 9 + textWidth(TINY, label) + 6;
  }

  // Inventory line: joke items and the photo strip.
  const items = [...g.inventory];
  if (g.hasPhotoStrip) items.push('PHOTO STRIP');
  const inv = items.length ? items.join(', ') : 'NOTHING YET';
  drawText(fb, TINY, `BAG: ${inv}`.slice(0, 60), 6, SCREEN_H - 18, C.PALEYELLOW);
  drawTextCentered(fb, TINY, 'SELECT TO CLOSE', SCREEN_W / 2, SCREEN_H - 9, C.GREY);
}

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

export function drawPause(fb: Framebuffer, clock: number): void {
  fb.clearClip();
  fb.darken(0, HUD_H, SCREEN_W, VIEW_H, C.BLACK, 2);
  if (Math.floor(clock / 24) % 2 === 0) {
    drawTextCenteredOutlined(fb, FONT, 'PAUSE', SCREEN_W / 2, HUD_H + VIEW_H / 2 - 10, C.WHITE, C.BLACK, 2);
  }
  drawTextCentered(fb, TINY, 'START TO RESUME', SCREEN_W / 2, HUD_H + VIEW_H / 2 + 16, C.GREY);
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

export function drawTitle(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  // Night-sky gradient.
  const bands = [C.BLACK, C.NAVY, C.DARKBLUE, C.INDIGO, C.PURPLE, C.VIOLET];
  for (let i = 0; i < bands.length; i++) {
    fb.rect(0, (i * SCREEN_H) / bands.length, SCREEN_W, SCREEN_H / bands.length + 1, bands[i]);
  }
  for (let i = 0; i < 50; i++) {
    const x = (i * 83) % SCREEN_W;
    const y = (i * 29) % 90;
    if ((i * 7 + Math.floor(clock / 24)) % 9 !== 0) fb.px(x, y, C.WHITE);
  }

  // A big two-tone logo.
  drawTextCentered(fb, FONT, 'MALL ACTION', SCREEN_W / 2 + 1, 41, C.MAROON, 3);
  drawTextCentered(fb, FONT, 'MALL ACTION', SCREEN_W / 2, 40, C.YELLOW, 3);
  drawTextCentered(fb, FONT, 'A SHOPPING MALL ESPIONAGE', SCREEN_W / 2, 66, C.PALECYAN);

  if (g.konamiArmed) {
    // BLACK FRIDAY! flashing, after the Konami code.
    if (Math.floor(clock / 6) % 2 === 0) {
      drawTextCentered(fb, FONT, BLACK_FRIDAY_LINES[0], SCREEN_W / 2, 84, C.RED, 2);
    }
    drawTextCentered(fb, FONT, BLACK_FRIDAY_LINES[1], SCREEN_W / 2, 102, C.PALEYELLOW);
  } else {
    drawTextCentered(fb, FONT, '(C) 2026 FLICKERSOFT', SCREEN_W / 2, 88, C.WHITE);
    drawTextCentered(fb, FONT, `HIGH SCORE  ${String(g.highScore).padStart(6, '0')}`, SCREEN_W / 2, 100, C.PALEYELLOW);
  }

  if (Math.floor(clock / 24) % 2 === 0) {
    drawTextCentered(fb, FONT, 'PRESS START', SCREEN_W / 2, 122, C.WHITE);
  }

  drawTextCentered(fb, TINY, 'ARROWS MOVE  Z SHOOT  X JUMP/SEARCH', SCREEN_W / 2, 142, C.LIGHTGREY);
  drawTextCentered(fb, TINY, 'SHIFT MAP  ENTER START  C CRT  M SOUND', SCREEN_W / 2, 150, C.LIGHTGREY);

  drawTitleStorefronts(fb, clock);
}

/** A row of real storefronts, with window displays, scrolling along the bottom. */
function drawTitleStorefronts(fb: Framebuffer, clock: number): void {
  const y = SCREEN_H - 56;
  fb.rect(0, y, SCREEN_W, 56, C.NAVY);
  fb.rect(0, SCREEN_H - 12, SCREEN_W, 12, C.LIGHTGREY);
  fb.hline(0, SCREEN_H - 12, SCREEN_W, C.WHITE);

  const scroll = Math.floor(clock / 2) % (STOREFRONT_W * STORES.length);
  for (let i = -1; i < 5; i++) {
    const def = STORES[(i + STORES.length * 2) % STORES.length];
    const x = i * STOREFRONT_W - (scroll % STOREFRONT_W) + ((i * 0) | 0);
    const idx = Math.floor((scroll + i * STOREFRONT_W) / STOREFRONT_W) % STORES.length;
    const d = STORES[(idx + STORES.length) % STORES.length];
    void def;
    fb.rect(x, y + 6, STOREFRONT_W - 2, 38, C.GREY);
    fb.rect(x, y + 6, STOREFRONT_W - 2, 9, C.BLACK);
    drawTextCentered(fb, TINY, d.name, x + STOREFRONT_W / 2 - 1, y + 8, d.role === 'closed' ? C.GREY : C.YELLOW);
    const frames = displayFrames(d.windows[0]);
    fb.blit(frames[Math.floor(clock / 20) % frames.length], x + 3, y + 18);
    const frames2 = displayFrames(d.windows[1]);
    fb.blit(frames2[Math.floor(clock / 20) % frames2.length], x + STOREFRONT_W - 27, y + 18);
    // Door.
    fb.rect(x + 29, y + 20, 20, 24, d.role === 'target' ? C.RED : d.role === 'powerup' ? C.LIGHTBLUE : C.DARKGREY);
  }
}

// ---------------------------------------------------------------------------
// Level clear
// ---------------------------------------------------------------------------

export function drawLevelClear(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  const t = g.clearTally!;
  // Parking-garage backdrop.
  fb.rect(0, 0, SCREEN_W, SCREEN_H, C.BLACK);
  fb.rect(0, SCREEN_H - 60, SCREEN_W, 60, C.DARKGREY);
  fb.hline(0, SCREEN_H - 60, SCREEN_W, C.GREY);
  for (let x = 16; x < SCREEN_W; x += 64) {
    fb.blit(SPRITES.pillar, x, SCREEN_H - 108);
  }

  // The wagon drives off, with a spy chasing it waving a receipt.
  const drive = Math.min(1, t.frames / sec(2.5));
  const carX = Math.round(20 + drive * 200);
  fb.blit(SPRITES.stationWagon, carX, SCREEN_H - 84);
  const spyX = carX - 40 - Math.round(Math.sin(clock / 6) * 2);
  fb.blit(SPRITES.spyWalk, spyX, SCREEN_H - 84, true);
  // The receipt.
  fb.rect(spyX - 4, SCREEN_H - 82 + (Math.floor(clock / 6) % 2), 5, 10, C.WHITE);

  drawTextCentered(fb, FONT, 'LEVEL CLEAR', SCREEN_W / 2, 16, C.PALEYELLOW, 2);

  const rows: [string, string][] = [
    ['PACKAGES', `${t.packages}/${PACKAGES_TOTAL}`],
    ['TIME BONUS', String(t.timeBonus)],
    ['CLEAR BONUS', String(t.clearBonus)],
  ];
  rows.forEach(([label, value], i) => {
    if (t.step <= i && t.frames > sec(2.5)) return;
    if (t.frames <= sec(2.5)) return;
    const y = 52 + i * 14;
    drawText(fb, FONT, label, 40, y, C.WHITE);
    drawText(fb, FONT, value, 180, y, C.PALEYELLOW);
  });
  if (t.step >= 3) {
    drawTextCentered(fb, FONT, `LOOP ${t.loop}`, SCREEN_W / 2, 102, C.LIGHTGREEN);
    if (Math.floor(clock / 20) % 2 === 0) {
      drawTextCentered(fb, TINY, 'PRESS START', SCREEN_W / 2, 118, C.GREY);
    }
  }
}

// ---------------------------------------------------------------------------
// THE DAILY MALL
// ---------------------------------------------------------------------------

export function drawNews(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  fb.rect(0, 0, SCREEN_W, SCREEN_H, C.DARKGREY);
  // The paper.
  const px = 12;
  const pw = SCREEN_W - 24;
  fb.rect(px, 10, pw, SCREEN_H - 24, C.WHITE);
  fb.frame(px, 10, pw, SCREEN_H - 24, C.BLACK);

  drawTextCentered(fb, FONT, 'THE DAILY MALL', SCREEN_W / 2, 18, C.BLACK, 2);
  fb.hline(px + 6, 38, pw - 12, C.BLACK);
  drawTextCentered(fb, TINY, 'YOUR MALL. YOUR NEWS. MOSTLY.', SCREEN_W / 2, 42, C.DARKGREY);

  const lines = g.headline ?? [];
  lines.forEach((l, i) => {
    drawTextCentered(fb, FONT, l, SCREEN_W / 2, 56 + i * 12, C.BLACK);
  });

  // Columns of "text".
  for (let col = 0; col < 3; col++) {
    const cx = px + 8 + col * ((pw - 16) / 3);
    for (let i = 0; i < 14; i++) {
      const w = ((i * 37 + col * 13) % 20) + 30;
      fb.hline(cx, 92 + i * 6, Math.min(w, (pw - 16) / 3 - 6), C.GREY);
    }
  }
  // A photo.
  fb.rect(px + 8, 92, 60, 40, C.LIGHTGREY);
  fb.frame(px + 8, 92, 60, 40, C.BLACK);
  fb.blit(SPRITES.agentIdle, px + 30, 100);

  if (Math.floor(clock / 20) % 2 === 0) {
    drawTextCentered(fb, TINY, 'PRESS START', SCREEN_W / 2, SCREEN_H - 20, C.DARKGREY);
  }
}

// ---------------------------------------------------------------------------
// SPYGRAM card
// ---------------------------------------------------------------------------

const CARD_W = 150;
const CARD_H = 130;

export function drawSpygram(fb: Framebuffer, g: GameState, clock: number, overlay: boolean): void {
  const s = g.spygram;
  if (!s) return;
  fb.clearClip();
  if (!overlay) fb.rect(0, 0, SCREEN_W, SCREEN_H, C.INDIGO);

  const x = Math.round((SCREEN_W - CARD_W) / 2);
  const y = Math.round((SCREEN_H - CARD_H) / 2);

  fb.rect(x, y, CARD_W, CARD_H, C.WHITE);
  fb.frame(x, y, CARD_W, CARD_H, C.BLACK);
  // Magenta header.
  fb.rect(x + 1, y + 1, CARD_W - 2, 13, C.MAGENTA);
  drawText(fb, TINY, 'SPYGRAM', x + 5, y + 5, C.WHITE);
  drawText(fb, TINY, '@AGENT_7', x + CARD_W - 38, y + 5, C.WHITE);

  // The photo.
  const py = y + 15;
  fb.rect(x + 5, py, CARD_W - 10, 54, C.DARKBLUE);
  fb.frame(x + 5, py, CARD_W - 10, 54, C.GREY);
  for (let i = 0; i < 24; i++) {
    fb.px(x + 8 + ((i * 47) % (CARD_W - 16)), py + 4 + ((i * 17) % 46), C.WHITE);
  }
  fb.blit(s.kind === 'arrival' ? SPRITES.agentSelfie : SPRITES.agentHold, x + CARD_W / 2 - 8, py + 28);

  // Caption.
  s.caption.forEach((line, i) => {
    drawText(fb, TINY, line, x + 6, py + 58 + i * 7, C.BLACK);
  });

  // A like counter that climbs quickly.
  const likes = Math.min(999999, s.likes);
  drawText(fb, TINY, '~', x + 6, py + 74, C.RED);
  drawText(fb, TINY, `${likes} LIKES`, x + 12, py + 74, C.BLACK);

  // One comment.
  drawText(fb, TINY, s.comment, x + 6, py + 84, C.DARKGREY);

  if (Math.floor(clock / 20) % 2 === 0) {
    drawTextCentered(fb, TINY, 'ANY BUTTON', SCREEN_W / 2, y + CARD_H - 9, C.GREY);
  }
}

// ---------------------------------------------------------------------------
// Continue
// ---------------------------------------------------------------------------

export function drawContinue(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  fb.rect(0, 0, SCREEN_W, SCREEN_H, C.BLACK);
  drawTextCentered(fb, FONT, 'CONTINUE?', SCREEN_W / 2, 48, C.WHITE, 2);

  const n = Math.max(0, g.continueCountdown);
  const col = n <= 3 ? C.RED : C.PALEYELLOW;
  drawTextCentered(fb, FONT, String(n), SCREEN_W / 2, 90, col, 6);

  drawTextCentered(fb, FONT, `CONTINUES LEFT: ${g.continues}`, SCREEN_W / 2, 158, C.LIGHTGREY);
  if (Math.floor(clock / 20) % 2 === 0) {
    drawTextCentered(fb, FONT, 'PRESS START', SCREEN_W / 2, 180, C.WHITE);
  }
  void CONTINUE_SECONDS;
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

const gameOverShutter = makeShutter(SCREEN_W, SCREEN_H);

export function drawGameOver(fb: Framebuffer, g: GameState, clock: number): void {
  fb.clearClip();
  fb.rect(0, 0, SCREEN_W, SCREEN_H, C.BLACK);

  const f = g.screenFrames;

  // Storefronts with the agent in front, then the shutters roll down over them.
  fb.rect(0, 60, SCREEN_W, 80, C.NAVY);
  for (let i = 0; i < 4; i++) {
    const d = STORES[i];
    const x = i * 66 - 4;
    fb.rect(x, 70, 62, 52, C.GREY);
    fb.rect(x, 70, 62, 9, C.BLACK);
    drawTextCentered(fb, TINY, d.name, x + 31, 72, C.YELLOW);
    fb.blit(displayFrames(d.windows[0])[0], x + 1, 82);
    fb.blit(displayFrames(d.windows[1])[0], x + 37, 82);
    fb.rect(x + 26, 104, 12, 18, d.role === 'target' ? C.MAROON : C.DARKBLUE);
    fb.frame(x + 26, 104, 12, 18, C.BLACK);
  }
  fb.rect(0, 122, SCREEN_W, 18, C.LIGHTGREY);
  fb.blit(SPRITES.agentIdle, 118, 98);

  // The typewriter PA message.
  const typed = Math.floor(f / 3);
  let budget = typed;
  GAMEOVER_PA.forEach((line, i) => {
    const take = Math.max(0, Math.min(line.length, budget));
    budget -= line.length;
    if (take > 0) drawTextCentered(fb, FONT, line.slice(0, take), SCREEN_W / 2, 18 + i * 12, C.PALEYELLOW);
  });

  // Metal shutters rolling down over the storefronts and the agent.
  const rollStart = sec(2.2);
  if (f > rollStart) {
    const t = Math.min(1, (f - rollStart) / sec(1.6));
    const h = Math.round(80 * t);
    fb.rect(0, 60, SCREEN_W, h, C.DARKGREY);
    for (let y = 60; y < 60 + h; y += 3) fb.hline(0, y, SCREEN_W, C.GREY);
    fb.hline(0, 60 + h - 1, SCREEN_W, C.LIGHTGREY);
  }

  if (f > sec(4)) {
    fb.rect(0, 0, SCREEN_W, SCREEN_H, C.BLACK);
    drawTextCentered(fb, FONT, 'GAME OVER', SCREEN_W / 2, 80, C.RED, 3);
    drawTextCentered(fb, FONT, `SCORE ${String(g.score).padStart(6, '0')}`, SCREEN_W / 2, 126, C.WHITE);
    drawTextCentered(fb, FONT, `HIGH  ${String(g.highScore).padStart(6, '0')}`, SCREEN_W / 2, 140, C.PALEYELLOW);
    if (Math.floor(clock / 20) % 2 === 0) {
      drawTextCentered(fb, TINY, 'PRESS START', SCREEN_W / 2, 168, C.GREY);
    }
  }
  void gameOverShutter;
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

/** The kiosk map panel: a small directory highlighting the nearest package. */
export function drawKioskPanel(fb: Framebuffer, g: GameState, clock: number): void {
  const w = 120;
  const h = 62;
  const x = SCREEN_W - w - 6;
  const y = HUD_H + 6;
  fb.rect(x, y, w, h, C.BLACK);
  fb.frame(x, y, w, h, C.PALECYAN);
  drawTextCentered(fb, TINY, 'DIRECTORY', x + w / 2, y + 3, C.PALECYAN);
  for (let f = FLOOR_R; f <= FLOOR_P; f++) {
    const ly = y + 12 + f * 8;
    fb.hline(x + 4, ly + 5, w - 8, C.DARKGREY);
    drawText(fb, TINY, FLOOR_NAMES[f], x + 4, ly, C.GREY);
    for (const def of STORES.filter((s) => s.floor === f)) {
      const rt = g.level.stores[def.id];
      const sxp = x + 18 + Math.round((def.x / MALL_W) * (w - 26));
      const col =
        def.role === 'closed' ? C.DARKGREY : def.role === 'powerup' ? C.LIGHTBLUE : rt?.cleared ? C.GREY : C.RED;
      const blink = def.role === 'target' && !rt?.cleared && Math.floor(clock / 8) % 2 === 0;
      fb.rect(sxp, ly, 8, 5, blink ? C.PALEYELLOW : col);
    }
  }
}

/** Power-up pickup icon helper shared with the mall scene. */
export { POWERUP_ICONS };
