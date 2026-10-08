import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Game logic must be deterministic and DOM-free: all randomness goes through the
 * seeded Rng and all time is counted in simulation frames.
 */
const FORBIDDEN = [/Math\.random\s*\(/, /Date\.now\s*\(/, /new Date\s*\(/, /performance\.now\s*\(/, /\bdocument\./, /\bwindow\./, /requestAnimationFrame/];
const PURE_DIRS = ['engine', 'game', 'content', 'art', 'flickersoft'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('rules layers stay pure', () => {
  for (const d of PURE_DIRS) {
    it(`src/${d} has no Math.random / Date / performance / DOM access`, () => {
      const root = join(import.meta.dirname, d);
      const bad: string[] = [];
      for (const file of walk(root)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          // `Math.random` / `Date.now` mentioned in comments is fine; code is not.
          if (/^\s*\*/.test(line)) return;
          for (const re of FORBIDDEN) if (re.test(code)) bad.push(`${file}:${i + 1}: ${line.trim()}`);
        });
      }
      expect(bad).toEqual([]);
    });
  }
});
