import { Container, Graphics, Sprite } from 'pixi.js';
import { MALL_W, MALL_H, SKY, floorTop, feetY } from '../world/constants.js';
import { SHAFTS, SHAFT_W, ESCALATORS, ESC_RUN, STORE_W, KIOSKS } from '../world/mallLevel.js';
import { makeSprite, tex, textureFromGrid } from '../gfx/textures.js';
import { tinyText } from '../gfx/sprites/tiny.js';
import { C } from '../gfx/palette.js';

const SIGN_COLOR = { target: C.red, powerup: C.blue, closed: C.darkGrey };

function tileRow(c, name, x0, x1, y) {
  for (let x = x0; x < x1; x += 8) { const s = makeSprite(name); s.position.set(x, y); c.addChild(s); }
}
function tileRect(c, name, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += 8) tileRow(c, name, x0, x1, y);
}
const put = (c, name, x, y, frame = 0) => { const s = makeSprite(name, frame); s.position.set(x, y); c.addChild(s); return s; };

export function signTexture(text, color) {
  return textureFromGrid(tinyText(text.toUpperCase(), '1'), [color]);
}

// Static parts of the mall, built once per level and cached as a texture.
export function buildMallBackground() {
  const c = new Container();
  // sky above the roof
  tileRect(c, 'sky', 0, 0, MALL_W, feetY(0));
  // roof slab
  tileRow(c, 'roofTile', 0, MALL_W, feetY(0));
  // shopping floors
  for (let f = 1; f <= 4; f++) {
    tileRect(c, 'wallBack', 0, floorTop(f), MALL_W, feetY(f));
    tileRow(c, 'ceiling', 0, MALL_W, floorTop(f));
    tileRow(c, 'floorTop', 0, MALL_W, feetY(f));
  }
  // parking level
  tileRect(c, 'parkingWall', 0, floorTop(5), MALL_W, feetY(5));
  tileRow(c, 'parkingFloor', 0, MALL_W, feetY(5));
  for (let x = 40; x < MALL_W; x += 128) tileRect(c, 'pillar', x, floorTop(5), x + 8, feetY(5));
  // outer walls
  c.addChild(new Graphics().rect(0, SKY, 8, MALL_H - SKY).fill(C.darkGrey).rect(MALL_W - 8, SKY, 8, MALL_H - SKY).fill(C.darkGrey));

  // escalators: a steel band on the diagonal with step lines, glass side panel and a black handrail
  for (const e of ESCALATORS) {
    const x0 = e.x - 6, x1 = e.x + ESC_RUN + 6, yb = feetY(e.bottomFloor), yt = feetY(e.topFloor);
    const g = new Graphics();
    g.poly([x0, yb - 20, x1, yt - 20, x1, yt, x0, yb]).fill({ color: C.sky, alpha: 0.35 });
    g.poly([x0, yb, x1, yt, x1, yt + 8, x0, yb + 8]).fill(C.grey);
    for (let i = 0; i <= ESC_RUN + 12; i += 4) g.rect(x0 + i, yb - i * ((yb - yt) / (x1 - x0)), 2, 2).fill(C.darkGrey);
    g.moveTo(x0, yb - 20).lineTo(x1, yt - 20).stroke({ width: 2, color: C.black });
    g.rect(x0 - 2, yb - 20, 3, 20).fill(C.black).rect(x1 - 1, yt - 20, 3, 20).fill(C.black);
    c.addChild(g);
  }

  // shafts: dark column through every floor the shaft serves, frame around each opening
  for (const sh of SHAFTS) {
    tileRect(c, 'shaftBg', sh.x, floorTop(sh.minFloor), sh.x + SHAFT_W, feetY(sh.maxFloor) + 8);
    for (let f = sh.minFloor; f <= sh.maxFloor; f++) put(c, 'shaftDoorFrame', sh.x - 4, floorTop(f));
  }

  // decor
  for (const k of KIOSKS) { put(c, 'kiosk', k.x - 8, feetY(k.floor) - 32); put(c, 'plant', k.x + 10, feetY(k.floor) - 24); }
  put(c, 'bench', 336, feetY(4) - 12);
  put(c, 'bench', 560, feetY(2) - 12);
  put(c, 'plant', 700, feetY(4) - 24);
  put(c, 'plant', 150, feetY(3) - 24);
  put(c, 'plant', 460, feetY(1) - 24);
  return c;
}

// One storefront: facade, sign, windows, door. Returns handles for per-frame updates.
export function buildStorefront(s, { blackFriday }) {
  const c = new Container();
  c.position.set(s.x, floorTop(s.floor));
  put(c, 'facade', 0, 0);
  const sign = new Sprite(signTexture(s.name, SIGN_COLOR[s.role]));
  sign.position.set(Math.floor((STORE_W - sign.width) / 2), 4);
  c.addChild(sign);
  const h = { container: c, store: s, windows: [], door: null, dim: [] };
  if (s.role === 'closed') {
    put(c, `disp_${s.id}`, 0, 12);
    return h;
  }
  h.windows.push(put(c, `disp_${s.id}_L`, 4, 14), put(c, `disp_${s.id}_R`, 52, 14));
  h.dim.push(put(c, 'windowLightOff', 4, 14), put(c, 'windowLightOff', 52, 14));
  h.door = put(c, s.role === 'target' ? 'doorRed' : 'doorBlue', 32, 16);
  if (blackFriday) put(c, 'saleSign', 28, 12);
  return h;
}

export function updateStorefront(h, state, t) {
  const { store: s } = h;
  if (s.role === 'closed') return;
  h.windows.forEach((w, i) => { w.texture = tex(`disp_${s.id}_${i ? 'R' : 'L'}`, Math.floor(t / 12)); });
  const cleared = state.cleared.has(s.id);
  h.dim.forEach((d) => { d.visible = cleared; });
  if (s.role === 'target') h.door.texture = cleared ? tex('doorDark') : tex('doorRed', Math.floor(t / 30) % 2);
}

// Sprite pool keyed by entity object.
export class EntityViews {
  constructor(parent) { this.parent = parent; this.map = new Map(); }
  sync(list, apply) {
    const seen = new Set();
    for (const e of list) {
      let s = this.map.get(e);
      if (!s) { s = new Sprite(); s.anchor.set(0.5, 1); this.parent.addChild(s); this.map.set(e, s); }
      seen.add(e);
      apply(e, s);
    }
    for (const [e, s] of this.map) if (!seen.has(e)) { s.destroy(); this.map.delete(e); }
  }
  clear() { for (const s of this.map.values()) s.destroy(); this.map.clear(); }
}

export { put };
