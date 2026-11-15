//! Port of `game/mall/spies.test.ts`.

use super::spies::{new_spy, AIM_FRAMES, DODGE_CHANCE, FIRST_SHOT_DELAY};
use super::testutil::*;
use super::types::*;
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::PA_LINES;
use crate::content::layout::{ShaftId, SHAFTS};
use crate::content::powerups::PowerId;
use crate::content::stores::StoreId;
use crate::game::difficulty::difficulty;
use crate::game::mall::geometry::fy;

const A_: crate::content::layout::ShaftDef = SHAFTS[0];

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 0.5e-5
}

fn spawn(r: &mut Rig, x: f64, floor: i32) -> i32 {
    spawn_mode(r, x, floor, SpyMode::Walk)
}

fn spawn_mode(r: &mut Rig, x: f64, floor: i32, mode: SpyMode) -> i32 {
    let s = new_spy(&mut r.w, x, floor, mode, None);
    let id = s.id;
    r.w.spies.push(s);
    id
}

fn spy(r: &Rig, id: i32) -> &Spy {
    r.w.spy_by_id(id).expect("spy is gone")
}

fn spy_mut(r: &mut Rig, id: i32) -> &mut Spy {
    r.w.spy_by_id_mut(id).expect("spy is gone")
}

fn has_spy_bullet(r: &Rig) -> bool {
    r.w.bullets.iter().any(|b| b.owner == BulletOwner::Spy)
}

/// Make the agent immortal for scenario tests that observe the spies.
fn immortal(r: &mut Rig) {
    r.w.player.invuln = 99999;
}

mod spy_shooting_fairness {
    use super::*;

    #[test]
    fn the_first_shot_comes_no_sooner_than_2_s_after_a_spy_appears() {
        for seed in 1..=20u32 {
            let mut r = make_rig(RigOpts::new().seed(seed).floor(1).x(300.0));
            immortal(&mut r);
            r.w.next_spy = 1_000_000_000;
            let s = spawn(&mut r, 380.0, 1);
            let mut first_shot = -1;
            let mut f = 1;
            while f <= 400 && first_shot < 0 {
                r.hold(0, 1);
                if has_spy_bullet(&r) {
                    first_shot = f;
                }
                f += 1;
            }
            assert!(first_shot >= FIRST_SHOT_DELAY);
            assert!(spy(&r, s).age > 0);
        }
    }

    #[test]
    fn shows_a_clear_aiming_pose_for_about_half_a_second_before_each_shot() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        r.w.next_spy = 1_000_000_000;
        let s = spawn(&mut r, 380.0, 1);
        let mut aim_start = -1;
        let mut shot_at = -1;
        let mut f = 1;
        while f < 500 && shot_at < 0 {
            r.hold(0, 1);
            if spy(&r, s).mode == SpyMode::Aim && aim_start < 0 {
                aim_start = f;
            }
            if has_spy_bullet(&r) && shot_at < 0 {
                shot_at = f;
            }
            f += 1;
        }
        assert!(aim_start > 0);
        assert!(shot_at - aim_start >= AIM_FRAMES - 1);
        assert!(shot_at - aim_start <= AIM_FRAMES + 2);
    }

    #[test]
    fn after_the_first_shot_a_spy_fires_about_every_2_5_s_on_loop_1_and_never_more_than_once_a_second() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        r.w.next_spy = 1_000_000_000; // only the one spy
        spawn(&mut r, 380.0, 1);
        let mut shots: Vec<i32> = Vec::new();
        let mut seen = 0;
        for f in 1..1500 {
            r.hold(0, 1);
            let n = r.sfx_count(SfxId::EnemyShot);
            if n > seen {
                shots.push(f);
                seen = n;
            }
            r.w.bullets.clear();
        }
        assert!(shots.len() >= 3);
        for i in 1..shots.len() {
            assert!(shots[i] - shots[i - 1] >= 60);
            assert!(shots[i] - shots[i - 1] < 260);
        }
        assert_eq!(difficulty(1, false).shot_interval, 150);
        assert!(difficulty(50, false).shot_interval >= 60);
    }

    #[test]
    fn spy_bullets_are_slower_2_px_frame_than_the_agents_4_px_frame() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        spawn(&mut r, 380.0, 1);
        let mut f = 0;
        while f < 300 && !has_spy_bullet(&r) {
            r.hold(0, 1);
            f += 1;
        }
        let b = r.w.bullets.iter().find(|k| k.owner == BulletOwner::Spy).unwrap();
        assert_eq!(b.vx.abs(), 2.0);
    }

    #[test]
    fn a_spy_dodges_an_incoming_volley_with_10_percent_chance_most_straight_shots_land() {
        assert_eq!(DODGE_CHANCE, 0.1);
        let mut ducked = 0;
        let mut survived = 0;
        let n = 400;
        for seed in 1..=n as u32 {
            let mut r = make_rig(RigOpts::new().seed(seed).floor(1).x(300.0));
            immortal(&mut r);
            let s = spawn(&mut r, 360.0, 1);
            spy_mut(&mut r, s).fire_cd = 99999; // do not shoot back
            r.hold(A, 1);
            let mut did_duck = false;
            for _ in 0..60 {
                r.hold(0, 1);
                let m = r.w.spy_by_id(s).map(|k| k.mode);
                if m == Some(SpyMode::Duck) {
                    did_duck = true;
                }
                if m == Some(SpyMode::Dying) {
                    break;
                }
            }
            if did_duck {
                ducked += 1;
            }
            if let Some(k) = r.w.spy_by_id(s) {
                if k.mode != SpyMode::Dying && !r.w.spies.iter().all(|k| k.mode == SpyMode::Dying) {
                    survived += 1;
                }
            }
        }
        let rate = ducked as f64 / n as f64;
        assert!(rate > 0.04);
        assert!(rate < 0.17);
        assert!((survived as f64 / n as f64) < 0.2);
    }

    #[test]
    fn a_spy_hit_by_a_straight_shot_dies_scores_100_and_the_death_animation_lasts_0_4_s() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        let s = spawn(&mut r, 360.0, 1);
        spy_mut(&mut r, s).fire_cd = 99999;
        // Make sure it cannot dodge: no roll
        spy_mut(&mut r, s).volley_t = 999;
        r.hold(A, 1);
        let mut f = 0;
        while f < 40 && spy(&r, s).mode != SpyMode::Dying {
            r.hold(0, 1);
            f += 1;
        }
        assert_eq!(spy(&r, s).mode, SpyMode::Dying);
        assert_eq!(r.run.score, 100);
        let mut frames = 0;
        while r.w.spy_by_id(s).is_some() && frames < 100 {
            r.hold(0, 1);
            frames += 1;
        }
        assert!(frames >= 20);
        assert!(frames <= 30);
    }

    #[test]
    fn spies_ignore_a_hidden_agent() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        let s = spawn(&mut r, 340.0, 1);
        r.w.hide_player(600);
        for _ in 0..300 {
            r.hold(0, 1);
        }
        assert!(!has_spy_bullet(&r));
        assert_ne!(spy(&r, s).mode, SpyMode::Aim);
    }

    #[test]
    fn a_spy_never_walks_into_a_pit() {
        let mut r = make_rig(RigOpts::new().floor(1).x(100.0));
        immortal(&mut r);
        set_car(&mut r, ShaftId::A, 3); // A's 4F opening is a deep pit
        let s = spawn(&mut r, A_.x - 10.0, 1);
        spy_mut(&mut r, s).fire_cd = 99999;
        for _ in 0..3000 {
            r.w.player.x = 40.0; // far enough that he wanders rather than approaches
            r.hold(0, 1);
            match r.w.spy_by_id(s) {
                None => break,
                Some(k) => assert!(k.x < A_.x + 4.0 || k.x > A_.x + A_.w - 4.0),
            }
        }
    }

    #[test]
    fn a_car_coming_down_onto_a_spy_waiting_on_its_grate_crushes_him_for_300_points() {
        let mut r = make_rig(RigOpts::new().floor(1).x(100.0));
        immortal(&mut r);
        set_car(&mut r, ShaftId::A, 0);
        let s = spawn(&mut r, A_.x + 12.0, 1);
        spy_mut(&mut r, s).fire_cd = 99999;
        spy_mut(&mut r, s).mode = SpyMode::Wait; // waiting in the shaft opening, as spies do
        r.w.car_mut(ShaftId::A).goal = Some(fy(1));
        // (TS reads the spy object after it left the world; remember what we saw while it was still there)
        let mut killed_by = None;
        for _ in 0..80 {
            r.hold(0, 1);
            if let Some(k) = r.w.spy_by_id(s) {
                killed_by = k.killed_by;
            }
        }
        assert_eq!(killed_by, Some(KilledBy::Crush));
        assert_eq!(r.run.score, 300);
    }

    #[test]
    fn touching_a_spy_kills_the_agent_cinnabomb_kills_the_spy_instead() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        spawn(&mut r, 304.0, 1);
        r.hold(0, 4);
        assert_eq!(r.causes, vec!["touch".to_string()]);
        let mut r2 = make_rig(RigOpts::new().floor(1).x(300.0));
        r2.run.give_power(PowerId::Cinnabomb);
        let s = spawn(&mut r2, 304.0, 1);
        r2.hold(0, 4);
        assert!(r2.causes.is_empty());
        assert_eq!(spy(&r2, s).killed_by, Some(KilledBy::Cinna));
    }
}

mod spy_spawning {
    use super::*;

    #[test]
    fn the_first_spy_appears_about_5_s_into_the_level_from_a_store_door_64_200_px_away() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        let mut first = -1;
        let mut f = 1;
        while f < 1200 && first < 0 {
            r.hold(0, 1);
            if !r.w.spies.is_empty() {
                first = f;
            }
            f += 1;
        }
        assert!(first >= 295);
        assert!(first <= 420);
        let s = &r.w.spies[0];
        let d = (s.x - 300.0).abs();
        assert!(d >= 64.0);
        assert!(d <= 200.0);
    }

    #[test]
    fn never_more_than_4_on_screen_8_in_black_friday() {
        let mut r = make_rig(RigOpts::new().floor(1).x(300.0));
        immortal(&mut r);
        let mut max = 0;
        for _ in 0..6000 {
            r.hold(0, 1);
            r.w.bullets.clear();
            max = max.max(r.w.live_spies());
        }
        assert!(max <= 4);
        assert!(max >= 2);
    }

    #[test]
    fn spawns_only_from_open_stores_cleared_targets_and_closed_shops_never_release_spies() {
        let mut r = make_rig(RigOpts::new().floor(3).x(200.0));
        immortal(&mut r);
        for s in r.run.level.stores.iter_mut().flatten() {
            s.package_taken = true;
        }
        // 2F stores: sambaddy (cleared), sharper (power-up shop: open), hotspy (cleared), circuitpity (closed)
        let mut froms: Vec<StoreId> = Vec::new();
        for _ in 0..4000 {
            r.hold(0, 1);
            r.w.bullets.clear();
            for s in r.w.spies.iter() {
                if let Some(id) = s.emerge_from {
                    if !froms.contains(&id) {
                        froms.push(id);
                    }
                }
            }
        }
        for id in froms {
            assert!([StoreId::Sharper, StoreId::Gamestonk, StoreId::Crookstone, StoreId::Spenders].contains(&id), "{:?}", id);
        }
    }

    #[test]
    fn later_loops_spawn_spies_more_often_and_the_alarm_makes_them_faster() {
        let count = |loop_: i32| -> usize {
            let mut total = 0;
            for seed in 1..=6u32 {
                let mut r = make_rig(RigOpts::new().seed(seed).floor(1).x(300.0).loop_(loop_));
                immortal(&mut r);
                let mut seen: Vec<i32> = Vec::new();
                for _ in 0..6000 {
                    r.hold(0, 1);
                    r.w.bullets.clear();
                    for s in r.w.spies.iter_mut() {
                        if s.mode == SpyMode::Walk {
                            s.fire_cd = 9999;
                        }
                        if !seen.contains(&s.id) {
                            seen.push(s.id);
                        }
                    }
                    // kill them as they appear so the cap never limits the count
                    for s in r.w.spies.iter_mut() {
                        if s.mode == SpyMode::Walk || s.mode == SpyMode::Emerge {
                            s.mode = SpyMode::Dying;
                        }
                    }
                }
                total += seen.len();
            }
            total
        };
        assert!(count(4) > count(1));
        let mut r = make_rig(RigOpts::new());
        let base = r.w.spy_speed(&r.run);
        r.run.alarm_on = true;
        assert!(close(r.w.spy_speed(&r.run) / base, 1.25));
        assert!(close(difficulty(2, false).spy_speed / difficulty(1, false).spy_speed, 1.1));
    }

    #[test]
    fn the_alarm_goes_off_after_150_s_on_loop_1_sooner_on_later_loops() {
        let mut r = make_rig(RigOpts::new());
        r.run.level_frames = 150 * 60 - 1;
        r.hold(0, 1);
        assert!(!r.run.alarm_on);
        r.run.level_frames = 150 * 60;
        r.hold(0, 1);
        assert!(r.run.alarm_on);
        assert_eq!(r.w.banner.as_ref().map(|b| b.text.as_str()), Some("ALARM! SECURITY ALERTED"));
        assert_eq!(r.w.music(&r.run), MusicId::Alarm);
        let r3 = make_rig(RigOpts::new().loop_(3));
        assert_eq!(r3.w.diff.alarm_frames, 110 * 60);
    }

    #[test]
    fn the_mall_pa_announces_about_once_a_minute_and_never_the_same_line_twice_in_a_row() {
        let mut r = make_rig(RigOpts::new());
        immortal(&mut r);
        let mut seen: Vec<String> = Vec::new();
        let mut last = String::new();
        for _ in 0..60 * 60 * 8 {
            r.hold(0, 1);
            r.w.spies.clear();
            if let Some(b) = r.w.banner.as_ref() {
                if b.t == b.total - 1 && b.total == 240 {
                    let mut parts = vec![b.text.clone()];
                    if let Some(l) = &b.lines {
                        parts.extend(l.iter().cloned());
                    }
                    let text = parts.join(" ");
                    assert_ne!(text, last);
                    last = text.clone();
                    seen.push(text);
                }
            }
        }
        assert!(seen.len() >= 6);
        assert!(seen.len() <= 10);
        for t in &seen {
            assert!(PA_LINES.contains(&t.as_str()), "{}", t);
        }
    }

    #[test]
    fn determinism_same_seed_and_inputs_give_the_same_world() {
        let run = || -> String {
            let mut r = make_rig(RigOpts::new().seed(42).floor(1).x(300.0));
            immortal(&mut r);
            for f in 0..2000 {
                r.hold(if f % 90 < 45 { RIGHT } else { LEFT }, 1);
                r.w.bullets.clear();
            }
            let spies: Vec<(i32, i64, &str)> = r.w.spies.iter().map(|s| (s.id, crate::engine::num::round_i(s.x) as i64, s.mode.as_str())).collect();
            format!("{:?}", (r.w.player.x, spies, r.w.cars.iter().map(|c| c.y).collect::<Vec<f64>>()))
        };
        assert_eq!(run(), run());
    }
}
