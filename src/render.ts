import { GameState, Screen } from './types';

const INTERNAL_WIDTH = 256;
const INTERNAL_HEIGHT = 240;
const HUD_HEIGHT = 16;

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = INTERNAL_WIDTH;
    this.canvas.height = INTERNAL_HEIGHT;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    this.ctx = ctx;
    this.scale = this.calculateScale();

    this.canvas.style.width = (INTERNAL_WIDTH * this.scale) + 'px';
    this.canvas.style.height = (INTERNAL_HEIGHT * this.scale) + 'px';
    this.canvas.style.imageRendering = 'pixelated';

    container.appendChild(this.canvas);

    window.addEventListener('resize', () => this.handleResize());
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
      this.canvas.style.width = (INTERNAL_WIDTH * this.scale) + 'px';
      this.canvas.style.height = (INTERNAL_HEIGHT * this.scale) + 'px';
    }
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
      case Screen.GameOver:
        this.renderGameOver(state);
        break;
    }
  }

  private renderSplash(state: GameState) {
    const elapsed = state.frame;

    // Simple flicker effect for "FLICKERSOFT"
    if (Math.floor(elapsed / 3) % 2 === 0) {
      this.drawText('FLICKERSOFT', INTERNAL_WIDTH / 2 - 40, 100, '#f0f');
    }

    if (elapsed > 60) {
      this.drawText('PRESENTS', INTERNAL_WIDTH / 2 - 30, 150, '#0f0');
    }
  }

  private renderTitle(state: GameState) {
    // Background
    for (let y = 0; y < INTERNAL_HEIGHT; y++) {
      const hue = (y / INTERNAL_HEIGHT) * 360;
      this.ctx.fillStyle = `hsl(${hue}, 100%, 30%)`;
      this.ctx.fillRect(0, y, INTERNAL_WIDTH, 1);
    }

    // Title text
    this.drawText('MALL ACTION', 40, 80, '#ff0');
    this.drawText('A SHOPPING MALL ESPIONAGE', 20, 100, '#fff');

    // High score
    this.drawText(`HIGH SCORE: ${state.player.score}`, 50, 160, '#fff');

    // Start prompt
    if ((state.frame % 20) < 10) {
      this.drawText('PRESS START', 60, 200, '#ff0');
    }
  }

  private renderMall(state: GameState) {
    // Sky gradient background
    for (let y = 0; y < 100; y++) {
      const hue = 200 - (y / 100) * 20;
      const light = 50 - (y / 100) * 30;
      this.ctx.fillStyle = `hsl(${hue}, 100%, ${light}%)`;
      this.ctx.fillRect(0, y, INTERNAL_WIDTH, 1);
    }

    // Ground
    this.ctx.fillStyle = '#888';
    this.ctx.fillRect(0, 100, INTERNAL_WIDTH, INTERNAL_HEIGHT - 100);

    // Draw player (simple rectangle for now)
    this.ctx.fillStyle = '#f00';
    this.ctx.fillRect(state.player.x - 8, state.player.y - 16, 16, 24);

    // Draw spies
    this.ctx.fillStyle = '#333';
    state.spies.forEach(spy => {
      if (spy.alive && spy.floor === state.player.floor) {
        this.ctx.fillRect(spy.x - 8, spy.y - 12, 16, 24);
      }
    });

    // Draw bullets
    this.ctx.fillStyle = '#ff0';
    state.bullets.forEach(bullet => {
      if (bullet.floor === state.player.floor) {
        this.ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
      }
    });

    // HUD
    this.drawHUD(state);
  }

  private renderStore(state: GameState) {
    this.ctx.fillStyle = '#8f8';
    this.ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    this.drawText('STORE', 100, 50, '#000');
    this.drawHUD(state);
  }

  private renderLevelClear(state: GameState) {
    this.ctx.fillStyle = '#00f';
    this.ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    this.drawText('LEVEL CLEAR', 50, 80, '#fff');
    this.drawText(`SCORE: ${state.player.score}`, 60, 110, '#fff');
    this.drawText(`LOOP: ${state.loop}`, 80, 140, '#fff');
    this.drawText('PRESS START', 60, 200, '#ff0');
  }

  private renderGameOver(state: GameState) {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

    this.drawText('GAME OVER', 70, 100, '#f00');
    this.drawText(`FINAL SCORE: ${state.player.score}`, 40, 150, '#fff');
    this.drawText('PRESS START', 60, 200, '#ff0');
  }

  private drawHUD(state: GameState) {
    this.ctx.fillStyle = '#223';
    this.ctx.fillRect(0, 0, INTERNAL_WIDTH, HUD_HEIGHT);

    this.drawText(`SCORE:${state.player.score.toString().padStart(6)}`, 2, 8, '#fff');
    this.drawText(`PKG:${state.player.packages}/6`, 100, 8, state.player.packages === 6 ? '#0f0' : '#f00');
    this.drawText(`LIVES:${state.player.lives}`, 160, 8, '#fff');
  }

  private drawText(text: string, x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.font = '8px monospace';
    this.ctx.fillText(text, x, y);
  }
}
