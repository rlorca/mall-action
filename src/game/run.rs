//! Whole-game state that survives scene changes. Port of `game/run.ts`.

use crate::audio_ids::SfxId;
use crate::content::powerups::{power_def, PowerId, PowerSlot};
use crate::content::stores::{StoreId, PACKAGES_TOTAL};
use crate::engine::rng::Rng;

use super::levelstate::{packages_taken, LevelState};

pub const START_LIVES: i32 = 3;
pub const MAX_CONTINUES: i32 = 3;
pub const EXTRA_LIFE_SCORE: i32 = 20000;
pub const CLEAR_BONUS: i32 = 1000;
pub const TIME_BONUS_BASE_SECONDS: i32 = 300;

/// TS `POINTS` (`as const` object); read as `POINTS.spy_shot` etc.
#[derive(Clone, Copy, Debug)]
pub struct Points {
    pub spy_shot: i32,
    pub spy_crushed: i32,
    pub package: i32,
    pub powerup: i32,
    pub level_clear: i32,
    pub time_per_second: i32,
    pub coin: i32,
    pub walker_shot: i32,
    pub caught_by_cop: i32,
    pub joke_item: i32,
}

pub const POINTS: Points = Points {
    spy_shot: 100,
    spy_crushed: 300,
    package: 500,
    powerup: 50,
    level_clear: 1000,
    time_per_second: 10,
    coin: 50,
    walker_shot: -200,
    caught_by_cop: -500,
    joke_item: 1,
};

/// A timed slot (weapon / speed): which power-up (Rapid|Spread, Sneakers|Ooze) and frames left.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct TimedPower {
    pub id: PowerId,
    pub left: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct PowerState {
    /// `id` is `Rapid` or `Spread`.
    pub weapon: Option<TimedPower>,
    /// `id` is `Sneakers` or `Ooze`.
    pub speed: Option<TimedPower>,
    /// `Some(Armor)` or `Some(Pretzel)`.
    pub armor: Option<PowerId>,
    pub radar: bool,
    /// Frames of Cinnabomb invincibility left.
    pub invincible: i32,
}

pub fn empty_power() -> PowerState {
    PowerState { weapon: None, speed: None, armor: None, radar: false, invincible: 0 }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FireProfile {
    pub max_bullets: i32,
    pub cooldown: i32,
    pub spread: bool,
}

/// Result of `Run::lose_life`: TS 'respawn' | 'continue' | 'gameover'.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LifeOutcome {
    Respawn,
    Continue,
    Gameover,
}

impl LifeOutcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            LifeOutcome::Respawn => "respawn",
            LifeOutcome::Continue => "continue",
            LifeOutcome::Gameover => "gameover",
        }
    }
}

/// TS `activeTimed()` result.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct ActiveTimed {
    pub id: PowerId,
    pub name: &'static str,
    pub left: i32,
    pub total: i32,
}

/// TS `opts: { blackFriday?, hiScore? }`.
#[derive(Clone, Copy, Debug, Default)]
pub struct RunOpts {
    pub black_friday: bool,
    pub hi_score: i32,
}

/// Whole-game state that survives scene changes: score, lives, continues, loop,
/// power-ups, inventory and the per-game "first time" flags. Pure and testable;
/// sound requests go into `sfx_queue` (the Game drains it each step).
pub struct Run {
    pub seed: u32,
    pub rng: Rng,
    pub score: i32,
    pub hi_score: i32,
    pub lives: i32,
    pub continues_left: i32,
    pub loop_: i32,
    pub black_friday: bool,
    /// Frames of play in the current level (stops while paused; counts inside stores).
    pub level_frames: i32,
    pub alarm_on: bool,
    pub power: PowerState,
    /// Joke items collected this game (GameStonk easter egg etc).
    pub inventory: Vec<String>,
    /// The 4-frame photo strip from the photo booth (first exit each game).
    pub photo_strip: bool,
    /// Per-game "first time" flags (TS `Set<StoreId>`, kept in insertion order; use `has_seen_store` / `mark_store_seen`).
    pub seen_stores: Vec<StoreId>,
    pub easter_egg_done: bool,
    pub extra_life_awarded: bool,
    /// Set when the extra-life threshold was crossed this step (UI can flash 1UP).
    pub extra_life_just_awarded: bool,
    /// TS declares `level!: LevelState` (assigned by the Game at level start). Here it starts as an empty level
    /// (no stores), which behaves like the TS "undefined" for `packages`.
    pub level: LevelState,
    pub sfx_queue: Vec<SfxId>,
}

impl Run {
    pub fn new(seed: u32, opts: RunOpts) -> Run {
        Run {
            seed,
            rng: Rng::new(seed),
            score: 0,
            hi_score: opts.hi_score,
            lives: START_LIVES,
            continues_left: MAX_CONTINUES,
            loop_: 1,
            black_friday: opts.black_friday,
            level_frames: 0,
            alarm_on: false,
            power: empty_power(),
            inventory: Vec::new(),
            photo_strip: false,
            seen_stores: Vec::new(),
            easter_egg_done: false,
            extra_life_awarded: false,
            extra_life_just_awarded: false,
            level: LevelState::new(0, 1, false),
            sfx_queue: Vec::new(),
        }
    }

    pub fn sfx(&mut self, id: SfxId) {
        self.sfx_queue.push(id);
    }

    pub fn drain_sfx(&mut self) -> Vec<SfxId> {
        std::mem::take(&mut self.sfx_queue)
    }

    pub fn has_seen_store(&self, id: StoreId) -> bool {
        self.seen_stores.contains(&id)
    }

    /// TS `seenStores.add(id)`.
    pub fn mark_store_seen(&mut self, id: StoreId) {
        if !self.seen_stores.contains(&id) {
            self.seen_stores.push(id);
        }
    }

    // ---------------------------------------------------------------- score
    pub fn add_score(&mut self, n: i32) {
        self.score = 0.max(self.score + n);
        if self.score > self.hi_score {
            self.hi_score = self.score;
        }
        if !self.extra_life_awarded && self.score >= EXTRA_LIFE_SCORE {
            self.extra_life_awarded = true;
            self.extra_life_just_awarded = true;
            self.lives += 1;
            self.sfx(SfxId::Oneup);
        }
    }

    pub fn add_life(&mut self) {
        self.lives += 1;
        self.sfx(SfxId::Oneup);
    }

    // ---------------------------------------------------------------- packages
    /// TS getter `packages`.
    pub fn packages(&self) -> i32 {
        packages_taken(&self.level)
    }

    /// TS getter `allPackages`.
    pub fn all_packages(&self) -> bool {
        self.packages() >= PACKAGES_TOTAL
    }

    // ---------------------------------------------------------------- items
    pub fn add_joke(&mut self, name: &str) {
        self.inventory.push(name.to_string());
        self.add_score(POINTS.joke_item);
    }

    /// "ITEMS: PET ROCK, MOOD RING" style line for the map; empty string when nothing yet.
    pub fn inventory_line(&self) -> String {
        let mut parts: Vec<&str> = self.inventory.iter().map(|s| s.as_str()).collect();
        if self.photo_strip {
            parts.push("PHOTO STRIP");
        }
        if !parts.is_empty() {
            parts.join(", ")
        } else {
            "NONE YET".to_string()
        }
    }

    // ---------------------------------------------------------------- power-ups
    /// Apply a power-up (slot rules from the brief). Returns its display name.
    pub fn give_power(&mut self, id: PowerId) -> &'static str {
        let def = power_def(id);
        match def.slot {
            PowerSlot::Weapon => self.power.weapon = Some(TimedPower { id, left: def.frames }),
            PowerSlot::Speed => self.power.speed = Some(TimedPower { id, left: def.frames }),
            PowerSlot::Armor => self.power.armor = Some(id),
            PowerSlot::Radar => self.power.radar = true,
            PowerSlot::Invincible => self.power.invincible = def.frames,
            PowerSlot::Instant => self.add_life(),
        }
        def.name
    }

    /// Called once per simulation step in BOTH the mall and stores (not while paused / map / continue).
    pub fn tick_powers(&mut self) {
        let p = &mut self.power;
        if let Some(w) = p.weapon.as_mut() {
            w.left -= 1;
            if w.left <= 0 {
                p.weapon = None;
            }
        }
        if let Some(s) = p.speed.as_mut() {
            s.left -= 1;
            if s.left <= 0 {
                p.speed = None;
            }
        }
        if p.invincible > 0 {
            p.invincible -= 1;
        }
    }

    /// TS getter `invincible`.
    pub fn invincible(&self) -> bool {
        self.power.invincible > 0
    }

    /// Armour absorbs exactly one hit. Returns true if the hit was absorbed.
    pub fn absorb_hit(&mut self) -> bool {
        if self.power.armor.is_some() {
            self.power.armor = None;
            return true;
        }
        false
    }

    /// Death: everything is lost except Radar.
    pub fn clear_powers_on_death(&mut self) {
        let radar = self.power.radar;
        self.power = empty_power();
        self.power.radar = radar;
    }

    /// Continue / new level: everything reset, Radar included.
    pub fn reset_powers(&mut self) {
        self.power = empty_power();
    }

    /// The timed power-up the HUD shows with a draining bar (food first: it is the rarest).
    pub fn active_timed(&self) -> Option<ActiveTimed> {
        let p = &self.power;
        if p.invincible > 0 {
            let d = power_def(PowerId::Cinnabomb);
            return Some(ActiveTimed { id: PowerId::Cinnabomb, name: d.name, left: p.invincible, total: d.frames });
        }
        if let Some(w) = p.weapon {
            let d = power_def(w.id);
            return Some(ActiveTimed { id: w.id, name: d.name, left: w.left, total: d.frames });
        }
        if let Some(s) = p.speed {
            let d = power_def(s.id);
            return Some(ActiveTimed { id: s.id, name: d.name, left: s.left, total: d.frames });
        }
        None
    }

    /// Walk speed multiplier. Sneakers 1.25x, Orange Juli-Ooze 1.5x.
    pub fn walk_factor(&self) -> f64 {
        match self.power.speed {
            Some(s) => {
                if s.id == PowerId::Ooze {
                    1.5
                } else {
                    1.25
                }
            }
            None => 1.0,
        }
    }

    /// Jump height multiplier (Sneakers jump higher).
    pub fn jump_factor(&self) -> f64 {
        if self.power.speed.map(|s| s.id) == Some(PowerId::Sneakers) {
            1.3
        } else {
            1.0
        }
    }

    /// Frames a store search takes (0.75 s; Sneakers search faster).
    pub fn search_frames(&self) -> i32 {
        if self.power.speed.map(|s| s.id) == Some(PowerId::Sneakers) {
            30
        } else {
            45
        }
    }

    pub fn fire_profile(&self) -> FireProfile {
        match self.power.weapon.map(|w| w.id) {
            Some(PowerId::Rapid) => FireProfile { max_bullets: 4, cooldown: 6, spread: false },
            Some(PowerId::Spread) => FireProfile { max_bullets: 6, cooldown: 14, spread: true },
            _ => FireProfile { max_bullets: 2, cooldown: 14, spread: false },
        }
    }

    // ---------------------------------------------------------------- lives / continues
    /// The agent died. Returns what happens next:
    ///  `Respawn` (lives remain), `Continue` (no lives, continues remain), `Gameover`.
    pub fn lose_life(&mut self) -> LifeOutcome {
        self.lives -= 1;
        self.clear_powers_on_death();
        if self.lives > 0 {
            return LifeOutcome::Respawn;
        }
        if self.continues_left > 0 {
            LifeOutcome::Continue
        } else {
            LifeOutcome::Gameover
        }
    }

    /// Spend a continue: 3 fresh lives, powers reset; score, packages and loop are kept.
    /// Panics ("no continues left") when there are none, like the TS throws.
    pub fn use_continue(&mut self) {
        if self.continues_left <= 0 {
            panic!("no continues left");
        }
        self.continues_left -= 1;
        self.lives = START_LIVES;
        self.reset_powers();
    }

    // ---------------------------------------------------------------- level clear
    /// Seconds of play in the level (TS getter `levelSeconds`).
    pub fn level_seconds(&self) -> i32 {
        self.level_frames / 60
    }

    pub fn time_bonus(&self) -> i32 {
        0.max(TIME_BONUS_BASE_SECONDS - self.level_seconds()) * POINTS.time_per_second
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(seed: u32) -> Run {
        Run::new(seed, RunOpts::default())
    }

    // ---- Run scoring and lives
    #[test]
    fn starts_with_3_lives_and_3_continues() {
        let r = run(1);
        assert_eq!(r.lives, START_LIVES);
        assert_eq!(r.continues_left, MAX_CONTINUES);
    }

    #[test]
    fn awards_exactly_one_extra_life_at_20_000_points() {
        let mut r = run(1);
        r.add_score(EXTRA_LIFE_SCORE - 1);
        assert_eq!(r.lives, 3);
        r.add_score(1);
        assert_eq!(r.lives, 4);
        r.add_score(50000);
        assert_eq!(r.lives, 4);
        assert!(r.drain_sfx().contains(&SfxId::Oneup));
    }

    #[test]
    fn never_lets_the_score_go_negative_and_tracks_the_high_score() {
        let mut r = Run::new(1, RunOpts { hi_score: 500, ..Default::default() });
        r.add_score(POINTS.caught_by_cop);
        assert_eq!(r.score, 0);
        r.add_score(900);
        assert_eq!(r.hi_score, 900);
        r.add_score(POINTS.walker_shot);
        assert_eq!(r.score, 700);
        assert_eq!(r.hi_score, 900);
    }

    #[test]
    fn time_bonus_is_10_per_second_under_300_s() {
        let mut r = run(1);
        r.level_frames = 100 * 60;
        assert_eq!(r.time_bonus(), 2000);
        r.level_frames = 400 * 60;
        assert_eq!(r.time_bonus(), 0);
    }

    #[test]
    fn lose_life_respawn_continue_game_over_continue_gives_3_fresh_lives_and_keeps_score() {
        let mut r = run(1);
        r.add_score(1234);
        assert_eq!(r.lose_life(), LifeOutcome::Respawn);
        assert_eq!(r.lose_life(), LifeOutcome::Respawn);
        assert_eq!(r.lose_life(), LifeOutcome::Continue);
        r.use_continue();
        assert_eq!(r.lives, 3);
        assert_eq!(r.continues_left, 2);
        assert_eq!(r.score, 1234);
        for _ in 0..2 {
            r.lives = 1;
            assert_eq!(r.lose_life(), LifeOutcome::Continue);
            r.use_continue();
        }
        r.lives = 1;
        assert_eq!(r.lose_life(), LifeOutcome::Gameover);
        let threw = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| r.use_continue()));
        assert!(threw.is_err());
    }

    // ---- Run power-ups
    #[test]
    fn weapons_replace_each_other_armour_speed_radar_stack_with_the_weapon() {
        let mut r = run(1);
        r.give_power(PowerId::Rapid);
        r.give_power(PowerId::Armor);
        r.give_power(PowerId::Sneakers);
        r.give_power(PowerId::Radar);
        assert_eq!(r.power.weapon.map(|w| w.id), Some(PowerId::Rapid));
        r.give_power(PowerId::Spread);
        assert_eq!(r.power.weapon.map(|w| w.id), Some(PowerId::Spread));
        assert_eq!(r.power.armor, Some(PowerId::Armor));
        assert_eq!(r.power.speed.map(|s| s.id), Some(PowerId::Sneakers));
        assert!(r.power.radar);
    }

    #[test]
    fn sneakers_and_orange_juli_ooze_share_one_slot_ooze_is_1_5x_walk_speed() {
        let mut r = run(1);
        r.give_power(PowerId::Sneakers);
        assert!(r.walk_factor() > 1.0);
        r.give_power(PowerId::Ooze);
        assert_eq!(r.power.speed.map(|s| s.id), Some(PowerId::Ooze));
        assert_eq!(r.walk_factor(), 1.5);
    }

    #[test]
    fn timers_run_20_s_12_s_6_s_and_expire() {
        let mut r = run(1);
        r.give_power(PowerId::Rapid);
        r.give_power(PowerId::Ooze);
        r.give_power(PowerId::Cinnabomb);
        for _ in 0..6 * 60 {
            r.tick_powers();
        }
        assert!(!r.invincible());
        assert!(r.power.speed.is_some());
        for _ in 0..6 * 60 {
            r.tick_powers();
        }
        assert!(r.power.speed.is_none());
        assert!(r.power.weapon.is_some());
        for _ in 0..8 * 60 {
            r.tick_powers();
        }
        assert!(r.power.weapon.is_none());
    }

    #[test]
    fn armour_vest_or_pretzel_absorbs_exactly_one_hit() {
        let mut r = run(1);
        r.give_power(PowerId::Pretzel);
        assert!(r.absorb_hit());
        assert!(!r.absorb_hit());
    }

    #[test]
    fn death_clears_everything_except_radar_continue_clears_radar_too() {
        let mut r = run(1);
        r.give_power(PowerId::Radar);
        r.give_power(PowerId::Rapid);
        r.give_power(PowerId::Armor);
        r.clear_powers_on_death();
        assert!(r.power.radar);
        assert!(r.power.weapon.is_none());
        assert!(r.power.armor.is_none());
        r.reset_powers();
        assert!(!r.power.radar);
    }

    #[test]
    fn one_up_is_instant_plus_1_life_rapid_fire_allows_4_bullets() {
        let mut r = run(1);
        r.give_power(PowerId::Oneup);
        assert_eq!(r.lives, 4);
        assert_eq!(r.fire_profile().max_bullets, 2);
        r.give_power(PowerId::Rapid);
        assert_eq!(r.fire_profile().max_bullets, 4);
        assert!(r.fire_profile().cooldown < 14);
    }

    #[test]
    fn joke_items_are_worth_plus_1_point_and_go_in_the_inventory() {
        let mut r = run(1);
        r.add_joke("PET ROCK");
        assert_eq!(r.score, 1);
        assert!(r.inventory_line().contains("PET ROCK"));
    }

    #[test]
    fn hud_timed_power_up_reports_a_draining_bar() {
        let mut r = run(1);
        assert!(r.active_timed().is_none());
        r.give_power(PowerId::Spread);
        let a = r.active_timed().unwrap();
        assert_eq!(a.left, a.total);
        r.tick_powers();
        assert_eq!(r.active_timed().unwrap().left, a.total - 1);
    }
}
