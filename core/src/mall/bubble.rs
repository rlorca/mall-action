//! World-anchored speech bubbles (last words, "HEY!", the cop's whistle, ...). Pure data plus a painter; the
//! hook modules own their bubbles and call `draw` from their `draw_top` (screen space, above everything).

use crate::pixel::Fb;
use crate::ui;

use super::camera::Camera;

#[derive(Clone, Debug)]
pub struct Bubble {
    /// World position the tail points at (just above the speaker's head).
    pub x: i32,
    pub y: i32,
    pub text: String,
    /// Frames shown so far / in total.
    pub t: u32,
    pub dur: u32,
    /// Speaker id (a spy id) the bubble follows, if any.
    pub follow: Option<u32>,
}

impl Bubble {
    pub fn new(x: i32, y: i32, text: &str, dur: u32) -> Bubble {
        Bubble { x, y, text: text.to_string(), t: 0, dur, follow: None }
    }

    pub fn alive(&self) -> bool {
        self.t < self.dur
    }
}

/// Advance and drop the dead ones.
pub fn step_all(v: &mut Vec<Bubble>) {
    for b in v.iter_mut() {
        b.t += 1;
    }
    v.retain(Bubble::alive);
}

pub fn draw_all(v: &[Bubble], fb: &mut Fb, cam: &Camera) {
    for b in v {
        ui::speech_bubble(fb, &b.text, cam.sx(b.x), cam.sy(b.y));
    }
}
