/** Draws a top-down store room (any size, with a camera) and its bottom status strip. */
import { Fb } from '../gfx/fb';
import { S } from '../gfx/sprites';
import { Pr, THEME_TILES } from '../gfx/props';
import type { Facing, Game, Guard } from '../game/types';
import { HUD_H, STORES } from '../game/level';
import { TILE } from '../game/rooms';
import { TEXT } from '../game/copy';
import { CLERK, EGG_TEXT, GUARD_TELEGRAPH, PEDESTAL } from '../game/store';
import { drawBubble } from './ui';

export const ROOM_VIEW_H = 176;

function charSprite(prefix: string, face: Facing, walkT: number): [string, boolean] {
  const f = 1 + (Math.floor(walkT / 8) % 2);
  if (face === 'd') return [prefix + '_down' + f, false];
  if (face === 'u') return [prefix + '_up' + f, false];
  return [prefix + '_side' + f, face === 'l'];
}

function drawGuard(fb: Fb, q: Guard, x: number, y: number, frame: number): void {
  if (!q.alive) {
    if (q.dead > 0) fb.spr(S(q.dead > 12 ? 'puff1' : 'puff2'), x, y);
    return;
  }
  if (q.hitT > 0 && frame & 2) return;
  if (q.kind === 'bot') fb.spr(S(Math.floor(q.walkT / 8) % 2 ? 'bot1' : 'bot2'), x, y, q.face === 'l');
  else {
    const [name, flip] = charSprite('ssp', q.face, q.walkT);
    fb.spr(S(name), x, y, flip);
    if (q.aimT > 0) {
      // telegraph: a blinking "!" before the shot
      if (frame & 4 || q.aimT < GUARD_TELEGRAPH / 2) fb.text('!', x + 4, y - 9, 0x16);
    }
  }
  if (q.stun > 0) { fb.pset(x + 3 + ((frame >> 2) % 10), y - 2, 0x28); fb.pset(x + 12 - ((frame >> 2) % 10), y - 3, 0x30); }
}

export function drawStore(fb: Fb, g: Game): void {
  const L = g.level!;
  const R = L.room!;
  const st = L.stores[R.store];
  const def = STORES[R.store];
  const tpl = R.tpl;
  const tiles = THEME_TILES[def.theme!];
  const frame = g.frame;
  const camX = Math.max(0, Math.min(tpl.w * TILE - 256, R.x + 8 - 128));
  const camY = Math.max(0, Math.min(tpl.h * TILE - ROOM_VIEW_H, R.y + 8 - ROOM_VIEW_H / 2));
  const ox = -camX + (tpl.w * TILE < 256 ? (256 - tpl.w * TILE) / 2 : 0);
  const oy = HUD_H - camY;
  fb.rect(0, HUD_H, 256, ROOM_VIEW_H, 0x0f);
  fb.clip(0, HUD_H, 256, ROOM_VIEW_H);
  for (let ty = 0; ty < tpl.h; ty++) {
    for (let tx = 0; tx < tpl.w; tx++) {
      const ch = tpl.tiles[ty][tx];
      const x = tx * TILE + ox, y = ty * TILE + oy;
      if (ch === '#') { fb.spr(tiles.wall, x, y); continue; }
      fb.spr(tiles.floor, x, y);
      if (ch === 'C') fb.spr(tiles.counter, x, y);
      else if (ch === 'P') fb.spr(tiles.decor, x, y);
      else if (ch === 'D') fb.spr(Pr('door_mat'), x, y);
      else if (ch === 'B') fb.spr(Pr('booth_pad'), x, y);
      else if (ch === 'V') fb.spr(Pr(Math.floor(frame / 6) % 2 ? 'tv_tile1' : 'tv_tile2'), x, y);
    }
  }
  for (const f of st.fixtures) {
    const x = f.tx * TILE + ox, y = f.ty * TILE + oy;
    if (f.kind === 'R') fb.spr(Pr(f.opened ? 'fitting_open' : 'fitting_closed'), x, y);
    else if (f.kind === 'T') fb.spr(Pr(f.opened || f.toysOut ? 'toyshelf_open' : 'toyshelf'), x, y);
    else fb.spr(f.opened ? tiles.fixtureOpen : tiles.fixture, x, y);
    // Radar reveals the package fixture with a flashing "!"
    if (L.powers.radar && f.content === 'package' && !f.opened && frame & 8) fb.text('!', x + 4, y - 8, 0x28, 0x0f);
  }
  if (R.prompt >= 0 && !R.search) {
    const f = st.fixtures[R.prompt];
    fb.frame(f.tx * TILE + ox, f.ty * TILE + oy, 16, 16, frame & 8 ? 0x30 : 0x28);
  }
  // GameStonk easter egg
  const e = R.egg;
  if (e && e.phase !== 'done') {
    if (!(e.phase === 'got' && e.t > 70 && frame & 2)) fb.spr(S('clerk'), CLERK.x + ox, CLERK.y + oy);
    if (e.phase === 'item') { fb.spr(Pr('pedestal'), PEDESTAL.x + ox, PEDESTAL.y + oy); fb.spr(S('pu_joke'), PEDESTAL.x + 2 + ox, PEDESTAL.y - 3 + oy - ((frame >> 4) & 1)); }
  }
  for (const t of R.toys) if (t.t > 90 || frame & 4) fb.spr(S(Math.floor(frame / 8) % 2 ? 'toy1' : 'toy2'), t.x + ox, t.y + oy, t.dx < 0);
  for (const q of R.guards) drawGuard(fb, q, q.x + ox, q.y + oy, frame);
  // the agent
  const px = R.x + ox, py = R.y + oy;
  if (R.dying > 0) {
    if (R.dying > 30 || frame & 4) fb.spr(S(R.dying > 30 ? (frame & 8 ? 'sag_down1' : 'sag_up1') : 'puff2'), px, py, (frame & 16) !== 0);
  } else if (!(R.invuln > 0 && frame & 2)) {
    if (R.hold) {
      fb.spr(S('sag_hold'), px, py);
      fb.spr(S(R.hold.icon === 'package' ? 'pkg' : 'pu_' + R.hold.icon), px + (R.hold.icon === 'package' ? 0 : 2), py - (R.hold.icon === 'package' ? 13 : 11));
    } else {
      const [name, flip] = charSprite('sag', R.face, R.walkT);
      const cinna = L.powers.cinna > 0 && frame & 2;
      fb.spr(S(name), px + (R.stun > 0 ? ((frame >> 1) & 1) * 2 - 1 : 0), py, flip, null, cinna ? 0x30 : undefined);
      if (R.stun > 0) fb.text('*', px + 4, py - 8, 0x28);
    }
  }
  for (const b of R.bullets) {
    if (b.shoe) fb.spr(S('shoe'), b.x - 4 + ox, b.y - 2 + oy, b.vx < 0);
    else fb.spr(S(b.owner === 'p' ? 'bullet_p' : 'bullet_e'), b.x - 2 + ox, b.y - 1 + oy);
  }
  for (const f of L.fx) fb.spr(S(f.t > 14 ? 'puff1' : 'puff2'), f.x - 8 + ox, f.y - 8 + oy);
  for (const p of L.popups) fb.text(p.text, Math.round(p.x - p.text.length * 4 + ox), Math.round(p.y + oy), 0x30);
  for (const b of L.bubbles) drawBubble(fb, b.text, b.x + ox, b.y + oy);
  if (e && e.phase === 'talk') {
    // typewriter box
    const n = Math.min(EGG_TEXT.length, Math.floor(e.t / 3));
    const shown = EGG_TEXT.slice(0, n);
    fb.rect(12, 120, 232, 30, 0x0f);
    fb.frame(12, 120, 232, 30, 0x30);
    fb.text(shown.slice(0, TEXT.egg1.length), 20, 126, 0x30);
    if (n > TEXT.egg1.length + 1) fb.text(shown.slice(TEXT.egg1.length + 1), 20, 138, 0x30);
  }
  fb.noClip();
  // bottom strip
  const sy = HUD_H + ROOM_VIEW_H;
  fb.rect(0, sy, 256, 240 - sy, 0x0f);
  fb.rect(0, sy, 256, 1, 0x10);
  fb.textC(def.name, 128, sy + 5, def.role === 'target' ? (st.cleared ? 0x10 : 0x26) : 0x21);
  if (R.search) {
    fb.text(TEXT.searching, 40, sy + 17, 0x30);
    fb.rect(128, sy + 17, 82, 8, 0x00);
    fb.rect(129, sy + 18, Math.round((80 * R.search.t) / R.search.dur), 6, 0x2a);
  } else if (R.prompt >= 0 && R.dying === 0) fb.textC(TEXT.pressSearch, 128, sy + 17, frame & 16 ? 0x30 : 0x10);
  if (L.banner) L.banner.lines.slice(0, 2).forEach((l, i) => fb.textC(l, 128, sy + 28 + i * 10, i === 0 ? 0x28 : 0x30));
}
