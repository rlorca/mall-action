/** HUD, overlays and the non-play screens (title, map, pause, level clear, continue, game over). */
import { C } from '../core/palette';
import { MAIN_FONT, TINY_FONT, textWidth, wrap } from '../core/font';
import {
  ESCALATORS, FLOORS, FLOOR_NAMES, MALL_W, SHAFTS, STORES, STORE_W, WAGON, doorX, floorBand, floorAtY, surf, storeById,
} from '../game/layout';
import { BANNERS, POWERUP_NAMES, type SpygramPost } from '../game/copy';
import { hudFraction } from '../game/powerups';
import { continueNumber, GAMEOVER_SHOW, GAMEOVER_TEXT_START, GAMEOVER_TYPE } from '../game/game';
import type { GameState, Level } from '../game/state';
import { Gfx, HUD_H, SCREEN_H, SCREEN_W } from './gfx';
import { drawStorefront } from './draw_mall';
import { drawBanner } from './draw_common';

// ---------------------------------------------------------------- HUD

export function drawHud(gx: Gfx, g: GameState): void {
  const lvl = g.level;
  gx.rect(0, 0, SCREEN_W, HUD_H, C.BLACK);
  gx.rect(0, HUD_H - 1, SCREEN_W, 1, C.DGREY);
  gx.text(String(g.score).padStart(6, '0'), 4, 1, C.WHITE);
  if (!lvl) return;
  const pk = lvl.packages;
  gx.text(`PKG ${pk}/6`, 44, 1, pk >= 6 ? C.LGREEN : C.RED);
  gx.spr('hud_head', 94, 0);
  gx.text(`x${Math.min(g.lives, 99)}`, 103, 1, C.WHITE);
  if (lvl.powers.armor) gx.spr('hud_armor', 124, 0);
  if (lvl.powers.radar) gx.spr('hud_radar', 134, 0);
  if (g.blackFriday) gx.text('BF', 146, 1, Math.floor(g.frame / 20) % 2 ? C.YELLOW : C.RED, { font: TINY_FONT });
  // Active timed power-up and its draining bar.
  const p = lvl.powers;
  if (p.hud) {
    gx.text(POWERUP_NAMES[p.hud], 4, 9, C.CYAN, { font: TINY_FONT });
    const w = 40;
    gx.rect(70, 10, w, 4, C.DGREY);
    const frac = hudFraction(p);
    gx.rect(71, 11, Math.round((w - 2) * frac), 2, frac < 0.25 && Math.floor(g.frame / 6) % 2 ? C.RED : C.LGREEN);
  }
  if (lvl.alarm && Math.floor(g.frame / 15) % 2 === 0) gx.text('ALARM', 124, 9, C.RED, { font: TINY_FONT });
  gx.text(`L${g.loop}`, 176, 1, C.GREY, { font: TINY_FONT });
  drawLed(gx, g, lvl);
}

/** Elevator-style LED floor panel; inside a store it scrolls the store name like a marquee. */
function drawLed(gx: Gfx, g: GameState, lvl: Level): void {
  const x = 204;
  const w = 50;
  gx.rect(x, 1, w, 14, C.DGREY);
  gx.rect(x + 1, 2, w - 2, 12, C.BLACK);
  if (g.scene === 'store' && lvl.store) {
    const name = storeById(lvl.store.id).name + '   ';
    const full = name + name;
    const px = Math.floor(g.frame / 3) % (name.length * 6);
    gx.ctx.save();
    gx.ctx.beginPath();
    gx.ctx.rect(x + 2, 2, w - 4, 12);
    gx.ctx.clip();
    gx.text(full, x + 3 - px, 4, C.ORANGE);
    gx.ctx.restore();
    return;
  }
  const p = lvl.mall.player;
  let f = floorAtY(p.y);
  if (f < 0) f = floorBand(p.y);
  let arrow = '';
  if (p.mode === 'elevator') {
    const car = lvl.mall.cars[p.car];
    arrow = car.dir < 0 ? '↑' : car.dir > 0 ? '↓' : '';
  }
  const label = FLOOR_NAMES[f];
  // Seven-segment-ish look: dim "88" behind the lit floor.
  gx.text(label, x + 8 + (label.length === 1 ? 3 : 0), 4, C.ORANGE);
  if (arrow) gx.text(arrow, x + 34, 4, Math.floor(g.frame / 8) % 2 ? C.ORANGE : C.DRED);
}

// ---------------------------------------------------------------- title

export function drawNightSky(gx: Gfx, t: number, h = SCREEN_H): void {
  const bands = [C.BLACK, C.BLACK, C.DBLUE, C.DBLUE, C.DPURPLE, C.DPURPLE, C.DMAGENTA];
  const bh = Math.ceil(h / bands.length);
  bands.forEach((c, i) => gx.rect(0, i * bh, SCREEN_W, bh, c));
  for (let i = 0; i < 50; i++) {
    const x = (i * 53 + 11) % SCREEN_W;
    const y = (i * 37 + 5) % Math.floor(h * 0.6);
    const tw = Math.floor(t / 16 + i) % 9 === 0;
    gx.rect(x, y, 1, 1, tw ? C.GREY : i % 4 === 0 ? C.YELLOW : C.WHITE);
  }
}

export function drawTitle(gx: Gfx, g: GameState): void {
  const t = g.sceneT;
  drawNightSky(gx, t);
  // Logo: big two-tone MALL / ACTION.
  const s1 = 'MALL';
  const s2 = 'ACTION';
  gx.bigText(s1, Math.round((SCREEN_W - gx.bigWidth(s1, 4)) / 2), 22, 4, C.GOLD, C.ORANGE, C.DRED);
  gx.bigText(s2, Math.round((SCREEN_W - gx.bigWidth(s2, 4)) / 2), 56, 4, C.WHITE, C.LBLUE, C.DBLUE);
  gx.textC(BANNERS.subtitle, SCREEN_W / 2, 92, C.PINK, { shadow: C.BLACK });
  if (g.title.bf) {
    if (Math.floor(t / 6) % 2 === 0) gx.textC(BANNERS.blackFriday, SCREEN_W / 2, 106, C.YELLOW, { shadow: C.RED });
    gx.textC(BANNERS.seventyOff, SCREEN_W / 2, 116, Math.floor(t / 6) % 2 ? C.RED : C.WHITE, { shadow: C.BLACK });
  }
  if (Math.floor(t / 30) % 2 === 0) gx.textC(BANNERS.pressStart, SCREEN_W / 2, 130, C.WHITE, { shadow: C.DGREY });
  gx.textC(`HI ${String(g.hiScore).padStart(6, '0')}`, SCREEN_W / 2, 144, C.LGREEN, { shadow: C.BLACK });
  gx.textC(BANNERS.copyright, SCREEN_W / 2, 154, C.LGREY, { shadow: C.BLACK });
  // A row of real storefronts scrolling along the bottom.
  const base = 206;
  gx.rect(0, base - 42, SCREEN_W, 42, C.PERI);
  gx.rect(0, base - 42, SCREEN_W, 2, C.BLUE);
  const span = STORES.length * (STORE_W + 8);
  const scroll = Math.floor(t / 2) % span;
  STORES.forEach((s, i) => {
    let x = i * (STORE_W + 8) - scroll;
    if (x < -STORE_W) x += span;
    const fake = { ...s, x: 0 };
    drawStorefront(gx, fake, undefined, g.title.bf, t, x, base);
    if (x + span < SCREEN_W) drawStorefront(gx, fake, undefined, g.title.bf, t, x + span, base);
  });
  gx.rect(0, base, SCREEN_W, 3, C.WHITE);
  gx.rect(0, base + 3, SCREEN_W, SCREEN_H - base - 3, C.BLACK);
  gx.textC(BANNERS.controlHint, SCREEN_W / 2, 216, C.GREY);
  gx.textC(BANNERS.controlHint2 + '  C CRT  M MUTE', SCREEN_W / 2, 227, C.GREY, { font: TINY_FONT });
}

// ---------------------------------------------------------------- map overlay & kiosk

interface MapBox {
  x: number;
  y: number;
  w: number;
  rowH: number;
}

/** Schematic of the whole mall. Returns nothing; draws into the given box. */
function drawSchematic(gx: Gfx, g: GameState, lvl: Level, box: MapBox, highlight: string | null): void {
  const sx = (x: number) => box.x + Math.round((x / MALL_W) * box.w);
  const fy = (f: number) => box.y + f * box.rowH + box.rowH - 3;
  const blink = Math.floor(g.frame / 10) % 2 === 0;
  for (let f = 0; f < FLOORS; f++) {
    gx.rect(box.x, fy(f), box.w, 1, C.LGREY);
    gx.text(FLOOR_NAMES[f], box.x - 14, fy(f) - 6, C.WHITE, { font: TINY_FONT });
  }
  // Escalators.
  for (const e of ESCALATORS) {
    const x0 = sx(e.bottomX);
    const x1 = sx(e.topX);
    const y0 = fy(e.lower);
    const y1 = fy(e.lower - 1);
    const n = Math.max(1, Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) gx.rect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1, C.GOLD);
  }
  // Stores, colour-coded.
  for (const s of STORES) {
    const rt = lvl.stores[s.id];
    const x = sx(s.x) + 1;
    const w = Math.max(6, Math.round((STORE_W / MALL_W) * box.w) - 2);
    const y = fy(s.floor) - Math.min(9, box.rowH - 5);
    const h = Math.min(8, box.rowH - 5);
    const current = g.scene === 'store' && lvl.store?.id === s.id;
    if (current && !blink) continue;
    if (highlight === s.id && !blink) continue;
    if (s.role === 'closed') gx.frame(x, y, w, h, C.GREY);
    else if (s.role === 'powerup') gx.rect(x, y, w, h, C.BLUE);
    else if (rt?.cleared) gx.rect(x, y, w, h, C.GREY);
    else gx.rect(x, y, w, h, C.RED);
    if (highlight === s.id || current) gx.frame(x - 1, y - 1, w + 2, h + 2, C.WHITE);
    if (lvl.powers.radar && s.role === 'target' && !rt?.cleared && blink) gx.text('!', x + w / 2 - 2, y - 1, C.YELLOW, { font: TINY_FONT });
  }
  // Elevator shafts with their cars' current positions.
  SHAFTS.forEach((s, i) => {
    const x = sx(s.x + 12);
    gx.rect(x - 1, fy(s.top) - box.rowH + 4, 3, fy(s.bottom) - fy(s.top) + box.rowH - 4, C.DGREY);
    const car = lvl.mall.cars[i];
    const cy = box.y + ((car.y - surf(0)) / (surf(1) - surf(0))) * box.rowH + box.rowH - 3;
    gx.rect(x - 2, Math.round(cy) - 5, 5, 5, C.GOLD);
    gx.text(s.id, x - 1, fy(s.top) - box.rowH + 1, C.WHITE, { font: TINY_FONT });
  });
  // Getaway car.
  gx.rect(sx(WAGON.x), fy(5) - 4, Math.max(5, Math.round((WAGON.w / MALL_W) * box.w)), 4, C.OLIVE);
  // The player.
  if (g.scene === 'mall' && blink) {
    const p = lvl.mall.player;
    const py = box.y + ((p.y - surf(0)) / (surf(1) - surf(0))) * box.rowH + box.rowH - 3;
    gx.rect(sx(p.x) - 1, Math.round(py) - 5, 3, 5, C.LGREEN);
  }
}

export function drawMap(gx: Gfx, g: GameState): void {
  const lvl = g.level!;
  gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.DBLUE);
  gx.frame(4, HUD_H + 3, SCREEN_W - 8, SCREEN_H - HUD_H - 6, C.LBLUE);
  gx.textC(BANNERS.mapTitle, SCREEN_W / 2, HUD_H + 8, C.YELLOW, { shadow: C.BLACK });
  drawSchematic(gx, g, lvl, { x: 26, y: HUD_H + 18, w: 216, rowH: 24 }, null);
  // Legend.
  const ly = 184;
  const items: [number, string, boolean][] = [[C.RED, 'PACKAGE', false], [C.GREY, 'CLEARED', false], [C.BLUE, 'SHOP', false], [C.GREY, 'CLOSED', true]];
  items.forEach(([c, label, outline], i) => {
    const x = 12 + i * 60;
    if (outline) gx.frame(x, ly, 7, 6, c);
    else gx.rect(x, ly, 7, 6, c);
    gx.text(label, x + 10, ly + 1, C.WHITE, { font: TINY_FONT });
  });
  gx.rect(12, ly + 10, 5, 5, C.GOLD);
  gx.text('CAR', 20, ly + 11, C.WHITE, { font: TINY_FONT });
  gx.rect(52, ly + 10, 3, 5, C.LGREEN);
  gx.text('YOU', 58, ly + 11, C.WHITE, { font: TINY_FONT });
  if (lvl.powers.radar) gx.text('! = RADAR', 92, ly + 11, C.YELLOW, { font: TINY_FONT });
  // Inventory line.
  const inv = g.inventory.length ? g.inventory.join(', ') : 'NOTHING YET';
  const lines = wrap('INVENTORY: ' + inv, 60).slice(0, 3);
  lines.forEach((l, i) => gx.text(l, 12, ly + 22 + i * 7, C.LGREY, { font: TINY_FONT }));
}

export function drawKioskPanel(gx: Gfx, g: GameState, lvl: Level): void {
  const kp = lvl.mall.kioskPanel;
  if (!kp) return;
  const x = 120;
  const y = HUD_H + 4;
  const w = 132;
  const h = 96;
  gx.rect(x, y, w, h, C.BLACK);
  gx.frame(x, y, w, h, C.LGREEN);
  gx.text('YOU ARE HERE', x + 4, y + 3, C.LGREEN, { font: TINY_FONT });
  drawSchematic(gx, g, lvl, { x: x + 16, y: y + 8, w: w - 22, rowH: 12 }, kp.store);
  const name = kp.store ? storeById(kp.store).name : 'ALL FOUND! GO TO P';
  gx.text(kp.store ? 'NEAREST: ' + name : name, x + 4, y + h - 9, C.YELLOW, { font: TINY_FONT });
}

// ---------------------------------------------------------------- pause

export function drawPause(gx: Gfx, g: GameState): void {
  gx.dim(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, 0.55);
  if (Math.floor(g.overlayT / 20) % 2 === 0) {
    const w = gx.bigWidth(BANNERS.pause, 3);
    gx.bigText(BANNERS.pause, Math.round((SCREEN_W - w) / 2), 108, 3, C.WHITE, C.LGREY, C.BLACK);
  }
  gx.textC('START TO RESUME', SCREEN_W / 2, 140, C.LGREY, { font: TINY_FONT });
}

// ---------------------------------------------------------------- SPYGRAM

export function drawSpygram(gx: Gfx, post: SpygramPost, t: number, cx = SCREEN_W / 2, cy = 124): void {
  const w = 148;
  const h = 150;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  gx.rect(x - 1, y - 1, w + 2, h + 2, C.BLACK);
  gx.rect(x, y, w, h, C.WHITE);
  gx.rect(x, y, w, 12, C.MAGENTA);
  gx.text(BANNERS.spygram, x + 4, y + 3, C.WHITE);
  gx.rect(x + w - 12, y + 3, 7, 6, C.WHITE);
  gx.rect(x + w - 10, y + 5, 3, 2, C.MAGENTA);
  // The photo.
  const px = x + 4;
  const py = y + 16;
  const ph = 76;
  const bands = [C.DBLUE, C.PURPLE, C.HOTPINK, C.ORANGE];
  bands.forEach((c, i) => gx.rect(px, py + i * (ph / 4), w - 8, ph / 4, c));
  gx.rect(px, py + ph - 10, w - 8, 10, C.GREY);
  gx.sprScaled('portrait_agent', px + (w - 8) / 2 - 36, py + 4, 3);
  // Likes climb quickly.
  const likes = Math.min(99999, Math.floor(Math.pow(Math.max(0, t), 1.7)));
  gx.text('♥', x + 4, py + ph + 4, C.RED);
  gx.text(`${likes} LIKES`, x + 12, py + ph + 4, C.BLACK);
  post.caption.forEach((l, i) => gx.text(l, x + 4, py + ph + 15 + i * 9, C.DGREY));
  const cm = post.comment;
  const colon = cm.indexOf(':');
  gx.text(cm.slice(0, colon + 1), x + 4, y + h - 11, C.BLUE);
  gx.text(cm.slice(colon + 1), x + 4 + (colon + 1) * 6, y + h - 11, C.GREY);
}

// ---------------------------------------------------------------- level clear

export function drawLevelClear(gx: Gfx, g: GameState): void {
  const c = g.clear;
  if (!c) {
    gx.clear(C.BLACK);
    return;
  }
  const t = c.t;
  if (c.phase === 'drive' || c.phase === 'tally') {
    // Parking-garage backdrop.
    gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.DGREY);
    gx.rect(0, HUD_H, SCREEN_W, 8, C.GREY);
    for (let x = 16; x < SCREEN_W; x += 80) {
      gx.rect(x, HUD_H + 8, 14, 150, C.GREY);
      gx.rect(x + 2, HUD_H + 8, 2, 150, C.LGREY);
      for (let y = 160; y < 174; y += 4) {
        gx.rect(x, y, 14, 2, C.GOLD);
        gx.rect(x, y + 2, 14, 2, C.BLACK);
      }
    }
    gx.rect(0, 174, SCREEN_W, 4, C.LGREY);
    gx.rect(0, 178, SCREEN_W, SCREEN_H - 178, C.GREY);
    for (let x = 0; x < SCREEN_W; x += 32) gx.rect(x + ((g.frame >> 1) % 32), 190, 16, 2, C.YELLOW);
  }
  if (c.phase === 'drive') {
    const wx = 80 + Math.max(0, t - 30) * Math.max(0, t - 30) * 0.012;
    const bounce = Math.floor(t / 4) % 2;
    gx.spr('wagon_body', wx, 150 - bounce);
    gx.spr(`wagon_wheel_${Math.floor(t / 3) % 2}`, wx + 10, 166);
    gx.spr(`wagon_wheel_${Math.floor(t / 3) % 2}`, wx + 46, 166);
    if (t > 30) for (let i = 0; i < 3; i++) gx.rect(wx - 6 - i * 6, 168 - ((t + i * 3) % 6), 3, 3, C.LGREY);
    const sx = -20 + t * 1.1;
    gx.spr(gx.anim('spy_receipt', t, 6), sx, 150);
    if (t > 60 && t < 200 && Math.floor(t / 20) % 2 === 0) gx.text('WAIT! YOUR RECEIPT!', Math.max(2, sx - 40), 138, C.WHITE, { font: TINY_FONT, shadow: C.BLACK });
    gx.bigText('LEVEL CLEAR!', Math.round((SCREEN_W - gx.bigWidth('LEVEL CLEAR!', 2)) / 2), 40, 2, C.YELLOW, C.ORANGE, C.BLACK);
    return;
  }
  if (c.phase === 'tally') {
    gx.rect(24, 40, SCREEN_W - 48, 110, C.BLACK);
    gx.frame(24, 40, SCREEN_W - 48, 110, C.WHITE);
    gx.textC('BONUS TALLY', SCREEN_W / 2, 48, C.YELLOW);
    const rows: [string, string][] = [
      ['PACKAGES', `${c.packages} x 500`],
      ['TIME BONUS', String(c.timeBonus)],
      ['CLEAR BONUS', '1000'],
      [BANNERS.loop(g.loop), 'COMPLETE'],
    ];
    rows.slice(0, Math.min(rows.length, 1 + Math.floor(t / 30))).forEach(([a, b], i) => {
      gx.text(a, 36, 66 + i * 14, C.WHITE);
      gx.text(b, SCREEN_W - 36 - textWidth(MAIN_FONT, b), 66 + i * 14, C.LGREEN);
    });
    if (t > 130) gx.textC(`SCORE ${String(g.score).padStart(6, '0')}`, SCREEN_W / 2, 132, C.GOLD);
    return;
  }
  if (c.phase === 'news') {
    drawNewspaper(gx, g, c.headline, t);
    return;
  }
  drawNightSky(gx, t);
  drawSpygram(gx, c.post, t, SCREEN_W / 2, 128);
  gx.textC('MISSION COMPLETE', SCREEN_W / 2, HUD_H + 16, C.YELLOW, { shadow: C.BLACK });
}

function drawNewspaper(gx: Gfx, g: GameState, headline: string, t: number): void {
  gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.DGREY);
  const x = 16;
  const y = HUD_H + 8 + Math.max(0, 30 - t) * 4;
  const w = SCREEN_W - 32;
  gx.rect(x + 3, y + 3, w, 196, C.BLACK);
  gx.rect(x, y, w, 196, C.CREAM);
  const mast = BANNERS.dailyMall;
  gx.bigText(mast, Math.round(x + (w - gx.bigWidth(mast, 2)) / 2), y + 6, 2, C.BLACK, C.BLACK);
  gx.rect(x + 6, y + 24, w - 12, 1, C.BLACK);
  gx.text(`LOOP ${g.loop} EDITION     25 CENTS`, x + 8, y + 27, C.DGREY, { font: TINY_FONT });
  gx.rect(x + 6, y + 34, w - 12, 1, C.BLACK);
  const lines = wrap(headline, 26);
  lines.forEach((l, i) => gx.textC(l, SCREEN_W / 2, y + 40 + i * 10, C.BLACK));
  const py = y + 44 + lines.length * 10;
  // A "photo" of the getaway car, plus column filler.
  gx.rect(x + 8, py, 96, 56, C.GREY);
  gx.rect(x + 9, py + 1, 94, 54, C.LGREY);
  gx.spr('wagon_body', x + 24, py + 20, false, [C.DGREY, C.GREY, C.BLACK]);
  gx.spr('wagon_wheel_0', x + 34, py + 36, false, [C.BLACK, C.DGREY, C.GREY]);
  gx.spr('wagon_wheel_0', x + 70, py + 36, false, [C.BLACK, C.DGREY, C.GREY]);
  for (let i = 0; i < 8; i++) gx.rect(x + 112, py + 2 + i * 7, i % 3 === 2 ? 60 : 94, 2, C.GREY);
  for (let i = 0; i < 6; i++) gx.rect(x + 8, py + 62 + i * 7, i % 4 === 3 ? 120 : w - 16, 2, C.GREY);
}

// ---------------------------------------------------------------- continue & game over

export function drawContinue(gx: Gfx, g: GameState): void {
  gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.BLACK);
  const n = continueNumber(g);
  gx.textC(BANNERS.continue, SCREEN_W / 2, 60, C.WHITE);
  const s = String(n);
  const w = gx.bigWidth(s, 8);
  gx.bigText(s, Math.round((SCREEN_W - w) / 2), 86, 8, n <= 3 ? C.RED : C.WHITE, n <= 3 ? C.CRIMSON : C.LGREY, C.DGREY);
  gx.textC(BANNERS.continuesLeft(g.continues), SCREEN_W / 2, 164, C.LGREY);
  if (Math.floor(g.frame / 20) % 2 === 0) gx.textC(BANNERS.pressStart, SCREEN_W / 2, 184, C.YELLOW);
}

export function drawGameOver(gx: Gfx, g: GameState): void {
  const o = g.over!;
  const t = o.t;
  // Storefronts with the agent in front; shutters roll down over everything.
  gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.PERI);
  const base = 200;
  STORES.slice(0, 3).forEach((s, i) => drawStorefront(gx, { ...s, x: 0 }, undefined, false, 0, 8 + i * 84, base));
  gx.rect(0, base, SCREEN_W, 4, C.WHITE);
  gx.rect(0, base + 4, SCREEN_W, SCREEN_H - base - 4, C.LGREY);
  gx.spr('agent_stand', 120, base - 24);
  const shutter = Math.min(base - HUD_H, Math.max(0, (t - 20) * 0.8));
  for (let y = HUD_H; y < HUD_H + shutter; y += 4) {
    gx.rect(0, y, SCREEN_W, 3, C.LGREY);
    gx.rect(0, y + 3, SCREEN_W, 1, C.GREY);
  }
  if (shutter > 0) gx.rect(0, HUD_H + shutter - 2, SCREEN_W, 3, C.DGREY);
  // Typewriter PA message.
  const [l1, l2] = BANNERS.mallClosed;
  const typed = Math.max(0, Math.floor((t - GAMEOVER_TEXT_START) / GAMEOVER_TYPE));
  const a = l1.slice(0, typed);
  const b = l2.slice(0, Math.max(0, typed - l1.length));
  gx.rect(20, 40, SCREEN_W - 40, 30, C.BLACK);
  gx.frame(20, 40, SCREEN_W - 40, 30, C.YELLOW);
  gx.text(a, 30, 46, C.YELLOW);
  gx.text(b, 30, 57, C.YELLOW);
  if (t >= GAMEOVER_SHOW) {
    const w = gx.bigWidth(BANNERS.gameOver, 3);
    gx.rect(0, 96, SCREEN_W, 64, C.BLACK);
    gx.bigText(BANNERS.gameOver, Math.round((SCREEN_W - w) / 2), 104, 3, C.RED, C.CRIMSON, C.DGREY);
    gx.textC(`SCORE ${String(g.score).padStart(6, '0')}`, SCREEN_W / 2, 134, C.WHITE);
    gx.textC(`HI ${String(g.hiScore).padStart(6, '0')}`, SCREEN_W / 2, 146, C.LGREEN);
  }
}

// ---------------------------------------------------------------- in-play overlays

export function drawPlayOverlays(gx: Gfx, g: GameState): void {
  const lvl = g.level;
  if (!lvl) return;
  const m = lvl.mall;
  if (g.scene === 'mall') {
    const p = m.player;
    if (p.mode === 'selfie') {
      if (p.modeT < 6) gx.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, C.WHITE);
      else if (p.modeT > 12) drawSpygram(gx, lvl.arrivalPost, p.modeT - 12, SCREEN_W / 2, 120);
    }
    if (m.announce) {
      const w = textWidth(TINY_FONT, m.announce.text) + 10;
      gx.rect((SCREEN_W - w) / 2, HUD_H + 3, w, 11, C.BLACK);
      gx.frame((SCREEN_W - w) / 2, HUD_H + 3, w, 11, C.GOLD);
      gx.textC(m.announce.text, SCREEN_W / 2, HUD_H + 6, C.GOLD, { font: TINY_FONT });
    }
    drawKioskPanel(gx, g, lvl);
    if (m.photoPopup > 0) drawPhotoStrip(gx, g, m.photoPopup);
  }
  if (g.pa) {
    const lines = g.pa.lines;
    const h = lines.length * 9 + 12;
    const y = SCREEN_H - h - 4;
    gx.rect(8, y, SCREEN_W - 16, h, C.BLACK);
    gx.frame(8, y, SCREEN_W - 16, h, C.YELLOW);
    gx.text('♪ MALL PA', 12, y + 2, C.GOLD, { font: TINY_FONT });
    lines.forEach((l, i) => gx.textC(l, SCREEN_W / 2, y + 10 + i * 9, C.WHITE));
  }
  if (g.banner) drawBanner(gx, g.banner, 70, g.frame);
}

function drawPhotoStrip(gx: Gfx, g: GameState, t: number): void {
  const x = 196;
  const y = HUD_H + 8;
  gx.rect(x, y, 34, 110, C.WHITE);
  gx.frame(x, y, 34, 110, C.BLACK);
  const tints: (number[] | undefined)[] = [undefined, [C.DGREY, C.GREY, C.LGREY], undefined, [C.MAGENTA, C.BLACK, C.PINK]];
  for (let i = 0; i < 4; i++) {
    gx.rect(x + 4, y + 4 + i * 26, 26, 24, i % 2 ? C.SKY : C.LPINK);
    gx.spr('portrait_agent', x + 5, y + 4 + i * 26, i === 2, tints[i]);
  }
  if (Math.floor(t / 10) % 2 === 0) gx.text(BANNERS.photoStrip, 100, y + 114, C.YELLOW, { font: TINY_FONT, shadow: C.BLACK });
  void g;
}

export { doorX };
