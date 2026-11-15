# mall-splash: the reusable FLICKERSOFT splash

Zero dependencies. Draws only filled rectangles through a tiny `Canvas` trait, using its own built-in block font,
so it can be dropped into any FLICKERSOFT game (software framebuffer, wgpu quad batcher, terminal, ...).

Timeline at 60 fps (all constants are public): black, then the word FLICKERSOFT in rainbow letters that flicker on
alternate frames (neighbours out of phase, like an NES with too many sprites on a scanline), then they settle
solid with an underline and a jingle, then PRESENTS, then done at about 3 seconds. Any button skips.

## Embedding

```rust
use mall_splash::{Canvas, Rgb, Splash, SplashEvent, JINGLE};

struct MyCanvas { /* your framebuffer */ }
impl Canvas for MyCanvas {
    fn width(&self) -> i32 { 256 }
    fn height(&self) -> i32 { 240 }
    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: Rgb) { /* fill, clipping yourself */ }
}

let mut splash = Splash::new();
// every 1/60 s:
match splash.step(any_button_pressed) {
    SplashEvent::Jingle => { /* play JINGLE: &[(hz, frames)] (or your own tune) */ }
    SplashEvent::Done => { /* go to your title screen */ }
    SplashEvent::None => {}
}
splash.draw(&mut my_canvas);
```

`rect` receives possibly off-screen or empty rectangles; clip them. `Rgb` is plain 8-bit RGB, so map it to a
palette if your game is palette based (MALL ACTION maps to the nearest NES colour).
The splash is fully deterministic: the frame counter is its only state.
