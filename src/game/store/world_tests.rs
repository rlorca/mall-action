//! Port of `store/world.test.ts`.
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::{package_banner, UI};
use crate::content::powerups::{power_def, PowerId, POWER_IDS};
use crate::content::stores::StoreId;
use crate::content::themes::ThemeId;
use crate::engine::pad::BtnName::{self, Down, Left, Right, Up, A, B};
use crate::engine::rng::Rng;
use crate::game::levelstate::FixtureContent;
use crate::game::run::POINTS;

use super::collision::HALF;
use super::room::{get_room, TILE};
use super::testutil::{empty_room, make_world, set_content, MakeOpts, Made};
use super::world::{BulletKind as BK, Dir, StoreWorld, DEATH_FRAMES, HOLD_PACKAGE, STUN_FRAMES, VIEW_H, VIEW_W};

const TILE_F: f64 = TILE as f64;

fn opts_room(room: super::room::Room) -> MakeOpts {
    MakeOpts { room: Some(room), ..Default::default() }
}

/// Step until `pred` holds (max n frames); returns the frames it took.
fn until(m: &mut Made, pred: impl Fn(&Made) -> bool, max: i32) -> i32 {
    for i in 0..max {
        if pred(m) {
            return i;
        }
        m.step(&[]);
    }
    panic!("condition never met");
}

fn close(a: f64, b: f64, digits: i32) -> bool {
    (a - b).abs() < 10f64.powi(-digits) / 2.0
}

mod agent_movement {
    use super::*;

    #[test]
    fn walks_about_1_25_px_per_frame_facing_where_he_walks() {
        let mut m = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        let x0 = m.world.agent.x;
        m.hold(10, &[Right]);
        assert!(close(m.world.agent.x - x0, 12.5, 5));
        assert_eq!(m.world.agent.facing, Dir::Right);
        m.hold(4, &[Up]);
        assert_eq!(m.world.agent.facing, Dir::Up);
        m.hold(2, &[Left]);
        assert_eq!(m.world.agent.facing, Dir::Left);
        m.hold(2, &[Down]);
        assert_eq!(m.world.agent.facing, Dir::Down);
    }

    #[test]
    fn moves_with_sub_pixel_precision() {
        let mut m = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        m.step(&[Right]);
        assert_ne!(m.world.agent.x % 1.0, 0.0);
    }

    #[test]
    fn walks_faster_with_sneakers_1_25x_and_orange_juli_ooze_1_5x() {
        let mut base = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        let x0 = base.world.agent.x;
        base.hold(8, &[Right]);
        let slow = base.world.agent.x - x0;
        let mut sn = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        sn.run.give_power(PowerId::Sneakers);
        sn.hold(8, &[Right]);
        let fast = sn.world.agent.x - x0;
        assert!(close(fast / slow, 1.25, 5));
        let mut oz = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        oz.run.give_power(PowerId::Ooze);
        oz.hold(8, &[Right]);
        assert!(close((oz.world.agent.x - x0) / slow, 1.5, 5));
    }

    #[test]
    fn gives_vertical_input_priority_over_horizontal_input() {
        let mut m = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        let x0 = m.world.agent.x;
        let y0 = m.world.agent.y;
        m.hold(10, &[Up, Right]);
        assert_eq!(m.world.agent.x, x0);
        assert!(m.world.agent.y < y0);
        assert_eq!(m.world.agent.facing, Dir::Up);
    }

    #[test]
    fn walls_are_solid_he_stops_flush_against_them() {
        let mut m = make_world(StoreId::Crookstone, opts_room(empty_room(16, 11, &[])));
        m.hold(200, &[Left]);
        assert_eq!(m.world.agent.x, TILE_F + HALF);
        m.hold(200, &[Up]);
        assert_eq!(m.world.agent.y, TILE_F + HALF);
    }

    #[test]
    fn fixtures_counters_and_decor_are_solid() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.teleport(3, 2); // below the shelf at (3,1)
        let x0 = m.world.agent.x;
        m.hold(30, &[Up]);
        assert_eq!(m.world.agent.y, 2.0 * TILE_F + HALF);
        assert_eq!(m.world.agent.x, x0);
        // decor block at (3,3): walk into it from above
        m.teleport(3, 2);
        m.hold(30, &[Down]);
        assert_eq!(m.world.agent.y, 3.0 * TILE_F - HALF);
    }

    #[test]
    fn slips_through_a_1_tile_gap_with_zelda_style_corner_assist() {
        for dx in [-5.0, -3.0, 0.0, 3.0, 5.0] {
            let gap_room = empty_room(16, 11, &[(5, "######.#######")]);
            let mut m = make_world(StoreId::Crookstone, opts_room(gap_room));
            m.teleport_by(7, 7, dx, 0.0);
            m.hold(80, &[Up]);
            assert!(m.world.agent.y < 5.0 * TILE_F, "offset {}", dx);
        }
    }

    #[test]
    fn corner_assist_does_not_push_through_a_gap_that_is_too_far_away() {
        let gap_room = empty_room(16, 11, &[(5, "######.#######")]);
        let mut m = make_world(StoreId::Crookstone, opts_room(gap_room));
        m.teleport_by(7, 7, 12.0, 0.0);
        m.hold(80, &[Up]);
        assert!(m.world.agent.y > 6.0 * TILE_F);
    }

    #[test]
    fn walking_onto_the_door_sets_exited_exactly_once_and_plays_the_door_sound_once() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        assert!(!m.world.exited);
        m.hold(30, &[Down]);
        assert!(m.world.exited);
        m.hold(30, &[Down]);
        assert_eq!(m.run.drain_sfx().iter().filter(|s| **s == SfxId::Door).count(), 1);
    }

    #[test]
    fn does_not_exit_while_standing_inside_the_room() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.hold(120, &[Left]);
        m.hold(120, &[Up]);
        assert!(!m.world.exited);
        assert!(!m.world.died);
    }
}

mod rooms_of_any_size_and_the_camera {
    use super::*;

    #[test]
    fn a_16_x_11_room_fits_the_256_x_176_view_exactly() {
        let m = make_world(StoreId::Crookstone, MakeOpts::default());
        assert_eq!(VIEW_W, 256);
        assert_eq!(VIEW_H, 176);
        assert_eq!(m.world.cam_x, 0);
        assert_eq!(m.world.cam_y, 0);
    }

    #[test]
    fn a_room_smaller_than_the_view_is_centred() {
        let m = make_world(StoreId::Crookstone, opts_room(empty_room(10, 7, &[])));
        assert_eq!(m.world.cam_x, -((256 - 160) / 2));
        assert_eq!(m.world.cam_y, -((176 - 112) / 2));
    }

    #[test]
    fn a_big_room_scrolls_the_camera_follows_the_agent_and_stays_inside_the_room() {
        let room = empty_room(40, 24, &[]);
        let mut m = make_world(StoreId::Crookstone, opts_room(room));
        let max_x = 40 * TILE - VIEW_W;
        let max_y = 24 * TILE - VIEW_H;
        assert_eq!(m.world.cam_y, max_y);
        assert!(m.world.cam_x > 0);
        let start_cam_x = m.world.cam_x;
        for _ in 0..400 {
            m.step(&[Left]);
            assert!(m.world.cam_x >= 0);
            assert!(m.world.cam_x <= max_x);
            let sx = m.world.agent.x - m.world.cam_x as f64;
            assert!(sx >= 0.0);
            assert!(sx < VIEW_W as f64);
        }
        assert!(m.world.cam_x < start_cam_x);
        assert_eq!(m.world.cam_x, 0);
        for _ in 0..400 {
            m.step(&[Up]);
        }
        assert_eq!(m.world.cam_y, 0);
        let sy = m.world.agent.y - m.world.cam_y as f64;
        assert!(sy >= 0.0);
        assert!(sy < VIEW_H as f64);
    }
}

mod searching {
    use super::*;

    /// crookstone: shelves at (3,1) idx 0, (4,1) idx 1, ...
    fn near_shelf() -> Made {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.teleport(3, 2);
        m
    }

    #[test]
    fn a_single_tap_of_b_starts_a_search_that_runs_on_its_own_for_search_frames_frames() {
        let mut m = near_shelf();
        assert!(m.world.can_search());
        m.step(&[B]); // the tap: pressed this frame...
        assert!(m.world.search.is_some());
        assert_eq!(m.world.search_progress(), 0.0);
        let start_frame = m.world.frame;
        let mut opened = -1;
        let mut i = 1;
        while i <= 200 && opened < 0 {
            m.step(&[]); // ...and released: the search keeps going
            if m.world.fixture_opened(&m.run, 0) {
                opened = m.world.frame - start_frame;
            } else {
                assert!(m.world.search.is_some());
            }
            i += 1;
        }
        assert_eq!(opened, m.run.search_frames());
        assert_eq!(opened, 45);
        assert!(m.world.search.is_none());
    }

    #[test]
    fn shows_a_progress_fraction_that_climbs_from_0_to_1() {
        let mut m = near_shelf();
        m.step(&[B]);
        let mut fracs: Vec<f64> = Vec::new();
        for _ in 0..44 {
            m.step(&[]);
            fracs.push(m.world.search_progress());
        }
        assert!(fracs[0] > 0.0);
        assert!(fracs[fracs.len() - 1] > 0.9);
        for i in 1..fracs.len() {
            assert!(fracs[i] > fracs[i - 1]);
        }
    }

    #[test]
    fn is_faster_with_sneakers_30_frames() {
        let mut m = near_shelf();
        m.run.give_power(PowerId::Sneakers);
        m.step(&[B]);
        let start = m.world.frame;
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 600);
        assert_eq!(m.world.frame - start, 30);
    }

    #[test]
    fn does_nothing_when_no_fixture_is_touched() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.teleport(7, 8);
        assert!(!m.world.can_search());
        m.tap(&[B]);
        assert!(m.world.search.is_none());
    }

    #[test]
    fn a_fixture_touched_from_the_side_counts_and_the_agent_turns_to_face_it() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.teleport(5, 1); // right of the shelf at (4,1)
        m.world.agent.facing = Dir::Up;
        assert_eq!(m.world.search_target, 1);
        m.tap(&[B]);
        assert_eq!(m.world.search.map(|s| s.fixture), Some(1));
        assert_eq!(m.world.agent.facing, Dir::Left);
    }

    #[test]
    fn a_fixture_touched_from_behind_the_corner_below_counts_too_auto_facing_up() {
        let mut m = near_shelf();
        m.world.agent.facing = Dir::Down;
        m.tap(&[B]);
        assert_eq!(m.world.search.map(|s| s.fixture), Some(0));
        assert_eq!(m.world.agent.facing, Dir::Up);
    }

    #[test]
    fn a_fixture_touched_at_a_gap_between_two_fixtures_works() {
        let room = empty_room(16, 11, &[(3, ".....s.s......")]);
        let cols: Vec<i32> = room.fixtures.iter().map(|f| f.col).collect();
        let mut m = make_world(StoreId::Crookstone, opts_room(room));
        assert_eq!(cols, vec![6, 8]);
        m.teleport(7, 3); // standing in the 1-tile gap
        m.world.agent.facing = Dir::Up;
        assert!(m.world.can_search());
        m.tap(&[B]);
        assert!(m.world.search.is_some());
        assert!(m.world.agent.facing == Dir::Left || m.world.agent.facing == Dir::Right);
    }

    #[test]
    fn prefers_the_fixture_the_agent_is_facing_when_he_touches_several() {
        let room = empty_room(16, 11, &[(3, ".....s.s......")]);
        let mut m = make_world(StoreId::Crookstone, opts_room(room.clone()));
        m.teleport(7, 3);
        m.world.agent.facing = Dir::Right;
        m.tap(&[B]);
        assert_eq!(m.world.search.map(|s| s.fixture), Some(1));
        let mut n = make_world(StoreId::Crookstone, opts_room(room));
        n.teleport(7, 3);
        n.world.agent.facing = Dir::Left;
        n.tap(&[B]);
        assert_eq!(n.world.search.map(|s| s.fixture), Some(0));
    }

    #[test]
    fn works_while_pressing_into_the_fixture_too_touching_is_enough_no_exact_alignment_needed() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.teleport_by(3, 2, 7.0, 0.0); // 7 px right of centre: still under the shelf pair
        m.hold(20, &[Up]);
        assert!(m.world.can_search());
        m.tap(&[B]);
        assert!(m.world.search.is_some());
    }

    #[test]
    fn a_fresh_press_of_a_different_direction_cancels_the_search() {
        let mut m = near_shelf();
        m.tap(&[B]); // faces up
        m.idle(10);
        assert!(m.world.search.is_some());
        m.step(&[Left]);
        assert!(m.world.search.is_none());
        m.idle(80);
        assert!(!m.world.fixture_opened(&m.run, 0));
    }

    #[test]
    fn pressing_the_direction_he_is_already_facing_into_the_fixture_does_not_cancel() {
        let mut m = near_shelf();
        m.tap(&[B]);
        m.idle(5);
        m.step(&[Up]);
        assert!(m.world.search.is_some());
        m.hold(60, &[Up]);
        assert!(m.world.fixture_opened(&m.run, 0));
    }

    #[test]
    fn shooting_cancels_the_search() {
        let mut m = near_shelf();
        m.tap(&[B]);
        m.idle(10);
        assert!(m.world.search.is_some());
        m.step(&[A]);
        assert!(m.world.search.is_none());
        assert!(m.run.drain_sfx().contains(&SfxId::Shot));
        assert!(m.world.agent.shoot_cd > 0);
        m.idle(80);
        assert!(!m.world.fixture_opened(&m.run, 0));
    }

    #[test]
    fn holding_a_direction_that_was_already_down_does_not_cancel() {
        let mut m = near_shelf();
        m.step(&[Left]); // already walking...
        m.teleport(3, 2);
        m.step(&[Left, B]); // ...then B pressed while LEFT is merely held
        assert!(m.world.search.is_some());
        m.hold(10, &[Left]);
        assert!(m.world.search.is_some());
    }

    #[test]
    fn after_a_cancel_a_new_tap_searches_again_from_zero() {
        let mut m = near_shelf();
        m.tap(&[B]);
        m.idle(20);
        m.step(&[Right]); // cancel (moves a little)
        m.teleport(3, 2);
        m.idle(2);
        m.tap(&[B]);
        assert!(m.world.search.unwrap().t < 5);
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 600);
    }

    #[test]
    fn holding_b_after_a_search_does_not_immediately_search_the_next_fixture() {
        let room = empty_room(16, 11, &[(3, ".....s.s......")]);
        let mut m = make_world(StoreId::Crookstone, opts_room(room));
        m.teleport(7, 3);
        m.world.agent.facing = Dir::Left;
        m.hold(300, &[B]);
        let opened: Vec<usize> = [0usize, 1].iter().copied().filter(|i| m.world.fixture_opened(&m.run, *i)).collect();
        assert_eq!(opened, vec![0]);
        assert!(m.world.search.is_none());
        // a fresh press does search the other one
        m.idle(130);
        m.tap(&[B]);
        assert_eq!(m.world.search.map(|s| s.fixture), Some(1));
    }

    #[test]
    fn searched_fixtures_cannot_be_searched_again_and_stay_open() {
        let mut m = near_shelf();
        m.tap(&[B]);
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 600);
        m.idle(130);
        assert_ne!(m.world.search_target, 0);
        m.tap(&[B]);
        // fixture 1 at (4,1) may be touched from here; fixture 0 must not restart
        assert_ne!(m.world.search.map_or(-1, |s| s.fixture as i32), 0);
    }

    #[test]
    fn re_entering_the_store_keeps_opened_fixtures_state_lives_in_run_level() {
        let mut m = near_shelf();
        m.tap(&[B]);
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 600);
        assert!(m.run.level.store(StoreId::Crookstone).unwrap().fixtures[0].opened);
        let again = make_world(StoreId::Crookstone, MakeOpts::default());
        // a brand new world on the same run (the Game rebuilds the world on every entry)
        let mut w2 = StoreWorld::new(&mut m.run, StoreId::Crookstone, &Rng::new(5), None);
        assert!(w2.fixture_opened(&m.run, 0));
        assert!(!w2.fixture_opened(&m.run, 1));
        w2.teleport_agent(&m.run, 3, 2);
        w2.agent.facing = Dir::Up;
        assert_ne!(w2.search_target, 0);
        assert!(!again.world.fixture_opened(&again.run, 0));
    }

    #[test]
    fn search_target_prompt_can_search_is_false_while_stunned_or_holding_an_item() {
        let mut m = near_shelf();
        set_content(&mut m, 0, FixtureContent::Trap);
        m.tap(&[B]);
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 600);
        assert!(m.world.agent.stun > 0);
        assert!(!m.world.can_search());
    }
}

mod fixture_contents {
    use super::*;

    fn at(store_id: StoreId, col: i32, row: i32) -> Made {
        let mut m = make_world(store_id, MakeOpts::default());
        m.teleport(col, row);
        m
    }
    fn at_default() -> Made {
        at(StoreId::Radioshock, 2, 2)
    }
    fn search(m: &mut Made, i: usize) {
        m.tap(&[B]);
        until(m, |m| m.world.fixture_opened(&m.run, i), 600);
    }

    #[test]
    fn package_500_held_overhead_fanfare_package_n_6_the_store_is_cleared() {
        let mut m = at_default();
        set_content(&mut m, 0, FixtureContent::Package);
        search(&mut m, 0);
        assert_eq!(m.run.score, POINTS.package);
        assert_eq!(POINTS.package, 500);
        assert!(m.world.store(&m.run).package_taken);
        assert!(m.run.level.store(StoreId::Radioshock).unwrap().package_taken);
        assert_eq!(m.world.banner.as_ref().map(|b| b.text.clone()), Some(package_banner(1)));
        assert_eq!(m.world.banner.as_ref().unwrap().text, "PACKAGE 1/6");
        assert!(m.run.drain_sfx().contains(&SfxId::Fanfare));
        assert_eq!(m.world.agent.hold.as_ref().map(|h| h.kind.as_str()), Some("package"));
        assert_eq!(m.run.packages(), 1);
    }

    #[test]
    fn package_count_includes_the_packages_already_taken_package_3_6() {
        let mut m = at_default();
        m.run.level.store_mut(StoreId::Kgbtoys).unwrap().package_taken = true;
        m.run.level.store_mut(StoreId::Hotspy).unwrap().package_taken = true;
        set_content(&mut m, 0, FixtureContent::Package);
        search(&mut m, 0);
        assert_eq!(m.world.banner.as_ref().unwrap().text, "PACKAGE 3/6");
    }

    #[test]
    fn freezes_the_agent_while_he_holds_the_item_overhead_then_he_can_move_again() {
        let mut m = at_default();
        set_content(&mut m, 0, FixtureContent::Package);
        search(&mut m, 0);
        let x0 = m.world.agent.x;
        m.hold(HOLD_PACKAGE - 10, &[Right]);
        assert_eq!(m.world.agent.x, x0);
        m.hold(40, &[Right]);
        assert!(m.world.agent.x > x0);
        assert!(m.world.agent.hold.is_none());
    }

    #[test]
    fn power_up_applies_the_slot_50_banner_with_its_name_powerup_sound_held_overhead() {
        for id in POWER_IDS {
            let mut m = at(StoreId::Radioshock, 2, 2);
            set_content(&mut m, 0, FixtureContent::Powerup(id));
            let lives = m.run.lives;
            search(&mut m, 0);
            assert_eq!(m.world.banner.as_ref().unwrap().text, power_def(id).name, "{:?}", id);
            assert_eq!(m.run.score, POINTS.powerup, "{:?}", id);
            assert!(m.run.drain_sfx().contains(&SfxId::Powerup), "{:?}", id);
            assert_eq!(m.world.agent.hold.as_ref().map(|h| h.kind.as_str()), Some("power"), "{:?}", id);
            if id == PowerId::Rapid {
                assert_eq!(m.run.power.weapon.map(|w| w.id), Some(PowerId::Rapid));
            }
            if id == PowerId::Spread {
                assert_eq!(m.run.power.weapon.map(|w| w.id), Some(PowerId::Spread));
            }
            if id == PowerId::Armor || id == PowerId::Pretzel {
                assert_eq!(m.run.power.armor, Some(id));
            }
            if id == PowerId::Sneakers || id == PowerId::Ooze {
                assert_eq!(m.run.power.speed.map(|s| s.id), Some(id));
            }
            if id == PowerId::Radar {
                assert!(m.run.power.radar);
            }
            if id == PowerId::Cinnabomb {
                assert!(m.run.invincible());
            }
            if id == PowerId::Oneup {
                assert_eq!(m.run.lives, lives + 1);
            }
        }
    }

    #[test]
    fn a_power_up_from_a_shop_applies_to_the_existing_slots_weapon_replaced_armour_stacks() {
        let mut m = at(StoreId::Radioshock, 2, 2);
        m.run.give_power(PowerId::Rapid);
        m.run.give_power(PowerId::Armor);
        set_content(&mut m, 0, FixtureContent::Powerup(PowerId::Spread));
        search(&mut m, 0);
        assert_eq!(m.run.power.weapon.map(|w| w.id), Some(PowerId::Spread));
        assert_eq!(m.run.power.armor, Some(PowerId::Armor));
    }

    #[test]
    fn trap_smoke_puff_its_a_trap_stunned_for_exactly_1_s_smoke_sound() {
        let mut m = at_default();
        set_content(&mut m, 0, FixtureContent::Trap);
        search(&mut m, 0);
        assert_eq!(m.world.banner.as_ref().unwrap().text, UI.trap);
        assert!(!m.world.puffs.is_empty());
        assert!(m.run.drain_sfx().contains(&SfxId::Smoke));
        assert_eq!(m.world.agent.stun, STUN_FRAMES);
        assert_eq!(STUN_FRAMES, 60);
        let x0 = m.world.agent.x;
        m.hold(59, &[Right]);
        assert_eq!(m.world.agent.x, x0);
        m.hold(3, &[Right]);
        assert!(m.world.agent.x > x0);
    }

    #[test]
    fn nothing_a_puff_and_nothing_here_no_stun_no_score() {
        let mut m = at_default();
        set_content(&mut m, 0, FixtureContent::Nothing);
        search(&mut m, 0);
        assert_eq!(m.world.banner.as_ref().unwrap().text, UI.nothing);
        assert!(!m.world.puffs.is_empty());
        assert_eq!(m.world.agent.stun, 0);
        assert_eq!(m.run.score, 0);
    }

    #[test]
    fn every_search_is_announced_in_a_banner() {
        for content in [FixtureContent::Package, FixtureContent::Trap, FixtureContent::Nothing, FixtureContent::Powerup(PowerId::Radar)] {
            let mut m = at_default();
            set_content(&mut m, 0, content);
            search(&mut m, 0);
            assert!(m.world.banner.is_some());
            assert!(m.world.banner.as_ref().unwrap().t > 30);
        }
    }

    #[test]
    fn radar_flags_the_fixture_holding_the_package_until_it_is_searched() {
        let mut m = at_default();
        let idx = m.run.level.store(StoreId::Radioshock).unwrap().fixtures.iter().position(|f| f.content == FixtureContent::Package).unwrap();
        for i in 0..m.world.room.fixtures.len() {
            assert!(!m.world.radar_marked(&m.run, i));
        }
        m.run.give_power(PowerId::Radar);
        let marked: Vec<usize> = (0..m.world.room.fixtures.len()).filter(|i| m.world.radar_marked(&m.run, *i)).collect();
        assert_eq!(marked, vec![idx]);
        m.run.level.store_mut(StoreId::Radioshock).unwrap().fixtures[idx].opened = true;
        assert!(!m.world.radar_marked(&m.run, idx));
    }

    #[test]
    fn power_up_timers_keep_running_inside_stores_tick_powers_once_per_step_the_world_never_touches_level_frames() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.run.give_power(PowerId::Rapid);
        m.run.give_power(PowerId::Cinnabomb);
        let left = m.run.power.weapon.unwrap().left;
        m.idle(10);
        assert_eq!(m.run.power.weapon.unwrap().left, left - 10);
        assert_eq!(m.run.power.invincible, 6 * 60 - 10);
        assert_eq!(m.run.level_frames, 0);
    }

    #[test]
    fn does_not_run_after_it_has_finished_exited_died() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        m.hold(30, &[Down]);
        assert!(m.world.exited);
        m.run.give_power(PowerId::Rapid);
        let left = m.run.power.weapon.unwrap().left;
        m.idle(10);
        assert_eq!(m.run.power.weapon.unwrap().left, left);
    }

    #[test]
    fn uses_the_theme_and_name_of_the_store() {
        let m = make_world(StoreId::Hotspy, MakeOpts::default());
        assert_eq!(m.world.name(), crate::content::stores::store_def(StoreId::Hotspy).name);
        assert_eq!(m.world.room.theme, ThemeId::Food);
        assert_eq!(m.world.music(), MusicId::StoreHotspy);
        // TS asserts `getRoom('hotspy') toBe world.room` (same object); the Rust world owns a clone, so compare by value.
        assert!(*get_room(StoreId::Hotspy) == m.world.room);
    }

    #[test]
    fn death_sequence_died_is_only_set_after_the_death_animation() {
        let mut m = make_world(StoreId::Crookstone, MakeOpts::default());
        let (x, y) = (m.world.agent.x, m.world.agent.y);
        m.world.bullets.push(super::super::world::Bullet { kind: BK::Enemy, x, y, vx: 0.0, vy: 1.0, age: 0, noclip: 0 });
        m.step(&[]);
        assert!(m.world.agent.dying > 0);
        assert!(!m.world.died);
        m.idle(DEATH_FRAMES - 5);
        assert!(!m.world.died);
        m.idle(10);
        assert!(m.world.died);
        assert!(m.run.drain_sfx().contains(&SfxId::Death));
        assert_eq!(m.run.lives, 3); // the Game calls run.loseLife(), not the world
    }
}

#[allow(dead_code)]
fn _unused(_: BtnName) {}
