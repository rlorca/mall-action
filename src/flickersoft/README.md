# FLICKERSOFT splash

Self-contained studio splash for FLICKERSOFT games. No imports from the rest of the game, no
assets, no `Date`/`Math.random`: fully deterministic and frame-based (60 Hz).

Copy the `flickersoft/` folder into a new game and:

```ts
import { FlickerSplash } from './flickersoft';

const splash = new FlickerSplash({
  width: 256, height: 240,        // logical drawing area
  skipAllowed: true,              // any button skips (default true)
  onJingle: () => playJingle(),   // fires exactly once when the letters settle
});

// every simulation step (60 Hz):
splash.update(anyButtonPressed);
// every render:
splash.draw(ctx2d);               // plain CanvasRenderingContext2D of size width x height
if (splash.done) startTitleScreen();
```

Timeline (frames): 0-59 letters flicker (even letters on even frames, odd on odd, like an NES
scanline with too many sprites); 60 letters settle solid with a rainbow underline and the jingle;
90-110 "PRESENTS" fades in; 180 `done = true`. A skip sets `done` immediately (no jingle).

Files: `timing.ts` (pure timing, `letterVisible`), `letters.ts` (own 5x7 bitmap font),
`index.ts` (`FlickerSplash`).
