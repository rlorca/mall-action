//! Port of `store/guards.test.ts`.
use crate::audio_ids::SfxId;
use crate::content::copy::LAST_WORDS;
use crate::content::stores::StoreId;
use crate::engine::pad::{BtnName::A, Pad};
use crate::engine::rng::Rng;
use crate::game::run::POINTS;
use crate::content::powerups::PowerId;

use super::collision::HALF;
use super::room::{GuardKind, TileKind, TILE};
use super::testutil::{empty_room, make_world, MakeOpts, Made};
use super::world::{Bullet, BulletKind, Dir, StoreWorld, AIM_FRAMES, BOT_HP, DEATH_FRAMES, GRACE_FRAMES, HURT_FRAMES};

const TILE_F: f64 = TILE as f64;

fn enemy_bullets(m: &Made) -> usize {
    m.world.bullets.iter().filter(|b| b.kind == BulletKind::Enemy).count()
}
fn centre(col: i32) -> f64 {
    col as f64 * TILE_F + TILE_F / 2.0
}
fn guards_room(room: super::room::Room) -> Made {
    make_world(StoreId::Crookstone, MakeOpts { room: Some(room), guards: true, ..Default::default() })
}
fn plain_room(room: super::room::Room) -> Made {
    make_world(StoreId::Crookstone, MakeOpts { room: Some(room), ..Default::default() })
}

/// One spy at (3,5) in an otherwise empty room, the agent on the same row.
fn spy_duel() -> Made {
    let room = empty_room(16, 11, &[(5, "..y...........")]);
    let mut m = guards_room(room);
    m.teleport(13, 5);
    m
}

mod spies_grace_period_telegraph_and_line_of_fire {
    use super::*;

    #[test]
    fn do_not_shoot_before_the_grace_period_then_telegraph_before_the_first_shot() {
        let mut m = spy_duel();
        let mut first_aim = -1;
        let mut first_bullet = -1;
        let mut i = 0;
        while i < 400 && first_bullet < 0 {
            m.step(&[]);
            let g = &m.world.guards[0];
            if first_aim < 0 && g.aim > 0 {
                first_aim = m.world.frame;
            }
            if enemy_bullets(&m) > 0 {
                first_bullet = m.world.frame;
            }
            i += 1;
        }
        assert!(first_aim >= GRACE_FRAMES);
        assert!(first_bullet > 0);
        // the aim telegraph lasts AIM_FRAMES before the bullet leaves
        assert!(first_bullet - first_aim >= AIM_FRAMES - 1);
        assert!(first_bullet - first_aim <= AIM_FRAMES + 1);
        assert!(first_bullet >= GRACE_FRAMES + AIM_FRAMES - 1);
    }

    #[test]
    fn the_telegraph_is_dodgeable_stepping_out_of_the_line_before_the_shot_makes_it_miss() {
        let mut m = spy_duel();
        let mut i = 0;
        while i < 300 && m.world.guards[0].aim == 0 {
            m.step(&[]);
            i += 1;
        }
        assert!(m.world.guards[0].aim > 0);
        m.teleport(13, 8);
        let mut saw_bullet = false;
        for _ in 0..(AIM_FRAMES + 40) {
            m.step(&[]);
            if enemy_bullets(&m) > 0 {
                saw_bullet = true;
            }
            if saw_bullet && enemy_bullets(&m) == 0 {
                break;
            }
        }
        assert!(saw_bullet);
        assert_eq!(m.world.agent.dying, 0);
    }

    #[test]
    fn line_of_fire_same_row_or_column_with_a_clear_path_and_the_box_lined_up_none_otherwise() {
        let mut open = guards_room(empty_room(16, 11, &[(5, "..y...........")]));
        let spy = open.world.guards[0].clone();
        open.teleport(10, 5);
        assert_eq!(open.world.line_of_fire(&spy), Some(Dir::Right));
        open.teleport(1, 5);
        assert_eq!(open.world.line_of_fire(&spy), Some(Dir::Left));
        open.teleport(3, 9);
        assert_eq!(open.world.line_of_fire(&spy), Some(Dir::Down));
        open.teleport(3, 1);
        assert_eq!(open.world.line_of_fire(&spy), Some(Dir::Up));
        // a few px off the row still gets hit (the bullet clips his box) ...
        open.teleport_by(10, 5, 0.0, 5.0);
        assert_eq!(open.world.line_of_fire(&spy), Some(Dir::Right));
        // ... but a whole tile off does not
        open.teleport(10, 6);
        assert_eq!(open.world.line_of_fire(&spy), None);
        open.teleport_by(10, 5, 0.0, HALF + 2.0);
        assert_eq!(open.world.line_of_fire(&spy), None);
        let mut walled = guards_room(empty_room(16, 11, &[(5, "..y..c........")]));
        let wspy = walled.world.guards[0].clone();
        walled.teleport(10, 5);
        assert_eq!(walled.world.line_of_fire(&wspy), None);
        walled.teleport(4, 5);
        assert_eq!(walled.world.line_of_fire(&wspy), Some(Dir::Right));
    }

    #[test]
    fn never_shoot_without_a_clear_path_a_sealed_pocket_behind_a_wall_stays_silent() {
        let mut sealed = guards_room(empty_room(16, 11, &[(4, ".###.........."), (5, ".#y#.........."), (6, ".###..........")]));
        sealed.teleport(10, 5);
        sealed.world.agent.hurt = 0;
        for _ in 0..600 {
            sealed.step(&[]);
            assert_eq!(sealed.world.guards[0].aim, 0);
            assert_eq!(enemy_bullets(&sealed), 0);
        }
        // control: open the pocket and he shoots
        let mut open = guards_room(empty_room(16, 11, &[(4, ".###.........."), (5, ".#y..........."), (6, ".###..........")]));
        open.teleport(10, 5);
        let mut shot = false;
        let mut i = 0;
        while i < 400 && !shot {
            open.step(&[]);
            shot = enemy_bullets(&open) > 0 || open.world.guards[0].aim > 0;
            i += 1;
        }
        assert!(shot);
    }

    #[test]
    fn enemy_bullets_stop_at_solid_tiles() {
        let mut m = guards_room(empty_room(16, 11, &[(5, "..y..c........")]));
        m.world.bullets.push(Bullet { kind: BulletKind::Enemy, x: centre(3), y: centre(5), vx: 2.0, vy: 0.0, age: 0, noclip: 0 });
        m.teleport(13, 8);
        m.idle(60);
        assert_eq!(enemy_bullets(&m), 0);
        assert_eq!(m.world.agent.dying, 0);
    }

    #[test]
    fn move_tile_by_tile_favouring_the_player_and_never_into_walls_or_through_the_door() {
        let room = empty_room(16, 11, &[(2, "..y..........."), (5, "......cc......")]);
        let mut m = guards_room(room);
        m.teleport(12, 8);
        let dist = |m: &Made| {
            let g = &m.world.guards[0];
            (g.x - m.world.agent.x).abs() + (g.y - m.world.agent.y).abs()
        };
        let d0 = dist(&m);
        for _ in 0..400 {
            m.step(&[]);
            m.world.agent.hurt = 9999; // stay alive for the experiment
            let g = &m.world.guards[0];
            // always aligned to the tile grid on at least one axis (tile-by-tile movement)
            let aligned_x = ((g.x - TILE_F / 2.0) % TILE_F).abs() < 1e-6;
            let aligned_y = ((g.y - TILE_F / 2.0) % TILE_F).abs() < 1e-6;
            assert!(aligned_x || aligned_y);
            let c = m.world.cell_at(g.x, g.y);
            assert_eq!(m.world.room.tiles[(c.row * 16 + c.col) as usize], TileKind::Floor);
            assert!(g.y < 10.0 * TILE_F);
        }
        assert!(dist(&m) < d0);
    }

    #[test]
    fn two_spies_never_share_a_tile() {
        let room = empty_room(16, 11, &[(2, "..y.y.........")]);
        let mut m = guards_room(room);
        m.teleport(12, 8);
        for _ in 0..300 {
            m.step(&[]);
            m.world.agent.hurt = 9999;
            let (a, b) = (&m.world.guards[0], &m.world.guards[1]);
            assert!(!(a.col == b.col && a.row == b.row));
        }
    }
}

mod shooting_and_killing {
    use super::*;

    fn lineup(kind: char, stunned: bool) -> Made {
        let room = empty_room(16, 11, &[(5, if kind == 'y' { ".......y......" } else { ".......b......" })]);
        let mut m = guards_room(room);
        m.teleport(3, 5);
        m.world.agent.facing = Dir::Right;
        if stunned {
            m.world.guards[0].stun = 99999;
        }
        m
    }

    #[test]
    fn a_shoots_in_the_facing_direction_max_2_bullets_and_a_cooldown_by_default() {
        let mut m = plain_room(empty_room(16, 11, &[]));
        m.world.agent.facing = Dir::Up;
        m.step(&[A]);
        assert_eq!(m.world.bullets.len(), 1);
        assert!(m.world.bullets[0].vy < 0.0);
        assert_eq!(m.world.bullets[0].vx, 0.0);
        m.step(&[A]);
        assert_eq!(m.world.bullets.len(), 1); // cooldown
        m.hold(14, &[A]);
        assert!(m.world.bullets.len() <= 2);
        assert!(m.run.drain_sfx().contains(&SfxId::Shot));
    }

    #[test]
    fn rapid_fire_allows_4_bullets_at_a_faster_rate_spread_shot_fires_a_3_way_fan() {
        let mut rapid = plain_room(empty_room(16, 11, &[(9, "......@.......")]));
        rapid.run.give_power(PowerId::Rapid);
        rapid.teleport(7, 9);
        rapid.world.agent.facing = Dir::Left;
        rapid.hold(40, &[A]);
        assert!(rapid.world.bullets.len() <= 4);
        assert!(rapid.world.agent.shoot_cd <= 6);
        let mut spread = plain_room(empty_room(16, 11, &[]));
        spread.run.give_power(PowerId::Spread);
        spread.world.agent.facing = Dir::Up;
        spread.step(&[A]);
        assert_eq!(spread.world.bullets.len(), 3);
        let mut vxs: Vec<i32> = spread.world.bullets.iter().map(|b| crate::engine::num::round_i(b.vx * 100.0)).collect();
        vxs.sort();
        assert!(vxs[0] < 0);
        assert_eq!(vxs[1], 0);
        assert!(vxs[2] > 0);
        assert!(spread.world.bullets.iter().all(|b| b.vy < 0.0));
    }

    #[test]
    fn a_bullet_stops_at_the_first_solid_tile() {
        let mut m = plain_room(empty_room(16, 11, &[(5, ".....c........")]));
        m.teleport(3, 5);
        m.world.agent.facing = Dir::Right;
        m.step(&[A]);
        m.idle(40);
        assert_eq!(m.world.bullets.len(), 0);
    }

    #[test]
    fn a_spy_dies_to_one_hit_plus_100_a_popup_removed_after_a_short_animation() {
        let mut m = lineup('y', true);
        m.step(&[A]);
        m.idle(30);
        let g = m.world.guards.get(0);
        assert!(g.is_none() || g.unwrap().dead);
        assert_eq!(m.run.score, POINTS.spy_shot);
        assert_eq!(POINTS.spy_shot, 100);
        assert!(m.world.popups.iter().any(|p| p.text == "+100"));
        m.idle(30);
        assert_eq!(m.world.guards.len(), 0);
    }

    #[test]
    fn about_35_percent_of_spy_kills_end_with_last_words_in_a_speech_bubble() {
        let mut words = 0;
        let n = 300;
        for seed in 1..=n {
            let room = empty_room(16, 11, &[(5, ".......y......")]);
            let mut m = make_world(StoreId::Crookstone, MakeOpts { room: Some(room), guards: true, seed, ..Default::default() });
            m.teleport(3, 5);
            m.world.agent.facing = Dir::Right;
            m.world.guards[0].stun = 99999;
            m.step(&[A]);
            m.idle(30);
            if m.world.bubbles.iter().any(|b| LAST_WORDS.contains(&b.text.as_str())) {
                words += 1;
            }
        }
        assert!(words as f64 / n as f64 > 0.25);
        assert!((words as f64 / n as f64) < 0.45);
    }

    #[test]
    fn security_bots_take_3_hits() {
        assert_eq!(BOT_HP, 3);
        let mut m = lineup('b', true);
        m.step(&[A]);
        m.idle(30);
        assert_eq!(m.world.guards[0].hp, 2);
        assert!(!m.world.guards[0].dead);
        m.step(&[A]);
        m.idle(30);
        assert_eq!(m.world.guards[0].hp, 1);
        assert!(!m.world.guards[0].dead);
        assert_eq!(m.run.score, 0);
        m.step(&[A]);
        m.idle(30);
        assert!(m.world.guards[0].dead);
        assert_eq!(m.run.score, POINTS.spy_shot);
    }

    #[test]
    fn bots_patrol_back_and_forth_turning_at_walls() {
        let mut m = guards_room(empty_room(16, 11, &[(5, "..b...........")]));
        m.teleport(7, 9);
        let mut min = f64::INFINITY;
        let mut max = f64::NEG_INFINITY;
        let mut turns = 0;
        let mut last_dir = m.world.guards[0].dir;
        for _ in 0..700 {
            m.step(&[]);
            let bot = &m.world.guards[0];
            min = min.min(bot.x);
            max = max.max(bot.x);
            if bot.dir != last_dir {
                turns += 1;
            }
            last_dir = bot.dir;
            assert_eq!(bot.y, centre(5));
        }
        assert!(min < TILE_F + HALF + 2.0);
        assert!(max > 15.0 * TILE_F - HALF - 2.0);
        assert!(turns >= 2);
    }

    #[test]
    fn vertical_bots_patrol_up_and_down() {
        let mut m = guards_room(empty_room(16, 11, &[(5, "..v...........")]));
        m.teleport(12, 9);
        let mut min = f64::INFINITY;
        let mut max = f64::NEG_INFINITY;
        for _ in 0..400 {
            m.step(&[]);
            let bot = &m.world.guards[0];
            min = min.min(bot.y);
            max = max.max(bot.y);
            assert_eq!(bot.x, centre(3));
        }
        assert!(max - min > 5.0 * TILE_F);
    }
}

mod getting_hurt {
    use super::*;

    fn hit(m: &mut Made) {
        let (x, y) = (m.world.agent.x, m.world.agent.y);
        m.world.bullets.push(Bullet { kind: BulletKind::Enemy, x, y, vx: 0.0, vy: 0.1, age: 0, noclip: 0 });
    }

    #[test]
    fn an_enemy_bullet_kills_died_is_set_after_the_short_death_animation() {
        let mut m = plain_room(empty_room(16, 11, &[]));
        hit(&mut m);
        m.step(&[]);
        assert!(m.world.agent.dying > 0);
        assert!(!m.world.died);
        m.idle(DEATH_FRAMES + 2);
        assert!(m.world.died);
    }

    #[test]
    fn a_dying_agent_cannot_move_or_search() {
        let mut m = plain_room(empty_room(16, 11, &[]));
        hit(&mut m);
        m.step(&[]);
        let x = m.world.agent.x;
        m.hold(20, &[crate::engine::pad::BtnName::Right]);
        assert_eq!(m.world.agent.x, x);
    }

    #[test]
    fn armour_vest_or_pretzel_absorbs_exactly_one_hit_then_the_next_one_kills() {
        for armour in [PowerId::Armor, PowerId::Pretzel] {
            let mut m = plain_room(empty_room(16, 11, &[]));
            m.run.give_power(armour);
            hit(&mut m);
            m.step(&[]);
            assert_eq!(m.world.agent.dying, 0);
            assert_eq!(m.run.power.armor, None);
            assert!(m.world.agent.hurt > 0);
            m.idle(HURT_FRAMES + 2);
            hit(&mut m);
            m.step(&[]);
            assert!(m.world.agent.dying > 0);
        }
    }

    #[test]
    fn armour_does_not_get_used_up_twice_by_one_bullet_burst_short_invulnerability_after_an_absorbed_hit() {
        let mut m = plain_room(empty_room(16, 11, &[]));
        m.run.give_power(PowerId::Armor);
        hit(&mut m);
        hit(&mut m);
        m.step(&[]);
        assert_eq!(m.world.agent.dying, 0);
    }

    #[test]
    fn cinnabomb_bullets_do_nothing_touching_spies_and_bots_kills_them() {
        let room = empty_room(16, 11, &[(5, ".......y......"), (6, ".......b......")]);
        let mut m = guards_room(room);
        m.run.give_power(PowerId::Cinnabomb);
        for g in m.world.guards.iter_mut() {
            g.stun = 99999;
        }
        hit(&mut m);
        m.step(&[]);
        assert_eq!(m.world.agent.dying, 0);
        m.teleport(8, 5);
        m.step(&[]);
        m.teleport(8, 6);
        m.step(&[]);
        assert!(m.world.guards.iter().all(|g| g.dead));
        assert_eq!(m.run.score, 2 * POINTS.spy_shot);
        // ... and it wears off after 6 seconds
        m.idle(6 * 60);
        hit(&mut m);
        m.step(&[]);
        assert!(m.world.agent.dying > 0);
    }

    #[test]
    fn touching_a_security_bot_kills_armour_absorbs_it_and_stuns_the_bot() {
        let room = empty_room(16, 11, &[(5, ".......b......")]);
        let mut m = guards_room(room.clone());
        m.teleport(8, 5);
        m.step(&[]);
        assert!(m.world.agent.dying > 0);

        let mut a = guards_room(room);
        a.run.give_power(PowerId::Armor);
        a.teleport(8, 5);
        a.step(&[]);
        assert_eq!(a.world.agent.dying, 0);
        assert_eq!(a.run.power.armor, None);
        assert!(a.world.guards[0].stun > 0);
    }

    #[test]
    fn a_spy_touching_the_agent_does_no_harm_by_itself() {
        let room = empty_room(16, 11, &[(5, ".......y......")]);
        let mut m = guards_room(room);
        m.world.guards[0].stun = 99999;
        m.teleport(8, 5);
        m.idle(30);
        assert_eq!(m.world.agent.dying, 0);
    }
}

mod guards_on_re_entry {
    use super::*;

    #[test]
    fn guards_come_back_every_time_you_re_enter_a_store_whose_package_is_still_inside() {
        let mut m = make_world(StoreId::Radioshock, MakeOpts { guards: true, ..Default::default() });
        let n = m.world.room.guards.len();
        assert_eq!(m.world.guards.len(), n);
        m.world.guards.clear();
        let again = StoreWorld::new(&mut m.run, StoreId::Radioshock, &Rng::new(3), None);
        assert_eq!(again.guards.len(), n);
        assert!(!m.run.level.store(StoreId::Radioshock).unwrap().package_taken);
    }
}

mod determinism {
    use super::*;
    use crate::engine::pad::BtnName;

    fn play(seed: u32) -> String {
        let mut m = make_world(StoreId::Footlock, MakeOpts { seed, guards: true, seen: false, ..Default::default() });
        let mut script = Rng::new(seed + 77);
        let names = [BtnName::Up, BtnName::Down, BtnName::Left, BtnName::Right, BtnName::A, BtnName::B];
        for i in 0..900 {
            if i % 12 == 0 {
                let mut held: Vec<BtnName> = Vec::new();
                for n in names {
                    if script.chance(0.3) {
                        held.push(n);
                    }
                }
                m.hold(1, &held);
            } else if m.world.agent.moving {
                m.hold(1, &[BtnName::Up]);
            } else {
                m.hold(1, &[]);
            }
            if m.world.died || m.world.exited {
                break;
            }
        }
        let w = &m.world;
        format!("{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}|{:?}", w.agent, w.guards, w.bullets, w.toys, w.puffs, w.frame, m.run.score, w.banner, w.bubbles)
    }

    #[test]
    fn same_seed_plus_same_inputs_the_same_state() {
        assert_eq!(play(5), play(5));
        assert_eq!(play(11), play(11));
    }

    #[test]
    fn different_seeds_play_out_differently() {
        assert_ne!(play(5), play(6));
    }
}

#[allow(dead_code)]
fn _unused(_: GuardKind, _: Pad) {}
