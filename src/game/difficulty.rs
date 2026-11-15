//! Difficulty scaling per loop (1-based). Each loop: spies ~10% faster, ~15% more
//! frequent, ~15% more trigger-happy, alarm ~20 s sooner. Everything is capped.
//! Port of `game/difficulty.ts`.

pub const FPS: i32 = 60;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Difficulty {
    /// Spy walking speed in px/frame.
    pub spy_speed: f64,
    /// Multiplier on how often spies spawn.
    pub spawn_rate: f64,
    /// Frames between a spy's shots (never below MIN_SHOT_INTERVAL).
    pub shot_interval: i32,
    /// Frames into the level before the alarm goes off.
    pub alarm_frames: i32,
    /// Max spies on screen.
    pub spy_cap: i32,
}

pub const BASE_SPY_SPEED: f64 = 0.8;
/// `Math.round(2.5 * FPS)`.
pub const BASE_SHOT_INTERVAL: i32 = 150;
pub const MIN_SHOT_INTERVAL: i32 = FPS; // never more often than once a second
pub const BASE_ALARM_SECONDS: i32 = 150;
pub const MIN_ALARM_SECONDS: i32 = 70;
pub const ALARM_SPEED_BONUS: f64 = 1.25;
pub const ALARM_SPAWN_BONUS: f64 = 1.5;

/// `difficulty(loop, blackFriday = false)`.
pub fn difficulty(loop_: i32, black_friday: bool) -> Difficulty {
    let n = 0.max(loop_ - 1);
    let nf = n as f64;
    let spy_speed = (BASE_SPY_SPEED * 1.1f64.powf(nf)).min(BASE_SPY_SPEED * 1.8);
    let spawn = 1.15f64.powf(nf).min(2.5);
    let fire = 1.15f64.powf(nf).min(2.2);
    let shot_interval = MIN_SHOT_INTERVAL.max(crate::engine::num::round_i(BASE_SHOT_INTERVAL as f64 / fire));
    let alarm_seconds = MIN_ALARM_SECONDS.max(BASE_ALARM_SECONDS - 20 * n);
    Difficulty {
        spy_speed,
        spawn_rate: spawn * if black_friday { 2.0 } else { 1.0 },
        shot_interval,
        alarm_frames: alarm_seconds * FPS,
        spy_cap: if black_friday { 8 } else { 4 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.5e-5
    }

    #[test]
    fn loop_1_matches_the_brief_a_shot_about_every_2_5_s_4_spies_alarm_after_150_s() {
        let d = difficulty(1, false);
        assert_eq!(d.shot_interval, 150);
        assert_eq!(d.spy_cap, 4);
        assert_eq!(d.alarm_frames, 150 * 60);
    }

    #[test]
    fn each_loop_spies_faster_more_frequent_shoot_more_often_alarm_20_s_sooner_all_capped() {
        let d1 = difficulty(1, false);
        let d2 = difficulty(2, false);
        assert!(close(d2.spy_speed / d1.spy_speed, 1.1));
        assert!(close(d2.spawn_rate / d1.spawn_rate, 1.15));
        assert!(d2.shot_interval < d1.shot_interval);
        assert_eq!(d1.alarm_frames - d2.alarm_frames, 20 * 60);
        let d99 = difficulty(99, false);
        assert!(d99.shot_interval >= MIN_SHOT_INTERVAL);
        assert!(d99.spy_speed <= d1.spy_speed * 1.8 + 1e-9);
        assert!(d99.spawn_rate <= 2.5);
        assert!(d99.alarm_frames >= 70 * 60);
    }

    #[test]
    fn black_friday_doubles_the_spy_cap_and_spawn_rate() {
        let n = difficulty(1, false);
        let b = difficulty(1, true);
        assert_eq!(b.spy_cap, n.spy_cap * 2);
        assert_eq!(b.spawn_rate, n.spawn_rate * 2.0);
    }
}
