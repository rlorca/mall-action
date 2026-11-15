//! The game context: everything the shell owns besides the Bevy world. Lives in a thread-local because the
//! wasm build is single-threaded and the debug hooks exported to JS must reach the same state as the systems.

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mall_core::art;
use mall_core::audio::Synth;
use mall_core::fixed::FixedStep;
use mall_core::game::{Game, GameOptions};
use mall_core::input::{self, HostKey, InputMapper, PadState};
use mall_core::pixel::{pal, Fb};

use crate::audio::SAMPLE_RATE;
use crate::web::{self, Params};

pub struct Ctx {
    pub game: Game,
    pub input: InputMapper,
    pub fixed: FixedStep,
    pub fb: Fb,
    pub synth: Arc<Mutex<Synth>>,
    pub muted: Arc<AtomicBool>,
    pub crt: bool,
    pub params: Params,
    /// "CRT ON" / "SOUND OFF" confirmation: text and frames left.
    pub toast: Option<(String, u32)>,
    /// Debug stepping (via `mallDebug.step`) suspends real time until `resume`.
    pub realtime: bool,
    pub debug_held: u8,
    pub gallery_page: usize,
    pub gallery_tick: u32,
    pub frame: u64,
    /// Set when the framebuffer must be re-uploaded.
    pub dirty: bool,
    /// The user has interacted (browsers allow audio now).
    pub interacted: bool,
}

thread_local! {
    static CTX: RefCell<Option<Ctx>> = const { RefCell::new(None) };
}

pub fn with<R>(f: impl FnOnce(&mut Ctx) -> R) -> Option<R> {
    CTX.with(|c| c.borrow_mut().as_mut().map(f))
}

pub fn install(params: Params) {
    let seed = params.seed.unwrap_or(if params.debug { 1 } else { web::now_seed() });
    let game = Game::new(seed, GameOptions { skip_splash: params.debug });
    let ctx = Ctx {
        game,
        input: InputMapper::new(),
        fixed: FixedStep::new(),
        fb: Fb::new(),
        synth: Arc::new(Mutex::new(Synth::new(SAMPLE_RATE))),
        muted: Arc::new(AtomicBool::new(false)),
        crt: web::load_crt(),
        params,
        toast: None,
        realtime: true,
        debug_held: 0,
        gallery_page: 0,
        gallery_tick: 0,
        frame: 0,
        dirty: true,
        interacted: false,
    };
    CTX.with(|c| *c.borrow_mut() = Some(ctx));
}

impl Ctx {
    pub fn toast(&mut self, s: &str) {
        self.toast = Some((s.to_string(), 90));
        self.dirty = true;
    }

    pub fn host_key(&mut self, k: HostKey) {
        match k {
            HostKey::ToggleCrt => {
                self.crt = !self.crt;
                web::save_crt(self.crt);
                self.toast(if self.crt { "CRT ON" } else { "CRT OFF" });
            }
            HostKey::ToggleMute => {
                let m = !self.muted.load(Ordering::Relaxed);
                self.muted.store(m, Ordering::Relaxed);
                self.toast(if m { "SOUND OFF" } else { "SOUND ON" });
            }
        }
    }

    /// Run exactly one 60 Hz simulation step with `pad`, forwarding the game's events to the synth.
    pub fn sim_step(&mut self, pad: PadState) {
        self.frame += 1;
        if self.params.gallery {
            self.gallery_tick += 1;
            if pad.just_pressed(input::RIGHT) || pad.just_pressed(input::B) || pad.just_pressed(input::START) {
                self.gallery_page += 1;
            }
            if pad.just_pressed(input::LEFT) {
                self.gallery_page = self.gallery_page.saturating_sub(1);
            }
        } else {
            self.game.step(pad);
            let events = self.game.drain_events();
            if !events.is_empty() {
                if let Ok(mut s) = self.synth.lock() {
                    for e in &events {
                        s.apply(e);
                    }
                }
            }
        }
        if let Some((_, n)) = &mut self.toast {
            *n = n.saturating_sub(1);
            if *n == 0 {
                self.toast = None;
            }
        }
        self.dirty = true;
    }

    /// Paint the current frame (game + toast) into the framebuffer.
    pub fn render(&mut self) {
        if self.params.gallery {
            let pages = art::gallery::draw(&mut self.fb, self.gallery_page, self.gallery_tick);
            if pages > 0 && self.gallery_page >= pages {
                self.gallery_page %= pages;
            }
        } else {
            self.game.draw(&mut self.fb);
        }
        if let Some((text, _)) = &self.toast {
            let w = mall_core::pixel::text_width(mall_core::pixel::FontKind::Normal, text) + 12;
            let x = (256 - w) / 2;
            self.fb.rect(x, 214, w, 15, pal::BLACK);
            self.fb.frame(x, 214, w, 15, pal::WHITE);
            self.fb.text_center(128, 218, text, pal::WHITE);
        }
        self.dirty = false;
    }
}
