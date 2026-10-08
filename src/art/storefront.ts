import type { Framebuffer } from '../engine/framebuffer';
import type { StoreId } from '../content/stores';

/**
 * A storefront is STORE_W (80) x STOREFRONT_H (40) px. Layout (all in px, relative to the top-left):
 *   rows 0..9    sign plate with the store name in the tiny font (coloured by role)
 *   rows 10..37  body: 2 px frame | window L (28 wide) | door (20 wide) | window R (28 wide) | 2 px frame
 *   rows 38..39  threshold / base
 * Its bottom edge sits on a floor's walking surface, so top y = floorY(floor) - 40.
 * Door trigger for the agent is x + 32 .. x + 48.
 *
 * OWNER: storefronts art agent. Implement `drawStorefront`, composing the `win.<id>.L/R`, `door.*` sprites.
 */
export const STOREFRONT_H = 40;

export interface StorefrontOpts {
  /** Simulation frame counter (drives idle animation and door blinking). */
  frame: number;
  /** Target store whose package was taken: dark door, dimmed windows. */
  cleared?: boolean;
  /** Black Friday Mode: a "70% OFF" sign on every OPEN storefront. */
  blackFriday?: boolean;
}

export function drawStorefront(_fb: Framebuffer, _x: number, _y: number, _id: StoreId, _opts: StorefrontOpts): void {
  throw new Error('drawStorefront: not implemented yet (storefronts art agent)');
}
