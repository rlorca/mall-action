import { describe, expect, it } from 'vitest';
import { FIRST_VISIT } from '../../content/copy';
import { OPEN_STORES, POWERUP_STORES, TARGET_STORES, storeDef } from '../../content/stores';
import { THEMES } from '../../content/themes';
import {
  MAX_FIXTURES,
  MIN_FIXTURES,
  MIN_GUARD_DISTANCE,
  ROOM_GRIDS,
  getRoom,
  isSolidKind,
  parseRoom,
  tileAt,
  validateRoom,
  walkDistances,
} from './room';
import { emptyRoom } from './testutil';

describe('store room templates', () => {
  it('there is exactly one hand-designed room per open store (10) and none for closed stores', () => {
    expect(Object.keys(ROOM_GRIDS).sort()).toEqual(OPEN_STORES.map((s) => s.id).sort());
    expect(OPEN_STORES).toHaveLength(10);
  });

  for (const def of OPEN_STORES) {
    describe(def.name, () => {
      const grid = (ROOM_GRIDS as Record<string, readonly string[]>)[def.id]!;
      const room = parseRoom(def.id, def.theme!, grid);

      it('is 16 x 11 tiles and uses only legend characters', () => {
        expect(room.cols).toBe(16);
        expect(room.rows).toBe(11);
        expect(grid.every((r) => r.length === 16)).toBe(true);
        expect(grid.every((r) => /^[#.D@srFcdVTBPKybv]+$/.test(r))).toBe(true);
      });

      it('is valid: enclosed by walls, door at the bottom centre, everything reachable', () => {
        expect(validateRoom(room)).toEqual([]);
        expect(getRoom(def.id)).toBe(getRoom(def.id));
      });

      it('has the door at columns 7-8 of the bottom row and the agent start right above it', () => {
        expect(room.door).toEqual({ col: 7, row: 10 });
        expect(tileAt(room, 7, 10)).toBe('door');
        expect(tileAt(room, 8, 10)).toBe('door');
        expect(room.spawn.row).toBe(9);
        expect([7, 8]).toContain(room.spawn.col);
        expect(tileAt(room, room.spawn.col, room.spawn.row)).toBe('floor');
      });

      it('is enclosed: every border tile is a wall except the doorway', () => {
        for (let c = 0; c < room.cols; c++) {
          expect(tileAt(room, c, 0)).toBe('wall');
          const bottom = tileAt(room, c, room.rows - 1);
          expect(bottom).toBe(c === 7 || c === 8 ? 'door' : 'wall');
        }
        for (let r = 0; r < room.rows; r++) {
          expect(tileAt(room, 0, r)).toBe('wall');
          expect(tileAt(room, room.cols - 1, r)).toBe('wall');
        }
      });

      it('has every searchable fixture reachable from the door', () => {
        const dist = walkDistances(room, room.spawn);
        for (const f of room.fixtures) {
          const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => dist[(f.row + dr!) * room.cols + f.col + dc!]! >= 0);
          expect(open, `fixture ${f.index} at ${f.col},${f.row}`).toBe(true);
        }
        // and every walkable tile is reachable (no sealed pockets)
        room.tiles.forEach((k, i) => {
          if (!isSolidKind(k)) expect(dist[i], `tile ${i % room.cols},${Math.floor(i / room.cols)} (${k})`).toBeGreaterThanOrEqual(0);
        });
      });

      it('has guard spawns on floor, 1 to 3 of them, away from the entrance', () => {
        expect(room.guards.length).toBeGreaterThanOrEqual(1);
        expect(room.guards.length).toBeLessThanOrEqual(3);
        const dist = walkDistances(room, room.spawn);
        for (const g of room.guards) {
          expect(tileAt(room, g.col, g.row)).toBe('floor');
          expect(dist[g.row * room.cols + g.col]).toBeGreaterThanOrEqual(MIN_GUARD_DISTANCE);
        }
      });

      it('uses its own theme from content/stores.ts', () => {
        expect(room.theme).toBe(def.theme);
      });
    });
  }

  it('target stores have about 6-9 searchable fixtures, power-up shops about 4-6', () => {
    for (const s of TARGET_STORES) {
      const n = getRoom(s.id).fixtures.length;
      expect(n, s.id).toBeGreaterThanOrEqual(6);
      expect(n, s.id).toBeLessThanOrEqual(9);
    }
    for (const s of POWERUP_STORES) {
      const n = getRoom(s.id).fixtures.length;
      expect(n, s.id).toBeGreaterThanOrEqual(4);
      expect(n, s.id).toBeLessThanOrEqual(6);
    }
  });

  it('fixtures are numbered in reading order (rows top to bottom, left to right)', () => {
    for (const s of OPEN_STORES) {
      const fx = getRoom(s.id).fixtures;
      fx.forEach((f, i) => {
        expect(f.index).toBe(i);
        if (i > 0) {
          const p = fx[i - 1]!;
          expect(f.row > p.row || (f.row === p.row && f.col > p.col)).toBe(true);
        }
      });
    }
  });

  it('all 9 themes are used and the two gadget shops have different layouts', () => {
    const used = new Set(OPEN_STORES.map((s) => s.theme));
    for (const t of THEMES) expect(used.has(t), t).toBe(true);
    const gadgets = OPEN_STORES.filter((s) => s.theme === 'gadgets');
    expect(gadgets).toHaveLength(2);
    expect(ROOM_GRIDS.crookstone).not.toEqual(ROOM_GRIDS.sharper);
  });

  it('every store with first-visit lines has a guard to say them (a bot for bot lines, a spy for spy lines)', () => {
    for (const [id, lines] of Object.entries(FIRST_VISIT)) {
      const room = getRoom(id as never);
      for (const l of lines!) expect(room.guards.some((g) => g.kind === l.who), `${id}: ${l.who}`).toBe(true);
    }
  });

  it('store extras have their special tiles', () => {
    expect(getRoom('forever12').fixtures.filter((f) => f.kind === 'fitting').length).toBeGreaterThanOrEqual(3);
    expect(getRoom('kgbtoys').toyShelves.length).toBeGreaterThanOrEqual(3);
    expect(getRoom('sambaddy').booths.length).toBeGreaterThanOrEqual(1);
    const gs = getRoom('gamestonk');
    expect(gs.clerk).not.toBeNull();
    expect(gs.pedestal).not.toBeNull();
    // the clerk stands between two demo TVs
    expect(tileAt(gs, gs.clerk!.col - 1, gs.clerk!.row)).toBe('tv');
    expect(tileAt(gs, gs.clerk!.col + 1, gs.clerk!.row)).toBe('tv');
    expect(getRoom('radioshock').guards.some((g) => g.kind === 'bot')).toBe(true);
    expect(getRoom('sharper').guards.some((g) => g.kind === 'bot')).toBe(true);
  });

  it('fixture counts sit within the validator limits', () => {
    for (const s of OPEN_STORES) {
      const n = getRoom(s.id).fixtures.length;
      expect(n).toBeGreaterThanOrEqual(MIN_FIXTURES);
      expect(n).toBeLessThanOrEqual(MAX_FIXTURES);
    }
  });
});

describe('room parsing and the validator', () => {
  const base = (): string[] => [...ROOM_GRIDS.crookstone];

  it('rejects ragged rows, unknown characters and a missing start', () => {
    const ragged = base();
    ragged[3] = ragged[3]!.slice(1);
    expect(() => parseRoom('x', 'gadgets', ragged)).toThrow(/expected 16/);
    const unknown = base();
    unknown[3] = unknown[3]!.replace('.', '?');
    expect(() => parseRoom('x', 'gadgets', unknown)).toThrow(/unknown legend/);
    const noStart = base().map((r) => r.replace('@', '.'));
    expect(() => parseRoom('x', 'gadgets', noStart)).toThrow(/@/);
  });

  it('flags a hole in the wall', () => {
    const g = base();
    g[0] = g[0]!.slice(0, 5) + '.' + g[0]!.slice(6);
    const problems = validateRoom(parseRoom('x', 'gadgets', g));
    expect(problems.some((p) => p.includes('expected wall'))).toBe(true);
  });

  it('flags a missing or off-centre door', () => {
    const none = base();
    none[10] = '################';
    expect(() => parseRoom('x', 'gadgets', none)).toThrow(/doorway/);
    const off = base();
    off[10] = '#DD#############';
    expect(validateRoom(parseRoom('x', 'gadgets', off)).some((p) => p.includes('door must be bottom centre'))).toBe(true);
  });

  it('flags a fixture walled in and a sealed pocket', () => {
    const g = base();
    // seal the free tiles around the shelf at (3,1): (2,1) and (3,2)... (4,1) is another shelf, (3,0) is wall
    g[1] = '#.dss......ss..#';
    g[2] = '#..d...........#';
    const problems = validateRoom(parseRoom('x', 'gadgets', g));
    expect(problems.length).toBeGreaterThan(0);
  });

  it('flags a guard spawned too close to the door or inside the fixtures count limits', () => {
    const g = base();
    g[8] = '#.....y........#';
    const problems = validateRoom(parseRoom('x', 'gadgets', g));
    expect(problems.some((p) => p.includes('guard spawn'))).toBe(true);
  });

  it('parses rooms of any size (the room system is not tied to 16 x 11)', () => {
    const big = emptyRoom(40, 24);
    expect(big.cols).toBe(40);
    expect(big.rows).toBe(24);
    expect(big.door).toEqual({ col: 19, row: 23 });
    const small = emptyRoom(10, 7);
    expect(small.cols).toBe(10);
    expect(small.door).toEqual({ col: 4, row: 6 });
  });

  it('closed stores have no room', () => {
    expect(() => getRoom('blockbluster')).toThrow();
    expect(storeDef('blockbluster').theme).toBeNull();
  });
});
