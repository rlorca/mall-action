// HUD: the 16 px status strip (y 0..15). Pure drawing of a HudModel; no game rules.
//
// LAYOUT (x px, 256 wide; row1 text y=1, row2 text y=8; bottom border line y=15):
//   x   2..49   row1 SCORE (6 digits, 8px font)          row2 "PKG n/6" (x 2..57; red until 6, green after)
//   x  62..89   row1 head icon + "xN" lives               row2 armour icon (62) + radar icon (72) when owned
//   x  82..105  row2 blinking boxed "ALARM" (small font; the HUD bottom border also flashes red)  [only when alarm]
//   x 108..185  timed power-ups, active slots stacked (weapon, speed, invincible): 1-2 slots use rows y=2/9, 3 slots y=0/5/10; 5px small font,
//               name (POWERUP_NAMES) + draining bar filling the rest of the width (min 8 px)
//   x 188..253  LED floor panel: dark box; big amber current floor label (ghost "88" behind, LED look) and six mini
//               floor lights R 4 3 2 1 P (current one lit). When `marquee` != null the box shows the store name
//               scrolling right-to-left (deterministic from tick) instead.
import { C } from '../core/palette';
import { POWERUP_NAMES } from '../data/copy';
import type { Surface } from '../art/surface';
import type { Progress, TimedSlot } from '../game/progress';

export interface HudModel {
  progress: Progress;
  /** 'R','4F','3F','2F','1F','P' */
  floorLabel: string;
  /** Store name when inside a store (scrolls in the LED panel), else null. */
  marquee: string | null;
  alarm: boolean;
  tick: number;
}

export const HUD_LAYOUT = {
  panelX: 188,
  panelY: 1,
  panelW: 66,
  panelH: 13,
  powerX: 108,
  powerRight: 185,
} as const;

const FLOORS = ['R', '4', '3', '2', '1', 'P'];

export function drawHud(s: Surface, h: HudModel): void {
  const p = h.progress;
  s.rect(0, 0, 256, 16, C.BLACK);
  const alarmFlash = h.alarm && ((h.tick >> 4) & 1) === 0;
  s.hline(0, 15, 256, alarmFlash ? C.RED : C.GRAY_D);

  // score
  s.text(String(Math.max(0, Math.min(999999, Math.floor(p.score)))).padStart(6, '0'), 2, 1, C.WHITE);
  // packages
  const got = p.packages.length;
  const all = got >= 6;
  s.text(`PKG ${Math.min(got, 6)}/6`, 2, 8, all ? C.GREEN_L : C.RED_L);
  // lives
  s.sprite('icon_head', 62, 0);
  s.text(`x${Math.max(0, Math.min(9, p.lives))}`, 72, 1, C.WHITE);
  // armour / radar
  if (p.power.armor) s.sprite('icon_armor', 62, 7);
  if (p.power.radar) s.sprite('icon_radar', 72, 7);
  // alarm
  if (h.alarm && ((h.tick >> 3) & 1) === 0) {
    s.rect(82, 8, 24, 7, C.RED);
    s.text('ALARM', 84, 9, C.WHITE, { small: true });
  }
  const slots: [TimedSlot | null, number][] = [
    [p.power.weapon, C.ORANGE],
    [p.power.speed, C.CYAN],
    [p.power.invincible, C.YELLOW_L],
  ];
  const active = slots.filter(([sl]) => sl);
  // 1-2 active: two roomy rows (y 2 / 9); 3 active: three tight rows (y 0 / 5 / 10)
  const ys = active.length >= 3 ? [0, 5, 10] : [2, 9];
  active.forEach(([sl, col], i) => drawPower(s, sl, ys[i], col, h.tick));
  drawLed(s, h);
}

function drawPower(s: Surface, slot: TimedSlot | null, y: number, color: number, tick: number): void {
  if (!slot) return;
  const name = POWERUP_NAMES[slot.kind] ?? slot.kind.toUpperCase();
  const x = HUD_LAYOUT.powerX;
  const tw = name.length * 4;
  s.text(name, x, y, C.WHITE, { small: true });
  const bx = x + tw + 2;
  const bw = Math.max(0, HUD_LAYOUT.powerRight - bx + 1);
  if (bw < 4) return;
  const frac = Math.max(0, Math.min(1, slot.total > 0 ? slot.frames / slot.total : 0));
  const low = slot.frames < 120 && ((tick >> 3) & 1) === 0;
  s.rect(bx, y + 1, bw, 3, C.GRAY_DD);
  s.rect(bx, y + 1, Math.max(1, Math.round(bw * frac)), 3, low ? C.RED_L : color);
}

function drawLed(s: Surface, h: HudModel): void {
  const { panelX: x, panelY: y, panelW: w, panelH: ht } = HUD_LAYOUT;
  s.rect(x, y, w, ht, C.BROWN);
  s.rect(x + 1, y + 1, w - 2, ht - 2, C.BLACK);
  const inner = { x: x + 2, y: y + 2, w: w - 4, h: ht - 4 };
  if (h.marquee !== null && h.marquee !== '') {
    const text = h.marquee;
    const tw = text.length * 8;
    const span = tw + inner.w;
    const off = Math.floor(h.tick / 2) % span;
    s.clip(inner.x, inner.y, inner.w, inner.h);
    s.text(text, inner.x + inner.w - off, y + 3, C.ORANGE);
    s.unclip();
    return;
  }
  const label = h.floorLabel.slice(0, 2);
  // ghost segments
  const lx = x + 4;
  s.text('88', lx, y + 3, C.RED_D);
  s.text(label, lx, y + 3, C.YELLOW_L, { shadow: undefined });
  // mini floor lights
  const cur = label[0];
  let mx = x + 27;
  for (const f of FLOORS) {
    const lit = f === cur;
    if (lit) s.rect(mx - 1, y + 3, 5, 7, C.RED);
    s.text(f, mx, y + 4, lit ? C.YELLOW_L : C.RED_D, { small: true });
    mx += 6;
  }
}
