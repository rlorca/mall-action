import { Gfx } from './gfx';
import { Game } from '../core/game';
import { MallView, drawMall, drawBanner, makeCam } from './mall-render';
import { drawStore } from './store-render';
import { drawHud } from './hud';
import { floorAt, HUD_H } from '../core/level';
import { FLOOR_NAMES, MISC } from '../core/copy';
import { drawClear, drawClosingMessage, drawContinue, drawGameOverFinal, drawMap, drawPauseOverlay, drawSpygram, drawSplash, drawTitle, drawSchematic } from './screens';
import { FADE_FRAMES } from '../core/game';
import { GameEvent } from '../core/events';
import { remainingPackageStores } from '../core/levelsetup';

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  space: 'mall' | 'screen';
}

/** All screen drawing lives here: reads the game state, never changes it. */
export class FrameRenderer {
  view = new MallView();
  popups: Popup[] = [];
  toast: { text: string; life: number } | null = null;
  /** The 4-frame photo strip that pops up the first time the agent leaves the photo booth. */
  strip: { t: number } | null = null;
  frame = 0;

  constructor(readonly g: Gfx) {}

  showToast(text: string, life = 100): void {
    this.toast = { text, life };
  }

  /** Feed events that matter to the picture (score popups). */
  onEvents(events: GameEvent[]): void {
    for (const e of events) {
      if (e.kind === 'popup') this.popups.push({ x: e.x, y: e.y, text: e.text, life: 60, space: e.space });
      if (e.kind === 'photoStrip') this.strip = { t: 0 };
    }
  }

  draw(game: Game): void {
    const g = this.g;
    this.frame++;
    const f = this.frame;
    switch (game.screen) {
      case 'splash':
        drawSplash(g, game);
        break;
      case 'title':
        drawTitle(g, game, f);
        break;
      case 'mall':
        this.drawPlay(game, 'mall', f);
        break;
      case 'store':
        this.drawPlay(game, 'store', f);
        break;
      case 'map':
        if (game.mall) drawMap(g, game.mall, f);
        break;
      case 'pause':
        this.drawPlay(game, game.under === 'store' ? 'store' : 'mall', f);
        drawPauseOverlay(g, f);
        break;
      case 'clear':
        drawClear(g, game, f);
        break;
      case 'continue':
        drawContinue(g, game, f);
        break;
      case 'gameover':
        if (game.over!.phase === 'pa') {
          this.view.tick(game.mall!);
          drawMall(g, game.mall!, this.view, { shuttersAmount: game.over!.shutters });
          drawHud(g, game.run!, { frame: f, floor: game.mall!.currentFloor(), alarm: false });
          drawClosingMessage(g, game);
        } else drawGameOverFinal(g, game, f);
        break;
    }
    this.drawPopups(game);
    this.drawStrip();
    if (game.fade) {
      const t = game.fade.phase === 'out' ? game.fade.t / FADE_FRAMES : 1 - game.fade.t / FADE_FRAMES;
      g.dim(0, 0, 256, 240, Math.max(0, Math.min(1, t)));
    }
    if (this.toast) {
      const w = g.measure(this.toast.text) + 10;
      const x = Math.floor((256 - w) / 2);
      g.rect(x, 226, w, 12, 0x0f);
      g.box(x, 226, w, 12, 0x30);
      g.text(this.toast.text, 128, 229, 0x28, { align: 'center' });
      if (--this.toast.life <= 0) this.toast = null;
    }
  }

  private drawPlay(game: Game, which: 'mall' | 'store', f: number): void {
    const g = this.g;
    const run = game.run;
    if (!run) return;
    if (which === 'store' && game.store) {
      drawStore(g, game.store, f);
      drawHud(g, run, { frame: f, marquee: game.store.info.longName, alarm: game.mall?.alarm ?? false });
      return;
    }
    const mall = game.mall!;
    if (game.screen === 'mall' || game.screen === 'pause') this.view.tick(mall);
    drawMall(g, mall, this.view);
    drawBanner(g, mall);
    const p = mall.p;
    drawHud(g, run, {
      frame: f,
      floor: mall.currentFloor(),
      arrow: p.mode === 'car' || p.onRoof ? (mall.cars[p.carIdx]?.moving ? (mall.cars[p.carIdx].dir as -1 | 1) : 0) : 0,
      alarm: mall.alarm,
    });
    // arrival: phone flash, then the SPYGRAM selfie post
    if (p.mode === 'selfie') {
      if (p.timer < 12) g.dim(0, 0, 256, 240, 0); // placeholder to keep calls simple
      if (p.timer < 14) g.veil(0x30, 1 - p.timer / 14);
      else drawSpygram(g, mall.post, p.timer - 14, 'roof', f);
      if (p.timer > 40 && (f >> 4) % 2 === 0) g.text('PRESS ANY BUTTON', 128, 226, 0x30, { align: 'center', font: 3 });
    }
    // kiosk map panel
    if (mall.kioskPanel) {
      const kp = mall.kioskPanel;
      g.rect(36, 70, 184, 108, 0x0f);
      g.box(36, 70, 184, 108, 0x30);
      g.rect(37, 71, 182, 10, 0x02);
      g.text('DIRECTORY', 128, 73, 0x30, { align: 'center', font: 3 });
      drawSchematic(g, mall, { x0: 56, y0: 88, w: 150, rowH: 14, labels: false, highlight: kp.store, blink: (f >> 3) % 2 === 0, radar: false });
      g.text(kp.store ? 'NEAREST PACKAGE: FLASHING' : 'ALL PACKAGES FOUND - GO TO P!', 128, 170, 0x28, { align: 'center', font: 3 });
    }
    // camera helpers for popups
    void makeCam;
    void floorAt;
    void HUD_H;
    void FLOOR_NAMES;
    void MISC;
    void remainingPackageStores;
  }

  private drawStrip(): void {
    const s = this.strip;
    if (!s) return;
    const g = this.g;
    s.t++;
    if (s.t > 220) {
      this.strip = null;
      return;
    }
    // pops up from below, waits, slides away
    const rise = Math.min(1, s.t / 14);
    const fall = s.t > 190 ? (s.t - 190) / 30 : 0;
    const y = Math.floor(240 - (240 - 116) * rise * (1 - fall));
    const x = 214;
    g.rect(x - 2, y - 2, 36, 108, 0x0f);
    g.rect(x, y, 32, 104, 0x30);
    const poses = ['agent.stand', 'agent.shoot', 'agent.jump', 'agent.duckshoot'];
    poses.forEach((p, i) => {
      g.rect(x + 3, y + 3 + i * 25, 26, 22, 0x02);
      g.sprite(p, 0, x + 8, y + 2 + i * 25);
    });
    if (s.t > 14) g.text('PHOTO STRIP', x + 16, y + 106, 0x28, { font: 3, align: 'center' });
  }

  private drawPopups(game: Game): void {
    const g = this.g;
    const cam = game.mall?.cam ?? { x: 0, y: 0 };
    for (const p of this.popups) p.life--;
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const p of this.popups) {
      const rise = (60 - p.life) * 0.4;
      const x = p.space === 'mall' ? p.x - cam.x : p.x;
      const y = (p.space === 'mall' ? p.y - cam.y + HUD_H : p.y) - rise;
      if (game.screen !== 'mall' && game.screen !== 'store' && game.screen !== 'pause') continue;
      if (game.screen === 'store' && p.space === 'mall') continue;
      g.text(p.text, x, y, p.text.startsWith('-') ? 0x16 : 0x28, { align: 'center', shadow: 0x0f });
    }
  }
}
