# FLICKERSOFT splash

A tiny, self-contained splash screen module used by every FLICKERSOFT game. It has **no imports** from the rest of
this repository, so you can copy `src/flickersoft/` into the next game as is.

What it does:

1. Black screen (~0.2 s).
2. The word **FLICKERSOFT** appears in big rainbow letters that flicker on **alternate frames**, neighbouring
   letters out of phase - the NES look of too many sprites on one scanline - for about a second.
3. The letters settle solid, a rainbow underline appears and `jingle` is raised once (the host plays a chime).
4. "PRESENTS" follows. At frame 190 (~3.2 s) `done` becomes true and the host shows its title screen.
5. Any button skips it (`step(true)`).

## API

```ts
import { FlickersoftSplash, drawFlickersoft, letterVisible, SPLASH } from './flickersoft/splash';

const splash = new FlickersoftSplash();
// every 60 Hz simulation step:
splash.step(anyButtonPressed);
if (splash.jingle) playChime();
if (splash.done) showTitle();
// every rendered frame (any 2D context, default 256x240 logical size):
drawFlickersoft(ctx, splash);
```

* `letterVisible(i, frame)` - pure function: is letter `i` drawn on `frame`? (unit-tested: neighbours are out of phase)
* `SPLASH` - the timeline constants (`blackUntil`, `flickerUntil`, `presentsAt`, `end`).
* The module draws with `fillRect` only, from its own 5x7 glyph table (F L I C K E R S O T P N).
