import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { OPEN_STORES } from '../../content/stores';
import { boxFree, HALF } from './collision';
import { isSolidKind, roomPxH, roomPxW, tileAt, TILE } from './room';
import { makeWorld } from './testutil';

/** Random-input soak: whatever the player mashes, the world keeps its invariants. */
describe('random play never breaks the store rules', () => {
  const buttons = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B'] as const;
  for (const def of OPEN_STORES) {
    it(`${def.name}: 3 seeds x 2500 frames of mashing`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const m = makeWorld(def.id, { seed, guards: true, seen: seed !== 1, egg: def.id === 'gamestonk' && seed === 1 });
        const input = new Rng(seed * 31 + 7);
        let held: (typeof buttons)[number][] = [];
        let frames = 0;
        for (let i = 0; i < 2500 && !m.world.died && !m.world.exited; i++) {
          if (i % 9 === 0) held = buttons.filter(() => input.chance(0.28));
          if (i % 400 === 399) m.run.givePower(input.pick(['armor', 'cinnabomb', 'rapid', 'spread', 'sneakers'] as const));
          // seeds 2 and 3: immortal and kept away from the door, so the soak runs the full length
          if (seed > 1) {
            m.world.agent.hurt = 99999;
            if (m.world.agent.y > (m.world.room.rows - 1) * TILE - 4) m.world.teleportAgent(m.world.room.spawn.col, m.world.room.spawn.row);
          }
          m.pilot.step(...held);
          frames++;
          const w = m.world;
          const a = w.agent;
          expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
          expect(a.x).toBeGreaterThan(0);
          expect(a.x).toBeLessThan(roomPxW(w.room));
          expect(a.y).toBeGreaterThan(0);
          expect(a.y).toBeLessThanOrEqual(roomPxH(w.room));
          // the agent never ends up inside a wall / fixture (the doorway row is walkable)
          if (!w.exited) expect(boxFree((c, r) => isSolidKind(tileAt(w.room, c, r)), a.x, a.y, HALF - 0.01), `frame ${w.frame} agent in a solid`).toBe(true);
          for (const g of w.guards) {
            expect(Number.isFinite(g.x) && Number.isFinite(g.y)).toBe(true);
            if (g.change === 0) expect(boxFree((c, r) => isSolidKind(tileAt(w.room, c, r)) || tileAt(w.room, c, r) === 'door', g.x, g.y, HALF - 0.01), `guard in a solid at frame ${w.frame}`).toBe(true);
          }
          for (const b of w.bullets) expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
          expect(w.bullets.length).toBeLessThan(40);
          expect(w.guards.length).toBeLessThan(12);
          expect(w.toys.length).toBeLessThan(30);
          for (const t of w.toys) expect(isSolidKind(tileAt(w.room, Math.floor(t.x / TILE), Math.floor(t.y / TILE)))).toBe(false);
          expect(w.camX).toBeLessThanOrEqual(0 + Math.max(0, roomPxW(w.room) - 256));
        }
        if (seed > 1) expect(frames).toBe(2500);
      }
    });
  }
});
