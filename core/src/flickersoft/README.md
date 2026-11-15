# FLICKERSOFT splash (reusable module)

A self-contained studio splash for FLICKERSOFT games:

1. Black screen. The word **FLICKERSOFT** appears in big rainbow letters.
2. For ~1 s (`FLICKER_FRAMES`) the letters flicker on **alternate frames**, with neighbouring letters out of phase,
   imitating an NES scene with too many sprites on one scanline.
3. The letters settle solid, an underline grows and the jingle fires (`Splash::jingle_now()`), then `PRESENTS` appears.
4. `Splash::done()` becomes true after ~3 s (`TOTAL_FRAMES`) or as soon as any button is pressed.

Dependencies: only `crate::pixel::{Canvas, c}` and `crate::font`. No game rules, no audio: the shell plays the jingle
(here `audio::Song::FlickerJingle`) when `jingle_now()` returns true.

```rust
let mut splash = Splash::new();
loop {
    splash.step(any_button_pressed);       // once per 60 Hz simulation step
    if splash.jingle_now() { play_jingle(); }
    splash.draw(&mut canvas);              // 256x240 canvas
    if splash.done() { break; }
}
```

To reuse in another game, copy this folder plus `pixel.rs` (Canvas/palette) and `font.rs`.
