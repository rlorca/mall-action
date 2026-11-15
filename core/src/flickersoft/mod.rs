//! FLICKERSOFT splash: a self-contained, reusable studio splash for every FLICKERSOFT game.
//!
//! Depends only on `pixel::Canvas`, `pixel::c` (palette names) and `font` — no game rules.
//! Usage: create `Splash::new()`, call `step(any_button_pressed)` once per 60 Hz frame, `draw(&mut canvas)`
//! to render, and play `Splash::jingle_now()` / `Splash::done()` events from the shell.
//! See README.md in this folder.
use crate::font;
use crate::pixel::{c, Canvas};

pub const NAME: &str = "FLICKERSOFT";
/// Frames of NES "too many sprites on a scanline" flicker before the letters settle.
pub const FLICKER_FRAMES: i32 = 60;
/// Frame on which the underline appears and the jingle plays.
pub const SETTLE_AT: i32 = FLICKER_FRAMES;
pub const PRESENTS_AT: i32 = SETTLE_AT + 40;
pub const TOTAL_FRAMES: i32 = 190;

const RAINBOW: [u8; 6] = [c::RED, c::ORANGE, c::YELLOW, c::GREEN_L, c::BLUE_L, c::PURPLE_L];

/// Is letter `i` drawn on frame `t`? During the flicker window neighbouring letters are
/// out of phase and every letter blinks on alternate frames; afterwards all are solid.
pub fn letter_visible(t: i32, i: usize) -> bool {
    t >= FLICKER_FRAMES || (t + i as i32) % 2 == 0
}

#[derive(Clone, Debug, Default)]
pub struct Splash {
    pub t: i32,
    skipped: bool,
    jingle_sent: bool,
}

impl Splash {
    pub fn new() -> Splash {
        Splash::default()
    }
    /// Advance one frame. Any button press skips.
    pub fn step(&mut self, any_pressed: bool) {
        self.t += 1;
        if any_pressed && self.t > 2 {
            self.skipped = true;
        }
    }
    /// True exactly once, on the frame the jingle should start.
    pub fn jingle_now(&mut self) -> bool {
        if !self.jingle_sent && self.t >= SETTLE_AT && !self.skipped {
            self.jingle_sent = true;
            return true;
        }
        false
    }
    pub fn done(&self) -> bool {
        self.skipped || self.t >= TOTAL_FRAMES
    }
    pub fn draw(&self, cv: &mut Canvas) {
        cv.clear(c::BLACK);
        let k = 3;
        let w = font::big_width(NAME, k);
        let x0 = (cv.w as i32 - w) / 2;
        let y0 = cv.h as i32 / 2 - 14;
        for (i, ch) in NAME.chars().enumerate() {
            if !letter_visible(self.t, i) {
                continue;
            }
            let col = RAINBOW[i % RAINBOW.len()];
            let s: String = ch.to_string();
            let x = x0 + i as i32 * font::ADV * k;
            font::draw_text_big(cv, x + k, y0 + k, &s, c::GRAY_D, k);
            font::draw_text_big(cv, x, y0, &s, col, k);
        }
        if self.t >= SETTLE_AT {
            let grow = ((self.t - SETTLE_AT) * 8).min(w);
            let cx = cv.w as i32 / 2;
            cv.rect(cx - grow / 2, y0 + 7 * k + 4, grow, 2, c::WHITE);
        }
        if self.t >= PRESENTS_AT {
            font::draw_text_center(cv, cv.w as i32 / 2, y0 + 7 * k + 16, "PRESENTS", c::GRAY_L);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn letters_flicker_on_alternate_frames_with_neighbours_out_of_phase() {
        for t in 0..FLICKER_FRAMES - 2 {
            for i in 0..NAME.len() - 1 {
                assert_ne!(letter_visible(t, i), letter_visible(t, i + 1), "t={t} i={i}");
                assert_ne!(letter_visible(t, i), letter_visible(t + 1, i));
            }
        }
    }
    #[test]
    fn letters_settle_solid_after_about_a_second() {
        for i in 0..NAME.len() {
            assert!(letter_visible(FLICKER_FRAMES, i));
            assert!(letter_visible(FLICKER_FRAMES + 7, i));
        }
        assert!((50..=70).contains(&FLICKER_FRAMES));
    }
    #[test]
    fn ends_after_about_three_seconds_and_any_button_skips() {
        let mut s = Splash::new();
        let mut n = 0;
        while !s.done() {
            s.step(false);
            n += 1;
        }
        assert!((170..=200).contains(&n), "{n}");
        let mut s = Splash::new();
        s.step(false);
        s.step(false);
        s.step(false);
        s.step(true);
        assert!(s.done());
    }
    #[test]
    fn jingle_plays_once_when_the_letters_settle() {
        let mut s = Splash::new();
        let mut fired = vec![];
        for _ in 0..TOTAL_FRAMES {
            s.step(false);
            if s.jingle_now() {
                fired.push(s.t);
            }
        }
        assert_eq!(fired, vec![SETTLE_AT]);
    }
    #[test]
    fn draw_never_panics_and_shows_presents_late() {
        let mut s = Splash::new();
        let mut cv = Canvas::new(256, 240);
        for _ in 0..TOTAL_FRAMES {
            s.step(false);
            s.draw(&mut cv);
        }
    }
}
