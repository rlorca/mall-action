//! Elevator car physics. Pure; no rendering.
use super::level::{floor_y, ShaftDef, CLEAR_H, FLOOR_GAP};
use crate::rng::Rng;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CarEvent {
    Started,
    /// The car came to rest exactly level with this floor (emit ONE ding).
    Stopped(u8),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Opening {
    /// Shaft does not serve this floor (solid wall).
    None,
    /// Car level with the floor: walk in.
    CarHere,
    /// Car above: a grate you can stand on (crush risk).
    Grate,
    /// Car below: an open pit.
    Pit,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Fall {
    /// Lands on the car roof at this y (safe: one floor or less).
    Roof(i32),
    Fatal,
}

#[derive(Clone, Debug)]
pub struct Car {
    pub def: ShaftDef,
    /// y of the car floor (feet of whoever rides inside).
    pub y: i32,
    /// Current movement: -1 up, 0 stopped, 1 down.
    pub dir: i8,
    pub target: Option<u8>,
    /// Moving because someone called it (faster, picks the caller up).
    pub called: bool,
    pub doors: i32,
    pub wait: i32,
    /// Frames the car has been continuously moving (for hum / stop detection).
    pub moving_for: i32,
}

pub const AUTO_WAIT: i32 = 120;
pub const CALL_SPEED: i32 = 2;

impl Car {
    pub fn new(def: ShaftDef, start_floor: u8) -> Car {
        Car { def, y: floor_y(start_floor), dir: 0, target: None, called: false, doors: 8, wait: AUTO_WAIT, moving_for: 0 }
    }
    pub fn top_y(&self) -> i32 {
        floor_y(self.def.top)
    }
    pub fn bottom_y(&self) -> i32 {
        floor_y(self.def.bottom)
    }
    pub fn floor_at(&self) -> Option<u8> {
        (self.def.bottom..=self.def.top).find(|f| floor_y(*f) == self.y)
    }
    pub fn roof_y(&self) -> i32 {
        self.y - CLEAR_H
    }
    pub fn opening(&self, floor: u8) -> Opening {
        if !self.def.serves(floor) {
            return Opening::None;
        }
        let fy = floor_y(floor);
        if self.y == fy {
            Opening::CarHere
        } else if self.y < fy {
            Opening::Grate
        } else {
            Opening::Pit
        }
    }
    /// What happens to something that steps into the pit at `floor` (feet at that floor's line).
    pub fn fall_into(&self, floor: u8) -> Fall {
        let fy = floor_y(floor);
        let roof = self.roof_y();
        if roof > fy && roof - fy <= FLOOR_GAP {
            Fall::Roof(roof)
        } else {
            Fall::Fatal
        }
    }
    /// Would a car coming down onto something standing on the grate at `floor` crush it right now?
    pub fn crushes_grate(&self, floor: u8) -> bool {
        let fy = floor_y(floor);
        self.dir == 1 && self.y > fy - 24 && self.y < fy && self.def.serves(floor)
    }
    /// Does the car, rising, squash someone standing on its roof against the top of the shaft?
    pub fn crushes_roof_rider(&self) -> bool {
        // head of a 24px rider on the roof vs ceiling of the top floor's opening
        self.dir == -1 && (self.roof_y() - 24) <= floor_y(self.def.top) - FLOOR_GAP
    }
    pub fn call(&mut self, floor: u8) {
        if !self.def.serves(floor) {
            return;
        }
        if self.floor_at() == Some(floor) && self.dir == 0 {
            return;
        }
        self.target = Some(floor);
        self.called = true;
        self.wait = AUTO_WAIT;
    }
    /// Next floor level strictly in `dir` from the current position (or the current floor if level... see glide()).
    fn next_floor_in_dir(&self, dir: i8) -> Option<u8> {
        let mut best: Option<(i32, u8)> = None;
        for f in self.def.bottom..=self.def.top {
            let fy = floor_y(f);
            let d = if dir < 0 { self.y - fy } else { fy - self.y };
            if d >= 0 {
                if best.map_or(true, |(bd, _)| d < bd) {
                    best = Some((d, f));
                }
            }
        }
        best.map(|b| b.1)
    }
    /// One simulation step. `drive`: -1/0/1 from the rider's up/down input (manual cars only).
    /// `occupied`: someone is inside (auto car never leaves).
    pub fn step(&mut self, drive: i8, occupied: bool, rng: &mut Rng) -> Option<CarEvent> {
        let was_moving = self.dir != 0;
        let mut ev = None;
        if drive != 0 && self.def.manual {
            // player driving
            self.called = false;
            let nd = drive;
            let lim = if nd < 0 { self.top_y() } else { self.bottom_y() };
            if self.y != lim {
                self.y += nd as i32;
                self.dir = nd;
                self.target = None;
            } else if was_moving {
                self.dir = 0;
                if let Some(f) = self.floor_at() {
                    ev = Some(CarEvent::Stopped(f));
                }
            }
        } else if let Some(t) = self.target {
            let ty = floor_y(t);
            let speed = if self.called { CALL_SPEED } else { 1 };
            let d = ty - self.y;
            if d == 0 {
                self.target = None;
                self.called = false;
                self.dir = 0;
                if was_moving {
                    ev = Some(CarEvent::Stopped(t));
                }
            } else {
                let mv = d.abs().min(speed);
                self.y += mv * d.signum();
                self.dir = d.signum() as i8;
                if self.y == ty {
                    self.target = None;
                    self.called = false;
                    self.dir = 0;
                    ev = Some(CarEvent::Stopped(t));
                }
            }
        } else if was_moving && drive == 0 && self.def.manual {
            // released between floors: glide on in the same direction
            match self.next_floor_in_dir(self.dir) {
                Some(f) if floor_y(f) == self.y => {
                    self.dir = 0;
                    ev = Some(CarEvent::Stopped(f));
                }
                Some(f) => {
                    self.target = Some(f);
                    self.called = false;
                    // take this step's movement through the target branch next frame
                    let d = (floor_y(f) - self.y).signum();
                    self.y += d;
                    self.dir = d as i8;
                    if self.y == floor_y(f) {
                        self.target = None;
                        self.dir = 0;
                        ev = Some(CarEvent::Stopped(f));
                    }
                }
                None => self.dir = 0,
            }
        } else if !self.def.manual {
            // automatic car: wait, then pick a random other floor
            if self.dir == 0 {
                if occupied {
                    self.wait = self.wait.max(30);
                } else if self.wait > 0 {
                    self.wait -= 1;
                } else {
                    let cur = self.floor_at();
                    let choices: Vec<u8> = (self.def.bottom..=self.def.top).filter(|f| Some(*f) != cur).collect();
                    if !choices.is_empty() {
                        self.target = Some(*rng.pick(&choices));
                        self.called = false;
                    }
                }
            }
        }
        // door animation and bookkeeping
        let now_moving = self.dir != 0;
        if now_moving && !was_moving {
            ev = ev.or(Some(CarEvent::Started));
            self.doors = 0;
        }
        if now_moving {
            self.moving_for += 1;
            self.doors = 0;
        } else {
            self.moving_for = 0;
            if self.floor_at().is_some() {
                self.doors = (self.doors + 1).min(8);
            }
            if was_moving && !self.def.manual {
                self.wait = AUTO_WAIT;
            }
        }
        ev
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::level::SHAFTS;

    fn car_b(floor: u8) -> Car {
        Car::new(SHAFTS[1], floor)
    }
    fn run(c: &mut Car, drive: i8, n: usize, rng: &mut Rng) -> Vec<CarEvent> {
        let mut v = vec![];
        for _ in 0..n {
            if let Some(e) = c.step(drive, false, rng) {
                v.push(e);
            }
        }
        v
    }

    #[test]
    fn driving_moves_one_px_per_frame() {
        let mut c = car_b(3);
        let y0 = c.y;
        run(&mut c, -1, 10, &mut Rng::new(1));
        assert_eq!(c.y, y0 - 10);
        assert_eq!(c.dir, -1);
    }
    #[test]
    fn release_between_floors_glides_to_next_floor_in_same_direction_and_stops_level() {
        let mut rng = Rng::new(1);
        let mut c = car_b(3);
        run(&mut c, -1, 10, &mut rng);
        let ev = run(&mut c, 0, 100, &mut rng);
        assert_eq!(c.y, floor_y(4));
        assert_eq!(c.floor_at(), Some(4));
        assert!(ev.contains(&CarEvent::Stopped(4)));
        // going down
        let mut c = car_b(3);
        run(&mut c, 1, 10, &mut rng);
        run(&mut c, 0, 100, &mut rng);
        assert_eq!(c.y, floor_y(2));
    }
    #[test]
    fn exactly_one_ding_per_stop() {
        let mut rng = Rng::new(1);
        let mut c = car_b(3);
        let mut ev = run(&mut c, -1, 10, &mut rng);
        ev.extend(run(&mut c, 0, 100, &mut rng));
        assert_eq!(ev.iter().filter(|e| matches!(e, CarEvent::Stopped(_))).count(), 1);
    }
    #[test]
    fn holding_direction_at_end_of_shaft_does_not_repeat_the_ding() {
        let mut rng = Rng::new(1);
        let mut c = car_b(3);
        let mut ev = run(&mut c, -1, 200, &mut rng);
        assert_eq!(c.y, floor_y(4));
        assert!(ev.iter().filter(|e| matches!(e, CarEvent::Stopped(_))).count() <= 1);
        ev.clear();
        ev.extend(run(&mut c, -1, 100, &mut rng));
        assert!(ev.iter().all(|e| !matches!(e, CarEvent::Stopped(_))), "{ev:?}");
        // and releasing at the limit does not ding again either
        ev.extend(run(&mut c, 0, 50, &mut rng));
        assert!(ev.iter().all(|e| !matches!(e, CarEvent::Stopped(_))));
    }
    #[test]
    fn car_never_leaves_its_shaft() {
        let mut rng = Rng::new(1);
        let mut c = car_b(2);
        run(&mut c, 1, 1000, &mut rng);
        assert_eq!(c.y, floor_y(0));
        run(&mut c, -1, 1000, &mut rng);
        assert_eq!(c.y, floor_y(4));
    }
    #[test]
    fn opening_kinds() {
        let c = car_b(2);
        assert_eq!(c.opening(2), Opening::CarHere);
        assert_eq!(c.opening(3), Opening::Pit); // car is below floor 3
        assert_eq!(c.opening(1), Opening::Grate); // car above floor 1
        assert_eq!(c.opening(5), Opening::None);
    }
    #[test]
    fn falling_one_floor_lands_on_roof_two_floors_is_fatal() {
        let c = car_b(3);
        assert!(matches!(c.fall_into(4), Fall::Roof(_)));
        let c = car_b(2);
        assert_eq!(c.fall_into(4), Fall::Fatal);
    }
    #[test]
    fn car_coming_down_crushes_something_on_the_grate_below() {
        let mut rng = Rng::new(1);
        let mut c = car_b(4);
        c.target = Some(3);
        let mut crushed = false;
        for _ in 0..200 {
            c.step(0, false, &mut rng);
            if c.crushes_grate(3) {
                crushed = true;
            }
        }
        assert!(crushed);
        // a stationary car above never crushes
        let c = car_b(4);
        assert!(!c.crushes_grate(3));
    }
    #[test]
    fn rising_car_crushes_roof_rider_only_at_the_top() {
        let mut rng = Rng::new(1);
        let mut c = car_b(0);
        let mut crush_at = None;
        for _ in 0..400 {
            c.step(-1, false, &mut rng);
            if c.crushes_roof_rider() {
                crush_at = Some(c.y);
                break;
            }
        }
        let y = crush_at.expect("must crush eventually");
        assert!(y <= floor_y(4) + 16 + 24);
        // mid-shaft there is no crush
        let mut c = car_b(1);
        c.dir = -1;
        assert!(!c.crushes_roof_rider());
    }
    #[test]
    fn called_car_comes_and_stops_level() {
        let mut rng = Rng::new(1);
        let mut c = car_b(0);
        c.call(3);
        let ev = run(&mut c, 0, 500, &mut rng);
        assert_eq!(c.floor_at(), Some(3));
        assert!(ev.contains(&CarEvent::Stopped(3)));
        assert_eq!(c.opening(3), Opening::CarHere);
        // calling a floor the shaft does not serve is ignored
        let mut c = Car::new(SHAFTS[0], 4);
        c.call(0);
        assert!(c.target.is_none());
    }
    #[test]
    fn auto_car_waits_about_two_seconds_then_picks_another_floor() {
        let mut rng = Rng::new(5);
        let mut c = Car::new(SHAFTS[2], 3);
        let mut started_at = None;
        for i in 0..400 {
            if c.step(0, false, &mut rng) == Some(CarEvent::Started) {
                started_at = Some(i);
                break;
            }
        }
        let s = started_at.unwrap();
        assert!((100..=140).contains(&s), "{s}");
        assert_ne!(c.target, Some(3));
    }
    #[test]
    fn auto_car_never_leaves_while_occupied() {
        let mut rng = Rng::new(5);
        let mut c = Car::new(SHAFTS[2], 3);
        for _ in 0..2000 {
            c.step(0, true, &mut rng);
        }
        assert_eq!(c.floor_at(), Some(3));
        assert_eq!(c.dir, 0);
    }
    #[test]
    fn doors_closed_while_moving_open_while_stopped() {
        let mut rng = Rng::new(1);
        let mut c = car_b(3);
        run(&mut c, -1, 5, &mut rng);
        assert_eq!(c.doors, 0);
        run(&mut c, 0, 100, &mut rng);
        assert_eq!(c.doors, 8);
    }
}
