/**
 * Events are the ONLY channel from the rules to the presentation layer.
 * The rules never call the audio or renderer directly; they push events, and
 * the shell drains them once per step. This keeps the rules browser-free.
 */

export type SfxId =
  | 'shot'
  | 'enemyShot'
  | 'jump'
  | 'ding'
  | 'hum'
  | 'crush'
  | 'lampFall'
  | 'glass'
  | 'searchTick'
  | 'packageFanfare'
  | 'powerup'
  | 'hurt'
  | 'death'
  | 'door'
  | 'blip'
  | 'whistle'
  | 'ping'
  | 'coin'
  | 'zip'
  | 'paChime'
  | 'smoke'
  | 'shriek'
  | 'buzzer'
  | 'pause'
  | 'select'
  | 'itemGet'
  | 'shutter'
  | 'camera'
  | 'thud'
  | 'like';

export type MusicId =
  | 'none'
  | 'title'
  | 'mallAmbient'
  | 'alarm'
  | 'elevator'
  | 'bonus'
  | 'clear'
  | 'gameover'
  | 'splash'
  | string; // store_* tracks

export type GameEvent =
  | { t: 'sfx'; id: SfxId }
  | { t: 'music'; id: MusicId }
  | { t: 'shake'; frames: number; power: number }
  | { t: 'flash'; frames: number }
  | { t: 'toast'; text: string };

/** A tiny append-only sink. One per game instance, drained each step. */
export class EventBus {
  private queue: GameEvent[] = [];

  sfx(id: SfxId): void {
    this.queue.push({ t: 'sfx', id });
  }

  music(id: MusicId): void {
    this.queue.push({ t: 'music', id });
  }

  shake(frames = 12, power = 2): void {
    this.queue.push({ t: 'shake', frames, power });
  }

  flash(frames = 4): void {
    this.queue.push({ t: 'flash', frames });
  }

  toast(text: string): void {
    this.queue.push({ t: 'toast', text });
  }

  drain(): GameEvent[] {
    if (this.queue.length === 0) return [];
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clear(): void {
    this.queue.length = 0;
  }
}
