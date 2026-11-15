use super::konami::KonamiDetector;
use super::screen::Screen;
use crate::audio_ids::{MusicId, SfxId};
use crate::content::stores::{STORE_IDS, STORE_W};
use crate::engine::pad::{btn, Pad};

/// Gap between neighbouring storefronts in the scrolling row (px).
pub const TITLE_STORE_GAP: i32 = 8;
/// One full cycle of the row (13 storefronts + gaps): the scroll wraps seamlessly at this width.
pub const TITLE_STRIP_PERIOD: i32 = STORE_IDS.len() as i32 * (STORE_W as i32 + TITLE_STORE_GAP);
/// The row moves 1 px every this many frames.
pub const TITLE_SCROLL_FRAMES: i32 = 2;

/// Scroll offset (px) of the storefront row after `frame` steps; wraps at TITLE_STRIP_PERIOD.
pub fn strip_offset(frame: i32) -> i32 {
    frame.div_euclid(TITLE_SCROLL_FRAMES) % TITLE_STRIP_PERIOD
}

/// Title screen: Start finishes it (`done`); the Konami code (UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT B A,
/// extra leading Ups are fine) switches on Black Friday Mode: `black_friday` becomes true and the screen shows
/// a flashing "BLACK FRIDAY!" / "70% OFF EVERYTHING". The Game reads `black_friday` when it starts the run.
/// Only Start starts the game (B and A are part of the code, so they must not).
pub struct TitleScreen {
    pub hi_score: i32,
    frame: i32,
    done: bool,
    black_friday: bool,
    bf_at: i32,
    sfx: Vec<SfxId>,
    konami: KonamiDetector,
}

impl TitleScreen {
    pub fn new(hi_score: i32) -> TitleScreen {
        TitleScreen { hi_score, frame: 0, done: false, black_friday: false, bf_at: -1, sfx: Vec::new(), konami: KonamiDetector::new() }
    }

    pub fn frame(&self) -> i32 {
        self.frame
    }

    /// Black Friday Mode was unlocked with the Konami code.
    pub fn black_friday(&self) -> bool {
        self.black_friday
    }

    /// Frames since the code was entered (0 if not yet; check `black_friday`).
    pub fn black_friday_frames(&self) -> i32 {
        if self.bf_at < 0 {
            0
        } else {
            self.frame - self.bf_at
        }
    }

    /// Storefront row scroll offset in px.
    pub fn scroll(&self) -> i32 {
        strip_offset(self.frame)
    }
}

impl Screen for TitleScreen {
    fn step(&mut self, pad: &Pad) {
        if self.done {
            return;
        }
        self.frame += 1;
        if self.konami.feed(pad.pressed) {
            if !self.black_friday {
                self.bf_at = self.frame;
            }
            self.black_friday = true;
            self.sfx.push(SfxId::Fanfare);
        }
        if pad.pressed & btn::START != 0 {
            self.done = true;
            self.sfx.push(SfxId::Select);
        }
    }

    fn done(&self) -> bool {
        self.done
    }

    fn music(&self) -> Option<MusicId> {
        Some(MusicId::Title)
    }

    fn drain_sfx(&mut self) -> Vec<SfxId> {
        std::mem::take(&mut self.sfx)
    }
}

#[cfg(test)]
mod tests {
    use super::super::konami::KONAMI_CODE;
    use super::*;
    use crate::engine::pad::NO_PAD;

    fn press(mask: u32) -> Pad {
        Pad { held: mask, pressed: mask, released: 0 }
    }

    fn enter(t: &mut TitleScreen, presses: &[u32], gap: i32) {
        for b in presses {
            t.step(&press(*b));
            for _ in 0..gap {
                t.step(&NO_PAD);
            }
        }
    }

    #[test]
    fn plays_the_title_music_and_shows_the_high_score_it_was_given() {
        let t = TitleScreen::new(12345);
        assert_eq!(t.music(), Some(MusicId::Title));
        assert_eq!(t.hi_score, 12345);
        assert!(!t.done());
        assert!(!t.black_friday());
    }

    #[test]
    fn start_finishes_the_screen() {
        let mut t = TitleScreen::new(0);
        for _ in 0..50 {
            t.step(&NO_PAD);
        }
        assert!(!t.done());
        t.step(&press(btn::START));
        assert!(t.done());
        assert!(t.drain_sfx().contains(&SfxId::Select));
    }

    #[test]
    fn other_buttons_including_b_and_a_do_not_start_the_game() {
        let mut t = TitleScreen::new(0);
        for b in [btn::A, btn::B, btn::UP, btn::SELECT] {
            t.step(&press(b));
        }
        assert!(!t.done());
    }

    #[test]
    fn the_konami_code_switches_on_black_friday_mode_and_does_not_start_the_game() {
        let mut t = TitleScreen::new(0);
        enter(&mut t, &KONAMI_CODE, 3);
        assert!(t.black_friday());
        assert!(!t.done());
        assert!(t.drain_sfx().contains(&SfxId::Fanfare));
        t.step(&press(btn::START));
        assert!(t.done());
        assert!(t.black_friday());
    }

    #[test]
    fn works_with_extra_leading_ups() {
        let mut t = TitleScreen::new(0);
        let mut seq = vec![btn::UP; 4];
        seq.extend(KONAMI_CODE);
        enter(&mut t, &seq, 3);
        assert!(t.black_friday());
    }

    #[test]
    fn a_wrong_press_in_the_middle_prevents_it() {
        let mut t = TitleScreen::new(0);
        let mut seq: Vec<u32> = KONAMI_CODE[..4].to_vec();
        seq.push(btn::SELECT);
        seq.extend(&KONAMI_CODE[4..]);
        enter(&mut t, &seq, 3);
        assert!(!t.black_friday());
    }

    #[test]
    fn counts_frames_since_the_code_was_entered() {
        let mut t = TitleScreen::new(0);
        assert_eq!(t.black_friday_frames(), 0);
        enter(&mut t, &KONAMI_CODE, 0);
        let f0 = t.black_friday_frames();
        for _ in 0..10 {
            t.step(&NO_PAD);
        }
        assert_eq!(t.black_friday_frames(), f0 + 10);
    }

    #[test]
    fn the_storefront_row_wraps_seamlessly_after_exactly_one_period() {
        assert_eq!(strip_offset(0), 0);
        assert_eq!(strip_offset(1), 0);
        assert_eq!(strip_offset(TITLE_SCROLL_FRAMES), 1);
        assert_eq!(strip_offset(TITLE_STRIP_PERIOD * TITLE_SCROLL_FRAMES), 0);
        assert_eq!(strip_offset(TITLE_STRIP_PERIOD * TITLE_SCROLL_FRAMES - 1), TITLE_STRIP_PERIOD - 1);
        let mut t = TitleScreen::new(0);
        for _ in 0..100 {
            t.step(&NO_PAD);
        }
        assert_eq!(t.scroll(), 50);
    }
}
