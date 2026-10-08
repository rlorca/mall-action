import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, wrapText } from '../engine/font';
import { getSprite } from '../art/registry';
import { EASTER_EGG, UI } from '../content/copy';
import type { ThemeId } from '../content/themes';
import { TILE, isSolidKind, tileAt } from '../game/store/room';
import { DIR_VEC, ROOM_TOP, VIEW_H, VIEW_W, type Agent, type Guard, type StoreWorld } from '../game/store/world';
import { drawBanner, drawBar, drawBubbles, drawPopups, SCREEN_W } from './widgets';

/**
 * Draws a StoreWorld: the room area (y = 16 .. 192, 256 x 176) and the bottom strip
 * (y = 192 .. 240) with the store name and the search prompt / progress bar. Reads
 * game state only; never mutates it. Everything is clipped to its area, text is
 * clamped or sized to fit so nothing runs off screen.
 */
export const STRIP_TOP = ROOM_TOP + VIEW_H; // 192

const THEME_COLOR: Readonly<Record<ThemeId, number>> = {
  fashion: C.HOTPINK,
  electronics: C.CYAN,
  toys: C.YELLOW,
  food: C.AMBER,
  sports: C.LTGREEN,
  music: C.LAVENDER,
  gadgets: C.LTBLUE,
  novelty: C.PALEMAGENTA,
  games: C.LIME,
};

interface Ctx {
  fb: Framebuffer;
  world: StoreWorld;
  frame: number;
  /** Room pixel -> screen pixel offsets. */
  ox: number;
  oy: number;
}

/** Draw the whole store screen below the HUD. */
export function drawStoreView(fb: Framebuffer, world: StoreWorld, frame: number): void {
  const ctx: Ctx = { fb, world, frame, ox: -world.camX, oy: ROOM_TOP - world.camY };
  fb.fillRect(0, ROOM_TOP, SCREEN_W, VIEW_H, C.BLACK);
  fb.pushClip(0, ROOM_TOP, VIEW_W, VIEW_H);
  drawTiles(ctx);
  drawFixtureMarks(ctx);
  drawEntities(ctx);
  drawOverlays(ctx);
  fb.popClip();
  drawStrip(ctx);
}

/** Alias kept for AGENTS.md ("drawStore(fb, world, frame)"). */
export const drawStore = drawStoreView;

// ------------------------------------------------------------------ tiles
function sprName(theme: ThemeId, k: string): string {
  return `st.${theme}.${k}`;
}

function drawTiles(ctx: Ctx): void {
  const { fb, world, frame, ox, oy } = ctx;
  const room = world.room;
  const theme = room.theme;
  const floor = getSprite(sprName(theme, 'floor'));
  const wall = getSprite(sprName(theme, 'wall'));
  const fixtureAt = new Map<number, number>();
  for (const f of room.fixtures) fixtureAt.set(f.row * room.cols + f.col, f.index);
  const c0 = Math.max(0, Math.floor(-ox / TILE));
  const c1 = Math.min(room.cols - 1, Math.floor((VIEW_W - ox) / TILE));
  const r0 = Math.max(0, Math.floor((ROOM_TOP - oy) / TILE));
  const r1 = Math.min(room.rows - 1, Math.floor((ROOM_TOP + VIEW_H - oy) / TILE));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const kind = tileAt(room, col, row);
      const x = col * TILE + ox;
      const y = row * TILE + oy;
      if (kind === 'wall') {
        fb.sprite(wall, x, y);
        continue;
      }
      if (kind === 'door') {
        if (col === room.door.col) {
          fb.sprite(floor, x, y);
          fb.sprite(floor, x + TILE, y);
          fb.sprite(getSprite('st.door'), x, y);
        }
        continue;
      }
      fb.sprite(floor, x, y);
      switch (kind) {
        case 'counter':
        case 'decor':
          fb.sprite(getSprite(sprName(theme, kind)), x, y);
          break;
        case 'shelf':
        case 'rack': {
          const open = world.fixtureOpened(fixtureAt.get(row * room.cols + col) ?? -1);
          fb.sprite(getSprite(sprName(theme, open ? `${kind}.open` : kind)), x, y);
          break;
        }
        case 'fitting': {
          const i = fixtureAt.get(row * room.cols + col) ?? -1;
          fb.sprite(getSprite(world.fixtureOpened(i) || world.peeked.has(i) ? 'st.fitting.open' : 'st.fitting'), x, y);
          break;
        }
        case 'toyshelf':
          fb.sprite(getSprite(world.toyShelfReleased(col, row) ? 'st.toyshelf.open' : 'st.toyshelf'), x, y);
          break;
        case 'booth': {
          const here = world.onBooth && Math.floor(world.agent.x / TILE) === col && Math.floor(world.agent.y / TILE) === row;
          fb.sprite(getSprite('st.booth'), x, y, { frame: here || (world.onBooth && frame % 16 < 8) ? 1 : 0 });
          break;
        }
        case 'tv':
          fb.sprite(getSprite('st.tv'), x, y, { frame: (Math.floor(frame / 7) + col) % 3 });
          break;
        case 'pedestal':
          if (world.egg && world.egg.phase !== 'done') fb.sprite(getSprite('st.pedestal'), x, y);
          break;
        default:
          break;
      }
    }
  }
}

/** Radar "!" over the package fixture, and a blinking bracket on the fixture a B tap would search. */
function drawFixtureMarks(ctx: Ctx): void {
  const { fb, world, frame, ox, oy } = ctx;
  for (const f of world.room.fixtures) {
    const x = f.col * TILE + ox;
    const y = f.row * TILE + oy;
    if (world.radarMarked(f.index) && frame % 24 < 14) {
      drawText(fb, '!', x + TILE / 2, y + 4, C.YELLOW, { align: 'center', outline: C.BLACK });
    }
  }
  const t = world.search ? world.search.fixture : world.canSearch ? world.searchTarget : -1;
  if (t >= 0 && (world.search || frame % 20 < 14)) {
    const f = world.room.fixtures[t]!;
    const x = f.col * TILE + ox;
    const y = f.row * TILE + oy;
    const col = world.search ? C.YELLOW : C.WHITE;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + TILE - 1, y, -1, 1], [x, y + TILE - 1, 1, -1], [x + TILE - 1, y + TILE - 1, -1, -1]] as const) {
      fb.hLine(dx > 0 ? cx : cx - 3, cy, 4, col);
      fb.vLine(cx, dy > 0 ? cy : cy - 3, 4, col);
    }
  }
}

// ------------------------------------------------------------------ entities
type Layer = { y: number; draw: () => void };

function drawEntities(ctx: Ctx): void {
  const { fb, world, frame, ox, oy } = ctx;
  const layers: Layer[] = [];

  if (world.clerkVisible && world.room.clerk) {
    const c = world.room.clerk;
    layers.push({
      y: c.row * TILE,
      draw: () => fb.sprite(getSprite('td.clerk'), c.col * TILE + ox, c.row * TILE + oy, { frame: Math.floor(frame / 20) % 2 }),
    });
  }
  if (world.pedestalItem && world.room.pedestal) {
    const p = world.room.pedestal;
    layers.push({
      y: p.row * TILE,
      draw: () => {
        const bob = Math.round(Math.sin(frame / 8) * 1.5);
        fb.sprite(getSprite('item.joke'), p.col * TILE + 2 + ox, p.row * TILE + 1 + oy + bob);
        if (frame % 16 < 8) fb.setPixel(p.col * TILE + ox + 13, p.row * TILE + oy + 2 + bob, C.WHITE);
      },
    });
  }
  for (const t of world.toys) {
    layers.push({
      y: t.y,
      draw: () => {
        const winding = t.age > 540 && frame % 6 < 3;
        if (!winding) fb.sprite(getSprite('td.toy'), Math.round(t.x) - 8 + ox, Math.round(t.y) - 8 + oy, { frame: Math.floor(t.age / 6) % 2, flipX: t.dir === 'left' });
      },
    });
  }
  for (const g of world.guards) layers.push({ y: g.y, draw: () => drawGuard(ctx, g) });
  layers.push({ y: world.agent.y, draw: () => drawAgent(ctx, world.agent) });
  layers.sort((a, b) => a.y - b.y);
  for (const l of layers) l.draw();

  // projectiles and puffs sit on top of the characters
  for (const b of world.bullets) {
    if (b.kind === 'shoe') fb.sprite(getSprite('td.shoe'), Math.round(b.x) - 4 + ox, Math.round(b.y) - 4 + oy, { frame: Math.floor(b.age / 4) % 2 });
    else fb.sprite(getSprite('td.bullet'), Math.round(b.x) - 2 + ox, Math.round(b.y) - 2 + oy, { solid: b.kind === 'agent' ? C.WHITE : C.YELLOW });
  }
  for (const p of world.puffs) {
    const prog = 1 - p.t / p.total;
    if (p.kind === 'smoke') fb.sprite(getSprite('fx.puff'), Math.round(p.x) - 8 + ox, Math.round(p.y) - 8 + oy, { frame: Math.min(3, Math.floor(prog * 4)) });
    else fb.sprite(getSprite('fx.spark'), Math.round(p.x) - 4 + ox, Math.round(p.y) - 4 + oy, { frame: Math.min(2, Math.floor(prog * 3)) });
  }
}

function drawGuard(ctx: Ctx, g: Guard): void {
  const { fb, world, frame, ox, oy } = ctx;
  if (g.dead && frame % 4 < 2) return;
  const x = Math.round(g.x) - 8 + ox;
  const y = Math.round(g.y) - 8 + oy;
  const flash = g.hitFlash > 0 && frame % 2 === 0 ? { solid: C.WHITE } : {};
  if (g.kind === 'bot') {
    fb.sprite(getSprite('td.bot'), x, y, { frame: g.moving ? Math.floor(g.anim / 8) % 2 : 0, flipX: g.facing === 'left', ...flash });
  } else if (g.change > 0) {
    fb.sprite(getSprite('td.spy.change'), x, y, flash);
  } else {
    const walk = g.moving ? Math.floor(g.anim / 8) % 2 : 0;
    if (g.facing === 'up') fb.sprite(getSprite('td.spy.up'), x, y, { frame: walk, ...flash });
    else if (g.facing === 'down') fb.sprite(getSprite('td.spy.down'), x, y, { frame: walk, ...flash });
    else fb.sprite(getSprite('td.spy.side'), x, y, { frame: walk, flipX: g.facing === 'left', ...flash });
  }
  if (g.aim > 0) {
    // telegraph: a blinking line of fire and a "!" over his head
    const [dx, dy] = DIR_VEC[g.aimDir];
    let px = g.x;
    let py = g.y;
    for (let i = 0; i < 300; i++) {
      px += dx * 2;
      py += dy * 2;
      if (isSolidKind(tileAt(world.room, Math.floor(px / TILE), Math.floor(py / TILE)))) break;
      if (i > 4 && i % 3 === 0 && Math.floor(frame / 3) % 2 === 0) fb.fillRect(Math.round(px) + ox, Math.round(py) + oy, 2, 2, C.RED);
    }
    drawText(fb, '!', Math.round(g.x) + ox, Math.round(g.y) - 17 + oy, C.RED, { align: 'center', outline: C.WHITE });
  }
  if (g.stun > 0 && !g.dead) {
    // orbiting stars
    for (let i = 0; i < 3; i++) {
      const a = frame / 9 + (i * Math.PI * 2) / 3;
      fb.fillRect(Math.round(g.x + Math.cos(a) * 6) + ox - 1, Math.round(g.y - 10 + Math.sin(a) * 2) + oy, 2, 2, C.YELLOW);
    }
  }
}

function drawAgent(ctx: Ctx, a: Agent): void {
  const { fb, world, frame, ox, oy } = ctx;
  const x = Math.round(a.x) - 8 + ox;
  const y = Math.round(a.y) - 8 + oy;
  const run = world.run;
  if (a.dying > 0) {
    // spin, then blink away
    if (a.dying > 40 && frame % 4 < 2) return;
    const faces = ['down', 'left', 'up', 'right'] as const;
    const f = faces[Math.floor(a.dying / 4) % 4]!;
    if (f === 'down') fb.sprite(getSprite('td.agent.down'), x, y);
    else if (f === 'up') fb.sprite(getSprite('td.agent.up'), x, y);
    else fb.sprite(getSprite('td.agent.side'), x, y, { flipX: f === 'left' });
    return;
  }
  if (a.hurt > 0 && frame % 4 < 2) return; // armour just soaked a hit: blink
  const opts = run.invincible && frame % 4 < 2 ? { solid: run.power.invincible < 90 && frame % 8 < 4 ? C.WHITE : C.YELLOW } : {};
  const walk = a.moving ? Math.floor(a.anim / 4) % 2 : 0;
  if (a.hold) {
    fb.sprite(getSprite('td.agent.hold'), x, y, opts);
    const item = a.hold.kind === 'package' ? 'item.package' : a.hold.kind === 'joke' ? 'item.joke' : `item.${a.hold.power}`;
    fb.sprite(getSprite(item), x + 2, y - 13);
    if (frame % 8 < 4) {
      fb.setPixel(x - 1, y - 12, C.WHITE);
      fb.setPixel(x + 17, y - 6, C.WHITE);
    }
    return;
  }
  if (a.stun > 0) {
    fb.sprite(getSprite('td.agent.stun'), x, y, { frame: Math.floor(frame / 6) % 2, ...opts });
    return;
  }
  if (a.facing === 'up') fb.sprite(getSprite('td.agent.up'), x, y, { frame: walk, ...opts });
  else if (a.facing === 'down') fb.sprite(getSprite('td.agent.down'), x, y, { frame: walk, ...opts });
  else fb.sprite(getSprite('td.agent.side'), x, y, { frame: walk, flipX: a.facing === 'left', ...opts });
}

// ------------------------------------------------------------------ overlays (inside the room clip)
function drawOverlays(ctx: Ctx): void {
  const { fb, world } = ctx;
  drawBubbles(fb, world.bubbles, world.camX, world.camY - ROOM_TOP);
  drawPopups(fb, world.popups, world.camX, world.camY - ROOM_TOP);
  if (world.banner) drawBanner(fb, world.banner, ROOM_TOP + 8);
  const typed = world.typewriter;
  if (typed !== null) drawTypewriter(ctx, typed);
}

/** Zelda-cave style text box: the full line is wrapped once so the words do not jump while it prints. */
function drawTypewriter(ctx: Ctx, typed: string): void {
  const { fb, frame } = ctx;
  const maxW = 196;
  const lines = wrapText(EASTER_EGG.clerk, maxW);
  const w = maxW + 16;
  const h = lines.length * 10 + 12;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = ROOM_TOP + 66;
  fb.fillRect(x, y, w, h, C.BLACK);
  fb.strokeRect(x, y, w, h, C.WHITE);
  fb.strokeRect(x + 2, y + 2, w - 4, h - 4, C.MDGRAY);
  let left = typed.length;
  lines.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, left));
    drawText(fb, shown, x + 8, y + 6 + i * 10, C.WHITE);
    left -= line.length + 1; // the space the wrapper swallowed
  });
  if (typed.length < EASTER_EGG.clerk.length && frame % 12 < 6) {
    const li = Math.min(lines.length - 1, wrapIndex(lines, typed.length));
    const used = typed.length - lines.slice(0, li).reduce((n, l) => n + l.length + 1, 0);
    fb.fillRect(x + 8 + Math.max(0, used) * 6, y + 6 + li * 10 + 6, 5, 1, C.WHITE);
  }
}

function wrapIndex(lines: readonly string[], chars: number): number {
  let left = chars;
  for (let i = 0; i < lines.length; i++) {
    if (left <= lines[i]!.length) return i;
    left -= lines[i]!.length + 1;
  }
  return lines.length - 1;
}

// ------------------------------------------------------------------ bottom strip
function drawStrip(ctx: Ctx): void {
  const { fb, world, frame } = ctx;
  const color = THEME_COLOR[world.room.theme];
  fb.fillRect(0, STRIP_TOP, SCREEN_W, 240 - STRIP_TOP, C.BLACK);
  fb.fillRect(0, STRIP_TOP, SCREEN_W, 1, C.WHITE);
  fb.fillRect(0, STRIP_TOP + 1, SCREEN_W, 1, color);
  const name = world.name;
  const scale = (name.length * 6 - 1) * 2 <= SCREEN_W - 16 ? 2 : 1;
  drawText(fb, name, SCREEN_W / 2, STRIP_TOP + 5, color, { align: 'center', scale, shadow: C.DKBLUE });

  // line 1 (y 213): NOW PLAYING while on the listening booth, SEARCHING... during a search
  // line 2 (y 223): the prompt, or the progress bar
  const py = STRIP_TOP + 21;
  if (world.search) {
    drawText(fb, UI.searching, SCREEN_W / 2, py, C.WHITE, { align: 'center' });
    fb.strokeRect(63, py + 10, 130, 9, C.WHITE);
    drawBar(fb, 65, py + 12, 126, 5, world.searchProgress, C.LIME, C.DKGREEN);
  } else {
    if (world.nowPlaying) drawText(fb, UI.nowPlaying, SCREEN_W / 2, py, frame % 24 < 12 ? C.HOTPINK : C.CYAN, { align: 'center' });
    if (world.canSearch && frame % 40 < 30) drawText(fb, UI.pressToSearch, SCREEN_W / 2, py + (world.nowPlaying ? 11 : 4), C.YELLOW, { align: 'center' });
  }

  // one pip per searchable fixture: filled once it has been searched
  const n = world.room.fixtures.length;
  const pip = 5;
  const gap = 3;
  const total = n * pip + (n - 1) * gap;
  let x = Math.round((SCREEN_W - total) / 2);
  for (let i = 0; i < n; i++) {
    if (world.fixtureOpened(i)) fb.fillRect(x, STRIP_TOP + 42, pip, pip, color);
    else fb.strokeRect(x, STRIP_TOP + 42, pip, pip, C.MDGRAY);
    x += pip + gap;
  }
}
