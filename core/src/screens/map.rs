//! MALL DIRECTORY: the Select-button map overlay. A schematic of all six floors built from `layout.rs`:
//! shafts with their cars' current positions, escalators, the getaway wagon on P, colour-coded stores, a
//! blinking "you are here" marker (or the blinking store rectangle when inside one), radar "!" marks, a legend
//! and the inventory line.

use crate::layout::{self, ESCALATORS, SHAFTS, STORE_W, WORLD_W};
use crate::mall::MapInfo;
use crate::pixel::{pal, text_width, Fb, FontKind, Rect, H, W};
use crate::run::RunState;
use crate::types::{Floor, StoreId, StoreRole, FLOOR_COUNT};
use crate::ui;

/// Left edge of the schematic and its width in screen pixels (768 world px -> 232 px, about 1/3.3).
pub const MAP_X: i32 = 18;
pub const MAP_W: i32 = 232;
/// Top of the first (roof) band, band height and vertical pitch.
pub const BAND_Y0: i32 = 20;
pub const BAND_H: i32 = 28;
pub const BAND_PITCH: i32 = 31;
/// Stores are drawn this tall, sitting on the floor line of their band.
pub const STORE_H: i32 = 17;

const FLOOR_LINE_OFF: i32 = BAND_H - 3;

/// What a store looks like on the directory.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreMark {
    /// Target store whose package is still inside (red).
    Package,
    /// Target store already cleared (grey).
    Cleared,
    /// Power-up shop (blue).
    Shop,
    /// Closed for business (dark outline only).
    Closed,
}

pub fn store_mark(run: &RunState, id: StoreId) -> StoreMark {
    match id.role() {
        StoreRole::Target => {
            if run.store_cleared(id) {
                StoreMark::Cleared
            } else {
                StoreMark::Package
            }
        }
        StoreRole::PowerShop => StoreMark::Shop,
        StoreRole::Closed => StoreMark::Closed,
    }
}

fn sx(world_x: i32) -> i32 {
    MAP_X + world_x * MAP_W / WORLD_W
}

pub fn band(f: Floor) -> Rect {
    Rect::new(MAP_X - 2, BAND_Y0 + f.index() as i32 * BAND_PITCH, MAP_W + 4, BAND_H)
}

/// Y of the floor line (where feet stand) on the directory.
pub fn floor_line_y(f: Floor) -> i32 {
    band(f).y + FLOOR_LINE_OFF
}

pub fn store_rect(id: StoreId) -> Rect {
    let x0 = sx(layout::store_x(id));
    let x1 = sx(layout::store_x(id) + STORE_W);
    let fy = floor_line_y(id.info().floor);
    Rect::new(x0, fy - STORE_H, x1 - x0, STORE_H)
}

pub fn shaft_rect(i: usize) -> Rect {
    let s = &SHAFTS[i];
    let x0 = sx(s.x);
    let x1 = sx(s.x + layout::SHAFT_W);
    let top = floor_line_y(s.top) - STORE_H;
    let bot = floor_line_y(s.bottom);
    Rect::new(x0, top, x1 - x0, bot - top + 1)
}

/// Y of the car (its centre) for a floor position 0.0 (roof) ..= 5.0 (P).
pub fn car_y(pos: f32) -> i32 {
    let p = pos.clamp(0.0, (FLOOR_COUNT - 1) as f32);
    floor_line_y(Floor::Roof) + (p * BAND_PITCH as f32).round() as i32 - 4
}

pub fn wagon_rect() -> Rect {
    let x0 = sx(layout::CAR_X);
    let x1 = sx(layout::CAR_X + layout::CAR_W);
    Rect::new(x0, floor_line_y(Floor::Parking) - 6, x1 - x0, 6)
}

const BG: u8 = pal::NAVY;

fn fill_of(m: StoreMark) -> Option<(u8, u8)> {
    // (fill, edge)
    match m {
        StoreMark::Package => Some((pal::RED, pal::LRED)),
        StoreMark::Cleared => Some((pal::GRAY, pal::LGRAY)),
        StoreMark::Shop => Some((pal::BLUE, pal::LBLUE)),
        StoreMark::Closed => None,
    }
}

fn line(fb: &mut Fb, x0: i32, y0: i32, x1: i32, y1: i32, c: u8) {
    let n = (x1 - x0).abs().max((y1 - y0).abs()).max(1);
    for i in 0..=n {
        fb.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
    }
}

fn draw_store(fb: &mut Fb, run: &RunState, id: StoreId, radar: bool, blink_on: bool, active: bool) {
    let r = store_rect(id);
    let m = store_mark(run, id);
    match fill_of(m) {
        Some((fill, edge)) => {
            fb.rect(r.x, r.y, r.w, r.h, fill);
            fb.frame(r.x, r.y, r.w, r.h, edge);
        }
        None => fb.frame(r.x, r.y, r.w, r.h, pal::DGRAY),
    }
    // door notch at the bottom centre
    fb.rect(r.x + r.w / 2 - 1, r.y + r.h - 3, 2, 3, pal::BLACK);
    if radar && m == StoreMark::Package {
        fb.text(r.x + r.w / 2 - 2, r.y + 3, "!", pal::WHITE);
    }
    if active && blink_on {
        fb.rect(r.x, r.y, r.w, r.h, pal::YELLOW);
        fb.frame(r.x, r.y, r.w, r.h, pal::WHITE);
    }
}

/// Draw the whole overlay. `in_store` makes that store blink instead of the player marker.
pub fn draw(fb: &mut Fb, run: &RunState, info: &MapInfo, in_store: Option<StoreId>, tick: u32) {
    fb.clear(pal::BLACK);
    fb.frame(1, 1, W as i32 - 2, H as i32 - 2, pal::DBLUE);
    fb.text_center(W as i32 / 2, 6, "MALL DIRECTORY", pal::LYELLOW);
    fb.hline(40, 14, W as i32 - 80, pal::MBLUE);

    let blink_on = ui::blink(tick, 16, 12);
    let radar = run.power.radar;

    for f in Floor::ALL {
        let b = band(f);
        fb.rect(b.x, b.y, b.w, b.h, BG);
        fb.hline(b.x, floor_line_y(f), b.w, pal::STEEL);
        fb.text_tiny(2, floor_line_y(f) - 5, f.label(), pal::WHITE);
    }
    // shafts and cars
    for (i, s) in SHAFTS.iter().enumerate() {
        let r = shaft_rect(i);
        fb.rect(r.x, r.y, r.w, r.h, pal::BLACK);
        fb.frame(r.x, r.y, r.w, r.h, if s.manual { pal::TAN } else { pal::CYAN });
    }
    // escalators: diagonal between the two floor lines
    for e in ESCALATORS.iter() {
        let x0 = sx(e.x);
        let x1 = sx(e.x + layout::ESC_W);
        let (yu, yl) = (floor_line_y(e.upper), floor_line_y(e.lower()));
        line(fb, x0, yl, x1, yu, pal::LGREEN);
        line(fb, x0, yl - 1, x1, yu - 1, pal::GREEN);
    }
    // stores
    let player_in_store = in_store;
    for id in StoreId::ALL {
        draw_store(fb, run, id, radar, blink_on, player_in_store == Some(id));
    }
    // wagon on P
    let w = wagon_rect();
    fb.rect(w.x, w.y, w.w, w.h - 2, pal::ORANGE);
    fb.rect(w.x + 3, w.y - 2, w.w - 6, 2, pal::ORANGE);
    fb.rect(w.x + 2, w.y + w.h - 2, 3, 2, pal::WHITE);
    fb.rect(w.x + w.w - 5, w.y + w.h - 2, 3, 2, pal::WHITE);
    // cars at their live positions
    for (i, pos) in info.car_floor_pos.iter().enumerate() {
        let r = shaft_rect(i);
        let y = car_y(*pos);
        fb.rect(r.x + 1, y - 3, r.w - 2, 7, pal::YELLOW);
        fb.frame(r.x + 1, y - 3, r.w - 2, 7, pal::BROWN);
    }
    // player marker
    if in_store.is_none() && blink_on {
        let px = sx(info.player_x.clamp(0, WORLD_W));
        let fy = floor_line_y(info.player_floor);
        fb.rect(px - 1, fy - 8, 3, 8, pal::WHITE);
        fb.rect(px - 1, fy - 8, 3, 2, pal::LPINK);
        fb.rect(px, fy - 10, 1, 2, pal::LPINK);
    }

    draw_legend(fb);
    draw_inventory(fb, run);
    if ui::blink(tick, 40, 20) {
        fb.text_center_tiny(W as i32 / 2, 233, "PRESS SELECT TO RETURN", pal::LAVENDER);
    }
}

fn swatch(fb: &mut Fb, x: i32, y: i32, mark: Option<StoreMark>, label: &str) -> i32 {
    match mark.and_then(fill_of) {
        Some((fill, edge)) => {
            fb.rect(x, y, 7, 6, fill);
            fb.frame(x, y, 7, 6, edge);
        }
        None => {
            if mark == Some(StoreMark::Closed) {
                fb.frame(x, y, 7, 6, pal::DGRAY);
            } else {
                // the player marker swatch
                fb.rect(x + 2, y, 3, 6, pal::WHITE);
            }
        }
    }
    let end = fb.text_tiny(x + 10, y + 1, label, pal::WHITE);
    end + 5
}

fn draw_legend(fb: &mut Fb) {
    let y = 208;
    let mut x = 6;
    x = swatch(fb, x, y, Some(StoreMark::Package), "PACKAGE");
    x = swatch(fb, x, y, Some(StoreMark::Cleared), "CLEARED");
    x = swatch(fb, x, y, Some(StoreMark::Shop), "SHOP");
    x = swatch(fb, x, y, Some(StoreMark::Closed), "CLOSED");
    swatch(fb, x, y, None, "YOU");
    // second row: transport
    let y2 = 217;
    fb.rect(6, y2, 7, 6, pal::BLACK);
    fb.frame(6, y2, 7, 6, pal::TAN);
    let x = fb.text_tiny(16, y2 + 1, "LIFT", pal::WHITE) + 5;
    fb.rect(x, y2, 7, 6, pal::BLACK);
    fb.frame(x, y2, 7, 6, pal::CYAN);
    let x = fb.text_tiny(x + 10, y2 + 1, "AUTO LIFT", pal::WHITE) + 5;
    line(fb, x, y2 + 5, x + 6, y2, pal::LGREEN);
    let x = fb.text_tiny(x + 10, y2 + 1, "ESCALATOR", pal::WHITE) + 5;
    fb.rect(x, y2 + 1, 8, 4, pal::ORANGE);
    fb.text_tiny(x + 11, y2 + 1, "GETAWAY WAGON", pal::WHITE);
}

/// The inventory line text (joke items), truncated with ".." so it always fits the screen.
pub fn inventory_text(run: &RunState) -> String {
    let mut s = String::from("LOOT: ");
    if run.inventory.is_empty() {
        s.push_str("NONE YET");
    } else {
        s.push_str(&run.inventory.join(", "));
    }
    let max_chars = ((W as i32 - 10 - 26) / FontKind::Tiny.advance()) as usize;
    if s.chars().count() > max_chars {
        s = s.chars().take(max_chars - 2).collect::<String>() + "..";
    }
    s
}

fn draw_inventory(fb: &mut Fb, run: &RunState) {
    let y = 226;
    let txt = inventory_text(run);
    let end = fb.text_tiny(6, y, &txt, pal::LYELLOW);
    debug_assert!(end <= W as i32 - 4);
    if run.photo_done {
        // photo strip: three little frames
        let (px, py) = (W as i32 - 22, 212);
        fb.rect(px, py, 8, 15, pal::WHITE);
        for i in 0..3 {
            fb.rect(px + 1, py + 1 + i * 5, 6, 4, pal::DPURPLE);
        }
        fb.rect(px + 2, py + 6, 4, 2, pal::LPINK);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info() -> MapInfo {
        MapInfo { player_floor: Floor::F3, player_x: 300, car_floor_pos: [0.0, 2.5, 5.0] }
    }

    #[test]
    fn layout_fits_the_screen_and_stays_disjoint() {
        for f in Floor::ALL {
            let b = band(f);
            assert!(b.x >= 0 && b.right() <= W as i32 && b.y >= 15 && b.bottom() <= 206, "{b:?}");
        }
        for id in StoreId::ALL {
            let r = store_rect(id);
            let b = band(id.info().floor);
            assert!(r.x >= b.x && r.right() <= b.right() && r.y >= b.y && r.bottom() <= b.bottom(), "{id:?} {r:?}");
        }
        for i in 0..3 {
            let r = shaft_rect(i);
            assert!(r.x >= 0 && r.right() <= W as i32 && r.y >= 15 && r.bottom() <= 206);
        }
        // stores on one floor never overlap each other or the shafts that serve it
        for f in Floor::ALL {
            let stores = layout::stores_on(f);
            for (i, a) in stores.iter().enumerate() {
                for b in stores.iter().skip(i + 1) {
                    assert!(!store_rect(*a).intersects(&store_rect(*b)));
                }
                for (si, s) in SHAFTS.iter().enumerate() {
                    if s.serves(f) {
                        assert!(!store_rect(*a).intersects(&shaft_rect(si)), "{a:?} vs shaft {si}");
                    }
                }
            }
        }
        let w = wagon_rect();
        assert!(w.right() <= W as i32 && w.bottom() <= band(Floor::Parking).bottom());
        // scale is about 1/3.3
        assert!((768.0 / MAP_W as f32 - 3.3).abs() < 0.1);
    }

    #[test]
    fn marks_follow_role_and_state() {
        let mut run = RunState::new(1, false);
        assert_eq!(store_mark(&run, StoreId::KgbToys), StoreMark::Package);
        assert_eq!(store_mark(&run, StoreId::Crookstone), StoreMark::Shop);
        assert_eq!(store_mark(&run, StoreId::CircuitPity), StoreMark::Closed);
        let mut o = crate::events::Out::new();
        run.take_package(StoreId::KgbToys, &mut o);
        assert_eq!(store_mark(&run, StoreId::KgbToys), StoreMark::Cleared);
    }

    fn centre(id: StoreId) -> (i32, i32) {
        let r = store_rect(id);
        (r.x + 3, r.y + 3)
    }

    #[test]
    fn store_colours_by_state() {
        let mut run = RunState::new(1, false);
        let mut o = crate::events::Out::new();
        run.take_package(StoreId::KgbToys, &mut o);
        let mut fb = Fb::new();
        draw(&mut fb, &run, &info(), None, 0);
        let c = |id| {
            let (x, y) = centre(id);
            fb.get(x, y)
        };
        assert_eq!(c(StoreId::Forever12), pal::RED);
        assert_eq!(c(StoreId::KgbToys), pal::GRAY);
        assert_eq!(c(StoreId::Crookstone), pal::BLUE);
        assert_eq!(c(StoreId::CircuitPity), BG, "closed shop is just an outline");
        let r = store_rect(StoreId::CircuitPity);
        assert_eq!(fb.get(r.x, r.y), pal::DGRAY);
    }

    fn count_white_in(fb: &Fb, r: Rect) -> usize {
        let mut n = 0;
        for y in r.y..r.bottom() {
            for x in r.x..r.right() {
                if fb.get(x, y) == pal::WHITE {
                    n += 1;
                }
            }
        }
        n
    }

    #[test]
    fn radar_marks_only_uncleared_targets_and_only_with_radar() {
        let mut run = RunState::new(1, false);
        let mut o = crate::events::Out::new();
        run.take_package(StoreId::KgbToys, &mut o);
        let inner = |id: StoreId| {
            let r = store_rect(id);
            Rect::new(r.x + 2, r.y + 2, r.w - 4, r.h - 6)
        };
        let nowhere = MapInfo { player_floor: Floor::Roof, player_x: 10, car_floor_pos: [0.0; 3] };
        let mut off = Fb::new();
        draw(&mut off, &run, &nowhere, None, 20);
        for id in StoreId::ALL {
            assert_eq!(count_white_in(&off, inner(id)), 0, "no marks without radar: {id:?}");
        }
        run.power.grant(crate::types::PowerUp::Radar);
        let mut on = Fb::new();
        draw(&mut on, &run, &nowhere, None, 20);
        for id in StoreId::ALL {
            let n = count_white_in(&on, inner(id));
            let want = id.role() == StoreRole::Target && !run.store_cleared(id);
            assert_eq!(n > 0, want, "{id:?}");
        }
    }

    #[test]
    fn player_marker_blinks_on_its_floor_and_x() {
        let run = RunState::new(1, false);
        let i = info();
        let px = sx(i.player_x);
        let fy = floor_line_y(i.player_floor);
        let mut on = Fb::new();
        draw(&mut on, &run, &i, None, 0);
        let mut off = Fb::new();
        draw(&mut off, &run, &i, None, 20);
        assert_eq!(on.get(px, fy - 5), pal::WHITE);
        assert_ne!(off.get(px, fy - 5), pal::WHITE);
    }

    #[test]
    fn inside_a_store_that_store_blinks_and_the_marker_is_hidden() {
        let run = RunState::new(1, false);
        let i = info();
        let (x, y) = centre(StoreId::SamBaddy);
        let mut on = Fb::new();
        draw(&mut on, &run, &i, Some(StoreId::SamBaddy), 0);
        let mut off = Fb::new();
        draw(&mut off, &run, &i, Some(StoreId::SamBaddy), 20);
        assert_eq!(on.get(x, y), pal::YELLOW);
        assert_ne!(off.get(x, y), pal::YELLOW);
        let px = sx(i.player_x);
        assert_ne!(on.get(px, floor_line_y(i.player_floor) - 5), pal::WHITE);
    }

    #[test]
    fn cars_are_drawn_where_the_mall_says() {
        let run = RunState::new(1, false);
        let mut a = Fb::new();
        draw(&mut a, &run, &MapInfo { player_floor: Floor::F1, player_x: 10, car_floor_pos: [0.0, 1.0, 2.0] }, None, 20);
        let mut b = Fb::new();
        draw(&mut b, &run, &MapInfo { player_floor: Floor::F1, player_x: 10, car_floor_pos: [0.0, 3.0, 2.0] }, None, 20);
        let r = shaft_rect(1);
        assert_eq!(a.get(r.x + 2, car_y(1.0)), pal::YELLOW);
        assert_eq!(b.get(r.x + 2, car_y(3.0)), pal::YELLOW);
        assert_ne!(a.get(r.x + 2, car_y(3.0)), pal::YELLOW);
    }

    #[test]
    fn inventory_line_fits_and_photo_strip_shows() {
        let mut run = RunState::new(1, false);
        assert!(inventory_text(&run).contains("NONE"));
        for n in crate::copy::EGG_ITEMS {
            run.inventory.push(n.to_string());
        }
        run.inventory.push("A VERY LONG EXTRA ITEM NAME THAT GOES ON".into());
        let t = inventory_text(&run);
        assert!(text_width(FontKind::Tiny, &t) + 6 <= W as i32 - 26, "{t}");
        assert!(t.ends_with(".."));
        let mut a = Fb::new();
        draw(&mut a, &run, &info(), None, 0);
        run.photo_done = true;
        let mut b = Fb::new();
        draw(&mut b, &run, &info(), None, 0);
        assert_ne!(a.px, b.px);
    }
}
