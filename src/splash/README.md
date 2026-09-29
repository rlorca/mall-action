# FLICKERSOFT splash

The studio intro used by every FLICKERSOFT game: black screen, **FLICKERSOFT** in big rainbow letters that
flicker on alternate frames (neighbouring letters out of phase, like an NES scene with too many sprites on one
scanline), then settle solid with an underline and a jingle, then **PRESENTS**. Any button skips it.

Self-contained: no imports outside this folder, its own 5x7 capital font and NES colours.

```ts
import { createSplash, stepSplash, drawSplash, playSplashJingle, DEFAULT_SPLASH } from './splash';

const splash = createSplash();
// every 60 Hz frame:
const ev = stepSplash(splash, anyButtonPressed);          // pure; 'jingle' on the frame the letters settle
if (ev === 'jingle' && audioCtx) playSplashJingle(audioCtx, audioCtx.destination);
drawSplash(ctx2d, splash);                                 // onto a 256x240 canvas
if (splash.done) goToTitle();
```

- `logic.ts`: pure timing (`letterVisible`, `isSettled`, `underlineProgress`, `showSubtitle`), unit-tested.
- `draw.ts`: Canvas 2D renderer for any canvas size (scales the letters to fit).
- `jingle.ts`: WebAudio pulse + triangle jingle.
- Customise with a `SplashConfig` (`word`, `subtitle`, and the frame timings `flickerEnd`, `presentsAt`, `endAt`).
