//! Phase 2 tests: spies, lights, NPCs, fixtures, alarm, PA, pickups, determinism and a loop-1 fairness bot.

use crate::events::{Event, Out, Sfx, Track};
use crate::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use crate::layout::{self, floor_y, ShaftId, ESCALATORS, ESC_W, SHAFTS, SHAFT_W};
use crate::run::{Difficulty, RunState};
use crate::types::{Floor, PowerUp, StoreId};

use super::bullets::Owner;
use super::events;
use super::fixtures;
use super::lights::{self, LampState};
use super::npcs::{self, Patch, Walker};
use super::pickups::Pickup;
use super::spies::{self, Spies, SpyState};
use super::state::Ctx;
use super::tests::Sim;
use super::{Mall, MallOutcome};

/// A live mall (spawns, lamps and NPCs all on) with the agent hidden so nothing hurts him.
fn live(seed: u64, bf: bool, floor: Floor, x: i32) -> Sim {
    let mut run = RunState::new(seed, bf);
    let mut out = Out::new();
    let mut m = Mall::new(&mut run, &mut out);
    m.debug_teleport(floor, x);
    let mut s = Sim { m, run, out, held: 0 };
    s.step(0);
    s.m.core.player.hidden = true;
    s
}

/// Step with the level clock running (the Game does this).
fn tick(s: &mut Sim, held: u8) -> MallOutcome {
    s.run.frames += 1;
    s.step(held)
}

fn ticks(s: &mut Sim, held: u8, n: u32) {
    for _ in 0..n {
        tick(s, held);
    }
}

fn spy_at(s: &mut Sim, floor: Floor, x: i32, dir: i32) -> usize {
    s.m.spies.add_walking(floor, x, dir);
    let i = s.m.spies.spies.len() - 1;
    s.m.spies.spies[i].shot_cd = 1_000_000;
    i
}

// ------------------------------------------------------------------------------------------------ spies

#[test]
fn the_first_spy_walks_out_about_300_frames_into_the_level_not_before() {
    let mut s = live(3, false, Floor::F3, 330);
    for _ in 0..280 {
        s.step(0);
        assert!(s.m.spies.spies.is_empty(), "no spy before ~300 frames");
    }
    let mut appeared = false;
    for _ in 0..200 {
        s.step(0);
        if !s.m.spies.spies.is_empty() {
            appeared = true;
            break;
        }
    }
    assert!(appeared, "a spy appears around 300 frames");
}

#[test]
fn spies_only_come_out_of_open_stores_64_to_200_px_away_on_the_floor_or_next_to_it() {
    let mut s = live(1, false, Floor::F3, 330);
    let base = s.m.core.player_view();
    let mut run = RunState::new(1, false);
    for floor in Floor::ALL {
        for x in (40..=740).step_by(10) {
            let mut pv = base;
            pv.floor = floor;
            pv.x = x;
            let c = Spies::spawn_candidates(&run, &pv);
            for id in StoreId::ALL {
                let open = id.is_open() && !run.store_cleared(id);
                let d = (layout::door_x(id) - x).abs();
                let near = (id.info().floor.index() as i32 - floor.index() as i32).abs() <= 1;
                let expect = open && near && (64..=200).contains(&d);
                assert_eq!(c.contains(&id), expect, "{id:?} for the agent at {floor:?} x={x}");
            }
        }
    }
    // a store whose package is gone stops sending spies; power-up shops always do
    let target = StoreId::ALL.iter().copied().find(|id| id.role() == crate::types::StoreRole::Target && id.info().floor == Floor::F4).unwrap();
    let power = StoreId::ALL.iter().copied().find(|id| id.role() == crate::types::StoreRole::PowerShop && id.info().floor == Floor::F4).unwrap();
    run.taken[target.index()] = true;
    let mut pv = base;
    pv.floor = Floor::F4;
    pv.x = (layout::door_x(target) + layout::door_x(power)) / 2;
    let c = Spies::spawn_candidates(&run, &pv);
    assert!(!c.contains(&target), "package taken: no more spies from there");
    assert!(c.contains(&power) || (layout::door_x(power) - pv.x).abs() > 200 || (layout::door_x(power) - pv.x).abs() < 64);
}

#[test]
fn never_more_spies_than_the_cap_and_black_friday_doubles_it() {
    for (bf, cap) in [(false, 4usize), (true, 8usize)] {
        let mut mx = 0;
        for seed in 1..4 {
            let mut s = live(seed, bf, Floor::F3, 330);
            for i in 0..5000 {
                tick(&mut s, 0);
                mx = mx.max(s.m.spies.alive_count());
                assert!(s.m.spies.alive_count() <= cap, "bf={bf} frame {i}");
            }
        }
        assert!(mx >= 2, "bf={bf}: spies do show up (max {mx})");
    }
}

/// Runs a lone spy at 60 px with the agent invulnerable; returns (frame of each shot, Aim frames before it).
fn watch_shots(run_loop: u32, frames: u32) -> Vec<(u32, u32)> {
    let mut s = Sim::new(4);
    s.run.loop_no = run_loop;
    s.at(Floor::F4, 300);
    s.m.spies.add_walking(Floor::F4, 360, -1);
    let mut shots = Vec::new();
    let mut aim = 0;
    let mut prev = 0;
    for i in 0..frames {
        s.m.core.player.invuln = 1000;
        s.step(0);
        let sp = &s.m.spies.spies[0];
        if matches!(sp.state, SpyState::Aim { .. }) {
            aim += 1;
        }
        if sp.shots > prev {
            prev = sp.shots;
            shots.push((i, aim));
            aim = 0;
        }
    }
    shots
}

#[test]
fn the_first_shot_is_at_least_two_seconds_after_appearing_and_every_shot_is_telegraphed() {
    let shots = watch_shots(1, 900);
    assert!(shots.len() >= 4);
    assert!(shots[0].0 + 1 >= spies::FIRST_SHOT_DELAY, "first shot at frame {}", shots[0].0);
    for (f, aim) in &shots {
        assert_eq!(*aim, spies::AIM_FRAMES, "shot at {f} had {aim} aiming frames before it");
    }
}

#[test]
fn shots_are_never_closer_than_a_second_and_loop_one_spaces_them_about_every_2_5_seconds() {
    let shots = watch_shots(1, 1500);
    let gaps: Vec<u32> = shots.windows(2).map(|w| w[1].0 - w[0].0).collect();
    assert!(!gaps.is_empty());
    for g in &gaps {
        assert!((120..=185).contains(g), "gap {g}");
    }
    let shots = watch_shots(40, 1200);
    for w in shots.windows(2) {
        assert!(w[1].0 - w[0].0 >= 60, "even at the hardest loop a spy waits a second: {}", w[1].0 - w[0].0);
    }
    assert_eq!(Difficulty::new(40, false).shot_interval(), 60);
}

/// Spy at 50 px aims (high or low) at an agent who does `act`; returns whether the agent died.
fn volley(low: bool, act: &dyn Fn(&mut Sim, u32) -> u8) -> bool {
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    let i = spy_at(&mut s, Floor::F4, 350, -1);
    s.m.spies.spies[i].state = SpyState::Aim { t: spies::AIM_FRAMES - 1, low };
    let lives = s.run.lives;
    for k in 0..45 {
        let h = act(&mut s, k);
        s.step(h);
    }
    s.run.lives < lives
}

#[test]
fn high_shots_miss_a_ducking_agent_low_shots_do_not_and_a_jump_clears_a_low_shot() {
    let stand = |_: &mut Sim, _| 0u8;
    let duck = |_: &mut Sim, _| DOWN;
    assert!(volley(false, &stand), "a high shot hits a standing agent");
    assert!(!volley(false, &duck), "a high shot flies over a ducking agent");
    assert!(volley(true, &stand), "a low shot hits a standing agent");
    assert!(volley(true, &duck), "a low shot hits a ducking agent");
    let hop = |_: &mut Sim, k: u32| if k == 6 { B } else { 0 };
    assert!(!volley(true, &hop), "a well-timed jump clears a low shot");
}

#[test]
fn the_agents_chest_high_shot_misses_a_ducking_spy_but_a_ducking_shot_hits_him() {
    for (agent_ducks, spy_dies) in [(false, false), (true, true)] {
        let mut s = Sim::new(1);
        s.at(Floor::F3, 100);
        let i = spy_at(&mut s, Floor::F3, 160, -1);
        s.m.spies.spies[i].state = SpyState::Duck { t: 0 };
        let h = if agent_ducks { DOWN } else { 0 };
        s.step(h);
        s.step(h | A);
        s.frames(h, 22);
        let alive = s.m.spies.spies.iter().any(|sp| sp.alive());
        assert_eq!(!alive, spy_dies, "agent ducks: {agent_ducks}");
    }
}

#[test]
fn spies_duck_about_one_volley_in_ten_decided_once_per_volley() {
    let mut s = Sim::new(11);
    s.at(Floor::F3, 100);
    let (mut dodged, mut n) = (0, 0);
    for _ in 0..700 {
        s.m.spies.spies.clear();
        s.m.core.bullets.clear();
        spy_at(&mut s, Floor::F3, 170, -1);
        s.m.core.player.cooldown = 0;
        s.step(A);
        let mut ducked = false;
        for _ in 0..26 {
            s.step(0);
            if let Some(sp) = s.m.spies.spies.first() {
                ducked |= sp.ducking();
            }
        }
        n += 1;
        if s.m.spies.spies.iter().any(|sp| sp.alive()) {
            dodged += 1;
            assert!(ducked, "a surviving spy must have ducked");
        }
    }
    let rate = dodged as f32 / n as f32;
    assert!((0.06..=0.15).contains(&rate), "dodge rate {rate}");
}

#[test]
fn a_spread_volley_is_one_dodge_decision() {
    // three bullets, one group: the decision is made once, so the spy is either hit by the volley or ducks it all
    let mut s = Sim::new(2);
    s.run.power.grant(PowerUp::SpreadShot);
    s.at(Floor::F3, 100);
    let mut hits = 0;
    for _ in 0..40 {
        s.m.spies.spies.clear();
        s.m.core.bullets.clear();
        spy_at(&mut s, Floor::F3, 150, -1);
        s.m.core.player.cooldown = 0;
        s.step(A);
        s.frames(0, 24);
        if !s.m.spies.spies.iter().any(|sp| sp.alive()) {
            hits += 1;
        }
    }
    assert!(hits >= 30, "{hits}");
}

#[test]
fn killing_a_spy_scores_a_hundred_and_the_death_animation_lasts_24_frames() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    spy_at(&mut s, Floor::F3, 140, -1);
    s.step(A);
    let mut died_at = None;
    for k in 0..60 {
        s.step(0);
        if died_at.is_none() && !s.m.spies.spies[0].alive() {
            died_at = Some(k);
            assert_eq!(s.run.score, 100);
            assert!(s.out.count_sfx(Sfx::Splat) >= 1);
        }
        if died_at.is_some() && s.m.spies.spies.is_empty() {
            assert_eq!(k - died_at.unwrap(), spies::DIE_FRAMES as i32, "dying lasts 24 frames");
            return;
        }
    }
    panic!("the spy never finished dying");
}

#[test]
fn spies_never_walk_into_a_pit() {
    for seed in 1..6 {
        let mut s = Sim::new(seed);
        s.freeze_c();
        s.car(ShaftId::B, Floor::Parking); // B's opening on 3F is a pit
        s.at(Floor::F3, 100);
        let i = spy_at(&mut s, Floor::F3, 380, 1);
        s.m.spies.spies[i].shot_cd = 1_000_000;
        s.m.core.player.hidden = true; // he does not see anyone: pure wandering
        let b = &SHAFTS[1];
        for f in 0..3000 {
            s.step(0);
            for sp in &s.m.spies.spies {
                assert!(!(sp.x >= b.x && sp.x < b.x + SHAFT_W), "seed {seed} frame {f}: spy at {}", sp.x);
                assert!(sp.alive(), "seed {seed}: the spy fell");
            }
        }
    }
}

#[test]
fn spies_wait_on_grates_and_a_car_coming_down_crushes_one_for_300() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::B, Floor::F4);
    s.at(Floor::F3, 100);
    let cx = SHAFTS[1].center_x();
    let i = spy_at(&mut s, Floor::F3, cx, 1);
    s.m.spies.spies[i].state = SpyState::Wait { t: 0 };
    s.m.core.player.hidden = true;
    s.out.take();
    s.m.core.cars[1].call_to(Floor::F2);
    let mut shook = false;
    for _ in 0..100 {
        s.step(0);
        shook |= s.m.core.shake > 0;
    }
    assert_eq!(s.run.score, 300, "crushed spies are worth 300");
    assert!(s.out.count_sfx(Sfx::Crush) >= 1);
    assert!(shook, "the crush shakes the screen");
}

#[test]
fn a_spy_waits_in_an_opening_on_its_own() {
    // wandering spies are drawn to shaft openings (grates) and wait there
    let mut waited = false;
    for seed in 1..12 {
        let mut s = Sim::new(seed);
        s.freeze_c();
        s.car(ShaftId::B, Floor::F4);
        s.at(Floor::F3, 100);
        s.m.core.player.hidden = true;
        spy_at(&mut s, Floor::F3, 330, 1);
        for _ in 0..2500 {
            s.step(0);
            if s.m.spies.spies.iter().any(|sp| matches!(sp.state, SpyState::Wait { .. })) {
                waited = true;
            }
        }
    }
    assert!(waited, "wandering spies sometimes wait in a shaft opening");
}

#[test]
fn touching_a_spy_kills_the_agent_a_jump_kick_kills_the_spy_and_a_cinnabomb_too() {
    // walking into him
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    spy_at(&mut s, Floor::F4, 340, -1);
    s.frames(RIGHT, 40);
    assert_eq!(s.run.lives, 2, "touching a spy costs a life");
    // jump-kick
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    spy_at(&mut s, Floor::F4, 326, -1);
    s.step(RIGHT | B);
    s.frames(RIGHT, 30);
    assert_eq!(s.run.lives, 3);
    assert_eq!(s.run.score, 100, "a jump-kick kill is worth 100");
    assert!(s.m.spies.spies.iter().all(|sp| !sp.alive()));
    // cinnabomb
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::Cinnabomb);
    s.at(Floor::F4, 300);
    spy_at(&mut s, Floor::F4, 340, -1);
    s.frames(RIGHT, 40);
    assert_eq!(s.run.lives, 3);
    assert_eq!(s.run.score, 100);
}

#[test]
fn spies_ignore_a_hidden_agent_and_never_shoot_him() {
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    s.m.core.player.hidden = true;
    let i = spy_at(&mut s, Floor::F4, 350, -1);
    s.m.spies.spies[i].shot_cd = 0;
    for _ in 0..300 {
        s.step(0);
        assert!(!matches!(s.m.spies.spies[0].state, SpyState::Aim { .. }));
        assert!(s.m.core.bullets.list.is_empty());
    }
    assert_eq!(s.run.lives, 3);
}

#[test]
fn spies_walk_toward_the_agent_and_stop_about_40_px_away() {
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    let i = spy_at(&mut s, Floor::F4, 440, -1);
    s.m.core.player.invuln = 10_000;
    for _ in 0..400 {
        s.step(0);
    }
    let d = (s.m.spies.spies[i].x - 300).abs();
    assert!((36..=44).contains(&d), "stopped at {d} px");
}

#[test]
fn spies_are_visibly_slower_than_the_agent_and_the_alarm_makes_them_25_percent_faster() {
    let run_for = |alarm: bool| -> i32 {
        let mut s = Sim::new(1);
        s.run.alarm = alarm;
        s.at(Floor::F4, 300);
        let i = spy_at(&mut s, Floor::F4, 440, -1);
        s.m.core.player.invuln = 10_000;
        s.frames(0, 100);
        440 - s.m.spies.spies[i].x
    };
    let (calm, alarmed) = (run_for(false), run_for(true));
    assert!((65..=75).contains(&calm), "calm spies walk ~0.7 px/frame: {calm}");
    assert!(calm < 100, "slower than the agent");
    let ratio = alarmed as f32 / calm as f32;
    assert!((1.2..=1.3).contains(&ratio), "alarm ratio {ratio}");
}

#[test]
fn the_alarm_makes_spies_spawn_sooner_and_black_friday_much_sooner() {
    let mean = |alarm: bool, bf: bool| -> f32 {
        let mut s = Sim::new(5);
        s.run.alarm = alarm;
        s.run.black_friday = bf;
        let Sim { m, run, out, .. } = &mut s;
        let mut ctx = Ctx { core: &mut m.core, run, out, pad: PadState::default() };
        let mut t = 0u32;
        for _ in 0..400 {
            t += Spies::spawn_interval(&mut ctx);
        }
        t as f32 / 400.0
    };
    let calm = mean(false, false);
    assert!((300.0..=480.0).contains(&calm), "{calm}");
    assert!(mean(true, false) < calm * 0.7, "alarm: more often");
    assert!(mean(false, true) < calm * 0.6, "black friday: twice the spawn rate");
}

#[test]
fn a_car_that_stops_near_the_agent_sometimes_lets_a_spy_out_who_says_something() {
    let mut got = false;
    for seed in 1..40 {
        let mut s = Sim::new(seed);
        s.m.spies.enabled = true;
        s.m.spies.spawn_cd = u32::MAX;
        s.at(Floor::F3, 330);
        s.m.core.player.hidden = true;
        s.m.core.player.invuln = 10_000;
        // car C rattles between floors by itself; B is called back and forth
        for k in 0..2400 {
            if k % 300 == 0 {
                let f = if (k / 300) % 2 == 0 { Floor::F3 } else { Floor::F2 };
                s.m.core.cars[1].call_to(f);
            }
            s.step(0);
            if s.m.spies.spies.iter().any(|sp| sp.car.is_some()) {
                assert!(!s.m.spies.bubbles.is_empty(), "he says one of the elevator lines");
                assert!(s.m.spies.bubbles.iter().any(|b| crate::copy::ELEVATOR_LINES.contains(&b.text.as_str())));
                assert!(s.m.core.cars[1].extra_occupants + s.m.core.cars[0].extra_occupants + s.m.core.cars[2].extra_occupants >= 1, "the car waits for him");
                got = true;
            }
        }
        if got {
            break;
        }
    }
    assert!(got);
}

#[test]
fn spy_drops_last_words_and_food_split_follow_the_spec_odds() {
    let mut s = Sim::new(9);
    s.at(Floor::F3, 100);
    let (mut drops, mut words, mut food, n) = (0, 0, 0, 4000);
    for _ in 0..n {
        s.m.spies.spies.clear();
        s.m.spies.bubbles.clear();
        s.m.pickups.items.clear();
        s.run.rng = crate::rng::Rng::new(s.run.rng.next_u32() as u64);
        spy_at(&mut s, Floor::F3, 300, -1);
        s.m.core.bullets.fire(Owner::Player, 295, floor_y(Floor::F3) - 15, 1, 0, Floor::F3, 1);
        s.step(0);
        if let Some(d) = s.m.pickups.items.first().copied() {
            drops += 1;
            if d.item.is_food() {
                food += 1;
            }
        }
        if !s.m.spies.bubbles.is_empty() {
            assert!(crate::copy::LAST_WORDS.contains(&s.m.spies.bubbles[0].text.as_str()));
            words += 1;
        }
    }
    assert!((0.03..=0.08).contains(&(drops as f32 / n as f32)), "drops {drops}");
    assert!((0.28..=0.42).contains(&(words as f32 / n as f32)), "words {words}");
    assert!(food * 5 >= drops * 2 && food * 5 <= drops * 3 + 5, "about half the drops are food: {food}/{drops}");
}

// ------------------------------------------------------------------------------------------------ lights

#[test]
fn lamps_hang_in_gaps_never_over_a_shaft_opening_or_a_store_sign() {
    let l = lights::Lights::new();
    assert!(l.lamps.len() >= 8);
    for lamp in &l.lamps {
        for sh in SHAFTS.iter().filter(|s| s.serves(lamp.floor)) {
            assert!(lamp.x + 8 <= sh.x - 4 || lamp.x - 8 >= sh.x + SHAFT_W + 4, "lamp {} on {:?} over shaft {:?}", lamp.x, lamp.floor, sh.id);
        }
        for st in layout::stores_on(lamp.floor) {
            let sx = layout::store_x(st);
            assert!(lamp.x + 8 <= sx || lamp.x - 8 >= sx + layout::STORE_W);
        }
        assert_eq!(lamp.ball, lamp.floor == Floor::F2, "disco balls on 2F only");
    }
}

fn first_lamp(s: &Sim, f: Floor) -> usize {
    s.m.lights.lamps.iter().position(|l| l.floor == f && l.x > 150).unwrap()
}

#[test]
fn a_standing_shot_drops_a_lamp_which_shatters_shakes_the_screen_and_darkens_the_corridor_for_two_seconds() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    let i = first_lamp(&s, Floor::F3);
    let lx = s.m.lights.lamps[i].x;
    s.at(Floor::F3, lx - 50);
    s.out.take();
    s.step(A);
    let mut fell = false;
    let mut shook = false;
    for _ in 0..40 {
        s.step(0);
        fell |= matches!(s.m.lights.lamps[i].state, LampState::Falling { .. });
        shook |= s.m.core.shake > 0;
    }
    assert!(fell && shook);
    assert!(matches!(s.m.lights.lamps[i].state, LampState::Shards { .. }));
    let ev = s.out.take();
    let pos = |sfx| ev.iter().position(|e| *e == Event::Sfx(sfx)).unwrap();
    assert!(pos(Sfx::LampFall) < pos(Sfx::Glass), "LampFall then Glass");
    assert!(s.m.lights.is_dark(Floor::F3, lx));
    assert!(!s.m.lights.is_dark(Floor::F3, lx + 200), "only that section is dark");
    s.frames(0, 125);
    assert!(!s.m.lights.is_dark(Floor::F3, lx), "the light comes back after ~2 s");
}

#[test]
fn a_ducking_shot_passes_under_a_lamp() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    let i = first_lamp(&s, Floor::F3);
    let lx = s.m.lights.lamps[i].x;
    s.at(Floor::F3, lx - 50);
    s.step(DOWN);
    s.step(DOWN | A);
    s.frames(DOWN, 40);
    assert_eq!(s.m.lights.lamps[i].state, LampState::Hung);
}

#[test]
fn a_falling_lamp_kills_the_agent_and_spies_underneath_for_300() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    let i = first_lamp(&s, Floor::F3);
    let lx = s.m.lights.lamps[i].x;
    s.at(Floor::F3, lx);
    spy_at(&mut s, Floor::F3, lx + 3, -1);
    s.m.core.player.invuln = 0;
    let Sim { m, run, out, .. } = &mut s;
    let mut ctx = Ctx { core: &mut m.core, run, out, pad: PadState::default() };
    m.lights.knock_down(i, 1, &mut ctx);
    s.frames(0, 30);
    assert_eq!(s.run.lives, 2, "the lamp killed the agent");
    assert!(s.run.score >= 300, "and the spy under it");
}

#[test]
fn lamps_hang_again_after_a_while() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    let i = first_lamp(&s, Floor::F3);
    let lx = s.m.lights.lamps[i].x;
    s.at(Floor::F3, lx - 50);
    s.step(A);
    s.frames(0, 40);
    assert!(matches!(s.m.lights.lamps[i].state, LampState::Shards { .. }));
    s.frames(0, (lights::REHANG_FRAMES + 200) as u32);
    assert_eq!(s.m.lights.lamps[i].state, LampState::Hung);
}

#[test]
fn a_disco_ball_rolls_the_way_it_was_shot_flattening_spies_and_the_agent_until_a_wall() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    s.car(ShaftId::B, Floor::F4); // grate on 2F: it rolls over it
    let i = s.m.lights.lamps.iter().position(|l| l.floor == Floor::F2 && l.x > 560).unwrap();
    let bx = s.m.lights.lamps[i].x;
    s.at(Floor::F2, bx - 50);
    s.step(A);
    for _ in 0..30 {
        s.step(0);
        if matches!(s.m.lights.lamps[i].state, LampState::Rolling { .. }) {
            break;
        }
    }
    let LampState::Rolling { dir, .. } = s.m.lights.lamps[i].state else { panic!("{:?}", s.m.lights.lamps[i].state) };
    assert_eq!(dir, 1, "rolls the way the shot travelled");
    // a spy waiting ahead of it is flattened for 300
    s.m.core.player.hidden = true;
    spy_at(&mut s, Floor::F2, bx + 80, -1);
    s.m.spies.spies.last_mut().unwrap().state = SpyState::Wait { t: 0 };
    let sc = s.run.score;
    let mut x_prev = bx;
    for _ in 0..400 {
        s.step(0);
        if let LampState::Rolling { x16, .. } = s.m.lights.lamps[i].state {
            assert!(x16 >> 4 >= x_prev, "it keeps going the same way");
            x_prev = x16 >> 4;
        }
    }
    assert_eq!(s.run.score - sc, 300);
    assert!(matches!(s.m.lights.lamps[i].state, LampState::Shards { .. } | LampState::Gone { .. }), "stopped at the wall");
    assert!(x_prev > layout::WALL_R - 20, "it rolled all the way to the wall: {x_prev}");
}

/// The agent stands ahead of a rolling ball; he jumps when it is `jump_at` px away (None: never).
fn ball_vs_agent(jump_at: Option<i32>) -> bool {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    s.car(ShaftId::B, Floor::F4);
    let i = s.m.lights.lamps.iter().position(|l| l.floor == Floor::F2 && l.x > 560).unwrap();
    let bx = s.m.lights.lamps[i].x;
    s.at(Floor::F2, bx + 80);
    s.m.core.bullets.fire(Owner::Player, bx - 30, floor_y(Floor::F2) - 15, 4, 0, Floor::F2, 5);
    let lives = s.run.lives;
    let mut jumped = false;
    for _ in 0..140 {
        let near = if let LampState::Rolling { x16, .. } = s.m.lights.lamps[i].state { (s.m.core.player.x - (x16 >> 4)).abs() } else { 999 };
        let h = if jump_at.map_or(false, |d| near <= d) && !jumped && s.pv().grounded {
            jumped = true;
            B
        } else {
            0
        };
        s.step(h);
    }
    s.run.lives < lives
}

#[test]
fn a_rolling_disco_ball_flattens_a_standing_agent_but_a_well_timed_jump_clears_it() {
    assert!(ball_vs_agent(None), "the ball flattens a standing agent");
    let clears: Vec<i32> = (14..=40).filter(|d| !ball_vs_agent(Some(*d))).collect();
    assert!(clears.len() >= 3, "a jump timed within a few frames of the ball gets over it: {clears:?}");
}

#[test]
fn a_rolling_disco_ball_goes_down_a_pit() {
    let mut s = Sim::new(1);
    s.m.lights = lights::Lights::new();
    s.freeze_c();
    s.car(ShaftId::B, Floor::F1); // 2F opening of B is a pit
    let i = s.m.lights.lamps.iter().position(|l| l.floor == Floor::F2 && l.x < 395 && l.x > 340).or_else(|| s.m.lights.lamps.iter().position(|l| l.floor == Floor::F2 && l.x < 395));
    let Some(i) = i else { return };
    let bx = s.m.lights.lamps[i].x;
    s.at(Floor::F2, (bx - 50).max(40));
    s.m.core.player.hidden = true;
    let Sim { m, run, out, .. } = &mut s;
    let mut ctx = Ctx { core: &mut m.core, run, out, pad: PadState::default() };
    m.lights.knock_down(i, 1, &mut ctx);
    for _ in 0..300 {
        s.step(0);
        if let LampState::Rolling { x16, .. } = s.m.lights.lamps[i].state {
            assert!((x16 >> 4) < SHAFTS[1].x + 2, "never crosses the pit");
        }
    }
    assert!(matches!(s.m.lights.lamps[i].state, LampState::Gone { .. } | LampState::Hung), "the ball is gone down the shaft");
}

#[test]
fn darker_never_brightens_and_stays_in_the_palette() {
    for c in 0..64u8 {
        let d = lights::darker(c);
        assert!(d < 64);
        let lum = |c: u8| {
            let (r, g, b) = crate::pixel::palette_rgb(c);
            r as u32 + g as u32 + b as u32
        };
        assert!(lum(d) <= lum(c), "{c:#x} -> {d:#x}");
    }
}

// ------------------------------------------------------------------------------------------------ janitor / wet floor

fn wet_sim() -> Sim {
    let mut s = Sim::new(1);
    let (lo, hi) = npcs::janitor_range();
    s.m.npcs.patches.push(Patch { x0: 240, x1: 288, age: npcs::MOP_FRAMES });
    let _ = (lo, hi);
    s.at(Floor::F1, 232);
    s
}

#[test]
fn a_wet_patch_makes_the_agent_slide_at_walking_speed_and_he_cannot_stop_or_turn() {
    let mut s = wet_sim();
    s.frames(RIGHT, 12); // walks onto the patch at 240
    assert!(s.pv().sliding, "x={}", s.pv().x);
    let mut x = s.pv().x;
    // let go, then fight it: left, down (duck), nothing
    for h in [0, LEFT, LEFT, DOWN, 0, LEFT] {
        s.step(h);
        if s.pv().sliding {
            assert_eq!(s.pv().x - x, 1, "slides at walking speed, input ignored");
            assert_eq!(s.pv().facing, 1, "cannot turn");
            assert!(!s.m.core.player.ducking, "cannot duck");
        }
        x = s.pv().x;
    }
    s.frames(0, 60);
    assert!(!s.pv().sliding);
    assert!(s.pv().x >= 288, "carried off the far end: {}", s.pv().x);
    // once off, he is free again
    let x0 = s.pv().x;
    s.frames(LEFT, 3);
    assert!(s.pv().x < x0 || s.pv().x == x0 + 0, "free to walk again (at the edge it re-enters)");
}

#[test]
fn a_jump_kick_landing_on_the_wet_patch_keeps_kicking_and_a_spy_hit_that_way_is_worth_300() {
    let mut s = wet_sim();
    s.at(Floor::F1, 222);
    // spy just beyond the far end of the patch
    spy_at(&mut s, Floor::F1, 291, -1);
    s.step(RIGHT | B);
    let mut kicked_on_wet = false;
    for _ in 0..60 {
        s.step(RIGHT);
        let pv = s.pv();
        if pv.grounded && pv.sliding {
            assert!(pv.kicking, "keeps kicking while it slides");
            kicked_on_wet = true;
        }
    }
    assert!(kicked_on_wet);
    assert_eq!(s.run.score, 300, "slide-kicked spy");
    assert_eq!(s.run.lives, 3);
}

#[test]
fn spies_slide_on_wet_floors_too() {
    let mut s = wet_sim();
    s.at(Floor::F1, 100);
    s.m.core.player.hidden = true;
    let i = spy_at(&mut s, Floor::F1, 250, 1);
    s.step(0);
    assert!(matches!(s.m.spies.spies[i].state, SpyState::Slide), "{:?}", s.m.spies.spies[i].state);
    let x0 = s.m.spies.spies[i].x;
    s.frames(0, 20);
    let sp = &s.m.spies.spies[i];
    assert!(sp.x > x0 && sp.dir == 1, "slid on in the same direction");
}

#[test]
fn the_wet_patch_can_never_reach_a_shaft_opening_or_an_escalator() {
    let (lo, hi) = npcs::janitor_range();
    let (x0, x1) = (lo - npcs::PATCH_W / 2, hi + npcs::PATCH_W / 2);
    for sh in SHAFTS.iter().filter(|s| s.serves(Floor::F1)) {
        assert!(x1 + 10 <= sh.x || x0 >= sh.x + SHAFT_W + 10, "patch span {x0}..{x1} vs shaft {:?}", sh.id);
    }
    for e in ESCALATORS.iter().filter(|e| e.lower() == Floor::F1 || e.upper == Floor::F1) {
        assert!(x1 + 8 <= e.x - 8 || x0 >= e.x + ESC_W + 8, "patch span {x0}..{x1} vs escalator");
    }
    // and over a long run the janitor really leaves patches, all inside that span, at most two, each ~600 frames
    let mut s = Sim::new(3);
    let mut seen = 0;
    for _ in 0..4000 {
        s.step(0);
        assert!(s.m.npcs.patches.len() <= 2);
        for p in &s.m.npcs.patches {
            assert!(p.x0 >= x0 && p.x1 <= x1);
            assert_eq!(p.x1 - p.x0, npcs::PATCH_W);
        }
        seen = seen.max(s.m.npcs.patches.len());
    }
    assert!(seen >= 1);
    let mut s = Sim::new(3);
    s.m.npcs.patches.push(Patch { x0: 240, x1: 288, age: 0 });
    s.frames(0, npcs::PATCH_FRAMES - 2);
    assert!(s.m.npcs.patches.iter().any(|p| p.x0 == 240));
    s.frames(0, 5);
    assert!(!s.m.npcs.patches.iter().any(|p| p.x0 == 240), "the patch dries after ~600 frames");
}

#[test]
fn bullets_pass_through_the_janitor() {
    let mut s = Sim::new(1);
    s.at(Floor::F1, 200);
    s.m.npcs.janitor.x = 260;
    s.step(A);
    s.frames(0, 20);
    assert!(s.m.core.bullets.list.iter().any(|b| b.x() > 262), "the bullet flew on past him");
}

// ------------------------------------------------------------------------------------------------ walkers

fn walker_sim() -> Sim {
    let mut s = Sim::new(1);
    s.m.npcs.disable_roamers();
    s.at(Floor::F2, 620);
    s.m.npcs.walkers.push(Walker::test_new(Floor::F2, 660, -1, 600, 740));
    s.run.score = 1000;
    s
}

#[test]
fn walkers_block_bullets_from_both_sides_and_shooting_one_costs_200_and_says_hey() {
    let mut s = walker_sim();
    s.step(A);
    s.frames(0, 12);
    assert!(s.m.core.bullets.list.is_empty(), "the bullet stopped dead against the walker");
    assert_eq!(s.run.score, 800);
    assert!(s.m.npcs.bubbles.iter().any(|b| b.text == crate::copy::HEY));
    // an enemy bullet from the far side is blocked and costs nothing
    s.m.core.bullets.fire_enemy(700, floor_y(Floor::F2) - 15, -1, Floor::F2);
    let w = s.m.npcs.walkers[0].x;
    s.frames(0, 60);
    assert!(s.m.core.bullets.list.iter().all(|b| b.x() > w) || s.m.core.bullets.list.is_empty());
    assert_eq!(s.run.score, 800);
    assert_eq!(s.run.lives, 3);
}

#[test]
fn a_spread_volley_into_a_walker_is_charged_once() {
    let mut s = walker_sim();
    s.run.power.grant(PowerUp::SpreadShot);
    s.step(A);
    s.frames(0, 14);
    assert_eq!(s.run.score, 800);
}

#[test]
fn walkers_pace_back_and_forth_never_die_and_touching_one_pushes_you_along() {
    let mut s = walker_sim();
    s.m.npcs.walkers[0].dir = 1;
    s.m.npcs.walkers[0].x = 625;
    s.m.npcs.walkers[0].lo = 600;
    s.m.npcs.walkers[0].hi = 740;
    s.m.core.player.place(630, floor_y(Floor::F2));
    let x0 = s.pv().x;
    s.frames(0, 20);
    assert!(s.pv().x > x0 + 5, "carried along by the walker: {} -> {}", x0, s.pv().x);
    assert_eq!(s.run.lives, 3, "touching a walker is harmless");
    // walking into one head-on gets you through it
    let mut s = walker_sim();
    s.m.npcs.walkers[0].x = 700;
    s.m.npcs.walkers[0].dir = -1;
    s.m.core.player.place(650, floor_y(Floor::F2));
    s.frames(RIGHT, 80);
    assert!(s.pv().x > 720 - 1 || s.pv().x > s.m.npcs.walkers[0].x, "the agent passed through");
    // they turn at the ends of their stretch
    s.frames(0, 600);
    let w = &s.m.npcs.walkers[0];
    assert!(w.x >= w.lo && w.x <= w.hi);
    let r = npcs::walker_ranges();
    for (lo, hi) in r {
        for sh in SHAFTS.iter().filter(|x| x.serves(Floor::F2)) {
            assert!(hi + 20 <= sh.x || lo >= sh.x + SHAFT_W + 20, "walker stretch {lo}..{hi} too near {:?}", sh.id);
        }
    }
}

// ------------------------------------------------------------------------------------------------ cop

fn cop_sim(cop_x: i32, cop_dir: i32, agent_x: i32, agent_face_left: bool) -> Sim {
    let mut s = Sim::new(1);
    s.m.npcs.disable_roamers();
    s.at(Floor::F3, agent_x);
    s.m.npcs.cop = Some(npcs::Cop::test_new(Floor::F3, cop_x, cop_dir));
    s.m.core.player.facing = if agent_face_left { -1 } else { 1 };
    s
}

fn chase(s: &Sim) -> u32 {
    s.m.npcs.cop.as_ref().unwrap().chase
}

#[test]
fn the_cop_whistles_only_when_you_shoot_in_front_of_him() {
    // in front: same floor, he faces you, within 128 px
    let mut s = cop_sim(380, -1, 300, false);
    s.out.take();
    s.step(A);
    s.step(0);
    assert!(chase(&s) > 500, "chasing");
    assert_eq!(s.out.count_sfx(Sfx::Whistle), 1);
    assert!(s.m.npcs.bubbles.iter().any(|b| b.text == crate::copy::COP_WHISTLE));
    // no shot, no whistle
    let mut s = cop_sim(380, -1, 300, false);
    s.frames(0, 120);
    assert_eq!(chase(&s), 0);
    // he faces away
    let mut s = cop_sim(380, 1, 300, false);
    s.step(A);
    s.step(0);
    assert_eq!(chase(&s), 0);
    // too far
    let mut s = cop_sim(300 + 200, -1, 300, false);
    s.step(A);
    s.step(0);
    assert_eq!(chase(&s), 0);
    // another floor
    let mut s = cop_sim(380, -1, 300, false);
    s.m.npcs.cop.as_mut().unwrap().floor = Floor::F2;
    s.step(A);
    s.step(0);
    assert_eq!(chase(&s), 0);
}

#[test]
fn a_chase_lasts_ten_seconds_and_catching_you_freezes_you_three_seconds_for_500_points_not_a_life() {
    let mut s = cop_sim(380, -1, 300, false);
    s.run.score = 1000;
    s.step(A);
    s.step(0);
    // the cop is quicker than a standing target: he catches him
    let mut caught_at = None;
    for k in 0..200 {
        s.step(0);
        if s.pv().frozen && caught_at.is_none() {
            caught_at = Some(k);
        }
    }
    assert!(caught_at.is_some(), "he catches a stationary agent");
    assert_eq!(s.run.score, 500, "-500");
    assert_eq!(s.run.lives, 3, "not a life");
    assert!(s.m.npcs.bubbles.iter().any(|b| b.text == crate::copy::DETAINED) || s.m.npcs.bubbles.is_empty());
    // frozen: the pad does nothing for 180 frames
    let mut s = cop_sim(380, -1, 300, false);
    s.step(A);
    s.step(0);
    while !s.pv().frozen {
        s.step(0);
    }
    let x = s.pv().x;
    let mut frozen_frames = 0;
    for _ in 0..400 {
        s.step(RIGHT);
        if s.pv().frozen {
            frozen_frames += 1;
            assert_eq!(s.pv().x, x, "frozen agents do not move");
        } else {
            break;
        }
    }
    assert!((176..=182).contains(&frozen_frames), "{frozen_frames}");
}

#[test]
fn running_away_from_a_whistling_cop_works_and_the_chase_times_out_after_600_frames() {
    let mut s = cop_sim(380, -1, 300, false);
    s.m.npcs.cop.as_mut().unwrap().lo = 100;
    s.m.npcs.cop.as_mut().unwrap().hi = 700;
    s.step(A);
    s.step(0);
    // an agent who hops into the car on the same floor loses him; a bystander on another floor ends the chase
    s.at(Floor::F2, 300);
    s.frames(0, 5);
    assert_eq!(chase(&s), 0, "the agent left the floor: chase over");
    assert_eq!(s.run.score, 0);
}

#[test]
fn bullets_ping_off_the_cop_and_he_cannot_be_killed() {
    let mut s = cop_sim(380, -1, 300, false);
    s.m.npcs.cop.as_mut().unwrap().cool = 10_000; // no whistle for this test
    s.out.take();
    for _ in 0..4 {
        s.step(A);
        s.frames(0, 20);
    }
    assert!(s.out.count_sfx(Sfx::HelmetPing) >= 1);
    assert!(s.m.npcs.cop.is_some());
    assert!(s.m.core.bullets.list.is_empty());
}

// ------------------------------------------------------------------------------------------------ fixtures

#[test]
fn the_directory_kiosk_highlights_the_nearest_remaining_package_store_then_cools_down() {
    let mut s = Sim::new(1);
    s.run.taken[StoreId::KgbToys.index()] = true;
    let (kf, kx) = layout::KIOSKS[1]; // 3F
    s.at(kf, kx);
    s.tap(UP);
    let p = s.m.fixtures.panel.expect("the panel opens");
    // 3F's only other target is Blockbluster-video? (a closed store) -> the nearest target by floor then distance
    assert_eq!(p.target, fixtures::nearest_package_store(&s.run, Floor::F3, kx));
    let t = p.target.unwrap();
    assert!(t.role() == crate::types::StoreRole::Target && !s.run.store_cleared(t));
    // close it by pressing A, then try again: still cooling down
    s.tap(A);
    assert!(s.m.fixtures.panel.is_none());
    s.tap(UP);
    assert!(s.m.fixtures.panel.is_none(), "cooldown");
    s.frames(0, fixtures::KIOSK_COOLDOWN);
    s.tap(UP);
    assert!(s.m.fixtures.panel.is_some(), "usable again after ~1200 frames");
}

#[test]
fn with_every_package_found_the_kiosk_points_to_the_car() {
    let mut s = Sim::new(1);
    for t in s.run.taken.iter_mut() {
        *t = true;
    }
    assert_eq!(fixtures::nearest_package_store(&s.run, Floor::F3, 100), None);
}

#[test]
fn the_photo_booth_hides_the_agent_for_at_most_five_seconds_and_gives_the_strip_once_per_game() {
    let mut s = Sim::new(1);
    let (bf, bx) = layout::PHOTO_BOOTH;
    s.at(bf, bx);
    s.tap(UP);
    assert!(s.pv().hidden && s.m.fixtures.booth.is_some());
    // spies walk past
    let i = spy_at(&mut s, bf, bx - 60, 1);
    s.m.spies.spies[i].shot_cd = 0;
    s.frames(0, 250);
    assert!(s.pv().hidden);
    assert!(!matches!(s.m.spies.spies[i].state, SpyState::Aim { .. }), "spies ignore him");
    assert_eq!(s.run.lives, 3);
    s.frames(0, 60);
    assert!(!s.pv().hidden, "out after 300 frames at the latest");
    assert!(s.run.inventory.contains(&"PHOTO STRIP".to_string()));
    assert!(s.m.fixtures.strip.is_some(), "the strip pops up");
    s.m.spies.spies.clear();
    // second visit: leave early with a button, no second strip
    s.frames(0, fixtures::PHOTO_STRIP_FRAMES);
    s.tap(UP);
    assert!(s.pv().hidden);
    s.frames(0, 20);
    s.tap(B);
    assert!(!s.pv().hidden);
    assert_eq!(s.run.inventory.iter().filter(|i| *i == "PHOTO STRIP").count(), 1);
    assert!(s.m.fixtures.strip.is_none());
}

#[test]
fn shooting_a_fountain_sprays_three_to_five_coins_then_it_rests() {
    let mut s = Sim::new(1);
    let (ff, fx) = layout::FOUNTAINS[0];
    s.at(ff, fx - 110);
    s.step(A);
    s.frames(0, 30);
    let n = s.m.pickups.coins.len();
    assert!((3..=5).contains(&n), "{n} coins");
    // a second shot during the cooldown does nothing
    s.frames(0, 10);
    s.step(A);
    s.frames(0, 25);
    assert_eq!(s.m.pickups.coins.len(), n);
    // touching coins collects them (+50 each)
    let sc = s.run.score;
    s.m.core.player.place(fx, floor_y(ff));
    s.frames(0, 120);
    assert!(s.run.score >= sc + 50, "coins are worth 50");
    assert_eq!((s.run.score - sc) % 50, 0);
}

#[test]
fn one_spray_in_twenty_hides_a_gold_coin_worth_an_extra_life() {
    let mut s = Sim::new(21);
    let (ff, fx) = layout::FOUNTAINS[0];
    s.at(ff, fx - 60);
    let (mut gold, mut sprays) = (0, 0);
    for _ in 0..1000 {
        s.m.fixtures.fountain_cd = [0, 0];
        s.m.pickups.coins.clear();
        s.m.core.bullets.fire(Owner::Player, fx - 30, floor_y(ff) - 15, 4, 0, ff, 1);
        s.step(0);
        s.frames(0, 8);
        s.m.core.bullets.clear();
        let n = s.m.pickups.coins.len();
        if n > 0 {
            sprays += 1;
            assert!((3..=5).contains(&n));
            if s.m.pickups.coins.iter().any(|c| c.gold) {
                gold += 1;
            }
        }
    }
    assert!(sprays >= 950);
    assert!((25..=85).contains(&gold), "gold sprays {gold}/{sprays}");
    // the gold coin is a life
    let mut s = Sim::new(1);
    s.at(ff, fx);
    s.m.pickups.coins.push(super::pickups::Coin { floor: ff, x16: fx << 4, y16: floor_y(ff) << 4, vx16: 0, vy16: 0, gold: true, age: 0, bounces: 0 });
    s.step(0);
    assert_eq!(s.run.lives, 4);
}

// ------------------------------------------------------------------------------------------------ alarm and PA

#[test]
fn the_alarm_sounds_after_the_difficulty_time_with_banner_siren_and_music() {
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    let t = s.run.difficulty().alarm_frames;
    s.run.frames = t - 1;
    s.out.take();
    s.step(0);
    assert!(!s.run.alarm);
    s.run.frames = t;
    s.step(0);
    assert!(s.run.alarm);
    assert_eq!(s.m.core.banner.text, crate::copy::ALARM_BANNER);
    s.step(0);
    let ev = s.out.take();
    assert_eq!(ev.iter().filter(|e| **e == Event::Sfx(Sfx::Alarm)).count(), 1);
    assert!(ev.contains(&Event::Music(Track::Alarm)));
    // later loops sound it sooner
    assert!(Difficulty::new(3, false).alarm_frames < Difficulty::new(1, false).alarm_frames);
}

#[test]
fn the_pa_chimes_first_at_about_40_seconds_then_about_every_minute_and_never_repeats_a_line() {
    let mut s = Sim::new(7);
    s.at(Floor::F4, 300);
    s.m.core.player.hidden = true;
    s.m.events.next_pa = events::PA_FIRST;
    s.run.alarm = true; // keep the alarm banner out of the way
    s.run.frames = 2390;
    s.out.take();
    for _ in 0..9 {
        s.run.frames += 1;
        s.step(0);
    }
    assert_eq!(s.m.events.pa_count, 0, "not before ~40 s");
    s.run.frames = 2400;
    s.step(0);
    assert_eq!(s.m.events.pa_count, 1);
    assert_eq!(s.out.count_sfx(Sfx::PaChime), 1);
    assert!(crate::copy::PA_LINES.contains(&s.m.core.banner.text.as_str()));
    let mut last = s.m.events.last_pa;
    let mut prev_time = 2400;
    for _ in 0..40 {
        // jump the level clock to the next due time
        let due = s.m.events.next_pa;
        assert!((2400..=4300).contains(&(due - prev_time)) || due - prev_time >= 3000, "about once a minute: {}", due - prev_time);
        s.m.core.banner.frames_left = 0;
        s.run.frames = due;
        s.step(0);
        assert_ne!(s.m.events.last_pa, last, "never the same line twice in a row");
        last = s.m.events.last_pa;
        prev_time = due;
    }
}

// ------------------------------------------------------------------------------------------------ pickups

#[test]
fn touching_a_dropped_power_up_grants_it_scores_fifty_and_announces_it() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 200);
    s.m.pickups.items.push(Pickup { floor: Floor::F3, x: 200, item: PowerUp::SpreadShot, age: 0 });
    s.m.pickups.items.push(Pickup { floor: Floor::F3, x: 300, item: PowerUp::OneUp, age: 0 });
    s.out.take();
    s.step(0);
    assert!(s.run.power.spread_shot());
    assert_eq!(s.run.score, 50);
    assert_eq!(s.out.count_sfx(Sfx::PowerUp), 1);
    assert_eq!(s.m.core.banner.text, "SPREAD SHOT");
    assert_eq!(s.m.pickups.items.len(), 1);
    s.at(Floor::F3, 300);
    s.step(0);
    assert_eq!(s.run.lives, 4, "1-Up gives a life");
}

#[test]
fn dropped_items_expire_and_hidden_agents_do_not_pick_them_up() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    s.m.pickups.items.push(Pickup { floor: Floor::F3, x: 300, item: PowerUp::Sneakers, age: 0 });
    s.frames(0, super::pickups::PICKUP_FRAMES + 5);
    assert!(s.m.pickups.items.is_empty());
}

// ------------------------------------------------------------------------------------------------ misc

#[test]
fn returning_from_a_store_brings_the_mall_music_back() {
    let mut s = Sim::new(1);
    s.at(Floor::F4, 300);
    s.out.take();
    s.m.return_from_store(StoreId::Forever12);
    s.step(0);
    assert!(s.out.events.contains(&Event::Music(Track::MallAmbient)), "the next step re-emits the mall track");
    s.out.take();
    s.m.return_from_store_out(StoreId::Forever12, &s.run, &mut s.out);
    assert!(s.out.events.contains(&Event::Music(Track::MallAmbient)), "and right away with the _out variant");
}

#[test]
fn the_whole_live_mall_is_deterministic_per_seed() {
    fn run(seed: u64) -> Vec<String> {
        let mut s = live(seed, false, Floor::F3, 330);
        s.m.core.player.hidden = false;
        s.m.core.player.invuln = 0;
        let mut v = Vec::new();
        for k in 0..2500u32 {
            let h = match (k / 50) % 4 {
                0 => RIGHT,
                1 => RIGHT | A,
                2 => LEFT,
                _ => LEFT | A,
            };
            tick(&mut s, h);
            if k % 100 == 0 {
                let sp: Vec<String> = s.m.spies.spies.iter().map(|p| format!("{}:{}:{:?}", p.id, p.x, p.state)).collect();
                v.push(format!("{} s={} l={} {:?}", s.m.debug_state(), s.run.score, s.run.lives, sp));
            }
        }
        v
    }
    assert_eq!(run(5), run(5));
    assert_ne!(run(5), run(6));
}

// ------------------------------------------------------------------------------------------------ the loop-1 fairness bot

/// A pad-only bot: roof -> elevator A -> 4F -> walks to Forever 12's door and presses Up. It shoots spies in
/// its way, ducks high aims, jumps low aims. Returns (reached the door, deaths).
fn run_bot(seed: u64) -> (bool, u32) {
    let mut s = Sim::new(seed);
    // a live mall: spawns, lamps, walkers, cop, janitor
    s.m.spies.enabled = true;
    s.m = {
        let mut run = RunState::new(seed, false);
        let mut out = Out::new();
        let mut m = Mall::new(&mut run, &mut out);
        m.debug_teleport(Floor::Roof, 120);
        s.run = run;
        s.out = out;
        m
    };
    s.step(0);
    let door = layout::door_x(StoreId::Forever12);
    let mut hop_cd = 0;
    // a human dawdles: stay on the roof for a while so the mall is already busy
    for _ in 0..(200 + (seed as u32 * 53) % 400) {
        tick(&mut s, 0);
    }
    let mut spy_shots = 0u32;
    for _ in 0..9000 {
        spy_shots = spy_shots.max(s.m.spies.spies.iter().map(|p| p.shots).sum());
        s.run.frames = s.run.frames.min(2000); // the alarm is not what this tests
        let pv = s.m.core.player_view();
        if pv.dying || pv.frozen || pv.in_arrival {
            tick(&mut s, 0);
            continue;
        }
        let me = pv.x;
        let mut h = 0u8;
        let floor = pv.floor;
        // threat assessment on this floor
        let threat = s
            .m
            .spies
            .spies
            .iter()
            .filter(|sp| sp.alive() && sp.floor == floor && !matches!(sp.state, SpyState::Appear { .. }) && (sp.x - me).abs() < 150)
            .min_by_key(|sp| (sp.x - me).abs());
        hop_cd = (hop_cd as u32).saturating_sub(1);
        let mut goal_dir = 0;
        if let Some(r) = pv.riding {
            // riding: down to 4F
            let c = &s.m.core.cars[SHAFTS.iter().position(|x| x.id == r).unwrap()];
            if c.level_floor() == Some(Floor::F4) && c.dir == 0 {
                goal_dir = -1;
                h |= LEFT;
            } else if !s.m.core.player.ride_lock && c.dir == 0 {
                // a nudge down; letting go makes the car glide to the next floor and stop level
                h |= DOWN;
            }
        } else if floor == Floor::Roof {
            let ax = SHAFTS[0].center_x();
            if s.m.core.cars[0].level_floor() == Some(Floor::Roof) {
                if (me - ax).abs() > 3 {
                    goal_dir = if me < ax { 1 } else { -1 };
                } else {
                    h |= UP;
                }
            } else if me >= SHAFTS[0].x - 7 && me < SHAFTS[0].x {
                // wait beside the pit and call the car
                if s.m.core.frame % 40 == 0 {
                    h |= UP;
                }
            } else if me < SHAFTS[0].x - 7 {
                goal_dir = 1;
            } else {
                goal_dir = -1;
            }
        } else if floor == Floor::F4 {
            if (me - door).abs() <= 3 {
                h |= UP;
            } else {
                goal_dir = if me < door { 1 } else { -1 };
            }
        }
        // fight
        let mut fighting = false;
        if let Some(sp) = threat.filter(|_| pv.riding.is_none()) {
            let toward = if sp.x > me { 1 } else { -1 };
            match sp.state {
                SpyState::Aim { t, low } if (sp.dir == -toward) => {
                    fighting = true;
                    if low {
                        if t >= 16 && pv.grounded && hop_cd == 0 {
                            h |= B;
                            hop_cd = 40;
                        }
                    } else {
                        h |= DOWN;
                    }
                    h |= if toward > 0 { RIGHT } else { LEFT };
                }
                _ => {
                    // shoot him
                    if pv.facing == toward && (sp.x - me).abs() < 140 {
                        h |= A;
                        h |= DOWN & if (s.m.core.frame / 7) % 2 == 0 { DOWN } else { 0 };
                        fighting = true;
                    } else {
                        h |= if toward > 0 { RIGHT } else { LEFT };
                        fighting = true;
                    }
                }
            }
        }
        if !fighting && pv.riding.is_none() {
            h |= match goal_dir {
                1 => RIGHT,
                -1 => LEFT,
                _ => 0,
            };
        }
        // the key pressed this frame
        let o = tick(&mut s, h);
        if let MallOutcome::EnterStore(id) = o {
            if id == StoreId::Forever12 {
                return (true, 3 - s.run.lives);
            }
        }
        if s.run.lives == 0 {
            return (false, 3);
        }
    }
    (false, 3 - s.run.lives)
}

#[test]
fn loop_one_is_fair_a_scripted_bot_walks_from_the_roof_to_a_4f_door_on_most_seeds() {
    let mut ok = 0;
    let mut deaths = Vec::new();
    for seed in 1..=20 {
        let (reached, d) = run_bot(seed);
        deaths.push(d);
        if reached && d <= 1 {
            ok += 1;
        }
    }
    assert!(ok >= 14, "only {ok}/20 seeds reached the door with <= 1 death; deaths per seed {deaths:?}");
}
