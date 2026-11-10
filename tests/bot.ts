/**
 * A scripted player used by the tests: it plans a route through shafts and escalators,
 * fights spies, searches stores and drives to the exit. It only uses pad input.
 */
import { Btn, type PadFrame } from '../src/core/input';
import type { Game, Level } from '../src/game/types';
import { ESCALATORS, FLOOR_Y, F_P, SHAFTS, SHAFT_W, STORES, WAGON_X, doorX, segmentsOf, shaftColumn, shaftServes } from '../src/game/level';
import { TILE, solidTile, tileAt } from '../src/game/rooms';
import { stepGame } from '../src/game/game';

type Step =
  | { kind: 'cross'; shaft: number; to: number }
  | { kind: 'ride'; shaft: number; floor: number }
  | { kind: 'esc'; i: number; up: boolean };

function segIndex(f: number, x: number): number {
  const segs = segmentsOf(f);
  for (let i = 0; i < segs.length; i++) if (x <= segs[i][1]) return i;
  return segs.length - 1;
}

/** Breadth-first route between (floor, segment) nodes. */
export function planRoute(f0: number, x0: number, f1: number, x1: number): Step[] | null {
  const key = (f: number, s: number) => f * 10 + s;
  const start = key(f0, segIndex(f0, x0)), goal = key(f1, segIndex(f1, x1));
  const prev = new Map<number, { from: number; step: Step }>();
  const queue = [start];
  const seen = new Set([start]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === goal) break;
    const f = Math.floor(cur / 10), si = cur % 10;
    const seg = segmentsOf(f)[si];
    const edges: { to: number; step: Step }[] = [];
    SHAFTS.forEach((s, i) => {
      if (!shaftServes(s, f)) return;
      const left = seg[1] === s.x, right = seg[0] === s.x + SHAFT_W;
      if (!left && !right) return;
      edges.push({ to: key(f, left ? si + 1 : si - 1), step: { kind: 'cross', shaft: i, to: left ? 1 : -1 } });
      for (let gfl = s.top; gfl <= s.bottom; gfl++) {
        if (gfl === f) continue;
        const gs = segmentsOf(gfl);
        const li = gs.findIndex((q) => q[1] === s.x);
        edges.push({ to: key(gfl, li), step: { kind: 'ride', shaft: i, floor: gfl } });
        edges.push({ to: key(gfl, li + 1), step: { kind: 'ride', shaft: i, floor: gfl } });
      }
    });
    ESCALATORS.forEach((e, i) => {
      if (e.lower === f && segIndex(f, e.xLow) === si) edges.push({ to: key(e.upper, segIndex(e.upper, e.xHigh)), step: { kind: 'esc', i, up: true } });
      if (e.upper === f && segIndex(f, e.xHigh) === si) edges.push({ to: key(e.lower, segIndex(e.lower, e.xLow)), step: { kind: 'esc', i, up: false } });
    });
    for (const e of edges) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, step: e.step });
      queue.push(e.to);
    }
  }
  if (!seen.has(goal)) return null;
  const steps: Step[] = [];
  let cur = goal;
  while (cur !== start) {
    const p = prev.get(cur)!;
    steps.unshift(p.step);
    cur = p.from;
  }
  return steps;
}

export interface BotOpts {
  peek?: boolean; // look at where the package is (route tests); off for fairness tests
  fight?: boolean;
  stores?: number[]; // which stores to visit (default: all targets)
}

export class Bot {
  prev = 0;
  rideTarget = -1;
  log: string[] = [];
  constructor(readonly g: Game, readonly opts: BotOpts = {}) {}

  /** Advance the game by one frame under bot control. */
  step(): void {
    const held = this.decide();
    const pad: PadFrame = { held, pressed: held & ~this.prev };
    this.prev = held;
    stepGame(this.g, pad);
  }
  run(maxFrames: number, until: (g: Game) => boolean): number {
    let n = 0;
    while (n < maxFrames && !until(this.g)) { this.step(); n++; }
    return n;
  }

  private tap(btn: number, period = 8): number {
    return this.g.frame % period < period / 2 ? btn : 0;
  }

  decide(): number {
    const g = this.g;
    if (g.screen === 'title') return this.tap(Btn.Start, 20);
    if (g.screen === 'clear' || g.screen === 'continue') return this.tap(Btn.Start, 60);
    if (g.screen !== 'play') return 0;
    const L = g.level!;
    if (L.trans || L.mode === 'arrive') return 0;
    if (L.mode === 'selfie') return this.tap(Btn.A, 10);
    if (L.mode === 'store') return this.store(L);
    return this.mall(L);
  }

  private goal(L: Level): { floor: number; x: number; store: number } {
    const want = this.opts.stores;
    for (const st of L.stores) {
      if (st.def.role !== 'target' || st.cleared) continue;
      if (want && !want.includes(st.def.id)) continue;
      return { floor: st.def.floor, x: doorX(st.def), store: st.def.id };
    }
    return { floor: F_P, x: WAGON_X, store: -1 };
  }

  private mall(L: Level): number {
    const g = this.g;
    const P = L.player;
    if (P.dying > 0 || P.frozen > 0 || P.esc) return 0;
    if (P.hidden > 0) return Btn.Left;
    const goal = this.goal(L);
    // inside a car
    if (P.ride && P.ride.part === 'in') {
      const s = P.ride.shaft;
      const car = L.cars[s];
      if (this.rideTarget >= 0 && shaftServes(SHAFTS[s], this.rideTarget)) {
        const ty = FLOOR_Y[this.rideTarget];
        if (car.y !== ty) {
          if (Math.abs(car.y - ty) < 48 && car.dir !== 0) return 0; // glide the last leg
          return car.y > ty ? Btn.Up : Btn.Down;
        }
      }
      if (car.dir !== 0) return 0;
    }
    if (!P.onGround) return 0;
    const pf = FLOOR_Y.indexOf(P.y);
    let out = 0;
    // threats
    const fight = this.opts.fight !== false;
    if (fight) {
      for (const b of L.bullets) {
        if (b.owner !== 's' || Math.abs(b.y - P.y) > 24) continue;
        const dx = P.x - b.x;
        if (Math.sign(dx) !== Math.sign(b.vx) || Math.abs(dx) > 36) continue;
        if (b.y < P.y - 10) return Btn.Down | (P.ride ? Btn.Left : 0); // duck under a high shot
        if (Math.abs(dx) < 26) return this.prev & Btn.B ? 0 : Btn.B; // hop over a low one
      }
      let best: { dx: number } | null = null;
      for (const s of L.spies) {
        if (s.state === 'dead' || s.state === 'emerge' || Math.abs(s.y - P.y) > 2) continue;
        const dx = s.x - P.x;
        if (Math.abs(dx) < 150 && (!best || Math.abs(dx) < Math.abs(best.dx))) best = { dx };
      }
      if (best) {
        const dir = best.dx >= 0 ? 1 : -1;
        if (P.face !== dir) return dir > 0 ? Btn.Right : Btn.Left;
        return this.tap(Btn.A, 6);
      }
    }
    if (pf < 0) {
      // standing on a car roof: just walk out of the pit
      return P.x < SHAFTS[shaftColumn(P.x)]?.x + 12 ? Btn.Left : Btn.Right;
    }
    const route = planRoute(pf, P.x, goal.floor, goal.x);
    if (!route) return 0;
    if (route.length === 0) {
      this.rideTarget = -1;
      out = this.walkTo(L, pf, goal.x);
      if (out === 0) out = this.tap(Btn.Up, 12);
      return out;
    }
    const st = route[0];
    if (st.kind === 'cross') {
      const s = SHAFTS[st.shaft];
      return this.walkTo(L, pf, st.to > 0 ? s.x + SHAFT_W + 8 : s.x - 8);
    }
    if (st.kind === 'ride') {
      const s = SHAFTS[st.shaft];
      this.rideTarget = st.floor;
      const cx = s.x + SHAFT_W / 2;
      if (Math.abs(P.x - cx) > 1) return this.walkTo(L, pf, cx);
      const car = L.cars[st.shaft];
      if (car.y !== P.y || car.dir !== 0) return 0; // on the grate, the call picks us up
      return car.y > FLOOR_Y[st.floor] ? Btn.Up : Btn.Down;
    }
    const e = ESCALATORS[st.i];
    const lx = st.up ? e.xLow : e.xHigh;
    if (Math.abs(P.x - lx) > 2) return this.walkTo(L, pf, lx);
    return st.up ? Btn.Up : Btn.Down;
  }

  /** Walk toward x on this floor, waiting (and calling the car) at pits. */
  private walkTo(L: Level, pf: number, x: number): number {
    const P = L.player;
    const dx = x - P.x;
    if (Math.abs(dx) <= 1) return 0;
    const dir = dx > 0 ? 1 : -1;
    const ahead = shaftColumn(P.x + dir * 10);
    const here = shaftColumn(P.x);
    if (ahead >= 0 && here !== ahead && shaftServes(SHAFTS[ahead], pf)) {
      const car = L.cars[ahead];
      const fy = FLOOR_Y[pf];
      const open = car.y === fy && car.dir === 0;
      const grate = car.y < fy - 47 && !(car.dir > 0 && car.y > fy - 150) && !(car.dir > 0);
      if (!open && !grate) {
        // pit or a moving car: stand clear and call
        return car.dir === 0 && car.call !== pf ? this.tap(Btn.Up, 16) : 0;
      }
    }
    // a wet floor ahead is fine; other walkers just push
    return dir > 0 ? Btn.Right : Btn.Left;
  }

  private store(L: Level): number {
    const R = L.room!;
    const st = L.stores[R.store];
    const tpl = R.tpl;
    if (R.dying > 0 || R.hold || R.stun > 0 || (R.egg && R.egg.phase === 'talk')) return 0;
    if (R.search) return 0;
    const ptx = Math.floor((R.x + 8) / TILE), pty = Math.floor((R.y + 10) / TILE);
    if (this.opts.fight !== false) {
      // sidestep out of the line of an aiming guard or an incoming bullet
      const free = (dx: number, dy: number) => !solidTile(tpl, Math.floor((R.x + 8 + dx * 12) / TILE), Math.floor((R.y + 10 + dy * 10) / TILE));
      const dodge = (col: boolean): number => {
        if (col) return free(-1, 0) ? Btn.Left : free(1, 0) ? Btn.Right : 0;
        return free(0, 1) ? Btn.Down : free(0, -1) ? Btn.Up : 0;
      };
      for (const b of R.bullets) {
        if (b.owner !== 'g' || b.shoe) continue;
        const ddx = R.x + 8 - b.x, ddy = R.y + 10 - b.y;
        if (b.vx !== 0 && Math.abs(ddy) < 9 && Math.sign(ddx) === Math.sign(b.vx) && Math.abs(ddx) < 70) { const d = dodge(false); if (d) return d; }
        if (b.vy !== 0 && Math.abs(ddx) < 9 && Math.sign(ddy) === Math.sign(b.vy) && Math.abs(ddy) < 70) { const d = dodge(true); if (d) return d; }
      }
      for (const q of R.guards) {
        if (!q.alive || q.kind !== 'spy' || q.aimT <= 0 || q.aimT > 16) continue;
        const col = q.face === 'u' || q.face === 'd';
        if (col ? Math.abs(q.x - R.x) < 9 : Math.abs(q.y + 8 - (R.y + 10)) < 9) { const d = dodge(col); if (d) return d; }
      }
    }
    // shoot guards that are lined up
    if (this.opts.fight !== false) {
      for (const q of R.guards) {
        if (!q.alive) continue;
        const ddx = q.x - R.x, ddy = q.y - R.y;
        if (Math.abs(ddx) < 8 || Math.abs(ddy) < 8) {
          const want = Math.abs(ddx) < 8 ? (ddy > 0 ? 'd' : 'u') : ddx > 0 ? 'r' : 'l';
          const btn = { u: Btn.Up, d: Btn.Down, l: Btn.Left, r: Btn.Right }[want];
          if (Math.hypot(ddx, ddy) < 120) {
            if (R.face !== want) return btn;
            return this.tap(Btn.A, 6);
          }
        }
      }
    }
    let targets: number[] = [];
    const leave = st.def.role !== 'target' || st.cleared;
    if (!leave) {
      st.fixtures.forEach((f, i) => { if (!f.opened && (!this.opts.peek || f.content === 'package')) targets.push(i); });
    }
    // BFS over walkable tiles
    const dist = new Map<number, number>();
    const from = new Map<number, number>();
    const k = (x: number, y: number) => y * 64 + x;
    const q: [number, number][] = [[ptx, pty]];
    dist.set(k(ptx, pty), 0);
    const danger = (x: number, y: number) => R.guards.some((b) => b.alive && b.kind === 'bot' && Math.abs(b.x / TILE - x) < 1.6 && Math.abs(b.y / TILE - y) < 1.6);
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (solidTile(tpl, nx, ny) || dist.has(k(nx, ny)) || danger(nx, ny)) continue;
        dist.set(k(nx, ny), dist.get(k(x, y))! + 1);
        from.set(k(nx, ny), k(x, y));
        q.push([nx, ny]);
      }
    }
    let goalTile = -1, goalFix = -1, bd = Infinity;
    if (leave) {
      for (const d of tpl.doors) if (dist.has(k(d.tx, d.ty)) && dist.get(k(d.tx, d.ty))! < bd) { bd = dist.get(k(d.tx, d.ty))!; goalTile = k(d.tx, d.ty); }
    } else {
      for (const i of targets) {
        const f = st.fixtures[i];
        for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const t = k(f.tx + ox, f.ty + oy);
          if (tileAt(tpl, f.tx + ox, f.ty + oy) === 'D') continue;
          if (dist.has(t) && dist.get(t)! < bd) { bd = dist.get(t)!; goalTile = t; goalFix = i; }
        }
      }
    }
    if (goalTile < 0) return 0;
    if (goalTile === k(ptx, pty) && !leave) {
      const f = st.fixtures[goalFix];
      // centre on the tile, then touch the fixture and tap B once
      const gx = ptx * TILE, gy = pty * TILE;
      if (R.prompt === goalFix) return this.prev & Btn.B ? 0 : Btn.B;
      if (f.ty < pty) return Btn.Up;
      if (f.ty > pty) return Btn.Down;
      if (Math.abs(R.y - gy) > 2) return R.y > gy ? Btn.Up : Btn.Down;
      void gx;
      return f.tx < ptx ? Btn.Left : Btn.Right;
    }
    // walk the path: find the first tile after ours
    let cur = goalTile;
    let nextT = goalTile;
    while (cur !== k(ptx, pty)) { nextT = cur; cur = from.get(cur)!; if (cur === undefined) return 0; }
    const nx = nextT % 64, ny = Math.floor(nextT / 64);
    const gx = nx * TILE, gy = ny * TILE;
    if (leave && tileAt(tpl, nx, ny) === 'D') return Btn.Down;
    if (ny !== pty) {
      if (Math.abs(R.x - gx) > 1) return R.x > gx ? Btn.Left : Btn.Right;
      return ny < pty ? Btn.Up : Btn.Down;
    }
    if (Math.abs(R.y - gy) > 1) return R.y > gy ? Btn.Up : Btn.Down;
    return nx < ptx ? Btn.Left : Btn.Right;
  }
}

/** Fresh game already past the splash and title, at the start of the arrival. */
export function startedGame(seed: number, blackFriday = false): Game {
  // imported lazily to keep this helper tiny
  const g = newGameFn(seed);
  g.splash.done = true;
  g.screen = 'title';
  g.bfArmed = blackFriday;
  stepGame(g, { held: Btn.Start, pressed: Btn.Start });
  return g;
}
import { newGame as newGameFn } from '../src/game/setup';

/** Step with fixed input. pressed applies to the first frame only. */
export function run(g: Game, n: number, held = 0, pressed = 0): void {
  for (let i = 0; i < n; i++) stepGame(g, { held, pressed: i === 0 ? pressed | held : 0 });
}
/** Skip the arrival and the selfie; the player has control on the roof. */
export function toMall(seed: number, blackFriday = false): Game {
  const g = startedGame(seed, blackFriday);
  let guard = 0;
  while (g.level!.mode !== 'mall' && guard++ < 1000) stepGame(g, { held: 0, pressed: guard % 30 === 0 ? Btn.A : 0 });
  return g;
}
export { STORES };

/** Put the agent on a floor at x, standing. */
export function place(g: Game, floor: number, x: number): void {
  const P = g.level!.player;
  P.x = x; P.y = FLOOR_Y[floor]; P.vx = 0; P.vy = 0; P.onGround = true; P.ride = null; P.safeX = x; P.safeY = P.y;
  g.level!.camX = Math.max(0, Math.min(512, x - 128));
}
/** Remove random pressure so a test can focus on one rule. */
export function quiet(g: Game): void {
  const L = g.level!;
  L.spawnT = 1e9;
  L.paT = 1e9;
  L.alarmAt = 1e9;
  L.cop.x = 30;
  L.cop.floor = 4;
  L.cop.cool = 1e9;
  L.janitor.nextMop = 1e9;
  L.spies = [];
}
