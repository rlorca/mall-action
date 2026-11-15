use crate::engine::font::{draw_text, text_width, Align, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::types::{Banner, Bubble, Popup};

/// Shared UI widgets. Everything clamps to the 256x240 screen so bubbles and
/// banners can never run off the edge.
pub const SCREEN_W: i32 = 256;
pub const SCREEN_H: i32 = 240;

pub fn draw_box(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, fill: u8, border: Option<u8>) {
    fb.fill_rect(x, y, w, h, fill);
    if let Some(b) = border {
        fb.stroke_rect(x, y, w, h, b);
    }
}

/// Horizontal progress/timer bar; frac 0..1 (background black).
pub fn draw_bar(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, frac: f64, fg: u8) {
    draw_bar_bg(fb, x, y, w, h, frac, fg, c::BLACK);
}

/// `draw_bar` with an explicit background colour.
#[allow(clippy::too_many_arguments)]
pub fn draw_bar_bg(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, frac: f64, fg: u8, bg: u8) {
    fb.fill_rect(x, y, w, h, bg);
    let n = round_i(w as f64 * frac).min(w).max(0);
    if n > 0 {
        fb.fill_rect(x, y, n, h, fg);
    }
}

/// Speech bubble above an anchor point (the speaker's head, in SCREEN pixels), `min_y` = 18.
pub fn draw_bubble(fb: &mut Framebuffer, text: &str, anchor_x: f64, anchor_y: f64) {
    draw_bubble_at(fb, text, anchor_x, anchor_y, 18);
}

/// Speech bubble above an anchor point (the speaker's head, in SCREEN pixels).
/// White box, black text, little tail; clamped on screen. Flips below the anchor when it would go above `min_y`.
pub fn draw_bubble_at(fb: &mut Framebuffer, text: &str, anchor_x: f64, anchor_y: f64, min_y: i32) {
    let tw = text_width(text, &TextOpts::default());
    let w = tw + 8;
    let h = 13;
    let mut x = round_i(anchor_x - w as f64 / 2.0);
    x = x.min(SCREEN_W - 2 - w).max(2);
    let mut y = round_i(anchor_y - h as f64 - 4.0);
    let flip_below = y < min_y;
    if flip_below {
        y = round_i(anchor_y + 6.0);
    }
    fb.fill_rect(x + 1, y, w - 2, h, c::WHITE);
    fb.fill_rect(x, y + 1, w, h - 2, c::WHITE);
    fb.stroke_rect(x, y, w, h, c::BLACK);
    fb.set_pixel(x, y, c::BLACK);
    // tail
    let tx = round_i(anchor_x).min(x + w - 4).max(x + 3);
    if flip_below {
        fb.set_pixel(tx, y - 1, c::BLACK);
        fb.set_pixel(tx, y, c::WHITE);
    } else {
        fb.set_pixel(tx, y + h, c::BLACK);
        fb.set_pixel(tx - 1, y + h - 1, c::BLACK);
        fb.set_pixel(tx + 1, y + h - 1, c::BLACK);
        fb.set_pixel(tx, y + h - 1, c::WHITE);
    }
    draw_text(fb, text, x + 4, y + 3, c::BLACK, &TextOpts::default());
}

pub fn draw_bubbles(fb: &mut Framebuffer, bubbles: &[Bubble], cam_x: f64, cam_y: f64) {
    for b in bubbles {
        if b.t > 0 {
            draw_bubble(fb, &b.text, b.x - cam_x, b.y - cam_y);
        }
    }
}

/// Message banner at y = 24.
pub fn draw_banner(fb: &mut Framebuffer, b: &Banner) {
    draw_banner_at(fb, b, 24);
}

/// Message banner: a dark plate with centred text (+ optional extra lines),
/// fading in/out over its first/last frames. `y` is the plate's top.
pub fn draw_banner_at(fb: &mut Framebuffer, b: &Banner, y: i32) {
    if b.t <= 0 {
        return;
    }
    let mut lines: Vec<&str> = vec![b.text.as_str()];
    if let Some(extra) = &b.lines {
        lines.extend(extra.iter().map(|s| s.as_str()));
    }
    let opts = TextOpts::default();
    let widest = lines.iter().map(|l| text_width(l, &opts)).max().unwrap_or(0);
    let w = (SCREEN_W - 4).min(widest + 12);
    let h = lines.len() as i32 * 9 + 5;
    let x = round_i((SCREEN_W - w) as f64 / 2.0);
    let age = b.total - b.t;
    let a = if age < 6 { 2 - age.div_euclid(3) } else { 0 };
    let bb = if b.t < 12 { 2 - b.t.div_euclid(6) } else { 0 };
    let fade = a.min(bb);
    fb.fill_rect(x, y, w, h, c::BLACK);
    fb.stroke_rect(x, y, w, h, if fade != 0 { c::MDGRAY } else { c::WHITE });
    let col = if fade >= 2 { c::MDGRAY } else { b.color.unwrap_or(c::WHITE) };
    for (i, l) in lines.iter().enumerate() {
        draw_text(fb, l, SCREEN_W / 2, y + 3 + i as i32 * 9, col, &TextOpts::default().align(Align::Center));
    }
}

/// Floating score / text popups; world positions minus camera.
pub fn draw_popups(fb: &mut Framebuffer, popups: &[Popup], cam_x: f64, cam_y: f64) {
    for p in popups {
        let x = round_i(p.x - cam_x);
        let y = round_i(p.y - cam_y);
        draw_text(fb, &p.text, x, y, p.color.unwrap_or(c::YELLOW), &TextOpts::default().align(Align::Center).shadow(c::BLACK));
    }
}
