import { PALETTE, SCREEN_W, SCREEN_H } from "../core/constants.js";
import { drawText, drawShadowText, textWidth } from "../render/font.js";

export const FLICKERSOFT_SPLASH = Object.freeze({ duration: 210, flickerEnd: 60, presentsAt: 105 });
const RAINBOW = [PALETTE.red, PALETTE.orange, PALETTE.yellow, PALETTE.lime, PALETTE.cyan, PALETTE.lavender];

/** Canvas-only, reusable FLICKERSOFT ident. Time is always a 60 Hz frame number. */
export function drawFlickersoftSplash(ctx, frame, word = "FLICKERSOFT") {
  ctx.fillStyle = PALETTE.black; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const scale = 2;
  const width = textWidth(word, scale);
  let x = Math.floor((SCREEN_W - width) / 2);
  for (let i = 0; i < word.length; i++) {
    const settled = frame >= FLICKERSOFT_SPLASH.flickerEnd;
    const visible = settled || (frame + i) % 2 === 0;
    if (visible) drawShadowText(ctx, word[i], x, 88, RAINBOW[i % RAINBOW.length], scale, "left", PALETTE.charcoal);
    x += 12;
  }
  if (frame >= FLICKERSOFT_SPLASH.flickerEnd) {
    ctx.fillStyle = RAINBOW[Math.floor(frame / 8) % RAINBOW.length];
    ctx.fillRect(Math.floor((SCREEN_W - width) / 2), 108, width, 2);
  }
  if (frame >= FLICKERSOFT_SPLASH.presentsAt) drawText(ctx, "PRESENTS", SCREEN_W / 2, 126, PALETTE.white, 1, "center");
}

export function splashLetterVisible(frame, letterIndex) {
  return frame >= FLICKERSOFT_SPLASH.flickerEnd || (frame + letterIndex) % 2 === 0;
}
