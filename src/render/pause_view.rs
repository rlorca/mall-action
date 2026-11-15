use super::screen_fx::{blink_on, H, W};
use crate::content::copy::UI;
use crate::engine::font::{draw_text, text_width, Align, TextOpts};
use crate::engine::framebuffer::Framebuffer;
use crate::engine::palette::c;

/// Dim steps applied to the frozen game picture behind the PAUSE plate.
pub const PAUSE_DIM_STEPS: i32 = 2;

/// Pause overlay: the whole screen is dimmed (NES-style luminance steps) and a framed PAUSE blinks in the
/// middle. Draw it on top of the frozen game picture; `frame` is any ever-increasing frame counter.
pub fn draw_pause_overlay(fb: &mut Framebuffer, frame: i32) {
    fb.darken_all(PAUSE_DIM_STEPS);
    if !blink_on(frame, 60, 40) {
        return;
    }
    let scale = 3;
    let tw = text_width(UI.pause, &TextOpts::default().scale(scale));
    let w = tw + 24;
    let h = 7 * scale + 18;
    let x = (W - w).div_euclid(2);
    let y = (H - h).div_euclid(2);
    fb.fill_rect(x, y, w, h, c::BLACK);
    fb.stroke_rect(x, y, w, h, c::WHITE);
    fb.stroke_rect(x + 3, y + 3, w - 6, h - 6, c::MDGRAY);
    draw_text(fb, UI.pause, W / 2, y + 9, c::WHITE, &TextOpts::default().scale(scale).shadow(c::GRAY).align(Align::Center));
}
