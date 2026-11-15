use super::screen_fx::hash01;
use super::spygram_view::{draw_spygram, spygram_likes, SpygramOpts};
use super::widgets::{draw_banner_at, draw_bubbles, draw_popups};
use crate::art::registry::get_sprite;
use crate::art::storefront::{draw_storefront, StorefrontOpts};
use crate::content::layout::{floor_y, ARRIVAL, CAR_H, CEILING_GAP, ESCALATORS, FEATURES, LEVEL_W, NUM_FLOORS, ROOF_Y, SHAFTS, SLAB_H};
use crate::content::layout::FeatureKind;
use crate::content::stores::STORES;
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::engine::sprite::{make_recolor, Recolor};
use crate::game::levelstate::{store_status, StoreStatus};
use crate::game::mall::geometry::opening_state;
use crate::game::mall::types::{OpeningState, PlayerMode, PlayerState, Spy, SpyMode};
use crate::game::mall::world::{IntroPhase, MallWorld};
use crate::game::run::Run;

pub use crate::content::layout::LEVEL_H;

/// HUD strip height: the mall view starts below it.
pub const VIEW_TOP: i32 = 16;
pub const VIEW_H: i32 = 224;

/// An extra drawing hook: (fb, world, run, cam_x, cam_y, frame). cam_x / cam_y are the already rounded and shaken
/// camera in whole pixels.
pub type MallDrawHook = fn(&mut Framebuffer, &MallWorld, &Run, i32, i32, i32);

/// Optional extra drawing hooks supplied by the integrator (NPCs, lamps and other state-dependent
/// furniture live in their own module and draw themselves).
#[derive(Clone, Copy, Default)]
pub struct MallDrawHooks {
    pub furniture: Option<MallDrawHook>,
    pub actors: Option<MallDrawHook>,
}

fn flash() -> Recolor {
    make_recolor(&[(c::RED, c::WHITE), (c::PEACH, c::WHITE), (c::BLACK, c::YELLOW)])
}
fn ghost() -> Recolor {
    make_recolor(&[(c::RED, c::LTGRAY), (c::PEACH, c::LTGRAY)])
}
const SKY_BANDS: [u8; 8] = [c::BLACK, c::BLACK, c::DKBLUE, c::DKBLUE, c::VIOLET, c::DKBLUE, c::VIOLET, c::PURPLE0];

const CEILING_GAP_I: i32 = CEILING_GAP as i32;
const SLAB_H_I: i32 = SLAB_H as i32;
const LEVEL_W_I: i32 = LEVEL_W as i32;

/// Draw the whole mall scene (world + entities + banners) below the HUD.
/// Rust port note: the TS took the `Level` (`level.mall`, `level.run`); here the world and the run are separate.
pub fn draw_mall(fb: &mut Framebuffer, w: &MallWorld, run: &Run, frame: i32, hooks: &MallDrawHooks) {
    let shake = if w.shake > 0 { (if frame & 2 != 0 { 1 } else { -1 }) * 3.min((w.shake + 3).div_euclid(4)) } else { 0 };
    let cam_x = round_i(w.cam.x) + shake;
    let cam_y = round_i(w.cam.y) + if w.shake > 0 && frame & 1 != 0 { 1 } else { 0 };

    fb.push_clip(0, VIEW_TOP, 256, VIEW_H);
    fb.fill_rect(0, VIEW_TOP, 256, VIEW_H, c::BLACK);
    draw_sky(fb, cam_x, cam_y);
    draw_building(fb, cam_x, cam_y, frame);
    draw_storefronts(fb, run, cam_x, cam_y, frame);
    draw_shafts(fb, w, cam_x, cam_y);
    draw_features(fb, cam_x, cam_y, frame);
    draw_escalators(fb, cam_x, cam_y, frame);
    if let Some(h) = hooks.furniture {
        h(fb, w, run, cam_x, cam_y, frame);
    }
    draw_cars(fb, w, cam_x, cam_y);
    if let Some(h) = hooks.actors {
        h(fb, w, run, cam_x, cam_y, frame);
    }
    draw_spies(fb, w, cam_x, cam_y, frame);
    draw_pickups(fb, w, cam_x, cam_y, frame);
    draw_player(fb, w, run, cam_x, cam_y, frame);
    draw_bullets(fb, w, cam_x, cam_y);
    if run.alarm_on {
        draw_alarm(fb, frame);
    }
    draw_popups(fb, &w.popups, cam_x as f64, (cam_y - VIEW_TOP) as f64);
    draw_bubbles(fb, &w.bubbles, cam_x as f64, (cam_y - VIEW_TOP) as f64);
    if let Some(b) = &w.banner {
        draw_banner_at(fb, b, VIEW_TOP + 8);
    }
    draw_selfie(fb, w, run, frame);
    fb.pop_clip();
}

// ------------------------------------------------------------------ helpers
fn sx(x: f64, cam_x: i32) -> i32 {
    round_i(x - cam_x as f64)
}
fn sy(y: f64, cam_y: i32) -> i32 {
    round_i(y - cam_y as f64) + VIEW_TOP
}
fn fl(f: i32) -> f64 {
    floor_y(f as f64)
}

fn draw_sky(fb: &mut Framebuffer, cam_x: i32, cam_y: i32) {
    let top = sy(0.0, cam_y);
    let bottom = sy(ROOF_Y, cam_y);
    if bottom <= VIEW_TOP {
        return;
    }
    let band_h = (ROOF_Y / SKY_BANDS.len() as f64).ceil() as i32;
    for (i, &col) in SKY_BANDS.iter().enumerate() {
        fb.fill_rect(0, top + i as i32 * band_h, 256, band_h + 1, col);
    }
    // stars (deterministic hash, so they never shimmer between frames except by design)
    for i in 0..46 {
        let wx = (hash01(i, 1) * LEVEL_W).floor() as i32;
        let wy = (hash01(i, 2) * (ROOF_Y - 24.0)).floor() as i32;
        fb.set_pixel(sx(wx as f64, cam_x), sy(wy as f64, cam_y), if i % 5 == 0 { c::PALEYELLOW } else { c::LTGRAY });
    }
    // distant skyline
    for i in 0..26 {
        let bx = i * 32 + (hash01(i, 5) * 10.0).floor() as i32;
        let bh = 14 + (hash01(i, 6) * 30.0).floor() as i32;
        let bw = 14 + (hash01(i, 7) * 14.0).floor() as i32;
        let x = sx(bx as f64, cam_x);
        let y = sy(ROOF_Y - bh as f64, cam_y);
        fb.fill_rect(x, y, bw, bh, c::DKBLUE);
        let mut wy = 3;
        while wy < bh - 3 {
            let mut wx = 3;
            while wx < bw - 3 {
                if hash01(i * 31 + wy, wx) > 0.7 {
                    fb.set_pixel(x + wx, y + wy, c::DKGREEN);
                }
                wx += 5;
            }
            wy += 5;
        }
    }
}

/// The dark skyscraper at the left edge with lit windows, and the zip-line cable down to the anchor post.
fn draw_building(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, frame: i32) {
    let bx = sx(0.0, cam_x);
    let top = sy(ROOF_Y - 130.0, cam_y);
    let h = 130 + 40;
    fb.fill_rect(bx, top, 46, h, c::BLACK);
    fb.fill_rect(bx + 46, top, 2, h, c::DKBLUE);
    fb.fill_rect(bx, top, 48, 2, c::DKBLUE);
    for r in 0..18 {
        for col in 0..6 {
            let lit = hash01(r * 7 + col, 17) > 0.45;
            let x = bx + 4 + col * 7;
            let y = top + 8 + r * 7;
            fb.fill_rect(x, y, 4, 4, if lit { if (r + col) % 3 == 0 { c::YELLOW } else { c::AMBER } } else { c::DKBLUE });
        }
    }
    // roof antenna blinking
    if (frame >> 4) & 1 != 0 {
        fb.fill_rect(bx + 22, top - 6, 2, 2, c::RED);
    }
    fb.v_line(bx + 22, top - 4, 4, c::MDGRAY);
    // cable
    fb.line(sx(ARRIVAL.cable_start_x, cam_x), sy(ARRIVAL.cable_start_y, cam_y), sx(ARRIVAL.post_x, cam_x), sy(ARRIVAL.post_top_y, cam_y), c::LTGRAY);
}

fn wall_rows(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, floor: i32, dark: i32) {
    let wall = get_sprite("mall.wall");
    let y1 = fl(floor);
    let y0 = y1 - CEILING_GAP;
    fb.push_clip(0, sy(y0, cam_y), 256, CEILING_GAP_I);
    let first = cam_x.div_euclid(16);
    let last = (cam_x + 255).div_euclid(16);
    let rows = (CEILING_GAP / 16.0).ceil() as i32;
    for r in 0..rows {
        for col in first..=last {
            if col < 0 || col * 16 >= LEVEL_W_I {
                continue;
            }
            let variant = if (col * 5 + floor * 3) % 7 == 0 { 1 } else { 0 };
            fb.sprite(wall, sx((col * 16) as f64, cam_x), sy(y1 - (16 * (r + 1)) as f64 + ((rows * 16) as f64 - CEILING_GAP) * 0.0, cam_y), &BlitOpts::default().frame(variant));
        }
    }
    if dark > 0 {
        fb.darken_rect(0, sy(y0, cam_y), 256, CEILING_GAP_I, dark);
    }
    fb.pop_clip();
}

/// The parking level: bare grey concrete with a pipe run, expansion joints and a hazard stripe.
fn parking_backdrop(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, floor: i32) {
    let y1 = fl(floor);
    let y0 = y1 - CEILING_GAP;
    let top = sy(y0, cam_y);
    fb.fill_rect(0, top, 256, CEILING_GAP_I, c::GRAY);
    fb.fill_rect(0, top, 256, 3, c::BLACK);
    fb.h_line(0, top + 3, 256, c::LTGRAY);
    // pipe run along the ceiling
    fb.h_line(0, top + 8, 256, c::LTGRAY);
    fb.h_line(0, top + 9, 256, c::MDGRAY);
    // expansion joints and a bay-number stripe
    let mut x = cam_x.div_euclid(48) * 48;
    while x < cam_x + 256 + 48 {
        if !(x < 0 || x >= LEVEL_W_I) {
            fb.v_line(sx(x as f64, cam_x), top + 4, CEILING_GAP_I - 4, c::BLACK);
            fb.v_line(sx(x as f64, cam_x) + 1, top + 4, CEILING_GAP_I - 4, c::MDGRAY);
            fb.v_line(sx((x + 8) as f64, cam_x), top + 8, 4, c::LTGRAY); // pipe bracket
            fb.set_pixel(sx((x + 22) as f64, cam_x), top + 18, c::WHITE);
        }
        x += 48;
    }
    // hazard stripe at the foot of the wall
    let mut x = cam_x.div_euclid(8) * 8;
    while x < cam_x + 264 {
        if !(x < 0 || x >= LEVEL_W_I) {
            fb.fill_rect(sx(x as f64, cam_x), top + CEILING_GAP_I - 4, 4, 4, c::YELLOW);
            fb.fill_rect(sx((x + 4) as f64, cam_x), top + CEILING_GAP_I - 4, 4, 4, c::BLACK);
        }
        x += 8;
    }
}

fn parking_slab(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, floor: i32) {
    let y = sy(fl(floor), cam_y);
    fb.fill_rect(0, y, 256, SLAB_H_I, c::MDGRAY);
    fb.h_line(0, y, 256, c::LTGRAY);
    fb.h_line(0, y + SLAB_H_I - 1, 256, c::BLACK);
    let mut x = cam_x.div_euclid(24) * 24;
    while x < cam_x + 256 + 24 {
        if x >= 0 && x < LEVEL_W_I {
            fb.fill_rect(sx(x as f64, cam_x), y + 3, 10, 1, c::WHITE);
        }
        x += 24;
    }
}

fn slab_row(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, floor: i32) {
    let slab = get_sprite("mall.slab");
    let y = sy(fl(floor), cam_y);
    let first = cam_x.div_euclid(16);
    let last = (cam_x + 255).div_euclid(16);
    for col in first..=last {
        if col >= 0 && col * 16 < LEVEL_W_I {
            fb.sprite(slab, sx((col * 16) as f64, cam_x), y, &BlitOpts::default());
        }
    }
}

fn draw_storefronts(fb: &mut Framebuffer, run: &Run, cam_x: i32, cam_y: i32, frame: i32) {
    for f in 1..NUM_FLOORS {
        if f == NUM_FLOORS - 1 {
            parking_backdrop(fb, cam_x, cam_y, f);
        } else {
            wall_rows(fb, cam_x, cam_y, f, 0);
        }
    }
    for f in 0..NUM_FLOORS {
        if f == NUM_FLOORS - 1 {
            parking_slab(fb, cam_x, cam_y, f);
        } else {
            slab_row(fb, cam_x, cam_y, f);
        }
    }
    // ground under the parking level
    fb.fill_rect(0, sy(fl(NUM_FLOORS - 1) + SLAB_H, cam_y), 256, 80, c::BLACK);
    for st in STORES.iter() {
        let x = sx(st.x, cam_x);
        if x > 256 || x + 80 < 0 {
            continue;
        }
        let y = sy(fl(st.floor) - 40.0, cam_y);
        draw_storefront(
            fb,
            x as f64,
            y as f64,
            st.id,
            &StorefrontOpts { frame, cleared: store_status(&run.level, st.id) == StoreStatus::Cleared, black_friday: run.black_friday },
        );
    }
}

/// Shaft columns (cut through the slabs), grates over openings with a car above, penthouses on the roof.
fn draw_shafts(fb: &mut Framebuffer, w: &MallWorld, cam_x: i32, cam_y: i32) {
    let wall_tile = get_sprite("shaft.wall");
    let grate = get_sprite("grate");
    for s in SHAFTS.iter() {
        let x = sx(s.x, cam_x);
        let sw = s.w as i32;
        if x > 256 || x + sw < 0 {
            continue;
        }
        let y0 = fl(s.top) - CEILING_GAP;
        let y1 = fl(s.bottom);
        // roof penthouse housing around the top of the shaft
        if s.top == 0 {
            fb.fill_rect(x - 4, sy(y0 - 8.0, cam_y), sw + 8, 10, c::MDGRAY);
            fb.h_line(x - 4, sy(y0 - 8.0, cam_y), sw + 8, c::WHITE);
            fb.fill_rect(x - 4, sy(y0 + 2.0, cam_y), 4, CEILING_GAP_I - 2, c::MDGRAY);
            fb.fill_rect(x + sw, sy(y0 + 2.0, cam_y), 4, CEILING_GAP_I - 2, c::MDGRAY);
        }
        fb.push_clip(x, sy(y0, cam_y), sw, (y1 - y0) as i32);
        let mut yy = y0;
        while yy < y1 {
            fb.sprite(wall_tile, x, sy(yy, cam_y), &BlitOpts::default());
            yy += 16.0;
        }
        fb.pop_clip();
        let car = w.car(s.id);
        for f in s.top..=s.bottom {
            if opening_state(car, f) == OpeningState::Above {
                fb.sprite(grate, x, sy(fl(f), cam_y), &BlitOpts::default());
            }
        }
    }
}

fn draw_features(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, frame: i32) {
    for f in FEATURES.iter() {
        let x = sx(f.x, cam_x);
        if x > 256 || x + (f.w as i32) < 0 {
            continue;
        }
        let fy = fl(f.floor);
        let none = BlitOpts::default();
        match f.kind {
            FeatureKind::Bench => fb.sprite(get_sprite("bench"), x, sy(fy - 12.0, cam_y), &none),
            FeatureKind::Plant => fb.sprite(get_sprite("plant"), x, sy(fy - 24.0, cam_y), &none),
            FeatureKind::Pillar => fb.sprite(get_sprite("pillar"), x, sy(fy - 48.0, cam_y), &none),
            FeatureKind::Wagon => fb.sprite(get_sprite("wagon"), x, sy(fy - 28.0, cam_y), &BlitOpts::default().frame(0)),
            FeatureKind::Post => fb.sprite(get_sprite("post"), x, sy(fy - 16.0, cam_y), &none),
            FeatureKind::Ac => fb.sprite(get_sprite("ac"), x, sy(fy - 16.0, cam_y), &none),
            FeatureKind::Pigeon => fb.sprite(get_sprite("pigeon"), x, sy(fy - 8.0, cam_y), &BlitOpts::default().frame((frame >> 5) & 1)),
            _ => {} // kiosk / booth / fountain are state-dependent: drawn by the furniture hook
        }
    }
}

fn draw_escalators(fb: &mut Framebuffer, cam_x: i32, cam_y: i32, frame: i32) {
    let step = get_sprite("esc.step");
    let rail = get_sprite("esc.rail");
    for e in ESCALATORS.iter() {
        let x0 = e.x_low;
        let y0 = fl(e.lower);
        let x1 = e.x_high;
        let y1 = fl(e.upper);
        if x0.max(x1) - (cam_x as f64) < -8.0 || x0.min(x1) - (cam_x as f64) > 264.0 {
            continue;
        }
        let n = 48;
        let phase = (frame >> 1) % 8;
        let mut i = -8;
        while i <= n {
            let t = (i + phase) as f64 / n as f64;
            if !(t < 0.0 || t > 1.0) {
                let x = x0 + (x1 - x0) * t;
                let y = y0 + (y1 - y0) * t;
                fb.sprite(step, sx(x - 4.0, cam_x), sy(y - 4.0, cam_y), &BlitOpts::default().frame((frame >> 2) & 3));
            }
            i += 8;
        }
        let mut i = 0;
        while i <= n {
            let t = i as f64 / n as f64;
            let x = x0 + (x1 - x0) * t;
            let y = y0 + (y1 - y0) * t;
            fb.sprite(rail, sx(x - 2.0, cam_x), sy(y - 22.0, cam_y), &BlitOpts::default());
            i += 4;
        }
        // landing plates
        fb.h_line(sx(x0 - 8.0, cam_x), sy(y0, cam_y), 16, c::YELLOW);
        fb.h_line(sx(x1 - 8.0, cam_x), sy(y1, cam_y), 16, c::YELLOW);
    }
}

fn draw_cars(fb: &mut Framebuffer, w: &MallWorld, cam_x: i32, cam_y: i32) {
    for car in w.cars.iter() {
        let s = &car.def;
        let x = sx(s.x, cam_x);
        if x > 256 || x + (s.w as i32) < 0 {
            continue;
        }
        let spr = get_sprite(if car.open { "car.open" } else { "car.closed" });
        fb.sprite(spr, x, sy(car.y - CAR_H, cam_y), &BlitOpts::default());
    }
}

struct PlayerSpr {
    name: &'static str,
    frame: i32,
    flip: bool,
}

fn player_sprite(w: &MallWorld, p: &PlayerState) -> Option<PlayerSpr> {
    let flip = p.face < 0;
    let s = |name: &'static str, frame: i32, flip: bool| Some(PlayerSpr { name, frame, flip });
    if let Some(intro) = &w.intro {
        return match intro.phase {
            IntroPhase::Zip => s("agent.hang", 0, false),
            IntroPhase::Drop => s("agent.jump", 0, false),
            IntroPhase::Crouch => s("agent.crouch", 0, false),
            IntroPhase::Selfie => s("agent.selfie", if intro.t < 12 { 1 } else { 0 }, false),
        };
    }
    if p.mode == PlayerMode::Hidden {
        return None;
    }
    if p.mode == PlayerMode::Dying || p.mode == PlayerMode::Dead {
        let t = p.death_t;
        return s("agent.die", if t < 12 { 0 } else if t < 30 { 1 } else { 2 }, flip);
    }
    if p.mode == PlayerMode::Ride {
        return s("agent.ride", 0, false);
    }
    if p.mode == PlayerMode::Air {
        return s(if p.kick { "agent.kick" } else { "agent.jump" }, 0, flip);
    }
    if p.mode == PlayerMode::Escalator {
        return s("agent.stand", 0, flip);
    }
    if p.ducking {
        return s(if p.shoot_pose > 0 { "agent.shootlow" } else { "agent.duck" }, 0, flip);
    }
    if p.shoot_pose > 0 {
        return s("agent.shoot", 0, flip);
    }
    if p.kick && p.slide != 0 {
        return s("agent.kick", 0, flip);
    }
    if p.vx.abs() > 0.01 || p.slide != 0 {
        return s("agent.walk", (p.anim >> 3) & 3, flip);
    }
    s("agent.stand", 0, flip)
}

fn draw_player(fb: &mut Framebuffer, w: &MallWorld, run: &Run, cam_x: i32, cam_y: i32, frame: i32) {
    let p = &w.player;
    let spec = match player_sprite(w, p) {
        Some(s) => s,
        None => return,
    };
    // blinking invulnerability
    if p.invuln > 0 && p.mode != PlayerMode::Dying && (frame >> 2) & 1 != 0 {
        return;
    }
    let spr = get_sprite(spec.name);
    let flash_lut = flash();
    let ghost_lut = ghost();
    let mut recolor: Option<&Recolor> = None;
    if run.invincible() && (frame >> 1) & 1 != 0 {
        recolor = Some(&flash_lut);
    }
    if p.frozen > 0 && (frame >> 2) & 1 != 0 {
        recolor = Some(&ghost_lut);
    }
    let x = sx(p.x - 8.0, cam_x);
    let y = sy(p.y - 24.0, cam_y);
    let mut o = BlitOpts::default().frame(spec.frame).flip_x(spec.flip);
    o.recolor = recolor;
    fb.sprite(spr, x, y, &o);
    // the agent holds his phone up during the selfie: nothing else to draw
}

fn spy_sprite(s: &Spy) -> (&'static str, i32) {
    match s.mode {
        SpyMode::Aim => (if s.aim_high { "spy.aimhigh" } else { "spy.aimlow" }, 0),
        SpyMode::Duck => ("spy.duck", 0),
        SpyMode::Dying => ("spy.die", 2.min(s.death_t.div_euclid(8))),
        SpyMode::Emerge => ("spy.stand", 0),
        SpyMode::Wait => ("spy.stand", 0),
        SpyMode::Walk => ("spy.walk", (s.anim >> 3) & 3),
    }
}

fn draw_spies(fb: &mut Framebuffer, w: &MallWorld, cam_x: i32, cam_y: i32, frame: i32) {
    for s in w.spies.iter() {
        let (name, f) = spy_sprite(s);
        let x = sx(s.x - 8.0, cam_x);
        let y = sy(s.y - 24.0, cam_y);
        if x > 256 || x < -16 {
            continue;
        }
        if s.mode == SpyMode::Emerge {
            // step out of the door: reveal from the door line, flickering in
            if s.t < 8 && (frame & 1) != 0 {
                continue;
            }
        }
        fb.sprite(get_sprite(name), x, y, &BlitOpts::default().frame(f).flip_x(s.face < 0));
    }
}

fn draw_bullets(fb: &mut Framebuffer, w: &MallWorld, cam_x: i32, cam_y: i32) {
    use crate::game::mall::types::BulletOwner;
    let pb = get_sprite("bullet.player");
    let eb = get_sprite("bullet.enemy");
    for b in w.bullets.iter() {
        fb.sprite(if b.owner == BulletOwner::Player { pb } else { eb }, sx(b.x - 2.0, cam_x), sy(b.y - 1.0, cam_y), &BlitOpts::default().flip_x(b.vx < 0.0));
    }
}

fn draw_pickups(fb: &mut Framebuffer, w: &MallWorld, cam_x: i32, cam_y: i32, frame: i32) {
    use crate::game::mall::types::PickupKind;
    for k in w.pickups.iter() {
        if k.life < 90 && (frame >> 2) & 1 != 0 {
            continue; // blink before disappearing
        }
        match (k.kind, k.power) {
            (PickupKind::Power, Some(p)) => {
                fb.sprite(get_sprite(&format!("item.{}", p.as_str())), sx(k.x - 6.0, cam_x), sy(k.y - 12.0, cam_y), &BlitOpts::default());
            }
            _ => {
                fb.sprite(
                    get_sprite(if k.kind == PickupKind::Goldcoin { "item.goldcoin" } else { "item.coin" }),
                    sx(k.x - 4.0, cam_x),
                    sy(k.y - 8.0, cam_y),
                    &BlitOpts::default().frame((frame >> 3) & 3),
                );
            }
        }
    }
}

fn draw_alarm(fb: &mut Framebuffer, frame: i32) {
    if (frame >> 4) & 1 != 0 {
        fb.stroke_rect(0, VIEW_TOP, 256, VIEW_H, c::RED);
        fb.stroke_rect(1, VIEW_TOP + 1, 254, VIEW_H - 2, c::MAROON);
    }
}

/// Phone flash, then the SPYGRAM card, during the roof selfie.
fn draw_selfie(fb: &mut Framebuffer, w: &MallWorld, run: &Run, frame: i32) {
    let intro = match &w.intro {
        Some(i) if i.phase == IntroPhase::Selfie => i,
        _ => return,
    };
    let t = intro.t;
    if t < 12 {
        let level = 0.max(3 - t.div_euclid(3));
        fb.fill_rect(0, VIEW_TOP, 256, VIEW_H, c::WHITE);
        if level < 3 {
            fb.darken_rect(0, VIEW_TOP, 256, VIEW_H, 3 - level);
        }
        return;
    }
    let card_t = t - 12;
    let x = 0.max((256 - 184) / 2);
    let slide = 1.0f64.min(card_t as f64 / 14.0);
    let y = round_i(VIEW_TOP as f64 + 6.0 + (1.0 - slide) * 200.0);
    draw_spygram(fb, &intro.post, spygram_likes(card_t, run.seed as i32), frame, &SpygramOpts { x: Some(x), y: Some(y), photo: None });
}
