import { FADE_FRAMES, HUD_H, SCREEN_H, SCREEN_W, VIEW_H } from '../core/constants';
import { drawSplash, newSplash, stepSplash, type SplashState } from '../flickersoft/splash';
import type { GameState } from '../core/types';
import { FONT, TINY, drawTextCentered } from './font';
import { C, RAINBOW } from './palette';
import { Framebuffer } from './pixels';
import { drawBanner, drawMall, drawMallEphemera } from './mallScene';
import { drawStore } from './storeScene';
import {
  drawContinue,
  drawGameOver,
  drawHud,
  drawKioskPanel,
  drawLevelClear,
  drawMap,
  drawNews,
  drawPause,
  drawSpygram,
  drawTitle,
} from './uiScene';

/**
 * Draws the whole screen from game state. It reads state and nothing else:
 * no rules run here, and the rules never call into this file.
 */
export class Renderer {
  readonly fb = new Framebuffer(SCREEN_W, SCREEN_H);
  /** Free-running animation clock, so idle animation continues while paused. */
  clock = 0;
  splash: SplashState = newSplash();
  private shakeFrames = 0;
  private shakePower = 0;
  private flashFrames = 0;

  shake(frames: number, power: number): void {
    this.shakeFrames = Math.max(this.shakeFrames, frames);
    this.shakePower = Math.max(this.shakePower, power);
  }

  flash(frames: number): void {
    this.flashFrames = Math.max(this.flashFrames, frames);
  }

  /** Advance presentation-only animation. Called once per simulation step. */
  tick(g: GameState, anyPressed: boolean): { playJingle: boolean; splashDone: boolean } {
    this.clock++;
    if (this.shakeFrames > 0) this.shakeFrames--;
    if (this.flashFrames > 0) this.flashFrames--;
    if (g.screen === 'splash') {
      const r = stepSplash(this.splash, anyPressed);
      return { playJingle: r.playJingle, splashDone: r.finished };
    }
    return { playJingle: false, splashDone: false };
  }

  draw(g: GameState): Framebuffer {
    const fb = this.fb;
    fb.clearClip();
    fb.clear(C.BLACK);

    const shakeX = this.shakeFrames > 0 ? ((this.clock % 2) * 2 - 1) * this.shakePower : 0;
    const shakeY = this.shakeFrames > 0 ? ((Math.floor(this.clock / 2) % 2) * 2 - 1) * this.shakePower : 0;

    switch (g.screen) {
      case 'splash':
        drawSplash(fb, FONT, this.splash, { black: C.BLACK, rainbow: RAINBOW, accent: C.WHITE }, SCREEN_W, SCREEN_H);
        break;

      case 'title':
        drawTitle(fb, g, this.clock);
        break;

      case 'mall': {
        const ctx = { camX: g.mall.camX + shakeX, camY: g.mall.camY + shakeY, clock: this.clock };
        drawMall(fb, g, ctx);
        drawMallEphemera(fb, g, ctx);
        for (const b of g.mall.banners) drawBanner(fb, b.lines, b.kind);
        if (g.mall.kioskPanel > 0) drawKioskPanel(fb, g, this.clock);
        drawHud(fb, g, this.clock);
        if (g.spygram) drawSpygram(fb, g, this.clock, true);
        break;
      }

      case 'store':
        drawStore(fb, g, this.clock);
        for (const b of g.store?.banners ?? []) drawBanner(fb, b.lines, b.kind);
        drawHud(fb, g, this.clock);
        break;

      case 'levelClear':
        drawLevelClear(fb, g, this.clock);
        break;

      case 'news':
        drawNews(fb, g, this.clock);
        break;

      case 'spygram':
        drawSpygram(fb, g, this.clock, false);
        break;

      case 'continue':
        drawContinue(fb, g, this.clock);
        break;

      case 'gameOver':
        drawGameOver(fb, g, this.clock);
        break;
    }

    // Overlays sit above the scene but below the fade.
    if (g.overlay === 'map') drawMap(fb, g, this.clock);
    else if (g.overlay === 'pause') drawPause(fb, this.clock);

    if (this.flashFrames > 0) {
      // A camera flash: one near-solid white frame, then it thins out fast.
      // Never a persistent overlay - it must not bury the scene underneath.
      fb.darken(0, 0, SCREEN_W, SCREEN_H, C.WHITE, this.flashFrames > 3 ? 1 : 4);
    }

    if (g.fade > 0) fadeOverlay(fb, g.fade / FADE_FRAMES);

    if (g.toast) {
      drawToast(fb, g.toast.text);
    }

    return fb;
  }
}

/** A dithered fade to black. At amount >= 1 the screen is fully black. */
function fadeOverlay(fb: Framebuffer, amount: number): void {
  fb.clearClip();
  if (amount >= 0.99) {
    fb.clear(C.BLACK);
    return;
  }
  // Four ordered-dither levels, so the fade reads as an NES fade rather than
  // an alpha blend the hardware could not do.
  const level = Math.min(3, Math.floor(amount * 4));
  const patterns = [
    [[0, 0]],
    [
      [0, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [2, 1],
      [1, 0],
      [3, 1],
    ],
    [],
  ];
  if (level >= 3) {
    fb.darken(0, 0, SCREEN_W, SCREEN_H, C.BLACK, 1);
    return;
  }
  const pat = patterns[level];
  for (let y = 0; y < SCREEN_H; y++) {
    for (let x = 0; x < SCREEN_W; x++) {
      for (const [px, py] of pat) {
        if (x % 4 === px && y % 2 === py) {
          fb.px(x, y, C.BLACK);
          break;
        }
      }
    }
  }
}

/** The "CRT ON" / "SOUND OFF" style confirmation. */
function drawToast(fb: Framebuffer, text: string): void {
  fb.clearClip();
  const w = 96;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = HUD_H + VIEW_H - 28;
  fb.rect(x, y, w, 14, C.BLACK);
  fb.frame(x, y, w, 14, C.WHITE);
  drawTextCentered(fb, FONT, text, SCREEN_W / 2, y + 4, C.PALEYELLOW);
  void TINY;
}
