//! Elevator cars. Port of `game/mall/cars.ts`.

use super::geometry::{fy, floor_at_y};
use super::types::Car;
use crate::content::layout::SHAFTS;
use crate::engine::rng::Rng;

/// Px per frame: a rider driving the car, and a car that was called / driven by its timer.
pub const DRIVE_SPEED: f64 = 1.0;
pub const TRAVEL_SPEED: f64 = 2.0;
/// The automatic car waits about 2 s at a floor before choosing another.
pub const AUTO_WAIT: i32 = 120;

pub fn make_cars() -> Vec<Car> {
    // Start with the roof cars (A, C) waiting at R so the agent can ride down; B waits at 4F.
    SHAFTS
        .iter()
        .map(|def| {
            let y = fy(if def.id == crate::content::layout::ShaftId::B { 1 } else { 0 });
            Car {
                id: def.id,
                def: *def,
                y,
                prev_y: y,
                dir: 0,
                goal: None,
                last_dir: 1,
                wait: AUTO_WAIT,
                protect_floor: None,
                open: true,
                since_stop: 999,
            }
        })
        .collect()
}

/// The next floor surface y at or beyond `y` in direction `dir`, kept inside the shaft's range.
pub fn next_floor_y(car: &Car, y: f64, dir: i32) -> f64 {
    let top = fy(car.def.top);
    let bottom = fy(car.def.bottom);
    if dir < 0 {
        let mut f = car.def.bottom;
        while f >= car.def.top {
            if fy(f) <= y {
                return fy(f);
            }
            f -= 1;
        }
        return top;
    }
    for f in car.def.top..=car.def.bottom {
        if fy(f) >= y {
            return fy(f);
        }
    }
    bottom
}

pub struct CarStep {
    /// The car came to rest this frame (exactly one per stop). `floor` is its floor index (None if it stopped between floors, which never happens).
    pub stopped: bool,
    pub floor: Option<i32>,
}

/// Advance one car one frame.
/// * `drive`: the rider's input (-1 up, 0 none, 1 down) if the player is riding or standing on the roof of a car that
///   he can drive; None when nobody is driving it.
/// * `occupied`: someone is standing inside the open car (the automatic car never leaves then).
pub fn step_car(car: &mut Car, drive: Option<i32>, occupied: bool, rng: &mut Rng) -> CarStep {
    let top = fy(car.def.top);
    let bottom = fy(car.def.bottom);
    let was_moving = car.dir != 0;
    let prev = car.y;
    car.prev_y = prev;
    let mut mv = 0.0;

    if let Some(d) = drive {
        car.protect_floor = None;
        if d != 0 {
            mv = d as f64 * DRIVE_SPEED;
            car.goal = None;
            car.last_dir = d;
        } else if was_moving && car.goal.is_none() {
            // Released between floors: glide on to the next floor in the same direction.
            let g = next_floor_y(car, prev, car.last_dir);
            if g != prev {
                car.goal = Some(g);
            }
        }
    }

    if mv == 0.0 {
        if let Some(goal) = car.goal {
            let diff = goal - prev;
            if diff == 0.0 {
                car.goal = None;
            } else {
                let sp = if drive.is_some() { DRIVE_SPEED } else { TRAVEL_SPEED };
                mv = diff.signum() * sp.min(diff.abs());
                car.last_dir = if diff < 0.0 { -1 } else { 1 };
            }
        }
    }

    // Automatic timer: only when nobody drives it, it has no goal, it is at rest, and nobody is standing inside.
    if mv == 0.0 && car.goal.is_none() && drive.is_none() && !car.def.manual {
        if occupied {
            car.wait = AUTO_WAIT;
        } else if !was_moving {
            car.wait -= 1;
            if car.wait <= 0 {
                let cur = floor_at_y(car.y);
                let mut options: Vec<i32> = Vec::new();
                for f in car.def.top..=car.def.bottom {
                    if Some(f) != cur {
                        options.push(f);
                    }
                }
                if !options.is_empty() {
                    car.goal = Some(fy(*rng.pick(&options)));
                }
                car.wait = AUTO_WAIT;
            }
        }
    }

    let ny = top.max(bottom.min(prev + mv));
    car.y = ny;
    let moved = ny - prev;
    car.dir = if moved == 0.0 {
        0
    } else if moved < 0.0 {
        -1
    } else {
        1
    };
    if let Some(goal) = car.goal {
        if car.y == goal {
            car.goal = None;
        }
    }

    let stopped_now = was_moving && car.dir == 0;
    if car.dir != 0 {
        car.open = false;
        car.since_stop = 0;
    } else {
        car.since_stop += 1;
        if stopped_now {
            car.open = true;
            car.since_stop = 0;
            car.protect_floor = None;
            car.goal = None;
            car.wait = AUTO_WAIT;
        }
    }
    CarStep { stopped: stopped_now, floor: if stopped_now { floor_at_y(car.y) } else { None } }
}

/// Send a car to a floor (the player stood in / beside the opening and called).
pub fn call_car(car: &mut Car, floor: i32, by_player: bool) {
    let target = fy(floor);
    if target < fy(car.def.top) || target > fy(car.def.bottom) {
        return;
    }
    if car.y == target && car.dir == 0 {
        return;
    }
    car.goal = Some(target);
    car.protect_floor = if by_player { Some(floor) } else { None };
}
