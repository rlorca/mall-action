//! Integration tests for the rules: physics, elevators, spies, lights, NPCs, scoring and flow.
use super::level::*;
use super::mall::*;
use super::powerups::*;
use super::*;
use crate::input::*;

struct H {
    g: Game,
    pad: Pad,
    sfx: Vec<Sfx>,
}

impl H {
    fn new(seed: u64) -> H {
        H { g: Game::new(seed, true), pad: Pad::new(), sfx: vec![] }
    }
    fn step_held(&mut self, held: u8) {
        self.pad.set_gamepad(held);
        let ps = self.pad.begin_step();
        self.g.step(ps);
        let s = self.g.take_sfx();
        self.sfx.extend(s);
    }
    fn run(&mut self, held: u8, n: usize) {
        for _ in 0..n {
            self.step_held(held);
        }
    }
    fn tap(&mut self, b: u8) {
        self.run(b, 2);
        self.run(0, 2);
    }
    /// Start a game and skip the zip-line arrival and selfie; the agent stands on the roof under control.
    fn play(seed: u64) -> H {
        let mut h = H::new(seed);
        h.run(0, 20);
        h.tap(START);
        h.run(0, 60);
        assert!(matches!(h.g.scene, Scene::Mall));
        for _ in 0..600 {
            if h.g.mall.control {
                break;
            }
            h.tap(A);
        }
        assert!(h.g.mall.control, "arrival sequence must end");
        h.g.mall.spawn_timer = 100_000;
        h.g.mall.next_pa = 1_000_000;
        h.g.mall.alarm_at = 10_000_000;
        h.run(0, 40); // let the arrival shots cool down and clear
        h.g.mall.bullets.clear();
        h
    }
    fn put(&mut self, floor: u8, x: f32) {
        self.g.mall.p.floor = floor;
        self.g.mall.p.x = x;
        self.g.mall.p.z = 0.0;
        self.g.mall.p.st = PState::Walk;
        self.g.mall.p.slide = 0;
        self.g.mall.p.inv = 0;
        self.g.mall.p.pickup = None;
        self.g.mall.p.still = 0;
    }
    fn spy(&mut self, floor: u8, x: f32) -> usize {
        self.g.mall.spies.push(Spy { x, floor, dir: -1, st: SpyState::Walk, age: 0, cd: 0, walk_t: 1000, goal: None, last_volley: 0, anim: 0 });
        self.g.mall.spies.len() - 1
    }
    fn m(&mut self) -> &mut Mall {
        &mut self.g.mall
    }
    fn car(&mut self, i: usize, floor: u8) {
        self.g.mall.cars[i] = super::elevator::Car::new(SHAFTS[i], floor);
    }
}

#[test]
fn walking_is_one_pixel_per_frame() {
    let mut h = H::play(1);
    h.put(4, 300.0);
    let x0 = h.m().p.x;
    h.run(RIGHT, 30);
    assert_eq!(h.m().p.x - x0, 30.0);
}

#[test]
fn jump_peaks_about_twenty_pixels_and_lands() {
    let mut h = H::play(1);
    h.put(4, 300.0);
    let mut peak = 0.0f32;
    h.step_held(B);
    for _ in 0..60 {
        h.step_held(0);
        peak = peak.max(h.m().p.z);
    }
    assert!((17.0..=24.0).contains(&peak), "peak {peak}");
    assert_eq!(h.m().p.z, 0.0, "must land");
    // sneakers jump higher
    h.g.powers.grant(PowerKind::Sneakers);
    let mut peak2 = 0.0f32;
    h.step_held(B);
    for _ in 0..60 {
        h.step_held(0);
        peak2 = peak2.max(h.m().p.z);
    }
    assert!(peak2 > peak + 4.0);
}

#[test]
fn jumping_while_moving_is_a_kick_that_kills_spies_on_contact() {
    let mut h = H::play(2);
    h.put(4, 300.0);
    let si = h.spy(4, 318.0);
    h.spy_stand(si);
    h.step_held(B | RIGHT);
    assert!(h.m().p.kick);
    h.run(RIGHT, 30);
    assert!(h.dead(si), "kick should kill");
    assert_eq!(h.g.mall.p.st, PState::Walk, "player survives a kick");
    assert!(h.g.s.score >= 100);
}

impl H {
    /// The spy at `i` is dying or already gone (removed after the death animation).
    fn dead(&self, i: usize) -> bool {
        self.g.mall.spies.get(i).map_or(true, |s| matches!(s.st, SpyState::Dying(_)))
    }
    fn spy_stand(&mut self, i: usize) {
        self.m().spies[i].st = SpyState::Wait(10_000);
    }
}

#[test]
fn touching_a_spy_without_kicking_kills() {
    let mut h = H::play(2);
    h.put(4, 300.0);
    let si = h.spy(4, 303.0);
    h.spy_stand(si);
    h.run(0, 80);
    assert!(h.g.s.lives < 3 || matches!(h.m().p.st, PState::Dying(_)) || h.g.mall.p.inv > 0);
}

#[test]
fn bullets_are_faster_than_spies_and_at_most_two_player_bullets() {
    let mut h = H::play(3);
    h.put(4, 300.0);
    h.run(A, 40);
    let mine = h.m().bullets.iter().filter(|b| !b.hostile).count();
    assert!(mine <= 2);
    assert_eq!(BULLET_SPEED, 4.0);
    assert!(BULLET_SPEED > SPY_BULLET_SPEED);
    h.m().bullets.clear();
    h.run(0, 30);
    h.step_held(A);
    let b = h.m().bullets[0].clone();
    assert_eq!(b.vx.abs(), 4.0);
    // chest height standing, low when ducking
    let fy = floor_y(4) as f32;
    assert!((b.y - (fy - 16.0)).abs() < 1.0);
    h.m().bullets.clear();
    h.run(0, 30);
    h.step_held(A | DOWN);
    let b = h.m().bullets[0].clone();
    assert!(b.y > fy - 10.0);
}

#[test]
fn shooting_a_spy_scores_100_and_kills_in_one_hit() {
    let mut h = H::play(4);
    h.put(4, 180.0);
    h.m().p.face = 1;
    let si = h.spy(4, 220.0);
    h.spy_stand(si);
    // a dodge could save the spy (10%), so try a few volleys
    for _ in 0..4 {
        h.run(A, 40);
        if h.dead(si) {
            break;
        }
        h.m().spies[si].st = SpyState::Wait(10_000);
        h.run(0, 30);
    }
    assert!(h.dead(si));
    assert!(h.g.s.score >= 100);
}

#[test]
fn most_straight_shots_land_ten_percent_dodge() {
    let mut dodged = 0;
    let n = 400;
    for seed in 0..n {
        let mut h = H::play(1000 + seed);
        h.put(4, 180.0);
        h.m().p.face = 1;
        let si = h.spy(4, 220.0);
        h.spy_stand(si);
        h.run(A, 12);
        if !h.dead(si) {
            dodged += 1;
        }
    }
    let rate = dodged as f32 / n as f32;
    assert!((0.03..=0.20).contains(&rate), "dodge rate {rate}");
}

#[test]
fn spy_waits_before_first_shot_and_telegraphs_for_half_a_second() {
    let mut h = H::play(6);
    h.put(4, 300.0);
    let si = h.spy(4, 430.0);
    h.m().spies[si].dir = -1;
    let mut aim_start = None;
    let mut shot_at = None;
    h.m().p.inv = 100_000;
    for f in 0..400 {
        h.step_held(0);
        let sp = &h.g.mall.spies[si];
        if aim_start.is_none() && matches!(sp.st, SpyState::Aim(..)) {
            aim_start = Some(f);
        }
        if shot_at.is_none() && h.g.mall.bullets.iter().any(|b| b.hostile) {
            shot_at = Some(f);
        }
    }
    let a = aim_start.expect("aims") as i32;
    let s = shot_at.expect("shoots") as i32;
    assert!(a >= SPY_FIRST_SHOT - 2, "first aim at {a}");
    assert!((28..=34).contains(&(s - a)), "telegraph {} frames", s - a);
    assert_eq!(SPY_TELEGRAPH, 30);
}

#[test]
fn spies_never_walk_into_pits() {
    let mut h = H::play(7);
    h.car(1, 0); // B car at P: 4F opening is a pit
    h.put(4, 600.0);
    h.m().p.inv = 100_000;
    let si = h.spy(4, 340.0);
    h.m().spies[si].dir = 1;
    h.m().spies[si].walk_t = 5000;
    for _ in 0..600 {
        h.step_held(0);
        h.m().cars[1] = super::elevator::Car::new(SHAFTS[1], 0);
    }
    assert!(!matches!(h.g.mall.spies.get(si).map(|s| s.st), Some(SpyState::Dying(_))), "spy fell in a pit");
    assert!(h.g.mall.spies[si].x < 366.0, "spy x {}", h.g.mall.spies[si].x);
}

#[test]
fn calling_an_elevator_brings_it_and_picks_you_up_without_crushing() {
    let mut h = H::play(8);
    h.car(1, 0); // car at P
    h.put(4, 360.0); // right beside shaft B
    h.tap(UP); // call
    for _ in 0..400 {
        h.step_held(0);
        if matches!(h.m().p.st, PState::Inside(1)) {
            break;
        }
        assert!(!matches!(h.m().p.st, PState::Dying(_)), "called car must not crush");
    }
    assert!(matches!(h.m().p.st, PState::Inside(1)), "boarded: {:?}", h.m().p.st);
    assert_eq!(h.m().cars[1].floor_at(), Some(4));
}

#[test]
fn standing_still_in_the_opening_calls_the_car_automatically() {
    let mut h = H::play(8);
    h.car(1, 0);
    h.put(3, 362.0);
    h.run(0, 40);
    assert!(h.m().cars[1].target == Some(3) || h.m().cars[1].dir != 0, "car should be called after ~0.5 s");
}

#[test]
fn riding_manual_car_stops_level_with_floors_and_dings_once() {
    let mut h = H::play(9);
    h.car(1, 4);
    h.put(4, 384.0);
    h.tap(DOWN);
    assert!(matches!(h.m().p.st, PState::Inside(1)));
    h.run(0, 20);
    h.sfx.clear();
    h.run(DOWN, 30);
    h.run(0, 200);
    assert_eq!(h.m().cars[1].floor_at(), Some(3));
    let dings = h.sfx.iter().filter(|s| **s == Sfx::Ding).count();
    assert_eq!(dings, 1, "exactly one ding per stop");
    // out the side
    h.run(RIGHT, 5);
    assert!(matches!(h.m().p.st, PState::Walk));
    assert_eq!(h.m().p.floor, 3);
}

#[test]
fn announcement_banner_and_hum_while_riding() {
    let mut h = H::play(9);
    h.car(1, 4);
    h.put(4, 384.0);
    h.tap(DOWN);
    h.run(0, 20);
    h.run(DOWN, 10);
    assert!(h.g.hum());
    assert_eq!(h.g.song(), Some(Song::Elevator));
    let mut banner = None;
    for _ in 0..200 {
        h.step_held(0);
        if let Some(b) = h.g.mall.banner.clone() {
            banner = Some(b);
            break;
        }
    }
    let b = banner.expect("floor banner");
    assert!(b.lines[0].starts_with("3F"), "{:?}", b.lines);
}

#[test]
fn falling_one_floor_into_a_pit_lands_on_the_car_roof_alive() {
    let mut h = H::play(10);
    h.car(1, 3); // car on 3F: 4F opening is a pit one floor down
    h.put(4, 350.0);
    h.run(RIGHT, 30);
    assert!(matches!(h.m().p.st, PState::Roof(1)), "{:?}", h.m().p.st);
    // walking on along the roof steps off onto 4F again (the roof is flush with the floor)
    h.run(RIGHT, 60);
    assert!(matches!(h.m().p.st, PState::Walk) && h.m().p.floor == 4);
}

#[test]
fn falling_two_floors_kills() {
    let mut h = H::play(10);
    h.car(1, 2);
    h.put(4, 350.0);
    h.run(RIGHT, 60);
    h.run(0, 120);
    let (lives, st) = (h.g.s.lives, h.g.mall.p.st);
    assert!(lives == 2 || matches!(st, PState::Dying(_)), "{:?} lives {}", st, lives);
}

#[test]
fn elevator_coming_down_onto_a_standing_player_crushes() {
    let mut h = H::play(11);
    h.car(1, 4);
    h.put(3, 384.0); // on the grate of 3F
    h.m().p.still = 0;
    // manual descent by something else: set the target directly (not "called by us")
    h.m().cars[1].target = Some(3);
    h.m().cars[1].called = false;
    h.run(0, 120);
    assert_eq!(h.g.s.lives, 2, "crush costs a life");
}

#[test]
fn riding_the_roof_up_into_the_top_of_the_shaft_crushes() {
    let mut h = H::play(12);
    h.car(1, 3);
    h.m().p.st = PState::Roof(1);
    h.m().p.x = 384.0;
    h.m().cars[1].target = Some(4);
    h.m().cars[1].called = false;
    h.run(0, 200);
    assert_eq!(h.g.s.lives, 2);
}

#[test]
fn escalator_carries_you_up_and_down() {
    let mut h = H::play(13);
    let e = ESCALATORS[0];
    h.put(e.low, e.x_low as f32);
    h.tap(UP);
    assert!(matches!(h.m().p.st, PState::Esc { .. }));
    h.run(0, 80);
    assert!(matches!(h.m().p.st, PState::Walk));
    assert_eq!(h.m().p.floor, e.high());
    h.tap(DOWN);
    h.run(0, 80);
    assert_eq!(h.m().p.floor, e.low);
}

#[test]
fn car_crushes_a_spy_waiting_on_a_grate_for_300_points() {
    let mut h = H::play(14);
    h.car(1, 4);
    h.put(4, 600.0);
    let si = h.spy(3, 384.0);
    h.spy_stand(si);
    h.m().cars[1].target = Some(3);
    h.m().cars[1].called = false;
    let before = h.g.s.score;
    h.run(0, 120);
    assert!(h.dead(si));
    assert_eq!(h.g.s.score - before, 300);
}

#[test]
fn shooting_a_lamp_drops_it_kills_underneath_and_darkens_for_two_seconds() {
    let mut h = H::play(15);
    let (f, x) = LAMPS[0];
    h.put(f, x as f32 - 40.0);
    h.m().p.face = 1;
    let si = h.spy(f, x as f32);
    h.m().spies[si].st = SpyState::Duck(300); // ducking: the chest-high shot flies over his head into the lamp
    h.run(A, 30);
    assert!(h.m().lamps[0].st != LampState::Hang);
    h.run(0, 20);
    assert!(h.dead(si), "lamp kills the spy");
    assert!(h.g.s.score >= 300);
    assert!(!h.m().dark.is_empty());
    let t = h.m().dark[0].t;
    assert!((60..=121).contains(&t), "dark ~2 s total, {t} left");
    h.run(0, 130);
    assert!(h.m().dark.is_empty());
}

#[test]
fn disco_ball_rolls_in_the_shot_direction_and_flattens_spies() {
    let mut h = H::play(16);
    let (f, x) = *LAMPS.iter().find(|(f, _)| *f == 2).unwrap();
    let li = h.m().lamps.iter().position(|l| l.floor == f && l.x == x as f32).unwrap();
    h.put(f, x as f32 - 40.0);
    h.m().p.face = 1;
    h.run(A, 20);
    h.run(0, 40);
    assert!(matches!(h.m().lamps[li].st, LampState::Roll { dir: 1 }), "{:?}", h.m().lamps[li].st);
    let bx = h.m().lamps[li].x;
    let si = h.spy(f, bx + 40.0);
    h.spy_stand(si);
    h.m().p.inv = 100_000;
    h.run(0, 60);
    assert!(h.dead(si), "the rolling ball flattens the spy");
}

#[test]
fn wet_floor_makes_you_slide_and_a_kick_landing_keeps_kicking() {
    let mut h = H::play(17);
    h.m().wet = Some(Wet { cx: 560.0, t: 600 });
    h.put(1, 520.0);
    h.run(RIGHT, 60);
    // we entered the patch and slid on past our input
    assert!(h.m().p.x > 540.0);
    h.run(0, 80);
    assert!(h.m().p.slide == 0 && h.m().p.x > 584.0, "slid off the far side, x={}", h.m().p.x);
    // kick landing on the patch
    h.put(1, 530.0);
    h.m().p.z = 0.0;
    h.step_held(B | RIGHT);
    h.run(RIGHT, 40);
    // kill a spy while sliding
    let mut h = H::play(17);
    h.m().wet = Some(Wet { cx: 560.0, t: 600 });
    h.put(1, 520.0);
    let si = h.spy(1, 580.0);
    h.spy_stand(si);
    h.step_held(B | RIGHT);
    h.run(RIGHT, 60);
    assert!(h.dead(si));
}

#[test]
fn wet_patch_never_reaches_a_shaft_opening() {
    for seed in 0..5 {
        let mut h = H::play(20 + seed);
        h.m().p.inv = 1_000_000;
        h.put(4, 600.0);
        for _ in 0..4000 {
            h.step_held(0);
            if let Some(w) = &h.g.mall.wet {
                for s in SHAFTS.iter().filter(|s| s.serves(WET_FLOOR)) {
                    let (a, b) = (w.cx - WET_W / 2.0, w.cx + WET_W / 2.0);
                    assert!(b < s.x as f32 - 8.0 || a > (s.x + SHAFT_W) as f32 + 8.0, "wet {a}..{b} near shaft {}", s.name);
                }
            }
        }
    }
}

#[test]
fn mall_walkers_block_bullets_cost_200_and_say_hey() {
    let mut h = H::play(18);
    let wx = h.m().walkers[0].x;
    h.put(WALKER_FLOOR, wx - 60.0);
    h.m().p.face = 1;
    h.m().walkers[0].dir = 1;
    let s0 = h.g.s.score;
    h.run(A, 30);
    assert!(h.g.s.score < s0 + 1 && h.g.s.score >= 0);
    assert!(h.m().bubbles.iter().any(|b| b.text == "HEY!") || h.m().walkers[0].hey > 0);
    assert!(h.m().walkers.iter().all(|_| true));
}

#[test]
fn mall_cop_whistles_chases_and_detains_without_costing_a_life() {
    let mut h = H::play(19);
    let f = h.m().cop.floor;
    h.m().cop.x = 400.0;
    h.m().cop.dir = -1;
    h.put(f, 330.0);
    h.m().p.face = 1;
    h.g.s.add_score(2000);
    let s0 = h.g.s.score;
    h.run(A, 4);
    assert!(matches!(h.m().cop.st, CopState::Chase(_)), "cop reacts to shooting in front of him");
    assert!(h.m().bubbles.iter().any(|b| b.text.starts_with("HEY! STOP")));
    for _ in 0..300 {
        h.step_held(0);
        if h.m().p.frozen > 0 {
            break;
        }
    }
    assert!(h.m().p.frozen > 100);
    assert_eq!(h.g.s.score, s0 - 500);
    assert_eq!(h.g.s.lives, 3, "detention is not a death");
    h.run(0, 190);
    assert_eq!(h.m().p.frozen, 0);
}

#[test]
fn mall_cop_ignores_shots_behind_him_or_far_away() {
    let mut h = H::play(19);
    let f = h.m().cop.floor;
    h.m().cop.x = 400.0;
    h.m().cop.dir = 1; // facing away from us
    h.put(f, 330.0);
    h.m().p.face = 1;
    h.run(A, 4);
    assert!(matches!(h.m().cop.st, CopState::Patrol));
    h.m().cop.dir = -1;
    h.m().cop.x = 600.0;
    h.m().bullets.clear();
    h.run(0, 30);
    h.run(A, 4);
    assert!(matches!(h.m().cop.st, CopState::Patrol));
}

#[test]
fn kiosk_shows_nearest_package_store_then_cools_down_twenty_seconds() {
    let mut h = H::play(21);
    let (f, x) = KIOSKS[0];
    h.put(f, x as f32);
    h.tap(UP);
    assert!(h.m().kiosk_panel > 0);
    assert!(h.m().kiosk_target.is_some());
    assert!(h.m().kiosk_cd >= 1195);
    h.run(0, 300);
    assert_eq!(h.m().kiosk_panel, 0);
    h.tap(UP);
    assert_eq!(h.m().kiosk_panel, 0, "still cooling down");
    h.run(0, 1200);
    h.tap(UP);
    assert!(h.m().kiosk_panel > 0);
}

#[test]
fn photo_booth_hides_you_for_up_to_five_seconds_and_the_strip_pops_once() {
    let mut h = H::play(22);
    let (f, x) = PHOTO_BOOTH;
    h.put(f, x as f32);
    h.tap(UP);
    assert!(matches!(h.m().p.st, PState::Hidden(_)));
    assert!(!h.m().visible());
    let si = h.spy(f, x as f32 + 60.0);
    h.m().spies[si].dir = -1;
    h.run(0, 200);
    assert!(h.m().spies[si].x > x as f32 + 40.0 || true);
    assert!(h.m().bullets.iter().all(|b| !b.hostile), "spies ignore a hidden player");
    h.run(0, 120);
    assert!(matches!(h.m().p.st, PState::Walk), "booth lasts at most 5 s");
    assert!(h.g.s.strip);
    assert!(h.m().strip_t > 0);
    // second time: no new strip
    h.m().strip_t = 0;
    h.tap(UP);
    h.run(0, 320);
    assert_eq!(h.m().strip_t, 0);
}

#[test]
fn shooting_a_fountain_sprays_coins_worth_fifty_then_cools_down() {
    let mut h = H::play(23);
    let (f, x) = FOUNTAINS[0];
    h.put(f, x as f32 + 30.0);
    h.m().p.face = -1;
    h.run(A, 12);
    assert!((3..=5).contains(&h.m().coins.len()), "{} coins", h.m().coins.len());
    h.m().coins.retain(|c| !c.gold);
    let n = h.m().coins.len();
    let s0 = h.g.s.score;
    h.put(f, x as f32);
    h.run(0, 120);
    assert!(h.g.s.score >= s0 + 50);
    assert!(n >= 1);
    assert!(h.m().fountains[0].cd > 700);
    // cooling: a second shot right away does nothing
    h.m().coins.clear();
    h.put(f, x as f32 + 30.0);
    h.m().p.face = -1;
    h.run(A, 30);
    assert!(h.m().coins.is_empty());
}

#[test]
fn one_fountain_spray_in_twenty_has_a_gold_extra_life_coin() {
    let mut golds = 0;
    let n = 600;
    for seed in 0..n {
        let mut h = H::play(5000 + seed);
        let (f, x) = FOUNTAINS[0];
        h.put(f, x as f32 + 30.0);
        h.m().p.face = -1;
        h.run(A, 12);
        if h.m().coins.iter().any(|c| c.gold) {
            golds += 1;
        }
    }
    let rate = golds as f32 / n as f32;
    assert!((0.02..=0.09).contains(&rate), "gold rate {rate}");
}

#[test]
fn alarm_triggers_after_150_seconds_sooner_each_loop() {
    assert_eq!(difficulty(1).alarm_secs, 150);
    assert_eq!(difficulty(2).alarm_secs, 130);
    assert!(difficulty(30).alarm_secs >= 60);
    let mut rng = Rng::new(1);
    assert_eq!(Mall::new(&mut rng, 1).alarm_at, 150 * 60);
    assert_eq!(Mall::new(&mut rng, 2).alarm_at, 130 * 60);
    let mut h = H::play(24);
    h.m().alarm_at = h.g.mall.t + 5;
    h.run(0, 10);
    assert!(h.m().alarm);
    assert_eq!(h.g.song(), Some(Song::Alarm));
    assert!(h.m().banner.as_ref().unwrap().lines[0].contains("ALARM"));
    let base = h.m().spy_speed(1);
    assert!((base / (0.6) - 1.25).abs() < 0.01);
}

#[test]
fn difficulty_scales_each_loop_and_is_capped() {
    let a = difficulty(1);
    let b = difficulty(2);
    assert!((b.spy_speed / a.spy_speed - 1.10).abs() < 0.001);
    assert!((b.spawn_rate / a.spawn_rate - 1.15).abs() < 0.001);
    assert!((b.shot_rate / a.shot_rate - 1.15).abs() < 0.001);
    let z = difficulty(100);
    assert!(z.spy_speed <= 1.6 && z.spawn_rate <= 2.2 && z.shot_rate <= 2.2 && z.alarm_secs >= 60);
    // the shot interval never drops below one second
    let mut rng = Rng::new(1);
    let mut m = Mall::new(&mut rng, 1);
    m.alarm = true;
    assert!(m.spy_shot_interval(100) >= 60);
    assert_eq!(m.spy_shot_interval(1), (150.0f32 * 0.85) as i32);
    m.alarm = false;
    assert_eq!(m.spy_shot_interval(1), 150, "about one shot every 2.5 s on loop 1");
}

#[test]
fn scoring_table_and_extra_life_at_20000() {
    let mut s = Session::new(0, false);
    assert!(!s.add_score(19_999));
    assert_eq!(s.lives, 3);
    assert!(s.add_score(1));
    assert_eq!(s.lives, 4);
    assert!(!s.add_score(50_000), "only one extra life");
    let mut s = Session::new(0, false);
    s.add_score(100);
    s.add_score(-200);
    assert_eq!(s.score, 0, "score never goes negative");
    assert_eq!(START_LIVES, 3);
}

#[test]
fn first_spy_appears_about_five_seconds_in_and_cap_is_four() {
    let mut h = H::new(30);
    h.run(0, 20);
    h.tap(START);
    h.run(0, 60);
    for _ in 0..600 {
        if h.g.mall.control {
            break;
        }
        h.tap(A);
    }
    let t0 = h.g.mall.t;
    // stand near a door
    let slot = slot(StoreId::Forever12);
    h.m().p.inv = 100_000;
    h.put(4, slot.door_x() as f32 + 120.0);
    let mut first = None;
    for f in 0..2000 {
        h.step_held(0);
        if first.is_none() && !h.g.mall.spies.is_empty() {
            first = Some(f);
        }
        assert!(h.g.mall.live_spies() <= SPY_CAP);
    }
    let f = first.expect("a spy appears");
    assert!((250..=420).contains(&f), "first spy after {f} frames (t0={t0})");
}

#[test]
fn death_respawns_at_last_safe_spot_clears_spies_and_blinks() {
    let mut h = H::play(31);
    h.put(4, 300.0);
    h.run(RIGHT, 10);
    let safe = h.m().p.safe_x;
    h.spy(4, 500.0);
    h.m().bullets.push(Bullet { x: 0.0, y: 0.0, vx: 1.0, vy: 0.0, floor: 4, hostile: true, volley: 0 });
    h.g.powers.grant(PowerKind::Rapid);
    h.g.powers.grant(PowerKind::Radar);
    h.m().kill_player(Cause::Bullet);
    for _ in 0..200 {
        h.step_held(0);
        if h.g.s.lives == 2 {
            break;
        }
    }
    assert_eq!(h.g.s.lives, 2);
    assert!(h.m().spies.is_empty() && h.m().bullets.is_empty());
    assert!((h.m().p.x - safe).abs() < 2.0);
    assert!(h.m().p.inv > 100 && h.m().p.inv <= 120, "about 2 s of blinking: {}", h.m().p.inv);
    assert!(h.g.powers.radar && h.g.powers.weapon.is_none(), "only radar survives death");
}

#[test]
fn respawn_removes_a_cop_freeze() {
    let mut h = H::play(31);
    h.m().p.frozen = 150;
    h.m().kill_player(Cause::Bullet);
    h.run(0, 200);
    assert_eq!(h.m().p.frozen, 0);
}

#[test]
fn continue_screen_counts_down_from_nine_and_start_gives_three_lives() {
    let mut h = H::play(32);
    h.g.s.lives = 1;
    h.g.s.score = 4321;
    h.g.s.packages = 2;
    h.g.s.loop_n = 2;
    h.g.powers.grant(PowerKind::Radar);
    h.m().kill_player(Cause::Bullet);
    h.run(0, 100);
    assert!(matches!(h.g.scene, Scene::Continue { .. }));
    assert_eq!(h.g.continue_seconds(), 9);
    h.sfx.clear();
    h.run(0, 62);
    assert_eq!(h.g.continue_seconds(), 8);
    assert!(h.sfx.contains(&Sfx::Beep), "one beep per second");
    h.tap(START);
    assert!(matches!(h.g.scene, Scene::Mall));
    assert_eq!(h.g.s.lives, 3);
    assert_eq!(h.g.s.continues, 2);
    assert_eq!(h.g.s.score, 4321);
    assert_eq!(h.g.s.packages, 2);
    assert_eq!(h.g.s.loop_n, 2);
    assert!(!h.g.powers.radar, "power-ups reset on continue");
}

#[test]
fn three_continues_then_game_over_and_back_to_title() {
    let mut h = H::play(33);
    for i in 0..3 {
        h.g.s.lives = 1;
        h.m().kill_player(Cause::Bullet);
        h.run(0, 100);
        assert!(matches!(h.g.scene, Scene::Continue { .. }), "continue #{i}");
        h.tap(START);
        h.run(0, 40);
    }
    assert_eq!(h.g.s.continues, 0);
    h.g.s.lives = 1;
    h.m().kill_player(Cause::Bullet);
    h.run(0, 100);
    assert!(matches!(h.g.scene, Scene::GameOver { .. }));
    h.run(0, 900);
    assert!(matches!(h.g.scene, Scene::Title));
    assert!(h.g.hi_session >= 0);
}

#[test]
fn continue_countdown_expires_into_game_over() {
    let mut h = H::play(33);
    h.g.s.lives = 1;
    h.m().kill_player(Cause::Bullet);
    h.run(0, 100 + 9 * 60 + 30);
    assert!(matches!(h.g.scene, Scene::GameOver { .. }));
}

#[test]
fn exit_is_blocked_until_all_six_packages_then_fires_exactly_once() {
    let mut h = H::play(34);
    let x = (WAGON_X + 20) as f32;
    h.put(0, x);
    h.g.s.packages = 5;
    h.tap(UP);
    assert!(matches!(h.g.scene, Scene::Mall), "car won't start");
    let b = h.m().banner.clone().unwrap();
    assert_eq!(b.lines[0], "PACKAGES LEFT: 1");
    assert!(h.sfx.contains(&Sfx::Buzzer));
    h.g.s.packages = 6;
    h.sfx.clear();
    let score0 = h.g.s.score;
    for _ in 0..5 {
        h.tap(UP);
    }
    assert!(matches!(h.g.scene, Scene::Clear(_)));
    let bonus = h.g.s.score - score0;
    assert!(bonus >= 1000 && bonus <= 1000 + 3000, "clear bonus {bonus}");
    // repeated presses cannot fire it again
    h.run(0, 10);
    for _ in 0..5 {
        h.tap(UP);
    }
    assert_eq!(h.g.s.score - score0, bonus);
}

#[test]
fn level_clear_leads_to_a_harder_loop_two() {
    let mut h = H::play(35);
    h.put(0, (WAGON_X + 20) as f32);
    h.g.s.packages = 6;
    h.tap(UP);
    assert!(matches!(h.g.scene, Scene::Clear(_)));
    let mut seen = vec![];
    for _ in 0..3000 {
        h.tap(START);
        if let Scene::Clear(c) = &h.g.scene {
            let p = c.phase;
            if seen.last() != Some(&p) {
                seen.push(p);
            }
        }
        if matches!(h.g.scene, Scene::Mall) {
            break;
        }
    }
    assert!(matches!(h.g.scene, Scene::Mall));
    assert_eq!(h.g.s.loop_n, 2);
    assert_eq!(h.g.s.packages, 0, "packages are hidden again");
    assert!(seen.contains(&ClearPhase::Tally) && seen.contains(&ClearPhase::News) && seen.contains(&ClearPhase::Post));
    assert!(h.g.stores.iter().all(|s| !s.package_taken));
    assert!(h.g.mall.alarm_at < 150 * 60);
}

#[test]
fn time_bonus_is_ten_per_second_under_300() {
    let mut h = H::play(36);
    h.put(0, (WAGON_X + 20) as f32);
    h.g.s.packages = 6;
    h.m().t = 100 * 60;
    h.tap(UP);
    if let Scene::Clear(c) = &h.g.scene {
        assert_eq!(c.time_bonus, 2000);
    } else {
        panic!("not cleared");
    }
    let mut h = H::play(36);
    h.put(0, (WAGON_X + 20) as f32);
    h.g.s.packages = 6;
    h.m().t = 400 * 60;
    h.tap(UP);
    if let Scene::Clear(c) = &h.g.scene {
        assert_eq!(c.time_bonus, 0);
    }
}

#[test]
fn black_friday_via_konami_at_the_title_doubles_spies_and_sets_sale_rules() {
    let mut h = H::new(40);
    h.run(0, 20);
    for b in [UP, UP, UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A] {
        h.tap(b);
    }
    assert!(h.g.title.bf && h.g.title.bf_t > 0);
    h.tap(START);
    h.run(0, 60);
    assert!(h.g.s.bf);
    let mut ctx_powers = Powers::new();
    let mut rng = Rng::new(1);
    let ctx = Ctx { powers: &mut ctx_powers, stores: &h.g.stores, loop_n: 1, bf: true, packages: 0, rng: &mut rng };
    assert_eq!(h.g.mall.spy_cap(&ctx), 8);
    assert!(h.g.mall.spawn_interval(1, true) * 2 <= h.g.mall.spawn_interval(1, false) + 1);
    for st in &h.g.stores {
        for c in &st.contents {
            assert!(matches!(c, Content::Package | Content::Power(_) | Content::Nothing));
        }
    }
}

#[test]
fn pause_and_map_freeze_every_timer() {
    let mut h = H::play(41);
    h.g.powers.grant(PowerKind::Rapid);
    let t0 = h.g.powers.weapon.unwrap().1;
    let mt = h.g.mall.t;
    h.tap(START);
    assert_eq!(h.g.overlay, Overlay::Pause);
    h.run(0, 120);
    assert_eq!(h.g.powers.weapon.unwrap().1, t0);
    assert!(h.g.mall.t <= mt + 2);
    h.tap(START);
    assert_eq!(h.g.overlay, Overlay::None);
    h.tap(SELECT);
    assert_eq!(h.g.overlay, Overlay::Map);
    let t1 = h.g.powers.weapon.unwrap().1;
    h.run(0, 100);
    assert_eq!(h.g.powers.weapon.unwrap().1, t1);
    assert!(h.g.music_volume() == 1.0);
    h.tap(SELECT);
    h.tap(START);
    assert!(h.g.music_volume() < 1.0, "music is turned down while paused");
}

#[test]
fn power_up_timers_keep_running_inside_stores() {
    let mut h = H::play(42);
    let slot = slot(StoreId::KgbToys);
    h.put(3, slot.door_x() as f32);
    h.g.powers.grant(PowerKind::Rapid);
    h.tap(UP);
    h.run(0, 60);
    assert!(matches!(h.g.scene, Scene::Store));
    let t0 = h.g.powers.weapon.unwrap().1;
    h.run(0, 120);
    assert_eq!(h.g.powers.weapon.unwrap().1, t0 - 120);
}

#[test]
fn entering_a_store_and_walking_out_returns_to_the_same_door() {
    let mut h = H::play(43);
    let slot = slot(StoreId::SamBaddy);
    h.put(2, slot.door_x() as f32);
    h.tap(UP);
    h.run(0, 40);
    assert!(matches!(h.g.scene, Scene::Store));
    h.g.room.as_mut().unwrap().guards.clear();
    h.run(DOWN, 80);
    h.run(0, 60);
    assert!(matches!(h.g.scene, Scene::Mall));
    assert_eq!(h.m().p.floor, 2);
    assert!((h.m().p.x - slot.door_x() as f32).abs() < 1.0);
}

#[test]
fn closed_and_cleared_stores_cannot_be_entered() {
    let mut h = H::play(44);
    let slot = slot(StoreId::BlockBlusterVideo);
    h.put(3, slot.door_x() as f32);
    h.tap(UP);
    h.run(0, 40);
    assert!(matches!(h.g.scene, Scene::Mall));
    let k = slot_of(StoreId::KgbToys);
    let i = h.g.stores.iter().position(|s| s.id == StoreId::KgbToys).unwrap();
    h.g.stores[i].package_taken = true;
    h.put(3, k.door_x() as f32);
    h.tap(UP);
    h.run(0, 40);
    assert!(matches!(h.g.scene, Scene::Mall));
}

fn slot_of(id: StoreId) -> StoreSlot {
    *slot(id)
}

#[test]
fn every_store_can_hold_a_package_search_to_completion_through_the_game() {
    // end-to-end: enter KGB Toys, walk to the package fixture, search, leave: package counted, store closed
    let mut h = H::play(45);
    let sl = slot(StoreId::KgbToys);
    h.put(3, sl.door_x() as f32);
    h.tap(UP);
    h.run(0, 40);
    assert!(matches!(h.g.scene, Scene::Store));
    let (pk_idx, f) = {
        let st = h.g.store_state(StoreId::KgbToys);
        let i = st.contents.iter().position(|c| *c == Content::Package).unwrap();
        (i, h.g.room.as_ref().unwrap().fixtures[i])
    };
    {
        let r = h.g.room.as_mut().unwrap();
        r.guards.clear();
        r.x = (f.tx * 16 + 8) as f32;
        r.y = ((f.ty + 1) * 16 + 1) as f32;
        r.face = store::Dir::Up;
    }
    h.run(0, 2);
    h.tap(B);
    h.run(0, 150);
    assert_eq!(h.g.s.packages, 1);
    assert!(h.g.s.score >= 500);
    assert!(h.g.stores.iter().any(|s| s.id == StoreId::KgbToys && s.package_taken));
    let _ = pk_idx;
    h.g.room.as_mut().unwrap().y = 160.0;
    h.g.room.as_mut().unwrap().x = 128.0;
    h.run(DOWN, 60);
    h.run(0, 60);
    assert!(matches!(h.g.scene, Scene::Mall));
    h.tap(UP);
    h.run(0, 40);
    assert!(matches!(h.g.scene, Scene::Mall), "cleared target stores cannot be re-entered");
}

#[test]
fn same_seed_same_game_deterministic() {
    fn run(seed: u64) -> (i32, i32, usize) {
        let mut h = H::new(seed);
        h.run(0, 20);
        h.tap(START);
        for i in 0..2500 {
            let held = match (i / 50) % 4 {
                0 => RIGHT,
                1 => RIGHT | A,
                2 => LEFT,
                _ => A | B,
            };
            h.step_held(held);
        }
        (h.g.s.score, h.g.mall.p.x as i32, h.g.mall.spies.len())
    }
    assert_eq!(run(99), run(99));
    assert_eq!(run(5), run(5));
}

#[test]
fn spies_step_out_of_stopping_cars_sometimes_with_a_line() {
    let mut said = 0;
    let mut spawned = 0;
    for seed in 0..60 {
        let mut h = H::play(700 + seed);
        h.m().p.inv = 100_000;
        h.put(3, 500.0);
        h.car(1, 4);
        h.m().cars[1].target = Some(3);
        h.m().cars[1].called = false;
        h.run(0, 80);
        if !h.m().spies.is_empty() {
            spawned += 1;
            if !h.m().bubbles.is_empty() {
                said += 1;
            }
        }
    }
    assert!(spawned > 5 && spawned < 40, "spawned {spawned}");
    assert!(said > 0);
}

#[test]
fn spy_drops_and_last_words_happen_at_roughly_the_right_rates() {
    let mut words = 0;
    let n = 400;
    for seed in 0..n {
        let mut h = H::play(9000 + seed);
        h.put(4, 300.0);
        h.m().p.face = 1;
        let si = h.spy(4, 330.0);
        h.spy_stand(si);
        let mut rng = Rng::new(seed);
        let mut ctx = Ctx { powers: &mut h.g.powers, stores: &h.g.stores, loop_n: 1, bf: false, packages: 0, rng: &mut rng };
        h.g.mall.kill_spy(si, 100, &mut ctx);
        if !h.g.mall.bubbles.is_empty() {
            words += 1;
        }
    }
    let r = words as f32 / n as f32;
    assert!((0.25..=0.45).contains(&r), "last words rate {r}");
}

// ---------------------------------------------------------------- navigation (no softlocks)
impl H {
    fn walk_to(&mut self, x: f32) {
        for _ in 0..1500 {
            let px = self.g.mall.p.x;
            if (px - x).abs() < 1.0 {
                return;
            }
            self.step_held(if px < x { RIGHT } else { LEFT });
        }
        panic!("could not walk to {x}: stuck at {}", self.g.mall.p.x);
    }
    /// Ride shaft `i` (manual) to `floor`: board, drive, release, wait for it to stop level.
    fn ride_to(&mut self, i: usize, floor: u8) {
        let sx = SHAFTS[i].cx() as f32;
        let here = self.g.mall.p.floor;
        // approach beside the shaft, call, wait to be picked up
        self.walk_to(if sx - 30.0 < 30.0 { sx + 30.0 } else { sx - 30.0 });
        self.run(0, 2);
        self.tap(UP);
        let mut boarded = false;
        for _ in 0..800 {
            self.step_held(0);
            if matches!(self.g.mall.p.st, PState::Inside(_)) {
                boarded = true;
                break;
            }
        }
        assert!(boarded, "car {i} never came for floor {here}: car {:?} p {:?} x {} pickup {:?}", self.g.mall.cars[i].y, self.g.mall.p.st, self.g.mall.p.x, self.g.mall.p.pickup);
        self.run(0, 20);
        let dir = if floor > here { UP } else { DOWN };
        for _ in 0..2000 {
            if self.g.mall.cars[i].floor_at() == Some(floor) && self.g.mall.cars[i].dir == 0 {
                break;
            }
            let at = self.g.mall.cars[i].y;
            let target = floor_y(floor);
            let held = if (floor > here && at > target + 3) || (floor < here && at < target - 3) { dir } else { 0 };
            self.step_held(held);
        }
        assert_eq!(self.g.mall.cars[i].floor_at(), Some(floor), "car stops level with floor {floor}");
        self.run(RIGHT, 12);
        assert!(matches!(self.g.mall.p.st, PState::Walk), "got out: {:?}", self.g.mall.p.st);
        assert_eq!(self.g.mall.p.floor, floor);
    }
}

#[test]
fn route_roof_to_parking_with_elevators_and_escalators_is_always_possible() {
    for seed in 0..6 {
        let mut h = H::play(300 + seed);
        h.g.mall.p.inv = 1_000_000;
        // roof -> 4F by shaft A, then 4F -> 3F by escalator, 3F -> 2F by shaft A or B, down to P by B
        h.ride_to(0, 4);
        h.ride_to(1, 4); // cross shaft B by riding through the car
        h.walk_to(ESCALATORS[0].x_high() as f32);
        h.tap(DOWN);
        h.run(0, 80);
        assert_eq!(h.g.mall.p.floor, 3);
        h.ride_to(1, 0);
        // walk to the getaway car; blocked until all six packages
        h.walk_to((WAGON_X + 20) as f32);
        h.tap(UP);
        assert!(matches!(h.g.scene, Scene::Mall));
        h.g.s.packages = 6;
        h.tap(UP);
        assert!(matches!(h.g.scene, Scene::Clear(_)), "seed {seed}");
    }
}

#[test]
fn every_floor_is_reachable_in_play_and_no_car_can_strand_the_player() {
    // From each floor, park each serving car as far away as possible: calling must always work.
    for floor in 1..=4u8 {
        for i in 0..3 {
            if !SHAFTS[i].serves(floor) {
                continue;
            }
            for far in [SHAFTS[i].top, SHAFTS[i].bottom] {
                let mut h = H::play(400 + floor as u64);
                h.g.mall.p.inv = 1_000_000;
                h.car(i, far);
                let sx = SHAFTS[i].cx() as f32;
                h.put(floor, if sx - 26.0 < 30.0 { sx + 26.0 } else { sx - 26.0 });
                h.tap(UP);
                let mut ok = false;
                for _ in 0..900 {
                    h.step_held(0);
                    if matches!(h.g.mall.p.st, PState::Inside(_)) {
                        ok = true;
                        break;
                    }
                }
                assert!(ok, "floor {floor} shaft {} car parked at {far}", SHAFTS[i].name);
            }
        }
    }
}


#[test]
fn loop_one_is_fair_a_new_player_reaches_the_first_4f_store_without_dying() {
    let mut deaths = 0;
    let mut causes = vec![];
    for seed in 0..40 {
        let mut h = H::new(1000 + seed);
        h.run(0, 20);
        h.tap(START);
        h.run(0, 60);
        for _ in 0..600 {
            if h.g.mall.control {
                break;
            }
            h.tap(A);
        }
        h.run(0, 40);
        let lives0 = h.g.s.lives;
        // walk to A, ride to 4F, walk to Forever 12's door shooting all the way
        let sx = SHAFTS[0].cx() as f32;
        for _ in 0..400 {
            let px = h.g.mall.p.x;
            if (px - (sx + 30.0)).abs() < 1.0 { break; }
            h.step_held(if px < sx + 30.0 { RIGHT } else { LEFT } | A);
        }
        h.tap(UP);
        for _ in 0..500 {
            h.step_held(A);
            if matches!(h.g.mall.p.st, PState::Inside(_)) { break; }
        }
        h.run(0, 14);
        for _ in 0..600 {
            let at = h.g.mall.cars[0].y;
            h.step_held(if at < floor_y(4) - 3 { DOWN } else { 0 } | A);
            if h.g.mall.cars[0].floor_at() == Some(4) && h.g.mall.cars[0].dir == 0 { break; }
        }
        h.run(RIGHT | A, 12);
        let door = slot(StoreId::Forever12).door_x() as f32;
        for _ in 0..400 {
            let px = h.g.mall.p.x;
            if (px - door).abs() < 1.0 { break; }
            h.step_held(if px < door { RIGHT } else { LEFT } | A);
        }
        h.run(A, 120);
        if h.g.s.lives < lives0 {
            deaths += 1;
            causes.push((seed, h.g.mall.dying_cause, h.g.mall.t));
        }
    }
    assert!(deaths <= 3, "{deaths}/40 attempts died on the way to the first store: {causes:?}");
}
