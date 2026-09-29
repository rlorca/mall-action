// App wiring: Session + Overlay + audio routing + drawing. No DOM lookups here (main.ts owns those), so it stays
// easy to reason about: simStep() advances one 60 Hz frame; draw() paints the whole 256x240 frame.
import type { AudioApi } from './audio';
import { PadTracker, type Buttons } from './core/pad';
import { EventBuffer } from './core/events';
import { C, HUD_H, SCREEN_H, SCREEN_W } from './core/palette';
import { Surface } from './art/surface';
import { Session } from './game/session';
import { drawHud } from './render/hud';
import { drawMall } from './render/mallView';
import { drawFade, Overlay } from './render/overlay';
import { drawStore } from './render/storeView';
import { drawContinue, drawGameOver, drawLevelClear, drawMap, drawPause, drawTitle } from './screens';

export interface AppOptions {
  seed: number;
  highScore: number;
  skipSplash: boolean;
  onHighScore?: (n: number) => void;
}

export class App {
  readonly session: Session;
  readonly overlay = new Overlay();
  readonly surface: Surface;
  audio: AudioApi | null = null;
  private readonly pads = new PadTracker();
  private readonly buf = new EventBuffer();
  private lastMall: unknown = null;
  private lastScene = '';
  /** Set by main when ?input=1: returns per-source pad state to draw. */
  inputProbe: (() => { k: Partial<Buttons>; g: Partial<Buttons>; pads: number }) | null = null;

  constructor(opts: AppOptions, surface?: Surface) {
    this.session = new Session({ seed: opts.seed, highScore: opts.highScore, skipSplash: opts.skipSplash, onHighScore: opts.onHighScore });
    this.surface = surface ?? new Surface(SCREEN_W, SCREEN_H);
  }

  /** One simulation frame with these buttons held. `withAudio=false` for the debug stepper. */
  simStep(held: Partial<Buttons>, withAudio = true): void {
    const s = this.session;
    const audio = withAudio ? this.audio : null;
    s.step(this.pads.next(held), this.buf);
    // Fresh game / fresh level: drop leftover banners and popups.
    if (s.mall !== this.lastMall || (s.scene !== this.lastScene && s.scene === 'title')) {
      if (s.mall !== this.lastMall && s.mall) this.overlay.reset();
      this.lastMall = s.mall;
    }
    this.lastScene = s.scene;
    for (const ev of this.buf.drain()) {
      this.overlay.handle(ev);
      audio?.handleEvent(ev);
    }
    this.overlay.update();
    if (audio) {
      audio.setMusicDuck(s.duck);
      const playing = s.scene === 'play' && !s.frozen && s.playMode === 'mall';
      audio.hum(playing && !!s.mall?.s.rideHum);
    }
  }

  /** Paint the current frame into the surface. */
  draw(): void {
    const s = this.session;
    const sf = this.surface;
    const ov = this.overlay;
    switch (s.scene) {
      case 'splash':
        s.splash.draw(sf.ctx);
        ov.draw(sf, { x: 0, y: 0 });
        break;
      case 'title':
        if (s.title) drawTitle(sf, s.title);
        ov.draw(sf, { x: 0, y: 0 });
        break;
      case 'play':
        this.drawPlay();
        break;
      case 'levelclear':
        if (s.levelClear) drawLevelClear(sf, s.levelClear);
        ov.draw(sf, { x: 0, y: 0 });
        break;
      case 'continue':
        if (s.continueState) drawContinue(sf, s.continueState);
        ov.draw(sf, { x: 0, y: 0 });
        break;
      case 'gameover':
        if (s.gameOver) drawGameOver(sf, s.gameOver);
        ov.draw(sf, { x: 0, y: 0 });
        break;
    }
    if (s.fade > 0) {
      drawFade(sf, s.fade);
      // Toasts (CRT / SOUND) stay readable through the fade.
      if (s.scene !== 'play') ov.draw(sf, { x: 0, y: 0 });
    }
  }

  private drawPlay(): void {
    const s = this.session;
    const sf = this.surface;
    const ov = this.overlay;
    const store = s.playMode === 'store' ? s.store : null;
    const mall = s.mall;
    let cam = { x: 0, y: 0 };
    if (store) {
      drawStore(sf, store, s.tick);
      cam = store.camera;
    } else if (mall) {
      drawMall(sf, mall, s.tick);
      cam = mall.s.camera;
    } else {
      sf.clear(C.BLACK);
    }
    // Screen shake: shift the finished playfield by whole pixels (edges just repeat the neighbouring pixels).
    const sh = ov.shakeOffset();
    const dx = Math.round(sh.x);
    const dy = Math.round(sh.y);
    if (dx !== 0 || dy !== 0) {
      const ctx = sf.ctx;
      ctx.drawImage(sf.canvas, 0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, dx, HUD_H + dy, SCREEN_W, SCREEN_H - HUD_H);
    }
    const covered = s.mapOpen || s.paused;
    if (!covered) ov.draw(sf, cam);
    drawHud(sf, s.hudModel());
    const fa = ov.flashAlpha();
    if (fa > 0) {
      const ctx = sf.ctx;
      ctx.globalAlpha = Math.min(1, fa);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H);
      ctx.globalAlpha = 1;
    }
    if (s.mapOpen && mall) drawMap(sf, mall.mapSnapshot(), { progress: s.progress, inStore: s.inStore, tick: s.tick });
    if (s.paused) drawPause(sf, s.tick);
    // Banners, popups and toasts stay on top of the map / pause screens (toasts must always be readable).
    if (covered) ov.draw(sf, cam);
  }

  /** ?input=1 diagnostic: eight pad boxes, lit by keyboard (K, yellow) or gamepad (G, red). Always on top. */
  drawInputProbe(): void {
    if (!this.inputProbe) return;
    const { k, g, pads } = this.inputProbe();
    const sf = this.surface;
    const names = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'] as const;
    const labels = ['U', 'D', 'L', 'R', 'A', 'B', 'S', 'T'];
    sf.rect(0, 224, 256, 16, 0x0f);
    for (let i = 0; i < 8; i++) {
      const x = 2 + i * 20;
      const col = g[names[i]] ? 0x16 : k[names[i]] ? 0x28 : 0x00;
      sf.rect(x, 226, 18, 12, col);
      sf.text(labels[i], x + 5, 228, g[names[i]] || k[names[i]] ? 0x0f : 0x30);
    }
    sf.text(`PADS:${pads}`, 168, 228, pads ? 0x16 : 0x30);
  }
}
