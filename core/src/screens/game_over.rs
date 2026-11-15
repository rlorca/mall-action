//! Game over: PA chime, typewriter message, shutters roll down, "GAME OVER" with scores (screens agent 1).
//!
//! Timeline (60 Hz frames): the PA chime at 0; the typewriter starts at `TYPE_START` (3 frames per char);
//! the metal shutters roll down from the top between `SHUTTER_START` and `SHUTTERS_DOWN` (2 s) with a rattle;
//! "GAME OVER" shows from `GAME_OVER_AT`; START is accepted once the message and shutters are done;
//! the screen ends by itself at `TOTAL_FRAMES` (8 s).

use super::title::fancy_text;
use crate::art::storefront::{draw_storefront, FrontState};
use crate::copy::GAME_OVER_TYPED;
use crate::events::{Out, Sfx, Track};
use crate::input::{PadState, START};
use crate::pixel::{pal, text_width, Fb, FontKind, H, W};
use crate::types::StoreId;
use crate::ui::{blink, typed};

pub const TYPE_START: u32 = 12;
pub const FRAMES_PER_CHAR: u32 = 3;
pub const SHUTTER_START: u32 = 24;
/// Shutters take 120 frames (2 s) to roll all the way down.
pub const SHUTTER_FRAMES: u32 = 120;
pub const SHUTTERS_DOWN: u32 = SHUTTER_START + SHUTTER_FRAMES;
/// "GAME OVER" appears (after the shutters and the message are done).
pub const GAME_OVER_AT: u32 = 170;
/// Total length before returning to the title (8 s).
pub const TOTAL_FRAMES: u32 = 480;
const SLAT_H: i32 = 4;

pub struct GameOver {
    score: u32,
    high: u32,
    t: u32,
    done: bool,
}

/// Number of characters in the whole typed message (both lines).
fn message_chars() -> u32 {
    GAME_OVER_TYPED.iter().map(|l| l.chars().count() as u32).sum()
}

/// Frame at which the typewriter has printed the entire message.
pub fn message_done_at() -> u32 {
    TYPE_START + message_chars() * FRAMES_PER_CHAR
}

impl GameOver {
    pub fn new(score: u32, high_score: u32) -> GameOver {
        GameOver { score, high: high_score, t: 0, done: false }
    }

    pub fn frame(&self) -> u32 {
        self.t
    }

    /// Height in pixels the shutters have rolled down (0..=H).
    pub fn shutter_height(&self) -> i32 {
        shutter_height_at(self.t)
    }

    pub fn game_over_visible(&self) -> bool {
        self.t >= GAME_OVER_AT
    }

    /// START works once the message has finished and the shutters are down.
    pub fn skippable(&self) -> bool {
        self.t >= message_done_at().max(SHUTTERS_DOWN)
    }

    /// Returns true when finished and the game should go back to the title.
    pub fn step(&mut self, pad: PadState, out: &mut Out) -> bool {
        if self.done {
            return true;
        }
        if self.t == 0 {
            out.sfx(Sfx::PaChime);
        }
        // typewriter blips: one per printed character (skip spaces)
        if self.t >= TYPE_START && (self.t - TYPE_START) % FRAMES_PER_CHAR == 0 {
            let n = ((self.t - TYPE_START) / FRAMES_PER_CHAR) as usize;
            if n >= 1 {
                if let Some(c) = message_char(n - 1) {
                    if c != ' ' {
                        out.sfx(Sfx::TextBlip);
                    }
                }
            }
        }
        // shutter rattle while rolling, thud when they hit the floor
        if self.t >= SHUTTER_START && self.t < SHUTTERS_DOWN && self.t % 4 == 0 {
            out.sfx(Sfx::Tick);
        }
        if self.t == SHUTTERS_DOWN {
            out.sfx(Sfx::Thud);
        }
        if self.t == GAME_OVER_AT {
            out.music(Track::GameOver);
        }
        if self.skippable() && pad.just_pressed(START) {
            self.done = true;
            return true;
        }
        self.t += 1;
        if self.t >= TOTAL_FRAMES {
            self.done = true;
            return true;
        }
        false
    }

    /// `backdrop` is the last gameplay frame the shutters roll down over (None = plain mall backdrop).
    pub fn draw(&self, fb: &mut Fb, backdrop: Option<&Fb>) {
        match backdrop {
            Some(b) => fb.px.copy_from_slice(&b.px),
            None => generic_backdrop(fb),
        }
        let sh = self.shutter_height();
        draw_shutters(fb, sh, self.t);

        let cx = W as i32 / 2;
        // PA message on a dark plate (typed)
        let typed_total = self.t.saturating_sub(TYPE_START);
        let l1 = typed(GAME_OVER_TYPED[0], typed_total, FRAMES_PER_CHAR);
        let used = l1.chars().count() as u32 * FRAMES_PER_CHAR;
        let l2 = typed(GAME_OVER_TYPED[1], typed_total.saturating_sub(GAME_OVER_TYPED[0].chars().count() as u32 * FRAMES_PER_CHAR), FRAMES_PER_CHAR);
        let _ = used;
        if self.t >= TYPE_START {
            let y = if self.game_over_visible() { 22 } else { 92 };
            let w = text_width(FontKind::Normal, GAME_OVER_TYPED[1]) + 14;
            fb.rect(cx - w / 2, y, w, 33, pal::BLACK);
            fb.frame(cx - w / 2, y, w, 33, pal::WHITE);
            fb.frame(cx - w / 2 + 2, y + 2, w - 4, 29, pal::DGRAY);
            fb.text(cx - w / 2 + 7, y + 7, l1, pal::YELLOW);
            let cursor = blink(self.t, 8, 8) && l2.chars().count() < GAME_OVER_TYPED[1].chars().count();
            let x2 = fb.text(cx - w / 2 + 7, y + 19, l2, pal::WHITE);
            if cursor {
                fb.rect(x2, y + 19, 5, 7, pal::WHITE);
            }
        }

        if self.game_over_visible() {
            let t = self.t - GAME_OVER_AT;
            // drops in from the top
            let drop = if t < 20 { -((20 - t as i32) * (20 - t as i32)) / 4 } else { 0 };
            let gw = Fb::text_scaled_width("GAME OVER", 4);
            let (gx, gy) = (cx - gw / 2, 78 + drop);
            fancy_text(fb, gx, gy, "GAME OVER", 4, pal::LRED, pal::RED, pal::BLACK, pal::DRED);
            if t > 24 {
                let score = format!("SCORE    {:06}", self.score.min(999_999));
                let hi = format!("HI-SCORE {:06}", self.high.min(999_999));
                plate(fb, cx, 128, &score, pal::WHITE);
                plate(fb, cx, 144, &hi, pal::YELLOW);
                if self.score > 0 && self.score >= self.high && blink(t, 12, 8) {
                    fb.text_center(cx, 162, "NEW HI-SCORE!", pal::LGREEN);
                }
            }
            if self.skippable() && t > 40 && blink(t, 30, 20) {
                fb.text_center(cx + 1, 193, "PRESS START", pal::BLACK);
                fb.text_center(cx, 192, "PRESS START", pal::WHITE);
            }
        }
    }
}

fn plate(fb: &mut Fb, cx: i32, y: i32, s: &str, c: u8) {
    let w = text_width(FontKind::Normal, s) + 12;
    fb.rect(cx - w / 2, y - 3, w, 13, pal::BLACK);
    fb.frame(cx - w / 2, y - 3, w, 13, pal::DGRAY);
    fb.text_center(cx, y, s, c);
}

fn message_char(i: usize) -> Option<char> {
    let mut i = i;
    for l in GAME_OVER_TYPED {
        let n = l.chars().count();
        if i < n {
            return l.chars().nth(i);
        }
        i -= n;
    }
    None
}

/// Pixels of shutter rolled down at frame `t`: 0 before SHUTTER_START, `H` once SHUTTERS_DOWN, eased in
/// between (accelerating like a heavy shutter falling, with the last stretch slowed by the slats stacking).
pub fn shutter_height_at(t: u32) -> i32 {
    if t <= SHUTTER_START {
        return 0;
    }
    if t >= SHUTTERS_DOWN {
        return H as i32;
    }
    let p = (t - SHUTTER_START) as i32;
    let n = SHUTTER_FRAMES as i32;
    // quadratic ease-in then linear: h = H * p^2 / n^2 would end too fast; blend with linear
    let lin = H as i32 * p / n;
    let quad = H as i32 * p * p / (n * n);
    (lin + quad) / 2
}

fn draw_shutters(fb: &mut Fb, height: i32, t: u32) {
    if height <= 0 {
        return;
    }
    let w = W as i32;
    let rolling = height < H as i32;
    let mut y = 0;
    let mut row = 0;
    while y < height {
        let h = SLAT_H.min(height - y);
        // rattle: the bottom slats wobble sideways while the shutter is moving
        let wob = if rolling && height - y < 40 { ((t / 2 + row as u32) % 3) as i32 - 1 } else { 0 };
        fb.rect(wob, y, w, h, pal::LGRAY);
        fb.rect(wob, y, w, 1.min(h), pal::LGRAY);
        if h > 2 {
            fb.rect(wob, y + 2, w, h - 2, pal::GRAY);
        }
        if h >= SLAT_H {
            fb.rect(wob, y + 3, w, 1, pal::DGRAY);
        }
        // little rivet / perforation marks, staggered per row
        for x in (((row % 2) * 8)..w).step_by(16) {
            fb.put(x + wob, y + 1, pal::DGRAY);
        }
        y += SLAT_H;
        row += 1;
    }
    if rolling {
        // heavy bottom bar with yellow-black hazard stripes
        let by = (height - 1).max(0);
        fb.rect(0, by - 3, w, 5, pal::CHARCOAL);
        for x in (0..w).step_by(12) {
            fb.rect(x, by - 2, 6, 3, pal::YELLOW);
        }
        fb.rect(0, by + 2, w, 1, pal::BLACK);
        // handle
        fb.rect(w / 2 - 8, by - 5, 16, 3, pal::DGRAY);
    }
}

/// A plain mall frontage used when no gameplay frame is available.
fn generic_backdrop(fb: &mut Fb) {
    fb.clear(pal::DPURPLE);
    fb.rect(0, 16, W as i32, 150, pal::PLUM);
    fb.dither_rect(0, 16, W as i32, 150, pal::DPURPLE, 0);
    let floor = 200;
    fb.rect(0, floor, W as i32, H as i32 - floor, pal::GRAY);
    fb.rect(0, floor, W as i32, 2, pal::LGRAY);
    let st = FrontState::default();
    for (i, id) in [StoreId::KgbToys, StoreId::Forever12, StoreId::RadioShock].iter().enumerate() {
        draw_storefront(fb, *id, i as i32 * 86 - 2, floor, &st);
    }
    // the agent, standing in the concourse
    let ag = crate::art::get("agent_stand");
    fb.blit(ag, 0, 120, floor - 24 + 10, false);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::Event;

    fn idle() -> PadState {
        PadState::default()
    }

    #[test]
    fn plays_chime_first_then_blips_then_the_jingle() {
        let mut s = GameOver::new(100, 200);
        let mut out = Out::new();
        s.step(idle(), &mut out);
        assert_eq!(out.events[0], Event::Sfx(Sfx::PaChime));
        for _ in 0..GAME_OVER_AT + 5 {
            s.step(idle(), &mut out);
        }
        let blips = out.count_sfx(Sfx::TextBlip);
        let letters = GAME_OVER_TYPED.iter().flat_map(|l| l.chars()).filter(|c| *c != ' ').count();
        assert_eq!(blips, letters);
        let jingles = out.events.iter().filter(|e| **e == Event::Music(Track::GameOver)).count();
        assert_eq!(jingles, 1);
        assert_eq!(out.count_sfx(Sfx::PaChime), 1);
    }

    #[test]
    fn shutters_are_fully_down_before_game_over_shows() {
        assert!(SHUTTERS_DOWN <= GAME_OVER_AT && message_done_at() <= GAME_OVER_AT);
        let mut s = GameOver::new(0, 0);
        let mut out = Out::new();
        let mut last = 0;
        for _ in 0..GAME_OVER_AT {
            assert!(!s.game_over_visible());
            s.step(idle(), &mut out);
            let h = s.shutter_height();
            assert!(h >= last, "shutters never go back up");
            last = h;
        }
        assert_eq!(s.shutter_height(), H as i32);
        s.step(idle(), &mut out);
        assert!(s.game_over_visible());
    }

    #[test]
    fn shutters_start_at_the_top_and_take_about_two_seconds() {
        assert_eq!(shutter_height_at(SHUTTER_START), 0);
        assert!(shutter_height_at(SHUTTER_START + 1) > 0);
        assert!(shutter_height_at(SHUTTERS_DOWN - 1) < H as i32);
        assert_eq!(shutter_height_at(SHUTTERS_DOWN), H as i32);
        assert_eq!(SHUTTER_FRAMES, 120);
    }

    #[test]
    fn shutters_cover_the_backdrop_from_the_top_down() {
        let mut back = Fb::new();
        back.clear(pal::LGREEN);
        let mut s = GameOver::new(0, 0);
        let mut out = Out::new();
        for _ in 0..SHUTTER_START + 60 {
            s.step(idle(), &mut out);
        }
        let h = s.shutter_height();
        assert!(h > 20 && h < H as i32 - 20);
        let mut fb = Fb::new();
        s.draw(&mut fb, Some(&back));
        // below the shutters the gameplay frame is untouched, above it is covered
        assert_eq!(fb.get(5, H as i32 - 1), pal::LGREEN);
        assert_ne!(fb.get(5, 5), pal::LGREEN);
        assert_ne!(fb.get(250, 10), pal::LGREEN);
    }

    #[test]
    fn game_over_text_shows_scores_after_the_shutters() {
        let mut s = GameOver::new(48250, 62000);
        let mut out = Out::new();
        for _ in 0..GAME_OVER_AT + 60 {
            s.step(idle(), &mut out);
        }
        let mut fb = Fb::new();
        s.draw(&mut fb, None);
        assert!(fb.px.iter().any(|p| *p == pal::LRED), "GAME OVER letters are red");
        assert!(fb.px.iter().any(|p| *p == pal::YELLOW), "HI-SCORE line in yellow");
    }

    #[test]
    fn start_is_ignored_until_the_message_is_done() {
        let mut s = GameOver::new(5, 5);
        let mut out = Out::new();
        for f in 0..message_done_at().max(SHUTTERS_DOWN) {
            assert!(!s.step(PadState::from_held(0, START), &mut out), "early start at {f}");
            assert!(!s.skippable() || f + 1 >= message_done_at());
        }
        assert!(s.skippable());
        assert!(s.step(PadState::from_held(0, START), &mut out));
    }

    #[test]
    fn returns_true_after_480_frames_and_stays_true() {
        let mut s = GameOver::new(5, 5);
        let mut out = Out::new();
        for f in 1..TOTAL_FRAMES {
            assert!(!s.step(idle(), &mut out), "frame {f}");
        }
        assert!(s.step(idle(), &mut out));
        assert!(s.step(idle(), &mut out));
    }

    #[test]
    fn typewriter_text_appears_progressively() {
        let at = |n: u32| {
            let mut s = GameOver::new(0, 0);
            let mut out = Out::new();
            for _ in 0..n {
                s.step(idle(), &mut out);
            }
            let mut fb = Fb::new();
            fb.clear(pal::BLACK);
            s.draw(&mut fb, None);
            fb.px.iter().filter(|p| **p == pal::YELLOW).count()
        };
        // line 1 is yellow: more pixels after more frames, none at the start
        // (the backdrop also contains some yellow, so compare counts rather than expecting zero)
        assert!(at(5) < at(TYPE_START + 30));
        assert!(at(TYPE_START + 30) < at(TYPE_START + 19 * FRAMES_PER_CHAR + 1));
    }
}
