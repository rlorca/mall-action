import { Gfx } from './gfx';
import { StoreRoom } from '../core/store';
import { TILE, ROOM_W, ROOM_H } from '../core/stores-data';
import { HUD_H } from '../core/level';
import { MISC, wrapLines } from '../core/copy';
import { SEARCH_FRAMES } from '../core/store';
import { placeBubble } from './mall-render';

const VIEW_PX_H = ROOM_H * TILE; // 176

export function drawStore(g: Gfx, s: StoreRoom, f: number): void {
  const room = s.room;
  const th = room.theme;
  g.rect(0, HUD_H, 256, 240 - HUD_H, 0x0f);
  g.clip(0, HUD_H, 256, VIEW_PX_H);
  const ox = -s.cam.x;
  const oy = HUD_H - s.cam.y;
  const X = (x: number) => Math.floor(x + ox);
  const Y = (y: number) => Math.floor(y + oy);

  const fixIndex = new Map<string, number>();
  s.setup.fixtures.forEach((fx, i) => fixIndex.set(`${fx.col},${fx.row}`, i));

  for (let r = 0; r < room.h; r++) {
    for (let c = 0; c < room.w; c++) {
      const ch = room.tiles[r][c];
      const x = X(c * TILE);
      const y = Y(r * TILE);
      if (x > 256 || x + TILE < 0 || y > 240 || y + TILE < 0) continue;
      switch (ch) {
        case '#':
          g.sprite(`td.${th}.wall`, 0, x, y);
          break;
        case 'D':
          g.sprite(`td.${th}.floor`, 0, x, y);
          g.sprite('td.doormat', 0, x, y);
          break;
        default:
          g.sprite(`td.${th}.floor`, 0, x, y);
      }
      if (ch === 'c') g.sprite(`td.${th}.counter`, 0, x, y);
      else if (ch === 'o') g.sprite(`td.${th}.decor`, 0, x, y);
      else if (ch === 'b') g.sprite('td.booth', 0, x, y);
      else if (ch === 'v') g.sprite('td.tv', (f >> 3) % 2, x, y);
      else if (ch === 'K') {
        if (!s.clerkGone) g.sprite('td.clerk', (f >> 4) % 2, x, y);
      } else if (ch === 'e') {
        g.sprite('td.pedestal', 0, x, y);
        if (s.egg && s.egg.phase === 'item') g.sprite('package', 0, x, y - 4 + Math.round(Math.sin(f / 8) * 2));
      } else if (ch === 'f' || ch === 'F' || ch === 'T') {
        const fi = fixIndex.get(`${c},${r}`);
        const fx = fi !== undefined ? s.setup.fixtures[fi] : null;
        const open = !!fx?.opened;
        if (ch === 'f') g.sprite(`td.${th}.fixture${open ? '.open' : ''}`, 0, x, y);
        else if (ch === 'F') g.sprite(open ? 'td.fitting.open' : 'td.fitting', 0, x, y);
        else g.sprite(fx?.released || open ? 'td.toyshelf.open' : 'td.toyshelf', 0, x, y);
        // Radar: a flashing "!" over the package fixture
        if (fx && s.radarOn() && !open && fx.loot.type === 'package' && (f >> 3) % 2 === 0) g.sprite('pad.exclaim', 0, x + 4, y - 4);
        // touched / searched fixture highlight
        if (fi !== undefined && fi === s.touched && s.canSearch() && (f >> 3) % 2 === 0) g.box(x, y, TILE, TILE, 0x30);
      }
    }
  }
  // door arrow
  const dc = room.doorCols[0];
  if ((f >> 4) % 2 === 0) g.text('EXIT', X(dc * TILE + 16), Y((room.h - 1) * TILE) - 8, 0x28, { font: 3, align: 'center' });

  // toys, smoke
  for (const t of s.toys) g.sprite('td.toy', (t.anim >> 4) % 2, X(t.x), Y(t.y));
  // guards
  for (const gd of s.guards) {
    if (gd.flash > 0 && gd.flash % 2 === 0) continue;
    const x = X(gd.x);
    const y = Y(gd.y);
    if (gd.kind === 'bot') g.sprite('td.bot', (gd.anim >> 4) % 2, x, y);
    else if (gd.state === 'dying') g.sprite('td.spy.dead', 0, x, y);
    else g.sprite(`td.spy.${gd.dir}`, gd.state === 'move' ? (gd.anim >> 3) % 2 : 0, x, y);
    if (gd.state === 'aim' && (f >> 1) % 2 === 0) g.sprite('pad.exclaim', 0, x + 4, y - 12);
    if (gd.state === 'stun') for (let i = 0; i < 3; i++) g.px(x + 8 + Math.round(Math.cos(f / 5 + i * 2.1) * 6), y - 1 + Math.round(Math.sin(f / 5 + i * 2.1) * 2), 0x28);
  }
  // player
  const p = s.p;
  {
    const x = X(p.x);
    const y = Y(p.y);
    if (p.state === 'dead') g.sprite('td.agent.dead', 0, x, y);
    else if (p.state === 'hold' && p.hold) {
      g.sprite('td.agent.hold', 0, x, y);
      g.sprite(p.hold.kind === 'powerup' && p.hold.power ? `pu.${p.hold.power}` : 'package', 0, x, y - 17);
    } else {
      const frame = p.moving ? (p.anim >> 3) % 2 : 0;
      g.sprite(`td.agent.${p.dir}`, frame, x, y);
      if (p.state === 'stun') for (let i = 0; i < 3; i++) g.px(x + 8 + Math.round(Math.cos(f / 4 + i * 2.1) * 6), y - 1 + Math.round(Math.sin(f / 4 + i * 2.1) * 2), 0x28);
    }
    if (s.search) {
      const w = 20;
      const frac = Math.min(1, s.search.t / SEARCH_FRAMES);
      g.rect(x - 2, y - 7, w, 5, 0x0f);
      g.rect(x - 1, y - 6, w - 2, 3, 0x2d);
      g.rect(x - 1, y - 6, Math.floor((w - 2) * frac), 3, 0x2a);
    }
  }
  for (const sm of s.smoke) g.sprite('smoke', Math.min(2, Math.floor((24 - sm.t) / 8)), X(sm.x - 8), Y(sm.y - 8));
  // bullets
  for (const b of s.bullets) {
    if (b.owner === 'shoe') g.sprite('td.shoe', 0, X(b.x - 4), Y(b.y - 4));
    else g.sprite(b.owner === 'player' ? 'td.bullet.p' : 'td.bullet.e', 0, X(b.x - 2), Y(b.y - 2));
  }
  // speech bubbles
  for (const b of s.bubbles) {
    const tw = g.measure(b.text);
    const bx = placeBubble(b.text, X(b.x), Y(b.y - 2), tw);
    g.rect(bx.x, bx.y, bx.w, bx.h, 0x30);
    g.rect(bx.x + 1, bx.y - 1, bx.w - 2, 1, 0x30);
    g.rect(bx.x + 1, bx.y + bx.h, bx.w - 2, 1, 0x30);
    g.rect(bx.tailX - 1, bx.y + bx.h + 1, 3, 1, 0x30);
    g.px(bx.tailX, bx.y + bx.h + 2, 0x30);
    g.text(b.text, bx.x + 3, bx.y + 2, 0x0f);
  }
  g.unclip();

  // top-of-room banner (package / power-up / trap messages)
  if (s.banner) {
    const w = g.measure(s.banner.text) + 12;
    const x = Math.floor((256 - w) / 2);
    g.rect(x, HUD_H + 8, w, 13, 0x0f);
    g.box(x, HUD_H + 8, w, 13, 0x30);
    g.text(s.banner.text, 128, HUD_H + 12, 0x28, { align: 'center' });
  }

  // Zelda-cave typewriter box
  if (s.egg && (s.egg.phase === 'type' || s.egg.phase === 'wait')) {
    const lines = wrapLines(MISC.gamestonkClerk, 26);
    g.rect(14, 96, 228, 52, 0x0f);
    g.box(14, 96, 228, 52, 0x30);
    g.box(16, 98, 224, 48, 0x2d);
    let left = s.egg.shown;
    lines.forEach((l, i) => {
      const t = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      g.text(t, 24, 106 + i * 12, 0x30);
    });
  }

  // bottom strip
  drawStoreStrip(g, s, f);
}

function drawStoreStrip(g: Gfx, s: StoreRoom, f: number): void {
  const y0 = HUD_H + VIEW_PX_H;
  g.rect(0, y0, 256, 240 - y0, 0x0f);
  g.rect(0, y0, 256, 2, 0x2d);
  g.text(s.info.longName, 128, y0 + 8, 0x28, { align: 'center' });
  let msg = '';
  let col = 0x30;
  if (s.search) msg = 'SEARCHING...';
  else if (s.canSearch()) {
    msg = 'PRESS X TO SEARCH';
    col = (f >> 4) % 2 ? 0x30 : 0x2a;
  } else if (s.onBooth) {
    msg = MISC.nowPlaying;
    col = 0x25;
  }
  if (msg) g.text(msg, 128, y0 + 22, col, { align: 'center' });
  if (s.search) {
    const frac = Math.min(1, s.search.t / SEARCH_FRAMES);
    g.rect(78, y0 + 34, 100, 6, 0x2d);
    g.rect(79, y0 + 35, Math.floor(98 * frac), 4, 0x2a);
  }
  void ROOM_W;
}
