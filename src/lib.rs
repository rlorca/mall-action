//! MALL ACTION: Rust core compiled to WebAssembly. A faithful port of the TypeScript implementation; see PORTING.md.
//!
//! The module tree mirrors the TypeScript tree. This file is only the raw wasm ABI (no wasm-bindgen): the browser shell
//! (`browser.js`) hands in input edges, reads the RGBA framebuffer, and drains sound requests. No game rules live here.
pub mod art;
pub mod audio_ids;
pub mod content;
pub mod engine;
pub mod flickersoft;
pub mod game;
pub mod render;

use engine::framebuffer::Framebuffer;
use engine::pad::Pad;
use game::game::{Game, GameOptions};
use render::gallery::Gallery;
use render::osd::{osd_text, Osd};
use std::cell::RefCell;

struct Runtime {
    game: Game,
    gallery: Option<Gallery>,
    osd: Osd,
    fb: Framebuffer,
    rgba: Vec<u8>,
    sfx: std::collections::VecDeque<u32>,
    json: String,
}

thread_local! { static RUNTIME: RefCell<Option<Runtime>> = const { RefCell::new(None) }; }

fn with<R>(f: impl FnOnce(&mut Runtime) -> R) -> R {
    RUNTIME.with(|c| f(c.borrow_mut().as_mut().expect("init() not called")))
}

/// flags: 1 debug (skips the splash), 2 gallery, 4 autostart (?start=1), 8 skip the arrival (?skipintro=1).
#[no_mangle]
pub extern "C" fn init(seed: u32, flags: u32) {
    art::init();
    let game = Game::new(GameOptions {
        seed,
        skip_splash: flags & 1 != 0,
        autostart: flags & 4 != 0,
        skip_intro: flags & 8 != 0,
        black_friday: false,
        hi_score: 0,
    });
    RUNTIME.with(|c| {
        *c.borrow_mut() = Some(Runtime {
            game,
            gallery: if flags & 2 != 0 { Some(Gallery::new()) } else { None },
            osd: Osd::new(),
            fb: Framebuffer::new(),
            rgba: vec![0; 256 * 240 * 4],
            sfx: Default::default(),
            json: String::new(),
        })
    });
}

/// Advance one 60 Hz step with the given button masks (bits as in `engine::pad`).
#[no_mangle]
pub extern "C" fn tick(held: u32, pressed: u32, released: u32) {
    with(|r| {
        let pad = Pad { held, pressed, released };
        if let Some(g) = r.gallery.as_mut() {
            g.step(&pad);
            return;
        }
        r.game.step(pad);
        for s in r.game.drain_sfx() {
            r.sfx.push_back(s.index() as u32 + 1);
        }
    })
}

/// Next requested sound effect as `index + 1` into `SFX_IDS`, or 0 when the queue is empty.
#[no_mangle]
pub extern "C" fn sfx_next() -> u32 {
    with(|r| r.sfx.pop_front().unwrap_or(0))
}

/// Music the current scene wants: `index + 1` into `MUSIC_IDS`, 0 for silence.
#[no_mangle]
pub extern "C" fn music() -> u32 {
    with(|r| if r.gallery.is_some() { 0 } else { r.game.music().map_or(0, |m| m.index() as u32 + 1) })
}

#[no_mangle]
pub extern "C" fn duck() -> u32 {
    with(|r| (r.gallery.is_none() && r.game.duck()) as u32)
}

/// Show an on-screen confirmation (1 CRT ON, 2 CRT OFF, 3 SOUND ON, 4 SOUND OFF, 5 GAMEPAD ON, 6 GAMEPAD OFF).
#[no_mangle]
pub extern "C" fn osd_show(kind: u32) {
    with(|r| r.osd.show(osd_text(kind), 100))
}

/// The OSD times out in rendered frames (presentation, not game time).
#[no_mangle]
pub extern "C" fn osd_tick() {
    with(|r| r.osd.tick())
}

/// Render the current state (plus OSD) and return a pointer to 256x240 RGBA bytes in wasm memory.
/// The pointer stays valid until the next call; refresh typed-array views after any call (memory may grow).
#[no_mangle]
pub extern "C" fn draw() -> *const u8 {
    with(|r| {
        match r.gallery.as_ref() {
            Some(g) => g.draw(&mut r.fb),
            None => render::game_view::render_game(&mut r.fb, &r.game),
        }
        r.osd.draw(&mut r.fb);
        r.fb.to_rgba(&mut r.rgba);
        r.rgba.as_ptr()
    })
}

/// ?debug=1: a JSON summary of the game state (pointer + length of UTF-8 bytes).
#[no_mangle]
pub extern "C" fn state_json() -> *const u8 {
    with(|r| {
        r.json = game::debug::summary_json(&r.game);
        r.json.as_ptr()
    })
}

#[no_mangle]
pub extern "C" fn state_json_len() -> u32 {
    with(|r| r.json.len() as u32)
}
