//! Elevator cars (spec 5.4). One car per shaft; `y` is the car's platform (feet) in world px.
//!
//! * Manual driving: a rider holding Up/Down moves the car 1 px/frame. Releasing between floors makes it
//!   glide on in the same direction to the NEXT floor and stop exactly level.
//! * Called / automatic movement: 2 px/frame towards a target floor (`target`). `call` marks a trip that
//!   answers a call (the called player is picked up instead of crushed).
//! * Car C is automatic: while empty it waits `AUTO_WAIT` frames at a floor, then goes to a random other
//!   served floor. It never leaves while the player (or a registered spy) is inside; a player inside may
//!   still drive it with Up/Down like the others.
//! * Doors are closed while moving (`door == 0`) and open while stopped (`door == DOOR_OPEN`).

use crate::layout::{self, floor_y, ShaftId, SHAFTS};
use crate::rng::Rng;
use crate::types::Floor;

use super::world::{self, CAR_H};

/// Frames C waits at a floor before leaving (2 s in the spec; "about 2 s" -> 120 frames).
pub const AUTO_WAIT: u32 = 120;
pub const DOOR_OPEN: u8 = 8;
/// Doors count as open enough to board/exit from this value.
pub const DOOR_USABLE: u8 = 5;
/// Speed of a called / automatic car (px per frame). Manual driving is 1 px/frame.
pub const AUTO_SPEED: i32 = 2;

#[derive(Clone, Debug)]
pub struct Car {
    pub shaft: ShaftId,
    /// Platform (feet) world y.
    pub y: i32,
    /// Direction of travel this frame: -1 up, 0 stopped, +1 down.
    pub dir: i8,
    /// 0 = closed .. DOOR_OPEN = fully open.
    pub door: u8,
    /// Where an automatic or called trip is heading.
    pub target: Option<Floor>,
    /// The current trip answers a call.
    pub call: bool,
    /// Car C's wait timer.
    pub wait: u32,
    /// The player is inside (set by the mall every frame).
    pub rider: bool,
    /// Spies (or anyone else) inside; the spies hook sets this.
    pub extra_occupants: u32,
    /// Number of times this car has come to a stop (used by tests and the ding).
    pub stops: u32,
    /// Distance travelled in the last frame (signed, + down): hooks use it for crush checks.
    pub last_move: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CarEvent {
    None,
    /// The car came to rest this frame.
    Stopped,
}

impl Car {
    pub fn new(shaft: ShaftId, at: Floor) -> Car {
        Car {
            shaft,
            y: floor_y(at),
            dir: 0,
            door: DOOR_OPEN,
            target: None,
            call: false,
            wait: 0,
            rider: false,
            extra_occupants: 0,
            stops: 0,
            last_move: 0,
        }
    }

    pub fn index(&self) -> usize {
        SHAFTS.iter().position(|s| s.id == self.shaft).unwrap()
    }
    pub fn manual(&self) -> bool {
        layout::shaft(self.shaft).manual
    }
    pub fn occupied(&self) -> bool {
        self.rider || self.extra_occupants > 0
    }
    pub fn top_y(&self) -> i32 {
        floor_y(layout::shaft(self.shaft).top)
    }
    pub fn bottom_y(&self) -> i32 {
        floor_y(layout::shaft(self.shaft).bottom)
    }
    pub fn roof_y(&self) -> i32 {
        self.y - CAR_H
    }
    /// The floor the platform is exactly level with.
    pub fn level_floor(&self) -> Option<Floor> {
        let f = world::floor_at_y(self.y)?;
        if layout::shaft(self.shaft).serves(f) {
            Some(f)
        } else {
            None
        }
    }
    /// Stopped, level with a floor, doors open enough to board or leave.
    pub fn open_at(&self) -> Option<Floor> {
        if self.dir == 0 && self.door >= DOOR_USABLE {
            self.level_floor()
        } else {
            None
        }
    }
    /// 0.0 (roof) ..= 5.0 (P) position for the map.
    pub fn floor_pos(&self) -> f32 {
        (self.y - floor_y(Floor::Roof)) as f32 / layout::FLOOR_GAP as f32
    }
    /// Door sprite frame: 0 closed, 1 half, 2 open.
    pub fn door_frame(&self) -> usize {
        match self.door {
            0..=1 => 0,
            2..=5 => 1,
            _ => 2,
        }
    }

    /// Ask the car to come to `floor` (a call). Ignored while occupied or when it cannot serve that floor.
    pub fn call_to(&mut self, floor: Floor) -> bool {
        if self.occupied() || !layout::shaft(self.shaft).serves(floor) {
            return false;
        }
        if self.level_floor() == Some(floor) && self.dir == 0 {
            return true;
        }
        self.target = Some(floor);
        self.call = true;
        true
    }

    /// Is this car answering a call to `floor` right now?
    pub fn answering_call_to(&self, floor: Floor) -> bool {
        self.call && self.target == Some(floor)
    }

    fn is_level(&self) -> bool {
        self.level_floor().is_some()
    }

    /// Advance one frame. `drive` is the rider's Up/Down (-1/0/+1; only used while the player rides).
    pub fn step(&mut self, drive: i32, rng: &mut Rng) -> CarEvent {
        let was_moving = self.dir != 0;
        let drive = if self.rider { drive } else { 0 };

        // ---- decide what to do this frame: (direction, speed)
        let mut want: i32 = 0;
        let mut speed = 1;
        if drive != 0 {
            want = drive;
            self.target = None;
            self.call = false;
        } else if self.rider && self.target.is_some() && self.call {
            // somebody boarded mid-call (picked up): the call is over, wait for orders.
            self.target = None;
            self.call = false;
        } else if let Some(t) = self.target {
            if self.occupied() && !self.call {
                // an automatic trip is cancelled the moment somebody is inside
                self.target = None;
            } else {
                let dist = floor_y(t) - self.y;
                if dist != 0 {
                    want = dist.signum();
                    speed = AUTO_SPEED;
                } else {
                    self.target = None;
                    self.call = false;
                }
            }
        }
        if want == 0 && was_moving && !self.is_level() && self.target.is_none() {
            // released between floors: glide on to the next floor in the same direction
            want = self.dir as i32;
        }
        // end of the shaft: cannot move further
        if want < 0 && self.y <= self.top_y() {
            want = 0;
        }
        if want > 0 && self.y >= self.bottom_y() {
            want = 0;
        }

        // ---- doors and movement
        let mut moved = 0;
        if want != 0 {
            if self.door > 0 {
                self.door = self.door.saturating_sub(2);
                // doors still closing: hold still (dir stays 0 unless already moving)
            } else {
                let mut step = speed;
                if let Some(t) = self.target {
                    step = step.min((floor_y(t) - self.y).abs());
                }
                // never overshoot the end of the shaft
                if want < 0 {
                    step = step.min(self.y - self.top_y());
                } else {
                    step = step.min(self.bottom_y() - self.y);
                }
                // glide / manual motion stops exactly level with the next floor boundary
                if self.target.is_none() {
                    step = step.min(self.distance_to_next_floor(want));
                }
                if step < 1 {
                    step = 1;
                }
                self.y += want * step;
                moved = want * step;
                self.dir = want as i8;
            }
        } else {
            self.dir = 0;
            if self.is_level() && self.door < DOOR_OPEN {
                self.door += 1;
            }
        }
        self.last_move = moved;

        // ---- automatic car: wait, then pick a random other floor
        if !self.manual() {
            if self.occupied() || self.dir != 0 || self.target.is_some() {
                self.wait = 0;
            } else {
                self.wait += 1;
                if self.wait >= AUTO_WAIT {
                    self.wait = 0;
                    let floors = layout::shaft(self.shaft).floors();
                    let cur = self.level_floor();
                    let others: Vec<Floor> = floors.into_iter().filter(|f| Some(*f) != cur).collect();
                    if !others.is_empty() {
                        let t = *rng.pick(&others);
                        self.target = Some(t);
                        self.call = false;
                    }
                }
            }
        }

        // ---- came to rest?
        if was_moving && self.dir == 0 {
            self.stops += 1;
            return CarEvent::Stopped;
        }
        if was_moving && self.dir != 0 && self.is_level() && drive == 0 && self.target.is_none() {
            // glide reached a floor: next frame's `want` is 0 and we stop then
        }
        CarEvent::None
    }

    /// Pixels to the next floor level in direction `dir` (>0 down), at least 1; clamped to the shaft.
    fn distance_to_next_floor(&self, dir: i32) -> i32 {
        let stops = world::shaft_stops(self.shaft);
        let mut best = i32::MAX;
        for s in stops {
            let d = (s - self.y) * dir;
            if d > 0 && d < best {
                best = d;
            }
        }
        if best == i32::MAX {
            1
        } else {
            best
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn car(shaft: ShaftId, at: Floor) -> (Car, Rng) {
        (Car::new(shaft, at), Rng::new(7))
    }

    fn run_frames(c: &mut Car, r: &mut Rng, n: u32, drive: i32) {
        for _ in 0..n {
            c.step(drive, r);
        }
    }

    #[test]
    fn manual_drive_is_one_pixel_per_frame_and_glides_to_the_next_floor() {
        let (mut c, mut r) = car(ShaftId::B, Floor::F4);
        c.rider = true;
        // doors close first, then 1 px per frame down
        run_frames(&mut c, &mut r, 20, 1);
        let y0 = c.y;
        c.step(1, &mut r);
        assert_eq!(c.y - y0, 1, "one pixel per frame");
        // release mid-way: it must keep going down to the next floor and stop exactly level
        run_frames(&mut c, &mut r, 100, 0);
        assert_eq!(c.y, floor_y(Floor::F3));
        assert_eq!(c.dir, 0);
        assert_eq!(c.level_floor(), Some(Floor::F3));
        assert_eq!(c.stops, 1);
    }

    #[test]
    fn holding_a_direction_passes_floors_without_stopping() {
        let (mut c, mut r) = car(ShaftId::B, Floor::F4);
        c.rider = true;
        run_frames(&mut c, &mut r, 100, 1);
        // held all the way: passes floors without stopping until released
        assert!(c.y > floor_y(Floor::F3));
        assert_eq!(c.stops, 0, "no stop while a direction is held between floors");
    }

    #[test]
    fn exactly_one_stop_when_holding_down_at_the_bottom() {
        let (mut c, mut r) = car(ShaftId::B, Floor::F4);
        c.rider = true;
        let mut stops = 0;
        for _ in 0..600 {
            if c.step(1, &mut r) == CarEvent::Stopped {
                stops += 1;
            }
        }
        assert_eq!(c.y, floor_y(Floor::Parking));
        assert_eq!(stops, 1, "holding Down at the end of the shaft must not stop again");
        assert_eq!(c.stops, 1);
    }

    #[test]
    fn doors_closed_while_moving_open_when_stopped() {
        let (mut c, mut r) = car(ShaftId::A, Floor::Roof);
        c.rider = true;
        assert_eq!(c.door, DOOR_OPEN);
        run_frames(&mut c, &mut r, 10, 1);
        assert_eq!(c.door, 0);
        assert_eq!(c.door_frame(), 0);
        run_frames(&mut c, &mut r, 120, 0);
        assert_eq!(c.door, DOOR_OPEN);
        assert_eq!(c.door_frame(), 2);
    }

    #[test]
    fn cannot_go_past_the_ends() {
        let (mut c, mut r) = car(ShaftId::A, Floor::Roof);
        c.rider = true;
        run_frames(&mut c, &mut r, 60, -1);
        assert_eq!(c.y, floor_y(Floor::Roof));
        let (mut c, mut r) = car(ShaftId::A, Floor::F2);
        c.rider = true;
        run_frames(&mut c, &mut r, 60, 1);
        assert_eq!(c.y, floor_y(Floor::F2));
    }

    #[test]
    fn a_call_brings_the_car_exactly_level() {
        let (mut c, mut r) = car(ShaftId::B, Floor::Parking);
        assert!(c.call_to(Floor::F4));
        run_frames(&mut c, &mut r, 400, 0);
        assert_eq!(c.y, floor_y(Floor::F4));
        assert!(c.open_at().is_some());
        assert!(!c.call && c.target.is_none());
    }

    #[test]
    fn an_occupied_car_ignores_calls() {
        let (mut c, _r) = car(ShaftId::B, Floor::Parking);
        c.rider = true;
        assert!(!c.call_to(Floor::F4));
    }

    #[test]
    fn automatic_car_waits_about_two_seconds_then_leaves() {
        let (mut c, mut r) = car(ShaftId::C, Floor::F2);
        let mut left_at = None;
        for i in 0..400 {
            c.step(0, &mut r);
            if c.dir != 0 && left_at.is_none() {
                left_at = Some(i);
            }
        }
        let t = left_at.expect("C must leave on its own");
        assert!((AUTO_WAIT as i32..AUTO_WAIT as i32 + 20).contains(&t), "left after {t}");
    }

    #[test]
    fn automatic_car_never_leaves_while_somebody_is_inside() {
        let (mut c, mut r) = car(ShaftId::C, Floor::F2);
        c.rider = true;
        run_frames(&mut c, &mut r, 1000, 0);
        assert_eq!(c.y, floor_y(Floor::F2));
        assert_eq!(c.stops, 0);
        c.rider = false;
        c.extra_occupants = 1; // a spy
        run_frames(&mut c, &mut r, 1000, 0);
        assert_eq!(c.y, floor_y(Floor::F2));
    }

    #[test]
    fn automatic_car_visits_only_served_floors_and_never_repeats_the_current_one() {
        let (mut c, mut r) = car(ShaftId::C, Floor::Roof);
        let mut last = c.level_floor();
        for _ in 0..20_000 {
            c.step(0, &mut r);
            assert!(c.y >= c.top_y() && c.y <= c.bottom_y());
            if c.dir == 0 {
                let now = c.level_floor();
                assert!(now.is_some());
                if now != last {
                    last = now;
                }
            }
        }
        assert!(c.stops > 5);
    }

    #[test]
    fn auto_cancels_when_a_rider_boards_before_it_departs() {
        let (mut c, mut r) = car(ShaftId::C, Floor::F2);
        run_frames(&mut c, &mut r, AUTO_WAIT, 0);
        assert!(c.target.is_some() || c.dir != 0);
        c.rider = true; // boards on the very frame it was about to leave (doors still open)
        run_frames(&mut c, &mut r, 200, 0);
        assert_eq!(c.y, floor_y(Floor::F2));
    }
}
