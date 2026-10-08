# FLICKERSOFT splash

A self-contained studio splash, built to be reused by future FLICKERSOFT games.

- `flickersoft-splash.ts` - the whole module. It has no game state and no globals.
- Timeline (60 frames = 1 s): the word flickers on alternate frames for about one second, then settles
  with an underline and a jingle, then "PRESENTS" fades in. The splash ends after about 3 seconds, and
  any button skips it.
- Usage:

```ts
const splash = new FlickerSplash();
// once per 60 Hz frame:
splash.step(anyButtonPressedThisFrame);
splash.draw(ctx); // ctx is a 256x240 2D context
for (const e of splash.drainEvents()) { /* 'jingle' | 'pop' | 'done' */ }
```

It depends only on the shared pixel font in `src/render/text.ts` and the palette in `src/core/palette.ts`.
Tests are in `tests/splash.test.ts` (flicker timing, skip, and the done event).
