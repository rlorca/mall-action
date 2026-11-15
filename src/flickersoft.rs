//! FLICKERSOFT splash
//!
//! The studio splash for every FLICKERSOFT game: a black screen, the word **FLICKERSOFT** in large rainbow
//! letters that flicker on alternate frames (neighbouring letters out of phase, like an NES scene with too
//! many sprites on one scanline), then settle solid with an underline and a jingle, then **PRESENTS**.
//!
//! It is self-contained. It imports only from `crate::engine` (framebuffer, font, palette, pad types), has no
//! idea what game it is in, and asks for sound through a callback. To reuse it in another game, copy this
//! file together with the `engine` files it imports (`framebuffer`, `font`, `palette`, `pad`).
//!
//! # Using it
//!
//! ```ignore
//! let mut splash = FlickerSplash::new(FlickerSplashOpts::default());
//!
//! // every 60 Hz simulation step (pad = { held, pressed, released }; any newly pressed button skips):
//! let jingle_now = splash.step(&pad);   // true on the one frame the jingle should start
//! // every render:
//! splash.draw(&mut framebuffer);        // clears the framebuffer to black and draws the current frame
//! // when:
//! if splash.done() { go_to_title(); }
//! ```
//!
//! * `step(&pad)` advances one 60 Hz frame. Pass the virtual pad; any newly pressed button (`pad.pressed != 0`)
//!   ends the splash at once. A held button does not skip, and a skipped splash never fires the jingle.
//!   (`tick()` steps with no pad.) The return value is `true` exactly on the frame the jingle fires; the
//!   `on_jingle` option is the callback form of the same thing.
//! * `draw(fb)` is pure with respect to the splash (it only reads state) and clears the whole framebuffer.
//! * `frame()` is the number of steps taken; `done()`, `settled()` (letters are solid), `skipped()` are read-only.
//! * Options: `text` / `presents` change the words (default `FLICKERSOFT` / `PRESENTS`; keep the word to about 11
//!   letters at the default size so it fits 256 px).
//!
//! # Timing (60 Hz frames, all constants exported from this module)
//!
//! | Frames | What |
//! |---|---|
//! | 0 - 5 | black |
//! | 6 - 65 | **flicker** (`FLICKER_START` .. `FLICKER_END`, 60 frames = 1 s): letter *i* is drawn only when `(frame + i)` is even, so every letter blinks every other frame and neighbours are always opposite |
//! | 66 | letters solid, underline wipes in (14 frames), a white shine sweeps across, **the jingle fires exactly once** |
//! | 100 | `PRESENTS` fades in |
//! | 180 | `done` (`TOTAL_FRAMES`, 3 s) |
//!
//! `letter_visible(i, frame)` is the pure visibility rule; the tests assert it against what actually lands in the framebuffer.
//!
//! # Hooking up sound
//!
//! The module never touches audio. Use the return value of `step` (or give it `on_jingle`) and play whatever
//! you like there (in MALL ACTION the `SplashScreen` adapter in `game/screens/splash.rs` records the flag and
//! reports the `Splash` jingle through `music()`). If the user skips the splash before the letters settle, the
//! jingle is never requested.
//!
//! # Tests
//!
//! alternate-frame visibility, neighbouring letters out of phase, framebuffer matches the
//! visibility rule, solid after the flicker phase, underline and PRESENTS timing, jingle fires once, total length, skip.
//!
//! The FLICKERSOFT splash itself. SELF-CONTAINED and reusable: it only imports from `engine`
//! (framebuffer, font, palette, pad types) and knows nothing about the game, its audio or its
//! scenes. Sound is injected through `on_jingle`.
//!
//! Timeline (60 Hz frames, `frame` = steps taken so far):
//!   0 .. FLICKER_START      black screen
//!   FLICKER_START .. FLICKER_END   rainbow letters FLICKER on alternate frames, neighbouring letters
//!                           out of phase (imitating an NES scene with too many sprites on a scanline)
//!   FLICKER_END             letters settle solid, underline wipes in, a shine sweeps across, jingle
//!   PRESENTS_AT             "PRESENTS" fades in
//!   TOTAL_FRAMES            done (any button press skips earlier)

use crate::engine::font::{draw_text, text_width, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::num::round_i;
use crate::engine::pad::Pad;
use crate::engine::palette::{c, darken};

pub const STUDIO_NAME: &str = "FLICKERSOFT";
pub const STUDIO_PRESENTS: &str = "PRESENTS";

pub const FLICKER_START: i32 = 6;
pub const FLICKER_END: i32 = 66; // the flicker lasts 60 frames = 1 s
pub const UNDERLINE_FRAMES: i32 = 14;
pub const SHINE_FRAMES: i32 = 30;
pub const PRESENTS_AT: i32 = 100;
pub const PRESENTS_FADE: i32 = 12;
pub const TOTAL_FRAMES: i32 = 180; // 3 s

const SCALE: i32 = 3;
const GLYPH_W: i32 = 5 * SCALE;
const GLYPH_H: i32 = 7 * SCALE;
const PITCH: i32 = GLYPH_W + 5; // letter-to-letter advance
const SCREEN_W: i32 = 256;
const TOP: i32 = 94;
const UNDERLINE_Y: i32 = TOP + GLYPH_H + 6;

/// Per-letter NES colours (a full rainbow across 11 letters).
const RAINBOW: [u8; 11] = [c::RED, c::ORANGE, c::AMBER, c::YELLOW, c::LIME, c::GREEN, c::CYAN, c::SKY, c::INDIGO, c::MAGENTA, c::PINK];

#[derive(Default)]
pub struct FlickerSplashOpts {
    /// Called exactly once, on the frame the letters settle (play your jingle here). Not called if skipped before that.
    pub on_jingle: Option<Box<dyn FnMut()>>,
    /// Studio word; defaults to FLICKERSOFT.
    pub text: Option<String>,
    /// Second line; defaults to PRESENTS.
    pub presents: Option<String>,
}

/// Where a letter is drawn.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct LetterBox {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Is letter `i` drawn on frame `frame`? Pure. Neighbouring letters are always in opposite phase
/// during the flicker; before it nothing shows; after it everything is solid.
pub fn letter_visible(i: i32, frame: i32) -> bool {
    if frame < FLICKER_START {
        return false;
    }
    if frame >= FLICKER_END {
        return true;
    }
    (frame + i) % 2 == 0
}

pub struct FlickerSplash {
    text: Vec<char>,
    presents: String,
    on_jingle: Option<Box<dyn FnMut()>>,
    frame: i32,
    done: bool,
    skipped: bool,
}

impl FlickerSplash {
    pub fn new(opts: FlickerSplashOpts) -> FlickerSplash {
        let text = opts.text.unwrap_or_else(|| STUDIO_NAME.to_string()).to_uppercase();
        let presents = opts.presents.unwrap_or_else(|| STUDIO_PRESENTS.to_string()).to_uppercase();
        FlickerSplash { text: text.chars().collect(), presents, on_jingle: opts.on_jingle, frame: 0, done: false, skipped: false }
    }

    /// Steps taken so far (the frame that `draw` will show).
    pub fn frame(&self) -> i32 {
        self.frame
    }

    pub fn done(&self) -> bool {
        self.done
    }

    /// True when the player skipped the splash instead of watching it.
    pub fn skipped(&self) -> bool {
        self.skipped
    }

    /// The letters have settled (the jingle has been requested).
    pub fn settled(&self) -> bool {
        self.frame >= FLICKER_END
    }

    /// Number of letters in the studio word.
    pub fn letter_count(&self) -> i32 {
        self.text.len() as i32
    }

    /// Is letter `i` visible right now?
    pub fn visible(&self, i: i32) -> bool {
        letter_visible(i, self.frame)
    }

    /// Advance one 60 Hz frame with no pad (TS `step()` with `pad` undefined).
    pub fn tick(&mut self) -> bool {
        self.advance()
    }

    /// Advance one 60 Hz frame. Any newly pressed button skips. Returns true on the frame the jingle fires.
    pub fn step(&mut self, pad: &Pad) -> bool {
        if self.done {
            return false;
        }
        if pad.pressed != 0 {
            self.skipped = true;
            self.done = true;
            return false;
        }
        self.advance()
    }

    fn advance(&mut self) -> bool {
        if self.done {
            return false;
        }
        self.frame += 1;
        let mut fired = false;
        if self.frame == FLICKER_END {
            if let Some(cb) = self.on_jingle.as_mut() {
                cb();
            }
            fired = true;
        }
        if self.frame >= TOTAL_FRAMES {
            self.done = true;
        }
        fired
    }

    /// Where letter `i` is drawn (for tests and for games that want to add effects).
    pub fn letter_box(&self, i: i32) -> LetterBox {
        LetterBox { x: self.left() + i * PITCH, y: TOP, w: GLYPH_W, h: GLYPH_H }
    }

    fn left(&self) -> i32 {
        let n = self.text.len() as i32;
        let w = (n - 1) * PITCH + GLYPH_W;
        (SCREEN_W - w).div_euclid(2)
    }

    /// Draw the current frame (clears the whole framebuffer to black first).
    pub fn draw(&self, fb: &mut Framebuffer) {
        fb.clear(c::BLACK);
        let f = self.frame;
        let n = self.text.len() as i32;
        let left = self.left();
        let total_w = (n - 1) * PITCH + GLYPH_W;

        for i in 0..n {
            if !letter_visible(i, f) {
                continue;
            }
            let ch = self.text[i as usize].to_string();
            let col = RAINBOW[i as usize % RAINBOW.len()];
            draw_text(fb, &ch, left + i * PITCH, TOP, col, &TextOpts::default().scale(SCALE).shadow(darken(col, 1)));
        }

        // After settling: shine sweep (a diagonal-ish white band across the letters), underline wipe.
        if f >= FLICKER_END {
            let t = f - FLICKER_END;
            if t < SHINE_FRAMES {
                let sx = left - 8 + round_i((t as f64 / SHINE_FRAMES as f64) * (total_w + 16) as f64);
                fb.push_clip(sx, TOP, 7, GLYPH_H);
                for i in 0..n {
                    let ch = self.text[i as usize].to_string();
                    draw_text(fb, &ch, left + i * PITCH, TOP, c::WHITE, &TextOpts::default().scale(SCALE));
                }
                fb.pop_clip();
            }
            let wipe = (t as f64 / UNDERLINE_FRAMES as f64).min(1.0);
            let uw = round_i(total_w as f64 * wipe);
            for x in 0..uw {
                let li = (n - 1).min(((x as f64 + (PITCH - GLYPH_W) as f64 / 2.0) / PITCH as f64).floor() as i32);
                let col = RAINBOW[li as usize % RAINBOW.len()];
                fb.fill_rect(left + x, UNDERLINE_Y, 1, 3, col);
                fb.fill_rect(left + x, UNDERLINE_Y + 3, 1, 1, darken(col, 2));
            }
        }

        if f >= PRESENTS_AT {
            let k = 2.0f64.min((((f - PRESENTS_AT) as f64 / PRESENTS_FADE as f64) * 3.0).floor()) as usize;
            let col = [c::GRAY, c::LTGRAY, c::WHITE][k];
            let y = UNDERLINE_Y + 14;
            let opts = TextOpts::default().scale(2);
            let w = text_width(&self.presents, &opts);
            draw_text(fb, &self.presents, (SCREEN_W - w).div_euclid(2), y, col, &opts);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::pad::{btn, NO_PAD};
    use std::cell::Cell;
    use std::rc::Rc;

    fn press(mask: u32) -> Pad {
        Pad { held: mask, pressed: mask, released: 0 }
    }

    fn step_to(s: &mut FlickerSplash, frame: i32) {
        while s.frame() < frame && !s.done() {
            s.step(&NO_PAD);
        }
    }

    /// Non-black pixel count inside a letter's box.
    fn ink_in(fb: &Framebuffer, b: LetterBox) -> i32 {
        let mut n = 0;
        for y in b.y..b.y + b.h {
            for x in b.x..b.x + b.w {
                if fb.get_pixel(x, y) != c::BLACK {
                    n += 1;
                }
            }
        }
        n
    }

    fn name_len() -> i32 {
        STUDIO_NAME.chars().count() as i32
    }

    #[test]
    fn is_black_before_the_flicker_starts() {
        let mut s = FlickerSplash::new(Default::default());
        let mut fb = Framebuffer::new();
        for f in 0..FLICKER_START {
            s.draw(&mut fb);
            assert_eq!(fb.count_not(c::BLACK), 0, "frame {}", f);
            s.step(&NO_PAD);
        }
    }

    #[test]
    fn flickers_for_about_one_second_60_frames() {
        assert_eq!(FLICKER_END - FLICKER_START, 60);
    }

    #[test]
    fn letters_appear_on_alternate_frames_and_neighbouring_letters_are_out_of_phase() {
        let mut s = FlickerSplash::new(Default::default());
        let n = name_len();
        step_to(&mut s, FLICKER_START);
        let mut prev: Option<Vec<bool>> = None;
        while s.frame() < FLICKER_END {
            let vis: Vec<bool> = (0..n).map(|i| s.visible(i)).collect();
            for i in 0..(n - 1) as usize {
                assert_ne!(vis[i], vis[i + 1], "frame {} letters {}/{}", s.frame(), i, i + 1);
            }
            if let Some(p) = &prev {
                for i in 0..n as usize {
                    assert_ne!(vis[i], p[i], "frame {} letter {} toggles", s.frame(), i);
                }
            }
            prev = Some(vis);
            s.step(&NO_PAD);
        }
    }

    #[test]
    fn what_the_framebuffer_shows_matches_letter_visible_hidden_letters_leave_no_ink() {
        let mut s = FlickerSplash::new(Default::default());
        let mut fb = Framebuffer::new();
        step_to(&mut s, FLICKER_START);
        for _ in 0..6 {
            s.draw(&mut fb);
            for i in 0..name_len() {
                let ink = ink_in(&fb, s.letter_box(i));
                if letter_visible(i, s.frame()) {
                    assert!(ink > 0, "frame {} letter {} should show", s.frame(), i);
                } else {
                    assert_eq!(ink, 0, "frame {} letter {} should be hidden", s.frame(), i);
                }
            }
            s.step(&NO_PAD);
        }
    }

    #[test]
    fn settles_solid_after_the_flicker_phase_every_letter_every_frame() {
        let mut s = FlickerSplash::new(Default::default());
        let mut fb = Framebuffer::new();
        step_to(&mut s, FLICKER_END);
        assert!(s.settled());
        for _ in 0..20 {
            s.draw(&mut fb);
            for i in 0..name_len() {
                assert!(letter_visible(i, s.frame()));
                assert!(ink_in(&fb, s.letter_box(i)) > 0);
            }
            s.step(&NO_PAD);
        }
    }

    #[test]
    fn draws_an_underline_once_settled_and_not_during_the_flicker() {
        let mut s = FlickerSplash::new(Default::default());
        let mut fb = Framebuffer::new();
        let underline_ink = |s: &FlickerSplash, fb: &Framebuffer| {
            let mut n = 0;
            let b = s.letter_box(0);
            for y in (b.y + b.h + 4)..(b.y + b.h + 12) {
                for x in 0..fb.w {
                    if fb.get_pixel(x, y) != c::BLACK {
                        n += 1;
                    }
                }
            }
            n
        };
        step_to(&mut s, FLICKER_END - 1);
        s.draw(&mut fb);
        assert_eq!(underline_ink(&s, &fb), 0);
        step_to(&mut s, FLICKER_END + 30);
        s.draw(&mut fb);
        assert!(underline_ink(&s, &fb) > 100);
    }

    #[test]
    fn presents_follows_the_settle_not_before() {
        let mut s = FlickerSplash::new(Default::default());
        let mut fb = Framebuffer::new();
        let below = |s: &FlickerSplash, fb: &Framebuffer| {
            let b = s.letter_box(0);
            let mut n = 0;
            for y in (b.y + b.h + 12)..fb.h {
                for x in 0..fb.w {
                    if fb.get_pixel(x, y) != c::BLACK {
                        n += 1;
                    }
                }
            }
            n
        };
        step_to(&mut s, PRESENTS_AT - 1);
        s.draw(&mut fb);
        assert_eq!(below(&s, &fb), 0);
        step_to(&mut s, PRESENTS_AT + 20);
        s.draw(&mut fb);
        assert!(below(&s, &fb) > 50);
    }

    #[test]
    fn fires_the_jingle_exactly_once_on_the_settle_frame() {
        let calls = Rc::new(Cell::new(0));
        let c2 = calls.clone();
        let mut s = FlickerSplash::new(FlickerSplashOpts { on_jingle: Some(Box::new(move || c2.set(c2.get() + 1))), ..Default::default() });
        step_to(&mut s, FLICKER_END - 1);
        assert_eq!(calls.get(), 0);
        assert!(s.step(&NO_PAD));
        assert_eq!(s.frame(), FLICKER_END);
        assert_eq!(calls.get(), 1);
        while !s.done() {
            assert!(!s.step(&NO_PAD));
        }
        assert_eq!(calls.get(), 1);
    }

    #[test]
    fn lasts_about_3_seconds_in_total() {
        let mut s = FlickerSplash::new(Default::default());
        let mut steps = 0;
        while !s.done() && steps < 1000 {
            s.step(&NO_PAD);
            steps += 1;
        }
        assert_eq!(steps, TOTAL_FRAMES);
        assert!(steps >= 150);
        assert!(steps <= 210);
    }

    #[test]
    fn any_button_skips_at_any_time_without_the_jingle_if_it_was_early() {
        for b in [btn::START, btn::A, btn::B, btn::UP, btn::SELECT] {
            let calls = Rc::new(Cell::new(0));
            let c2 = calls.clone();
            let mut s = FlickerSplash::new(FlickerSplashOpts { on_jingle: Some(Box::new(move || c2.set(c2.get() + 1))), ..Default::default() });
            step_to(&mut s, 20);
            s.step(&press(b));
            assert!(s.done());
            assert!(s.skipped());
            assert_eq!(calls.get(), 0);
        }
    }

    #[test]
    fn a_held_not_newly_pressed_button_does_not_skip() {
        let mut s = FlickerSplash::new(Default::default());
        s.step(&Pad { held: btn::START, pressed: 0, released: 0 });
        assert!(!s.done());
    }

    #[test]
    fn can_be_skipped_on_the_very_first_step_and_during_presents() {
        let mut a = FlickerSplash::new(Default::default());
        a.step(&press(btn::A));
        assert!(a.done());
        let mut b = FlickerSplash::new(Default::default());
        step_to(&mut b, PRESENTS_AT + 5);
        b.step(&press(btn::START));
        assert!(b.done());
    }

    #[test]
    fn stops_counting_once_done() {
        let mut s = FlickerSplash::new(Default::default());
        s.step(&press(btn::START));
        let f = s.frame();
        s.step(&NO_PAD);
        assert_eq!(s.frame(), f);
    }

    #[test]
    fn is_reusable_for_other_studio_text_and_drawing_is_deterministic() {
        let opts = || FlickerSplashOpts { text: Some("ACME".to_string()), ..Default::default() };
        let mut a = FlickerSplash::new(opts());
        let mut b = FlickerSplash::new(opts());
        let mut fa = Framebuffer::new();
        let mut fb2 = Framebuffer::new();
        step_to(&mut a, 90);
        step_to(&mut b, 90);
        a.draw(&mut fa);
        b.draw(&mut fb2);
        assert_eq!(fa.hash(), fb2.hash());
        assert!(fa.count_not(c::BLACK) > 0);
    }
}
