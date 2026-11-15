//! Hanging lamps (3F, 4F, 1F, P) and disco balls (2F) (spec 5.6). Shoot the lamp's cord or shade with a
//! standing shot and it drops: it kills anything underneath (spies +300, the agent dies), shatters, shakes
//! the screen and DARKENS that stretch of corridor for ~2 s. A disco ball drops and then ROLLS the way the
//! shot was travelling, flattening spies (+300) and the agent until it reaches a wall or a pit. Lamps hang
//! again after a while. Positions come from `world::lamp_slots` (gaps between stores, never over a shaft).
//!
//! The corridor is 44 px high; a lamp hangs low enough that a STANDING shot (chest height, 15 px above the
//! floor) reaches it, so the player can take it out without jumping, and a ducking shot passes beneath.

use crate::art;
use crate::events::Sfx;
use crate::layout::{floor_y, SHAFT_W, SHAFTS, WALL_L, WALL_R};
use crate::pixel::{pal, Fb, Rect};
use crate::run::RunState;
use crate::types::Floor;

use super::bullets::Owner;
use super::camera::Camera;
use super::state::{Ctx, DeathCause, Lethal};
use super::world::{self, Opening, CORRIDOR_H};

/// Frames a corridor stays dark after a lamp falls (2 s).
pub const DARK_FRAMES: u32 = 120;
/// Half width of the dimmed stretch.
pub const DARK_HALF: i32 = 48;
/// A fallen lamp hangs again after this many frames (25 s).
pub const REHANG_FRAMES: u32 = 1500;
/// The shootable zone of a hanging lamp reaches down to this many px above the floor.
pub const HIT_FLOOR_GAP: i32 = 13;
/// Disco ball roll speed, 1/16 px per frame (1.5 px).
pub const ROLL_16: i32 = 24;
const FALL_ACCEL_16: i32 = 5;
/// Shards stay on the floor this long.
const SHARD_FRAMES: u32 = 150;
/// Sprite top of a hanging lamp / ball below the ceiling.
const LAMP_DROP: i32 = 4;
const BALL_DROP: i32 = 10;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LampState {
    Hung,
    /// Falling; `y16` is the sprite top in 1/16 px.
    Falling { y16: i32, vy16: i32, dir: i32 },
    /// A disco ball rolling on the floor; `x16` is the centre.
    Rolling { x16: i32, dir: i32 },
    /// Shattered on the floor.
    Shards { t: u32 },
    /// Waiting to be hung again.
    Gone { t: u32 },
}

#[derive(Clone, Copy, Debug)]
pub struct Lamp {
    pub floor: Floor,
    pub x: i32,
    pub ball: bool,
    pub state: LampState,
    /// Frames of darkness left around this lamp.
    pub dark: u32,
}

impl Lamp {
    fn ceiling(&self) -> i32 {
        floor_y(self.floor) - CORRIDOR_H
    }
    fn top_hung(&self) -> i32 {
        self.ceiling() + if self.ball { BALL_DROP } else { LAMP_DROP }
    }
    fn size(&self) -> (i32, i32) {
        if self.ball {
            (16, 16)
        } else {
            (16, 24)
        }
    }
    /// Sprite top when resting on the floor (lamp: the shade (13 rows) touches it; ball: it sits on it).
    fn top_landed(&self) -> i32 {
        floor_y(self.floor) - if self.ball { 16 } else { 13 }
    }
    /// The shootable zone while hung: cord, shade and the light under it.
    pub fn hit_rect(&self) -> Rect {
        let top = self.ceiling();
        let bottom = floor_y(self.floor) - HIT_FLOOR_GAP;
        Rect::new(self.x - 8, top, 16, bottom - top)
    }
    /// The deadly part while falling / rolling.
    fn lethal_rect(&self) -> Option<Rect> {
        match self.state {
            LampState::Falling { y16, .. } => {
                let top = y16 >> 4;
                Some(if self.ball { Rect::new(self.x - 7, top + 2, 14, 14) } else { Rect::new(self.x - 7, top + 3, 14, 11) })
            }
            // a little smaller than the sprite: a decently timed jump clears it
            LampState::Rolling { x16, .. } => Some(Rect::new((x16 >> 4) - 6, floor_y(self.floor) - 10, 12, 10)),
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Lights {
    pub lamps: Vec<Lamp>,
}

impl Default for Lights {
    fn default() -> Self {
        Lights::new()
    }
}

/// One palette step darker (same hue, one row down); blacks stay black.
pub fn darker(c: u8) -> u8 {
    let (row, col) = (c >> 4, c & 0x0F);
    match (row, col) {
        (_, 0x0D..=0x0F) if c != 0x3D && c != 0x2D => pal::BLACK,
        (3, 0x0D) => 0x2D,
        (2, 0x0D) => pal::BLACK,
        (0, _) => pal::BLACK,
        (3, 0) | (2, 0) => 0x10,
        (r, c) => ((r - 1) << 4) | c,
    }
}

impl Lights {
    pub fn new() -> Lights {
        let mut lamps = Vec::new();
        for f in Floor::ALL {
            for x in world::lamp_slots(f) {
                lamps.push(Lamp { floor: f, x, ball: f == Floor::F2, state: LampState::Hung, dark: 0 });
            }
        }
        Lights { lamps }
    }

    /// Respawns: everything hangs again (a fresh level), nothing is dark.
    pub fn clear(&mut self) {
        for l in self.lamps.iter_mut() {
            // lamps that are mid-fall or rolling do not survive a respawn; shards and darkness stay
            if matches!(l.state, LampState::Falling { .. } | LampState::Rolling { .. }) {
                l.state = LampState::Shards { t: 0 };
            }
        }
    }

    pub fn is_dark(&self, floor: Floor, x: i32) -> bool {
        self.lamps.iter().any(|l| l.floor == floor && l.dark > 0 && (x - l.x).abs() <= DARK_HALF)
    }

    /// Shoot the lamp at index `i` as if hit by a bullet travelling in `dir` (tests, debug).
    pub fn knock_down(&mut self, i: usize, dir: i32, ctx: &mut Ctx) {
        self.start_fall(i, dir, ctx);
    }

    fn start_fall(&mut self, i: usize, dir: i32, ctx: &mut Ctx) {
        let l = &mut self.lamps[i];
        if l.state != LampState::Hung {
            return;
        }
        l.state = LampState::Falling { y16: l.top_hung() << 4, vy16: 0, dir };
        ctx.out.sfx(Sfx::LampFall);
    }

    pub fn step(&mut self, ctx: &mut Ctx) {
        ctx.core.lethal.clear();
        let pv = ctx.core.player_view();
        for i in 0..self.lamps.len() {
            let l = self.lamps[i];
            // ---- the darkness timer
            if l.dark > 0 {
                self.lamps[i].dark -= 1;
            }
            match l.state {
                LampState::Hung => {
                    if let Some(b) = ctx.core.bullets.take_hit(l.hit_rect(), Owner::Player) {
                        let dir = if b.vx16 < 0 { -1 } else { 1 };
                        self.start_fall(i, dir, ctx);
                    }
                }
                LampState::Falling { y16, vy16, dir } => {
                    let vy = vy16 + FALL_ACCEL_16;
                    let ny = y16 + vy;
                    if (ny >> 4) >= l.top_landed() {
                        // it hits the floor
                        let rect_now = self.lamps[i].lethal_rect();
                        let landed = LampState::Falling { y16: l.top_landed() << 4, vy16: vy, dir };
                        self.lamps[i].state = landed;
                        let _ = rect_now;
                        self.lethal_hits(i, ctx, &pv);
                        ctx.out.sfx(Sfx::Glass);
                        ctx.core.request_shake(14);
                        if l.ball {
                            self.lamps[i].state = LampState::Rolling { x16: l.x << 4, dir };
                        } else {
                            self.lamps[i].state = LampState::Shards { t: 0 };
                            self.lamps[i].dark = DARK_FRAMES;
                        }
                    } else {
                        self.lamps[i].state = LampState::Falling { y16: ny, vy16: vy, dir };
                        self.lethal_hits(i, ctx, &pv);
                    }
                }
                LampState::Rolling { x16, dir } => {
                    let nx16 = x16 + dir * ROLL_16;
                    let nx = nx16 >> 4;
                    let mut stop = false;
                    let mut pit = false;
                    if nx <= WALL_L + 8 || nx >= WALL_R - 8 {
                        stop = true;
                    } else {
                        for (si, s) in SHAFTS.iter().enumerate() {
                            if s.serves(l.floor) && nx >= s.x && nx < s.x + SHAFT_W && ctx.core.opening(SHAFTS[si].id, l.floor) == Some(Opening::PitBelow) {
                                pit = true;
                            }
                        }
                    }
                    if stop || pit {
                        // splat against the wall, or gone down the shaft
                        ctx.out.sfx(if pit { Sfx::Land } else { Sfx::Glass });
                        ctx.core.request_shake(8);
                        self.lamps[i].state = if pit { LampState::Gone { t: 0 } } else { LampState::Shards { t: 0 } };
                    } else {
                        self.lamps[i].state = LampState::Rolling { x16: nx16, dir };
                        self.lethal_hits(i, ctx, &pv);
                    }
                }
                LampState::Shards { t } => {
                    self.lamps[i].state = if t + 1 >= SHARD_FRAMES { LampState::Gone { t: 0 } } else { LampState::Shards { t: t + 1 } };
                }
                LampState::Gone { t } => {
                    self.lamps[i].state = if t + 1 >= REHANG_FRAMES { LampState::Hung } else { LampState::Gone { t: t + 1 } };
                }
            }
        }
    }

    /// Publish the lethal rectangle of lamp `i` (spies die in it) and kill the agent if he is in it.
    fn lethal_hits(&mut self, i: usize, ctx: &mut Ctx, pv: &super::state::PlayerView) {
        let l = self.lamps[i];
        let Some(r) = l.lethal_rect() else { return };
        let cause = if l.ball { DeathCause::DiscoBall } else { DeathCause::Lamp };
        ctx.core.lethal.push(Lethal { floor: l.floor, rect: r, cause });
        if !pv.dying && !pv.in_arrival && pv.riding.is_none() && !pv.on_escalator && r.intersects(&pv.hitbox) {
            ctx.kill_player(cause);
        }
    }

    // ------------------------------------------------------------------------------------------ drawing

    pub fn draw(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, tick: u32) {
        // 1. darkness over the corridor wall (the scene is already painted)
        for l in &self.lamps {
            if l.dark == 0 {
                continue;
            }
            let steps = if l.dark > 40 { 2 } else { 1 };
            let fy = floor_y(l.floor);
            let (x0, x1) = ((l.x - DARK_HALF).max(WALL_L), (l.x + DARK_HALF).min(WALL_R));
            let (sx, sy) = (cam.sx(x0), cam.sy(fy - CORRIDOR_H));
            fb.map_rect(sx, sy, x1 - x0, CORRIDOR_H, |c| (0..steps).fold(c, |c, _| darker(c)));
        }
        // 2. the lamps themselves
        for l in &self.lamps {
            let (w, _) = l.size();
            if !cam.sees_x(l.x - w, l.x + w) {
                continue;
            }
            let fy = floor_y(l.floor);
            let ceil = l.ceiling();
            match l.state {
                LampState::Hung => {
                    if l.ball {
                        fb.rect(cam.sx(l.x), cam.sy(ceil), 1, BALL_DROP + 1, pal::LGRAY);
                        fb.blit(art::get("disco_ball"), ((tick / 8) % 4) as usize, cam.sx(l.x - 8), cam.sy(l.top_hung()), false);
                    } else {
                        fb.rect(cam.sx(l.x), cam.sy(ceil), 1, LAMP_DROP + 1, pal::DGRAY);
                        fb.blit(art::get("lamp"), ((tick / 50) % 2) as usize, cam.sx(l.x - 8), cam.sy(l.top_hung()), false);
                    }
                }
                LampState::Falling { y16, .. } => {
                    fb.rect(cam.sx(l.x), cam.sy(ceil), 1, 6, pal::DGRAY);
                    let name = if l.ball { "disco_ball" } else { "lamp" };
                    fb.blit(art::get(name), (tick / 3 % 2) as usize, cam.sx(l.x - 8), cam.sy(y16 >> 4), false);
                }
                LampState::Rolling { x16, dir } => {
                    // the ball spins: sparkle frame follows the distance rolled
                    let x = x16 >> 4;
                    fb.blit(art::get("disco_ball"), ((x / 3).rem_euclid(4)) as usize, cam.sx(x - 8), cam.sy(fy - 16), false);
                    // motion streak behind it
                    for k in 1..4 {
                        fb.put(cam.sx(x - dir * (9 + k * 2)), cam.sy(fy - 3 - k), pal::LAVENDER);
                    }
                }
                LampState::Shards { t } => {
                    if t < SHARD_FRAMES - 30 || (t / 3) % 2 == 0 {
                        fb.blit(art::get("lamp_shards"), ((t / 5) as usize).min(2), cam.sx(l.x - 8), cam.sy(fy - 8), false);
                    }
                }
                LampState::Gone { t } => {
                    // the cord of the missing lamp, then a blink as it is hung again
                    fb.rect(cam.sx(l.x), cam.sy(ceil), 1, 3, pal::DGRAY);
                    if t + 40 >= REHANG_FRAMES && (t / 4) % 2 == 0 {
                        fb.blit(art::get(if l.ball { "disco_ball" } else { "lamp" }), 0, cam.sx(l.x - 8), cam.sy(l.top_hung()), false);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {}
