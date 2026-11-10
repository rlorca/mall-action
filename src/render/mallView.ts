/** Draws the side-scrolling mall from the game state. Reads state only. */
import { Fb } from '../gfx/fb';
import { DARK } from '../gfx/palette';
import { S } from '../gfx/sprites';
import { Pr } from '../gfx/props';
import type { Game, Level } from '../game/types';
import {
  BENCHES, BOOTH, CABLE, CAR_H, ESCALATORS, FLOOR_H, FLOOR_Y, FOUNTAINS, F_2, F_P, F_R, HUD_H, KIOSKS, PILLARS, PLANTS, POST_X, SHAFTS, SHAFT_W,
  SLAB, STORES, STORE_W, VIEW_H, WAGON_X, WET_W, WORLD_W, shaftServes,
} from '../game/level';
import { drawStorefront, SF_H } from './storefront';
import { drawBubble, drawBanner } from './ui';
import { SPY_TELEGRAPH } from '../game/mall';

const WALL_COL = [0, 0x31, 0x3b, 0x34, 0x38, 0x10];
const TRIM_COL = [0, 0x21, 0x2b, 0x24, 0x28, 0x00];
const CAR_COL = [0x16, 0x12, 0x1a];

function drawSky(fb: Fb, cx: number, oy: number, frame: number): void {
  const bands: [number, number][] = [[-40, 0x02], [18, 0x03], [34, 0x04], [48, 0x15], [58, 0x26]];
  for (let i = 0; i < bands.length; i++) {
    const y0 = bands[i][0], y1 = i + 1 < bands.length ? bands[i + 1][0] : FLOOR_Y[F_R];
    fb.rect(0, y0 + oy, 256, y1 - y0, bands[i][1]);
    // dithered band edge
    if (i > 0) for (let x = (y0 & 1); x < 256; x += 2) fb.pset(x, y0 + oy - 1, bands[i][1]);
  }
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97 + 31) % WORLD_W, sy = (i * 53) % 30;
    if ((i + Math.floor(frame / 30)) % 7 !== 0) fb.pset(sx - cx, sy + oy, 0x30);
  }
  // distant skyline
  for (let i = 0; i < 26; i++) {
    const bx = i * 31 + 60, bh = 8 + ((i * 37) % 18), bw = 18 + ((i * 13) % 10);
    fb.rect(bx - cx, FLOOR_Y[F_R] - bh + oy, bw, bh, 0x05);
    if (i % 2) fb.pset(bx - cx + 4, FLOOR_Y[F_R] - bh + 4 + oy, 0x28);
    if (i % 3 === 0) fb.pset(bx - cx + 10, FLOOR_Y[F_R] - bh + 8 + oy, 0x28);
  }
  // the dark skyscraper the agent zips down from
  fb.rect(0 - cx, -40 + oy, 44, FLOOR_Y[F_R] + 40, 0x0f);
  fb.rect(42 - cx, -40 + oy, 2, FLOOR_Y[F_R] + 40, 0x00);
  for (let wy = -4; wy < 58; wy += 8) for (let wx = 4; wx < 38; wx += 9) if ((wx * 3 + wy * 7 + 400) % 5 < 2) fb.rect(wx - cx, wy + oy, 5, 4, 0x28);
  // cable and anchor post
  fb.line(CABLE.x0 - cx, CABLE.y0 + oy, CABLE.x1 - cx, CABLE.y1 + oy, 0x10);
  fb.rect(POST_X - 1 - cx, CABLE.y1 - 2 + oy, 3, FLOOR_Y[F_R] - CABLE.y1 + 2, 0x00);
  fb.rect(POST_X - 3 - cx, CABLE.y1 - 3 + oy, 7, 2, 0x10);
  // roof furniture
  for (const ax of [232, 300, 470, 520]) fb.spr(Pr('ac_unit'), ax - cx, FLOOR_Y[F_R] - 12 + oy);
  // neon MALL sign
  const sx = 610 - cx, sy = FLOOR_Y[F_R] - 44 + oy;
  fb.rect(sx + 8, sy + 34, 3, 10, 0x00); fb.rect(sx + 110, sy + 34, 3, 10, 0x00);
  fb.rect(sx, sy, 122, 36, 0x0f);
  fb.frame(sx, sy, 122, 36, Math.floor(frame / 20) % 2 ? 0x25 : 0x15);
  fb.bigText('MALL', sx + 14, sy + 5, 3, Math.floor(frame / 20) % 2 ? 0x2c : 0x21);
}

function drawFloors(fb: Fb, g: Game, L: Level, cx: number, oy: number): void {
  for (let f = 1; f < FLOOR_Y.length; f++) {
    const top = FLOOR_Y[f] - FLOOR_H + SLAB + oy;
    if (top > 240 || top + FLOOR_H < HUD_H) continue;
    fb.rect(0, top, 256, FLOOR_H - SLAB, WALL_COL[f]);
    fb.rect(0, top, 256, 3, TRIM_COL[f]);
    if (f === F_P) {
      // parking: concrete, pillars, bay lines
      for (let x = 24; x < WORLD_W; x += 48) fb.rect(x - cx, FLOOR_Y[f] - 2 + oy, 20, 2, 0x28);
      for (const px of PILLARS) { fb.rect(px - 6 - cx, top, 12, FLOOR_H - SLAB, 0x00); fb.rect(px - 6 - cx, top + 14, 12, 6, 0x28); fb.rect(px - 4 - cx, top, 2, FLOOR_H - SLAB, 0x10); }
      fb.text('P', 20 - cx, top + 12, 0x30);
      fb.text('EXIT {', 330 - cx, top + 8, 0x2a);
    } else {
      fb.rect(0, FLOOR_Y[f] - 4 + oy, 256, 4, TRIM_COL[f]);
      if (f === F_2) for (let x = 12; x < WORLD_W; x += 16) fb.pset(x - cx, top + 6 + ((x >> 4) % 3) * 9, 0x30);
    }
  }
  // slabs
  for (let f = 0; f < FLOOR_Y.length; f++) {
    const y = FLOOR_Y[f] + oy;
    fb.rect(0, y, 256, SLAB, 0x00);
    fb.rect(0, y, 256, 1, 0x10);
  }
  fb.rect(0, FLOOR_Y[F_P] + SLAB + oy, 256, 40, 0x0f);
  // outer walls
  fb.rect(0 - cx, FLOOR_Y[F_R] + SLAB + oy, 8, 400, 0x0f);
  fb.rect(WORLD_W - 8 - cx, FLOOR_Y[F_R] + SLAB + oy, 8, 400, 0x0f);
  fb.rect(0 - cx, FLOOR_Y[F_R] - 6 + oy, 6, 6, 0x00);
  fb.rect(WORLD_W - 6 - cx, FLOOR_Y[F_R] - 6 + oy, 6, 6, 0x00);
}

function drawEscalators(fb: Fb, cx: number, oy: number, frame: number): void {
  for (const e of ESCALATORS) {
    const y0 = FLOOR_Y[e.lower] + oy;
    for (let i = -6; i <= FLOOR_H + 6; i++) {
      const x = e.xLow + i - cx;
      const k = Math.max(0, Math.min(FLOOR_H, i));
      const sy = y0 - (k & ~3); // steps
      fb.rect(x, sy, 1, 4, 0x00);
      fb.pset(x, sy, ((i + Math.floor(frame / 6)) & 7) < 4 ? 0x10 : 0x2d);
      fb.pset(x, y0 - k - 12, 0x0f); // handrail
      if (i % 8 === 0) fb.rect(x, y0 - k - 11, 1, 11 - 3, 0x2d);
      if (i > 0 && i < FLOOR_H) fb.rect(x, sy + 4, 1, Math.min(6, y0 - sy - 4), 0x2d);
    }
    // landing plates
    fb.rect(e.xLow - 8 - cx, y0, 12, 1, 0x28);
    fb.rect(e.xHigh - 4 - cx, FLOOR_Y[e.upper] + oy, 12, 1, 0x28);
  }
}

function drawShafts(fb: Fb, L: Level, cx: number, oy: number, behind: boolean, frame: number): void {
  for (let i = 0; i < SHAFTS.length; i++) {
    const s = SHAFTS[i];
    const car = L.cars[i];
    const x = s.x - cx;
    if (x > 256 || x + SHAFT_W < 0) continue;
    const top = FLOOR_Y[s.top] - FLOOR_H + SLAB + oy;
    const bot = FLOOR_Y[s.bottom] + SLAB + oy;
    const cy = car.y + oy;
    if (behind) {
      if (s.top === F_R) {
        // rooftop housing
        fb.rect(x - 3, top - 2, SHAFT_W + 6, FLOOR_H - SLAB + 2, 0x00);
        fb.rect(x - 3, top - 2, SHAFT_W + 6, 2, 0x10);
      }
      fb.rect(x, top, SHAFT_W, bot - top, 0x0f);
      fb.rect(x + 7, top, 1, bot - top, 0x2d);
      fb.rect(x + 16, top, 1, bot - top, 0x2d);
      fb.rect(x - 1, top, 1, bot - top, 0x10);
      fb.rect(x + SHAFT_W, top, 1, bot - top, 0x10);
      // grates where the car is above
      for (let f = s.top; f <= s.bottom; f++) {
        if (car.y < FLOOR_Y[f]) {
          const gy = FLOOR_Y[f] + oy;
          fb.rect(x, gy, SHAFT_W, SLAB, 0x00);
          for (let k = 1; k < SHAFT_W; k += 3) fb.rect(x + k, gy, 1, SLAB, 0x10);
          fb.rect(x, gy, SHAFT_W, 1, 0x10);
        }
      }
      // car body and interior
      const col = CAR_COL[i];
      fb.rect(x, cy - CAR_H, SHAFT_W, CAR_H + SLAB, col);
      fb.rect(x + 2, cy - CAR_H + 5, SHAFT_W - 4, CAR_H - 5, 0x37);
      fb.rect(x + 2, cy - CAR_H + 5, SHAFT_W - 4, 2, 0x27);
      fb.rect(x, cy - CAR_H, SHAFT_W, 1, 0x30);
      fb.rect(x, cy, SHAFT_W, SLAB, 0x00);
      fb.text(s.id, x + 8, cy - CAR_H - 9 < top ? -100 : cy - CAR_H - 9, 0x00);
      fb.pset(x + 12, cy - CAR_H + 2, car.dir !== 0 ? (frame & 8 ? 0x28 : 0x16) : 0x2a);
    } else {
      // sliding cage doors, drawn over riders: closed while moving, open while stopped
      const open = car.door; // 0..8
      const half = Math.round(((SHAFT_W - 4) / 2) * (1 - open / 8));
      for (let k = 0; k < half; k += 3) {
        fb.rect(x + 2 + k, cy - CAR_H + 7, 1, CAR_H - 7, 0x00);
        fb.rect(x + SHAFT_W - 3 - k, cy - CAR_H + 7, 1, CAR_H - 7, 0x00);
      }
      fb.rect(x, cy - CAR_H, 2, CAR_H, CAR_COL[i]);
      fb.rect(x + SHAFT_W - 2, cy - CAR_H, 2, CAR_H, CAR_COL[i]);
    }
  }
}

function agentSprite(L: Level, frame: number): string {
  const P = L.player;
  if (L.mode === 'arrive' && !P.onGround && L.arriveT <= 110) return 'ag_hang';
  if (L.mode === 'selfie') return 'ag_selfie';
  if (P.landT > 0) return 'ag_duck';
  if (P.dying > 0) return P.dying < 40 ? 'ag_dead' : frame & 4 ? 'ag_jump' : 'ag_duck';
  const shooting = P.shootAnim > 0;
  if (!P.onGround) return P.kicking ? 'ag_kick' : shooting ? 'ag_jumpshoot' : 'ag_jump';
  if (P.sliding) return P.kicking ? 'ag_kick' : 'ag_walk1';
  if (P.ducking) return shooting ? 'ag_duckshoot' : 'ag_duck';
  if (P.walkT > 0) {
    const k = Math.floor(P.walkT / 6) % 4;
    if (shooting) return k % 2 ? 'ag_shoot' : 'ag_shootwalk';
    return k === 0 ? 'ag_walk1' : k === 2 ? 'ag_walk1' : k === 1 ? 'ag_walk2' : 'ag_stand';
  }
  return shooting ? 'ag_shoot' : 'ag_stand';
}

export function drawMall(fb: Fb, g: Game): void {
  const L = g.level!;
  const P = L.player;
  const frame = g.frame;
  let cx = L.camX;
  let oy = HUD_H - L.camY;
  if (L.shake > 0) { cx += (L.shake & 2) - 1; oy += ((L.shake >> 1) & 2) - 1; }
  fb.clip(0, HUD_H, 256, VIEW_H);
  drawSky(fb, cx, oy, frame);
  drawFloors(fb, g, L, cx, oy);
  drawEscalators(fb, cx, oy, frame);
  // storefronts
  for (const st of L.stores) {
    const x = st.def.x - cx;
    if (x > 256 || x + STORE_W < 0) continue;
    drawStorefront(fb, st.def, x, FLOOR_Y[st.def.floor] - SF_H + oy, frame, st.def.role === 'target' && st.cleared, g.blackFriday);
  }
  // props
  for (let k = 0; k < KIOSKS.length; k++) fb.spr(Pr('kiosk'), KIOSKS[k].x - 8 - cx, FLOOR_Y[KIOSKS[k].floor] - 24 + oy, false, L.kioskCd[k] > 0 ? DARK[1] : null);
  fb.spr(Pr('booth'), BOOTH.x - 12 - cx, FLOOR_Y[BOOTH.floor] - 36 + oy);
  fb.tiny('PHOTO', BOOTH.x - 9 - cx, FLOOR_Y[BOOTH.floor] - 34 + oy + 1, 0x15);
  if (P.hidden > 0 && frame & 8) fb.rect(BOOTH.x - 8 - cx, FLOOR_Y[BOOTH.floor] - 26 + oy, 10, 3, 0x30);
  for (let k = 0; k < FOUNTAINS.length; k++) fb.spr(Pr(L.fountainCd[k] > 0 || frame & 8 ? 'fountain1' : 'fountain2'), FOUNTAINS[k].x - 16 - cx, FLOOR_Y[FOUNTAINS[k].floor] - 22 + oy);
  for (const b of BENCHES) fb.spr(Pr('bench'), b.x - 12 - cx, FLOOR_Y[b.floor] - 10 + oy);
  for (const pl of PLANTS) fb.spr(Pr('plant'), pl.x - 6 - cx, FLOOR_Y[pl.floor] - 16 + oy);
  // getaway station wagon
  fb.spr(Pr('wagon'), WAGON_X - 32 - cx, FLOOR_Y[F_P] - 24 + oy);
  if (g.pkgs >= 6 && frame & 16) fb.text('~', WAGON_X - 4 - cx, FLOOR_Y[F_P] - 36 + oy, 0x2a);
  drawShafts(fb, L, cx, oy, true, frame);
  // wet floor
  for (const w of L.wets) {
    const wy = FLOOR_Y[4] + oy;
    for (let x = 0; x < WET_W; x += 2) fb.pset(w.x0 + x - cx, wy - 1 - ((x >> 1) & 1), 0x30);
    fb.rect(w.x0 - cx, wy, WET_W, 1, 0x21);
    fb.spr(S('wet_sign'), w.x0 + WET_W / 2 - 5 - cx, wy - 11);
  }
  // lamps
  for (const lamp of L.lamps) {
    if (lamp.state === 'gone') continue;
    const lx = lamp.x - cx, fy = FLOOR_Y[lamp.floor];
    if (lamp.state === 'hang') fb.rect(lx, fy - FLOOR_H + SLAB + oy, 1, FLOOR_H - SLAB - 14 - 10, 0x0f);
    if (lamp.disco) fb.spr(S(Math.floor((frame + lamp.x) / 8) % 2 ? 'disco1' : 'disco2'), lx - 6, lamp.y - 12 + oy + (lamp.state === 'hang' ? 0 : 0));
    else fb.spr(S('lamp'), lx - 6, lamp.y - 10 + oy);
  }
  for (const p of L.pickups) if (p.t > 120 || frame & 4) fb.spr(S('pu_' + p.kind), p.x - 6 - cx, p.y - 13 + oy);
  for (const c of L.coins) if (c.t < 330 || frame & 4) fb.spr(S(c.gold ? 'coin_gold' : 'coin'), c.x - 3 - cx, c.y - 6 + oy);
  // people
  L.walkers.forEach((w, i) => {
    const name = (i ? 'wk2_walk' : 'wk_walk') + (1 + (Math.floor(frame / 8) % 2));
    fb.spr(S(name), w.x - 8 - cx, FLOOR_Y[F_2] - 24 + oy, w.dir < 0);
  });
  const j = L.janitor;
  fb.spr(S(j.mopT > 0 ? 'jn_walk1' : 'jn_walk' + (1 + (Math.floor(frame / 12) % 2))), j.x - 8 - cx, FLOOR_Y[4] - 24 + oy, j.dir < 0);
  fb.spr(S('mop'), j.x + (j.dir < 0 ? -12 : 6) + (j.mopT > 0 ? ((frame >> 3) & 1) * 2 * j.dir : 0) - cx, FLOOR_Y[4] - 12 + oy, j.dir < 0);
  const cop = L.cop;
  fb.spr(S(frame & 8 ? 'cop1' : 'cop2'), cop.x - 8 - cx, FLOOR_Y[cop.floor] - 24 + oy, cop.dir < 0);
  if (cop.chase > 0 && frame & 4) fb.rect(cop.x - 2 - cx, FLOOR_Y[cop.floor] - 27 + oy, 4, 2, frame & 8 ? 0x16 : 0x21);
  for (const s of L.spies) {
    let name = 'sp_stand';
    if (s.state === 'emerge') { if (s.t < 10) continue; name = 'sp_stand'; }
    else if (s.state === 'dead') name = s.t < 10 ? 'sp_dead1' : 'sp_dead2';
    else if (s.state === 'aim') name = s.aimLow ? 'sp_aimlow' : 'sp_aim';
    else if (s.state === 'duck') name = 'sp_duck';
    else if (s.pause === 0 || s.slide) name = Math.floor((frame + s.id * 5) / 8) % 2 ? 'sp_walk1' : 'sp_walk2';
    fb.spr(S(name), s.x - 8 - cx, s.y - 24 + oy, s.face < 0);
    // telegraph flash on the muzzle while aiming
    if (s.state === 'aim' && s.t > SPY_TELEGRAPH - 12 && frame & 2) fb.rect(s.x + s.face * 9 - 1 - cx, s.y - (s.aimLow ? 7 : 18) + oy, 2, 2, 0x30);
  }
  // the agent
  if (P.hidden === 0 && !(P.invuln > 0 && frame & 2 && P.dying === 0)) {
    const name = agentSprite(L, frame);
    const cinna = L.powers.cinna > 0 && frame & 2;
    fb.spr(S(name), P.x - 8 - cx, P.y - 24 + oy, P.face < 0, null, cinna ? 0x30 : undefined);
    if (P.frozen > 0) fb.frame(Math.round(P.x) - 10 - cx, P.y - 26 + oy, 20, 27, frame & 4 ? 0x21 : 0x30);
    if (L.mode === 'selfie' && L.selfie && L.selfie.t < 8) fb.rect(0, HUD_H, 256, VIEW_H, 0x30);
  }
  drawShafts(fb, L, cx, oy, false, frame);
  for (const b of L.bullets) fb.spr(S(b.owner === 'p' ? 'bullet_p' : 'bullet_e'), b.x - 2 - cx, b.y - 1 + oy);
  for (const f of L.fx) {
    if (f.kind === 'glass') { for (let k = 0; k < 6; k++) fb.rect(f.x + (k - 3) * (26 - f.t) * 0.4 - cx, f.y - 2 - ((k * 5 + f.t) % 7) + oy, 2, 1, k % 2 ? 0x30 : 0x28); }
    else fb.spr(S(f.t > 8 ? 'puff1' : 'puff2'), f.x - 8 - cx, f.y - 12 + oy);
  }
  // darkness after a lamp shatters
  for (const dk of L.dark) fb.shade(dk.x0 - cx, FLOOR_Y[dk.floor] - FLOOR_H + SLAB + oy, dk.x1 - dk.x0, FLOOR_H - SLAB, dk.t > 20 ? 2 : 1);
  for (const p of L.popups) fb.text(p.text, Math.round(p.x - p.text.length * 4) - cx, Math.round(p.y) + oy, p.text[0] === '-' ? 0x16 : 0x30);
  for (const b of L.bubbles) drawBubble(fb, b.text, b.x - cx, b.y + oy);
  // kiosk map panel
  if (L.kioskPanel) drawKioskPanel(fb, L, frame);
  if (L.photoStripT > 0) {
    const k = Math.min(1, (180 - L.photoStripT) / 20);
    fb.spr(Pr('photo_strip'), 222, Math.round(240 - 60 * k));
  }
  fb.noClip();
  if (L.banner) drawBanner(fb, L.banner.lines, 22);
}

/** Small "you are here" panel: highlights the nearest store that still holds a package. */
function drawKioskPanel(fb: Fb, L: Level, frame: number): void {
  const x0 = 64, y0 = 44, w = 128, h = 74;
  fb.rect(x0, y0, w, h, 0x0f);
  fb.frame(x0, y0, w, h, 0x21);
  fb.textC('DIRECTORY', 128, y0 + 3, 0x21);
  for (let f = 1; f <= 4; f++) {
    const y = y0 + 4 + f * 13;
    fb.tiny(['', '4F', '3F', '2F', '1F'][f], x0 + 4, y + 2, 0x10);
    fb.rect(x0 + 14, y + 8, 108, 1, 0x00);
    for (const st of L.stores) {
      if (st.def.floor !== f) continue;
      const sx = x0 + 14 + Math.round(st.def.x * 0.14);
      const hot = st.def.id === L.kioskPanel!.store;
      const col = st.def.role === 'closed' ? 0x00 : st.def.role === 'shop' ? 0x12 : st.cleared ? 0x10 : 0x16;
      fb.rect(sx, y, 11, 8, hot && frame & 8 ? 0x30 : col);
      if (hot) fb.frame(sx - 1, y - 1, 13, 10, 0x28);
    }
  }
  const t = L.kioskPanel!.store;
  fb.textC(t >= 0 ? STORES[t].name.slice(0, 15) : 'ALL CLEAR', 128, y0 + h - 10, 0x28);
}
