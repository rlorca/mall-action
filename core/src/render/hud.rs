//! The 16 px status strip.
use super::{Renderer, SCREEN_W};
use crate::font::*;
use crate::game::level::floor_name;
use crate::game::mall::PState;
use crate::game::{Game, Scene};
use crate::pixel::{c, Canvas};

impl Renderer {
    pub(crate) fn draw_hud(&self, g: &Game, cv: &mut Canvas) {
        cv.reset_clip();
        cv.rect(0, 0, SCREEN_W as i32, 16, c::BLACK);
        cv.hline(0, 15, SCREEN_W as i32, c::GRAY_D);
        // score
        draw_text(cv, 5, 4, &format!("{:06}", g.s.score.max(0)), c::WHITE);
        // packages
        let all = g.s.packages >= 6;
        draw_text(cv, 47, 4, &format!("PKG {}/6", g.s.packages), if all { c::GREEN_L } else { c::RED_L });
        // lives
        cv.blit(self.spr("hud_head"), 94, 4);
        draw_text(cv, 103, 4, &format!("{}", g.s.lives.max(0)), c::WHITE);
        // active timed power-up
        if let Some((k, left, total)) = g.powers.hud_timer() {
            let name = match k {
                crate::game::powerups::PowerKind::Rapid => "RAPID",
                crate::game::powerups::PowerKind::Spread => "SPREAD",
                crate::game::powerups::PowerKind::Sneakers => "SNEAK",
                crate::game::powerups::PowerKind::Ooze => "JULI",
                crate::game::powerups::PowerKind::Cinnabomb => "CINNA",
                _ => "",
            };
            draw_tiny(cv, 114, 2, name, c::YELLOW);
            let w = 28 * left / total.max(1);
            cv.rect(114, 9, 28, 3, c::GRAY_D);
            cv.rect(114, 9, w.max(1), 3, c::YELLOW);
        }
        // icons
        if g.powers.armor {
            cv.blit(self.spr("hud_armor"), 146, 4);
        }
        if g.powers.radar {
            cv.blit(self.spr("hud_radar"), 156, 4);
        }
        // alarm
        if matches!(g.scene, Scene::Mall | Scene::Store) && g.mall.alarm && (g.frame / 12) % 2 == 0 {
            draw_text(cv, 166, 4, "ALARM", c::RED_L);
        }
        // LED floor panel
        cv.rect(204, 2, 50, 12, c::BLACK);
        cv.frame(204, 2, 50, 12, c::GRAY_D);
        match g.scene {
            Scene::Store => {
                let name = g.current_store_name();
                let text = format!("   {name}   ");
                let total = text_width(&text) + 1;
                let off = (g.store_name_scroll / 3) % total.max(1);
                cv.set_clip(206, 2, 252, 14);
                draw_text(cv, 206 - off, 4, &text, c::ORANGE);
                draw_text(cv, 206 - off + total, 4, &text, c::ORANGE);
                cv.reset_clip();
            }
            _ => {
                let f = match g.mall.p.st {
                    PState::Inside(_) | PState::Roof(_) | PState::Esc { .. } | PState::Fall { .. } => {
                        crate::game::mall::floor_from_y(g.mall.feet_y())
                    }
                    _ => g.mall.player_floor(),
                };
                for (i, n) in ["P", "1F", "2F", "3F", "4F", "R"].iter().enumerate().rev() {
                    // draw all floors dim, current one lit
                    let x = 207 + (5 - i as i32) * 7;
                    let lit = f as usize == i;
                    let label = if n.len() == 1 { n.to_string() } else { n[..1].to_string() };
                    draw_tiny(cv, x, 5, &label, if lit { c::ORANGE } else { c::GRAY_D });
                }
                let _ = floor_name;
            }
        }
    }
}
