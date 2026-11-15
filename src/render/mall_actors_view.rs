use super::screen_fx::{blink_on, draw_sprite_by_name_sized, hash01};
use crate::content::copy::{packages_left, UI};
use crate::content::layout::{floor_y, FLOOR_NAMES, LEVEL_W, NUM_FLOORS, SHAFTS};
use crate::content::stores::{StoreId, STORES, STORE_W};
use crate::engine::font::{draw_text, Align, TextOpts, FONT_TINY};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::engine::sprite::{make_recolor, Recolor};
use crate::game::levelstate::{store_status, StoreStatus};
use crate::game::mall::modules::booth::STRIP_CELLS;
use crate::game::mall::modules::cop::CopMode;
use crate::game::mall::modules::fountains::SPRAY_FRAMES;
use crate::game::mall::modules::fx::{Fx, FxKind};
use crate::game::mall::modules::janitor::{JanitorMode, JANITOR_FLOOR, PATCH_W};
use crate::game::mall::modules::lamps::{LampKind, LampMode, DARK_HALF_W};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

/// Mall furniture and NPCs: everything the mall "extras" modules (src/game/mall/modules) put in the world.
/// Reads `world.extras`; never mutates the rules.
///
///   draw_mall_furniture  state-dependent STATIC things that sit behind the characters: kiosks (screen on while used),
///                        the photo booth (curtain), fountains, hanging lamps / disco balls on their cords (and the
///                        remains of broken ones), the wet patch with its sign.
///   draw_mall_actors     janitor, walkers, cop, falling lamps and rolling disco balls, glass and sparks, then the
///                        DARKNESS of shattered lamps, then the kiosk map panel and the photo strip popup.
///
/// Call order for the integrator: backdrop -> furniture -> cars/spies/agent -> actors -> bubbles/popups/banner -> HUD.
/// (The darkness darkens whatever is already in the framebuffer, so it must come after the characters but before the
/// HUD; it is clipped to the play view anyway so it can never touch the HUD strip.)
///
/// World coordinates in, screen coordinates out: screenX = x - camX, screenY = y - camY + 16 (the HUD strip).
///
/// Rust port note: the TS read `w.run.level` for the directory panel; here the `Run` is passed next to the world, and
/// the camera is the already rounded whole-pixel camera of `draw_mall`.
const HUD_H: i32 = 16;
const VIEW_W: i32 = 256;
const VIEW_H: i32 = 224;

fn sx(x: f64, cam_x: i32) -> i32 {
    round_i(x - cam_x as f64)
}
fn sy(y: f64, cam_y: i32) -> i32 {
    round_i(y - cam_y as f64) + HUD_H
}
fn offscreen(x: i32, w: i32) -> bool {
    x + w < 0 || x > VIEW_W
}
fn fl(f: i32) -> f64 {
    floor_y(f as f64)
}

const CEILING: f64 = 40.0;

/// The second walker's tracksuit is recoloured so the pair can be told apart.
fn walker_alt() -> Recolor {
    make_recolor(&[(c::TEAL, c::PINKRED)])
}

// =============================================================== furniture

pub fn draw_mall_furniture(fb: &mut Framebuffer, w: &MallWorld, _run: &Run, cam_x: i32, cam_y: i32, frame: i32) {
    let ex = match &w.extras {
        Some(e) => e,
        None => return,
    };
    fb.push_clip(0, HUD_H, VIEW_W, VIEW_H);

    // kiosks: the screen is on while somebody is looking at the directory
    for (i, k) in ex.kiosks.kiosks.iter().enumerate() {
        let x = sx(k.x, cam_x);
        if offscreen(x, 24) {
            continue;
        }
        draw_sprite_by_name_sized(fb, "kiosk", x, sy(fl(k.floor), cam_y) - 32, &BlitOpts::default().frame(if ex.kiosks.screen_on(i) { 1 } else { 0 }), 24, 32);
    }

    // photo booth: curtain closed (feet visible) while the agent is inside
    {
        let x = sx(ex.booth.x, cam_x);
        if !offscreen(x, 24) {
            draw_sprite_by_name_sized(fb, "booth", x, sy(fl(ex.booth.floor), cam_y) - 32, &BlitOpts::default().frame(if ex.booth.occupied() { 1 } else { 0 }), 24, 32);
        }
    }

    // fountains: lively water when ready, still while cooling down; a jet of droplets after a spray
    for f in ex.fountains.fountains.iter() {
        let x = sx(f.x, cam_x);
        if offscreen(x, f.w as i32) {
            continue;
        }
        let y = sy(fl(f.floor), cam_y);
        let f0 = if f.cool > 0 && f.spray == 0 { 0 } else { (frame >> (if f.spray > 0 { 2 } else { 3 })) & 3 };
        draw_sprite_by_name_sized(fb, "fountain", x, y - 24, &BlitOpts::default().frame(f0), f.w as i32, 24);
        if f.spray > 0 {
            draw_jets(fb, x as f64 + f.w / 2.0, y - 24, SPRAY_FRAMES - f.spray);
        }
    }

    // the wet patch and its sign
    if let Some(patch) = &ex.janitor.patch {
        let x0 = sx(patch.x - PATCH_W / 2.0, cam_x);
        if !offscreen(x0, PATCH_W as i32) {
            draw_wet_patch(fb, x0, sy(fl(JANITOR_FLOOR), cam_y), frame, patch.t);
        }
    }

    // hanging lamps and disco balls (falling / rolling ones are drawn with the actors)
    for l in ex.lamps.lamps.iter() {
        let x = sx(l.x, cam_x);
        if offscreen(x, 16) && offscreen(sx(l.home_x, cam_x), 16) {
            continue;
        }
        let fy = fl(l.floor);
        let ceil = sy(fy - CEILING, cam_y);
        let hx = sx(l.home_x, cam_x);
        if l.mode == LampMode::Hung {
            let bottom = sy(l.y, cam_y);
            if l.kind == LampKind::Lamp {
                fb.v_line(hx, ceil, bottom - 10 - ceil, c::BLACK);
                draw_sprite_by_name_sized(fb, "lamp.shade", hx - 6, bottom - 10, &BlitOpts::default().frame(0), 12, 10);
            } else {
                fb.v_line(hx, ceil, bottom - 12 - ceil, c::LTGRAY);
                draw_sprite_by_name_sized(fb, "disco.ball", hx - 6, bottom - 12, &BlitOpts::default().frame((frame >> 3) & 3), 12, 12);
            }
        } else {
            // the cord stub left hanging at the ceiling, and the wreck on the floor
            fb.v_line(hx, ceil, 3, if l.kind == LampKind::Lamp { c::BLACK } else { c::LTGRAY });
            if l.mode == LampMode::Broken {
                draw_sprite_by_name_sized(fb, "lamp.broken", sx(l.x, cam_x) - 6, sy(fy, cam_y) - 10, &BlitOpts::default(), 12, 10);
            }
        }
    }

    fb.pop_clip();
}

/// Droplets of a fountain spray: a few arcs rising from the basin and falling back.
fn draw_jets(fb: &mut Framebuffer, cx: f64, top: i32, t: i32) {
    for i in 0..5 {
        let tt = t - i * 2;
        if tt < 0 || tt > SPRAY_FRAMES - 4 {
            continue;
        }
        let u = tt as f64 / (SPRAY_FRAMES - 4) as f64; // 0..1
        let lift = round_i(4.0 * u * (1.0 - u) * (10 + (i % 3) * 3) as f64);
        let dx = (i - 2) * 4 + round_i((u - 0.5) * (i - 2) as f64 * 4.0);
        fb.fill_rect(round_i(cx + dx as f64), top - 1 - lift, 2, 2, if i % 2 != 0 { c::WHITE } else { c::CYAN });
    }
}

/// A shiny puddle on the floor: a domed highlight over pale-blue slab rows, with glints that come and go.
fn draw_wet_patch(fb: &mut Framebuffer, x0: i32, y: i32, frame: i32, left: i32) {
    let w = PATCH_W as i32;
    let drying = left < 90 && (frame >> 2) % 2 == 0; // it flickers for the last 1.5 s
    let body = if drying { c::SKY } else { c::PALEBLUE };
    // the dome (what stands on the floor), then the two rows of the slab surface
    fb.fill_rect(x0 + 14, y - 3, w - 28, 1, c::SKY);
    fb.fill_rect(x0 + 7, y - 2, w - 14, 1, body);
    fb.fill_rect(x0 + 2, y - 1, w - 4, 1, c::SKY);
    fb.fill_rect(x0, y, w, 1, body);
    fb.fill_rect(x0, y + 1, w, 1, c::SKY);
    // glints
    let step = frame >> 3;
    for i in 0..5 {
        let px = x0 + 3 + (hash01(step, i) * (w - 6) as f64).floor() as i32;
        fb.set_pixel(px, if i % 2 != 0 { y } else { y - 1 }, c::WHITE);
    }
    // the yellow wet-floor sign stands at the patch's left end
    draw_sprite_by_name_sized(fb, "sign.wet", x0 + 4, y - 12, &BlitOpts::default(), 8, 12);
}

// =============================================================== actors

pub fn draw_mall_actors(fb: &mut Framebuffer, w: &MallWorld, run: &Run, cam_x: i32, cam_y: i32, frame: i32) {
    let ex = match &w.extras {
        Some(e) => e,
        None => return,
    };
    fb.push_clip(0, HUD_H, VIEW_W, VIEW_H);

    // ---- janitor
    {
        let j = &ex.janitor.janitor;
        let x = sx(j.x, cam_x);
        if !offscreen(x, 16) {
            let mop = j.mode == JanitorMode::Mop;
            let name = if mop { "janitor.mop" } else { "janitor.walk" };
            let f = if mop { (j.t >> 3) & 1 } else { (j.anim >> 4) & 1 };
            draw_sprite_by_name_sized(fb, name, x - 8, sy(fl(j.floor), cam_y) - 24, &BlitOpts::default().frame(f).flip_x(j.face < 0), 16, 24);
        }
    }

    // ---- mall walkers
    let alt = walker_alt();
    for (i, k) in ex.walkers.walkers.iter().enumerate() {
        let x = sx(k.x, cam_x);
        if offscreen(x, 16) {
            continue;
        }
        let f = if k.angry_t > 0 { 0 } else { ((k.anim as f64 / if k.speed < 0.7 { 9.0 } else { 6.0 }).floor() as i32) & 3 };
        let mut o = BlitOpts::default().frame(f).flip_x(k.face < 0);
        if i % 2 == 1 {
            o.recolor = Some(&alt);
        }
        draw_sprite_by_name_sized(fb, "walker.walk", x - 8, sy(k.y, cam_y) - 24, &o, 16, 24);
        if k.angry_t > 0 && (frame >> 2) % 2 == 0 {
            fb.fill_rect(x - 1 + k.face * 9, sy(k.y, cam_y) - 30, 2, 5, c::RED); // "!" over his head
        }
    }

    // ---- mall cop
    {
        let cp = &ex.cop.cop;
        let x = sx(cp.x, cam_x);
        if !offscreen(x, 24) {
            let y = sy(ex.cop.y(), cam_y);
            let moving = match cp.mode {
                CopMode::Patrol => cp.pause_t <= 0,
                CopMode::Chase => cp.whistle_t <= 0,
                _ => true,
            };
            let whistling = cp.whistle_t > 0;
            let name = if whistling { "cop.whistle" } else { "cop.segway" };
            let f = if whistling { 0 } else if moving { (cp.anim >> 3) & 1 } else { 0 };
            draw_sprite_by_name_sized(fb, name, x - 12, y - 24, &BlitOpts::default().frame(f).flip_x(cp.face < 0), 24, 24);
            if cp.mode == CopMode::Chase {
                // flashing red / blue light on the helmet
                let on = (frame >> 2) & 1;
                fb.fill_rect(x - cp.face * 3 - 1, y - 27, 3, 2, if on != 0 { c::RED } else { c::BLUE });
            }
        }
    }

    // ---- falling lamps and rolling / falling disco balls
    for l in ex.lamps.lamps.iter() {
        if l.mode != LampMode::Falling && l.mode != LampMode::Rolling && l.mode != LampMode::Fell {
            continue;
        }
        let x = sx(l.x, cam_x);
        if offscreen(x, 16) {
            continue;
        }
        let bottom = sy(l.y, cam_y);
        if l.kind == LampKind::Lamp {
            draw_sprite_by_name_sized(fb, "lamp.shade", x - 6, bottom - 10, &BlitOpts::default().frame(1), 12, 10);
            fb.v_line(x, bottom - 13, 3, c::BLACK); // the snapped cord trailing behind
        } else {
            let spin = if l.mode == LampMode::Falling { frame >> 2 } else { ((l.x.abs() / 3.0).floor() as i32) * (if l.dir >= 0 { 1 } else { -1 }) };
            draw_sprite_by_name_sized(fb, "disco.ball", x - 6, bottom - 12, &BlitOpts::default().frame(((spin % 4) + 4) % 4), 12, 12);
        }
    }

    // ---- bullet sparks and glass
    for f in ex.fx.items.iter() {
        draw_fx(fb, f, cam_x, cam_y);
    }

    // ---- darkness of shattered lamps (over everything above, under the panels)
    let half_w = DARK_HALF_W as i32;
    for z in ex.lamps.dark.iter() {
        let y0 = sy(fl(z.floor) - CEILING, cam_y);
        let h = CEILING as i32 + 8;
        let age = z.total - z.t;
        // quick fade-in and a slow fade-out: every step lowers each band one rung on the style ladder
        let fade = (if z.t < 30 { (30 - z.t + 9).div_euclid(10) } else { 0 }).max(if age < 4 { 2 } else if age < 8 { 1 } else { 0 });
        let x = sx(z.x, cam_x);
        let cx = cam_x;
        let cy = cam_y;
        let mut band = |from: i32, to: i32, rung: i32| dim_rect(fb, x + from, y0, to - from, h, rung - fade, cx, cy);
        band(-half_w + 8, half_w - 8, 3);
        band(-half_w, -half_w + 8, 2);
        band(half_w - 8, half_w, 2);
        band(-half_w - 5, -half_w, 1);
        band(half_w, half_w + 5, 1);
    }

    fb.pop_clip();

    // ---- overlays that must stay readable: kiosk map panel and the photo strip
    fb.push_clip(0, HUD_H, VIEW_W, VIEW_H);
    if let Some(panel) = &ex.kiosks.panel {
        let k = &ex.kiosks.kiosks[panel.kiosk];
        draw_kiosk_panel(fb, run, k.floor, k.x + 12.0, panel.target, panel.total - panel.t, panel.t, frame);
    }
    if let Some(strip) = &ex.booth.strip {
        draw_photo_strip(fb, sx(strip.x, cam_x), sy(strip.y, cam_y), strip.t, strip.total);
    }
    fb.pop_clip();
}

/// The ladder of "how dark": rung 0 = untouched, 1 = a light screen-door (one pixel in four black, rest a notch
/// darker), 2 = half the pixels black, 3 = very dark (the rest sinks to each hue's darkest row, half black).
/// The grid is fixed to the WORLD, so it does not shimmer when the camera scrolls. (Darkening pastel walls by two
/// NES rows lands on garish saturated colours, hence this ladder instead of a plain darken_rect.)
#[allow(clippy::too_many_arguments)]
fn dim_rect(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, rung: i32, cam_x: i32, cam_y: i32) {
    if rung <= 0 {
        return;
    }
    let r = 3.min(rung);
    let x0 = x.max(0);
    let x1 = (x + w).min(VIEW_W);
    let y0 = y.max(HUD_H);
    let y1 = (y + h).min(HUD_H + VIEW_H);
    if x1 <= x0 || y1 <= y0 {
        return;
    }
    fb.darken_rect(x0, y0, x1 - x0, y1 - y0, if r == 3 { 3 } else { 1 });
    for yy in y0..y1 {
        for xx in x0..x1 {
            let wx = xx + cam_x;
            let wy = yy + cam_y;
            let black = if r == 1 { (wx & 1) == 0 && (wy & 1) == 0 } else { ((wx + wy) & 1) == 0 };
            if black {
                fb.set_pixel(xx, yy, c::BLACK);
            }
        }
    }
}

fn draw_fx(fb: &mut Framebuffer, f: &Fx, cam_x: i32, cam_y: i32) {
    let x = sx(f.x, cam_x);
    if offscreen(x, 24) {
        return;
    }
    let y = sy(f.y, cam_y);
    let p = 1.0 - f.t as f64 / f.total as f64; // 0..1
    let frame_idx = 2.min((p * 3.0).floor() as i32);
    if f.kind == FxKind::Spark {
        draw_sprite_by_name_sized(fb, "fx.spark", x - 4, y - 4, &BlitOpts::default().frame(frame_idx), 8, 8);
        return;
    }
    // a burst of glass: three sprites flying apart
    let spread = 2.0 + p * 9.0;
    let rise = round_i((1.0f64.min(p * 1.4) * std::f64::consts::PI).sin() * 6.0);
    draw_sprite_by_name_sized(fb, "fx.glass", round_i(x as f64 - 4.0 - spread), y - 4 - rise, &BlitOpts::default().frame(frame_idx), 8, 8);
    draw_sprite_by_name_sized(fb, "fx.glass", x - 4, y - 8 - rise - round_i(p * 3.0), &BlitOpts::default().frame((frame_idx + 1) % 3), 8, 8);
    draw_sprite_by_name_sized(fb, "fx.glass", round_i(x as f64 - 4.0 + spread), y - 4 - rise, &BlitOpts::default().frame((frame_idx + 2) % 3), 8, 8);
}

// =============================================================== kiosk map panel

const PANEL_W: i32 = 128;
const PANEL_H: i32 = 80;
const ROW_H: i32 = 8;
const MAP_SCALE: f64 = 8.0; // mall px per panel px: 768 -> 96

fn status_fill(s: StoreStatus) -> Option<u8> {
    match s {
        StoreStatus::Package => Some(c::RED),
        StoreStatus::Cleared => Some(c::GRAY),
        StoreStatus::Powerup => Some(c::BLUE),
        StoreStatus::Closed => None,
    }
}

/// "MALL DIRECTORY": a little schematic of the six floors with every store, the shafts, a blinking marker for where
/// the kiosk is and the nearest store that still holds a package flashing in yellow. Screen-space panel at the top.
#[allow(clippy::too_many_arguments)]
fn draw_kiosk_panel(fb: &mut Framebuffer, run: &Run, kiosk_floor: i32, kiosk_x: f64, target: Option<StoreId>, age: i32, left: i32, frame: i32) {
    let x = (VIEW_W - PANEL_W).div_euclid(2);
    let y = HUD_H + 4;
    // slide open / closed like a shutter
    let vis = 2.max(round_i(PANEL_H as f64 * 1.0f64.min(age as f64 / 8.0).min(left as f64 / 8.0)));
    fb.push_clip(x, y, PANEL_W, vis);
    fb.fill_rect(x, y, PANEL_W, PANEL_H, c::BLACK);
    fb.stroke_rect(x, y, PANEL_W, PANEL_H, c::WHITE);
    fb.fill_rect(x + 1, y + 1, PANEL_W - 2, 11, c::DKBLUE);
    fb.h_line(x + 1, y + 12, PANEL_W - 2, c::SKY);
    draw_text(fb, UI.directory, x + PANEL_W / 2, y + 3, c::WHITE, &TextOpts::default().align(Align::Center).shadow(c::BLACK));

    let x0 = x + 16;
    let top = y + 15;
    let tiny = TextOpts::default().font(&FONT_TINY);
    // floors
    for f in 0..NUM_FLOORS {
        let ry = top + f * ROW_H;
        fb.h_line(x0, ry + ROW_H - 1, (LEVEL_W / MAP_SCALE) as i32, if f == 0 { c::WHITE } else { c::MDGRAY });
        draw_text(fb, FLOOR_NAMES[f as usize], x + 4, ry + 1, if f == kiosk_floor { c::YELLOW } else { c::LTGRAY }, &tiny);
    }
    // shafts
    for s in SHAFTS.iter() {
        fb.fill_rect(x0 + (s.x / MAP_SCALE).floor() as i32, top + s.top * ROW_H, 3, (s.bottom - s.top + 1) * ROW_H - 1, c::DKTEAL);
    }
    // stores
    let flash = blink_on(frame, 16, 9);
    for st in STORES.iter() {
        let status = store_status(&run.level, st.id);
        let bx = x0 + (st.x / MAP_SCALE).floor() as i32;
        let by = top + st.floor * ROW_H + 1;
        let bw = round_i(STORE_W / MAP_SCALE);
        let is_target = Some(st.id) == target;
        if is_target {
            fb.fill_rect(bx - 1, by - 1, bw + 2, 7, if flash { c::YELLOW } else { c::WHITE });
            fb.fill_rect(bx, by, bw, 5, if flash { c::ORANGE } else { c::RED });
        } else {
            match status_fill(status) {
                None => fb.stroke_rect(bx, by, bw, 5, c::MDGRAY),
                Some(fill) => fb.fill_rect(bx, by, bw, 5, fill),
            }
        }
    }
    // you are here
    if blink_on(frame, 24, 16) {
        let hx = x0 + (kiosk_x / MAP_SCALE).floor() as i32;
        let hy = top + kiosk_floor * ROW_H + 2;
        fb.fill_rect(hx - 1, hy - 1, 4, 6, c::BLACK);
        fb.fill_rect(hx, hy, 2, 2, c::PEACH);
        fb.fill_rect(hx, hy + 2, 2, 2, c::WHITE);
    }
    // footer: the winner, or nothing left
    let label: String = match target {
        Some(t) => STORES.iter().find(|s| s.id == t).map(|s| s.name.to_string()).unwrap_or_default(),
        None => packages_left(0),
    };
    let col = if target.is_some() { if flash { c::YELLOW } else { c::WHITE } } else { c::GREEN };
    draw_text(fb, &label, x + PANEL_W / 2, y + PANEL_H - 10, col, &TextOpts::default().align(Align::Center));
    fb.pop_clip();
}

// =============================================================== photo strip

const CELL_W: i32 = 12;
const CELL_H: i32 = 9;
const CELL_BG: [u8; 4] = [c::SKY, c::HOTPINK, c::LTGREEN, c::AMBER];
pub const STRIP_REVEAL_FRAMES: i32 = 16;

/// One photo: the agent pulling a different face in each of the four frames.
fn draw_photo_cell(fb: &mut Framebuffer, x: i32, y: i32, i: i32) {
    fb.fill_rect(x, y, CELL_W, CELL_H, CELL_BG[(i as usize) % CELL_BG.len()]);
    fb.fill_rect(x + 3, y + 1, 6, 2, c::BLACK); // hair
    fb.fill_rect(x + 3, y + 3, 6, 5, c::PEACH); // face
    fb.fill_rect(x + 2, y + 8, 8, 1, c::RED); // trench coat collar
    match i % 4 {
        0 => {
            // deadpan
            fb.set_pixel(x + 4, y + 4, c::BLACK);
            fb.set_pixel(x + 7, y + 4, c::BLACK);
            fb.fill_rect(x + 5, y + 6, 2, 1, c::BLACK);
        }
        1 => {
            // big grin
            fb.set_pixel(x + 4, y + 4, c::BLACK);
            fb.set_pixel(x + 7, y + 4, c::BLACK);
            fb.fill_rect(x + 4, y + 6, 4, 1, c::WHITE);
            fb.h_line(x + 4, y + 7, 4, c::BLACK);
        }
        2 => {
            // sunglasses
            fb.fill_rect(x + 3, y + 4, 6, 1, c::BLACK);
            fb.fill_rect(x + 5, y + 6, 2, 1, c::BLACK);
        }
        _ => {
            // wink and tongue
            fb.set_pixel(x + 4, y + 4, c::BLACK);
            fb.h_line(x + 7, y + 4, 2, c::BLACK);
            fb.fill_rect(x + 4, y + 6, 4, 1, c::BLACK);
            fb.fill_rect(x + 6, y + 7, 2, 1, c::PINKRED);
        }
    }
}

/// The four-frame photo strip popping up next to the agent after the first time he leaves the booth: the four photos
/// get "taken" one after the other (white flash), then the strip stays a moment and blinks out. (x, y) = the agent's
/// feet in screen pixels.
fn draw_photo_strip(fb: &mut Framebuffer, x: i32, y: i32, t: i32, total: i32) {
    if t > total - 24 && (t >> 2) % 2 == 1 {
        return; // blink out
    }
    let w = CELL_W + 4;
    let h = STRIP_CELLS * (CELL_H + 1) + 3;
    let pop = 8.min(t.div_euclid(2));
    let mut cx = x + 16;
    if cx + w > VIEW_W - 2 {
        cx = x - 16 - w;
    }
    let top = (HUD_H + 2).max(y - 30 - h + 8 - pop);
    fb.fill_rect(cx, top, w, h, c::WHITE);
    fb.stroke_rect(cx, top, w, h, c::BLACK);
    for i in 0..STRIP_CELLS {
        let cy = top + 2 + i * (CELL_H + 1);
        let born = 6 + i * STRIP_REVEAL_FRAMES;
        if t < born {
            fb.fill_rect(cx + 2, cy, CELL_W, CELL_H, c::BLACK);
        } else if t < born + 3 {
            fb.fill_rect(cx + 2, cy, CELL_W, CELL_H, c::WHITE); // flash
        } else {
            draw_photo_cell(fb, cx + 2, cy, i);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::pad::UP;
    use crate::game::mall::modules::booth::PhotoStrip;
    use crate::game::mall::modules::janitor::WetPatch;
    use crate::game::mall::modules::kiosks::KioskPanel;
    use crate::game::mall::modules::testrig::{make_xrig, park_cop, XRig};
    use crate::game::mall::testutil::{place, RigOpts};

    const BG: u8 = c::OFFWHITE;
    const HUD_MARK: u8 = c::LTGRAY;

    fn rig(floor: i32, x: f64) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(floor).x(x), false);
        park_cop(&mut r, 1, 60.0, -1);
        r.x().janitor.janitor.next_mop = 1_000_000_000;
        r.x().janitor.janitor.x = 30.0;
        r
    }

    fn cam_for(floor: i32, cam_x: i32) -> (i32, i32) {
        (cam_x, floor_y(floor as f64) as i32 - 150)
    }

    fn draw(r: &XRig, cam_x: i32, cam_y: i32, frame: i32) -> Framebuffer {
        draw_bg(r, cam_x, cam_y, frame, BG)
    }

    fn draw_bg(r: &XRig, cam_x: i32, cam_y: i32, frame: i32, bg: u8) -> Framebuffer {
        let mut fb = Framebuffer::new();
        fb.clear(bg);
        fb.fill_rect(0, 0, 256, 16, HUD_MARK);
        draw_mall_furniture(&mut fb, &r.w, &r.run, cam_x, cam_y, frame);
        draw_mall_actors(&mut fb, &r.w, &r.run, cam_x, cam_y, frame);
        fb
    }

    /// Number of pixels in a screen rect that are not `bg`.
    fn inked(fb: &Framebuffer, x: i32, y: i32, w: i32, h: i32) -> i32 {
        let mut n = 0;
        for yy in y..y + h {
            for xx in x..x + w {
                if fb.get_pixel(xx, yy) != BG {
                    n += 1;
                }
            }
        }
        n
    }

    #[test]
    fn draws_every_extra_without_throwing_the_same_way_twice_and_never_changes_the_rules_state() {
        let mut r = rig(3, 340.0);
        r.x().janitor.patch = Some(WetPatch { x: 200.0, t: 300 });
        r.x().booth.strip = Some(PhotoStrip { x: 150.0, y: floor_y(2.0), t: 40, total: 200 });
        r.tap(UP);
        let snap = |r: &XRig| format!("{:?}", (&r.w.player, &r.w.spies, &r.w.pickups, r.x_ref().cop.cop, &r.x_ref().walkers.walkers, &r.x_ref().lamps.lamps));
        let before = snap(&r);
        let a = draw(&r, 300, floor_y(3.0) as i32 - 150, 5);
        let b = draw(&r, 300, floor_y(3.0) as i32 - 150, 5);
        assert_eq!(a.hash(), b.hash());
        assert_eq!(snap(&r), before);
        assert!(a.count_not(BG) > 200);
    }

    #[test]
    fn does_nothing_without_the_extras() {
        let mut r = rig(4, 200.0);
        r.w.extras = None;
        let fb = draw(&r, 100, floor_y(4.0) as i32 - 150, 0);
        assert_eq!(fb.count_not(BG), 256 * 16); // only the HUD strip stand-in
    }

    #[test]
    fn draws_a_wet_patch_with_a_yellow_sign_only_while_it_exists() {
        let mut r = rig(4, 100.0);
        let (cam_x, cam_y) = cam_for(4, 100);
        let dry = draw(&r, cam_x, cam_y, 0);
        r.x().janitor.patch = Some(WetPatch { x: 200.0, t: 500 });
        let wet = draw(&r, cam_x, cam_y, 0);
        let y = floor_y(4.0) as i32 - cam_y + 16;
        assert_eq!(inked(&dry, 76, y - 14, 48, 16), 0);
        assert!(inked(&wet, 76, y - 14, 48, 16) > 40);
        // the sign (sprite colours include yellow) stands inside the patch
        let mut yellow = 0;
        for yy in y - 14..y {
            for xx in 76..124 {
                if wet.get_pixel(xx, yy) == c::YELLOW {
                    yellow += 1;
                }
            }
        }
        assert!(yellow > 3);
        // and it lines up with the patch: nothing is drawn outside its 48 px (+ the dome)
        assert_eq!(inked(&wet, 64, y - 14, 12, 16), 0);
        assert_eq!(inked(&wet, 124, y - 14, 20, 16), 0);
    }

    #[test]
    fn shows_the_kiosk_screen_only_while_it_is_being_used_and_the_curtain_of_the_booth_while_someone_is_inside() {
        let mut r = rig(2, 200.0);
        let (cam_x, cam_y) = cam_for(2, 600);
        let idle = draw(&r, cam_x, cam_y, 0);
        let idx = r.x_ref().kiosks.kiosks.iter().position(|k| k.floor == 2).unwrap();
        r.x().kiosks.panel = Some(KioskPanel { kiosk: idx, target: None, t: 100, total: 240 });
        let used = draw(&r, cam_x, cam_y, 0);
        // compare only the kiosk's own rect (the panel is drawn elsewhere)
        let kx = 650 - cam_x;
        let ky = floor_y(2.0) as i32 - cam_y + 16 - 32;
        let mut differ = 0;
        for yy in ky..ky + 32 {
            for xx in kx..kx + 24 {
                if idle.get_pixel(xx, yy) != used.get_pixel(xx, yy) {
                    differ += 1;
                }
            }
        }
        assert!(differ > 10);
        let open = draw(&r, 20, cam_y, 0);
        r.tap(UP);
        place(&mut r, 2, 132.0);
        r.tap(UP);
        assert!(r.x_ref().booth.occupied());
        let shut = draw(&r, 20, cam_y, 0);
        assert_ne!(shut.hash(), open.hash());
    }

    #[test]
    fn the_directory_panel_lists_the_floors_and_flashes_the_target_store() {
        let mut r = rig(2, 662.0);
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_some());
        r.hold(0, 20);
        let cy = floor_y(2.0) as i32 - 150;
        let a = draw(&r, 520, cy, 0);
        let b = draw(&r, 520, cy, 10);
        assert_ne!(a.hash(), b.hash()); // the highlight blinks
        // the panel sits at the top of the play view, centred, in a black box
        assert_ne!(a.get_pixel(128, 40), BG);
        assert!(inked(&a, 64, 22, 128, 60) > 2000);
    }

    #[test]
    fn a_shattered_lamp_darkens_about_96_px_of_its_floor_for_2_s_not_the_hud_and_then_it_is_light_again() {
        use crate::game::mall::modules::lamps::LampMode;
        let mut r = rig(1, 100.0);
        let idx = r.x_ref().lamps.lamps.iter().position(|l| l.floor == 1 && l.home_x == 374.0).unwrap();
        r.with_x(|x, _w, run| x.lamps.release(run, idx, 1));
        let mut n = 0;
        while r.x_ref().lamps.lamps[idx].mode != LampMode::Broken && n < 100 {
            n += 1;
            r.hold(0, 1);
        }
        r.hold(0, 10);
        assert_eq!(r.x_ref().lamps.dark.len(), 1);
        // a camera that puts this corridor right under the HUD, so an unclipped overlay would hit it
        let cam_x = 250;
        let cam_y = floor_y(1.0) as i32 - 40 - 3; // the corridor's top edge lands at screen y 19
        for (i, l) in r.x().lamps.lamps.iter_mut().enumerate() {
            if i != idx {
                l.mode = LampMode::Broken;
            }
        }
        let mut fb = Framebuffer::new();
        fb.clear(c::WHITE);
        fb.fill_rect(0, 0, 256, 16, HUD_MARK);
        draw_mall_actors(&mut fb, &r.w, &r.run, cam_x, cam_y, 0);
        let y = floor_y(1.0) as i32 - cam_y + 16 - 12;
        let lx = 374 - cam_x;
        assert_ne!(fb.get_pixel(lx, y), c::WHITE);
        assert_ne!(fb.get_pixel(lx + 30, y + 1), c::WHITE);
        assert_eq!(fb.get_pixel(lx + 70, y), c::WHITE); // outside the +-48 px (+ soft edge)
        assert_eq!(fb.get_pixel(lx - 70, y), c::WHITE);
        for xx in 0..256 {
            for yy in 0..16 {
                assert_eq!(fb.get_pixel(xx, yy), HUD_MARK);
            }
        }
        // after its 2 s the darkness is gone
        r.hold(0, 125);
        let mut fb2 = Framebuffer::new();
        fb2.clear(c::WHITE);
        draw_mall_actors(&mut fb2, &r.w, &r.run, cam_x, cam_y, 0);
        assert_eq!(fb2.get_pixel(lx, y), c::WHITE);
    }

    #[test]
    fn the_two_mall_walkers_wear_different_tracksuits() {
        let mut r = rig(3, 340.0);
        r.x().walkers.walkers[0].x = 300.0;
        r.x().walkers.walkers[1].x = 400.0;
        let fb = draw(&r, 250, floor_y(3.0) as i32 - 150, 0);
        let left = |x0: i32, col: u8| -> i32 {
            let mut n = 0;
            for yy in 100..200 {
                for xx in x0 - 50..x0 - 50 + 100 {
                    if fb.get_pixel(xx, yy) == col {
                        n += 1;
                    }
                }
            }
            n
        };
        let ax = 300 - 250;
        let bx = 400 - 250;
        // each walker is within its own window; the second is recoloured
        assert!(left(ax, c::TEAL) + left(bx, c::TEAL) > 20);
        assert!(left(bx, c::PINKRED) > 20);
        assert_eq!(left(ax, c::PINKRED), 0);
    }

    #[test]
    fn the_photo_strip_pops_up_with_its_four_photos_taken_one_after_the_other() {
        let mut r = rig(2, 132.0);
        let cam_y = floor_y(2.0) as i32 - 150;
        let mut hashes: Vec<u32> = Vec::new();
        for t in [0, 10, 26, 44, 55, 100] {
            r.x().booth.strip = Some(PhotoStrip { x: 132.0, y: floor_y(2.0), t, total: 200 });
            let h = draw(&r, 40, cam_y, 0).hash();
            if !hashes.contains(&h) {
                hashes.push(h);
            }
        }
        assert_eq!(hashes.len(), 6);
        r.x().booth.strip = None;
        let none = draw(&r, 40, cam_y, 0).hash();
        assert!(!hashes.contains(&none));
    }
}
