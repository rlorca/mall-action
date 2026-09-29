import { SCREEN_H, SCREEN_W } from '../core/constants';
import { ALL_DISPLAY_KINDS, displayFrames } from './displays';
import { TINY, drawText, drawTextCentered } from './font';
import { C } from './palette';
import type { Framebuffer, Sprite } from './pixels';
import { SPRITES } from './sprites';
import { ALL_THEMES, SPECIAL_TILES, themeTiles } from './tiles';

/**
 * `?gallery=1`: every sprite in the game, animated, on scrolling pages.
 * Handy for spotting a broken sprite without hunting for it in play.
 */

interface Entry {
  name: string;
  frames: Sprite[];
}

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  for (const [name, s] of Object.entries(SPRITES)) {
    out.push({ name, frames: [s] });
  }
  for (const kind of ALL_DISPLAY_KINDS) {
    out.push({ name: kind, frames: displayFrames(kind) });
  }
  for (const theme of ALL_THEMES) {
    const t = themeTiles(theme);
    out.push({ name: `${theme}.floor`, frames: [t.floor] });
    out.push({ name: `${theme}.wall`, frames: [t.wall] });
    out.push({ name: `${theme}.fix`, frames: [t.fixture] });
    out.push({ name: `${theme}.open`, frames: [t.fixtureOpen] });
    out.push({ name: `${theme}.cnt`, frames: [t.counter] });
    out.push({ name: `${theme}.dec`, frames: [t.decor] });
  }
  for (const [name, s] of Object.entries(SPECIAL_TILES)) {
    out.push({ name: `tile.${name}`, frames: [s] });
  }
  return out;
}

const ENTRIES = buildEntries();
const CELL_W = 41;
const CELL_H = 50;
const COLS = 6;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;

export function galleryPages(): number {
  return Math.ceil(ENTRIES.length / PER_PAGE);
}

export function drawGallery(fb: Framebuffer, clock: number, page: number): void {
  fb.clearClip();
  fb.clear(C.DARKBLUE);
  const pages = galleryPages();
  const p = ((page % pages) + pages) % pages;

  drawTextCentered(fb, TINY, `SPRITE GALLERY  ${p + 1}/${pages}`, SCREEN_W / 2, 4, C.PALEYELLOW);
  drawTextCentered(fb, TINY, 'LEFT/RIGHT TO PAGE', SCREEN_W / 2, SCREEN_H - 8, C.GREY);

  for (let i = 0; i < PER_PAGE; i++) {
    const e = ENTRIES[p * PER_PAGE + i];
    if (!e) break;
    const cx = 5 + (i % COLS) * CELL_W;
    const cy = 16 + Math.floor(i / COLS) * CELL_H;
    // A mid-grey cell, not black: several sprites are mostly black and would
    // be invisible on a black backdrop.
    fb.rect(cx, cy, CELL_W - 3, CELL_H - 4, C.GREY);
    fb.frame(cx, cy, CELL_W - 3, CELL_H - 4, C.LIGHTGREY);
    const s = e.frames[Math.floor(clock / 16) % e.frames.length];
    // Centre the sprite in the cell, clipped if it is bigger than one.
    const ox = cx + Math.round((CELL_W - 3 - Math.min(s.w, CELL_W - 5)) / 2);
    const oy = cy + 2 + Math.round((CELL_H - 14 - Math.min(s.h, CELL_H - 16)) / 2);
    fb.blit(s, ox, oy);
    fb.rect(cx + 1, cy + CELL_H - 17, CELL_W - 5, 12, C.BLACK);
    drawText(fb, TINY, e.name.slice(0, 9), cx + 2, cy + CELL_H - 11, C.WHITE);
    drawText(fb, TINY, `${s.w}X${s.h}`, cx + 2, cy + CELL_H - 17, C.PALECYAN);
  }
}
