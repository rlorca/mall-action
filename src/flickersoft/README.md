# FLICKERSOFT splash

The studio splash for every FLICKERSOFT game: a black screen, the word **FLICKERSOFT** in large rainbow
letters that flicker on alternate frames (neighbouring letters out of phase, like an NES scene with too
many sprites on one scanline), then settle solid with an underline and a jingle, then **PRESENTS**.

It is self-contained. It imports only from `src/engine` (framebuffer, font, palette, pad types), has no
idea what game it is in, and asks for sound through a callback. To reuse it in another game, copy this
folder together with the `src/engine` files it imports (`framebuffer`, `font`, `palette`, `pad`).

## Using it

```ts
import { FlickerSplash } from './flickersoft';

const splash = new FlickerSplash({ onJingle: () => audio.play('splash') });

// every 60 Hz simulation step:
splash.step(pad);          // pad = { held, pressed, released }; any newly pressed button skips
// every render:
splash.draw(framebuffer);  // clears the framebuffer to black and draws the current frame
// when:
if (splash.done) goToTitle();
```

* `step(pad?)` advances one 60 Hz frame. Pass the virtual pad; any newly pressed button (`pad.pressed != 0`)
  ends the splash at once. A held button does not skip, and a skipped splash never fires the jingle.
* `draw(fb)` is pure with respect to the splash (it only reads state) and clears the whole framebuffer.
* `frame` is the number of steps taken; `done`, `settled` (letters are solid), `skipped` are read-only.
* Options: `text` / `presents` change the words (default `FLICKERSOFT` / `PRESENTS`; keep the word to about 11
  letters at the default size so it fits 256 px).

## Timing (60 Hz frames, all constants exported from `splash.ts`)

| Frames | What |
|---|---|
| 0 - 5 | black |
| 6 - 65 | **flicker** (`FLICKER_START` .. `FLICKER_END`, 60 frames = 1 s): letter *i* is drawn only when `(frame + i)` is even, so every letter blinks every other frame and neighbours are always opposite |
| 66 | letters solid, underline wipes in (14 frames), a white shine sweeps across, **`onJingle()` fires exactly once** |
| 100 | `PRESENTS` fades in |
| 180 | `done` (`TOTAL_FRAMES`, 3 s) |

`letterVisible(i, frame)` is the pure visibility rule; the tests assert it against what actually lands in the framebuffer.

## Hooking up sound

The module never touches audio. Give it `onJingle` and play whatever you like there (in MALL ACTION the
`SplashScreen` adapter in `src/game/screens/splash.ts` flips a flag and reports the `'splash'` jingle through
`music()`). If the user skips the splash before the letters settle, the callback is never called.

## Tests

`splash.test.ts`: alternate-frame visibility, neighbouring letters out of phase, framebuffer matches the
visibility rule, solid after the flicker phase, underline and PRESENTS timing, jingle fires once, total length, skip.
