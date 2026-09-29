// Contracts between the pure rule worlds (mall / store) and the Session that orchestrates them.
// Rules never touch DOM/audio/canvas. They read PadFrames and push GameEvents.
import type { EventSink, StoreId } from '../core/events';
import type { PadFrame } from '../core/pad';
import type { Floor } from '../data/stores';
import type { Progress } from './progress';

export interface World {
  /** Advance exactly one 60 Hz simulation frame. */
  step(pad: PadFrame, sink: EventSink): void;
}

export interface MapCar {
  shaft: 'A' | 'B' | 'C';
  /** World y of the car's floor plane (px) and nearest floor index for convenience. */
  y: number;
  floor: Floor | null; // non-null when stopped level with a floor
}

export interface MapSnapshot {
  playerFloor: Floor;
  playerX: number;
  cars: MapCar[];
  getawayCar: { x: number };
  /** Player is currently inside a store (Session sets this; map blinks the store instead). */
  stores: { id: StoreId; floor: Floor; x: number; w: number }[];
}

export interface MallWorldApi extends World {
  progress: Progress;
  /** Non-null once the player walked through a store door. Session fades, builds the store, then calls clearPendingStore(). */
  pendingStore: StoreId | null;
  clearPendingStore(): void;
  /** Session calls this after the player left a store: player reappears at that store's door, mall music re-emitted. */
  returnFromStore(id: StoreId, sink: EventSink): void;
  /** True once the last life was lost and the death animation finished. Session runs Continue / Game Over. */
  outOfLives: boolean;
  /** Session calls this after the player accepted a continue (progress already updated with fresh lives): respawn where he fell. */
  resumeAfterContinue(sink: EventSink): void;
  /** Becomes true exactly once (never re-armed) when the exit rule fires. */
  levelClear: boolean;
  mapSnapshot(): MapSnapshot;
}

export interface StoreWorldApi extends World {
  storeId: StoreId;
  progress: Progress;
  /** True once the player walked out through the door (Session fades back to the mall). */
  exited: boolean;
  /** True once the last life was lost inside the store and the death animation finished. */
  outOfLives: boolean;
  /** Session calls this after the player accepted a continue while inside a store. */
  resumeAfterContinue(sink: EventSink): void;
  /** True if this store's package is taken (so it counts as cleared). */
  cleared: boolean;
}

export type { Progress };
