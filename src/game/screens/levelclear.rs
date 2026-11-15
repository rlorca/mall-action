use super::screen::Screen;
use super::screentext::{loop_label, SCREEN_TEXT};
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::{SpygramPost, HEADLINES, SPYGRAM_COMPLETE};
use crate::content::stores::PACKAGES_TOTAL;
use crate::engine::num::round_i;
use crate::engine::pad::{btn, Pad};
use crate::engine::rng::Rng;

/// LEVEL CLEAR: four phases, Start skips ahead one phase, after the last one `done`.
///   0 DRIVE     garage backdrop; the wood-panelled wagon drives off while a spy chases it waving a receipt
///   1 TALLY     a receipt: packages, time bonus, clear bonus, LOOP n, score (counting up, blip sfx)
///   2 NEWS      front page of THE DAILY MALL with a random headline
///   3 SPYGRAM   a random mission-complete post
/// Phases 2..3 advance on their own timers too, so an idle player still moves on to the next loop.
///
/// The screen does NOT touch the Run: the Game adds `bonus_total` (time bonus + clear bonus) to the score
/// itself. `score` is the score BEFORE those bonuses (pass `score_includes_bonus: true` if the Game already
/// added them) so the SCORE line can count up from the old score to `final_score`.
pub const LC_DRIVE_FRAMES: i32 = 270;
pub const LC_NEWS_FRAMES: i32 = 7 * 60;
pub const LC_SPYGRAM_FRAMES: i32 = 8 * 60;
/// After the last tally line has finished counting, how long the receipt stays up.
pub const LC_TALLY_HOLD: i32 = 100;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum LevelClearPhase {
    Drive = 0,
    Tally = 1,
    News = 2,
    Spygram = 3,
}

pub const PHASE_DRIVE: LevelClearPhase = LevelClearPhase::Drive;
pub const PHASE_TALLY: LevelClearPhase = LevelClearPhase::Tally;
pub const PHASE_NEWS: LevelClearPhase = LevelClearPhase::News;
pub const PHASE_SPYGRAM: LevelClearPhase = LevelClearPhase::Spygram;

impl LevelClearPhase {
    fn next(self) -> LevelClearPhase {
        match self {
            LevelClearPhase::Drive => LevelClearPhase::Tally,
            LevelClearPhase::Tally => LevelClearPhase::News,
            LevelClearPhase::News | LevelClearPhase::Spygram => LevelClearPhase::Spygram,
        }
    }
}

pub struct LevelClearOpts<'a> {
    pub rng: &'a Rng,
    /// Packages collected this level (normally 6).
    pub packages: i32,
    /// Points for the time left (run.time_bonus()).
    pub time_bonus: i32,
    /// The flat clear bonus (1000).
    pub clear_bonus: i32,
    /// The loop just completed (shown as "LOOP n").
    pub loop_n: i32,
    /// Score before the bonuses are added (see above).
    pub score: i32,
    pub score_includes_bonus: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TallyRowView {
    pub label: String,
    /// Text of the value as currently counted (e.g. "4/6", "+1200", "LOOP 1", "012340").
    pub value: String,
    pub visible: bool,
    pub counting: bool,
    pub done: bool,
    /// Highlight (the final score line).
    pub total: bool,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum TallyKey {
    Packages,
    Time,
    Clear,
    Loop,
    Score,
}

#[derive(Clone, Debug)]
struct TallyDef {
    key: TallyKey,
    label: String,
    start: i32,
    dur: i32,
    from: i32,
    to: i32,
}

const GAP: i32 = 14;

pub struct LevelClearScreen {
    pub packages: i32,
    pub time_bonus: i32,
    pub clear_bonus: i32,
    pub loop_n: i32,
    pub base_score: i32,
    /// What the Game must add to the score.
    pub bonus_total: i32,
    /// base_score + bonus_total: what the SCORE line ends on.
    pub final_score: i32,
    pub headline: &'static str,
    pub post: SpygramPost,
    /// Seed for spygram_likes().
    pub like_seed: i32,

    phase: LevelClearPhase,
    phase_frame: i32,
    frame: i32,
    done: bool,
    sfx: Vec<SfxId>,
    defs: Vec<TallyDef>,
    tally_end: i32,
}

impl LevelClearScreen {
    pub fn new(opts: LevelClearOpts) -> LevelClearScreen {
        let bonus_total = opts.time_bonus + opts.clear_bonus;
        let base_score = if opts.score_includes_bonus { (opts.score - bonus_total).max(0) } else { opts.score };
        let final_score = base_score + bonus_total;
        let mut r = opts.rng.fork("levelclear");
        let headline = *r.pick(HEADLINES);
        let post = *r.pick(SPYGRAM_COMPLETE);
        let like_seed = r.int(1 << 30);

        // Tally schedule (phase-1 frames): each line starts when the previous finished, plus a gap.
        let tt = SCREEN_TEXT.tally;
        let mut defs: Vec<TallyDef> = Vec::new();
        let mut t = 24;
        let mut add = |key: TallyKey, label: String, dur: i32, from: i32, to: i32| {
            defs.push(TallyDef { key, label, start: t, dur, from, to });
            t += dur + GAP;
        };
        add(TallyKey::Packages, tt.packages.to_string(), 12.max(opts.packages * 8), 0, opts.packages);
        add(TallyKey::Time, tt.time.to_string(), 50, 0, opts.time_bonus);
        add(TallyKey::Clear, tt.clear.to_string(), 40, 0, opts.clear_bonus);
        add(TallyKey::Loop, loop_label(opts.loop_n), 0, 0, 0);
        add(TallyKey::Score, tt.score.to_string(), 64, base_score, final_score);
        let tally_end = t - GAP + LC_TALLY_HOLD;

        LevelClearScreen {
            packages: opts.packages,
            time_bonus: opts.time_bonus,
            clear_bonus: opts.clear_bonus,
            loop_n: opts.loop_n,
            base_score,
            bonus_total,
            final_score,
            headline,
            post,
            like_seed,
            phase: LevelClearPhase::Drive,
            phase_frame: 0,
            frame: 0,
            done: false,
            sfx: Vec::new(),
            defs,
            tally_end,
        }
    }

    pub fn phase(&self) -> LevelClearPhase {
        self.phase
    }

    /// Frames since the current phase began.
    pub fn phase_frame(&self) -> i32 {
        self.phase_frame
    }

    /// Frames since the screen began.
    pub fn frame(&self) -> i32 {
        self.frame
    }

    /// Receipt rows for the renderer, computed from the tally clock.
    pub fn tally(&self) -> Vec<TallyRowView> {
        let pf: f64 = if self.phase == PHASE_TALLY {
            self.phase_frame as f64
        } else if self.phase > PHASE_TALLY {
            1e9
        } else {
            0.0
        };
        self.defs
            .iter()
            .map(|d| {
                let visible = pf >= d.start as f64;
                let p = if d.dur == 0 {
                    if visible {
                        1.0
                    } else {
                        0.0
                    }
                } else {
                    ((pf - d.start as f64) / d.dur as f64).min(1.0).max(0.0)
                };
                let v = round_i(d.from as f64 + (d.to - d.from) as f64 * p);
                let done = visible && p >= 1.0;
                let value = match d.key {
                    TallyKey::Packages => format!("{}/{}", v, PACKAGES_TOTAL),
                    TallyKey::Time | TallyKey::Clear => format!("+{}", v),
                    TallyKey::Loop => String::new(),
                    TallyKey::Score => format!("{:0>6}", v.to_string()),
                };
                TallyRowView { label: d.label.clone(), value, visible, counting: visible && !done, done, total: d.key == TallyKey::Score }
            })
            .collect()
    }

    fn advance(&mut self, by_player: bool) {
        if self.phase == PHASE_SPYGRAM {
            self.done = true;
            if by_player {
                self.sfx.push(SfxId::Select);
            }
            return;
        }
        self.phase = self.phase.next();
        self.phase_frame = 0;
        if by_player {
            self.sfx.push(SfxId::Select);
        }
        if self.phase == PHASE_NEWS {
            self.sfx.push(SfxId::Thud);
        }
        if self.phase == PHASE_SPYGRAM {
            self.sfx.push(SfxId::Camera);
        }
    }
}

impl Screen for LevelClearScreen {
    fn step(&mut self, pad: &Pad) {
        if self.done {
            return;
        }
        self.frame += 1;
        if pad.pressed & btn::START != 0 {
            self.advance(true);
            return;
        }
        self.phase_frame += 1;
        let pf = self.phase_frame;
        match self.phase {
            LevelClearPhase::Drive => {
                if pf == 24 {
                    self.sfx.push(SfxId::Door);
                }
                if pf == 52 {
                    self.sfx.push(SfxId::Zip);
                }
                if pf >= LC_DRIVE_FRAMES {
                    self.advance(false);
                }
            }
            LevelClearPhase::Tally => {
                for d in &self.defs {
                    let local = pf - d.start;
                    if local == 0 && d.dur == 0 {
                        self.sfx.push(SfxId::Coin);
                    } else if local > 0 && local <= d.dur {
                        if local % 3 == 0 && local < d.dur {
                            self.sfx.push(SfxId::Blip);
                        }
                        if local == d.dur {
                            self.sfx.push(SfxId::Coin);
                        }
                    }
                }
                if pf >= self.tally_end {
                    self.advance(false);
                }
            }
            LevelClearPhase::News => {
                if pf >= LC_NEWS_FRAMES {
                    self.advance(false);
                }
            }
            LevelClearPhase::Spygram => {
                if pf >= LC_SPYGRAM_FRAMES {
                    self.advance(false);
                }
            }
        }
    }

    fn done(&self) -> bool {
        self.done
    }

    fn music(&self) -> Option<MusicId> {
        if self.phase < PHASE_NEWS {
            Some(MusicId::Levelclear)
        } else {
            Some(MusicId::Newspaper)
        }
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

    /// Defaults of the TS `make()` helper: packages 6, timeBonus 1500, clearBonus 1000, loop 1, score 4000.
    fn make_with(seed: u32, f: impl FnOnce(&mut LevelClearOpts)) -> LevelClearScreen {
        let rng = Rng::new(seed);
        let mut o = LevelClearOpts { rng: &rng, packages: 6, time_bonus: 1500, clear_bonus: 1000, loop_n: 1, score: 4000, score_includes_bonus: false };
        f(&mut o);
        LevelClearScreen::new(o)
    }

    fn make(seed: u32) -> LevelClearScreen {
        make_with(seed, |_| {})
    }

    #[test]
    fn starts_in_the_drive_off_phase_with_the_level_clear_jingle() {
        let s = make(1);
        assert_eq!(s.phase(), PHASE_DRIVE);
        assert_eq!(s.music(), Some(MusicId::Levelclear));
        assert!(!s.done());
    }

    #[test]
    fn start_skips_ahead_exactly_one_phase_at_a_time_and_finishes_after_the_last() {
        let mut s = make(1);
        let mut seen = vec![s.phase()];
        for _ in 0..3 {
            s.step(&NO_PAD);
            s.step(&press(btn::START));
            seen.push(s.phase());
        }
        assert_eq!(seen, vec![PHASE_DRIVE, PHASE_TALLY, PHASE_NEWS, PHASE_SPYGRAM]);
        assert!(!s.done());
        s.step(&press(btn::START));
        assert!(s.done());
    }

    #[test]
    fn other_buttons_do_not_skip() {
        let mut s = make(1);
        for b in [btn::A, btn::B, btn::SELECT, btn::UP] {
            s.step(&press(b));
        }
        assert_eq!(s.phase(), PHASE_DRIVE);
    }

    #[test]
    fn music_levelclear_jingle_for_drive_and_tally_newspaper_loop_for_the_news_and_the_spygram() {
        let mut s = make(1);
        let mut m = vec![s.music()];
        for _ in 0..3 {
            s.step(&press(btn::START));
            m.push(s.music());
        }
        assert_eq!(m, vec![Some(MusicId::Levelclear), Some(MusicId::Levelclear), Some(MusicId::Newspaper), Some(MusicId::Newspaper)]);
    }

    #[test]
    fn advances_through_every_phase_on_its_own_timers_and_then_finishes() {
        let mut s = make(1);
        let mut steps = 0;
        let mut phases: Vec<i32> = Vec::new();
        while !s.done() && steps < 20000 {
            s.step(&NO_PAD);
            let p = s.phase() as i32;
            if !phases.contains(&p) {
                phases.push(p);
            }
            steps += 1;
        }
        assert!(s.done());
        phases.sort();
        assert_eq!(phases, vec![0, 1, 2, 3]);
        assert!(steps > LC_DRIVE_FRAMES + LC_NEWS_FRAMES + LC_SPYGRAM_FRAMES);
    }

    #[test]
    fn picks_a_headline_and_a_mission_complete_post_from_the_copy_deterministically_per_rng() {
        let a = make(7);
        let b = make(7);
        assert!(HEADLINES.contains(&a.headline));
        assert!(SPYGRAM_COMPLETE.iter().any(|p| p.comment == a.post.comment && p.caption == a.post.caption));
        assert_eq!(a.headline, b.headline);
        assert_eq!(a.post.comment, b.post.comment);
        assert_eq!(a.post.caption, b.post.caption);
        assert_eq!(a.like_seed, b.like_seed);
        let mut seen: Vec<&str> = Vec::new();
        for seed in 1..60 {
            let h = make(seed).headline;
            if !seen.contains(&h) {
                seen.push(h);
            }
        }
        assert!(seen.len() > 1);
    }

    #[test]
    fn does_not_advance_the_injected_rng_it_forks() {
        let rng = Rng::new(3);
        let state = rng.state();
        LevelClearScreen::new(LevelClearOpts { rng: &rng, packages: 6, time_bonus: 0, clear_bonus: 1000, loop_n: 2, score: 0, score_includes_bonus: false });
        assert_eq!(rng.state(), state);
    }

    #[test]
    fn bonus_total_and_final_score_score_includes_bonus_keeps_the_final_score() {
        let s = make(1);
        assert_eq!(s.bonus_total, 2500);
        assert_eq!(s.final_score, 6500);
        let t = make_with(1, |o| {
            o.score = 6500;
            o.score_includes_bonus = true;
        });
        assert_eq!(t.base_score, 4000);
        assert_eq!(t.final_score, 6500);
    }

    #[test]
    fn the_tally_counts_up_row_by_row_packages_time_bonus_clear_bonus_loop_n_score() {
        let mut s = make_with(1, |o| o.loop_n = 3);
        s.step(&press(btn::START)); // -> tally
        assert_eq!(s.phase(), PHASE_TALLY);
        assert_eq!(s.tally().iter().map(|r| r.visible).collect::<Vec<_>>(), vec![false, false, false, false, false]);
        let mut sfx: Vec<SfxId> = Vec::new();
        let mut guard = 0;
        let mut last_visible = 0;
        while s.phase() == PHASE_TALLY && guard < 5000 {
            guard += 1;
            s.step(&NO_PAD);
            sfx.extend(s.drain_sfx());
            let vis = s.tally().iter().filter(|r| r.visible).count();
            assert!(vis >= last_visible); // rows only ever appear, in order
            last_visible = vis;
        }
        let fin = s.tally();
        assert_eq!(fin.iter().map(|r| r.visible).collect::<Vec<_>>(), vec![true, true, true, true, true]);
        assert_eq!(fin[0].value, "6/6");
        assert_eq!(fin[1].value, "+1500");
        assert_eq!(fin[2].value, "+1000");
        assert_eq!(fin[3].label, "LOOP 3");
        assert_eq!(fin[4].value, "006500");
        assert!(fin[4].total);
        assert!(sfx.iter().filter(|x| **x == SfxId::Blip).count() > 5);
        assert!(sfx.contains(&SfxId::Coin));
    }

    #[test]
    fn tally_values_rise_monotonically_while_counting() {
        let mut s = make(1);
        s.step(&press(btn::START));
        let mut prev = -1;
        let mut i = 0;
        while i < 400 && s.phase() == PHASE_TALLY {
            i += 1;
            s.step(&NO_PAD);
            let v: i32 = s.tally()[1].value.replace('+', "").parse().unwrap();
            assert!(v >= prev);
            prev = v;
        }
        assert_eq!(prev, 1500);
    }

    #[test]
    fn rows_are_all_final_once_past_the_tally_phase() {
        let mut s = make(1);
        s.step(&press(btn::START));
        s.step(&press(btn::START));
        assert_eq!(s.phase(), PHASE_NEWS);
        assert!(s.tally().iter().all(|r| r.visible && !r.counting));
    }

    #[test]
    fn handles_a_tiny_clear_no_time_bonus_0_packages() {
        let mut s = make_with(1, |o| {
            o.packages = 0;
            o.time_bonus = 0;
        });
        s.step(&press(btn::START));
        let mut i = 0;
        while i < 600 && s.phase() == PHASE_TALLY {
            i += 1;
            s.step(&NO_PAD);
        }
        assert_eq!(s.tally()[0].value, "0/6");
        assert_eq!(s.tally()[4].value, "005000");
    }
}
