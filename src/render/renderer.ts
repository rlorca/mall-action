// Draws one frame of the game into a 256x240 buffer. Reads game state; keeps only visual effects
// of its own (score popups, screen shake), which it fills from the game's outbox.
import { FLOOR_NAMES, HUD_H, SCREEN_H, SCREEN_W, SEC } from '../core/constants';
import { NES } from '../core/palette';
import { DURATION, POWERUP_NAMES } from '../core/powerups';
import type { Game, GameOutput } from '../core/game';
import { Assets } from './assets';
import { drawText, drawCentered, textWidth, wrap } from './text';
import { drawArrival, drawMall } from './mall-view';
import { drawStoreRoom } from './store-view';
import { drawContinue, drawFade, drawGameOver, drawLevelClear, drawMap, drawPause, drawTitle } from './screens';

interface Popup {
  text: string;
  x: number;
  y: number;
  t: number;
  colour: string;
}

export class Renderer {
  readonly buf: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  readonly assets = new Assets();
  private popups: Popup[] = [];
  private toasts: { text: string; t: number }[] = [];
  private shakeT = 0;
  private frame = 0;

  constructor() {
    this.buf = document.createElement('canvas');
    this.buf.width = SCREEN_W;
    this.buf.height = SCREEN_H;
    this.g = this.buf.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
  }

  /** Reacts to the game's outputs for this frame: popups and shake. Sound is the audio's job. */
  consume(outputs: readonly GameOutput[]): void {
    for (const o of outputs) {
      if (o.type === 'popup') {
        this.popups.push({
          text: o.points > 0 ? `+${o.points}` : `${o.points}`,
          x: o.x,
          y: o.y,
          t: SEC,
          colour: o.points > 0 ? NES.yellow : NES.red,
        });
      } else if (o.type === 'sfx' && (o.name === 'crush' || o.name === 'lamp' || o.name === 'death')) {
        this.shakeT = 12;
      }
    }
  }

  draw(game: Game): void {
    this.frame++;
    const g = this.g;
    g.fillStyle = '#000';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const f = this.frame;
    switch (game.screen) {
      case 'title':
        drawTitle(g, this.assets, game, f);
        break;
      case 'map':
        drawMap(g, game, f);
        break;
      case 'continue':
        drawContinue(g, game, f);
        break;
      case 'gameover':
        drawGameOver(g, game, f);
        break;
      case 'levelclear':
        drawLevelClear(g, this.assets, game, f);
        break;
      case 'fade':
        this.drawPlay(game, false);
        drawFade(g, this.fadeAlpha(game));
        break;
      case 'pause':
        this.drawPlay(game, false);
        drawPause(g, f);
        break;
      case 'mall':
      case 'store':
      case 'dying':
        this.drawPlay(game, game.screen === 'dying');
        break;
    }
    this.drawToasts();
  }

  /** A short confirmation line (CRT ON, SOUND OFF) shown over whatever is on screen. */
  toast(text: string): void {
    this.toasts = [{ text, t: 1.5 * SEC }];
  }

  private drawToasts(): void {
    const t = this.toasts[0];
    if (!t) return;
    const w = textWidth(t.text) + 10;
    this.g.fillStyle = NES.ink;
    this.g.fillRect(Math.round(SCREEN_W / 2 - w / 2), 200, w, 14);
    drawText(this.g, t.text, Math.round(SCREEN_W / 2 - textWidth(t.text) / 2), 204, NES.white, 1);
    t.t--;
    if (t.t <= 0) this.toasts = [];
  }

  private fadeAlpha(game: Game): number {
    const fade = game.fade;
    if (!fade) return 0;
    const t = fade.t / 20;
    return fade.phase === 'out' ? t : 1 - t;
  }

  /** The mall or store view, with HUD, banner and popups. */
  private drawPlay(game: Game, dying: boolean): void {
    const g = this.g;
    const shake = this.shakeT > 0 ? this.shakeT-- : 0;
    g.save();
    if (shake) g.translate(((this.frame * 7) % 5) - 2, ((this.frame * 3) % 3) - 1);
    if (game.room) {
      drawStoreRoom(g, this.assets, game.room, this.frame);
    } else if (game.world.arrival) {
      drawArrival(g, this.assets, game.world, game.lastSpygram);
    } else {
      drawMall(g, this.assets, game, this.frame);
    }
    g.restore();
    this.drawPopups();
    this.drawHud(game);
    this.drawBanner(game);
    if (dying) this.drawDeathBanner(game);
  }

  private drawPopups(): void {
    for (const p of this.popups) {
      drawText(this.g, p.text, p.x, p.y - (SEC - p.t) / 4, p.colour, 1);
      p.t--;
    }
    this.popups = this.popups.filter((p) => p.t > 0);
  }

  private drawBanner(game: Game): void {
    const b = game.bannerNow;
    if (!b || game.screen === 'title' || game.screen === 'map') return;
    const lines = b.lines.flatMap((l) => wrap(l, 32));
    const width = Math.max(...lines.map((l) => textWidth(l))) + 10;
    const height = lines.length * 8 + 6;
    const x = Math.round(SCREEN_W / 2 - width / 2);
    const y = HUD_H + 30;
    this.g.fillStyle = NES.ink;
    this.g.fillRect(x, y, width, height);
    this.g.fillStyle = NES.gold;
    this.g.fillRect(x, y, width, 1);
    this.g.fillRect(x, y + height - 1, width, 1);
    lines.forEach((l, i) => drawCentered(this.g, l, y + 4 + i * 8, NES.white, 1));
  }

  private drawDeathBanner(game: Game): void {
    if (game.timer % 16 < 8) drawCentered(this.g, 'OUCH!', 120, NES.red, 2);
  }

  private drawHud(game: Game): void {
    const g = this.g;
    g.fillStyle = NES.ink;
    g.fillRect(0, 0, SCREEN_W, HUD_H);
    g.fillStyle = NES.dkgrey;
    g.fillRect(0, HUD_H - 1, SCREEN_W, 1);
    // Score: six digits.
    drawText(g, String(Math.min(999999, game.score.points)).padStart(6, '0'), 2, 4, NES.white);
    // Packages: red until all six are found, then green.
    const pk = game.packagesFound;
    drawText(g, `PKG ${pk}/6`, 42, 4, pk >= 6 ? NES.lime : NES.red);
    // Lives, with a head icon.
    g.fillStyle = NES.skin;
    g.fillRect(88, 4, 6, 6);
    g.fillStyle = NES.ink;
    g.fillRect(88, 3, 6, 2);
    drawText(g, `x${game.lives}`, 96, 4, NES.white);
    // Active timed power-up with a draining bar.
    const timed = game.powerUps.weapon ?? game.powerUps.speed;
    if (timed) {
      const label = POWERUP_NAMES[timed.id];
      drawText(g, label, 114, 2, NES.yellow);
      const full = DURATION[timed.id] ?? 1;
      g.fillStyle = NES.dkgrey;
      g.fillRect(114, 10, 48, 2);
      g.fillStyle = NES.lime;
      g.fillRect(114, 10, Math.round((48 * timed.left) / full), 2);
    } else if (game.powerUps.cinnabomb > 0) {
      drawText(g, 'CINNABOMB', 114, 4, NES.red);
    }
    // Armour and radar icons.
    let ix = 170;
    if (game.powerUps.armour !== 'none') {
      g.drawImage(this.assets.canvas('pu_armor'), ix, 4);
      ix += 10;
    }
    if (game.powerUps.radar) g.drawImage(this.assets.canvas('pu_radar'), ix, 4);
    // ALARM, blinking.
    if (game.world.alarm && Math.floor(this.frame / 15) % 2 === 0) drawText(g, 'ALARM', 190, 4, NES.red);
    // LED floor panel, or the store name scrolling as a marquee inside a store.
    g.fillStyle = NES.black;
    g.fillRect(224, 2, 30, 12);
    if (game.room) {
      const text = `${game.room.store.name}   `;
      const w = textWidth(text);
      const offset = Math.floor(this.frame / 3) % w;
      g.save();
      g.beginPath();
      g.rect(224, 2, 30, 12);
      g.clip();
      drawText(g, text + text, 226 - offset, 4, NES.red);
      g.restore();
    } else {
      const f = game.world.playerFloor;
      const label = f === null ? '--' : FLOOR_NAMES[f];
      drawText(g, label, 228, 4, NES.red);
    }
  }
}
