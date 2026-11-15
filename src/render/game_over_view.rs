use super::screen_fx::{blink_on, draw_sprite_by_name, pad6, H, W};
use crate::art::storefront::{draw_storefront, StorefrontOpts, STOREFRONT_H};
use crate::content::copy::UI;
use crate::content::stores::StoreId;
use crate::engine::font::{draw_text, text_width, Align, TextOpts};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::screens::gameover::{GameOverScreen, GO_FLOORS};
use crate::game::screens::screentext::SCREEN_TEXT;

/// What the view reads from the GameOverScreen. (TS passed a `shutter(floor)` method; here the three
/// shutter fractions are precomputed: `shutters[f]` = `GameOverScreen::shutter(f)`.)
#[derive(Clone, Debug)]
pub struct GameOverViewState {
    pub frame: i32,
    pub line1: String,
    pub line2: String,
    pub shutters: [f64; 3],
    pub show_game_over: bool,
    pub score: i32,
    pub hi_score: i32,
    pub new_record: bool,
}

impl GameOverViewState {
    pub fn shutter(&self, floor: i32) -> f64 {
        self.shutters[floor as usize]
    }
}

impl From<&GameOverScreen> for GameOverViewState {
    fn from(s: &GameOverScreen) -> Self {
        GameOverViewState {
            frame: s.frame(),
            line1: s.line1(),
            line2: s.line2(),
            shutters: [s.shutter(0), s.shutter(1), s.shutter(2)],
            show_game_over: s.show_game_over(),
            score: s.score,
            hi_score: s.hi_score,
            new_record: s.new_record(),
        }
    }
}

/// Three floors of three storefronts, drawn on the real floor pitch (48 px).
const ROWS: [[StoreId; 3]; 3] = [
    [StoreId::Forever12, StoreId::Radioshock, StoreId::Crookstone],
    [StoreId::Kgbtoys, StoreId::Spenders, StoreId::Hotspy],
    [StoreId::Footlock, StoreId::Gamestonk, StoreId::Sambaddy],
];
const FLOOR_Y: [i32; 3] = [88, 136, 184];

/// One rolling shutter covering the top `frac` of a storefront row: ribbed slats and a bottom bar with a handle.
fn draw_shutter(fb: &mut Framebuffer, y: i32, frac: f64) {
    let h = round_i(frac * STOREFRONT_H as f64);
    if h <= 0 {
        return;
    }
    for r in 0..h {
        let band = r % 4;
        let col = if band == 0 {
            c::LTGRAY
        } else if band == 3 {
            c::MDGRAY
        } else {
            c::GRAY
        };
        fb.h_line(0, y + r, W, col);
    }
    // guide rails
    let mut x = 0;
    while x < W {
        fb.v_line(x, y, h, c::BLACK);
        fb.v_line(x + 1, y, h, c::MDGRAY);
        x += 80;
    }
    // bottom bar and handle
    fb.fill_rect(0, y + h - 2, W, 2, c::BLACK);
    if h >= 4 {
        let mut x = 40;
        while x < W {
            fb.fill_rect(x - 3, y + h - 3, 7, 3, c::LTGRAY);
            fb.h_line(x - 3, y + h - 1, 7, c::BLACK);
            x += 80;
        }
    }
}

pub fn draw_game_over(fb: &mut Framebuffer, s: &GameOverViewState) {
    fb.clear(c::BLACK);
    // interior wall + slabs
    fb.fill_rect(0, FLOOR_Y[0] - STOREFRONT_H - 4, W, FLOOR_Y[2] + 8 - (FLOOR_Y[0] - STOREFRONT_H - 4), c::DKBLUE);
    // polished concourse floor under the last row
    fb.fill_rect(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, c::DKBLUE);
    fb.dither(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, c::BLACK, 0);

    for f in 0..GO_FLOORS as usize {
        let fy = FLOOR_Y[f];
        for (i, &id) in ROWS[f].iter().enumerate() {
            draw_storefront(fb, (8 + i as i32 * 80) as f64, (fy - STOREFRONT_H) as f64, id, &StorefrontOpts { frame: s.frame, ..Default::default() });
        }
        fb.fill_rect(0, fy, W, 8, c::MDGRAY);
        fb.h_line(0, fy, W, c::LTGRAY);
        fb.h_line(0, fy + 7, W, c::BLACK);
    }

    // the agent, standing on the ground floor in front of the middle store, looking at us
    draw_sprite_by_name(fb, "agent.ride", 120, FLOOR_Y[2] - 24, &BlitOpts::default());

    for f in 0..GO_FLOORS {
        draw_shutter(fb, FLOOR_Y[f as usize] - STOREFRONT_H, s.shutter(f));
    }

    let o = TextOpts::default();
    // PA plate with the typewriter text
    fb.fill_rect(16, 6, W - 32, 34, c::BLACK);
    fb.stroke_rect(16, 6, W - 32, 34, c::WHITE);
    fb.stroke_rect(18, 8, W - 36, 30, c::MDGRAY);
    let cursor_on = blink_on(s.frame, 20, 12);
    draw_text(fb, &s.line1, 28, 13, c::YELLOW, &o);
    let done1 = s.line1.encode_utf16().count() == UI.closed_line1.encode_utf16().count();
    if !done1 && cursor_on {
        fb.fill_rect(28 + text_width(&s.line1, &o) + 1, 13, 5, 7, c::YELLOW);
    }
    draw_text(fb, &s.line2, 28, 25, c::WHITE, &o);
    if done1 && s.line2.encode_utf16().count() < UI.closed_line2.encode_utf16().count() && cursor_on {
        fb.fill_rect(28 + text_width(&s.line2, &o) + 1, 25, 5, 7, c::WHITE);
    }

    if s.show_game_over {
        fb.fill_rect(0, FLOOR_Y[2] + 8, W, H - FLOOR_Y[2] - 8, c::BLACK);
        draw_text(fb, UI.game_over, W / 2, 196, c::RED, &TextOpts::default().scale(3).align(Align::Center).shadow(c::MAROON));
        let g = SCREEN_TEXT.game_over;
        let a = format!("{} ", g.score);
        let b = format!("{} ", g.hi_score);
        let total = text_width(&format!("{}{}", a, pad6(s.score)), &o) + 14 + text_width(&format!("{}{}", b, pad6(s.hi_score)), &o);
        let mut x = (W - total).div_euclid(2);
        draw_text(fb, &a, x, 221, c::YELLOW, &o);
        x += text_width(&a, &o);
        draw_text(fb, &pad6(s.score), x, 221, c::WHITE, &o);
        x += text_width(&pad6(s.score), &o) + 14;
        draw_text(fb, &b, x, 221, c::CYAN, &o);
        x += text_width(&b, &o);
        draw_text(fb, &pad6(s.hi_score), x, 221, c::WHITE, &o);
        if s.new_record && blink_on(s.frame, 30, 20) {
            draw_text(fb, g.new_record, W / 2, 231, c::YELLOW, &TextOpts::default().align(Align::Center));
        }
    }
}
