//! Browser glue: query-string options and the persisted CRT setting. Native fallbacks keep `cargo check` honest.

pub use mall_core::query::{parse_query, Params};

#[cfg(target_arch = "wasm32")]
pub fn params() -> Params {
    let q = web_sys::window().and_then(|w| w.location().search().ok()).unwrap_or_default();
    parse_query(&q)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn params() -> Params {
    let q = std::env::var("MALL_QUERY").unwrap_or_default();
    parse_query(&q)
}

#[cfg(target_arch = "wasm32")]
pub fn now_seed() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_seed() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(1)
}

const CRT_KEY: &str = "mall-action.crt";

/// CRT effect is ON by default; the choice persists across visits.
#[cfg(target_arch = "wasm32")]
pub fn load_crt() -> bool {
    web_sys::window()
        .and_then(|w| w.local_storage().ok().flatten())
        .and_then(|s| s.get_item(CRT_KEY).ok().flatten())
        .map(|v| v != "0")
        .unwrap_or(true)
}

#[cfg(target_arch = "wasm32")]
pub fn save_crt(on: bool) {
    if let Some(s) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
        let _ = s.set_item(CRT_KEY, if on { "1" } else { "0" });
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn load_crt() -> bool {
    true
}

#[cfg(not(target_arch = "wasm32"))]
pub fn save_crt(_on: bool) {}
