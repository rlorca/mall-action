//! "CONTINUE?" countdown (screens agent 1 owns this file). Spec 4.8: big countdown from 9, one beep per
//! second, red at 3 or below, "CONTINUES LEFT: n", START uses a continue.

use super::title::fancy_text;
use crate::events::{Out, Sfx, Track};
use crate::input::{PadState, START};
use crate::pixel::{pal, Fb, H, W};
use crate::ui::blink;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContinueOutcome {
    None,
    /// Start was pressed: use a continue.
    Continue,
    /// The countdown reached zero.
    Expired,
}

/// The countdown starts at this number.
pub const COUNTDOWN_FROM: u32 = 9;
/// Frames per displayed second (60 Hz).
pub const FRAMES_PER_SECOND: u32 = 60;
/// Total frames before the countdown expires (9 s = 540 frames).
pub const TOTAL_FRAMES: u32 = COUNTDOWN_FROM * FRAMES_PER_SECOND;
/// The digit turns red at this number or below.
pub const RED_AT: u32 = 3;

pub struct ContinueScreen {
    continues_left: u32,
    t: u32,
    done: bool,
}

impl ContinueScreen {
    pub fn new(continues_left: u32) -> ContinueScreen {
        ContinueScreen { continues_left, t: 0, done: false }
    }

    /// The digit currently shown (9 down to 1; 0 once expired).
    pub fn seconds_left(&self) -> u32 {
        (TOTAL_FRAMES - self.t.min(TOTAL_FRAMES)).div_ceil(FRAMES_PER_SECOND)
    }

    pub fn is_red(&self) -> bool {
        self.seconds_left() <= RED_AT
    }

    pub fn step(&mut self, pad: PadState, out: &mut Out) -> ContinueOutcome {
        if self.done {
            return ContinueOutcome::None;
        }
        if self.t == 0 {
            out.music(Track::Continue);
        }
        if pad.just_pressed(START) {
            self.done = true;
            out.sfx(Sfx::PowerUp);
            return ContinueOutcome::Continue;
        }
        // one beep as each second begins (t = 0, 60, ... 480)
        if self.t % FRAMES_PER_SECOND == 0 && self.t < TOTAL_FRAMES {
            out.sfx(Sfx::Beep);
        }
        self.t += 1;
        if self.t >= TOTAL_FRAMES {
            self.done = true;
            return ContinueOutcome::Expired;
        }
        ContinueOutcome::None
    }

    pub fn draw(&self, fb: &mut Fb) {
        let (w, h) = (W as i32, H as i32);
        let secs = self.seconds_left();
        let red = self.is_red();
        // background: dark with a faint checker; goes red-tinged when time is nearly out
        let bg = if red { pal::MAROON } else { pal::NAVY };
        fb.clear(bg);
        fb.dither_rect(0, 0, w, h, if red { pal::BLACK } else { pal::DBLUE }, 0);
        // spotlight rings around the digit that pulse every second
        let phase = (self.t % FRAMES_PER_SECOND) as i32;
        let cx = w / 2;
        let cy = 104;
        let r = 54 + phase / 3;
        ring(fb, cx, cy, r, if red { pal::RED } else { pal::BLUE });
        ring(fb, cx, cy, r - 3, if red { pal::DRED } else { pal::DBLUE });

        fancy_text(fb, (w - Fb::text_scaled_width("CONTINUE?", 4)) / 2, 18, "CONTINUE?", 4, pal::LYELLOW, pal::ORANGE, pal::BLACK, pal::DPURPLE);

        // the big digit pops on each new second
        let scale = if phase < 5 { 13 } else { 12 };
        let ds = secs.to_string();
        let dw = Fb::text_scaled_width(&ds, scale);
        let dx = cx - dw / 2;
        let dy = cy - 7 * scale / 2;
        let (top, bot) = if red { (pal::LRED, pal::RED) } else { (pal::WHITE, pal::LCYAN) };
        fancy_text(fb, dx, dy, &ds, scale, top, bot, pal::BLACK, pal::BLACK);

        // time bar
        let frac = (TOTAL_FRAMES - self.t.min(TOTAL_FRAMES)) as f32 / TOTAL_FRAMES as f32;
        crate::ui::bar(fb, 48, 168, 160, 6, frac, if red { pal::RED } else { pal::CYAN }, pal::BLACK);
        fb.frame(47, 167, 162, 8, pal::WHITE);

        let line = format!("CONTINUES LEFT: {}", self.continues_left);
        fb.text_center(cx + 1, 186, &line, pal::BLACK);
        fb.text_center(cx, 185, &line, pal::WHITE);
        if blink(self.t, 30, 20) {
            fb.text_center(cx + 1, 204, "PRESS START", pal::BLACK);
            fb.text_center(cx, 203, "PRESS START", pal::YELLOW);
        }
    }
}

/// A one-pixel circle outline.
fn ring(fb: &mut Fb, cx: i32, cy: i32, r: i32, c: u8) {
    let (lo, hi) = ((r - 1) * (r - 1), r * r);
    for y in cy - r..=cy + r {
        for x in cx - r..=cx + r {
            let d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if d >= lo && d <= hi {
                fb.put(x, y, c);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::Event;

    fn run(n: u32) -> (ContinueScreen, Out) {
        let mut s = ContinueScreen::new(2);
        let mut out = Out::new();
        for _ in 0..n {
            s.step(PadState::default(), &mut out);
        }
        (s, out)
    }

    #[test]
    fn counts_down_from_nine_one_digit_per_second() {
        let mut s = ContinueScreen::new(3);
        let mut out = Out::new();
        assert_eq!(s.seconds_left(), 9);
        for sec in (1..=9).rev() {
            for _ in 0..60 {
                assert_eq!(s.seconds_left(), sec);
                s.step(PadState::default(), &mut out);
            }
        }
        assert_eq!(s.seconds_left(), 0);
    }

    #[test]
    fn one_beep_per_second_nine_total() {
        let (_, out) = run(539);
        assert_eq!(out.count_sfx(Sfx::Beep), 9);
        let (_, out) = run(60);
        assert_eq!(out.count_sfx(Sfx::Beep), 1);
        let (_, out) = run(61);
        assert_eq!(out.count_sfx(Sfx::Beep), 2);
    }

    #[test]
    fn red_at_three_and_below() {
        let mut s = ContinueScreen::new(1);
        let mut out = Out::new();
        let mut first_red = None;
        for f in 0..540 {
            if s.is_red() && first_red.is_none() {
                first_red = Some((f, s.seconds_left()));
            }
            assert_eq!(s.is_red(), s.seconds_left() <= 3);
            s.step(PadState::default(), &mut out);
        }
        assert_eq!(first_red, Some((360, 3)));
        // the digit is drawn in a different colour family
        let (calm, _) = run(10);
        let (hot, _) = run(400);
        let (mut a, mut b) = (Fb::new(), Fb::new());
        calm.draw(&mut a);
        hot.draw(&mut b);
        assert!(b.px.iter().any(|p| *p == pal::LRED || *p == pal::RED));
        assert!(!a.px.iter().any(|p| *p == pal::LRED));
    }

    #[test]
    fn start_continues_with_a_confirm_sound() {
        let mut s = ContinueScreen::new(2);
        let mut out = Out::new();
        for _ in 0..100 {
            assert_eq!(s.step(PadState::default(), &mut out), ContinueOutcome::None);
        }
        assert_eq!(s.step(PadState::from_held(0, START), &mut out), ContinueOutcome::Continue);
        assert_eq!(out.count_sfx(Sfx::PowerUp), 1);
        assert_eq!(s.step(PadState::from_held(0, START), &mut out), ContinueOutcome::None);
    }

    #[test]
    fn expires_after_exactly_540_frames() {
        let mut s = ContinueScreen::new(2);
        let mut out = Out::new();
        for f in 1..=539 {
            assert_eq!(s.step(PadState::default(), &mut out), ContinueOutcome::None, "frame {f}");
        }
        assert_eq!(s.step(PadState::default(), &mut out), ContinueOutcome::Expired);
        assert_eq!(s.step(PadState::default(), &mut out), ContinueOutcome::None);
    }

    #[test]
    fn plays_the_continue_track_first() {
        let (_, out) = run(1);
        assert_eq!(out.events[0], Event::Music(Track::Continue));
    }

    #[test]
    fn shows_continues_left() {
        let (s, _) = run(5);
        let mut fb = Fb::new();
        s.draw(&mut fb);
        let (s0, _) = {
            let mut s = ContinueScreen::new(0);
            let mut o = Out::new();
            for _ in 0..5 {
                s.step(PadState::default(), &mut o);
            }
            (s, o)
        };
        let mut fb0 = Fb::new();
        s0.draw(&mut fb0);
        assert_ne!(fb.px, fb0.px);
    }
}
