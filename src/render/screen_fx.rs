use crate::art::registry::{get_sprite, has_sprite};
use crate::engine::font::{draw_text, text_width, Align, Font, TextOpts, FONT_MAIN};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::imul;
use crate::engine::palette::{c, TRANSPARENT};
use crate::engine::sprite::{Recolor, Sprite};

/// Shared drawing helpers for the screen views (title, level clear, game over, map, HUD...). Pure drawing, no state.
pub const W: i32 = 256;
pub const H: i32 = 240;

/// The sprite, or None while an art module has not defined it yet (views then draw a placeholder).
pub fn sprite_or_null(name: &str) -> Option<&'static Sprite> {
    if has_sprite(name) {
        Some(get_sprite(name))
    } else {
        None
    }
}

/// Draw a sprite by name at its top-left (x, y) with a 16x24 fallback box. See `draw_sprite_by_name_sized`.
pub fn draw_sprite_by_name(fb: &mut Framebuffer, name: &str, x: i32, y: i32, opts: &BlitOpts) -> bool {
    draw_sprite_by_name_sized(fb, name, x, y, opts, 16, 24)
}

/// Draw a sprite by name at its top-left (x, y). If it is not registered a hot-pink outlined box of
/// `fallback_w` x `fallback_h` is drawn instead so a missing sprite is obvious but never crashes a screen.
/// Returns true when the real sprite was drawn.
pub fn draw_sprite_by_name_sized(fb: &mut Framebuffer, name: &str, x: i32, y: i32, opts: &BlitOpts, fallback_w: i32, fallback_h: i32) -> bool {
    match sprite_or_null(name) {
        None => {
            fb.stroke_rect(x, y, fallback_w, fallback_h, c::HOTPINK);
            false
        }
        Some(s) => {
            fb.sprite(s, x, y, opts);
            true
        }
    }
}

#[derive(Clone, Copy, Default)]
pub struct ScaledOpts {
    pub frame: i32,
    pub flip_x: bool,
    /// Draw every opaque pixel in this single colour.
    pub solid: Option<u8>,
}

/// Nearest-neighbour integer-scaled sprite blit (cutscene cards, photos). (x, y) is the top-left.
pub fn blit_scaled(fb: &mut Framebuffer, s: &Sprite, x: i32, y: i32, k: i32, opts: &ScaledOpts) {
    let f = opts.frame.rem_euclid(s.frame_count()) as usize;
    let data = &s.frames[f];
    for sy in 0..s.h {
        for sx in 0..s.w {
            let v = data[(sy * s.w + if opts.flip_x { s.w - 1 - sx } else { sx }) as usize];
            if v == TRANSPARENT {
                continue;
            }
            fb.fill_rect(x + sx * k, y + sy * k, k, k, opts.solid.unwrap_or(v));
        }
    }
}

/// Scaled sprite by name (skips silently when missing). Returns true when drawn.
pub fn blit_scaled_by_name(fb: &mut Framebuffer, name: &str, x: i32, y: i32, k: i32, opts: &ScaledOpts) -> bool {
    match sprite_or_null(name) {
        None => false,
        Some(s) => {
            blit_scaled(fb, s, x, y, k, opts);
            true
        }
    }
}

#[derive(Clone, Copy)]
pub struct TwoToneOpts {
    pub scale: i32,
    /// Colour of the upper `split` glyph rows and of the rest.
    pub top: u8,
    pub bottom: u8,
    /// Glyph rows (of 7) that use `top`.
    pub split: i32,
    pub outline: Option<u8>,
    pub shadow: Option<u8>,
    pub align: Align,
    pub font: &'static Font,
}

impl Default for TwoToneOpts {
    fn default() -> Self {
        TwoToneOpts { scale: 1, top: c::WHITE, bottom: c::WHITE, split: 4, outline: None, shadow: None, align: Align::Left, font: &FONT_MAIN }
    }
}

/// Big logo text with two colours stacked inside each letter (upper rows / lower rows). Returns the left x used.
pub fn draw_two_tone(fb: &mut Framebuffer, text: &str, x: i32, y: i32, o: &TwoToneOpts) -> i32 {
    let base = TextOpts { scale: o.scale, align: o.align, font: o.font, shadow: None, outline: None };
    if let Some(outline) = o.outline {
        // the outline pass: draw once in the outline colour (draw_text adds the 8-way outline around the glyphs)
        let mut t = base;
        t.outline = Some(outline);
        t.shadow = o.shadow;
        draw_text(fb, text, x, y, outline, &t);
    } else if let Some(shadow) = o.shadow {
        let mut t = base;
        t.shadow = Some(shadow);
        draw_text(fb, text, x, y, shadow, &t);
    }
    let w = text_width(text, &base);
    let left = match o.align {
        Align::Center => x - w.div_euclid(2),
        Align::Right => x - w,
        Align::Left => x,
    };
    let split = o.split * o.scale;
    let h = 7 * o.scale;
    fb.push_clip(left - 1, y - 1, w + 2, split + 1);
    draw_text(fb, text, x, y, o.top, &base);
    fb.pop_clip();
    fb.push_clip(left - 1, y + split, w + 2, h - split + 1);
    draw_text(fb, text, x, y, o.bottom, &base);
    fb.pop_clip();
    left
}

/// True for the "on" part of a blink: `period` frames per cycle, on for `on` of them.
pub fn blink_on(frame: i32, period: i32, on: i32) -> bool {
    frame % period < on
}

/// Centered text helper (centre x = 128).
pub fn center_text(fb: &mut Framebuffer, text: &str, y: i32, color: u8, opts: &TextOpts) {
    center_text_at(fb, text, y, color, opts, W / 2);
}

/// Centered text helper with an explicit centre x.
pub fn center_text_at(fb: &mut Framebuffer, text: &str, y: i32, color: u8, opts: &TextOpts, cx: i32) {
    let mut o = *opts;
    o.align = Align::Center;
    draw_text(fb, text, cx, y, color, &o);
}

/// Zero-padded score, clamped to 6 digits.
pub fn pad6(n: i32) -> String {
    format!("{:0>6}", n.clamp(0, 999999))
}

/// A tiny deterministic hash-to-[0,1) so views can scatter stars/windows without any random source.
pub fn hash01(a: i32, b: i32) -> f64 {
    let mut h: u32 = (imul(a, 0x9e3779b1u32 as i32) ^ imul(b.wrapping_add(0x7f4a7c15), 0x85ebca6bu32 as i32)) as u32;
    h ^= h >> 15;
    h = imul(h as i32, 0x2c1b3c6d) as u32;
    h ^= h >> 12;
    h as f64 / 4294967296.0
}

/// Recolour LUT that turns a sprite's colours into newsprint greys (darkest -> black, lightest -> light grey),
/// for the front-page photo. Based on the NES luminance row of each colour.
pub fn gray_recolor(s: &Sprite) -> Recolor {
    let mut lut: Recolor = [0; 64];
    for (i, v) in lut.iter_mut().enumerate() {
        *v = i as u8;
    }
    let mut cols: Vec<u8> = s.colors.clone();
    cols.sort_by_key(|c| c >> 4); // stable, like Array.sort
    let greys: &[u8] = match cols.len() {
        0 | 1 => &[c::GRAY],
        2 => &[c::BLACK, c::LTGRAY],
        _ => &[c::BLACK, c::GRAY, c::LTGRAY],
    };
    for (i, &col) in cols.iter().enumerate() {
        lut[col as usize] = greys[i.min(greys.len() - 1)];
    }
    lut
}

/// Number with thousands separators (no locale APIs: 1234 -> "1,234").
pub fn with_commas(n: i32) -> String {
    let s = n.max(0).to_string();
    let b = s.as_bytes();
    let mut out = String::new();
    for i in 0..b.len() {
        if i > 0 && (b.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(b[i] as char);
    }
    out
}
