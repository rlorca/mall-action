/** Shared UI drawing: speech bubbles, banners, HUD, SPYGRAM card. */
import { Fb } from '../gfx/fb';
import { S } from '../gfx/sprites';
import { art } from '../gfx/pixelart';
import type { Game } from '../game/types';
import { FLOOR_NAMES, STORES, floorOf } from '../game/level';
import { POWER_NAMES, TEXT, type Post } from '../game/copy';
import { hudPower } from '../game/powers';

const HUD_ARMOR = art(['.wwwww.', 'wbbbbbw', 'wbwwwbw', 'wbbbbbw', '.wbbbw.', '..www..'], { w: 0x30, b: 0x11 });
const HUD_RADAR = art(['..ggg..', '.g...g.', 'g..g..g', 'g.ggg.g', '.g...g.', '..ggg..'], { g: 0x2a });

/** Speech bubble centred on x with its tail at y; always kept on screen. */
export function drawBubble(fb: Fb, text: string, x: number, y: number): void {
  const w = text.length * 8 + 6;
  const bx = Math.max(1, Math.min(255 - w, Math.round(x - w / 2)));
  const by = Math.max(18, Math.min(240 - 14, Math.round(y - 12)));
  fb.rect(bx, by, w, 12, 0x30);
  fb.frame(bx, by, w, 12, 0x0f);
  const tx = Math.max(bx + 3, Math.min(bx + w - 5, Math.round(x)));
  fb.rect(tx - 1, by + 11, 3, 1, 0x30);
  fb.pset(tx, by + 12, 0x0f); fb.pset(tx - 1, by + 12, 0x0f); fb.pset(tx + 1, by + 12, 0x0f); fb.pset(tx, by + 13, 0x0f);
  fb.pset(tx, by + 12, 0x30);
  fb.text(text, bx + 3, by + 2, 0x0f);
}

/** Multi-line banner box, centred horizontally with its top at y. */
export function drawBanner(fb: Fb, lines: string[], y: number, col = 0x28): void {
  const len = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = len * 8 + 10, h = lines.length * 10 + 5;
  const x = Math.round(128 - w / 2);
  fb.rect(x, y, w, h, 0x0f);
  fb.frame(x, y, w, h, col);
  lines.forEach((l, i) => fb.textC(l, 128, y + 4 + i * 10, i === 0 ? 0x30 : col));
}

export function drawHud(fb: Fb, g: Game): void {
  const L = g.level;
  fb.rect(0, 0, 256, 16, 0x0f);
  fb.text(String(g.score).padStart(6, '0'), 0, 0, 0x30);
  fb.text('PKG ' + g.pkgs + '/6', 56, 0, g.pkgs >= 6 ? 0x2a : 0x16);
  fb.spr(S('head'), 116, 0);
  fb.text(String(Math.min(99, g.lives)), 126, 0, 0x30);
  if (!L) return;
  if (L.alarm && g.frame & 16) fb.text('ALARM', 148, 0, 0x16);
  // power-up line
  const hp = hudPower(L.powers);
  if (hp) {
    fb.text(POWER_NAMES[hp[0]], 0, 8, 0x28);
    const bw = Math.ceil((hp[1] / hp[2]) * 40);
    fb.rect(132, 9, 42, 6, 0x00);
    fb.rect(133, 10, bw, 4, hp[1] < 180 && g.frame & 8 ? 0x16 : 0x2a);
  }
  if (L.powers.armor) fb.spr(HUD_ARMOR, 178, 9);
  if (L.powers.radar) fb.spr(HUD_RADAR, 188, 9);
  // elevator-style LED floor panel
  const px = 198, pw = 58;
  fb.rect(px, 0, pw, 16, 0x06);
  fb.frame(px, 0, pw, 16, 0x00);
  if (L.mode === 'store' && L.room) {
    // inside a store the panel scrolls the store name like a marquee
    const name = STORES[L.room.store].name + '   ';
    const total = name.length * 8;
    const off = Math.floor(g.frame / 2) % total;
    const saved = [fb.cx0, fb.cy0, fb.cx1, fb.cy1];
    fb.clip(px + 2, 0, pw - 4, 16);
    fb.text(name + name, px + 2 - off, 4, 0x26);
    [fb.cx0, fb.cy0, fb.cx1, fb.cy1] = saved;
  } else {
    const f = floorOf(L.player.y);
    for (let i = 0; i < 6; i++) {
      const on = i === f;
      const lx = px + 3 + i * 9;
      if (on) { fb.rect(lx - 1, 2, FLOOR_NAMES[i].length > 1 ? 9 : 5, 7, 0x16); }
      fb.tiny(FLOOR_NAMES[i], lx, 3, on ? 0x30 : 0x16);
      fb.pset(lx + 2, 12, on ? 0x28 : 0x07);
    }
    const P = L.player;
    if (P.ride && P.ride.part === 'in') {
      const d = L.cars[P.ride.shaft].dir;
      if (d) fb.text(d < 0 ? '^' : '~', px + pw - 10, 8, 0x28);
    }
  }
}

/** SPYGRAM post card (a parody photo app). likes is derived from time by the caller. */
export function drawSpygram(fb: Fb, post: Post, likes: number, y: number, photo: (x: number, y: number, w: number, h: number) => void): void {
  const w = 21 * 8 + 12, h = 118;
  const x = Math.round(128 - w / 2);
  fb.rect(x + 2, y + 2, w, h, 0x0f);
  fb.rect(x, y, w, h, 0x30);
  fb.frame(x, y, w, h, 0x0f);
  fb.rect(x + 1, y + 1, w - 2, 12, 0x14);
  fb.text(TEXT.spygram, x + 5, y + 3, 0x30);
  fb.text('@', x + w - 13, y + 3, 0x34);
  const pw = w - 12, ph = 46;
  fb.rect(x + 6, y + 16, pw, ph, 0x0f);
  const saved = [fb.cx0, fb.cy0, fb.cx1, fb.cy1];
  fb.clip(x + 7, y + 17, pw - 2, ph - 2);
  photo(x + 7, y + 17, pw - 2, ph - 2);
  [fb.cx0, fb.cy0, fb.cx1, fb.cy1] = saved;
  fb.text('♥', x + 6, y + 66, 0x15);
  fb.text(String(likes), x + 16, y + 66, 0x0f);
  fb.text(post.caption[0], x + 6, y + 78, 0x0f);
  fb.text(post.caption[1], x + 6, y + 88, 0x0f);
  fb.rect(x + 6, y + 99, w - 12, 1, 0x10);
  fb.text(post.comment, x + 6, y + 104, 0x12);
}
