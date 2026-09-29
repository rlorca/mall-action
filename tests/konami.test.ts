import { describe, expect, it } from 'vitest';
import { KonamiDetector } from '../src/core/konami';
import type { ButtonName } from '../src/core/pad';

const feedAll = (d: KonamiDetector, s: ButtonName[]): boolean[] => s.map((b) => d.feed(b));
const CODE: ButtonName[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

describe('KonamiDetector', () => {
  it('detects the plain sequence once, at the end', () => {
    const r = feedAll(new KonamiDetector(), CODE);
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(r[9]).toBe(true);
  });
  it('works with extra leading Ups', () => {
    const d = new KonamiDetector();
    const r = feedAll(d, ['up', 'up', 'up', 'up', ...CODE.slice(2)]);
    expect(r[r.length - 1]).toBe(true);
  });
  it('restarts after a wrong press', () => {
    const d = new KonamiDetector();
    feedAll(d, ['up', 'up', 'down', 'left']);
    expect(feedAll(d, CODE).pop()).toBe(true);
  });
  it('wrong press mid-sequence that is also a valid start', () => {
    const d = new KonamiDetector();
    feedAll(d, ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'up']);
    expect(feedAll(d, ['up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']).pop()).toBe(true);
  });
  it('does not fire on partial or shuffled input', () => {
    const d = new KonamiDetector();
    expect(feedAll(d, CODE.slice(0, 9)).some(Boolean)).toBe(false);
    d.reset();
    expect(feedAll(d, ['a', 'b', 'right', 'left', 'right', 'left', 'down', 'down', 'up', 'up']).some(Boolean)).toBe(false);
  });
  it('fires again after completing, and reset() clears progress', () => {
    const d = new KonamiDetector();
    feedAll(d, CODE);
    expect(feedAll(d, CODE).pop()).toBe(true);
    feedAll(d, CODE.slice(0, 9));
    d.reset();
    expect(d.feed('a')).toBe(false);
  });
  it('select/start break the sequence', () => {
    const d = new KonamiDetector();
    feedAll(d, CODE.slice(0, 5));
    d.feed('start');
    expect(feedAll(d, CODE.slice(5)).some(Boolean)).toBe(false);
  });
});
