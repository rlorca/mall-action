# FLICKERSOFT splash

The studio ident that opens every FLICKERSOFT game. Self-contained and reusable:
copy this folder into the next game and wire up four calls.

## What it does

1. Black screen. **FLICKERSOFT** in large rainbow letters.
2. For about a second the letters flicker on **alternate frames**, with
   neighbouring letters out of phase — the look of an NES scene with too many
   sprites on one scanline.
3. The letters settle solid, an underline wipes in from the centre, and the
   host plays a jingle.
4. **PRESENTS** appears, and the splash finishes after about 3.2 seconds.
5. Any button skips it.

## Dependencies

Only the generic pixel primitives, which are passed in:

- `Framebuffer` — an indexed drawing surface with `clear`, `rect`
- `PixelFont` — a glyph table with `w`, `h`, `advance`, `glyphs`
- a `SplashPalette` — colour indices you choose

It does not import any game module, read any global, touch the DOM, or own a
timer. Timings are in **frames at 60 Hz**, matching a fixed-step host loop.

## Usage

```ts
import { newSplash, stepSplash, drawSplash } from './flickersoft/splash';

const splash = newSplash();

// once per simulation step
const { playJingle, finished } = stepSplash(splash, anyButtonPressed);
if (playJingle) audio.play('splashJingle');
if (finished) goToTitleScreen();

// once per rendered frame
drawSplash(fb, FONT, splash, {
  black: C.BLACK,
  rainbow: RAINBOW,
  accent: C.WHITE,
}, 256, 240);
```

## Tuning

Everything adjustable lives in `SPLASH_TIMING`. `letterVisible(frame, index)` is
the flicker rule and is pure, so it can be asserted directly in tests — see
`tests/splash.test.ts` in the host project for the timing checks.

## Contract

- `drawSplash` clears the framebuffer itself and always fills it. It never
  leaves the screen blank or partially covered.
- `stepSplash` reports `playJingle` exactly once per run.
- Skipping is sticky: once `skip` is passed, `finished` stays true.
