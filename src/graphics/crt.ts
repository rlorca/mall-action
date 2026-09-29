const CRT_STORAGE_KEY = "mall_action_crt";

export class CRTFilter {
  private enabled: boolean = true;
  private bannerTimer: number = 0;
  private bannerText: string = "";

  constructor() {
    // Read persisted preference; default to true if unassigned
    const saved = localStorage.getItem(CRT_STORAGE_KEY);
    if (saved !== null) {
      this.enabled = saved === "true";
    } else {
      this.enabled = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem(CRT_STORAGE_KEY, String(this.enabled));
    this.bannerText = this.enabled ? "CRT ON" : "CRT OFF";
    this.bannerTimer = 120; // Show banner for 2 seconds (120 frames)
    return this.enabled;
  }

  public update(): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer--;
    }
  }

  /**
   * Post-processes 2D canvas context with scanlines, vignette, and curvature overlay.
   */
  public applyCanvas2D(ctx: CanvasRenderingContext2D, width: number, height: number, frameCount: number): void {
    if (this.enabled) {
      ctx.save();

      // Scanlines (subtle dark horizontal lines on alternate scanlines)
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      for (let y = 0; y < height; y += 2) {
        ctx.fillRect(0, y, width, 1);
      }

      // Vignette (radial dark gradient around edges)
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.35,
        width / 2, height / 2, width * 0.65
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle noise on alternate frames
      if (frameCount % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();
    }

    // Render ON/OFF Banner overlay if active
    if (this.bannerTimer > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(width / 2 - 40, 10, 80, 16);
      ctx.strokeStyle = "#FFFFFF";
      ctx.strokeRect(width / 2 - 40, 10, 80, 16);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.bannerText, width / 2, 18);
      ctx.restore();
    }
  }
}
