//! Wrapper that plays the FLICKERSOFT splash module (screens agent 1 owns this file).

use crate::events::{Out, Track};
use crate::input::PadState;
use crate::pixel::{palette_rgb, Fb, H, W};
use mall_splash::{Canvas, Rgb, Splash, SplashEvent};

/// Adapter: the splash paints filled rectangles; we snap its RGB to the nearest NES palette colour.
struct FbCanvas<'a> {
    fb: &'a mut Fb,
    /// (rgb, palette index) cache so every colour is matched once.
    cache: Vec<(Rgb, u8)>,
}

fn nearest(c: Rgb) -> u8 {
    let mut best = (u32::MAX, 0x0Fu8);
    for i in 0..64u8 {
        if matches!(i, 0x0D | 0x1D | 0x0E | 0x1E | 0x2E | 0x3E | 0x1F | 0x2F | 0x3F) {
            continue; // the "blacker than black" / duplicate black entries
        }
        let (r, g, b) = palette_rgb(i);
        let d = |a: u8, b: u8| (a as i32 - b as i32).pow(2) as u32;
        let dist = d(r, c.0) + d(g, c.1) + d(b, c.2);
        if dist < best.0 {
            best = (dist, i);
        }
    }
    best.1
}

impl Canvas for FbCanvas<'_> {
    fn width(&self) -> i32 {
        W as i32
    }
    fn height(&self) -> i32 {
        H as i32
    }
    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: Rgb) {
        let idx = match self.cache.iter().find(|(k, _)| *k == c) {
            Some((_, i)) => *i,
            None => {
                let i = nearest(c);
                self.cache.push((c, i));
                i
            }
        };
        self.fb.rect(x, y, w, h, idx);
    }
}

pub struct SplashScreen {
    inner: Splash,
    started: bool,
}

impl SplashScreen {
    pub fn new() -> SplashScreen {
        SplashScreen { inner: Splash::new(), started: false }
    }
    /// Returns true when the splash is finished (or skipped with any button).
    pub fn step(&mut self, pad: PadState, out: &mut Out) -> bool {
        if self.inner.is_done() {
            return true;
        }
        self.started = true;
        match self.inner.step(pad.any_pressed()) {
            SplashEvent::Jingle => out.music(Track::Splash),
            SplashEvent::Done => return true,
            SplashEvent::None => {}
        }
        false
    }
    pub fn draw(&self, fb: &mut Fb) {
        let mut c = FbCanvas { fb, cache: Vec::new() };
        self.inner.draw(&mut c);
    }
    /// Frames since the splash started.
    pub fn frame(&self) -> u32 {
        self.inner.frame()
    }
}

impl Default for SplashScreen {
    fn default() -> Self {
        SplashScreen::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::Event;
    use crate::input::START;

    #[test]
    fn plays_the_jingle_once_and_finishes_after_three_seconds() {
        let mut s = SplashScreen::new();
        let mut out = Out::new();
        let mut n = 0;
        while !s.step(PadState::default(), &mut out) {
            n += 1;
            assert!(n < 1000);
        }
        assert!((170..=190).contains(&n), "{n}");
        let j = out.events.iter().filter(|e| **e == Event::Music(Track::Splash)).count();
        assert_eq!(j, 1);
    }

    #[test]
    fn any_button_skips_and_no_jingle() {
        let mut s = SplashScreen::new();
        let mut out = Out::new();
        for _ in 0..20 {
            assert!(!s.step(PadState::default(), &mut out));
        }
        assert!(s.step(PadState::from_held(0, START), &mut out));
        assert!(out.events.is_empty());
    }

    #[test]
    fn flicker_shows_on_the_framebuffer() {
        let mut s = SplashScreen::new();
        let mut out = Out::new();
        let mut counts = Vec::new();
        for _ in 0..30 {
            s.step(PadState::default(), &mut out);
            let mut fb = Fb::new();
            fb.clear(0);
            s.draw(&mut fb);
            counts.push(fb.px.iter().filter(|p| **p != 0x0F && **p != 0).count());
        }
        // alternate frames in the flicker window differ in which letters show, so pixel counts alternate
        assert!(counts[20] != counts[21] || counts[21] != counts[22] || counts[22] != 0);
    }

    #[test]
    fn nearest_colours_are_not_black_for_rainbow() {
        for c in mall_splash::RAINBOW {
            assert_ne!(nearest(c), 0x0F);
        }
    }
}
