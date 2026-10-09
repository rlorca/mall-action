import { Gfx } from './gfx';
import { Game } from '../core/game';
import { Mall } from '../core/mall';
import { SpygramPost, MISC, STORES, StoreId, FLOOR_NAMES, storeInfo, wrapLines, LIMITS, JOKE_ITEMS } from '../core/copy';
import { ESCALATORS, FLOOR_COUNT, FLOOR_P, GETAWAY, MALL_W, SHAFTS, STOREFRONTS, STORE_W, floorAt, floorY } from '../core/level';
import { drawStorefrontAt, storeColour } from './mall-render';
import { drawFlickersoft } from '../flickersoft/splash';
import { SPY_DEATH_FRAMES } from '../core/mall-spies';
import { remainingPackageStores } from '../core/levelsetup';
import { C } from '../art/palette';

// ================================================================ shared bits
function skyBands(g: Gfx, h: number): void {
  const bands = [0x0f, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x04, 0x05, 0x05, 0x15];
  const bh = Math.ceil(h / bands.length);
  bands.forEach((c, i) => g.rect(0, i * bh, 256, bh + 1, c));
}

function stars(g: Gfx, f: number, h: number, seed = 0): void {
  for (let i = 0; i < 60; i++) {
    const x = (i * 97 + seed * 13 + 11) % 256;
    const y = (i * 53 + seed * 7 + 5) % h;
    if ((i + Math.floor(f / 20)) % 4 === 0) continue;
    g.px(x, y, i % 3 === 0 ? 0x30 : 0x10);
  }
}

export function fmtScore(n: number): string {
  return String(Math.min(999999, Math.max(0, n))).padStart(6, '0');
}

// ================================================================ splash
export function drawSplash(g: Gfx, game: Game): void {
  drawFlickersoft(g.ctx, game.splash, 256, 240);
}

// ================================================================ title
export function drawTitle(g: Gfx, game: Game, f: number): void {
  const t = game.title;
  skyBands(g, 160);
  stars(g, f, 150);
  // moon
  g.rect(196, 14, 12, 12, 0x38);
  g.rect(199, 12, 6, 16, 0x38);
  g.rect(203, 13, 6, 12, 0x04);
  // skyline
  for (let i = 0; i < 24; i++) {
    const bx = i * 12 - 4;
    const h = 20 + ((i * 29) % 40);
    g.rect(bx, 150 - h, 11, h, 0x0f);
    for (let wy = 150 - h + 3; wy < 146; wy += 5) for (let wx = 2; wx < 9; wx += 4) if ((i * 5 + wy + wx) % 3 === 0) g.px(bx + wx, wy, (i + wy) % 4 ? 0x28 : 0x38);
  }
  // logo
  const bob = Math.round(Math.sin(f / 30) * 1);
  g.textTwoTone('MALL', 128, 18 + bob, 0x28, 0x16, 4, 0x03);
  g.textTwoTone('ACTION', 128, 50 + bob, 0x30, 0x21, 4, 0x03);
  g.rect(40, 84, 176, 1, 0x30);
  g.text(MISC.subtitle, 128, 90, 0x28, { align: 'center', shadow: 0x0f });
  // storefronts scrolling along the bottom
  const rowY = 150;
  g.rect(0, rowY - 1, 256, 60, 0x0f);
  g.rect(0, rowY + 44, 256, 4, 0x17);
  g.rect(0, rowY + 44, 256, 1, 0x30);
  const step = STORE_W + 8;
  const total = STORES.length * step;
  const scroll = Math.floor(f / 2) % total;
  for (let rep = -1; rep <= 1; rep++) {
    for (let i = 0; i < STORES.length; i++) {
      const x = i * step - scroll + rep * total;
      if (x > 256 || x + STORE_W < 0) continue;
      const id = STORES[i].id;
      drawStorefrontAt(g, id, x, rowY, f, { cleared: false, bf: t.blackFriday });
    }
  }
  g.rect(0, rowY + 48, 256, 240 - rowY - 48, 0x0f);
  // hi-score and copyright
  g.text(`HI-SCORE ${fmtScore(game.hiScore)}`, 128, 102, 0x30, { align: 'center' });
  if ((f >> 4) % 2 === 0) g.text(MISC.pressStart, 128, 116, 0x30, { align: 'center', shadow: 0x0f });
  g.text(MISC.copyright, 128, 129, 0x10, { align: 'center' });
  // control hints
  g.text('ARROWS:MOVE  Z:SHOOT  X:JUMP/SEARCH', 128, 207, 0x10, { align: 'center' });
  g.text('SHIFT:MAP  ENTER:PAUSE  C:CRT  M:MUTE', 128, 219, 0x10, { align: 'center' });
  if (t.blackFriday && t.bfFlash <= 0 && (f >> 3) % 2 === 0) g.text('BLACK FRIDAY MODE', 128, 141, 0x16, { align: 'center' });
  // Konami: BLACK FRIDAY!
  if (t.bfFlash > 0) {
    const flash = (f >> 2) % 2 === 0;
    g.rect(0, 60, 256, 54, flash ? 0x16 : 0x28);
    g.rect(0, 60, 256, 2, 0x30);
    g.rect(0, 112, 256, 2, 0x30);
    g.text(MISC.blackFriday1, 128, 66, flash ? 0x28 : 0x16, { align: 'center', scale: 3, shadow: 0x0f });
    g.text(MISC.blackFriday2, 128, 96, 0x30, { align: 'center', scale: 1, shadow: 0x0f });
    g.text('%', 20, 94, 0x30, { scale: 2 });
    g.text('%', 232, 94, 0x30, { scale: 2 });
  }
}

// ================================================================ SPYGRAM cards
function hashStr(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function likesFor(post: SpygramPost, t: number): number {
  const target = 300 + (hashStr(post.caption[0]) % 9000);
  const k = Math.min(1, t / 70);
  return Math.floor(target * (1 - Math.pow(1 - k, 3)));
}

/** The photo-app card: magenta header, the agent's photo, caption, a like counter that climbs quickly and one comment. */
export function drawSpygram(g: Gfx, post: SpygramPost, t: number, photo: 'roof' | 'wagon', f: number): void {
  const x = 28;
  const y = 22;
  const w = 200;
  g.rect(x - 2, y - 2, w + 4, 200, 0x0f);
  g.rect(x, y, w, 196, 0x30);
  // magenta header
  g.rect(x, y, w, 20, 0x24);
  g.rect(x, y + 18, w, 2, 0x14);
  g.rect(x + 6, y + 5, 10, 9, 0x30);
  g.rect(x + 8, y + 3, 4, 3, 0x30);
  g.disc(x + 11, y + 10, 3, 0x24);
  g.text('SPYGRAM', x + 24, y + 6, 0x30, { scale: 1, shadow: 0x14 });
  g.text('@AGENT_RED', x + w - 6, y + 7, 0x30, { align: 'right', font: 3 });
  // photo
  const py = y + 22;
  g.clip(x, py, w, 100);
  const bands = [0x0f, 0x01, 0x02, 0x03, 0x04, 0x05];
  bands.forEach((c, i) => g.rect(x, py + i * 14, w, 15, c));
  for (let i = 0; i < 30; i++) if ((i + (f >> 4)) % 4) g.px(x + ((i * 61 + 9) % w), py + ((i * 29) % 50), 0x30);
  if (photo === 'roof') {
    // skyscraper + roof
    g.rect(x + 4, py + 6, 26, 70, 0x0f);
    for (let wy = 10; wy < 70; wy += 8) for (let wx = 8; wx < 28; wx += 8) g.rect(x + wx, py + wy, 4, 4, (wx + wy) % 3 ? 0x28 : 0x01);
    g.rect(x, py + 74, w, 30, 0x10);
    g.rect(x, py + 74, w, 2, 0x30);
    g.sprite('agent.selfie', 0, x + 96, py + 38);
    g.rect(x + 104, py + 28, 6, 4, 0x30);
  } else {
    g.rect(x, py + 74, w, 30, 0x2d);
    g.sprite('wagon', 0, x + 70, py + 50);
    g.sprite('agent.stand', 0, x + 40, py + 50);
    g.text('^', x + 150, py + 20, 0x16);
  }
  g.unclip();
  // caption
  g.text(post.caption[0], x + 8, py + 108, 0x0f);
  g.text(post.caption[1], x + 8, py + 119, 0x0f);
  // likes
  const likes = likesFor(post, t);
  g.text('^', x + 8, py + 134, 0x16);
  g.text(`${likes.toLocaleString('en-US')} LIKES`, x + 20, py + 134, 0x0f);
  // one comment
  g.rect(x + 6, py + 146, w - 12, 1, 0x10);
  g.text(post.comment, x + 8, py + 154, 0x13);
  g.text('2M AGO', x + w - 8, py + 172, 0x10, { align: 'right', font: 3 });
}

// ================================================================ map overlay (MALL DIRECTORY)
const SHORT: Record<StoreId, string> = {
  forever12: 'F12',
  radioshock: 'RDS',
  crookstone: 'CRK',
  gamestonk: 'GMS',
  kgbtoys: 'KGB',
  blockblustar: 'BLK',
  spenders: 'SPN',
  sambaddy: 'SAM',
  sharper: 'SHP',
  hotspy: 'HOT',
  circuitpity: 'CIR',
  footlock: 'FTL',
  borderline: 'BRD',
};

export interface SchematicOpts {
  x0: number;
  y0: number;
  w: number;
  rowH: number;
  labels: boolean;
  highlight?: StoreId | null;
  blink: boolean;
  radar: boolean;
  /** inside a store: the store that blinks instead of the agent dot. */
  inStore?: StoreId | null;
}

export function drawSchematic(g: Gfx, mall: Mall, o: SchematicOpts): void {
  const sx = o.w / MALL_W;
  const rowY = (f: number) => o.y0 + f * o.rowH;
  // floors
  for (let f = 0; f < FLOOR_COUNT; f++) {
    g.rect(o.x0, rowY(f), o.w, o.rowH - 2, f === 0 ? 0x02 : 0x01);
    g.rect(o.x0, rowY(f) + o.rowH - 3, o.w, 1, 0x10);
    if (o.labels) g.text(FLOOR_NAMES[f], o.x0 - 4, rowY(f) + o.rowH / 2 - 4, 0x30, { align: 'right' });
  }
  // shafts
  for (let i = 0; i < SHAFTS.length; i++) {
    const s = SHAFTS[i];
    const x = Math.floor(o.x0 + s.cx * sx) - 2;
    const top = rowY(s.minFloor);
    const bot = rowY(s.maxFloor) + o.rowH - 2;
    g.rect(x, top, 5, bot - top, 0x00);
    const car = mall.cars[i];
    const cy = o.y0 + ((car.y - floorY(0)) / 48) * o.rowH + o.rowH - 2 - Math.max(3, Math.floor(o.rowH / 3));
    g.rect(x - 1, Math.floor(cy), 7, Math.max(3, Math.floor(o.rowH / 3)), 0x28);
    if (o.labels) g.text(s.id, x + 3, top - 8, 0x28, { align: 'center', font: 3 });
  }
  // escalators
  for (const e of ESCALATORS) {
    const xa = o.x0 + e.xLower * sx;
    const xb = o.x0 + e.xUpper * sx;
    const ya = rowY(e.lowerFloor) + o.rowH - 3;
    const yb = rowY(e.upperFloor) + o.rowH - 3;
    const n = Math.abs(ya - yb);
    for (let i = 0; i <= n; i++) g.px(Math.floor(xa + ((xb - xa) * i) / n), Math.floor(ya - i), 0x2a);
  }
  // stores
  for (const sf of STOREFRONTS) {
    const kind = storeColour(mall, sf.id);
    const x = Math.floor(o.x0 + sf.x * sx);
    const w = Math.max(6, Math.floor(STORE_W * sx));
    const y = rowY(sf.floor) + 3;
    const h = o.rowH - 8;
    const col = kind === 'package' ? 0x16 : kind === 'cleared' ? 0x10 : kind === 'powerup' ? 0x12 : 0x0f;
    const flash = o.highlight === sf.id || o.inStore === sf.id;
    const on = !flash || o.blink;
    g.rect(x, y, w, h, on ? col : 0x30);
    if (kind === 'closed') g.box(x, y, w, h, 0x2d);
    if (flash) g.box(x - 1, y - 1, w + 2, h + 2, o.blink ? 0x30 : 0x28);
    if (o.labels) g.text(SHORT[sf.id], x + w / 2, y + Math.floor(h / 2) - 2, kind === 'closed' ? 0x10 : 0x30, { align: 'center', font: 3 });
    if (o.radar && kind === 'package' && o.blink) g.text('!', x + w / 2, y - 7, 0x28, { align: 'center', shadow: 0x0f });
  }
  // getaway car
  const gx = Math.floor(o.x0 + GETAWAY.x * sx);
  const gy = rowY(FLOOR_P) + o.rowH - 8;
  g.rect(gx, gy, 14, 5, 0x17);
  g.rect(gx + 2, gy - 2, 9, 2, 0x17);
  g.px(gx + 2, gy + 5, 0x0f);
  g.px(gx + 10, gy + 5, 0x0f);
  if (o.labels) g.text('EXIT', gx + 7, gy - 9, 0x2a, { align: 'center', font: 3 });
  // agent
  const p = mall.p;
  if (!o.inStore && p.mode !== 'store' && o.blink) {
    const px = Math.floor(o.x0 + (p.x + 8) * sx);
    const py = Math.floor(o.y0 + ((p.y - floorY(0)) / 48) * o.rowH + o.rowH - 5);
    g.rect(px - 1, py - 1, 4, 4, 0x30);
    g.rect(px, py, 2, 2, 0x16);
  }
}

export function drawMap(g: Gfx, mall: Mall, f: number): void {
  g.clear(0x01);
  g.rect(0, 0, 256, 20, 0x02);
  g.rect(0, 20, 256, 1, 0x30);
  g.text(MISC.mallDirectory, 128, 6, 0x30, { align: 'center', scale: 1, shadow: 0x0f });
  g.text('YOU ARE HERE', 250, 25, 0x28, { align: 'right', font: 3 });
  const inStore = mall.p.mode === 'store' ? mall.run && lastStoreOf(mall) : null;
  drawSchematic(g, mall, { x0: 28, y0: 36, w: 216, rowH: 24, labels: true, blink: (f >> 4) % 2 === 0, radar: mall.run.powers.radar, inStore });
  // legend
  const ly = 186;
  const chip = (x: number, c: number, label: string, outline = false) => {
    g.rect(x, ly, 8, 6, c);
    if (outline) g.box(x, ly, 8, 6, 0x2d);
    g.text(label, x + 11, ly, 0x30, { font: 3 });
  };
  chip(10, 0x16, 'PACKAGE');
  chip(62, 0x10, 'CLEARED');
  chip(114, 0x12, 'POWER-UP');
  chip(172, 0x0f, 'CLOSED', true);
  g.rect(10, ly + 11, 6, 6, 0x28);
  g.text('CAR', 19, ly + 12, 0x30, { font: 3 });
  g.rect(48, ly + 11, 6, 6, 0x30);
  g.rect(50, ly + 13, 2, 2, 0x16);
  g.text('YOU', 57, ly + 12, 0x30, { font: 3 });
  if (mall.run.powers.radar) {
    g.text('!', 88, ly + 10, 0x28);
    g.text('RADAR', 96, ly + 12, 0x30, { font: 3 });
  }
  g.text(`PACKAGES ${mall.run.packages.length}/6`, 246, ly + 12, mall.run.packages.length >= 6 ? 0x2a : 0x26, { align: 'right', font: 3 });
  // inventory
  const inv = mall.run.inventory;
  g.rect(8, 214, 240, 1, 0x10);
  const text = inv.length ? 'ITEMS: ' + inv.join(', ') : 'ITEMS: NONE YET';
  const lines = wrapLines(text, 56);
  lines.slice(0, 2).forEach((l, i) => g.text(l, 10, 219 + i * 8, 0x38, { font: 3 }));
}

function lastStoreOf(mall: Mall): StoreId | null {
  return mall.lastStoreEntered;
}

// ================================================================ pause
export function drawPauseOverlay(g: Gfx, f: number): void {
  g.dim(0, 0, 256, 240, 0.6);
  if ((f >> 4) % 2 === 0) {
    g.rect(88, 106, 80, 24, 0x0f);
    g.box(88, 106, 80, 24, 0x30);
    g.text('PAUSE', 128, 112, 0x30, { align: 'center', scale: 2 });
  }
  g.text('PRESS START', 128, 134, 0x10, { align: 'center' });
}

// ================================================================ level clear
function garage(g: Gfx, f: number): void {
  g.rect(0, 0, 256, 240, 0x0f);
  g.rect(0, 0, 256, 60, 0x2d);
  g.rect(0, 58, 256, 4, 0x00);
  for (let x = -((f * 0.5) | 0) % 64; x < 256; x += 64) g.rect(x, 20, 40, 4, 0x10);
  for (let x = 20; x < 256; x += 90) {
    g.rect(x, 62, 16, 110, 0x10);
    g.rect(x, 62, 2, 110, 0x30);
    g.rect(x + 14, 62, 2, 110, 0x00);
    g.rect(x, 140, 16, 6, 0x28);
  }
  g.rect(0, 172, 256, 68, 0x00);
  g.rect(0, 172, 256, 2, 0x2d);
  for (let x = 6; x < 256; x += 48) g.rect(x, 205, 26, 3, 0x28);
  g.text('P', 12, 30, 0x28, { scale: 3 });
}

export function drawClear(g: Gfx, game: Game, f: number): void {
  const c = game.clear!;
  const run = game.run!;
  if (c.phase === 'drive') {
    garage(g, f);
    // the station wagon revs, pulls out and drives off while the spy runs after it waving a receipt
    const t = c.t;
    const go = Math.max(0, t - 50);
    const wx = 70 + Math.floor((go * go) / 38);
    g.sprite('wagon', (f >> 3) & 1, wx, 150);
    // exhaust puffs
    for (let i = 0; i < 3; i++) g.sprite('smoke', ((f >> 3) + i) % 3, wx - 12 - i * 9, 156 + i * 2, false);
    const sx = t < 50 ? 6 : 6 + Math.min(150, Math.floor((t - 50) * 1.1));
    g.sprite(`spy.walk${Math.floor(f / 5) % 4}`, 0, sx, 148);
    // receipt flapping in his hand
    const flap = (f >> 2) % 2;
    g.rect(sx + 14, 138 - flap, 8, 12, 0x30);
    for (let i = 0; i < 4; i++) g.hline(sx + 15, 140 + i * 2 - flap, 6, 0x10);
    if (t > 40 && t < 220) {
      const w = g.measure(MISC.levelClearReceipt) + 6;
      const bx = Math.max(4, Math.min(256 - w - 4, sx - 4));
      g.rect(bx, 112, w, 11, 0x30);
      g.text(MISC.levelClearReceipt, bx + 3, 114, 0x0f);
    }
    if (t > 60) g.text('MISSION COMPLETE!', 128, 80, (f >> 3) % 2 ? 0x28 : 0x30, { align: 'center', scale: 2, shadow: 0x0f });
    return;
  }
  if (c.phase === 'tally') {
    g.clear(0x0f);
    skyBands(g, 240);
    g.dim(0, 0, 256, 240, 0.5);
    g.rect(24, 30, 208, 176, 0x0f);
    g.box(24, 30, 208, 176, 0x30);
    g.box(26, 32, 204, 172, 0x2d);
    g.text('LEVEL CLEAR!', 128, 42, 0x28, { align: 'center', scale: 2, shadow: 0x16 });
    const rows: [string, string, number][] = [
      ['PACKAGES', `${c.packages}/6`, 0x30],
      ['TIME', `${Math.floor(c.timeFrames / 3600)}:${String(Math.floor(c.timeFrames / 60) % 60).padStart(2, '0')}`, 0x30],
      ['TIME BONUS', `+${c.timeBonus}`, 0x2a],
      ['CLEAR BONUS', `+${c.clearBonus}`, 0x2a],
    ];
    rows.forEach(([l, v, col], i) => {
      if (c.t < 30 + i * 36) return;
      g.text(l, 40, 78 + i * 18, 0x10);
      g.text(v, 216, 78 + i * 18, col, { align: 'right' });
    });
    if (c.t > 190) g.text(`SCORE ${fmtScore(run.score.score)}`, 128, 160, 0x30, { align: 'center' });
    if (c.t > 150) g.text(`LOOP ${c.loop}`, 128, 180, (f >> 3) % 2 ? 0x26 : 0x28, { align: 'center', scale: 1 });
    if (c.t > 150) g.text(`NEXT: LOOP ${c.loop + 1} - HARDER`, 128, 192, 0x10, { align: 'center', font: 3 });
    return;
  }
  if (c.phase === 'news') {
    drawNewspaper(g, c.headline, c.t, f);
    return;
  }
  g.clear(0x03);
  stars(g, f, 240, 3);
  drawSpygram(g, c.post, c.t, 'wagon', f);
  g.text('PRESS START', 128, 226, (f >> 4) % 2 ? 0x30 : 0x10, { align: 'center', font: 3 });
}

export function drawNewspaper(g: Gfx, headline: string, t: number, f: number): void {
  g.clear(0x2d);
  // the page spins in
  const k = Math.min(1, t / 22);
  const w = Math.floor(224 * k);
  const x = 128 - Math.floor(w / 2);
  if (w < 10) return;
  g.rect(x, 12, w, 216, 0x38);
  g.box(x, 12, w, 216, 0x0f);
  if (k < 1) return;
  g.hline(x + 6, 40, w - 12, 0x0f);
  g.text(MISC.dailyMall, 128, 18, 0x0f, { align: 'center', scale: 2 });
  g.hline(x + 6, 36, w - 12, 0x0f);
  g.hline(x + 6, 40, w - 12, 0x0f);
  g.text('LATE EDITION  *  25 CENTS', 128, 44, 0x0f, { align: 'center', font: 3 });
  g.hline(x + 6, 52, w - 12, 0x0f);
  const lines = wrapLines(headline, LIMITS.headline);
  lines.forEach((l, i) => {
    g.text(l, 129, 60 + i * 12, 0x0f, { align: 'center' });
    g.text(l, 128, 60 + i * 12, 0x0f, { align: 'center' });
  });
  const by = 60 + lines.length * 12 + 6;
  // photo
  g.rect(x + 10, by, 96, 64, 0x10);
  g.box(x + 10, by, 96, 64, 0x0f);
  g.rect(x + 11, by + 1, 94, 40, 0x03);
  g.rect(x + 11, by + 41, 94, 22, 0x2d);
  g.sprite('wagon', 0, x + 36, by + 28);
  g.sprite('agent.stand', 0, x + 20, by + 28 + 0);
  g.text('FILE PHOTO', x + 12, by + 52, 0x30, { font: 3 });
  // filler columns
  for (let i = 0; i < 9; i++) g.hline(x + 112, by + 4 + i * 7, w - 124, 0x10);
  for (let i = 0; i < 7; i++) g.hline(x + 10, by + 74 + i * 7, w - 20, 0x10);
  g.text('MALL WALKERS CLUB MEETS', x + 10, 218 - 18 + 0, 0x10, { font: 3 });
  void f;
}

// ================================================================ continue / game over
export function drawContinue(g: Gfx, game: Game, f: number): void {
  const run = game.run!;
  g.clear(0x0f);
  const sec = game.continueSeconds();
  const red = sec <= 3;
  g.text(MISC.continueQ, 128, 40, 0x30, { align: 'center', scale: 3, shadow: 0x03 });
  const col = red ? ((f >> 3) % 2 ? 0x16 : 0x26) : 0x30;
  const digit = String(Math.min(9, sec));
  g.text(digit, 131, 85, 0x03, { align: 'center', scale: 10 });
  g.text(digit, 128, 82, col, { align: 'center', scale: 10 });
  g.text(`CONTINUES LEFT: ${run.continuesLeft}`, 128, 164, 0x28, { align: 'center' });
  if ((f >> 4) % 2 === 0) g.text(MISC.pressStart, 128, 186, 0x30, { align: 'center' });
  g.text(`SCORE ${fmtScore(run.score.score)}`, 128, 208, 0x10, { align: 'center', font: 3 });
}

export function drawGameOverFinal(g: Gfx, game: Game, f: number): void {
  const run = game.run!;
  g.clear(0x0f);
  stars(g, f, 240, 5);
  g.text(MISC.gameOver, 128, 70, 0x16, { align: 'center', scale: 4, shadow: 0x06 });
  g.text(`SCORE     ${fmtScore(run.score.score)}`, 128, 128, 0x30, { align: 'center' });
  g.text(`HI-SCORE  ${fmtScore(game.hiScore)}`, 128, 144, 0x28, { align: 'center' });
  g.text(`LOOP ${run.loop}   PACKAGES ${run.packages.length}/6`, 128, 166, 0x10, { align: 'center', font: 3 });
  g.text('THANKS FOR SHOPPING', 128, 200, 0x10, { align: 'center', font: 3 });
}

export function drawClosingMessage(g: Gfx, game: Game): void {
  const o = game.over!;
  if (o.t < 90) return;
  const chars = Math.floor((o.t - 90) / 3);
  const [a, b] = game.closingLines();
  g.rect(16, 96, 224, 48, 0x0f);
  g.box(16, 96, 224, 48, 0x30);
  g.box(18, 98, 220, 44, 0x02);
  g.text(a.slice(0, chars), 128, 107, 0x28, { align: 'center' });
  g.text(b.slice(0, Math.max(0, chars - a.length)), 128, 123, 0x30, { align: 'center' });
}

export { SPY_DEATH_FRAMES, remainingPackageStores, floorAt, storeInfo, JOKE_ITEMS, C };
