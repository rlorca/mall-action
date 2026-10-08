// Draws the side-scrolling mall from the world's state. Reads state, never changes it.
import { AGENT_H, AGENT_W, CAR_W, ESCALATORS, ESCALATOR_W, FLOOR_NAMES, HUD_H, MALL_W, SCREEN_W, SHAFTS, SHAFT_W, VIEW_H, floorY } from '../core/constants';
import { NES } from '../core/palette';
import { drawText, drawCentered, textWidth, wrap } from './text';
import type { Assets } from './assets';
import { THEME, MALL_FLOOR, MALL_WALL } from './palette-theme';
import { PROPS, STORES, type StoreDef } from '../mall/layout';
import type { MallWorld } from '../mall/world';
import type { Game } from '../core/game';
import type { SpygramPost } from '../core/copy';

const STORE_H = 40;

/** Breaks a store name into sign lines of at most 13 characters. */
export function signLines(name: string): string[] {
  return wrap(name, 13);
}

/** Converts a world x to a screen x. */
const sx = (w: MallWorld, x: number): number => Math.round(x - w.cameraX);
/** Converts a world y to a screen y (the view sits under the HUD). */
const sy = (w: MallWorld, y: number): number => Math.round(y - w.cameraY + HUD_H);

export function drawMall(g: CanvasRenderingContext2D, a: Assets, game: Game, frame: number): void {
  const w = game.world;
  g.save();
  g.beginPath();
  g.rect(0, HUD_H, SCREEN_W, VIEW_H);
  g.clip();
  drawBackdrop(g, w, frame);
  drawFloors(g, w);
  drawShafts(g, w);
  drawEscalators(g, w);
  drawStores(g, w, game, frame);
  drawProps(g, a, w, frame);
  drawDarkZones(g, w);
  drawWet(g, w, frame);
  drawCoinsAndItems(g, a, w, frame);
  drawNpcs(g, a, w, frame);
  drawSpies(g, a, w, frame);
  drawCars(g, w);
  drawBullets(g, a, w);
  drawPlayer(g, a, w, frame);
  drawBubbles(g, w);
  g.restore();
  if (w.kioskShow) drawKioskPanel(g, w);
}

function drawBackdrop(g: CanvasRenderingContext2D, w: MallWorld, frame: number): void {
  g.fillStyle = MALL_WALL;
  g.fillRect(0, HUD_H, SCREEN_W, VIEW_H);
  // Ceiling lights, one row per floor, parallax-free.
  for (let f = 0; f < 6; f++) {
    const y = sy(w, floorY(f)) - 46;
    g.fillStyle = NES.nightC;
    g.fillRect(0, y, SCREEN_W, 2);
    for (let x = 0; x < SCREEN_W; x += 48) {
      g.fillStyle = (frame >> 4) % 2 ? NES.yellow : NES.white;
      g.fillRect(((x - Math.round(w.cameraX)) % 256 + 256) % 256 + 8, y + 3, 6, 1);
    }
  }
}

function drawFloors(g: CanvasRenderingContext2D, w: MallWorld): void {
  for (let f = 0; f < 6; f++) {
    const y = sy(w, floorY(f));
    // The walkable strip under each floor line.
    g.fillStyle = f === 5 ? NES.dkgrey : MALL_FLOOR;
    g.fillRect(0, y, SCREEN_W, 4);
    g.fillStyle = f === 5 ? NES.grey : NES.silver;
    for (let x = -Math.round(w.cameraX) % 16; x < SCREEN_W; x += 16) g.fillRect(x, y + 4, 1, 4);
    // Floor label on the left edge of the world.
    if (w.cameraX < 16) drawText(g, FLOOR_NAMES[f], 2, y - 10, NES.white, 1);
  }
  // Level edges.
  g.fillStyle = NES.ink;
  if (w.cameraX < 2) g.fillRect(0, HUD_H, 2, VIEW_H);
  if (w.cameraX > MALL_W - 256 - 2) g.fillRect(SCREEN_W - 2, HUD_H, 2, VIEW_H);
}

function drawShafts(g: CanvasRenderingContext2D, w: MallWorld): void {
  SHAFTS.forEach((s) => {
    for (let f = s.minFloor; f <= s.maxFloor; f++) {
      const y = sy(w, floorY(f));
      const x = sx(w, s.x);
      if (x + SHAFT_W < 0 || x > SCREEN_W) continue;
      g.fillStyle = NES.ink;
      g.fillRect(x, y - AGENT_H, SHAFT_W, AGENT_H);
      // Door frame (brass) on each floor the shaft serves.
      g.fillStyle = NES.gold;
      g.fillRect(x, y - AGENT_H, 2, AGENT_H);
      g.fillRect(x + SHAFT_W - 2, y - AGENT_H, 2, AGENT_H);
      // Grate: a fine hatch so a shaft opening is easy to read.
      g.fillStyle = NES.dkgrey;
      for (let k = 2; k < SHAFT_W - 2; k += 4) g.fillRect(x + k, y - 2, 2, 2);
    }
  });
}

function drawEscalators(g: CanvasRenderingContext2D, w: MallWorld): void {
  for (const e of ESCALATORS) {
    const x0 = sx(w, e.x);
    const yl = sy(w, floorY(e.lowerFloor));
    g.fillStyle = NES.dkgrey;
    for (let k = 0; k <= ESCALATOR_W; k++) {
      g.fillRect(x0 + k, yl - k, 3, 3);
    }
    g.fillStyle = NES.silver;
    for (let k = 0; k <= ESCALATOR_W; k += 4) g.fillRect(x0 + k, yl - k - 3, 2, 1);
  }
}

function drawStores(g: CanvasRenderingContext2D, w: MallWorld, game: Game, frame: number): void {
  for (const s of STORES) {
    const x = sx(w, s.x);
    const base = sy(w, floorY(s.floor));
    if (x + 80 < 0 || x > SCREEN_W) continue;
    drawStorefront(g, s, x, base, game, frame);
  }
}

function drawStorefront(g: CanvasRenderingContext2D, s: StoreDef, x: number, base: number, game: Game, frame: number): void {
  const th = THEME[s.theme];
  const cleared = s.role === 'target' && !game.remaining.has(s.id);
  const top = base - STORE_H;
  // Facade.
  g.fillStyle = th.wall;
  g.fillRect(x, top + 16, 80, STORE_H - 16);
  // Sign.
  const signCol = s.role === 'target' ? NES.red : s.role === 'power' ? NES.blue : NES.dkgrey;
  g.fillStyle = s.role === 'closed' ? NES.ink : signCol;
  g.fillRect(x, top, 80, 16);
  g.fillStyle = NES.white;
  g.fillRect(x, top + 15, 80, 1);
  signLines(s.name).slice(0, 2).forEach((line, i) => {
    drawCentered(g, line, top + 2 + i * 7, s.role === 'closed' ? NES.silver : NES.white, 1, x + 40);
  });
  // Windows with idle animation.
  drawWindow(g, s, x + 4, top + 18, 24, 18, frame, cleared);
  drawWindow(g, s, x + 52, top + 18, 24, 18, frame, cleared);
  // Door: red blinking for target stores, blue for power-up shops, shutter for closed stores.
  if (s.role === 'closed') {
    g.fillStyle = NES.silver;
    for (let k = 0; k < 24; k += 4) g.fillRect(x + 32, top + 16 + k, 16, 2);
    g.fillStyle = NES.ink;
    g.fillRect(x + 32, top + 16, 16, 1);
  } else if (cleared) {
    g.fillStyle = NES.ink;
    g.fillRect(x + 32, base - AGENT_H, 16, AGENT_H);
  } else {
    const on = s.role === 'target' ? (frame >> 5) % 2 === 0 : true;
    g.fillStyle = s.role === 'target' ? (on ? NES.red : NES.redDk) : NES.blue;
    g.fillRect(x + 32, base - AGENT_H, 16, AGENT_H);
    g.fillStyle = NES.yellow;
    g.fillRect(x + 42, base - 12, 2, 2);
  }
  if (game.blackFriday && s.role !== 'closed' && !cleared) {
    g.fillStyle = NES.red;
    g.fillRect(x + 4, base - 6, 26, 6);
    drawText(g, '70% OFF', x + 5, base - 6, NES.white, 1);
  }
}

function drawWindow(g: CanvasRenderingContext2D, s: StoreDef, x: number, y: number, w: number, h: number, frame: number, dim: boolean): void {
  const bg = dim ? NES.ink : NES.nightA;
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  const c = (col: string): string => (dim ? NES.dkgrey : col);
  const t = Math.floor(frame / 8);
  switch (s.theme) {
    case 'fashion':
      g.fillStyle = c(NES.pink);
      g.fillRect(x + 6, y + 4, 4, 12);
      g.fillStyle = c(NES.cyan);
      g.fillRect(x + 14, y + 4, 4, 12);
      g.fillStyle = c(NES.silver);
      g.fillRect(x + 2, y + 2, 20, 1);
      break;
    case 'electronics':
      g.fillStyle = c(NES.ink);
      g.fillRect(x + 2, y + 3, 9, 8);
      g.fillRect(x + 13, y + 3, 9, 8);
      g.fillStyle = dim ? NES.dkgrey : (t % 2 ? NES.white : NES.silver);
      g.fillRect(x + 3, y + 4, 7, 6);
      g.fillRect(x + 14, y + 4, 7, 6);
      break;
    case 'toys':
      g.fillStyle = c(NES.brown);
      g.fillRect(x + 5, y + 7, 6, 8);
      g.fillStyle = c(NES.orange);
      g.fillRect(x + 4, y + 2, 8, 6);
      g.fillStyle = c(NES.red);
      g.fillRect(x + 14, y + 10 - (t % 2), 4, 6);
      break;
    case 'food':
      g.fillStyle = c(NES.yellow);
      g.fillRect(x + 4, y + 9, 16, 7);
      g.fillStyle = c(NES.orange);
      g.fillRect(x + 6 + (t % 3), y + 2, 2, 3);
      g.fillRect(x + 14, y + 1 + (t % 2), 2, 3);
      break;
    case 'sports':
      for (let i = 0; i < 3; i++) {
        g.fillStyle = c(i === 1 ? NES.lime : NES.white);
        g.fillRect(x + 3 + i * 7, y + 8, 6, 4);
      }
      break;
    case 'music':
      g.fillStyle = c(NES.ink);
      g.fillRect(x + 3, y + 5, 18, 10);
      g.fillStyle = c(NES.pink);
      g.fillRect(x + 6, y + 8, 4, 4);
      g.fillRect(x + 14, y + 8 + (t % 2), 4, 4);
      break;
    case 'gadgets':
      g.fillStyle = c(NES.cyan);
      g.fillRect(x + 8 + (t % 2), y + 6, 6, 6);
      g.fillStyle = c(NES.silver);
      g.fillRect(x + 3, y + 13, 18, 2);
      break;
    case 'novelty':
      g.fillStyle = c(NES.magenta);
      g.fillRect(x + 8, y + 3 + (t % 4), 8, 8);
      g.fillStyle = c(NES.orange);
      g.fillRect(x + 9, y + 12, 6, 3);
      break;
    case 'games':
      g.fillStyle = c(NES.ink);
      g.fillRect(x + 4, y + 10, 16, 5);
      g.fillStyle = c(t % 2 ? NES.green : NES.lime);
      g.fillRect(x + 6, y + 3, 12, 6);
      break;
  }
}

function drawProps(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, frame: number): void {
  for (const p of PROPS) {
    const x = sx(w, p.x);
    const base = sy(w, floorY(p.floor));
    if (x + p.w < 0 || x > SCREEN_W) continue;
    switch (p.kind) {
      case 'kiosk':
        g.drawImage(a.canvas('kiosk'), x - 0, base - AGENT_H);
        break;
      case 'booth':
        g.fillStyle = NES.navy;
        g.fillRect(x, base - AGENT_H, 24, AGENT_H);
        g.fillStyle = NES.cyan;
        g.fillRect(x + 3, base - AGENT_H + 4, 18, 10);
        g.fillStyle = NES.yellow;
        g.fillRect(x + 6, base - AGENT_H + 7, 12, 4);
        break;
      case 'fountain': {
        g.fillStyle = NES.silver;
        g.fillRect(x, base - 10, 24, 10);
        g.fillStyle = NES.cyan;
        g.fillRect(x + 2, base - 8, 20, 6);
        const spray = (frame >> 3) % 3;
        g.fillStyle = NES.white;
        g.fillRect(x + 11, base - 16 - spray, 2, 6 + spray);
        break;
      }
      case 'lamp': {
        const lamp = w.lamps.find((l) => l.id === p.id);
        if (lamp && lamp.state === 'hanging') {
          g.fillStyle = NES.dkgrey;
          g.fillRect(x + 7, base - AGENT_H - 8, 2, 14);
          g.drawImage(a.canvas('lamp'), x, base - 40 + 2);
        }
        break;
      }
      case 'disco': {
        const d = w.discos.find((l) => l.id === p.id);
        if (d && d.state !== 'gone') {
          const yy = d.state === 'hanging' ? base - 40 : base - 16;
          g.drawImage(a.canvas('disco'), sx(w, d.x), yy);
        }
        break;
      }
      case 'bench':
        g.fillStyle = NES.wood;
        g.fillRect(x, base - 6, p.w, 3);
        g.fillStyle = NES.brown;
        g.fillRect(x + 1, base - 3, 2, 3);
        g.fillRect(x + p.w - 3, base - 3, 2, 3);
        break;
      case 'plant':
        g.fillStyle = NES.brown;
        g.fillRect(x, base - 6, p.w, 6);
        g.fillStyle = NES.greenDk;
        g.fillRect(x - 2, base - 14, p.w + 4, 9);
        break;
      case 'pillar':
        g.fillStyle = NES.silver;
        g.fillRect(x, base - 48, p.w, 48);
        g.fillStyle = NES.dkgrey;
        g.fillRect(x + p.w - 2, base - 48, 2, 48);
        break;
      case 'wagon':
        drawWagon(g, x, base);
        break;
      case 'anchor':
        break;
    }
  }
}

/** The wood-panelled station wagon on P (also used by the level-clear drive-off). */
export function drawWagon(g: CanvasRenderingContext2D, x: number, base: number): void {
  g.fillStyle = NES.silver;
  g.fillRect(x, base - 26, 64, 18);
  g.fillStyle = NES.wood;
  g.fillRect(x + 2, base - 22, 60, 10);
  g.fillStyle = NES.brown;
  for (let k = 6; k < 60; k += 8) g.fillRect(x + 2 + k, base - 22, 1, 10);
  g.fillStyle = NES.cyan;
  g.fillRect(x + 48, base - 24, 12, 5);
  g.fillStyle = NES.ink;
  g.fillRect(x + 6, base - 8, 10, 8);
  g.fillRect(x + 46, base - 8, 10, 8);
}

function drawDarkZones(g: CanvasRenderingContext2D, w: MallWorld): void {
  for (const z of w.darkZones) {
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(sx(w, z.x0), sy(w, floorY(z.floor)) - AGENT_H, z.x1 - z.x0, AGENT_H);
  }
}

function drawWet(g: CanvasRenderingContext2D, w: MallWorld, frame: number): void {
  if (!w.wet) return;
  const x = sx(w, w.wet.x0);
  const y = sy(w, floorY(4));
  g.fillStyle = NES.blue;
  g.fillRect(x, y, w.wet.x1 - w.wet.x0, 3);
  g.fillStyle = NES.cyan;
  g.fillRect(x + 2 + (frame % 40), y, 6, 1);
  // The sign: a yellow wet-floor placard.
  g.fillStyle = NES.yellow;
  g.fillRect(x + 8, y - 12, 16, 10);
  g.fillStyle = NES.ink;
  g.fillRect(x + 11, y - 9, 10, 4);
}

function drawCoinsAndItems(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, frame: number): void {
  for (const c of w.coins) {
    const x = sx(w, c.x) - 4;
    const y = sy(w, c.y) - 8;
    g.drawImage(a.canvas(c.gold ? 'coin_gold' : 'coin'), x, y + (frame >> 3 & 1));
  }
  for (const it of w.items) {
    const x = sx(w, it.x) - 4;
    const y = sy(w, floorY(it.floor)) - 12;
    g.drawImage(a.canvas(`pu_${it.id}`), x, y + ((frame >> 3) & 1) * -2);
  }
}

function drawNpcs(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, frame: number): void {
  const walk = (frame >> 4) % 2 ? 'walkA' : 'walkB';
  for (const wk of w.walkers) {
    const x = sx(w, wk.x);
    const y = sy(w, floorY(wk.floor));
    if (x + AGENT_W < 0 || x > SCREEN_W) continue;
    g.drawImage(a.canvas(`walker_${walk}`, wk.dir < 0), x, y - AGENT_H);
  }
  const j = w.janitor;
  const jx = sx(w, j.x);
  const jy = sy(w, floorY(j.floor));
  if (jx + AGENT_W > 0 && jx < SCREEN_W) {
    g.drawImage(a.canvas(j.mopT > 0 ? 'janitor_stand' : `janitor_${walk}`, j.dir < 0), jx, jy - AGENT_H);
    if (j.mopT > 0) {
      g.fillStyle = NES.silver;
      g.fillRect(jx + 12, jy - 14, 2, 14);
    }
  }
  const c = w.cop;
  const cx = sx(w, c.x);
  const cy = sy(w, floorY(c.floor));
  if (cx + 16 > 0 && cx < SCREEN_W) {
    g.drawImage(a.canvas('segway'), cx, cy - 16);
    g.drawImage(a.canvas(`cop_${walk}`, c.facing < 0), cx, cy - 16 - AGENT_H + 16);
  }
}

function drawSpies(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, frame: number): void {
  const walk = (frame >> 4) % 2 ? 'walkA' : 'walkB';
  for (const s of w.spies) {
    const x = sx(w, s.x);
    const y = sy(w, floorY(s.floor));
    if (x + AGENT_W < 0 || x > SCREEN_W) continue;
    const strides = s.mode === 'fresh' || (s.mode === 'wander' && (frame >> 4) % 2 === 1);
    const pose = s.mode === 'dying' ? 'dead' : s.mode === 'aim' ? 'aim' : strides ? walk : 'stand';
    g.drawImage(a.canvas(`spy_${pose}`, s.facing < 0), x, y - AGENT_H);
    if (s.mode === 'aim') {
      // Telegraph: a yellow tick above the head shows the spy is about to shoot.
      g.fillStyle = s.aimHigh ? NES.yellow : NES.orange;
      g.fillRect(x + 6, y - AGENT_H - 4, 4, 2);
    }
  }
}

function drawCars(g: CanvasRenderingContext2D, w: MallWorld): void {
  for (const car of w.cars) {
    const x = sx(w, car.x);
    const y = sy(w, car.y);
    g.fillStyle = NES.dkgrey;
    g.fillRect(x, y - AGENT_H, CAR_W, AGENT_H);
    g.fillStyle = car.occupied ? NES.wood : NES.silver;
    g.fillRect(x + 1, y - AGENT_H + 1, CAR_W - 2, AGENT_H - 2);
    // Doors: closed while moving.
    if (car.moving) {
      g.fillStyle = NES.dkgrey;
      g.fillRect(x + CAR_W / 2 - 1, y - AGENT_H + 1, 2, AGENT_H - 2);
    }
    g.fillStyle = car.moving ? NES.yellow : NES.greenDk;
    g.fillRect(x + 8, y - AGENT_H + 3, 8, 2);
  }
}

function drawBullets(g: CanvasRenderingContext2D, a: Assets, w: MallWorld): void {
  for (const b of w.bullets) {
    const x = sx(w, b.x);
    const y = sy(w, b.y);
    const name = b.owner === 'player' ? 'bullet_player' : 'bullet_spy';
    g.drawImage(a.canvas(name, b.dx < 0), x - 2, y - 1);
  }
}

function drawPlayer(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, frame: number): void {
  const p = w.player;
  if (p.mode === 'hidden') return;
  if (p.invulnT > 0 && (frame >> 2) % 2) return; // blinking invulnerability
  if (w.arrival) return;
  const walk = (frame >> 3) % 2 ? 'walkA' : 'walkB';
  const pose =
    p.mode === 'dead' ? 'dead' :
    p.mode === 'jump' ? (p.jumpKick ? 'kick' : 'jump') :
    p.mode === 'roof' || (p.mode === 'walk' && p.ducking) ? 'duck' :
    p.mode === 'walk' && p.moving ? walk :
    'stand';
  const x = sx(w, p.x);
  const y = sy(w, p.y);
  const flip = p.facing < 0;
  g.drawImage(a.canvas(`agent_${pose}`, flip), x, y - AGENT_H);
  if (p.frozenT > 0 || p.mode === 'frozen') {
    g.fillStyle = NES.yellow;
    g.fillRect(x + 6, y - AGENT_H - 6, 4, 4);
  }
}

function drawBubbles(g: CanvasRenderingContext2D, w: MallWorld): void {
  for (const b of w.bubbles) {
    const lines = wrap(b.text, 28);
    const width = Math.max(...lines.map((l) => textWidth(l))) + 6;
    const height = lines.length * 8 + 4;
    let x = sx(w, b.x) - width / 2 + 8;
    let y = sy(w, floorY(b.floor)) - AGENT_H - height - 4;
    x = Math.min(Math.max(x, 2), SCREEN_W - width - 2);
    y = Math.max(y, HUD_H + 2);
    g.fillStyle = NES.white;
    g.fillRect(x, y, width, height);
    g.fillStyle = NES.ink;
    g.fillRect(x, y, width, 1);
    g.fillRect(x, y + height - 1, width, 1);
    g.fillRect(x, y, 1, height);
    g.fillRect(x + width - 1, y, 1, height);
    lines.forEach((l, i) => drawText(g, l, x + 3, y + 3 + i * 8, NES.ink, 1));
  }
}

function drawKioskPanel(g: CanvasRenderingContext2D, w: MallWorld): void {
  g.fillStyle = NES.ink;
  g.fillRect(40, 60, 176, 96);
  g.fillStyle = NES.cyan;
  g.fillRect(40, 60, 176, 1);
  drawCentered(g, 'DIRECTORY', 66, NES.white);
  const k = w.kioskShow!;
  const s = STORES.find((st) => st.id === k.storeId);
  if (s) {
    drawCentered(g, 'NEAREST PACKAGE:', 84, NES.yellow);
    drawCentered(g, s.name, 96, NES.white);
    drawCentered(g, `FLOOR ${FLOOR_NAMES[s.floor]}`, 106, NES.silver);
  } else {
    drawCentered(g, 'ALL PACKAGES FOUND!', 90, NES.lime);
  }
}

/**
 * The arrival: a dark skyscraper at the left, the zip-line down to the roof anchor, the drop,
 * the crouch landing, then the SPYGRAM selfie. Drawn in screen coordinates.
 */
export function drawArrival(g: CanvasRenderingContext2D, a: Assets, w: MallWorld, post: SpygramPost | null): void {
  const arr = w.arrival;
  if (!arr) return;
  g.fillStyle = NES.nightA;
  g.fillRect(0, HUD_H, SCREEN_W, VIEW_H);
  // Skyscraper with lit windows at the left edge.
  g.fillStyle = NES.ink;
  g.fillRect(0, 40, 48, 200);
  for (let y = 48; y < 200; y += 8) {
    for (let x = 4; x < 44; x += 8) {
      g.fillStyle = (x + y) % 3 === 0 ? NES.yellow : NES.nightC;
      g.fillRect(x, y, 4, 4);
    }
  }
  // The roof, and the anchor post the cable is tied to.
  const roofY = floorY(0) + HUD_H;
  g.fillStyle = NES.dkgrey;
  g.fillRect(0, roofY, SCREEN_W, VIEW_H - (roofY - HUD_H));
  g.fillStyle = NES.silver;
  g.fillRect(ANCHOR_X, roofY - 16, 4, 16);
  // The cable from the tower to the anchor post.
  g.fillStyle = NES.silver;
  for (let x = 0; x < ANCHOR_X; x++) g.fillRect(x, CABLE_Y0 + ((x * (CABLE_Y1 - CABLE_Y0)) / ANCHOR_X) | 0, 1, 1);

  if (arr.phase === 'slide') {
    const t = arr.t / 150;
    const x = 8 + (ANCHOR_X - 8) * t;
    const feet = CABLE_Y0 + 6 + (CABLE_Y1 - CABLE_Y0) * t;
    g.drawImage(a.canvas('agent_zip'), Math.round(x), Math.round(feet - AGENT_H));
  } else if (arr.phase === 'drop') {
    const t = arr.t / 30;
    const feet = CABLE_Y1 + 6 + (roofY - CABLE_Y1 - 6) * t;
    g.drawImage(a.canvas('agent_jump'), ANCHOR_X - 4, Math.round(feet - AGENT_H));
  } else if (arr.phase === 'land' || arr.phase === 'selfie') {
    g.drawImage(a.canvas(arr.phase === 'land' ? 'agent_duck' : 'agent_stand'), ANCHOR_X - 4, roofY - AGENT_H);
  }
  if (arr.phase === 'selfie' && post) drawSelfie(g, a, post, 0);
}

const ANCHOR_X = 40;
const CABLE_Y0 = 36 + HUD_H;
const CABLE_Y1 = floorY(0) + HUD_H - 14;

/** SPYGRAM card: a magenta header, the agent's photo, a caption and a like counter. */
export function drawSelfie(g: CanvasRenderingContext2D, a: Assets, post: SpygramPost, likes: number): void {
  const x = 40;
  const y = 36;
  g.fillStyle = NES.white;
  g.fillRect(x, y, 176, 160);
  g.fillStyle = NES.magenta;
  g.fillRect(x, y, 176, 14);
  drawText(g, 'SPYGRAM', x + 6, y + 3, NES.white, 1);
  g.fillStyle = NES.nightB;
  g.fillRect(x + 8, y + 18, 160, 76);
  g.drawImage(a.canvas('agent_stand'), x + 80, y + 30, AGENT_W, AGENT_H);
  post.caption.forEach((l, i) => drawText(g, l, x + 8, y + 104 + i * 8, NES.ink, 1));
  drawText(g, post.comment, x + 8, y + 128, NES.purple, 1);
  drawText(g, `${likes} LIKES`, x + 8, y + 140, NES.red, 1);
}
