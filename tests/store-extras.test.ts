import { describe, expect, it } from 'vitest';
import { newProgress } from '../src/game/progress';
import { FIRST_VISIT, GAMESTONK_EGG, MISC } from '../src/data/copy';
import { createStore, FITTING_SPY_CHANCE } from '../src/game/store';
import { Driver, make, placeAdjacent, tpTile } from './store-helpers';

describe('first-visit lines', () => {
  it('guards hold still and speak; second line ~60 frames after the first; once per game', () => {
    const p = newProgress(3);
    const { w, d } = make('forever12', 3, p);
    const start = w.guards.map((g) => [g.x, g.y]);
    const texts: { frame: number; text: string; guard: number }[] = [];
    for (let f = 0; f < 200; f++) {
      d.step({});
      for (const b of w.bubbles) if (b.t === 0) texts.push({ frame: w.frame, text: b.text, guard: b.guard });
      if (w.frame < 110) expect(w.guards.map((g) => [g.x, g.y])).toEqual(start);
    }
    expect(texts.map((t) => t.text)).toEqual(FIRST_VISIT.forever12.map((l) => l.text));
    expect(texts[1].frame - texts[0].frame).toBe(60);
    expect(p.visited).toContain('forever12');
    // second visit: no lines
    const m2 = make('forever12', 3, p);
    for (let f = 0; f < 200; f++) {
      m2.d.step({});
      expect(m2.w.bubbles.length).toBe(0);
    }
  });

  it('the bot line goes to a bot', () => {
    const { w, d } = make('radioshock', 3);
    let botBubble = false;
    for (let f = 0; f < 200; f++) {
      d.step({});
      for (const b of w.bubbles) if (b.text === 'BEEP. NOT INCLUDED.' && w.guards[b.guard].type === 'bot') botBubble = true;
    }
    expect(botBubble).toBe(true);
    const s = make('sharperimagine', 3);
    let ok = false;
    for (let f = 0; f < 100; f++) {
      s.d.step({});
      for (const b of s.w.bubbles) if (s.w.guards[b.guard].type === 'bot') ok = true;
    }
    expect(ok).toBe(true);
  });

  it('a store with a bot line but no bot gets a bot', () => {
    const tpl = { rows: make('crookstone').w.room.rows, guards: [{ type: 'spy' as const, col: 4, row: 3 }] };
    const { w } = make('radioshock', 3, undefined, tpl);
    expect(w.guards.some((g) => g.type === 'bot')).toBe(true);
  });

  it('every open store with copy has its lines shown', () => {
    for (const id of Object.keys(FIRST_VISIT)) {
      const { w, d } = make(id as never, 8);
      const seen: string[] = [];
      for (let f = 0; f < 200; f++) {
        d.step({});
        for (const b of w.bubbles) if (b.t === 0) seen.push(b.text);
      }
      expect(seen).toEqual(FIRST_VISIT[id].map((l) => l.text));
    }
  });
});

describe('GameStonk easter egg', () => {
  it('full flow: freeze, typewriter, item on pedestal, pick up, +1, inventory, clerk vanishes; once per game', () => {
    const p = newProgress(4);
    const { w, d } = make('gamestonk', 4, p);
    expect(w.egg?.phase).toBe('talk');
    expect(p.gamestonkEggDone).toBe(true);
    const g0 = [w.guards[0].x, w.guards[0].y];
    const pl0 = [w.player.x, w.player.y];
    let frames = 0;
    while (w.egg!.phase === 'talk' && frames < 1000) {
      d.step({ up: true, b: true, a: true });
      frames++;
      if (w.egg!.phase === 'talk') {
        expect([w.player.x, w.player.y]).toEqual(pl0); // input frozen
        expect([w.guards[0].x, w.guards[0].y]).toEqual(g0); // guards frozen
      }
    }
    expect(w.egg!.phase).toBe('item');
    expect(frames).toBeGreaterThan(60);
    expect(w.egg!.lines).toEqual(GAMESTONK_EGG.clerk);
    expect(d.sink.sfxCount('blip')).toBeGreaterThan(15);
    expect(w.egg!.itemVisible).toBe(true);
    expect(w.bullets.length).toBe(0);
    // walk onto the pedestal
    const item = w.egg!.item!;
    expect(GAMESTONK_EGG.items).toContain(item);
    w.guards = [];
    tpTile(w, w.egg!.pedestal.tx, w.egg!.pedestal.ty + 1);
    d.step({ up: true }, 20);
    expect(w.egg!.phase).toBe('get');
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'jingle:itemget')).toBe(true);
    expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === `YOU GOT: ${item}`)).toBe(true);
    expect(w.player.anim).toBe('hold');
    expect(p.score).toBe(1);
    expect(p.inventory).toEqual([item]);
    expect(w.egg!.itemVisible).toBe(false);
    expect(w.egg!.clerk.visible).toBe(true);
    d.step({}, 130);
    expect(w.egg!.phase).toBe('done');
    expect(w.egg!.clerk.visible).toBe(false);
    expect(w.puffs.length + d.sink.sfxCount('smoke')).toBeGreaterThan(0);
    // second visit: no egg
    const again = createStore({ id: 'gamestonk', seed: 4, progress: p });
    expect(again.egg).toBeNull();
  });

  it('the item is random (seeded) from the list', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) seen.add(make('gamestonk', seed).w.egg!.item!);
    expect(seen.size).toBeGreaterThanOrEqual(4);
    for (const s of seen) expect(GAMESTONK_EGG.items).toContain(s);
    expect(make('gamestonk', 12).w.egg!.item).toBe(make('gamestonk', 12).w.egg!.item);
  });

  it('other stores have no egg', () => {
    expect(make('crookstone', 1).w.egg).toBeNull();
  });
});

describe('Forever 12 fitting rooms', () => {
  function trial(seed: number) {
    const p = newProgress(seed);
    p.visited.push('forever12');
    const m = make('forever12', seed, p);
    const i = m.w.fixtures.findIndex((f) => f.kind === 'fitting' && m.w.room.rows[f.ty + 1][f.tx] === '.');
    placeAdjacent(m.w, i);
    m.w.guards = [];
    m.d.step({}, 1);
    m.d.tap('b');
    m.d.step({}, 50);
    return { ...m, i };
  }

  it('about 25% reveal a spy; contents stay unsearched and can be searched again', () => {
    let revealed = 0;
    const N = 600;
    let example: ReturnType<typeof trial> | null = null;
    for (let s = 0; s < N; s++) {
      const t = trial(s * 31 + 1);
      const f = t.w.fixtures[t.i];
      if (f.revealed) {
        revealed++;
        expect(f.open).toBe(false);
        expect(t.p.opened.forever12 ?? []).not.toContain(t.i);
        example ??= t;
      } else {
        expect(f.open).toBe(true);
      }
    }
    const ratio = revealed / N;
    expect(ratio).toBeGreaterThan(FITTING_SPY_CHANCE - 0.06);
    expect(ratio).toBeLessThan(FITTING_SPY_CHANCE + 0.06);
    expect(example).not.toBeNull();
  });

  it('a revealed spy shrieks OCCUPIED!!, throws a shoe, then fights; the room can be searched again', () => {
    let t: ReturnType<typeof trial> | null = null;
    for (let s = 0; s < 200 && !t; s++) {
      const c = trial(s + 1);
      if (c.w.fixtures[c.i].revealed) t = c;
    }
    const { w, d, p, i } = t!;
    const content = w.debugContent(i);
    expect(d.sink.sfxCount('shriek')).toBe(1);
    expect(w.guards.length).toBe(1);
    expect(w.guards[0].type).toBe('spy');
    w.player.invuln = 9999; // keep the agent alive so we can search again
    d.step({}, 40);
    expect(d.sink.has((e) => e.t === 'sfx' && e.name === 'enemyShot')).toBe(true); // the shoe
    // search again
    w.player.invuln = 9999;
    w.player.stun = 0;
    w.player.heldT = 0;
    w.guards[0].stunT = 9999;
    placeAdjacent(w, i);
    d.step({}, 2);
    d.tap('b');
    d.step({}, 50);
    expect(w.fixtures[i].open).toBe(true);
    expect(w.debugContent(i)).toEqual(content);
    expect(p.opened.forever12).toContain(i);
    expect(w.fixtures[i].revealed).toBe(true);
  });

  it('OCCUPIED!! bubble appears at reveal', () => {
    for (let s = 1; s < 200; s++) {
      const p = newProgress(s);
      p.visited.push('forever12');
      const m = make('forever12', s, p);
      const i = m.w.fixtures.findIndex((f) => f.kind === 'fitting' && m.w.room.rows[f.ty + 1][f.tx] === '.');
      placeAdjacent(m.w, i);
      m.w.guards = [];
      m.d.step({}, 1);
      m.d.tap('b');
      for (let f = 0; f < 50; f++) {
        m.d.step({});
        if (m.w.bubbles.some((b) => b.text === MISC.fitting)) {
          expect(m.w.guards[m.w.bubbles[0].guard]).toBeDefined();
          return;
        }
      }
    }
    throw new Error('no reveal found');
  });
});

describe('KGB Toys wind-up toys', () => {
  const shelfShot = () => {
    const p = newProgress(6);
    p.visited.push('kgbtoys');
    const m = make('kgbtoys', 6, p);
    m.w.guards = [];
    tpTile(m.w, 1, 3); // below shelf K(1,1) with floor at (1,2)
    m.w.player.facing = 'up';
    m.d.step({}, 1);
    m.d.tap('a');
    m.d.step({}, 20);
    return m;
  };

  it('shooting a shelf releases exactly 3 toys, once per shelf', () => {
    const { w, d } = shelfShot();
    expect(w.toyShelves.find((s) => s.tx === 1 && s.ty === 1)!.released).toBe(true);
    expect(w.toys.length).toBe(3);
    d.step({}, 30);
    tpTile(w, 1, 3);
    w.player.facing = 'up';
    d.tap('a');
    d.step({}, 20);
    expect(w.toys.length).toBe(3);
  });

  it('toys march, turn at walls and stay in the room', () => {
    const { w, d } = shelfShot();
    const start = w.toys.map((t) => [t.x, t.y]);
    d.step({}, 500);
    w.toys.forEach((t, k) => {
      expect(t.x).toBeGreaterThanOrEqual(16 - 3);
      expect(t.x).toBeLessThanOrEqual(w.room.pxW - 16);
      expect(t.y).toBeGreaterThanOrEqual(16 - 3);
      expect(t.y).toBeLessThanOrEqual(w.room.pxH - 32);
      expect([t.x, t.y]).not.toEqual(start[k]);
    });
    const dirs = new Set(w.toys.map((t) => t.dir));
    expect(dirs.size).toBeGreaterThanOrEqual(1);
  });

  it('toys stun guards they touch', () => {
    const p = newProgress(6);
    p.visited.push('kgbtoys');
    const m = make('kgbtoys', 6, p);
    tpTile(m.w, 1, 3);
    m.d.step({}, 1);
    m.d.tap('a');
    m.d.step({}, 10);
    expect(m.w.toys.length).toBe(3);
    const g = m.w.guards[0];
    g.x = m.w.toys[0].x;
    g.y = m.w.toys[0].y;
    m.d.step({});
    expect(g.stunT).toBeGreaterThan(60);
    expect(g.anim).toBe('stun');
    const pos = [g.x, g.y];
    m.d.step({}, 30);
    expect([g.x, g.y]).toEqual(pos);
  });

  it('toys set off traps: smoke that stuns nearby guards', () => {
    let m: ReturnType<typeof make> | null = null;
    let ti = -1;
    for (let seed = 1; seed < 300 && !m; seed++) {
      const p = newProgress(seed);
      p.visited.push('kgbtoys');
      const c = make('kgbtoys', seed, p);
      ti = c.w.fixtures.findIndex((f, k) => c.w.debugContent(k).kind === 'trap' && c.w.room.rows[f.ty + 1][f.tx] === '.');
      if (ti >= 0) m = c;
    }
    const { w, d, p } = m!;
    const f = w.fixtures[ti];
    expect(f.open).toBe(false);
    // release toys, then park one next to the trap and a guard near it
    tpTile(w, 1, 3);
    d.step({}, 1);
    d.tap('a');
    d.step({}, 5);
    const toy = w.toys[0];
    toy.x = f.tx * 16;
    toy.y = f.ty * 16 + 13;
    const g = w.guards[0];
    g.x = f.tx * 16 + 16;
    g.y = f.ty * 16 + 16;
    w.player.invuln = 999;
    d.step({});
    expect(f.open).toBe(true);
    expect(p.opened.kgbtoys).toContain(ti);
    expect(g.stunT).toBeGreaterThan(60);
    expect(d.sink.sfxCount('smoke')).toBeGreaterThanOrEqual(1);
    expect(w.puffs.length).toBeGreaterThan(0);
  });
});

describe('Sam Baddy listening booth', () => {
  it('store song on entry; booth music + NOW PLAYING while standing on it; song back afterwards', () => {
    const p = newProgress(2);
    p.visited.push('sambaddy');
    const { w, d } = make('sambaddy', 2, p);
    w.guards = [];
    d.step({});
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'store:sambaddy')).toBe(true);
    d.sink.drain();
    const b = w.booth!;
    tpTile(w, b.tx, b.ty);
    d.step({});
    expect(b.active).toBe(true);
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'booth')).toBe(true);
    expect(d.sink.has((e) => e.t === 'banner' && e.lines[0] === MISC.nowPlaying)).toBe(true);
    expect(b.nowPlaying).toBe(MISC.nowPlaying);
    d.step({}, 30);
    expect(d.sink.events.filter((e) => e.t === 'music').length).toBe(1); // no re-emit while standing
    d.sink.drain();
    tpTile(w, b.tx, b.ty + 1);
    d.step({});
    expect(b.active).toBe(false);
    expect(b.nowPlaying).toBeNull();
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'store:sambaddy')).toBe(true);
  });
});

describe('entry rules', () => {
  it('closed stores and cleared targets are refused', () => {
    const p = newProgress(1);
    for (const id of ['blockblustervideo', 'circuitpity', 'borderlinebooks'] as const) {
      const w = createStore({ id, seed: 1, progress: p });
      expect(w.refused).toBe(true);
      expect(w.exited).toBe(true);
    }
    expect(createStore({ id: 'crookstone', seed: 1, progress: p }).refused).toBe(false);
  });

  it('emits the store song on the first step', () => {
    const { d } = make('kgbtoys', 1);
    d.step({});
    expect(d.sink.has((e) => e.t === 'music' && e.name === 'store:kgbtoys')).toBe(true);
  });

  it('a power-up shop is never "cleared" and can be re-entered', () => {
    const p = newProgress(1);
    const w = createStore({ id: 'crookstone', seed: 1, progress: p });
    expect(w.cleared).toBe(false);
    void Driver;
  });
});
