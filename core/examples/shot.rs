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
        "combat" | "elevride" | "wet2" | "kiosk" | "alarm" | "disco" | "f4" | "f2" | "f3" | "f1" | "p" | "elev" | "map" | "pause" | "store" | "package" | "clear" | "continue" | "gameover" | "wet" => {
            run(&mut g, &mut pad, 0, 20);
            tap(&mut g, &mut pad, START);
            run(&mut g, &mut pad, 0, 40);
            run(&mut g, &mut pad, 0, 400);
            let fl = match scenario {
                "combat" | "kiosk" | "alarm" => 4,
                "elevride" => 3,
                "wet2" => 1,
                "disco" => 2,
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
                "combat" => {
                    g.mall.p.x = 190.0;
                    g.mall.spies.push(Spy { x: 232.0, floor: 4, dir: -1, st: SpyState::Aim(10, true), age: 200, cd: 0, walk_t: 100, goal: None, last_volley: 0, anim: 0 });
                    g.mall.spies.push(Spy { x: 140.0, floor: 4, dir: 1, st: SpyState::Dying(14), age: 200, cd: 0, walk_t: 100, goal: None, last_volley: 0, anim: 0 });
                    g.mall.bullets.push(Bullet { x: 210.0, y: 160.0, vx: -2.0, vy: 0.0, floor: 4, hostile: true, volley: 0 });
                    g.mall.popups.push(Popup { x: 140.0, y: 140.0, text: "100".into(), t: 40 });
                    g.mall.bubbles.push(Bubble { x: 140.0, y: 146.0, text: "NOT THE FACE!".into(), t: 60 });
                    g.mall.p.face = 1;
                    g.powers.grant(mall_core::game::powerups::PowerKind::Rapid);
                    g.powers.grant(mall_core::game::powerups::PowerKind::Armor);
                    run(&mut g, &mut pad, A, 3);
                }
                "elevride" => {
                    g.mall.cars[1] = mall_core::game::elevator::Car::new(mall_core::game::level::SHAFTS[1], 3);
                    g.mall.p.x = 384.0;
                    g.mall.p.st = PState::Inside(1);
                    g.mall.set_banner(vec!["3F - TOYS & VIDEO, SPIES".into()], 100, false);
                }
                "wet2" => {
                    g.mall.wet = Some(Wet { cx: 560.0, t: 600 });
                    g.mall.janitor.x = 600.0;
                    g.mall.p.x = 540.0;
                    run(&mut g, &mut pad, RIGHT, 12);
                }
                "kiosk" => {
                    g.mall.p.x = 292.0;
                    tap(&mut g, &mut pad, UP);
                }
                "alarm" => {
                    g.mall.alarm_at = 1;
                    run(&mut g, &mut pad, 0, 20);
                    g.mall.p.x = 480.0;
                }
                "disco" => {
                    g.mall.p.x = 300.0;
                    g.mall.p.face = 1;
                    run(&mut g, &mut pad, A, 40);
                    run(&mut g, &mut pad, 0, 40);
                }
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
    let scale = std::env::var("SCALE").ok().and_then(|s| s.parse().ok()).unwrap_or(3);
    std::fs::write(&out, encode_png(256, 240, &cv.data, scale)).unwrap();
    eprintln!("wrote {out}");
}
