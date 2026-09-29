/** Renders one frame of the game state into the 256x240 buffer. Reads state only. */
import { C } from '../core/palette';
import { drawSplash } from '../splash/draw';
import type { GameState } from '../game/state';
import { Gfx, HUD_H, SCREEN_W } from './gfx';
import { drawMall } from './draw_mall';
import { drawStore } from './draw_store';
import {
  drawContinue, drawGameOver, drawHud, drawLevelClear, drawMap, drawPause, drawPlayOverlays, drawTitle,
} from './screens';

export interface Toast {
  text: string;
  t: number;
}

export function render(gx: Gfx, g: GameState, toast: Toast | null): void {
  switch (g.scene) {
    case 'splash':
      drawSplash(gx.ctx, g.splash);
      break;
    case 'title':
      drawTitle(gx, g);
      break;
    case 'mall':
      gx.clear(C.BLACK);
      drawMall(gx, g, g.level!);
      drawPlayOverlays(gx, g);
      drawHud(gx, g);
      break;
    case 'store':
      gx.clear(C.BLACK);
      drawStore(gx, g, g.level!);
      drawPlayOverlays(gx, g);
      drawHud(gx, g);
      break;
    case 'levelclear':
      gx.clear(C.BLACK);
      drawLevelClear(gx, g);
      drawHud(gx, g);
      break;
    case 'continue':
      gx.clear(C.BLACK);
      drawContinue(gx, g);
      drawHud(gx, g);
      break;
    case 'gameover':
      gx.clear(C.BLACK);
      drawGameOver(gx, g);
      drawHud(gx, g);
      break;
  }
  if (g.overlay === 'map') drawMap(gx, g);
  else if (g.overlay === 'pause') drawPause(gx, g);
  if (g.fade) {
    const f = g.fade;
    const half = f.total / 2;
    const k = f.t < half ? f.t / half : (f.total - f.t) / half;
    gx.dim(0, 0, SCREEN_W, 240, Math.max(0, Math.min(1, k)));
  }
  if (toast && toast.t > 0) {
    const w = toast.text.length * 6 + 8;
    gx.rect(4, HUD_H + 4, w, 12, C.BLACK);
    gx.frame(4, HUD_H + 4, w, 12, C.WHITE);
    gx.text(toast.text, 8, HUD_H + 6, C.WHITE);
  }
}
