import { describe, expect, it } from 'vitest';
import {
  LevelClearScreen,
  LC_DRIVE_FRAMES,
  LC_NEWS_FRAMES,
  LC_SPYGRAM_FRAMES,
  PHASE_DRIVE,
  PHASE_NEWS,
  PHASE_SPYGRAM,
  PHASE_TALLY,
} from './levelclear';
import { HEADLINES, SPYGRAM_COMPLETE } from '../../content/copy';
import { Rng } from '../../engine/rng';
import { Btn, NO_PAD, type Pad } from '../../engine/pad';
import type { SfxId } from '../../audio/ids';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });
const make = (seed = 1, over: Partial<ConstructorParameters<typeof LevelClearScreen>[0]> = {}) =>
  new LevelClearScreen({ rng: new Rng(seed), packages: 6, timeBonus: 1500, clearBonus: 1000, loop: 1, score: 4000, ...over });

describe('LevelClearScreen', () => {
  it('starts in the drive-off phase with the level clear jingle', () => {
    const s = make();
    expect(s.phase).toBe(PHASE_DRIVE);
    expect(s.music()).toBe('levelclear');
    expect(s.done).toBe(false);
  });

  it('Start skips ahead exactly one phase at a time, and finishes after the last', () => {
    const s = make();
    const seen = [s.phase];
    for (let i = 0; i < 3; i++) {
      s.step(NO_PAD);
      s.step(press(Btn.START));
      seen.push(s.phase);
    }
    expect(seen).toEqual([PHASE_DRIVE, PHASE_TALLY, PHASE_NEWS, PHASE_SPYGRAM]);
    expect(s.done).toBe(false);
    s.step(press(Btn.START));
    expect(s.done).toBe(true);
  });

  it('other buttons do not skip', () => {
    const s = make();
    for (const b of [Btn.A, Btn.B, Btn.SELECT, Btn.UP]) s.step(press(b));
    expect(s.phase).toBe(PHASE_DRIVE);
  });

  it('music: levelclear jingle for drive+tally, newspaper loop for the news and the spygram', () => {
    const s = make();
    const m: Array<string | null> = [s.music()];
    for (let i = 0; i < 3; i++) {
      s.step(press(Btn.START));
      m.push(s.music());
    }
    expect(m).toEqual(['levelclear', 'levelclear', 'newspaper', 'newspaper']);
  });

  it('advances through every phase on its own timers and then finishes', () => {
    const s = make();
    let steps = 0;
    const phases = new Set<number>();
    while (!s.done && steps < 20000) {
      s.step(NO_PAD);
      phases.add(s.phase);
      steps++;
    }
    expect(s.done).toBe(true);
    expect([...phases].sort()).toEqual([0, 1, 2, 3]);
    expect(steps).toBeGreaterThan(LC_DRIVE_FRAMES + LC_NEWS_FRAMES + LC_SPYGRAM_FRAMES);
  });

  it('picks a headline and a mission-complete post from the copy, deterministically per rng', () => {
    const a = make(7);
    const b = make(7);
    expect(HEADLINES).toContain(a.headline);
    expect(SPYGRAM_COMPLETE).toContain(a.post);
    expect(a.headline).toBe(b.headline);
    expect(a.post).toBe(b.post);
    expect(a.likeSeed).toBe(b.likeSeed);
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) seen.add(make(seed).headline);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('does not advance the injected rng (it forks)', () => {
    const rng = new Rng(3);
    const state = rng.getState();
    new LevelClearScreen({ rng, packages: 6, timeBonus: 0, clearBonus: 1000, loop: 2, score: 0 });
    expect(rng.getState()).toBe(state);
  });

  it('bonusTotal and finalScore; scoreIncludesBonus keeps the final score', () => {
    const s = make();
    expect(s.bonusTotal).toBe(2500);
    expect(s.finalScore).toBe(6500);
    const t = make(1, { score: 6500, scoreIncludesBonus: true });
    expect(t.baseScore).toBe(4000);
    expect(t.finalScore).toBe(6500);
  });

  it('the tally counts up row by row: packages, time bonus, clear bonus, LOOP n, score', () => {
    const s = make(1, { loop: 3 });
    s.step(press(Btn.START)); // -> tally
    expect(s.phase).toBe(PHASE_TALLY);
    expect(s.tally.map((r) => r.visible)).toEqual([false, false, false, false, false]);
    const sfx: SfxId[] = [];
    let guard = 0;
    let lastVisible = 0;
    while (s.phase === PHASE_TALLY && guard++ < 5000) {
      s.step(NO_PAD);
      sfx.push(...s.drainSfx());
      const vis = s.tally.filter((r) => r.visible).length;
      expect(vis).toBeGreaterThanOrEqual(lastVisible); // rows only ever appear, in order
      lastVisible = vis;
    }
    const final = s.tally;
    expect(final.map((r) => r.visible)).toEqual([true, true, true, true, true]);
    expect(final[0]!.value).toBe('6/6');
    expect(final[1]!.value).toBe('+1500');
    expect(final[2]!.value).toBe('+1000');
    expect(final[3]!.label).toBe('LOOP 3');
    expect(final[4]!.value).toBe('006500');
    expect(final[4]!.total).toBe(true);
    expect(sfx.filter((x) => x === 'blip').length).toBeGreaterThan(5);
    expect(sfx).toContain('coin');
  });

  it('tally values rise monotonically while counting', () => {
    const s = make();
    s.step(press(Btn.START));
    let prev = -1;
    for (let i = 0; i < 400 && s.phase === PHASE_TALLY; i++) {
      s.step(NO_PAD);
      const v = Number(s.tally[1]!.value.replace('+', ''));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(prev).toBe(1500);
  });

  it('rows are all final once past the tally phase', () => {
    const s = make();
    s.step(press(Btn.START));
    s.step(press(Btn.START));
    expect(s.phase).toBe(PHASE_NEWS);
    expect(s.tally.every((r) => r.visible && !r.counting)).toBe(true);
  });

  it('handles a tiny clear (no time bonus, 0 packages)', () => {
    const s = make(1, { packages: 0, timeBonus: 0 });
    s.step(press(Btn.START));
    for (let i = 0; i < 600 && s.phase === PHASE_TALLY; i++) s.step(NO_PAD);
    expect(s.tally[0]!.value).toBe('0/6');
    expect(s.tally[4]!.value).toBe('005000');
  });
});
