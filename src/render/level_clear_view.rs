use super::newspaper_view::draw_newspaper;
use super::screen_fx::{blink_on, blit_scaled_by_name, draw_sprite_by_name_sized, hash01, sprite_or_null, ScaledOpts, H, W};
use super::spygram_view::{draw_spygram, spygram_likes, PhotoFn, SpygramOpts, SPYGRAM_CARD_H};
use super::widgets::draw_bubble_at;
use crate::content::copy::{SpygramPost, UI};
use crate::engine::font::{draw_text, text_width, Align, TextOpts};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::screens::levelclear::{LevelClearPhase, LevelClearScreen, TallyRowView, LC_DRIVE_FRAMES};
use crate::game::screens::screentext::SCREEN_TEXT;

/// What the view reads from the LevelClearScreen.
#[derive(Clone, Debug)]
pub struct LevelClearViewState {
    pub phase: LevelClearPhase,
    pub phase_frame: i32,
    pub tally: Vec<TallyRowView>,
    pub headline: String,
    pub post: SpygramPost,
    pub like_seed: i32,
}

impl From<&LevelClearScreen> for LevelClearViewState {
    fn from(s: &LevelClearScreen) -> Self {
        LevelClearViewState { phase: s.phase(), phase_frame: s.phase_frame(), tally: s.tally(), headline: s.headline.to_string(), post: s.post, like_seed: s.like_seed }
    }
}

// ------------------------------------------------------------------ phase 0: the garage

const FLOOR: i32 = 196; // y of the garage floor line under the wheels
const WAGON_X0: f64 = 92.0;
const WAGON_GO: i32 = 40; // frame the wagon starts rolling
const WAGON_ACC: f64 = 0.03;

/// Wagon left edge x after `pf` frames of the scene (pure; the tests use it).
pub fn wagon_x(pf: i32) -> f64 {
    let t = (pf - WAGON_GO).max(0) as f64;
    WAGON_X0 + 0.5 * WAGON_ACC * t * t
}

/// Chasing spy's left edge x. He runs in from the left, never catches up, then pulls up and stops.
pub fn spy_x(pf: i32) -> f64 {
    let start = 30;
    let speed = 1.8;
    let stop_at = 150; // frame he starts to give up
    let brake = 30; // frames to stop
    if pf < start {
        return -24.0;
    }
    if pf <= stop_at {
        return -24.0 + speed * (pf - start) as f64;
    }
    let t = brake.min(pf - stop_at) as f64;
    let brake = brake as f64;
    -24.0 + speed * (stop_at - start) as f64 + speed * (t - (t * t) / (2.0 * brake))
}

fn draw_garage_backdrop(fb: &mut Framebuffer, frame: i32) {
    // back wall
    fb.fill_rect(0, 0, W, H, c::GRAY);
    fb.dither(0, 44, W, FLOOR - 44, c::MDGRAY, 0);
    // ceiling slab with beams and pipes
    fb.fill_rect(0, 0, W, 44, c::MDGRAY);
    fb.fill_rect(0, 40, W, 4, c::BLACK);
    let mut x = 0;
    while x < W {
        fb.fill_rect(x, 0, 14, 52, c::GRAY);
        fb.v_line(x + 14, 0, 52, c::BLACK);
        x += 64;
    }
    fb.h_line(0, 8, W, c::DKTEAL);
    fb.h_line(0, 9, W, c::TEAL);
    fb.h_line(0, 12, W, c::DKTEAL);
    // fluorescent tubes, one of them flickering
    for i in 0..3 {
        let lx = 40 + i * 80;
        let lit = i != 1 || frame % 90 > 6;
        fb.fill_rect(lx, 46, 36, 3, if lit { c::PALEBLUE } else { c::GRAY });
        fb.h_line(lx, 49, 36, c::BLACK);
        if lit {
            fb.dither(lx - 4, 49, 44, 5, c::MDGRAY, 0);
        }
    }
    // pillars with hazard stripes at the foot
    for px in [18, 130, 236] {
        fb.fill_rect(px, 44, 20, FLOOR - 44, c::LTGRAY);
        fb.fill_rect(px + 14, 44, 6, FLOOR - 44, c::GRAY);
        fb.v_line(px, 44, FLOOR - 44, c::BLACK);
        fb.v_line(px + 19, 44, FLOOR - 44, c::BLACK);
        let mut y = FLOOR - 16;
        while y < FLOOR {
            fb.fill_rect(px, y, 20, 2, if ((y - (FLOOR - 16)) / 4) % 2 == 0 { c::YELLOW } else { c::BLACK });
            y += 4;
        }
    }
    // level sign "P" and the EXIT arrow
    fb.fill_rect(68, 62, 22, 22, c::BLUE);
    fb.stroke_rect(68, 62, 22, 22, c::WHITE);
    draw_text(fb, SCREEN_TEXT.garage.level, 79, 67, c::WHITE, &TextOpts::default().scale(2).align(Align::Center));
    fb.fill_rect(176, 66, 46, 14, c::GREEN);
    fb.stroke_rect(176, 66, 46, 14, c::WHITE);
    draw_text(fb, SCREEN_TEXT.garage.exit, 199, 70, c::WHITE, &TextOpts::default().align(Align::Center));
    // floor, parking lines and wheel stops
    fb.fill_rect(0, FLOOR, W, H - FLOOR, c::MDGRAY);
    fb.h_line(0, FLOOR, W, c::LTGRAY);
    fb.dither(0, FLOOR + 1, W, H - FLOOR - 1, c::GRAY, 0);
    let mut x = -16;
    while x < W {
        for k in 0..24 {
            fb.set_pixel(x + 28 - k / 2, FLOOR + 6 + k, c::WHITE); // slanted parking line
        }
        fb.fill_rect(x + 6, FLOOR + 3, 20, 3, c::YELLOW);
        x += 72;
    }
}

fn draw_receipt(fb: &mut Framebuffer, x: i32, y: i32, frame: i32) {
    let wob = (frame >> 2) % 2;
    fb.fill_rect(x, y, 7, 11, c::WHITE);
    fb.stroke_rect(x, y, 7, 11, c::BLACK);
    let mut r = 2;
    while r < 9 {
        fb.h_line(x + 1, y + r, 5, if r == 4 { c::RED } else { c::MDGRAY });
        r += 2;
    }
    // torn bottom edge
    fb.set_pixel(x + 1, y + 11, c::WHITE);
    fb.set_pixel(x + 3, y + 11 + wob, c::WHITE);
    fb.set_pixel(x + 5, y + 11, c::WHITE);
}

fn draw_puff(fb: &mut Framebuffer, x: i32, y: i32, age: i32) {
    match sprite_or_null("fx.puff") {
        Some(s) => fb.sprite(s, x, y, &BlitOpts::default().frame((age / 6) % s.frame_count())),
        None => fb.fill_circle(x + 6, y + 6, (3 - age / 10) as f64, c::LTGRAY),
    }
}

fn draw_drive(fb: &mut Framebuffer, pf: i32) {
    draw_garage_backdrop(fb, pf);

    // exhaust puffs trail behind the accelerating wagon
    for k in 0..9 {
        let born = WAGON_GO + 4 + k * 7;
        let age = pf - born;
        if !(0..=26).contains(&age) {
            continue;
        }
        draw_puff(fb, round_i(wagon_x(born)) - 10, FLOOR - 16 - age / 3, age);
    }

    // the wagon
    let wx = round_i(wagon_x(pf));
    if wx < W {
        let lights = pf >= 18;
        fb.fill_rect(wx + 4, FLOOR - 2, 64, 3, c::BLACK); // soft shadow under the car
        if !draw_sprite_by_name_sized(fb, "wagon", wx, FLOOR - 28, &BlitOpts::default().frame(if lights { 1 } else { 0 }), 72, 28) {
            fb.stroke_rect(wx, FLOOR - 28, 72, 28, c::AMBER);
        }
        // headlight glow in front of the car once the lights are on
        if lights {
            fb.dither(wx + 72, FLOOR - 14, 12, 8, c::PALEYELLOW, 0);
        }
    }

    // the chasing spy waving his receipt
    let sx = round_i(spy_x(pf));
    if pf >= 30 && sx < W {
        let running = spy_x(pf) - spy_x(pf - 1) > 0.25;
        let sy = FLOOR - 24 + 1;
        let bob = if running { (pf >> 2) % 2 } else { 0 };
        if running {
            draw_sprite_by_name_sized(fb, "spy.walk", sx, sy - bob, &BlitOpts::default().frame((pf >> 2) & 3), 16, 24);
        } else {
            draw_sprite_by_name_sized(fb, "spy.stand", sx, sy, &BlitOpts::default(), 16, 24);
        }
        let wave = round_i((pf as f64 / 3.0).sin() * 3.0);
        draw_receipt(fb, sx + 12, sy - 10 + wave - bob, pf);
        // the shout, while he runs
        if (60..=215).contains(&pf) {
            draw_bubble_at(fb, SCREEN_TEXT.chase, (sx + 8) as f64, (sy - 14) as f64, 4);
        }
        // sweat drops once he gives up
        if pf > 175 {
            let d = (pf >> 3) % 3;
            fb.fill_rect(sx - 2 + d, sy + 4 - d, 1, 2, c::CYAN);
            fb.fill_rect(sx + 18 - d, sy + 2 + d, 1, 2, c::CYAN);
        }
    }

    // banner
    if pf >= 12 {
        let col = [c::YELLOW, c::WHITE, c::ORANGE][((pf / 6) % 3) as usize];
        draw_text(fb, UI.level_clear, W / 2, 18, col, &TextOpts::default().scale(2).align(Align::Center).shadow(c::BLACK));
    }

    // fade out at the end
    let fade = (pf - (LC_DRIVE_FRAMES - 18)).div_euclid(5) + 1;
    if fade > 0 {
        fb.darken_all(fade.min(4));
    }
}

// ------------------------------------------------------------------ phase 1: the receipt

fn draw_zigzag(fb: &mut Framebuffer, x: i32, y: i32, w: i32, up: bool, color: u8) {
    // sawtooth teeth hanging off the paper edge (y is the paper's top / bottom edge)
    let mut i = 0;
    while i < w {
        for r in 0..3 {
            fb.fill_rect(x + i + r, if up { y - 1 - r } else { y + r }, 6 - 2 * r, 1, color);
        }
        i += 6;
    }
}

fn draw_tally(fb: &mut Framebuffer, s: &LevelClearViewState) {
    let pf = s.phase_frame;
    fb.fill_rect(0, 0, W, H, c::DKBLUE);
    fb.dither(0, 0, W, H, c::INDIGO, 0);
    let t = (pf as f64 / 22.0).min(1.0);
    let oy = round_i((1.0 - (1.0 - (1.0 - t) * (1.0 - t))) * H as f64);

    let px = 40;
    let pw = 176;
    let top = 12 + oy;
    let bottom = 226 + oy;
    fb.fill_rect(px + 3, top + 3, pw, bottom - top, c::BLACK);
    fb.fill_rect(px, top, pw, bottom - top, c::WHITE);
    draw_zigzag(fb, px, top, pw, true, c::WHITE);
    draw_zigzag(fb, px, bottom, pw, false, c::WHITE);

    let o = TextOpts::default();
    draw_text(fb, UI.level_clear, px + pw / 2, top + 10, c::BLACK, &TextOpts::default().scale(2).align(Align::Center));
    fb.h_line(px + 8, top + 28, pw - 16, c::BLACK);
    let mut x = px + 8;
    while x < px + pw - 8 {
        fb.set_pixel(x + 1, top + 30, c::GRAY);
        x += 4;
    }

    let ys = [40, 62, 84, 108, 148];
    for (i, r) in s.tally.iter().enumerate() {
        if !r.visible {
            continue;
        }
        let y = top + ys[i];
        let col = if r.counting {
            if blink_on(pf, 6, 3) {
                c::RED
            } else {
                c::MAROON
            }
        } else {
            c::BLACK
        };
        if r.value.is_empty() {
            // LOOP n: big and centred between stars
            draw_text(fb, &r.label, px + pw / 2, y, c::BLACK, &TextOpts::default().scale(2).align(Align::Center));
            draw_text(fb, "*", px + 16, y + 3, c::BLACK, &o);
            draw_text(fb, "*", px + pw - 21, y + 3, c::BLACK, &o);
            continue;
        }
        if r.total {
            fb.h_line(px + 8, y - 8, pw - 16, c::BLACK);
            fb.h_line(px + 8, y - 6, pw - 16, c::BLACK);
            draw_text(fb, &r.label, px + 10, y + 4, c::BLACK, &o);
            draw_text(fb, &r.value, px + pw - 10, y, col, &TextOpts::default().scale(2).align(Align::Right));
            continue;
        }
        draw_text(fb, &r.label, px + 10, y, c::BLACK, &o);
        let vw = text_width(&r.value, &TextOpts::default().scale(2));
        draw_text(fb, &r.value, px + pw - 10, y - 3, col, &TextOpts::default().scale(2).align(Align::Right));
        // dotted leader between label and value
        let lx = px + 10 + text_width(&r.label, &o) + 4;
        let mut x = lx;
        while x < px + pw - 10 - vw - 4 {
            fb.set_pixel(x, y + 6, c::GRAY);
            x += 3;
        }
    }

    // barcode + thanks
    let by = top + 168;
    let mut x = px + 20;
    while x < px + pw - 20 {
        let w = 1 + (hash01(x, 3) * 3.0).floor() as i32;
        fb.fill_rect(x, by, w, 14, c::BLACK);
        x += w + 1 + (hash01(x, 4) * 2.0).floor() as i32;
    }
    draw_text(fb, SCREEN_TEXT.tally.thanks, px + pw / 2, by + 20, c::MDGRAY, &TextOpts::default().align(Align::Center));
}

// ------------------------------------------------------------------ phase 3: the SPYGRAM post

/// The post's photo: the agent grinning in front of the wood-panelled wagon in the garage.
pub fn garage_photo(fb: &mut Framebuffer, x: i32, y: i32, w: i32, h: i32, frame: i32) {
    fb.fill_rect(x, y, w, h, c::GRAY);
    fb.dither(x, y + 14, w, h - 22, c::MDGRAY, 0);
    fb.fill_rect(x, y, w, 14, c::MDGRAY);
    fb.fill_rect(x, y + 12, w, 2, c::BLACK);
    fb.fill_rect(x + 6, y + 14, 12, h - 22, c::LTGRAY);
    fb.fill_rect(x, y + h - 8, w, 8, c::MDGRAY);
    fb.h_line(x, y + h - 8, w, c::LTGRAY);
    if !blit_scaled_by_name(fb, "wagon", x + 2, y + h - 8 - 56, 2, &ScaledOpts { frame: 0, ..Default::default() }) {
        fb.stroke_rect(x + 2, y + h - 64, 144, 56, c::AMBER);
    }
    let so = ScaledOpts { frame: if frame % 120 < 4 { 1 } else { 0 }, ..Default::default() };
    if !blit_scaled_by_name(fb, "agent.selfie", x + w - 56, y + h - 8 - 72, 3, &so) {
        fb.stroke_rect(x + w - 56, y + h - 80, 48, 72, c::HOTPINK);
    }
}

fn draw_spygram_phase(fb: &mut Framebuffer, s: &LevelClearViewState) {
    let pf = s.phase_frame;
    fb.fill_rect(0, 0, W, H, c::PURPLE0);
    let mut y = 0;
    while y < H {
        fb.dither(0, y, W, 12, c::VIOLET, 0);
        y += 24;
    }
    let t = (pf as f64 / 16.0).min(1.0);
    let ease = 1.0 - (1.0 - t) * (1.0 - t);
    let y = round_i((H - SPYGRAM_CARD_H) as f64 / 2.0 + (1.0 - ease) * H as f64);
    let photo: PhotoFn = garage_photo;
    draw_spygram(fb, &s.post, spygram_likes(pf, s.like_seed), pf, &SpygramOpts { x: None, y: Some(y), photo: Some(photo) });
}

pub fn draw_level_clear(fb: &mut Framebuffer, s: &LevelClearViewState) {
    match s.phase {
        LevelClearPhase::Drive => draw_drive(fb, s.phase_frame),
        LevelClearPhase::Tally => draw_tally(fb, s),
        LevelClearPhase::News => draw_newspaper(fb, &s.headline, s.phase_frame),
        LevelClearPhase::Spygram => draw_spygram_phase(fb, s),
    }
}
