// Dev-only scratch page (see /preview.html): all 13 storefronts animated, plus title logo and backdrops.
import { STORES } from '../data/stores';
import { drawGarageBackdrop, drawMallInterior, drawNightSky, drawShutter } from './backdrops';
import { drawStorefrontRow, drawTitleLogo } from './logo';
import { drawStorefront } from './storefronts';
import { Surface } from './surface';

const COLS = 4;
const CELL_W = 84;
const CELL_H = 48;
const rows = Math.ceil(STORES.length / COLS);
const W = COLS * CELL_W + 4;
const H = rows * CELL_H + 4 + 240 + 8;
const surf = new Surface(W, H);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const out = canvas.getContext('2d')!;
const cleared = document.getElementById('cleared') as HTMLInputElement;
const bf = document.getElementById('bf') as HTMLInputElement;
const scaleSel = document.getElementById('scale') as HTMLSelectElement;
let tick = 0;

function frame(): void {
  surf.clear(0x1d);
  STORES.forEach((st, i) => {
    drawStorefront(surf, st.id, 4 + (i % COLS) * CELL_W, 4 + Math.floor(i / COLS) * CELL_H, { tick, cleared: cleared.checked, blackFriday: bf.checked });
  });
  const oy = rows * CELL_H + 8;
  drawNightSky(surf, 0, oy, 256, 240, tick);
  drawTitleLogo(surf, 128, oy + 20, tick);
  drawStorefrontRow(surf, oy + 120, tick, tick, bf.checked);
  drawMallInterior(surf, 0, oy + 180, 256, 48, 'parking', 0);
  drawShutter(surf, 260, oy + 20, 60, 100, (Math.sin(tick / 60) + 1) / 2);
  void drawGarageBackdrop;
  const s = Number(scaleSel.value);
  canvas.width = W * s;
  canvas.height = H * s;
  out.imageSmoothingEnabled = false;
  out.drawImage(surf.canvas, 0, 0, W * s, H * s);
  tick++;
  requestAnimationFrame(frame);
}
frame();
