//! Dev tool (art agent 1): sprite sheet of registry sprites whose name starts with any given prefix.
//!   cargo run -p mall-core --example shot_art1 -- out.png scale prefix [prefix...]
//! Shows every frame side by side with a 1px gap, wrapping at 256 px.
use mall_core::art;
use mall_core::pixel::{pal, Fb};
use mall_core::png;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let out = &a[1];
    let scale: usize = a[2].parse().unwrap();
    let prefixes = &a[3..];
    let bg = std::env::var("BG").ok().and_then(|v| u8::from_str_radix(&v, 16).ok()).unwrap_or(0x2C - 0x10 * 0 );
    let maxw: i32 = std::env::var("MAXW").ok().and_then(|v| v.parse().ok()).unwrap_or(254);
    let mut fb = Fb::new();
    let mut used_w = 0;
    fb.clear(pal::DGRAY);
    let (mut x, mut y, mut rowh) = (2, 2, 0);
    for (name, s) in art::registry() {
        if !prefixes.iter().any(|p| name.starts_with(p.as_str())) {
            continue;
        }
        let total = (s.w as i32 + 2) * s.frames.len() as i32;
        if x + total > maxw && x > 2 {
            x = 2;
            y += rowh + 8;
            rowh = 0;
        }
        for f in 0..s.frames.len() {
            let fx = x + f as i32 * (s.w as i32 + 2);
            fb.rect(fx, y, s.w as i32, s.h as i32, bg);
            fb.blit(s, f, fx, y, false);
        }
        fb.text_tiny(x, y + s.h as i32 + 1, name, pal::WHITE);
        used_w = used_w.max(x + total);
        x += total.max(name.len() as i32 * 4) + 4;
        rowh = rowh.max(s.h as i32 + 2);
    }
    let ch = (y + rowh + 10).min(240) as usize;
    let cw = (used_w + 4).min(256) as usize;
    let mut rgba = vec![0u8; 256 * 240 * 4];
    fb.to_rgba(&mut rgba);
    let (sw, sh) = (cw * scale, ch * scale);
    let mut o = vec![0u8; sw * sh * 4];
    for yy in 0..sh {
        for xx in 0..sw {
            let sidx = ((yy / scale) * 256 + xx / scale) * 4;
            o[(yy * sw + xx) * 4..(yy * sw + xx) * 4 + 4].copy_from_slice(&rgba[sidx..sidx + 4]);
        }
    }
    std::fs::write(out, png::encode_rgba(&o, sw as u32, sh as u32)).unwrap();
}
