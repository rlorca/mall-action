//! The mall's neutral residents (spec 5.7): the 1F janitor and his wet floor, the 2F mall walkers and the
//! Segway mall cop. None of them can be killed; each makes shooting or walking carelessly more interesting.
//!
//! * Janitor: pads back and forth in a safe stretch, periodically mops a ~48 px wet patch (yellow sign at both
//!   ends) that lasts ~600 frames. Whoever steps on it (agent or spy) slides at walking speed and cannot stop
//!   or turn until off it. The stretch is chosen so a patch can NEVER touch a shaft opening or an escalator.
//!   Bullets pass through him.
//! * Walkers: two retirees power-walking a fixed stretch of 2F. They block bullets from both sides; shooting
//!   one costs 200 points and shows "HEY!"; touching one just carries you along with it.
//! * Cop: patrols a random floor. If you SHOOT in front of him (same floor, he faces you, within 128 px) he
//!   blows the whistle and chases you for 600 frames; catching you freezes you for 180 frames and costs 500
//!   points, not a life. Bullets ping off his helmet. He cannot be killed.

use crate::art;
use crate::copy;
use crate::events::Sfx;
use crate::layout::{floor_y, SHAFTS, SHAFT_W, WALL_L, WALL_R};
use crate::pixel::{pal, Fb, Rect};
use crate::run::{RunState, PTS_COP, PTS_WALKER};
use crate::types::Floor;

use super::bubble::{self, Bubble};
use super::bullets::Owner;
use super::camera::Camera;
use super::state::{Ctx, EffectKind, PlayerView, Wet};
use super::world;

// ---- janitor
pub const PATCH_W: i32 = 48;
pub const PATCH_FRAMES: u32 = 600;
pub const MOP_FRAMES: u32 = 45;
pub const MOP_INTERVAL: u32 = 420;
pub const JANITOR_MILLI: i32 = 450;
// ---- walkers
pub const WALKER_MILLI: i32 = 600;
// ---- cop
pub const COP_PATROL_MILLI: i32 = 700;
pub const COP_CHASE_MILLI: i32 = 1150;
pub const COP_CHASE_FRAMES: u32 = 600;
pub const COP_FREEZE_FRAMES: u32 = 180;
pub const COP_WHISTLE_RANGE: i32 = 128;
/// After a detention (or a lost chase) the cop will not react for this long.
pub const COP_COOLDOWN: u32 = 600;
const COP_RELOCATE: u32 = 1800;

#[derive(Clone, Copy, Debug)]
pub struct Patch {
    pub x0: i32,
    pub x1: i32,
    pub age: u32,
}

impl Patch {
    /// Slippery once the mopping is done.
    pub fn armed(&self) -> bool {
        self.age >= MOP_FRAMES
    }
}

#[derive(Clone, Debug)]
pub struct Janitor {
    pub x: i32,
    pub dir: i32,
    /// Frames into the current mopping, if mopping.
    pub mop: Option<u32>,
    pub until_mop: u32,
    pub lo: i32,
    pub hi: i32,
    xacc: i32,
}

#[derive(Clone, Debug)]
pub struct Walker {
    pub floor: Floor,
    pub x: i32,
    pub dir: i32,
    pub lo: i32,
    pub hi: i32,
    pub kind: u8,
    /// Pixels moved this frame (signed): the push on whoever touches him.
    pub dx: i32,
    xacc: i32,
    anim: u32,
}

impl Walker {
    /// A walker placed by hand (tests, debug).
    pub fn test_new(floor: Floor, x: i32, dir: i32, lo: i32, hi: i32) -> Walker {
        Walker { floor, x, dir, lo, hi, kind: 0, dx: 0, xacc: 0, anim: 0 }
    }

    pub fn rect(&self) -> Rect {
        Rect::new(self.x - 6, floor_y(self.floor) - 22, 12, 22)
    }
}

#[derive(Clone, Debug)]
pub struct Cop {
    pub floor: Floor,
    pub x: i32,
    pub dir: i32,
    pub lo: i32,
    pub hi: i32,
    /// Frames of chase left.
    pub chase: u32,
    pub cool: u32,
    pub relocate: u32,
    xacc: i32,
    anim: u32,
    pause: u32,
}

impl Cop {
    /// A cop placed by hand (tests, debug).
    pub fn test_new(floor: Floor, x: i32, dir: i32) -> Cop {
        let (lo, hi) = corridor_spans(floor, 14, 80).into_iter().find(|(a, b)| x >= *a && x <= *b).unwrap_or((x - 80, x + 80));
        Cop { floor, x, dir, lo, hi, chase: 0, cool: 0, relocate: COP_RELOCATE, xacc: 0, anim: 0, pause: 0 }
    }

    pub fn rect(&self) -> Rect {
        Rect::new(self.x - 10, floor_y(self.floor) - 22, 20, 22)
    }
}

#[derive(Clone, Debug)]
pub struct Npcs {
    pub janitor: Janitor,
    pub patches: Vec<Patch>,
    pub walkers: Vec<Walker>,
    pub cop: Option<Cop>,
    pub bubbles: Vec<Bubble>,
    /// Volley groups already charged for hitting a walker.
    hey_groups: Vec<u32>,
    inited: bool,
}

impl Default for Npcs {
    fn default() -> Self {
        Npcs::new()
    }
}

fn walk(x: &mut i32, xacc: &mut i32, dir: i32, milli: i32) -> i32 {
    *xacc += milli;
    let n = *xacc / 1000;
    *xacc -= n * 1000;
    *x += dir * n;
    dir * n
}

/// The stretches of `floor` between shaft columns (and the walls), shrunk by `margin`.
pub fn corridor_spans(floor: Floor, margin: i32, min_w: i32) -> Vec<(i32, i32)> {
    let mut cols: Vec<(i32, i32)> = SHAFTS.iter().filter(|s| s.serves(floor)).map(|s| (s.x, s.x + SHAFT_W)).collect();
    cols.sort();
    let mut out = Vec::new();
    let mut cursor = WALL_L;
    for (a, b) in cols {
        if (a - margin) - (cursor + margin) >= min_w {
            out.push((cursor + margin, a - margin));
        }
        cursor = b;
    }
    if (WALL_R - margin) - (cursor + margin) >= min_w {
        out.push((cursor + margin, WALL_R - margin));
    }
    out
}

/// The janitor's patrol range on 1F: the widest free stretch (no stores, shafts, escalators, kiosk, fountain),
/// kept 16 px away from everything, so even a patch centred at either end stays clear.
pub fn janitor_range() -> (i32, i32) {
    let spans = world::free_spans(Floor::F1, 16, PATCH_W + 16);
    let best = spans.into_iter().max_by_key(|(a, b)| b - a).unwrap_or((WALL_L + 40, WALL_L + 40 + PATCH_W + 16));
    (best.0 + PATCH_W / 2, best.1 - PATCH_W / 2)
}

/// Where the two walkers pace on 2F: stretches well clear of every shaft opening.
pub fn walker_ranges() -> [(i32, i32); 2] {
    let a = SHAFTS[0].x - 28;
    let c = SHAFTS[2].x + SHAFT_W + 28;
    [(WALL_L + 24, a), (c, WALL_R - 24)]
}

impl Npcs {
    pub fn new() -> Npcs {
        let (lo, hi) = janitor_range();
        Npcs {
            janitor: Janitor { x: (lo + hi) / 2, dir: 1, mop: None, until_mop: 240, lo, hi, xacc: 0 },
            patches: Vec::new(),
            walkers: Vec::new(),
            cop: None,
            bubbles: Vec::new(),
            hey_groups: Vec::new(),
            inited: false,
        }
    }

    /// Tests / debug: no walkers, no cop (the janitor keeps mopping).
    pub fn disable_roamers(&mut self) {
        self.inited = true;
        self.walkers.clear();
        self.cop = None;
    }

    pub fn clear(&mut self) {
        // bubbles and the cop's chase end with a respawn; the janitor and his patches carry on
        self.bubbles.clear();
        if let Some(c) = self.cop.as_mut() {
            c.chase = 0;
            c.cool = 120;
        }
    }

    fn init(&mut self, ctx: &mut Ctx) {
        self.inited = true;
        for (i, (lo, hi)) in walker_ranges().iter().enumerate() {
            let x = ctx.run.rng.range(*lo, *hi);
            let dir = if ctx.run.rng.chance(0.5) { 1 } else { -1 };
            self.walkers.push(Walker { floor: Floor::F2, x, dir, lo: *lo, hi: *hi, kind: i as u8, dx: 0, xacc: 0, anim: 0 });
        }
        self.cop = Some(Npcs::new_cop(ctx, None));
    }

    fn new_cop(ctx: &mut Ctx, avoid: Option<(Floor, i32)>) -> Cop {
        let floors = [Floor::F4, Floor::F3, Floor::F2, Floor::F1];
        let floor = *ctx.run.rng.pick(&floors);
        let spans = corridor_spans(floor, 14, 80);
        let (lo, hi) = *ctx.run.rng.pick(&spans);
        let mut x = ctx.run.rng.range(lo, hi);
        if let Some((af, ax)) = avoid {
            if af == floor && (x - ax).abs() < 160 {
                x = if ax - lo > hi - ax { lo } else { hi };
            }
        }
        Cop { floor, x, dir: if ctx.run.rng.chance(0.5) { 1 } else { -1 }, lo, hi, chase: 0, cool: 0, relocate: COP_RELOCATE, xacc: 0, anim: 0, pause: 0 }
    }

    pub fn step(&mut self, ctx: &mut Ctx) {
        if !self.inited {
            self.init(ctx);
        }
        bubble::step_all(&mut self.bubbles);
        let pv = ctx.core.player_view();
        self.step_janitor(ctx);
        self.step_walkers(ctx, &pv);
        self.step_cop(ctx, &pv);
    }

    // ------------------------------------------------------------------------------------------ janitor

    fn step_janitor(&mut self, ctx: &mut Ctx) {
        let j = &mut self.janitor;
        match j.mop {
            Some(t) => {
                if t + 1 >= MOP_FRAMES {
                    j.mop = None;
                    j.until_mop = MOP_INTERVAL + ctx.run.rng.below(180);
                } else {
                    j.mop = Some(t + 1);
                }
            }
            None => {
                walk(&mut j.x, &mut j.xacc, j.dir, JANITOR_MILLI);
                if j.x <= j.lo {
                    j.x = j.lo;
                    j.dir = 1;
                } else if j.x >= j.hi {
                    j.x = j.hi;
                    j.dir = -1;
                }
                j.until_mop = j.until_mop.saturating_sub(1);
                if j.until_mop == 0 {
                    j.mop = Some(0);
                    // the patch is centred on him; the range already keeps it inside the safe stretch
                    let (x0, x1) = (j.x - PATCH_W / 2, j.x + PATCH_W / 2);
                    self.patches.push(Patch { x0, x1, age: 0 });
                    if self.patches.len() > 2 {
                        self.patches.remove(0);
                    }
                }
            }
        }
        for p in self.patches.iter_mut() {
            p.age += 1;
        }
        self.patches.retain(|p| p.age < PATCH_FRAMES);
        ctx.core.wet.retain(|w| w.floor != Floor::F1);
        for p in self.patches.iter().filter(|p| p.armed()) {
            ctx.core.wet.push(Wet { floor: Floor::F1, x0: p.x0, x1: p.x1 });
        }
    }

    // ------------------------------------------------------------------------------------------ walkers

    fn step_walkers(&mut self, ctx: &mut Ctx, pv: &PlayerView) {
        for w in self.walkers.iter_mut() {
            w.anim += 1;
            w.dx = walk(&mut w.x, &mut w.xacc, w.dir, WALKER_MILLI);
            if w.x <= w.lo {
                w.x = w.lo;
                w.dir = 1;
            } else if w.x >= w.hi {
                w.x = w.hi;
                w.dir = -1;
            }
        }
        // bullets stop dead against them, from both sides
        let mut hits: Vec<(usize, u32, Owner, i32, i32)> = Vec::new();
        for (bi, b) in ctx.core.bullets.list.iter().enumerate() {
            for w in self.walkers.iter() {
                if b.floor == w.floor && b.rect().intersects(&w.rect()) {
                    hits.push((bi, b.group, b.owner, b.x(), b.y()));
                    break;
                }
            }
        }
        for (bi, group, owner, bx, by) in hits.iter().rev().map(|h| (h.0, h.1, h.2, h.3, h.4)) {
            ctx.core.bullets.list.remove(bi);
            ctx.core.add_effect(EffectKind::Spark, bx, by);
            if owner == Owner::Player && !self.hey_groups.contains(&group) {
                self.hey_groups.push(group);
                if self.hey_groups.len() > 12 {
                    self.hey_groups.remove(0);
                }
                ctx.run.add_score(PTS_WALKER, ctx.out);
                ctx.out.sfx(Sfx::Buzzer);
                // the walker nearest the shot says it
                if let Some(w) = self.walkers.iter().filter(|w| w.floor == ctx.core.player_view().floor).min_by_key(|w| (w.x - bx).abs()) {
                    self.bubbles.push(Bubble::new(w.x, floor_y(w.floor) - 26, copy::HEY, 70));
                }
            }
        }
        // touching one just carries you along
        if pv.grounded && !pv.dying && !pv.hidden && !pv.in_arrival && pv.riding.is_none() && !pv.on_escalator && !pv.frozen {
            for w in self.walkers.iter() {
                if w.floor == pv.floor && w.dx != 0 && w.rect().intersects(&pv.hitbox) {
                    let p = &mut ctx.core.player;
                    p.x = (p.x + w.dx).clamp(WALL_L + 4, WALL_R - 4);
                    break;
                }
            }
        }
    }

    // ------------------------------------------------------------------------------------------ cop

    fn step_cop(&mut self, ctx: &mut Ctx, pv: &PlayerView) {
        let Some(mut cop) = self.cop.take() else { return };
        cop.anim += 1;
        cop.cool = cop.cool.saturating_sub(1);
        let fy = floor_y(cop.floor);
        let on_floor = pv.floor == cop.floor && pv.grounded && pv.riding.is_none() && !pv.on_escalator && !pv.dying && !pv.in_arrival && (pv.y - fy).abs() <= 2;

        // ---- the whistle: only when you shoot in front of him
        if cop.chase == 0 && cop.cool == 0 && !pv.dying {
            let shot = ctx.core.bullets.list.iter().any(|b| b.owner == Owner::Player && b.age == 0 && b.floor == cop.floor);
            let toward = if pv.x >= cop.x { 1 } else { -1 };
            if shot && pv.floor == cop.floor && cop.dir == toward && (pv.x - cop.x).abs() <= COP_WHISTLE_RANGE && !pv.hidden {
                cop.chase = COP_CHASE_FRAMES;
                ctx.out.sfx(Sfx::Whistle);
                self.bubbles.push(Bubble::new(cop.x, fy - 26, copy::COP_WHISTLE, 110));
            }
        }

        // ---- bullets ping off his helmet
        let rect = cop.rect();
        let mut pinged: Vec<usize> = Vec::new();
        for (bi, b) in ctx.core.bullets.list.iter().enumerate() {
            if b.floor == cop.floor && b.rect().intersects(&rect) {
                pinged.push(bi);
            }
        }
        for bi in pinged.into_iter().rev() {
            let b = ctx.core.bullets.list.remove(bi);
            ctx.core.add_effect(EffectKind::Spark, b.x(), b.y());
            ctx.out.sfx(Sfx::HelmetPing);
        }

        // ---- movement
        if cop.chase > 0 {
            cop.chase -= 1;
            let same = pv.floor == cop.floor && !pv.dying && pv.riding.is_none() && !pv.on_escalator;
            if !same {
                // the agent got away (other floor, in a car): the chase is over
                cop.chase = 0;
                cop.cool = COP_COOLDOWN / 2;
            } else {
                let d = if pv.x >= cop.x { 1 } else { -1 };
                cop.dir = d;
                if (pv.x - cop.x).abs() > 2 {
                    walk(&mut cop.x, &mut cop.xacc, d, COP_CHASE_MILLI);
                    cop.x = cop.x.clamp(cop.lo, cop.hi);
                }
                if cop.chase == 0 {
                    cop.cool = COP_COOLDOWN / 2;
                }
            }
            // caught him
            if cop.chase > 0 && on_floor && pv.hittable() && cop.rect().intersects(&pv.hitbox) {
                ctx.core.player.frozen = COP_FREEZE_FRAMES;
                ctx.core.player.ducking = false;
                ctx.run.add_score(PTS_COP, ctx.out);
                ctx.out.sfx(Sfx::Buzzer);
                self.bubbles.push(Bubble::new(pv.x, pv.y - 26, copy::DETAINED, 150));
                cop.chase = 0;
                cop.cool = COP_COOLDOWN;
            }
        } else if cop.pause > 0 {
            cop.pause -= 1;
        } else {
            walk(&mut cop.x, &mut cop.xacc, cop.dir, COP_PATROL_MILLI);
            if cop.x <= cop.lo {
                cop.x = cop.lo;
                cop.dir = 1;
                cop.pause = 30;
            } else if cop.x >= cop.hi {
                cop.x = cop.hi;
                cop.dir = -1;
                cop.pause = 30;
            } else if ctx.run.rng.below(600) == 0 {
                cop.pause = 60;
                if ctx.run.rng.chance(0.5) {
                    cop.dir = -cop.dir;
                }
            }
        }

        // ---- off to patrol elsewhere now and then (never in view)
        if cop.chase == 0 {
            cop.relocate = cop.relocate.saturating_sub(1);
            let far = (cop.floor.index() as i32 - pv.floor.index() as i32).abs() >= 2 || (cop.x - pv.x).abs() > 320;
            if cop.relocate == 0 && far {
                let keep = cop.cool;
                cop = Npcs::new_cop(ctx, Some((pv.floor, pv.x)));
                cop.cool = keep;
            }
        }
        self.cop = Some(cop);
    }

    // ------------------------------------------------------------------------------------------ drawing

    pub fn draw(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, tick: u32) {
        // wet patches and their signs
        let fy1 = floor_y(Floor::F1);
        for p in &self.patches {
            let w = if p.age < MOP_FRAMES { (p.x1 - p.x0) * p.age as i32 / MOP_FRAMES as i32 } else { p.x1 - p.x0 };
            let cx = (p.x0 + p.x1) / 2;
            let (x0, x1) = (cx - w / 2, cx + w / 2);
            let fading = p.age + 60 >= PATCH_FRAMES;
            for x in x0..x1 {
                if fading && (x + tick as i32 / 6) % 3 == 0 {
                    continue;
                }
                let edge = x == x0 || x == x1 - 1;
                let shine = (x - x0 + tick as i32 / 3) % 13 < 2;
                let top = if edge { pal::BLUE } else if shine { pal::WHITE } else { pal::LCYAN };
                fb.put(cam.sx(x), cam.sy(fy1 - 3), if edge { pal::BLUE } else { pal::SKY });
                fb.put(cam.sx(x), cam.sy(fy1 - 2), top);
                fb.put(cam.sx(x), cam.sy(fy1 - 1), if shine { pal::LCYAN } else { pal::CYAN });
                fb.put(cam.sx(x), cam.sy(fy1), pal::BLUE);
            }
            if p.age >= 6 {
                fb.blit(art::get("wet_sign"), 0, cam.sx(p.x0 - 6), cam.sy(fy1 - 12), false);
                fb.blit(art::get("wet_sign"), 0, cam.sx(p.x1 - 2), cam.sy(fy1 - 12), true);
            }
        }
        // the janitor
        {
            let j = &self.janitor;
            let (name, frame) = match j.mop {
                Some(t) => ("janitor_mop", ((t / 8) % 2) as usize),
                None => ("janitor_walk", ((tick / 14) % 2) as usize),
            };
            fb.blit(art::get(name), frame, cam.sx(j.x - 8), cam.sy(fy1 - 24), j.dir < 0);
        }
        for w in &self.walkers {
            let name = if w.kind == 0 { "walker_a" } else { "walker_b" };
            fb.blit(art::get(name), ((w.anim / 6) % 4) as usize, cam.sx(w.x - 8), cam.sy(floor_y(w.floor) - 24), w.dir < 0);
        }
        if let Some(c) = &self.cop {
            let fy = floor_y(c.floor);
            if cam.sees_x(c.x - 12, c.x + 12) {
                fb.blit(art::get("cop_segway"), ((c.anim / 10) % 2) as usize, cam.sx(c.x - 12), cam.sy(fy - 24), c.dir < 0);
                // the flashing light on his helmet while he chases
                if c.chase > 0 && (tick / 4) % 2 == 0 {
                    fb.put(cam.sx(c.x - c.dir * 3), cam.sy(fy - 25), pal::RED);
                    fb.put(cam.sx(c.x - c.dir * 3 + 1), cam.sy(fy - 25), pal::LRED);
                } else if c.chase > 0 {
                    fb.put(cam.sx(c.x - c.dir * 3), cam.sy(fy - 25), pal::LCYAN);
                }
            }
        }
    }

    pub fn draw_top(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, _tick: u32) {
        bubble::draw_all(&self.bubbles, fb, cam);
    }
}

#[cfg(test)]
mod tests {}
