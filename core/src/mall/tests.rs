//! Mall rules tests: physics, elevators, escalators, exit, death, arrival, determinism and a pad-only bot.

use crate::events::{Event, Out, Sfx, Track};
use crate::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use crate::layout::{self, floor_y, ShaftId, ESCALATORS, ESC_W, SHAFTS};
use crate::run::RunState;
use crate::types::{Floor, PowerUp, StoreId, PACKAGES_TOTAL};

use super::elevator::{AUTO_WAIT, DOOR_OPEN};
use super::player::Mode;
use super::state::{DeathCause, DEATH_FRAMES};
use super::world::{self, Opening, CAR_H};
use super::{Ctx, Mall, MallOutcome};

pub struct Sim {
    pub m: Mall,
    pub run: RunState,
    pub out: Out,
    pub held: u8,
}

impl Sim {
    /// A mall with the arrival skipped, the agent standing on the roof.
    pub fn new(seed: u64) -> Sim {
        let mut run = RunState::new(seed, false);
        let mut out = Out::new();
        let mut m = Mall::new(&mut run, &mut out);
        m.debug_teleport(Floor::Roof, 120);
        let mut s = Sim { m, run, out, held: 0 };
        s.step(0);
        s
    }

    pub fn step(&mut self, held: u8) -> MallOutcome {
        let pad = PadState::from_held(self.held, held);
        self.held = held;
        self.m.step(pad, &mut self.run, &mut self.out)
    }

    pub fn frames(&mut self, held: u8, n: u32) -> MallOutcome {
        let mut last = MallOutcome::None;
        for _ in 0..n {
            let o = self.step(held);
            if o != MallOutcome::None {
                last = o;
            }
        }
        last
    }

    /// Press for one frame then release for one frame.
    pub fn tap(&mut self, b: u8) -> MallOutcome {
        let o = self.step(b);
        let o2 = self.step(0);
        if o != MallOutcome::None {
            o
        } else {
            o2
        }
    }

    pub fn at(&mut self, floor: Floor, x: i32) {
        self.m.debug_teleport(floor, x);
        self.step(0);
    }

    /// Put the agent at exactly (x, floor) without the safety nudge.
    pub fn place(&mut self, floor: Floor, x: i32) {
        self.m.core.player.place(x, floor_y(floor));
        self.m.core.last_safe = (x, floor_y(floor));
    }

    pub fn car(&mut self, id: ShaftId, at: Floor) {
        let i = SHAFTS.iter().position(|s| s.id == id).unwrap();
        self.m.core.cars[i].y = floor_y(at);
        self.m.core.cars[i].dir = 0;
        self.m.core.cars[i].door = DOOR_OPEN;
        self.m.core.cars[i].target = None;
        self.m.core.cars[i].call = false;
    }

    /// Stop the automatic car from wandering during a test.
    pub fn freeze_c(&mut self) {
        self.m.core.cars[2].extra_occupants = 1;
    }

    pub fn pv(&self) -> super::PlayerView {
        self.m.core.player_view()
    }
    pub fn dings(&self) -> usize {
        self.out.count_sfx(Sfx::Ding)
    }
    pub fn alive(&self) -> bool {
        !self.m.core.player.is_dying()
    }
}

fn ci(id: ShaftId) -> usize {
    SHAFTS.iter().position(|s| s.id == id).unwrap()
}

// ------------------------------------------------------------------------------------------ physics

#[test]
fn walking_is_one_pixel_per_frame_and_faces_the_direction() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    let x0 = s.pv().x;
    s.frames(RIGHT, 30);
    assert_eq!(s.pv().x - x0, 30);
    assert_eq!(s.pv().facing, 1);
    s.frames(LEFT, 10);
    assert_eq!(s.pv().x - x0, 20);
    assert_eq!(s.pv().facing, -1);
}

#[test]
fn sneakers_walk_one_and_a_half_times_faster() {
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::Sneakers);
    s.at(Floor::F3, 100);
    let x0 = s.pv().x;
    s.frames(RIGHT, 60);
    assert_eq!(s.pv().x - x0, 90);
}

fn jump_apex(s: &mut Sim, held_at_takeoff: u8) -> (i32, u32) {
    let fy = s.pv().y;
    let mut apex = 0;
    let mut air = 0;
    s.step(held_at_takeoff | B);
    for _ in 0..80 {
        let h = fy - s.pv().y;
        apex = apex.max(h);
        if s.pv().grounded {
            break;
        }
        air += 1;
        s.step(held_at_takeoff);
    }
    (apex, air)
}

#[test]
fn jump_arc_is_about_twenty_pixels_and_lands_on_the_floor() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    let fy = floor_y(Floor::F3);
    let (apex, air) = jump_apex(&mut s, 0);
    assert!((19..=21).contains(&apex), "apex {apex}");
    assert!((16..=30).contains(&air), "airtime {air}");
    s.frames(0, 5);
    assert!(s.pv().grounded);
    assert_eq!(s.pv().y, fy);
    assert!(s.out.count_sfx(Sfx::Jump) == 1 && s.out.count_sfx(Sfx::Land) == 1);
}

#[test]
fn sneakers_jump_higher() {
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::Sneakers);
    s.at(Floor::F3, 100);
    let (apex, _) = jump_apex(&mut s, 0);
    assert!((28..=33).contains(&apex), "apex {apex}");
}

#[test]
fn jumping_while_moving_is_a_jump_kick_and_carries_momentum() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    s.step(RIGHT | B);
    assert!(s.pv().kicking && s.pv().jumping);
    let x0 = s.pv().x;
    s.frames(0, 6); // no input in the air: momentum keeps him moving
    assert!(s.pv().x > x0 + 4);
    assert!(s.pv().kicking);
    s.frames(0, 40);
    assert!(s.pv().grounded && !s.pv().kicking);
    // standing jump: no kick
    s.step(B);
    assert!(s.pv().jumping && !s.pv().kicking);
}

#[test]
fn ducking_has_a_smaller_hitbox_and_stops_walking() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    let stand = s.pv().hitbox;
    s.step(DOWN);
    let duck = s.pv().hitbox;
    assert!(s.pv().ducking && duck.h < stand.h);
    let x0 = s.pv().x;
    s.frames(DOWN | RIGHT, 10);
    assert_eq!(s.pv().x, x0);
}

#[test]
fn shots_fly_four_px_per_frame_at_chest_height_and_low_when_ducking() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 1);
    let b0 = s.m.core.bullets.list[0];
    assert_eq!(b0.y(), floor_y(Floor::F3) - world::CHEST_DY);
    s.step(0);
    assert_eq!(s.m.core.bullets.list[0].x() - b0.x(), 4, "4 px per frame");
    s.frames(0, 10);
    s.m.core.bullets.clear();
    s.step(DOWN);
    s.step(DOWN | A);
    let low = s.m.core.bullets.list[0];
    assert_eq!(low.y(), floor_y(Floor::F3) - world::LOW_DY);
    assert!(s.out.count_sfx(Sfx::Shot) == 2);
}

#[test]
fn at_most_two_bullets_and_a_cooldown_between_shots() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, 100);
    s.step(A);
    s.step(0);
    s.step(A); // inside the 6 frame cooldown
    assert_eq!(s.m.core.bullets.list.len(), 1, "cooldown blocks the second shot");
    s.frames(0, 6);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 2);
    s.frames(0, 6);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 2, "never more than two on screen");
}

#[test]
fn rapid_fire_allows_four_and_spread_fires_three_as_one_shot() {
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::RapidFire);
    s.at(Floor::F3, 100);
    for _ in 0..30 {
        s.step(A);
    }
    assert_eq!(s.m.core.bullets.list.len(), 4);

    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::SpreadShot);
    s.at(Floor::F3, 100);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 3);
    let ys: Vec<i32> = s.m.core.bullets.list.iter().map(|b| b.vy16).collect();
    assert!(ys.contains(&0) && ys.iter().any(|v| *v < 0) && ys.iter().any(|v| *v > 0));
    s.frames(0, 6);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 6, "two spread volleys alive at once");
    s.frames(0, 6);
    s.tap(A);
    assert_eq!(s.m.core.bullets.list.len(), 6);
}

// ------------------------------------------------------------------------------------------ falls

#[test]
fn falling_one_floor_onto_the_car_roof_is_safe() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F2); // one floor below 3F
    let cx = SHAFTS[0].center_x();
    s.place(Floor::F3, cx);
    assert_eq!(s.m.core.opening(ShaftId::A, Floor::F3), Some(Opening::PitBelow));
    s.frames(0, 40);
    assert!(s.alive());
    assert!(s.pv().on_roof);
    assert_eq!(s.pv().y, floor_y(Floor::F2) - CAR_H);
    assert_eq!(s.run.lives, 3);
    assert!(s.out.count_sfx(Sfx::Thud) >= 1);
}

#[test]
fn falling_two_floors_is_fatal() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F2); // two floors below 4F
    let cx = SHAFTS[0].center_x();
    s.place(Floor::F4, cx);
    s.frames(0, 40);
    assert!(s.pv().dying, "a two floor fall must kill");
    assert_eq!(s.run.lives, 2);
    assert_eq!(s.out.count_sfx(Sfx::Death), 1);
    assert_eq!(s.out.count_sfx(Sfx::Fall), 1);
}

#[test]
fn walking_into_a_pit_makes_you_fall_and_a_grate_holds_you() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::Roof);
    s.place(Floor::F4, SHAFTS[0].x - 6);
    // car above: grate, walk across without falling
    assert_eq!(s.m.core.opening(ShaftId::A, Floor::F4), Some(Opening::GrateAbove));
    s.frames(RIGHT, 40);
    assert!(s.pv().grounded && s.pv().y == floor_y(Floor::F4));
    assert!(s.alive());
}

#[test]
fn invincible_players_survive_a_fatal_fall() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.run.power.grant(PowerUp::Cinnabomb);
    s.car(ShaftId::A, Floor::F2);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.frames(0, 40);
    assert!(s.alive() && s.pv().grounded);
    assert_eq!(s.run.lives, 3);
}

// ------------------------------------------------------------------------------------------ elevators

fn board(s: &mut Sim, id: ShaftId, floor: Floor) {
    s.freeze_c();
    let i = ci(id);
    s.car(id, floor);
    s.place(floor, SHAFTS[i].center_x());
    s.step(0);
    s.tap(UP);
    assert_eq!(s.pv().riding, Some(id), "boarding failed");
}

#[test]
fn boarding_a_car_and_riding_with_hum_and_muzak() {
    let mut s = Sim::new(1);
    board(&mut s, ShaftId::B, Floor::F4);
    assert!(s.m.riding_elevator());
    assert!(s.out.events.contains(&Event::Hum(true)));
    assert!(s.out.events.contains(&Event::Music(Track::Elevator)));
    s.out.take();
    s.frames(0, 20);
    // leaving: Left gets you out
    s.step(LEFT);
    assert!(!s.m.riding_elevator());
    assert!(s.out.events.contains(&Event::Hum(false)));
    assert!(s.out.events.contains(&Event::Music(Track::MallAmbient)));
    s.out.take();
    s.frames(0, 10);
    assert!(s.out.events.is_empty(), "music/hum only on change: {:?}", s.out.events);
}

#[test]
fn elevator_drives_one_pixel_per_frame_glides_and_stops_level_with_one_ding() {
    let mut s = Sim::new(1);
    board(&mut s, ShaftId::B, Floor::F4);
    s.frames(0, 5);
    s.out.take();
    // hold Down for a while (doors close first, then 1 px/frame)
    s.frames(DOWN, 20);
    let y0 = s.m.core.cars[1].y;
    s.step(DOWN);
    assert_eq!(s.m.core.cars[1].y - y0, 1);
    assert_eq!(s.pv().y, s.m.core.cars[1].y, "the rider moves with the car");
    s.frames(0, 120);
    assert_eq!(s.m.core.cars[1].y, floor_y(Floor::F3));
    assert_eq!(s.m.core.cars[1].stops, 1);
    assert_eq!(s.dings(), 1);
    assert_eq!(s.m.core.banner.text, crate::copy::floor_announcement(Floor::F3));
    assert!(s.m.core.banner.active());
}

#[test]
fn holding_down_at_the_bottom_dings_exactly_once() {
    let mut s = Sim::new(1);
    board(&mut s, ShaftId::B, Floor::F4);
    s.frames(0, 3);
    s.out.take();
    s.frames(DOWN, 600);
    assert_eq!(s.m.core.cars[1].y, floor_y(Floor::Parking));
    assert_eq!(s.m.core.cars[1].stops, 1);
    assert_eq!(s.dings(), 1);
    assert_eq!(s.hud_floor(), Floor::Parking);
}

impl Sim {
    fn hud_floor(&self) -> Floor {
        self.m.hud_floor()
    }
}

#[test]
fn a_car_descending_onto_a_grate_crushes_the_player() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::Roof);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.step(0);
    assert!(s.alive());
    // an automatic (not called) trip down through 4F
    s.m.core.cars[0].target = Some(Floor::F3);
    s.m.core.cars[0].call = false;
    s.frames(0, 80);
    assert!(s.pv().dying, "crushed by the descending car");
    assert_eq!(s.run.lives, 2);
    assert!(s.out.count_sfx(Sfx::Crush) >= 1);
    assert!(s.m.core.shake > 0 || s.out.count_sfx(Sfx::Death) == 1);
}

#[test]
fn a_car_rising_into_the_top_crushes_someone_on_the_roof() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F3);
    // fall onto the roof of A from 4F? the car is one floor below F4's pit? A is at F3: roof 10 px under 4F.
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.frames(0, 30);
    assert!(s.pv().on_roof && s.alive(), "{:?}", s.pv());
    s.m.core.cars[0].target = Some(Floor::Roof);
    s.m.core.cars[0].call = false;
    let mut died = false;
    for _ in 0..120 {
        s.step(0);
        died |= s.pv().dying;
    }
    assert!(died, "someone on the roof is crushed against the top of the shaft");
    assert_eq!(s.run.lives, 2);
}

#[test]
fn riding_the_roof_down_is_fine() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F3);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.frames(0, 30);
    assert!(s.pv().on_roof);
    s.m.core.cars[0].target = Some(Floor::F2);
    s.m.core.cars[0].call = false;
    s.frames(0, 120);
    assert!(s.alive() && s.pv().on_roof);
    assert_eq!(s.pv().y, floor_y(Floor::F2) - CAR_H);
}

#[test]
fn jumping_off_a_car_roof_up_to_the_floor_above_works() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F3);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.frames(0, 30);
    assert!(s.pv().on_roof);
    // jump with momentum to the right, out of the shaft, onto 4F
    s.step(RIGHT | B);
    s.frames(0, 40);
    assert!(s.pv().grounded);
    assert_eq!(s.pv().y, floor_y(Floor::F4), "{:?}", s.pv());
}

#[test]
fn pressing_up_beside_the_pit_calls_the_car_which_opens_level() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::F2);
    let sx = SHAFTS[0].x;
    s.place(Floor::F3, sx - 5);
    s.tap(UP);
    s.frames(0, 120);
    assert_eq!(s.m.core.cars[0].y, floor_y(Floor::F3));
    assert!(s.m.core.cars[0].open_at().is_some());
    assert!(s.alive() && s.pv().grounded && s.pv().y == floor_y(Floor::F3));
    // walk in and board
    s.frames(RIGHT, 7);
    s.tap(DOWN);
    assert_eq!(s.pv().riding, Some(ShaftId::A));
}

#[test]
fn standing_still_beside_the_shaft_calls_the_car_after_half_a_second() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::B, Floor::Parking);
    s.place(Floor::F4, SHAFTS[1].x - 5);
    s.frames(0, 20);
    assert_eq!(s.m.core.cars[1].y, floor_y(Floor::Parking), "20 frames is not enough");
    s.frames(0, 20);
    assert!(s.m.core.cars[1].y < floor_y(Floor::Parking), "the car is on its way after ~30 frames");
    s.frames(0, 300);
    assert_eq!(s.m.core.cars[1].y, floor_y(Floor::F4));
}

#[test]
fn a_called_car_picks_up_a_player_standing_on_the_grate_instead_of_crushing_him() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::A, Floor::Roof);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.step(0);
    s.tap(DOWN);
    s.frames(0, 150);
    assert!(s.alive());
    assert_eq!(s.run.lives, 3);
    assert_eq!(s.pv().riding, Some(ShaftId::A), "picked up");
    assert_eq!(s.m.core.cars[0].y, floor_y(Floor::F4));
    assert_eq!(s.pv().y, floor_y(Floor::F4));
}

#[test]
fn a_called_car_picks_up_a_player_who_waits_in_the_opening_of_a_stranded_car() {
    // car far above: a grate under him, the same pick-up rule through the 30 frame auto call
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::B, Floor::F4);
    s.place(Floor::F1, SHAFTS[1].center_x());
    s.step(0);
    s.frames(0, 40);
    s.frames(0, 400);
    assert!(s.alive());
    assert_eq!(s.pv().riding, Some(ShaftId::B));
}

#[test]
fn car_c_never_leaves_with_the_player_inside_but_leaves_empty() {
    let mut s = Sim::new(1);
    s.car(ShaftId::C, Floor::F3);
    s.place(Floor::F3, SHAFTS[2].center_x());
    s.step(0);
    s.tap(UP);
    assert_eq!(s.pv().riding, Some(ShaftId::C));
    s.frames(0, AUTO_WAIT * 4);
    assert_eq!(s.m.core.cars[2].y, floor_y(Floor::F3));
    assert_eq!(s.m.core.cars[2].stops, 0);
    // step out, wait: it leaves by itself
    s.step(LEFT);
    s.frames(0, 12);
    s.frames(0, AUTO_WAIT + 30);
    assert_ne!(s.m.core.cars[2].y, floor_y(Floor::F3), "an empty C leaves after about two seconds");
}

#[test]
fn the_player_can_drive_car_c_while_inside() {
    let mut s = Sim::new(1);
    s.car(ShaftId::C, Floor::Roof);
    s.place(Floor::Roof, SHAFTS[2].center_x());
    s.step(0);
    s.tap(DOWN);
    assert_eq!(s.pv().riding, Some(ShaftId::C));
    s.frames(DOWN, 12);
    s.frames(0, 100);
    assert_eq!(s.m.core.cars[2].y, floor_y(Floor::F4));
}

#[test]
fn cars_stopping_near_the_player_ding_but_far_ones_do_not() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.place(Floor::F3, 40);
    s.step(0);
    s.out.take();
    s.m.core.cars[0].target = Some(Floor::F3); // A is far to the right? A at x=208: within 150? no: 168 away
    s.car(ShaftId::B, Floor::Parking);
    s.m.core.cars[1].target = Some(Floor::F1);
    s.frames(0, 200);
    assert_eq!(s.dings(), 0, "B stopping 360 px and 4 floors away is silent");
    s.place(Floor::F1, SHAFTS[1].x - 30);
    s.m.core.cars[1].target = Some(Floor::F2);
    s.frames(0, 100);
    assert_eq!(s.dings(), 1);
}

// ------------------------------------------------------------------------------------------ escalators

#[test]
fn escalator_up_and_down_ride_diagonally() {
    let mut s = Sim::new(1);
    let e = &ESCALATORS[1]; // 2F <-> 1F, climbs right
    s.place(Floor::F1, e.x);
    s.step(0);
    s.tap(UP);
    assert!(matches!(s.m.core.player.mode, Mode::Escalator { up: true, .. }));
    let (x0, y0) = (s.pv().x, s.pv().y);
    s.frames(0, 10);
    assert_eq!((s.pv().x - x0, y0 - s.pv().y), (10, 10), "1 px per frame on both axes");
    // no jumping / shooting while riding
    s.step(B | A);
    assert!(s.m.core.bullets.list.is_empty());
    assert!(s.pv().on_escalator);
    s.frames(0, ESC_W as u32);
    assert!(!s.pv().on_escalator);
    assert_eq!(s.pv().y, floor_y(Floor::F2));
    assert!(s.pv().x >= e.x + ESC_W);
    // and back down from the top landing
    s.place(Floor::F2, e.x + ESC_W);
    s.step(0);
    s.tap(DOWN);
    assert!(matches!(s.m.core.player.mode, Mode::Escalator { up: false, .. }));
    s.frames(0, ESC_W as u32 + 2);
    assert_eq!(s.pv().y, floor_y(Floor::F1));
}

#[test]
fn down_at_the_landing_next_to_shaft_b_boards_the_escalator_not_the_call() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.car(ShaftId::B, Floor::Parking);
    let e = &ESCALATORS[0];
    s.place(Floor::F4, e.x + ESC_W + 4);
    s.step(0);
    s.tap(DOWN);
    assert!(matches!(s.m.core.player.mode, Mode::Escalator { up: false, .. }));
    assert_eq!(s.m.core.cars[1].target, None, "no car call from the landing");
}

#[test]
fn bullets_can_hit_a_player_on_the_escalator() {
    let mut s = Sim::new(1);
    let e = &ESCALATORS[1];
    s.place(Floor::F1, e.x);
    s.step(0);
    s.tap(UP);
    s.frames(0, 10);
    let pv = s.pv();
    s.m.core.bullets.fire_enemy(pv.x + 8, pv.y - 12, -1, Floor::F1);
    s.frames(0, 6);
    assert!(s.pv().dying);
}

// ------------------------------------------------------------------------------------------ stores and exit

#[test]
fn up_at_an_open_store_door_enters_it() {
    let mut s = Sim::new(1);
    s.at(Floor::F4, layout::door_x(StoreId::Forever12));
    s.out.take();
    assert_eq!(s.tap(UP), MallOutcome::EnterStore(StoreId::Forever12));
    assert_eq!(s.out.count_sfx(Sfx::Door), 1);
    s.at(Floor::F4, layout::door_x(StoreId::Crookstone));
    assert_eq!(s.tap(UP), MallOutcome::EnterStore(StoreId::Crookstone), "power shops are always open");
}

#[test]
fn closed_and_cleared_stores_do_nothing_but_buzz() {
    let mut s = Sim::new(1);
    s.at(Floor::F3, layout::door_x(StoreId::BlockblusterVideo));
    s.out.take();
    assert_eq!(s.tap(UP), MallOutcome::None);
    assert_eq!(s.out.count_sfx(Sfx::Buzzer), 1);
    s.at(Floor::F4, layout::door_x(StoreId::Forever12));
    let mut o = Out::new();
    s.run.take_package(StoreId::Forever12, &mut o);
    s.out.take();
    assert_eq!(s.tap(UP), MallOutcome::None);
    assert_eq!(s.out.count_sfx(Sfx::Buzzer), 1);
    assert_eq!(s.out.count_sfx(Sfx::Door), 0);
    // a door that is not under him does nothing at all
    s.at(Floor::F4, layout::door_x(StoreId::Forever12) + 30);
    s.out.take();
    assert_eq!(s.tap(UP), MallOutcome::None);
    assert!(s.out.events.is_empty());
}

#[test]
fn returning_from_a_store_stands_at_its_door_and_keeps_the_world() {
    let mut s = Sim::new(1);
    s.car(ShaftId::B, Floor::F2);
    let car_y = s.m.core.cars[1].y;
    s.at(Floor::F3, 600);
    s.m.return_from_store(StoreId::KgbToys);
    let pv = s.pv();
    assert_eq!((pv.x, pv.y), (layout::door_x(StoreId::KgbToys), floor_y(Floor::F3)));
    assert_eq!(pv.facing, 1, "faces into the corridor");
    assert_eq!(s.m.core.cars[1].y, car_y);
    // the next step re-emits the mall music
    s.out.take();
    s.step(0);
    assert!(s.out.events.contains(&Event::Music(Track::MallAmbient)));
    s.m.return_from_store(StoreId::GameStonk);
    assert_eq!(s.pv().facing, -1, "right side stores face left");
}

#[test]
fn exit_is_blocked_with_packages_missing() {
    let mut s = Sim::new(1);
    s.at(Floor::Parking, layout::CAR_X + 20);
    s.out.take();
    assert_eq!(s.tap(UP), MallOutcome::None);
    assert!(s.m.core.banner.active());
    assert_eq!(s.m.core.banner.text, "PACKAGES LEFT: 6");
    assert_eq!(s.out.count_sfx(Sfx::Buzzer), 1);
    let mut o = Out::new();
    for id in [StoreId::Forever12, StoreId::RadioShock, StoreId::KgbToys] {
        s.run.take_package(id, &mut o);
    }
    s.tap(UP);
    assert_eq!(s.m.core.banner.text, "PACKAGES LEFT: 3");
}

#[test]
fn level_clear_fires_exactly_once_with_all_packages() {
    let mut s = Sim::new(1);
    let mut o = Out::new();
    for id in StoreId::ALL {
        if id.role() == crate::types::StoreRole::Target {
            s.run.take_package(id, &mut o);
        }
    }
    assert_eq!(s.run.packages_found(), PACKAGES_TOTAL);
    s.at(Floor::Parking, layout::CAR_X + 20);
    let mut clears = 0;
    for _ in 0..5 {
        if s.tap(UP) == MallOutcome::LevelClear {
            clears += 1;
        }
    }
    for _ in 0..120 {
        if s.step(UP) == MallOutcome::LevelClear {
            clears += 1;
        }
    }
    assert_eq!(clears, 1);
}

#[test]
fn up_away_from_the_car_does_not_end_the_level() {
    let mut s = Sim::new(1);
    let mut o = Out::new();
    for id in StoreId::ALL {
        if id.role() == crate::types::StoreRole::Target {
            s.run.take_package(id, &mut o);
        }
    }
    s.at(Floor::Parking, layout::CAR_X + layout::CAR_W + 40);
    assert_eq!(s.tap(UP), MallOutcome::None);
}

// ------------------------------------------------------------------------------------------ death

#[test]
fn death_costs_a_life_then_respawns_at_the_last_safe_spot_with_invulnerability() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.at(Floor::F4, 100);
    s.frames(RIGHT, 20); // x = 120 safe
    let safe_x = s.pv().x;
    s.m.core.bullets.fire_enemy(s.pv().x + 30, s.pv().y - 12, -1, Floor::F4);
    s.out.take();
    s.frames(0, 30);
    assert!(s.pv().dying);
    assert_eq!(s.run.lives, 2);
    // walk off: nothing moves the dead
    s.frames(RIGHT, 10);
    assert_eq!(s.pv().x, safe_x);
    s.frames(0, DEATH_FRAMES);
    assert!(!s.pv().dying);
    assert_eq!((s.pv().x, s.pv().y), (safe_x, floor_y(Floor::F4)));
    assert!(s.pv().invulnerable);
    assert!(s.m.core.bullets.list.is_empty());
    assert_eq!(s.out.count_sfx(Sfx::Death), 1);
    // invulnerable for about two seconds, then not
    s.m.core.bullets.fire_enemy(s.pv().x + 10, s.pv().y - 12, -1, Floor::F4);
    s.frames(0, 10);
    assert!(s.alive(), "hits are ignored while invulnerable");
    s.frames(0, 130);
    assert!(!s.pv().invulnerable);
}

#[test]
fn respawn_after_a_pit_death_uses_the_last_floor_spot_not_the_pit() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.at(Floor::F4, 100);
    s.car(ShaftId::A, Floor::F2);
    s.m.core.player.place(SHAFTS[0].center_x(), floor_y(Floor::F4));
    s.frames(0, 40);
    assert!(s.pv().dying);
    s.frames(0, DEATH_FRAMES + 2);
    assert!(s.alive());
    assert_eq!((s.pv().x, s.pv().y), (100, floor_y(Floor::F4)));
}

#[test]
fn out_of_lives_is_reported_once_and_continue_revives() {
    let mut s = Sim::new(1);
    s.run.lives = 1;
    s.at(Floor::F3, 100);
    s.m.debug_kill();
    let mut n = 0;
    for _ in 0..(DEATH_FRAMES + 200) {
        if s.step(0) == MallOutcome::OutOfLives {
            n += 1;
        }
    }
    assert_eq!(n, 1);
    assert_eq!(s.run.lives, 0);
    assert!(s.pv().dying);
    // Game: continue
    s.run.use_continue();
    s.m.revive_after_continue(&mut s.run);
    s.step(0);
    assert!(s.alive() && s.pv().invulnerable);
    assert_eq!(s.pv().x, 100);
    // and he can die and report again later
    s.run.lives = 1;
    s.m.debug_kill();
    let mut n2 = 0;
    for _ in 0..(DEATH_FRAMES + 20) {
        if s.step(0) == MallOutcome::OutOfLives {
            n2 += 1;
        }
    }
    assert_eq!(n2, 1);
}

fn ctx_kill(s: &mut Sim, cause: DeathCause) -> bool {
    let mut ctx = Ctx { core: &mut s.m.core, run: &mut s.run, out: &mut s.out, pad: PadState::default() };
    ctx.kill_player(cause)
}

#[test]
fn armour_absorbs_exactly_one_hit_then_a_short_invulnerability() {
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::ArmorVest);
    s.at(Floor::F3, 100);
    assert!(!ctx_kill(&mut s, DeathCause::Bullet));
    assert!(!s.run.power.armor);
    assert_eq!(s.run.lives, 3);
    assert!(s.pv().invulnerable);
    assert!(!ctx_kill(&mut s, DeathCause::Spy), "invulnerable right after the hit");
    s.frames(0, 60);
    assert!(!s.pv().invulnerable);
    assert!(ctx_kill(&mut s, DeathCause::Spy));
    assert_eq!(s.run.lives, 2);
}

#[test]
fn armour_does_not_help_against_crushing_or_falling_and_cinnabomb_beats_everything() {
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::SoftPretzel);
    s.at(Floor::F3, 100);
    assert!(ctx_kill(&mut s, DeathCause::Crushed));
    assert!(s.run.power.armor == false, "lose_life drops power-ups");
    let mut s = Sim::new(1);
    s.run.power.grant(PowerUp::Cinnabomb);
    s.run.power.grant(PowerUp::ArmorVest);
    s.at(Floor::F3, 100);
    for c in [DeathCause::Bullet, DeathCause::Spy, DeathCause::Lamp, DeathCause::DiscoBall, DeathCause::Crushed, DeathCause::Fall] {
        assert!(!ctx_kill(&mut s, c), "{c:?}");
    }
    assert!(s.run.power.armor, "armour is not spent while invincible");
    assert_eq!(s.run.lives, 3);
}

#[test]
fn a_cinnabomb_player_in_the_way_of_a_car_is_taken_aboard_not_left_inside_it() {
    let mut s = Sim::new(1);
    s.freeze_c();
    s.run.power.grant(PowerUp::Cinnabomb);
    s.car(ShaftId::A, Floor::Roof);
    s.place(Floor::F4, SHAFTS[0].center_x());
    s.step(0);
    s.m.core.cars[0].target = Some(Floor::F3);
    s.frames(0, 120);
    assert!(s.alive());
    assert_eq!(s.pv().riding, Some(ShaftId::A));
}

#[test]
fn dying_clears_riding_state_and_the_hum() {
    let mut s = Sim::new(1);
    board(&mut s, ShaftId::B, Floor::F4);
    s.out.take();
    s.m.debug_kill();
    s.frames(0, 5);
    assert!(s.out.events.contains(&Event::Hum(false)));
    assert!(!s.m.riding_elevator());
}

// ------------------------------------------------------------------------------------------ arrival

#[test]
fn arrival_slides_lands_poses_and_hands_over_control() {
    let mut run = RunState::new(5, false);
    let mut out = Out::new();
    let mut m = Mall::new(&mut run, &mut out);
    assert!(m.in_arrival());
    assert_eq!(m.hud_floor(), Floor::Roof);
    let mut frames = 0;
    let mut hang_y = Vec::new();
    while m.in_arrival() && frames < 600 {
        m.step(PadState::default(), &mut run, &mut out);
        hang_y.push(m.core.player.y());
        frames += 1;
    }
    assert!((150..=330).contains(&frames), "arrival took {frames} frames");
    assert_eq!(out.count_sfx(Sfx::Zip), 1);
    assert_eq!(out.count_sfx(Sfx::Thud), 1);
    assert_eq!(out.count_sfx(Sfx::Flash), 1);
    assert!(hang_y[0] < hang_y[60], "slides down");
    assert!(m.core.player.grounded && m.core.player.y() == floor_y(Floor::Roof));
    // the selfie lasts 2.5 s
    let selfie = super::arrival::SELFIE_FRAMES;
    assert_eq!(selfie, 150);
    // in control now
    let x0 = m.core.player.x;
    let mut prev = 0u8;
    for _ in 0..20 {
        let pad = PadState::from_held(prev, RIGHT);
        prev = RIGHT;
        m.step(pad, &mut run, &mut out);
    }
    assert_eq!(m.core.player.x - x0, 20);
}

#[test]
fn any_button_skips_the_arrival_and_is_swallowed() {
    for skip_at in [10u32, 100, 150, 200] {
        let mut run = RunState::new(5, false);
        let mut out = Out::new();
        let mut m = Mall::new(&mut run, &mut out);
        for _ in 0..skip_at {
            m.step(PadState::default(), &mut run, &mut out);
        }
        assert!(m.in_arrival(), "still arriving at {skip_at}");
        m.step(PadState::from_held(0, A | B), &mut run, &mut out);
        assert!(!m.in_arrival(), "skipped at {skip_at}");
        assert!(m.core.player.grounded && m.core.player.y() == floor_y(Floor::Roof));
        assert!(m.core.bullets.list.is_empty() && out.count_sfx(Sfx::Shot) == 0 && out.count_sfx(Sfx::Jump) == 0);
        assert_eq!(m.core.player.mode, Mode::Normal);
    }
}

#[test]
fn the_selfie_post_comes_from_the_seeded_rng_and_is_deterministic() {
    let post = |seed| {
        let mut run = RunState::new(seed, false);
        let mut out = Out::new();
        Mall::new(&mut run, &mut out).core.post
    };
    assert_eq!(post(3), post(3));
    let all: std::collections::BTreeSet<usize> = (0..40).map(post).collect();
    assert!(all.len() >= 4, "posts vary across seeds: {all:?}");
    assert!(all.iter().all(|p| *p < crate::copy::ARRIVAL_POSTS.len()));
}

// ------------------------------------------------------------------------------------------ determinism

#[test]
fn same_seed_and_inputs_give_the_same_state() {
    fn run(seed: u64) -> Vec<String> {
        let mut run = RunState::new(seed, false);
        let mut out = Out::new();
        let mut m = Mall::new(&mut run, &mut out);
        let mut pad_rng = crate::rng::Rng::new(99);
        let mut prev = 0u8;
        let mut log = Vec::new();
        for i in 0..4000 {
            let held = if i < 300 { 0 } else { (pad_rng.next_u32() & 0x3F) as u8 & !(crate::input::SELECT | crate::input::START) };
            let o = m.step(PadState::from_held(prev, held), &mut run, &mut out);
            prev = held;
            if let MallOutcome::OutOfLives = o {
                run.use_continue();
                m.revive_after_continue(&mut run);
            }
            if let MallOutcome::EnterStore(id) = o {
                m.return_from_store(id);
            }
            if i % 250 == 0 {
                log.push(m.debug_state());
            }
        }
        log
    }
    assert_eq!(run(7), run(7));
    assert_ne!(run(7), run(8), "the automatic car depends on the seed");
}

// ------------------------------------------------------------------------------------------ the pad-only bot

#[derive(Clone, Copy, Debug)]
enum Step {
    Shaft(ShaftId, Floor),
    Esc(usize, bool),
}

fn plan(from: Floor, target: Floor) -> Step {
    let down = target.index() > from.index();
    match (from, down) {
        (Floor::Roof, true) => Step::Shaft(ShaftId::A, Floor::F4),
        (Floor::F4, true) => Step::Esc(0, false),
        (Floor::F3, true) => Step::Shaft(ShaftId::A, Floor::F2),
        (Floor::F2, true) => Step::Esc(1, false),
        (Floor::F1, true) => Step::Shaft(ShaftId::B, Floor::Parking),
        (Floor::Parking, false) => Step::Shaft(ShaftId::B, Floor::F4),
        (Floor::F4, false) => Step::Shaft(ShaftId::A, Floor::Roof),
        (Floor::F3, false) => Step::Esc(0, true),
        (Floor::F2, false) => Step::Shaft(ShaftId::A, Floor::F3),
        (Floor::F1, false) => Step::Esc(1, true),
        _ => unreachable!(),
    }
}

/// A bot that only produces pad input, from observation of the mall (like a player looking at the screen).
#[derive(Default)]
struct Bot {
    goal: Option<Floor>,
}

impl Bot {
    fn pad(&mut self, s: &Sim, target: Floor) -> u8 {
        let pv = s.pv();
        let alt = |b: u8| if s.held & b == 0 { b } else { 0 };
        if let Some(id) = pv.riding {
            let i = ci(id);
            let c = &s.m.core.cars[i];
            let goal = self.goal.unwrap();
            let gy = floor_y(goal);
            if c.open_at() == Some(goal) {
                return LEFT;
            }
            if s.m.core.player.ride_lock {
                return 0;
            }
            let dir = if gy > c.y { DOWN } else { UP };
            // release between floors so the car glides on to the goal floor
            let release = if dir == DOWN { c.y >= gy - 20 } else { c.y <= gy + 20 };
            return if release { 0 } else { dir };
        }
        if !pv.grounded || world::floor_at_y(pv.y).is_none() {
            return 0;
        }
        let f = pv.floor;
        if f == target {
            return 0;
        }
        match plan(f, target) {
            Step::Shaft(id, to) => {
                self.goal = Some(to);
                let i = ci(id);
                let sh = &SHAFTS[i];
                let car = &s.m.core.cars[i];
                let in_zone = world::in_opening_zone(id, pv.x);
                if car.open_at() == Some(f) {
                    if in_zone {
                        return alt(if to.index() > f.index() { DOWN } else { UP });
                    }
                    return if pv.x < sh.center_x() { RIGHT } else { LEFT };
                }
                if world::in_call_zone(id, pv.x) {
                    return alt(UP);
                }
                let want = if pv.x < sh.x { sh.x - 5 } else { sh.x + layout::SHAFT_W + 5 };
                if pv.x < want {
                    RIGHT
                } else if pv.x > want {
                    LEFT
                } else {
                    0
                }
            }
            Step::Esc(idx, up) => {
                let e = &ESCALATORS[idx];
                let wx = if up { e.x } else { e.x + ESC_W };
                if pv.x < wx {
                    RIGHT
                } else if pv.x > wx {
                    LEFT
                } else {
                    alt(if up { UP } else { DOWN })
                }
            }
        }
    }
}

fn bot_travel(s: &mut Sim, target: Floor, budget: u32) -> bool {
    let mut bot = Bot::default();
    for _ in 0..budget {
        if s.pv().floor == target && s.pv().grounded && world::floor_at_y(s.pv().y).is_some() && s.pv().riding.is_none() {
            return true;
        }
        let held = bot.pad(s, target);
        s.step(held);
        if !s.alive() {
            return false;
        }
    }
    false
}

#[test]
fn a_pad_only_bot_gets_from_the_roof_to_parking_through_real_gameplay() {
    for seed in 1..=4u64 {
        let mut s = Sim::new(seed);
        s.at(Floor::Roof, 80);
        assert!(bot_travel(&mut s, Floor::Parking, 9000), "seed {seed} stuck: {}", s.m.debug_state());
        assert_eq!(s.run.lives, 3, "the bot must not die on the way");
    }
}

#[test]
fn a_pad_only_bot_climbs_back_up_to_the_roof() {
    for seed in 1..=3u64 {
        let mut s = Sim::new(seed);
        s.at(Floor::Parking, 300);
        assert!(bot_travel(&mut s, Floor::Roof, 9000), "seed {seed} stuck: {}", s.m.debug_state());
    }
}

#[test]
fn the_bot_run_is_deterministic_per_seed() {
    let run = |seed| {
        let mut s = Sim::new(seed);
        s.at(Floor::Roof, 80);
        let ok = bot_travel(&mut s, Floor::Parking, 9000);
        (ok, s.m.core.frame, s.m.debug_state())
    };
    assert_eq!(run(2), run(2));
}

// ------------------------------------------------------------------------------------------ playability

#[test]
fn nobody_is_ever_stranded_from_a_car_pad_input_alone_can_always_get_aboard() {
    // every shaft x every car floor x every floor the player waits at x (beside the opening | in the opening)
    for (si, sh) in SHAFTS.iter().enumerate() {
        for car_floor in sh.floors() {
            for at in sh.floors() {
                for in_opening in [false, true] {
                    // standing IN the opening only makes sense when the car is not below (no pit under him)
                    if in_opening && floor_y(car_floor) > floor_y(at) {
                        continue;
                    }
                    let mut s = Sim::new(11);
                    if sh.id != ShaftId::C {
                        s.freeze_c();
                    }
                    s.car(sh.id, car_floor);
                    let x = if in_opening { sh.center_x() } else { sh.x - 5 };
                    s.place(at, x);
                    s.step(0);
                    s.tap(UP);
                    for _ in 0..700 {
                        s.step(0);
                        if s.pv().riding.is_some() || s.m.core.cars[si].open_at() == Some(at) {
                            break;
                        }
                    }
                    assert!(s.alive(), "{:?} car {:?} at {:?} in_opening={in_opening}: died", sh.id, car_floor, at);
                    if s.pv().riding.is_none() {
                        assert_eq!(s.m.core.cars[si].open_at(), Some(at), "{:?} car {:?} at {:?} in_opening={in_opening}: car never came", sh.id, car_floor, at);
                        for _ in 0..20 {
                            if s.pv().x < sh.center_x() {
                                s.step(RIGHT);
                            }
                        }
                        s.tap(DOWN);
                    }
                    assert_eq!(s.pv().riding, Some(sh.id), "{:?} car {:?} at {:?} in_opening={in_opening}: could not board", sh.id, car_floor, at);
                }
            }
        }
    }
}

#[test]
fn walking_over_a_grate_beside_a_stationary_car_is_never_a_trap() {
    // a car stranded at the very top and a player who falls into the shaft below is on the roof and can leave
    let mut s = Sim::new(3);
    s.freeze_c();
    s.car(ShaftId::B, Floor::F2);
    s.place(Floor::F3, SHAFTS[1].center_x());
    s.frames(0, 30);
    assert!(s.pv().on_roof);
    s.step(RIGHT | B);
    s.frames(0, 45);
    assert!(s.pv().grounded && s.alive());
    assert_eq!(s.pv().y, floor_y(Floor::F3));
}

#[test]
fn escalators_and_shafts_reach_every_floor_per_layout() {
    // the bot tests above prove it by play; this is the cheap structural cross-check
    assert_eq!(layout::reachable_floors(Floor::Roof).len(), 6);
}

#[test]
fn debug_teleport_never_places_the_player_in_a_pit() {
    let mut s = Sim::new(1);
    for f in Floor::ALL {
        for x in (10..760).step_by(7) {
            s.m.debug_teleport(f, x);
            let p = &s.m.core.player;
            assert_eq!(p.y(), floor_y(f));
            assert!(s.m.core.standing_support(p.x, p.y()).is_some(), "{f:?} x={x} -> {}", p.x);
        }
    }
}
