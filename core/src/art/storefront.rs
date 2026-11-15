//! Storefronts (art agent 2 owns this file). Each is ~80 px wide: sign on top, a door in the middle and a
//! display window on each side. Window displays show what the store sells.

use super::Registry;
use crate::pixel::Fb;
use crate::types::StoreId;

pub fn register(_r: &mut Registry) {}

/// Total storefront height in pixels (sign + door + windows), standing on the floor line.
pub const FRONT_H: i32 = 44;

#[derive(Clone, Copy, Debug, Default)]
pub struct FrontState {
    /// The package here has been taken (target stores): door goes dark, windows dim.
    pub cleared: bool,
    /// Animation clock in frames.
    pub tick: u32,
    /// Black Friday mode: draw a "70% OFF" sign.
    pub black_friday: bool,
}

/// Draw the storefront whose left edge is `x` and whose floor line (bottom edge) is `floor_y`.
pub fn draw_storefront(_fb: &mut Fb, _id: StoreId, _x: i32, _floor_y: i32, _st: &FrontState) {}
