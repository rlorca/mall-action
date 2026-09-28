import { Container, Graphics, Sprite } from 'pixi.js';
import { FLOORS, FLOOR_NAMES, MALL_W, SKY, PITCH, feetY } from '../world/constants.js';
import { SHAFTS, SHAFT_W, ESCALATORS, ESC_RUN, STORES, STORE_W, GETAWAY_CAR } from '../world/mallLevel.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { signTexture } from './mallView.js';

const ROLE_COLOR = { target: C.red, powerup: C.blue, closed: C.darkGrey };

// Draws the mall schematic into `g`/`c` for the box {x, y, w, h}. Used by the map overlay and the kiosk mini-map.
export function drawMallMap(c, state, world, { x, y, w, h, highlightStoreId = null, blink = true, labels = true }) {
  const g = new Graphics();
  c.addChild(g);
  const band = h / FLOORS;
  const mx = (wx) => x + (wx / MALL_W) * w;
  const my = (wy) => y + ((wy - SKY) / (FLOORS * PITCH)) * h;
  g.rect(x, y, w, h).fill(C.navy);
  for (let f = 0; f < FLOORS; f++) {
    g.rect(x, my(feetY(f)), w, 1).fill(C.sky);
    if (labels) { const t = makeText(FLOOR_NAMES[f], C.sky); t.position.set(x - 18, Math.round(my(feetY(f)) - 8)); c.addChild(t); }
  }
  for (const sh of SHAFTS) {
    const top = my(feetY(sh.minFloor) - 40), bot = my(feetY(sh.maxFloor));
    g.rect(mx(sh.x), top, Math.max(3, (SHAFT_W / MALL_W) * w), bot - top).fill(C.black);
    const car = world?.cars.find((k) => k.id === sh.id);
    if (car) g.rect(mx(car.x), my(car.y) - band * 0.7, Math.max(3, (SHAFT_W / MALL_W) * w), band * 0.7).fill(C.lightGrey);
  }
  for (const e of ESCALATORS) g.moveTo(mx(e.x), my(feetY(e.bottomFloor))).lineTo(mx(e.x + ESC_RUN), my(feetY(e.topFloor))).stroke({ width: 1, color: C.lightGrey });
  g.rect(mx(GETAWAY_CAR.x), my(feetY(GETAWAY_CAR.floor)) - band * 0.4, (GETAWAY_CAR.w / MALL_W) * w, band * 0.4).fill(C.yellow);
  for (const s of STORES) {
    const cleared = state.cleared.has(s.id);
    const hl = s.id === highlightStoreId;
    if (hl && !blink) continue;
    const color = hl ? C.white : s.role === 'target' ? (cleared ? C.grey : C.red) : ROLE_COLOR[s.role];
    const sx = mx(s.x), sw = (STORE_W / MALL_W) * w, sy = my(feetY(s.floor)) - band * 0.75;
    if (s.role === 'closed' && !hl) g.rect(sx, sy, sw, band * 0.7).stroke({ color: C.darkGrey, width: 1 });
    else g.rect(sx, sy, sw, band * 0.7).fill(color);
    if (state.power.radar && s.role === 'target' && !cleared) {
      const bang = new Sprite(signTexture('!', C.yellow)); bang.position.set(Math.round(sx + sw / 2 - 1), Math.round(sy - 6)); c.addChild(bang);
    }
  }
  const p = world?.player;
  if (p && !highlightStoreId && blink) g.rect(mx(p.x) - 1, my(p.y) - 4, 3, 4).fill(C.yellow);
  return c;
}

export class MapOverlay {
  constructor() { this.container = new Container(); }
  enter(ctx, { storeId = null } = {}) {
    this.ctx = ctx; this.storeId = storeId; this.t = 0;
    ctx.audio.sfx('pause'); ctx.audio.duck(true);
    this.draw();
  }
  draw() {
    const { ctx } = this;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    c.addChild(new Graphics().rect(0, 0, 256, 240).fill(C.black));
    const title = makeText('MALL DIRECTORY', C.yellow); title.position.set(72, 8); c.addChild(title);
    const blink = Math.floor(this.t / 15) % 2 === 0;
    drawMallMap(c, ctx.state, ctx.mallScene?.world, { x: 24, y: 28, w: 224, h: 150, highlightStoreId: this.storeId, blink });
    const legend = [['PACKAGE', C.red], ['CLEARED', C.grey], ['SHOP', C.blue]];
    legend.forEach(([label, col], i) => {
      c.addChild(new Graphics().rect(8 + i * 82, 188, 6, 6).fill(col));
      const t = makeText(label, C.white); t.position.set(18 + i * 82, 187); c.addChild(t);
    });
    const inv = ctx.state.inventory.length ? ctx.state.inventory.join(', ') : '-';
    const invText = makeText(`INVENTORY: ${inv}`.slice(0, 31), C.lightGrey); invText.position.set(4, 204); c.addChild(invText);
    const close = makeText('SELECT: CLOSE', C.white); close.position.set(76, 224); c.addChild(close);
  }
  update(ctx) {
    this.t++;
    if (this.t % 15 === 0) this.draw();
    if (ctx.pad.pressed('select') || ctx.pad.pressed('start')) ctx.scenes.pop();
  }
  exit(ctx) { ctx.audio.duck(false); }
}
