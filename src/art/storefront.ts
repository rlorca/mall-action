import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, FONT_TINY, textWidth } from '../engine/font';
import { storeDef, STORE_W, type StoreId, type StoreRole } from '../content/stores';
import { getSprite } from './registry';
import { WINDOW_STYLE, windowFrameIndex } from './storefronts';

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

// Column / row layout (relative to the storefront's top-left).
const SIGN_H = 10;
const BODY_Y = 10;
const BODY_H = 28;
const BASE_Y = 38;
const FRAME_W = 2;
const WIN_W = 28;
const DOOR_W = 20;
const WIN_L_X = FRAME_W; // 2
const DOOR_X = WIN_L_X + WIN_W; // 30
const WIN_R_X = DOOR_X + DOOR_W; // 50
/** Door blinks: 16 frames dim, 16 frames bright (about 1.9 Hz). */
const BLINK_PERIOD = 16;

interface RoleLook {
  plate: number;
  rimTop: number;
  rimBottom: number;
  text: number;
  shadow: number;
  frame: number;
  door: number;
}

const LOOK: Record<StoreRole, RoleLook> = {
  target: { plate: C.RED, rimTop: C.SALMON, rimBottom: C.BROWNRED, text: C.WHITE, shadow: C.BROWNRED, frame: C.BROWNRED, door: C.BLACK },
  powerup: { plate: C.BLUE, rimTop: C.LTBLUE, rimBottom: C.DKBLUE, text: C.WHITE, shadow: C.DKBLUE, frame: C.DKBLUE, door: C.BLACK },
  // Closed: an unlit sign and a grey frame.
  closed: { plate: C.BLACK, rimTop: C.GRAY, rimBottom: C.BLACK, text: C.GRAY, shadow: C.BLACK, frame: C.MDGRAY, door: C.BLACK },
};

function drawSign(fb: Framebuffer, x: number, y: number, name: string, look: RoleLook): void {
  fb.fillRect(x, y, STORE_W, SIGN_H, look.plate);
  fb.hLine(x, y, STORE_W, look.rimTop);
  fb.hLine(x, y + SIGN_H - 1, STORE_W, look.rimBottom);
  fb.vLine(x, y, SIGN_H, look.rimBottom);
  fb.vLine(x + STORE_W - 1, y, SIGN_H, look.rimBottom);
  fb.setPixel(x, y, look.rimTop);
  drawText(fb, name, x + STORE_W / 2, y + 2, look.text, { font: FONT_TINY, align: 'center', shadow: look.shadow });
}

function drawWindow(fb: Framebuffer, x: number, y: number, id: StoreId, side: 'L' | 'R', opts: StorefrontOpts): void {
  const st = WINDOW_STYLE[id];
  fb.fillRect(x, y, WIN_W, BODY_H, C.BLACK); // window frame
  fb.fillRect(x + 1, y + 1, WIN_W - 2, BODY_H - 2, st.bg);
  fb.fillRect(x + 1, y + BODY_H - 3, WIN_W - 2, 2, st.floor);
  const spr = getSprite(`win.${id}.${side}`);
  fb.sprite(spr, x, y, { frame: windowFrameIndex(id, side, opts.frame) });
  if (opts.cleared) fb.darkenRect(x, y, WIN_W, BODY_H, 1);
}

/**
 * The "70% OFF" Black Friday tag: a yellow sign hanging under the name plate, stacked in two lines so it
 * stays inside the door's width and leaves both window displays readable.
 */
function drawSaleTag(fb: Framebuffer, x: number, y: number): void {
  const opts = { font: FONT_TINY } as const;
  const inner = textWidth('70%', opts); // 11
  const w = inner + 4; // 1 px border + 1 px padding each side
  const h = 15;
  const bx = x + Math.floor((STORE_W - w) / 2);
  const by = y + BODY_Y + 1;
  fb.fillRect(bx, by, w, h, C.BLACK);
  fb.fillRect(bx + 1, by + 1, w - 2, h - 2, C.YELLOW);
  drawText(fb, '70%', bx + 2, by + 2, C.BLACK, opts);
  drawText(fb, 'OFF', bx + 2, by + 8, C.RED, opts);
}

export function drawStorefront(fb: Framebuffer, x: number, y: number, id: StoreId, opts: StorefrontOpts): void {
  x = Math.round(x);
  y = Math.round(y);
  const def = storeDef(id);
  const look = LOOK[def.role];
  const cleared = def.role === 'target' && opts.cleared === true;
  fb.pushClip(x, y, STORE_W, STOREFRONT_H);

  // sign plate
  drawSign(fb, x, y, def.name, look);
  if (cleared) fb.darkenRect(x, y, STORE_W, SIGN_H, 1);

  // body frame, windows, door
  fb.fillRect(x, y + BODY_Y, STORE_W, BODY_H, look.frame);
  drawWindow(fb, x + WIN_L_X, y + BODY_Y, id, 'L', { ...opts, cleared });
  drawWindow(fb, x + WIN_R_X, y + BODY_Y, id, 'R', { ...opts, cleared });
  fb.fillRect(x + DOOR_X, y + BODY_Y, DOOR_W, BODY_H, look.door);
  let doorName: string;
  let doorFrame = 0;
  if (def.role === 'closed') doorName = 'door.closed';
  else if (def.role === 'powerup') doorName = 'door.powerup';
  else if (cleared) doorName = 'door.dark';
  else {
    doorName = 'door.target';
    doorFrame = Math.floor(Math.max(0, opts.frame) / BLINK_PERIOD) & 1;
  }
  fb.sprite(getSprite(doorName), x + DOOR_X, y + BODY_Y, { frame: doorFrame });

  // base / threshold
  fb.fillRect(x, y + BASE_Y, STORE_W, 2, C.GRAY);
  fb.hLine(x, y + BASE_Y, STORE_W, C.LTGRAY);

  if (opts.blackFriday && def.role !== 'closed') drawSaleTag(fb, x, y);
  fb.popClip();
}
