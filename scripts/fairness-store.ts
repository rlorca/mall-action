import { Rng } from '../src/engine/rng';
import { padFromHeld } from '../src/engine/pad';
import { TARGET_STORES } from '../src/content/stores';
import { Run } from '../src/game/run';
import { generateLevel } from '../src/game/store/levelgen';
import { StoreWorld } from '../src/game/store/world';
import { playStoreSmart } from '../src/game/bot';

/** For each target store: how often does a sensible player (dodges, shoots lined-up guards) find the package without dying? */
const N = 30;
for (const st of TARGET_STORES) {
  let found = 0, diedN = 0, timeSum = 0, frames = 0;
  for (let seed = 1; seed <= N; seed++) {
    const run = new Run(seed);
    run.level = generateLevel(new Rng(seed), 1, false);
    const world = new StoreWorld(run, st.id, new Rng(seed + 1000));
    let held = 0;
    let t = 0;
    const b = {
      world,
      hold(mask: number, n = 1) { for (let i = 0; i < n; i++) { world.step(padFromHeld(held, mask)); held = mask; t++; } },
      tap(btn: number) { this.hold(btn, 1); this.hold(0, 1); },
    };
    const ok = playStoreSmart(b, 6000);
    if (ok) { found++; timeSum += t; }
    if (world.died || run.power.armor === null && false) diedN++;
    frames += t;
  }
  console.log(`${st.id.padEnd(11)} package found ${String(found).padStart(2)}/${N}  died ${String(diedN).padStart(2)}/${N}  avg time to package ${(timeSum / Math.max(1, found) / 60).toFixed(1)} s`);
}
