// CRT post-effect: scanlines, vignette, slight noise and a subtle curvature
// (corner darkening). Applied as an overlay on the scaled image.

export interface CrtOptions {
  enabled: boolean;
}

export function drawCrt(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
): void {
  // Scanlines.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < h; y += 2) {
    ctx.fillRect(0, y, w, 1);
  }

  // Vignette.
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.9);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Slight noise (deterministic-ish flicker).
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  const seed = frame;
  for (let i = 0; i < 40; i++) {
    const x = ((seed * 2654435761 + i * 40503) >>> 0) % w;
    const y = ((seed * 2246822519 + i * 1013904223) >>> 0) % h;
    ctx.fillRect(x, y, 1, 1);
  }
}
