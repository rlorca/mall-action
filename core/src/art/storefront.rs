//! Storefronts (art agent 2 owns this file). Each is exactly 80 px wide and `FRONT_H` tall: a 10 px sign on
//! top, a lintel/awning, a 24 px wide, 30 px tall door in the middle and a display window on each side.
//! The door colour shows the role (red blinking = target, blue = power-up shop, shutter = closed) and the
//! windows show what the store sells (see `displays`).

use super::Registry;
use crate::pixel::{pal::*, Fb, Rect};
use crate::types::{StoreId, StoreRole};

mod displays;
mod draw;

use displays::{draw_window, Win, WIN_H, WIN_W};
use draw::*;

pub fn register(_r: &mut Registry) {}

/// Total storefront height in pixels (sign + door + windows), standing on the floor line.
pub const FRONT_H: i32 = 44;
/// Storefront width in pixels.
pub const FRONT_W: i32 = 80;
/// Door size (the 16x24 agent has to fit).
pub const DOOR_W: i32 = 24;
pub const DOOR_H: i32 = 30;
/// Frames per blink phase of a target door (60 Hz: 20 frames on, 20 off).
pub const BLINK_FRAMES: u32 = 20;

#[derive(Clone, Copy, Debug, Default)]
pub struct FrontState {
    /// The package here has been taken (target stores): door goes dark, windows dim.
    pub cleared: bool,
    /// Animation clock in frames.
    pub tick: u32,
    /// Black Friday mode: draw a "70% OFF" sign.
    pub black_friday: bool,
}

/// Door rectangle (outer, including its frame) of a storefront at (`x`, `floor_y`).
pub fn door_rect(x: i32, floor_y: i32) -> Rect {
    Rect::new(x + 28, floor_y - DOOR_H, DOOR_W, DOOR_H)
}

struct Style {
    body: u8,
    trim: u8,
    stripe_a: u8,
    stripe_b: u8,
}

fn style(id: StoreId) -> Style {
    let (body, trim) = match id {
        StoreId::Forever12 => (PINK, MAGENTA),
        StoreId::RadioShock => (DBLUE, YELLOW),
        StoreId::Crookstone => (DBROWN, TAN),
        StoreId::GameStonk => (PURPLE, LGREEN),
        StoreId::KgbToys => (ORANGE, LYELLOW),
        StoreId::BlockblusterVideo => (GRAY, DGRAY),
        StoreId::SpendersGifts => (DPURPLE, LCYAN),
        StoreId::SamBaddy => (BROWN, LRED),
        StoreId::SharperImagine => (STEEL, LCYAN),
        StoreId::HotSpyOnAStick => (LYELLOW, RED),
        StoreId::CircuitPity => (CHARCOAL, DGRAY),
        StoreId::FootLockpicker => (DGRAY, LRED),
        StoreId::BorderlineBooks => (DOLIVE, DGRAY),
    };
    let (stripe_a, stripe_b) = match id.role() {
        StoreRole::Target => (RED, WHITE),
        StoreRole::PowerShop => (BLUE, WHITE),
        StoreRole::Closed => (GRAY, DGRAY),
    };
    Style { body, trim, stripe_a, stripe_b }
}

/// Is the target door in its bright phase?
pub fn blink_on(tick: u32) -> bool {
    (tick / BLINK_FRAMES) % 2 == 0
}

fn sign(fb: &mut Fb, id: StoreId, x: i32, top: i32, st: &FrontState) {
    let info = id.info();
    let (bg, fg) = match info.role {
        StoreRole::Closed => (DGRAY, GRAY),
        _ => (info.sign_color, info.sign_text),
    };
    let mut bg = bg;
    if st.cleared && info.role == StoreRole::Target {
        bg = darker(bg);
    }
    fb.rect(x, top, FRONT_W, 10, bg);
    fb.hline(x, top, FRONT_W, darker(darker(bg)));
    fb.hline(x, top + 9, FRONT_W, darker(darker(bg)));
    fb.vline(x, top, 10, darker(darker(bg)));
    fb.vline(x + FRONT_W - 1, top, 10, darker(darker(bg)));
    fb.text_center_tiny(x + FRONT_W / 2, top + 3, info.sign, fg);
    // bulbs along the top edge: red chase on targets, cool cyan twinkle on power shops
    match info.role {
        StoreRole::Target if !st.cleared => {
            for i in 0..20 {
                let on = ((st.tick / 8) + i as u32) % 3 == 0;
                fb.put(x + 2 + i * 4, top, if on { YELLOW } else { LRED });
            }
        }
        StoreRole::PowerShop => {
            for i in 0..20 {
                let on = ((st.tick / 12) + i as u32) % 4 == 0;
                fb.put(x + 2 + i * 4, top, if on { WHITE } else { LCYAN });
            }
        }
        _ => {}
    }
}

fn shutter(fb: &mut Fb, x: i32, y: i32, w: i32, h: i32) {
    fb.rect(x, y, w, h, GRAY);
    let mut yy = y;
    let mut n = 0;
    while yy < y + h {
        fb.hline(x, yy, w, DGRAY);
        if yy + 1 < y + h {
            fb.hline(x, yy + 1, w, if n % 2 == 0 { LGRAY } else { GRAY });
        }
        // slat rivets
        if yy + 2 < y + h - 3 {
            for rx in (x + 2..x + w).step_by(8) {
                fb.put(rx, yy + 2, DGRAY);
            }
        }
        yy += 4;
        n += 1;
    }
    fb.hline(x, y + h - 1, w, DGRAY);
}

fn shutter_bar(fb: &mut Fb, x: i32, y: i32, w: i32) {
    fb.rect(x, y, w, 3, CHARCOAL);
    fb.hline(x, y, w, LGRAY);
    fb.rect(x + w / 2 - 2, y + 1, 4, 1, GRAY);
}

fn door(fb: &mut Fb, id: StoreId, x: i32, floor_y: i32, st: &FrontState) {
    let d = door_rect(x, floor_y);
    let role = id.role();
    if role == StoreRole::Closed {
        fb.rect(d.x, d.y, d.w, d.h, BLACK);
        let full = id != StoreId::CircuitPity;
        if full {
            shutter(fb, d.x + 1, d.y + 1, d.w - 2, d.h - 1);
            shutter_bar(fb, d.x + 1, d.y + d.h - 3, d.w - 2);
        } else {
            // shutter stops half way: dark glass below it
            fb.rect(d.x + 1, d.y + 16, d.w - 2, d.h - 16, CHARCOAL);
            fb.dither_rect(d.x + 1, d.y + 16, d.w - 2, d.h - 16, BLACK, 0);
            // chain and padlock
            fb.vline(d.x + 11, d.y + 17, 8, GRAY);
            fb.rect(d.x + 10, d.y + 25, 4, 3, YELLOW);
        }
        return;
    }
    let (pane, dark, glint) = if role == StoreRole::Target && !st.cleared {
        if blink_on(st.tick) {
            (RED, DRED, true)
        } else {
            (DRED, MAROON, false)
        }
    } else if role == StoreRole::Target {
        (BLACK, BLACK, false)
    } else {
        (BLUE, DBLUE, true)
    };
    fb.rect(d.x, d.y, d.w, d.h, BLACK);
    fb.rect(d.x + 1, d.y + 1, d.w - 2, d.h - 1, pane);
    // two leaves with a gap
    fb.vline(d.x + 11, d.y + 1, d.h - 1, dark);
    fb.vline(d.x + 12, d.y + 1, d.h - 1, dark);
    // kick plates
    fb.rect(d.x + 1, d.y + d.h - 4, d.w - 2, 4, dark);
    fb.rect(d.x + 2, d.y + 4, 8, 17, dark);
    fb.rect(d.x + 14, d.y + 4, 8, 17, dark);
    fb.rect(d.x + 3, d.y + 5, 6, 15, pane);
    fb.rect(d.x + 15, d.y + 5, 6, 15, pane);
    // push bars
    let bar = if st.cleared && role == StoreRole::Target { GRAY } else { LGRAY };
    fb.rect(d.x + 8, d.y + 17, 1, 6, bar);
    fb.rect(d.x + 15, d.y + 17, 1, 6, bar);
    if glint {
        let g = if role == StoreRole::Target { LRED } else { LBLUE };
        fb.put(d.x + 4, d.y + 8, g);
        fb.put(d.x + 5, d.y + 7, g);
        fb.put(d.x + 6, d.y + 6, g);
        fb.put(d.x + 16, d.y + 8, g);
        fb.put(d.x + 17, d.y + 7, g);
        fb.put(d.x + 18, d.y + 6, g);
    }
    if role == StoreRole::Target && st.cleared {
        fb.dither_rect(d.x + 1, d.y + 1, d.w - 2, d.h - 1, CHARCOAL, 0);
    }
}

fn window(fb: &mut Fb, id: StoreId, right: bool, ox: i32, top: i32, st: &FrontState, trim: u8) {
    // frame
    fb.rect(ox, top + 15, WIN_W + 2, WIN_H + 2, trim);
    let w = Win { x: ox + 1, y: top + 16, t: st.tick };
    draw_window(fb, id, right, &w);
    if st.cleared && id.role() == StoreRole::Target {
        dim(fb, w.x, w.y, WIN_W, WIN_H);
    } else {
        // glass glint
        let c = WHITE;
        for (dx, dy) in [(3, 7), (4, 6), (5, 5), (7, 3), (8, 2)] {
            if (dx + dy) % 2 == 1 || dx == 3 {
                fb.put(w.x + dx, w.y + dy, c);
            }
        }
    }
    // inner shadow line at top
    fb.hline(w.x, w.y, WIN_W, darker(trim));
}

/// Draw the storefront whose left edge is `x` and whose floor line (bottom edge) is `floor_y`.
pub fn draw_storefront(fb: &mut Fb, id: StoreId, x: i32, floor_y: i32, st: &FrontState) {
    let top = floor_y - FRONT_H;
    let s = style(id);
    let role = id.role();
    // body wall
    fb.rect(x, top + 10, FRONT_W, FRONT_H - 10, s.body);
    // lintel / awning stripes
    for i in 0..FRONT_W / 4 {
        let c = if i % 2 == 0 { s.stripe_a } else { s.stripe_b };
        fb.rect(x + i * 4, top + 10, 4, 4, c);
    }
    fb.hline(x, top + 13, FRONT_W, darker(s.stripe_a));
    // bulkhead under windows
    fb.rect(x, top + 40, FRONT_W, 4, darker(s.body));
    fb.hline(x, top + 40, FRONT_W, s.trim);
    // pilasters between door and windows
    fb.rect(x, top + 14, 1, 30, darker(s.body));
    fb.rect(x + FRONT_W - 1, top + 14, 1, 30, darker(s.body));
    window(fb, id, false, x + 1, top, st, s.trim);
    window(fb, id, true, x + 53, top, st, s.trim);
    // Circuit Pity: shutter half way down over the whole opening
    if id == StoreId::CircuitPity {
        shutter(fb, x + 1, top + 15, FRONT_W - 2, 16);
        shutter_bar(fb, x + 1, top + 28, FRONT_W - 2);
        // the door area below it stays dark
    }
    // doors are drawn after the Circuit Pity shutter so the chain and padlock sit on top
    if id == StoreId::CircuitPity {
        let d = door_rect(x, floor_y);
        fb.rect(d.x, d.y + 16, d.w, d.h - 16, BLACK);
        door(fb, id, x, floor_y, st);
        shutter(fb, d.x + 1, d.y + 1, d.w - 2, 15);
        shutter_bar(fb, d.x + 1, d.y + 13, d.w - 2);
    } else {
        door(fb, id, x, floor_y, st);
    }
    if id == StoreId::BorderlineBooks {
        // CLOSING SALE banner draped across the front
        let by = top + 29;
        fb.rect(x + 12, by, 56, 9, YELLOW);
        fb.hline(x + 12, by, 56, ORANGE);
        fb.hline(x + 12, by + 8, 56, ORANGE);
        fb.text_center_tiny(x + FRONT_W / 2, by + 2, "CLOSING SALE", DRED);
        fb.rect(x + 11, by - 1, 1, 11, BROWN);
        fb.rect(x + 68, by - 1, 1, 11, BROWN);
    }
    if id == StoreId::BlockblusterVideo {
    }
    sign(fb, id, x, top, st);
    if st.black_friday && role != StoreRole::Closed {
        let on = (st.tick / 15) % 2 == 0;
        let (bg, fg) = if on { (YELLOW, RED) } else { (RED, YELLOW) };
        let px = x + 23;
        let py = top + 11;
        fb.rect(px, py, 34, 9, bg);
        fb.frame(px, py, 34, 9, if on { RED } else { YELLOW });
        fb.text_center_tiny(px + 17, py + 2, "70% OFF", fg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pixel::{text_width, FontKind};
    use crate::types::STORES;

    fn render(id: StoreId, x: i32, st: &FrontState) -> Fb {
        let mut fb = Fb::new();
        fb.clear(LGRAY);
        draw_storefront(&mut fb, id, x, 120, st);
        fb
    }

    fn count(fb: &Fb, r: Rect, c: u8) -> usize {
        let mut n = 0;
        for y in r.y..r.bottom() {
            for x in r.x..r.right() {
                if fb.get(x, y) == c {
                    n += 1;
                }
            }
        }
        n
    }

    fn door_sample(x: i32) -> Rect {
        // lower part of the door, clear of any sale sign
        let d = door_rect(x, 120);
        Rect::new(d.x + 1, d.y + 8, d.w - 2, d.h - 8)
    }

    #[test]
    fn every_sign_fits_in_the_storefront() {
        for s in STORES.iter() {
            let w = text_width(FontKind::Tiny, s.sign);
            assert!(w <= FRONT_W - 4, "{} sign is {w} px wide", s.sign);
        }
    }

    #[test]
    fn door_is_tall_enough_for_the_agent() {
        assert!(DOOR_H >= 26 && DOOR_W >= 22);
        assert!(FRONT_H >= DOOR_H + 10);
    }

    #[test]
    fn all_stores_draw_anywhere_without_panicking() {
        for id in StoreId::ALL {
            for x in [-100, -79, -40, -1, 0, 5, 100, 176, 200, 255, 256, 400] {
                for tick in [0, 7, 19, 20, 99, 1000] {
                    for (cleared, bf) in [(false, false), (true, false), (false, true), (true, true)] {
                        let mut fb = Fb::new();
                        draw_storefront(&mut fb, id, x, 120, &FrontState { cleared, tick, black_friday: bf });
                        // also at the very top / bottom of the screen
                        draw_storefront(&mut fb, id, x, 20, &FrontState { cleared, tick, black_friday: bf });
                        draw_storefront(&mut fb, id, x, 300, &FrontState { cleared, tick, black_friday: bf });
                    }
                }
            }
        }
    }

    #[test]
    fn storefronts_are_pairwise_different() {
        let st = FrontState::default();
        let all: Vec<Fb> = StoreId::ALL.iter().map(|id| render(*id, 10, &st)).collect();
        for i in 0..all.len() {
            for j in i + 1..all.len() {
                let diff = all[i].px.iter().zip(&all[j].px).filter(|(a, b)| a != b).count();
                assert!(diff > 600, "{:?} and {:?} look too alike ({diff} px differ)", StoreId::ALL[i], StoreId::ALL[j]);
            }
        }
    }

    #[test]
    fn displays_animate() {
        for id in StoreId::ALL {
            let mut seen = Vec::new();
            for tick in (0..240).step_by(4) {
                let fb = render(id, 10, &FrontState { tick, ..Default::default() });
                if !seen.contains(&fb.px) {
                    seen.push(fb.px.clone());
                }
            }
            if id.is_open() {
                assert!(seen.len() >= 2, "{id:?} never animates");
            }
        }
    }

    #[test]
    fn role_door_colours() {
        for id in StoreId::ALL {
            let r = door_sample(10);
            let on = render(id, 10, &FrontState::default());
            match id.role() {
                StoreRole::Target => {
                    assert!(count(&on, r, RED) > 150, "{id:?} door should be red");
                    assert_eq!(count(&on, r, BLUE), 0);
                    // it blinks
                    let off = render(id, 10, &FrontState { tick: BLINK_FRAMES, ..Default::default() });
                    assert!(count(&off, r, RED) < count(&on, r, RED) / 2, "{id:?} door does not blink");
                }
                StoreRole::PowerShop => {
                    assert!(count(&on, r, BLUE) > 150, "{id:?} door should be blue");
                    assert_eq!(count(&on, r, RED), 0);
                    let later = render(id, 10, &FrontState { tick: BLINK_FRAMES, ..Default::default() });
                    assert!(count(&later, r, BLUE) > 150, "power doors stay blue");
                }
                StoreRole::Closed => {
                    assert_eq!(count(&on, r, RED) + count(&on, r, BLUE), 0, "{id:?}");
                }
            }
        }
    }

    #[test]
    fn closed_stores_have_shutters() {
        for id in [StoreId::BlockblusterVideo, StoreId::CircuitPity, StoreId::BorderlineBooks] {
            let fb = render(id, 10, &FrontState::default());
            let d = door_rect(10, 120);
            // the upper half of the door is covered by slats in every closed store
            let upper = Rect::new(d.x + 1, d.y + 1, d.w - 2, 12);
            let slat = count(&fb, upper, GRAY) + count(&fb, upper, LGRAY) + count(&fb, upper, DGRAY);
            assert!(slat > (upper.w * upper.h) as usize * 8 / 10, "{id:?} door is not shuttered ({slat})");
            // slats alternate: dark joint lines every 4 rows
            let dark_rows = (0..upper.h).filter(|j| (0..upper.w).all(|i| fb.get(upper.x + i, upper.y + j) == DGRAY)).count();
            assert!(dark_rows >= 2, "{id:?} shutter has no slat joints");
        }
        // open stores have no shutter in the door
        let fb = render(StoreId::SamBaddy, 10, &FrontState::default());
        let d = door_rect(10, 120);
        assert!(count(&fb, Rect::new(d.x + 1, d.y + 1, d.w - 2, 12), GRAY) < 10);
    }

    #[test]
    fn cleared_target_differs_and_goes_dark() {
        for id in StoreId::ALL.into_iter().filter(|i| i.role() == StoreRole::Target) {
            let a = render(id, 10, &FrontState::default());
            let b = render(id, 10, &FrontState { cleared: true, ..Default::default() });
            let diff = a.px.iter().zip(&b.px).filter(|(p, q)| p != q).count();
            assert!(diff > 500, "{id:?}: cleared looks the same");
            let r = door_sample(10);
            assert_eq!(count(&b, r, RED), 0, "{id:?}: cleared door still red");
            // windows are darker: fewer bright (lightness >= 0x30) pixels
            let bright = |fb: &Fb| fb.px.iter().filter(|p| **p >= 0x30 && **p != 0x3D && **p <= 0x3C).count();
            assert!(bright(&b) < bright(&a), "{id:?}: windows not dimmed");
        }
        // clearing only matters for targets
        for id in StoreId::ALL.into_iter().filter(|i| i.role() != StoreRole::Target) {
            let a = render(id, 10, &FrontState::default());
            let b = render(id, 10, &FrontState { cleared: true, ..Default::default() });
            assert_eq!(a.px, b.px, "{id:?} must ignore `cleared`");
        }
    }

    #[test]
    fn black_friday_marks_open_stores_only() {
        for id in StoreId::ALL {
            let a = render(id, 10, &FrontState::default());
            let b = render(id, 10, &FrontState { black_friday: true, ..Default::default() });
            if id.is_open() {
                assert_ne!(a.px, b.px, "{id:?} shows no sale sign");
                // and it flashes
                let c = render(id, 10, &FrontState { black_friday: true, tick: 15, ..Default::default() });
                assert_ne!(b.px, c.px.clone().into_iter().map(|p| p).collect::<Vec<_>>(), "{id:?} sale sign does not flash");
            } else {
                assert_eq!(a.px, b.px, "{id:?} is closed: no sale");
            }
        }
    }

    #[test]
    fn storefront_stays_inside_its_box() {
        // nothing is drawn outside x..x+80, floor_y-44..floor_y
        for id in StoreId::ALL {
            let mut fb = Fb::new();
            fb.clear(LGRAY);
            draw_storefront(&mut fb, id, 50, 150, &FrontState { black_friday: true, tick: 33, ..Default::default() });
            for y in 0..240 {
                for x in 0..256 {
                    let inside = (50..130).contains(&x) && (106..150).contains(&y);
                    if !inside {
                        assert_eq!(fb.get(x, y), LGRAY, "{id:?} drew outside its box at {x},{y}");
                    }
                }
            }
        }
    }
}
