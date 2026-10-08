import type { Framebuffer } from '../engine/framebuffer';
import { Btn, type Pad } from '../engine/pad';
import { C } from '../engine/palette';
import { drawText, FONT_TINY } from '../engine/font';
import { allSprites } from '../art/registry';
import type { Sprite } from '../engine/sprite';

interface Placed {
  s: Sprite;
  x: number;
  y: number;
}

/** ?gallery=1: every registered sprite, animated, paged with Left / Right (or A / D). */
export class Gallery {
  frame = 0;
  page = 0;
  readonly pages: Placed[][];

  constructor() {
    const sprites = allSprites().sort((a, b) => a.name.localeCompare(b.name));
    this.pages = [[]];
    let x = 4;
    let y = 22;
    let rowH = 0;
    for (const s of sprites) {
      const cellW = Math.max(s.w, s.name.length * 4) + 4;
      if (x + cellW > 254) {
        x = 4;
        y += rowH + 12;
        rowH = 0;
      }
      if (y + s.h + 8 > 238) {
        this.pages.push([]);
        x = 4;
        y = 22;
        rowH = 0;
      }
      this.pages[this.pages.length - 1]!.push({ s, x, y });
      x += cellW;
      rowH = Math.max(rowH, s.h);
    }
  }

  step(pad: Pad): void {
    this.frame++;
    if (pad.pressed & Btn.RIGHT) this.page = (this.page + 1) % this.pages.length;
    if (pad.pressed & Btn.LEFT) this.page = (this.page + this.pages.length - 1) % this.pages.length;
  }

  draw(fb: Framebuffer): void {
    fb.clear(C.MDGRAY);
    for (let yy = 0; yy < 240; yy += 8) for (let xx = 0; xx < 256; xx += 8) if (((xx + yy) >> 3) & 1) fb.fillRect(xx, yy, 8, 8, C.GRAY);
    fb.fillRect(0, 0, 256, 16, C.BLACK);
    drawText(fb, `SPRITE GALLERY ${this.page + 1}/${this.pages.length}  <- ->`, 6, 4, C.WHITE);
    for (const p of this.pages[this.page]!) {
      const f = p.s.frames > 1 ? (this.frame >> 4) % p.s.frames : 0;
      fb.sprite(p.s, p.x, p.y, { frame: f });
      drawText(fb, p.s.name, p.x, p.y + p.s.h + 2, C.WHITE, { font: FONT_TINY, shadow: C.BLACK });
    }
  }
}
