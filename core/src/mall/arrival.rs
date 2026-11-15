//! The level arrival (spec 5.1): the agent hangs from the zip line, slides down to the anchor post, lets go,
//! drops onto the roof, lands in a crouch (thud), poses for the SPYGRAM selfie (flash, then the post card)
//! and only then gets control. Any button skips the whole thing (the press is swallowed).

use crate::events::Sfx;
use crate::input::PadState;
use crate::layout::{floor_y, ANCHOR_X};
use crate::types::Floor;

use super::state::Ctx;
use super::player::{Mode, FP, GRAVITY};

/// Cable start (high on the skyscraper) and end (top of the anchor post), world px.
pub const CABLE_START: (i32, i32) = (34, 10);
pub fn cable_end() -> (i32, i32) {
    (ANCHOR_X, floor_y(Floor::Roof) - 24)
}
/// Frames of the slide.
pub const SLIDE_FRAMES: u32 = 84;
/// How far along the cable the agent lets go (0..1).
pub const RELEASE_AT: f32 = 0.8;
pub const CROUCH_FRAMES: u32 = 18;
/// Selfie pose + flash + card, in total (2.5 s).
pub const SELFIE_FRAMES: u32 = 150;
/// The flash fires at the start of the selfie; the card appears after this many frames.
pub const FLASH_FRAMES: u32 = 24;
/// Hands hang this far above the cable? The sprite's top row is at cable y - 2; feet are 22 below the cable.
pub const HANG_FEET_DY: i32 = 22;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    Slide,
    Drop,
    Crouch,
    Selfie,
}

#[derive(Clone, Debug)]
pub struct Arrival {
    pub phase: Phase,
    /// Frames in the current phase.
    pub t: u32,
    /// Total frames since the arrival began.
    pub total: u32,
}

impl Arrival {
    pub fn new() -> Arrival {
        Arrival { phase: Phase::Slide, t: 0, total: 0 }
    }
    /// Frames since the selfie began (0 before it).
    pub fn selfie_t(&self) -> u32 {
        if self.phase == Phase::Selfie {
            self.t
        } else {
            0
        }
    }
}

impl Default for Arrival {
    fn default() -> Self {
        Arrival::new()
    }
}

/// Point on the cable after `t` slide frames (ease-in: the agent speeds up as he slides).
pub fn cable_point(t: u32) -> (i32, i32) {
    let a = (t.min(SLIDE_FRAMES) as f32) / SLIDE_FRAMES as f32;
    let p = a * (0.45 + 0.55 * a);
    let f = p * RELEASE_AT;
    cable_lerp(f)
}

pub fn cable_lerp(f: f32) -> (i32, i32) {
    let (sx, sy) = CABLE_START;
    let (ex, ey) = cable_end();
    (sx + ((ex - sx) as f32 * f).round() as i32, sy + ((ey - sy) as f32 * f).round() as i32)
}

/// (x, feet y) of the hanging agent after `t` slide frames.
pub fn hang_pos(t: u32) -> (i32, i32) {
    let (x, y) = cable_point(t);
    (x, y + HANG_FEET_DY)
}

impl<'a> Ctx<'a> {
    /// Advance the arrival one frame. Returns true while it is still running.
    pub(super) fn step_arrival(&mut self, pad: PadState) -> bool {
        let Some(mut a) = self.core.arrival.take() else { return false };
        // any button skips (and is swallowed by returning before the player ever sees it)
        if pad.any_pressed() && a.total > 0 {
            self.finish_arrival();
            return false;
        }
        if a.total == 0 {
            self.out.sfx(Sfx::Zip);
        }
        a.total += 1;
        a.t += 1;
        let ground = floor_y(Floor::Roof);
        match a.phase {
            Phase::Slide => {
                let (x, y) = hang_pos(a.t);
                let p = &mut self.core.player;
                p.x = x;
                p.set_y(y);
                p.grounded = false;
                p.facing = 1;
                if a.t >= SLIDE_FRAMES {
                    p.vy = 0;
                    a.phase = Phase::Drop;
                    a.t = 0;
                }
            }
            Phase::Drop => {
                let p = &mut self.core.player;
                p.vy = (p.vy + GRAVITY).min(5 * FP);
                p.yf += p.vy;
                if a.t % 3 == 0 {
                    p.x += 1;
                }
                if p.y() >= ground {
                    p.set_y(ground);
                    p.vy = 0;
                    p.grounded = true;
                    a.phase = Phase::Crouch;
                    a.t = 0;
                    self.out.sfx(Sfx::Thud);
                    let x = self.core.player.x;
                    self.core.add_effect(super::state::EffectKind::Puff, x, ground - 8);
                }
            }
            Phase::Crouch => {
                if a.t >= CROUCH_FRAMES {
                    a.phase = Phase::Selfie;
                    a.t = 0;
                    self.out.sfx(Sfx::Flash);
                }
            }
            Phase::Selfie => {
                if a.t >= SELFIE_FRAMES {
                    self.finish_arrival();
                    return false;
                }
            }
        }
        self.core.arrival = Some(a);
        true
    }

    /// End the arrival: the player stands on the roof, in control.
    pub(super) fn finish_arrival(&mut self) {
        self.core.arrival = None;
        let x = {
            let p = &self.core.player;
            if p.grounded && p.y() == floor_y(Floor::Roof) {
                p.x
            } else {
                ANCHOR_X - 4
            }
        };
        let y = floor_y(Floor::Roof);
        self.core.player.place(x, y);
        self.core.player.facing = 1;
        self.core.last_safe = (x, y);
        let _ = Mode::Normal;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_cable_runs_from_the_skyscraper_down_to_the_post() {
        let (sx, sy) = cable_point(0);
        assert_eq!((sx, sy), CABLE_START);
        let (ex, ey) = cable_point(SLIDE_FRAMES);
        assert!(ex > sx + 20 && ey > sy + 30, "{ex},{ey}");
        // letting go happens near the post, a little above the roof
        assert!((ANCHOR_X - ex).abs() < 14);
        assert!(ey + HANG_FEET_DY < floor_y(Floor::Roof));
    }

    #[test]
    fn the_slide_speeds_up() {
        let d1 = cable_point(20).1 - cable_point(0).1;
        let d2 = cable_point(SLIDE_FRAMES).1 - cable_point(SLIDE_FRAMES - 20).1;
        assert!(d2 > d1);
    }
}
