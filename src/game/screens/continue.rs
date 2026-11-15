use super::screen::Screen;
use crate::audio_ids::{MusicId, SfxId};
use crate::engine::pad::{btn, Pad};

/// Seconds on the clock when the screen opens.
pub const CONTINUE_SECONDS: i32 = 9;
/// Sim frames per displayed number.
pub const CONTINUE_FRAMES_PER_COUNT: i32 = 60;
/// Total frames until the clock runs out.
pub const CONTINUE_TOTAL_FRAMES: i32 = CONTINUE_SECONDS * CONTINUE_FRAMES_PER_COUNT;
/// The number turns red at this value and below.
pub const CONTINUE_RED_AT: i32 = 3;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ContinueResult {
    Continue,
    Gameover,
}

impl ContinueResult {
    pub fn as_str(self) -> &'static str {
        match self {
            ContinueResult::Continue => "continue",
            ContinueResult::Gameover => "gameover",
        }
    }
}

/// CONTINUE? screen: a BIG countdown from 9 (60 frames per number), one 'beep' per number,
/// red at 3 or below. Start => `result == Some(Continue)` (the Game spends the continue and gives 3 fresh
/// lives); the clock reaching 0 => `result == Some(Gameover)`. The Game reads `result` when `done`.
pub struct ContinueScreen {
    pub continues_left: i32,
    frame: i32,
    result: Option<ContinueResult>,
    sfx: Vec<SfxId>,
}

impl ContinueScreen {
    pub fn new(continues_left: i32) -> ContinueScreen {
        ContinueScreen { continues_left, frame: 0, result: None, sfx: vec![SfxId::Beep] }
    }

    pub fn frame(&self) -> i32 {
        self.frame
    }

    /// None while the clock is running.
    pub fn result(&self) -> Option<ContinueResult> {
        self.result
    }

    /// The displayed number, 9 down to 0.
    pub fn count(&self) -> i32 {
        (CONTINUE_SECONDS - self.frame.div_euclid(CONTINUE_FRAMES_PER_COUNT)).max(0)
    }

    /// Frame inside the current second (0..59): drives the pulse of the big digit.
    pub fn tick(&self) -> i32 {
        self.frame % CONTINUE_FRAMES_PER_COUNT
    }

    pub fn urgent(&self) -> bool {
        self.count() <= CONTINUE_RED_AT
    }
}

impl Screen for ContinueScreen {
    fn step(&mut self, pad: &Pad) {
        if self.result.is_some() {
            return;
        }
        if pad.pressed & btn::START != 0 {
            self.result = Some(ContinueResult::Continue);
            self.sfx.push(SfxId::Select);
            return;
        }
        self.frame += 1;
        if self.frame >= CONTINUE_TOTAL_FRAMES {
            self.result = Some(ContinueResult::Gameover);
            self.sfx.push(SfxId::Buzzer);
            return;
        }
        if self.frame % CONTINUE_FRAMES_PER_COUNT == 0 {
            self.sfx.push(SfxId::Beep);
        }
    }

    fn done(&self) -> bool {
        self.result.is_some()
    }

    fn music(&self) -> Option<MusicId> {
        Some(MusicId::Continue)
    }

    fn drain_sfx(&mut self) -> Vec<SfxId> {
        std::mem::take(&mut self.sfx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::pad::NO_PAD;

    fn press(mask: u32) -> Pad {
        Pad { held: mask, pressed: mask, released: 0 }
    }

    #[test]
    fn starts_at_9_with_continues_left_data_and_the_continue_music() {
        let s = ContinueScreen::new(2);
        assert_eq!(s.count(), 9);
        assert_eq!(s.continues_left, 2);
        assert!(!s.done());
        assert_eq!(s.result(), None);
        assert_eq!(s.music(), Some(MusicId::Continue));
    }

    #[test]
    fn counts_down_one_number_every_60_frames() {
        let mut s = ContinueScreen::new(3);
        let mut seen = Vec::new();
        for f in 0..CONTINUE_TOTAL_FRAMES - 1 {
            if f % CONTINUE_FRAMES_PER_COUNT == 0 {
                seen.push(s.count());
            }
            assert_eq!(s.count(), 9 - f / 60);
            s.step(&NO_PAD);
        }
        assert_eq!(seen, vec![9, 8, 7, 6, 5, 4, 3, 2, 1]);
    }

    #[test]
    fn beeps_once_per_second_nine_beeps_and_nothing_in_between() {
        let mut s = ContinueScreen::new(3);
        let mut beeps = s.drain_sfx().iter().filter(|x| **x == SfxId::Beep).count();
        assert_eq!(beeps, 1); // the 9
        let mut per_second = Vec::new();
        for _sec in 1..9 {
            let mut n = 0;
            for _ in 0..60 {
                s.step(&NO_PAD);
                n += s.drain_sfx().iter().filter(|x| **x == SfxId::Beep).count();
            }
            per_second.push(n);
            beeps += n;
        }
        assert!(per_second.iter().all(|n| *n == 1));
        assert_eq!(beeps, 9);
    }

    #[test]
    fn is_red_at_3_or_below() {
        let mut s = ContinueScreen::new(1);
        let mut red = [false; 10];
        for _ in 0..CONTINUE_TOTAL_FRAMES - 1 {
            red[s.count() as usize] = s.urgent();
            s.step(&NO_PAD);
        }
        for n in 1..=9usize {
            assert_eq!(red[n], n <= 3, "count {}", n);
        }
    }

    #[test]
    fn start_gives_result_continue_and_finishes() {
        let mut s = ContinueScreen::new(3);
        for _ in 0..100 {
            s.step(&NO_PAD);
        }
        s.step(&press(btn::START));
        assert!(s.done());
        assert_eq!(s.result(), Some(ContinueResult::Continue));
        assert!(s.drain_sfx().contains(&SfxId::Select));
    }

    #[test]
    fn other_buttons_do_not_continue() {
        let mut s = ContinueScreen::new(3);
        for b in [btn::A, btn::B, btn::UP, btn::SELECT] {
            s.step(&press(b));
        }
        assert!(!s.done());
    }

    #[test]
    fn the_clock_reaching_0_gives_result_gameover_after_9_s() {
        let mut s = ContinueScreen::new(0);
        let mut steps = 0;
        while !s.done() && steps < 2000 {
            s.step(&NO_PAD);
            steps += 1;
        }
        assert_eq!(steps, 9 * 60);
        assert_eq!(s.result(), Some(ContinueResult::Gameover));
        assert_eq!(s.count(), 0);
    }

    #[test]
    fn ignores_further_input_once_finished() {
        let mut s = ContinueScreen::new(3);
        s.step(&press(btn::START));
        let f = s.frame();
        s.step(&NO_PAD);
        assert_eq!(s.frame(), f);
        assert_eq!(s.result(), Some(ContinueResult::Continue));
    }
}
