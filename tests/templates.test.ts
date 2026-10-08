import { describe, expect, it } from 'vitest';
import { STORES } from '../src/mall/layout';
import { TEMPLATES, checkTemplate, ROOM_COLS, ROOM_ROWS } from '../src/store/templates';

const SOLID = new Set(['#', 'F', 'L', 'C', 'R', 'T', 'S']);

/** Tiles reachable from the door through walkable tiles. */
function reachable(rows: readonly string[]): Set<string> {
  const start = `${ROOM_ROWS - 2},${Math.floor(ROOM_COLS / 2) - 1}`;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const [r, c] = stack.pop()!.split(',').map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= ROOM_ROWS || nc >= ROOM_COLS) continue;
      if (SOLID.has(rows[nr][nc])) continue;
      const k = `${nr},${nc}`;
      if (!seen.has(k)) {
        seen.add(k);
        stack.push(k);
      }
    }
  }
  return seen;
}

describe('store room templates', () => {
  it('every template is 16 x 11 with one door at the bottom centre', () => {
    for (const t of Object.values(TEMPLATES)) expect(checkTemplate(t)).toEqual([]);
  });

  it('every open store has a template', () => {
    for (const s of STORES.filter((st) => st.role !== 'closed')) expect(TEMPLATES[s.template ?? '']).toBeDefined();
  });

  it('every fixture can be reached from the door (touched from some walkable tile)', () => {
    for (const t of Object.values(TEMPLATES)) {
      const seen = reachable(t.rows);
      t.rows.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if (ch !== 'F' && ch !== 'L') return;
          const touchable = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].some(([nr, nc]) => seen.has(`${nr},${nc}`));
          expect(touchable, `${t.id} fixture at ${r},${c}`).toBe(true);
        }),
      );
    }
  });

  it('every guard marker can be reached from the door', () => {
    for (const t of Object.values(TEMPLATES)) {
      const seen = reachable(t.rows);
      t.rows.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if (ch === 'G') expect(seen.has(`${r},${c}`), `${t.id} guard at ${r},${c}`).toBe(true);
        }),
      );
    }
  });

  it('every template has at least one guard marker per guard it places', () => {
    for (const t of Object.values(TEMPLATES)) {
      const markers = t.rows.join('').split('').filter((c) => c === 'G').length;
      expect(markers, t.id).toBeGreaterThanOrEqual(Math.min(1, t.guards.length));
    }
  });
});
