import {
  SCREEN_W, SCREEN_H, HUD_H, TILE, MALL_W, FLOOR_H,
  FloorId, FLOOR_NAMES, FLOOR_SUBTITLES,
  Direction, GameScreen, StoreRole, PowerUpType, POWER_UP_NAMES,
} from '../engine/types';
import type { GameState, SpyState, NpcState, LampState, ElevatorState, SpygramState, BannerState } from '../game/state';
import { getFloorY } from '../game/state';
import { SPRITES, type SpriteData } from '../sprites/sprites';
import { NES_PALETTE, colorToRgb } from '../sprites/palette';
import { FONT_GLYPHS, FONT_W, FONT_H, TITLE_FONT_GLYPHS, TITLE_FONT_W, TITLE_FONT_H } from '../sprites/font';
import { STORES } from '../data/stores';
import {
  KONAMI_TEXT, MALL_COP_LINE, MALL_WALKER_LINE, DETAINED_LINE, PACKAGES_LEFT_LINE,
} from '../data/copy';

const RAINBOW_COLORS = ['#FF0000', '#FF7700', '#FFFF00', '#00FF00', '#0077FF', '#8800FF', '#FF00FF'];

const STORE_DOOR_COLORS: Record<StoreRole, string> = {
  [StoreRole.Target]: '#CC0000',
  [StoreRole.PowerUp]: '#0044CC',
  [StoreRole.Closed]: '#333333',
};

const FLOOR_COLORS = ['#1a1a2e', '#2a2a3e', '#2e2e3e', '#2a2a3e', '#2e2e3e', '#1e1e28'];
const FLOOR_CEILING_COLORS = ['#0e0e1e', '#222238', '#222238', '#222238', '#222238', '#141420'];
const FLOOR_GROUND_COLORS = ['#444455', '#555566', '#555566', '#555566', '#555566', '#3a3a44'];

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private bufCtx: CanvasRenderingContext2D;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private crtEnabled: boolean = true;
  private spriteImageCache: Map<string, HTMLCanvasElement> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.buffer = document.createElement('canvas');
    this.buffer.width = SCREEN_W;
    this.buffer.height = SCREEN_H;
    const bufCtx = this.buffer.getContext('2d');
    if (!bufCtx) throw new Error('Could not get buffer 2D context');
    this.bufCtx = bufCtx;

    this.resize();
  }

  resize(): void {
    const dpr = 1;
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    this.scale = Math.max(1, Math.floor(Math.min(ww / SCREEN_W, wh / SCREEN_H)));
    const sw = SCREEN_W * this.scale;
    const sh = SCREEN_H * this.scale;

    this.canvas.width = ww * dpr;
    this.canvas.height = wh * dpr;
    this.canvas.style.width = ww + 'px';
    this.canvas.style.height = wh + 'px';

    this.offsetX = Math.floor((ww - sw) / 2);
    this.offsetY = Math.floor((wh - sh) / 2);

    this.ctx.imageSmoothingEnabled = false;
  }

  setCRT(enabled: boolean): void {
    this.crtEnabled = enabled;
  }

  render(state: GameState): void {
    const c = this.bufCtx;
    c.imageSmoothingEnabled = false;

    c.fillStyle = '#000000';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    switch (state.screen) {
      case GameScreen.Splash: this.renderSplash(state); break;
      case GameScreen.Title: this.renderTitle(state); break;
      case GameScreen.Arrival: this.renderArrival(state); break;
      case GameScreen.Mall: this.renderMall(state); this.renderHUD(state); break;
      case GameScreen.Store: this.renderStore(state); this.renderHUD(state); break;
      case GameScreen.Map: this.renderMap(state); break;
      case GameScreen.Pause: this.renderPause(state); break;
      case GameScreen.LevelClear: this.renderLevelClear(state); break;
      case GameScreen.Continue: this.renderContinue(state); break;
      case GameScreen.GameOver: this.renderGameOver(state); break;
    }

    if (state.fadeAlpha > 0) {
      c.fillStyle = `rgba(0,0,0,${state.fadeAlpha})`;
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }

    // Scale to display canvas
    const dc = this.ctx;
    dc.fillStyle = '#000000';
    dc.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.crtEnabled) {
      this.applyCRT();
    }

    dc.imageSmoothingEnabled = false;
    dc.drawImage(
      this.buffer,
      0, 0, SCREEN_W, SCREEN_H,
      this.offsetX, this.offsetY,
      SCREEN_W * this.scale, SCREEN_H * this.scale,
    );

    if (this.crtEnabled) {
      this.applyCRTOverlay();
    }
  }

  // ---- SPLASH SCREEN ----
  private renderSplash(state: GameState): void {
    const c = this.bufCtx;
    const text = 'FLICKERSOFT';
    const charW = TITLE_FONT_W + 1;
    const totalW = text.length * charW;
    const startX = Math.floor((SCREEN_W - totalW) / 2);
    const y = 100;

    const flickerPhase = state.screenTimer < 60;

    for (let i = 0; i < text.length; i++) {
      if (flickerPhase) {
        const visible = (state.frame + i) % 2 === 0;
        if (!visible) continue;
      }
      const color = RAINBOW_COLORS[i % RAINBOW_COLORS.length];
      this.drawTitleChar(text[i], startX + i * charW, y, color);
    }

    if (state.screenTimer >= 60) {
      const lineY = y + TITLE_FONT_H + 4;
      c.fillStyle = '#FFFFFF';
      c.fillRect(startX, lineY, totalW, 2);
    }

    if (state.screenTimer >= 90) {
      this.drawText('PRESENTS', Math.floor((SCREEN_W - 8 * 5) / 2), y + TITLE_FONT_H + 12, '#AAAAAA');
    }
  }

  // ---- TITLE SCREEN ----
  private renderTitle(state: GameState): void {
    const c = this.bufCtx;

    // Night sky gradient
    for (let y = 0; y < SCREEN_H; y++) {
      const t = y / SCREEN_H;
      const r = Math.floor(8 + t * 10);
      const g = Math.floor(8 + t * 12);
      const b = Math.floor(30 + t * 20);
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(0, y, SCREEN_W, 1);
    }

    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 73 + 17) * 37) % SCREEN_W;
      const sy = ((i * 41 + 7) * 23) % 120;
      const blink = ((state.frame + i * 11) % 60) < 50;
      if (blink) {
        c.fillStyle = '#FFFFFF';
        c.fillRect(sx, sy, 1, 1);
      }
    }

    // MALL ACTION title
    const title = 'MALL ACTION';
    const titleW = title.length * (TITLE_FONT_W + 1);
    const tx = Math.floor((SCREEN_W - titleW) / 2);
    // Shadow
    for (let i = 0; i < title.length; i++) {
      this.drawTitleChar(title[i], tx + i * (TITLE_FONT_W + 1) + 1, 41, '#885500');
    }
    // Main
    for (let i = 0; i < title.length; i++) {
      this.drawTitleChar(title[i], tx + i * (TITLE_FONT_W + 1), 40, '#FFCC00');
    }

    this.drawText('A SHOPPING MALL ESPIONAGE', Math.floor((SCREEN_W - 25 * 5) / 2), 56, '#AAAACC');
    this.drawText('(C) 2026 FLICKERSOFT', Math.floor((SCREEN_W - 20 * 5) / 2), 72, '#666688');

    // High score
    const hsText = `HI ${String(state.player.highScore).padStart(6, '0')}`;
    this.drawText(hsText, Math.floor((SCREEN_W - hsText.length * 5) / 2), 88, '#88AACC');

    // Blink PRESS START
    if (Math.floor(state.frame / 30) % 2 === 0) {
      this.drawText('PRESS START', Math.floor((SCREEN_W - 11 * 5) / 2), 140, '#FFFFFF');
    }

    // Control hints
    this.drawText('ARROWS/WASD:MOVE Z:SHOOT', 16, 200, '#556677');
    this.drawText('X:JUMP ENTER:START', 40, 210, '#556677');

    // Scrolling storefronts at bottom
    this.renderScrollingStorefronts(state);

    // Konami code activated
    if (state.konamiActive) {
      if (Math.floor(state.frame / 8) % 2 === 0) {
        this.drawText('BLACK FRIDAY!', Math.floor((SCREEN_W - 13 * 5) / 2), 120, '#FF0000');
        this.drawText('70% OFF EVERYTHING', Math.floor((SCREEN_W - 18 * 5) / 2), 130, '#FFFF00');
      }
    }
  }

  private renderScrollingStorefronts(state: GameState): void {
    const c = this.bufCtx;
    const y = 218;
    const scrollX = (state.frame * 0.5) % (STORES.length * 80);

    for (let i = 0; i < STORES.length + 2; i++) {
      const store = STORES[i % STORES.length];
      const x = Math.floor(i * 80 - scrollX);
      if (x > SCREEN_W || x + 80 < 0) continue;

      // Store body
      c.fillStyle = '#334455';
      c.fillRect(x + 2, y, 76, 22);

      // Sign
      const signColor = store.role === StoreRole.Target ? '#CC4444' :
                        store.role === StoreRole.PowerUp ? '#4444CC' : '#444444';
      c.fillStyle = signColor;
      c.fillRect(x + 4, y, 72, 6);

      // Door
      c.fillStyle = STORE_DOOR_COLORS[store.role];
      c.fillRect(x + 34, y + 8, 12, 14);

      // Windows
      c.fillStyle = '#556688';
      c.fillRect(x + 6, y + 8, 24, 12);
      c.fillRect(x + 50, y + 8, 24, 12);

      // Window glow
      c.fillStyle = 'rgba(100,150,200,0.3)';
      c.fillRect(x + 8, y + 10, 20, 8);
      c.fillRect(x + 52, y + 10, 20, 8);
    }
  }

  // ---- ARRIVAL ----
  private renderArrival(state: GameState): void {
    const c = this.bufCtx;

    // Sky
    for (let y = 0; y < SCREEN_H; y++) {
      const t = y / SCREEN_H;
      c.fillStyle = `rgb(${Math.floor(5 + t * 15)},${Math.floor(5 + t * 15)},${Math.floor(20 + t * 30)})`;
      c.fillRect(0, y, SCREEN_W, 1);
    }

    // Skyscraper at left
    c.fillStyle = '#111122';
    c.fillRect(10, 30, 40, 170);
    // Windows
    for (let wy = 40; wy < 190; wy += 12) {
      for (let wx = 16; wx < 44; wx += 10) {
        c.fillStyle = ((wy + wx) % 24 < 12) ? '#FFCC66' : '#335566';
        c.fillRect(wx, wy, 6, 8);
      }
    }

    // Cable from skyscraper to roof
    c.strokeStyle = '#888888';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(50, 40);
    c.lineTo(200, 180);
    c.stroke();

    // Mall roof
    c.fillStyle = '#333344';
    c.fillRect(100, 185, SCREEN_W - 100, 15);

    // Anchor post
    c.fillStyle = '#666666';
    c.fillRect(196, 178, 8, 12);

    const t = state.screenTimer;
    if (t < 90) {
      // Agent sliding down zipline
      const progress = t / 90;
      const ax = Math.floor(50 + progress * 150);
      const ay = Math.floor(40 + progress * 140);
      this.drawSpriteData(SPRITES.agent.mall.stand, ax - 8, ay - 12);
    } else if (t < 120) {
      // Crouching on roof
      this.drawSpriteData(SPRITES.agent.mall.duck, 192, 161);
    } else {
      // Standing for selfie
      this.drawSpriteData(SPRITES.agent.mall.stand, 192, 161);

      // SPYGRAM card
      if (state.spygram) {
        this.renderSpygram(state.spygram, state.frame);
      }
    }
  }

  // ---- MALL (SIDE-SCROLLING) ----
  private renderMall(state: GameState): void {
    const c = this.bufCtx;
    const camX = Math.floor(state.camera.x);
    const camY = Math.floor(state.camera.y);
    const shakeX = state.screenShake > 0 ? ((state.frame % 4) - 2) : 0;
    const shakeY = state.screenShake > 0 ? ((state.frame % 3) - 1) : 0;
    const ox = -camX + shakeX;
    const oy = -camY + shakeY + HUD_H;

    // Draw floor backgrounds
    for (let f = FloorId.Roof; f <= FloorId.Parking; f++) {
      const fy = f * FLOOR_H + oy;
      if (fy > SCREEN_H || fy + FLOOR_H < HUD_H) continue;

      // Ceiling
      c.fillStyle = FLOOR_CEILING_COLORS[f];
      c.fillRect(0, fy, SCREEN_W, 8);

      // Main corridor
      c.fillStyle = FLOOR_COLORS[f];
      c.fillRect(0, fy + 8, SCREEN_W, FLOOR_H - 16);

      // Floor
      c.fillStyle = FLOOR_GROUND_COLORS[f];
      c.fillRect(0, fy + FLOOR_H - 8, SCREEN_W, 8);

      // Floor tiles pattern
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let tx = ((-camX % 16) + 16) % 16; tx < SCREEN_W; tx += 16) {
        if (((Math.floor((tx + camX) / 16) + f) % 2) === 0) {
          c.fillRect(tx, fy + FLOOR_H - 8, 16, 8);
        }
      }
    }

    // Roof special: skyscraper and cable
    if (FloorId.Roof * FLOOR_H + oy > -FLOOR_H) {
      const roofY = FloorId.Roof * FLOOR_H + oy;
      // Sky above
      c.fillStyle = '#0a0a1e';
      c.fillRect(0, HUD_H, SCREEN_W, Math.max(0, roofY - HUD_H));

      // Skyscraper
      const bldgX = 10 + ox;
      c.fillStyle = '#111122';
      c.fillRect(bldgX, roofY - 60, 40, 68);
      for (let wy = roofY - 55; wy < roofY + 5; wy += 10) {
        for (let wx = bldgX + 4; wx < bldgX + 36; wx += 10) {
          c.fillStyle = '#FFCC66';
          c.fillRect(wx, wy, 6, 6);
        }
      }

      // Cable
      c.strokeStyle = '#666666';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bldgX + 40, roofY - 50);
      c.lineTo(bldgX + 200, roofY + 4);
      c.stroke();
    }

    // Parking level: pillars and station wagon
    if (FloorId.Parking * FLOOR_H + oy < SCREEN_H) {
      const py = FloorId.Parking * FLOOR_H + oy;
      for (let px = 60; px < MALL_W; px += 100) {
        this.drawSpriteData(SPRITES.pillar, px + ox, py + 8);
      }
      // Station wagon
      const wagonX = 600 + ox;
      const wagonY = py + FLOOR_H - 32;
      this.drawSpriteData(SPRITES.stationWagon, wagonX, wagonY);
    }

    // Render storefronts
    this.renderStorefronts(state, ox, oy);

    // Elevator shafts
    for (const elev of state.elevators) {
      this.renderElevator(elev, ox, oy, state);
    }

    // Escalators
    for (const esc of state.escalators) {
      const topY = esc.topFloor * FLOOR_H + oy;
      const botY = esc.bottomFloor * FLOOR_H + oy;
      c.fillStyle = '#555577';
      c.beginPath();
      c.moveTo(esc.x + ox, topY + FLOOR_H - 8);
      c.lineTo(esc.x + ox + 32, botY + FLOOR_H - 8);
      c.lineTo(esc.x + ox + 32, botY + FLOOR_H);
      c.lineTo(esc.x + ox, topY + FLOOR_H);
      c.fill();
      // Step lines
      c.strokeStyle = '#777799';
      c.lineWidth = 1;
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const sx = esc.x + ox + t * 32;
        const sy = topY + FLOOR_H - 8 + t * (botY - topY);
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx, sy + 8);
        c.stroke();
      }
    }

    // Lamps
    for (const lamp of state.lamps) {
      if (!lamp.alive && lamp.darkTimer <= 0) continue;
      const lx = lamp.x + ox;
      const ly = lamp.floor * FLOOR_H + oy;
      if (lamp.alive) {
        this.drawSpriteData(lamp.isDisco ? SPRITES.discoBall : SPRITES.lamp, lx, ly + 2,
          lamp.isDisco ? Math.floor(state.frame / 10) % 2 : undefined);
      } else if (lamp.falling) {
        const fy = ly + 2 + lamp.fallY;
        this.drawSpriteData(lamp.isDisco ? SPRITES.discoBall : SPRITES.lamp, lamp.isDisco ? lamp.rollingX + ox : lx, fy,
          lamp.isDisco ? Math.floor(state.frame / 4) % 2 : undefined);
      }
      if (lamp.darkTimer > 0) {
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(lx - 40, ly, 80, FLOOR_H);
      }
    }

    // Fountains
    for (const ftn of state.fountains) {
      const fx = ftn.x + ox;
      const fy = ftn.floor * FLOOR_H + oy + FLOOR_H - 24;
      this.drawSpriteData(SPRITES.fountain, fx, fy, Math.floor(state.frame / 15) % 2);
    }

    // Benches and plants (decorative, placed between stores)
    for (let f = FloorId.F4; f <= FloorId.F1; f++) {
      const bfy = f * FLOOR_H + oy + FLOOR_H - 16;
      // A few benches and plants per floor
      for (let bx = 160; bx < MALL_W; bx += 200) {
        this.drawSpriteData(SPRITES.bench, bx + ox, bfy);
        this.drawSpriteData(SPRITES.plant, bx + 30 + ox, bfy - 8);
      }
    }

    // Kiosks
    const kiosks = [
      { x: 250, floor: FloorId.F4 },
      { x: 250, floor: FloorId.F3 },
      { x: 250, floor: FloorId.F2 },
      { x: 250, floor: FloorId.F1 },
    ];
    for (const k of kiosks) {
      const kx = k.x + ox;
      const ky = k.floor * FLOOR_H + oy + FLOOR_H - 32;
      this.drawSpriteData(SPRITES.kiosk, kx, ky);
    }

    // Photo booth on 3F
    {
      const pbx = 450 + ox;
      const pby = FloorId.F3 * FLOOR_H + oy + FLOOR_H - 32;
      this.drawSpriteData(SPRITES.photoBooth, pbx, pby);
    }

    // NPCs
    for (const npc of state.npcs) {
      this.renderNpc(npc, ox, oy, state);
    }

    // Coins
    for (const coin of state.coins) {
      const cx = coin.x + ox;
      const cy = coin.y + oy;
      if (coin.isGold) {
        c.fillStyle = '#FFD700';
        c.fillRect(cx, cy, 8, 8);
      } else {
        this.drawSpriteData(SPRITES.coin, cx, cy, Math.floor(state.frame / 8) % 2);
      }
    }

    // Spies
    for (const spy of state.spies) {
      this.renderSpy(spy, ox, oy, state);
    }

    // Player
    if (!state.player.hidden) {
      this.renderPlayer(state, ox, oy);
    }

    // Bullets
    for (const bullet of state.bullets) {
      const bx = bullet.x + ox;
      const by = bullet.y + oy;
      this.drawSpriteData(bullet.isPlayer ? SPRITES.bullets.player : SPRITES.bullets.enemy, bx, by);
    }

    // Wet floor signs and patches
    for (const npc of state.npcs) {
      if (npc.type === 'janitor' && npc.wetPatches) {
        for (const patch of npc.wetPatches) {
          const px = patch.x + ox;
          const py = npc.floor * FLOOR_H + oy + FLOOR_H - 8;
          c.fillStyle = 'rgba(200,200,50,0.3)';
          c.fillRect(px, py, 48, 4);
          this.drawSpriteData(SPRITES.wetFloorSign, px + 20, py - 16);
        }
      }
    }

    // Score popups
    for (const popup of state.scorePopups) {
      const alpha = Math.min(1, popup.timer / 20);
      const py = popup.y + oy - (30 - popup.timer);
      this.drawText(popup.text, popup.x + ox, py, popup.text.startsWith('-') ? '#FF4444' : '#FFFF00');
    }

    // Banners
    for (const banner of state.banners) {
      this.renderBanner(banner, state);
    }

    // SPYGRAM (during arrival on mall screen)
    if (state.spygram) {
      this.renderSpygram(state.spygram, state.frame);
    }
  }

  private renderStorefronts(state: GameState, ox: number, oy: number): void {
    const c = this.bufCtx;

    const storePositions = this.getStorePositions();

    for (const store of STORES) {
      const pos = storePositions[store.id];
      if (!pos) continue;

      const sx = pos.x + ox;
      const sy = pos.floor * FLOOR_H + oy;
      if (sx > SCREEN_W || sx + 80 < 0) continue;

      const storeState = state.stores.get(store.id);
      const cleared = storeState?.cleared ?? false;

      // Store body
      c.fillStyle = '#2a2a3e';
      c.fillRect(sx, sy + 8, 80, FLOOR_H - 16);

      // Sign background
      const signColor = store.role === StoreRole.Target ? (cleared ? '#442222' : '#882222') :
                        store.role === StoreRole.PowerUp ? '#222288' : '#222222';
      c.fillStyle = signColor;
      c.fillRect(sx + 2, sy + 4, 76, 8);

      // Store name (truncated to fit)
      const name = store.name.length > 14 ? store.name.slice(0, 13) + '.' : store.name;
      this.drawText(name, sx + 4, sy + 5, '#FFFFFF');

      // Door
      if (store.role === StoreRole.Closed) {
        // Shutter
        c.fillStyle = '#333333';
        c.fillRect(sx + 34, sy + 14, 12, 22);
        for (let dy = 0; dy < 22; dy += 3) {
          c.fillStyle = '#444444';
          c.fillRect(sx + 34, sy + 14 + dy, 12, 1);
        }
      } else {
        const doorColor = store.role === StoreRole.Target ?
          (cleared ? '#442222' : ((state.frame % 30 < 15) ? '#CC0000' : '#880000')) :
          '#3333AA';
        c.fillStyle = doorColor;
        c.fillRect(sx + 34, sy + 14, 12, 22);
        // Door handle
        c.fillStyle = '#FFCC00';
        c.fillRect(sx + 43, sy + 24, 2, 2);
      }

      // Display windows
      const windowDim = cleared ? 0.5 : 1.0;
      c.fillStyle = `rgba(80,100,140,${windowDim * 0.8})`;
      c.fillRect(sx + 4, sy + 16, 26, 16);
      c.fillRect(sx + 50, sy + 16, 26, 16);

      // Window display content (simple shapes based on store theme)
      this.renderWindowDisplay(store, sx, sy, state.frame, cleared);

      // Black Friday signs
      if (state.blackFriday && store.role !== StoreRole.Closed) {
        c.fillStyle = '#FF0000';
        c.fillRect(sx + 4, sy + 34, 26, 6);
        this.drawText('70%OFF', sx + 5, sy + 35, '#FFFF00');
      }
    }
  }

  private renderWindowDisplay(store: { id: string; theme: string; role: StoreRole }, sx: number, sy: number, frame: number, cleared: boolean): void {
    const c = this.bufCtx;
    if (cleared || store.role === StoreRole.Closed) return;

    const alpha = 0.9;
    switch (store.id) {
      case 'forever12':
        // Mannequins
        c.fillStyle = `rgba(200,150,100,${alpha})`;
        c.fillRect(sx + 10, sy + 20, 4, 10);
        c.fillRect(sx + 18, sy + 22, 4, 8);
        c.fillStyle = `rgba(200,100,100,${alpha})`;
        c.fillRect(sx + 56, sy + 20, 4, 10);
        c.fillRect(sx + 64, sy + 22, 4, 8);
        break;

      case 'radioshock':
        // Stacked TVs with static
        for (let ty = 0; ty < 2; ty++) {
          for (let tx = 0; tx < 2; tx++) {
            c.fillStyle = '#222222';
            c.fillRect(sx + 6 + tx * 12, sy + 18 + ty * 8, 10, 7);
            // Static
            const staticBright = ((frame + tx + ty) % 3) * 40 + 60;
            c.fillStyle = `rgb(${staticBright},${staticBright},${staticBright})`;
            c.fillRect(sx + 7 + tx * 12, sy + 19 + ty * 8, 8, 5);
          }
        }
        break;

      case 'kgb_toys':
        // Teddy bears
        c.fillStyle = `rgba(160,120,80,${alpha})`;
        c.fillRect(sx + 8, sy + 22, 8, 8);
        c.fillRect(sx + 18, sy + 24, 6, 6);
        // Robot
        c.fillStyle = `rgba(100,100,200,${alpha})`;
        c.fillRect(sx + 56, sy + 22, 6, 8);
        c.fillRect(sx + 64, sy + 20, 8, 10);
        break;

      case 'sam_baddy':
        // Boombox
        c.fillStyle = '#333333';
        c.fillRect(sx + 8, sy + 22, 16, 8);
        // Speaker bounce
        const bounce = Math.sin(frame * 0.2) * 2;
        c.fillStyle = '#666666';
        c.fillRect(sx + 10, sy + 24 + bounce, 4, 4);
        c.fillRect(sx + 18, sy + 24 - bounce, 4, 4);
        // Vinyl
        c.fillStyle = '#111111';
        c.beginPath();
        c.arc(sx + 62, sy + 26, 5, 0, Math.PI * 2);
        c.fill();
        break;

      case 'hot_spy':
        // Corn dogs
        c.fillStyle = `rgba(200,160,80,${alpha})`;
        c.fillRect(sx + 8, sy + 20, 3, 10);
        c.fillRect(sx + 14, sy + 22, 3, 8);
        c.fillRect(sx + 20, sy + 21, 3, 9);
        // Lemonade tub
        c.fillStyle = `rgba(255,255,100,${alpha})`;
        c.fillRect(sx + 54, sy + 22, 14, 8);
        break;

      case 'foot_lockpicker':
        // Sneakers
        c.fillStyle = `rgba(200,200,200,${alpha})`;
        c.fillRect(sx + 6, sy + 24, 8, 5);
        c.fillRect(sx + 16, sy + 22, 8, 5);
        c.fillRect(sx + 6, sy + 18, 8, 5);
        // Basketball
        c.fillStyle = `rgba(200,100,50,${alpha})`;
        c.beginPath();
        c.arc(sx + 60, sy + 26, 4, 0, Math.PI * 2);
        c.fill();
        break;

      case 'crookstone':
        // Massage chair
        c.fillStyle = `rgba(100,80,60,${alpha})`;
        c.fillRect(sx + 6, sy + 20, 12, 10);
        c.fillRect(sx + 6, sy + 18, 8, 4);
        // Gadgets
        c.fillStyle = `rgba(100,150,200,${alpha})`;
        c.fillRect(sx + 54, sy + 22, 6, 6);
        c.fillRect(sx + 64, sy + 24, 6, 4);
        break;

      case 'gamestonk':
        // Console stack
        c.fillStyle = '#222222';
        c.fillRect(sx + 6, sy + 24, 10, 6);
        c.fillRect(sx + 6, sy + 20, 10, 4);
        // TO THE MOON rocket
        c.fillStyle = `rgba(200,50,50,${alpha})`;
        c.fillRect(sx + 60, sy + 18, 4, 12);
        c.fillStyle = `rgba(255,200,0,${alpha})`;
        c.fillRect(sx + 58, sy + 28, 8, 3);
        break;

      case 'spenders':
        // Lava lamp
        const blobY = Math.sin(frame * 0.05) * 3;
        c.fillStyle = `rgba(200,50,200,${alpha})`;
        c.fillRect(sx + 10, sy + 18, 6, 12);
        c.fillStyle = `rgba(255,100,50,${alpha})`;
        c.fillRect(sx + 11, sy + 22 + blobY, 4, 4);
        // Plasma ball
        c.fillStyle = `rgba(100,50,200,${alpha})`;
        c.beginPath();
        c.arc(sx + 62, sy + 26, 5, 0, Math.PI * 2);
        c.fill();
        break;

      case 'sharper_imagine':
        // Glowing orb
        const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
        c.fillStyle = `rgba(100,200,255,${pulse})`;
        c.beginPath();
        c.arc(sx + 16, sy + 26, 5, 0, Math.PI * 2);
        c.fill();
        // Robot vacuum
        c.fillStyle = `rgba(80,80,80,${alpha})`;
        c.beginPath();
        c.arc(sx + 62, sy + 28, 4, 0, Math.PI * 2);
        c.fill();
        break;

      case 'blockbluster':
        // FOR LEASE sign
        this.drawText('LEASE', sx + 55, sy + 24, '#888888');
        break;

      case 'circuit_pity':
        // Dead TVs behind half-down shutter
        c.fillStyle = '#222222';
        c.fillRect(sx + 6, sy + 24, 8, 6);
        c.fillRect(sx + 16, sy + 24, 8, 6);
        break;

      case 'borderline':
        // CLOSING SALE
        c.fillStyle = '#CC0000';
        c.fillRect(sx + 50, sy + 22, 24, 8);
        this.drawText('SALE', sx + 52, sy + 24, '#FFFFFF');
        break;
    }
  }

  private renderElevator(elev: ElevatorState, ox: number, oy: number, state: GameState): void {
    const c = this.bufCtx;
    const shaftX = this.getShaftX(elev.shaft);

    // Shaft background
    const topFloor = Math.min(...elev.floorsServed);
    const botFloor = Math.max(...elev.floorsServed);
    const shaftTop = topFloor * FLOOR_H + oy;
    const shaftBot = (botFloor + 1) * FLOOR_H + oy;

    c.fillStyle = '#111118';
    c.fillRect(shaftX + ox, shaftTop, 24, shaftBot - shaftTop);

    // Shaft rails
    c.fillStyle = '#333344';
    c.fillRect(shaftX + ox, shaftTop, 2, shaftBot - shaftTop);
    c.fillRect(shaftX + ox + 22, shaftTop, 2, shaftBot - shaftTop);

    // Floor openings
    for (const floor of elev.floorsServed) {
      const openY = floor * FLOOR_H + oy;
      const carAtFloor = Math.abs(elev.y - getFloorY(floor)) < 4;
      if (carAtFloor) {
        // Car is here - draw car
      } else if (elev.y < getFloorY(floor)) {
        // Car above - grate
        c.fillStyle = '#444455';
        for (let gx = 0; gx < 24; gx += 4) {
          c.fillRect(shaftX + ox + gx, openY + FLOOR_H - 4, 2, 4);
        }
      }
      // If car below - open pit (just the dark shaft shows)
    }

    // Draw car
    const carY = elev.y + oy - 24;
    const sprite = elev.doorsOpen ? SPRITES.elevator.open : SPRITES.elevator.closed;
    this.drawSpriteData(sprite, shaftX + ox, carY);

    // Floor indicator on car
    if (elev.playerInside) {
      const nearestFloor = this.getNearestFloor(elev.y);
      const floorName = FLOOR_NAMES[nearestFloor] || '?';
      c.fillStyle = '#000000';
      c.fillRect(shaftX + ox + 6, carY + 2, 12, 8);
      this.drawText(floorName, shaftX + ox + 7, carY + 3, '#00FF00');
    }
  }

  private renderSpy(spy: SpyState, ox: number, oy: number, state: GameState): void {
    const sx = spy.x + ox;
    const sy = spy.y + oy - 24;
    const flipX = spy.direction === Direction.Left;

    let sprite: SpriteData;
    switch (spy.state) {
      case 'aiming': sprite = SPRITES.spy.mall.aim; break;
      case 'shooting': sprite = spy.stateTimer % 2 === 0 ? SPRITES.spy.mall.shootHigh : SPRITES.spy.mall.shootLow; break;
      case 'ducking': sprite = SPRITES.spy.mall.duck; break;
      case 'dying': sprite = SPRITES.spy.mall.death; break;
      default: {
        const walkFrame = Math.floor(state.frame / 8) % 4;
        sprite = SPRITES.spy.mall.walk;
        this.drawSpriteData(sprite, sx, sy, walkFrame, flipX);
        return;
      }
    }
    this.drawSpriteData(sprite, sx, sy, undefined, flipX);
    if (spy.lastWords && spy.state === 'dying') {
      this.renderSpeechBubble(spy.lastWords, sx + 8, sy - 12);
    }
  }

  private renderPlayer(state: GameState, ox: number, oy: number): void {
    const p = state.player;
    if (p.invulnerable > 0 && state.frame % 4 < 2) return;

    const px = p.x + ox;
    const py = p.y + oy - 24;
    const flipX = p.direction === Direction.Left;

    let sprite: SpriteData;
    if (p.dead) {
      sprite = SPRITES.agent.mall.death;
    } else if (p.holdingItem) {
      sprite = SPRITES.agent.mall.holdItem;
    } else if (p.jumping) {
      sprite = SPRITES.agent.mall.jump;
    } else if (p.ducking) {
      sprite = p.shooting ? SPRITES.agent.mall.shootDuck : SPRITES.agent.mall.duck;
    } else if (p.shooting) {
      sprite = SPRITES.agent.mall.shoot;
    } else if (p.vx !== 0) {
      const walkFrame = Math.floor(state.frame / 8) % 4;
      this.drawSpriteData(SPRITES.agent.mall.walk, px, py, walkFrame, flipX);
      // Cinnabomb flash
      if (p.cinnabomb && state.frame % 4 < 2) {
        this.bufCtx.fillStyle = 'rgba(255,255,0,0.3)';
        this.bufCtx.fillRect(px, py, 16, 24);
      }
      return;
    } else {
      sprite = SPRITES.agent.mall.stand;
    }
    this.drawSpriteData(sprite, px, py, undefined, flipX);

    if (p.cinnabomb && state.frame % 4 < 2) {
      this.bufCtx.fillStyle = 'rgba(255,255,0,0.3)';
      this.bufCtx.fillRect(px, py, 16, 24);
    }
  }

  private renderNpc(npc: NpcState, ox: number, oy: number, state: GameState): void {
    const nx = npc.x + ox;
    const ny = npc.floor * FLOOR_H + oy + FLOOR_H - 32;
    const flipX = npc.direction === Direction.Left;

    switch (npc.type) {
      case 'janitor':
        this.drawSpriteData(SPRITES.janitor, nx, ny, undefined, flipX);
        break;
      case 'mall_walker':
        this.drawSpriteData(SPRITES.mallWalker, nx, ny, undefined, flipX);
        break;
      case 'mall_cop':
        this.drawSpriteData(SPRITES.mallCop, nx, ny, undefined, flipX);
        if (npc.chasing) {
          this.renderSpeechBubble(MALL_COP_LINE, nx + 8, ny - 12);
        }
        break;
    }
  }

  // ---- STORE (TOP-DOWN) ----
  private renderStore(state: GameState): void {
    const c = this.bufCtx;
    if (!state.currentStore) return;

    const storeState = state.stores.get(state.currentStore);
    const store = STORES.find(s => s.id === state.currentStore);
    if (!store) return;

    // Background fill
    c.fillStyle = '#1a1a2e';
    c.fillRect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H);

    // Tile grid
    const roomW = 16;
    const roomH = 11;
    const tileStartX = Math.floor((SCREEN_W - roomW * TILE) / 2);
    const tileStartY = HUD_H + 4;

    // Floor tiles
    const floorColor = this.getStoreFloorColor(store.theme);
    const wallColor = this.getStoreWallColor(store.theme);

    for (let ty = 0; ty < roomH; ty++) {
      for (let tx = 0; tx < roomW; tx++) {
        const px = tileStartX + tx * TILE;
        const py = tileStartY + ty * TILE;

        if (ty === 0 || ty === roomH - 1 || tx === 0 || tx === roomW - 1) {
          // Wall
          c.fillStyle = wallColor;
          c.fillRect(px, py, TILE, TILE);
          c.fillStyle = 'rgba(0,0,0,0.2)';
          c.fillRect(px, py, TILE, 1);
          c.fillRect(px, py, 1, TILE);
        } else {
          // Floor
          c.fillStyle = floorColor;
          c.fillRect(px, py, TILE, TILE);
          // Checkerboard pattern
          if ((tx + ty) % 2 === 0) {
            c.fillStyle = 'rgba(255,255,255,0.05)';
            c.fillRect(px, py, TILE, TILE);
          }
        }
      }
    }

    // Door at bottom center
    const doorX = tileStartX + Math.floor(roomW / 2) * TILE - TILE / 2;
    const doorY = tileStartY + (roomH - 1) * TILE;
    c.fillStyle = '#886644';
    c.fillRect(doorX, doorY, TILE, TILE);

    // Fixtures (simplified: just draw as colored blocks)
    // Use store layout data if available, otherwise generate simple layout
    this.renderStoreFixtures(state, store, storeState, tileStartX, tileStartY, roomW, roomH);

    // Store guards
    for (const guard of state.storeSpies) {
      const gx = tileStartX + guard.x;
      const gy = tileStartY + guard.y;
      if (guard.isBot) {
        this.drawSpriteData(SPRITES.securityBot, gx, gy);
      } else {
        const dirSprite = this.getStoreDirectionSprite(SPRITES.spy.store, guard.direction);
        this.drawSpriteData(dirSprite, gx, gy);
      }
      if (guard.state === 'dying') {
        c.fillStyle = 'rgba(255,0,0,0.4)';
        c.fillRect(gx, gy, 16, 16);
      }
    }

    // Player in store
    const p = state.player;
    if (p.invulnerable <= 0 || state.frame % 4 >= 2) {
      const playerSprite = p.searching ? SPRITES.agent.store.search :
        this.getStoreDirectionSprite(SPRITES.agent.store, p.storeDir);
      this.drawSpriteData(playerSprite, tileStartX + p.storeX, tileStartY + p.storeY);
    }

    // Store bullets
    for (const b of state.storeBullets) {
      const bx = tileStartX + b.x;
      const by = tileStartY + b.y;
      this.drawSpriteData(b.isPlayer ? SPRITES.bullets.player : SPRITES.bullets.enemy, bx, by);
    }

    // Search progress bar
    if (p.searching && p.searchTarget !== null) {
      const barW = 20;
      const barH = 3;
      const progress = 1 - (p.searchTimer / 45);
      const barX = tileStartX + p.storeX - 2;
      const barY = tileStartY + p.storeY - 6;
      c.fillStyle = '#333333';
      c.fillRect(barX, barY, barW, barH);
      c.fillStyle = '#00CC00';
      c.fillRect(barX, barY, Math.floor(barW * progress), barH);
    }

    // Bottom strip
    const stripY = SCREEN_H - 12;
    c.fillStyle = '#000000';
    c.fillRect(0, stripY, SCREEN_W, 12);

    const storeName = store.name;
    this.drawText(storeName, 4, stripY + 3, '#AAAAAA');

    if (p.searching) {
      this.drawText('SEARCHING...', SCREEN_W - 65, stripY + 3, '#FFCC00');
    } else if (p.searchTarget !== null) {
      this.drawText('PRESS X TO SEARCH', SCREEN_W - 92, stripY + 3, '#88AACC');
    }

    // Banners
    for (const banner of state.banners) {
      this.renderBanner(banner, state);
    }
  }

  private renderStoreFixtures(
    state: GameState, store: { id: string; theme: string }, storeState: any,
    startX: number, startY: number, roomW: number, roomH: number,
  ): void {
    const c = this.bufCtx;
    if (!storeState) return;

    // Simple fixture placement based on store theme
    const fixturePositions = this.getFixturePositions(roomW, roomH);

    for (let i = 0; i < fixturePositions.length && i < storeState.fixturesSearched.length; i++) {
      const pos = fixturePositions[i];
      const searched = storeState.fixturesSearched[i];
      const fx = startX + pos.x * TILE;
      const fy = startY + pos.y * TILE;

      const sprite = searched ? SPRITES.fixtures.opened : SPRITES.fixtures.closed;
      this.drawSpriteData(sprite, fx, fy);

      // Radar highlight
      if (state.player.hasRadar && !searched && i === storeState.packageIndex) {
        if (state.frame % 20 < 10) {
          this.drawText('!', fx + 6, fy - 8, '#FF0000');
        }
      }
    }
  }

  private getFixturePositions(roomW: number, roomH: number): { x: number; y: number }[] {
    return [
      { x: 3, y: 2 }, { x: 7, y: 2 }, { x: 12, y: 2 },
      { x: 3, y: 5 }, { x: 12, y: 5 },
      { x: 5, y: 8 }, { x: 10, y: 8 },
    ];
  }

  // ---- MAP OVERLAY ----
  private renderMap(state: GameState): void {
    const c = this.bufCtx;
    c.fillStyle = '#0a0a1a';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Title
    this.drawText('MALL DIRECTORY', Math.floor((SCREEN_W - 14 * 5) / 2), 8, '#FFCC00');

    const mapX = 20;
    const mapY = 24;
    const floorH = 28;
    const mapW = SCREEN_W - 40;

    // Draw floors
    for (let f = FloorId.Roof; f <= FloorId.Parking; f++) {
      const fy = mapY + f * floorH;
      const label = FLOOR_NAMES[f as FloorId];

      // Floor bar
      c.fillStyle = '#222233';
      c.fillRect(mapX, fy, mapW, floorH - 2);
      c.fillStyle = '#333344';
      c.fillRect(mapX, fy, mapW, 1);

      // Floor label
      this.drawText(label, mapX + 2, fy + 4, '#888899');
    }

    // Elevator shafts
    const shaftPositions = { A: 0.2, B: 0.5, C: 0.8 };
    for (const elev of state.elevators) {
      const sx = mapX + Math.floor(mapW * shaftPositions[elev.shaft]);

      // Shaft line
      const topFloor = Math.min(...elev.floorsServed);
      const botFloor = Math.max(...elev.floorsServed);
      c.fillStyle = '#444466';
      c.fillRect(sx, mapY + topFloor * floorH, 4, (botFloor - topFloor + 1) * floorH);

      // Car position
      const carFloor = this.getNearestFloor(elev.y);
      const carMapY = mapY + carFloor * floorH + 4;
      c.fillStyle = '#AAAACC';
      c.fillRect(sx - 2, carMapY, 8, 12);
      this.drawText(elev.shaft, sx, carMapY + 3, '#000000');
    }

    // Escalators
    for (const esc of state.escalators) {
      const escMapX = mapX + Math.floor(mapW * (esc.x / MALL_W));
      const topY = mapY + esc.topFloor * floorH + floorH - 4;
      const botY = mapY + esc.bottomFloor * floorH + 4;
      c.strokeStyle = '#66AA66';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(escMapX, topY);
      c.lineTo(escMapX + 10, botY);
      c.stroke();
    }

    // Stores
    for (const store of STORES) {
      const pos = this.getStorePositions()[store.id];
      if (!pos) continue;

      const storeMapX = mapX + Math.floor(mapW * (pos.x / MALL_W));
      const storeMapY = mapY + pos.floor * floorH + 14;

      const storeState = state.stores.get(store.id);
      let color: string;
      if (store.role === StoreRole.Closed) {
        color = '#333333';
      } else if (store.role === StoreRole.PowerUp) {
        color = '#4444CC';
      } else if (storeState?.cleared) {
        color = '#666666';
      } else {
        color = '#CC0000';
        // Radar: show "!" for remaining package stores
        if (state.player.hasRadar && state.frame % 20 < 10) {
          this.drawText('!', storeMapX + 4, storeMapY - 8, '#FF0000');
        }
      }

      c.fillStyle = color;
      c.fillRect(storeMapX, storeMapY, 12, 8);
    }

    // Player position (blinking)
    if (state.frame % 20 < 14) {
      if (state.currentStore) {
        // Inside a store: blink the store
        const storePos = this.getStorePositions()[state.currentStore];
        if (storePos) {
          const px = mapX + Math.floor(mapW * (storePos.x / MALL_W));
          const py = mapY + storePos.floor * floorH + 14;
          c.fillStyle = '#FFFF00';
          c.fillRect(px - 1, py - 1, 14, 10);
        }
      } else {
        const px = mapX + Math.floor(mapW * (state.player.x / MALL_W));
        const py = mapY + state.player.floor * floorH + 10;
        c.fillStyle = '#FFFF00';
        c.fillRect(px - 2, py - 2, 5, 5);
      }
    }

    // Getaway car on P
    const carMapX = mapX + Math.floor(mapW * (600 / MALL_W));
    const carMapY = mapY + FloorId.Parking * floorH + 10;
    c.fillStyle = '#887744';
    c.fillRect(carMapX, carMapY, 16, 8);
    this.drawText('CAR', carMapX + 1, carMapY + 1, '#000000');

    // Legend
    const legY = SCREEN_H - 40;
    c.fillStyle = '#CC0000'; c.fillRect(mapX, legY, 6, 6);
    this.drawText('PKG', mapX + 8, legY, '#888899');
    c.fillStyle = '#666666'; c.fillRect(mapX + 30, legY, 6, 6);
    this.drawText('CLR', mapX + 38, legY, '#888899');
    c.fillStyle = '#4444CC'; c.fillRect(mapX + 60, legY, 6, 6);
    this.drawText('SHOP', mapX + 68, legY, '#888899');
    c.fillStyle = '#333333'; c.fillRect(mapX + 98, legY, 6, 6);
    this.drawText('SHUT', mapX + 106, legY, '#888899');

    // Inventory
    const invY = SCREEN_H - 24;
    this.drawText('INV:', mapX, invY, '#888899');
    let ix = mapX + 24;
    for (const item of state.inventory) {
      this.drawText(item, ix, invY, '#AAAACC');
      ix += (item.length + 1) * 5;
    }
    if (state.photoStrip.collected) {
      this.drawText('PHOTO STRIP', ix, invY, '#AAAACC');
    }

    this.drawText('SELECT TO CLOSE', Math.floor((SCREEN_W - 15 * 5) / 2), SCREEN_H - 10, '#556677');
  }

  // ---- PAUSE ----
  private renderPause(state: GameState): void {
    // Draw the current game screen dimmed
    if (state.currentStore) {
      this.renderStore(state);
    } else {
      this.renderMall(state);
    }
    this.renderHUD(state);

    // Dim overlay
    this.bufCtx.fillStyle = 'rgba(0,0,0,0.5)';
    this.bufCtx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Blinking PAUSE
    if (Math.floor(state.frame / 30) % 2 === 0) {
      this.drawText('PAUSE', Math.floor((SCREEN_W - 5 * 5) / 2), Math.floor(SCREEN_H / 2) - 4, '#FFFFFF');
    }
  }

  // ---- LEVEL CLEAR ----
  private renderLevelClear(state: GameState): void {
    const c = this.bufCtx;
    const phase = state.levelClearPhase;

    if (phase === 0) {
      // Parking garage
      c.fillStyle = '#1a1a28';
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);

      // Floor
      c.fillStyle = '#333344';
      c.fillRect(0, 180, SCREEN_W, 60);

      // Pillars
      for (let px = 40; px < SCREEN_W; px += 80) {
        c.fillStyle = '#444455';
        c.fillRect(px, 120, 12, 60);
      }

      // Station wagon driving off
      const wagonX = Math.min(SCREEN_W + 50, 80 + state.screenTimer * 2);
      c.fillStyle = '#776633';
      c.fillRect(wagonX, 160, 48, 16);
      c.fillStyle = '#554422';
      c.fillRect(wagonX + 8, 155, 30, 8);
      // Wood paneling
      c.fillStyle = '#998866';
      c.fillRect(wagonX + 4, 162, 40, 4);
      // Wheels
      c.fillStyle = '#222222';
      c.beginPath();
      c.arc(wagonX + 10, 176, 4, 0, Math.PI * 2);
      c.arc(wagonX + 38, 176, 4, 0, Math.PI * 2);
      c.fill();

      // Spy chasing
      const spyX = Math.min(SCREEN_W + 20, 40 + state.screenTimer * 1.5);
      const spyWave = Math.sin(state.frame * 0.3) * 3;
      this.drawSpriteData(SPRITES.spy.mall.stand, spyX, 156 + spyWave, undefined, false);
      // Receipt
      c.fillStyle = '#FFFFFF';
      c.fillRect(spyX + 16, 156, 4, 8);
    } else if (phase === 1) {
      // Bonus tally
      c.fillStyle = '#000011';
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);

      this.drawText('LEVEL CLEAR!', Math.floor((SCREEN_W - 12 * 5) / 2), 30, '#FFCC00');

      const tallyX = 60;
      let ty = 60;
      const lineH = 16;

      this.drawText('PACKAGES  X500', tallyX, ty, '#FFFFFF');
      this.drawText(String(state.packagesCollected * 500), SCREEN_W - 80, ty, '#FFCC00');
      ty += lineH;

      const timeBonus = Math.max(0, (300 * 60 - state.levelTime) / 60) * 10;
      this.drawText('TIME BONUS', tallyX, ty, '#FFFFFF');
      this.drawText(String(Math.floor(timeBonus)), SCREEN_W - 80, ty, '#FFCC00');
      ty += lineH;

      this.drawText('CLEAR BONUS', tallyX, ty, '#FFFFFF');
      this.drawText('1000', SCREEN_W - 80, ty, '#FFCC00');
      ty += lineH * 2;

      const total = state.packagesCollected * 500 + Math.floor(timeBonus) + 1000;
      this.drawText('TOTAL', tallyX, ty, '#FFFFFF');
      this.drawText(String(total), SCREEN_W - 80, ty, '#00FF00');
      ty += lineH * 2;

      this.drawText(`LOOP ${state.loop}`, Math.floor((SCREEN_W - 6 * 5) / 2), ty, '#AAAACC');
    } else if (phase === 2) {
      // THE DAILY MALL
      c.fillStyle = '#EEEECC';
      c.fillRect(20, 20, SCREEN_W - 40, SCREEN_H - 40);

      // Newspaper header
      c.fillStyle = '#000000';
      c.fillRect(24, 24, SCREEN_W - 48, 20);
      this.drawText('THE DAILY MALL', 30, 28, '#EEEECC');

      // Date line
      this.drawText('LATE EDITION', 30, 48, '#444444');

      // Headline
      const headlines = [
        'LOCAL AGENT FINDS 6',
        'PACKAGES, STILL NO',
        'PARKING',
      ];
      let hy = 64;
      for (const line of headlines) {
        this.drawText(line, 30, hy, '#000000');
        hy += 10;
      }

      // Decorative rules
      c.fillStyle = '#000000';
      c.fillRect(24, 56, SCREEN_W - 48, 1);
      c.fillRect(24, 100, SCREEN_W - 48, 1);
    } else if (phase === 3) {
      // SPYGRAM mission complete
      c.fillStyle = '#000011';
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);

      if (state.spygram) {
        this.renderSpygram(state.spygram, state.frame);
      }
    }
  }

  // ---- CONTINUE ----
  private renderContinue(state: GameState): void {
    const c = this.bufCtx;
    c.fillStyle = '#000000';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    this.drawText('CONTINUE?', Math.floor((SCREEN_W - 9 * 5) / 2), 80, '#FFFFFF');

    const countdownSec = Math.ceil(state.continueCountdown / 60);
    const isRed = countdownSec <= 3;
    const numStr = String(countdownSec);

    // Large countdown number
    const numX = Math.floor((SCREEN_W - numStr.length * (TITLE_FONT_W + 1)) / 2);
    for (let i = 0; i < numStr.length; i++) {
      this.drawTitleChar(numStr[i], numX + i * (TITLE_FONT_W + 1), 110, isRed ? '#FF0000' : '#FFFFFF');
    }

    const contText = `CONTINUES LEFT: ${state.player.continues}`;
    this.drawText(contText, Math.floor((SCREEN_W - contText.length * 5) / 2), 150, '#888899');

    this.drawText('PRESS START', Math.floor((SCREEN_W - 11 * 5) / 2), 180, '#556677');
  }

  // ---- GAME OVER ----
  private renderGameOver(state: GameState): void {
    const c = this.bufCtx;

    // Background with shutters
    c.fillStyle = '#0a0a1e';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Rolling shutters
    const shutterProgress = Math.min(1, state.gameOverTimer / 120);
    for (let sx = 0; sx < SCREEN_W; sx += 80) {
      const shutterH = Math.floor(shutterProgress * SCREEN_H);
      c.fillStyle = '#333333';
      c.fillRect(sx, 0, 76, shutterH);
      // Shutter lines
      for (let sly = 0; sly < shutterH; sly += 4) {
        c.fillStyle = '#444444';
        c.fillRect(sx, sly, 76, 1);
      }
    }

    // Typewriter text
    if (state.gameOverTimer > 60) {
      const text1 = 'ATTENTION SHOPPERS:';
      const charsShown1 = Math.min(text1.length, Math.floor((state.gameOverTimer - 60) / 3));
      this.drawText(text1.slice(0, charsShown1), Math.floor((SCREEN_W - text1.length * 5) / 2), 70, '#FFFFFF');
    }
    if (state.gameOverTimer > 120) {
      const text2 = 'THE MALL IS NOW CLOSED';
      const charsShown2 = Math.min(text2.length, Math.floor((state.gameOverTimer - 120) / 3));
      this.drawText(text2.slice(0, charsShown2), Math.floor((SCREEN_W - text2.length * 5) / 2), 84, '#FFFFFF');
    }

    if (state.gameOverTimer > 200) {
      this.drawText('GAME OVER', Math.floor((SCREEN_W - 9 * 5) / 2), 120, '#FF0000');

      const scoreText = `SCORE: ${String(state.player.score).padStart(6, '0')}`;
      this.drawText(scoreText, Math.floor((SCREEN_W - scoreText.length * 5) / 2), 145, '#FFFFFF');

      const hiText = `HI: ${String(state.player.highScore).padStart(6, '0')}`;
      this.drawText(hiText, Math.floor((SCREEN_W - hiText.length * 5) / 2), 160, '#FFCC00');
    }
  }

  // ---- HUD ----
  private renderHUD(state: GameState): void {
    const c = this.bufCtx;
    const p = state.player;

    // Background
    c.fillStyle = '#000000';
    c.fillRect(0, 0, SCREEN_W, HUD_H);

    // Score
    const scoreStr = String(p.score).padStart(6, '0');
    this.drawText(scoreStr, 2, 2, '#FFFFFF');

    // Packages
    const pkgColor = state.packagesCollected >= state.totalPackages ? '#00CC00' : '#CC0000';
    this.drawText(`PKG ${state.packagesCollected}/${state.totalPackages}`, 42, 2, pkgColor);

    // Lives
    let lifeX = 90;
    for (let i = 0; i < p.lives; i++) {
      this.drawSpriteData(SPRITES.headIcon, lifeX, 1);
      lifeX += 10;
    }

    // Active power-up
    if (p.weapon !== null) {
      const name = POWER_UP_NAMES[p.weapon] || '';
      const shortName = name.length > 6 ? name.slice(0, 5) + '.' : name;
      this.drawText(shortName, 120, 2, '#FFCC00');

      // Timer bar
      const maxDur = p.weapon === PowerUpType.RapidFire || p.weapon === PowerUpType.SpreadShot ? 20 * 60 : 20 * 60;
      const barProgress = p.weaponTimer / maxDur;
      c.fillStyle = '#333333';
      c.fillRect(120, 10, 30, 3);
      c.fillStyle = '#FFCC00';
      c.fillRect(120, 10, Math.floor(30 * barProgress), 3);
    }

    // Speed boost indicator
    if (p.speedBoost !== null) {
      const sName = POWER_UP_NAMES[p.speedBoost] || '';
      this.drawText(sName.slice(0, 4), 155, 2, '#00CCFF');
    }

    // Cinnabomb indicator
    if (p.cinnabomb) {
      this.drawText('BOMB', 155, 2, state.frame % 4 < 2 ? '#FFFF00' : '#FF0000');
    }

    // Armor icon
    if (p.hasArmor) {
      c.fillStyle = '#4488FF';
      c.fillRect(180, 2, 6, 6);
      this.drawText('A', 181, 2, '#FFFFFF');
    }

    // Radar icon
    if (p.hasRadar) {
      c.fillStyle = '#44CC44';
      c.fillRect(188, 2, 6, 6);
      this.drawText('R', 189, 2, '#FFFFFF');
    }

    // Alarm indicator
    if (state.alarmActive && state.frame % 30 < 20) {
      this.drawText('ALARM', 198, 2, '#FF0000');
    }

    // Floor indicator (right side)
    const floorName = state.currentStore ?
      this.scrollStoreMarquee(state.currentStore, state.frame) :
      FLOOR_NAMES[state.player.floor] || '?';

    c.fillStyle = '#111111';
    c.fillRect(SCREEN_W - 26, 1, 24, 14);
    c.fillStyle = '#002200';
    c.fillRect(SCREEN_W - 25, 2, 22, 12);
    this.drawText(floorName, SCREEN_W - 24, 5, '#00FF00');
  }

  // ---- SPYGRAM ----
  private renderSpygram(spygram: SpygramState, frame: number): void {
    const c = this.bufCtx;
    const cardX = 40;
    const cardY = 50;
    const cardW = 176;
    const cardH = 140;

    // Card background
    c.fillStyle = '#FFFFFF';
    c.fillRect(cardX, cardY, cardW, cardH);

    // Header
    c.fillStyle = '#CC33AA';
    c.fillRect(cardX, cardY, cardW, 14);
    this.drawText('SPYGRAM', cardX + 4, cardY + 4, '#FFFFFF');

    // Agent photo area
    c.fillStyle = '#EEEEDD';
    c.fillRect(cardX + 10, cardY + 20, cardW - 20, 50);
    this.drawSpriteData(SPRITES.agent.mall.stand, cardX + cardW / 2 - 8, cardY + 36);

    // Caption
    let capY = cardY + 78;
    for (const line of spygram.caption) {
      this.drawText(line, cardX + 10, capY, '#333333');
      capY += 10;
    }

    // Likes
    const likeStr = `<3 ${Math.floor(spygram.likes)}`;
    this.drawText(likeStr, cardX + 10, capY + 4, '#CC3366');

    // Comment
    this.drawText(spygram.comment, cardX + 10, capY + 14, '#666666');
  }

  // ---- SHARED DRAWING HELPERS ----

  private drawText(text: string, x: number, y: number, color: string = '#FFFFFF', large: boolean = false): void {
    const c = this.bufCtx;
    const glyphs = large ? TITLE_FONT_GLYPHS : FONT_GLYPHS;
    const charW = large ? TITLE_FONT_W : FONT_W;
    const charH = large ? TITLE_FONT_H : FONT_H;
    const [r, g, b] = this.hexToRgb(color);

    let cx = Math.floor(x);
    for (const ch of text.toUpperCase()) {
      const glyph = glyphs[ch];
      if (glyph) {
        for (let row = 0; row < charH && row < glyph.length; row++) {
          const bits = glyph[row];
          for (let col = 0; col < charW; col++) {
            if (bits & (1 << (charW - 1 - col))) {
              c.fillStyle = color;
              c.fillRect(cx + col, y + row, 1, 1);
            }
          }
        }
      }
      cx += charW + 1;
    }
  }

  private drawTitleChar(ch: string, x: number, y: number, color: string): void {
    const glyphs = TITLE_FONT_GLYPHS;
    const glyph = glyphs[ch.toUpperCase()];
    if (!glyph) return;
    const c = this.bufCtx;

    for (let row = 0; row < TITLE_FONT_H && row < glyph.length; row++) {
      const bits = glyph[row];
      for (let col = 0; col < TITLE_FONT_W; col++) {
        if (bits & (1 << (TITLE_FONT_W - 1 - col))) {
          c.fillStyle = color;
          c.fillRect(x + col, y + row, 1, 1);
        }
      }
    }
  }

  private drawSpriteData(sprite: SpriteData, x: number, y: number, frame?: number, flipX?: boolean): void {
    const c = this.bufCtx;
    const pixels = (frame !== undefined && sprite.frames) ? sprite.frames[frame % sprite.frames.length] : sprite.pixels;
    const palette = sprite.palette;
    const w = sprite.width;
    const h = sprite.height;

    for (let row = 0; row < h && row < pixels.length; row++) {
      for (let col = 0; col < w && col < pixels[row].length; col++) {
        const pidx = pixels[row][col];
        if (pidx === 0) continue;

        const colorIdx = palette[pidx - 1];
        const color = NES_PALETTE[colorIdx] || '#FF00FF';
        c.fillStyle = color;

        const dx = flipX ? x + (w - 1 - col) : x + col;
        c.fillRect(dx, y + row, 1, 1);
      }
    }
  }

  private renderSpeechBubble(text: string, x: number, y: number): void {
    const c = this.bufCtx;
    const textW = text.length * 5;
    const bubbleW = textW + 8;
    const bubbleH = 12;
    const bx = Math.max(0, Math.min(SCREEN_W - bubbleW, x - bubbleW / 2));
    const by = Math.max(0, y - bubbleH - 4);

    // Bubble
    c.fillStyle = '#FFFFFF';
    c.fillRect(bx, by, bubbleW, bubbleH);
    c.fillStyle = '#000000';
    c.fillRect(bx, by, bubbleW, 1);
    c.fillRect(bx, by + bubbleH - 1, bubbleW, 1);
    c.fillRect(bx, by, 1, bubbleH);
    c.fillRect(bx + bubbleW - 1, by, 1, bubbleH);

    // Pointer
    c.fillStyle = '#FFFFFF';
    c.fillRect(bx + bubbleW / 2 - 2, by + bubbleH, 4, 3);

    // Text
    this.drawText(text, bx + 4, by + 3, '#000000');
  }

  private renderBanner(banner: BannerState, state: GameState): void {
    const c = this.bufCtx;
    const lines = banner.text.split('\n');
    const maxLineW = Math.max(...lines.map((l: string) => l.length * 5));
    const bannerW = maxLineW + 16;
    const bannerH = lines.length * 10 + 8;
    const bx = Math.floor((SCREEN_W - bannerW) / 2);
    const by = Math.floor(SCREEN_H * 0.35);

    let bgColor: string;
    let borderColor: string;
    let textColor: string;
    switch (banner.type) {
      case 'pa':
        bgColor = '#222244';
        borderColor = '#4444AA';
        textColor = '#AAAAFF';
        break;
      case 'floor':
        bgColor = '#113311';
        borderColor = '#33AA33';
        textColor = '#88FF88';
        break;
      case 'alarm':
        bgColor = '#441111';
        borderColor = '#CC2222';
        textColor = '#FF4444';
        break;
      default:
        bgColor = '#111122';
        borderColor = '#4444AA';
        textColor = '#FFFFFF';
    }

    c.fillStyle = bgColor;
    c.fillRect(bx, by, bannerW, bannerH);
    c.strokeStyle = borderColor;
    c.lineWidth = 1;
    c.strokeRect(bx, by, bannerW, bannerH);

    let ty = by + 5;
    for (const line of lines) {
      this.drawText(line, bx + 8, ty, textColor);
      ty += 10;
    }
  }

  // ---- CRT EFFECT ----
  private applyCRT(): void {
    const c = this.bufCtx;
    const imageData = c.getImageData(0, 0, SCREEN_W, SCREEN_H);
    const data = imageData.data;

    for (let y = 0; y < SCREEN_H; y++) {
      for (let x = 0; x < SCREEN_W; x++) {
        const i = (y * SCREEN_W + x) * 4;

        // Scanline darkening (every other line)
        if (y % 2 === 1) {
          data[i] = Math.floor(data[i] * 0.7);
          data[i + 1] = Math.floor(data[i + 1] * 0.7);
          data[i + 2] = Math.floor(data[i + 2] * 0.7);
        }

        // Subtle noise (deterministic based on frame counter from x,y position)
        const noiseVal = ((x * 7 + y * 13 + this.noiseFrame * 37) % 17) / 17;
        const noiseFactor = 0.95 + noiseVal * 0.1;
        data[i] = Math.min(255, Math.floor(data[i] * noiseFactor));
        data[i + 1] = Math.min(255, Math.floor(data[i + 1] * noiseFactor));
        data[i + 2] = Math.min(255, Math.floor(data[i + 2] * noiseFactor));

        // Vignette
        const dx = (x - SCREEN_W / 2) / (SCREEN_W / 2);
        const dy = (y - SCREEN_H / 2) / (SCREEN_H / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.7) {
          const vignette = 1 - (dist - 0.7) * 1.2;
          const v = Math.max(0, Math.min(1, vignette));
          data[i] = Math.floor(data[i] * v);
          data[i + 1] = Math.floor(data[i + 1] * v);
          data[i + 2] = Math.floor(data[i + 2] * v);
        }
      }
    }

    c.putImageData(imageData, 0, 0);
  }

  private noiseFrame: number = 0;

  setNoiseFrame(frame: number): void {
    this.noiseFrame = frame;
  }

  private applyCRTOverlay(): void {
    const dc = this.ctx;
    const sw = SCREEN_W * this.scale;
    const sh = SCREEN_H * this.scale;

    // Curvature effect: slight barrel distortion via a subtle border darkening
    const grad = dc.createRadialGradient(
      this.offsetX + sw / 2, this.offsetY + sh / 2, sw * 0.35,
      this.offsetX + sw / 2, this.offsetY + sh / 2, sw * 0.7,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    dc.fillStyle = grad;
    dc.fillRect(this.offsetX, this.offsetY, sw, sh);
  }

  // ---- UTILITY ----

  private getShaftX(shaft: 'A' | 'B' | 'C'): number {
    switch (shaft) {
      case 'A': return 120;
      case 'B': return 380;
      case 'C': return 620;
    }
  }

  private getStorePositions(): Record<string, { x: number; floor: FloorId }> {
    return {
      forever12: { x: 30, floor: FloorId.F4 },
      radioshock: { x: 180, floor: FloorId.F4 },
      crookstone: { x: 440, floor: FloorId.F4 },
      gamestonk: { x: 560, floor: FloorId.F4 },
      kgb_toys: { x: 30, floor: FloorId.F3 },
      blockbluster: { x: 180, floor: FloorId.F3 },
      spenders: { x: 560, floor: FloorId.F3 },
      sam_baddy: { x: 30, floor: FloorId.F2 },
      sharper_imagine: { x: 180, floor: FloorId.F2 },
      hot_spy: { x: 440, floor: FloorId.F2 },
      circuit_pity: { x: 560, floor: FloorId.F2 },
      foot_lockpicker: { x: 30, floor: FloorId.F1 },
      borderline: { x: 180, floor: FloorId.F1 },
    };
  }

  private getNearestFloor(y: number): FloorId {
    let best = FloorId.Roof;
    let bestDist = Infinity;
    for (let f = FloorId.Roof; f <= FloorId.Parking; f++) {
      const dist = Math.abs(y - getFloorY(f as FloorId));
      if (dist < bestDist) {
        bestDist = dist;
        best = f as FloorId;
      }
    }
    return best;
  }

  private getStoreFloorColor(theme: string): string {
    const colors: Record<string, string> = {
      fashion: '#2a1a2a',
      electronics: '#1a1a2a',
      toys: '#2a2a1a',
      food: '#2a2a2a',
      sports: '#1a2a1a',
      music: '#2a1a1a',
      gadgets: '#1a2a2a',
      novelty: '#1a0a2a',
      games: '#0a1a2a',
    };
    return colors[theme] || '#1a1a2a';
  }

  private getStoreWallColor(theme: string): string {
    const colors: Record<string, string> = {
      fashion: '#442244',
      electronics: '#224444',
      toys: '#444422',
      food: '#443322',
      sports: '#224422',
      music: '#442222',
      gadgets: '#224444',
      novelty: '#330044',
      games: '#112244',
    };
    return colors[theme] || '#333344';
  }

  private getStoreDirectionSprite(
    sprites: { down: SpriteData; up: SpriteData; left: SpriteData; right: SpriteData },
    dir: Direction,
  ): SpriteData {
    switch (dir) {
      case Direction.Up: return sprites.up;
      case Direction.Down: return sprites.down;
      case Direction.Left: return sprites.left;
      case Direction.Right: return sprites.right;
    }
  }

  private scrollStoreMarquee(storeId: string, frame: number): string {
    const store = STORES.find(s => s.id === storeId);
    if (!store) return '??';
    const name = store.name + '  ';
    const offset = Math.floor(frame / 10) % name.length;
    return (name + name).slice(offset, offset + 4);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  renderGallery(): void {
    const c = this.bufCtx;
    c.fillStyle = '#111111';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    this.drawText('SPRITE GALLERY', 80, 4, '#FFFFFF');

    const allSprites: { name: string; sprite: SpriteData }[] = [
      { name: 'AGENT', sprite: SPRITES.agent.mall.stand },
      { name: 'SPY', sprite: SPRITES.spy.mall.stand },
      { name: 'ELEV', sprite: SPRITES.elevator.closed },
      { name: 'COIN', sprite: SPRITES.coin },
      { name: 'PKG', sprite: SPRITES.package },
      { name: 'LAMP', sprite: SPRITES.lamp },
      { name: 'PLANT', sprite: SPRITES.plant },
      { name: 'BENCH', sprite: SPRITES.bench },
      { name: 'WAGON', sprite: SPRITES.stationWagon },
      { name: 'KIOSK', sprite: SPRITES.kiosk },
      { name: 'COP', sprite: SPRITES.mallCop },
      { name: 'JANITOR', sprite: SPRITES.janitor },
      { name: 'WALKER', sprite: SPRITES.mallWalker },
      { name: 'BOT', sprite: SPRITES.securityBot },
      { name: 'RAPID', sprite: SPRITES.powerUps.rapidFire },
      { name: 'SPREAD', sprite: SPRITES.powerUps.spreadShot },
      { name: 'ARMOR', sprite: SPRITES.powerUps.armorVest },
      { name: 'SNEAK', sprite: SPRITES.powerUps.sneakers },
      { name: 'RADAR', sprite: SPRITES.powerUps.radar },
      { name: '1UP', sprite: SPRITES.powerUps.oneUp },
    ];

    let x = 8;
    let y = 16;
    for (const { name, sprite } of allSprites) {
      this.drawSpriteData(sprite, x, y);
      this.drawText(name, x, y + sprite.height + 2, '#AAAAAA');
      x += Math.max(sprite.width, 20) + 8;
      if (x > SCREEN_W - 40) {
        x = 8;
        y += 40;
      }
    }

    const dc = this.ctx;
    dc.fillStyle = '#000000';
    dc.fillRect(0, 0, this.canvas.width, this.canvas.height);
    dc.imageSmoothingEnabled = false;
    dc.drawImage(
      this.buffer,
      0, 0, SCREEN_W, SCREEN_H,
      this.offsetX, this.offsetY,
      SCREEN_W * this.scale, SCREEN_H * this.scale,
    );
  }
}
