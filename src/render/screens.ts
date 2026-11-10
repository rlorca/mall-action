/** Title, map, pause, level clear, continue, game over and the sprite gallery. */
import { Fb } from '../gfx/fb';
import { nearestIndex } from '../gfx/palette';
import { wrap } from '../gfx/font';
import { S, SPRITES } from '../gfx/sprites';
import { Pr, PROPS } from '../gfx/props';
import type { Game } from '../game/types';
import { ESCALATORS, FLOOR_NAMES, FLOOR_Y, F_P, SHAFTS, STORES, STORE_W, WAGON_X, floorOf } from '../game/level';
import { ARRIVAL_POSTS, CLEAR_POSTS, HEADLINES, LIMITS, TEXT } from '../game/copy';
import { continueCount } from '../game/game';
import { drawSplash } from '../flickersoft/splash';
import { drawStorefront, SF_H } from './storefront';
import { drawSpygram } from './ui';

export function drawSplashScreen(fb: Fb, g: Game): void {
  drawSplash(g.splash, { width: fb.w, height: fb.h, fillRect: (x, y, w, h, rgb) => fb.rect(x, y, w, h, nearestIndex(rgb)) });
}

function nightSky(fb: Fb, frame: number): void {
  const bands = [0x0f, 0x01, 0x02, 0x03, 0x04, 0x14];
  for (let i = 0; i < bands.length; i++) {
    fb.rect(0, i * 26, 256, 26, bands[i]);
    if (i > 0) for (let x = i & 1; x < 256; x += 2) fb.pset(x, i * 26 - 1, bands[i]);
  }
  for (let i = 0; i < 46; i++) {
    const tw = (i + Math.floor(frame / 24)) % 9 === 0;
    fb.pset((i * 89 + 17) % 256, (i * 37) % 120, tw ? 0x10 : 0x30);
  }
}

/** Two-tone big text with a drop shadow. */
function logo(fb: Fb, text: string, x: number, y: number, scale: number, top: number, bottom: number): void {
  fb.bigText(text, x + 2, y + 2, scale, 0x0f);
  fb.bigText(text, x, y, scale, top);
  const saved = [fb.cx0, fb.cy0, fb.cx1, fb.cy1];
  fb.clip(0, y + Math.floor((7 * scale) / 2), 256, 7 * scale);
  fb.bigText(text, x, y, scale, bottom);
  [fb.cx0, fb.cy0, fb.cx1, fb.cy1] = saved;
}

export function drawTitle(fb: Fb, g: Game): void {
  const f = g.frame;
  nightSky(fb, f);
  logo(fb, TEXT.title1, 128 - 62, 14, 4, 0x28, 0x16);
  logo(fb, TEXT.title2, 128 - 94, 46, 4, 0x30, 0x21);
  if (g.bfArmed) {
    if (f & 8) fb.textC(TEXT.blackFriday, 128, 82, f & 16 ? 0x28 : 0x16);
    fb.textC(TEXT.blackFriday2, 128, 92, 0x30);
  } else fb.textC(TEXT.subtitle, 128, 84, 0x2c);
  if (g.t % 60 < 40) fb.textC(TEXT.pressStart, 128, 106, 0x30);
  fb.textC('HI ' + String(g.hi).padStart(6, '0'), 128, 120, 0x28);
  fb.textC(TEXT.copyright, 128, 132, 0x10);
  // a row of real storefronts scrolling along the bottom
  const y = 150;
  fb.rect(0, y - 2, 256, SF_H + 2, 0x31);
  fb.rect(0, y - 2, 256, 2, 0x21);
  const open = STORES;
  const span = open.length * 96;
  const off = Math.floor(g.t / 2) % span;
  for (let i = 0; i < open.length; i++) {
    let x = i * 96 - off;
    if (x < -STORE_W) x += span;
    if (x < 256) drawStorefront(fb, open[i], x, y, f, false, g.bfArmed);
  }
  fb.rect(0, y + SF_H, 256, 4, 0x00);
  fb.rect(0, y + SF_H, 256, 1, 0x10);
  fb.rect(0, y + SF_H + 4, 256, 240, 0x0f);
  fb.textC(TEXT.controls1, 128, 208, 0x10);
  fb.textC(TEXT.controls2, 128, 220, 0x10);
}

/** Full-screen MALL DIRECTORY schematic. */
export function drawMap(fb: Fb, g: Game): void {
  const L = g.level!;
  const f = g.frame;
  fb.rect(0, 0, 256, 240, 0x0f);
  fb.frame(2, 2, 252, 236, 0x21);
  fb.textC(TEXT.mapTitle, 128, 8, 0x30);
  const X = (wx: number) => 22 + Math.round(wx * 0.295);
  const Y = (fl: number) => 34 + fl * 24;
  for (let fl = 0; fl < 6; fl++) {
    fb.text(FLOOR_NAMES[fl], 5, Y(fl) + 3, 0x10);
    fb.rect(22, Y(fl) + 12, 228, 1, 0x00);
  }
  // elevator shafts with their cars' current positions
  SHAFTS.forEach((s, i) => {
    const x = X(s.x + 12);
    fb.rect(x - 1, Y(s.top), 3, Y(s.bottom) - Y(s.top) + 12, 0x00);
    const cy = Y(0) + ((L.cars[i].y - FLOOR_Y[0]) / 48) * 24;
    fb.rect(x - 3, Math.round(cy) + 2, 7, 10, 0x2a);
    fb.tiny(s.id, x - 1, Math.round(cy) + 4, 0x0f);
  });
  for (const e of ESCALATORS) fb.line(X(e.xLow), Y(e.lower) + 11, X(e.xHigh), Y(e.upper) + 12, 0x28);
  for (const st of L.stores) {
    const x = X(st.def.x), y = Y(st.def.floor) + 2;
    const w = Math.round(STORE_W * 0.295);
    const here = L.mode === 'store' && L.room && L.room.store === st.def.id;
    if (here && f & 8) { fb.frame(x, y, w, 10, 0x30); continue; }
    if (st.def.role === 'closed') fb.frame(x, y, w, 10, 0x00);
    else fb.rect(x, y, w, 10, st.def.role === 'shop' ? 0x12 : st.cleared ? 0x10 : 0x16);
    // Radar marks every remaining package store
    if (L.powers.radar && st.def.role === 'target' && !st.cleared) fb.text('!', x + w / 2 - 4, y + 1, f & 8 ? 0x28 : 0x30);
  }
  // getaway car
  fb.rect(X(WAGON_X) - 5, Y(F_P) + 6, 11, 5, 0x27);
  fb.rect(X(WAGON_X) - 3, Y(F_P) + 3, 7, 3, 0x37);
  // the player's position blinks
  if (L.mode !== 'store' && f & 8) {
    const P = L.player;
    const py = Y(0) + ((P.y - FLOOR_Y[0]) / 48) * 24;
    fb.rect(X(P.x) - 1, Math.round(py) + 4, 3, 8, 0x30);
    fb.rect(X(P.x) - 2, Math.round(py) + 2, 5, 3, 0x26);
  }
  // legend
  const ly = 182;
  const leg: [number, string, boolean][] = [[0x16, 'PACKAGE', false], [0x10, 'CLEARED', false], [0x12, 'POWER-UP', false], [0x00, 'CLOSED', true]];
  leg.forEach(([c, name, outline], i) => {
    const x = 8 + (i % 2) * 124, y = ly + Math.floor(i / 2) * 11;
    if (outline) fb.frame(x, y, 10, 8, c);
    else fb.rect(x, y, 10, 8, c);
    fb.text(name, x + 14, y, 0x30);
  });
  fb.rect(8, ly + 23, 5, 5, 0x2a); fb.text('CAR', 16, ly + 22, 0x30);
  fb.line(52, ly + 28, 60, ly + 22, 0x28); fb.text('ESC', 64, ly + 22, 0x30);
  fb.rect(132, ly + 24, 7, 4, 0x27); fb.text('EXIT', 146, ly + 22, 0x30);
  fb.text(`F:${FLOOR_NAMES[floorOf(L.player.y)]}`, 200, ly + 22, 0x28);
  // inventory line (joke items, photo strip)
  let ix = 8;
  fb.text('ITEMS', ix, 218, 0x10);
  ix += 48;
  if (g.photoStrip) { fb.rect(ix, 216, 6, 12, 0x30); for (let k = 0; k < 4; k++) fb.rect(ix + 1, 217 + k * 3, 4, 2, 0x16); ix += 10; }
  for (const it of g.inventory.slice(0, 5)) { void it; fb.spr(S('pu_joke'), ix, 216); ix += 14; }
  const last = g.inventory[g.inventory.length - 1];
  if (last) fb.text(last.slice(0, 24 - Math.floor((ix - 56) / 8)), ix + 2, 218, 0x28);
  else if (!g.photoStrip) fb.text('-', ix, 218, 0x10);
}

export function drawPause(fb: Fb, g: Game): void {
  fb.shade(0, 16, 256, 224, 2);
  if (g.frame & 16) {
    fb.rect(96, 108, 64, 20, 0x0f);
    fb.frame(96, 108, 64, 20, 0x30);
    fb.textC(TEXT.pause, 128, 114, 0x30);
  }
}

function garage(fb: Fb): void {
  fb.rect(0, 0, 256, 240, 0x0f);
  fb.rect(0, 40, 256, 120, 0x00);
  fb.rect(0, 40, 256, 4, 0x10);
  for (let x = 20; x < 256; x += 78) { fb.rect(x, 44, 14, 116, 0x2d); fb.rect(x, 80, 14, 8, 0x28); fb.rect(x + 2, 44, 2, 116, 0x10); }
  fb.rect(0, 160, 256, 6, 0x10);
  for (let x = 8; x < 256; x += 40) fb.rect(x, 162, 18, 2, 0x28);
  fb.text('P', 232, 52, 0x30);
  fb.text('EXIT }', 96, 50, 0x2a);
}

export function drawClear(fb: Fb, g: Game): void {
  const c = g.clear;
  if (!c) return;
  const f = g.frame;
  if (c.phase === 0) {
    garage(fb);
    // the wood-panelled wagon drives off while a spy chases it waving a receipt
    const wx = -70 + c.t * 1.1;
    const bob = (f >> 2) & 1;
    fb.spr(Pr('wagon'), wx, 136 - bob);
    if (wx < 256) { fb.rect(wx - 6 - (f & 4), 152, 4, 3, 0x10); fb.rect(wx - 14 + (f & 2), 149, 3, 3, 0x00); }
    const sx = wx - 44 - Math.min(40, c.t * 0.12);
    fb.spr(S(Math.floor(f / 6) % 2 ? 'sp_walk1' : 'sp_walk2'), sx, 136);
    fb.spr(S('receipt'), sx + 13, 128 + ((f >> 2) & 3));
    fb.textC('MISSION COMPLETE!', 128, 12, f & 16 ? 0x28 : 0x30);
    const lines: [string, string][] = [
      ['PACKAGES', '6 X 500'],
      ['TIME BONUS', String(c.timeBonus)],
      ['CLEAR BONUS', '1000'],
      ['SCORE', String(g.score)],
    ];
    lines.forEach(([a, b], i) => {
      if (c.t > 40 + i * 40) { fb.text(a, 48, 176 + i * 11, 0x30); fb.text(b, 208 - b.length * 8, 176 + i * 11, i === 3 ? 0x28 : 0x2a); }
    });
    if (c.t > 200) fb.textC('LOOP ' + g.loop, 128, 221, 0x26);
  } else if (c.phase === 1) {
    // front page of THE DAILY MALL
    fb.rect(0, 0, 256, 240, 0x00);
    fb.rect(14, 14, 228, 212, 0x30);
    fb.frame(14, 14, 228, 212, 0x0f);
    fb.bigText(TEXT.paper, 128 - TEXT.paper.length * 8, 22, 2, 0x0f);
    fb.rect(20, 40, 216, 2, 0x0f);
    fb.text('LOOP ' + g.loop + ' EDITION', 22, 46, 0x00);
    fb.text('25C', 210, 46, 0x00);
    fb.rect(20, 56, 216, 1, 0x0f);
    const lines = wrap(HEADLINES[c.headline], LIMITS.headline);
    lines.forEach((l, i) => fb.textC(l, 128, 64 + i * 12, 0x0f));
    const y0 = 64 + lines.length * 12 + 6;
    fb.rect(22, y0, 100, 60, 0x10);
    fb.frame(22, y0, 100, 60, 0x0f);
    fb.spr(Pr('wagon'), 40, y0 + 28);
    fb.spr(S('ag_stand'), 30, y0 + 28);
    for (let k = 0; k < 9; k++) fb.rect(130, y0 + 2 + k * 7, k % 4 === 3 ? 60 : 104, 2, 0x10);
    for (let k = 0; k < 6; k++) { if (y0 + 70 + k * 7 < 216) fb.rect(22, y0 + 68 + k * 7, k % 3 === 2 ? 150 : 212, 2, 0x10); }
  } else {
    garage(fb);
    fb.shade(0, 0, 256, 240, 1);
    drawSpygram(fb, CLEAR_POSTS[c.post], Math.min(99999, c.t * 43), 60, (x, y, w, h) => {
      fb.rect(x, y, w, h, 0x00);
      fb.rect(x, y + h - 8, w, 8, 0x10);
      fb.spr(Pr('wagon'), x + 70, y + h - 30);
      fb.spr(S('ag_selfie'), x + 30, y + h - 30);
      fb.spr(S('pkg'), x + 8, y + h - 22);
    });
  }
  if (c.t > 60 && f & 32 && c.phase !== 0) fb.textC('START: NEXT', 128, 230, 0x10);
  if (c.phase === 0 && c.t > 60 && f & 32) fb.textC('START: NEXT', 128, 232, 0x10);
}

export function drawContinue(fb: Fb, g: Game): void {
  fb.rect(0, 0, 256, 240, 0x0f);
  const n = continueCount(g);
  fb.textC(TEXT.continueQ, 128, 50, 0x30);
  fb.bigText(String(n), 128 - 5 * 3 - 3, 84, 6, n <= 3 ? 0x16 : 0x30);
  fb.textC(TEXT.continuesLeft + ' ' + g.continues, 128, 156, 0x28);
  if (g.frame & 16) fb.textC(TEXT.pressStart, 128, 180, 0x30);
  fb.textC('SCORE ' + String(g.score).padStart(6, '0'), 128, 204, 0x10);
}

export function drawGameOver(fb: Fb, g: Game): void {
  const t = g.t;
  const f = g.frame;
  nightSky(fb, f);
  const y = 110;
  fb.rect(0, y - 2, 256, SF_H + 2, 0x31);
  const row = [STORES[0], STORES[1], STORES[4]];
  row.forEach((s, i) => drawStorefront(fb, s, 4 + i * 84, y, f, false, false));
  fb.rect(0, y + SF_H, 256, 4, 0x00);
  fb.rect(0, y + SF_H + 4, 256, 100, 0x0f);
  fb.spr(S('ag_dead'), 120, y + SF_H - 24);
  // metal shutters roll down over the storefronts and the agent
  const h = Math.min(SF_H + 2, Math.max(0, Math.floor((t - 60) / 3)));
  if (h > 0) {
    fb.rect(0, y - 2, 256, h, 0x10);
    for (let yy = y - 2 + ((h + 1) % 3); yy < y - 2 + h; yy += 3) fb.rect(0, yy, 256, 1, 0x00);
    fb.rect(0, y - 2 + h - 2, 256, 2, 0x2d);
  }
  // typewriter PA message
  const n = Math.max(0, Math.floor((t - 40) / 4));
  fb.textC(TEXT.closed1.slice(0, n).padEnd(TEXT.closed1.length, ' '), 128, 40, 0x30);
  fb.textC(TEXT.closed2.slice(0, Math.max(0, n - TEXT.closed1.length)).padEnd(TEXT.closed2.length, ' '), 128, 54, 0x28);
  if (t > 300) {
    fb.rect(40, 170, 176, 58, 0x0f);
    fb.frame(40, 170, 176, 58, 0x16);
    fb.bigText(TEXT.gameOver, 128 - TEXT.gameOver.length * 8, 176, 2, 0x16);
    fb.textC('SCORE ' + String(g.score).padStart(6, '0'), 128, 200, 0x30);
    fb.textC('HI    ' + String(g.hi).padStart(6, '0'), 128, 212, 0x28);
  }
}

/** ?gallery=1: every sprite, animated (numbered variants cycle in place). */
export function drawGallery(fb: Fb, frame: number, scroll: number): number {
  fb.clear(0x21);
  const all = { ...SPRITES, ...PROPS };
  const groups = new Map<string, string[]>();
  for (const k of Object.keys(all)) {
    const base = k.replace(/\d+$/, '');
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(k);
  }
  let x = 4, y = 20 - scroll, rowH = 0;
  for (const [, names] of groups) {
    const s = all[names[Math.floor(frame / 12) % names.length]];
    if (x + s.w > 252) { x = 4; y += rowH + 4; rowH = 0; }
    fb.spr(s, x, y);
    x += s.w + 4;
    rowH = Math.max(rowH, s.h);
  }
  fb.rect(0, 0, 256, 14, 0x0f);
  fb.text('SPRITE GALLERY  ^~ SCROLL', 4, 3, 0x30);
  return y + rowH + scroll;
}
export { ARRIVAL_POSTS };
