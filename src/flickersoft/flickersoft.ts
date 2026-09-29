import { drawPixelText } from "../graphics/sprites";
import { PAL } from "../graphics/palette";
import { VirtualPadState } from "../input/input";

export interface FlickersoftSplashOptions {
  width?: number;
  height?: number;
  onComplete?: () => void;
}

/**
 * Reusable FLICKERSOFT Splash Screen Module.
 * Animates a retro NES hardware scanline flicker effect for the FLICKERSOFT logo.
 */
export class FlickersoftSplash {
  private frameCount: number = 0;
  private finished: boolean = false;
  private onComplete?: () => void;
  private readonly totalDuration: number = 240; // 4 seconds total at 60Hz

  private readonly letterColors = [
    PAL.RED, PAL.ORANGE, PAL.YELLOW, PAL.GREEN,
    PAL.CYAN, PAL.BLUE, PAL.MAGENTA, PAL.HOT_PINK,
    PAL.LIGHT_CYAN, PAL.LIGHT_GREEN, PAL.GOLD
  ];

  constructor(options: FlickersoftSplashOptions = {}) {
    this.onComplete = options.onComplete;
  }

  public isFinished(): boolean {
    return this.finished;
  }

  public update(pad: VirtualPadState): void {
    if (this.finished) return;

    this.frameCount++;

    // Any button skips the splash
    const anyPressed = pad.a || pad.b || pad.start || pad.select || pad.up || pad.down || pad.left || pad.right;
    if (anyPressed && this.frameCount > 5) {
      this.finish();
      return;
    }

    if (this.frameCount >= this.totalDuration) {
      this.finish();
    }
  }

  public finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.onComplete) {
      this.onComplete();
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number = 256, height: number = 240): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, width, height);

    const logoText = "FLICKERSOFT";
    const startX = Math.round(width / 2 - (logoText.length * 6) / 2);
    const startY = Math.round(height / 2 - 16);

    const isFlickerPhase = this.frameCount < 60;

    // Draw FLICKERSOFT logo letters
    for (let i = 0; i < logoText.length; i++) {
      const char = logoText[i];
      const color = this.letterColors[i % this.letterColors.length];

      // Scanline flicker emulation: alternating odd/even frame visibility per letter
      if (isFlickerPhase) {
        const visible = (this.frameCount + i) % 2 === 0;
        if (!visible) continue;
      }

      drawPixelText(ctx, char, startX + i * 6, startY, color);
    }

    // Solid phase: underline & "PRESENTS" text
    if (this.frameCount >= 60) {
      // Underline
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(startX, startY + 8, logoText.length * 6 - 1, 1);

      if (this.frameCount >= 100) {
        drawPixelText(ctx, "PRESENTS", width / 2 - 24, startY + 20, PAL.LIGHT_GRAY);
      }
    }
  }

  public reset(): void {
    this.frameCount = 0;
    this.finished = false;
  }
}
