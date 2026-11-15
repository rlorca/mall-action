use super::screen_fx::{blink_on, draw_two_tone, hash01, pad6, TwoToneOpts, H, W};
use crate::art::storefront::{draw_storefront, StorefrontOpts, STOREFRONT_H};
use crate::content::copy::UI;
use crate::content::stores::{STORE_IDS, STORE_W};
use crate::engine::font::{draw_text, text_width, Align, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::palette::c;
use crate::game::screens::screentext::SCREEN_TEXT;
use crate::game::screens::title::{TitleScreen, TITLE_STORE_GAP, TITLE_STRIP_PERIOD};

/// What the title view reads from the TitleScreen.
#[derive(Clone, Copy, Debug)]
pub struct TitleViewState {
    pub frame: i32,
    pub hi_score: i32,
    pub black_friday: bool,
    pub black_friday_frames: i32,
    pub scroll: i32,
}

impl From<&TitleScreen> for TitleViewState {
    fn from(t: &TitleScreen) -> Self {
        TitleViewState { frame: t.frame(), hi_score: t.hi_score, black_friday: t.black_friday(), black_friday_frames: t.black_friday_frames(), scroll: t.scroll() }
    }
}

const SKY_BANDS: [u8; 8] = [c::BLACK, c::DKBLUE, c::DKBLUE, c::VIOLET, c::VIOLET, c::PURPLE0, c::PURPLE0, c::CRIMSON];
const SKY_H: i32 = 176;
const STORE_Y: i32 = 176;
const PAVE_Y: i32 = STORE_Y + STOREFRONT_H;
const STORE_W_I: i32 = STORE_W as i32;

fn draw_sky(fb: &mut Framebuffer, frame: i32) {
    let bh = SKY_H / SKY_BANDS.len() as i32;
    for (i, &col) in SKY_BANDS.iter().enumerate() {
        let i = i as i32;
        fb.fill_rect(0, i * bh, W, bh, col);
        // two rows of checkerboard dither with the next colour blend the bands like an NES gradient
        if let Some(&next) = SKY_BANDS.get((i + 1) as usize) {
            if next != col {
                fb.dither(0, (i + 1) * bh - 4, W, 2, next, 0);
                fb.dither(0, (i + 1) * bh - 2, W, 2, next, 1);
            }
        }
    }
    // stars (twinkle)
    for i in 0..46 {
        let x = (hash01(i, 1) * W as f64).floor() as i32;
        let y = (hash01(i, 2) * 118.0).floor() as i32;
        let phase = (frame + i * 13).div_euclid(24) % 4;
        let col = match phase {
            0 => c::WHITE,
            1 => c::PALEBLUE,
            2 => c::LTGRAY,
            _ => c::GRAY,
        };
        fb.set_pixel(x, y, col);
        if i % 9 == 0 && phase < 2 {
            fb.set_pixel(x - 1, y, c::GRAY);
            fb.set_pixel(x + 1, y, c::GRAY);
            fb.set_pixel(x, y - 1, c::GRAY);
            fb.set_pixel(x, y + 1, c::GRAY);
        }
    }
    // moon with a bite taken out of it
    fb.fill_circle(226, 30, 10.0, c::PALEYELLOW);
    fb.fill_circle(231, 26, 8.0, c::VIOLET);
    fb.set_pixel(222, 34, c::YELLOW);
    fb.set_pixel(220, 29, c::YELLOW);
    // skyline
    let mut x = 0;
    let mut i = 0;
    while x < W {
        let bw = 10 + (hash01(i, 5) * 16.0).floor() as i32;
        let bhgt = 6 + (hash01(i, 6) * 14.0).floor() as i32;
        fb.fill_rect(x, SKY_H - bhgt, bw, bhgt, c::BLACK);
        let mut wy = SKY_H - bhgt + 3;
        while wy < SKY_H - 3 {
            let mut wx = x + 2;
            while wx < x + bw - 2 {
                if hash01(wx, wy) > 0.55 {
                    fb.set_pixel(wx, wy, if hash01(wx, wy) > 0.9 { c::WHITE } else { c::YELLOW });
                }
                wx += 4;
            }
            wy += 5;
        }
        x += bw + 1 + (hash01(i, 7) * 3.0).floor() as i32;
        i += 1;
    }
}

fn draw_logo(fb: &mut Framebuffer, frame: i32) {
    let big = TwoToneOpts { scale: 6, top: c::YELLOW, bottom: c::ORANGE, split: 4, outline: Some(c::BLACK), shadow: Some(c::BLACK), align: Align::Center, ..Default::default() };
    draw_two_tone(fb, "MALL", W / 2, 12, &big);
    let small = TwoToneOpts { scale: 4, top: c::ORANGE, bottom: c::RED, split: 4, outline: Some(c::BLACK), shadow: Some(c::BLACK), align: Align::Center, ..Default::default() };
    draw_two_tone(fb, "ACTION", W / 2, 60, &small);
    // a glint that sweeps over the logo now and then
    let t = frame % 180;
    if t < 16 {
        let gx = 58 + ((t as f64 / 16.0) * 140.0).floor() as i32;
        fb.push_clip(gx, 12, 5, 42);
        draw_two_tone(fb, "MALL", W / 2, 12, &TwoToneOpts { scale: 6, top: c::WHITE, bottom: c::PALEYELLOW, split: 4, align: Align::Center, ..Default::default() });
        fb.pop_clip();
        fb.push_clip(gx - 6, 60, 5, 28);
        draw_two_tone(fb, "ACTION", W / 2, 60, &TwoToneOpts { scale: 4, top: c::PALEYELLOW, bottom: c::SALMON, split: 4, align: Align::Center, ..Default::default() });
        fb.pop_clip();
    }
}

fn draw_black_friday(fb: &mut Framebuffer, t: &TitleViewState) {
    let flash = t.black_friday_frames.div_euclid(6) % 3;
    let col = [c::YELLOW, c::WHITE, c::RED][flash as usize];
    let col2 = [c::WHITE, c::YELLOW, c::WHITE][flash as usize];
    fb.fill_rect(28, 145, 200, 26, c::BLACK);
    fb.stroke_rect(28, 145, 200, 26, col);
    draw_text(fb, UI.black_friday, W / 2, 149, col, &TextOpts::default().scale(2).align(Align::Center));
    draw_text(fb, UI.black_friday_off, W / 2, 161, col2, &TextOpts::default().align(Align::Center));
}

fn draw_store_row(fb: &mut Framebuffer, t: &TitleViewState) {
    // building wall behind the row + pavement
    fb.fill_rect(0, STORE_Y - 3, W, STOREFRONT_H + 3, c::DKBLUE);
    fb.h_line(0, STORE_Y - 4, W, c::BLACK);
    let pitch = STORE_W_I + TITLE_STORE_GAP;
    let off = t.scroll;
    for rep in 0..2 {
        for (k, &id) in STORE_IDS.iter().enumerate() {
            let x = k as i32 * pitch - off + rep * TITLE_STRIP_PERIOD;
            if x >= W || x + STORE_W_I <= 0 {
                continue;
            }
            draw_storefront(fb, x as f64, STORE_Y as f64, id, &StorefrontOpts { frame: t.frame, cleared: false, black_friday: t.black_friday });
        }
    }
    fb.fill_rect(0, PAVE_Y, W, 8, c::MDGRAY);
    fb.h_line(0, PAVE_Y, W, c::LTGRAY);
    let mut x = -(off % 32);
    while x < W {
        fb.v_line(x, PAVE_Y + 1, 7, c::GRAY);
        x += 32;
    }
}

pub fn draw_title(fb: &mut Framebuffer, t: &TitleViewState) {
    draw_sky(fb, t.frame);
    draw_logo(fb, t.frame);

    draw_text(fb, UI.subtitle, W / 2, 91, c::PALEBLUE, &TextOpts::default().align(Align::Center).shadow(c::BLACK));

    let hi = format!("{} ", SCREEN_TEXT.title.hi_score);
    let o = TextOpts::default();
    let hi_w = text_width(&format!("{}{}", hi, pad6(t.hi_score)), &o);
    let hx = (W - hi_w).div_euclid(2);
    draw_text(fb, &hi, hx, 105, c::YELLOW, &TextOpts::default().shadow(c::BLACK));
    draw_text(fb, &pad6(t.hi_score), hx + text_width(&hi, &o), 105, c::WHITE, &TextOpts::default().shadow(c::BLACK));

    if blink_on(t.frame, 60, 38) {
        draw_text(fb, UI.press_start, W / 2, 119, c::WHITE, &TextOpts::default().scale(2).align(Align::Center).shadow(c::MAROON));
    }

    if t.black_friday {
        draw_black_friday(fb, t);
    }
    draw_text(fb, UI.copyright, W / 2, 148, c::LTGRAY, &TextOpts::default().align(Align::Center).shadow(c::BLACK));

    draw_store_row(fb, t);

    draw_text(fb, UI.hint1, W / 2, H - 18, c::LTGRAY, &TextOpts::default().align(Align::Center));
    draw_text(fb, UI.hint2, W / 2, H - 10, c::GRAY, &TextOpts::default().align(Align::Center));
}
