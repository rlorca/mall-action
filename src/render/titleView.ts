import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';
import { UI } from '../content/copy';
import { STORE_IDS, STORE_W } from '../content/stores';
import { drawStorefront, STOREFRONT_H } from '../art/storefront';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { TITLE_STORE_GAP, TITLE_STRIP_PERIOD } from '../game/screens/title';
import { blinkOn, drawTwoTone, hash01, pad6, H, W } from './screenFx';

/** What the title view reads from the TitleScreen. */
export interface TitleViewState {
  frame: number;
  hiScore: number;
  blackFriday: boolean;
  blackFridayFrames: number;
  scroll: number;
}

const SKY_BANDS = [C.BLACK, C.DKBLUE, C.DKBLUE, C.VIOLET, C.VIOLET, C.PURPLE0, C.PURPLE0, C.CRIMSON] as const;
const SKY_H = 176;
const STORE_Y = 176;
const PAVE_Y = STORE_Y + STOREFRONT_H;

function drawSky(fb: Framebuffer, frame: number): void {
  const bh = SKY_H / SKY_BANDS.length;
  SKY_BANDS.forEach((c, i) => {
    fb.fillRect(0, i * bh, W, bh, c);
    // two rows of checkerboard dither with the next colour blend the bands like an NES gradient
    const next = SKY_BANDS[i + 1];
    if (next !== undefined && next !== c) {
      fb.dither(0, (i + 1) * bh - 4, W, 2, next, 0);
      fb.dither(0, (i + 1) * bh - 2, W, 2, next, 1);
    }
  });
  // stars (twinkle)
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(hash01(i, 1) * W);
    const y = Math.floor(hash01(i, 2) * 118);
    const phase = Math.floor((frame + i * 13) / 24) % 4;
    const col = phase === 0 ? C.WHITE : phase === 1 ? C.PALEBLUE : phase === 2 ? C.LTGRAY : C.GRAY;
    fb.setPixel(x, y, col);
    if (i % 9 === 0 && phase < 2) {
      fb.setPixel(x - 1, y, C.GRAY);
      fb.setPixel(x + 1, y, C.GRAY);
      fb.setPixel(x, y - 1, C.GRAY);
      fb.setPixel(x, y + 1, C.GRAY);
    }
  }
  // moon with a bite taken out of it
  fb.fillCircle(226, 30, 10, C.PALEYELLOW);
  fb.fillCircle(231, 26, 8, C.VIOLET);
  fb.setPixel(222, 34, C.YELLOW);
  fb.setPixel(220, 29, C.YELLOW);
  // skyline
  let x = 0;
  for (let i = 0; x < W; i++) {
    const bw = 10 + Math.floor(hash01(i, 5) * 16);
    const bhgt = 6 + Math.floor(hash01(i, 6) * 14);
    fb.fillRect(x, SKY_H - bhgt, bw, bhgt, C.BLACK);
    for (let wy = SKY_H - bhgt + 3; wy < SKY_H - 3; wy += 5) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        if (hash01(wx, wy) > 0.55) fb.setPixel(wx, wy, hash01(wx, wy) > 0.9 ? C.WHITE : C.YELLOW);
      }
    }
    x += bw + 1 + Math.floor(hash01(i, 7) * 3);
  }
}

function drawLogo(fb: Framebuffer, frame: number): void {
  drawTwoTone(fb, 'MALL', W / 2, 12, { scale: 6, top: C.YELLOW, bottom: C.ORANGE, split: 4, outline: C.BLACK, shadow: C.BLACK, align: 'center' });
  drawTwoTone(fb, 'ACTION', W / 2, 60, { scale: 4, top: C.ORANGE, bottom: C.RED, split: 4, outline: C.BLACK, shadow: C.BLACK, align: 'center' });
  // a glint that sweeps over the logo now and then
  const t = frame % 180;
  if (t < 16) {
    const gx = 58 + Math.floor((t / 16) * 140);
    fb.pushClip(gx, 12, 5, 42);
    drawTwoTone(fb, 'MALL', W / 2, 12, { scale: 6, top: C.WHITE, bottom: C.PALEYELLOW, split: 4, align: 'center' });
    fb.popClip();
    fb.pushClip(gx - 6, 60, 5, 28);
    drawTwoTone(fb, 'ACTION', W / 2, 60, { scale: 4, top: C.PALEYELLOW, bottom: C.SALMON, split: 4, align: 'center' });
    fb.popClip();
  }
}

function drawBlackFriday(fb: Framebuffer, t: TitleViewState): void {
  const flash = Math.floor(t.blackFridayFrames / 6) % 3;
  const col = [C.YELLOW, C.WHITE, C.RED][flash]!;
  const col2 = [C.WHITE, C.YELLOW, C.WHITE][flash]!;
  fb.fillRect(28, 145, 200, 26, C.BLACK);
  fb.strokeRect(28, 145, 200, 26, col);
  drawText(fb, UI.blackFriday, W / 2, 149, col, { scale: 2, align: 'center' });
  drawText(fb, UI.blackFridayOff, W / 2, 161, col2, { align: 'center' });
}

function drawStoreRow(fb: Framebuffer, t: TitleViewState): void {
  // building wall behind the row + pavement
  fb.fillRect(0, STORE_Y - 3, W, STOREFRONT_H + 3, C.DKBLUE);
  fb.hLine(0, STORE_Y - 4, W, C.BLACK);
  const pitch = STORE_W + TITLE_STORE_GAP;
  const off = t.scroll;
  for (let rep = 0; rep < 2; rep++) {
    for (let k = 0; k < STORE_IDS.length; k++) {
      const x = k * pitch - off + rep * TITLE_STRIP_PERIOD;
      if (x >= W || x + STORE_W <= 0) continue;
      drawStorefront(fb, x, STORE_Y, STORE_IDS[k]!, { frame: t.frame, blackFriday: t.blackFriday });
    }
  }
  fb.fillRect(0, PAVE_Y, W, 8, C.MDGRAY);
  fb.hLine(0, PAVE_Y, W, C.LTGRAY);
  for (let x = -(off % 32); x < W; x += 32) fb.vLine(x, PAVE_Y + 1, 7, C.GRAY);
}

export function drawTitle(fb: Framebuffer, t: TitleViewState): void {
  drawSky(fb, t.frame);
  drawLogo(fb, t.frame);

  drawText(fb, UI.subtitle, W / 2, 91, C.PALEBLUE, { align: 'center', shadow: C.BLACK });

  const hi = `${SCREEN_TEXT.title.hiScore} `;
  const hiW = textWidth(hi + pad6(t.hiScore));
  const hx = Math.floor((W - hiW) / 2);
  drawText(fb, hi, hx, 105, C.YELLOW, { shadow: C.BLACK });
  drawText(fb, pad6(t.hiScore), hx + textWidth(hi), 105, C.WHITE, { shadow: C.BLACK });

  if (blinkOn(t.frame, 60, 38)) drawText(fb, UI.pressStart, W / 2, 119, C.WHITE, { scale: 2, align: 'center', shadow: C.MAROON });

  if (t.blackFriday) drawBlackFriday(fb, t);
  drawText(fb, UI.copyright, W / 2, 148, C.LTGRAY, { align: 'center', shadow: C.BLACK });

  drawStoreRow(fb, t);

  drawText(fb, UI.hint1, W / 2, H - 18, C.LTGRAY, { align: 'center' });
  drawText(fb, UI.hint2, W / 2, H - 10, C.GRAY, { align: 'center' });
}
