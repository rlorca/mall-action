use super::screen_fx::{blink_on, H, W};
use crate::content::copy::{continues_left, UI};
use crate::engine::font::{draw_text, Align, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::screens::r#continue::{ContinueScreen, CONTINUE_FRAMES_PER_COUNT, CONTINUE_SECONDS};

/// What the view reads from the ContinueScreen.
#[derive(Clone, Copy, Debug)]
pub struct ContinueViewState {
    pub count: i32,
    /// Frame inside the current second, 0..59.
    pub tick: i32,
    pub urgent: bool,
    pub continues_left: i32,
    pub frame: i32,
}

impl From<&ContinueScreen> for ContinueViewState {
    fn from(s: &ContinueScreen) -> Self {
        ContinueViewState { count: s.count(), tick: s.tick(), urgent: s.urgent(), continues_left: s.continues_left, frame: s.frame() }
    }
}

const CX: i32 = W / 2;
const CY: i32 = 122;

/// A ring that unwinds once per second (clockwise from the top).
fn draw_ring(fb: &mut Framebuffer, remaining: f64, color: u8) {
    let r = 62.0;
    let steps = 180;
    for i in 0..steps {
        if i as f64 / steps as f64 > remaining {
            break;
        }
        let a = -std::f64::consts::PI / 2.0 + (i as f64 / steps as f64) * std::f64::consts::PI * 2.0;
        fb.fill_rect(round_i(CX as f64 + a.cos() * r), round_i(CY as f64 + a.sin() * r), 3, 3, color);
    }
}

pub fn draw_continue(fb: &mut Framebuffer, s: &ContinueViewState) {
    fb.clear(c::BLACK);
    // faint perspective grid so the screen is not an empty void
    let mut y = 0;
    while y < H {
        fb.h_line(0, y, W, c::DKBLUE);
        y += 16;
    }
    let mut x = 0;
    while x < W {
        fb.v_line(x, 0, H, c::DKBLUE);
        x += 16;
    }
    fb.fill_rect(0, 0, W, 40, c::BLACK);
    fb.fill_rect(0, 196, W, 44, c::BLACK);

    draw_text(fb, UI.continue_q, CX, 14, c::WHITE, &TextOpts::default().scale(3).align(Align::Center).shadow(c::INDIGO));

    let col = if s.urgent {
        if blink_on(s.frame, 16, 10) {
            c::RED
        } else {
            c::SALMON
        }
    } else {
        c::YELLOW
    };
    let flash = if s.tick < 5 { c::WHITE } else { col };
    draw_ring(fb, 1.0 - s.tick as f64 / CONTINUE_FRAMES_PER_COUNT as f64, if s.urgent { c::RED } else { c::CYAN });
    let digit = s.count.max(0).to_string();
    let scale: i32 = 12;
    let dy = CY - (7 * scale).div_euclid(2);
    let big = TextOpts::default().scale(scale).align(Align::Center);
    draw_text(fb, &digit, CX + 5, dy + 5, if s.urgent { c::MAROON } else { c::DKBLUE }, &big);
    draw_text(fb, &digit, CX, dy, flash, &big);

    draw_text(fb, &continues_left(s.continues_left), CX, 196, c::PALEYELLOW, &TextOpts::default().align(Align::Center).shadow(c::BLACK));
    if blink_on(s.frame, 50, 32) {
        draw_text(fb, UI.press_start, CX, 212, c::WHITE, &TextOpts::default().scale(2).align(Align::Center).shadow(c::GRAY));
    }

    // time bar for the whole countdown
    let total = CONTINUE_SECONDS * CONTINUE_FRAMES_PER_COUNT;
    let left = (s.count * CONTINUE_FRAMES_PER_COUNT - s.tick).max(0);
    fb.fill_rect(16, 234, W - 32, 3, c::MDGRAY);
    let w = round_i(((W - 32) * left) as f64 / total as f64);
    if w > 0 {
        fb.fill_rect(16, 234, w, 3, if s.urgent { c::RED } else { c::CYAN });
    }
}
