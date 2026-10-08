import { Btn, type Pad } from '../engine/pad';
import type { Rng } from '../engine/rng';
import type { MusicId } from '../audio/ids';
import { STORES, storeDef, type StoreId } from '../content/stores';
import { CLEAR_BONUS, POINTS, type Run } from './run';
import { storeStatus } from './levelstate';
import { MallWorld } from './mall/world';
import { installExtras } from './mall/modules';
import { StoreWorld, generateLevel } from './store';
import type { HudData } from './hud';
import type { MapData } from './screens/mapdata';

/** Frames of the fade to / from black when entering or leaving a store. */
export const FADE_FRAMES = 16;

export type LevelOverlay = null | 'map' | 'pause';
export type LevelResult = null | 'clear' | 'continue' | 'gameover';

interface Fade {
  /** 'out' = going dark, 'in' = coming back. */
  dir: 'out' | 'in';
  t: number;
  /** Runs once when the screen is fully black (swap scenes here). */
  swap: (() => void) | null;
}

/**
 * One level (one loop of the game): the mall, the store the agent is currently in, the map and
 * pause overlays, the fades between scenes, and what ends the level (clear / continue / game over).
 * Pure rules: `step(pad)` advances one 60 Hz frame.
 */
export class Level {
  readonly run: Run;
  readonly mall: MallWorld;
  store: StoreWorld | null = null;
  overlay: LevelOverlay = null;
  fade: Fade | null = null;
  result: LevelResult = null;
  /** Level frame counter (blink/scroll), advances even in overlays. */
  frame = 0;
  private readonly rng: Rng;

  constructor(run: Run, rng: Rng, opts: { skipIntro?: boolean } = {}) {
    this.run = run;
    this.rng = rng;
    run.level = generateLevel(rng.fork(`level${run.loop}`), run.loop, run.blackFriday);
    run.levelFrames = 0;
    run.alarmOn = false;
    run.resetPowers();
    this.mall = new MallWorld(run, rng.fork(`mall${run.loop}`), { skipIntro: opts.skipIntro });
    installExtras(this.mall);
  }

  /** Black level 0..4 for the renderer's fade (0 = none, 4 = black). */
  fadeSteps(): number {
    const f = this.fade;
    if (!f) return 0;
    const frac = Math.min(1, f.t / FADE_FRAMES);
    return Math.ceil((f.dir === 'out' ? frac : 1 - frac) * 4);
  }

  inStore(): boolean {
    return this.store !== null;
  }

  /** Overlays and fades stop the world (all timers pause in the map, pause and continue screens). */
  paused(): boolean {
    return this.overlay !== null;
  }

  step(pad: Pad): void {
    this.frame++;

    if (this.fade) {
      this.stepFade();
      return;
    }

    if (this.overlay === 'pause') {
      if (pad.pressed & Btn.START) {
        this.overlay = null;
        this.run.sfx('pause');
      }
      return;
    }
    if (this.overlay === 'map') {
      if (pad.pressed & (Btn.SELECT | Btn.START)) {
        this.overlay = null;
        this.run.sfx('select');
      }
      return;
    }

    const arriving = !this.store && this.mall.intro !== null;
    if (!arriving) {
      if (pad.pressed & Btn.START) {
        this.overlay = 'pause';
        this.run.sfx('pause');
        return;
      }
      if (pad.pressed & Btn.SELECT) {
        this.overlay = 'map';
        this.run.sfx('select');
        return;
      }
    }

    if (!arriving) this.run.levelFrames++;

    if (this.store) {
      this.stepStore(pad);
    } else {
      this.stepMall(pad);
    }
  }

  // ------------------------------------------------------------------ mall
  private stepMall(pad: Pad): void {
    const m = this.mall;
    m.step(pad);
    if (m.outcome) {
      this.result = m.outcome;
      return;
    }
    if (m.exitTriggered) {
      m.exitTriggered = false;
      // Level clear: bonuses are paid out here; the tally screen shows them.
      this.run.addScore(this.run.timeBonus() + CLEAR_BONUS);
      this.result = 'clear';
      return;
    }
    if (m.enterStore) {
      const id = m.enterStore;
      m.enterStore = null;
      this.startFade('out', () => {
        this.store = new StoreWorld(this.run, id, this.rng.fork(`store-${id}-${this.run.levelFrames}`));
      });
    }
  }

  // ------------------------------------------------------------------ store
  private stepStore(pad: Pad): void {
    const s = this.store!;
    s.step(pad);
    if (s.died) {
      const id = s.storeId;
      const next = this.run.loseLife();
      if (next === 'respawn') {
        this.startFade('out', () => this.leaveStore(id));
      } else {
        // The Game shows CONTINUE / GAME OVER; on continue we come back out at the store door.
        this.result = next;
      }
      return;
    }
    if (s.exited) {
      const id = s.storeId;
      this.startFade('out', () => this.leaveStore(id));
    }
  }

  private leaveStore(id: StoreId): void {
    this.store = null;
    this.mall.returnFromStore(id);
  }

  // ------------------------------------------------------------------ fades
  private startFade(dir: 'out' | 'in', swap: (() => void) | null): void {
    this.fade = { dir, t: 0, swap };
  }

  private stepFade(): void {
    const f = this.fade!;
    f.t++;
    if (f.t >= FADE_FRAMES) {
      if (f.dir === 'out') {
        f.swap?.();
        this.fade = { dir: 'in', t: 0, swap: null };
      } else {
        this.fade = null;
      }
    }
  }

  // ------------------------------------------------------------------ continue
  /** After CONTINUE (the Run already spent a continue): put the agent back where he fell. */
  resume(): void {
    this.result = null;
    this.overlay = null;
    this.fade = null;
    this.run.resetPowers();
    if (this.store) {
      const id = this.store.storeId;
      this.leaveStore(id);
      this.mall.player.invuln = 120;
    } else {
      this.mall.resume();
    }
    this.mall.outcome = null;
  }

  // ------------------------------------------------------------------ outputs for the renderer / audio
  music(): MusicId {
    if (this.store) return this.store.music();
    const m = this.mall;
    if (m.intro?.phase === 'selfie' && m.intro.t < 90) return 'selfie';
    return m.music();
  }

  hud(): HudData {
    const run = this.run;
    const t = run.activeTimed();
    return {
      score: run.score,
      packages: run.packages,
      lives: run.lives,
      timed: t ? { name: t.name, frac: t.total > 0 ? t.left / t.total : 0 } : null,
      armor: run.power.armor !== null,
      radar: run.power.radar,
      alarm: run.alarmOn,
      floor: this.store ? null : this.mall.hudFloor(),
      marquee: this.store ? storeDef(this.store.storeId).name : null,
      frame: this.frame,
    };
  }

  mapData(): MapData {
    const statuses = {} as MapData['statuses'];
    for (const s of STORES) statuses[s.id] = storeStatus(this.run.level, s.id);
    const p = this.mall.player;
    return {
      frame: this.frame,
      cars: this.mall.cars.map((c) => ({ shaft: c.id, y: c.y })),
      player: { x: p.x, y: p.y, inStore: this.store ? this.store.storeId : null },
      statuses,
      radar: this.run.power.radar,
      inventory: this.run.inventoryLine(),
      blackFriday: this.run.blackFriday,
    };
  }

  /** Data for the level-clear tally (the bonuses were already added to the score). */
  clearData(): { packages: number; timeBonus: number; clearBonus: number; loop: number; score: number } {
    const run = this.run;
    const secs = run.levelSeconds;
    return {
      packages: run.packages,
      timeBonus: Math.max(0, 300 - secs) * POINTS.timePerSecond,
      clearBonus: CLEAR_BONUS,
      loop: run.loop,
      score: run.score,
    };
  }
}
