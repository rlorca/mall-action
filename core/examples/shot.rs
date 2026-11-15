//! Dev tool: render scenarios to PNG. `cargo run -p mall-core --example shot -- <scenario> <out.png>`
use mall_core::game::mall::*;
use mall_core::game::*;
use mall_core::input::*;
use mall_core::pixel::{encode_png, Canvas};
use mall_core::render::Renderer;
use mall_core::stores::StoreId;

fn run(g: &mut Game, pad: &mut Pad, held: u8, n: usize) {
    for _ in 0..n {
        pad.set_gamepad(held);
        let ps = pad.begin_step();
        g.step(ps);
    }
}
fn tap(g: &mut Game, pad: &mut Pad, b: u8) {
    run(g, pad, b, 2);
    run(g, pad, 0, 2);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let scenario = args.get(1).map(|s| s.as_str()).unwrap_or("title");
    let out = args.get(2).cloned().unwrap_or("/tmp/shot.png".into());
    let mut g = Game::new(7, true);
    let mut pad = Pad::new();
    let r = Renderer::new();
    let mut cv = Canvas::new(256, 240);
    match scenario {
        "splash" => {
            g = Game::new(7, false);
            run(&mut g, &mut pad, 0, 80);
        }
        "title" => run(&mut g, &mut pad, 0, 60),
        "title_bf" => {
            for b in [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A] {
                tap(&mut g, &mut pad, b);
            }
        }
        "zip" | "selfie" | "mall" | "walk" => {
            run(&mut g, &mut pad, 0, 20);
            tap(&mut g, &mut pad, START);
            run(&mut g, &mut pad, 0, 40);
            match scenario {
                "zip" => run(&mut g, &mut pad, 0, 90),
                "selfie" => run(&mut g, &mut pad, 0, 220),
                _ => {
                    run(&mut g, &mut pad, 0, 400);
                    tap(&mut g, &mut pad, B);
                }
            }
        }
        "f4" | "f2" | "f3" | "f1" | "p" | "elev" | "map" | "pause" | "store" | "package" | "clear" | "continue" | "gameover" | "wet" => {
            run(&mut g, &mut pad, 0, 20);
            tap(&mut g, &mut pad, START);
            run(&mut g, &mut pad, 0, 40);
            run(&mut g, &mut pad, 0, 400);
            let fl = match scenario {
                "f4" | "elev" => 4,
                "f3" => 3,
                "f2" => 2,
                "f1" | "wet" => 1,
                "p" | "clear" => 0,
                _ => 4,
            };
            g.mall.p.floor = fl;
            g.mall.p.x = if scenario == "wet" { 500.0 } else { 120.0 };
            g.mall.control = true;
            match scenario {
                "map" => {
                    tap(&mut g, &mut pad, SELECT);
                }
                "pause" => tap(&mut g, &mut pad, START),
                "store" | "package" => {
                    g.mall.p.floor = 3;
                    let slot = mall_core::game::level::slot(StoreId::KgbToys);
                    g.mall.p.x = slot.door_x() as f32;
                    tap(&mut g, &mut pad, UP);
                    run(&mut g, &mut pad, 0, 60);
                    run(&mut g, &mut pad, UP, 30);
                }
                "clear" => {
                    g.s.packages = 6;
                    g.mall.p.x = 560.0;
                    tap(&mut g, &mut pad, UP);
                    run(&mut g, &mut pad, 0, 100);
                }
                "continue" => {
                    g.s.lives = 1;
                    g.mall.kill_player(Cause::Crush);
                    run(&mut g, &mut pad, 0, 140);
                }
                "gameover" => {
                    g.s.lives = 1;
                    g.s.continues = 0;
                    g.mall.kill_player(Cause::Crush);
                    run(&mut g, &mut pad, 0, 100 + 380);
                }
                _ => run(&mut g, &mut pad, 0, 30),
            }
        }
        _ => {}
    }
    if let Some(n) = args.get(3).and_then(|s| s.parse::<usize>().ok()) {
        run(&mut g, &mut pad, 0, n);
    }
    r.render(&g, &mut cv);
    std::fs::write(&out, encode_png(256, 240, &cv.data, 3)).unwrap();
    eprintln!("wrote {out}");
}
