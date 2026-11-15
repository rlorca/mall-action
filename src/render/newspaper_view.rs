use super::screen_fx::{gray_recolor, hash01, sprite_or_null, H, W};
use crate::content::copy::{wrap_words, UI};
use crate::engine::font::{draw_text, text_width, Align, TextOpts, FONT_TINY};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::screens::screentext::SCREEN_TEXT;

/// Front page of THE DAILY MALL: masthead, a big random headline, a little halftone "photo" of the getaway
/// wagon and the chasing spy, and columns of greeked text. The page slides in from below over its first
/// NEWS_SLIDE_FRAMES frames. The headline is wrapped with wrap_words (copy.rs) at NEWS_HEADLINE_CHARS so that the
/// scale-2 headline always fits the page; every headline line is therefore also within the 26-char copy limit.
pub const NEWS_SLIDE_FRAMES: i32 = 22;
pub const NEWS_HEADLINE_CHARS: usize = 18;
const PAGE_X: i32 = 8;
const PAGE_Y: i32 = 6;
const PAGE_W: i32 = 240;
const PAGE_H: i32 = 228;
const INK: u8 = c::BLACK;
const PAPER: u8 = c::PEACH;

pub fn headline_lines(headline: &str) -> Vec<String> {
    wrap_words(headline, NEWS_HEADLINE_CHARS)
}

/// Rows of greyed-out "text" so the page looks like a page.
fn greek(fb: &mut Framebuffer, x: i32, y: i32, w: i32, rows: i32, seed: i32) {
    for r in 0..rows {
        let last = r == rows - 1;
        let len = if last { (w as f64 * (0.3 + hash01(seed, r) * 0.5)).floor() as i32 } else { w - (hash01(seed, r + 50) * 6.0).floor() as i32 };
        fb.h_line(x, y + r * 4, len, c::GRAY);
    }
}

/// The halftone newsprint photo: wagon pulling away, the spy running after it with a receipt.
fn draw_photo(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, frame: i32) {
    fb.fill_rect(x, y, w, h, c::LTGRAY);
    fb.dither(x, y, w, 40, c::WHITE, 0);
    // garage ceiling + pillars + floor
    fb.fill_rect(x, y, w, 8, c::GRAY);
    fb.dither(x, y + 8, w, 3, c::GRAY, 0);
    for px in [x + 12, x + 62, x + 98] {
        fb.fill_rect(px, y + 8, 8, h - 22, c::MDGRAY);
        fb.v_line(px, y + 8, h - 22, c::GRAY);
    }
    fb.fill_rect(x, y + h - 16, w, 16, c::GRAY);
    fb.dither(x, y + h - 16, w, 16, c::MDGRAY, 0);
    for i in 0..6 {
        fb.fill_rect(x + 6 + i * 20, y + h - 9, 10, 1, c::LTGRAY);
    }

    let wag = sprite_or_null("wagon");
    let spy = sprite_or_null("spy.walk");
    let wx = x + w - 72 - 2 - ((frame >> 3) % 3);
    match wag {
        Some(s) => {
            let lut = gray_recolor(s);
            fb.sprite(s, wx, y + h - 14 - s.h + 6, &BlitOpts::default().recolor(&lut));
        }
        None => fb.stroke_rect(wx, y + h - 36, 72, 28, c::BLACK),
    }
    let sx = x + 8;
    let sy = y + h - 14 - 24 + 6;
    match spy {
        Some(s) => {
            let lut = gray_recolor(s);
            fb.sprite(s, sx, sy, &BlitOpts::default().frame((frame >> 3) & 3).recolor(&lut));
        }
        None => fb.stroke_rect(sx, sy, 16, 24, c::BLACK),
    }
    // the receipt
    fb.fill_rect(sx + 14, sy - 6, 5, 9, c::WHITE);
    fb.stroke_rect(sx + 14, sy - 6, 5, 9, c::BLACK);
    fb.h_line(sx + 15, sy - 4, 3, c::GRAY);
    fb.h_line(sx + 15, sy - 2, 3, c::GRAY);
    // grain
    for i in 0..40 {
        let gx = x + (hash01(i, 9) * w as f64).floor() as i32;
        let gy = y + (hash01(i, 10) * h as f64).floor() as i32;
        fb.set_pixel(gx, gy, if hash01(i, 12) > 0.5 { c::WHITE } else { c::GRAY });
    }
}

/// `frame` = frames since the newspaper phase began (drives the slide-in).
pub fn draw_newspaper(fb: &mut Framebuffer, headline: &str, frame: i32) {
    // desk behind the page
    fb.fill_rect(0, 0, W, H, c::DKBLUE);
    fb.dither(0, 0, W, H, c::BLACK, 0);

    let t = (frame as f64 / NEWS_SLIDE_FRAMES as f64).min(1.0);
    let slide = round_i((1.0 - (1.0 - t) * (1.0 - t)) * 1000.0) as f64 / 1000.0; // ease-out
    let oy = round_i((1.0 - slide) * (H - PAGE_Y) as f64);
    let px = PAGE_X;
    let py = PAGE_Y + oy;
    fb.fill_rect(px + 3, py + 3, PAGE_W, PAGE_H, c::BLACK);
    fb.fill_rect(px, py, PAGE_W, PAGE_H, PAPER);
    fb.stroke_rect(px, py, PAGE_W, PAGE_H, INK);

    let tiny = TextOpts::default().font(&FONT_TINY);
    let big = TextOpts::default().scale(2);

    // top furniture
    draw_text(fb, SCREEN_TEXT.news.edition, px + 8, py + 6, INK, &tiny);
    draw_text(fb, SCREEN_TEXT.news.price, px + PAGE_W - 8, py + 6, INK, &tiny.align(Align::Right));

    // masthead
    let mw = text_width(UI.newspaper_name, &big);
    let mx = px + (PAGE_W - mw).div_euclid(2);
    draw_text(fb, UI.newspaper_name, mx + 1, py + 15, INK, &big);
    draw_text(fb, UI.newspaper_name, mx, py + 15, INK, &big);
    for sx in [px + 8, px + PAGE_W - 8 - 24] {
        for i in 0..4 {
            fb.fill_rect(sx + i * 6, py + 18 + (i % 2) * 2, 4, 4, INK);
        }
    }
    fb.fill_rect(px + 6, py + 35, PAGE_W - 12, 3, INK);
    fb.h_line(px + 6, py + 40, PAGE_W - 12, INK);
    draw_text(fb, SCREEN_TEXT.news.tagline, px + PAGE_W / 2, py + 44, INK, &tiny.align(Align::Center));
    fb.h_line(px + 6, py + 52, PAGE_W - 12, INK);

    // headline
    let lines = headline_lines(headline);
    let mut hy = py + 58;
    for l in &lines {
        let lw = text_width(l, &big);
        let lx = px + (PAGE_W - lw).div_euclid(2);
        draw_text(fb, l, lx, hy, INK, &big);
        draw_text(fb, l, lx + 1, hy, INK, &big);
        hy += 16;
    }
    let body_top = hy + 5;
    fb.h_line(px + 6, body_top - 2, PAGE_W - 12, INK);

    // photo + caption bars (left), text column (right)
    let photo_w = 112;
    let photo_h = 70;
    let phx = px + 8;
    let phy = body_top + 4;
    fb.stroke_rect(phx - 1, phy - 1, photo_w + 2, photo_h + 2, INK);
    fb.push_clip(phx, phy, photo_w, photo_h);
    draw_photo(fb, phx, phy, photo_w, photo_h, frame);
    fb.pop_clip();
    greek(fb, phx, phy + photo_h + 5, photo_w, 2, 3);

    let col_x = phx + photo_w + 8;
    let col_w = px + PAGE_W - 8 - col_x;
    greek(fb, col_x, phy, col_w, (photo_h + 10).div_euclid(4), headline.encode_utf16().count() as i32);

    // lower columns
    let low_y = phy + photo_h + 18;
    fb.h_line(px + 6, low_y - 3, PAGE_W - 12, INK);
    let rows = (py + PAGE_H - 8 - low_y).div_euclid(4).max(0);
    let cw = (PAGE_W - 16 - 8).div_euclid(3);
    for col in 0..3 {
        let cx = px + 8 + col * (cw + 4);
        greek(fb, cx, low_y, cw, rows, 20 + col);
        if col < 2 {
            fb.v_line(cx + cw + 1, low_y, rows * 4, c::GRAY);
        }
    }
}
