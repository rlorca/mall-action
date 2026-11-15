//! Port of `game/mall/mall.test.ts`.

use super::geometry::fy;
use super::spies::new_spy;
use super::testutil::*;
use super::types::*;
use super::world::{Outcome, GRAVITY, JUMP_HEIGHT};
use crate::audio_ids::SfxId;
use crate::content::copy::FLOOR_BANNERS;
use crate::content::layout::{ShaftDef, ShaftId, CAR_H, ESCALATORS, SHAFTS, WAGON};
use crate::content::powerups::PowerId;
use crate::content::stores::{StoreId, DOOR_W, DOOR_X, STORES};

const A_: ShaftDef = SHAFTS[0];
const B_: ShaftDef = SHAFTS[1];
const C_: ShaftDef = SHAFTS[2];

fn cx(s: &ShaftDef) -> f64 {
    s.x + s.w / 2.0
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 0.5e-5
}

fn banner_text(r: &Rig) -> Option<String> {
    r.w.banner.as_ref().map(|b| b.text.clone())
}

/// Spawn a walking spy and return its id (look it up with `w.spy_by_id`).
fn spawn(r: &mut Rig, x: f64, floor: i32) -> i32 {
    let s = new_spy(&mut r.w, x, floor, SpyMode::Walk, None);
    let id = s.id;
    r.w.spies.push(s);
    id
}

fn player_bullets(r: &Rig) -> usize {
    r.w.bullets.iter().filter(|k| k.owner == BulletOwner::Player).count()
}

mod walking_jumping_ducking_shooting {
    use super::*;

    #[test]
    fn walks_exactly_1_px_per_frame() {
        let mut r = make_rig(RigOpts::new());
        let x0 = r.w.player.x;
        r.hold(RIGHT, 30);
        assert!(close(r.w.player.x - x0, 30.0));
        r.hold(LEFT, 10);
        assert!(close(r.w.player.x - x0, 20.0));
        assert_eq!(r.w.player.face, -1);
    }

    #[test]
    fn stays_inside_the_mall_walls() {
        let mut r = make_rig(RigOpts::new());
        place(&mut r, 1, 20.0);
        r.hold(LEFT, 60);
        assert!(r.w.player.x >= 8.0);
    }

    #[test]
    fn a_standing_jump_rises_about_20_px_lands_on_the_same_floor_in_25_frames_and_is_not_a_kick() {
        let mut r = make_rig(RigOpts::new());
        let y0 = r.w.player.y;
        r.hold(B, 1);
        let mut peak = y0;
        let mut frames = 1;
        assert!(!r.w.player.kick);
        r.hold(0, 1);
        while r.w.player.mode == PlayerMode::Air && frames < 100 {
            peak = peak.min(r.w.player.y);
            r.hold(0, 1);
            frames += 1;
        }
        assert!(y0 - peak > JUMP_HEIGHT - 3.0);
        assert!(y0 - peak < JUMP_HEIGHT + 3.0);
        assert!(frames > 20);
        assert!(frames < 32);
        assert_eq!(r.w.player.y, y0);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert!(GRAVITY > 0.0);
    }

    #[test]
    fn jumping_while_moving_carries_momentum_and_is_a_jump_kick_that_kills_spies_on_contact() {
        let mut r = make_rig(RigOpts::new());
        r.hold(RIGHT | B, 1);
        assert!(r.w.player.kick);
        let x1 = r.w.player.x;
        r.hold(RIGHT, 10);
        assert!(r.w.player.x - x1 > 8.0);
        // a spy in the way
        let mut r2 = make_rig(RigOpts::new());
        place(&mut r2, 1, 300.0);
        let sp = spawn(&mut r2, 316.0, 1);
        r2.hold(RIGHT | B, 1);
        let mut i = 0;
        while i < 20 && r2.w.spy_by_id(sp).map_or(false, |s| s.mode != SpyMode::Dying) {
            r2.hold(RIGHT, 1);
            i += 1;
        }
        let s = r2.w.spy_by_id(sp).unwrap();
        assert_eq!(s.mode, SpyMode::Dying);
        assert_eq!(s.killed_by, Some(KilledBy::Kick));
        assert_ne!(r2.w.player.mode, PlayerMode::Dying);
    }

    #[test]
    fn holding_down_ducks_and_stops_walking() {
        let mut r = make_rig(RigOpts::new());
        r.hold(DOWN, 2);
        assert!(r.w.player.ducking);
        let x = r.w.player.x;
        r.hold(DOWN | RIGHT, 5);
        assert!(r.w.player.x <= x + 5.0);
        r.hold(0, 1);
        assert!(!r.w.player.ducking);
    }

    #[test]
    fn bullets_fly_4_px_frame_at_most_2_at_once_chest_height_standing_and_low_when_ducking() {
        let mut r = make_rig(RigOpts::new());
        place(&mut r, 1, 300.0);
        r.hold(A, 1);
        assert_eq!(r.w.bullets.len(), 1);
        assert_eq!(r.w.bullets[0].y, fy(1) - 16.0);
        let x0 = r.w.bullets[0].x;
        r.hold(A, 1);
        assert_eq!(r.w.bullets[0].x - x0, 4.0);
        r.hold(A, 30);
        assert!(player_bullets(&r) <= 2);
        let mut r2 = make_rig(RigOpts::new());
        place(&mut r2, 1, 300.0);
        r2.hold(DOWN | A, 2);
        assert_eq!(r2.w.bullets[0].y, fy(1) - 8.0);
    }

    #[test]
    fn rapid_fire_allows_4_bullets_spread_fires_3() {
        let mut r = make_rig(RigOpts::new());
        place(&mut r, 1, 100.0);
        r.run.give_power(PowerId::Rapid);
        r.hold(A, 30);
        let n = player_bullets(&r);
        assert!(n > 2);
        assert!(n <= 4);
        let mut r2 = make_rig(RigOpts::new());
        place(&mut r2, 1, 100.0);
        r2.run.give_power(PowerId::Spread);
        r2.hold(A, 1);
        assert_eq!(r2.w.bullets.len(), 3);
    }
}

mod elevators {
    use super::*;

    #[test]
    fn boards_a_level_car_rides_down_glides_to_the_next_floor_and_stops_exactly_level_with_one_ding() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0);
        place(&mut r, 0, cx(&A_));
        r.tap(DOWN);
        assert_eq!(r.w.player.mode, PlayerMode::Ride);
        r.sfx.clear();
        r.hold(DOWN, 60); // less than one floor (48) is fine; travel past floor 1 and release between 4F and 3F
        r.hold(0, 1);
        for _ in 0..80 {
            r.hold(0, 1);
        }
        let car = r.w.car(ShaftId::A);
        assert_eq!(car.dir, 0);
        assert!([fy(1), fy(2), fy(3)].contains(&car.y));
        assert_eq!(car.y, fy(2)); // held 60 px from R(112): 172, between 4F(160) and 3F(208) -> glides on to 3F
        assert_eq!(r.sfx_count(SfxId::Ding), 1);
        assert_eq!(r.w.player.y, r.w.car(ShaftId::A).y);
    }

    #[test]
    fn holding_a_direction_at_the_end_of_the_shaft_dings_once_not_repeatedly() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 2);
        place(&mut r, 2, cx(&A_));
        r.tap(DOWN);
        r.sfx.clear();
        r.hold(DOWN, 200); // bottom of A is 2F (floor 3)
        assert_eq!(r.w.car(ShaftId::A).y, fy(3));
        assert_eq!(r.sfx_count(SfxId::Ding), 1);
    }

    #[test]
    fn a_rider_can_get_out_left_right_when_stopped_at_a_floor() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0);
        place(&mut r, 0, cx(&A_));
        r.tap(DOWN);
        r.hold(DOWN, 20);
        r.hold(0, 80); // glides on to 4F and stops level
        assert_eq!(r.w.car(ShaftId::A).y, fy(1));
        r.hold(RIGHT, 40);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert_eq!(r.w.player.floor, Some(1));
        assert!(r.w.player.x > A_.x + A_.w);
    }

    #[test]
    fn shows_the_floor_announcement_banner_when_the_car_stops_with_the_agent_inside() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0);
        place(&mut r, 0, cx(&A_));
        r.tap(DOWN);
        r.hold(DOWN, 100);
        r.hold(0, 80);
        let f = (0..6).find(|k| fy(*k) == r.w.car(ShaftId::A).y).unwrap();
        assert!(f > 0);
        assert_eq!(banner_text(&r).as_deref(), Some(FLOOR_BANNERS[f as usize]));
        if f == 1 {
            assert_eq!(banner_text(&r).as_deref(), Some("4F - FASHION & GADGETS, SPIES"));
        }
    }

    #[test]
    fn walking_into_an_open_pit_one_floor_deep_lands_safely_on_the_car_roof() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 1); // car at 4F; we stand on R next to the opening: a pit 1 floor below
        place(&mut r, 0, A_.x - 6.0);
        r.hold(RIGHT, 14);
        for _ in 0..60 {
            r.hold(0, 1);
        }
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert_eq!(r.w.player.roof, Some(ShaftId::A));
        assert_eq!(r.w.player.y, fy(1) - CAR_H);
        assert_ne!(r.w.player.mode, PlayerMode::Dying);
    }

    #[test]
    fn falling_more_than_one_floor_kills() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 3); // 2F: roof is 3 floors minus 32 below the roof surface
        place(&mut r, 0, A_.x - 6.0);
        r.hold(RIGHT, 14);
        for _ in 0..80 {
            r.hold(0, 1);
        }
        assert_eq!(r.causes, vec!["fall".to_string()]);
    }

    #[test]
    fn a_car_coming_down_onto_the_agent_standing_on_its_grate_crushes_him() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0); // car at R, agent on 4F standing on the grate under it
        place(&mut r, 1, cx(&A_));
        r.w.car_mut(ShaftId::A).goal = Some(fy(1));
        r.hold(0, 120);
        assert_eq!(r.causes, vec!["crush".to_string()]);
    }

    #[test]
    fn a_car_called_by_the_agent_picks_him_up_instead_of_crushing_him() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0);
        place(&mut r, 1, cx(&A_));
        r.idle(35); // standing still in the opening for ~0.5 s calls the car
        r.hold(0, 120);
        assert!(r.causes.is_empty());
        assert_eq!(r.w.car(ShaftId::A).y, fy(1));
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        // and he can board it
        r.tap(UP);
        assert_eq!(r.w.player.mode, PlayerMode::Ride);
    }

    #[test]
    fn up_down_beside_an_empty_opening_calls_the_car_immediately() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::B, 5); // car at the bottom
        place(&mut r, 1, B_.x - 8.0);
        r.tap(DOWN);
        r.hold(0, 400);
        assert_eq!(r.w.car(ShaftId::B).y, fy(1));
    }

    #[test]
    fn the_automatic_car_never_leaves_while_someone_stands_inside_it() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::C, 1);
        place(&mut r, 1, cx(&C_));
        r.hold(0, 600); // stand in the car much longer than the 2 s wait
        assert_eq!(r.w.car(ShaftId::C).y, fy(1));
        place(&mut r, 1, 200.0);
        r.hold(0, 400);
        assert_ne!(r.w.car(ShaftId::C).y, fy(1)); // free to go once the agent left (it picks another floor)
    }

    #[test]
    fn the_automatic_car_waits_2_s_then_moves_to_a_random_other_floor() {
        let mut r = make_rig(RigOpts::new().floor(1).x(200.0));
        set_car(&mut r, ShaftId::C, 1);
        r.hold(0, 100);
        assert_eq!(r.w.car(ShaftId::C).y, fy(1));
        r.hold(0, 40);
        assert_ne!(r.w.car(ShaftId::C).dir, 0);
    }

    #[test]
    fn standing_on_a_car_roof_and_rising_into_the_top_of_the_shaft_crushes() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 2);
        place(&mut r, 1, A_.x - 6.0);
        r.hold(RIGHT, 14);
        for _ in 0..30 {
            r.hold(0, 1);
        }
        assert_eq!(r.w.player.roof, Some(ShaftId::A));
        r.hold(UP, 400);
        assert_eq!(r.causes[0], "roofcrush");
    }

    #[test]
    fn cannot_walk_through_the_shaft_wall_while_a_car_is_moving_past_the_doorway_blocked() {
        let mut r = make_rig(RigOpts::new());
        set_car(&mut r, ShaftId::A, 0);
        let car = r.w.car_mut(ShaftId::A);
        car.y = fy(1) + 10.0; // body overlapping the 4F doorway
        car.prev_y = car.y;
        place(&mut r, 1, A_.x - 8.0);
        r.hold(RIGHT, 20);
        assert!(r.w.player.x <= A_.x + 4.0);
    }

    #[test]
    fn every_floor_can_be_reached_by_shaft_or_escalator_routing_sanity() {
        // B is the only way down to P and it starts at 4F: the agent reaches 4F from R via A or C.
        assert_eq!(SHAFTS.iter().find(|s| s.id == ShaftId::B).unwrap().bottom, 5);
        assert_eq!(SHAFTS.iter().find(|s| s.id == ShaftId::A).unwrap().top, 0);
    }
}

mod shaft_walls_exist_only_where_the_shaft_does {
    use super::*;

    #[test]
    fn a_floor_below_above_a_shaft_has_no_invisible_wall_1f_and_p_at_a_r_at_b() {
        let cases: [(i32, f64, f64); 4] = [
            (4, A_.x - 30.0, A_.x + A_.w + 30.0), // 1F: shaft A ends at 2F
            (5, A_.x - 30.0, A_.x + A_.w + 30.0), // P: no A
            (0, B_.x - 30.0, B_.x + B_.w + 30.0), // R: shaft B starts at 4F
            (5, C_.x - 30.0, C_.x + C_.w + 30.0), // P: no C
        ];
        for (floor, x0, x1) in cases {
            let mut r = make_rig(RigOpts::new());
            place(&mut r, floor, x0);
            r.hold(RIGHT, (x1 - x0).ceil() as i32 + 4);
            assert!(r.w.player.x > x1 - 2.0, "floor {}", floor);
            assert_eq!(r.w.player.floor, Some(floor));
        }
    }
}

mod escalators {
    use super::*;

    #[test]
    fn up_at_the_bottom_landing_rides_to_the_upper_floor_down_at_the_top_landing_rides_down() {
        let e = ESCALATORS[0];
        let mut r = make_rig(RigOpts::new());
        place(&mut r, e.lower, e.x_low);
        r.tap(UP);
        assert_eq!(r.w.player.mode, PlayerMode::Escalator);
        r.hold(0, 60);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert_eq!(r.w.player.floor, Some(e.upper));
        assert_eq!(r.w.player.x, e.x_high);
        r.tap(DOWN);
        assert_eq!(r.w.player.mode, PlayerMode::Escalator);
        r.hold(0, 60);
        assert_eq!(r.w.player.floor, Some(e.lower));
        assert_eq!(r.w.player.x, e.x_low);
    }

    #[test]
    fn the_1f_2f_escalator_works_too() {
        let e = ESCALATORS[1];
        let mut r = make_rig(RigOpts::new());
        place(&mut r, e.lower, e.x_low);
        r.tap(UP);
        r.hold(0, 60);
        assert_eq!(r.w.player.floor, Some(e.upper));
    }
}

mod store_doors_and_the_exit {
    use super::*;

    #[test]
    fn up_at_an_open_store_door_asks_to_enter_closed_and_cleared_stores_stay_shut() {
        let f12 = STORES.iter().find(|s| s.id == StoreId::Forever12).unwrap();
        let mut r = make_rig(RigOpts::new());
        place(&mut r, f12.floor, f12.x + DOOR_X + DOOR_W / 2.0);
        r.tap(UP);
        assert_eq!(r.w.enter_store, Some(StoreId::Forever12));
        let blk = STORES.iter().find(|s| s.id == StoreId::Blockbluster).unwrap();
        let mut r2 = make_rig(RigOpts::new());
        place(&mut r2, blk.floor, blk.x + DOOR_X + DOOR_W / 2.0);
        r2.tap(UP);
        assert_eq!(r2.w.enter_store, None);
        let mut r3 = make_rig(RigOpts::new());
        r3.run.level.store_mut(StoreId::Forever12).unwrap().package_taken = true;
        place(&mut r3, f12.floor, f12.x + DOOR_X + DOOR_W / 2.0);
        r3.tap(UP);
        assert_eq!(r3.w.enter_store, None);
    }

    #[test]
    fn the_getaway_car_will_not_start_with_packages_missing_packages_left_n_and_a_buzzer() {
        let mut r = make_rig(RigOpts::new());
        place(&mut r, 5, WAGON.x + 30.0);
        r.sfx.clear();
        r.tap(UP);
        assert!(!r.w.exit_triggered);
        assert_eq!(banner_text(&r).as_deref(), Some("PACKAGES LEFT: 6"));
        assert!(r.sfx_has(SfxId::Buzzer));
    }

    #[test]
    fn with_all_6_packages_the_exit_fires_exactly_once() {
        let mut r = make_rig(RigOpts::new());
        for s in r.run.level.stores.iter_mut().flatten() {
            s.package_taken = true;
        }
        place(&mut r, 5, WAGON.x + 30.0);
        r.tap(UP);
        assert!(r.w.exit_triggered);
        r.w.exit_triggered = false; // the Game consumed it
        r.tap(UP);
        r.tap(UP);
        assert!(!r.w.exit_triggered);
    }
}

mod death_and_respawn {
    use super::*;

    #[test]
    fn after_a_death_the_agent_respawns_at_the_last_safe_spot_invulnerable_with_spies_and_bullets_cleared() {
        let mut r = make_rig(RigOpts::new().floor(1).x(280.0));
        place(&mut r, 1, 280.0);
        r.hold(0, 5);
        let _sp = spawn(&mut r, 400.0, 1);
        r.w.bullets.push(Bullet { x: 290.0, y: fy(1) - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.w.bullets.push(Bullet { x: 270.0, y: fy(1) - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 4);
        assert_eq!(r.w.player.mode, PlayerMode::Dying);
        r.hold(0, 90);
        assert_eq!(r.run.lives, 2);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert!(r.w.player.invuln > 60);
        assert_eq!(r.w.spies.len(), 0);
        assert_eq!(r.w.bullets.len(), 0);
        assert!((r.w.player.x - 280.0).abs() < 40.0);
    }

    #[test]
    fn armour_absorbs_one_bullet() {
        let mut r = make_rig(RigOpts::new().floor(1).x(280.0));
        place(&mut r, 1, 280.0);
        r.run.give_power(PowerId::Armor);
        r.w.bullets.push(Bullet { x: 276.0, y: fy(1) - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 3);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert!(r.run.power.armor.is_none());
    }

    #[test]
    fn the_last_life_leads_to_a_continue_then_game_over_when_none_are_left() {
        let mut r = make_rig(RigOpts::new().floor(1).x(280.0));
        r.run.lives = 1;
        place(&mut r, 1, 280.0);
        r.w.bullets.push(Bullet { x: 276.0, y: fy(1) - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 90);
        assert_eq!(r.w.outcome, Some(Outcome::Continue));
        let mut r2 = make_rig(RigOpts::new().floor(1).x(280.0));
        r2.run.lives = 1;
        r2.run.continues_left = 0;
        place(&mut r2, 1, 280.0);
        r2.w.bullets.push(Bullet { x: 276.0, y: fy(1) - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r2.hold(0, 90);
        assert_eq!(r2.w.outcome, Some(Outcome::Gameover));
    }
}
