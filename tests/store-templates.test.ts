import { describe, expect, it } from 'vitest';
import { OPEN_STORES, STORE_BY_ID, TARGET_STORES, POWERUP_STORES, THEMES } from '../src/data/stores';
import { TILE_CHARS, SOLID_KINDS, SEARCHABLE_KINDS } from '../src/game/store/tilekinds';
import { TEMPLATES, generateContents } from '../src/game/store';
import { newProgress } from '../src/game/progress';
import { make } from './store-helpers';

const solidCh = (c: string): boolean => SOLID_KINDS.has(TILE_CHARS[c]);

describe('store templates', () => {
  it('has a template for every open store, none for closed', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...OPEN_STORES].sort());
  });

  for (const id of OPEN_STORES) {
    const t = TEMPLATES[id];
    describe(id, () => {
      it('is 16x11 with a door at the bottom centre and a closed wall border', () => {
        expect(t.rows.length).toBe(11);
        for (const r of t.rows) expect(r.length).toBe(16);
        expect(t.rows[10][8]).toBe('d');
        for (let x = 0; x < 16; x++) {
          expect(t.rows[0][x]).toBe('#');
          if (x !== 8) expect(t.rows[10][x]).toBe('#');
        }
        for (let y = 0; y < 11; y++) {
          expect(t.rows[y][0]).toBe('#');
          expect(t.rows[y][15]).toBe('#');
        }
        expect([...t.rows.join('')].filter((c) => c === 'd').length).toBe(1);
      });
      it('uses only known tile chars and a free spawn tile', () => {
        for (const c of t.rows.join('')) expect(TILE_CHARS[c]).toBeDefined();
        expect(t.rows[9][8]).toBe('.');
      });
      it('has enough searchable fixtures', () => {
        const n = [...t.rows.join('')].filter((c) => SEARCHABLE_KINDS.has(TILE_CHARS[c])).length;
        const role = STORE_BY_ID[id].role;
        expect(n).toBeGreaterThanOrEqual(role === 'target' ? 6 : 3);
      });
      it('every walkable tile, guard start and fixture is reachable from the door', () => {
        const seen = new Set<string>();
        const q: [number, number][] = [[8, 10]];
        seen.add('8,10');
        while (q.length) {
          const [x, y] = q.pop()!;
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx > 15 || ny > 10 || seen.has(`${nx},${ny}`)) continue;
            if (solidCh(t.rows[ny][nx])) continue;
            seen.add(`${nx},${ny}`);
            q.push([nx, ny]);
          }
        }
        for (let y = 0; y < 11; y++)
          for (let x = 0; x < 16; x++) {
            const c = t.rows[y][x];
            if (SEARCHABLE_KINDS.has(TILE_CHARS[c])) {
              const touch = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
              expect(touch, `fixture ${c} at ${x},${y}`).toBe(true);
            } else if (!solidCh(c)) expect(seen.has(`${x},${y}`), `floor ${x},${y}`).toBe(true);
          }
        for (const g of t.guards) {
          expect(seen.has(`${g.col},${g.row}`)).toBe(true);
          expect(t.rows[g.row][g.col]).toBe('.');
        }
      });
      it('has guards matching the store guard count and first-visit bot needs', () => {
        const def = STORE_BY_ID[id];
        expect(t.guards.length).toBeGreaterThanOrEqual(def.guardCount[1]);
        if (id === 'radioshock' || id === 'sharperimagine') {
          const { w } = make(id, 3);
          expect(w.guards.some((g) => g.type === 'bot')).toBe(true);
        }
      });
    });
  }

  it('themes: all 9 used and gadgets shared by two stores with different layouts', () => {
    const used = new Set(OPEN_STORES.map((id) => STORE_BY_ID[id].theme));
    for (const th of THEMES) expect(used.has(th)).toBe(true);
    expect(TEMPLATES.crookstone.rows.join('')).not.toBe(TEMPLATES.sharperimagine.rows.join(''));
  });

  it('special tiles exist where the extras need them', () => {
    expect(TEMPLATES.forever12.rows.join('')).toContain('F');
    expect(TEMPLATES.kgbtoys.rows.join('')).toContain('K');
    expect(TEMPLATES.sambaddy.rows.join('')).toContain('B');
    expect(TEMPLATES.gamestonk.rows.join('')).toContain('V');
    expect(TEMPLATES.gamestonk.rows.join('')).toContain('P');
  });
});

describe('level-setup rules', () => {
  const count = (id: (typeof OPEN_STORES)[number]): number => [...TEMPLATES[id].rows.join('')].filter((c) => SEARCHABLE_KINDS.has(TILE_CHARS[c])).length;

  it('exactly one package per target store, none elsewhere (many seeds/loops)', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const id of OPEN_STORES) {
        for (const loop of [1, 2]) {
          const cs = generateContents(id, count(id), seed * 7919, loop, false);
          const pk = cs.filter((c) => c.kind === 'package').length;
          expect(pk).toBe(TARGET_STORES.includes(id) ? 1 : 0);
        }
      }
    }
  });

  it('power-up shops never hold traps or packages', () => {
    for (let seed = 0; seed < 100; seed++)
      for (const id of POWERUP_STORES) {
        const cs = generateContents(id, count(id as never), seed, 1, false);
        expect(cs.every((c) => c.kind === 'powerup' || c.kind === 'nothing')).toBe(true);
        expect(cs.some((c) => c.kind === 'powerup')).toBe(true);
      }
  });

  it('Black Friday: every non-package fixture holds a power-up', () => {
    for (let seed = 0; seed < 40; seed++)
      for (const id of OPEN_STORES) {
        const cs = generateContents(id, count(id), seed, 1, true);
        expect(cs.every((c) => c.kind === 'powerup' || c.kind === 'package')).toBe(true);
        expect(cs.filter((c) => c.kind === 'package').length).toBe(TARGET_STORES.includes(id) ? 1 : 0);
      }
  });

  it('layout is identical on re-creation and matches created worlds', () => {
    const p = newProgress(4242);
    const a = make('hotspy', 1, p).w;
    const b = make('hotspy', 99, p).w;
    for (let i = 0; i < a.fixtures.length; i++) expect(a.debugContent(i)).toEqual(b.debugContent(i));
    expect(a.fixtures.length).toBe(count('hotspy'));
  });

  it('hot spy holds mostly food power-ups', () => {
    let food = 0;
    let all = 0;
    for (let seed = 0; seed < 100; seed++)
      for (const c of generateContents('hotspy', 10, seed, 1, false))
        if (c.kind === 'powerup') {
          all++;
          if (['cinnabomb', 'juice', 'pretzel'].includes(c.power)) food++;
        }
    expect(food / all).toBeGreaterThan(0.5);
  });
});

describe('spawn fairness', () => {
  it('no guard starts within 3 tiles of the door spawn', () => {
    for (const [id, t] of Object.entries(TEMPLATES)) {
      for (const g of (t as any).guards) {
        const d = Math.abs(g.col - 8) + Math.abs(g.row - 9);
        expect(d, `${id} guard at ${g.col},${g.row}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
