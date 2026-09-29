/** ?gallery=1 : every sprite, animated, with its name. Scrolls with the arrow keys. */
import { C } from '../core/palette';
import { TINY_FONT } from '../core/font';
import { SPRITE_DEFS } from '../art/sprites';
import { Gfx, SCREEN_W } from './gfx';

/** Groups sprites into animations: name_0, name_1 ... become one animated entry. */
export function galleryEntries(): { base: string; frames: string[] }[] {
  const map = new Map<string, string[]>();
  for (const name of Object.keys(SPRITE_DEFS)) {
    const m = /^(.*)_(\d+)$/.exec(name);
    const base = m ? m[1] : name;
    const list = map.get(base) ?? [];
    list.push(name);
    map.set(base, list);
  }
  return [...map.entries()].map(([base, frames]) => ({ base, frames: frames.sort() }));
}

export function drawGallery(gx: Gfx, t: number, scroll: number): void {
  gx.clear(C.DGREY);
  const entries = galleryEntries();
  let x = 4;
  let y = 14 - scroll;
  let rowH = 0;
  gx.text(`SPRITE GALLERY (${Object.keys(SPRITE_DEFS).length})  ARROWS SCROLL`, 4, 3 - scroll, C.WHITE, { font: TINY_FONT });
  for (const e of entries) {
    const name = e.frames[Math.floor(t / 12) % e.frames.length];
    const s = gx.sprite(name)!;
    const cellW = Math.max(s.w, Math.min(64, e.base.length * 4)) + 6;
    const cellH = s.h + 10;
    if (x + cellW > SCREEN_W) {
      x = 4;
      y += rowH;
      rowH = 0;
    }
    gx.rect(x, y, s.w, s.h, C.GREY);
    gx.spr(name, x, y);
    gx.text(e.base.slice(0, 16), x, y + s.h + 2, C.LGREY, { font: TINY_FONT });
    x += cellW;
    rowH = Math.max(rowH, cellH);
  }
}
