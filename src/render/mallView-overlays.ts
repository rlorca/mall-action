// Mall renderer overlays: lamp darkness, kiosk map panel, photo strip popup and the arrival selfie (flash + SPYGRAM card).
import { C } from '../core/palette';
import type { Surface } from '../art/surface';
import { SPYGRAM_ARRIVAL } from '../data/copy';
import { STORE_BY_ID, type Floor } from '../data/stores';
import type { MallWorld } from '../game/mall';
import { SHAFTS, ESCALATORS, STORE_LAYOUTS } from '../game/mall/layout';
import { SPYGRAM_CARD_H, SPYGRAM_CARD_W, drawSpygramCard } from '../screens/spygram';
import { FOOT_DROP, VIEW_H, VIEW_TOP, VIEW_W, sx, sy } from './mallView-common';

/* ---------------------------------------------------------------- darkness from shattered lamps */

export function drawDarkness(s: Surface, w: MallWorld): void {
  for (const r of w.s.darkened) {
    const x0 = Math.max(0, sx(r.x0));
    const x1 = Math.min(VIEW_W, sx(r.x1));
    const y0 = Math.max(VIEW_TOP, sy(r.y0));
    const y1 = Math.min(VIEW_TOP + VIEW_H, sy(r.y1) + 6);
    if (x1 <= x0 || y1 <= y0) continue;
    // quick fade in, long fade out (120 frames total)
    const a = Math.min(0.72, (r.frames / 120) * 1.1, (120 - r.frames) / 6 + 0.1);
    s.setAlpha(Math.max(0, a));
    s.rect(x0, y0, x1 - x0, y1 - y0, C.BLACK);
    s.setAlpha(1);
  }
}

/* ---------------------------------------------------------------- kiosk directory panel */

const PANEL_W = 96;
const PANEL_H = 52;

export function drawKioskPanel(s: Surface, w: MallWorld, tick: number): void {
  const kp = w.s.kioskPanel;
  if (!kp) return;
  const x = ((VIEW_W - PANEL_W) >> 1) | 0;
  // slides in over 8 frames, out over the last 8
  const slide = Math.min(8, 300 - kp.frames, kp.frames);
  const y = VIEW_TOP + 4 - Math.max(0, 8 - slide) * 2;
  s.rect(x, y, PANEL_W, PANEL_H, C.BLACK);
  s.frame(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2, C.CYAN);
  s.rect(x + 2, y + 2, PANEL_W - 4, PANEL_H - 4, C.BLUE_D);
  s.text('DIRECTORY', x + PANEL_W / 2, y + 4, C.CYAN_L, { small: true, align: 'center' });
  const rows: Floor[] = ['4F', '3F', '2F', '1F'];
  const mapX = x + 14;
  const mapW = PANEL_W - 18;
  const k = mapW / 768;
  const target = kp.storeId;
  rows.forEach((f, i) => {
    const ry = y + 11 + i * 7;
    const here = f === kp.kioskFloor;
    s.text(f, x + 4, ry + 1, here ? C.YELLOW_L : C.GRAY_L, { small: true });
    s.rect(mapX, ry, mapW, 6, C.BLACK);
    s.hline(mapX, ry + 5, mapW, here ? C.YELLOW : C.GRAY_D);
    for (const sh of SHAFTS) if (sh.floors.includes(f)) s.rect(mapX + Math.round(sh.x * k), ry + 1, Math.max(2, Math.round(sh.w * k)), 4, C.GRAY_D);
    for (const e of ESCALATORS) if (e.lower === f || e.upper === f) s.rect(mapX + Math.round(e.x0 * k), ry + 4, Math.round((e.x1 - e.x0) * k), 1, C.ORANGE);
    for (const l of STORE_LAYOUTS) {
      if (l.floor !== f) continue;
      const def = STORE_BY_ID[l.id];
      let col: number;
      if (l.id === target) col = (tick >> 3) & 1 ? C.YELLOW_L : C.RED_L;
      else if (def.role === 'closed') col = C.GRAY_DD;
      else if (def.role === 'powerup') col = C.BLUE;
      else col = w.progress.packages.includes(l.id) ? C.GRAY_M : C.RED;
      s.rect(mapX + Math.round(l.x * k), ry + 1, Math.max(3, Math.round(l.w * k) - 1), 4, col);
    }
    if (here && (tick >> 4) % 2 === 0) s.rect(mapX - 6, ry + 2, 3, 3, C.WHITE); // "you are here"
  });
  const label = target ? STORE_BY_ID[target].name : 'ALL CLEAR: GO TO P';
  s.text(label, x + PANEL_W / 2, y + PANEL_H - 9, target ? C.YELLOW_L : C.LIME, { small: true, align: 'center' });
}

/* ---------------------------------------------------------------- photo strip popup */

const STRIP_TOTAL = 180;

export function drawPhotoStrip(s: Surface, w: MallWorld, tick: number): void {
  const ps = w.s.photoStrip;
  if (!ps) return;
  const el = STRIP_TOTAL - ps.frames;
  const slide = Math.min(1, el / 14);
  const bw = 26;
  const bh = 4 * 18 + 6;
  const x = VIEW_W - bw - 6;
  const y = Math.round(VIEW_TOP - bh + (bh + 8) * slide);
  const out = Math.min(1, ps.frames / 14); // slide away at the end
  const yy = out < 1 ? Math.round(y - (bh + 8) * (1 - out)) : y;
  s.rect(x + 1, yy + 1, bw, bh, C.BLACK); // drop shadow
  s.rect(x, yy, bw, bh, C.WHITE);
  s.frame(x, yy, bw, bh, C.GRAY_L);
  const poses: { name: string; frame: number; flip: boolean }[] = [
    { name: 'agent_stand', frame: 0, flip: false },
    { name: 'agent_selfie', frame: 0, flip: false },
    { name: 'agent_selfie', frame: 1, flip: true },
    { name: 'agent_kick', frame: 0, flip: false },
  ];
  for (let i = 0; i < 4; i++) {
    const fx = x + 3;
    const fy = yy + 3 + i * 18;
    const shown = el >= 16 + i * 10;
    s.rect(fx, fy, 20, 16, shown ? [C.SKY, C.PINK, C.TAN, C.LIME][i] : C.GRAY_D);
    if (!shown) continue;
    s.clip(fx, fy, 20, 16);
    s.sprite(poses[i].name, fx + 2, fy + 1, { frame: poses[i].frame, flipX: poses[i].flip });
    s.unclip();
    // camera flash flicker on the newest frame
    if (el >= 16 + i * 10 && el < 20 + i * 10) {
      s.setAlpha(0.8);
      s.rect(fx, fy, 20, 16, C.WHITE);
      s.setAlpha(1);
    }
  }
  void tick;
}

/* ---------------------------------------------------------------- arrival selfie */

/** Timeline (phaseFrames of phase 'selfie', 150 frames): pose + phone flash, then the SPYGRAM card. */
const FLASH_LEN = 16;
const CARD_AT = 34;

export function drawSelfie(s: Surface, w: MallWorld, tick: number): void {
  const st = w.s;
  if (st.phase !== 'selfie') return;
  const t = st.phaseFrames;
  const p = st.player;
  // the agent striking the pose; frame 1 = arm out during the flash
  const pose = t < 6 || t > FLASH_LEN + 6 ? 0 : 1;
  s.sprite('agent_selfie', sx(p.x - 8), sy(p.y - 24) + FOOT_DROP, { frame: pose, flipX: p.facing < 0 });
  // phone flash sparkle next to the phone
  if (t < FLASH_LEN) s.sprite('star_pop', sx(p.x + 6), sy(p.y - 30) + FOOT_DROP, { frame: t < 4 ? 1 : t < 10 ? 0 : 2 });
  // full-view white flash, fading out
  if (t < FLASH_LEN) {
    s.setAlpha(1 - t / FLASH_LEN);
    s.rect(0, VIEW_TOP, VIEW_W, VIEW_H, C.WHITE);
    s.setAlpha(1);
  }
  if (t >= CARD_AT) {
    const a = Math.min(0.55, (t - CARD_AT) / 10);
    s.setAlpha(a);
    s.rect(0, VIEW_TOP, VIEW_W, VIEW_H, C.BLACK);
    s.setAlpha(1);
    const x = (VIEW_W - SPYGRAM_CARD_W) >> 1;
    // pop in from slightly low, then settle
    const rise = Math.max(0, 8 - (t - CARD_AT)) * 2;
    const y = VIEW_TOP + ((VIEW_H - SPYGRAM_CARD_H) >> 1) + rise;
    drawSpygramCard(s, SPYGRAM_ARRIVAL[st.spygramIndex % SPYGRAM_ARRIVAL.length], { x, y, frames: t - CARD_AT });
  }
  void tick;
}
