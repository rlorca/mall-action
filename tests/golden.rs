//! Replays the golden traces produced by `scripts/trace.ts` from the TypeScript game and requires the Rust port
//! to match frame for frame: scene, music, framebuffer hash and sound effects at every recorded step.
use mall_action::engine::framebuffer::Framebuffer;
use mall_action::engine::pad::{self, pad_from_held};
use mall_action::game::game::{Game, GameOptions};
use mall_action::render::game_view::render_game;

const MASKS: [u32; 16] = [
    0, pad::RIGHT, pad::LEFT, pad::RIGHT | pad::B, pad::LEFT | pad::B, pad::A, pad::RIGHT | pad::A, pad::UP, pad::DOWN, pad::B,
    pad::UP | pad::RIGHT, pad::DOWN | pad::RIGHT, pad::START, pad::SELECT, pad::A | pad::B, 0,
];

struct Scn { name: &'static str, seed: u32, skip_splash: bool, autostart: bool, skip_intro: bool, black_friday: bool, frames: u32, input_seed: u32, start_at: u32 }
const SCN: [Scn; 5] = [
    Scn { name: "splash", seed: 99, skip_splash: false, autostart: false, skip_intro: false, black_friday: false, frames: 700, input_seed: 5, start_at: 400 },
    Scn { name: "title-run", seed: 7, skip_splash: true, autostart: false, skip_intro: false, black_friday: false, frames: 4000, input_seed: 11, start_at: 10 },
    Scn { name: "auto", seed: 1234, skip_splash: false, autostart: true, skip_intro: true, black_friday: false, frames: 5000, input_seed: 23, start_at: 0 },
    Scn { name: "auto-intro", seed: 42, skip_splash: false, autostart: true, skip_intro: false, black_friday: false, frames: 3000, input_seed: 31, start_at: 0 },
    Scn { name: "bf", seed: 3, skip_splash: false, autostart: true, skip_intro: true, black_friday: true, frames: 4000, input_seed: 47, start_at: 0 },
];

/// The fixture is `{"name":[row,...],\n"name":[...]}` with rows like `9 splash null 3741221751 []`.
fn fixture_rows(name: &str) -> Vec<String> {
    let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/golden-trace.json")).unwrap();
    let key = format!("\"{}\":[", name);
    let start = text.find(&key).expect("scenario in fixture") + key.len();
    let end = start + text[start..].find(']').map(|_| 0).unwrap();
    let _ = end;
    let mut rows = Vec::new();
    let mut rest = &text[start..];
    // rows are JSON strings; scan quoted strings until the closing `]` that follows a closing quote
    loop {
        rest = rest.trim_start_matches(|c| c == ',' || c == ' ');
        if !rest.starts_with('"') { break; }
        let body = &rest[1..];
        let close = body.find('"').unwrap();
        rows.push(body[..close].to_string());
        rest = &body[close + 1..];
    }
    rows
}

fn run(s: &Scn) {
    let want = fixture_rows(s.name);
    let mut g = Game::new(GameOptions { seed: s.seed, skip_splash: s.skip_splash, autostart: s.autostart, skip_intro: s.skip_intro, black_friday: s.black_friday, hi_score: 0 });
    let mut fb = Framebuffer::new();
    let (mut held, mut prev, mut lcg) = (0u32, 0u32, s.input_seed);
    let mut got: Vec<String> = Vec::new();
    for f in 0..s.frames {
        if f % 15 == 0 {
            lcg = lcg.wrapping_mul(1664525).wrapping_add(1013904223);
            held = MASKS[((lcg >> 16) % 16) as usize];
        }
        let mut m = held;
        if f == s.start_at && s.start_at > 0 { m = pad::START } else if m & pad::START != 0 && f % 15 != 0 { m &= !pad::START }
        if s.name == "splash" && f < s.start_at { m = 0 }
        g.step(pad_from_held(prev, m));
        prev = m;
        let sfx = g.drain_sfx();
        if f % 10 == 9 || !sfx.is_empty() {
            render_game(&mut fb, &g);
            let music = g.music().map(|m| m.as_str()).unwrap_or("null");
            let ids: Vec<&str> = sfx.iter().map(|s| s.as_str()).collect();
            got.push(format!("{} {} {} {} [{}]", f, g.scene.as_str(), music, fb.hash(), ids.join(",")));
        }
    }
    for (i, (a, b)) in got.iter().zip(want.iter()).enumerate() {
        assert_eq!(a, b, "{}: first divergence at recorded row {} (TS = right)", s.name, i);
    }
    assert_eq!(got.len(), want.len(), "{}: row count", s.name);
}

#[test] fn golden_splash() { run(&SCN[0]) }
#[test] fn golden_title_run() { run(&SCN[1]) }
#[test] fn golden_auto() { run(&SCN[2]) }
#[test] fn golden_auto_intro() { run(&SCN[3]) }
#[test] fn golden_black_friday() { run(&SCN[4]) }
