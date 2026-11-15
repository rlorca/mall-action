//! Port of `store/extras.test.ts`.
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::{first_visit, you_got, BubbleWho, EASTER_EGG, SHOUTS, UI};
use crate::content::stores::{open_stores, StoreId};
use crate::engine::pad::{BtnName::{self, Down, Left, Right, Up, A, B}, Pad};
use crate::engine::rng::Rng;
use crate::game::levelstate::FixtureContent;

use super::room::{GuardKind, TileKind, TILE};
use super::testutil::{make_world, set_content, MakeOpts, Made};
use super::world::{
    BulletKind, Dir, EggPhase, StoreWorld, AIM_FRAMES, GRACE_FRAMES, HOLD_JOKE, INTRO_GAP, INTRO_START, TOY_LIFE,
};

const TILE_F: f64 = TILE as f64;

fn centre(col: i32) -> f64 {
    col as f64 * TILE_F + TILE_F / 2.0
}

fn until(m: &mut Made, pred: impl Fn(&Made) -> bool, max: i32) -> i32 {
    for i in 0..max {
        if pred(m) {
            return i;
        }
        m.step(&[]);
    }
    panic!("condition never met");
}

fn egg_phase(m: &Made) -> EggPhase {
    m.world.egg.unwrap().phase
}

mod gamestonk_easter_egg {
    use super::*;

    fn egg(guards: bool) -> Made {
        make_world(StoreId::Gamestonk, MakeOpts { egg: true, guards, ..Default::default() })
    }

    #[test]
    fn plays_the_first_time_only_clerk_between_two_tvs_flagged_in_run_easter_egg_done() {
        let mut m = egg(false);
        assert!(m.world.egg.is_some());
        assert!(m.world.clerk_visible());
        assert!(m.run.easter_egg_done);
        let clerk = m.world.room.clerk.unwrap();
        assert_eq!(m.world.room.tiles[(clerk.row * 16 + clerk.col - 1) as usize], TileKind::Tv);
        assert_eq!(m.world.room.tiles[(clerk.row * 16 + clerk.col + 1) as usize], TileKind::Tv);
        // the second visit has no egg
        let again = StoreWorld::new(&mut m.run, StoreId::Gamestonk, &Rng::new(2), None);
        assert!(again.egg.is_none());
        assert!(!again.clerk_visible());
        assert_eq!(again.pedestal_item(), None);
        // and no other store ever has one
        assert!(make_world(StoreId::Crookstone, MakeOpts { egg: true, ..Default::default() }).world.egg.is_none());
    }

    #[test]
    fn a_typewriter_prints_the_clerk_line_with_text_blip_sounds_while_input_and_guards_are_frozen() {
        let mut m = egg(true);
        let spawn: Vec<(f64, f64)> = m.world.guards.iter().map(|g| (g.x, g.y)).collect();
        let x0 = m.world.agent.x;
        let y0 = m.world.agent.y;
        let mut last = "";
        let mut growth = 0;
        for _ in 0..120 {
            m.step(&[Right, A]);
            let t = m.world.typewriter();
            if let Some(t) = t {
                if t != last {
                    assert!(EASTER_EGG.clerk.starts_with(t));
                    growth += 1;
                    last = t;
                }
            }
        }
        assert!(growth > 20);
        assert_eq!(m.world.agent.x, x0);
        assert_eq!(m.world.agent.y, y0);
        assert_eq!(m.world.bullets.len(), 0);
        let now: Vec<(f64, f64)> = m.world.guards.iter().map(|g| (g.x, g.y)).collect();
        assert_eq!(now, spawn);
        let sfx = m.run.drain_sfx();
        assert_eq!(sfx.iter().filter(|s| **s == SfxId::Blip).count(), EASTER_EGG.clerk.replace(' ', "").len());
        until(&mut m, |m| egg_phase(m) == EggPhase::Item, 600);
        assert_eq!(m.world.typewriter(), None);
    }

    #[test]
    fn then_an_item_appears_on_the_pedestal_and_input_comes_back() {
        let mut m = egg(false);
        until(&mut m, |m| egg_phase(m) == EggPhase::Item, 600);
        assert!(EASTER_EGG.items.contains(&m.world.pedestal_item().unwrap()));
        let x0 = m.world.agent.x;
        m.hold(10, &[Left]);
        assert!(m.world.agent.x < x0);
    }

    #[test]
    fn walking_onto_the_item_plays_the_item_get_jingle_holds_it_overhead_you_got_item_plus_1_point_and_an_inventory_entry() {
        let mut m = egg(false);
        until(&mut m, |m| egg_phase(m) == EggPhase::Item, 600);
        let item = m.world.pedestal_item().unwrap();
        assert_eq!(m.world.music(), MusicId::StoreGamestonk);
        m.teleport(7, 3);
        m.hold(30, &[Up]);
        assert_eq!(egg_phase(&m), EggPhase::Get);
        assert_eq!(m.world.music(), MusicId::Itemget);
        assert_eq!(m.world.agent.hold.as_ref().map(|h| h.kind.as_str()), Some("joke"));
        assert_eq!(m.world.banner.as_ref().unwrap().text, you_got(item));
        assert_eq!(m.world.banner.as_ref().unwrap().text, format!("YOU GOT: {}", item));
        assert_eq!(m.run.score, 1);
        assert_eq!(m.run.inventory, vec![item.to_string()]);
        assert_eq!(m.world.pedestal_item(), None);
        // frozen while he holds it
        let y = m.world.agent.y;
        m.hold(20, &[Down]);
        assert_eq!(m.world.agent.y, y);
    }

    #[test]
    fn then_the_clerk_vanishes_in_a_puff_and_the_store_music_returns() {
        let mut m = egg(false);
        until(&mut m, |m| egg_phase(m) == EggPhase::Item, 600);
        m.teleport(7, 3);
        m.hold(30, &[Up]);
        assert!(m.world.clerk_visible());
        until(&mut m, |m| egg_phase(m) == EggPhase::Done, HOLD_JOKE + 5);
        assert!(!m.world.clerk_visible());
        assert_eq!(m.world.music(), MusicId::StoreGamestonk);
        assert!(!m.world.puffs.is_empty()); // the puff the clerk vanishes in
        // the clerk's tile is walkable now
        m.hold(40, &[Up]);
        assert!(m.world.agent.y < 2.0 * TILE_F);
    }

    #[test]
    fn the_demo_tvs_are_solid() {
        let mut m = egg(false);
        until(&mut m, |m| egg_phase(m) == EggPhase::Item, 600);
        m.teleport(6, 2); // below the TV at (6,1)
        m.hold(30, &[Up]);
        assert_eq!(m.world.agent.y, 2.0 * TILE_F + 6.0);
        assert_eq!(egg_phase(&m), EggPhase::Item);
    }

    #[test]
    fn the_item_is_random_all_five_turn_up_but_deterministic_for_a_seed() {
        let mut seen: Vec<&str> = Vec::new();
        for seed in 1..=80u32 {
            let m = make_world(StoreId::Gamestonk, MakeOpts { egg: true, seed, ..Default::default() });
            let item = m.world.egg.unwrap().item;
            if !seen.contains(&item) {
                seen.push(item);
            }
            let again = make_world(StoreId::Gamestonk, MakeOpts { egg: true, seed, ..Default::default() });
            assert_eq!(again.world.egg.unwrap().item, item);
        }
        seen.sort();
        let mut want: Vec<&str> = EASTER_EGG.items.to_vec();
        want.sort();
        assert_eq!(seen, want);
    }
}

mod forever_12_fitting_rooms {
    use super::*;

    /// Search fitting room 0 (at 2,1) once; returns the world.
    fn search_fitting(seed: u32) -> Made {
        let mut m = make_world(StoreId::Forever12, MakeOpts { seed, ..Default::default() });
        m.teleport(2, 2);
        m.tap(&[B]);
        until(&mut m, |m| m.world.search.is_none(), 80);
        m
    }
    fn spy_appeared(m: &Made) -> bool {
        m.world.guards.len() == 1
    }
    fn first_spy_seed() -> Made {
        for seed in 1..200 {
            let c = search_fitting(seed);
            if spy_appeared(&c) {
                return c;
            }
        }
        panic!("no seed produced a spy");
    }

    #[test]
    fn searching_a_fitting_room_has_a_25_percent_chance_of_a_spy_mid_change() {
        let mut spies = 0;
        let n = 400;
        for seed in 1..=n {
            if spy_appeared(&search_fitting(seed)) {
                spies += 1;
            }
        }
        let f = spies as f64 / n as f64;
        assert!(f > 0.18);
        assert!(f < 0.32);
    }

    #[test]
    fn the_spy_shrieks_occupied_throws_a_shoe_then_fights_as_a_normal_spy_the_real_contents_stay_unsearched() {
        let mut m = first_spy_seed();
        {
            let w = &m.world;
            let spy = &w.guards[0];
            assert_eq!(spy.kind, GuardKind::Spy);
            assert!(spy.change > 0);
            assert!(w.bubbles.iter().any(|b| b.text == SHOUTS.fitting));
            assert_eq!(SHOUTS.fitting, "OCCUPIED!!");
        }
        assert!(m.run.drain_sfx().contains(&SfxId::Shriek));
        assert!(!m.world.fixture_opened(&m.run, 0));
        assert!(m.world.peeked.contains(&0));
        assert!(m.world.banner.is_none());
        // the spy is in the cubicle, then throws a shoe
        assert_eq!(m.world.guards[0].x, centre(2));
        assert_eq!(m.world.guards[0].y, centre(1));
        m.teleport(6, 2); // out of the way so the shoe can be seen in flight
        m.world.agent.hurt = 99999;
        until(&mut m, |m| m.world.bullets.iter().any(|b| b.kind == BulletKind::Shoe), 80);
        assert!(m.world.bullets.iter().any(|b| b.kind == BulletKind::Shoe));
    }

    #[test]
    fn the_shoe_hurts_an_agent_who_stays_put_next_to_the_cubicle_is_hit() {
        let mut m = first_spy_seed();
        until(&mut m, |m| m.world.agent.dying > 0, 80);
        assert!(m.world.agent.dying > 0);
    }

    #[test]
    fn after_the_shriek_the_spy_fights_like_any_other_spy() {
        let mut m = first_spy_seed();
        m.world.agent.hurt = 99999; // sidestep the shoe for this experiment
        m.teleport(12, 6);
        m.idle(200);
        let spy = &m.world.guards[0];
        assert_eq!(spy.change, 0);
        assert!((spy.x - centre(2)).hypot(spy.y - centre(1)) > 8.0);
    }

    #[test]
    fn the_fitting_room_can_be_searched_again_it_only_rolls_the_spy_once() {
        let mut m = first_spy_seed();
        m.world.agent.hurt = 99999;
        m.world.guards.clear();
        m.world.bullets.clear();
        m.teleport(2, 2);
        m.idle(4);
        m.tap(&[B]);
        until(&mut m, |m| m.world.fixture_opened(&m.run, 0), 100);
        assert_eq!(m.world.guards.len(), 0);
        assert!(m.world.banner.is_some());
    }

    #[test]
    fn other_fixtures_never_produce_the_spy() {
        let mut spies = 0;
        for seed in 1..=100u32 {
            let mut m = make_world(StoreId::Forever12, MakeOpts { seed, ..Default::default() });
            // fixture 3 is a clothing rack at (3,3)
            m.teleport(3, 4);
            m.tap(&[B]);
            until(&mut m, |m| m.world.search.is_none(), 80);
            if !m.world.guards.is_empty() {
                spies += 1;
            }
        }
        assert_eq!(spies, 0);
    }
}

mod kgb_toys_shelves_and_wind_up_toys {
    use super::*;

    /// Shoot the toy shelf at (col,1) from the tile below it.
    fn shoot_shelf(m: &mut Made, col: i32) {
        m.teleport(col, 2);
        m.world.agent.facing = Dir::Up;
        m.step(&[A]);
        m.idle(20); // longer than the shot cooldown
    }

    #[test]
    fn shooting_a_toy_shelf_releases_3_wind_up_toys_once_per_shelf() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts::default());
        assert_eq!(m.world.toys.len(), 0);
        shoot_shelf(&mut m, 5);
        assert_eq!(m.world.toys.len(), 3);
        assert!(m.world.toy_shelf_released(5, 1));
        assert!(!m.world.toy_shelf_released(2, 1));
        assert!(m.run.drain_sfx().contains(&SfxId::Bounce));
        m.idle(20);
        shoot_shelf(&mut m, 5);
        assert_eq!(m.world.toys.len(), 3);
        shoot_shelf(&mut m, 2);
        assert_eq!(m.world.toys.len(), 6);
    }

    #[test]
    fn only_toy_shelves_release_toys_not_ordinary_shelves_or_walls() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts::default());
        m.teleport(2, 4); // below the shelf at (2,3)
        m.world.agent.facing = Dir::Up;
        m.step(&[A]);
        m.idle(20);
        assert_eq!(m.world.toys.len(), 0);
    }

    #[test]
    fn toys_march_in_different_directions_and_turn_at_walls() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts::default());
        shoot_shelf(&mut m, 5);
        m.teleport(12, 9);
        let mut dirs: Vec<Dir> = Vec::new();
        for t in &m.world.toys {
            if !dirs.contains(&t.dir) {
                dirs.push(t.dir);
            }
        }
        assert!(dirs.len() > 1);
        let start: Vec<(f64, f64)> = m.world.toys.iter().map(|t| (t.x, t.y)).collect();
        m.idle(10);
        for (i, t) in m.world.toys.iter().enumerate() {
            assert!((t.x - start[i].0).hypot(t.y - start[i].1) > 5.0);
        }
        for _ in 0..400 {
            m.step(&[]);
            for t in &m.world.toys {
                let tile = m.world.room.tiles[((t.y / TILE_F).floor() as i32 * 16 + (t.x / TILE_F).floor() as i32) as usize];
                assert!(tile == TileKind::Floor || tile == TileKind::Booth || tile == TileKind::Pedestal);
            }
        }
        assert!(m.world.toys.iter().map(|t| t.turns).sum::<i32>() >= 3);
    }

    #[test]
    fn toys_wind_down_after_a_while() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts::default());
        shoot_shelf(&mut m, 5);
        m.teleport(12, 9);
        m.idle(TOY_LIFE + 5);
        assert_eq!(m.world.toys.len(), 0);
    }

    #[test]
    fn toys_stun_the_guards_they_touch_stunned_guards_cannot_move_or_shoot() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { guards: true, ..Default::default() });
        let spy = m.world.guards.iter().find(|g| g.kind == GuardKind::Spy).unwrap().clone();
        m.world.guards = vec![spy];
        // park the spy in the path of the toy that marches down from the shelf at (5,1)
        {
            let spy = &mut m.world.guards[0];
            spy.x = centre(5);
            spy.y = centre(4);
            spy.col = 5;
            spy.row = 4;
            spy.tx = spy.x;
            spy.ty = spy.y;
            spy.think = 99999;
            spy.armed_at = 99999;
        }
        shoot_shelf(&mut m, 5);
        m.teleport(12, 9);
        until(&mut m, |m| m.world.guards[0].stun > 0, 120);
        assert!(m.world.guards[0].stun > 100);
        let px = m.world.guards[0].x;
        let py = m.world.guards[0].y;
        m.world.guards[0].think = 0;
        m.world.guards[0].armed_at = 0;
        m.idle(60);
        assert_eq!(m.world.guards[0].x, px);
        assert_eq!(m.world.guards[0].y, py);
        assert_eq!(m.world.guards[0].aim, 0);
    }

    #[test]
    fn a_toy_that_reaches_a_trap_sets_it_off_smoke_that_stuns_nearby_guards() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { guards: true, ..Default::default() });
        let trap_idx = 0; // fixture 0 is at (11,1)
        assert_eq!((m.world.room.fixtures[trap_idx].col, m.world.room.fixtures[trap_idx].row), (11, 1));
        set_content(&mut m, trap_idx, FixtureContent::Trap);
        let spy = m.world.guards.iter().find(|g| g.kind == GuardKind::Spy).unwrap().clone();
        m.world.guards = vec![spy];
        {
            let spy = &mut m.world.guards[0];
            spy.x = centre(12);
            spy.y = centre(3);
            spy.col = 12;
            spy.row = 3;
            spy.tx = spy.x;
            spy.ty = spy.y;
            spy.think = 99999;
            assert_eq!(spy.stun, 0);
        }
        shoot_shelf(&mut m, 8); // the toy that heads right runs along row 1 into the trap at (11,1)
        m.teleport(2, 9);
        m.run.drain_sfx();
        until(&mut m, |m| m.world.fixture_opened(&m.run, trap_idx), 200);
        assert!(!m.world.puffs.is_empty());
        assert!(m.run.drain_sfx().contains(&SfxId::Smoke));
        assert!(m.world.guards[0].stun > 100);
        assert_eq!(m.world.agent.stun, 0);
    }
}

mod sam_baddy_listening_booth {
    use super::*;

    #[test]
    fn stepping_on_the_booth_switches_the_music_to_the_bonus_track_until_he_steps_off() {
        let mut m = make_world(StoreId::Sambaddy, MakeOpts::default());
        assert_eq!(m.world.music(), MusicId::StoreSambaddy);
        assert!(!m.world.now_playing());
        m.teleport(9, 3);
        m.hold(40, &[Right]);
        assert!(m.world.on_booth);
        assert_eq!(m.world.music(), MusicId::Booth);
        assert!(m.world.now_playing());
        assert_eq!(UI.now_playing, "NOW PLAYING: SIDE B");
        m.hold(40, &[Left]);
        assert!(!m.world.on_booth);
        assert_eq!(m.world.music(), MusicId::StoreSambaddy);
        assert!(!m.world.now_playing());
    }

    #[test]
    fn the_booth_is_not_solid_it_can_be_walked_over_from_either_side() {
        let mut m = make_world(StoreId::Sambaddy, MakeOpts::default());
        m.teleport(11, 2);
        m.hold(30, &[Down]);
        assert!(m.world.agent.y > 3.0 * TILE_F);
    }
}

mod first_visit_lines {
    use super::*;

    #[test]
    fn on_the_first_entry_the_guards_hold_still_and_say_their_lines_the_second_about_1_s_after_the_first() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { seen: false, guards: true, ..Default::default() });
        assert!(m.world.first_visit);
        assert!(m.run.has_seen_store(StoreId::Kgbtoys));
        assert!(m.world.intro_active());
        let spawn: Vec<(f64, f64)> = m.world.guards.iter().map(|g| (g.x, g.y)).collect();
        let mut when: Vec<(String, i32)> = Vec::new();
        for _ in 0..400 {
            m.step(&[]);
            for b in &m.world.bubbles {
                if !when.iter().any(|(t, _)| *t == b.text) {
                    when.push((b.text.clone(), m.world.frame));
                }
            }
            if m.world.intro_active() {
                let now: Vec<(f64, f64)> = m.world.guards.iter().map(|g| (g.x, g.y)).collect();
                assert_eq!(now, spawn);
            }
        }
        let lines = first_visit(StoreId::Kgbtoys).unwrap();
        let (l1, l2) = (lines[0], lines[1]);
        let at = |t: &str| when.iter().find(|(x, _)| x == t).unwrap().1;
        assert_eq!(at(l1.text), INTRO_START);
        assert_eq!(at(l2.text) - at(l1.text), INTRO_GAP);
        assert_eq!(INTRO_GAP, 60);
        assert!(!m.world.intro_active());
        // ... then they act
        assert!(m.world.guards.iter().enumerate().any(|(i, g)| g.x != spawn[i].0 || g.y != spawn[i].1));
    }

    #[test]
    fn every_store_with_lines_says_them_in_order_over_the_right_speaker() {
        for def in open_stores() {
            let expected = match first_visit(def.id) {
                Some(e) => e,
                None => continue,
            };
            let mut m = make_world(def.id, MakeOpts { seen: false, guards: true, ..Default::default() });
            let home: Vec<(GuardKind, f64)> = m.world.guards.iter().map(|g| (g.kind, g.x)).collect();
            let mut said: Vec<String> = Vec::new();
            let mut speakers: Vec<f64> = Vec::new();
            for _ in 0..300 {
                m.step(&[]);
                for b in &m.world.bubbles {
                    if !said.contains(&b.text) {
                        said.push(b.text.clone());
                        speakers.push(b.x);
                    }
                }
            }
            let want: Vec<String> = expected.iter().map(|l| l.text.to_string()).collect();
            assert_eq!(said, want, "{}", def.id.as_str());
            for (i, l) in expected.iter().enumerate() {
                let kind = if l.who == BubbleWho::Spy { GuardKind::Spy } else { GuardKind::Bot };
                let g = home.iter().find(|o| o.0 == kind);
                assert!(g.is_some(), "{}: a {} to speak", def.id.as_str(), l.who.as_str());
                assert_eq!(speakers[i], g.unwrap().1, "{} line {}", def.id.as_str(), i);
            }
        }
    }

    #[test]
    fn radioshock_the_spy_speaks_first_then_the_security_bot() {
        let mut m = make_world(StoreId::Radioshock, MakeOpts { seen: false, guards: true, ..Default::default() });
        let spy_x = m.world.guards.iter().find(|g| g.kind == GuardKind::Spy).unwrap().x;
        let bot_x = m.world.guards.iter().find(|g| g.kind == GuardKind::Bot).unwrap().x;
        m.idle(INTRO_START + 1);
        assert_eq!(m.world.bubbles.len(), 1);
        assert_eq!(m.world.bubbles[0].x, spy_x);
        m.idle(INTRO_GAP);
        let text = first_visit(StoreId::Radioshock).unwrap()[1].text;
        let bot_bubble = m.world.bubbles.iter().find(|b| b.text == text).unwrap();
        assert_eq!(bot_bubble.x, bot_x);
    }

    #[test]
    fn only_the_first_visit_re_entering_shows_no_lines_and_the_guards_act_straight_away() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { seen: false, guards: true, ..Default::default() });
        m.idle(10);
        let mut again = StoreWorld::new(&mut m.run, StoreId::Kgbtoys, &Rng::new(9), None);
        assert!(!again.first_visit);
        assert!(!again.intro_active());
        let start: Vec<(f64, f64)> = again.guards.iter().map(|g| (g.x, g.y)).collect();
        for _ in 0..40 {
            again.step(&mut m.run, Pad { held: 0, pressed: 0, released: 0 });
        }
        assert_eq!(again.bubbles.len(), 0);
        assert!(again.guards.iter().enumerate().any(|(i, g)| g.x != start[i].0 || g.y != start[i].1));
    }

    #[test]
    fn guards_may_not_shoot_until_the_chatter_is_over_and_the_usual_grace_has_passed() {
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { seen: false, guards: true, ..Default::default() });
        m.teleport(7, 5);
        m.world.guards[0].x = centre(11);
        m.world.guards[0].y = centre(5);
        m.world.guards[0].col = 11;
        m.world.guards[0].row = 5;
        let mut first_aim = -1;
        let mut i = 0;
        while i < 400 && first_aim < 0 {
            m.step(&[]);
            m.world.agent.hurt = 99999;
            if m.world.guards.iter().any(|g| g.aim > 0) {
                first_aim = m.world.frame;
            }
            i += 1;
        }
        assert!(first_aim > INTRO_START + INTRO_GAP + 60);
        assert!(first_aim >= GRACE_FRAMES);
        assert!(AIM_FRAMES > 0);
    }

    #[test]
    fn the_first_visit_state_is_per_game_a_new_run_says_the_lines_again() {
        let a = make_world(StoreId::Hotspy, MakeOpts { seen: false, guards: true, ..Default::default() });
        let b = make_world(StoreId::Hotspy, MakeOpts { seen: false, guards: true, ..Default::default() });
        assert!(a.world.first_visit);
        assert!(b.world.first_visit);
    }
}

mod music {
    use super::*;

    #[test]
    fn every_store_plays_its_own_song() {
        for def in open_stores() {
            assert_eq!(Some(make_world(def.id, MakeOpts::default()).world.music().as_str()), def.song);
        }
    }
}

#[allow(dead_code)]
fn _unused(_: BtnName) {}
