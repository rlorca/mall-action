//! Port of `game/mall/route.test.ts`.
//!
//! A scripted "bot" that plays the real controls (walk, call, board, drive, glide, get out, escalators, doors)
//! to prove every floor and every store door can be reached, from the roof, with no stranded elevator.
//! The agent is made immortal (spies are not what is being tested here).
//!
//! The TS test imports `walkTo`, `ride` and `escalate` from `game/bot.ts`. `bot.rs` is ported later by the lead, so
//! the three mall helpers are ported here as private functions (identical logic, `must` -> `panic!`); once `bot.rs`
//! exists these can be swapped for its versions.
// TODO(bot): replace the private walk_to / ride / escalate below by crate::game::bot's once it exists.

use super::geometry::{fy, opening_state};
use super::testutil::*;
use super::types::*;
use crate::content::layout::{EscalatorDef, ShaftId, ESCALATORS, SHAFTS, WAGON};
use crate::content::stores::{DOOR_W, DOOR_X, STORES};

fn immortal(r: &mut Rig) {
    r.w.player.invuln = 1_000_000_000;
    r.w.next_spy = 1_000_000_000;
}

fn must(cond: bool, msg: &str) {
    if !cond {
        panic!("BotError: {}", msg);
    }
}

fn near_open_pit(r: &Rig, x: f64, floor: i32, margin: f64) -> bool {
    for sh in SHAFTS.iter() {
        if floor < sh.top || floor > sh.bottom {
            continue;
        }
        if x > sh.x - margin && x < sh.x + sh.w + margin && opening_state(r.w.car(sh.id), floor) == OpeningState::Pit {
            return true;
        }
    }
    false
}

/// Walk like a player: jump-kick over any open pit that is in the way, and over a mall walker that blocks the corridor.
fn walk_to(r: &mut Rig, x: f64) {
    walk_to_max(r, x, 3500)
}

fn walk_to_max(r: &mut Rig, x: f64, max: i32) {
    let mut stall = 0;
    let mut last_x = r.w.player.x;
    for _ in 0..max {
        let dx = x - r.w.player.x;
        if dx.abs() <= 0.6 {
            break;
        }
        let dir: i32 = if dx > 0.0 { 1 } else { -1 };
        let btn = if dir > 0 { RIGHT } else { LEFT };
        if r.w.player.mode == PlayerMode::Ground && r.w.player.floor.is_some() {
            let floor = r.w.player.floor.unwrap();
            for sh in SHAFTS.iter() {
                if floor < sh.top || floor > sh.bottom {
                    continue;
                }
                if opening_state(r.w.car(sh.id), floor) != OpeningState::Pit {
                    continue;
                }
                let edge = if dir > 0 { sh.x + 4.0 } else { sh.x + sh.w - 4.0 };
                let gap = (edge - r.w.player.x) * dir as f64;
                let beyond = if dir > 0 { x > sh.x + sh.w } else { x < sh.x };
                if beyond && gap >= 0.0 && gap <= 7.0 {
                    r.hold(btn | B, 1);
                    let mut k = 0;
                    while k < 60 && r.w.player.mode == PlayerMode::Air {
                        r.hold(btn, 1);
                        k += 1;
                    }
                }
            }
            // Not getting anywhere (a mall walker is shoving us back): a jump-kick carries us past his centre.
            stall = if (r.w.player.x - last_x) * dir as f64 > 0.2 { 0 } else { stall + 1 };
            last_x = r.w.player.x;
            if stall >= 12 && !near_open_pit(r, r.w.player.x, r.w.player.floor.unwrap_or(floor), 40.0) {
                r.hold(btn | B, 1);
                let mut k = 0;
                while k < 60 && r.w.player.mode == PlayerMode::Air {
                    r.hold(btn, 1);
                    k += 1;
                }
                stall = 0;
            }
        }
        r.hold(btn, 1);
    }
    r.hold(0, 1);
}

/// Ride shaft `id` from the current floor to floor `to` and step out.
fn ride(r: &mut Rig, id: ShaftId, to: i32) {
    let s = *SHAFTS.iter().find(|k| k.id == id).unwrap();
    let from = r.w.player.floor;
    must(from.is_some(), "ride: not standing on a floor");
    let from = from.unwrap();
    // like a player: stand beside the opening and wait (standing still calls the car)
    let side = if r.w.player.x < s.x { s.x - 6.0 } else { s.x + s.w + 6.0 };
    walk_to(r, side);
    let mut i = 0;
    while i < 1800 && opening_state(r.w.car(id), from) != OpeningState::Here {
        r.hold(0, 1);
        i += 1;
    }
    must(opening_state(r.w.car(id), from) == OpeningState::Here, &format!("{}: the car never came to floor {}", id.as_str(), from));
    walk_to(r, s.x + s.w / 2.0);
    r.tap(if to > from { DOWN } else { UP });
    must(r.w.player.mode == PlayerMode::Ride, &format!("{}: could not board", id.as_str()));
    let target = fy(to);
    let dir = if to > from { DOWN } else { UP };
    for _ in 0..1500 {
        let car = r.w.car(id);
        if (car.y - target).abs() < 24.0 && car.dir != 0 {
            break;
        }
        r.hold(dir, 1);
    }
    r.hold(0, 90);
    must(r.w.car(id).y == target && r.w.car(id).dir == 0, &format!("{}: did not stop level with floor {}", id.as_str(), to));
    r.hold(RIGHT, 30);
    must(r.w.player.mode == PlayerMode::Ground && r.w.player.floor == Some(to), &format!("{}: could not step out at {}", id.as_str(), to));
}

fn escalate(r: &mut Rig, e: EscalatorDef, up: bool) {
    walk_to(r, if up { e.x_low } else { e.x_high });
    r.tap(if up { UP } else { DOWN });
    must(r.w.player.mode == PlayerMode::Escalator, &format!("{}: could not board", e.id.as_str()));
    r.hold(0, 60);
    must(r.w.player.floor == Some(if up { e.upper } else { e.lower }), &format!("{}: did not arrive", e.id.as_str()));
}

#[test]
fn r_to_4f_via_a_4f_to_p_via_b_p_to_1f_via_b_1f_to_2f_via_the_escalator_2f_to_3f_via_a_3f_to_4f_via_the_escalator() {
    let mut r = make_rig(RigOpts::new().seed(5));
    immortal(&mut r);
    place(&mut r, 0, 100.0);
    ride(&mut r, ShaftId::A, 1); // R -> 4F
    walk_to(&mut r, 380.0);
    ride(&mut r, ShaftId::B, 5); // 4F -> P
    assert_eq!(r.w.player.floor, Some(5));
    ride(&mut r, ShaftId::B, 4); // P -> 1F
    escalate(&mut r, ESCALATORS[1], true); // 1F -> 2F
    assert_eq!(r.w.player.floor, Some(3));
    walk_to(&mut r, 190.0);
    ride(&mut r, ShaftId::A, 2); // 2F -> 3F
    walk_to(&mut r, ESCALATORS[0].x_low);
    escalate(&mut r, ESCALATORS[0], true); // 3F -> 4F
    assert_eq!(r.w.player.floor, Some(1));
}

#[test]
fn the_automatic_car_c_also_works_as_an_elevator_whatever_floor_it_wandered_to() {
    for seed in [1u32, 2, 3, 4] {
        let mut r = make_rig(RigOpts::new().seed(seed));
        immortal(&mut r);
        r.hold(0, seed as i32 * 97); // let it wander
        place(&mut r, 0, 560.0);
        ride(&mut r, ShaftId::C, 4); // R -> 1F
        ride(&mut r, ShaftId::C, 0); // 1F -> R
    }
}

#[test]
fn the_elevator_is_never_stranded_from_every_floor_served_a_car_can_be_called_and_ridden() {
    for sh in SHAFTS.iter() {
        for from in sh.top..=sh.bottom {
            let mut r = make_rig(RigOpts::new().seed((sh.bottom * 10 + from) as u32));
            immortal(&mut r);
            {
                let c = r.w.car_mut(sh.id);
                c.y = fy(sh.bottom); // park it as far away as possible
                c.prev_y = c.y;
            }
            place(&mut r, from, sh.x - 6.0);
            // stand beside the opening; the car is a pit or far above: call by standing still
            let mut i = 0;
            while i < 2000 && opening_state(r.w.car(sh.id), from) != OpeningState::Here {
                r.hold(0, 1);
                i += 1;
            }
            assert_eq!(opening_state(r.w.car(sh.id), from), OpeningState::Here, "{} from {}", sh.id.as_str(), from);
        }
    }
}

#[test]
fn every_open_store_door_on_every_shopping_floor_can_be_walked_to_and_entered() {
    let mut r = make_rig(RigOpts::new());
    immortal(&mut r);
    for st in STORES.iter() {
        if st.role == crate::content::stores::StoreRole::Closed {
            continue;
        }
        let cx = st.x + DOOR_X + DOOR_W / 2.0;
        place(&mut r, st.floor, cx - 40.0);
        walk_to(&mut r, cx);
        r.tap(UP);
        assert_eq!(r.w.enter_store, Some(st.id), "{}", st.id.as_str());
        r.w.enter_store = None;
    }
}

#[test]
fn p_the_getaway_car_is_reachable_by_walking_from_shaft_b() {
    let mut r = make_rig(RigOpts::new());
    immortal(&mut r);
    place(&mut r, 5, 392.0 - 8.0);
    walk_to(&mut r, WAGON.x + 40.0);
    assert!((r.w.player.x - (WAGON.x + 40.0)).abs() < 2.0);
}
