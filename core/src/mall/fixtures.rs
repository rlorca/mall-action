//! Interactive mall fixtures (spec 5.7): the directory kiosks, the photo booth and the fountains.
//!
//! * Kiosk (4F, 3F, 2F, 1F): Up at the screen opens a small map panel that highlights the nearest package
//!   store that still holds its package; then ~1200 frames cooldown.
//! * Photo booth (3F): Up hides the agent inside for up to 300 frames (spies ignore him). The first time he
//!   comes out in a game a 4-frame photo strip pops up and "PHOTO STRIP" lands in the inventory.
//! * Fountains (3F, 1F): a shot sprays 3-5 bouncing 50-point coins (1 spray in 20 hides a gold coin = an
//!   extra life), then ~900 frames cooldown. The coins themselves live in `pickups.rs` (`Drop::Coin`).

use crate::art;
use crate::copy;
use crate::events::Sfx;
use crate::input::{A, B, DOWN, UP};
use crate::layout::{self, floor_y, KIOSKS, PHOTO_BOOTH, SHAFTS, SHAFT_W, STORE_SLOTS, STORE_W, FOUNTAINS};
use crate::pixel::{pal, Fb, Rect, HUD_H};
use crate::run::RunState;
use crate::types::{Floor, StoreId, StoreRole};

use super::bullets::Owner;
use super::camera::Camera;
use super::state::{Ctx, Drop, DropKind};

pub const KIOSK_COOLDOWN: u32 = 1200;
pub const KIOSK_PANEL_FRAMES: u32 = 300;
/// Half width of the zone in front of a kiosk / the booth where Up works.
pub const USE_ZONE: i32 = 12;
pub const BOOTH_MAX_FRAMES: u32 = 300;
/// The earliest frame the agent may leave the booth again (so the Up that entered does not also exit).
pub const BOOTH_MIN_FRAMES: u32 = 12;
pub const PHOTO_STRIP_FRAMES: u32 = 200;
pub const FOUNTAIN_COOLDOWN: u32 = 900;

#[derive(Clone, Copy, Debug)]
pub struct Panel {
    pub kiosk: usize,
    pub t: u32,
    /// The package store to highlight (None: every package is found, go to the getaway car).
    pub target: Option<StoreId>,
}

#[derive(Clone, Debug)]
pub struct Fixtures {
    pub kiosk_cd: [u32; 4],
    pub panel: Option<Panel>,
    /// Frames spent hidden in the booth.
    pub booth: Option<u32>,
    /// Photo strip popup age.
    pub strip: Option<u32>,
    pub fountain_cd: [u32; 2],
}

impl Default for Fixtures {
    fn default() -> Self {
        Fixtures::new()
    }
}

/// The nearest package store that still holds its package, nearest by floors first then by distance along
/// the corridor from (`floor`, `x`).
pub fn nearest_package_store(run: &RunState, floor: Floor, x: i32) -> Option<StoreId> {
    StoreId::ALL
        .iter()
        .copied()
        .filter(|id| id.role() == StoreRole::Target && !run.store_cleared(*id))
        .min_by_key(|id| {
            let fd = (id.info().floor.index() as i32 - floor.index() as i32).abs();
            (fd, (layout::door_x(*id) - x).abs())
        })
}

impl Fixtures {
    pub fn new() -> Fixtures {
        Fixtures { kiosk_cd: [0; 4], panel: None, booth: None, strip: None, fountain_cd: [0; 2] }
    }

    pub fn clear(&mut self) {
        // a respawn takes him out of the booth and closes the panel; cooldowns carry on
        self.panel = None;
        self.booth = None;
    }

    pub fn step(&mut self, ctx: &mut Ctx) {
        let pv = ctx.core.player_view();
        for c in self.kiosk_cd.iter_mut().chain(self.fountain_cd.iter_mut()) {
            *c = c.saturating_sub(1);
        }
        let pad = ctx.pad;
        let usable = pv.grounded && !pv.dying && !pv.in_arrival && pv.riding.is_none() && !pv.on_escalator && !pv.frozen && !pv.sliding;

        // ---- kiosks
        if let Some(p) = self.panel.as_mut() {
            p.t += 1;
            let (kf, kx) = KIOSKS[p.kiosk];
            let walked_off = pv.floor != kf || (pv.x - kx).abs() > USE_ZONE + 6;
            if p.t >= KIOSK_PANEL_FRAMES || walked_off || pad.just_pressed(A) || pad.just_pressed(B) || pad.just_pressed(DOWN) {
                self.panel = None;
            }
        } else if usable && pad.just_pressed(UP) && !pv.hidden {
            for (i, (kf, kx)) in KIOSKS.iter().enumerate() {
                if pv.floor == *kf && (pv.y - floor_y(*kf)) == 0 && (pv.x - kx).abs() <= USE_ZONE {
                    if self.kiosk_cd[i] == 0 {
                        self.kiosk_cd[i] = KIOSK_COOLDOWN;
                        self.panel = Some(Panel { kiosk: i, t: 0, target: nearest_package_store(ctx.run, *kf, *kx) });
                        ctx.out.sfx(Sfx::Beep);
                    } else {
                        ctx.out.sfx(Sfx::Buzzer);
                    }
                    break;
                }
            }
        }

        // ---- the photo booth
        match self.booth {
            Some(t) => {
                let leave = t + 1 >= BOOTH_MAX_FRAMES || (t + 1 >= BOOTH_MIN_FRAMES && pad.any_pressed());
                if leave {
                    self.booth = None;
                    ctx.core.player.hidden = false;
                    ctx.out.sfx(Sfx::Door);
                    if !ctx.run.photo_done {
                        ctx.run.photo_done = true;
                        ctx.run.add_item("PHOTO STRIP", ctx.out);
                        self.strip = Some(0);
                        ctx.out.sfx(Sfx::Flash);
                        ctx.core.banner.show(&copy::you_got("PHOTO STRIP"), 150);
                    }
                } else {
                    self.booth = Some(t + 1);
                    ctx.core.player.hidden = true;
                }
            }
            None => {
                if usable && pad.just_pressed(UP) && !pv.hidden && pv.floor == PHOTO_BOOTH.0 && (pv.y - floor_y(PHOTO_BOOTH.0)) == 0 && (pv.x - PHOTO_BOOTH.1).abs() <= USE_ZONE - 2 {
                    self.booth = Some(0);
                    ctx.core.player.hidden = true;
                    ctx.core.player.ducking = false;
                    ctx.out.sfx(Sfx::Door);
                }
            }
        }
        if let Some(t) = self.strip.as_mut() {
            *t += 1;
            if *t >= PHOTO_STRIP_FRAMES {
                self.strip = None;
            }
        }

        // ---- fountains
        for (i, (ff, fx)) in FOUNTAINS.iter().enumerate() {
            if self.fountain_cd[i] > 0 {
                // a shot into a resting fountain just splashes
                continue;
            }
            let fy = floor_y(*ff);
            let r = Rect::new(fx - 16, fy - 24, 32, 24);
            if ctx.core.bullets.take_hit(r, Owner::Player).is_some() {
                self.fountain_cd[i] = FOUNTAIN_COOLDOWN;
                let n = ctx.run.rng.range(3, 5);
                let gold_idx = if ctx.run.rng.below(20) == 0 { Some(ctx.run.rng.below(n as u32) as i32) } else { None };
                for k in 0..n {
                    let x = fx + ctx.run.rng.range(-8, 8);
                    let vx16 = ctx.run.rng.range(-30, 30);
                    let vy16 = -ctx.run.rng.range(36, 60);
                    ctx.core.drops.push(Drop { floor: *ff, x, y: fy - 14, kind: DropKind::Coin { vx16, vy16, gold: gold_idx == Some(k) } });
                }
                ctx.out.sfx(Sfx::Coins);
            }
        }
    }

    // ------------------------------------------------------------------------------------------ drawing

    pub fn draw(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, tick: u32) {
        // the agent's shoes under the curtain while he hides
        if self.booth.is_some() {
            let (bf, bx) = PHOTO_BOOTH;
            let fy = floor_y(bf);
            // closed curtain over the booth, then two shoes sticking out below it
            fb.blit(art::get("photobooth"), ((tick / 40) % 2) as usize, cam.sx(bx - 12), cam.sy(fy - 32), false);
            fb.rect(cam.sx(bx - 4), cam.sy(fy - 1), 3, 1, pal::BROWN);
            fb.rect(cam.sx(bx + 1), cam.sy(fy - 1), 3, 1, pal::BROWN);
            // the flash in the window every so often
            if tick % 50 < 3 {
                fb.rect(cam.sx(bx - 5), cam.sy(fy - 27), 10, 3, pal::WHITE);
            }
        }
        // sparkles over a resting fountain
        for (i, (ff, fx)) in FOUNTAINS.iter().enumerate() {
            if self.fountain_cd[i] > FOUNTAIN_COOLDOWN - 25 {
                let fy = floor_y(*ff);
                let k = (FOUNTAIN_COOLDOWN - self.fountain_cd[i]) as i32;
                for j in 0..5 {
                    fb.put(cam.sx(fx - 12 + j * 6), cam.sy(fy - 24 - k / 3 + (j % 2) * 3), pal::LCYAN);
                }
            }
        }
    }

    /// Screen-space overlays: the kiosk panel and the photo strip.
    pub fn draw_top(&self, fb: &mut Fb, cam: &Camera, run: &RunState, tick: u32) {
        if let Some(p) = &self.panel {
            draw_panel(fb, p, run, tick);
        }
        if let Some(t) = self.strip {
            draw_strip(fb, cam, t, tick);
        }
    }
}

const PANEL_W: i32 = 128;
const PANEL_H: i32 = 82;

fn draw_panel(fb: &mut Fb, p: &Panel, run: &RunState, tick: u32) {
    let x0 = (256 - PANEL_W) / 2;
    let y0 = HUD_H + 34;
    fb.rect(x0, y0, PANEL_W, PANEL_H, pal::NAVY);
    fb.frame(x0, y0, PANEL_W, PANEL_H, pal::LCYAN);
    fb.frame(x0 + 2, y0 + 2, PANEL_W - 4, PANEL_H - 4, pal::BLUE);
    fb.text_center_tiny(x0 + PANEL_W / 2, y0 + 5, "MALL DIRECTORY", pal::WHITE);
    let (mx, my) = (x0 + 24, y0 + 14);
    let rows = Floor::ALL;
    for (r, f) in rows.iter().enumerate() {
        let ry = my + r as i32 * 9;
        fb.text_tiny(x0 + 6, ry + 1, f.label(), pal::LCYAN);
        // floor strip
        fb.rect(mx, ry + 7, 96, 1, pal::GRAY);
        for s in SHAFTS.iter().filter(|s| s.serves(*f)) {
            fb.rect(mx + s.x / 8, ry, SHAFT_W / 8, 7, pal::DGRAY);
        }
        for slot in STORE_SLOTS.iter().filter(|s| s.id.info().floor == *f) {
            let col = match slot.id.role() {
                StoreRole::Target if run.store_cleared(slot.id) => pal::DGRAY,
                StoreRole::Target => pal::RED,
                StoreRole::PowerShop => pal::BLUE,
                StoreRole::Closed => pal::CHARCOAL,
            };
            fb.rect(mx + slot.x / 8, ry + 1, STORE_W / 8, 6, col);
        }
    }
    // the highlighted store: a yellow blinking frame
    let (hf, hx, label) = match p.target {
        Some(id) => (id.info().floor, layout::store_x(id), id.info().name),
        None => (Floor::Parking, layout::CAR_X, "GETAWAY CAR"),
    };
    let hr = hf.index() as i32;
    let hy = my + hr * 9;
    if (tick / 10) % 2 == 0 {
        let w = if p.target.is_some() { STORE_W / 8 } else { layout::CAR_W / 8 };
        fb.frame(mx + hx / 8 - 1, hy, w + 2, 8, pal::YELLOW);
    }
    // you are here
    let (kf, kx) = KIOSKS[p.kiosk];
    if (tick / 6) % 2 == 0 {
        let ky = my + kf.index() as i32 * 9;
        fb.rect(mx + kx / 8 - 1, ky + 2, 3, 3, pal::WHITE);
    }
    let line = match p.target {
        Some(_) => format!("NEAREST: {label}"),
        None => "ALL FOUND! TO THE CAR".to_string(),
    };
    fb.text_center_tiny(x0 + PANEL_W / 2, y0 + PANEL_H - 9, &line, pal::YELLOW);
}

fn draw_strip(fb: &mut Fb, cam: &Camera, t: u32, tick: u32) {
    let (bf, bx) = PHOTO_BOOTH;
    let fy = floor_y(bf);
    // the strip pops out of the booth's slot and rises, holds, then blinks out
    let rise = (t * 3).min(60) as i32;
    let (sx, sy) = (cam.sx(bx + 14), cam.sy(fy - 4) - rise - 4);
    if t + 30 > PHOTO_STRIP_FRAMES && (t / 3) % 2 == 0 {
        return;
    }
    let (w, h) = (22, 4 * 15 + 5);
    let sy = sy.max(HUD_H + 1);
    fb.rect(sx, sy, w, h, pal::WHITE);
    fb.frame(sx, sy, w, h, pal::BLACK);
    let head = art::get("head_icon");
    for i in 0..4 {
        let cy = sy + 3 + i * 15;
        fb.rect(sx + 3, cy, 16, 13, [pal::SKY, pal::LMAGENTA, pal::YELLOW, pal::MINT][i as usize]);
        // four goofy poses: straight, tilted, wide-eyed, jazz hands
        let (hx, hy, flip) = [(sx + 7, cy + 3, false), (sx + 8, cy + 2, true), (sx + 6, cy + 4, false), (sx + 7, cy + 1, true)][i as usize];
        fb.blit(head, 0, hx, hy, flip);
        if i == 3 && (tick / 5) % 2 == 0 {
            fb.put(sx + 4, cy + 2, pal::WHITE);
            fb.put(sx + 17, cy + 4, pal::WHITE);
        }
    }
    fb.text_center_tiny(sx + w / 2, sy + h + 2, "PHOTO", pal::WHITE);
}

#[cfg(test)]
mod tests {}
