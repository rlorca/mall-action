//! The SPYGRAM post card (parody photo app): magenta header, photo, caption, like counter, one comment.

use crate::copy::Post;
use crate::pixel::Fb;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Photo {
    /// The agent on the roof, selfie pose (arrival).
    Roof,
    /// The agent beside the station wagon (mission complete).
    Getaway,
}

/// Draw the card at (x, y). `t` = frames since the card appeared (likes climb quickly).
pub fn draw_card(_fb: &mut Fb, _x: i32, _y: i32, _post: &Post, _photo: Photo, _t: u32) {}
/// Card size in pixels (w, h).
pub const CARD_W: i32 = 168;
pub const CARD_H: i32 = 168;
