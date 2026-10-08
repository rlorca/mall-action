import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import type { Game } from '../game/game';
import type { Level } from '../game/level';
import { drawHud } from './hud';
import { drawMall, type MallDrawHooks } from './mallView';
import { drawMapView } from './mapView';
import { drawPauseOverlay } from './pauseView';
import { drawTitle } from './titleView';
import { drawLevelClear } from './levelClearView';
import { drawContinue } from './continueView';
import { drawGameOver } from './gameOverView';
import { drawStoreView } from './storeView';
import { drawMallActors, drawMallFurniture } from './mallActorsView';

const HOOKS: MallDrawHooks = { furniture: drawMallFurniture, actors: drawMallActors };

function drawLevel(fb: Framebuffer, lv: Level): void {
  if (lv.overlay === 'map') {
    drawMapView(fb, lv.mapData());
  } else {
    if (lv.store) drawStoreView(fb, lv.store, lv.frame);
    else drawMall(fb, lv, lv.frame, HOOKS);
    drawHud(fb, lv.hud());
    if (lv.overlay === 'pause') drawPauseOverlay(fb, lv.frame);
  }
  const steps = lv.fadeSteps();
  if (steps > 0) fb.darkenAll(steps);
}

/** Draw whatever scene the game is in into the framebuffer. Rendering never mutates the game. */
export function renderGame(fb: Framebuffer, game: Game): void {
  fb.resetClip();
  fb.clear(C.BLACK);
  switch (game.scene) {
    case 'splash':
      game.splash!.draw(fb);
      break;
    case 'title':
      drawTitle(fb, game.title!);
      break;
    case 'level':
      drawLevel(fb, game.level!);
      break;
    case 'clear':
      drawLevelClear(fb, game.clear!);
      break;
    case 'continue':
      drawContinue(fb, game.cont!);
      break;
    case 'gameover':
      drawGameOver(fb, game.over!);
      break;
  }
}
