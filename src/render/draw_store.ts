/** Draws the top-down store room from the game state. */
import { C } from '../core/palette';
import { TINY_FONT, wrap } from '../core/font';
import { TILE, roomFor, tileAt } from '../game/rooms';
import { storeById } from '../game/layout';
import { BANNERS, EASTER_EGG_TEXT, JOKE_ITEM_SPRITES } from '../game/copy';
import { findSearchTarget } from '../game/store';
import type { GameState, Level, StoreSession } from '../game/state';
import { Gfx, SCREEN_W } from './gfx';
import { drawBubbles } from './draw_common';

export const ROOM_Y = 24;
export const ROOM_H = 176;
export const STRIP_Y = 204;

export function drawStore(gx: Gfx, g: GameState, lvl: Level): void {
  const s = lvl.store!;
  const room = roomFor(s.id);
  const def = storeById(s.id);
  const theme = def.theme!;
  const rt = lvl.stores[s.id];
  const t = g.frame;
  const shake = g.shake > 0 ? ((g.frame * 7) % 5) - 2 : 0;
  const ox = s.camX + shake;
  const oy = s.camY - ROOM_Y;
  gx.rect(0, 16, SCREEN_W, 8, C.BLACK);

  // Clip to the room viewport.
  gx.ctx.save();
  gx.ctx.beginPath();
  gx.ctx.rect(0, ROOM_Y, SCREEN_W, ROOM_H);
  gx.ctx.clip();
  gx.rect(0, ROOM_Y, SCREEN_W, ROOM_H, C.BLACK);

  const tx0 = Math.floor(ox / TILE);
  const ty0 = Math.floor((oy + ROOM_Y) / TILE);
  for (let ty = ty0; ty <= ty0 + 12; ty++) {
    for (let tx = tx0; tx <= tx0 + 16; tx++) {
      if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) continue;
      const ch = tileAt(room, tx, ty);
      const x = tx * TILE - ox;
      const y = ty * TILE - oy;
      if (ch === '#') {
        gx.spr(`t_${theme}_wall`, x, y);
        continue;
      }
      gx.spr(ch === 'D' ? 't_door' : `t_${theme}_floor`, x, y);
      const fi = room.fixtures.findIndex((f) => f.tx === tx && f.ty === ty);
      const opened = fi >= 0 && rt.opened[fi];
      switch (ch) {
        case 'F':
          gx.spr(`t_${theme}_${opened ? 'fixture_open' : 'fixture'}`, x, y);
          break;
        case 'C':
          gx.spr(`t_${theme}_counter`, x, y);
          break;
        case 'd':
          gx.spr(`t_${theme}_decor`, x, y);
          break;
        case 'R':
          gx.spr(opened ? 't_fitting_open' : 't_fitting', x, y);
          break;
        case 'T':
          gx.spr(opened ? 't_toyshelf_open' : 't_toyshelf', x, y);
          break;
        case 'L':
          gx.spr('t_booth', x, y);
          if (s.boothOn && Math.floor(t / 10) % 2 === 0) gx.rect(x + 7, y + 1, 2, 2, C.HOTPINK);
          break;
        case 'P':
          gx.spr('t_pedestal', x, y);
          break;
        case 'V':
          gx.spr(gx.anim('t_demotv', t + tx * 5, 6), x, y);
          break;
      }
      // Radar: a flashing "!" over the package fixture.
      if (fi >= 0 && !opened && lvl.powers.radar && rt.contents[fi].t === 'package' && Math.floor(t / 8) % 2 === 0) {
        gx.text('!', x + 6, y - 4, C.RED, { shadow: C.WHITE });
      }
    }
  }

  // GameStonk clerk and the item on the pedestal.
  if (s.clerkPresent && room.clerk) gx.spr('clerk', room.clerk.tx * TILE - ox, room.clerk.ty * TILE - oy);
  if (s.easter && s.easter.phase === 'item' && room.pedestal) {
    const bob = Math.floor(t / 12) % 2;
    gx.spr(JOKE_ITEM_SPRITES[s.easter.item], room.pedestal.tx * TILE - ox, room.pedestal.ty * TILE - oy - 4 - bob);
  }

  for (const toy of s.toys) gx.spr(gx.anim('toy', toy.anim, 8), toy.x - 4 - ox, toy.y - 4 - oy, toy.dir === 'left');
  for (const gd of s.guards) {
    if (gd.dying > 0 && Math.floor(gd.dying / 3) % 2 === 1) continue;
    let name: string;
    if (gd.kind === 'bot') name = gx.anim('bot', gd.anim, 10);
    else if (gd.changing > 0) name = 'tspy_changing';
    else {
      const d = gd.dir === 'left' || gd.dir === 'right' ? 'side' : gd.dir;
      name = gx.anim(`tspy_${d}`, gd.anim, 10);
    }
    const colors = gd.hitFlash > 0 ? [C.WHITE, C.WHITE, C.WHITE] : gd.stun > 0 && Math.floor(t / 6) % 2 ? [C.LGREY, C.GREY, C.WHITE] : undefined;
    gx.spr(name, gd.x - 8 - ox, gd.y - 8 - oy, gd.dir === 'left', colors);
    if (gd.stun > 0) gx.text('*', gd.x - 3 - ox + ((t >> 3) % 2) * 2, gd.y - 17 - oy, C.YELLOW);
    if (gd.aim > 0 && Math.floor(t / 3) % 2 === 0) gx.text('!', gd.x - 2 - ox, gd.y - 18 - oy, C.RED);
  }
  for (const b of s.bullets) {
    if (b.shoe) gx.spr('shoe', b.x - 4 - ox, b.y - 4 - oy);
    else gx.spr('tbullet', b.x - 2 - ox, b.y - 2 - oy);
  }

  // The agent.
  if (!(s.invuln > 0 && Math.floor(t / 3) % 2 === 0)) {
    let name: string;
    const flip = s.facing === 'left';
    if (s.dead > 0) name = Math.floor(s.dead / 6) % 2 ? 'tagent_down_0' : 'tagent_side_0';
    else if (s.hold) name = 'tagent_hold';
    else {
      const d = s.facing === 'left' || s.facing === 'right' ? 'side' : s.facing;
      name = gx.anim(`tagent_${d}`, s.anim, 8);
    }
    const colors = lvl.powers.invincT > 0 ? [[C.GOLD, C.BLACK, C.WHITE], [C.HOTPINK, C.BLACK, C.SKIN]][Math.floor(t / 4) % 2] : undefined;
    gx.spr(name, s.x - 8 - ox, s.y - 8 - oy, flip && !s.hold && s.dead === 0, colors);
    if (s.hold) gx.spr(s.hold.sprite, s.x - 8 - ox, s.y - 24 - oy);
    if (s.stun > 0) gx.text('*', s.x - 3 - ox, s.y - 18 - oy, C.YELLOW);
  }
  for (const p of s.puffs) gx.spr(`puff_${Math.min(2, Math.floor(p.t / 8))}`, p.x - 8 - ox, p.y - 8 - oy);

  // Search progress bar above the agent.
  if (s.search) {
    const k = s.search.t / s.search.dur;
    gx.rect(s.x - 9 - ox, s.y - 16 - oy, 18, 4, C.BLACK);
    gx.rect(s.x - 8 - ox, s.y - 15 - oy, Math.round(16 * k), 2, C.LGREEN);
  }
  for (const p of s.popups) gx.textC(p.text, p.x - ox, p.y - oy, C.WHITE, { font: TINY_FONT, shadow: C.BLACK });
  gx.ctx.restore();
  drawBubbles(gx, s.bubbles, ox, oy, ROOM_Y + 1, ROOM_Y + ROOM_H);

  // Easter-egg typewriter box.
  if (s.easter && s.easter.phase === 'text') {
    const shown = EASTER_EGG_TEXT.slice(0, s.easter.chars);
    const lines = wrap(shown, 26);
    gx.rect(20, 120, 216, 34, C.BLACK);
    gx.frame(20, 120, 216, 34, C.WHITE);
    lines.forEach((l, i) => gx.text(l, 30, 128 + i * 10, C.WHITE));
  }

  drawStrip(gx, g, lvl, s);
}

function drawStrip(gx: Gfx, g: GameState, lvl: Level, s: StoreSession): void {
  const def = storeById(s.id);
  gx.rect(0, 200, SCREEN_W, 40, C.BLACK);
  gx.rect(0, 200, SCREEN_W, 1, C.DGREY);
  gx.textC(def.name, SCREEN_W / 2, STRIP_Y + 2, def.role === 'target' ? C.SALMON : C.LBLUE);
  const room = roomFor(s.id);
  const rt = lvl.stores[s.id];
  if (s.search) {
    gx.textC(BANNERS.searching, SCREEN_W / 2, STRIP_Y + 14, C.YELLOW);
    const w = 100;
    gx.rect(SCREEN_W / 2 - w / 2, STRIP_Y + 25, w, 5, C.DGREY);
    gx.rect(SCREEN_W / 2 - w / 2 + 1, STRIP_Y + 26, Math.round((w - 2) * (s.search.t / s.search.dur)), 3, C.LGREEN);
  } else if (!s.hold && s.dead === 0 && findSearchTarget(room, rt, s.x, s.y, s.facing)) {
    if (Math.floor(g.frame / 20) % 3 !== 0) gx.textC(BANNERS.searchHint, SCREEN_W / 2, STRIP_Y + 14, C.WHITE);
  } else {
    const left = rt.opened.filter((o) => !o).length;
    gx.textC(`FIXTURES LEFT: ${left}`, SCREEN_W / 2, STRIP_Y + 14, C.GREY, { font: TINY_FONT });
  }
}
