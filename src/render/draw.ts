/** Render dispatcher: draws the whole frame from the game state. Never mutates the game. */
import { Fb } from '../gfx/fb';
import { S } from '../gfx/sprites';
import type { Game } from '../game/types';
import { ARRIVAL_POSTS } from '../game/copy';
import { TRANS_FRAMES } from '../game/game';
import { drawMall } from './mallView';
import { drawStore } from './storeView';
import { drawHud, drawSpygram } from './ui';
import { drawClear, drawContinue, drawGameOver, drawMap, drawPause, drawSplashScreen, drawTitle } from './screens';

export function drawGame(fb: Fb, g: Game): void {
  fb.noClip();
  switch (g.screen) {
    case 'splash': drawSplashScreen(fb, g); return;
    case 'title': drawTitle(fb, g); return;
    case 'clear': drawClear(fb, g); return;
    case 'continue': drawContinue(fb, g); return;
    case 'gameover': drawGameOver(fb, g); return;
    case 'play': break;
  }
  const L = g.level!;
  if (g.overlay === 'map') { drawMap(fb, g); return; }
  if (L.mode === 'store' && L.room) drawStore(fb, g);
  else drawMall(fb, g);
  fb.noClip();
  drawHud(fb, g);
  if (L.mode === 'selfie' && L.selfie && L.selfie.t >= 8) {
    // the arrival SPYGRAM selfie; the like counter climbs quickly
    drawSpygram(fb, ARRIVAL_POSTS[L.selfie.post], Math.min(99999, (L.selfie.t - 8) * 37), 96, (x, y, w, h) => {
      fb.rect(x, y, w, h, 0x04);
      fb.rect(x, y + h - 14, w, 14, 0x15);
      fb.rect(x, y + h - 5, w, 5, 0x00);
      for (let i = 0; i < 9; i++) fb.rect(x + 4 + i * 19, y + h - 12 - ((i * 7) % 9), 12, 12, 0x0f);
      fb.spr(S('ag_selfie'), x + w / 2 - 8, y + h - 27);
    });
  }
  // fades between scenes: NES-style palette darkening
  if (L.trans) {
    const half = TRANS_FRAMES / 2;
    const k = 1 - Math.abs(L.trans.t - half) / half;
    fb.shade(0, 16, 256, 224, Math.min(4, Math.round(k * 4)));
  }
  if (g.overlay === 'pause') drawPause(fb, g);
}
