//! Window displays: what each store sells, drawn into a 24x23 window interior with idle animation.

use super::draw::*;
use crate::pixel::{pal::*, Fb, FontKind};
use crate::types::StoreId;

/// A window interior (24 x 23 px) and the animation clock.
#[derive(Clone, Copy)]
pub struct Win {
    pub x: i32,
    pub y: i32,
    pub t: u32,
}

pub const WIN_W: i32 = 24;
pub const WIN_H: i32 = 23;

fn backdrop(fb: &mut Fb, w: &Win, wall: u8, floor: u8) {
    fb.rect(w.x, w.y, WIN_W, WIN_H, wall);
    fb.rect(w.x, w.y + WIN_H - 3, WIN_W, 3, floor);
    fb.hline(w.x, w.y + WIN_H - 3, WIN_W, darker(floor));
}

pub fn draw_window(fb: &mut Fb, id: StoreId, right: bool, w: &Win) {
    let r = crate::pixel::Rect::new(w.x, w.y, WIN_W, WIN_H);
    clipped(fb, r, |fb| match (id, right) {
        (StoreId::Forever12, false) => f12_mannequins(fb, w),
        (StoreId::Forever12, true) => f12_rack(fb, w),
        (StoreId::RadioShock, false) => radio_tvs(fb, w),
        (StoreId::RadioShock, true) => radio_walkies(fb, w),
        (StoreId::Crookstone, false) => crook_chair(fb, w),
        (StoreId::Crookstone, true) => crook_pedestals(fb, w),
        (StoreId::GameStonk, false) => game_consoles(fb, w),
        (StoreId::GameStonk, true) => game_moon(fb, w),
        (StoreId::KgbToys, false) => toys_bears(fb, w),
        (StoreId::KgbToys, true) => toys_robot(fb, w),
        (StoreId::BlockblusterVideo, false) => block_poster(fb, w),
        (StoreId::BlockblusterVideo, true) => block_lease(fb, w),
        (StoreId::SpendersGifts, false) => spend_lava(fb, w),
        (StoreId::SpendersGifts, true) => spend_plasma(fb, w),
        (StoreId::SamBaddy, false) => sam_vinyl(fb, w),
        (StoreId::SamBaddy, true) => sam_boombox(fb, w),
        (StoreId::SharperImagine, false) => sharp_vacuum(fb, w),
        (StoreId::SharperImagine, true) => sharp_orb(fb, w),
        (StoreId::HotSpyOnAStick, false) => hot_lemonade(fb, w),
        (StoreId::HotSpyOnAStick, true) => hot_corndogs(fb, w),
        (StoreId::CircuitPity, _) => circuit_dead(fb, w, right),
        (StoreId::FootLockpicker, false) => foot_sneakers(fb, w),
        (StoreId::FootLockpicker, true) => foot_balls(fb, w),
        (StoreId::BorderlineBooks, false) => books_stack(fb, w),
        (StoreId::BorderlineBooks, true) => books_empty(fb, w),
    });
}

// --------------------------------------------------------------------------------------------- Forever 12
const MANNEQUIN: [&str; 15] = [
    "...11...",
    "..1111..",
    "...11...",
    "..2222..",
    ".222222.",
    "..2222..",
    "..2222..",
    ".222222.",
    ".222222.",
    "22222222",
    "22222222",
    "...33...",
    "...33...",
    "..3333..",
    "..3333..",
];

fn f12_mannequins(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, LPINK, PINK);
    art(fb, w.x + 2, w.y + 6, &MANNEQUIN, &[WHITE, MAGENTA, CHARCOAL]);
    art(fb, w.x + 14, w.y + 6, &MANNEQUIN, &[WHITE, BLUE, CHARCOAL]);
    // Collar / belt details so they read as outfits.
    fb.hline(w.x + 4, w.y + 9, 4, WHITE);
    fb.hline(w.x + 16, w.y + 9, 4, LYELLOW);
    fb.hline(w.x + 14, w.y + 15, 8, LYELLOW);
    // Blinking sale sparkle.
    if (w.t / 20) % 2 == 0 {
        fb.put(w.x + 11, w.y + 4, WHITE);
        fb.put(w.x + 10, w.y + 5, WHITE);
        fb.put(w.x + 12, w.y + 5, WHITE);
        fb.put(w.x + 11, w.y + 6, WHITE);
    }
}

fn f12_rack(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, LPINK, PINK);
    fb.hline(w.x + 1, w.y + 5, 22, CHARCOAL);
    fb.vline(w.x + 1, w.y + 5, 15, CHARCOAL);
    fb.vline(w.x + 22, w.y + 5, 15, CHARCOAL);
    let cols = [RED, LYELLOW, BLUE, GREEN, MAGENTA];
    for i in 0..5 {
        let sway = ((w.t / 40 + i as u32) % 2) as i32;
        let x = w.x + 3 + i * 4 + sway;
        fb.vline(x + 1, w.y + 6, 1, CHARCOAL);
        fb.rect(x, w.y + 7, 3, 9 + (i % 2), cols[i as usize]);
        fb.hline(x - 1, w.y + 7, 5, cols[i as usize]);
        fb.vline(x + 1, w.y + 8, 3, WHITE);
    }
}

// --------------------------------------------------------------------------------------------- RadioShock
fn tv(fb: &mut Fb, x: i32, y: i32, tw: i32, th: i32, t: u32, seed: u32) {
    fb.rect(x, y, tw, th, CHARCOAL);
    fb.rect(x + 1, y + 1, tw - 2, th - 2, GRAY);
    let step = t / 3 + seed * 7;
    for yy in 0..th - 3 {
        for xx in 0..tw - 4 {
            let v = hash(xx as u32 + seed * 31, yy as u32, step) % 4;
            let c = [WHITE, LGRAY, GRAY, CHARCOAL][v as usize];
            fb.put(x + 2 + xx, y + 2 + yy, c);
        }
    }
    fb.put(x + tw - 2, y + th - 2, RED);
}

fn radio_tvs(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, NAVY, STEEL);
    tv(fb, w.x + 1, w.y + 13, 11, 8, w.t, 1);
    tv(fb, w.x + 12, w.y + 13, 11, 8, w.t, 2);
    tv(fb, w.x + 6, w.y + 4, 12, 9, w.t, 3);
}

const WALKIE: [&str; 15] = [
    "....1.",
    "....1.",
    "..1111",
    "..1331",
    "..1111",
    "..1221",
    "..1221",
    "..1221",
    "..1111",
    "..1441",
    "..1441",
    "..1111",
    "..1111",
    "..1111",
    "..1111",
];

fn radio_walkies(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, NAVY, STEEL);
    for i in 0..3 {
        let led = if (w.t / 24 + i as u32) % 3 == 0 { LRED } else { DRED };
        art(fb, w.x + 1 + i * 8, w.y + 6, &WALKIE, &[CHARCOAL, led, LGRAY, YELLOW]);
        fb.hline(w.x + 1 + i * 8, w.y + 6 + 14, 6, BLACK);
    }
    // yellow stripe
    fb.hline(w.x + 2, w.y + 3, 20, DBLUE);
}

// --------------------------------------------------------------------------------------------- Crookstone
const CHAIR: [&str; 13] = [
    "...11111111...",
    "..1222222221..",
    "..1233223321..",
    "..1222222221..",
    ".111222222111.",
    ".122123333221.",
    ".122122222221.",
    ".122123333221.",
    ".111222222111.",
    "..1222222221..",
    "..1111111111..",
    "...11....11...",
    "..111....111..",
];

fn crook_chair(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, TAN, BROWN);
    let jit = if (w.t / 5) % 2 == 0 { 0 } else { 1 };
    art(fb, w.x + 5 + jit, w.y + 6, &CHAIR, &[CHARCOAL, RED, LRED]);
    // vibration marks
    if (w.t / 8) % 2 == 0 {
        fb.put(w.x + 3, w.y + 12, BROWN);
        fb.put(w.x + 2, w.y + 13, BROWN);
        fb.put(w.x + 21, w.y + 12, BROWN);
        fb.put(w.x + 22, w.y + 13, BROWN);
    } else {
        fb.put(w.x + 3, w.y + 14, BROWN);
        fb.put(w.x + 2, w.y + 15, BROWN);
        fb.put(w.x + 21, w.y + 14, BROWN);
        fb.put(w.x + 22, w.y + 15, BROWN);
    }
}

fn crook_pedestals(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, TAN, BROWN);
    for (i, px) in [w.x + 3, w.x + 14].iter().enumerate() {
        fb.rect(*px, w.y + 14, 7, 6, WHITE);
        fb.rect(*px, w.y + 14, 7, 1, LGRAY);
        fb.rect(*px - 1, w.y + 19, 9, 1, LGRAY);
        fb.vline(*px + 6, w.y + 15, 4, LGRAY);
        let bob = if (w.t / 18 + i as u32 * 2) % 2 == 0 { 0 } else { 1 };
        if i == 0 {
            disc(fb, *px + 3, w.y + 9 + bob, 3, CYAN);
            fb.put(*px + 2, w.y + 8 + bob, WHITE);
        } else {
            // little drone gadget
            fb.rect(*px + 1, w.y + 9 + bob, 5, 2, CHARCOAL);
            fb.hline(*px, w.y + 8 + bob, 7, GRAY);
            fb.put(*px + 3, w.y + 10 + bob, LRED);
        }
    }
}

// --------------------------------------------------------------------------------------------- GameStonk
fn game_consoles(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DPURPLE, PURPLE);
    for (i, y) in [w.y + 4, w.y + 9, w.y + 14].iter().enumerate() {
        fb.rect(w.x + 2, *y, 20, 4, if i == 1 { GRAY } else { LGRAY });
        fb.hline(w.x + 2, *y + 3, 20, DGRAY);
        fb.rect(w.x + 4, *y + 1, 8, 1, BLACK);
        fb.put(w.x + 18, *y + 1, if (w.t / 20 + i as u32) % 3 == 0 { LGREEN } else { DGREEN });
        fb.put(w.x + 20, *y + 1, RED);
    }
    // cartridges on the floor line
    for i in 0..5 {
        let c = [LGREEN, LRED, YELLOW, CYAN, ORANGE][i];
        let y = w.y + 17;
        fb.rect(w.x + 2 + i as i32 * 4, y + (i as i32 % 2) * 0, 3, 3, GRAY);
        fb.rect(w.x + 2 + i as i32 * 4, y + 1, 3, 2, c);
    }
}

fn game_moon(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DPURPLE, PURPLE);
    // poster
    fb.rect(w.x, w.y + 1, 17, 19, DBLUE);
    fb.frame(w.x, w.y + 1, 17, 19, LGRAY);
    for (sx, sy) in [(3, 3), (13, 5), (6, 8), (14, 10), (2, 12)] {
        fb.put(w.x + sx, w.y + 2 + sy - 2, if (w.t / 15 + sx as u32) % 3 == 0 { WHITE } else { LBLUE });
    }
    art(fb, w.x + 6, w.y + 3, &[
        "...1...", "..121..", "..121..", "..121..", ".13231.", ".13231.", "..1.1..",
    ], &[WHITE, LRED, CYAN]);
    let flame = if (w.t / 6) % 2 == 0 { ORANGE } else { YELLOW };
    fb.rect(w.x + 8, w.y + 10, 1, 2, flame);
    // moon
    disc(fb, w.x + 13, w.y + 5, 2, LYELLOW);
    fb.text_tiny(w.x + 1, w.y + 13, "MOON", YELLOW);
    fb.hline(w.x + 1, w.y + 12, 15, LGRAY);
    // demo TV
    fb.rect(w.x + 17, w.y + 12, 7, 8, CHARCOAL);
    let c = [LCYAN, LGREEN, YELLOW, WHITE][((w.t / 8) % 4) as usize];
    fb.rect(w.x + 18, w.y + 13, 5, 4, c);
    fb.put(w.x + 19, w.y + 14, BLACK);
    fb.put(w.x + 21, w.y + 15, BLACK);
    fb.hline(w.x + 17, w.y + 20, 7, GRAY);
}

// --------------------------------------------------------------------------------------------- KGB Toys
const BEAR: [&str; 14] = [
    "..333333..",
    ".33334433.",
    "3333333333",
    "3322222233",
    "3252222523",
    ".22211222.",
    "..222222..",
    ".11111111.",
    "1111111111",
    "1121111211",
    "1111111111",
    ".11....11.",
    ".11....11.",
    ".11....11.",
];

fn toys_bears(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, SKY, YELLOW);
    for (i, bx) in [w.x + 1, w.x + 13].iter().enumerate() {
        let hop = if (w.t / 24 + i as u32) % 2 == 0 { 0 } else { -1 };
        art(fb, *bx, w.y + 6 + hop, &BEAR, &[BROWN, TAN, LGRAY, RED, BLACK]);
        fb.put(*bx + 1, w.y + 7 + hop, BROWN);
        fb.put(*bx + 8, w.y + 7 + hop, BROWN);
    }
}

fn toys_robot(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, SKY, YELLOW);
    // tin robot
    let blink = (w.t / 16) % 2 == 0;
    art(fb, w.x + 1, w.y + 6, &[
        "....1....",
        "....1....",
        "..11111..",
        ".1222221.",
        ".1323231.",
        ".1222221.",
        "..11111..",
        ".1122211.",
        "1.12221.1",
        "1.12221.1",
        "..12221..",
        "..11.11..",
        ".111.111.",
    ], &[CHARCOAL, LGRAY, if blink { ORANGE } else { LYELLOW }]);
    // toy rocket
    let fl = if (w.t / 5) % 2 == 0 { ORANGE } else { YELLOW };
    art(fb, w.x + 14, w.y + 3, &[
        "...1...", "..121..", "..121..", ".12221.", ".12321.", ".12221.", ".12221.", "1122211", "1.111.1", "...3...",
    ], &[RED, WHITE, BLUE]);
    fb.rect(w.x + 17, w.y + 13, 1, 2 + (w.t / 5 % 2) as i32, fl);
    fb.rect(w.x + 15, w.y + 17, 5, 2, GRAY);
}

// --------------------------------------------------------------------------------------------- Blockblubster
fn block_poster(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, GRAY, DGRAY);
    fb.rect(w.x + 4, w.y + 2, 16, 18, LBLUE);
    fb.dither_rect(w.x + 4, w.y + 2, 16, 18, LGRAY, 0);
    fb.frame(w.x + 4, w.y + 2, 16, 18, DGRAY);
    // faded hero silhouette and a VHS tape
    art(fb, w.x + 8, w.y + 4, &[
        "..111..", ".11111.", "..111..", ".11111.", "1111111", "1.111.1", "..1.1..", "..1.1..",
    ], &[GRAY]);
    fb.rect(w.x + 7, w.y + 14, 10, 4, DGRAY);
    fb.rect(w.x + 8, w.y + 15, 3, 2, LGRAY);
    fb.rect(w.x + 13, w.y + 15, 3, 2, LGRAY);
    // peeling corner
    fb.put(w.x + 19, w.y + 2, DGRAY);
    fb.put(w.x + 19, w.y + 3, GRAY);
    fb.put(w.x + 18, w.y + 2, GRAY);
}

fn block_lease(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, GRAY, DGRAY);
    fb.rect(w.x + 2, w.y + 4, 20, 14, WHITE);
    fb.frame(w.x + 2, w.y + 4, 20, 14, LGRAY);
    fb.text_tiny(w.x + 8, w.y + 6, "FOR", RED);
    fb.text_tiny(w.x + 3, w.y + 12, "LEASE", RED);
    fb.hline(w.x + 4, w.y + 10, 16, LGRAY);
    fb.put(w.x + 2, w.y + 4, GRAY);
    // dust
    fb.dither_rect(w.x, w.y + 18, 24, 2, GRAY, 1);
}

// --------------------------------------------------------------------------------------------- Spender's
fn lava_lamp(fb: &mut Fb, x: i32, y: i32, t: u32, ph: u32, wax: u8, glass: u8) {
    // base
    fb.rect(x + 1, y + 15, 5, 3, CHARCOAL);
    fb.rect(x, y + 17, 7, 1, CHARCOAL);
    // glass (tapered)
    for j in 0..14 {
        let half = if j < 2 { 1 + j / 1 } else if j > 10 { 3 } else { 3 };
        let w = (half * 2 + 1).min(7);
        fb.rect(x + 3 - w / 2, y + 1 + j, w, 1, glass);
    }
    fb.rect(x + 2, y, 3, 1, CHARCOAL);
    // wax blobs rise and fall
    let p1 = pingpong(t / 5 + ph, 8);
    let p2 = pingpong(t / 7 + ph * 3 + 4, 8);
    disc(fb, x + 3, y + 11 - p1, 1, wax);
    fb.rect(x + 2, y + 12, 3, 2, wax);
    fb.rect(x + 3, y + 3 + p2, 2, 2, wax);
    fb.put(x + 2, y + 5, WHITE);
}

fn spend_lava(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, BLACK, DPURPLE);
    fb.dither_rect(w.x, w.y, 24, 20, DPURPLE, 0);
    lava_lamp(fb, w.x + 2, w.y + 2, w.t, 0, YELLOW, LMAGENTA);
    lava_lamp(fb, w.x + 15, w.y + 2, w.t, 3, LRED, LCYAN);
    lava_lamp(fb, w.x + 8, w.y + 4, w.t, 5, ORANGE, LGREEN);
}

fn spend_plasma(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, BLACK, DPURPLE);
    let cx = w.x + 12;
    let cy = w.y + 9;
    disc(fb, cx, cy, 8, DPURPLE);
    fb.dither_rect(cx - 7, cy - 7, 15, 15, BLACK, 1);
    disc(fb, cx, cy, 8, DPURPLE);
    // glass rim
    for a in 0..16i32 {
        let (dx, dy) = [(8, 0), (7, 3), (6, 5), (3, 7), (0, 8), (-3, 7), (-6, 5), (-7, 3), (-8, 0), (-7, -3), (-6, -5), (-3, -7), (0, -8), (3, -7), (6, -5), (7, -3)][a as usize];
        fb.put(cx + dx, cy + dy, LAVENDER);
    }
    // lightning arcs
    let step = w.t / 4;
    for k in 0..4u32 {
        let hsh = hash(k, step, 9);
        let ang = (hsh % 16) as usize;
        let (dx, dy) = [(8, 0), (7, 3), (6, 5), (3, 7), (0, 8), (-3, 7), (-6, 5), (-7, 3), (-8, 0), (-7, -3), (-6, -5), (-3, -7), (0, -8), (3, -7), (6, -5), (7, -3)][ang];
        let mx = cx + dx / 2 + ((hsh >> 8) % 3) as i32 - 1;
        let my = cy + dy / 2 + ((hsh >> 12) % 3) as i32 - 1;
        let col = if k % 2 == 0 { LCYAN } else { LMAGENTA };
        line(fb, cx, cy, mx, my, col);
        line(fb, mx, my, cx + dx * 7 / 8, cy + dy * 7 / 8, col);
    }
    fb.put(cx, cy, WHITE);
    fb.rect(cx - 3, cy + 8, 7, 2, CHARCOAL);
    fb.rect(cx - 5, cy + 10, 11, 2, CHARCOAL);
}

// --------------------------------------------------------------------------------------------- Sam Baddy
fn vinyl(fb: &mut Fb, cx: i32, cy: i32, label: u8) {
    disc(fb, cx, cy, 5, BLACK);
    disc(fb, cx, cy, 2, label);
    fb.put(cx, cy, WHITE);
    fb.put(cx - 3, cy - 3, GRAY);
    fb.put(cx - 2, cy - 4, GRAY);
}

fn sam_vinyl(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DBROWN, BLACK);
    vinyl(fb, w.x + 6, w.y + 7, LRED);
    vinyl(fb, w.x + 17, w.y + 6, YELLOW);
    // cassette stack
    for (i, c) in [LCYAN, LRED, LYELLOW].iter().enumerate() {
        let y = w.y + 13 + i as i32 * 3 + if i == 2 { 0 } else { 0 };
        fb.rect(w.x + 3, y, 11, 3, CHARCOAL);
        fb.rect(w.x + 4, y, 9, 1, *c);
        fb.put(w.x + 6, y + 1, WHITE);
        fb.put(w.x + 11, y + 1, WHITE);
    }
    // crate with record spines
    fb.rect(w.x + 15, w.y + 12, 8, 8, BROWN);
    for i in 0..4 {
        fb.vline(w.x + 16 + i * 2, w.y + 9, 4, [LGREEN, LRED, LBLUE, YELLOW][i as usize]);
    }
    fb.hline(w.x + 15, w.y + 12, 8, TAN);
}

fn sam_boombox(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DBROWN, BLACK);
    fb.rect(w.x + 1, w.y + 8, 22, 12, CHARCOAL);
    fb.hline(w.x + 1, w.y + 8, 22, GRAY);
    fb.hline(w.x + 4, w.y + 6, 16, LGRAY);
    fb.vline(w.x + 4, w.y + 6, 3, LGRAY);
    fb.vline(w.x + 19, w.y + 6, 3, LGRAY);
    let pulse = (w.t / 8) % 2;
    for sx in [w.x + 6, w.x + 18] {
        let shift = (pulse as i32) * 0;
        disc(fb, sx + shift, w.y + 14, 4 + pulse as i32 - 0, GRAY);
        disc(fb, sx, w.y + 14, 3, BLACK);
        disc(fb, sx, w.y + 14, 1 + pulse as i32, LGRAY);
    }
    fb.rect(w.x + 10, w.y + 10, 5, 3, LCYAN);
    fb.put(w.x + 11, w.y + 11, BLACK);
    fb.put(w.x + 13, w.y + 11, BLACK);
    fb.hline(w.x + 10, w.y + 15, 5, RED);
    fb.hline(w.x + 10, w.y + 17, 5, LGRAY);
    // rising note
    let ny = w.y + 5 - ((w.t / 6) % 5) as i32;
    fb.vline(w.x + 22, ny, 3, YELLOW);
    fb.put(w.x + 21, ny + 3, YELLOW);
    fb.put(w.x + 21, ny + 2, YELLOW);
}

// --------------------------------------------------------------------------------------------- Sharper Imagine
fn sharp_vacuum(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, CHARCOAL, GRAY);
    let off = pingpong(w.t / 3, 9);
    let x = w.x + 3 + off;
    let y = w.y + 14;
    fb.rect(x + 1, y, 10, 5, LGRAY);
    fb.rect(x, y + 1, 12, 3, LGRAY);
    fb.hline(x + 1, y, 10, WHITE);
    fb.hline(x + 1, y + 4, 10, GRAY);
    disc(fb, x + 6, y + 2, 1, if (w.t / 10) % 2 == 0 { CYAN } else { LCYAN });
    fb.put(x + 1, y + 5, BLACK);
    fb.put(x + 10, y + 5, BLACK);
    // dust bits it chases
    for i in 0..3 {
        fb.put(w.x + 4 + i * 8, w.y + 20 - 1, BROWN);
    }
    // wall shelf with a tiny gadget
    fb.hline(w.x + 2, w.y + 6, 20, GRAY);
    fb.rect(w.x + 4, w.y + 3, 4, 3, CYAN);
    fb.rect(w.x + 14, w.y + 2, 6, 4, LGRAY);
}

fn sharp_orb(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, CHARCOAL, GRAY);
    let cx = w.x + 12;
    let cy = w.y + 9;
    let phase = (w.t / 12) % 4;
    let r = [4, 5, 6, 5][phase as usize];
    let halo = [DCYAN, DCYAN, TEAL, DCYAN][phase as usize];
    disc(fb, cx, cy, r + 2, halo);
    fb.dither_rect(cx - r - 2, cy - r - 2, 2 * r + 5, 2 * r + 5, CHARCOAL, 0);
    disc(fb, cx, cy, r, CYAN);
    disc(fb, cx, cy, r - 2, LCYAN);
    disc(fb, cx, cy, 1, WHITE);
    fb.rect(cx - 3, w.y + 15, 7, 6, LGRAY);
    fb.hline(cx - 3, w.y + 15, 7, WHITE);
    fb.hline(cx - 4, w.y + 20, 9, GRAY);
}

// --------------------------------------------------------------------------------------------- Hot Spy on a Stick
fn hot_lemonade(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, LYELLOW, ORANGE);
    // tub
    fb.rect(w.x + 2, w.y + 9, 14, 11, STEEL);
    fb.rect(w.x + 3, w.y + 10, 12, 9, YELLOW);
    fb.hline(w.x + 3, w.y + 10, 12, LYELLOW);
    fb.hline(w.x + 2, w.y + 13, 14, GRAY);
    fb.hline(w.x + 2, w.y + 17, 14, GRAY);
    fb.dither_rect(w.x + 4, w.y + 11, 3, 2, WHITE, 0);
    // pump handle bobbing
    let b = pingpong(w.t / 6, 3);
    fb.vline(w.x + 9, w.y + 2 + b, 7 - b, GRAY);
    fb.rect(w.x + 7, w.y + 1 + b, 5, 2, RED);
    // lemon slices
    disc(fb, w.x + 20, w.y + 17, 2, YELLOW);
    fb.put(w.x + 20, w.y + 17, WHITE);
    disc(fb, w.x + 20, w.y + 12, 2, YELLOW);
    fb.put(w.x + 20, w.y + 12, GREEN);
    // splash
    if b == 3 {
        fb.put(w.x + 16, w.y + 9, YELLOW);
    }
}

fn hot_corndogs(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, LYELLOW, ORANGE);
    fb.rect(w.x + 1, w.y + 14, 22, 6, RED);
    fb.hline(w.x + 1, w.y + 14, 22, LRED);
    for i in 0..5 {
        let x = w.x + 3 + i * 4;
        fb.vline(x + 1, w.y + 10, 5, BROWN);
        fb.rect(x, w.y + 2, 3, 10, ORANGE);
        fb.vline(x + 1, w.y + 2, 10, YELLOW);
        fb.put(x, w.y + 2, BROWN);
        fb.put(x + 2, w.y + 2, BROWN);
        let zz = (w.t / 30 + i as u32) % 2;
        for j in 0..4 {
            fb.put(x + ((j + zz as i32) % 2) * 2, w.y + 4 + j * 2, RED);
        }
    }
    // steam
    let s = ((w.t / 12) % 3) as i32;
    fb.put(w.x + 5, w.y + 1 - s % 2, WHITE);
    fb.put(w.x + 13, w.y + 1 - (s + 1) % 2, WHITE);
}

// --------------------------------------------------------------------------------------------- Circuit Pity
fn circuit_dead(fb: &mut Fb, w: &Win, right: bool) {
    backdrop(fb, w, DGRAY, BLACK);
    let mk = |fb: &mut Fb, x: i32, y: i32, tw: i32, th: i32| {
        fb.rect(x, y, tw, th, BLACK);
        fb.frame(x, y, tw, th, GRAY);
        fb.rect(x + 2, y + 2, tw - 4, th - 4, CHARCOAL);
        line(fb, x + 3, y + 2, x + tw - 4, y + th - 3, DGRAY);
        fb.put(x + 2, y + 2, GRAY);
    };
    if right {
        mk(fb, w.x + 12, w.y + 12, 11, 8);
        mk(fb, w.x + 1, w.y + 12, 10, 8);
        mk(fb, w.x + 6, w.y + 4, 11, 8);
    } else {
        mk(fb, w.x + 1, w.y + 12, 11, 8);
        mk(fb, w.x + 12, w.y + 12, 10, 8);
        mk(fb, w.x + 14, w.y + 4, 9, 8);
    }
    // cobwebs
    fb.put(w.x, w.y, GRAY);
    fb.put(w.x + 1, w.y, GRAY);
    fb.put(w.x, w.y + 1, GRAY);
}

// --------------------------------------------------------------------------------------------- Foot Lockpicker
fn shoe(fb: &mut Fb, x: i32, y: i32, c: u8, accent: u8) {
    fb.rect(x + 2, y, 3, 2, c);
    fb.rect(x, y + 2, 7, 2, c);
    fb.hline(x, y + 4, 7, WHITE);
    fb.put(x + 5, y + 2, accent);
    fb.put(x + 2, y + 1, WHITE);
}

fn foot_sneakers(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DGRAY, CHARCOAL);
    let cols = [RED, BLUE, LGREEN, ORANGE, PURPLE, LCYAN];
    for row in 0..3 {
        let y = w.y + 2 + row * 6;
        fb.hline(w.x, y + 5, 24, GRAY);
        for k in 0..3 {
            let c = cols[((row * 3 + k) % 6) as usize];
            shoe(fb, w.x + 1 + k * 8, y, c, YELLOW);
        }
    }
    // spotlight glint
    let g = ((w.t / 14) % 9) as i32;
    if g < 3 {
        fb.put(w.x + 2 + g * 8, w.y + 2, WHITE);
        fb.put(w.x + 3 + g * 8, w.y + 3, WHITE);
    }
}

fn ball(fb: &mut Fb, cx: i32, cy: i32, t: u32) {
    disc(fb, cx, cy, 4, ORANGE);
    if (t / 20) % 2 == 0 {
        fb.vline(cx, cy - 4, 9, BROWN);
        fb.hline(cx - 4, cy, 9, BROWN);
    } else {
        line(fb, cx - 3, cy - 3, cx + 3, cy + 3, BROWN);
        line(fb, cx + 3, cy - 3, cx - 3, cy + 3, BROWN);
    }
    fb.put(cx - 2, cy - 2, LYELLOW);
}

fn foot_balls(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DGRAY, CHARCOAL);
    // jersey on a hanger
    let jx = w.x + 14;
    let jy = w.y + 3;
    fb.rect(jx, jy, 9, 11, RED);
    fb.rect(jx + 3, jy, 3, 2, DGRAY);
    fb.hline(jx, jy, 9, LRED);
    fb.text_tiny(jx + 3, jy + 4, "7", WHITE);
    fb.vline(jx + 4, jy - 2, 2, GRAY);
    ball(fb, w.x + 5, w.y + 16, w.t);
    ball(fb, w.x + 12, w.y + 17, w.t + 20);
    ball(fb, w.x + 8, w.y + 9, w.t);
}

// --------------------------------------------------------------------------------------------- Borderline Books
fn books_stack(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DOLIVE, BROWN);
    let cols = [GRAY, DBROWN, LGRAY, DGRAY, OLIVE];
    let mut y = w.y + 19;
    for i in 0..6 {
        y -= 3;
        let bw = 14 + (i * 5) % 7;
        let bx = w.x + 4 + (i * 3) % 5;
        fb.rect(bx, y, bw, 3, cols[(i as usize) % 5]);
        fb.hline(bx, y, bw, darker(cols[(i as usize) % 5]));
        fb.put(bx + 2, y + 1, YELLOW);
    }
}

fn books_empty(fb: &mut Fb, w: &Win) {
    backdrop(fb, w, DOLIVE, BROWN);
    for y in [w.y + 6, w.y + 12, w.y + 18] {
        fb.hline(w.x + 1, y, 22, BROWN);
    }
    fb.rect(w.x + 2, w.y + 7, 3, 5, GRAY);
    fb.rect(w.x + 6, w.y + 8, 2, 4, DGRAY);
    fb.rect(w.x + 18, w.y + 13, 3, 5, GRAY);
    // cobweb
    line(fb, w.x + 23, w.y, w.x + 17, w.y + 5, LGRAY);
    line(fb, w.x + 23, w.y, w.x + 23, w.y + 6, LGRAY);
    line(fb, w.x + 20, w.y + 2, w.x + 23, w.y + 4, LGRAY);
    let _ = FontKind::Tiny;
}
