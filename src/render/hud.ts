import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_TINY, textWidth } from '../engine/font';
import type { HudData } from '../game/hud';
import { FLOOR_NAMES, NUM_FLOORS } from '../content/layout';
import { PACKAGES_TOTAL } from '../content/stores';
import { UI } from '../content/copy';
import { blinkOn, drawSpriteByName, pad6, W } from './screenFx';

/**
 * The 16 px status strip. Two text rows plus the LED floor panel on the right:
 *
 *   row A (y 1..9)   SCORE | PKG n/6 | head xN | armour | radar | ALARM          | LED PANEL
 *   row B (y 10..14) POWER-UP NAME  [draining bar]                               | (R 4F 3F 2F 1F P)
 *
 * `hudLayout` returns the rectangle of every element that is present, so the test can prove that nothing
 * overlaps and nothing leaves y 0..15, even in the worst case (everything on at once).
 */
export const HUD_H = 16;

export interface HudRect {
  id: 'score' | 'pkg' | 'lives' | 'armor' | 'radar' | 'alarm' | 'timedName' | 'timedBar' | 'panel';
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_NAME = 16;
const PANEL = { x: 189, y: 2, w: 65, h: 12 } as const;
const CELL_W = 9;

const pkgText = (hud: HudData): string => `PKG ${Math.max(0, Math.min(PACKAGES_TOTAL, hud.packages))}/${PACKAGES_TOTAL}`;
const livesText = (hud: HudData): string => `x${Math.max(0, Math.min(99, hud.lives))}`;
const nameText = (hud: HudData): string => (hud.timed ? hud.timed.name.toUpperCase().slice(0, MAX_NAME) : '');

export function hudLayout(hud: HudData): HudRect[] {
  const out: HudRect[] = [];
  out.push({ id: 'score', x: 2, y: 2, w: textWidth('000000'), h: 7 });
  out.push({ id: 'pkg', x: 42, y: 2, w: textWidth(pkgText(hud)), h: 7 });
  out.push({ id: 'lives', x: 88, y: 1, w: 10 + textWidth(livesText(hud)), h: 8 });
  if (hud.armor) out.push({ id: 'armor', x: 120, y: 1, w: 8, h: 8 });
  if (hud.radar) out.push({ id: 'radar', x: 130, y: 1, w: 8, h: 8 });
  if (hud.alarm) out.push({ id: 'alarm', x: 142, y: 1, w: textWidth(UI.alarmHud) + 4, h: 9 });
  if (hud.timed) {
    const nw = textWidth(nameText(hud), { font: FONT_TINY });
    out.push({ id: 'timedName', x: 2, y: 10, w: nw, h: 5 });
    out.push({ id: 'timedBar', x: 2 + nw + 4, y: 10, w: 44, h: 4 });
  }
  out.push({ id: 'panel', ...PANEL });
  return out;
}

function rectOf(rects: HudRect[], id: HudRect['id']): HudRect | undefined {
  return rects.find((r) => r.id === id);
}

function barColor(frac: number, frame: number): number {
  if (frac > 0.5) return C.GREEN;
  if (frac > 0.25) return C.YELLOW;
  return blinkOn(frame, 12, 8) ? C.RED : C.SALMON;
}

function drawPanel(fb: Framebuffer, hud: HudData): void {
  const { x, y, w, h } = PANEL;
  fb.fillRect(x, y, w, h, C.BLACK);
  fb.strokeRect(x, y, w, h, C.MDGRAY);
  if (hud.floor !== null) {
    const cellsW = NUM_FLOORS * CELL_W + (NUM_FLOORS - 1);
    const x0 = x + Math.floor((w - cellsW) / 2);
    for (let i = 0; i < NUM_FLOORS; i++) {
      const cx = x0 + i * (CELL_W + 1);
      const name = FLOOR_NAMES[i]!;
      const lit = i === hud.floor;
      if (lit) fb.fillRect(cx, y + 2, CELL_W, h - 4, C.RED);
      const tw = textWidth(name, { font: FONT_TINY });
      drawText(fb, name, cx + Math.floor((CELL_W - tw) / 2), y + 4, lit ? C.PALEYELLOW : C.BROWNRED, { font: FONT_TINY });
    }
    return;
  }
  if (hud.marquee !== null) {
    // Store name scrolling right-to-left like an LED marquee.
    const text = hud.marquee.toUpperCase();
    const tw = textWidth(text);
    const gap = 28;
    const period = tw + gap;
    const off = Math.floor(hud.frame / 2) % period;
    fb.pushClip(x + 1, y + 1, w - 2, h - 2);
    for (let k = -1; k <= 1; k++) drawText(fb, text, x + w - 1 - off + k * period, y + 2, C.ORANGE);
    fb.popClip();
  }
}

/** Draw one or all HUD elements (the optional filter exists so tests can check each element's bounds). */
export function drawHudElements(fb: Framebuffer, hud: HudData, only?: HudRect['id']): void {
  const rects = hudLayout(hud);
  const want = (id: HudRect['id']): HudRect | undefined => {
    const r = rectOf(rects, id);
    return r && (!only || only === id) ? r : undefined;
  };

  const score = want('score');
  if (score) drawText(fb, pad6(hud.score), score.x, score.y, C.WHITE);

  const pkg = want('pkg');
  if (pkg) drawText(fb, pkgText(hud), pkg.x, pkg.y, hud.packages >= PACKAGES_TOTAL ? C.GREEN : C.RED);

  const lives = want('lives');
  if (lives) {
    drawSpriteByName(fb, 'hud.head', lives.x, lives.y, {}, { w: 8, h: 8 });
    drawText(fb, livesText(hud), lives.x + 10, lives.y + 1, C.WHITE);
  }

  const armor = want('armor');
  if (armor) drawSpriteByName(fb, 'hud.armor', armor.x, armor.y, {}, { w: 8, h: 8 });
  const radar = want('radar');
  if (radar) drawSpriteByName(fb, 'hud.radar', radar.x, radar.y, {}, { w: 8, h: 8 });

  const alarm = want('alarm');
  if (alarm && blinkOn(hud.frame, 16, 10)) {
    fb.fillRect(alarm.x, alarm.y, alarm.w, alarm.h, C.RED);
    drawText(fb, UI.alarmHud, alarm.x + 2, alarm.y + 1, C.WHITE);
  }

  const tn = want('timedName');
  if (tn && hud.timed) drawText(fb, nameText(hud), tn.x, tn.y, C.WHITE, { font: FONT_TINY });
  const tb = want('timedBar');
  if (tb && hud.timed) {
    const frac = Math.max(0, Math.min(1, hud.timed.frac));
    fb.fillRect(tb.x, tb.y, tb.w, tb.h, C.MDGRAY);
    fb.fillRect(tb.x + 1, tb.y + 1, tb.w - 2, tb.h - 2, C.BLACK);
    const n = Math.round((tb.w - 2) * frac);
    if (n > 0) fb.fillRect(tb.x + 1, tb.y + 1, n, tb.h - 2, barColor(frac, hud.frame));
  }

  if (want('panel')) drawPanel(fb, hud);
}

/** Draw the whole HUD strip into rows 0..15. Nothing below y = 16 is touched. */
export function drawHud(fb: Framebuffer, hud: HudData): void {
  fb.fillRect(0, 0, W, HUD_H, C.BLACK);
  fb.hLine(0, HUD_H - 1, W, C.DKBLUE);
  drawHudElements(fb, hud);
}
