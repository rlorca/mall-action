//! Mall geometry helpers. Port of `game/mall/geometry.ts`.

use super::types::{Car, OpeningState};
use crate::content::layout::{floor_y, ShaftDef, CAR_H, CEILING_GAP, FLOOR_GAP, LEVEL_W, NUM_FLOORS, SHAFTS, WALL_L, WALL_R};

pub use crate::content::layout::CAR_W;

/// `floorY(f)` for an integer floor index.
#[inline]
pub fn fy(f: i32) -> f64 {
    floor_y(f as f64)
}

/// A walker's centre may overhang a shaft opening by this many px before it counts as "in" the opening.
pub const OPENING_EDGE: f64 = 4.0;
/// Safe fall: landing no more than one floor below where the fall started.
pub const MAX_SAFE_FALL: f64 = FLOOR_GAP;

pub fn floor_at_y(y: f64) -> Option<i32> {
    for f in 0..NUM_FLOORS {
        if fy(f) == y {
            return Some(f);
        }
    }
    None
}

/// Nearest floor index to a y (clamped).
pub fn nearest_floor(y: f64) -> i32 {
    let mut best = 0;
    let mut bd = f64::INFINITY;
    for f in 0..NUM_FLOORS {
        let d = (fy(f) - y).abs();
        if d < bd {
            bd = d;
            best = f;
        }
    }
    best
}

/// The shaft whose opening interior (shrunk by OPENING_EDGE) contains x on `floor`, or None.
pub fn shaft_at_x(x: f64, floor: i32) -> Option<ShaftDef> {
    for s in SHAFTS.iter() {
        if floor < s.top || floor > s.bottom {
            continue;
        }
        if x > s.x + OPENING_EDGE && x < s.x + s.w - OPENING_EDGE {
            return Some(*s);
        }
    }
    None
}

/// Any shaft (served on this floor) whose raw 24 px opening, widened by `margin`, contains x.
pub fn shaft_near(x: f64, floor: i32, margin: f64) -> Option<ShaftDef> {
    for s in SHAFTS.iter() {
        if floor < s.top || floor > s.bottom {
            continue;
        }
        if x > s.x - margin && x < s.x + s.w + margin {
            return Some(*s);
        }
    }
    None
}

pub fn car_roof_y(car: &Car) -> f64 {
    car.y - CAR_H
}

/// Y of the ceiling inside a shaft: the underside of the slab above its top floor.
pub fn shaft_ceiling_y(def: &ShaftDef) -> f64 {
    fy(def.top) - CEILING_GAP
}

pub fn car_floor_index(car: &Car) -> Option<i32> {
    floor_at_y(car.y)
}

/// What the opening of `car`'s shaft looks like on floor `floor`:
///  here    car level with the floor (walk in)
///  above   car above: a grate you can stand on (crush danger)
///  blocked car body overlaps the doorway while moving (solid)
///  pit     car roof is at or below the floor: an open pit
pub fn opening_state(car: &Car, floor: i32) -> OpeningState {
    let d = car.y - fy(floor);
    if d == 0.0 {
        OpeningState::Here
    } else if d < 0.0 {
        OpeningState::Above
    } else if d < CAR_H {
        OpeningState::Blocked
    } else {
        OpeningState::Pit
    }
}

pub fn clamp_x(x: f64) -> f64 {
    (WALL_L + 4.0).max((WALL_R - 4.0).min(x))
}

pub fn in_level(x: f64) -> bool {
    x >= 0.0 && x <= LEVEL_W
}
