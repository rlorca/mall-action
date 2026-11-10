/** Storefronts: sign, role-coloured door and animated window displays that show what is sold. */
import { Fb } from '../gfx/fb';
import { DARK } from '../gfx/palette';
import { Pr } from '../gfx/props';
import { STORE_W, type StoreDef } from '../game/level';
import { TEXT } from '../game/copy';

export const SF_H = 44;
const GLASS = 0x1c;

function shutter(fb: Fb, x: number, y: number, w: number, h: number): void {
  fb.rect(x, y, w, h, 0x10);
  for (let yy = y + 1; yy < y + h; yy += 3) fb.rect(x, yy, w, 1, 0x00);
}

/** One 24x24 window display. fr = animation frame counter. */
function display(fb: Fb, key: string, side: number, ox: number, oy: number, fr: number, rm: Uint8Array | null): void {
  const a2 = Math.floor(fr / 16) % 2;
  const a3 = Math.floor(fr / 12) % 3;
  const d = (name: string, x: number, y: number, flip = false) => fb.spr(Pr('d_' + name), ox + x, oy + y, flip, rm);
  const c = (col: number) => (rm ? rm[col] : col);
  switch (key + side) {
    case 'forever0': d('mannequin', 2, 7); d('mannequin', 14, 7, true); break;
    case 'forever1': d('rack', 2, 11); break;
    case 'radio0': d(a2 ? 'tv' : 'tv2', 1, 3); d(a2 ? 'tv2' : 'tv', 13, 3); d(a2 ? 'tv2' : 'tv', 1, 13); d(a2 ? 'tv' : 'tv2', 13, 13); break;
    case 'radio1': d('walkie', 4, 11); d('walkie', 14, 11); if (a2) { fb.pset(ox + 5, oy + 9, c(0x16)); fb.pset(ox + 15, oy + 9, c(0x2a)); } break;
    case 'crook0': d('chair', 5 + (a3 === 1 ? 1 : 0), 8); if (a3 !== 0) { fb.pset(ox + 3, oy + 12, c(0x30)); fb.pset(ox + 21, oy + 14, c(0x30)); } break;
    case 'crook1': d('gadget', 2, 11); d('gadget', 14, 11); if (a2) fb.pset(ox + 6, oy + 9, c(0x30)); else fb.pset(ox + 18, oy + 9, c(0x30)); break;
    case 'gamestonk0': d('console', 4, 10); fb.pset(ox + 7, oy + 15, c(a2 ? 0x16 : 0x2a)); break;
    case 'gamestonk1':
      fb.rect(ox + 0, oy + 0, 24, 13, c(0x02));
      fb.tiny(TEXT.toTheMoon.slice(0, 6), ox + 1, oy + 1, c(0x28));
      fb.tiny(TEXT.toTheMoon.slice(7), ox + 5, oy + 7, c(0x28));
      d('rocket', 0, 12 - (a2 ? 1 : 0));
      d(a2 ? 'tv' : 'tv2', 13, 15);
      break;
    case 'kgb0': d('teddy', 1, 10); d('teddy', 13, 10 - a2); break;
    case 'kgb1': d('robot', 2, 10); d('rocket', 11, 11 - a2); break;
    case 'spender0': d(a2 ? 'lava' : 'lava2', 3, 7); d(a2 ? 'lava2' : 'lava', 14, 7); break;
    case 'spender1': d(a3 === 1 ? 'plasma2' : 'plasma', 6, 9); break;
    case 'sam0': d('tape', 11, 3); d('vinyl', 1, 10); d('tape', 12, 15); break;
    case 'sam1': d('boombox', 2, 12 - a2); fb.pset(ox + 4 + a2 * 2, oy + 8, c(0x30)); fb.pset(ox + 18 - a2 * 2, oy + 6, c(0x30)); break;
    case 'sharper0': { const k = Math.floor(fr / 6) % 24; d('vacuum', k < 12 ? k : 24 - k, 17); fb.rect(ox, oy + 23, 24, 1, c(0x10)); break; }
    case 'sharper1': d('orb', 6, 8); if (a3 === 1) fb.frame(ox + 4, oy + 6, 16, 16, c(0x3c)); if (a3 === 2) fb.frame(ox + 2, oy + 4, 20, 20, c(0x2c)); break;
    case 'hotspy0': d('lemonade', 5, 10); fb.rect(ox + 9, oy + 5 + a2 * 3, 6, 2, c(0x30)); break;
    case 'hotspy1': d('corndog', 3, 8 + (a3 === 0 ? 1 : 0)); d('corndog', 10, 8 + (a3 === 1 ? 1 : 0)); d('corndog', 17, 8 + (a3 === 2 ? 1 : 0)); break;
    case 'foot0': for (let r = 0; r < 3; r++) { d('sneaker', 1, 2 + r * 7); d('sneaker', 13, 2 + r * 7); fb.rect(ox, oy + 7 + r * 7, 24, 1, c(0x10)); } break;
    case 'foot1': d('jersey', 6, 1); d('ball', 2, 15 - (a3 === 1 ? 2 : 0)); d('ball', 14, 15 - (a3 === 2 ? 2 : 0)); break;
    case 'block0': fb.rect(ox + 2, oy + 6, 20, 13, c(0x30)); fb.tinyC('FOR', ox + 12, oy + 7, c(0x16)); fb.tinyC('LEASE', ox + 12, oy + 13, c(0x16)); break;
    case 'block1': fb.spr(Pr('d_vhs'), ox + 6, oy + 6, false, DARK[1]); break;
    case 'circuit0': case 'circuit1': fb.spr(Pr('d_tv'), ox + 1, oy + 14, false, DARK[2]); fb.spr(Pr('d_tv'), ox + 13, oy + 14, false, DARK[2]); break;
    default: break;
  }
}

/**
 * Draw a storefront with its top-left at (x, y); it is STORE_W x SF_H pixels.
 * state: open target (red blinking door), cleared target (dark), shop (blue door), closed (shutter).
 */
export function drawStorefront(fb: Fb, def: StoreDef, x: number, y: number, frame: number, cleared: boolean, blackFriday: boolean): void {
  const closed = def.role === 'closed';
  const dim = cleared ? DARK[2] : null;
  const c = (col: number) => (dim ? dim[col] : col);
  const accent = closed ? 0x00 : def.role === 'target' ? 0x06 : 0x02;
  // facade
  fb.rect(x, y + 10, STORE_W, SF_H - 10, c(0x00));
  fb.rect(x, y + SF_H - 5, STORE_W, 5, c(accent));
  // sign: store name in the tiny font, coloured by role
  const signCol = closed ? 0x10 : cleared ? 0x00 : def.role === 'target' ? 0x26 : 0x21;
  fb.rect(x + 1, y, STORE_W - 2, 10, 0x0f);
  fb.frame(x + 1, y, STORE_W - 2, 10, c(closed ? 0x00 : def.role === 'target' ? 0x16 : 0x12));
  fb.tinyC(def.name, x + STORE_W / 2, y + 3, signCol);
  // windows
  for (let side = 0; side < 2; side++) {
    const wx = x + (side ? 51 : 3);
    const wy = y + 12;
    fb.rect(wx, wy, 26, 27, c(0x30));
    fb.rect(wx + 1, wy + 1, 24, 25, c(closed ? 0x0c : GLASS));
    const saved = [fb.cx0, fb.cy0, fb.cx1, fb.cy1];
    fb.cx0 = Math.max(saved[0], wx + 1); fb.cy0 = Math.max(saved[1], wy + 1);
    fb.cx1 = Math.min(saved[2], wx + 25); fb.cy1 = Math.min(saved[3], wy + 26);
    if (fb.cx1 > fb.cx0 && fb.cy1 > fb.cy0) display(fb, def.key, side, wx + 1, wy + 1, frame, dim);
    [fb.cx0, fb.cy0, fb.cx1, fb.cy1] = saved;
  }
  // door
  const dx = x + 32, dy = y + 12, dh = SF_H - 12;
  if (closed) {
    shutter(fb, dx, dy, 16, dh);
    if (def.key === 'circuit') {
      // shutter half down over the dead TVs
      shutter(fb, x + 3, y + 12, 26, 13);
      shutter(fb, x + 51, y + 12, 26, 13);
    }
    if (def.key === 'border') {
      shutter(fb, x + 3, y + 12, 26, 27);
      shutter(fb, x + 51, y + 12, 26, 27);
      fb.rect(x + 12, y + 20, 56, 9, 0x28);
      fb.frame(x + 12, y + 20, 56, 9, 0x16);
      fb.tinyC(TEXT.closingSale, x + STORE_W / 2, y + 22, 0x16);
    }
  } else {
    let body: number, trim: number;
    if (def.role === 'target') {
      if (cleared) { body = 0x0f; trim = 0x00; }
      else { const on = Math.floor(frame / 16) % 2 === 0; body = on ? 0x16 : 0x06; trim = on ? 0x26 : 0x16; }
    } else { body = 0x12; trim = 0x21; }
    fb.rect(dx, dy, 16, dh, trim);
    fb.rect(dx + 1, dy + 1, 14, dh - 1, body);
    fb.rect(dx + 3, dy + 3, 10, 9, cleared ? 0x00 : trim);
    fb.rect(dx + 4, dy + 4, 8, 7, cleared ? 0x0f : 0x0c);
    fb.rect(dx + 11, dy + 17, 2, 3, cleared ? 0x00 : 0x30);
    if (blackFriday && !cleared) {
      fb.rect(x + 50, y + 11, 28, 7, 0x28);
      fb.tiny(TEXT.off70, x + 51, y + 12, 0x16);
    }
  }
}
