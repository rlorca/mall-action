# FLICKERSOFT splash

A self-contained studio splash for FLICKERSOFT games. `splash.ts` has **no imports**: copy the
folder into another project and wire three things.

```ts
import { createSplash, stepSplash, drawSplash, SPLASH_JINGLE } from './flickersoft/splash';

const splash = createSplash();

// once per 60 Hz simulation step:
for (const ev of stepSplash(splash, anyButtonPressed)) {
  if (ev === 'jingle') playNotes(SPLASH_JINGLE); // [midiNote, startFrame, lengthFrames][]
  if (ev === 'done') showTitleScreen();
}

// once per rendered frame:
drawSplash(splash, { width: 256, height: 240, fillRect(x, y, w, h, rgb) { /* your renderer */ } });
```

What it does (all timings in frames at 60 Hz, see `SPLASH_TIMING`):

1. Black screen; `FLICKERSOFT` in big rainbow letters. For the first second the letters show on
   **alternate frames**, with neighbouring letters out of phase (`letterVisible`), imitating an NES
   scene with too many sprites on one scanline.
2. The letters settle solid, an underline grows, and the `jingle` event fires.
3. `PRESENTS` appears; about 3 s after settling the `done` event fires.
4. Any button (`anyPressed = true`) skips straight to `done`.

The state is plain data (`{ t, done }`), so it is trivially testable: see `tests/splash.test.ts`.
