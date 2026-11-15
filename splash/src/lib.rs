//! FLICKERSOFT splash: a self-contained, dependency-free intro for FLICKERSOFT games.
//!
//! Timeline (60 fps frames):
//! * `0..APPEAR_FRAME` black screen (about 0.17 s)
//! * `APPEAR_FRAME..SETTLE_FRAME` the rainbow letters flicker on alternate frames, neighbours out of phase
//!   (60 frames, 1 s), like an NES scene with too many sprites on a scanline
//! * `SETTLE_FRAME` letters go solid (white glint for a few frames), underline sweeps out, `Jingle` event fires
//! * `PRESENTS_FRAME` "PRESENTS" types in
//! * `TOTAL_FRAMES` (3 s) `Done`; any button skips at once

/// Plain 8-bit RGB colour.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rgb(pub u8, pub u8, pub u8);

/// What the host must provide: a size and filled rectangles. Rectangles may be off-screen or empty.
pub trait Canvas {
    fn width(&self) -> i32;
    fn height(&self) -> i32;
    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: Rgb);
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SplashEvent {
    None,
    /// The letters just settled: play `JINGLE` (once).
    Jingle,
    /// Finished or skipped (fires once).
    Done,
}

pub const WORD: &str = "FLICKERSOFT";
pub const SUBTITLE: &str = "PRESENTS";

/// Black screen before the letters appear.
pub const APPEAR_FRAME: u32 = 10;
/// Length of the flicker window (1 s).
pub const FLICKER_FRAMES: u32 = 60;
/// First frame on which the letters are solid; the jingle fires here.
pub const SETTLE_FRAME: u32 = APPEAR_FRAME + FLICKER_FRAMES;
/// Frames the settle glint (white flash) lasts.
pub const GLINT_FRAMES: u32 = 4;
/// Frames the underline takes to sweep out.
pub const UNDERLINE_FRAMES: u32 = 14;
/// "PRESENTS" starts typing in.
pub const PRESENTS_FRAME: u32 = SETTLE_FRAME + 28;
/// Frames per PRESENTS letter.
pub const PRESENTS_STEP: u32 = 4;
/// Total length (3 s).
pub const TOTAL_FRAMES: u32 = 180;

/// The settle jingle as plain note data: (frequency in Hz, duration in frames). Hz 0.0 is a rest.
pub const JINGLE: &[(f32, u32)] = &[
    (523.25, 6),
    (659.25, 6),
    (783.99, 6),
    (1046.50, 6),
    (0.0, 3),
    (783.99, 4),
    (1046.50, 28),
];

/// The fixed rainbow: one colour per letter of FLICKERSOFT (NES-like hues).
pub const RAINBOW: [Rgb; 11] = [
    Rgb(248, 56, 0),    // red
    Rgb(248, 120, 24),  // orange
    Rgb(252, 160, 68),  // amber
    Rgb(248, 216, 32),  // yellow
    Rgb(144, 224, 32),  // lime
    Rgb(0, 200, 56),    // green
    Rgb(0, 216, 168),   // teal
    Rgb(56, 200, 248),  // cyan
    Rgb(56, 120, 248),  // blue
    Rgb(144, 88, 248),  // violet
    Rgb(232, 72, 200),  // magenta
];

const BG: Rgb = Rgb(0, 0, 0);
const WHITE: Rgb = Rgb(252, 252, 252);
const SHADOW: Rgb = Rgb(40, 40, 72);
const GREY: Rgb = Rgb(188, 188, 200);

/// Pixel size of one font cell for the big word.
pub const CELL: i32 = 3;
const GLYPH_W: i32 = 5;
const GLYPH_H: i32 = 7;
const BIG_ADV: i32 = (GLYPH_W + 1) * CELL;

/// Is letter `i` (0-based) drawn on `frame`? Before APPEAR_FRAME never; during the flicker window letter `i`
/// shows only when `frame % 2 == i % 2` (neighbours out of phase); from SETTLE_FRAME always.
pub fn letter_visible(frame: u32, i: usize) -> bool {
    if frame < APPEAR_FRAME {
        false
    } else if frame < SETTLE_FRAME {
        frame % 2 == (i as u32) % 2
    } else {
        true
    }
}

/// Number of PRESENTS letters shown on `frame`.
pub fn presents_visible(frame: u32) -> usize {
    if frame < PRESENTS_FRAME {
        0
    } else {
        (((frame - PRESENTS_FRAME) / PRESENTS_STEP + 1) as usize).min(SUBTITLE.len())
    }
}

/// 5x7 block glyphs for the letters this module needs.
fn glyph(c: char) -> [u8; 7] {
    match c {
        'F' => [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
        'L' => [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
        'I' => [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
        'C' => [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
        'K' => [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
        'E' => [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
        'R' => [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
        'S' => [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
        'O' => [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
        'T' => [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
        'P' => [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
        'N' => [0b10001, 0b11001, 0b10101, 0b10101, 0b10011, 0b10001, 0b10001],
        _ => [0; 7],
    }
}

fn lighten(c: Rgb) -> Rgb {
    Rgb(c.0.saturating_add(64), c.1.saturating_add(64), c.2.saturating_add(64))
}

fn darken(c: Rgb) -> Rgb {
    Rgb(c.0 / 2, c.1 / 2, c.2 / 2)
}

/// Draw one glyph made of `cell`-sized squares. `lit` colours the face, with a highlight on top edges and a
/// darker bottom edge (chunky bevel).
fn draw_glyph(c: &mut impl Canvas, ch: char, x: i32, y: i32, cell: i32, face: Rgb, bevel: bool) {
    let g = glyph(ch);
    let on = |r: i32, col: i32| -> bool {
        r >= 0 && r < GLYPH_H && col >= 0 && col < GLYPH_W && g[r as usize] & (1 << (GLYPH_W - 1 - col)) != 0
    };
    for r in 0..GLYPH_H {
        for col in 0..GLYPH_W {
            if !on(r, col) {
                continue;
            }
            let (px, py) = (x + col * cell, y + r * cell);
            c.rect(px, py, cell, cell, face);
            if bevel && cell >= 2 {
                if !on(r - 1, col) {
                    c.rect(px, py, cell, 1, lighten(face));
                }
                if !on(r + 1, col) {
                    c.rect(px, py + cell - 1, cell, 1, darken(face));
                }
            }
        }
    }
}

fn word_width() -> i32 {
    WORD.len() as i32 * BIG_ADV - CELL
}

/// The splash state machine. Its only state is the frame counter.
#[derive(Clone, Debug, Default)]
pub struct Splash {
    frame: u32,
    done: bool,
}

impl Splash {
    pub fn new() -> Splash {
        Splash { frame: 0, done: false }
    }

    /// Frames stepped so far (what `draw` renders).
    pub fn frame(&self) -> u32 {
        self.frame
    }

    pub fn is_done(&self) -> bool {
        self.done
    }

    /// Advance one 60 Hz frame. `input_pressed`: any button was just pressed (skips).
    pub fn step(&mut self, input_pressed: bool) -> SplashEvent {
        if self.done {
            return SplashEvent::None;
        }
        if input_pressed {
            self.done = true;
            return SplashEvent::Done;
        }
        self.frame += 1;
        if self.frame >= TOTAL_FRAMES {
            self.done = true;
            return SplashEvent::Done;
        }
        if self.frame == SETTLE_FRAME {
            return SplashEvent::Jingle;
        }
        SplashEvent::None
    }

    pub fn draw(&self, c: &mut impl Canvas) {
        let (w, h) = (c.width(), c.height());
        c.rect(0, 0, w, h, BG);
        let f = self.frame;
        let top = h / 2 - GLYPH_H * CELL / 2 - 10;
        let left = (w - word_width()) / 2;
        let glint = f >= SETTLE_FRAME && f < SETTLE_FRAME + GLINT_FRAMES;
        for (i, ch) in WORD.chars().enumerate() {
            if !letter_visible(f, i) {
                continue;
            }
            let x = left + i as i32 * BIG_ADV;
            let face = if glint { WHITE } else { RAINBOW[i] };
            draw_glyph(c, ch, x + 2, top + 2, CELL, SHADOW, false);
            draw_glyph(c, ch, x, top, CELL, face, !glint);
        }
        if f >= SETTLE_FRAME {
            let t = ((f - SETTLE_FRAME) as i32).min(UNDERLINE_FRAMES as i32);
            let half = (word_width() / 2 + 4) * t / UNDERLINE_FRAMES as i32;
            let y = top + GLYPH_H * CELL + 6;
            c.rect(w / 2 - half + 2, y + 2, half * 2, 3, SHADOW);
            // the underline is itself a rainbow
            let x0 = w / 2 - half;
            let total = (half * 2).max(1);
            for k in 0..RAINBOW.len() as i32 {
                let a = x0 + total * k / RAINBOW.len() as i32;
                let b = x0 + total * (k + 1) / RAINBOW.len() as i32;
                c.rect(a, y, b - a, 3, RAINBOW[k as usize]);
            }
        }
        let n = presents_visible(f);
        if n > 0 {
            let cell = 2;
            let adv = (GLYPH_W + 1) * cell;
            let pw = SUBTITLE.len() as i32 * adv - cell;
            let px = (w - pw) / 2;
            let py = top + GLYPH_H * CELL + 22;
            for (i, ch) in SUBTITLE.chars().enumerate().take(n) {
                draw_glyph(c, ch, px + i as i32 * adv + 1, py + 1, cell, SHADOW, false);
                draw_glyph(c, ch, px + i as i32 * adv, py, cell, GREY, true);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Records the rectangles drawn.
    #[derive(Default)]
    struct Rec {
        rects: Vec<(i32, i32, i32, i32, Rgb)>,
    }
    impl Canvas for Rec {
        fn width(&self) -> i32 {
            256
        }
        fn height(&self) -> i32 {
            240
        }
        fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: Rgb) {
            self.rects.push((x, y, w, h, c));
        }
    }

    fn drawn_at(frame: u32) -> Vec<(i32, i32, i32, i32, Rgb)> {
        let mut s = Splash::new();
        for _ in 0..frame {
            s.step(false);
        }
        let mut r = Rec::default();
        s.draw(&mut r);
        r.rects.into_iter().skip(1).collect() // skip the background fill
    }

    #[test]
    fn black_before_the_letters_appear() {
        for f in 0..APPEAR_FRAME {
            assert!(drawn_at(f).is_empty(), "frame {f}");
        }
        assert!(!drawn_at(APPEAR_FRAME).is_empty());
    }

    #[test]
    fn flicker_alternates_with_neighbours_out_of_phase() {
        for f in APPEAR_FRAME..SETTLE_FRAME {
            for i in 0..WORD.len() {
                assert_eq!(letter_visible(f, i), f % 2 == i as u32 % 2, "f{f} i{i}");
                if i > 0 {
                    assert_ne!(letter_visible(f, i), letter_visible(f, i - 1), "neighbours f{f} i{i}");
                }
                if f + 1 < SETTLE_FRAME {
                    assert_ne!(letter_visible(f, i), letter_visible(f + 1, i), "flips every frame");
                }
            }
        }
    }

    #[test]
    fn flicker_window_is_exactly_one_second() {
        assert_eq!(SETTLE_FRAME - APPEAR_FRAME, 60);
        // on the last flicker frame only half the letters show, on the settle frame all do
        let on = |f| (0..WORD.len()).filter(|&i| letter_visible(f, i)).count();
        assert_eq!(on(SETTLE_FRAME - 1), 5); // odd frame: odd letters 1,3,5,7,9
        assert_eq!(on(SETTLE_FRAME), WORD.len());
        assert_eq!(on(APPEAR_FRAME), 6);
        assert_eq!(on(APPEAR_FRAME - 1), 0);
    }

    #[test]
    fn draw_matches_letter_visibility() {
        // an odd frame in the window draws fewer face rectangles than a settled frame
        let flick = drawn_at(APPEAR_FRAME + 1).len();
        let solid = drawn_at(SETTLE_FRAME + 40).len();
        assert!(flick < solid);
        // letter 0 (F, red) face colour present on an even frame, absent on an odd frame
        let has = |rects: &[(i32, i32, i32, i32, Rgb)], c: Rgb| rects.iter().any(|r| r.4 == c);
        assert!(has(&drawn_at(APPEAR_FRAME), RAINBOW[0]));
        assert!(!has(&drawn_at(APPEAR_FRAME + 1), RAINBOW[0]));
        assert!(has(&drawn_at(APPEAR_FRAME + 1), RAINBOW[1]));
    }

    #[test]
    fn jingle_fires_exactly_once_at_the_settle_frame() {
        let mut s = Splash::new();
        let mut at = Vec::new();
        let mut done_at = Vec::new();
        for i in 0..400 {
            match s.step(false) {
                SplashEvent::Jingle => at.push(s.frame()),
                SplashEvent::Done => done_at.push(i),
                SplashEvent::None => {}
            }
        }
        assert_eq!(at, vec![SETTLE_FRAME]);
        assert_eq!(done_at.len(), 1);
    }

    #[test]
    fn presents_comes_after_the_settle() {
        assert!(PRESENTS_FRAME > SETTLE_FRAME);
        assert_eq!(presents_visible(PRESENTS_FRAME - 1), 0);
        assert_eq!(presents_visible(PRESENTS_FRAME), 1);
        assert_eq!(presents_visible(TOTAL_FRAMES), SUBTITLE.len());
        // everything PRESENTS draws appears only after PRESENTS_FRAME
        assert_eq!(drawn_at(PRESENTS_FRAME - 1).len(), drawn_at(PRESENTS_FRAME - 2).len());
        assert!(drawn_at(PRESENTS_FRAME + 1).len() > drawn_at(PRESENTS_FRAME - 1).len());
        // full word is up well before the end
        assert_eq!(presents_visible(PRESENTS_FRAME + PRESENTS_STEP * 8), 8);
        assert!(PRESENTS_FRAME + PRESENTS_STEP * 8 < TOTAL_FRAMES - 20);
    }

    #[test]
    fn total_length_is_about_three_seconds() {
        let mut s = Splash::new();
        let mut n = 0;
        while !s.is_done() {
            s.step(false);
            n += 1;
            assert!(n < 1000);
        }
        assert_eq!(n, TOTAL_FRAMES);
        assert!((170..=190).contains(&n));
        assert_eq!(s.step(false), SplashEvent::None);
    }

    #[test]
    fn any_button_skips_at_any_frame_without_a_jingle() {
        for at in [0, 1, APPEAR_FRAME, 40, SETTLE_FRAME - 1, SETTLE_FRAME, 100, TOTAL_FRAMES - 1] {
            let mut s = Splash::new();
            for _ in 0..at {
                s.step(false);
            }
            if s.is_done() {
                continue;
            }
            assert_eq!(s.step(true), SplashEvent::Done, "skip at {at}");
            assert!(s.is_done());
            assert_eq!(s.step(true), SplashEvent::None);
        }
    }

    #[test]
    fn deterministic() {
        assert_eq!(drawn_at(95), drawn_at(95));
        assert_eq!(drawn_at(33), drawn_at(33));
    }

    #[test]
    fn jingle_data_is_sane() {
        assert!(JINGLE.iter().all(|&(hz, fr)| hz >= 0.0 && fr > 0));
        let total: u32 = JINGLE.iter().map(|n| n.1).sum();
        assert!(total < TOTAL_FRAMES - SETTLE_FRAME);
    }

    #[test]
    fn word_fits_a_256_screen_and_colours_are_distinct() {
        assert!(word_width() <= 256 - 32);
        for i in 0..RAINBOW.len() {
            for j in i + 1..RAINBOW.len() {
                assert_ne!(RAINBOW[i], RAINBOW[j]);
            }
        }
        assert_eq!(RAINBOW.len(), WORD.len());
    }
}
