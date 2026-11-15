use super::screen::Screen;
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::UI;
use crate::engine::pad::{btn, Pad};

/// Game over timeline (60 Hz frames):
///   0                PA chime
///   TYPE1_AT ..      "ATTENTION SHOPPERS:" typewriter (one char per CHAR_FRAMES, a blip each)
///   after a pause    "THE MALL IS NOW CLOSED" typewriter
///   SHUTTER_AT ..    metal shutters roll down over the storefronts and the agent, floor by floor
///   GAMEOVER_AT      "GAME OVER" + score + high score, the gameover jingle
///   TIMEOUT          done on its own; Start finishes it earlier (after a short input grace)
pub const GO_CHAR_FRAMES: i32 = 3;
pub const GO_TYPE1_AT: i32 = 40;
pub const GO_TYPE2_AT: i32 = GO_TYPE1_AT + UI.closed_line1.len() as i32 * GO_CHAR_FRAMES + 24;
pub const GO_SHUTTER_AT: i32 = 120;
/// Frames one floor's shutter takes to roll down, and the delay between floors (top floor first).
pub const GO_SHUTTER_FRAMES: i32 = 84;
pub const GO_SHUTTER_STAGGER: i32 = 30;
pub const GO_FLOORS: i32 = 3;
pub const GO_SHUTTERS_CLOSED_AT: i32 = GO_SHUTTER_AT + GO_SHUTTER_STAGGER * (GO_FLOORS - 1) + GO_SHUTTER_FRAMES;
pub const GO_GAMEOVER_AT: i32 = GO_SHUTTERS_CLOSED_AT + 20;
pub const GO_TIMEOUT: i32 = 10 * 60;
/// Start is ignored for this many frames so a carried-over button press cannot skip the screen.
pub const GO_INPUT_GRACE: i32 = 30;

pub struct GameOverScreen {
    pub score: i32,
    pub hi_score: i32,
    frame: i32,
    done: bool,
    sfx: Vec<SfxId>,
}

impl GameOverScreen {
    pub fn new(score: i32, hi_score: i32) -> GameOverScreen {
        GameOverScreen { score, hi_score, frame: 0, done: false, sfx: vec![SfxId::PaChime] }
    }

    pub fn frame(&self) -> i32 {
        self.frame
    }

    /// The visible part of the first line.
    pub fn line1(&self) -> String {
        typed(UI.closed_line1, self.frame - GO_TYPE1_AT)
    }

    /// The visible part of the second line.
    pub fn line2(&self) -> String {
        typed(UI.closed_line2, self.frame - GO_TYPE2_AT)
    }

    /// How far floor `f` (0 = top row) has its shutter down: 0 (open) .. 1 (closed).
    pub fn shutter(&self, f: i32) -> f64 {
        let t = self.frame - GO_SHUTTER_AT - f * GO_SHUTTER_STAGGER;
        (t as f64 / GO_SHUTTER_FRAMES as f64).min(1.0).max(0.0)
    }

    pub fn show_game_over(&self) -> bool {
        self.frame >= GO_GAMEOVER_AT
    }

    /// The score is at (or tied with) the high score and is worth a flourish.
    pub fn new_record(&self) -> bool {
        self.score > 0 && self.score >= self.hi_score
    }
}

impl Screen for GameOverScreen {
    fn step(&mut self, pad: &Pad) {
        if self.done {
            return;
        }
        if self.frame >= GO_INPUT_GRACE && pad.pressed & btn::START != 0 {
            self.done = true;
            self.sfx.push(SfxId::Select);
            return;
        }
        let before = self.frame;
        self.frame += 1;
        let f = self.frame;
        if f >= GO_TIMEOUT {
            self.done = true;
            return;
        }
        // typewriter blips: one when a new non-space character appears
        for (text, at) in [(UI.closed_line1, GO_TYPE1_AT), (UI.closed_line2, GO_TYPE2_AT)] {
            let n = (f - at).div_euclid(GO_CHAR_FRAMES) + 1;
            let was = (before - at).div_euclid(GO_CHAR_FRAMES) + 1;
            if f >= at && n != was && n >= 1 && n <= text.len() as i32 && text.as_bytes()[(n - 1) as usize] != b' ' {
                self.sfx.push(SfxId::Blip);
            }
        }
        // low rolling hum while any shutter is moving, a clang when the last one lands
        if f > GO_SHUTTER_AT && f < GO_SHUTTERS_CLOSED_AT && f % 24 == 0 {
            self.sfx.push(SfxId::Hum);
        }
        if f == GO_SHUTTERS_CLOSED_AT {
            self.sfx.push(SfxId::Door);
        }
    }

    fn done(&self) -> bool {
        self.done
    }

    /// Silence (apart from the PA) until the shutters are down, then the game over jingle.
    fn music(&self) -> Option<MusicId> {
        if self.show_game_over() {
            Some(MusicId::Gameover)
        } else {
            None
        }
    }

    fn drain_sfx(&mut self) -> Vec<SfxId> {
        std::mem::take(&mut self.sfx)
    }
}

fn typed(text: &str, frames_since_start: i32) -> String {
    if frames_since_start < 0 {
        return String::new();
    }
    let n = (text.chars().count() as i32).min(frames_since_start.div_euclid(GO_CHAR_FRAMES) + 1);
    text.chars().take(n as usize).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::pad::NO_PAD;

    fn press(mask: u32) -> Pad {
        Pad { held: mask, pressed: mask, released: 0 }
    }

    fn run(s: &mut GameOverScreen, frames: i32, pad: Pad) -> Vec<SfxId> {
        let mut all = Vec::new();
        for _ in 0..frames {
            s.step(&pad);
            all.extend(s.drain_sfx());
        }
        all
    }

    #[test]
    fn opens_with_the_pa_chime_and_no_text_yet() {
        let mut s = GameOverScreen::new(1234, 5000);
        assert_eq!(s.drain_sfx(), vec![SfxId::PaChime]);
        assert_eq!(s.line1(), "");
        assert_eq!(s.line2(), "");
        assert!(!s.show_game_over());
        assert_eq!(s.music(), None);
    }

    #[test]
    fn types_the_two_pa_lines_one_character_at_a_time_with_blip_sfx() {
        let mut s = GameOverScreen::new(0, 0);
        s.drain_sfx();
        run(&mut s, GO_TYPE1_AT - 1, NO_PAD);
        assert_eq!(s.line1(), "");
        let sfx = run(&mut s, GO_CHAR_FRAMES * 3, NO_PAD);
        assert!(s.line1().len() >= 3);
        assert!(sfx.iter().filter(|x| **x == SfxId::Blip).count() >= 3);
        let n = GO_TYPE2_AT - s.frame() + UI.closed_line2.len() as i32 * GO_CHAR_FRAMES;
        run(&mut s, n, NO_PAD);
        assert_eq!(s.line1(), UI.closed_line1);
        assert_eq!(s.line2(), UI.closed_line2);
    }

    #[test]
    fn line_1_is_complete_before_line_2_starts() {
        assert!(GO_TYPE1_AT + UI.closed_line1.len() as i32 * GO_CHAR_FRAMES <= GO_TYPE2_AT);
    }

    #[test]
    fn shutters_roll_down_top_floor_first_and_are_fully_closed_before_game_over() {
        let mut s = GameOverScreen::new(0, 0);
        run(&mut s, GO_SHUTTER_AT, NO_PAD);
        assert_eq!(s.shutter(0), 0.0);
        run(&mut s, 40, NO_PAD);
        assert!(s.shutter(0) > 0.0);
        assert!(s.shutter(0) >= s.shutter(1));
        assert!(s.shutter(1) >= s.shutter(2));
        let n = GO_SHUTTERS_CLOSED_AT - s.frame();
        run(&mut s, n, NO_PAD);
        for f in [0, 1, 2] {
            assert_eq!(s.shutter(f), 1.0);
        }
        assert!(!s.show_game_over());
        let n = GO_GAMEOVER_AT - s.frame();
        run(&mut s, n, NO_PAD);
        assert!(s.show_game_over());
        assert_eq!(s.music(), Some(MusicId::Gameover));
    }

    #[test]
    fn shutter_progress_is_monotonic() {
        let mut s = GameOverScreen::new(0, 0);
        let mut prev = [0.0f64; 3];
        for _ in 0..GO_GAMEOVER_AT + 5 {
            s.step(&NO_PAD);
            let cur = [s.shutter(0), s.shutter(1), s.shutter(2)];
            for f in 0..3 {
                assert!(cur[f] >= prev[f]);
            }
            prev = cur;
        }
    }

    #[test]
    fn start_is_ignored_during_the_grace_period_then_finishes_the_screen() {
        let mut s = GameOverScreen::new(10, 10);
        run(&mut s, 5, press(btn::START));
        assert!(!s.done());
        run(&mut s, GO_INPUT_GRACE, NO_PAD);
        s.step(&press(btn::START));
        assert!(s.done());
    }

    #[test]
    fn finishes_by_itself_after_about_10_seconds() {
        let mut s = GameOverScreen::new(10, 10);
        let mut n = 0;
        while !s.done() && n < 5000 {
            s.step(&NO_PAD);
            n += 1;
        }
        assert_eq!(n, GO_TIMEOUT);
        assert_eq!(GO_TIMEOUT, 600);
    }

    #[test]
    fn flags_a_new_record_only_when_the_score_is_positive_and_reaches_the_high_score() {
        assert!(GameOverScreen::new(500, 500).new_record());
        assert!(!GameOverScreen::new(400, 500).new_record());
        assert!(!GameOverScreen::new(0, 0).new_record());
    }

    #[test]
    fn exposes_score_and_high_score_for_the_view() {
        let s = GameOverScreen::new(123, 456);
        assert_eq!(s.score, 123);
        assert_eq!(s.hi_score, 456);
    }
}
