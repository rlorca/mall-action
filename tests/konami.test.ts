import { describe, expect, it } from 'vitest';
import { KonamiDetector } from '../src/core/konami';
import type { Pad } from '../src/core/input';

const CODE: Pad[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

function feed(d: KonamiDetector, pads: Pad[]): boolean[] {
  return pads.map((p) => d.press(p));
}

describe('Konami code', () => {
  it('fires exactly once when the full sequence is entered', () => {
    const d = new KonamiDetector();
    const hits = feed(d, CODE);
    expect(hits.filter(Boolean)).toHaveLength(1);
    expect(hits[hits.length - 1]).toBe(true);
  });

  it('still works with extra leading presses of Up', () => {
    const d = new KonamiDetector();
    const hits = feed(d, ['up', 'up', 'up', ...CODE]);
    expect(hits.some(Boolean)).toBe(true);
  });

  it('does not fire on a wrong sequence', () => {
    const d = new KonamiDetector();
    expect(feed(d, ['up', 'down', 'up', 'down', 'left', 'right', 'left', 'right', 'a', 'b']).some(Boolean)).toBe(false);
  });
});
