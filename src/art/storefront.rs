//! A storefront is STORE_W (80) x STOREFRONT_H (40) px. Layout (all in px, relative to the top-left):
//!   rows 0..9    sign plate with the store name in the tiny font (coloured by role)
//!   rows 10..37  body: 2 px frame | window L (28 wide) | door (20 wide) | window R (28 wide) | 2 px frame
//!   rows 38..39  threshold / base
//! Its bottom edge sits on a floor's walking surface, so top y = floor_y(floor) - 40.
//! Door trigger for the agent is x + 32 .. x + 48.
//!
//! OWNER: storefronts art agent. Implement `draw_storefront`, composing the `win.<id>.L/R`, `door.*` sprites.

use crate::content::stores::{store_def, StoreId, StoreRole, STORE_W};
use crate::engine::font::{draw_text, text_width, Align, TextOpts, FONT_TINY};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;

use super::storefronts::{get_sprite, window_frame_index, window_style, Side};

pub const STOREFRONT_H: i32 = 40;

#[derive(Clone, Copy, Default, Debug)]
pub struct StorefrontOpts {
    /// Simulation frame counter (drives idle animation and door blinking).
    pub frame: i32,
    /// Target store whose package was taken: dark door, dimmed windows.
    pub cleared: bool,
    /// Black Friday Mode: a "70% OFF" sign on every OPEN storefront.
    pub black_friday: bool,
}

const STORE_W_I: i32 = STORE_W as i32;

// Column / row layout (relative to the storefront's top-left).
const SIGN_H: i32 = 10;
const BODY_Y: i32 = 10;
const BODY_H: i32 = 28;
const BASE_Y: i32 = 38;
const FRAME_W: i32 = 2;
const WIN_W: i32 = 28;
const DOOR_W: i32 = 20;
const WIN_L_X: i32 = FRAME_W; // 2
const DOOR_X: i32 = WIN_L_X + WIN_W; // 30
const WIN_R_X: i32 = DOOR_X + DOOR_W; // 50
/// Door blinks: 16 frames dim, 16 frames bright (about 1.9 Hz).
const BLINK_PERIOD: i32 = 16;

struct RoleLook {
    plate: u8,
    rim_top: u8,
    rim_bottom: u8,
    text: u8,
    shadow: u8,
    frame: u8,
    door: u8,
}

fn look(role: StoreRole) -> RoleLook {
    match role {
        StoreRole::Target => RoleLook { plate: c::RED, rim_top: c::SALMON, rim_bottom: c::BROWNRED, text: c::WHITE, shadow: c::BROWNRED, frame: c::BROWNRED, door: c::BLACK },
        StoreRole::Powerup => RoleLook { plate: c::BLUE, rim_top: c::LTBLUE, rim_bottom: c::DKBLUE, text: c::WHITE, shadow: c::DKBLUE, frame: c::DKBLUE, door: c::BLACK },
        // Closed: an unlit sign and a grey frame.
        StoreRole::Closed => RoleLook { plate: c::BLACK, rim_top: c::GRAY, rim_bottom: c::BLACK, text: c::GRAY, shadow: c::BLACK, frame: c::MDGRAY, door: c::BLACK },
    }
}

fn draw_sign(fb: &mut Framebuffer, x: i32, y: i32, name: &str, look: &RoleLook) {
    fb.fill_rect(x, y, STORE_W_I, SIGN_H, look.plate);
    fb.h_line(x, y, STORE_W_I, look.rim_top);
    fb.h_line(x, y + SIGN_H - 1, STORE_W_I, look.rim_bottom);
    fb.v_line(x, y, SIGN_H, look.rim_bottom);
    fb.v_line(x + STORE_W_I - 1, y, SIGN_H, look.rim_bottom);
    fb.set_pixel(x, y, look.rim_top);
    let opts = TextOpts::default().font(&FONT_TINY).align(Align::Center).shadow(look.shadow);
    draw_text(fb, name, x + STORE_W_I / 2, y + 2, look.text, &opts);
}

fn draw_window(fb: &mut Framebuffer, x: i32, y: i32, id: StoreId, side: Side, opts: &StorefrontOpts) {
    let st = window_style(id);
    fb.fill_rect(x, y, WIN_W, BODY_H, c::BLACK); // window frame
    fb.fill_rect(x + 1, y + 1, WIN_W - 2, BODY_H - 2, st.bg);
    fb.fill_rect(x + 1, y + BODY_H - 3, WIN_W - 2, 2, st.floor);
    let spr = get_sprite(&format!("win.{}.{}", id.as_str(), side.as_str()));
    fb.sprite(spr, x, y, &BlitOpts::default().frame(window_frame_index(id, side, opts.frame)));
    if opts.cleared {
        fb.darken_rect(x, y, WIN_W, BODY_H, 1);
    }
}

/// The "70% OFF" Black Friday tag: a yellow sign hanging under the name plate, stacked in two lines so it
/// stays inside the door's width and leaves both window displays readable.
fn draw_sale_tag(fb: &mut Framebuffer, x: i32, y: i32) {
    let opts = TextOpts::default().font(&FONT_TINY);
    let inner = text_width("70%", &opts); // 11
    let w = inner + 4; // 1 px border + 1 px padding each side
    let h = 15;
    let bx = x + (STORE_W_I - w).div_euclid(2);
    let by = y + BODY_Y + 1;
    fb.fill_rect(bx, by, w, h, c::BLACK);
    fb.fill_rect(bx + 1, by + 1, w - 2, h - 2, c::YELLOW);
    draw_text(fb, "70%", bx + 2, by + 2, c::BLACK, &opts);
    draw_text(fb, "OFF", bx + 2, by + 8, c::RED, &opts);
}

pub fn draw_storefront(fb: &mut Framebuffer, x: f64, y: f64, id: StoreId, opts: &StorefrontOpts) {
    let x = round_i(x);
    let y = round_i(y);
    let def = store_def(id);
    let look = look(def.role);
    let cleared = def.role == StoreRole::Target && opts.cleared;
    fb.push_clip(x, y, STORE_W_I, STOREFRONT_H);

    // sign plate
    draw_sign(fb, x, y, def.name, &look);
    if cleared {
        fb.darken_rect(x, y, STORE_W_I, SIGN_H, 1);
    }

    // body frame, windows, door
    fb.fill_rect(x, y + BODY_Y, STORE_W_I, BODY_H, look.frame);
    let wopts = StorefrontOpts { cleared, ..*opts };
    draw_window(fb, x + WIN_L_X, y + BODY_Y, id, Side::L, &wopts);
    draw_window(fb, x + WIN_R_X, y + BODY_Y, id, Side::R, &wopts);
    fb.fill_rect(x + DOOR_X, y + BODY_Y, DOOR_W, BODY_H, look.door);
    let door_name;
    let mut door_frame = 0;
    match def.role {
        StoreRole::Closed => door_name = "door.closed",
        StoreRole::Powerup => door_name = "door.powerup",
        _ if cleared => door_name = "door.dark",
        _ => {
            door_name = "door.target";
            door_frame = (opts.frame.max(0) / BLINK_PERIOD) & 1;
        }
    }
    fb.sprite(get_sprite(door_name), x + DOOR_X, y + BODY_Y, &BlitOpts::default().frame(door_frame));

    // base / threshold
    fb.fill_rect(x, y + BASE_Y, STORE_W_I, 2, c::GRAY);
    fb.h_line(x, y + BASE_Y, STORE_W_I, c::LTGRAY);

    if opts.black_friday && def.role != StoreRole::Closed {
        draw_sale_tag(fb, x, y);
    }
    fb.pop_clip();
}

#[cfg(test)]
mod tests {
    use super::super::storefronts::{self, get_sprite, window_frame_index, window_style, Side};
    use super::super::{storeart, registry::build_def};
    use super::*;
    use crate::content::stores::{closed_stores, open_stores, powerup_stores, target_stores, StoreDef, STORES};
    use crate::engine::palette::{c, darken};

    const SENTINEL: u8 = 0x3f;
    const X0: i32 = 20;
    const Y0: i32 = 30;

    fn render_at(s: &StoreDef, opts: StorefrontOpts, x: f64, y: f64) -> Framebuffer {
        let mut fb = Framebuffer::new();
        fb.clear(SENTINEL);
        draw_storefront(&mut fb, x, y, s.id, &opts);
        fb
    }
    fn render(s: &StoreDef, opts: StorefrontOpts) -> Framebuffer {
        render_at(s, opts, X0 as f64, Y0 as f64)
    }
    fn o(frame: i32) -> StorefrontOpts {
        StorefrontOpts { frame, ..Default::default() }
    }

    /// Hash of one rectangle of the framebuffer.
    fn rect_hash(fb: &Framebuffer, x: i32, y: i32, w: i32, h: i32) -> u32 {
        let mut hash: u32 = 0x811c9dc5;
        for yy in 0..h {
            for xx in 0..w {
                hash ^= fb.get_pixel(x + xx, y + yy) as u32;
                hash = hash.wrapping_mul(0x01000193);
            }
        }
        hash
    }

    struct R {
        x: i32,
        y: i32,
        w: i32,
        h: i32,
    }
    const DOOR: R = R { x: X0 + 30, y: Y0 + 10, w: 20, h: 28 };
    const WIN_L: R = R { x: X0 + 2, y: Y0 + 10, w: 28, h: 28 };
    const WIN_R: R = R { x: X0 + 50, y: Y0 + 10, w: 28, h: 28 };
    fn door_hash(fb: &Framebuffer) -> u32 {
        rect_hash(fb, DOOR.x, DOOR.y, DOOR.w, DOOR.h)
    }

    #[test]
    fn draws_every_store_many_frames_and_option_combinations_without_throwing() {
        for s in STORES.iter() {
            for frame in [0, 1, 7, 16, 31, 32, 59, 600, 12345] {
                for cleared in [false, true] {
                    for black_friday in [false, true] {
                        render(s, StorefrontOpts { frame, cleared, black_friday });
                    }
                }
            }
        }
    }

    #[test]
    fn is_deterministic() {
        for s in STORES.iter() {
            assert_eq!(render(s, o(37)).hash(), render(s, o(37)).hash(), "{}", s.id.as_str());
        }
    }

    #[test]
    fn never_draws_outside_its_80x40_box_even_with_every_overlay_on() {
        for s in STORES.iter() {
            let fb = render(s, StorefrontOpts { frame: 21, cleared: true, black_friday: true });
            let mut stray = 0;
            for y in 0..fb.h {
                for x in 0..fb.w {
                    let inside = x >= X0 && x < X0 + STORE_W_I && y >= Y0 && y < Y0 + STOREFRONT_H;
                    if !inside && fb.get_pixel(x, y) != SENTINEL {
                        stray += 1;
                    }
                }
            }
            assert_eq!(stray, 0, "{}", s.id.as_str());
            // and the box itself is fully painted (no holes through to the mall behind)
            let mut holes = 0;
            for y in Y0..Y0 + STOREFRONT_H {
                for x in X0..X0 + STORE_W_I {
                    if fb.get_pixel(x, y) == SENTINEL {
                        holes += 1;
                    }
                }
            }
            assert_eq!(holes, 0, "{}", s.id.as_str());
        }
    }

    #[test]
    fn copes_with_storefronts_that_are_partly_or_fully_off_screen_the_mall_scrolls() {
        for s in STORES.iter() {
            for (x, y) in [(-30.0, 10.0), (-79.0, 10.0), (200.0, 100.0), (250.0, 230.0), (-200.0, -200.0), (20.4, 30.6)] {
                render_at(s, StorefrontOpts { frame: 5, black_friday: true, ..Default::default() }, x, y);
            }
        }
        // a partly clipped storefront must not leak into the other side of the screen
        let mut fb = Framebuffer::new();
        fb.clear(SENTINEL);
        draw_storefront(&mut fb, -40.0, 100.0, StoreId::Forever12, &o(0));
        for y in 0..fb.h {
            for x in 40..fb.w {
                assert_eq!(fb.get_pixel(x, y), SENTINEL);
            }
        }
    }

    #[test]
    fn respects_an_existing_clip_rectangle() {
        let mut fb = Framebuffer::new();
        fb.clear(SENTINEL);
        fb.push_clip(0, 0, X0 + 10, 256);
        draw_storefront(&mut fb, X0 as f64, Y0 as f64, StoreId::Kgbtoys, &o(0));
        fb.pop_clip();
        for y in 0..fb.h {
            for x in X0 + 10..fb.w {
                assert_eq!(fb.get_pixel(x, y), SENTINEL);
            }
        }
    }

    #[test]
    fn colours_the_sign_by_role_with_the_name_centred_and_inside_the_plate() {
        let plate = |r: StoreRole| match r {
            StoreRole::Target => c::RED,
            StoreRole::Powerup => c::BLUE,
            StoreRole::Closed => c::BLACK,
        };
        let text = |r: StoreRole| match r {
            StoreRole::Target => c::WHITE,
            StoreRole::Powerup => c::WHITE,
            StoreRole::Closed => c::GRAY,
        };
        for s in STORES.iter() {
            assert!(text_width(s.name, &TextOpts::default().font(&FONT_TINY)) <= STORE_W_I - 4, "{}", s.name);
            let fb = render(s, o(0));
            assert_eq!(fb.get_pixel(X0 + 2, Y0 + 8), plate(s.role), "{} plate colour", s.id.as_str());
            let mut left = i32::MAX;
            let mut right = i32::MIN;
            for y in Y0 + 2..=Y0 + 6 {
                for x in X0 + 1..X0 + STORE_W_I - 1 {
                    if fb.get_pixel(x, y) == text(s.role) {
                        left = left.min(x - X0);
                        right = right.max(x - X0);
                    }
                }
            }
            assert!(left > 0 && left != i32::MAX, "{} has text", s.id.as_str());
            let left_margin = left;
            let right_margin = STORE_W_I - 1 - right;
            assert!(left_margin >= 2, "{} left margin", s.id.as_str());
            assert!(right_margin >= 2, "{} right margin", s.id.as_str());
            assert!((left_margin - right_margin).abs() <= 3, "{} centred", s.id.as_str());
        }
    }

    #[test]
    fn target_doors_blink_between_two_clearly_different_looks_other_doors_do_not() {
        for s in target_stores() {
            let mut seen: Vec<u32> = Vec::new();
            for f in 0..64 {
                let h = door_hash(&render(s, o(f)));
                if !seen.contains(&h) {
                    seen.push(h);
                }
            }
            assert_eq!(seen.len(), 2, "{} door blinks", s.id.as_str());
            // dim for 16 frames, bright for 16 frames
            assert_eq!(door_hash(&render(s, o(0))), door_hash(&render(s, o(15))));
            assert_ne!(door_hash(&render(s, o(0))), door_hash(&render(s, o(16))));
            assert_eq!(door_hash(&render(s, o(16))), door_hash(&render(s, o(31))));
            assert_eq!(door_hash(&render(s, o(0))), door_hash(&render(s, o(32))));
            // the Black Friday tag must not hide the blink
            let bf = |frame| StorefrontOpts { frame, black_friday: true, ..Default::default() };
            assert_ne!(door_hash(&render(s, bf(0))), door_hash(&render(s, bf(16))), "{} blinks on black friday", s.id.as_str());
        }
        for s in powerup_stores() {
            let mut seen: Vec<u32> = Vec::new();
            for f in 0..64 {
                let h = door_hash(&render(s, o(f)));
                if !seen.contains(&h) {
                    seen.push(h);
                }
            }
            assert_eq!(seen.len(), 1, "{} door is steady", s.id.as_str());
        }
    }

    #[test]
    fn closed_storefronts_never_change_no_blinking_no_animation_no_black_friday_sign_no_clearing() {
        for s in closed_stores() {
            let base = render(s, o(0)).hash();
            for f in [1, 7, 16, 17, 33, 100, 999] {
                assert_eq!(render(s, o(f)).hash(), base, "{} f{}", s.id.as_str(), f);
            }
            assert_eq!(render(s, StorefrontOpts { frame: 40, black_friday: true, ..Default::default() }).hash(), base, "{} black friday", s.id.as_str());
            assert_eq!(render(s, StorefrontOpts { frame: 40, cleared: true, ..Default::default() }).hash(), base, "{} cleared", s.id.as_str());
        }
    }

    #[test]
    fn cleared_targets_look_different_dark_door_dimmed_windows_no_blinking() {
        for s in target_stores() {
            let normal = render(s, o(0));
            let cleared = render(s, StorefrontOpts { frame: 0, cleared: true, ..Default::default() });
            assert_ne!(cleared.hash(), normal.hash(), "{}", s.id.as_str());
            assert_ne!(door_hash(&cleared), door_hash(&normal), "{} door", s.id.as_str());
            // door stays dark through both blink phases
            let c16 = render(s, StorefrontOpts { frame: 16, cleared: true, ..Default::default() });
            assert_eq!(door_hash(&c16), door_hash(&cleared), "{} cleared door steady", s.id.as_str());
            // every window pixel is exactly the normal pixel, one luminance step darker
            for win in [&WIN_L, &WIN_R] {
                for y in win.y..win.y + win.h {
                    for x in win.x..win.x + win.w {
                        assert_eq!(cleared.get_pixel(x, y), darken(normal.get_pixel(x, y), 1), "{} @{},{}", s.id.as_str(), x, y);
                    }
                }
            }
        }
    }

    #[test]
    fn only_targets_can_be_cleared() {
        for s in powerup_stores() {
            assert_eq!(
                render(s, StorefrontOpts { frame: 3, cleared: true, ..Default::default() }).hash(),
                render(s, o(3)).hash(),
                "{}",
                s.id.as_str()
            );
        }
    }

    #[test]
    fn black_friday_adds_a_70_off_sign_to_every_open_storefront_and_nothing_to_closed_ones() {
        for s in open_stores() {
            let normal = render(s, o(9));
            let bf = render(s, StorefrontOpts { frame: 9, black_friday: true, ..Default::default() });
            assert_ne!(bf.hash(), normal.hash(), "{}", s.id.as_str());
            // the sign is yellow and sits under the name plate; the plate itself is untouched
            let mut yellow = 0;
            for y in Y0 + 10..Y0 + 30 {
                for x in X0 + 20..X0 + 60 {
                    if bf.get_pixel(x, y) == c::YELLOW {
                        yellow += 1;
                    }
                }
            }
            assert!(yellow > 60, "{} yellow sign", s.id.as_str());
            assert_eq!(rect_hash(&bf, X0, Y0, STORE_W_I, 10), rect_hash(&normal, X0, Y0, STORE_W_I, 10), "{} plate", s.id.as_str());
            // it must not hide the door's handle area (the door can still be read and entered)
            assert_eq!(
                rect_hash(&bf, DOOR.x, DOOR.y + 20, DOOR.w, 8),
                rect_hash(&normal, DOOR.x, DOOR.y + 20, DOOR.w, 8),
                "{} lower door",
                s.id.as_str()
            );
        }
        for s in closed_stores() {
            assert_eq!(render(s, StorefrontOpts { frame: 9, black_friday: true, ..Default::default() }).hash(), render(s, o(9)).hash(), "{}", s.id.as_str());
        }
    }

    #[test]
    fn the_black_friday_sign_also_appears_on_cleared_target_stores_still_open() {
        for s in target_stores() {
            let a = render(s, StorefrontOpts { frame: 0, cleared: true, black_friday: true });
            let b = render(s, StorefrontOpts { frame: 0, cleared: true, black_friday: false });
            assert_ne!(a.hash(), b.hash(), "{}", s.id.as_str());
        }
    }

    // ---- storefront window displays

    #[test]
    fn every_open_store_has_two_distinct_animated_windows() {
        for s in open_stores() {
            for side in [Side::L, Side::R] {
                let spr = get_sprite(&format!("win.{}.{}", s.id.as_str(), side.as_str()));
                let tag = format!("{}.{}", s.id.as_str(), side.as_str());
                assert!(spr.frame_count() >= 2, "{}", tag);
                assert!(spr.frame_count() <= 3, "{}", tag);
                let mut shown: Vec<i32> = Vec::new();
                for f in 0..600 {
                    let idx = window_frame_index(s.id, side, f);
                    assert!(idx >= 0);
                    assert!(idx < spr.frame_count());
                    if !shown.contains(&idx) {
                        shown.push(idx);
                    }
                }
                assert!(shown.len() >= 2, "{} animates", tag);
                // the frames really differ
                let mut differs = false;
                for fr in 1..spr.frames.len() {
                    if spr.frames[fr] != spr.frames[0] {
                        differs = true;
                    }
                }
                assert!(differs, "{} frames differ", tag);
            }
        }
    }

    #[test]
    fn closed_stores_show_frozen_windows() {
        for s in closed_stores() {
            for side in [Side::L, Side::R] {
                let spr = get_sprite(&format!("win.{}.{}", s.id.as_str(), side.as_str()));
                for fr in 1..spr.frames.len() {
                    assert_eq!(spr.frames[fr], spr.frames[0], "{}.{}", s.id.as_str(), side.as_str());
                }
            }
        }
    }

    #[test]
    fn no_two_windows_are_the_same_picture() {
        let mut seen: Vec<(Vec<u8>, Vec<u8>, String)> = Vec::new();
        for s in STORES.iter() {
            for side in [Side::L, Side::R] {
                let name = format!("{}.{}", s.id.as_str(), side.as_str());
                let spr = get_sprite(&format!("win.{}", name));
                let key = (spr.colors.clone(), spr.frames[0].clone());
                if let Some(prev) = seen.iter().find(|e| e.0 == key.0 && e.1 == key.1) {
                    panic!("{} duplicates {}", name, prev.2);
                }
                seen.push((key.0, key.1, name));
            }
        }
        assert_eq!(seen.len(), 26);
    }

    #[test]
    fn the_windows_of_neighbouring_stores_do_not_animate_in_lockstep() {
        let phase = |id: StoreId| -> i32 {
            for f in 0..200 {
                if window_frame_index(id, Side::L, f) != window_frame_index(id, Side::L, 0) {
                    return f;
                }
            }
            -1
        };
        let mut phases: Vec<i32> = Vec::new();
        for s in open_stores() {
            let p = phase(s.id);
            if !phases.contains(&p) {
                phases.push(p);
            }
        }
        assert!(phases.len() > 3);
    }

    // ---- parity with the TS source (fixtures/sprites-storefronts.json)

    const FIXTURE: &str = include_str!("../../fixtures/sprites-storefronts.json");

    fn fnv1a(bytes: &[u8]) -> u32 {
        let mut h: u32 = 0x811c9dc5;
        for &b in bytes {
            h ^= b as u32;
            h = h.wrapping_mul(0x01000193);
        }
        h
    }
    /// Lines of one section of the fixture (one flat object per line; no crates allowed).
    fn section(name: &str) -> Vec<&'static str> {
        let start = FIXTURE.find(&format!("\"{}\": [", name)).unwrap();
        FIXTURE[start..].lines().skip(1).take_while(|l| !l.trim_start().starts_with(']')).collect()
    }
    fn str_field(line: &str, key: &str) -> String {
        let k = format!("\"{}\": \"", key);
        let s = line.find(&k).unwrap() + k.len();
        let e = s + line[s..].find('"').unwrap();
        line[s..e].to_string()
    }
    fn raw_field(line: &str, key: &str) -> String {
        let k = format!("\"{}\": ", key);
        let s = line.find(&k).unwrap() + k.len();
        let e = s + line[s..].find(|ch: char| ch == ',' || ch == '}').unwrap();
        line[s..e].to_string()
    }
    fn num_field(line: &str, key: &str) -> f64 {
        raw_field(line, key).parse().unwrap()
    }
    fn list_field(line: &str, key: &str) -> Vec<i64> {
        let k = format!("\"{}\": [", key);
        let s = line.find(&k).unwrap() + k.len();
        let e = s + line[s..].find(']').unwrap();
        line[s..e].split(',').map(|t| t.trim()).filter(|t| !t.is_empty()).map(|t| t.parse().unwrap()).collect()
    }
    fn store_id(s: &str) -> StoreId {
        *StoreId::ALL.iter().find(|i| i.as_str() == s).unwrap()
    }

    #[test]
    fn parity_every_storefronts_and_storeart_sprite_matches_the_ts_pixels() {
        let mut sprites: Vec<crate::engine::sprite::Sprite> = storefronts::sprites();
        sprites.extend(storeart::defs().iter().map(build_def));
        let lines = section("sprites");
        assert_eq!(sprites.len(), lines.len());
        for (s, l) in sprites.iter().zip(lines.iter()) {
            assert_eq!(s.name, str_field(l, "name"));
            assert_eq!((s.w, s.h), (num_field(l, "w") as i32, num_field(l, "h") as i32), "{} size", s.name);
            assert_eq!(s.frames.len(), num_field(l, "frames") as usize, "{} frame count", s.name);
            let want = list_field(l, "hashes");
            for (f, w) in want.iter().enumerate() {
                assert_eq!(fnv1a(&s.frames[f]) as i64, *w, "{} frame {}", s.name, f);
            }
        }
        // the storefronts defs() list and the parsed sprites agree
        assert_eq!(storefronts::defs().len(), 30);
    }

    #[test]
    fn parity_window_styles_and_animation_sequences() {
        for l in section("windowStyle") {
            let st = window_style(store_id(&str_field(l, "id")));
            assert_eq!((st.bg as f64, st.floor as f64), (num_field(l, "bg"), num_field(l, "floor")), "{}", l);
        }
        for l in section("windowFrames") {
            let id = store_id(&str_field(l, "id"));
            let side = if str_field(l, "side") == "L" { Side::L } else { Side::R };
            let want = list_field(l, "seq");
            let mut got: Vec<i64> = (0..400).map(|f| window_frame_index(id, side, f) as i64).collect();
            got.push(window_frame_index(id, side, -5) as i64);
            assert_eq!(got, want, "{} {}", id.as_str(), side.as_str());
        }
    }

    #[test]
    fn parity_rendered_storefronts_match_the_ts_framebuffer_hashes() {
        let lines = section("renders");
        assert_eq!(lines.len(), 312);
        for l in lines {
            let id = store_id(&str_field(l, "id"));
            let opts = StorefrontOpts {
                frame: num_field(l, "frame") as i32,
                cleared: raw_field(l, "cleared") == "true",
                black_friday: raw_field(l, "blackFriday") == "true",
            };
            let fb = render_at(store_def(id), opts, num_field(l, "x"), num_field(l, "y"));
            assert_eq!(fb.hash() as f64, num_field(l, "hash"), "{}", l);
        }
    }
}
