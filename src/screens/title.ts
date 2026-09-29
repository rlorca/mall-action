// Title screen: state (Konami detection, Start) + drawing.
import { C, SCREEN_W } from '../core/palette';
import type { EventSink } from '../core/events';
import type { PadFrame } from '../core/pad';
import { BUTTON_NAMES } from '../core/pad';
import { KonamiDetector } from '../core/konami';
import { MISC } from '../data/copy';
import type { Surface } from '../art/surface';
import { drawNightSky } from '../art/backdrops';
import { LOGO_H, drawStorefrontRow, drawTitleLogo } from '../art/logo';
import { STOREFRONT_H } from '../game/geometry';
import { blinkOn, pad6 } from './util';

/** Frames the big flashing BLACK FRIDAY banner stays up after the code; then only the small marker remains. */
export const BF_BANNER_FRAMES = 150;

export class TitleState {
  frame = 0;
  startRequested = false;
  blackFriday = false;
  /** Frames since the Konami code completed (-1 = not entered). */
  bfFrame = -1;
  private konami = new KonamiDetector();

  constructor(readonly highScore: number) {}

  update(pad: PadFrame, sink: EventSink): void {
    if (this.frame === 0) sink.push({ t: 'music', name: 'title' });
    this.frame++;
    if (this.bfFrame >= 0) this.bfFrame++;
    for (const b of BUTTON_NAMES) {
      if (!pad.pressed[b]) continue;
      if (b === 'start') {
        if (!this.startRequested) {
          this.startRequested = true;
          sink.push({ t: 'sfx', name: 'select' });
        }
        continue;
      }
      if (this.konami.feed(b)) {
        this.blackFriday = true;
        this.bfFrame = 0;
        sink.push({ t: 'sfx', name: 'powerup' });
      }
    }
  }
}

const SCROLL_Y = 172;

export function drawTitle(s: Surface, st: TitleState): void {
  const f = st.frame;
  drawNightSky(s, 0, 0, SCREEN_W, 240, f);
  // hi-score
  s.text(`HI-SCORE ${pad6(st.highScore)}`, 128, 6, C.WHITE, { align: 'center', shadow: C.BLACK });
  // logo
  drawTitleLogo(s, 128, 24, f);
  const logoBottom = 24 + LOGO_H;
  s.text(MISC.subtitle, 128, logoBottom + 8, C.YELLOW_L, { align: 'center', shadow: C.BLACK });
  // press start
  if (blinkOn(f, 48)) s.text('PRESS START', 128, logoBottom + 30, C.WHITE, { align: 'center', shadow: C.BLACK });
  // black friday banner / marker
  if (st.blackFriday) drawBlackFriday(s, st, logoBottom + 46);
  // copyright
  s.text(MISC.copyright, 128, SCROLL_Y - 14, C.GRAY_L, { align: 'center', shadow: C.BLACK });
  // storefront row
  drawStorefrontRow(s, SCROLL_Y, f * 0.5, f, st.blackFriday);
  // control hints on a dark band
  const hy = SCROLL_Y + STOREFRONT_H;
  s.rect(0, hy, SCREEN_W, 240 - hy, C.BLACK);
  s.hline(0, hy, SCREEN_W, C.GRAY_D);
  s.text('ARROWS MOVE  Z SHOOT  X JUMP', 128, hy + 6, C.GRAY_L, { align: 'center' });
  s.text('SEL=MAP  ENTER=START  C=CRT', 128, hy + 16, C.GRAY_L, { align: 'center' });
  // flash overlay just after the code
  if (st.bfFrame >= 0 && st.bfFrame < 36 && (st.bfFrame >> 2) % 2 === 0) {
    s.setAlpha(0.45);
    s.rect(0, 0, SCREEN_W, 240, C.WHITE);
    s.setAlpha(1);
  }
}

function drawBlackFriday(s: Surface, st: TitleState, y: number): void {
  const bf = st.bfFrame;
  if (bf < BF_BANNER_FRAMES) {
    const a = (bf >> 2) % 2 === 0;
    s.rect(24, y - 3, 208, 26, C.BLACK);
    s.frame(24, y - 3, 208, 26, a ? C.RED_L : C.YELLOW);
    s.text(MISC.blackFriday[0], 128, y + 1, a ? C.YELLOW_L : C.WHITE, { align: 'center' });
    s.text(MISC.blackFriday[1], 128, y + 12, a ? C.WHITE : C.RED_L, { align: 'center' });
  } else {
    s.text('BLACK FRIDAY MODE', 128, y + 6, blinkOn(bf, 40) ? C.RED_L : C.YELLOW_L, { align: 'center', shadow: C.BLACK });
  }
}
