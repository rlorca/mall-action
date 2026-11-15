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

/// `Math.pow(1.1, n)` and `Math.pow(1.15, n)` for n = 0..=60 as dumped from the JavaScript engine (IEEE-754 bits).
/// `f64::powf` is libm-dependent and may differ from V8 in the last bit (and natively vs. wasm); these values feed the
/// simulation (spy speed, spawn rate), so they are baked in. Past n = 60 both results are far above their caps.
const POW_1_1: [u64; 61] = [0x3ff0000000000000,0x3ff199999999999a,0x3ff35c28f5c28f5d,0x3ff54bc6a7ef9db4,0x3ff76cf41f212d79,0x3ff9c4a6223e186c,0x3ffc585058dde7ab,0x3fff2df1fb5a7ed7,0x40012611e3d82c2a,0x4002dd13add43095,0x4004bffc0c03023e,0x4006d32eda034f44,0x40091b805636d732,0x400b9e405ed5ecb8,0x400e6146ceb81dfe,0x4010b5808b4baa19,0x401261409939a182,0x401437c70ef29810,0x40163d5af6d7a745,0x401876b0dc539e66,0x401ae8f5bf28c7d7,0x401d99db1f13423a,0x402047d21de4313a,0x4021e89a54149c8d,0x4023b3102949df68,0x4025ab5e93d1428d,0x4027d61b3c32fc68,0x402a3851289e7c0d,0x402cd78c797b220f,0x402fb9e7526dd8aa,0x4031730c06ef9d91,0x403331c06e0793ba,0x40351d20790855b3,0x403739a3b855f7df,0x40398c341791c3dd,0x403c1a394d205774,0x403ee9a56e706033,0x40410081632434e9,0x4042b3c186a7d3ce,0x40449288141f0296,0x4046a12f49554fa6,0x4048e480d0aaa46a,0x404b61c0e58881a8,0x404e1eba9616283a,0x405090e69f58fc87,0x405238fdaf4848fb,0x40540b7d7402b6ae,0x40560ca399362f59,0x4058411a5bbb9a7d,0x405aae0364e7f6bd,0x405d5903bbcbf5d0,0x4060242874169400,0x4061c15fb2e5a2cd,0x406387e944c96648,0x40657be6fedd8a1d,0x4067a1e47ec07e53,0x4069fee1bea08af6,0x406c985eb816ff42,0x406f746830e618ca,0x40714cd2e7b1c0d6,0x407307b4cba9edb8];
const POW_1_15: [u64; 61] = [0x3ff0000000000000,0x3ff2666666666666,0x3ff528f5c28f5c28,0x3ff855810624dd2e,0x3ffbfbedfa43fe5a,0x400017426fe718a7,0x4002812600b02926,0x400547b880ca95b8,0x400878e0fa829293,0x400c249c53495bc2,0x40102ea6afe3c7f5,0x40129c0c7d7925f3,0x401566a7f6b1b871,0x40189c745bb2c74e,0x401c4d85cfda6533,0x4020462cf11d93ca,0x4022b71a154869f4,0x402585c4654679d9,0x4028c03b74777285,0x402c76aac5efc3b2,0x40305dd5650376ed,0x4032d24f00f72f29,0x4035a50e0de90fd5,0x4038e4368fff389b,0x403ca00b8bff1ab2,0x404075a03d4c48f3,0x4042edab79b153e4,0x4045c4853258ba12,0x40490865f9e6092e,0x404cc9a878fbbdc1,0x40508d8dabf726b5,0x4053092fb8f5d2e9,0x4055e42a14b44c25,0x40592cc9fe35bdf7,0x405cf381e4576742,0x4060a59de34bdb5f,0x406324dbf8973c47,0x406603fcf77ab884,0x40695162e966ba97,0x406d1d982602f02d,0x4070bdd115db4a1a,0x407340b072bc2ed0,0x407623fe1d8b9c3c,0x4079763108608d44,0x407d47eb966f08db,0x4080d627767fd84a,0x40835cad61dfd255,0x4086442dca27cb7b,0x40899b34a87a9066,0x408d727c8e8cf2db,0x4090eea1385dd871,0x409378d300d25281,0x4096648c40f1dee1,0x4099c06e177c8d1c,0x409d9d4b67cf3be0,0x40a1073e8ee3f5a0,0x40a395218ab95a78,0x40a68519c5eec1a3,0x40a9e5dda39f5eae,0x40adc8587c2a79ae,0x40b11fffadcb9f90];

fn pow_table(table: &[u64; 61], base: f64, n: i32) -> f64 {
    if (0..=60).contains(&n) {
        f64::from_bits(table[n as usize])
    } else {
        base.powf(n as f64)
    }
}

/// `difficulty(loop, blackFriday = false)`.
pub fn difficulty(loop_: i32, black_friday: bool) -> Difficulty {
    let n = 0.max(loop_ - 1);
    let spy_speed = (BASE_SPY_SPEED * pow_table(&POW_1_1, 1.1, n)).min(BASE_SPY_SPEED * 1.8);
    let spawn = pow_table(&POW_1_15, 1.15, n).min(2.5);
    let fire = pow_table(&POW_1_15, 1.15, n).min(2.2);
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

    /// Bit-exact against the TypeScript `difficulty()` for loops 1..=70 (fixtures/difficulty.txt: loop bf speedBits spawnBits shot alarm cap).
    #[test]
    fn matches_typescript_bit_for_bit() {
        let text = include_str!("../../fixtures/difficulty.txt");
        let mut rows = 0;
        for line in text.lines() {
            let f: Vec<&str> = line.split(' ').collect();
            let d = difficulty(f[0].parse().unwrap(), f[1] == "1");
            assert_eq!(format!("{:016x}", d.spy_speed.to_bits()), f[2], "spy_speed loop {} bf {}", f[0], f[1]);
            assert_eq!(format!("{:016x}", d.spawn_rate.to_bits()), f[3], "spawn_rate loop {} bf {}", f[0], f[1]);
            assert_eq!(d.shot_interval.to_string(), f[4]);
            assert_eq!(d.alarm_frames.to_string(), f[5]);
            assert_eq!(d.spy_cap.to_string(), f[6]);
            rows += 1;
        }
        assert_eq!(rows, 140);
    }
}
