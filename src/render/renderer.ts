// Canvas renderer. Draws the game state to a 256x240 buffer, then scales it up
// with nearest-neighbour. Reads state only; never mutates the rules.

import type { Game } from "../rules/game";
import {
  SCREEN_W,
  SCREEN_H,
  HUD_H,
  MALL_W,
  MALL_H,
  FLOOR_Y,
  AGENT_H,
} from "../rules/types";
import { PALETTE, C } from "../palette";
import { buildSprites } from "../sprites";
import type { Sprite, SpriteSet } from "../sprites";
import { glyph, FONT_W, FONT_H, textWidth } from "../font";
import { STORES, SHAFTS, ESCALATORS, ROOM_W, ROOM_H, T_WALL, T_FIXTURE, T_COUNTER, T_DECOR, T_DOOR } from "../rules/layout";
import { FLOOR_ORDER } from "../copy";
import { drawCrt } from "./crt";

const TILE = 16;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private sprites: SpriteSet;
  crtEnabled: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.buf = document.createElement("canvas");
    this.buf.width = SCREEN_W;
    this.buf.height = SCREEN_H;
    this.bctx = this.buf.getContext("2d")!;
    this.bctx.imageSmoothingEnabled = false;
    this.sprites = buildSprites();
    this.crtEnabled = true;
  }

  render(game: Game): void {
    const ctx = this.bctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE[C.black];
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    switch (game.screen) {
      case "splash":
        this.drawSplash(game);
        break;
      case "title":
        this.drawTitle(game);
        break;
      case "mall":
        this.drawMall(game);
        break;
      case "store":
        this.drawStore(game);
        break;
      case "map":
        this.drawMap(game);
        break;
      case "pause":
        this.drawPause(game);
        break;
      case "levelclear":
        this.drawLevelClear(game);
        break;
      case "continue":
        this.drawContinue(game);
        break;
      case "gameover":
        this.drawGameOver(game);
        break;
    }

    // Scale up.
    const scale = this.scale();
    const dw = SCREEN_W * scale;
    const dh = SCREEN_H * scale;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    const ox = (this.ctx.canvas.width - dw) / 2;
    const oy = (this.ctx.canvas.height - dh) / 2;
    this.ctx.drawImage(this.buf, ox, oy, dw, dh);

    if (this.crtEnabled) {
      drawCrt(this.ctx, this.ctx.canvas.width, this.ctx.canvas.height, game.frame);
    }
  }

  private scale(): number {
    const w = this.ctx.canvas.width;
    const h = this.ctx.canvas.height;
    return Math.max(1, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H)));
  }

  // -------------------------------------------------------------------------
  // Drawing helpers.
  // -------------------------------------------------------------------------

  private px(x: number, y: number, color: number): void {
    this.bctx.fillStyle = PALETTE[color];
    this.bctx.fillRect(x, y, 1, 1);
  }

  private rect(x: number, y: number, w: number, h: number, color: number): void {
    this.bctx.fillStyle = PALETTE[color];
    this.bctx.fillRect(x, y, w, h);
  }

  private sprite(s: Sprite, x: number, y: number, flip = false): void {
    const ctx = this.bctx;
    for (let py = 0; py < s.h; py++) {
      for (let pxx = 0; pxx < s.w; pxx++) {
        const c = s.px[py * s.w + pxx];
        if (c === 0) continue;
        const dx = flip ? s.w - 1 - pxx : pxx;
        ctx.fillStyle = PALETTE[c];
        ctx.fillRect(Math.round(x) + dx, Math.round(y) + py, 1, 1);
      }
    }
  }

  private text(s: string, x: number, y: number, color: number): void {
    let cx = x;
    for (const ch of s) {
      const g = glyph(ch);
      for (let row = 0; row < FONT_H; row++) {
        const bits = g[row];
        for (let col = 0; col < FONT_W; col++) {
          if (bits & (1 << (FONT_W - 1 - col))) {
            this.px(cx + col, y + row, color);
          }
        }
      }
      cx += FONT_W + 1;
    }
  }

  private textCentered(s: string, y: number, color: number): void {
    this.text(s, Math.floor((SCREEN_W - textWidth(s)) / 2), y, color);
  }

  // -------------------------------------------------------------------------
  // Splash.
  // -------------------------------------------------------------------------

  private drawSplash(game: Game): void {
    const word = "FLICKERSOFT";
    const colors = [C.red, C.orange, C.yellow, C.green, C.cyan, C.blue, C.purple, C.pink];
    const w = textWidth(word);
    const x = Math.floor((SCREEN_W - w) / 2);
    const y = 100;
    const flicker = game.splashPhase === 0 && game.frame % 2 === 0;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const cx = x + i * (FONT_W + 1);
      const color = colors[i % colors.length];
      // Neighbouring letters out of phase.
      const show = flicker ? i % 2 === 0 : true;
      if (show) this.text(ch, cx, y, color);
    }
    if (game.splashPhase === 1) {
      this.rect(x, y + FONT_H + 2, w, 1, C.white);
      this.textCentered("PRESENTS", y + FONT_H + 12, C.white);
    }
  }

  // -------------------------------------------------------------------------
  // Title.
  // -------------------------------------------------------------------------

  private drawTitle(game: Game): void {
    // Night-sky gradient.
    for (let y = 0; y < SCREEN_H; y++) {
      const t = y / SCREEN_H;
      const c = t < 0.5 ? C.darkBlue : C.navy;
      this.rect(0, y, SCREEN_W, 1, c);
    }
    // Stars.
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % SCREEN_W;
      const sy = (i * 53) % 80;
      this.px(sx, sy, C.white);
    }

    // Logo.
    this.textCentered("MALL ACTION", 40, C.red);
    this.textCentered("MALL ACTION", 41, C.yellow);
    this.textCentered("A SHOPPING MALL ESPIONAGE", 60, C.white);
    this.textCentered("(C) 2026 FLICKERSOFT", 80, C.lightGrey);
    this.textCentered(`HIGH SCORE ${String(game.highScore).padStart(6, "0")}`, 96, C.white);

    if (game.frame % 60 < 40) {
      this.textCentered("PRESS START", 130, C.white);
    }
    this.textCentered("Z SHOOT  X JUMP  ARROWS MOVE", 200, C.lightGrey);

    if (game.blackFridayFlash > 0) {
      this.textCentered("BLACK FRIDAY!", 150, C.red);
      this.textCentered("70% OFF EVERYTHING", 160, C.yellow);
    }

    // Scrolling storefronts along the bottom.
    const scroll = Math.floor(game.frame / 2) % 256;
    for (let i = 0; i < 4; i++) {
      const sx = i * 80 - scroll;
      this.drawStorefrontSign(sx, 210, STORES[i % STORES.length]);
    }
  }

  private drawStorefrontSign(x: number, y: number, store: (typeof STORES)[number]): void {
    this.rect(x, y, 76, 20, C.grey);
    this.rect(x + 2, y + 2, 72, 16, C.black);
    const color = store.role === "target" ? C.red : store.role === "powerup" ? C.blue : C.lightGrey;
    this.text(store.name.slice(0, 10), x + 4, y + 6, color);
  }

  // -------------------------------------------------------------------------
  // Mall.
  // -------------------------------------------------------------------------

  private drawMall(game: Game): void {
    const mall = game.mall;
    const p = mall.player;
    const camX = Math.max(0, Math.min(MALL_W - SCREEN_W, p.x - SCREEN_W / 2));
    const camY = Math.max(0, Math.min(MALL_H - (SCREEN_H - HUD_H), p.y - (SCREEN_H - HUD_H) / 2));

    // Sky / background.
    this.rect(0, 0, SCREEN_W, SCREEN_H, C.navy);

    // Floors.
    for (const f of FLOOR_ORDER) {
      const fy = FLOOR_Y[f] - camY + HUD_H;
      this.rect(0, fy, SCREEN_W, 2, C.lightGrey);
    }

    // Storefronts.
    for (const s of STORES) {
      this.drawStorefront(s, camX, camY, game);
    }

    // Elevator shafts.
    for (const sh of SHAFTS) {
      this.drawShaft(sh, camX, camY, mall);
    }

    // Escalators.
    for (const e of ESCALATORS) {
      const x = e.x - camX;
      const y1 = FLOOR_Y[e.lower] - camY + HUD_H;
      const y2 = FLOOR_Y[e.upper] - camY + HUD_H;
      this.rect(x, y2, 8, y1 - y2, C.grey);
    }

    // Lamps.
    for (const l of mall.lamps) {
      const lx = l.x - camX;
      const ly = (l.state === "falling" ? l.y : FLOOR_Y[l.floor] - 40) - camY + HUD_H;
      if (l.state === "dark") continue;
      this.rect(lx, ly, 4, 8, l.disco ? C.cyan : C.yellow);
      this.rect(lx - 2, ly - 2, 8, 2, C.grey);
    }

    // Janitor.
    this.rect(mall.janitor.x - camX, FLOOR_Y["1F"] - camY + HUD_H - 16, 12, 16, C.green);

    // Walkers.
    for (const w of mall.walkers) {
      this.rect(w.x - camX, FLOOR_Y["2F"] - camY + HUD_H - 16, 12, 16, C.purple);
    }

    // Cop.
    this.rect(mall.cop.x - camX, FLOOR_Y[mall.cop.floor] - camY + HUD_H - 16, 12, 16, C.blue);

    // Powerups.
    for (const pu of mall.powerups) {
      this.rect(pu.x - camX, pu.y - camY + HUD_H - 8, 8, 8, C.yellow);
    }

    // Coins.
    for (const c of mall.coins) {
      this.rect(c.x - camX, c.y - camY + HUD_H - 4, 4, 4, c.gold ? C.yellow : C.orange);
    }

    // Spies.
    for (const s of mall.spies) {
      if (s.state === "dead") continue;
      this.sprite(this.sprites.spyStand, s.x - camX, s.y - camY + HUD_H - AGENT_H, s.dir === -1);
    }

    // Player.
    if (!p.dead && game.mallIntro.phase === "play") {
      this.drawPlayer(p, camX, camY);
    }

    // Bullets.
    for (const b of mall.bullets) {
      this.rect(b.x - camX, b.y - camY + HUD_H, 3, 2, b.from === "player" ? C.white : C.red);
    }

    // Bubbles.
    for (const b of mall.bubbles) {
      this.text(b.text, b.x - camX, b.y - camY + HUD_H, C.white);
    }

    // Banner.
    if (mall.banner) {
      this.textCentered(mall.banner.text, 40, C.yellow);
    }

    // PA line.
    if (mall.paLine) {
      this.textCentered(mall.paLine, 8, C.white);
    }

    // Intro (zipline / selfie).
    if (game.mallIntro.phase === "zipline") {
      this.drawZipline(game, camX, camY);
    } else if (game.mallIntro.phase === "selfie") {
      this.drawSelfie(game);
    }

    this.drawHud(game);
  }

  private drawPlayer(p: { x: number; y: number; dir: number; ducking: boolean; jumping: boolean; invuln: number }, camX: number, camY: number): void {
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;
    const sx = p.x - camX;
    const sy = p.y - camY + HUD_H - AGENT_H;
    const spr = p.ducking
      ? this.sprites.agentDuck
      : p.jumping
        ? this.sprites.agentJump
        : this.sprites.agentStand;
    this.sprite(spr, sx, sy, p.dir === -1);
  }

  private drawZipline(game: Game, camX: number, camY: number): void {
    const t = game.mallIntro.timer / 90;
    const startX = 0 - camX;
    const startY = 0 - camY + HUD_H;
    const endX = 40 - camX;
    const endY = FLOOR_Y.R - camY + HUD_H;
    this.bctx.strokeStyle = PALETTE[C.lightGrey];
    this.bctx.beginPath();
    this.bctx.moveTo(startX, startY);
    this.bctx.lineTo(endX, endY);
    this.bctx.stroke();
    const ax = startX + (endX - startX) * t;
    const ay = startY + (endY - startY) * t;
    this.sprite(this.sprites.agentStand, ax, ay - AGENT_H);
  }

  private drawSelfie(game: Game): void {
    const post = game.arrivalPost;
    this.rect(40, 40, 176, 120, C.black);
    this.rect(40, 40, 176, 16, C.pink);
    this.text("SPYGRAM", 48, 44, C.white);
    this.rect(48, 64, 40, 40, C.grey);
    this.sprite(this.sprites.agentStand, 56, 72);
    if (post) {
      this.text(post.caption[0], 96, 70, C.white);
      this.text(post.caption[1], 96, 80, C.white);
      this.text(post.comment, 48, 120, C.lightGrey);
    }
  }

  private drawStorefront(s: (typeof STORES)[number], camX: number, camY: number, game: Game): void {
    const x = s.x - camX;
    const y = FLOOR_Y[s.floor] - camY + HUD_H;
    // Sign.
    this.rect(x, y - 40, s.w, 16, C.grey);
    this.rect(x + 2, y - 38, s.w - 4, 12, C.black);
    const signColor = s.role === "target" ? C.red : s.role === "powerup" ? C.blue : C.lightGrey;
    this.text(s.name.slice(0, 10), x + 4, y - 36, signColor);
    // Door.
    const doorX = x + s.w / 2 - 6;
    if (s.role === "closed") {
      this.rect(doorX, y - 24, 12, 24, C.grey);
    } else {
      const cleared = s.role === "target" && game.packages.has(s.id);
      const blink = s.role === "target" && !cleared && game.frame % 30 < 15;
      const doorColor = cleared
        ? C.grey
        : s.role === "target"
          ? blink
            ? C.red
            : C.darkRed
          : C.blue;
      this.rect(doorX, y - 24, 12, 24, doorColor);
    }
    // Windows.
    this.rect(x + 2, y - 20, 20, 20, C.cyan);
    this.rect(x + s.w - 22, y - 20, 20, 20, C.cyan);
  }

  private drawShaft(sh: (typeof SHAFTS)[number], camX: number, camY: number, mall: Game["mall"]): void {
    const x = sh.x - camX;
    const car = mall.elevators.find((e) => e.shaft === sh.id)!;
    const topY = FLOOR_Y[sh.floors[0]] - camY + HUD_H;
    const botY = FLOOR_Y[sh.floors[sh.floors.length - 1]] - camY + HUD_H;
    this.rect(x, topY, 24, botY - topY, C.grey);
    // Car.
    const cy = car.y - camY + HUD_H;
    this.rect(x + 2, cy, 20, 24, C.lightGrey);
    this.rect(x + 2, cy, 20, 2, C.white);
  }

  // -------------------------------------------------------------------------
  // HUD.
  // -------------------------------------------------------------------------

  private drawHud(game: Game): void {
    const mall = game.mall;
    const p = mall.player;
    this.rect(0, 0, SCREEN_W, HUD_H, C.black);
    this.text(String(game.score).padStart(6, "0"), 2, 4, C.white);

    const pkg = game.packages.size;
    const pkgColor = pkg >= 6 ? C.green : C.red;
    this.text(`PKG ${pkg}/6`, 52, 4, pkgColor);

    // Lives.
    this.text("x" + game.lives, 100, 4, C.white);

    // Powerup.
    const active = game.activePowerups();
    if (active.length > 0) {
      const a = active[0];
      this.text(powerupLabel(a.kind), 120, 4, C.yellow);
      const barW = Math.floor((a.framesLeft / (20 * 60)) * 30);
      this.rect(120, 12, 30, 2, C.grey);
      this.rect(120, 12, barW, 2, C.yellow);
    }
    if (p.armor) this.text("A", 160, 4, C.cyan);
    if (p.radar) this.text("R", 168, 4, C.green);

    if (mall.alarm && game.frame % 30 < 15) {
      this.text("ALARM", 180, 4, C.red);
    }

    // Floor panel.
    const floorIdx = FLOOR_ORDER.indexOf(p.floor);
    this.text(FLOOR_ORDER.map((f, i) => (i === floorIdx ? "[" + f + "]" : f)).join(""), 210, 4, C.white);
  }

  // -------------------------------------------------------------------------
  // Store.
  // -------------------------------------------------------------------------

  private drawStore(game: Game): void {
    const st = game.store;
    if (!st) return;
    const theme = themeColors(st.storeId);

    for (let ty = 0; ty < ROOM_H; ty++) {
      for (let tx = 0; tx < ROOM_W; tx++) {
        const t = st.grid[ty * ROOM_W + tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (t === T_WALL) this.rect(x, y, TILE, TILE, theme.wall);
        else if (t === T_FIXTURE) {
          const f = st.fixtures.find((f) => f.x === tx && f.y === ty);
          this.rect(x, y, TILE, TILE, f && f.opened ? theme.fixtureOpen : theme.fixture);
        } else if (t === T_COUNTER) this.rect(x, y, TILE, TILE, theme.counter);
        else if (t === T_DECOR) this.rect(x, y, TILE, TILE, theme.decor);
        else if (t === T_DOOR) this.rect(x, y, TILE, TILE, C.black);
        else this.rect(x, y, TILE, TILE, theme.floor);
      }
    }

    // Guards.
    for (const g of st.guards) {
      if (g.state === "dead") continue;
      const spr = g.type === "bot" ? this.sprites.spyStore : this.sprites.spyStore;
      this.sprite(spr, g.x * TILE, g.y * TILE, g.dir === -1);
      if (g.line && g.lineTimer > 0) {
        this.text(g.line, g.x * TILE - 20, g.y * TILE - 12, C.white);
      }
    }

    // Player.
    const p = st.player;
    const spr = p.facing === "up" ? this.sprites.agentStoreUp : p.facing === "down" ? this.sprites.agentStoreDown : this.sprites.agentStoreSide;
    this.sprite(spr, p.x, p.y, p.facing === "left");

    // Searching progress.
    if (st.searching) {
      const f = st.fixtures.find((f) => f.x === st.searching!.fx && f.y === st.searching!.fy);
      if (f) {
        const prog = 1 - st.searching.timer / 45;
        this.rect(f.x * TILE, f.y * TILE - 4, TILE, 2, C.grey);
        this.rect(f.x * TILE, f.y * TILE - 4, Math.floor(TILE * prog), 2, C.green);
      }
    }

    // Bottom strip.
    this.rect(0, ROOM_H * TILE, SCREEN_W, SCREEN_H - ROOM_H * TILE, C.black);
    const def = STORES.find((s) => s.id === st.storeId)!;
    this.text(def.name, 4, ROOM_H * TILE + 4, C.white);
    if (st.searching) {
      this.text("SEARCHING...", 120, ROOM_H * TILE + 4, C.yellow);
    } else if (touchingAnyFixture(st)) {
      this.text("PRESS X TO SEARCH", 120, ROOM_H * TILE + 4, C.green);
    }

    if (st.banner) {
      this.textCentered(st.banner.text, 40, C.yellow);
    }

    this.drawHud(game);
  }

  // -------------------------------------------------------------------------
  // Map.
  // -------------------------------------------------------------------------

  private drawMap(game: Game): void {
    this.rect(0, 0, SCREEN_W, SCREEN_H, C.black);
    this.textCentered("MALL DIRECTORY", 8, C.white);

    const scaleX = 200 / MALL_W;
    const scaleY = 180 / MALL_H;
    const ox = 28;
    const oy = 30;

    // Floors.
    for (const f of FLOOR_ORDER) {
      const y = oy + FLOOR_Y[f] * scaleY;
      this.rect(ox, y, 200, 1, C.lightGrey);
      this.text(f, ox - 16, y - 3, C.white);
    }

    // Stores.
    for (const s of STORES) {
      const x = ox + s.x * scaleX;
      const y = oy + FLOOR_Y[s.floor] * scaleY - 6;
      const cleared = s.role === "target" && game.packages.has(s.id);
      const color = s.role === "closed"
        ? C.grey
        : cleared
          ? C.grey
          : s.role === "target"
            ? C.red
            : C.blue;
      this.rect(x, y, s.w * scaleX, 6, color);
    }

    // Elevator cars.
    for (const sh of SHAFTS) {
      const car = game.mall.elevators.find((e) => e.shaft === sh.id)!;
      const x = ox + sh.x * scaleX;
      const y = oy + car.y * scaleY;
      this.rect(x, y, 24 * scaleX, 24 * scaleY, C.white);
    }

    // Player.
    const p = game.mall.player;
    const px = ox + p.x * scaleX;
    const py = oy + p.y * scaleY;
    if (game.frame % 30 < 15) this.rect(px, py, 4, 4, C.yellow);

    // Legend.
    this.rect(ox, 220, 6, 6, C.red);
    this.text("PACKAGE", ox + 10, 220, C.white);
    this.rect(ox + 70, 220, 6, 6, C.blue);
    this.text("POWER-UP", ox + 80, 220, C.white);
    this.rect(ox + 150, 220, 6, 6, C.grey);
    this.text("CLEARED", ox + 160, 220, C.white);
  }

  // -------------------------------------------------------------------------
  // Pause.
  // -------------------------------------------------------------------------

  private drawPause(game: Game): void {
    // Dim the underlying screen.
    this.bctx.fillStyle = "rgba(0,0,0,0.5)";
    this.bctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (game.frame % 60 < 40) {
      this.textCentered("PAUSE", 110, C.white);
    }
  }

  // -------------------------------------------------------------------------
  // Level clear.
  // -------------------------------------------------------------------------

  private drawLevelClear(game: Game): void {
    const lc = game.levelClear;
    this.rect(0, 0, SCREEN_W, SCREEN_H, C.navy);
    if (!lc) return;
    if (lc.phase === 0) {
      this.textCentered("LEVEL CLEAR!", 40, C.yellow);
      this.textCentered(`PACKAGES  ${lc.packages} x 500`, 70, C.white);
      this.textCentered(`TIME BONUS  ${lc.timeBonus}`, 84, C.white);
      this.textCentered(`CLEAR BONUS  ${lc.clearBonus}`, 98, C.white);
      this.textCentered(`LOOP ${game.loop}`, 120, C.green);
    } else if (lc.phase === 1) {
      this.textCentered("THE DAILY MALL", 40, C.white);
      this.textCentered(lc.headline, 70, C.yellow);
    } else {
      this.rect(40, 40, 176, 120, C.black);
      this.rect(40, 40, 176, 16, C.pink);
      this.text("SPYGRAM", 48, 44, C.white);
      this.text(lc.post.caption[0], 48, 70, C.white);
      this.text(lc.post.caption[1], 48, 80, C.white);
      this.text(lc.post.comment, 48, 120, C.lightGrey);
    }
    this.textCentered("PRESS START", 200, C.white);
  }

  // -------------------------------------------------------------------------
  // Continue.
  // -------------------------------------------------------------------------

  private drawContinue(game: Game): void {
    this.rect(0, 0, SCREEN_W, SCREEN_H, C.black);
    this.textCentered("CONTINUE?", 80, C.white);
    const n = 9 - Math.floor(game.continueTimer / 60);
    const color = n <= 3 ? C.red : C.white;
    this.textCentered(String(n), 110, color);
    this.textCentered(`CONTINUES LEFT: ${game.continues}`, 140, C.white);
  }

  // -------------------------------------------------------------------------
  // Game over.
  // -------------------------------------------------------------------------

  private drawGameOver(game: Game): void {
    this.rect(0, 0, SCREEN_W, SCREEN_H, C.black);
    if (game.gameoverTimer < 120) {
      this.textCentered("ATTENTION SHOPPERS:", 80, C.white);
      this.textCentered("THE MALL IS NOW CLOSED", 96, C.white);
    } else {
      this.textCentered("GAME OVER", 80, C.red);
      this.textCentered(`SCORE ${String(game.score).padStart(6, "0")}`, 110, C.white);
      this.textCentered(`HIGH ${String(game.highScore).padStart(6, "0")}`, 124, C.white);
      this.textCentered("PRESS START", 160, C.white);
    }
  }
}

function powerupLabel(kind: string): string {
  const names: Record<string, string> = {
    rapid: "RAPID",
    spread: "SPREAD",
    armor: "ARMOR",
    sneakers: "SNEAKERS",
    radar: "RADAR",
    oneup: "1UP",
    cinnabomb: "CINNABOMB",
    juliooze: "JULI-OOZE",
    pretzel: "PRETZEL",
  };
  return names[kind] ?? kind.toUpperCase();
}

function themeColors(storeId: string): { floor: number; wall: number; fixture: number; fixtureOpen: number; counter: number; decor: number } {
  const themes: Record<string, { floor: number; wall: number; fixture: number; fixtureOpen: number; counter: number; decor: number }> = {
    fashion: { floor: C.pink, wall: C.purple, fixture: C.red, fixtureOpen: C.darkRed, counter: C.white, decor: C.pink },
    electronics: { floor: C.grey, wall: C.darkBlue, fixture: C.cyan, fixtureOpen: C.blue, counter: C.lightGrey, decor: C.cyan },
    toys: { floor: C.yellow, wall: C.orange, fixture: C.red, fixtureOpen: C.darkRed, counter: C.green, decor: C.yellow },
    food: { floor: C.tan, wall: C.brown, fixture: C.orange, fixtureOpen: C.darkRed, counter: C.yellow, decor: C.orange },
    sports: { floor: C.green, wall: C.darkBlue, fixture: C.white, fixtureOpen: C.grey, counter: C.red, decor: C.green },
    music: { floor: C.purple, wall: C.navy, fixture: C.pink, fixtureOpen: C.purple, counter: C.cyan, decor: C.pink },
    gadgets: { floor: C.lightGrey, wall: C.grey, fixture: C.cyan, fixtureOpen: C.blue, counter: C.white, decor: C.cyan },
    novelty: { floor: C.purple, wall: C.black, fixture: C.pink, fixtureOpen: C.purple, counter: C.cyan, decor: C.pink },
    games: { floor: C.green, wall: C.navy, fixture: C.yellow, fixtureOpen: C.orange, counter: C.red, decor: C.yellow },
  };
  return themes[storeId] ?? themes.gadgets;
}

function touchingAnyFixture(st: NonNullable<Game["store"]>): boolean {
  const p = st.player;
  const cx = Math.floor((p.x + 8) / TILE);
  const cy = Math.floor((p.y + 8) / TILE);
  const candidates = [[cx, cy], [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
  for (const [tx, ty] of candidates) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
    if (st.grid[ty * ROOM_W + tx] === T_FIXTURE) {
      const f = st.fixtures.find((f) => f.x === tx && f.y === ty);
      if (f && !f.opened) return true;
    }
  }
  return false;
}
