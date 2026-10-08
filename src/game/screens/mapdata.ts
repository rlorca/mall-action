import type { StoreId } from '../../content/stores';
import type { ShaftId } from '../../content/layout';
import type { StoreStatus } from '../levelstate';

/**
 * Snapshot the Game hands to the MALL DIRECTORY overlay (Select). The overlay
 * itself lives in screens/mapscreen.ts (state) + render/mapView.ts (drawing).
 */
export interface MapData {
  /** Sim frame (drives blinking). */
  frame: number;
  /** Each elevator car's floor y in WORLD pixels (its floor surface), so the map can show its position. */
  cars: Array<{ shaft: ShaftId; y: number }>;
  /** The player's world position (feet y). When `inStore` is set the current store blinks instead. */
  player: { x: number; y: number; inStore: StoreId | null };
  /** package (red) / cleared (grey) / powerup (blue) / closed (dark outline). */
  statuses: Record<StoreId, StoreStatus>;
  /** With the Radar power-up a "!" marks each remaining package store. */
  radar: boolean;
  /** Joke items and the photo strip, e.g. "PET ROCK, PHOTO STRIP" or "NONE YET". */
  inventory: string;
  /** World x of the getaway station wagon. */
  blackFriday: boolean;
}
