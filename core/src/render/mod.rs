//! Software renderer: draws the game state onto a 256x240 canvas. Reads state, never changes rules.
use crate::art::Sprites;
use crate::font::*;
use crate::game::{Game, Overlay, Scene};
use crate::pixel::{c, Canvas, Sprite};

mod gallery;
mod hud;
mod map;
pub mod mall_view;
mod screens;
mod store_view;

pub const SCREEN_W: usize = 256;
pub const SCREEN_H: usize = 240;
pub const HUD_H: i32 = 16;

pub struct Renderer {
    pub sprites: Sprites,
}

impl Renderer {
    pub fn new() -> Renderer {
        Renderer { sprites: Sprites::new() }
    }
    pub fn new_canvas() -> Canvas {
        Canvas::new(SCREEN_W, SCREEN_H)
    }
    pub(crate) fn spr(&self, name: &str) -> &Sprite {
        self.sprites.get(name)
    }

    pub fn render(&self, g: &Game, cv: &mut Canvas) {
        cv.reset_clip();
        match &g.scene {
            Scene::Splash => g.splash.draw(cv),
            Scene::Title => self.draw_title(g, cv),
            Scene::Mall => {
                self.draw_mall(g, cv);
                self.draw_hud(g, cv);
                self.draw_overlay(g, cv);
            }
            Scene::Store => {
                self.draw_store(g, cv);
                self.draw_hud(g, cv);
                self.draw_overlay(g, cv);
            }
            Scene::Clear(cs) => self.draw_clear(g, cs, cv),
            Scene::Continue { t, from_store } => {
                if *from_store {
                    self.draw_store(g, cv);
                } else {
                    self.draw_mall(g, cv);
                }
                self.draw_hud(g, cv);
                self.draw_continue(g, *t, cv);
            }
            Scene::GameOver { t } => self.draw_game_over(g, *t, cv),
        }
        // fades between scenes
        let f = g.fade_level();
        if f > 0.0 {
            cv.fade(1.0 - f);
        }
        if let Some((text, t)) = &g.toast {
            if *t > 0 {
                let w = text_width(text) + 8;
                let x = (SCREEN_W as i32 - w) / 2;
                draw_box(cv, x, 24, w, 13, c::BLACK, c::WHITE);
                draw_text(cv, x + 4, 27, text, c::WHITE);
            }
        }
    }

    fn draw_overlay(&self, g: &Game, cv: &mut Canvas) {
        match g.overlay {
            Overlay::Map => self.draw_map(g, cv),
            Overlay::Pause => {
                cv.dim_rect(0, 0, 256, 240, 0);
                cv.dim_rect(0, 0, 256, 240, 1);
                cv.shade_rect(0, 0, 256, 240, 0.5);
                if (g.frame / 30) % 2 == 0 {
                    draw_text_center_shadow(cv, 128, 112, "PAUSE", c::WHITE, c::BLACK);
                }
                draw_text_center(cv, 128, 130, "START: RESUME", c::GRAY);
            }
            Overlay::None => {}
        }
    }
}

impl Default for Renderer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::mall::*;
    use crate::game::powerups::PowerKind;
    use crate::game::*;
    use crate::input::*;
    use crate::stores::{info, Role, ALL_STORES};

    fn run(g: &mut Game, pad: &mut Pad, held: u8, n: usize) {
        for _ in 0..n {
            pad.set_gamepad(held);
            let ps = pad.begin_step();
            g.step(ps);
        }
    }

    /// Draw every screen and every state; no sprite the renderer asks for may be missing.
    #[test]
    fn renderer_never_requests_a_missing_sprite_and_never_panics() {
        let r = Renderer::new();
        let mut cv = Renderer::new_canvas();
        let mut g = Game::new(5, false);
        let mut pad = Pad::new();
        for _ in 0..200 {
            run(&mut g, &mut pad, 0, 1);
            r.render(&g, &mut cv);
        }
        let mut g = Game::new(5, true);
        run(&mut g, &mut pad, 0, 20);
        for b in [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A] {
            run(&mut g, &mut pad, b, 2);
            run(&mut g, &mut pad, 0, 2);
        }
        for _ in 0..40 {
            run(&mut g, &mut pad, 0, 1);
            r.render(&g, &mut cv);
        }
        run(&mut g, &mut pad, START, 2);
        for _ in 0..500 {
            run(&mut g, &mut pad, A, 1);
            r.render(&g, &mut cv);
        }
        g.mall.spawn_timer = 1_000_000;
        // every player pose in the mall
        let states = [
            PState::Walk,
            PState::Hidden(100),
            PState::Dying(50),
            PState::Inside(0),
            PState::Roof(1),
            PState::Esc { idx: 0, up: true, t: 10 },
            PState::Fall { vy: 1.0, fatal: false, shaft: 1, start_y: 100.0 },
            PState::Land(10),
            PState::Zip(30),
            PState::Drop,
            PState::Selfie(100),
        ];
        for st in states {
            g.mall.p.st = st;
            g.mall.p.duck = true;
            g.mall.p.kick = true;
            g.mall.p.z = 5.0;
            r.render(&g, &mut cv);
            g.mall.p.duck = false;
            g.mall.p.z = 0.0;
            g.mall.p.shoot_pose = 5;
            r.render(&g, &mut cv);
        }
        g.mall.p.st = PState::Walk;
        g.mall.p.shoot_pose = 0;
        // spies in every pose, lamps in every state, coins, pickups, NPC effects, banner, kiosk, strip
        for (i, st) in [SpyState::Walk, SpyState::Aim(5, true), SpyState::Aim(5, false), SpyState::Duck(9), SpyState::Wait(9), SpyState::Dying(12)].iter().enumerate() {
            g.mall.spies.push(Spy { x: 150.0 + i as f32 * 20.0, floor: 5, dir: 1, st: *st, age: 5, cd: 0, walk_t: 9, goal: None, last_volley: 0, anim: i as i32 });
        }
        for (i, l) in g.mall.lamps.iter_mut().enumerate() {
            l.st = match i % 4 {
                0 => LampState::Hang,
                1 => LampState::Fall { y: 100.0, vy: 1.0, dir: 1 },
                2 => LampState::Roll { dir: -1 },
                _ => LampState::Wreck(1),
            };
        }
        g.mall.coins.push(Coin { x: 160.0, y: 120.0, vx: 0.0, vy: 0.0, gold: true, floor: 5, bounces: 0, ttl: 10 });
        for k in [PowerKind::Rapid, PowerKind::Spread, PowerKind::Armor, PowerKind::Sneakers, PowerKind::Radar, PowerKind::OneUp, PowerKind::Cinnabomb, PowerKind::Ooze, PowerKind::Pretzel] {
            g.mall.pickups.push(Pickup { x: 130.0, floor: 5, kind: k, ttl: 100 });
            g.powers.grant(k);
        }
        g.mall.wet = Some(Wet { cx: 500.0, t: 100 });
        g.mall.janitor.mop = 10;
        g.mall.cop.whistle = 10;
        g.mall.alarm = true;
        g.mall.kiosk_panel = 50;
        g.mall.kiosk_target = Some(crate::stores::StoreId::KgbToys);
        g.mall.strip_t = 50;
        g.mall.set_banner(vec!["A".into(), "B".into()], 100, true);
        g.mall.bubbles.push(Bubble { x: 150.0, y: 100.0, text: "TEST".into(), t: 10 });
        g.mall.popups.push(Popup { x: 150.0, y: 100.0, text: "-500".into(), t: 10 });
        g.mall.dark.push(Dark { floor: 5, x0: 100.0, x1: 300.0, t: 50 });
        g.mall.ping.push((10.0, 10.0, 5));
        g.s.bf = true;
        for floor in 0..=5u8 {
            for x in [20.0, 200.0, 384.0, 600.0, 740.0] {
                g.mall.p.floor = floor;
                g.mall.p.x = x;
                r.render(&g, &mut cv);
            }
        }
        g.overlay = Overlay::Map;
        r.render(&g, &mut cv);
        g.s.jokes = vec![0, 1, 2, 3, 4];
        g.s.strip = true;
        r.render(&g, &mut cv);
        g.overlay = Overlay::Pause;
        r.render(&g, &mut cv);
        g.overlay = Overlay::None;
        // every open store, from the inside
        for id in ALL_STORES {
            if info(id).role == Role::Closed {
                continue;
            }
            g = Game::new(5, true);
            run(&mut g, &mut pad, 0, 20);
            run(&mut g, &mut pad, START, 2);
            run(&mut g, &mut pad, 0, 60);
            g.mall.control = true;
            g.mall.p.floor = info(id).floor;
            g.mall.p.x = crate::game::level::slot(id).door_x() as f32;
            g.mall.p.st = PState::Walk;
            g.mall.p.inv = 1_000_000;
            run(&mut g, &mut pad, UP, 2);
            run(&mut g, &mut pad, 0, 60);
            assert!(matches!(g.scene, Scene::Store), "{id:?}");
            for t in 0..200 {
                run(&mut g, &mut pad, if t % 3 == 0 { B } else { A | UP }, 1);
                r.render(&g, &mut cv);
            }
            {
                use crate::game::store::*;
                let mut set = |g: &mut Game, f: &dyn Fn(&mut StoreRoom)| {
                    f(g.room.as_mut().unwrap());
                    r.render(g, &mut cv);
                };
                set(&mut g, &|room| room.st = PSt::Search { fix: 0, t: 10, total: 45 });
                for item in [Held::Package, Held::Power(PowerKind::Rapid), Held::Joke(2)] {
                    set(&mut g, &|room| room.st = PSt::Hold { item, t: 20 });
                }
                set(&mut g, &|room| room.st = PSt::Stun(10));
                set(&mut g, &|room| room.st = PSt::Dying(30));
                set(&mut g, &|room| {
                    room.toys.push(Toy { x: 100.0, y: 100.0, dir: Dir::Left, t: 50 });
                    room.puffs.push(Puff { x: 100.0, y: 100.0, t: 10 });
                    room.banner = Some(("TEST".into(), 50));
                });
            }
            g.overlay = Overlay::Map;
            r.render(&g, &mut cv);
            g.overlay = Overlay::None;
        }
        // end screens
        for phase in [ClearPhase::Drive, ClearPhase::Tally, ClearPhase::News, ClearPhase::Post] {
            for t in [0, 50, 200, 399] {
                g.scene = Scene::Clear(ClearState { phase, t, time_bonus: 1234, headline: 2, post: 3, secs: 100 });
                r.render(&g, &mut cv);
            }
        }
        for t in [100, 20, 60 * 9] {
            g.scene = Scene::Continue { t, from_store: false };
            r.render(&g, &mut cv);
            g.scene = Scene::Continue { t, from_store: g.room.is_some() };
            r.render(&g, &mut cv);
        }
        for t in [0, 40, 100, 200, 340, 700] {
            g.scene = Scene::GameOver { t };
            r.render(&g, &mut cv);
        }
        g.toast("CRT ON");
        r.render(&g, &mut cv);
        let misses = r.sprites.misses.borrow();
        assert!(misses.is_empty(), "the renderer asked for sprites that do not exist: {misses:?}");
    }

    #[test]
    fn screen_is_never_blank_in_any_scene() {
        let r = Renderer::new();
        let mut cv = Renderer::new_canvas();
        let mut g = Game::new(5, true);
        let mut pad = Pad::new();
        run(&mut g, &mut pad, 0, 30);
        let lit = |cv: &Canvas| cv.data.chunks(4).filter(|p| p[0] as u32 + p[1] as u32 + p[2] as u32 > 30).count();
        r.render(&g, &mut cv);
        assert!(lit(&cv) > 20_000, "title");
        run(&mut g, &mut pad, START, 2);
        run(&mut g, &mut pad, 0, 100);
        r.render(&g, &mut cv);
        assert!(lit(&cv) > 20_000, "mall");
    }
}
