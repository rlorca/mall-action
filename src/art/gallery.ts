// Sprite gallery (?gallery=1): every sprite in ALL_SPRITES, animated at ~8 fps, paged. Left/Right to page.
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import { ALL_SPRITES } from './registry';
import { Surface } from './surface';
import type { SpriteDef } from './pixel';

const W = SCREEN_W * 2;
const H = SCREEN_H * 2;
const HEADER = 20;
const MARGIN = 6;
const PAD = 4;
const FPS = 8;

interface Cell {
  sprite: SpriteDef;
  x: number;
  y: number;
  w: number;
  scale: number;
}

function scaleFor(s: SpriteDef): number {
  return Math.max(1, Math.min(4, Math.floor(56 / s.w), Math.floor(56 / s.h)));
}

/** Flow the sprites into pages of cells. Never returns zero pages. */
function layout(sprites: SpriteDef[], surface: Surface): Cell[][] {
  const pages: Cell[][] = [[]];
  let x = MARGIN;
  let y = HEADER + MARGIN;
  let rowH = 0;
  for (const s of sprites) {
    const scale = scaleFor(s);
    const nameW = surface.textWidth(s.name.toUpperCase(), true);
    const cw = Math.max(s.w * scale, nameW) + PAD * 2;
    const ch = s.h * scale + 6 + PAD * 2;
    if (x + cw > W - MARGIN) {
      x = MARGIN;
      y += rowH;
      rowH = 0;
    }
    if (y + ch > H - MARGIN) {
      pages.push([]);
      x = MARGIN;
      y = HEADER + MARGIN;
      rowH = 0;
    }
    pages[pages.length - 1].push({ sprite: s, x, y, w: cw, scale });
    x += cw + 2;
    rowH = Math.max(rowH, ch + 2);
  }
  return pages;
}

export function mountGallery(canvas: HTMLCanvasElement): void {
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext('2d');
  if (!out) throw new Error('2D canvas unavailable');
  out.imageSmoothingEnabled = false;
  const surface = new Surface(W, H);
  const pages = layout(ALL_SPRITES, surface);
  let page = 0;
  const flip = (d: number): void => {
    page = (page + d + pages.length) % pages.length;
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'PageDown') flip(1);
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'PageUp') flip(-1);
    else return;
    e.preventDefault();
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    flip(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });

  const draw = (now: number): void => {
    const tick = Math.floor((now / 1000) * FPS);
    surface.clear(C.GRAY_DD);
    surface.rect(0, 0, W, HEADER, C.BLACK);
    surface.text(`SPRITES ${page + 1}/${pages.length}  (${ALL_SPRITES.length})`, MARGIN, 6, C.WHITE);
    surface.text('< > PAGE', W - MARGIN, 6, C.YELLOW, { align: 'right' });
    for (const c of pages[page]) {
      const s = c.sprite;
      const h = s.h * c.scale + 6 + PAD * 2;
      surface.rect(c.x, c.y, c.w, h, C.GRAY_D);
      surface.frame(c.x, c.y, c.w, h, C.BLACK);
      const sx = c.x + Math.floor((c.w - s.w * c.scale) / 2);
      surface.spriteScaled(s, sx, c.y + PAD, c.scale, { frame: tick % s.frames.length });
      const label = s.frames.length > 1 ? `${s.name.toUpperCase()}` : s.name.toUpperCase();
      surface.text(label, c.x + c.w / 2, c.y + PAD + s.h * c.scale + 2, C.WHITE, { small: true, align: 'center' });
    }
    out.drawImage(surface.canvas, 0, 0);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
