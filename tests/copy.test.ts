import { describe, expect, it } from 'vitest';
import * as copy from '../src/data/copy';

const ALLOWED = /^[A-Z0-9 .,!?:;'"\-+*\/%#$&()<>=_♥]+$/;
const L = copy.LIMITS;

function check(lines: string[], limit: number, what: string): void {
  for (const l of lines) {
    expect(l.length, `${what}: "${l}" is ${l.length} > ${limit}`).toBeLessThanOrEqual(limit);
  }
}

describe('copy fits the screen', () => {
  it('speech bubbles', () => {
    const lines: string[] = [];
    for (const v of Object.values(copy.FIRST_VISIT)) for (const x of v) lines.push(x.text);
    lines.push(...copy.SPY_LAST_WORDS, ...copy.SPY_ELEVATOR_LINES);
    const m = copy.MISC;
    lines.push(m.copen, m.copWhistle, m.walkerHey, m.fitting, m.trap);
    check(lines, L.bubble, 'bubble');
  });
  it('spygram captions: exactly 2 lines <= 21, comments <= 21', () => {
    for (const s of [...copy.SPYGRAM_ARRIVAL, ...copy.SPYGRAM_COMPLETE]) {
      expect(s.caption).toHaveLength(2);
      check([...s.caption], L.caption, 'caption');
      check([s.comment], L.comment, 'comment');
    }
  });
  it('headlines <= 26', () => {
    for (const h of copy.HEADLINES) check([...h], L.headline, 'headline');
  });
  it('PA and banners <= 30', () => {
    for (const p of copy.PA_ANNOUNCEMENTS) check([...p], L.banner, 'pa');
    check([...copy.MISC.gameOverPA, ...copy.MISC.alarm, ...copy.MISC.blackFriday], L.banner, 'banner');
    check(Object.values(copy.FLOOR_ANNOUNCE), L.banner, 'floor');
    check([...copy.GAMESTONK_EGG.clerk, ...copy.GAMESTONK_EGG.items, copy.GAMESTONK_EGG.got], L.banner, 'gamestonk');
    check([copy.MISC.nowPlaying, copy.MISC.subtitle, copy.MISC.copyright, copy.MISC.pressSearch], 32, 'screen');
    check([copy.MISC.packagesLeft(6), copy.MISC.packageGot(6), copy.MISC.loop(99), copy.MISC.continuesLeft(3)], 32, 'fn');
  });
  it('only font-supported characters', () => {
    const all: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') all.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'who' && walk(x));
      else if (typeof v === 'function') all.push((v as (n: number) => string)(3));
    };
    for (const [k, v] of Object.entries(copy)) if (k !== 'LIMITS') walk(v);
    expect(all.length).toBeGreaterThan(50);
    for (const s of all) expect(ALLOWED.test(s), `bad chars in "${s}"`).toBe(true);
  });
});
