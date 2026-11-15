//! Mall-wide events (spec 5.7): the alarm and the PA announcements.
//!
//! * Alarm: once `run.frames` reaches `run.difficulty().alarm_frames` the alarm goes off (`run.alarm = true`,
//!   banner, siren, `Track::Alarm` through `Core::desired_track`). Spies then walk 25% faster and spawn more
//!   often (the spies hook reads `run.alarm`); the HUD (someone else's) blinks ALARM. The red flashing at the
//!   screen edges is drawn here.
//! * PA: a chime and a multi-line banner (`copy::PA_LINES`, never the same line twice in a row) about once a
//!   minute of mall time, the first at ~40 s.

use crate::copy;
use crate::events::Sfx;
use crate::pixel::{pal, Fb, HUD_H};
use crate::run::RunState;

use super::camera::{Camera, VIEW_H, VIEW_W};
use super::state::Ctx;

/// First announcement (40 s of level time).
pub const PA_FIRST: u32 = 40 * 60;
/// Then about once a minute: 60 s +-10 s.
pub const PA_EVERY: u32 = 60 * 60;
pub const PA_BANNER_FRAMES: u32 = 300;
pub const ALARM_BANNER_FRAMES: u32 = 180;
/// The siren repeats this often while the alarm runs.
pub const SIREN_EVERY: u32 = 300;

#[derive(Clone, Debug)]
pub struct Events {
    pub next_pa: u32,
    pub last_pa: Option<usize>,
    /// Number of announcements so far (tests).
    pub pa_count: u32,
    siren: u32,
}

impl Default for Events {
    fn default() -> Self {
        Events::new()
    }
}

impl Events {
    pub fn new() -> Events {
        Events { next_pa: PA_FIRST, last_pa: None, pa_count: 0, siren: 0 }
    }

    pub fn clear(&mut self) {}

    pub fn step(&mut self, ctx: &mut Ctx) {
        if ctx.core.arrival.is_some() {
            return;
        }
        // ---- the alarm
        if !ctx.run.alarm && ctx.run.frames >= ctx.run.difficulty().alarm_frames {
            ctx.run.alarm = true;
            ctx.core.banner.show(copy::ALARM_BANNER, ALARM_BANNER_FRAMES);
            ctx.out.sfx(Sfx::Alarm);
            self.siren = 0;
        } else if ctx.run.alarm {
            self.siren += 1;
            if self.siren >= SIREN_EVERY {
                self.siren = 0;
                ctx.out.sfx(Sfx::Alarm);
            }
        }
        // ---- the PA (waits politely while the alarm banner is up)
        if ctx.run.frames >= self.next_pa && !ctx.core.banner.active() {
            let n = copy::PA_LINES.len();
            let mut i = ctx.run.rng.below(n as u32) as usize;
            if Some(i) == self.last_pa {
                i = (i + 1 + ctx.run.rng.below(n as u32 - 1) as usize) % n;
            }
            self.last_pa = Some(i);
            self.pa_count += 1;
            ctx.out.sfx(Sfx::PaChime);
            ctx.core.banner.show(copy::PA_LINES[i], PA_BANNER_FRAMES);
            let jitter = ctx.run.rng.range(-600, 600);
            self.next_pa = ctx.run.frames + (PA_EVERY as i32 + jitter) as u32;
        }
    }

    /// Red alarm flashing at the screen edges.
    pub fn draw_top(&self, fb: &mut Fb, _cam: &Camera, run: &RunState, tick: u32) {
        if !run.alarm {
            return;
        }
        let left = (tick / 16) % 2 == 0;
        let phase = (tick / 2) as i32;
        let x = if left { 0 } else { VIEW_W - 8 };
        fb.dither_rect(x, HUD_H, 8, VIEW_H, pal::RED, phase);
        fb.dither_rect(x + if left { 8 } else { -6 }, HUD_H, 6, VIEW_H, pal::DRED, phase + 1);
        // a beacon in the corner
        let bx = if left { 3 } else { VIEW_W - 8 };
        fb.rect(bx, HUD_H + 3, 5, 5, pal::LRED);
        fb.rect(bx + 1, HUD_H + 4, 3, 3, pal::WHITE);
    }
}

#[cfg(test)]
mod tests {}
