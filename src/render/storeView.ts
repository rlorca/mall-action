// STORE VIEW: draws the top-down store room (StoreWorld public state) into the playfield y=16..239.
// Layout: room viewport = y 16..191 (VIEW 256x176, honours the camera), bottom info strip = y 192..239.
// Room px -> screen: sx = x - camera.x, sy = y - camera.y + 16. Everything is whole-pixel. Pure drawing, no game rules.
import { C } from '../core/palette';
import { GAMESTONK_EGG } from '../data/copy';
import type { Surface } from '../art/surface';
import { hasSprite } from '../art/registry';
import type { StoreWorld, FixtureState, GuardState, HeldItem, Dir } from '../game/store';
import { drawBubble, type ViewRect } from './bubble';

const HUD_H = 16;
const VIEW_W = 256;
const VIEW_H = 176;
const TILE = 16;
const STRIP_Y = HUD_H + VIEW_H; // 192
const VIEW: ViewRect = { x: 0, y: HUD_H, w: VIEW_W, h: VIEW_H };

const JOKE_SPRITES: Record<string, string> = {
  'EXPIRED COUPON': 'item_coupon',
  'PRE-OWNED STRATEGY GUIDE': 'item_guide',
  'PET ROCK': 'item_rock',
  'MOOD RING': 'item_moodring',
  '1 SHARE (DOWN 99%)': 'item_share',
  'PHOTO STRIP': 'item_photo',
};

/** Sprite name for a held item / pedestal item. */
export function heldSpriteName(h: HeldItem | { kind: 'item'; name: string }): string {
  if (h.kind === 'package') return 'item_package';
  if (h.kind === 'powerup') return `item_${h.name}`;
  const n = JOKE_SPRITES[h.name] ?? 'item_coupon';
  return hasSprite(n) ? n : 'item_coupon';
}

/** Truncate text to at most `maxChars` characters (never draws outside its box). */
export function fitText(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, Math.max(0, maxChars));
}

const sideOrDir = (d: Dir): { name: string; flip: boolean } =>
  d === 'up' ? { name: 'up', flip: false } : d === 'down' ? { name: 'down', flip: false } : { name: 'side', flip: d === 'left' };

export function drawStore(s: Surface, w: StoreWorld, tick: number): void {
  const cam = w.camera;
  const ox = -Math.round(cam.x);
  const oy = -Math.round(cam.y) + HUD_H;
  s.rect(0, HUD_H, 256, 224, C.BLACK);
  s.clip(0, HUD_H, VIEW_W, VIEW_H);
  drawTiles(s, w, ox, oy, tick);
  drawFixtureExtras(s, w, ox, oy, tick);
  drawEgg(s, w, ox, oy, tick);
  drawActors(s, w, ox, oy, tick);
  drawEffects(s, w, ox, oy, tick);
  if (w.room.theme === 'novelty') darken(s, w, ox, oy);
  s.unclip();
  drawBubbles(s, w, ox, oy);
  drawEggBox(s, w, tick);
  drawBoothNote(s, w, tick);
  drawStrip(s, w, tick);
}

// ---------------------------------------------------------------------------------------------- tiles

function drawTiles(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  const theme = w.room.theme;
  const fixAt = new Map<number, FixtureState>();
  for (const f of w.fixtures) fixAt.set(f.ty * w.room.w + f.tx, f);
  const shelfAt = new Map<number, boolean>();
  for (const sh of w.toyShelves) shelfAt.set(sh.ty * w.room.w + sh.tx, sh.released);
  const tx0 = Math.max(0, Math.floor(-ox / TILE));
  const tx1 = Math.min(w.room.w - 1, Math.floor((-ox + VIEW_W - 1) / TILE));
  const ty0 = Math.max(0, Math.floor((HUD_H - oy) / TILE));
  const ty1 = Math.min(w.room.h - 1, Math.floor((HUD_H + VIEW_H - 1 - oy) / TILE));
  const floor = `tile_${theme}_floor`;
  for (let ty = ty0; ty <= ty1; ty++) {
    const row = w.room.rows[ty];
    for (let tx = tx0; tx <= tx1; tx++) {
      const x = tx * TILE + ox;
      const y = ty * TILE + oy;
      const ch = row[tx];
      if (ch === '#') {
        s.sprite(`tile_${theme}_wall`, x, y);
        continue;
      }
      s.sprite(floor, x, y);
      switch (ch) {
        case 'S':
        case 'T': {
          const f = fixAt.get(ty * w.room.w + tx);
          const base = ch === 'S' ? 'fixture' : 'fixture2';
          s.sprite(`tile_${theme}_${base}${f?.open ? '_open' : ''}`, x, y);
          break;
        }
        case 'F': {
          const f = fixAt.get(ty * w.room.w + tx);
          s.sprite(f?.open || f?.revealed ? 'tile_fitting_open' : 'tile_fitting', x, y);
          break;
        }
        case 'C': s.sprite(`tile_${theme}_counter`, x, y); break;
        case 'D': s.sprite(`tile_${theme}_decor`, x, y); break;
        case 'E': s.sprite(`tile_${theme}_decor2`, x, y); break;
        case 'K': s.sprite(shelfAt.get(ty * w.room.w + tx) ? 'tile_toyshelf_empty' : 'tile_toyshelf', x, y); break;
        case 'B': s.sprite('tile_booth', x, y, { frame: w.booth?.active ? (tick >> 3) & 1 : 0 }); break;
        case 'V': s.sprite('tile_demotv', x, y, { frame: (tick >> 2) % 3 }); break;
        case 'P': s.sprite('tile_pedestal', x, y, { frame: w.egg?.itemVisible ? (tick >> 4) & 1 : 0 }); break;
        case 'd': s.sprite('tile_door', x, y); break;
        default: break;
      }
    }
  }
  // door mat just inside the door
  const mx = w.room.doorCol * TILE + ox;
  const my = (w.room.doorRow - 1) * TILE + oy;
  if (my > HUD_H - TILE && my < HUD_H + VIEW_H) s.sprite('tile_door_mat', mx, my);
}

/** Radar '!' markers and the fitting-room spy who jumped out. */
function drawFixtureExtras(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  for (const f of w.fixtures) {
    const x = f.tx * TILE + ox;
    const y = f.ty * TILE + oy;
    if (f.kind === 'fitting' && f.revealed && f.revealT < 40) s.sprite('spy_fitting', x, y, { frame: (tick >> 3) & 1 });
    if (f.mark && ((tick >> 3) & 1) === 0) {
      s.rect(x + 5, y - 9, 6, 10, C.BLACK);
      s.text('!', x + 4, y - 10, C.YELLOW_L, { shadow: C.RED });
    } else if (f.mark) {
      s.text('!', x + 4, y - 10, C.RED_L, { shadow: C.BLACK });
    }
  }
}

// ---------------------------------------------------------------------------------------------- egg

function drawEgg(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  const e = w.egg;
  if (!e) return;
  if (e.clerk.visible) s.sprite('clerk_top', Math.round(e.clerk.x) + ox, Math.round(e.clerk.y) + oy);
  const px = e.pedestal.tx * TILE + ox;
  const py = e.pedestal.ty * TILE + oy;
  if (e.itemVisible && e.item) {
    // pulsing glow behind the item
    const g = (tick >> 3) & 1;
    s.setAlpha(g ? 0.35 : 0.2);
    s.rect(px - 2, py - 6, 20, 22, C.YELLOW_L);
    s.setAlpha(1);
    const bob = ((tick >> 4) & 1) - 1;
    s.sprite(heldSpriteName({ kind: 'item', name: e.item }), px, py - 6 + bob);
  }
}

function drawEggBox(s: Surface, w: StoreWorld, tick: number): void {
  const e = w.egg;
  if (!e || e.phase !== 'talk') return;
  const bx = 8;
  const bw = 240;
  const bh = 36;
  const by = HUD_H + VIEW_H - bh - 8;
  s.rect(bx, by, bw, bh, C.WHITE);
  s.rect(bx + 1, by + 1, bw - 2, bh - 2, C.BLACK);
  s.frame(bx + 3, by + 3, bw - 6, bh - 6, C.WHITE);
  const lines = e.lines.length ? e.lines : [''];
  lines.slice(0, 2).forEach((ln, i) => s.text(fitText(ln, 28), bx + 12, by + 8 + i * 12, C.WHITE));
  const last = Math.min(1, lines.length - 1);
  const full = GAMESTONK_EGG.clerk[last] ?? '';
  if (lines[last].length < full.length || ((tick >> 4) & 1) === 0) {
    s.rect(bx + 12 + Math.min(28, lines[last].length) * 8, by + 8 + last * 12, 6, 8, C.WHITE);
  }
}

function drawBoothNote(s: Surface, w: StoreWorld, tick: number): void {
  const np = w.booth?.nowPlaying;
  if (!np) return;
  const t = fitText(np, 26);
  const bw = t.length * 8 + 22;
  const bx = Math.round((256 - bw) / 2);
  const by = HUD_H + 3;
  s.rect(bx, by, bw, 13, C.BLACK);
  s.frame(bx, by, bw, 13, C.MAGENTA_L);
  s.sprite('speaker_note', bx + 3, by + 2, { frame: (tick >> 4) & 1 });
  s.text(t, bx + 14, by + 3, C.PINK_L);
}

// ---------------------------------------------------------------------------------------------- actors

function drawGuard(s: Surface, g: GuardState, ox: number, oy: number, tick: number): void {
  if (g.anim === 'gone') return;
  const x = Math.round(g.x) + ox;
  const y = Math.round(g.y) + oy;
  const flashing = g.hurtT > 0 && ((tick >> 1) & 1) === 0;
  const remap = flashing ? [C.WHITE, C.WHITE, C.GRAY_L] : undefined;
  if (g.type === 'bot') {
    if (g.anim === 'dead') {
      if (((tick >> 2) & 1) === 0) s.sprite('bot_top_hit', x, y);
      return;
    }
    if (g.hurtT > 0) s.sprite('bot_top_hit', x, y);
    else s.sprite('bot_top', x, y, { frame: g.anim === 'walk' ? (g.animT >> 3) & 1 : 0, remap });
    if (g.anim === 'stun') stars(s, x + 4, y - 6, tick);
    // damage pips
    if (g.hp < g.maxHp) for (let i = 0; i < g.maxHp; i++) s.rect(x + 3 + i * 4, y - 3, 3, 2, i < g.hp ? C.GREEN_L : C.RED);
    return;
  }
  if (g.anim === 'dead') {
    s.sprite('spytop_die', x, y, { frame: Math.min(1, g.animT >> 4) });
    return;
  }
  const dir = g.anim === 'aim' || g.anim === 'throw' ? g.aimDir : g.facing;
  const d = sideOrDir(dir);
  if (g.anim === 'aim' || g.anim === 'throw') {
    s.sprite(`spytop_aim_${d.name === 'up' ? 'up' : d.name === 'down' ? 'down' : 'side'}`, x, y, { flipX: d.flip, remap });
    if (g.anim === 'aim' && ((tick >> 2) & 1) === 0) s.rect(x + 6, y - 5, 4, 3, C.RED); // telegraph blink
  } else {
    s.sprite(`spytop_${d.name}`, x, y, { frame: g.anim === 'walk' ? (g.animT >> 3) & 1 : 0, flipX: d.flip, remap });
  }
  if (g.anim === 'stun') stars(s, x + 4, y - 6, tick);
}

function stars(s: Surface, x: number, y: number, tick: number): void {
  s.sprite('star_pop', x - 5, y, { frame: (tick >> 3) % 3 });
  s.sprite('star_pop', x + 5, y + 1, { frame: ((tick >> 3) + 1) % 3 });
}

function drawActors(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  // toys under everyone
  for (const t of w.toys) {
    const flip = t.dir === 'left';
    s.sprite('windup_toy', Math.round(t.x) + 4 + ox, Math.round(t.y) + 4 + oy, { frame: (t.animT >> 3) & 1, flipX: flip });
  }
  // y-sorted guards + player
  const list: { y: number; draw: () => void }[] = [];
  for (const g of w.guards) list.push({ y: g.y + (g.anim === 'dead' ? -100 : 0), draw: () => drawGuard(s, g, ox, oy, tick) });
  list.push({ y: w.player.y, draw: () => drawPlayer(s, w, ox, oy, tick) });
  list.sort((a, b) => a.y - b.y);
  for (const l of list) l.draw();
  // bullets on top
  for (const b of w.bullets) {
    const x = Math.round(b.x) + ox;
    const y = Math.round(b.y) + oy;
    if (b.from === 'shoe') s.sprite('shoe', x - 4, y - 4);
    else s.sprite('bullet_top', x - 2, y - 2, { frame: b.from === 'player' ? 0 : 1 });
  }
}

function drawPlayer(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  const p = w.player;
  if (p.anim === 'hidden' || p.blink) return;
  const x = Math.round(p.x) + ox;
  const y = Math.round(p.y) + oy;
  const inv = w.progress.power.invincible;
  const remap = inv && ((tick >> 2) & 1) === 0 ? [C.YELLOW_L, C.ORANGE, C.WHITE] : undefined;
  const d = sideOrDir(p.facing);
  switch (p.anim) {
    case 'hold':
      s.sprite('agent_top_hold', x, y, { remap });
      if (p.held) {
        const bob = (p.heldT >> 3) & 1;
        s.sprite(heldSpriteName(p.held), x, y - 15 - bob);
      }
      break;
    case 'search':
      s.sprite('agent_top_search', x, y, { frame: (p.animT >> 3) & 1, flipX: d.flip, remap });
      if (w.search) {
        const bw = 16;
        const by = y - 5;
        s.rect(x - 1, by - 1, bw + 2, 5, C.BLACK);
        s.rect(x, by, Math.round(bw * Math.min(1, w.search.progress)), 3, C.YELLOW_L);
      }
      break;
    case 'stun':
      s.sprite('agent_top_stun', x, y, { remap });
      stars(s, x + 8, y - 6, tick);
      break;
    case 'die':
      s.sprite('agent_top_die', x, y, { frame: Math.min(1, p.animT >> 4) });
      break;
    default:
      s.sprite(`agent_top_${d.name}`, x, y, { frame: p.anim === 'walk' ? (p.animT >> 3) & 1 : 0, flipX: d.flip, remap });
  }
}

function drawBubbles(s: Surface, w: StoreWorld, ox: number, oy: number): void {
  const drawn: ViewRect[] = [];
  for (const b of w.bubbles) {
    const g = w.guards[b.guard];
    if (!g || g.anim === 'gone') continue;
    const text = fitText(b.text, 28);
    const cx = Math.round(g.x) + 8 + ox;
    let by = Math.round(g.y) + 1 + oy;
    // stack above earlier bubbles instead of overlapping them (bubble box is 12 px + 4 px tail)
    const bw = text.length * 8 + 6;
    const bx = Math.max(1, Math.min(VIEW_W - bw - 1, Math.round(cx - bw / 2)));
    for (let i = 0; i < 4; i++) {
      const top = by - 16;
      const hit = drawn.find((r) => bx < r.x + r.w && bx + bw > r.x && top < r.y + r.h && top + 16 > r.y);
      if (!hit) break;
      by = hit.y - 1 + 0;
    }
    drawn.push(drawBubble(s, text, cx, by, VIEW));
  }
}

// ---------------------------------------------------------------------------------------------- effects

function drawEffects(s: Surface, w: StoreWorld, ox: number, oy: number, tick: number): void {
  for (const q of w.particles) {
    const x = Math.round(q.x) + ox;
    const y = Math.round(q.y) + oy;
    if (q.kind === 'star') s.sprite('star_pop', x - 4, y - 4, { frame: (q.t >> 2) % 3 });
    else s.sprite('spark_hit', x - 4, y - 4, { frame: (q.t >> 2) & 1 });
  }
  for (const pf of w.puffs) {
    const f = Math.min(3, Math.floor((pf.t / pf.ttl) * 4));
    s.sprite('puff', Math.round(pf.x) - 8 + ox, Math.round(pf.y) - 8 + oy, { frame: f, alpha: pf.kind === 'poof' ? 1 : undefined });
  }
  // damage: red vignette while dying
  if (w.player.anim === 'die') {
    s.setAlpha(0.25 + 0.15 * ((tick >> 2) & 1));
    s.rect(0, HUD_H, VIEW_W, VIEW_H, C.RED_D);
    s.setAlpha(1);
  }
}

/** Black-light novelty theme: stepped darkness with a lit circle around the player. */
function darken(s: Surface, w: StoreWorld, ox: number, oy: number): void {
  const cx = Math.round(w.player.x) + 8 + ox;
  const cy = Math.round(w.player.y) + 8 + oy;
  const radii = [56, 88, 120]; // lit, then three darkening rings
  const alphas = [0.2, 0.4, 0.55, 0.68]; // ring 1, ring 2, ring 3, outside
  for (let y = HUD_H; y < HUD_H + VIEW_H; y++) {
    const dy = Math.abs(y - cy);
    const half = radii.map((r) => (dy >= r ? 0 : Math.floor(Math.sqrt(r * r - dy * dy))));
    // edges from the centre outwards: lit | ring1 | ring2 | ring3 | outside
    const edges = [half[0], half[1], half[2], VIEW_W];
    let inner = half[0];
    for (let i = 0; i < 4; i++) {
      const outerEdge = i < 3 ? edges[i + 1] : VIEW_W * 2;
      drawSpan(s, Math.max(0, cx - outerEdge), Math.max(0, cx - inner), y, alphas[i]);
      drawSpan(s, Math.min(VIEW_W, cx + inner), Math.min(VIEW_W, cx + outerEdge), y, alphas[i]);
      inner = outerEdge;
    }
  }
  s.setAlpha(1);
}
function drawSpan(s: Surface, x0: number, x1: number, y: number, a: number): void {
  if (x1 <= x0 || a <= 0) return;
  s.setAlpha(a);
  s.rect(x0, y, x1 - x0, 1, C.BLACK);
}

// ---------------------------------------------------------------------------------------------- bottom strip

function drawStrip(s: Surface, w: StoreWorld, tick: number): void {
  const st = w.strip;
  s.rect(0, STRIP_Y, 256, 240 - STRIP_Y, C.BLACK);
  const px = 4;
  const py = STRIP_Y + 4;
  const pw = 248;
  const ph = 240 - STRIP_Y - 8; // 40
  s.rect(px, py, pw, ph, C.WHITE);
  s.rect(px + 1, py + 1, pw - 2, ph - 2, C.BLACK);
  s.frame(px + 3, py + 3, pw - 6, ph - 6, C.GRAY_M);
  s.text(fitText(st.title, 28), 128, py + 6, C.YELLOW_L, { align: 'center', shadow: C.BROWN });
  const barW = 200;
  const barX = Math.round((256 - barW) / 2);
  const barY = py + 27;
  if (st.mode === 'searching') {
    s.text(fitText(st.text, 28), 128, py + 16, C.CYAN_L, { align: 'center' });
    s.rect(barX, barY, barW, 6, C.GRAY_M);
    s.rect(barX + 1, barY + 1, barW - 2, 4, C.BLACK);
    const fill = Math.round((barW - 2) * Math.max(0, Math.min(1, st.bar ?? 0)));
    s.rect(barX + 1, barY + 1, fill, 4, C.GREEN_L);
  } else if (st.mode === 'ready') {
    s.text(fitText(st.text, 28), 128, py + 16, ((tick >> 4) & 1) ? C.WHITE : C.YELLOW_L, { align: 'center' });
    s.rect(barX, barY, barW, 6, C.GRAY_DD);
    s.rect(barX + 1, barY + 1, barW - 2, 4, C.BLACK);
  } else {
    const info = w.cleared ? 'PACKAGE SECURED' : w.def.role === 'powerup' ? 'POWER-UP SHOP' : 'FIND THE PACKAGE';
    s.text(fitText(info, 28), 128, py + 16, C.GRAY_M, { align: 'center' });
    s.rect(barX, barY, barW, 6, C.GRAY_DD);
    s.rect(barX + 1, barY + 1, barW - 2, 4, C.BLACK);
  }
}
