import { Gfx } from './gfx';
import { RunState } from '../core/run';
import { hudSlot } from '../core/powerups';
import { FLOOR_NAMES, POWERUP_HUD_NAMES, UI } from '../core/copy';

export interface HudCtx {
  frame: number;
  /** In the mall: the floor index to show. */
  floor?: number;
  /** Direction arrow while riding (-1 up, 1 down). */
  arrow?: -1 | 0 | 1;
  /** In a store: the name that scrolls like a marquee. */
  marquee?: string;
  alarm: boolean;
}

/** The 16 px status strip across the top. */
export function drawHud(g: Gfx, run: RunState, h: HudCtx): void {
  g.rect(0, 0, 256, 16, 0x0f);
  g.rect(0, 15, 256, 1, 0x2d);
  // score (6 digits)
  const score = String(Math.min(999999, run.score.score)).padStart(6, '0');
  g.text(score, 4, 4, 0x30);
  // packages: red until all 6 found, then green
  const pk = run.packages.length;
  g.text(`${UI.pkgHud} ${pk}/6`, 46, 4, pk >= 6 ? 0x2a : 0x26);
  // lives
  g.sprite('hud.head', 0, 90, 4);
  g.text(`x${Math.min(9, run.score.lives)}`, 100, 4, 0x30);
  // active timed power-up with a draining bar
  const slot = hudSlot(run.powers);
  if (slot) {
    const name = POWERUP_HUD_NAMES[slot.kind];
    g.text(name, 116, 2, slot.kind === 'cinnabomb' && (h.frame >> 2) % 2 ? 0x28 : 0x30, { font: 3 });
    const frac = Math.max(0, slot.frames / slot.total);
    g.rect(116, 9, 46, 3, 0x2d);
    g.rect(116, 9, Math.ceil(46 * frac), 3, frac < 0.25 ? 0x16 : 0x2a);
  }
  if (run.powers.armor) g.sprite('hud.armor', 0, 166, 4);
  if (run.powers.radar) g.sprite('hud.radar', 0, 176, 4);
  // alarm
  if (h.alarm && (h.frame >> 3) % 2 === 0) g.text(UI.alarmHud, 184, 4, 0x16);
  drawLedPanel(g, h);
}

/** Elevator-style LED floor panel: R / 4F ... P, or a scrolling store name. */
function drawLedPanel(g: Gfx, h: HudCtx): void {
  const x = 214;
  const w = 36;
  g.rect(x, 2, w, 12, 0x00);
  g.box(x, 2, w, 12, 0x10);
  g.rect(x + 1, 3, w - 2, 10, 0x0f);
  g.clip(x + 2, 3, w - 4, 10);
  if (h.marquee) {
    const text = h.marquee + '   ';
    const tw = g.measure(text, { font: 3 });
    const off = Math.floor(h.frame / 3) % tw;
    g.text(text + text, x + 3 - off, 6, 0x27, { font: 3 });
  } else if (h.floor !== undefined) {
    const name = FLOOR_NAMES[h.floor];
    const on = (h.frame >> 4) % 2 === 0 || !h.arrow;
    g.text(name, x + 13, 4, 0x27, { align: 'center' });
    if (h.arrow && on) {
      const ax = x + 25;
      if (h.arrow < 0) {
        g.px(ax + 2, 5, 0x27);
        g.rect(ax + 1, 6, 3, 1, 0x27);
        g.rect(ax, 7, 5, 1, 0x27);
      } else {
        g.rect(ax, 5, 5, 1, 0x27);
        g.rect(ax + 1, 6, 3, 1, 0x27);
        g.px(ax + 2, 7, 0x27);
      }
    }
    // the rest of the shaft's floors as dim LEDs
    for (let i = 0; i < 6; i++) g.px(x + 5 + i * 3, 11, i === h.floor ? 0x27 : 0x17);
  }
  g.unclip();
}
