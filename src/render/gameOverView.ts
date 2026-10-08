import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';
import { UI } from '../content/copy';
import type { StoreId } from '../content/stores';
import { drawStorefront, STOREFRONT_H } from '../art/storefront';
import { GO_FLOORS } from '../game/screens/gameover';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { blinkOn, drawSpriteByName, pad6, H, W } from './screenFx';

/** What the view reads from the GameOverScreen. */
export interface GameOverViewState {
  frame: number;
  line1: string;
  line2: string;
  shutter(floor: number): number;
  showGameOver: boolean;
  score: number;
  hiScore: number;
  newRecord: boolean;
}

/** Three floors of three storefronts, drawn on the real floor pitch (48 px). */
const ROWS: ReadonlyArray<readonly StoreId[]> = [
  ['forever12', 'radioshock', 'crookstone'],
  ['kgbtoys', 'spenders', 'hotspy'],
  ['footlock', 'gamestonk', 'sambaddy'],
];
const FLOOR_Y = [88, 136, 184] as const;

/** One rolling shutter covering the top `frac` of a storefront row: ribbed slats and a bottom bar with a handle. */
function drawShutter(fb: Framebuffer, y: number, frac: number): void {
  const h = Math.round(frac * STOREFRONT_H);
  if (h <= 0) return;
  for (let r = 0; r < h; r++) {
    const band = r % 4;
    const c = band === 0 ? C.LTGRAY : band === 3 ? C.MDGRAY : C.GRAY;
    fb.hLine(0, y + r, W, c);
  }
  // guide rails
  for (let x = 0; x < W; x += 80) {
    fb.vLine(x, y, h, C.BLACK);
    fb.vLine(x + 1, y, h, C.MDGRAY);
  }
  // bottom bar and handle
  fb.fillRect(0, y + h - 2, W, 2, C.BLACK);
  if (h >= 4) {
    for (let x = 40; x < W; x += 80) {
      fb.fillRect(x - 3, y + h - 3, 7, 3, C.LTGRAY);
      fb.hLine(x - 3, y + h - 1, 7, C.BLACK);
    }
  }
}

export function drawGameOver(fb: Framebuffer, s: GameOverViewState): void {
  fb.clear(C.BLACK);
  // interior wall + slabs
  fb.fillRect(0, FLOOR_Y[0] - STOREFRONT_H - 4, W, FLOOR_Y[2] + 8 - (FLOOR_Y[0] - STOREFRONT_H - 4), C.DKBLUE);
  // polished concourse floor under the last row
  fb.fillRect(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, C.DKBLUE);
  fb.dither(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, C.BLACK);

  for (let f = 0; f < GO_FLOORS; f++) {
    const fy = FLOOR_Y[f]!;
    ROWS[f]!.forEach((id, i) => drawStorefront(fb, 8 + i * 80, fy - STOREFRONT_H, id, { frame: s.frame }));
    fb.fillRect(0, fy, W, 8, C.MDGRAY);
    fb.hLine(0, fy, W, C.LTGRAY);
    fb.hLine(0, fy + 7, W, C.BLACK);
  }

  // the agent, standing on the ground floor in front of the middle store, looking at us
  drawSpriteByName(fb, 'agent.ride', 120, FLOOR_Y[2]! - 24, {});

  for (let f = 0; f < GO_FLOORS; f++) drawShutter(fb, FLOOR_Y[f]! - STOREFRONT_H, s.shutter(f));

  // PA plate with the typewriter text
  fb.fillRect(16, 6, W - 32, 34, C.BLACK);
  fb.strokeRect(16, 6, W - 32, 34, C.WHITE);
  fb.strokeRect(18, 8, W - 36, 30, C.MDGRAY);
  const cursorOn = blinkOn(s.frame, 20, 12);
  drawText(fb, s.line1, 28, 13, C.YELLOW);
  const done1 = s.line1.length === UI.closedLine1.length;
  if (!done1 && cursorOn) fb.fillRect(28 + textWidth(s.line1) + 1, 13, 5, 7, C.YELLOW);
  drawText(fb, s.line2, 28, 25, C.WHITE);
  if (done1 && s.line2.length < UI.closedLine2.length && cursorOn) fb.fillRect(28 + textWidth(s.line2) + 1, 25, 5, 7, C.WHITE);

  if (s.showGameOver) {
    fb.fillRect(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, C.BLACK);
    drawText(fb, UI.gameOver, W / 2, 196, C.RED, { scale: 3, align: 'center', shadow: C.MAROON });
    const g = SCREEN_TEXT.gameOver;
    const a = `${g.score} `;
    const b = `${g.hiScore} `;
    const total = textWidth(a + pad6(s.score)) + 14 + textWidth(b + pad6(s.hiScore));
    let x = Math.floor((W - total) / 2);
    drawText(fb, a, x, 221, C.YELLOW);
    x += textWidth(a);
    drawText(fb, pad6(s.score), x, 221, C.WHITE);
    x += textWidth(pad6(s.score)) + 14;
    drawText(fb, b, x, 221, C.CYAN);
    x += textWidth(b);
    drawText(fb, pad6(s.hiScore), x, 221, C.WHITE);
    if (s.newRecord && blinkOn(s.frame, 30, 20)) drawText(fb, g.newRecord, W / 2, 231, C.YELLOW, { align: 'center' });
  }
}
