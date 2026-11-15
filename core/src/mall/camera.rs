//! Camera: follows the player on both axes, smooth but pixel-snapped, clamped inside the level.
//! The viewport is 256x224 below the 16 px HUD strip: screen y = world y - cam.y + HUD_H.

use crate::layout::{WORLD_H, WORLD_W};
use crate::pixel::{HUD_H, W};

pub const VIEW_W: i32 = W as i32;
pub const VIEW_H: i32 = 224;
pub const MAX_X: i32 = WORLD_W - VIEW_W;
pub const MAX_Y: i32 = WORLD_H - VIEW_H;
/// Where (in the viewport, from its top) the player's feet are kept when the level allows it.
pub const FEET_ROW: i32 = 138;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Camera {
    /// Whole-pixel position used for drawing.
    pub x: i32,
    pub y: i32,
    fx: i32,
    fy: i32,
}

const FP: i32 = 256;

impl Camera {
    pub fn new() -> Camera {
        Camera::default()
    }

    /// World -> screen.
    pub fn sx(&self, wx: i32) -> i32 {
        wx - self.x
    }
    pub fn sy(&self, wy: i32) -> i32 {
        wy - self.y + HUD_H
    }
    /// Is any part of the world span `[x0, x1)` visible horizontally?
    pub fn sees_x(&self, x0: i32, x1: i32) -> bool {
        x1 > self.x && x0 < self.x + VIEW_W
    }
    pub fn sees_y(&self, y0: i32, y1: i32) -> bool {
        y1 > self.y && y0 < self.y + VIEW_H
    }

    fn target(px: i32, feet_y: i32, facing: i32) -> (i32, i32) {
        let tx = (px - VIEW_W / 2 + facing * 20).clamp(0, MAX_X);
        let ty = (feet_y - FEET_ROW).clamp(0, MAX_Y);
        (tx, ty)
    }

    pub fn snap_to(&mut self, px: i32, feet_y: i32, facing: i32) {
        let (tx, ty) = Camera::target(px, feet_y, facing);
        self.fx = tx * FP;
        self.fy = ty * FP;
        self.x = tx;
        self.y = ty;
    }

    /// One frame of smooth following (horizontal 1/6, vertical 1/10 of the remaining distance).
    pub fn follow(&mut self, px: i32, feet_y: i32, facing: i32) {
        let (tx, ty) = Camera::target(px, feet_y, facing);
        self.fx += ease(tx * FP - self.fx, 6);
        self.fy += ease(ty * FP - self.fy, 10);
        self.fx = self.fx.clamp(0, MAX_X * FP);
        self.fy = self.fy.clamp(0, MAX_Y * FP);
        self.x = (self.fx + FP / 2) / FP;
        self.y = (self.fy + FP / 2) / FP;
    }
}

fn ease(diff: i32, div: i32) -> i32 {
    let d = diff / div;
    if d == 0 {
        diff.signum() * diff.abs().min(FP / 8)
    } else {
        d
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn camera_stays_inside_the_level() {
        let mut c = Camera::new();
        for (px, py) in [(0, 0), (767, 400), (-50, -50), (400, 330), (760, 20)] {
            c.snap_to(px, py, 1);
            assert!(c.x >= 0 && c.x <= MAX_X && c.y >= 0 && c.y <= MAX_Y, "{c:?}");
            for _ in 0..200 {
                c.follow(px, py, 1);
                assert!(c.x >= 0 && c.x <= MAX_X && c.y >= 0 && c.y <= MAX_Y, "{c:?}");
            }
        }
    }

    #[test]
    fn follow_converges_on_the_target() {
        let mut c = Camera::new();
        c.snap_to(100, 88, 1);
        for _ in 0..300 {
            c.follow(500, 232, 1);
        }
        let (tx, ty) = Camera::target(500, 232, 1);
        assert_eq!((c.x, c.y), (tx, ty));
    }

    #[test]
    fn world_to_screen_uses_the_hud_offset() {
        let mut c = Camera::new();
        c.snap_to(128, 0, 0);
        assert_eq!(c.sy(c.y), HUD_H);
    }
}
