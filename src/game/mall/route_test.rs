//! Port of `game/mall/route.test.ts`.
//!
//! A scripted "bot" that plays the real controls (walk, call, board, drive, glide, get out, escalators, doors)
//! to prove every floor and every store door can be reached, from the roof, with no stranded elevator.
//! The agent is made immortal (spies are not what is being tested here).
//!
//! `walkTo`, `ride` and `escalate` come from `game/bot.rs` (a `BotError` is turned into a panic by `.unwrap()`).

use super::geometry::{fy, opening_state};
use crate::game::bot::{escalate as bot_escalate, ride as bot_ride, walk_to};
use super::testutil::*;
use super::types::*;
use crate::content::layout::{EscalatorDef, ShaftId, ESCALATORS, SHAFTS, WAGON};
use crate::content::stores::{DOOR_W, DOOR_X, STORES};

fn immortal(r: &mut Rig) {
    r.w.player.invuln = 1_000_000_000;
    r.w.next_spy = 1_000_000_000;
}

fn ride(r: &mut Rig, id: ShaftId, to: i32) {
    bot_ride(r, id, to).unwrap()
}

fn escalate(r: &mut Rig, e: EscalatorDef, up: bool) {
    bot_escalate(r, e, up).unwrap()
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
