//! Escalators: a moving staircase climbing right from the bottom landing (`x`, on the lower floor) to the top
//! landing (`x + ESC_W`, on the upper floor) at 1 px/frame on both axes (45 degrees). Boarding is handled by the
//! player; this module holds the ride geometry and the animation clock.

use crate::layout::{floor_y, ESCALATORS, ESC_W};

/// Frames a full ride takes (1 px per frame along both axes).
pub const RIDE_FRAMES: i32 = ESC_W;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EscState {
    /// Direction the steps move (true = up). Follows the last rider.
    pub up: bool,
    /// Animation phase in px (steps scroll along the slope).
    pub phase: u32,
    /// Frames since someone last rode it (steps keep rolling for a while).
    pub idle: u32,
}

impl Default for EscState {
    fn default() -> Self {
        EscState { up: true, phase: 0, idle: 999 }
    }
}

impl EscState {
    pub fn step(&mut self, riding: bool) {
        if riding {
            self.idle = 0;
        } else {
            self.idle = self.idle.saturating_add(1);
        }
        // the steps always crawl slowly; faster under a rider
        self.phase = self.phase.wrapping_add(if riding { 2 } else { 1 });
    }
}

/// Feet position after `t` frames of riding escalator `idx` (up: bottom -> top, down: top -> bottom).
pub fn ride_pos(idx: usize, up: bool, t: i32) -> (i32, i32) {
    let e = &ESCALATORS[idx];
    let t = t.clamp(0, RIDE_FRAMES);
    if up {
        (e.x + t, floor_y(e.lower()) - t)
    } else {
        (e.x + ESC_W - t, floor_y(e.upper) + t)
    }
}

/// Where the rider stands after stepping off: just past the landing, on the destination floor.
pub fn exit_pos(idx: usize, up: bool) -> (i32, i32) {
    let e = &ESCALATORS[idx];
    if up {
        (e.x + ESC_W + 4, floor_y(e.upper))
    } else {
        (e.x - 4, floor_y(e.lower()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ride_is_diagonal_one_pixel_per_frame() {
        let (x0, y0) = ride_pos(0, true, 0);
        let (x1, y1) = ride_pos(0, true, 10);
        assert_eq!((x1 - x0, y0 - y1), (10, 10));
        let (xe, ye) = ride_pos(0, true, RIDE_FRAMES);
        assert_eq!(ye, floor_y(ESCALATORS[0].upper));
        assert_eq!(xe, ESCALATORS[0].x + ESC_W);
        let (xd, yd) = ride_pos(1, false, RIDE_FRAMES);
        assert_eq!(yd, floor_y(ESCALATORS[1].lower()));
        assert_eq!(xd, ESCALATORS[1].x);
    }
}
