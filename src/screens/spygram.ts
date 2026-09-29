// SPYGRAM card (a parody photo-app post): magenta header, a mini-scene "photo", caption, likes, one comment.
// drawSpygramCard is stateless: everything derives from `frames` so callers only count frames.
import { C } from '../core/palette';
import { SPYGRAM_COMPLETE, type Spygram } from '../data/copy';
import type { Surface } from '../art/surface';
import { drawCityline, drawNightSky, CITYLINE_H } from '../art/backdrops';

/** Card size in px (wide enough for 21-char captions/comments in the 8x8 font). */
export const SPYGRAM_CARD_W = 184;
export const SPYGRAM_CARD_H = 146;

const PHOTO_X = 4;
const PHOTO_Y = 18;
const PHOTO_W = SPYGRAM_CARD_W - 8;
const PHOTO_H = 70;

/** How fast the like counter climbs (frames to reach the "first plateau"). */
const CLIMB_FRAMES = 90;

/**
 * Like counter after `frames` frames. Climbs quickly (ease-out) to a few hundred within ~90 frames, then keeps
 * creeping up. Monotonic non-decreasing in `frames`; 0 at frame 0. `seedish` varies the final number per post.
 */
export function likesAt(frames: number, seedish = 0): number {
  const f = Math.max(0, Math.floor(frames));
  const target = 180 + (Math.abs(Math.floor(seedish)) % 260);
  const t = Math.min(1, f / CLIMB_FRAMES);
  const eased = 1 - (1 - t) * (1 - t);
  const creep = f > CLIMB_FRAMES ? Math.floor((f - CLIMB_FRAMES) / 5) : 0;
  return Math.floor(target * eased) + creep;
}

function seedOf(entry: Spygram): number {
  let h = 0;
  for (const ch of entry.caption[0] + entry.caption[1]) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function isComplete(entry: Spygram): boolean {
  return SPYGRAM_COMPLETE.some((e) => e.caption[0] === entry.caption[0] && e.caption[1] === entry.caption[1]);
}

function drawCamera(s: Surface, x: number, y: number): void {
  s.rect(x + 1, y + 1, 10, 7, C.WHITE);
  s.rect(x + 3, y, 4, 2, C.WHITE);
  s.rect(x + 4, y + 2, 4, 4, C.MAGENTA);
  s.rect(x + 5, y + 3, 2, 2, C.WHITE);
  s.px(x + 9, y + 2, C.MAGENTA);
}

/** The framed mini-scene. Rooftop selfie for arrival posts, parking garage with the wagon for mission-complete ones. */
function drawPhoto(s: Surface, x: number, y: number, entry: Spygram, frames: number): void {
  s.clip(x, y, PHOTO_W, PHOTO_H);
  if (isComplete(entry)) {
    // parking garage
    s.rect(x, y, PHOTO_W, PHOTO_H, C.GRAY_DD);
    s.rect(x, y, PHOTO_W, 10, C.BLACK);
    for (let px = x + 14; px < x + PHOTO_W; px += 52) {
      s.rect(px, y + 10, 12, 46, C.GRAY_D);
      s.rect(px, y + 10, 2, 46, C.GRAY_M);
      for (let k = 0; k < 4; k++) s.rect(px, y + 44 + k * 3, 12, 3, k & 1 ? C.BLACK : C.YELLOW);
    }
    s.rect(x + PHOTO_W - 38, y + 14, 30, 10, C.GREEN_D);
    s.text('EXIT', x + PHOTO_W - 23, y + 17, C.WHITE, { small: true, align: 'center' });
    s.rect(x, y + 56, PHOTO_W, PHOTO_H - 56, C.GRAY_D);
    s.hline(x, y + 56, PHOTO_W, C.BLACK);
    s.spriteScaled('getaway_wagon', x + 14, y + 22, 2);
    s.spriteScaled('agent_stand', x + 118, y + 20, 2);
    s.px(x + 148, y + 30, C.WHITE); // little glint
  } else {
    // rooftop, dusk
    drawNightSky(s, x, y, PHOTO_W, PHOTO_H, frames);
    drawCityline(s, x, y + PHOTO_H - CITYLINE_H - 12, PHOTO_W, frames);
    s.rect(x, y + PHOTO_H - 14, PHOTO_W, 14, C.GRAY_D);
    s.hline(x, y + PHOTO_H - 14, PHOTO_W, C.GRAY_L);
    for (let px = x + 6; px < x + PHOTO_W; px += 16) s.vline(px, y + PHOTO_H - 12, 12, C.GRAY_DD);
    s.spriteScaled('agent_selfie', x + 76, y + 16, 2, { frame: (frames >> 4) & 1 });
  }
  s.unclip();
  s.frame(x - 1, y - 1, PHOTO_W + 2, PHOTO_H + 2, C.BLACK);
}

/** Draw the SPYGRAM post with its top-left corner at (x, y). Size SPYGRAM_CARD_W x SPYGRAM_CARD_H. */
export function drawSpygramCard(s: Surface, entry: Spygram, opts: { x: number; y: number; frames: number; name?: string }): void {
  const { x, y, frames } = opts;
  const name = opts.name ?? '@AGENT7';
  // card body
  s.rect(x, y, SPYGRAM_CARD_W, SPYGRAM_CARD_H, C.BLACK);
  s.rect(x + 1, y + 1, SPYGRAM_CARD_W - 2, SPYGRAM_CARD_H - 2, C.WHITE);
  // header
  s.rect(x + 1, y + 1, SPYGRAM_CARD_W - 2, 15, C.MAGENTA);
  s.hline(x + 1, y + 16, SPYGRAM_CARD_W - 2, C.PURPLE);
  drawCamera(s, x + 5, y + 4);
  s.text('SPYGRAM', x + 20, y + 5, C.WHITE, { shadow: C.PURPLE_D });
  s.text(name, x + SPYGRAM_CARD_W - 5, y + 6, C.PINK_L, { small: true, align: 'right' });
  // photo
  drawPhoto(s, x + PHOTO_X, y + PHOTO_Y, entry, frames);
  // like counter
  const likes = likesAt(frames, seedOf(entry));
  const pulse = frames % 12 < 3 && frames < CLIMB_FRAMES;
  s.text('♥', x + 5, y + 92, pulse ? C.RED_L : C.RED);
  s.text(`${likes} LIKES`, x + 15, y + 92, C.BLACK);
  // caption
  s.text(entry.caption[0], x + 8, y + 104, C.BLACK);
  s.text(entry.caption[1], x + 8, y + 114, C.BLACK);
  // divider + comment with avatar
  s.hline(x + 4, y + 126, SPYGRAM_CARD_W - 8, C.GRAY_L);
  s.rect(x + 4, y + 131, 8, 8, C.BLACK);
  s.rect(x + 5, y + 132, 6, 6, C.MAGENTA_L);
  s.rect(x + 7, y + 133, 2, 2, C.WHITE);
  s.rect(x + 6, y + 136, 4, 2, C.WHITE);
  const colon = entry.comment.indexOf(':');
  if (colon > 0) {
    const who = entry.comment.slice(0, colon + 1);
    s.text(who, x + 14, y + 131, C.PURPLE);
    s.text(entry.comment.slice(colon + 1), x + 14 + who.length * 8, y + 131, C.GRAY_D);
  } else s.text(entry.comment, x + 14, y + 131, C.GRAY_D);
}
