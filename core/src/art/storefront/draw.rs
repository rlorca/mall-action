//! Small drawing helpers shared by the storefront modules.

use crate::pixel::{pal, Fb, Rect};

/// Paint ASCII art with up to 9 colours: digit d maps to `cols[d-1]`, anything else is transparent.
pub fn art(fb: &mut Fb, x: i32, y: i32, rows: &[&str], cols: &[u8]) {
    for (j, row) in rows.iter().enumerate() {
        for (i, ch) in row.chars().enumerate() {
            if let Some(d) = ch.to_digit(10) {
                if d >= 1 && (d as usize) <= cols.len() {
                    fb.put(x + i as i32, y + j as i32, cols[d as usize - 1]);
                }
            }
        }
    }
}

/// Cheap deterministic hash for noise and sparkle.
pub fn hash(a: u32, b: u32, c: u32) -> u32 {
    let mut x = a.wrapping_mul(0x9E37_79B1) ^ b.wrapping_mul(0x85EB_CA6B) ^ c.wrapping_mul(0xC2B2_AE35);
    x ^= x >> 15;
    x = x.wrapping_mul(0x2C1B_3C6D);
    x ^= x >> 12;
    x = x.wrapping_mul(0x297A_2D39);
    x ^ (x >> 15)
}

/// Back and forth 0..=n..0 over time.
pub fn pingpong(t: u32, n: u32) -> i32 {
    if n == 0 {
        return 0;
    }
    let p = t % (2 * n);
    (if p <= n { p } else { 2 * n - p }) as i32
}

/// Filled circle.
pub fn disc(fb: &mut Fb, cx: i32, cy: i32, r: i32, c: u8) {
    for y in -r..=r {
        for x in -r..=r {
            if x * x + y * y <= r * r + r / 2 {
                fb.put(cx + x, cy + y, c);
            }
        }
    }
}

/// Bresenham line.
pub fn line(fb: &mut Fb, x0: i32, y0: i32, x1: i32, y1: i32, c: u8) {
    let (mut x, mut y) = (x0, y0);
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    loop {
        fb.put(x, y, c);
        if x == x1 && y == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }
}

/// One shade darker on the NES palette (lightness row down, black at the bottom).
pub fn darker(c: u8) -> u8 {
    if c == pal::BLACK {
        pal::BLACK
    } else if c >= 0x10 {
        c - 0x10
    } else {
        pal::BLACK
    }
}

/// Dim a rectangle: darken every pixel and dither black over it.
pub fn dim(fb: &mut Fb, x: i32, y: i32, w: i32, h: i32) {
    fb.map_rect(x, y, w, h, darker);
    fb.map_rect(x, y, w, h, darker);
    fb.dither_rect(x, y, w, h, pal::BLACK, 0);
}

/// Run `f` with the framebuffer clipped to a rectangle (intersected with the current clip).
pub fn clipped(fb: &mut Fb, r: Rect, f: impl FnOnce(&mut Fb)) {
    let cur = fb.clip();
    let x0 = r.x.max(cur.x);
    let y0 = r.y.max(cur.y);
    let x1 = r.right().min(cur.right());
    let y1 = r.bottom().min(cur.bottom());
    let old = fb.set_clip(Rect::new(x0, y0, (x1 - x0).max(0), (y1 - y0).max(0)));
    f(fb);
    fb.set_clip(old);
}
