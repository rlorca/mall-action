# FLICKERSOFT boot logo

The studio splash shared by every FLICKERSOFT game: the letters come on as sprites that flicker on
alternate frames (like an NES scene with too many sprites on one scanline), then settle into the
rainbow logo with a jingle and "PRESENTS".

- `flicker.js` — timing only (pure, unit-tested in `tests/splash.test.js`).
- `SplashScene.js` — the PixiJS scene: `new SplashScene(onDone)`; any button skips.

To reuse in another game, copy this folder. The scene expects the host game's scene contract
(`container`, `enter(ctx)`, `update(ctx)`, `exit()`), `ctx.pad` / `ctx.audio`, an 8×8 `makeText`
(`../gfx/font.js`) and the NES palette `C` (`../gfx/palette.js`). Once there's a second game,
this is the first thing to move into a shared `flickersoft-kit` package.
