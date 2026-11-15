use super::screen_fx::{blit_scaled_by_name, hash01, with_commas, ScaledOpts, H, W};
use crate::content::copy::{SpygramPost, UI};
use crate::engine::font::{draw_text, text_width, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::screens::screentext::SCREEN_TEXT;

/// SPYGRAM card: magenta header with the app name, the agent's photo in a frame, a like counter that
/// climbs quickly, the caption and one comment. Draws ONLY the card (with a drop shadow), at any position,
/// so the roof-arrival selfie and the level-clear post both use it.
///
///   draw_spygram(fb, &post, spygram_likes(frame, seed), frame, &SpygramOpts::default())
pub const SPYGRAM_CARD_W: i32 = 184;
pub const SPYGRAM_CARD_H: i32 = 190;
const PHOTO_DX: i32 = 8;
const PHOTO_DY: i32 = 36;
const PHOTO_W: i32 = 168;
const PHOTO_H: i32 = 96;

/// Draws the contents of the photo box; the box is clipped to (x, y, w, h). Args: fb, x, y, w, h, frame.
pub type PhotoFn = fn(&mut Framebuffer, i32, i32, i32, i32, i32);

#[derive(Clone, Copy, Default)]
pub struct SpygramOpts {
    /// Top-left of the card; defaults to centred on the 256x240 screen.
    pub x: Option<i32>,
    pub y: Option<i32>,
    /// Custom photo; the default is the agent taking a selfie against the night sky.
    pub photo: Option<PhotoFn>,
}

/// Final like count of a post for this seed.
fn like_target(seed: i32) -> i32 {
    300 + (hash01(seed, 11) * 700.0).floor() as i32
}

const LIKE_RAMP_FRAMES: i32 = 150;

/// Likes after `frame` frames of the post being on screen. Pure, never decreases, starts at 0 and climbs
/// quickly (fast start, easing to the target within ~2.5 s, then still ticking up slowly). Updates every 3 frames.
pub fn spygram_likes(frame: i32, seed: i32) -> i32 {
    let f = (frame.div_euclid(3) * 3).max(0);
    let p = (f as f64 / LIKE_RAMP_FRAMES as f64).min(1.0);
    let eased = 1.0 - (1.0 - p) * (1.0 - p);
    (like_target(seed) as f64 * eased).floor() as i32 + (f - LIKE_RAMP_FRAMES).max(0).div_euclid(30)
}

/// Default photo: night sky, a rooftop ledge and the agent holding up a phone, scaled 3x.
pub fn default_spygram_photo(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, frame: i32) {
    let bands = [c::BLACK, c::DKBLUE, c::DKBLUE, c::VIOLET, c::PURPLE0];
    let bh = ((h - 20) as f64 / bands.len() as f64).ceil() as i32;
    for (i, &col) in bands.iter().enumerate() {
        fb.fill_rect(x, y + i as i32 * bh, w, bh, col);
    }
    for i in 0..14 {
        let sx = x + (hash01(i, 3) * w as f64).floor() as i32;
        let sy = y + (hash01(i, 4) * (h - 40) as f64).floor() as i32;
        fb.set_pixel(sx, sy, if (frame + i * 7) % 40 < 30 { c::WHITE } else { c::LTGRAY });
    }
    fb.fill_rect(x, y + h - 20, w, 20, c::MDGRAY);
    fb.h_line(x, y + h - 20, w, c::WHITE);
    // agent selfie at 3x, standing on the ledge; frame 1 of the sprite is the flash
    let so = ScaledOpts { frame: if frame % 90 < 4 { 1 } else { 0 }, ..Default::default() };
    if !blit_scaled_by_name(fb, "agent.selfie", x + w.div_euclid(2) - 24, y + h - 20 - 72, 3, &so) {
        fb.stroke_rect(x + w.div_euclid(2) - 24, y + h - 92, 48, 72, c::HOTPINK);
    }
}

fn draw_camera(fb: &mut Framebuffer, x: i32, y: i32) {
    fb.fill_rect(x, y + 2, 12, 8, c::WHITE);
    fb.fill_rect(x + 3, y, 5, 2, c::WHITE);
    fb.fill_rect(x + 4, y + 3, 4, 4, c::MAGENTA);
    fb.fill_rect(x + 5, y + 4, 2, 2, c::WHITE);
}

fn draw_heart(fb: &mut Framebuffer, x: i32, y: i32, color: u8) {
    // 7x6 heart
    let rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
    for (j, r) in rows.iter().enumerate() {
        for (i, ch) in r.chars().enumerate() {
            if ch == 'X' {
                fb.set_pixel(x + i as i32, y + j as i32, color);
            }
        }
    }
}

/// Draws the card. `likes` comes from spygram_likes(); `frame` = frames since the card appeared.
pub fn draw_spygram(fb: &mut Framebuffer, post: &SpygramPost, likes: i32, frame: i32, opts: &SpygramOpts) {
    let x = opts.x.unwrap_or_else(|| round_i((W - SPYGRAM_CARD_W) as f64 / 2.0));
    let y = opts.y.unwrap_or_else(|| round_i((H - SPYGRAM_CARD_H) as f64 / 2.0));
    let w = SPYGRAM_CARD_W;
    let h = SPYGRAM_CARD_H;
    let o = TextOpts::default();

    // drop shadow + card body
    fb.fill_rect(x + 3, y + 3, w, h, c::BLACK);
    fb.fill_rect(x, y, w, h, c::WHITE);
    fb.stroke_rect(x, y, w, h, c::BLACK);

    // header
    fb.fill_rect(x + 1, y + 1, w - 2, 19, c::MAGENTA);
    fb.h_line(x + 1, y + 20, w - 2, c::PURPLE0);
    draw_camera(fb, x + 8, y + 5);
    draw_text(fb, UI.spygram, x + 26, y + 3, c::WHITE, &TextOpts::default().scale(2).shadow(c::PURPLE0));

    // user row
    fb.fill_circle(x + 14, y + 29, 5.0, c::MAGENTA);
    fb.fill_circle(x + 14, y + 29, 3.0, c::PALEPINK);
    draw_text(fb, SCREEN_TEXT.spygram.user, x + 24, y + 26, c::BLACK, &o);

    // photo, framed
    let px = x + PHOTO_DX;
    let py = y + PHOTO_DY;
    fb.stroke_rect(px - 2, py - 2, PHOTO_W + 4, PHOTO_H + 4, c::BLACK);
    fb.push_clip(px, py, PHOTO_W, PHOTO_H);
    (opts.photo.unwrap_or(default_spygram_photo))(fb, px, py, PHOTO_W, PHOTO_H, frame);
    fb.pop_clip();

    // like counter
    let ly = py + PHOTO_H + 7;
    draw_heart(fb, x + 9, ly, if frame % 30 < 6 { c::PINK } else { c::RED });
    draw_text(fb, &format!("{} {}", with_commas(likes), SCREEN_TEXT.spygram.likes), x + 20, ly, c::BLACK, &o);

    // caption
    let mut cy = ly + 12;
    for line in post.caption {
        draw_text(fb, line, x + 9, cy, c::BLACK, &o);
        cy += 9;
    }

    // comment: "WHO: TEXT" with the name in magenta
    cy += 3;
    match post.comment.find(':') {
        Some(colon) => {
            let who = &post.comment[..colon + 1];
            draw_text(fb, who, x + 9, cy, c::MAGENTA, &o);
            draw_text(fb, &post.comment[colon + 1..], x + 9 + text_width(who, &o) + 6, cy, c::MDGRAY, &o);
        }
        None => {
            draw_text(fb, post.comment, x + 9, cy, c::MDGRAY, &o);
        }
    }
}
