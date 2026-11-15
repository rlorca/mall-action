//! Dev tool for the screens agent 1 screens.
//!   cargo run -p mall-core --example shot_screens1 -- <what>:<frame> <out.png> [scale]
//! what: splash | spy-roof | spy-getaway | title | clear | continue | gameover

use mall_core::copy::{ARRIVAL_POSTS, CLEAR_POSTS};
use mall_core::events::Out;
use mall_core::input::PadState;
use mall_core::pixel::{pal, Fb};
use mall_core::png;
use mall_core::screens::continue_screen::ContinueScreen;
use mall_core::screens::game_over::GameOver;
use mall_core::screens::level_clear::LevelClear;
use mall_core::screens::spygram::{draw_card, Photo};
use mall_core::screens::splash::SplashScreen;
use mall_core::screens::title::Title;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let what = args.get(1).map(String::as_str).unwrap_or("title:60");
    let out = args.get(2).map(String::as_str).unwrap_or("shot.png");
    let scale: usize = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(3);
    let (kind, n) = match what.split_once(':') {
        Some((k, n)) => (k, n.parse::<u32>().unwrap_or(0)),
        None => (what, 0),
    };
    let pad = PadState::default();
    let mut o = Out::new();
    let mut fb = Fb::new();
    match kind {
        "splash" => {
            let mut s = SplashScreen::new();
            for _ in 0..n {
                s.step(pad, &mut o);
            }
            s.draw(&mut fb);
        }
        "spy-roof" | "spy-getaway" => {
            fb.clear(pal::DBLUE);
            let photo = if kind == "spy-roof" { Photo::Roof } else { Photo::Getaway };
            draw_card(&mut fb, 44, 36, &CLEAR_POSTS[4], photo, n);
            let _ = ARRIVAL_POSTS.len();
        }
        "title" => {
            let mut s = Title::new(12345);
            for _ in 0..n {
                s.step(pad, &mut o);
            }
            s.draw(&mut fb);
        }
        "clear" => {
            let mut s = LevelClear::new(6, 2350, 1000, 1, 7);
            for _ in 0..n {
                s.step(pad, &mut o);
            }
            s.draw(&mut fb);
        }
        "continue" => {
            let mut s = ContinueScreen::new(2);
            for _ in 0..n {
                s.step(pad, &mut o);
            }
            s.draw(&mut fb);
        }
        "gameover" => {
            let mut s = GameOver::new(48250, 62000);
            for _ in 0..n {
                s.step(pad, &mut o);
            }
            s.draw(&mut fb, None);
        }
        _ => eprintln!("unknown shot kind {what}"),
    }
    png::save_fb(out, &fb, scale);
    eprintln!("wrote {out}");
}
