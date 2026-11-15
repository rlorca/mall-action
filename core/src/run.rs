//! Session-wide game state that survives scene changes (mall <-> store) and deaths: score, lives, continues,
//! loop number, packages, power-ups, opened fixtures, per-game "first time" flags and the inventory.
//! Also the scoring rules and the difficulty curve.

use std::collections::{HashMap, HashSet};

use crate::events::{Out, Sfx};
use crate::powerup::PowerState;
use crate::rng::Rng;
use crate::types::{Content, StoreId, PACKAGES_TOTAL, STORE_COUNT};

pub const START_LIVES: u32 = 3;
pub const MAX_CONTINUES: u32 = 3;
pub const EXTRA_LIFE_SCORE: u32 = 20_000;

// Points
pub const PTS_SPY_SHOT: i32 = 100;
pub const PTS_SPY_SPECIAL: i32 = 300; // crushed, lamp, disco ball, wet-floor slide kick
pub const PTS_PACKAGE: i32 = 500;
pub const PTS_POWERUP: i32 = 50;
pub const PTS_LEVEL_CLEAR: i32 = 1000;
pub const PTS_COIN: i32 = 50;
pub const PTS_WALKER: i32 = -200;
pub const PTS_COP: i32 = -500;
pub const PTS_JOKE_ITEM: i32 = 1;
/// Time bonus: 10 points for every full second under this many seconds.
pub const TIME_BONUS_BASE_SECS: u32 = 300;

/// Everything about how hard a loop is. All values are capped.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Difficulty {
    pub loop_no: u32,
    /// Multiplier on spy walking speed.
    pub spy_speed: f32,
    /// Multiplier on how often spies spawn.
    pub spawn_rate: f32,
    /// Multiplier on how often spies shoot.
    pub shoot_rate: f32,
    /// Frames of level time before the alarm sounds.
    pub alarm_frames: u32,
    /// Maximum spies on screen.
    pub spy_cap: usize,
}

pub const ALARM_FRAMES_LOOP1: u32 = 150 * 60;
pub const BASE_SHOT_INTERVAL: u32 = 150; // 2.5 s
pub const MIN_SHOT_INTERVAL: u32 = 60; // never more often than once a second
pub const SPY_CAP_BASE: usize = 4;

impl Difficulty {
    pub fn new(loop_no: u32, black_friday: bool) -> Difficulty {
        let n = loop_no.max(1) - 1;
        let pow = |b: f32| b.powi(n as i32);
        let alarm = ALARM_FRAMES_LOOP1.saturating_sub(20 * 60 * n).max(60 * 60);
        Difficulty {
            loop_no: loop_no.max(1),
            spy_speed: pow(1.10).min(1.6),
            spawn_rate: (pow(1.15) * if black_friday { 2.0 } else { 1.0 }).min(if black_friday { 5.0 } else { 2.5 }),
            shoot_rate: pow(1.15).min(2.5),
            alarm_frames: alarm,
            spy_cap: if black_friday { SPY_CAP_BASE * 2 } else { SPY_CAP_BASE },
        }
    }

    /// Frames between a spy's shots at this difficulty (>= 60).
    pub fn shot_interval(&self) -> u32 {
        (((BASE_SHOT_INTERVAL as f32) / self.shoot_rate) as u32).max(MIN_SHOT_INTERVAL)
    }

    /// Alarm makes spies about 25% faster.
    pub fn alarm_speed_mul(alarm: bool) -> f32 {
        if alarm {
            1.25
        } else {
            1.0
        }
    }
}

#[derive(Clone, Debug)]
pub struct RunState {
    pub seed: u64,
    pub rng: Rng,
    pub score: u32,
    pub high_score: u32,
    pub lives: u32,
    pub continues_left: u32,
    pub loop_no: u32,
    pub black_friday: bool,
    /// Package collected, indexed by `StoreId::index()`.
    pub taken: [bool; STORE_COUNT],
    pub power: PowerState,
    /// Frames spent in the current level (stops while paused / in map / continue screen).
    pub frames: u32,
    pub alarm: bool,
    /// Fixture contents per store for this level (filled by `store::setup_level`).
    pub fixtures: HashMap<StoreId, Vec<Content>>,
    /// Fixtures already searched this level: (store, fixture index).
    pub opened: HashSet<(StoreId, usize)>,
    /// Stores entered at least once this GAME (first-visit lines).
    pub visited: HashSet<StoreId>,
    /// GameStonk cave easter egg already seen this game.
    pub egg_done: bool,
    /// The photo-booth strip was already given this game.
    pub photo_done: bool,
    /// Joke items collected (names).
    pub inventory: Vec<String>,
    extra_life_given: bool,
}

impl RunState {
    pub fn new(seed: u64, black_friday: bool) -> RunState {
        RunState {
            seed,
            rng: Rng::new(seed),
            score: 0,
            high_score: 0,
            lives: START_LIVES,
            continues_left: MAX_CONTINUES,
            loop_no: 1,
            black_friday,
            taken: [false; STORE_COUNT],
            power: PowerState::new(),
            frames: 0,
            alarm: false,
            fixtures: HashMap::new(),
            opened: HashSet::new(),
            visited: HashSet::new(),
            egg_done: false,
            photo_done: false,
            inventory: Vec::new(),
            extra_life_given: false,
        }
    }

    pub fn difficulty(&self) -> Difficulty {
        Difficulty::new(self.loop_no, self.black_friday)
    }

    /// Add (or subtract) points. Score never goes below zero. The first time the score reaches 20,000 an extra
    /// life is awarded (once per game).
    pub fn add_score(&mut self, pts: i32, out: &mut Out) {
        let new = (self.score as i64 + pts as i64).max(0) as u32;
        self.score = new;
        if new > self.high_score {
            self.high_score = new;
        }
        if !self.extra_life_given && self.score >= EXTRA_LIFE_SCORE {
            self.extra_life_given = true;
            self.lives += 1;
            out.sfx(Sfx::ExtraLife);
        }
    }

    pub fn extra_life(&mut self, out: &mut Out) {
        self.lives += 1;
        out.sfx(Sfx::ExtraLife);
    }

    pub fn packages_found(&self) -> u32 {
        self.taken.iter().filter(|t| **t).count() as u32
    }

    pub fn packages_left(&self) -> u32 {
        PACKAGES_TOTAL.saturating_sub(self.packages_found())
    }

    pub fn has_all_packages(&self) -> bool {
        self.packages_found() >= PACKAGES_TOTAL
    }

    pub fn store_cleared(&self, id: StoreId) -> bool {
        self.taken[id.index()]
    }

    /// Mark the package of `id` as taken. Returns false if it was already taken.
    pub fn take_package(&mut self, id: StoreId, out: &mut Out) -> bool {
        if self.taken[id.index()] {
            return false;
        }
        self.taken[id.index()] = true;
        self.add_score(PTS_PACKAGE, out);
        true
    }

    /// The player died. Returns true if the game continues with another life.
    pub fn lose_life(&mut self) -> bool {
        self.power.on_death();
        self.lives = self.lives.saturating_sub(1);
        self.lives > 0
    }

    pub fn can_continue(&self) -> bool {
        self.lives == 0 && self.continues_left > 0
    }

    /// Use a continue: 3 fresh lives; score, packages and loop are kept; power-ups (even radar) are reset.
    pub fn use_continue(&mut self) -> bool {
        if self.continues_left == 0 {
            return false;
        }
        self.continues_left -= 1;
        self.lives = START_LIVES;
        self.power.reset_all();
        true
    }

    /// 10 points per full second under 300 s.
    pub fn time_bonus(&self) -> u32 {
        let secs = self.frames / 60;
        TIME_BONUS_BASE_SECS.saturating_sub(secs) * 10
    }

    /// Award the level-clear tally (packages already scored when found). Returns (time bonus, clear bonus).
    pub fn award_level_clear(&mut self, out: &mut Out) -> (u32, u32) {
        let t = self.time_bonus();
        self.add_score(t as i32, out);
        self.add_score(PTS_LEVEL_CLEAR, out);
        (t, PTS_LEVEL_CLEAR as u32)
    }

    /// Begin the next loop: packages, fixtures and the clock reset; harder difficulty; radar expires.
    pub fn start_next_loop(&mut self) {
        self.loop_no += 1;
        self.reset_level_state();
    }

    /// Reset everything that belongs to a single level (used at game start too).
    pub fn reset_level_state(&mut self) {
        self.taken = [false; STORE_COUNT];
        self.fixtures.clear();
        self.opened.clear();
        self.frames = 0;
        self.alarm = false;
        self.power.on_new_level();
    }

    pub fn add_item(&mut self, name: &str, out: &mut Out) {
        self.inventory.push(name.to_string());
        self.add_score(PTS_JOKE_ITEM, out);
    }

    pub fn is_opened(&self, id: StoreId, fixture: usize) -> bool {
        self.opened.contains(&(id, fixture))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rs() -> RunState {
        RunState::new(1, false)
    }

    #[test]
    fn starts_with_three_lives_and_three_continues() {
        let r = rs();
        assert_eq!((r.lives, r.continues_left, r.loop_no, r.score), (3, 3, 1, 0));
    }

    #[test]
    fn scoring_table() {
        let mut r = rs();
        let mut o = Out::new();
        r.add_score(PTS_SPY_SHOT, &mut o);
        r.add_score(PTS_SPY_SPECIAL, &mut o);
        r.add_score(PTS_PACKAGE, &mut o);
        r.add_score(PTS_POWERUP, &mut o);
        r.add_score(PTS_COIN, &mut o);
        r.add_score(PTS_JOKE_ITEM, &mut o);
        assert_eq!(r.score, 100 + 300 + 500 + 50 + 50 + 1);
        r.add_score(PTS_WALKER, &mut o);
        assert_eq!(r.score, 1001 - 200);
        r.add_score(PTS_COP, &mut o);
        assert_eq!(r.score, 301);
    }

    #[test]
    fn score_never_goes_negative() {
        let mut r = rs();
        let mut o = Out::new();
        r.add_score(100, &mut o);
        r.add_score(-500, &mut o);
        assert_eq!(r.score, 0);
    }

    #[test]
    fn extra_life_at_20000_exactly_once() {
        let mut r = rs();
        let mut o = Out::new();
        r.add_score(19_999, &mut o);
        assert_eq!(r.lives, 3);
        r.add_score(1, &mut o);
        assert_eq!(r.lives, 4);
        assert_eq!(o.count_sfx(Sfx::ExtraLife), 1);
        r.add_score(-5000, &mut o);
        r.add_score(10_000, &mut o);
        assert_eq!(r.lives, 4, "crossing 20k again must not repeat the award");
    }

    #[test]
    fn high_score_follows_score() {
        let mut r = rs();
        let mut o = Out::new();
        r.add_score(700, &mut o);
        r.add_score(-300, &mut o);
        assert_eq!(r.high_score, 700);
    }

    #[test]
    fn packages_count_and_are_taken_once() {
        let mut r = rs();
        let mut o = Out::new();
        assert!(r.take_package(StoreId::KgbToys, &mut o));
        assert!(!r.take_package(StoreId::KgbToys, &mut o));
        assert_eq!(r.packages_found(), 1);
        assert_eq!(r.packages_left(), 5);
        assert_eq!(r.score, 500);
        assert!(r.store_cleared(StoreId::KgbToys));
        for s in [StoreId::Forever12, StoreId::RadioShock, StoreId::SamBaddy, StoreId::HotSpyOnAStick, StoreId::FootLockpicker] {
            r.take_package(s, &mut o);
        }
        assert!(r.has_all_packages());
    }

    #[test]
    fn losing_lives_and_continuing() {
        let mut r = rs();
        r.power.grant(crate::types::PowerUp::Radar);
        r.power.grant(crate::types::PowerUp::ArmorVest);
        assert!(r.lose_life());
        assert!(r.power.radar && !r.power.armor, "death keeps radar only");
        assert!(r.lose_life());
        assert!(!r.lose_life());
        assert_eq!(r.lives, 0);
        assert!(r.can_continue());
        let mut o = Out::new();
        r.add_score(1234, &mut o);
        r.taken[0] = true;
        r.loop_no = 2;
        assert!(r.use_continue());
        assert_eq!((r.lives, r.continues_left, r.score, r.loop_no), (3, 2, 1234, 2));
        assert!(r.taken[0], "packages are kept");
        assert!(!r.power.radar, "power-ups, radar included, are reset by a continue");
    }

    #[test]
    fn exactly_three_continues() {
        let mut r = rs();
        for i in 0..3 {
            r.lives = 0;
            assert!(r.can_continue(), "continue {i}");
            assert!(r.use_continue());
        }
        r.lives = 0;
        assert!(!r.can_continue());
        assert!(!r.use_continue());
    }

    #[test]
    fn time_bonus_is_ten_per_second_under_300() {
        let mut r = rs();
        r.frames = 0;
        assert_eq!(r.time_bonus(), 3000);
        r.frames = 100 * 60;
        assert_eq!(r.time_bonus(), 2000);
        r.frames = 100 * 60 + 59;
        assert_eq!(r.time_bonus(), 2000);
        r.frames = 300 * 60;
        assert_eq!(r.time_bonus(), 0);
        r.frames = 999 * 60;
        assert_eq!(r.time_bonus(), 0);
    }

    #[test]
    fn level_clear_tally() {
        let mut r = rs();
        r.frames = 120 * 60;
        let mut o = Out::new();
        let (t, c) = r.award_level_clear(&mut o);
        assert_eq!((t, c), (1800, 1000));
        assert_eq!(r.score, 2800);
    }

    #[test]
    fn next_loop_resets_level_state_and_ramps_difficulty() {
        let mut r = rs();
        let mut o = Out::new();
        r.take_package(StoreId::KgbToys, &mut o);
        r.opened.insert((StoreId::KgbToys, 2));
        r.frames = 500;
        r.alarm = true;
        r.visited.insert(StoreId::KgbToys);
        r.egg_done = true;
        r.power.grant(crate::types::PowerUp::Radar);
        r.start_next_loop();
        assert_eq!(r.loop_no, 2);
        assert_eq!(r.packages_found(), 0);
        assert!(r.opened.is_empty() && r.frames == 0 && !r.alarm && !r.power.radar);
        assert!(r.visited.contains(&StoreId::KgbToys) && r.egg_done, "first-visit flags last the whole game");
    }

    #[test]
    fn difficulty_loop_one_is_the_baseline() {
        let d = Difficulty::new(1, false);
        assert_eq!((d.spy_speed, d.spawn_rate, d.shoot_rate), (1.0, 1.0, 1.0));
        assert_eq!(d.alarm_frames, 150 * 60);
        assert_eq!(d.shot_interval(), 150);
        assert_eq!(d.spy_cap, 4);
    }

    #[test]
    fn difficulty_ramps_about_as_specified() {
        let d = Difficulty::new(2, false);
        assert!((d.spy_speed - 1.10).abs() < 1e-4);
        assert!((d.spawn_rate - 1.15).abs() < 1e-4);
        assert!((d.shoot_rate - 1.15).abs() < 1e-4);
        assert_eq!(d.alarm_frames, 130 * 60);
        assert!(d.shot_interval() < 150);
    }

    #[test]
    fn difficulty_is_capped() {
        let d = Difficulty::new(500, false);
        assert!(d.spy_speed <= 1.6 + 1e-4 && d.spawn_rate <= 2.5 + 1e-4 && d.shoot_rate <= 2.5 + 1e-4);
        assert!(d.alarm_frames >= 60 * 60);
        assert!(d.shot_interval() >= MIN_SHOT_INTERVAL);
    }

    #[test]
    fn difficulty_is_monotonic() {
        let mut prev = Difficulty::new(1, false);
        for n in 2..12 {
            let d = Difficulty::new(n, false);
            assert!(d.spy_speed >= prev.spy_speed && d.spawn_rate >= prev.spawn_rate && d.shoot_rate >= prev.shoot_rate);
            assert!(d.alarm_frames <= prev.alarm_frames);
            prev = d;
        }
    }

    #[test]
    fn black_friday_doubles_cap_and_spawn_rate() {
        let a = Difficulty::new(1, false);
        let b = Difficulty::new(1, true);
        assert_eq!(b.spy_cap, a.spy_cap * 2);
        assert!((b.spawn_rate - a.spawn_rate * 2.0).abs() < 1e-4);
    }

    #[test]
    fn alarm_speeds_spies_up_25_percent() {
        assert_eq!(Difficulty::alarm_speed_mul(true), 1.25);
        assert_eq!(Difficulty::alarm_speed_mul(false), 1.0);
    }

    #[test]
    fn items_score_a_point_and_go_in_inventory() {
        let mut r = rs();
        let mut o = Out::new();
        r.add_item("PET ROCK", &mut o);
        assert_eq!((r.score, r.inventory.len()), (1, 1));
    }
}
