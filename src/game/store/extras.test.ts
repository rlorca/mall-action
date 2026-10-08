import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { EASTER_EGG, FIRST_VISIT, SHOUTS, UI, youGot } from '../../content/copy';
import { OPEN_STORES } from '../../content/stores';
import { TILE } from './room';
import {
  AIM_FRAMES,
  GRACE_FRAMES,
  HOLD_JOKE,
  INTRO_GAP,
  INTRO_START,
  StoreWorld,
  TOY_LIFE,
} from './world';
import { makeWorld, type Made } from './testutil';

const centre = (col: number): number => col * TILE + TILE / 2;

function until(m: Made, pred: () => boolean, max = 600): number {
  for (let i = 0; i < max; i++) {
    if (pred()) return i;
    m.pilot.step();
  }
  throw new Error('condition never met');
}

describe('GameStonk easter egg', () => {
  const egg = (guards = false): Made => makeWorld('gamestonk', { egg: true, guards });

  it('plays the first time only: clerk between two TVs, flagged in run.easterEggDone', () => {
    const m = egg();
    expect(m.world.egg).not.toBeNull();
    expect(m.world.clerkVisible).toBe(true);
    expect(m.run.easterEggDone).toBe(true);
    const clerk = m.world.room.clerk!;
    expect(m.world.room.tiles[clerk.row * 16 + clerk.col - 1]).toBe('tv');
    expect(m.world.room.tiles[clerk.row * 16 + clerk.col + 1]).toBe('tv');
    // the second visit has no egg
    const again = new StoreWorld(m.run, 'gamestonk', new Rng(2));
    expect(again.egg).toBeNull();
    expect(again.clerkVisible).toBe(false);
    expect(again.pedestalItem).toBeNull();
    // and no other store ever has one
    expect(makeWorld('crookstone', { egg: true }).world.egg).toBeNull();
  });

  it('a typewriter prints the clerk line with text-blip sounds while input and guards are frozen', () => {
    const m = egg(true);
    const spawn = m.world.guards.map((g) => [g.x, g.y]);
    const x0 = m.world.agent.x;
    const y0 = m.world.agent.y;
    let last = '';
    let growth = 0;
    for (let i = 0; i < 120; i++) {
      m.pilot.step('RIGHT', 'A');
      const t = m.world.typewriter;
      if (t !== null && t !== last) {
        expect(EASTER_EGG.clerk.startsWith(t)).toBe(true);
        growth++;
        last = t;
      }
    }
    expect(growth).toBeGreaterThan(20);
    expect(m.world.agent.x).toBe(x0);
    expect(m.world.agent.y).toBe(y0);
    expect(m.world.bullets).toHaveLength(0);
    expect(m.world.guards.map((g) => [g.x, g.y])).toEqual(spawn);
    const sfx = m.run.drainSfx();
    expect(sfx.filter((s) => s === 'blip').length).toBe(EASTER_EGG.clerk.replace(/ /g, '').length);
    until(m, () => m.world.egg!.phase === 'item');
    expect(m.world.typewriter).toBeNull();
  });

  it('then an item appears on the pedestal and input comes back', () => {
    const m = egg();
    until(m, () => m.world.egg!.phase === 'item');
    expect(EASTER_EGG.items).toContain(m.world.pedestalItem);
    const x0 = m.world.agent.x;
    m.pilot.hold(10, 'LEFT');
    expect(m.world.agent.x).toBeLessThan(x0);
  });

  it('walking onto the item plays the item-get jingle, holds it overhead, "YOU GOT: <ITEM>", +1 point and an inventory entry', () => {
    const m = egg();
    until(m, () => m.world.egg!.phase === 'item');
    const item = m.world.pedestalItem!;
    expect(m.world.music()).toBe('store.gamestonk');
    m.world.teleportAgent(7, 3);
    m.pilot.hold(30, 'UP');
    expect(m.world.egg!.phase).toBe('get');
    expect(m.world.music()).toBe('itemget');
    expect(m.world.agent.hold?.kind).toBe('joke');
    expect(m.world.banner?.text).toBe(youGot(item));
    expect(m.world.banner?.text).toBe(`YOU GOT: ${item}`);
    expect(m.run.score).toBe(1);
    expect(m.run.inventory).toEqual([item]);
    expect(m.world.pedestalItem).toBeNull();
    // frozen while he holds it
    const y = m.world.agent.y;
    m.pilot.hold(20, 'DOWN');
    expect(m.world.agent.y).toBe(y);
  });

  it('then the clerk vanishes in a puff and the store music returns', () => {
    const m = egg();
    until(m, () => m.world.egg!.phase === 'item');
    m.world.teleportAgent(7, 3);
    m.pilot.hold(30, 'UP');
    expect(m.world.clerkVisible).toBe(true);
    until(m, () => m.world.egg!.phase === 'done', HOLD_JOKE + 5);
    expect(m.world.clerkVisible).toBe(false);
    expect(m.world.music()).toBe('store.gamestonk');
    expect(m.world.puffs.length).toBeGreaterThan(0); // the puff the clerk vanishes in
    // the clerk's tile is walkable now
    m.pilot.hold(40, 'UP');
    expect(m.world.agent.y).toBeLessThan(2 * TILE);
  });

  it('the demo TVs are solid', () => {
    const m = egg();
    until(m, () => m.world.egg!.phase === 'item');
    m.world.teleportAgent(6, 2); // below the TV at (6,1)
    m.pilot.hold(30, 'UP');
    expect(m.world.agent.y).toBe(2 * TILE + 6);
    expect(m.world.egg!.phase).toBe('item');
  });

  it('the item is random (all five turn up) but deterministic for a seed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const m = makeWorld('gamestonk', { egg: true, seed });
      seen.add(m.world.egg!.item);
      const again = makeWorld('gamestonk', { egg: true, seed });
      expect(again.world.egg!.item).toBe(m.world.egg!.item);
    }
    expect([...seen].sort()).toEqual([...EASTER_EGG.items].sort());
  });
});

describe('Forever 12 fitting rooms', () => {
  /** Search fitting room 0 (at 2,1) once; returns the world. */
  const searchFitting = (seed: number): Made => {
    const m = makeWorld('forever12', { seed });
    m.world.teleportAgent(2, 2);
    m.pilot.tap('B');
    until(m, () => m.world.search === null, 80);
    return m;
  };
  const spyAppeared = (m: Made): boolean => m.world.guards.length === 1;

  it('searching a fitting room has a 25% chance of a spy mid-change', () => {
    let spies = 0;
    const n = 400;
    for (let seed = 1; seed <= n; seed++) if (spyAppeared(searchFitting(seed))) spies++;
    expect(spies / n).toBeGreaterThan(0.18);
    expect(spies / n).toBeLessThan(0.32);
  });

  const firstSpySeed = (): Made => {
    for (let seed = 1; seed < 200; seed++) {
      const c = searchFitting(seed);
      if (spyAppeared(c)) return c;
    }
    throw new Error('no seed produced a spy');
  };

  it('the spy shrieks "OCCUPIED!!", throws a shoe, then fights as a normal spy; the real contents stay unsearched', () => {
    const m = firstSpySeed();
    const w = m.world;
    const spy = w.guards[0]!;
    expect(spy.kind).toBe('spy');
    expect(spy.change).toBeGreaterThan(0);
    expect(w.bubbles.map((b) => b.text)).toContain(SHOUTS.fitting);
    expect(SHOUTS.fitting).toBe('OCCUPIED!!');
    expect(m.run.drainSfx()).toContain('shriek');
    expect(w.fixtureOpened(0)).toBe(false);
    expect(w.store.fixtures[0]!.content.kind).toBeDefined();
    expect(w.peeked.has(0)).toBe(true);
    expect(w.banner).toBeNull();
    // the spy is in the cubicle, then throws a shoe
    expect(spy.x).toBe(centre(2));
    expect(spy.y).toBe(centre(1));
    w.teleportAgent(6, 2); // out of the way so the shoe can be seen in flight
    w.agent.hurt = 99999;
    until(m, () => w.bullets.some((b) => b.kind === 'shoe'), 80);
    expect(w.bullets.find((b) => b.kind === 'shoe')).toBeDefined();
  });

  it('the shoe hurts: an agent who stays put next to the cubicle is hit', () => {
    const m = firstSpySeed();
    until(m, () => m.world.agent.dying > 0, 80);
    expect(m.world.agent.dying).toBeGreaterThan(0);
  });

  it('after the shriek the spy fights like any other spy', () => {
    let m: Made | null = null;
    for (let seed = 1; seed < 200 && !m; seed++) {
      const c = searchFitting(seed);
      if (spyAppeared(c)) m = c;
    }
    const w = m!.world;
    w.agent.hurt = 99999; // sidestep the shoe for this experiment
    w.teleportAgent(12, 6);
    m!.pilot.idle(200);
    const spy = w.guards[0]!;
    expect(spy.change).toBe(0);
    expect(Math.hypot(spy.x - centre(2), spy.y - centre(1))).toBeGreaterThan(8);
  });

  it('the fitting room can be searched again; it only rolls the spy once', () => {
    let m: Made | null = null;
    for (let seed = 1; seed < 200 && !m; seed++) {
      const c = searchFitting(seed);
      if (spyAppeared(c)) m = c;
    }
    const w = m!.world;
    w.agent.hurt = 99999;
    w.guards.length = 0;
    w.bullets.length = 0;
    w.teleportAgent(2, 2);
    m!.pilot.idle(4);
    m!.pilot.tap('B');
    until(m!, () => w.fixtureOpened(0), 100);
    expect(w.guards).toHaveLength(0);
    expect(w.banner).not.toBeNull();
  });

  it('other fixtures never produce the spy', () => {
    let spies = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const m = makeWorld('forever12', { seed });
      // fixture 3 is a clothing rack at (3,3)
      m.world.teleportAgent(3, 4);
      m.pilot.tap('B');
      until(m, () => m.world.search === null, 80);
      if (m.world.guards.length > 0) spies++;
    }
    expect(spies).toBe(0);
  });
});

describe('KGB Toys shelves and wind-up toys', () => {
  /** Shoot the toy shelf at (col,1) from the tile below it. */
  const shootShelf = (m: Made, col: number): void => {
    m.world.teleportAgent(col, 2);
    m.world.agent.facing = 'up';
    m.pilot.step('A');
    m.pilot.idle(20); // longer than the shot cooldown
  };

  it('shooting a toy shelf releases 3 wind-up toys (once per shelf)', () => {
    const m = makeWorld('kgbtoys');
    expect(m.world.toys).toHaveLength(0);
    shootShelf(m, 5);
    expect(m.world.toys).toHaveLength(3);
    expect(m.world.toyShelfReleased(5, 1)).toBe(true);
    expect(m.world.toyShelfReleased(2, 1)).toBe(false);
    expect(m.run.drainSfx()).toContain('bounce');
    m.pilot.idle(20);
    shootShelf(m, 5);
    expect(m.world.toys).toHaveLength(3);
    shootShelf(m, 2);
    expect(m.world.toys).toHaveLength(6);
  });

  it('only toy shelves release toys, not ordinary shelves or walls', () => {
    const m = makeWorld('kgbtoys');
    m.world.teleportAgent(2, 4); // below the shelf at (2,3)
    m.world.agent.facing = 'up';
    m.pilot.step('A');
    m.pilot.idle(20);
    expect(m.world.toys).toHaveLength(0);
  });

  it('toys march in different directions and turn at walls', () => {
    const m = makeWorld('kgbtoys');
    shootShelf(m, 5);
    m.world.teleportAgent(12, 9);
    expect(new Set(m.world.toys.map((t) => t.dir)).size).toBeGreaterThan(1);
    const start = m.world.toys.map((t) => [t.x, t.y]);
    m.pilot.idle(10);
    m.world.toys.forEach((t, i) => expect(Math.hypot(t.x - start[i]![0]!, t.y - start[i]![1]!)).toBeGreaterThan(5));
    for (let i = 0; i < 400; i++) {
      m.pilot.step();
      for (const t of m.world.toys) {
        const tile = m.world.room.tiles[Math.floor(t.y / TILE) * 16 + Math.floor(t.x / TILE)];
        expect(['floor', 'booth', 'pedestal']).toContain(tile);
      }
    }
    expect(m.world.toys.reduce((n, t) => n + t.turns, 0)).toBeGreaterThanOrEqual(3);
  });

  it('toys wind down after a while', () => {
    const m = makeWorld('kgbtoys');
    shootShelf(m, 5);
    m.world.teleportAgent(12, 9);
    m.pilot.idle(TOY_LIFE + 5);
    expect(m.world.toys).toHaveLength(0);
  });

  it('toys stun the guards they touch; stunned guards cannot move or shoot', () => {
    const m = makeWorld('kgbtoys', { guards: true });
    const spy = m.world.guards.find((g) => g.kind === 'spy')!;
    m.world.guards.splice(0, m.world.guards.length, spy);
    // park the spy in the path of the toy that marches down from the shelf at (5,1)
    spy.x = centre(5);
    spy.y = centre(4);
    spy.col = 5;
    spy.row = 4;
    spy.tx = spy.x;
    spy.ty = spy.y;
    spy.think = 99999;
    spy.armedAt = 99999;
    shootShelf(m, 5);
    m.world.teleportAgent(12, 9);
    until(m, () => spy.stun > 0, 120);
    expect(spy.stun).toBeGreaterThan(100);
    const px = spy.x;
    const py = spy.y;
    spy.think = 0;
    spy.armedAt = 0;
    m.pilot.idle(60);
    expect(spy.x).toBe(px);
    expect(spy.y).toBe(py);
    expect(spy.aim).toBe(0);
  });

  it('a toy that reaches a trap sets it off: smoke that stuns nearby guards', () => {
    const m = makeWorld('kgbtoys', { guards: true });
    const trapIdx = 0; // fixture 0 is at (11,1)
    expect(m.world.room.fixtures[trapIdx]).toMatchObject({ col: 11, row: 1 });
    m.world.store.fixtures[trapIdx]!.content = { kind: 'trap' };
    const spy = m.world.guards.find((g) => g.kind === 'spy')!;
    m.world.guards.splice(0, m.world.guards.length, spy);
    spy.x = centre(12);
    spy.y = centre(3);
    spy.col = 12;
    spy.row = 3;
    spy.tx = spy.x;
    spy.ty = spy.y;
    spy.think = 99999;
    expect(spy.stun).toBe(0);
    shootShelf(m, 8); // the toy that heads right runs along row 1 into the trap at (11,1)
    m.world.teleportAgent(2, 9);
    m.run.drainSfx();
    until(m, () => m.world.fixtureOpened(trapIdx), 200);
    expect(m.world.puffs.length).toBeGreaterThan(0);
    expect(m.run.drainSfx()).toContain('smoke');
    expect(spy.stun).toBeGreaterThan(100);
    expect(m.world.agent.stun).toBe(0);
  });
});

describe('Sam Baddy listening booth', () => {
  it('stepping on the booth switches the music to the bonus track until he steps off', () => {
    const m = makeWorld('sambaddy');
    expect(m.world.music()).toBe('store.sambaddy');
    expect(m.world.nowPlaying).toBe(false);
    m.world.teleportAgent(9, 3);
    m.pilot.hold(40, 'RIGHT');
    expect(m.world.onBooth).toBe(true);
    expect(m.world.music()).toBe('booth');
    expect(m.world.nowPlaying).toBe(true);
    expect(UI.nowPlaying).toBe('NOW PLAYING: SIDE B');
    m.pilot.hold(40, 'LEFT');
    expect(m.world.onBooth).toBe(false);
    expect(m.world.music()).toBe('store.sambaddy');
    expect(m.world.nowPlaying).toBe(false);
  });

  it('the booth is not solid (it can be walked over from either side)', () => {
    const m = makeWorld('sambaddy');
    m.world.teleportAgent(11, 2);
    m.pilot.hold(30, 'DOWN');
    expect(m.world.agent.y).toBeGreaterThan(3 * TILE);
  });
});

describe('first-visit lines', () => {
  const lines = (id: keyof typeof FIRST_VISIT) => FIRST_VISIT[id]!;

  it('on the first entry the guards hold still and say their lines, the second about 1 s after the first', () => {
    const m = makeWorld('kgbtoys', { seen: false, guards: true });
    expect(m.world.firstVisit).toBe(true);
    expect(m.run.seenStores.has('kgbtoys')).toBe(true);
    expect(m.world.introActive).toBe(true);
    const spawn = m.world.guards.map((g) => [g.x, g.y]);
    const when: Record<string, number> = {};
    for (let i = 0; i < 400; i++) {
      m.pilot.step();
      for (const b of m.world.bubbles) if (!(b.text in when)) when[b.text] = m.world.frame;
      if (m.world.introActive) expect(m.world.guards.map((g) => [g.x, g.y])).toEqual(spawn);
    }
    const [l1, l2] = lines('kgbtoys');
    expect(when[l1!.text]).toBe(INTRO_START);
    expect(when[l2!.text]! - when[l1!.text]!).toBe(INTRO_GAP);
    expect(INTRO_GAP).toBe(60);
    expect(m.world.introActive).toBe(false);
    // ... then they act
    expect(m.world.guards.some((g, i) => g.x !== spawn[i]![0] || g.y !== spawn[i]![1])).toBe(true);
  });

  it('every store with lines says them in order, over the right speaker', () => {
    for (const def of OPEN_STORES) {
      const expected = FIRST_VISIT[def.id];
      if (!expected) continue;
      const m = makeWorld(def.id, { seen: false, guards: true });
      const home = m.world.guards.map((g) => ({ kind: g.kind, x: g.x }));
      const said: string[] = [];
      const speakers: number[] = [];
      for (let i = 0; i < 300; i++) {
        m.pilot.step();
        for (const b of m.world.bubbles) {
          if (!said.includes(b.text)) {
            said.push(b.text);
            speakers.push(b.x);
          }
        }
      }
      expect(said, def.id).toEqual(expected.map((l) => l.text));
      expected.forEach((l, i) => {
        const g = home.find((o) => o.kind === l.who)!;
        expect(g, `${def.id}: a ${l.who} to speak`).toBeDefined();
        expect(speakers[i], `${def.id} line ${i}`).toBe(g.x);
      });
    }
  });

  it('RadioShock: the spy speaks first, then the security bot', () => {
    const m = makeWorld('radioshock', { seen: false, guards: true });
    const spy = m.world.guards.find((g) => g.kind === 'spy')!;
    const bot = m.world.guards.find((g) => g.kind === 'bot')!;
    m.pilot.idle(INTRO_START + 1);
    expect(m.world.bubbles).toHaveLength(1);
    expect(m.world.bubbles[0]!.x).toBe(spy.x);
    m.pilot.idle(INTRO_GAP);
    const botBubble = m.world.bubbles.find((b) => b.text === lines('radioshock')[1]!.text)!;
    expect(botBubble.x).toBe(bot.x);
  });

  it('only the first visit: re-entering shows no lines and the guards act straight away', () => {
    const m = makeWorld('kgbtoys', { seen: false, guards: true });
    m.pilot.idle(10);
    const again = new StoreWorld(m.run, 'kgbtoys', new Rng(9));
    expect(again.firstVisit).toBe(false);
    expect(again.introActive).toBe(false);
    const start = again.guards.map((g) => [g.x, g.y]);
    for (let i = 0; i < 40; i++) again.step({ held: 0, pressed: 0, released: 0 });
    expect(again.bubbles).toHaveLength(0);
    expect(again.guards.some((g, i) => g.x !== start[i]![0] || g.y !== start[i]![1])).toBe(true);
  });

  it('guards may not shoot until the chatter is over (and the usual grace has passed)', () => {
    const m = makeWorld('kgbtoys', { seen: false, guards: true });
    m.world.teleportAgent(7, 5);
    m.world.guards[0]!.x = centre(11);
    m.world.guards[0]!.y = centre(5);
    m.world.guards[0]!.col = 11;
    m.world.guards[0]!.row = 5;
    let firstAim = -1;
    for (let i = 0; i < 400 && firstAim < 0; i++) {
      m.pilot.step();
      m.world.agent.hurt = 99999;
      if (m.world.guards.some((g) => g.aim > 0)) firstAim = m.world.frame;
    }
    expect(firstAim).toBeGreaterThan(INTRO_START + INTRO_GAP + 60);
    expect(firstAim).toBeGreaterThanOrEqual(GRACE_FRAMES);
    expect(AIM_FRAMES).toBeGreaterThan(0);
  });

  it('the first-visit state is per game: a new Run says the lines again', () => {
    const a = makeWorld('hotspy', { seen: false, guards: true });
    const b = makeWorld('hotspy', { seen: false, guards: true });
    expect(a.world.firstVisit).toBe(true);
    expect(b.world.firstVisit).toBe(true);
  });
});

describe('music', () => {
  it('every store plays its own song', () => {
    for (const def of OPEN_STORES) expect(makeWorld(def.id).world.music()).toBe(def.song);
  });
});
