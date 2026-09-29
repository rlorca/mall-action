/** Small helpers shared by the rule modules: events, banners, scoring. */
import type { SfxId, SongId } from '../audio/ids';
import { C } from '../core/palette';
import type { GameState, Popup } from './state';
import { BANNERS } from './copy';

export const EXTRA_LIFE_AT = 20000;

export const POINTS = {
  spyShot: 100,
  spySpecial: 300,
  package: 500,
  powerup: 50,
  levelClear: 1000,
  timePerSecond: 10,
  timeLimit: 300,
  coin: 50,
  walker: -200,
  copCatch: -500,
  joke: 1,
} as const;

export function sfx(g: GameState, id: SfxId): void {
  g.events.push({ t: 'sfx', id });
}

export function jingle(g: GameState, id: SongId): void {
  g.events.push({ t: 'jingle', id });
}

export function banner(g: GameState, lines: string | string[], frames = 120, color: number = C.WHITE, big = false): void {
  const l = Array.isArray(lines) ? lines : [lines];
  g.banner = { lines: l, t: frames, total: frames, color, big };
}

export function newId(g: GameState): number {
  return ++g.nextId;
}

/** Add points (may be negative; the score never drops below 0). Grants the one extra life at 20,000. */
export function addScore(g: GameState, pts: number): void {
  g.score = Math.max(0, g.score + pts);
  if (!g.extraLifeGiven && g.score >= EXTRA_LIFE_AT) {
    g.extraLifeGiven = true;
    g.lives++;
    sfx(g, 'powerup');
    banner(g, BANNERS.extraLife, 90, C.LGREEN, true);
  }
  if (g.score > g.hiScore) g.hiScore = g.score;
}

export function popup(list: Popup[], text: string, x: number, y: number, t = 50): void {
  list.push({ text, x, y, t });
}

export function tickPopups(list: Popup[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].y -= 0.5;
    if (--list[i].t <= 0) list.splice(i, 1);
  }
}

export function timeBonus(frames: number): number {
  const secs = Math.floor(frames / 60);
  return Math.max(0, POINTS.timeLimit - secs) * POINTS.timePerSecond;
}

export function rectsOverlap(ax0: number, ay0: number, ax1: number, ay1: number, bx0: number, by0: number, bx1: number, by1: number): boolean {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}
