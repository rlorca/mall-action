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
