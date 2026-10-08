import { describe, expect, it } from 'vitest';
import { KonamiDetector, KONAMI_CODE } from './konami';
import { Btn } from '../../engine/pad';

/** Feed a list of presses (0 = idle step); returns the step index (1-based press count) at which it fired, or -1. */
function run(d: KonamiDetector, presses: number[]): number[] {
  const hits: number[] = [];
  presses.forEach((p, i) => {
    if (d.feed(p)) hits.push(i);
  });
  return hits;
}

describe('KonamiDetector', () => {
  it('fires on the exact code, on the final A press', () => {
    const d = new KonamiDetector();
    expect(run(d, [...KONAMI_CODE])).toEqual([9]);
  });

  it('ignores idle steps between presses', () => {
    const d = new KonamiDetector();
    const seq: number[] = [];
    for (const b of KONAMI_CODE) seq.push(0, 0, b, 0);
    expect(run(d, seq)).toHaveLength(1);
  });

  it.each([1, 2, 4, 9])('still works with %i extra leading Ups', (extra) => {
    const d = new KonamiDetector();
    const seq = [...Array<number>(extra).fill(Btn.UP), ...KONAMI_CODE];
    expect(run(d, seq)).toEqual([seq.length - 1]);
  });

  it('does not fire on a partial or wrong code', () => {
    const d = new KonamiDetector();
    expect(run(d, KONAMI_CODE.slice(0, 9))).toEqual([]);
    const wrong = [...KONAMI_CODE];
    wrong[8] = Btn.A;
    wrong[9] = Btn.B;
    expect(run(new KonamiDetector(), wrong)).toEqual([]);
  });

  it('an unrelated press in the middle resets; a clean retry then works', () => {
    const d = new KonamiDetector();
    const broken = [...KONAMI_CODE.slice(0, 5), Btn.A, ...KONAMI_CODE.slice(5)];
    expect(run(d, broken)).toEqual([]);
    // the same detector still recognises a fresh, clean entry afterwards
    expect(run(d, [...KONAMI_CODE])).toHaveLength(1);
  });

  it('START/SELECT presses are unrelated presses too', () => {
    const d = new KonamiDetector();
    const seq = [...KONAMI_CODE.slice(0, 7), Btn.SELECT, ...KONAMI_CODE.slice(7)];
    expect(run(d, seq)).toEqual([]);
  });

  it('a chord (two buttons at once) breaks a sequence in progress', () => {
    const d = new KonamiDetector();
    const seq = [...KONAMI_CODE];
    seq[3] = Btn.DOWN | Btn.UP;
    expect(run(d, seq)).toEqual([]);
  });

  it('can be entered twice in a row (window clears after a hit)', () => {
    const d = new KonamiDetector();
    expect(run(d, [...KONAMI_CODE, ...KONAMI_CODE])).toEqual([9, 19]);
  });

  it('reports progress through the code', () => {
    const d = new KonamiDetector();
    expect(d.progress).toBe(0);
    d.feed(Btn.UP);
    d.feed(Btn.UP);
    expect(d.progress).toBe(2);
    d.feed(Btn.DOWN);
    expect(d.progress).toBe(3);
    d.feed(Btn.A);
    expect(d.progress).toBe(0);
    d.reset();
    expect(d.progress).toBe(0);
  });
});
