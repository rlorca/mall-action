// Full-screen views: title, directory map, pause, level clear, continue, game over, fades.
import { FLOOR_NAMES, HUD_H, MALL_W, SCREEN_H, SCREEN_W, SEC, SHAFTS, SHAFT_W, ESCALATORS, floorY } from '../core/constants';
import { HEADLINES, SHOP_LINES, continuesLeft } from '../core/copy';
import { NES } from '../core/palette';
import { STORES, storeById } from '../mall/layout';
import type { Game } from '../core/game';
import type { Assets } from './assets';
import { drawText, drawCentered, wrap, textWidth } from './text';
import { SKY } from './palette-theme';
import { drawWagon, drawSelfie } from './mall-view';

const blink = (frame: number, period = 40): boolean => Math.floor(frame / (period / 2)) % 2 === 0;

/** Vertical night-sky gradient with a few stars that twinkle. */
export function drawSky(g: CanvasRenderingContext2D, top: number, height: number, frame: number): void {
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = SKY[Math.min(SKY.length - 1, Math.floor((i / bands) * SKY.length))];
    g.fillRect(0, top + (i * height) / bands, SCREEN_W, height / bands + 1);
  }
  for (let i = 0; i < 36; i++) {
    if ((frame >> 5) % 3 === i % 3) continue;
    g.fillStyle = NES.silver;
    g.fillRect((i * 97) % SCREEN_W, top + ((i * 53) % Math.max(1, height - 40)), 1, 1);
  }
}

export function drawTitle(g: CanvasRenderingContext2D, a: Assets, game: Game, frame: number): void {
  drawSky(g, 0, SCREEN_H, frame);
  const logo = (text: string, y: number, colour: string): void => {
    const x = Math.round(SCREEN_W / 2 - textWidth(text, 3) / 2);
    drawText(g, text, x + 2, y + 2, NES.ink, 3);
    drawText(g, text, x, y, colour, 3);
  };
  logo('MALL', 30, NES.yellow);
  logo('ACTION', 60, NES.pink);
  drawCentered(g, SHOP_LINES.subtitle, 92, NES.white);
  drawCentered(g, SHOP_LINES.copyright, 104, NES.silver);
  drawCentered(g, `HI ${String(game.highScore).padStart(6, '0')}`, 118, NES.white);
  if (game.blackFriday) {
    if (blink(frame, 30)) {
      drawCentered(g, 'BLACK FRIDAY!', 130, NES.red);
      drawCentered(g, '70% OFF EVERYTHING', 140, NES.yellow);
    }
  } else if (blink(frame)) {
    drawCentered(g, SHOP_LINES.pressStart, 134, NES.white);
  }
  drawCentered(g, SHOP_LINES.controlHint, 156, NES.silver);
  drawStorefrontRow(g, frame);
  void a;
}

/** A row of storefronts that scrolls slowly along the bottom of the title screen. */
function drawStorefrontRow(g: CanvasRenderingContext2D, frame: number): void {
  const y = 186;
  const offset = Math.floor(frame / 4) % 96;
  const palette = [NES.red, NES.blue, NES.dkgrey, NES.green, NES.magenta, NES.orange];
  for (let i = -1; i < 5; i++) {
    const x = i * 96 - offset;
    const idx = ((i % STORES.length) + STORES.length) % STORES.length;
    g.fillStyle = NES.nightB;
    g.fillRect(x, y + 14, 80, 40);
    g.fillStyle = palette[idx % palette.length];
    g.fillRect(x, y, 80, 14);
    drawCentered(g, STORES[idx].name.slice(0, 13), y + 3, NES.white, 1, x + 40);
    g.fillStyle = NES.ink;
    g.fillRect(x + 32, y + 26, 16, 28);
    g.fillStyle = NES.yellow;
    g.fillRect(x + 6, y + 22, 22, 14);
    g.fillRect(x + 52, y + 22, 22, 14);
  }
}

/** The MALL DIRECTORY: floors, shafts with their cars, escalators, colour-coded stores. */
export function drawMap(g: CanvasRenderingContext2D, game: Game, frame: number): void {
  g.fillStyle = NES.nightA;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawCentered(g, SHOP_LINES.mapTitle, 3, NES.gold, 1);
  const w = game.world;
  const sxOf = (x: number): number => 12 + (x / MALL_W) * (SCREEN_W - 24);
  const floorLine = (f: number): number => 26 + f * 26;
  FLOOR_NAMES.forEach((name, f) => {
    g.fillStyle = NES.dkgrey;
    g.fillRect(10, floorLine(f), SCREEN_W - 20, 1);
    drawText(g, name, 1, floorLine(f) - 3, NES.silver, 1);
  });
  for (const e of ESCALATORS) {
    g.fillStyle = NES.silver;
    const x0 = sxOf(e.x);
    const x1 = sxOf(e.x + 48);
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const y = floorLine(e.lowerFloor) + (floorLine(e.upperFloor) - floorLine(e.lowerFloor)) * (1 - t);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  const shaftW = Math.round((SHAFT_W / MALL_W) * (SCREEN_W - 24));
  SHAFTS.forEach((s, i) => {
    const x = Math.round(sxOf(s.x));
    g.fillStyle = NES.ink;
    g.fillRect(x, floorLine(s.minFloor) - 2, shaftW, floorLine(s.maxFloor) - floorLine(s.minFloor) + 4);
    const car = w.cars[i];
    const cy = floorLine(0) + ((car.y - floorY(0)) / 48) * 26;
    g.fillStyle = car.occupied ? NES.yellow : NES.cyan;
    g.fillRect(x + 2, Math.round(cy) - 2, 6, 4);
    drawText(g, s.id, x + 1, floorLine(s.minFloor) - 9, NES.silver, 1);
  });
  const storeW = Math.round((80 / MALL_W) * (SCREEN_W - 24)) - 1;
  for (const s of STORES) {
    const x = Math.round(sxOf(s.x) + 1);
    const y = floorLine(s.floor) - 5;
    const remaining = s.role === 'target' && game.remaining.has(s.id);
    const cleared = s.role === 'target' && !game.remaining.has(s.id);
    if (s.role === 'closed') {
      g.fillStyle = NES.ink;
      g.fillRect(x, y, storeW, 4);
      g.fillStyle = NES.dkgrey;
      g.fillRect(x + 1, y + 1, storeW - 2, 2);
      continue;
    }
    g.fillStyle = remaining ? (blink(frame, 30) ? NES.red : NES.redDk) : cleared ? NES.grey : NES.blue;
    g.fillRect(x, y, storeW, 4);
    if (remaining && (game.powerUps.radar || blink(frame, 30))) drawText(g, '!', x, y - 9, NES.yellow, 1);
  }
  // The agent, blinking; inside a store, the store blinks instead.
  if (blink(frame, 24)) {
    const here = game.screen === 'store' && game.room ? storeById(game.room.store.id) : null;
    const px = here ? sxOf(here.x + 40) : sxOf(w.player.x);
    const py = floorLine(here ? here.floor : Math.max(0, w.player.floor));
    g.fillStyle = NES.white;
    g.fillRect(Math.round(px) - 1, Math.round(py) - 7, 3, 3);
  }
  const legend: [string, string][] = [
    [NES.red, 'PACKAGE'],
    [NES.grey, 'CLEARED'],
    [NES.blue, 'POWER-UP'],
    [NES.ink, 'CLOSED'],
  ];
  legend.forEach(([col, text], i) => {
    const x = 8 + (i % 2) * 120;
    const y = 180 + Math.floor(i / 2) * 9;
    g.fillStyle = col;
    g.fillRect(x, y, 4, 4);
    drawText(g, text, x + 7, y, NES.silver, 1);
  });
  const inv = game.inventory.length ? game.inventory.join(', ') : 'NO JOKE ITEMS YET';
  wrap(`INVENTORY: ${inv}`, 38).slice(0, 2).forEach((l, i) => drawText(g, l, 8, 204 + i * 8, NES.gold, 1));
  drawCentered(g, 'SELECT TO CLOSE', 228, NES.dkgrey, 1);
}

export function drawPause(g: CanvasRenderingContext2D, frame: number): void {
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H);
  if (blink(frame, 40)) drawCentered(g, SHOP_LINES.pause, 110, NES.white, 2);
}

export function drawLevelClear(g: CanvasRenderingContext2D, a: Assets, game: Game, frame: number): void {
  const elapsed = (duration: number): number => Math.min(1, (duration - game.timer) / duration);
  if (game.phase === 'wagon') {
    g.fillStyle = NES.nightA;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = NES.dkgrey;
    g.fillRect(0, 150, SCREEN_W, 90);
    g.fillStyle = NES.silver;
    for (let x = 0; x < SCREEN_W; x += 64) g.fillRect(x + 10, 150, 8, 90);
    const t = elapsed(3 * SEC);
    const wx = 40 + t * 260;
    drawWagon(g, wx, 200);
    g.drawImage(a.canvas('spy_walkA'), Math.round(wx - 30), 176);
    g.fillStyle = NES.white;
    g.fillRect(Math.round(wx - 30), 166 + ((frame >> 3) % 2), 6, 4);
    drawCentered(g, SHOP_LINES.levelClear, 20, NES.yellow, 2);
    return;
  }
  if (game.phase === 'tally') {
    g.fillStyle = NES.nightB;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawCentered(g, SHOP_LINES.levelClear, 24, NES.yellow, 2);
    drawCentered(g, `PACKAGES  ${game.packagesFound} / 6`, 70, NES.white);
    drawCentered(g, `TIME BONUS  ${game.timeBonusDisplay}`, 86, NES.white);
    drawCentered(g, 'CLEAR BONUS  1000', 102, NES.white);
    drawCentered(g, SHOP_LINES.loop(game.loop), 130, NES.lime, 2);
    drawCentered(g, `SCORE ${String(game.score.points).padStart(6, '0')}`, 176, NES.white);
    return;
  }
  if (game.phase === 'headline') {
    g.fillStyle = NES.white;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = NES.ink;
    g.fillRect(0, 0, SCREEN_W, 2);
    drawCentered(g, 'THE DAILY MALL', 10, NES.ink, 2);
    g.fillRect(8, 32, SCREEN_W - 16, 1);
    const headline = game.headline.length ? game.headline : HEADLINES[0];
    headline.forEach((l, i) => drawCentered(g, l, 70 + i * 14, NES.ink, 1));
    drawCentered(g, 'LATE EDITION - PAGE 1', 180, NES.dkgrey);
    return;
  }
  if (game.lastSpygram) {
    g.fillStyle = NES.nightA;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const likes = Math.floor(elapsed(3 * SEC) * 4000);
    drawSelfie(g, a, game.lastSpygram, likes);
    void frame;
  }
}

export function drawContinue(g: CanvasRenderingContext2D, game: Game, frame: number): void {
  g.fillStyle = NES.ink;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  drawCentered(g, SHOP_LINES.continueQ, 60, NES.white, 2);
  const n = game.continueCount;
  const colour = n <= 3 ? (blink(frame, 30) ? NES.red : NES.redDk) : NES.yellow;
  drawCentered(g, String(n), 100, colour, 4);
  drawCentered(g, continuesLeft(game.continues), 170, NES.silver);
  drawCentered(g, 'START TO CONTINUE', 190, NES.white);
}

export function drawGameOver(g: CanvasRenderingContext2D, game: Game, frame: number): void {
  g.fillStyle = NES.nightA;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (game.gameOverPhase === 'closed') {
    // Typewriter message while the shutters roll down.
    const [l1, l2] = SHOP_LINES.mallClosed;
    const shown = Math.min(l1.length + l2.length, Math.floor((frame / 60) * 14));
    drawCentered(g, l1.slice(0, shown), 80, NES.white);
    drawCentered(g, shown > l1.length ? l2.slice(0, shown - l1.length) : '', 92, NES.white);
  } else {
    drawCentered(g, SHOP_LINES.gameOver, 70, NES.red, 2);
    drawCentered(g, `SCORE ${String(game.score.points).padStart(6, '0')}`, 110, NES.white);
    drawCentered(g, `HI ${String(game.highScore).padStart(6, '0')}`, 124, NES.yellow);
  }
  const shutter = Math.round(game.shutter * 120);
  g.fillStyle = NES.silver;
  g.fillRect(0, 0, SCREEN_W, shutter);
  g.fillRect(0, SCREEN_H - shutter, SCREEN_W, shutter);
}

export function drawFade(g: CanvasRenderingContext2D, alpha: number): void {
  if (alpha <= 0) return;
  g.fillStyle = `rgba(0,0,0,${Math.min(1, alpha)})`;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
}
