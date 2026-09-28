import { Container, Graphics, Sprite } from 'pixi.js';
import { makeText, setText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { spriteNames, frames } from '../gfx/textures.js';

const CELL = 32, COLS = 8, ROWS = 6, PER_PAGE = COLS * ROWS;

// Debug sprite sheet (?gallery=1[&page=N]): every registered sprite, animated; arrows move the cursor.
export class GalleryScene {
  constructor(page = 0) { this.container = new Container(); this.page = page; this.cursor = 0; }
  enter() { this.t = 0; this.build(); }
  build() {
    const c = this.container;
    c.removeChildren();
    c.addChild(new Graphics().rect(0, 0, 256, 240).fill(C.darkGrey));
    this.names = spriteNames();
    this.pageNames = this.names.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.cells = this.pageNames.map((name, i) => {
      const s = new Sprite(frames(name)[0]);
      const scale = s.width > CELL || s.height > CELL ? Math.min(CELL / s.width, CELL / s.height) : 1;
      s.scale.set(scale);
      s.position.set((i % COLS) * CELL + Math.floor((CELL - s.width) / 2), Math.floor(i / COLS) * CELL + Math.floor((CELL - s.height) / 2));
      c.addChild(s);
      return { name, s };
    });
    this.box = new Graphics(); c.addChild(this.box);
    this.label = makeText(''); this.label.position.set(0, 200); c.addChild(this.label);
    const pages = Math.ceil(this.names.length / PER_PAGE);
    const info = makeText(`PAGE ${this.page + 1}/${pages}  START=NEXT`, C.lightGrey); info.position.set(0, 224); c.addChild(info);
  }
  update(ctx) {
    this.t++;
    for (const { name, s } of this.cells) { const f = frames(name); s.texture = f[Math.floor(this.t / 12) % f.length]; }
    const p = ctx.pad;
    if (p.pressed('right')) this.cursor++;
    if (p.pressed('left')) this.cursor--;
    if (p.pressed('down')) this.cursor += COLS;
    if (p.pressed('up')) this.cursor -= COLS;
    this.cursor = Math.max(0, Math.min(this.cells.length - 1, this.cursor));
    if (p.pressed('start')) { this.page = (this.page + 1) % Math.ceil(this.names.length / PER_PAGE); this.cursor = 0; this.build(); }
    const x = (this.cursor % COLS) * CELL, y = Math.floor(this.cursor / COLS) * CELL;
    this.box.clear().rect(x, y, CELL, CELL).stroke({ color: 0xffff00, width: 1 });
    setText(this.label, this.cells[this.cursor]?.name ?? '');
  }
  exit() {}
}
