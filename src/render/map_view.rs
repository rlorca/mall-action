use super::screen_fx::{blink_on, W};
use crate::content::copy::UI;
use crate::content::layout::{ESCALATORS, FEATURES, FLOOR_GAP, FLOOR_NAMES, LEVEL_W, NUM_FLOORS, ROOF_Y, SHAFTS, WAGON, FeatureKind};
use crate::content::stores::{store_def, StoreId, STORES, STORE_W};
use crate::engine::font::{draw_text, text_width, wrap_text, Align, TextOpts, FONT_TINY};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::levelstate::StoreStatus;
use crate::game::screens::mapdata::MapData;
use crate::game::screens::screentext::SCREEN_TEXT;

/// MALL DIRECTORY: a schematic of the whole mall (not to scale: 768 px across becomes 230, each 48 px floor
/// becomes 26). Every position goes through map_x / map_y so stores, shafts, cars, escalators, the wagon and the
/// player all stay consistent with each other.
pub const MAP_X0: i32 = 20;
pub const MAP_XS: f64 = 0.3;
pub const MAP_TOP: i32 = 36; // y of the roof walking surface
pub const MAP_PITCH: i32 = 24; // y distance between floors
const BOX_H: i32 = 16;

pub fn map_x(wx: f64) -> i32 {
    round_i(MAP_X0 as f64 + wx * MAP_XS)
}
/// World y (a floor surface or feet y) -> map y. Linear in floors, so a gliding car moves smoothly.
pub fn map_y(wy: f64) -> i32 {
    round_i(MAP_TOP as f64 + ((wy - ROOF_Y) / FLOOR_GAP) * MAP_PITCH as f64)
}
fn line_y(floor: i32) -> i32 {
    MAP_TOP + floor * MAP_PITCH
}

pub fn store_box_w() -> i32 {
    round_i(STORE_W * MAP_XS)
}

/// TS `STORE_BOX_W`.
pub const STORE_BOX_W: i32 = 24;

/// Short sign for the box: the first word of the store name, at most 5 letters.
pub fn short_label(name: &str) -> String {
    name.split(' ').next().unwrap_or("").chars().filter(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit()).take(5).collect()
}

#[derive(Clone, Copy, Debug)]
pub struct StoreBox {
    pub id: StoreId,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Where each store's box is drawn (exported for tests).
pub fn store_boxes() -> Vec<StoreBox> {
    STORES.iter().map(|s| StoreBox { id: s.id, x: map_x(s.x), y: line_y(s.floor) - BOX_H - 2, w: store_box_w(), h: BOX_H }).collect()
}

fn fill_of(st: StoreStatus) -> Option<u8> {
    match st {
        StoreStatus::Package => Some(c::RED),
        StoreStatus::Cleared => Some(c::GRAY),
        StoreStatus::Powerup => Some(c::BLUE),
        StoreStatus::Closed => None,
    }
}
fn label_of(st: StoreStatus) -> u8 {
    match st {
        StoreStatus::Package => c::WHITE,
        StoreStatus::Cleared => c::BLACK,
        StoreStatus::Powerup => c::WHITE,
        StoreStatus::Closed => c::MDGRAY,
    }
}
fn border_of(st: StoreStatus) -> u8 {
    match st {
        StoreStatus::Package => c::SALMON,
        StoreStatus::Powerup => c::CYAN,
        _ => c::LTGRAY,
    }
}

fn draw_store_box(fb: &mut Framebuffer, b: &StoreBox, status: StoreStatus, name: &str, flash: bool, bang: bool, frame: i32) {
    let fill = fill_of(status);
    if flash {
        fb.fill_rect(b.x, b.y, b.w, b.h, c::WHITE);
        fb.stroke_rect(b.x, b.y, b.w, b.h, c::YELLOW);
    } else if let Some(f) = fill {
        fb.fill_rect(b.x, b.y, b.w, b.h, f);
        fb.stroke_rect(b.x, b.y, b.w, b.h, border_of(status));
    } else {
        fb.stroke_rect(b.x, b.y, b.w, b.h, c::MDGRAY);
    }
    let label = short_label(name);
    let tiny = TextOpts::default().font(&FONT_TINY);
    let lw = text_width(&label, &tiny);
    let col = if flash { c::BLACK } else { label_of(status) };
    draw_text(fb, &label, b.x + (b.w - lw).div_euclid(2), b.y + b.h - 7, col, &tiny);
    if bang {
        draw_bang(fb, b.x + b.w.div_euclid(2), b.y + 2, if frame % 20 < 12 { c::YELLOW } else { c::WHITE });
    }
}

fn thick_line(fb: &mut Framebuffer, x0: i32, y0: i32, x1: i32, y1: i32, col: u8) {
    fb.line(x0, y0, x1, y1, col);
    fb.line(x0 + 1, y0, x1 + 1, y1, col);
}

fn draw_getaway_car(fb: &mut Framebuffer, x: i32, floor_line: i32) {
    let y = floor_line - 8;
    fb.fill_rect(x, y + 2, 22, 5, c::AMBER);
    fb.fill_rect(x + 4, y, 14, 3, c::AMBER);
    fb.fill_rect(x + 5, y + 1, 5, 2, c::CYAN);
    fb.fill_rect(x + 11, y + 1, 5, 2, c::CYAN);
    fb.h_line(x + 1, y + 4, 20, c::BROWN);
    fb.fill_rect(x + 3, y + 6, 3, 2, c::BLACK);
    fb.fill_rect(x + 16, y + 6, 3, 2, c::BLACK);
}

fn draw_elevator_car(fb: &mut Framebuffer, x: i32, bottom: i32, h: i32) {
    fb.fill_rect(x, bottom - h, 7, h, c::YELLOW);
    fb.stroke_rect(x, bottom - h, 7, h, c::BLACK);
    fb.v_line(x + 3, bottom - h + 1, h - 2, c::BROWN);
}

/// A bold 3 px wide "!" (the thin font glyph is hard to see at this size).
fn draw_bang(fb: &mut Framebuffer, cx: i32, y: i32, color: u8) {
    fb.fill_rect(cx - 1, y, 3, 4, color);
    fb.fill_rect(cx - 1, y + 5, 3, 2, color);
}

fn draw_player_marker(fb: &mut Framebuffer, cx: i32, feet: i32) {
    let x = cx - 2;
    let y = feet - 8;
    fb.fill_rect(x - 1, y - 1, 7, 10, c::BLACK);
    fb.fill_rect(x + 1, y, 3, 3, c::PEACH); // head
    fb.fill_rect(x, y + 3, 5, 4, c::WHITE); // coat
    fb.fill_rect(x + 1, y + 7, 1, 1, c::WHITE);
    fb.fill_rect(x + 3, y + 7, 1, 1, c::WHITE);
}

fn legend_swatch(fb: &mut Framebuffer, x: i32, y: i32, status: StoreStatus) {
    match fill_of(status) {
        None => fb.stroke_rect(x, y, 9, 7, c::MDGRAY),
        Some(f) => {
            fb.fill_rect(x, y, 9, 7, f);
            fb.stroke_rect(x, y, 9, 7, border_of(status));
        }
    }
}

/// Lines the inventory occupies (wrapped, at most 3; the last one ends with "..." when it overflows).
pub fn inventory_lines(inventory: &str) -> Vec<String> {
    let o = TextOpts::default();
    let all = wrap_text(&format!("{} {}", SCREEN_TEXT.map.items, inventory), W - 16, &o);
    if all.len() <= 3 {
        return all;
    }
    let mut lines: Vec<String> = all[..3].to_vec();
    let mut last = lines[2].clone();
    while text_width(&format!("{}...", last), &o) > W - 16 {
        last.pop();
    }
    lines[2] = format!("{}...", last);
    lines
}

pub fn draw_map_view(fb: &mut Framebuffer, data: &MapData) {
    let t = SCREEN_TEXT.map;
    let frame = data.frame;
    let o = TextOpts::default();
    let tiny = TextOpts::default().font(&FONT_TINY);
    fb.clear(c::BLACK);

    // ---- title bar
    fb.fill_rect(0, 0, W, 14, c::DKBLUE);
    fb.h_line(0, 14, W, c::SKY);
    draw_text(fb, UI.directory, W / 2, 3, c::WHITE, &TextOpts::default().align(Align::Center).shadow(c::BLACK));
    draw_text(fb, t.close, W - 4, 5, c::PALEBLUE, &tiny.align(Align::Right));
    if data.black_friday && blink_on(frame, 24, 14) {
        draw_text(fb, UI.black_friday, 4, 5, c::YELLOW, &tiny);
    }

    // ---- mall shell
    let left = map_x(0.0);
    let right = map_x(LEVEL_W);
    for f in 0..NUM_FLOORS {
        let y = line_y(f);
        fb.fill_rect(left, y - 1, right - left, 2, if f == 0 { c::WHITE } else { c::LTGRAY });
        draw_text(fb, FLOOR_NAMES[f as usize], 3, y - 13, if f == 0 { c::CYAN } else { c::YELLOW }, &o);
    }
    fb.v_line(left, line_y(0) - 19, line_y(NUM_FLOORS - 1) - line_y(0) + 19, c::GRAY);
    fb.v_line(right - 1, line_y(0) - 19, line_y(NUM_FLOORS - 1) - line_y(0) + 19, c::GRAY);
    // ground below P
    fb.fill_rect(left, line_y(NUM_FLOORS - 1) + 1, right - left, 3, c::BROWN);

    // roof clutter and parking pillars (from the real feature table)
    for ft in FEATURES {
        if ft.kind == FeatureKind::Ac {
            fb.fill_rect(map_x(ft.x), line_y(0) - 5, round_i(ft.w * MAP_XS), 4, c::GRAY);
        }
        if ft.kind == FeatureKind::Post {
            fb.fill_rect(map_x(ft.x), line_y(0) - 9, 2, 8, c::AMBER);
        }
        if ft.kind == FeatureKind::Pillar {
            fb.fill_rect(map_x(ft.x), line_y(5) - 17, round_i(ft.w * MAP_XS).max(2), 16, c::MDGRAY);
        }
    }

    // ---- elevator shafts + cars
    for s in SHAFTS.iter() {
        let x = map_x(s.x);
        let top = line_y(s.top) - BOX_H - 2;
        let bot = line_y(s.bottom);
        fb.fill_rect(x, top, round_i(s.w * MAP_XS), bot - top, c::DKTEAL);
        fb.stroke_rect(x - 1, top - 1, round_i(s.w * MAP_XS) + 2, bot - top + 2, c::TEAL);
        draw_text(fb, s.id.as_str(), x + 1, if s.bottom == NUM_FLOORS - 1 { bot + 4 } else { bot + 3 }, c::CYAN, &o);
    }
    for car in &data.cars {
        let s = match SHAFTS.iter().find(|x| x.id == car.shaft) {
            Some(s) => s,
            None => continue,
        };
        let lo = line_y(s.top);
        let hi = line_y(s.bottom);
        let bottom = map_y(car.y).min(hi).max(lo);
        draw_elevator_car(fb, map_x(s.x), bottom, 16);
    }

    // ---- escalators
    for e in ESCALATORS.iter() {
        thick_line(fb, map_x(e.x_low), line_y(e.lower) - 2, map_x(e.x_high), line_y(e.upper) - 2, c::ORANGE);
    }

    // ---- getaway car on P
    draw_getaway_car(fb, map_x(WAGON.x), line_y(NUM_FLOORS - 1));

    // ---- stores
    let blink_now = blink_on(frame, 24, 14);
    for b in store_boxes() {
        let def = store_def(b.id);
        let status = data.status(b.id);
        let flash = data.player.in_store == Some(b.id) && blink_now;
        draw_store_box(fb, &b, status, def.name, flash, data.radar && status == StoreStatus::Package, frame);
    }

    // ---- player
    if data.player.in_store.is_none() && blink_now {
        let px = map_x(data.player.x).min(right - 4).max(left + 3);
        let feet = (map_y(data.player.y) - 1).min(line_y(NUM_FLOORS - 1)).max(line_y(0) - 1);
        draw_player_marker(fb, px, feet);
    }

    // ---- legend
    let mut ly = 172;
    let items: [(StoreStatus, &str); 4] =
        [(StoreStatus::Package, t.legend_package), (StoreStatus::Cleared, t.legend_cleared), (StoreStatus::Powerup, t.legend_powerup), (StoreStatus::Closed, t.legend_closed)];
    let total: i32 = items.iter().map(|(_, s)| 12 + text_width(s, &o)).sum::<i32>() + 6 * (items.len() as i32 - 1);
    let mut lx = (W - total).div_euclid(2);
    for (st, text) in items {
        legend_swatch(fb, lx, ly, st);
        draw_text(fb, text, lx + 12, ly, c::WHITE, &o);
        lx += 12 + text_width(text, &o) + 6;
    }
    ly += 11;
    // row 2: you / package marker / elevator
    lx = 12;
    draw_player_marker(fb, lx + 3, ly + 8);
    draw_text(fb, t.legend_you, lx + 12, ly, c::WHITE, &o);
    lx += 12 + text_width(t.legend_you, &o) + 12;
    draw_bang(fb, lx + 3, ly, if data.radar { c::YELLOW } else { c::MDGRAY });
    draw_text(fb, t.legend_radar, lx + 10, ly, if data.radar { c::WHITE } else { c::MDGRAY }, &o);
    lx += 10 + text_width(t.legend_radar, &o) + 12;
    draw_elevator_car(fb, lx, ly + 8, 9);
    draw_text(fb, t.legend_car, lx + 11, ly, c::WHITE, &o);
    ly += 11;
    // row 3: getaway car / escalator
    lx = 12;
    draw_getaway_car(fb, lx, ly + 8);
    draw_text(fb, t.legend_getaway, lx + 26, ly, c::WHITE, &o);
    lx += 26 + text_width(t.legend_getaway, &o) + 12;
    thick_line(fb, lx, ly + 7, lx + 8, ly, c::ORANGE);
    draw_text(fb, t.legend_escalator, lx + 14, ly, c::WHITE, &o);

    // ---- inventory
    let lines = inventory_lines(&data.inventory);
    fb.h_line(8, 206, W - 16, c::DKBLUE);
    for (i, l) in lines.iter().enumerate() {
        draw_text(fb, l, 8, 210 + i as i32 * 8, if i == 0 { c::PALEYELLOW } else { c::LTGRAY }, &o);
    }
}
