// ?gallery=1: every sprite, animated, in a grid. A quick way to eyeball the pixel art.
import { buildSprites } from './core/sprites';
import { Assets } from './render/assets';
import { drawText } from './render/text';
import { NES } from './core/palette';

export function drawGallery(g: CanvasRenderingContext2D, assets: Assets, frame: number): void {
  g.fillStyle = NES.nightA;
  g.fillRect(0, 0, 256, 240);
  const names = Object.keys(buildSprites());
  const cols = 8;
  names.forEach((name, i) => {
    const def = assets.defs[name];
    const x = 4 + (i % cols) * 31;
    const y = 18 + Math.floor(i / cols) * 34;
    g.fillStyle = NES.ink;
    g.fillRect(x - 1, y - 1, def.bitmap.w + 2, def.bitmap.h + 2);
    // Animate by flipping and bobbing every 30 frames.
    const bob = (frame >> 5) % 2;
    g.drawImage(assets.canvas(name, (frame >> 5) % 2 === 1 && name.startsWith('agent')), x, y + bob);
    drawText(g, name.slice(0, 5), x, y + 26, NES.silver, 1);
  });
}
