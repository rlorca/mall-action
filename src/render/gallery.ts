import { Gfx } from './gfx';
import { allSprites } from '../art/index';

/** ?gallery=1: every sprite, animated, page by page (Left/Right or Space to change page). Returns the clamped page. */
export function drawGallery(g: Gfx, frame: number, page: number): number {
  const list = allSprites();
  g.clear(0x2d);
  // lay sprites out in rows (greedy)
  const cellPad = 3;
  const pages: { s: (typeof list)[number]; x: number; y: number; cw: number }[][] = [[]];
  let x = 4;
  let y = 14;
  let rowH = 0;
  const labelOf = (n: string) => (n.length > 11 ? n.slice(-11) : n);
  for (const s of list) {
    const w = Math.max(s.w, g.measure(labelOf(s.name), { font: 3 })) + cellPad * 2;
    const h = s.h + cellPad * 2 + 7;
    if (x + w > 252) {
      x = 4;
      y += rowH;
      rowH = 0;
    }
    if (y + h > 238) {
      pages.push([]);
      x = 4;
      y = 14;
      rowH = 0;
    }
    pages[pages.length - 1].push({ s, x: x + cellPad, y: y + cellPad, cw: w - cellPad * 2 });
    x += w;
    rowH = Math.max(rowH, h);
  }
  page = Math.min(page, pages.length - 1);
  g.rect(0, 0, 256, 11, 0x0f);
  g.text(`SPRITE GALLERY ${page + 1}/${pages.length}  ${list.length} SPRITES  <- ->`, 4, 2, 0x30, { font: 5 });
  for (const it of pages[page]) {
    g.rect(it.x - 1, it.y - 1, it.s.w + 2, it.s.h + 2, 0x1a);
    g.sprite(it.s.name, Math.floor(frame / 12), it.x, it.y);
    g.text(labelOf(it.s.name), it.x, it.y + it.s.h + 2, 0x38, { font: 3 });
  }
  return page;
}
