//! Playtest hooks exported to JavaScript (wasm only). `index.html` exposes them as `window.mallDebug`
//! when the page is opened with `?debug=1`.

use mall_core::input::PadState;
use wasm_bindgen::prelude::*;

use crate::ctx;

fn enabled() -> bool {
    ctx::with(|c| c.params.debug).unwrap_or(false)
}

/// Step the game `frames` frames with the buttons in `held` (bit order: UP DOWN LEFT RIGHT A B SELECT START)
/// held the whole time. The first call suspends real time; call `mall_resume` to go back to live play.
#[wasm_bindgen]
pub fn mall_step(frames: u32, held: u32) -> String {
    if !enabled() {
        return "debug off".into();
    }
    ctx::with(|c| {
        c.realtime = false;
        for _ in 0..frames {
            let pad = PadState::from_held(c.debug_held, held as u8);
            c.debug_held = held as u8;
            c.sim_step(pad);
        }
        c.render();
        c.game.debug_state()
    })
    .unwrap_or_default()
}

#[wasm_bindgen]
pub fn mall_resume() {
    ctx::with(|c| {
        c.realtime = true;
        c.debug_held = 0;
    });
}

#[wasm_bindgen]
pub fn mall_state() -> String {
    ctx::with(|c| c.game.debug_state()).unwrap_or_default()
}

#[wasm_bindgen]
pub fn mall_cmd(cmd: &str) -> String {
    if !enabled() {
        return "debug off".into();
    }
    ctx::with(|c| {
        let r = c.game.debug_cmd(cmd);
        c.render();
        r
    })
    .unwrap_or_default()
}

/// FNV-1a hash of the current framebuffer (cheap "did the picture change" check).
#[wasm_bindgen]
pub fn mall_fb_hash() -> u32 {
    ctx::with(|c| {
        let mut h: u32 = 2166136261;
        for &p in &c.fb.px {
            h ^= p as u32;
            h = h.wrapping_mul(16777619);
        }
        h
    })
    .unwrap_or(0)
}

#[wasm_bindgen]
pub fn mall_crt() -> bool {
    ctx::with(|c| c.crt).unwrap_or(false)
}
