import { GameState, Screen } from './types';
import { PALETTE } from './data';
import { Art } from './art';

const INTERNAL_WIDTH = 256;
const INTERNAL_HEIGHT = 240;
const HUD_HEIGHT = 16;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private crtCanvas: HTMLCanvasElement;
  private crtCtx: CanvasRenderingContext2D;
  private scale: number;
  private showCRT: boolean;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = INTERNAL_WIDTH;
    this.canvas.height = INTERNAL_HEIGHT;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;

    // CRT overlay canvas
    this.crtCanvas = document.createElement('canvas');
    this.crtCanvas.width = INTERNAL_WIDTH;
    this.crtCanvas.height = INTERNAL_HEIGHT;
    const crtCtx = this.crtCanvas.getContext('2d');
    if (!crtCtx) throw new Error('Could not get CRT context');
    this.crtCtx = crtCtx;

    this.scale = this.calculateScale();
    this.showCRT = true; // Default ON

    this.setupCanvas();
    this.generateCRTOverlay();
    container.appendChild(this.canvas);

    window.addEventListener('resize', () => this.handleResize());
  }

  private setupCanvas() {
    this.canvas.style.width = (INTERNAL_WIDTH * this.scale) + 'px';
    this.canvas.style.height = (INTERNAL_HEIGHT * this.scale) + 'px';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
  }

  private calculateScale(): number {
    const maxScale = Math.min(
      Math.floor(window.innerWidth / INTERNAL_WIDTH),
      Math.floor(window.innerHeight / INTERNAL_HEIGHT)
    );
    return Math.max(1, maxScale);
  }

  private handleResize() {
    const newScale = this.calculateScale();
    if (newScale !== this.scale) {
      this.scale = newScale;
      this.setupCanvas();
    }
  }

  private generateCRTOverlay() {
    // Create scanlines and vignette effect
    const imageData = this.crtCtx.createImageData(INTERNAL_WIDTH, INTERNAL_HEIGHT);
    const data = imageData.data;

    for (let y = 0; y < INTERNAL_HEIGHT; y++) {
      for (let x = 0; x < INTERNAL_WIDTH; x++) {
        const idx = (y * INTERNAL_WIDTH + x) * 4;

        // Scanline effect (every other line slightly darker)
        const scanlineAlpha = (y % 2 === 0) ? 0.8 : 0.9;

        // Vignette effect (edges darker)
        const vx = x / INTERNAL_WIDTH - 0.5;
        const vy = y / INTERNAL_HEIGHT - 0.5;
        const vignetteAlpha = Math.max(0.3, 1 - Math.sqrt(vx * vx + vy * vy) * 0.8);

        data[idx] = 0;     // R
        data[idx + 1] = 0; // G
        data[idx + 2] = 0; // B
        data[idx + 3] = Math.round(255 * (1 - scanlineAlpha * vignetteAlpha) * 0.3);
      }
    }

    this.crtCtx.putImageData(imageData, 0, 0);
  }

  render(state: GameState) {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    switch (state.screen) {
      case Screen.Splash:
        this.renderSplash(state);
        break;
      case Screen.Title:
        this.renderTitle(state);
        break;
      case Screen.Mall:
        this.renderMall(state);
        break;
      case Screen.Store:
        this.renderStore(state);
        break;
      case Screen.LevelClear:
        this.renderLevelClear(state);
        break;
      case Screen.Continue:
        this.renderContinue(state);
        break;
      case Screen.GameOver:
        this.renderGameOver(state);
        break;
    }

    // Apply CRT effect if enabled
    if (this.showCRT) {
      this.ctx.drawImage(this.crtCanvas, 0, 0);
    }
  }

  private renderSplash(state: GameState) {
    const elapsed = state.frame;
    const ctx = this.ctx;

    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    // FLICKERSOFT text with flicker
    const letters = 'FLICKERSOFT';
    const letterWidth = 16;
    const startX = (INTERNAL_WIDTH - letters.length * letterWidth) / 2;
    const y = 100;

    for (let i = 0; i < letters.length; i++) {
      const flicker = Math.floor(elapsed / 3) % (letters.length * 2);
      const shouldShow = Math.abs(flicker - i) < 3 || elapsed > 120;

      if (shouldShow) {
        const hues = ['#f0f', '#0ff', '#ff0', '#f00', '#0f0'];
        ctx.fillStyle = hues[i % hues.length];
        ctx.font = 'bold 16px monospace';
        ctx.fillText(letters[i], startX + i * letterWidth, y);
      }
    }

    // PRESENTS text after delay
    if (elapsed > 60) {
      ctx.fillStyle = '#0f0';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRESENTS', INTERNAL_WIDTH / 2, 150);
    }

    ctx.textAlign = 'left';
  }

  private renderTitle(state: GameState) {
    const ctx = this.ctx;

    // Night sky gradient
    for (let y = 0; y < 150; y++) {
      const ratio = y / 150;
      const hue = 220 - ratio * 40;
      const light = 40 - ratio * 20;
      ctx.fillStyle = `hsl(${hue}, 60%, ${light}%)`;
      ctx.fillRect(0, y, INTERNAL_WIDTH, 1);
    }

    // Ground
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 150, INTERNAL_WIDTH, INTERNAL_HEIGHT - 150);

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MALL ACTION', INTERNAL_WIDTH / 2, 60);

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('A SHOPPING MALL ESPIONAGE', INTERNAL_WIDTH / 2, 80);

    // High score
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`(C) 2026 FLICKERSOFT`, 20, INTERNAL_HEIGHT - 30);
    ctx.fillText(`HIGH SCORE: ${state.player.score.toString().padStart(6)}`, 20, INTERNAL_HEIGHT - 16);

    // Start prompt (blinking)
    ctx.fillStyle = (state.frame % 20) < 10 ? '#ff0' : '#000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS START', INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 20);

    ctx.textAlign = 'left';
  }

  private renderMall(state: GameState) {
    const ctx = this.ctx;

    // Sky gradient background
    for (let y = 0; y < 120; y++) {
      const hue = 200 - (y / 120) * 40;
      const light = 60 - (y / 120) * 30;
      ctx.fillStyle = `hsl(${hue}, 80%, ${light}%)`;
      ctx.fillRect(0, y, INTERNAL_WIDTH, 1);
    }

    // Ground/mall floors
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 120, INTERNAL_WIDTH, INTERNAL_HEIGHT - 120);

    // Floor lines
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let f = 0; f < 6; f++) {
      const y = 120 + f * 20;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(INTERNAL_WIDTH, y);
      ctx.stroke();
    }

    // Draw player (use simple sprite for now)
    ctx.fillStyle = '#f00';
    ctx.fillRect(
      Math.round(state.player.x - 8),
      Math.round(state.player.y - 16),
      16,
      24
    );

    // Draw spies
    ctx.fillStyle = '#333';
    state.spies.forEach(spy => {
      if (spy.alive && spy.floor === state.player.floor) {
        ctx.fillRect(
          Math.round(spy.x - 8),
          Math.round(spy.y - 12),
          16,
          24
        );
      }
    });

    // Draw bullets
    ctx.fillStyle = '#ff0';
    state.bullets.forEach(bullet => {
      if (bullet.floor === state.player.floor) {
        ctx.fillRect(
          Math.round(bullet.x - 2),
          Math.round(bullet.y - 2),
          4,
          4
        );
      }
    });

    // HUD
    this.drawHUD(state);
  }

  private renderStore(state: GameState) {
    const ctx = this.ctx;
    const storeRoom = (state as any).currentStore;

    if (!storeRoom) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
      return;
    }

    // Top-down view with tiles
    const tileSize = 16;

    // Floor background based on theme
    const themeColors: Record<string, string> = {
      'fashion': '#daa', 'electronics': '#aad', 'toys': '#ada', 'music': '#dda',
      'sports': '#aaa', 'food': '#fd9', 'gadgets': '#ffa', 'novelty': '#88f',
      'games': '#fda', 'video': '#888', 'books': '#dba',
    };
    ctx.fillStyle = themeColors[storeRoom.theme] || '#ccc';
    ctx.fillRect(0, HUD_HEIGHT, INTERNAL_WIDTH, INTERNAL_HEIGHT - HUD_HEIGHT);

    // Grid
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 16; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, HUD_HEIGHT);
      ctx.lineTo(x * tileSize, INTERNAL_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= 11; y++) {
      ctx.beginPath();
      ctx.moveTo(0, HUD_HEIGHT + y * tileSize);
      ctx.lineTo(INTERNAL_WIDTH, HUD_HEIGHT + y * tileSize);
      ctx.stroke();
    }

    // Draw fixtures
    storeRoom.fixtures.forEach((fixture: any) => {
      const x = fixture.x * tileSize;
      const y = HUD_HEIGHT + fixture.y * tileSize;
      ctx.fillStyle = fixture.opened ? '#9a9' : '#7a7';
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
    });

    // Draw player
    ctx.fillStyle = '#f00';
    const playerX = storeRoom.playerX * tileSize + 2;
    const playerY = HUD_HEIGHT + storeRoom.playerY * tileSize + 2;
    ctx.fillRect(playerX, playerY, 12, 12);

    // Door (bottom center)
    ctx.fillStyle = '#8b4';
    ctx.fillRect(7 * tileSize, HUD_HEIGHT + 10 * tileSize, 2 * tileSize, tileSize);

    // HUD
    this.drawHUD(state);
  }

  private renderLevelClear(state: GameState) {
    const ctx = this.ctx;

    // Parking garage backdrop
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    // Grid effect
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let x = 0; x < INTERNAL_WIDTH; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, INTERNAL_HEIGHT);
      ctx.stroke();
    }

    // Text
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL CLEAR', INTERNAL_WIDTH / 2, 60);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`SCORE: ${state.player.score}`, INTERNAL_WIDTH / 2, 100);
    ctx.fillText(`PACKAGES: ${state.player.packages}/6`, INTERNAL_WIDTH / 2, 120);
    ctx.fillText(`LOOP: ${state.loop}`, INTERNAL_WIDTH / 2, 140);

    ctx.fillStyle = (state.frame % 20) < 10 ? '#ff0' : '#000';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('PRESS START', INTERNAL_WIDTH / 2, 200);

    ctx.textAlign = 'left';
  }

  private renderContinue(state: GameState) {
    const ctx = this.ctx;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    // Blinking "CONTINUE?" text
    if ((state.frame % 10) < 5) {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CONTINUE?', INTERNAL_WIDTH / 2, 80);
    }

    // Countdown timer (9 to 0)
    const countdown = Math.max(0, 9 - Math.floor((state.frame - 30) / 60));
    ctx.fillStyle = countdown > 3 ? '#fff' : '#f00';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(countdown.toString(), INTERNAL_WIDTH / 2, 150);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`CONTINUES LEFT: ${state.continues}`, INTERNAL_WIDTH / 2, 200);

    ctx.textAlign = 'left';
  }

  private renderGameOver(state: GameState) {
    const ctx = this.ctx;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    ctx.fillStyle = '#f00';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', INTERNAL_WIDTH / 2, 80);

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`FINAL SCORE: ${state.player.score}`, INTERNAL_WIDTH / 2, 120);
    ctx.fillText(`LOOP: ${state.loop}`, INTERNAL_WIDTH / 2, 140);

    ctx.fillStyle = (state.frame % 20) < 10 ? '#ff0' : '#000';
    ctx.fillText('PRESS START', INTERNAL_WIDTH / 2, 200);

    ctx.textAlign = 'left';
  }

  private drawHUD(state: GameState) {
    const ctx = this.ctx;

    // HUD background
    ctx.fillStyle = '#223';
    ctx.fillRect(0, 0, INTERNAL_WIDTH, HUD_HEIGHT);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE:${state.player.score.toString().padStart(6)}`, 4, 12);

    // Packages
    const pkgColor = state.player.packages === 6 ? '#0f0' : '#f00';
    ctx.fillStyle = pkgColor;
    ctx.fillText(`PKG:${state.player.packages}/6`, 100, 12);

    // Lives
    ctx.fillStyle = '#fff';
    ctx.fillText(`LIVES:${state.player.lives}`, 160, 12);

    // Power-up display
    if (state.powerUps.size > 0) {
      ctx.fillStyle = '#0f0';
      let offset = 220;
      state.powerUps.forEach((time, name) => {
        ctx.fillText(name.substring(0, 3), offset, 12);
        offset += 20;
      });
    }

    ctx.textAlign = 'left';
  }
}
