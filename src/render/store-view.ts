// Draws the top-down store room from the room's state. Reads state, never changes it.
import { HUD_H, SCREEN_W } from '../core/constants';
import { NES } from '../core/palette';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../store/templates';
import type { StoreRoom } from '../store/room';
import type { Assets } from './assets';
import { THEME } from './palette-theme';
import { drawText, drawCentered, wrap, textWidth } from './text';

const ROOM_Y = HUD_H;
const STRIP_Y = ROOM_Y + ROOM_ROWS * TILE; // bottom strip with the store name

export function drawStoreRoom(g: CanvasRenderingContext2D, a: Assets, room: StoreRoom, frame: number): void {
  const th = THEME[room.template.theme];
  g.save();
  g.beginPath();
  g.rect(0, ROOM_Y, SCREEN_W, ROOM_ROWS * TILE);
  g.clip();
  g.translate(0, ROOM_Y);
  drawTiles(g, room, th.floor, th.wall, th.accent);
  drawFixtures(g, room, th.accent, frame);
  drawShelvesAndDecor(g, room, th.accent);
  drawEgg(g, room, frame);
  drawGuards(g, a, room, frame);
  drawToys(g, a, room);
  drawPlayer(g, a, room, frame);
  drawBullets(g, room);
  drawPuffs(g, a, room);
  drawSearchBar(g, room);
  drawRoomBubbles(g, room);
  g.restore();
  drawBottomStrip(g, room, frame);
}

function drawTiles(g: CanvasRenderingContext2D, room: StoreRoom, floor: string, wall: string, accent: string): void {
  for (let r = 0; r < ROOM_ROWS; r++)
    for (let c = 0; c < ROOM_COLS; c++) {
      const ch = room.rows[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (ch === '#') {
        g.fillStyle = wall;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = accent;
        g.fillRect(x, y + TILE - 2, TILE, 2);
        continue;
      }
      g.fillStyle = (r + c) % 2 ? floor : shade(floor);
      g.fillRect(x, y, TILE, TILE);
      if (ch === 'D') {
        g.fillStyle = NES.ink;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = NES.silver;
        g.fillRect(x + 3, y + 2, TILE - 6, TILE - 2);
      }
    }
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 10);
  const gg = Math.max(0, ((n >> 8) & 255) - 10);
  const b = Math.max(0, (n & 255) - 10);
  return `rgb(${r},${gg},${b})`;
}

function drawFixtures(g: CanvasRenderingContext2D, room: StoreRoom, accent: string, frame: number): void {
  for (const f of room.fixtures) {
    const x = f.col * TILE;
    const y = f.row * TILE;
    if (f.opened) {
      g.fillStyle = NES.dkgrey;
      g.fillRect(x + 1, y + 4, TILE - 2, TILE - 4);
      g.fillStyle = NES.silver;
      g.fillRect(x + 3, y + 8, 4, 4);
      g.fillRect(x + 9, y + 6, 4, 6);
      continue;
    }
    g.fillStyle = f.kind === 'L' ? NES.white : accent;
    g.fillRect(x + 1, y + 2, TILE - 2, TILE - 2);
    g.fillStyle = NES.ink;
    g.fillRect(x + 1, y + 2, TILE - 2, 1);
    g.fillRect(x + 1, y + TILE - 1, TILE - 2, 1);
    // A little glint, so searchable fixtures stand out.
    if ((frame >> 4) % 4 === f.index % 4) {
      g.fillStyle = NES.yellow;
      g.fillRect(x + 4, y + 4, 2, 2);
    }
  }
}

function drawShelvesAndDecor(g: CanvasRenderingContext2D, room: StoreRoom, accent: string): void {
  for (let r = 0; r < ROOM_ROWS; r++)
    for (let c = 0; c < ROOM_COLS; c++) {
      const ch = room.rows[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (ch === 'S') {
        g.fillStyle = NES.wood;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = accent;
        g.fillRect(x + 2, y + 4, TILE - 4, 2);
        g.fillRect(x + 2, y + 10, TILE - 4, 2);
      } else if (ch === 'C') {
        g.fillStyle = NES.brown;
        g.fillRect(x, y + 2, TILE, TILE - 2);
        g.fillStyle = NES.wood;
        g.fillRect(x, y + 2, TILE, 3);
      } else if (ch === 'R') {
        g.fillStyle = NES.dkgrey;
        g.fillRect(x, y + 2, TILE, TILE - 2);
        g.fillStyle = NES.grey;
        g.fillRect(x + 2, y + 5, TILE - 4, 2);
      } else if (ch === 'T') {
        g.fillStyle = NES.ink;
        g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.fillStyle = NES.cyan;
        g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      } else if (ch === 'B') {
        g.fillStyle = NES.navy;
        g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      } else if (ch === 'P') {
        g.fillStyle = NES.silver;
        g.fillRect(x + 4, y + 8, 8, 8);
        g.fillStyle = NES.white;
        g.fillRect(x + 6, y + 6, 4, 2);
      }
    }
}

function drawEgg(g: CanvasRenderingContext2D, room: StoreRoom, frame: number): void {
  if (room.mode !== 'egg' || room.eggPedestal) return;
  // The clerk between the two demo TVs, and the typewriter box.
  const cx = 5 * TILE;
  g.fillStyle = NES.white;
  g.fillRect(cx - 2, 8, TILE + 4, 22);
  g.fillStyle = NES.brown;
  g.fillRect(cx + 2, 12, TILE - 4, 14);
  g.fillStyle = NES.skin;
  g.fillRect(cx + 4, 8, 8, 6);
  const text = room.eggText;
  const box = { x: 8, y: 40, w: SCREEN_W - 16, h: 36 };
  g.fillStyle = NES.ink;
  g.fillRect(box.x, box.y, box.w, box.h);
  g.fillStyle = NES.white;
  g.fillRect(box.x, box.y, box.w, 1);
  g.fillRect(box.x, box.y + box.h - 1, box.w, 1);
  wrap(text, 34).slice(0, 3).forEach((l, i) => drawText(g, l, box.x + 6, box.y + 6 + i * 8, NES.white, 1));
  if ((frame >> 4) % 2) drawText(g, '_', box.x + 6 + textWidth(text.slice(-30)), box.y + 22, NES.white, 1);
}

function drawGuards(g: CanvasRenderingContext2D, a: Assets, room: StoreRoom, frame: number): void {
  for (const gd of room.guards) {
    if (!gd.alive) continue;
    const stunned = gd.stunT > 0;
    if (gd.kind === 'bot') {
      g.drawImage(a.canvas('security_bot'), Math.round(gd.x), Math.round(gd.y));
    } else {
      const pose = stunned ? 'stand' : (frame >> 4) % 2 ? 'walkA' : 'walkB';
      g.drawImage(a.canvas(`spy_${pose}`), Math.round(gd.x), Math.round(gd.y) - 8);
    }
    if (stunned) {
      g.fillStyle = NES.yellow;
      g.fillRect(Math.round(gd.x) + 6, Math.round(gd.y) - 4, 4, 2);
    }
  }
}

function drawToys(g: CanvasRenderingContext2D, a: Assets, room: StoreRoom): void {
  for (const t of room.toys) g.drawImage(a.canvas('windup_toy'), Math.round(t.x) - 4, Math.round(t.y) - 4);
}

function drawPlayer(g: CanvasRenderingContext2D, a: Assets, room: StoreRoom, frame: number): void {
  if (room.mode === 'egg' && !room.eggPedestal) return;
  const flip = room.facing === 'l';
  const pose = room.mode === 'search' ? 'duck' : (frame >> 3) % 2 ? 'walkA' : 'stand';
  g.drawImage(a.canvas(`agent_${pose}`, flip), Math.round(room.x), Math.round(room.y) - 8);
  if (room.mode === 'hold') {
    const item = room.holdText.startsWith('PACKAGE') ? 'package' : `pu_${room.holdText}`;
    g.drawImage(a.canvas(item), Math.round(room.x) + 4, Math.round(room.y) - 18);
  }
  if (room.mode === 'stun') {
    g.fillStyle = NES.yellow;
    g.fillRect(Math.round(room.x) + 6, Math.round(room.y) - 14, 4, 4);
  }
}

function drawBullets(g: CanvasRenderingContext2D, room: StoreRoom): void {
  for (const b of room.bullets) {
    g.fillStyle = b.owner === 'player' ? NES.yellow : NES.red;
    g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
  }
}

function drawPuffs(g: CanvasRenderingContext2D, a: Assets, room: StoreRoom): void {
  for (const p of room.puffs) {
    g.globalAlpha = Math.min(1, p.t / 20);
    g.drawImage(a.canvas('smoke'), Math.round(p.x), Math.round(p.y));
    g.globalAlpha = 1;
  }
}

function drawSearchBar(g: CanvasRenderingContext2D, room: StoreRoom): void {
  if (room.mode !== 'search' || !room.searchOf) return;
  const f = room.searchOf;
  const x = f.col * TILE;
  const y = f.row * TILE - 5;
  g.fillStyle = NES.ink;
  g.fillRect(x - 1, y - 1, TILE + 2, 4);
  g.fillStyle = NES.lime;
  g.fillRect(x, y, Math.round(TILE * room.searchProgress), 2);
}

function drawRoomBubbles(g: CanvasRenderingContext2D, room: StoreRoom): void {
  for (const b of room.bubbles) {
    const lines = wrap(b.text, 28);
    const width = Math.max(...lines.map((l) => textWidth(l))) + 6;
    const height = lines.length * 8 + 4;
    const x = Math.min(Math.max(b.x - width / 2 + 8, 2), SCREEN_W - width - 2);
    const y = Math.max(b.y - height, 2);
    g.fillStyle = NES.white;
    g.fillRect(x, y, width, height);
    lines.forEach((l, i) => drawText(g, l, x + 3, y + 3 + i * 8, NES.ink, 1));
  }
}

function drawBottomStrip(g: CanvasRenderingContext2D, room: StoreRoom, frame: number): void {
  g.fillStyle = NES.ink;
  g.fillRect(0, STRIP_Y, SCREEN_W, 240 - STRIP_Y);
  g.fillStyle = THEME[room.template.theme].accent;
  g.fillRect(0, STRIP_Y, SCREEN_W, 1);
  drawCentered(g, room.store.name, STRIP_Y + 4, NES.gold);
  let line = '';
  if (room.mode === 'search') {
    line = 'SEARCHING...';
    const w = Math.round(120 * room.searchProgress);
    g.fillStyle = NES.dkgrey;
    g.fillRect(68, STRIP_Y + 18, 120, 4);
    g.fillStyle = NES.lime;
    g.fillRect(68, STRIP_Y + 18, w, 4);
  } else if (room.canSearch) {
    line = (frame >> 4) % 2 ? 'PRESS X TO SEARCH' : 'PRESS X TO SEARCH!';
  }
  if (line) drawCentered(g, line, STRIP_Y + 16, NES.white);
  drawCentered(g, 'ARROWS MOVE   A SHOOT   X SEARCH', STRIP_Y + 28, NES.silver);
}

