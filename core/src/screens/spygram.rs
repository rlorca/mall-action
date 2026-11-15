//! The SPYGRAM post card (parody photo app): magenta header, photo, caption, like counter, one comment.
//!
//! Everything is drawn inside the card rectangle (the draw is clipped to it), with pixel-rounded corners
//! that leave the backdrop untouched.

use crate::art;
use crate::copy::{wrap, Post, CAPTION_LINE_MAX, COMMENT_MAX};
use crate::pixel::{pal, Fb, Rect, Sprite, HEART};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Photo {
    /// The agent on the roof, selfie pose (arrival).
    Roof,
    /// The agent beside the station wagon (mission complete).
    Getaway,
}

/// Card size in pixels (w, h).
pub const CARD_W: i32 = 168;
pub const CARD_H: i32 = 168;

const HEADER_H: i32 = 20;
const PHOTO_Y: i32 = 36;
const PHOTO_H: i32 = 74;
const LIKE_Y: i32 = 113;
const CAPTION_Y: i32 = 125;
const COMMENT_Y: i32 = 146;
/// Per-corner inset of the pixel-rounded corners (row 0 first).
const CORNER: [i32; 4] = [4, 2, 1, 1];
/// Likes climb by this much per frame at the start, then ease out (about 1.5 s).
pub const LIKES_PER_FRAME: u32 = 37;
const LIKE_FRAMES: u32 = 90;

/// Blit a sprite at an integer scale (the art is 1x; photos want the agent big).
pub fn blit_scaled(fb: &mut Fb, s: &Sprite, frame: usize, x: i32, y: i32, scale: i32, flip: bool) {
    let f = &s.frames[frame % s.frames.len()];
    for sy in 0..s.h {
        for sx in 0..s.w {
            let p = f[sy * s.w + sx];
            if p == 0 {
                continue;
            }
            let dx = if flip { s.w - 1 - sx } else { sx } as i32;
            fb.rect(x + dx * scale, y + sy as i32 * scale, scale, scale, s.colors[(p - 1) as usize]);
        }
    }
}

/// Final like count for a post (stable per post, 1.2k to 9.9k).
pub fn like_target(post: &Post) -> u32 {
    let mut h: u32 = 2166136261;
    for b in post.caption[0].bytes().chain(post.caption[1].bytes()).chain(post.who.bytes()) {
        h = (h ^ b as u32).wrapping_mul(16777619);
    }
    1200 + h % 8700
}

/// Likes shown `t` frames after the card appeared: starts at 0, climbs at first by ~LIKES_PER_FRAME per frame
/// and eases out until it reaches `like_target` after 90 frames.
pub fn likes_at(post: &Post, t: u32) -> u32 {
    let target = like_target(post);
    let p = t.min(LIKE_FRAMES);
    let q = LIKE_FRAMES - p;
    let eased = target as u64 * (LIKE_FRAMES * LIKE_FRAMES - q * q) as u64 / (LIKE_FRAMES * LIKE_FRAMES) as u64;
    eased as u32
}

/// "1,234".
pub fn with_commas(n: u32) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

/// Draw the card at (x, y). `t` = frames since the card appeared (likes climb quickly).
pub fn draw_card(fb: &mut Fb, x: i32, y: i32, post: &Post, photo: Photo, t: u32) {
    let old_clip = fb.set_clip(intersect(fb.clip(), Rect::new(x, y, CARD_W, CARD_H)));
    // remember the backdrop under the corners so the rounded corners stay transparent
    let mut saved: Vec<(i32, i32, u8)> = Vec::new();
    for (r, &inset) in CORNER.iter().enumerate() {
        for c in 0..inset {
            for (cx, cy) in corner_cells(x, y, r as i32, c) {
                saved.push((cx, cy, fb.get(cx, cy)));
            }
        }
    }

    // body
    fb.rect(x, y, CARD_W, CARD_H, pal::WHITE);
    // header: two-tone magenta with a darker foot line
    fb.rect(x, y, CARD_W, HEADER_H, pal::MAGENTA);
    fb.rect(x, y, CARD_W, 2, pal::LMAGENTA);
    fb.rect(x, y + HEADER_H - 3, CARD_W, 3, pal::PLUM);
    fb.rect(x, y + HEADER_H - 1, CARD_W, 1, pal::DPURPLE);
    draw_camera_logo(fb, x + 7, y + 4);
    fb.text_scaled(x + 27, y + 4 + 1, "SPYGRAM", pal::DPURPLE, 2);
    fb.text_scaled(x + 27, y + 4, "SPYGRAM", pal::WHITE, 2);
    // header right: tiny paper-plane / bell dots
    fb.rect(x + CARD_W - 16, y + 7, 8, 6, pal::WHITE);
    fb.rect(x + CARD_W - 15, y + 8, 6, 4, pal::MAGENTA);
    fb.rect(x + CARD_W - 13, y + 9, 2, 2, pal::WHITE);

    // avatar row
    draw_avatar(fb, x + 5, y + HEADER_H + 2);
    fb.text(x + 22, y + HEADER_H + 2, "AGENT.7", pal::BLACK);
    fb.text_tiny(x + 22, y + HEADER_H + 9, "MALL, SOMEWHERE", pal::GRAY);
    fb.text_right(x + CARD_W - 6, y + HEADER_H + 4, "...", pal::GRAY);

    // photo
    let (px, py, pw) = (x + 2, y + PHOTO_Y, CARD_W - 4);
    let old = fb.set_clip(intersect(fb.clip(), Rect::new(px, py, pw, PHOTO_H)));
    match photo {
        Photo::Roof => photo_roof(fb, px, py, pw, PHOTO_H, t),
        Photo::Getaway => photo_getaway(fb, px, py, pw, PHOTO_H, t),
    }
    fb.set_clip(old);
    fb.frame(px - 1, py - 1, pw + 2, PHOTO_H + 2, pal::LGRAY);

    // like row: heart, count, bubble + plane icons
    let likes = likes_at(post, t);
    let beat = t < LIKE_FRAMES && (t / 6) % 2 == 0; // the heart pulses while the counter climbs
    let hc = if beat { pal::LRED } else { pal::RED };
    fb.text(x + 6, y + LIKE_Y, &HEART.to_string(), hc);
    let s = format!("{} LIKES", with_commas(likes));
    fb.text(x + 16, y + LIKE_Y, &s, pal::BLACK);
    // speech-bubble icon
    let bx = x + CARD_W - 30;
    fb.rect(bx, y + LIKE_Y, 9, 6, pal::DGRAY);
    fb.rect(bx + 1, y + LIKE_Y + 1, 7, 4, pal::WHITE);
    fb.rect(bx + 1, y + LIKE_Y + 6, 2, 2, pal::DGRAY);
    // paper-plane icon
    let ax = x + CARD_W - 16;
    for i in 0..6 {
        fb.rect(ax + i, y + LIKE_Y + 6 - i - 1 + 1, 1, 1 + i / 2, pal::DGRAY);
    }
    fb.rect(ax + 6, y + LIKE_Y, 3, 7, pal::DGRAY);
    fb.rect(ax + 7, y + LIKE_Y + 1, 1, 5, pal::WHITE);

    // caption (two lines, wrapped within 21 chars)
    let mut row = 0;
    for line in post.caption {
        for l in wrap(line, CAPTION_LINE_MAX) {
            if row < 2 {
                fb.text(x + 6, y + CAPTION_Y + row * 9, &l, pal::BLACK);
                row += 1;
            }
        }
    }

    // one comment: "WHO: comment", at most two lines
    let full = format!("{}: {}", post.who, post.comment);
    let mut who_left = post.who.chars().count() + 1; // letters of the name + the colon
    for (i, l) in wrap(&full, COMMENT_MAX).iter().take(2).enumerate() {
        let ly = y + COMMENT_Y + i as i32 * 9;
        fb.text(x + 6, ly, l, pal::DGRAY);
        let n = who_left.min(l.chars().count());
        if n > 0 {
            let head: String = l.chars().take(n).collect();
            fb.text(x + 6, ly, &head, pal::PURPLE);
            who_left -= n;
            who_left = who_left.saturating_sub(1); // the space we wrapped on
        }
    }

    // border + rounded corners
    fb.frame(x, y, CARD_W, CARD_H, pal::DGRAY);
    for (cx, cy, c) in saved {
        fb.put(cx, cy, c);
    }
    for c in 0..4i32 {
        let inset = CORNER[c as usize];
        let prev = if c == 0 { inset + 1 } else { CORNER[c as usize - 1] };
        let hi = (prev - 1).max(inset);
        for col in inset..=hi {
            for (cx, cy) in corner_cells(x, y, c, col) {
                fb.put(cx, cy, pal::DGRAY);
            }
        }
    }
    fb.set_clip(old_clip);
}

fn intersect(a: Rect, b: Rect) -> Rect {
    let x0 = a.x.max(b.x);
    let y0 = a.y.max(b.y);
    let x1 = a.right().min(b.right());
    let y1 = a.bottom().min(b.bottom());
    Rect::new(x0, y0, (x1 - x0).max(0), (y1 - y0).max(0))
}

/// The four mirrored cells of corner pixel (col, row) of the card.
fn corner_cells(x: i32, y: i32, row: i32, col: i32) -> [(i32, i32); 4] {
    [
        (x + col, y + row),
        (x + CARD_W - 1 - col, y + row),
        (x + col, y + CARD_H - 1 - row),
        (x + CARD_W - 1 - col, y + CARD_H - 1 - row),
    ]
}

fn draw_camera_logo(fb: &mut Fb, x: i32, y: i32) {
    // 13x11 camera: body, top bump, big lens, flash dot
    fb.rect(x + 3, y, 5, 2, pal::WHITE);
    fb.rect(x, y + 2, 13, 9, pal::WHITE);
    fb.rect(x + 1, y + 3, 11, 7, pal::DPURPLE);
    fb.rect(x + 4, y + 4, 5, 5, pal::WHITE);
    fb.rect(x + 5, y + 5, 3, 3, pal::PERI);
    fb.put(x + 6, y + 6, pal::WHITE);
    fb.put(x + 10, y + 4, pal::YELLOW);
}

fn draw_avatar(fb: &mut Fb, x: i32, y: i32) {
    // 13x13 round avatar: pink ring, tan face, black hair, shades
    for dy in 0..13i32 {
        for dx in 0..13i32 {
            let (ox, oy) = (dx * 2 - 12, dy * 2 - 12);
            let d = ox * ox + oy * oy;
            if d <= 150 {
                let c = if d > 118 { pal::MAGENTA } else { pal::LBLUE };
                fb.put(x + dx, y + dy, c);
            }
        }
    }
    fb.rect(x + 3, y + 3, 7, 7, pal::TAN);
    fb.rect(x + 3, y + 2, 7, 3, pal::BLACK);
    fb.rect(x + 3, y + 5, 7, 2, pal::BLACK);
    fb.put(x + 6, y + 5, pal::LGRAY);
    fb.rect(x + 5, y + 8, 3, 1, pal::RED);
}

fn photo_roof(fb: &mut Fb, x: i32, y: i32, w: i32, h: i32, t: u32) {
    let ledge = 12;
    // banded dusk sky
    let bands = [pal::NAVY, pal::DBLUE, pal::DPURPLE, pal::PURPLE, pal::PLUM, pal::MAGENTA, pal::PINK, pal::ORANGE];
    let sky_h = h - ledge;
    for (i, &c) in bands.iter().enumerate() {
        let y0 = y + sky_h * i as i32 / 8;
        let y1 = y + sky_h * (i as i32 + 1) / 8;
        fb.rect(x, y0, w, y1 - y0, c);
    }
    // stars in the dark top bands
    for &(sx, sy) in &[(8, 4), (30, 11), (52, 3), (77, 9), (101, 5), (118, 14), (140, 6), (20, 21)] {
        let tw = (t / 20 + sx as u32) % 3 == 0;
        fb.put(x + sx, y + sy, if tw { pal::WHITE } else { pal::LAVENDER });
    }
    // distant skyline
    let skyline: [(i32, i32); 8] = [(0, 18), (14, 26), (30, 16), (46, 30), (88, 20), (100, 28), (116, 18), (132, 24)];
    for &(bx, bh) in &skyline {
        fb.rect(x + bx, y + sky_h - bh, 14, bh, pal::DPURPLE);
        for wy in (0..bh - 4).step_by(5) {
            for wx in [3, 8] {
                if (bx + wx + wy) % 3 != 0 {
                    fb.put(x + bx + wx, y + sky_h - bh + 3 + wy, pal::YELLOW);
                }
            }
        }
    }
    // the skyscraper silhouette
    let sk = art::get("skyscraper");
    fb.blit(sk, (t / 40) as usize, x + w - 72, y + sky_h - sk.h as i32 + 6, false);
    // roof ledge
    fb.rect(x, y + sky_h, w, ledge, pal::GRAY);
    fb.rect(x, y + sky_h, w, 2, pal::LGRAY);
    fb.rect(x, y + sky_h + 2, w, 1, pal::DGRAY);
    for bx in (0..w).step_by(10) {
        fb.rect(x + bx, y + sky_h + 3, 1, ledge - 3, pal::DGRAY);
    }
    fb.rect(x, y + sky_h + 7, w, 1, pal::DGRAY);
    // the agent, big, in selfie pose
    let ag = art::get("agent_selfie");
    blit_scaled(fb, ag, (t / 30) as usize, x + 30, y + sky_h - 48 + 1, 2, false);
    // camera flash burst now and then
    if (18..22).contains(&(t % 60)) {
        let fl = art::get("phone_flash");
        blit_scaled(fb, fl, (t / 2) as usize, x + 56, y + sky_h - 58, 2, false);
    }
}

fn photo_getaway(fb: &mut Fb, x: i32, y: i32, w: i32, h: i32, t: u32) {
    let floor_h = 22;
    let floor_y = y + h - floor_h;
    // concrete garage: ceiling, wall, floor
    fb.rect(x, y, w, h, pal::DGRAY);
    fb.rect(x, y, w, 10, pal::CHARCOAL);
    fb.rect(x, y + 10, w, 2, pal::BLACK);
    for lx in [x + 34, x + 116] {
        // dim ceiling lamps
        fb.rect(lx, y + 4, 18, 3, pal::LYELLOW);
        fb.rect(lx + 2, y + 7, 14, 2, pal::OLIVE);
    }
    let pil = art::get("pillar");
    fb.blit(pil, 0, x + 6, floor_y - pil.h as i32 + 12, false);
    fb.blit(pil, 0, x + w - 24, floor_y - pil.h as i32 + 12, false);
    fb.rect(x, floor_y, w, floor_h, pal::GRAY);
    fb.rect(x, floor_y, w, 1, pal::LGRAY);
    for sx in (6..w).step_by(26) {
        fb.rect(x + sx, floor_y + 9, 10, 2, pal::YELLOW); // painted parking line pieces
    }
    // the wood-panelled wagon and the agent, 2x
    let wg = art::get("station_wagon");
    blit_scaled(fb, wg, 0, x + 52, floor_y + 8 - wg.h as i32 * 2, 2, false);
    let ag = art::get("agent_stand");
    blit_scaled(fb, ag, 0, x + 8, floor_y + 8 - 48, 2, false);
    // thumbs up above the agent's head
    let thumb = Sprite::from_art(
        &[
            "......11..",
            "......11..",
            ".....111..",
            "1111.1111.",
            "1222.11111",
            "1222.11111",
            "1222.11111",
            "1111.11111",
        ],
        [pal::TAN, pal::ORANGE, pal::WHITE],
    );
    let bob = if (t / 12) % 2 == 0 { 0 } else { 1 };
    fb.blit(&thumb, 0, x + 40, floor_y + 8 - 48 + 10 - bob, false);
    let _ = h;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::copy::{ARRIVAL_POSTS, CLEAR_POSTS};
    use crate::pixel::{H, W};

    #[test]
    fn card_stays_inside_its_rect_for_all_posts() {
        let (cx, cy) = (40, 30);
        for (n, p) in ARRIVAL_POSTS.iter().chain(CLEAR_POSTS.iter()).enumerate() {
            for photo in [Photo::Roof, Photo::Getaway] {
                for t in [0, 5, 20, 200] {
                    let mut fb = Fb::new();
                    fb.clear(pal::BLACK);
                    draw_card(&mut fb, cx, cy, p, photo, t);
                    let mut inside = 0;
                    for yy in 0..H as i32 {
                        for xx in 0..W as i32 {
                            let c = fb.get(xx, yy);
                            let in_card = xx >= cx && xx < cx + CARD_W && yy >= cy && yy < cy + CARD_H;
                            if in_card {
                                inside += (c != pal::BLACK) as i32;
                            } else {
                                assert_eq!(c, pal::BLACK, "post {n} {photo:?} t{t} drew outside at {xx},{yy}");
                            }
                        }
                    }
                    assert!(inside > 8000, "card looks empty: {inside}");
                }
            }
        }
    }

    #[test]
    fn card_clips_at_screen_edges_without_panicking() {
        let mut fb = Fb::new();
        draw_card(&mut fb, -20, -10, &ARRIVAL_POSTS[0], Photo::Roof, 3);
        draw_card(&mut fb, 200, 200, &CLEAR_POSTS[0], Photo::Getaway, 3);
    }

    #[test]
    fn corners_are_rounded_and_leave_the_backdrop() {
        let mut fb = Fb::new();
        fb.clear(pal::LCYAN);
        draw_card(&mut fb, 10, 10, &ARRIVAL_POSTS[0], Photo::Roof, 0);
        assert_eq!(fb.get(10, 10), pal::LCYAN);
        assert_eq!(fb.get(10 + CARD_W - 1, 10 + CARD_H - 1), pal::LCYAN);
        assert_ne!(fb.get(10 + 5, 10), pal::LCYAN);
        assert_eq!(fb.get(10 + 5, 10), pal::DGRAY); // the thin border
    }

    #[test]
    fn header_is_magenta() {
        let mut fb = Fb::new();
        draw_card(&mut fb, 0, 0, &ARRIVAL_POSTS[0], Photo::Roof, 0);
        assert_eq!(fb.get(120, 10), pal::MAGENTA);
    }

    #[test]
    fn likes_climb_deterministically_to_a_target() {
        let p = &ARRIVAL_POSTS[3];
        assert_eq!(likes_at(p, 0), 0);
        let a = likes_at(p, 10);
        let b = likes_at(p, 11);
        assert!(a > 0 && b > a);
        assert!(b - a >= LIKES_PER_FRAME - 5, "{}", b - a);
        let mut last = 0;
        for t in 0..200 {
            let l = likes_at(p, t);
            assert!(l >= last);
            last = l;
        }
        assert_eq!(likes_at(p, 90), like_target(p));
        assert_eq!(likes_at(p, 5000), like_target(p));
        assert_eq!(likes_at(p, 33), likes_at(p, 33));
        assert!((1200..=9900).contains(&like_target(p)));
    }

    #[test]
    fn comma_formatting() {
        assert_eq!(with_commas(0), "0");
        assert_eq!(with_commas(999), "999");
        assert_eq!(with_commas(1234), "1,234");
        assert_eq!(with_commas(98765), "98,765");
    }

    #[test]
    fn different_posts_look_different() {
        let mut a = Fb::new();
        let mut b = Fb::new();
        draw_card(&mut a, 0, 0, &ARRIVAL_POSTS[0], Photo::Roof, 100);
        draw_card(&mut b, 0, 0, &ARRIVAL_POSTS[1], Photo::Roof, 100);
        assert_ne!(a.px, b.px);
    }
}
