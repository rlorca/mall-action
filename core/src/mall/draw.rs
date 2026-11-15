//! Drawing the mall: a polished side-scrolling corridor per floor. Read-only: everything here only paints
//! into the framebuffer from `Mall` state. All positions are whole pixels (world -> screen via `Camera`).
//!
//! Paint order: sky / roof, per-floor corridor walls, slabs (floor tiles), shaft columns, storefronts,
//! decor, escalators, elevator cars, hook modules (lights, pickups, npcs, spies), the agent, bullets,
//! effects, banner, arrival overlay.

use crate::art;
use crate::art::storefront::{draw_storefront, FrontState};
use crate::copy;
use crate::layout::{self, floor_y, ESCALATORS, ESC_W, SHAFTS, SHAFT_W, STORE_SLOTS, STORE_W, WALL_L, WALL_R, WORLD_H, WORLD_W};
use crate::pixel::{pal, Fb, Rect, HUD_H};
use crate::run::RunState;
use crate::screens::spygram::{self, Photo};
use crate::types::{Floor, StoreRole};
use crate::ui;

use super::arrival::{self, Phase};
use super::camera::{Camera, VIEW_H, VIEW_W};
use super::player::Mode;
use super::state::{EffectKind, Core, BANNER_Y};
use super::world::{self, DecorKind, CAR_H, CORRIDOR_H, SLAB};
use super::Mall;

// ------------------------------------------------------------------------------------------ themes

#[derive(Clone, Copy)]
struct Theme {
    wall: u8,
    wall2: u8,
    trim: u8,
    dado: u8,
    dado2: u8,
    tile_a: u8,
    tile_b: u8,
    slab: u8,
    slab_dark: u8,
    accent: u8,
}

fn theme(f: Floor) -> Theme {
    match f {
        // roof: concrete deck
        Floor::Roof => Theme { wall: pal::GRAY, wall2: pal::LGRAY, trim: pal::LGRAY, dado: pal::DGRAY, dado2: pal::CHARCOAL, tile_a: pal::GRAY, tile_b: pal::DGRAY, slab: pal::CHARCOAL, slab_dark: pal::BLACK, accent: pal::YELLOW },
        // 4F fashion: bubble-gum pink and plum
        Floor::F4 => Theme { wall: pal::LPINK, wall2: pal::PINK, trim: pal::WHITE, dado: pal::PLUM, dado2: pal::MAROON, tile_a: pal::WHITE, tile_b: pal::LAVENDER, slab: pal::PLUM, slab_dark: pal::MAROON, accent: pal::MAGENTA },
        // 3F toys and kitsch: mint and teal
        Floor::F3 => Theme { wall: pal::PALEGREEN, wall2: pal::MINT, trim: pal::WHITE, dado: pal::TEAL, dado2: pal::DCYAN, tile_a: pal::WHITE, tile_b: pal::MINT, slab: pal::TEAL, slab_dark: pal::DCYAN, accent: pal::CYAN },
        // 2F music and disco: deep purple with magenta
        Floor::F2 => Theme { wall: pal::DPURPLE, wall2: pal::PURPLE, trim: pal::LMAGENTA, dado: pal::BLACK, dado2: pal::DPURPLE, tile_a: pal::PLUM, tile_b: pal::BLACK, slab: pal::DPURPLE, slab_dark: pal::BLACK, accent: pal::LMAGENTA },
        // 1F sports and books: sky blue and navy
        Floor::F1 => Theme { wall: pal::LCYAN, wall2: pal::SKY, trim: pal::WHITE, dado: pal::BLUE, dado2: pal::DBLUE, tile_a: pal::WHITE, tile_b: pal::LCYAN, slab: pal::DBLUE, slab_dark: pal::NAVY, accent: pal::YELLOW },
        // P: bare concrete
        Floor::Parking => Theme { wall: pal::DGRAY, wall2: pal::CHARCOAL, trim: pal::GRAY, dado: pal::BLACK, dado2: pal::CHARCOAL, tile_a: pal::DGRAY, tile_b: pal::CHARCOAL, slab: pal::CHARCOAL, slab_dark: pal::BLACK, accent: pal::YELLOW },
    }
}

fn hash(a: i32, b: i32) -> u32 {
    let mut h = (a as u32).wrapping_mul(0x9E37_79B1) ^ (b as u32).wrapping_mul(0x85EB_CA6B);
    h ^= h >> 15;
    h = h.wrapping_mul(0x2C1B_3C6D);
    h ^= h >> 12;
    h
}

struct Pen<'a> {
    fb: &'a mut Fb,
    cam: Camera,
}

impl<'a> Pen<'a> {
    fn rect(&mut self, wx: i32, wy: i32, w: i32, h: i32, c: u8) {
        self.fb.rect(self.cam.sx(wx), self.cam.sy(wy), w, h, c);
    }
    fn put(&mut self, wx: i32, wy: i32, c: u8) {
        self.fb.put(self.cam.sx(wx), self.cam.sy(wy), c);
    }
    fn sprite(&mut self, name: &str, frame: usize, wx: i32, wy: i32, flip: bool) {
        let s = art::get(name);
        self.fb.blit(s, frame, self.cam.sx(wx), self.cam.sy(wy), flip);
    }
    fn sprite_tick(&mut self, name: &str, tick: u32, period: u32, wx: i32, wy: i32) {
        let s = art::get(name);
        self.fb.blit(s, s.frame_at(tick, period), self.cam.sx(wx), self.cam.sy(wy), false);
    }
    fn line(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, c: u8) {
        let (mut x, mut y) = (x0, y0);
        let dx = (x1 - x0).abs();
        let dy = -(y1 - y0).abs();
        let sx = if x0 < x1 { 1 } else { -1 };
        let sy = if y0 < y1 { 1 } else { -1 };
        let mut err = dx + dy;
        loop {
            self.put(x, y, c);
            if x == x1 && y == y1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
    }
    fn text_c(&mut self, wx: i32, wy: i32, s: &str, c: u8) {
        self.fb.text_center_tiny(self.cam.sx(wx), self.cam.sy(wy), s, c);
    }
    /// Visible world x range.
    fn xr(&self) -> (i32, i32) {
        (self.cam.x, self.cam.x + VIEW_W)
    }
}

// ------------------------------------------------------------------------------------------ entry

pub fn draw_mall(m: &Mall, fb: &mut Fb, run: &RunState, tick: u32) {
    let core = &m.core;
    let mut cam = core.cam;
    if core.shake > 0 {
        let k = (core.shake.min(24) / 6 + 1) as i32;
        cam.x = (cam.x + if tick % 2 == 0 { k } else { -k }).clamp(0, super::camera::MAX_X);
        cam.y = (cam.y + if (tick / 2) % 2 == 0 { k / 2 } else { -(k / 2) }).clamp(0, super::camera::MAX_Y);
    }
    let old = fb.set_clip(Rect::new(0, HUD_H, VIEW_W, VIEW_H));
    {
        let mut pen = Pen { fb, cam };
        draw_sky_and_roof(&mut pen, run, tick);
        for f in Floor::ALL {
            if !pen.cam.sees_y(floor_y(f) - 48, floor_y(f) + 4) && f != Floor::Parking {
                continue;
            }
            draw_corridor(&mut pen, f, tick);
        }
        for f in Floor::ALL {
            draw_slab(&mut pen, f);
        }
        draw_shafts(&mut pen, core, tick);
        for f in Floor::ALL {
            draw_floor_fixtures(&mut pen, f, run, tick, core.wagon_lights);
        }
        draw_escalators(&mut pen, core, tick);
        draw_cars(&mut pen, core, tick);
        draw_roof_front(&mut pen, tick);
    }
    // hook modules paint between the scene and the agent
    m.lights.draw(fb, &cam, run, tick);
    m.pickups.draw(fb, &cam, run, tick);
    m.fixtures.draw(fb, &cam, run, tick);
    m.npcs.draw(fb, &cam, run, tick);
    m.spies.draw(fb, &cam, run, tick);
    {
        let mut pen = Pen { fb, cam };
        draw_player(&mut pen, core, tick);
        draw_bullets(&mut pen, core);
        draw_effects(&mut pen, core);
    }
    m.spies.draw_top(fb, &cam, run, tick);
    m.npcs.draw_top(fb, &cam, run, tick);
    m.fixtures.draw_top(fb, &cam, run, tick);
    m.pickups.draw_top(fb, &cam, run, tick);
    m.events.draw_top(fb, &cam, run, tick);
    fb.set_clip(old);
    fb.reset_clip();
    // UI on top (screen space)
    fb.set_clip(Rect::new(0, HUD_H, VIEW_W, VIEW_H));
    core.banner.draw(fb, BANNER_Y, pal::WHITE, pal::NAVY, pal::LCYAN);
    draw_arrival_overlay(fb, core, tick);
    fb.reset_clip();
}

// ------------------------------------------------------------------------------------------ sky and roof

fn draw_sky_and_roof(p: &mut Pen, _run: &RunState, tick: u32) {
    let (x0, x1) = p.xr();
    let roof_y = floor_y(Floor::Roof);
    // night sky bands with dithered seams
    let bands: [(i32, u8, u8); 5] = [
        (0, pal::NAVY, pal::NAVY),
        (22, pal::DBLUE, pal::NAVY),
        (40, pal::DPURPLE, pal::DBLUE),
        (58, pal::PLUM, pal::DPURPLE),
        (74, pal::MAROON, pal::PLUM),
    ];
    for (i, (y, c, c_prev)) in bands.iter().enumerate() {
        let y_end = if i + 1 < bands.len() { bands[i + 1].0 } else { roof_y + 8 };
        p.rect(x0, *y, x1 - x0, y_end - *y, *c);
        // 3px dither seam into the previous band
        for dy in 0..3 {
            for x in x0..x1 {
                if (x + dy + *y) & 1 == 0 {
                    p.put(x, *y + dy, *c_prev);
                }
            }
        }
    }
    // stars
    for sx in (x0 - x0.rem_euclid(8))..x1 {
        if sx.rem_euclid(8) != 0 {
            continue;
        }
        let h = hash(sx, 3);
        if h % 5 == 0 {
            let y = (h >> 8) as i32 % 52;
            let tw = (tick / 20 + h) % 6 == 0;
            p.put(sx + (h >> 20) as i32 % 6, y, if tw { pal::WHITE } else { pal::LAVENDER });
        }
    }
    // moon
    let (mx, my) = (600, 22);
    for dy in -7i32..=7 {
        for dx in -7i32..=7 {
            if dx * dx + dy * dy <= 40 {
                let shade = dx * dx + dy * dy > 30 || (dx + 2) * (dx + 2) + (dy - 1) * (dy - 1) < 6;
                p.put(mx + dx, my + dy, if shade { pal::LYELLOW } else { pal::WHITE });
            }
        }
    }
    // distant city skyline in two layers
    for layer in 0..2 {
        let (col, win, base) = if layer == 0 { (pal::DPURPLE, pal::PLUM, 70) } else { (pal::BLACK, pal::YELLOW, 78) };
        let step = if layer == 0 { 14 } else { 10 };
        let mut x = x0 - x0.rem_euclid(step) - step;
        while x < x1 {
            let h = hash(x / step, layer + 11);
            let bw = 10 + (h % 3) as i32 * 2;
            let bh = 8 + ((h >> 4) % if layer == 0 { 22 } else { 14 }) as i32;
            p.rect(x, base - bh + 10, bw, bh, col);
            for wy in (base - bh + 12..base + 8).step_by(4) {
                for wx in (x + 2..x + bw - 2).step_by(3) {
                    if hash(wx, wy + layer) % 4 == 0 {
                        p.put(wx, wy, win);
                    }
                }
            }
            x += step;
        }
    }
    // the dark skyscraper at the left edge (with a bracket for the zip line)
    let flick = ((tick / 40) % 2) as usize;
    p.sprite("skyscraper", flick, -24, -6, false);
    // the mall's roof level, antenna masts, dish
    p.rect(300, roof_y - 34, 1, 34, pal::GRAY);
    p.rect(296, roof_y - 28, 9, 1, pal::GRAY);
    if (tick / 30) % 2 == 0 {
        p.put(300, roof_y - 36, pal::RED);
        p.put(300, roof_y - 35, pal::LRED);
    }
    p.rect(668, roof_y - 40, 1, 40, pal::GRAY);
    p.rect(664, roof_y - 34, 9, 1, pal::GRAY);
    p.rect(664, roof_y - 24, 9, 1, pal::GRAY);
    if (tick / 30) % 2 == 1 {
        p.put(668, roof_y - 42, pal::RED);
    }
}

/// Roof deck: parapet, vents and the zip-line cable with its anchor post. Drawn behind the agent.
fn draw_roof_front(p: &mut Pen, tick: u32) {
    let ry = floor_y(Floor::Roof);
    let (x0, x1) = p.xr();
    // back parapet along the whole roof, with a coping stone line
    p.rect(0, ry - 12, WORLD_W, 12, pal::CHARCOAL);
    for x in (x0 - x0.rem_euclid(16)..x1).step_by(16) {
        p.rect(x, ry - 12, 1, 12, pal::DGRAY);
        p.rect(x + 8, ry - 7, 1, 7, pal::DGRAY);
    }
    p.rect(0, ry - 12, WORLD_W, 2, pal::GRAY);
    p.rect(0, ry - 10, WORLD_W, 1, pal::DGRAY);
    // rooftop clutter standing on the deck (behind the agent's plane)
    for (x, kind) in [(30, 0), (140, 1), (380, 0), (470, 2), (610, 1), (700, 0)] {
        match kind {
            0 => {
                // AC unit
                p.rect(x, ry - 20, 22, 14, pal::GRAY);
                p.rect(x, ry - 20, 22, 2, pal::LGRAY);
                p.rect(x, ry - 8, 22, 2, pal::DGRAY);
                for i in 0..4 {
                    p.rect(x + 3 + i * 5, ry - 17, 3, 7, pal::DGRAY);
                }
                p.rect(x + 18, ry - 17, 2, 2, pal::GREEN);
            }
            1 => {
                // vent stack
                p.rect(x, ry - 22, 8, 16, pal::LGRAY);
                p.rect(x, ry - 22, 8, 2, pal::WHITE);
                p.rect(x + 6, ry - 20, 2, 14, pal::GRAY);
                p.rect(x - 2, ry - 24, 12, 3, pal::GRAY);
            }
            _ => {
                // water tank
                p.rect(x, ry - 26, 18, 18, pal::BROWN);
                p.rect(x, ry - 26, 18, 2, pal::ORANGE);
                for i in 0..3 {
                    p.rect(x, ry - 22 + i * 5, 18, 1, pal::DBROWN);
                }
                p.rect(x + 2, ry - 8, 2, 4, pal::DGRAY);
                p.rect(x + 14, ry - 8, 2, 4, pal::DGRAY);
            }
        }
    }
    let (ex, ey) = arrival::cable_end();
    let (sx, sy) = arrival::CABLE_START;
    // bracket on the skyscraper, then the cable (sags a hair with a dark underside)
    p.rect(sx - 4, sy - 2, 6, 4, pal::LGRAY);
    p.rect(sx - 4, sy + 2, 6, 1, pal::DGRAY);
    p.line(sx, sy, ex, ey, pal::LGRAY);
    p.line(sx, sy + 1, ex, ey + 1, pal::DGRAY);
    p.sprite("anchor_post", 0, ANCHOR_LEFT, ry - 24, false);
    let _ = tick;
}

const ANCHOR_LEFT: i32 = layout::ANCHOR_X - 4;

// ------------------------------------------------------------------------------------------ corridors

fn draw_corridor(p: &mut Pen, f: Floor, tick: u32) {
    if f == Floor::Roof {
        return;
    }
    let th = theme(f);
    let sy = floor_y(f);
    let top = sy - CORRIDOR_H;
    let (x0, x1) = p.xr();
    // back wall
    p.rect(0, top, WORLD_W, CORRIDOR_H, th.wall);
    // pilasters every 32 px: lit edge + shadow edge
    let first = x0 - x0.rem_euclid(32) - 32;
    let mut x = first;
    while x < x1 {
        if x >= 0 {
            p.rect(x, top + 2, 1, CORRIDOR_H - 12, th.wall2);
            p.rect(x + 1, top + 2, 1, CORRIDOR_H - 12, th.wall2);
            p.rect(x + 2, top + 2, 1, CORRIDOR_H - 12, th.trim);
        }
        x += 32;
    }
    match f {
        Floor::F2 => {
            // disco: faint sparkles
            for sx in (x0..x1).step_by(5) {
                let h = hash(sx, 9);
                if h % 6 == 0 {
                    let y = top + 2 + (h >> 6) as i32 % 28;
                    let on = (tick / 6 + h) % 5 != 0;
                    p.put(sx, y, if on { pal::LMAGENTA } else { pal::PURPLE });
                }
            }
        }
        Floor::Parking => {
            // concrete formwork lines and tie holes
            for yy in [top + 12, top + 26] {
                p.rect(0, yy, WORLD_W, 1, th.wall2);
            }
            for sx in (x0 - x0.rem_euclid(16)..x1).step_by(16) {
                p.put(sx + 8, top + 19, th.wall2);
                p.put(sx + 8, top + 33, th.wall2);
            }
        }
        _ => {
            // a pin stripe near the ceiling
            p.rect(0, top + 5, WORLD_W, 1, th.wall2);
        }
    }
    // ceiling cove: shadowed lip under the slab above + light strip
    p.rect(0, top, WORLD_W, 1, th.slab_dark);
    p.rect(0, top + 1, WORLD_W, 1, th.trim);
    // dado (wainscot) and baseboard
    p.rect(0, sy - 10, WORLD_W, 10, th.dado);
    p.rect(0, sy - 11, WORLD_W, 1, th.trim);
    let mut x = first;
    while x < x1 {
        p.rect(x + 8, sy - 9, 1, 7, th.dado2);
        p.rect(x + 24, sy - 9, 1, 7, th.dado2);
        x += 16;
    }
    p.rect(0, sy - 2, WORLD_W, 2, th.dado2);
    // outer walls: dark brick, with a window slit
    for (wx, w) in [(0, WALL_L), (WALL_R, WORLD_W - WALL_R)] {
        p.rect(wx, top, w, CORRIDOR_H, pal::BLACK);
        for yy in (top..sy).step_by(4) {
            p.rect(wx, yy, w, 1, pal::CHARCOAL);
            p.rect(wx + ((yy / 4) % 2) * 3 + 2, yy + 1, 1, 3, pal::CHARCOAL);
        }
    }
}

fn draw_slab(p: &mut Pen, f: Floor) {
    let th = theme(f);
    let sy = floor_y(f);
    let (x0, x1) = p.xr();
    let h = if f == Floor::Parking { WORLD_H - sy } else { SLAB };
    // body
    p.rect(0, sy, WORLD_W, h, th.slab);
    // top face: tile row (checker), then the tile edge
    let start = x0 - x0.rem_euclid(8) - 8;
    let mut x = start;
    while x < x1 {
        let alt = (x / 8) % 2 == 0;
        p.rect(x, sy, 8, 1, if alt { th.tile_a } else { th.tile_b });
        p.rect(x, sy + 1, 8, 1, if alt { th.tile_b } else { th.tile_a });
        x += 8;
    }
    // underside shadow row
    p.rect(0, sy + h - 1, WORLD_W, 1, th.slab_dark);
    if f == Floor::Parking {
        // bare concrete ground: parking bay lines and oil stains
        p.rect(0, sy, WORLD_W, 2, pal::GRAY);
        for bx in (x0 - x0.rem_euclid(48)..x1).step_by(48) {
            p.rect(bx + 20, sy, 2, 2, pal::YELLOW);
        }
        for yy in (sy + 4..sy + h).step_by(6) {
            p.rect(0, yy, WORLD_W, 1, pal::DGRAY);
        }
    }
}

// ------------------------------------------------------------------------------------------ shafts and cars

fn draw_shafts(p: &mut Pen, core: &Core, tick: u32) {
    for (i, s) in SHAFTS.iter().enumerate() {
        let top = world::ceiling_y(s.top);
        let bot = floor_y(s.bottom);
        // dark column from the top ceiling to the bottom platform; guide rails and cross-bracing
        p.rect(s.x, top, SHAFT_W, bot - top, pal::BLACK);
        p.rect(s.x + 1, top, 1, bot - top, pal::DGRAY);
        p.rect(s.x + SHAFT_W - 2, top, 1, bot - top, pal::DGRAY);
        for y in (top..bot).step_by(8) {
            let k = (y - top) / 8;
            p.put(s.x + 2 + (k % 2) * 17, y, pal::CHARCOAL);
        }
        // door frames on each served floor, grates over openings when the car is above
        for f in s.floors() {
            let fy = floor_y(f);
            let state = core.opening(s.id, f);
            if f != s.bottom {
                // pit / grate in the slab
                if state == Some(world::Opening::GrateAbove) {
                    p.sprite("elev_grate", 0, s.x, fy, false);
                }
            } else if state != Some(world::Opening::CarHere) {
                p.sprite("elev_grate", 0, s.x, fy, false);
            }
            p.sprite("elev_door_frame", 0, s.x, fy - CAR_H, false);
            // floor indicator lamp above the door
            let c = &core.cars[i];
            let lit = c.level_floor() == Some(f);
            p.rect(s.x + 4, fy - CORRIDOR_H + 1, SHAFT_W - 8, 5, pal::BLACK);
            p.rect(s.x + 5, fy - CORRIDOR_H + 2, SHAFT_W - 10, 3, if lit { pal::GREEN } else { pal::DGRAY });
            let _ = tick;
        }
        // hoist cable down to the roof of the car
        let c = &core.cars[i];
        p.rect(s.center_x(), top, 1, (c.y - CAR_H - top).max(0), pal::GRAY);
    }
}

fn draw_cars(p: &mut Pen, core: &Core, tick: u32) {
    for (i, c) in core.cars.iter().enumerate() {
        let s = &SHAFTS[i];
        p.sprite("elev_car", c.door_frame(), s.x, c.y - CAR_H, false);
        let _ = tick;
    }
}

// ------------------------------------------------------------------------------------------ storefronts and decor

fn draw_floor_fixtures(p: &mut Pen, f: Floor, run: &RunState, tick: u32, _core_wagon: bool) {
    if f == Floor::Roof {
        return;
    }
    let sy = floor_y(f);
    let (x0, x1) = p.xr();
    // storefronts
    for slot in STORE_SLOTS.iter().filter(|s| s.id.info().floor == f) {
        if slot.x + STORE_W < x0 || slot.x > x1 {
            continue;
        }
        let st = FrontState { cleared: run.store_cleared(slot.id), tick, black_friday: run.black_friday };
        let (sxp, syp) = (p.cam.sx(slot.x), p.cam.sy(sy));
        draw_storefront(p.fb, slot.id, sxp, syp, &st);
        // radar: a blinking exclamation over target stores that still hold a package
        if run.power.radar && slot.id.role() == StoreRole::Target && !run.store_cleared(slot.id) && (tick / 20) % 2 == 0 {
            p.sprite("exclaim", 0, slot.x + STORE_W / 2 - 4, sy - 54, false);
        }
    }
    // kiosks, booth, fountains
    for (kf, cx) in layout::KIOSKS {
        if kf == f {
            p.sprite_tick("kiosk", tick, 24, cx - 12, sy - 32);
        }
    }
    if layout::PHOTO_BOOTH.0 == f {
        p.sprite_tick("photobooth", tick, 40, layout::PHOTO_BOOTH.1 - 12, sy - 32);
    }
    for (ff, cx) in layout::FOUNTAINS {
        if ff == f {
            p.sprite_tick("fountain", tick, 8, cx - 16, sy - 24);
        }
    }
    // benches, plants, vending machines, bins
    for it in world::decor_items(f) {
        if it.x + 24 < x0 || it.x > x1 {
            continue;
        }
        match it.kind {
            DecorKind::Plant => p.sprite_tick("plant", tick, 40, it.x, sy - 24),
            DecorKind::Bench => p.sprite("bench", 0, it.x, sy - 12, false),
            DecorKind::Vending => p.sprite("vending", 0, it.x, sy - 24, false),
            DecorKind::Trash => p.sprite("trash_can", 0, it.x, sy - 12, false),
        }
    }
    // parking: pillars, the getaway wagon and the exit sign
    if f == Floor::Parking {
        for px in world::pillar_xs() {
            if px + 16 < x0 || px > x1 {
                continue;
            }
            p.sprite("pillar", 0, px, sy - 48, false);
        }
        p.sprite("station_wagon", if _core_wagon { 1 } else { 0 }, layout::CAR_X, sy - 24, false);
        p.sprite("exit_sign", 0, layout::CAR_X + 20, sy - 40, false);
        // painted "P" on the wall
        p.fb.text_scaled(p.cam.sx(36), p.cam.sy(sy - 34), "P", pal::YELLOW, 2);
    }
    // directory sign on the wall above kiosks is part of the kiosk sprite; show the floor's name on the left wall
    let name = f.label();
    p.rect(WALL_L + 1, sy - 30, 14, 10, pal::BLACK);
    p.text_c(WALL_L + 8, sy - 28, name, theme(f).accent);
}

// ------------------------------------------------------------------------------------------ escalators

fn draw_escalators(p: &mut Pen, core: &Core, _tick: u32) {
    for (idx, e) in ESCALATORS.iter().enumerate() {
        let st = &core.escs[idx];
        let sy_l = floor_y(e.lower());
        let sy_u = floor_y(e.upper);
        let dir = if st.up { 1 } else { -1 };
        let top_clip = sy_u + 2;
        // shadow under the staircase
        for i in 0..=ESC_W {
            let y_surf = sy_l - i;
            let y0 = (y_surf + 10).max(top_clip);
            let y1 = sy_l;
            if y1 > y0 && i % 2 == 0 {
                p.rect(e.x + i, y0, 2, y1 - y0, pal::BLACK);
            }
        }
        // truss
        for i in 0..=ESC_W {
            let ys = sy_l - i;
            for k in 0..10 {
                let y = ys + k;
                if y >= top_clip && y < sy_l {
                    p.put(e.x + i, y, if k < 2 { pal::LGRAY } else if k < 8 { pal::GRAY } else { pal::DGRAY });
                }
            }
        }
        // moving steps: bright tread lines scrolling along the slope
        let phase = (st.phase / 2) as i32 * dir;
        for i in 0..=ESC_W {
            let ys = sy_l - i;
            if ys < top_clip {
                continue;
            }
            let seg = (i + phase).rem_euclid(8);
            if seg == 0 {
                p.rect(e.x + i, ys, 1, 3, pal::BLACK);
            } else if seg < 5 {
                p.put(e.x + i, ys, pal::WHITE);
                p.put(e.x + i, ys + 1, pal::LGRAY);
            }
        }
        // handrail and balustrade (glass: dithered), clamped to the lower corridor
        let rail_top = sy_u + SLAB;
        for i in 0..=ESC_W {
            let yr = sy_l - i - 16;
            if yr < rail_top {
                break;
            }
            p.put(e.x + i, yr, pal::BLACK);
            p.put(e.x + i, yr - 1, pal::WHITE);
            if i % 12 == 0 {
                p.rect(e.x + i, yr, 1, 16, pal::DGRAY);
            }
            if i % 2 == 0 {
                let c = pal::LCYAN;
                for k in 2..15 {
                    if (i / 2 + k) % 2 == 0 && yr + k < sy_l - i && yr + k >= rail_top {
                        p.put(e.x + i, yr + k, c);
                    }
                }
            }
        }
        // newel posts and landing plates
        p.rect(e.x - 2, sy_l - 18, 3, 18, pal::DGRAY);
        p.rect(e.x - 2, sy_l - 19, 3, 1, pal::LGRAY);
        p.rect(e.x + ESC_W - 8, sy_u, 16, 2, pal::LGRAY);
        for k in 0..8 {
            p.rect(e.x + ESC_W - 8 + k * 2, sy_u, 1, 2, pal::DGRAY);
        }
        p.rect(e.x - 6, sy_l, 14, 1, pal::LGRAY);
    }
}

// ------------------------------------------------------------------------------------------ the agent

fn draw_player(p: &mut Pen, core: &Core, tick: u32) {
    let pl = &core.player;
    if pl.hidden {
        return;
    }
    let x = pl.x;
    let feet = pl.y();
    let flip = pl.facing < 0;
    let mut name = "agent_stand";
    let mut frame = 0usize;
    let mut visible = true;
    match pl.mode {
        Mode::Dying { t } => {
            name = "agent_die";
            frame = ((t / 8) as usize).min(2);
        }
        Mode::Riding { car } => {
            let c = &core.cars[car];
            // hidden behind closed doors while the car moves
            visible = c.door_frame() > 0;
        }
        Mode::Escalator { .. } => {}
        Mode::Normal => {
            if let Some(a) = &core.arrival {
                match a.phase {
                    Phase::Slide => name = "agent_hang",
                    Phase::Drop => name = "agent_jump",
                    Phase::Crouch => name = "agent_crouch",
                    Phase::Selfie => {
                        name = "agent_selfie";
                        frame = ((a.t / 10) % 2) as usize;
                    }
                }
            } else if !pl.grounded {
                name = if pl.jumped && pl.kick { "agent_kick" } else { "agent_jump" };
            } else if pl.slide_dir != 0 {
                // skidding on the wet floor (still kicking if he landed a jump-kick on it)
                name = if pl.slide_kick { "agent_kick" } else { "agent_slip" };
            } else if pl.frozen > 0 {
                name = "agent_stand";
            } else if pl.ducking {
                name = if pl.aim > 0 { "agent_aim_duck" } else { "agent_duck" };
            } else if pl.aim > 0 {
                name = "agent_aim";
            } else if pl.moving {
                name = "agent_walk";
                frame = ((pl.walk_t / 6) % 4) as usize;
            }
        }
    }
    if pl.invuln > 0 && (pl.invuln / 3) % 2 == 1 && !matches!(pl.mode, Mode::Dying { .. }) {
        visible = false;
    }
    if !visible {
        return;
    }
    let _ = tick;
    p.sprite(name, frame, x - 8, feet - 24, flip);
    // detained by the mall cop: stars circle his head
    if pl.frozen > 0 {
        let f = ((tick / 4) % 3) as usize;
        let off = [(-6, -3), (0, -6), (6, -3)][(tick as usize / 6) % 3];
        p.sprite("spark", f, x - 4 + off.0, feet - 30 + off.1, false);
    }
}

fn draw_bullets(p: &mut Pen, core: &Core) {
    for b in &core.bullets.list {
        let name = if b.owner == super::bullets::Owner::Player { "bullet_player" } else { "bullet_enemy" };
        p.sprite(name, 0, b.x() - 2, b.y() - 1, b.vx16 < 0);
    }
}

fn draw_effects(p: &mut Pen, core: &Core) {
    for e in &core.effects {
        match e.kind {
            EffectKind::Spark => p.sprite("spark", (e.t / 4) as usize, e.x - 4, e.y - 4, false),
            EffectKind::Puff => p.sprite("puff_smoke", (e.t / 4) as usize, e.x - 8, e.y - 8, false),
        }
    }
}

// ------------------------------------------------------------------------------------------ arrival overlay

fn draw_arrival_overlay(fb: &mut Fb, core: &Core, tick: u32) {
    let Some(a) = &core.arrival else { return };
    if a.phase != Phase::Selfie {
        return;
    }
    let t = a.t;
    let pl = &core.player;
    // camera flash right at the start: phone burst next to the raised phone, then a brief white-out
    let sx = core.cam.sx(pl.x);
    let sy = core.cam.sy(pl.y());
    if t < 8 {
        let s = art::get("phone_flash");
        fb.blit(s, (t / 4) as usize, sx + 4, sy - 22, false);
        if t < 3 {
            fb.dither_rect(0, HUD_H, VIEW_W, VIEW_H, pal::WHITE, (t % 2) as i32);
        }
    }
    if t >= arrival::FLASH_FRAMES {
        // dim the world and show the SPYGRAM card
        fb.dither_rect(0, HUD_H, VIEW_W, VIEW_H, pal::BLACK, 0);
        let post = &copy::ARRIVAL_POSTS[core.post % copy::ARRIVAL_POSTS.len()];
        let x = (VIEW_W - spygram::CARD_W) / 2;
        let y = HUD_H + (VIEW_H - spygram::CARD_H) / 2;
        spygram::draw_card(fb, x, y, post, Photo::Roof, t - arrival::FLASH_FRAMES);
        if (tick / 24) % 2 == 0 {
            fb.text_center(VIEW_W / 2, HUD_H + VIEW_H - 12, "PRESS ANY BUTTON", pal::WHITE);
        }
    }
    let _ = ui::blink(tick, 1, 1);
    let _ = WALL_R;
}
