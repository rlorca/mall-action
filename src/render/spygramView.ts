import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';
import type { SpygramPost } from '../content/copy';
import { UI } from '../content/copy';
import { SCREEN_TEXT } from '../game/screens/screentext';
import { blitScaledByName, hash01, withCommas, H, W } from './screenFx';

/**
 * SPYGRAM card: magenta header with the app name, the agent's photo in a frame, a like counter that
 * climbs quickly, the caption and one comment. Draws ONLY the card (with a drop shadow), at any position,
 * so the roof-arrival selfie and the level-clear post both use it.
 *
 *   drawSpygram(fb, post, spygramLikes(frame, seed), frame, { x, y, photo })
 */
export const SPYGRAM_CARD_W = 184;
export const SPYGRAM_CARD_H = 190;
const PHOTO = { dx: 8, dy: 36, w: 168, h: 96 } as const;

/** Draws the contents of the photo box; the box is clipped to (x, y, w, h). */
export type PhotoFn = (fb: Framebuffer, x: number, y: number, w: number, h: number, frame: number) => void;

export interface SpygramOpts {
  /** Top-left of the card; defaults to centred on the 256x240 screen. */
  x?: number;
  y?: number;
  /** Custom photo; the default is the agent taking a selfie against the night sky. */
  photo?: PhotoFn;
}

/** Final like count of a post for this seed. */
function likeTarget(seed: number): number {
  return 300 + Math.floor(hash01(seed, 11) * 700);
}

const LIKE_RAMP_FRAMES = 150;

/**
 * Likes after `frame` frames of the post being on screen. Pure, never decreases, starts at 0 and climbs
 * quickly (fast start, easing to the target within ~2.5 s, then still ticking up slowly). Updates every 3 frames.
 */
export function spygramLikes(frame: number, seed: number): number {
  const f = Math.max(0, Math.floor(frame / 3) * 3);
  const p = Math.min(1, f / LIKE_RAMP_FRAMES);
  const eased = 1 - (1 - p) * (1 - p);
  return Math.floor(likeTarget(seed) * eased) + Math.floor(Math.max(0, f - LIKE_RAMP_FRAMES) / 30);
}

/** Default photo: night sky, a rooftop ledge and the agent holding up a phone, scaled 3x. */
export const defaultSpygramPhoto: PhotoFn = (fb, x, y, w, h, frame) => {
  const bands = [C.BLACK, C.DKBLUE, C.DKBLUE, C.VIOLET, C.PURPLE0];
  const bh = Math.ceil((h - 20) / bands.length);
  bands.forEach((c, i) => fb.fillRect(x, y + i * bh, w, bh, c));
  for (let i = 0; i < 14; i++) {
    const sx = x + Math.floor(hash01(i, 3) * w);
    const sy = y + Math.floor(hash01(i, 4) * (h - 40));
    fb.setPixel(sx, sy, (frame + i * 7) % 40 < 30 ? C.WHITE : C.LTGRAY);
  }
  fb.fillRect(x, y + h - 20, w, 20, C.MDGRAY);
  fb.hLine(x, y + h - 20, w, C.WHITE);
  // agent selfie at 3x, standing on the ledge; frame 1 of the sprite is the flash
  if (!blitScaledByName(fb, 'agent.selfie', x + Math.floor(w / 2) - 24, y + h - 20 - 72, 3, { frame: frame % 90 < 4 ? 1 : 0 })) {
    fb.strokeRect(x + Math.floor(w / 2) - 24, y + h - 92, 48, 72, C.HOTPINK);
  }
};

function drawCamera(fb: Framebuffer, x: number, y: number): void {
  fb.fillRect(x, y + 2, 12, 8, C.WHITE);
  fb.fillRect(x + 3, y, 5, 2, C.WHITE);
  fb.fillRect(x + 4, y + 3, 4, 4, C.MAGENTA);
  fb.fillRect(x + 5, y + 4, 2, 2, C.WHITE);
}

function drawHeart(fb: Framebuffer, x: number, y: number, color: number): void {
  // 7x6 heart
  const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === 'X') fb.setPixel(x + i, y + j, color);
  });
}

/** Draws the card. `likes` comes from spygramLikes(); `frame` = frames since the card appeared. */
export function drawSpygram(fb: Framebuffer, post: SpygramPost, likes: number, frame: number, opts: SpygramOpts = {}): void {
  const x = Math.round(opts.x ?? (W - SPYGRAM_CARD_W) / 2);
  const y = Math.round(opts.y ?? (H - SPYGRAM_CARD_H) / 2);
  const w = SPYGRAM_CARD_W;
  const h = SPYGRAM_CARD_H;

  // drop shadow + card body
  fb.fillRect(x + 3, y + 3, w, h, C.BLACK);
  fb.fillRect(x, y, w, h, C.WHITE);
  fb.strokeRect(x, y, w, h, C.BLACK);

  // header
  fb.fillRect(x + 1, y + 1, w - 2, 19, C.MAGENTA);
  fb.hLine(x + 1, y + 20, w - 2, C.PURPLE0);
  drawCamera(fb, x + 8, y + 5);
  drawText(fb, UI.spygram, x + 26, y + 3, C.WHITE, { scale: 2, shadow: C.PURPLE0 });

  // user row
  fb.fillCircle(x + 14, y + 29, 5, C.MAGENTA);
  fb.fillCircle(x + 14, y + 29, 3, C.PALEPINK);
  drawText(fb, SCREEN_TEXT.spygram.user, x + 24, y + 26, C.BLACK);

  // photo, framed
  const px = x + PHOTO.dx;
  const py = y + PHOTO.dy;
  fb.strokeRect(px - 2, py - 2, PHOTO.w + 4, PHOTO.h + 4, C.BLACK);
  fb.pushClip(px, py, PHOTO.w, PHOTO.h);
  (opts.photo ?? defaultSpygramPhoto)(fb, px, py, PHOTO.w, PHOTO.h, frame);
  fb.popClip();

  // like counter
  const ly = py + PHOTO.h + 7;
  drawHeart(fb, x + 9, ly, frame % 30 < 6 ? C.PINK : C.RED);
  drawText(fb, `${withCommas(likes)} ${SCREEN_TEXT.spygram.likes}`, x + 20, ly, C.BLACK);

  // caption
  let cy = ly + 12;
  for (const line of post.caption) {
    drawText(fb, line, x + 9, cy, C.BLACK);
    cy += 9;
  }

  // comment: "WHO: TEXT" with the name in magenta
  cy += 3;
  const colon = post.comment.indexOf(':');
  if (colon >= 0) {
    const who = post.comment.slice(0, colon + 1);
    drawText(fb, who, x + 9, cy, C.MAGENTA);
    drawText(fb, post.comment.slice(colon + 1), x + 9 + textWidth(who) + 6, cy, C.MDGRAY);
  } else {
    drawText(fb, post.comment, x + 9, cy, C.MDGRAY);
  }
}
