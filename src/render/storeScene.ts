import {
  HUD_H,
  SCREEN_W,
  SEARCH_FRAMES,
  SEARCH_FRAMES_SNEAKERS,
  STORE_SPRITE_H,
  TILE,
  VIEW_H,
} from '../core/constants';
import { SEARCH_HINT, SEARCHING_LABEL } from '../core/copy';
import { DIR_DX, DIR_DY, STORE_STRIP_H, roomHeight, roomWidth, searchTargetFor } from '../core/store';
import {
  STORE_BY_ID,
  TILE_BOOTH,
  TILE_COUNTER,
  TILE_DECOR,
  TILE_DOOR,
  TILE_FITTING,
  TILE_FIXTURE,
  TILE_PEDESTAL,
  TILE_TOYSHELF,
  TILE_WALL,
} from '../core/storeDefs';
import type { GameState, StoreState } from '../core/types';
import { FONT, TINY, drawText, drawTextCentered, textWidth } from './font';
import { C } from './palette';
import type { Framebuffer } from './pixels';
import { SPRITES } from './sprites';
import { SPECIAL_TILES, themeTiles } from './tiles';
import { drawBubble } from './mallScene';

/** The bottom strip that shows the store name and the search prompt. */
const STRIP_H = STORE_STRIP_H;

export function drawStore(fb: Framebuffer, g: GameState, clock: number): void {
  const st = g.store!;
  const def = STORE_BY_ID.get(st.storeId)!;
  const tiles = themeTiles(def.theme!);

  fb.setClip(HUD_H, HUD_H + VIEW_H);
  fb.rect(0, HUD_H, SCREEN_W, VIEW_H, C.BLACK);

  const ox = -st.camX;
  const oy = -st.camY + HUD_H;

  // --- room --------------------------------------------------------------
  for (let ty = 0; ty < st.tiles.length; ty++) {
    for (let tx = 0; tx < st.tiles[ty].length; tx++) {
      const ch = st.tiles[ty][tx];
      const x = ox + tx * TILE;
      const y = oy + ty * TILE;
      if (x < -TILE || x > SCREEN_W || y < HUD_H - TILE || y > HUD_H + VIEW_H) continue;

      // Floor goes under everything so gaps never show black.
      fb.blit(tiles.floor, x, y);
      switch (ch) {
        case TILE_WALL:
          fb.blit(tiles.wall, x, y);
          break;
        case TILE_COUNTER:
          fb.blit(tiles.counter, x, y);
          break;
        case TILE_DECOR:
          fb.blit(tiles.decor, x, y);
          break;
        case TILE_DOOR:
          fb.blit(SPECIAL_TILES.door, x, y);
          break;
        case TILE_BOOTH:
          fb.blit(SPECIAL_TILES.booth, x, y);
          break;
        case TILE_PEDESTAL:
          fb.blit(SPECIAL_TILES.pedestal, x, y);
          break;
        default:
          break;
      }
    }
  }

  // --- fixtures (drawn from state so opened ones keep their rummaged look) --
  for (const f of st.fixtures) {
    const x = ox + f.tx * TILE;
    const y = oy + f.ty * TILE;
    let spr = f.opened ? tiles.fixtureOpen : tiles.fixture;
    if (f.char === TILE_FITTING) spr = f.opened ? SPECIAL_TILES.fittingOpen : SPECIAL_TILES.fitting;
    if (f.char === TILE_TOYSHELF) spr = f.opened ? SPECIAL_TILES.toyShelfOpen : SPECIAL_TILES.toyShelf;
    fb.blit(spr, x, y);

    // Radar reveals package fixtures with a flashing "!".
    if (g.powerups.radar && !f.opened && f.content === 'package' && Math.floor(clock / 8) % 2 === 0) {
      drawTextCentered(fb, FONT, '!', x + TILE / 2, y - 2, C.RED);
    }
  }

  // --- the GameStonk cave scene -------------------------------------------
  if (st.clerkVisible) {
    const cx = ox + roomWidth(st) / 2;
    const cy = oy + 3 * TILE;
    const on = Math.floor(clock / 6) % 2 === 0;
    fb.blit(on ? SPRITES.demoTvOn : SPRITES.demoTvOff, Math.round(cx) - 34, cy);
    fb.blit(on ? SPRITES.demoTvOff : SPRITES.demoTvOn, Math.round(cx) + 18, cy);
    fb.blit(SPRITES.clerk, Math.round(cx) - 8, cy - 4);
  }
  if (st.pedestalItem) {
    const ty = st.tiles.findIndex((r) => r.includes(TILE_PEDESTAL));
    if (ty >= 0) {
      const tx = st.tiles[ty].indexOf(TILE_PEDESTAL);
      const bob = Math.round(Math.sin(clock / 10) * 2);
      fb.blit(SPRITES.packageBox, ox + tx * TILE + 2, oy + ty * TILE - 6 + bob);
    }
  }

  // --- wind-up toys --------------------------------------------------------
  for (const t of st.toys) {
    fb.blit(SPRITES.windUpToy, Math.round(ox + t.x - 8), Math.round(oy + t.y - 8), t.dir === 1);
  }

  // --- guards --------------------------------------------------------------
  for (const gd of st.guards) {
    const x = Math.round(ox + gd.x - 8);
    const y = Math.round(oy + gd.y - 8);
    if (gd.deadFrames > 0) {
      fb.blit(SPRITES.puff2, x, y);
      continue;
    }
    const alt = Math.floor(clock / 8) % 2 === 0;
    if (gd.kind === 'bot') {
      fb.blit(alt ? SPRITES.sBot : SPRITES.sBot2, x, y);
    } else {
      const spr = gd.dir === 3 ? SPRITES.sSpyUp : gd.dir === 0 ? SPRITES.sSpyDown : SPRITES.sSpyRight;
      fb.blit(spr, x, y, gd.dir === 1);
    }
    if (gd.stunFrames > 0 && Math.floor(clock / 4) % 2 === 0) {
      drawText(fb, TINY, '*', x + 6, y - 6, C.PALEYELLOW);
    }
  }

  // --- bullets -------------------------------------------------------------
  for (const b of st.bullets) {
    fb.blit(
      b.fromPlayer ? SPRITES.bullet : SPRITES.enemyBullet,
      Math.round(ox + b.x - 2),
      Math.round(oy + b.y - 1),
      b.vx < 0,
    );
  }

  // --- the agent -----------------------------------------------------------
  drawStoreAgent(fb, g, st, ox, oy, clock);

  // --- searching -----------------------------------------------------------
  if (st.player.searchFrames > 0 && st.player.searchTarget) {
    const f = st.player.searchTarget;
    const total = g.powerups.speed ? SEARCH_FRAMES_SNEAKERS : SEARCH_FRAMES;
    const frac = Math.min(1, st.player.searchFrames / total);
    const bx = ox + f.tx * TILE;
    const by = oy + f.ty * TILE - 6;
    fb.rect(bx, by, TILE, 4, C.BLACK);
    fb.rect(bx + 1, by + 1, Math.round((TILE - 2) * frac), 2, C.LIGHTGREEN);
  }

  fb.clearClip();

  drawStoreStrip(fb, g, st);

  // --- ephemera ------------------------------------------------------------
  fb.setClip(HUD_H, HUD_H + VIEW_H);
  for (const p of st.popups) {
    drawTextCentered(fb, TINY, p.text, Math.round(ox + p.x), Math.round(oy + p.y), C.PALEYELLOW);
  }
  for (const b of st.bubbles) {
    drawBubble(fb, b.text, Math.round(ox + b.x), Math.round(oy + b.y));
  }
  fb.clearClip();

  if (st.cutscene === 'zelda') drawZeldaBox(fb, st);
  if (st.cutscene === 'itemGet') drawItemGetBox(fb, st);
}

function drawStoreAgent(
  fb: Framebuffer,
  g: GameState,
  st: StoreState,
  ox: number,
  oy: number,
  clock: number,
): void {
  const p = st.player;
  if (p.invulnFrames > 0 && Math.floor(clock / 3) % 2 === 0) return;

  let spr = SPRITES.sAgentDown;
  if (p.holdFrames > 0) {
    spr = SPRITES.sAgentHold;
  } else {
    const alt = Math.floor(clock / 8) % 2 === 0;
    if (p.dir === 3) spr = alt ? SPRITES.sAgentUp : SPRITES.sAgentUp2;
    else if (p.dir === 0) spr = alt ? SPRITES.sAgentDown : SPRITES.sAgentDown2;
    else spr = alt ? SPRITES.sAgentRight : SPRITES.sAgentRight2;
  }
  const x = Math.round(ox + p.x - 8);
  const y = Math.round(oy + p.y - 8);

  if (g.powerups.invulnFrames > 0) {
    const flash: [number, number, number] =
      Math.floor(clock / 3) % 2 === 0 ? [C.WHITE, C.PALEYELLOW, C.WHITE] : [C.BLACK, C.RED, C.TAN];
    fb.blitTinted(spr, x, y, flash, p.dir === 1);
  } else {
    fb.blit(spr, x, y, p.dir === 1 && p.holdFrames === 0);
  }

  if (p.stunFrames > 0) {
    fb.blit(SPRITES.puff1, x, y - 8);
  }
  if (p.holdFrames > 0 && p.holdText) {
    drawTextCentered(fb, TINY, p.holdText, x + 8, y - 12, C.PALEYELLOW);
  }
}

/** Store name and the search prompt along the bottom. */
function drawStoreStrip(fb: Framebuffer, g: GameState, st: StoreState): void {
  const def = STORE_BY_ID.get(st.storeId)!;
  const y = HUD_H + VIEW_H - STRIP_H;
  fb.rect(0, y, SCREEN_W, STRIP_H, C.BLACK);
  fb.hline(0, y, SCREEN_W, C.GREY);
  drawText(fb, TINY, def.name, 4, y + 5, C.PALEYELLOW);

  if (st.player.searchFrames > 0) {
    const total = g.powerups.speed ? SEARCH_FRAMES_SNEAKERS : SEARCH_FRAMES;
    const frac = Math.min(1, st.player.searchFrames / total);
    const label = SEARCHING_LABEL;
    const lx = SCREEN_W - textWidth(TINY, label) - 46;
    drawText(fb, TINY, label, lx, y + 5, C.WHITE);
    const bx = SCREEN_W - 42;
    fb.frame(bx, y + 4, 38, 6, C.WHITE);
    fb.rect(bx + 1, y + 5, Math.round(36 * frac), 4, C.LIGHTGREEN);
  } else if (searchTargetFor(st)) {
    const label = SEARCH_HINT;
    drawText(fb, TINY, label, SCREEN_W - textWidth(TINY, label) - 4, y + 5, C.PALEYELLOW);
  }
  void DIR_DX;
  void DIR_DY;
  void roomHeight;
  void TILE_FIXTURE;
  void STORE_SPRITE_H;
}

/** The Zelda-cave typewriter box. */
function drawZeldaBox(fb: Framebuffer, st: StoreState): void {
  const lines = st.cutsceneText;
  const typed = Math.floor(st.cutsceneFrames / 2);
  const w = 200;
  const h = lines.length * 10 + 10;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = HUD_H + 24;
  fb.rect(x, y, w, h, C.BLACK);
  fb.frame(x, y, w, h, C.WHITE);
  let budget = typed;
  lines.forEach((line, i) => {
    const take = Math.max(0, Math.min(line.length, budget));
    budget -= line.length;
    if (take > 0) drawText(fb, FONT, line.slice(0, take), x + 6, y + 5 + i * 10, C.WHITE);
  });
}

function drawItemGetBox(fb: Framebuffer, st: StoreState): void {
  const text = st.cutsceneText[0] ?? '';
  const w = Math.min(SCREEN_W - 8, textWidth(FONT, text) + 12);
  const x = Math.round((SCREEN_W - w) / 2);
  const y = HUD_H + 30;
  fb.rect(x, y, w, 18, C.BLACK);
  fb.frame(x, y, w, 18, C.PALEYELLOW);
  drawTextCentered(fb, FONT, text, SCREEN_W / 2, y + 6, C.PALEYELLOW);
}
