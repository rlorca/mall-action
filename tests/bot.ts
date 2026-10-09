import { Game } from '../src/core/game';
import { Driver } from './helpers';
import { PadState } from '../src/core/pad';
import { FLOOR_P, GETAWAY, SHAFTS, STOREFRONTS, doorHit, floorY, shaftServes } from '../src/core/level';
import { doorsOpen, openingState } from '../src/core/elevator';
import { StoreRoom } from '../src/core/store';
import { StoreId } from '../src/core/copy';
import { TILE, isSolidChar } from '../src/core/stores-data';

/**
 * A scripted "new player" used by the fairness and end-to-end tests. It is goal based (so it keeps working after
 * a death and respawn): it walks to the next target store, riding elevators and passing through cars to cross
 * shaft openings, shoots spies it can see, searches fixtures one by one until it holds the package, and finally
 * drives the getaway car. It never dodges, so its numbers are a pessimistic baseline.
 */
export class Bot {
  d = new Driver();
  toggle = false;
  deaths = 0;
  continuesUsed = 0;
  reached4F = false;
  foundPackage = false;
  lastLives = 3;
  /** Frames spent without progress (softlock detector). */
  constructor(
    readonly g: Game,
    readonly targets: StoreId[] = ['forever12'],
    readonly goToWagon = false,
  ) {}

  private flip(): boolean {
    return (this.toggle = !this.toggle);
  }
  private pad(h: Partial<PadState>) {
    return this.d.frame(h);
  }

  get nextStore(): StoreId | null {
    for (const id of this.targets) if (!this.g.run!.packages.includes(id)) return id;
    return null;
  }

  step(): void {
    const g = this.g;
    if (g.screen === 'continue') {
      if (g.fade === null) this.continuesUsed++;
      return void g.step(this.pad({ start: g.fade === null }));
    }
    if (g.screen === 'clear') return void g.step(this.pad({ start: this.flip() }));
    if (g.screen !== 'mall' && g.screen !== 'store') return void g.step(this.pad({}));
    if (g.fade) return void g.step(this.pad({}));
    const run = g.run!;
    if (run.score.lives < this.lastLives) this.deaths += this.lastLives - run.score.lives;
    this.lastLives = run.score.lives;
    if (this.targets.some((t) => run.packages.includes(t))) this.foundPackage = true;
    if (g.screen === 'store') return void g.step(this.pad(this.storeAct(g.store!)));
    g.step(this.pad(this.mallAct()));
  }

  // ------------------------------------------------------------ mall
  private mallAct(): Partial<PadState> {
    const m = this.g.mall!;
    const run = this.g.run!;
    const p = m.p;
    if (p.mode === 'selfie') return { a: this.flip() };
    if (p.mode !== 'normal' && p.mode !== 'car') return {};
    if (p.floor === 1) this.reached4F = true;

    // where are we going?
    const store = this.nextStore;
    let tf: number;
    let tx: number;
    if (store) {
      const sf = STOREFRONTS.find((s) => s.id === store)!;
      tf = sf.floor;
      tx = sf.doorX;
    } else if (this.goToWagon && run.packages.length >= 6) {
      tf = FLOOR_P;
      tx = GETAWAY.x + GETAWAY.w / 2;
    } else return {};

    // inside a car: ride to the right floor, then step out towards the goal
    if (p.mode === 'car') {
      const car = m.cars[p.carIdx];
      const sh = SHAFTS[p.carIdx];
      const want = floorY(tf);
      const here = car.y;
      if (p.floor === tf || (doorsOpen(car) && here === want)) {
        if (!doorsOpen(car)) return {};
        const f = this.flip();
        const dir = tx > sh.cx ? 'right' : 'left';
        return { [dir]: f };
      }
      // not yet at the right floor
      const best = this.pickShaft(p.floor, tf);
      if (best !== p.carIdx && doorsOpen(car)) {
        // wrong car: step out on the side of the destination shaft
        const f = this.flip();
        return { [SHAFTS[best].cx > sh.cx ? 'right' : 'left']: f };
      }
      return here < want ? { down: true } : here > want ? { up: true } : {};
    }

    // enemies first
    const foe = m.spies
      .filter((s) => (s.state as string) !== 'dying' && Math.abs(s.y - p.y) < 8 && Math.abs(s.x - p.x) < 170)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (foe && p.onGround) {
      const toward = foe.x > p.x ? 1 : -1;
      if (p.dir !== toward) return toward > 0 ? { right: true } : { left: true };
      return { a: this.flip(), down: (foe.state as string) === 'aim' && foe.aimHigh };
    }

    const cx = p.x + 8;
    if (p.floor === tf) {
      if (Math.abs(cx - tx) <= 2) return { up: this.flip() }; // door or getaway car
      return this.walkToward(tx, null);
    }
    const shaft = this.pickShaft(p.floor, tf);
    return this.walkToward(SHAFTS[shaft].cx, shaft);
  }

  /** The shaft to ride from floor a to floor b (one that serves both; the nearest to the agent first). */
  private pickShaft(a: number, b: number): number {
    const m = this.g.mall!;
    const px = m.p.x + 8;
    const c = SHAFTS.map((s, i) => ({ s, i })).filter(({ s }) => shaftServes(s, a) && shaftServes(s, b) && s.mode === 'manual');
    c.sort((x, y) => Math.abs(x.s.cx - px) - Math.abs(y.s.cx - px));
    return c.length ? c[0].i : 0;
  }

  /** Walk towards x on this floor. Open pits between us and x are crossed by riding through the shaft's car. */
  private walkToward(x: number, board: number | null): Partial<PadState> {
    const m = this.g.mall!;
    const p = m.p;
    const cx = p.x + 8;
    const dir = x > cx ? 1 : -1;
    for (let i = 0; i < SHAFTS.length; i++) {
      const s = SHAFTS[i];
      if (!shaftServes(s, p.floor)) continue;
      const lo = s.x;
      const hi = s.x + s.w;
      const between = dir > 0 ? hi > cx - 2 && lo < x + 1 : lo < cx + 2 && hi > x - 1;
      const inside = cx >= lo && cx <= hi;
      if (!between || inside) continue;
      if (s.mode === 'auto' && i !== board) continue;
      const st = openingState(m.cars[i], p.floor);
      const isDest = i === board;
      if (st === 'above' && !isDest) continue; // a grate: walk over it
      if (st === 'here') break; // walk in: we pass through the car
      // a pit (or the car we want is elsewhere): wait on our side so the car gets called
      const waitX = dir > 0 ? lo - 14 : hi + 14;
      if (Math.abs(cx - waitX) > 2) return waitX > cx ? { right: true } : { left: true };
      return {};
    }
    if (Math.abs(cx - x) <= 1) return {};
    return dir > 0 ? { right: true } : { left: true };
  }

  // ------------------------------------------------------------ store
  private walkable(s: StoreRoom, c: number, r: number): boolean {
    return !isSolidChar(s.tileAt(c, r)) && s.tileAt(c, r) !== 'D';
  }

  private bfs(s: StoreRoom, from: [number, number], goals: Set<string>): [number, number][] {
    const seen = new Map<string, string | null>();
    const key = (c: number, r: number) => `${c},${r}`;
    seen.set(key(...from), null);
    const q: [number, number][] = [from];
    while (q.length) {
      const [c, r] = q.shift()!;
      if (goals.has(key(c, r))) {
        const out: [number, number][] = [];
        let k: string | null = key(c, r);
        while (k) {
          const [cc, rr] = k.split(',').map(Number);
          out.unshift([cc, rr]);
          k = seen.get(k) ?? null;
        }
        return out;
      }
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (!this.walkable(s, nc, nr) || seen.has(key(nc, nr))) continue;
        seen.set(key(nc, nr), key(c, r));
        q.push([nc, nr]);
      }
    }
    return [];
  }

  private follow(s: StoreRoom, path: [number, number][], pcx: number, pcy: number): Partial<PadState> {
    const [nc, nr] = path[1];
    const tx = nc * TILE + 8;
    const ty = nr * TILE + 8;
    if (Math.abs(ty - pcy) > 2 && Math.abs(tx - pcx) <= 3) return ty > pcy ? { down: true } : { up: true };
    if (Math.abs(tx - pcx) > 2) return tx > pcx ? { right: true } : { left: true };
    return ty > pcy ? { down: true } : { up: true };
  }

  private storeAct(s: StoreRoom): Partial<PadState> {
    const p = s.p;
    if (p.state !== 'walk') return {};
    const hb = s.hitbox();
    const pcx = hb.x + hb.w / 2;
    const pcy = hb.y + hb.h / 2;
    // shoot guards that are lined up
    for (const gd of s.guards) {
      if ((gd.state as string) === 'dying') continue;
      const gx = gd.x + 8;
      const gy = gd.y + 8;
      let face: 'up' | 'down' | 'left' | 'right' | null = null;
      if (Math.abs(pcx - gx) < 8 && Math.abs(pcy - gy) < 110) face = gy < pcy ? 'up' : 'down';
      else if (Math.abs(pcy - gy) < 8 && Math.abs(pcx - gx) < 110) face = gx < pcx ? 'left' : 'right';
      if (face && s.lineTo(gd, pcx, pcy)) {
        if (p.dir !== face) return { [face]: true };
        return { a: this.flip() };
      }
    }
    const col = Math.floor(pcx / TILE);
    const row = Math.floor(pcy / TILE);
    const done = this.g.run!.packages.includes(s.id);
    if (!done) {
      if (s.canSearch() && s.touched >= 0) return { b: this.flip() };
      const goals = new Set<string>();
      for (const f of s.setup.fixtures) {
        if (f.opened) continue;
        for (const [dc, dr] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (this.walkable(s, f.col + dc, f.row + dr)) goals.add(`${f.col + dc},${f.row + dr}`);
      }
      if (goals.size) {
        const path = this.bfs(s, [col, row], goals);
        if (path.length >= 2) return this.follow(s, path, pcx, pcy);
        for (const f of s.setup.fixtures) {
          if (f.opened) continue;
          if (Math.abs(f.col - col) + Math.abs(f.row - row) === 1) return f.col > col ? { right: true } : f.col < col ? { left: true } : f.row > row ? { down: true } : { up: true };
        }
        return {};
      }
    }
    // leave: walk to the tile in front of the door, then out
    const exitRow = s.room.h - 2;
    const goals = new Set(s.room.doorCols.map((c) => `${c},${exitRow}`));
    const path = this.bfs(s, [col, row], goals);
    if (path.length >= 2) return this.follow(s, path, pcx, pcy);
    return { down: true };
  }
}

export { doorHit };
