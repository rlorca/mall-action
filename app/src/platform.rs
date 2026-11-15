//! Browser glue (see web/mall_plugin.js): gamepad, URL options, localStorage, debug hooks.
//! On native builds these are inert stand-ins so the same code runs in `cargo run`.
use mall_core::game::{Game, Overlay, Scene};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::Relaxed};

#[cfg(target_arch = "wasm32")]
extern "C" {
    fn mall_gamepad_mask() -> u32;
    fn mall_focus_lost() -> u32;
    fn mall_param_seed() -> f64;
    fn mall_param_flag(i: i32) -> i32;
    fn mall_storage_get(i: i32) -> i32;
    fn mall_storage_set(i: i32, v: i32);
}

pub fn gamepad_mask() -> u8 {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        return mall_gamepad_mask() as u8;
    }
    #[cfg(not(target_arch = "wasm32"))]
    0
}
pub fn focus_lost() -> u32 {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        return mall_focus_lost();
    }
    #[cfg(not(target_arch = "wasm32"))]
    0
}
pub fn param_seed() -> Option<u64> {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        let s = mall_param_seed();
        return if s >= 0.0 { Some(s as u64) } else { None };
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::env::var("SEED").ok().and_then(|s| s.parse().ok())
    }
}
/// 0 = debug, 1 = gallery
pub fn flag(i: i32) -> bool {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        return mall_param_flag(i) != 0;
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::env::var(if i == 0 { "DEBUG" } else { "GALLERY" }).is_ok()
    }
}
pub fn storage_get(i: i32) -> Option<i32> {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        let v = mall_storage_get(i);
        return if v >= 0 { Some(v) } else { None };
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = i;
        None
    }
}
pub fn storage_set(i: i32, v: i32) {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        mall_storage_set(i, v);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = (i, v);
    }
}

// ---- debug hooks (?debug=1): exported to JS as window.mallDebug ----
static STEP_N: AtomicU32 = AtomicU32::new(0);
static STEP_MASK: AtomicU32 = AtomicU32::new(0);
static SNAP: [AtomicU32; 20] = [const { AtomicU32::new(0) }; 20];

/// Step the game `n` frames with the buttons in `mask` held (picked up on the next rendered frame).
#[no_mangle]
pub extern "C" fn mall_debug_step(n: u32, mask: u32) {
    STEP_N.store(n, Relaxed);
    STEP_MASK.store(mask, Relaxed);
    // from now on the game only advances when stepped (deterministic playtests)
    MANUAL.store(true, Relaxed);
}
/// Resume real-time simulation after manual stepping.
#[no_mangle]
pub extern "C" fn mall_debug_resume() {
    MANUAL.store(false, Relaxed);
}
static MANUAL: AtomicBool = AtomicBool::new(false);
/// True once a debug step was requested: real-time stepping is suspended.
pub fn manual_mode() -> bool {
    MANUAL.load(Relaxed)
}
/// Read a field of the game context snapshot (see `fields` in web/mall_plugin.js).
#[no_mangle]
pub extern "C" fn mall_debug_get(i: u32) -> f64 {
    SNAP.get(i as usize).map(|v| v.load(Relaxed) as i32 as f64).unwrap_or(0.0)
}
#[no_mangle]
pub extern "C" fn mall_plugin_crate_version() -> u32 {
    1
}

pub fn debug_take_steps() -> Option<(u32, u8)> {
    let n = STEP_N.swap(0, Relaxed);
    if n == 0 {
        None
    } else {
        Some((n, STEP_MASK.load(Relaxed) as u8))
    }
}

pub fn debug_publish(g: &Game, crt: bool, muted: bool) {
    let scene = match g.scene {
        Scene::Splash => 0,
        Scene::Title => 1,
        Scene::Mall => 2,
        Scene::Store => 3,
        Scene::Clear(_) => 4,
        Scene::Continue { .. } => 5,
        Scene::GameOver { .. } => 6,
    };
    let overlay = match g.overlay {
        Overlay::None => 0,
        Overlay::Map => 1,
        Overlay::Pause => 2,
    };
    let pst = match g.mall.p.st {
        mall_core::game::mall::PState::Walk => 0,
        mall_core::game::mall::PState::Inside(_) => 1,
        mall_core::game::mall::PState::Roof(_) => 2,
        mall_core::game::mall::PState::Esc { .. } => 3,
        mall_core::game::mall::PState::Fall { .. } => 4,
        mall_core::game::mall::PState::Dying(_) => 5,
        mall_core::game::mall::PState::Hidden(_) => 6,
        _ => 7,
    };
    let vals: [i32; 20] = [
        scene,
        g.s.score,
        g.s.lives,
        g.s.packages as i32,
        g.s.loop_n as i32,
        g.mall.p.x as i32,
        g.mall.player_floor() as i32,
        g.mall.feet_y() as i32,
        overlay,
        g.frame as i32,
        g.mall.t,
        g.mall.live_spies() as i32,
        g.mall.alarm as i32,
        g.cur_store.map(|s| mall_core::stores::index(s) as i32).unwrap_or(-1),
        crt as i32,
        muted as i32,
        pst,
        g.mall.bullets.len() as i32,
        g.mall.coins.len() as i32,
        g.mall.banner.is_some() as i32,
    ];
    for (i, v) in vals.iter().enumerate() {
        SNAP[i].store(*v as u32, Relaxed);
    }
}
