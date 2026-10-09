import { Game } from '../src/core/game';
import { Driver } from './helpers';
import { PadState } from '../src/core/pad';
import { SHAFTS, STOREFRONTS, floorY, FLOOR_4F, doorHit } from '../src/core/level';
import { doorsOpen } from '../src/core/elevator';
import { StoreRoom } from '../src/core/store';
import { StoreId } from '../src/core/copy';
import { isSolidChar, TILE } from '../src/core/stores-data';

/**
 * A simple scripted "new player" used by fairness tests: rides shaft A down to 4F, walks to a target store, shoots
 * spies it can see, enters the store, searches fixtures one by one (shooting guards that line up) until it holds
 * the package. It deliberately plays without any dodging so the numbers are a pessimistic baseline.
 */
export class Bot {
  d = new Driver();
  fireToggle = false;
  deaths = 0;
  foundPackage = false;
  reached4F = false;
  path: [number, number][] = [];
  targetFx = -1;
  lastLives = 3;
  constructor(
    readonly g: Game,
    readonly storeId: StoreId = 'forever12',
  ) {}

  private pad(h: Partial<PadState>) {
    return this.d.frame(h);
  }

  step(): void {
    const g = this.g;
    if (g.screen === 'continue') return void g.step(this.pad({ start: true }));
    if (g.screen !== 'mall' && g.screen !== 'store') return void g.step(this.pad({}));
    if (g.fade) return void g.step(this.pad({}));
    if (g.run!.score.lives < this.lastLives) this.deaths += this.lastLives - g.run!.score.lives;
    this.lastLives = g.run!.score.lives;
    if (g.run!.packages.includes(this.storeId)) this.foundPackage = true;
    if (g.screen === 'store') return void g.step(this.pad(this.storeAct(g.store!)));
    g.step(this.pad(this.mallAct()));
  }

  // ------------------------------------------------------------ mall
  private mallAct(): Partial<PadState> {
    const m = this.g.mall!;
    const p = m.p;
    if (p.mode === 'selfie') return { a: this.fireToggle = !this.fireToggle };
    if (p.mode !== 'normal' && p.mode !== 'car') return {};
    if (p.floor === FLOOR_4F || p.mode === 'car') this.reached4F = this.reached4F || p.floor === FLOOR_4F;
    const sf = STOREFRONTS.find((s) => s.id === this.storeId)!;
    const pcx = p.x + 8;
    const act: Partial<PadState> = {};
    // ride A to 4F
    if (p.mode === 'car') {
      const car = m.cars[p.carIdx];
      const want = floorY(FLOOR_4F);
      if (doorsOpen(car) && car.y === want) {
        this.fireToggle = !this.fireToggle;
        // step out on the side of the store we want
        return sf.doorX > SHAFTS[0].cx ? { right: this.fireToggle } : { left: this.fireToggle };
      }
      return car.y < want ? { down: true } : car.y > want ? { up: true } : {};
    }
    // enemies
    const foe = m.spies.filter((s) => (s.state as string) !== 'dying' && Math.abs(s.y - p.y) < 8 && Math.abs(s.x - p.x) < 170).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (foe) {
      const toward = foe.x > p.x ? 1 : -1;
      if (p.dir !== toward) return toward > 0 ? { right: true } : { left: true };
      const hi = (foe.state as string) === 'aim' && foe.aimHigh;
      return { a: (this.fireToggle = !this.fireToggle), down: hi };
    }
    if (p.floor !== FLOOR_4F) {
      // go to shaft A
      const a = SHAFTS[0];
      const tx = a.cx;
      if (Math.abs(pcx - tx) > 1) return pcx < tx ? { right: true } : { left: true };
      return { down: true };
    }
    // walk to the store door and go in
    const dx = sf.doorX - pcx;
    if (Math.abs(dx) > 2 && !doorHit(pcx, p.floor)) return dx > 0 ? { right: true } : { left: true };
    this.fireToggle = !this.fireToggle;
    return { up: this.fireToggle };
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
        if (!this.walkable(s, nc, nr) && !(nr === s.room.h - 2 && false)) continue;
        if (seen.has(key(nc, nr))) continue;
        seen.set(key(nc, nr), key(c, r));
        q.push([nc, nr]);
      }
    }
    return [];
  }

  private storeAct(s: StoreRoom): Partial<PadState> {
    const p = s.p;
    if (p.state === 'dead') return {};
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
      if (face && s.lineTo({ ...gd, x: gd.x, y: gd.y } as never, pcx, pcy)) {
        if (p.dir !== face) return { [face]: true };
        return { a: (this.fireToggle = !this.fireToggle) };
      }
    }
    // choose a fixture
    const fixtures = s.setup.fixtures;
    const col = Math.floor(pcx / TILE);
    const row = Math.floor(pcy / TILE);
    const touched = s.touchedFixture();
    if (s.canSearch() && touched >= 0) {
      this.fireToggle = !this.fireToggle;
      return { b: this.fireToggle };
    }
    const goals = new Set<string>();
    fixtures.forEach((f) => {
      if (f.opened) return;
      for (const [dc, dr] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (this.walkable(s, f.col + dc, f.row + dr)) goals.add(`${f.col + dc},${f.row + dr}`);
    });
    if (!goals.size) {
      // nothing left: walk out
      return { down: true };
    }
    const path = this.bfs(s, [col, row], goals);
    if (path.length < 2) {
      // already at a goal tile: nudge toward an adjacent fixture
      for (const f of fixtures) {
        if (f.opened) continue;
        if (Math.abs(f.col - col) + Math.abs(f.row - row) === 1) return f.col > col ? { right: true } : f.col < col ? { left: true } : f.row > row ? { down: true } : { up: true };
      }
      return {};
    }
    const [nc, nr] = path[1];
    const tx = nc * TILE + 8;
    const ty = nr * TILE + 8;
    if (Math.abs(ty - pcy) > 2 && Math.abs(tx - pcx) <= 3) return ty > pcy ? { down: true } : { up: true };
    if (Math.abs(tx - pcx) > 2) return tx > pcx ? { right: true } : { left: true };
    return ty > pcy ? { down: true } : { up: true };
  }
}
