use super::screen::Screen;
use crate::audio_ids::{MusicId, SfxId};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::pad::Pad;
use crate::flickersoft::FlickerSplash;

/// Screen adapter around the reusable FLICKERSOFT splash. The splash itself knows nothing about audio:
/// `FlickerSplash::step` reports the jingle frame, which sets a flag, and `music()` then reports the one-shot
/// `Splash` jingle. (The TS `onJingle` callback is replaced by the return value to avoid a shared-state closure.)
pub struct SplashScreen {
    pub flicker: FlickerSplash,
    jingle: bool,
}

impl SplashScreen {
    pub fn new() -> SplashScreen {
        SplashScreen { flicker: FlickerSplash::new(Default::default()), jingle: false }
    }

    pub fn frame(&self) -> i32 {
        self.flicker.frame()
    }

    pub fn draw(&self, fb: &mut Framebuffer) {
        self.flicker.draw(fb);
    }
}

impl Default for SplashScreen {
    fn default() -> Self {
        Self::new()
    }
}

impl Screen for SplashScreen {
    fn step(&mut self, pad: &Pad) {
        if self.flicker.step(pad) {
            self.jingle = true;
        }
    }

    fn done(&self) -> bool {
        self.flicker.done()
    }

    /// Silence until the letters settle, then the studio jingle.
    fn music(&self) -> Option<MusicId> {
        if self.jingle {
            Some(MusicId::Splash)
        } else {
            None
        }
    }

    fn drain_sfx(&mut self) -> Vec<SfxId> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::pad::{btn, NO_PAD};
    use crate::flickersoft::{FLICKER_END, TOTAL_FRAMES};

    fn press(mask: u32) -> Pad {
        Pad { held: mask, pressed: mask, released: 0 }
    }

    #[test]
    fn is_silent_until_the_letters_settle_then_asks_for_the_splash_jingle() {
        let mut s = SplashScreen::new();
        while s.frame() < FLICKER_END - 1 {
            s.step(&NO_PAD);
            assert_eq!(s.music(), None);
        }
        s.step(&NO_PAD);
        assert_eq!(s.music(), Some(MusicId::Splash));
    }

    #[test]
    fn finishes_after_about_3_seconds() {
        let mut s = SplashScreen::new();
        let mut n = 0;
        while !s.done() && n < 1000 {
            s.step(&NO_PAD);
            n += 1;
        }
        assert_eq!(n, TOTAL_FRAMES);
        assert!(s.drain_sfx().is_empty());
    }

    #[test]
    fn any_button_skips_it_with_no_jingle_if_it_was_early() {
        let mut s = SplashScreen::new();
        for _ in 0..10 {
            s.step(&NO_PAD);
        }
        s.step(&press(btn::A));
        assert!(s.done());
        assert_eq!(s.music(), None);
    }
}
