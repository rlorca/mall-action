//! Title, level clear, continue, game over, SPYGRAM and small popups.
use super::mall_view::*;
use super::{Renderer, SCREEN_H, SCREEN_W};
use crate::copy::{self, Post};
use crate::font::*;
use crate::game::level::*;
use crate::game::{ClearPhase, ClearState, Game};
use crate::pixel::{c, Canvas};
use crate::stores::ALL_STORES;

impl Renderer {
    pub(crate) fn draw_title(&self, g: &Game, cv: &mut Canvas) {
        let t = g.title.t;
        // night sky gradient
        let bands = [(0x0F, 0), (0x01, 40), (0x02, 80), (0x12, 110), (0x13, 130), (0x14, 145), (0x25, 160)];
        for y in 0..240 {
            let mut col = bands[0].0;
            for (cc, from) in bands {
                if y >= from {
                    col = cc;
                }
            }
            cv.hline(0, y, 256, col);
        }
        for i in 0..30 {
            let (x, y) = ((i * 71 + 13) % 250, (i * 29 + 7) % 130);
            if (t / 20 + i) % 3 != 0 {
                cv.blit(self.spr(&format!("title_star_{}", (i + t / 30) % 2)), x, y);
            }
        }
        cv.blit(self.spr("moon"), 218, 14);
        // logo
        let k = 5;
        for (line, y, ca, cb) in [("MALL", 22, c::YELLOW, c::ORANGE), ("ACTION", 62, c::RED_L, c::RED_D)] {
            let w = big_width(line, k);
            let x = (256 - w) / 2;
            draw_text_big(cv, x + 2, y + 2, line, c::BLACK, k);
            // two-tone: top half light, bottom half dark
            cv.set_clip(0, y, 256, y + 4 * k);
            draw_text_big(cv, x, y, line, ca, k);
            cv.set_clip(0, y + 4 * k, 256, y + 8 * k);
            draw_text_big(cv, x, y, line, cb, k);
            cv.reset_clip();
        }
        draw_text_center_shadow(cv, 128, 106, "A SHOPPING MALL ESPIONAGE", c::WHITE, c::BLACK);
        if g.title.bf_t > 0 {
            if (g.frame / 6) % 2 == 0 {
                draw_text_center_shadow(cv, 128, 120, "BLACK FRIDAY!", c::YELLOW, c::RED_D);
                draw_text_center_shadow(cv, 128, 132, "70% OFF EVERYTHING", c::WHITE, c::RED_D);
            }
        } else if g.title.bf {
            draw_text_center(cv, 128, 126, "BLACK FRIDAY MODE", c::YELLOW);
        }
        draw_text_center(cv, 128, 146, &format!("HI {:06}", g.hi_session), c::WHITE);
        if (t / 30) % 2 == 0 {
            draw_text_center_shadow(cv, 128, 160, "PRESS START", c::WHITE, c::BLACK);
        }
        // scrolling storefronts
        let off = (t / 2) % (80 * ALL_STORES.len() as i32);
        let total = 80 * ALL_STORES.len() as i32;
        let fy = 214;
        for k in 0..ALL_STORES.len() as i32 + 4 {
            let idx = (k as usize) % ALL_STORES.len();
            let x = k * 80 - off;
            if x < -80 || x > 256 {
                continue;
            }
            self.draw_storefront(cv, x, fy, ALL_STORES[idx], t as i64, StoreLook::Normal);
        }
        let _ = total;
        cv.rect(0, fy, 256, 26, c::BLACK);
        draw_text_center(cv, 128, fy + 4, "(C) 2026 FLICKERSOFT", c::GRAY_L);
        draw_text_center(cv, 128, fy + 15, "ARROWS MOVE  Z SHOOT  X JUMP/SEARCH", c::GRAY);
    }

    pub(crate) fn draw_spygram(&self, cv: &mut Canvas, post: &Post, t: i32, photo: &str, roof: bool) {
        let (x, y, w, h) = (36, 34, 184, 176);
        cv.rect(x - 2, y - 2, w + 4, h + 4, c::BLACK);
        cv.rect(x, y, w, h, c::WHITE);
        cv.rect(x, y, w, 16, c::MAGENTA);
        draw_text_shadow(cv, x + 6, y + 4, "SPYGRAM", c::WHITE, c::VIOLET_D);
        cv.frame(x + w - 22, y + 4, 14, 9, c::WHITE);
        cv.rect(x + w - 18, y + 6, 6, 5, c::WHITE);
        // photo
        let (px, py, pw, ph) = (x + 8, y + 22, w - 16, 84);
        for i in 0..ph {
            let col = if roof { [c::BLUE_D, c::INDIGO, c::PURPLE, c::MAGENTA, c::PINK][(i * 5 / ph) as usize] } else { [c::GRAY_D, c::GRAY, c::GRAY_L][(i * 3 / ph) as usize] };
            cv.hline(px, py + i, pw, col);
        }
        cv.rect(px, py + ph - 14, pw, 14, if roof { c::GRAY } else { c::GRAY_D });
        let s = self.spr(photo);
        cv.blit_scaled(s, px + pw / 2 - s.w as i32 * 3 / 2, py + ph - 14 - s.h as i32 * 3 + 8, 3, false);
        cv.frame(px, py, pw, ph, c::BLACK);
        // caption
        draw_text(cv, x + 8, y + 112, post.caption[0], c::BLACK);
        draw_text(cv, x + 8, y + 122, post.caption[1], c::BLACK);
        // likes
        let likes = (12 + t.max(0) * 53).min(9999);
        cv.blit(self.spr("heart"), x + 8, y + 134);
        draw_text(cv, x + 20, y + 135, &format!("{likes} LIKES"), c::RED_D);
        // comment
        cv.hline(x + 8, y + 148, w - 16, c::GRAY_L);
        draw_text(cv, x + 8, y + 155, post.comment, c::GRAY_D);
        if t < 20 {
            // photo-in-progress flash
            cv.shade_rect(x, y, w, h, 1.0);
        }
    }

    pub(crate) fn draw_kiosk_panel(&self, g: &Game, cv: &mut Canvas) {
        let m = &g.mall;
        let (x, y, w, h) = (28, 40, 200, 110);
        cv.rect(x, y, w, h, c::BLUE_D);
        cv.frame(x, y, w, h, c::WHITE);
        draw_text_center(cv, 128, y + 5, "YOU ARE HERE", c::YELLOW);
        // mini map
        for f in 0..=FLOOR_R {
            let fy = y + 18 + (FLOOR_R as i32 - f as i32) * 14;
            cv.hline(x + 8, fy + 10, w - 16, c::GRAY_D);
        }
        for s in STORE_SLOTS.iter() {
            let st = g.store_state(s.id);
            let sx = x + 8 + s.x * (w - 16) / WORLD_W;
            let sy = y + 18 + (FLOOR_R as i32 - s.floor as i32) * 14 + 2;
            let target = m.kiosk_target == Some(s.id);
            let col = if target {
                if (g.frame / 8) % 2 == 0 { c::YELLOW } else { c::RED }
            } else if st.role() == crate::stores::Role::Closed {
                c::GRAY_D
            } else {
                c::BLUE
            };
            cv.rect(sx, sy, 20 * (w - 16) / WORLD_W * 4 / 3 + 4, 8, col);
        }
        let (px, pf) = (x + 8 + (m.p.x as i32) * (w - 16) / WORLD_W, m.player_floor());
        let py = y + 18 + (FLOOR_R as i32 - pf as i32) * 14 + 2;
        if (g.frame / 10) % 2 == 0 {
            cv.rect(px, py, 3, 8, c::WHITE);
        }
        match m.kiosk_target {
            Some(id) => {
                draw_text_center(cv, 128, y + 102 - 6, &format!("NEAREST: {}", crate::stores::info(id).name), c::WHITE);
            }
            None => draw_text_center(cv, 128, y + 96, "ALL PACKAGES FOUND!", c::GREEN_L),
        }
    }

    pub(crate) fn draw_photo_strip(&self, cv: &mut Canvas, t: i32) {
        let slide = (160 - t).clamp(0, 12);
        let (x, y) = (100, 40 - 12 + slide);
        cv.rect(x - 2, y - 2, 60, 130, c::BLACK);
        cv.rect(x, y, 56, 126, c::WHITE);
        for i in 0..4 {
            let fy = y + 4 + i * 30;
            cv.rect(x + 4, fy, 48, 26, c::GRAY_D);
            let col = [c::BLUE, c::PURPLE, c::MAGENTA, c::PINK][i as usize];
            cv.rect(x + 5, fy + 1, 46, 24, col);
            cv.blit(self.spr("agent_stand"), x + 20, fy + 2);
            draw_tiny(cv, x + 6, fy + 3, &format!("{}", i + 1), c::WHITE);
        }
        draw_text_center_shadow(cv, 128, y + 134, "PHOTO STRIP!", c::YELLOW, c::BLACK);
    }

    pub(crate) fn draw_clear(&self, g: &Game, cs: &ClearState, cv: &mut Canvas) {
        let t = cs.t;
        match cs.phase {
            ClearPhase::Drive => {
                cv.clear(c::BLACK);
                let fy = 170;
                for x in (0..256).step_by(16) {
                    cv.blit(self.spr("tile_ceiling"), x, fy - 112);
                    for r in 0..5 {
                        cv.blit(self.spr("park_wall"), x, fy - 104 + r * 16);
                    }
                    cv.blit(self.spr("park_floor"), x, fy);
                    cv.blit(self.spr("park_slab"), x, fy + 8);
                    cv.rect(x, fy + 16, 16, 60, c::GRAY_D);
                }
                for px in [40, 150, 260] {
                    cv.blit(self.spr("pillar"), px - 8 - (t / 2) % 4, fy - 40);
                }
                cv.blit(self.spr("exit_sign"), 120, fy - 100);
                let wx = 60 + t * 3 / 2;
                cv.blit(self.sprites.anim("wagon", (t / 4) as usize), wx, fy - 24);
                if wx < 260 {
                    let sx = wx - 34 - (t % 20) / 10 * 2;
                    cv.blit(self.spr("spy_wave"), sx, fy - 24);
                    cv.blit(self.spr(&format!("spy_walk_{}", (t / 5) % 4)), sx - 22, fy - 24);
                }
                for i in 0..3 {
                    let p = ((t / 6 + i * 3) % 12) as i32;
                    if wx > 70 {
                        cv.blit(self.spr(&format!("puff_{}", (p / 3).min(3))), wx - 14 - i * 6, fy - 12 + i * 2);
                    }
                }
                if (t / 8) % 2 == 0 {
                    draw_text_center_shadow(cv, 128, 24, "MISSION COMPLETE!", c::YELLOW, c::RED_D);
                }
            }
            ClearPhase::Tally => {
                cv.clear(c::BLUE_D);
                cv.frame(8, 8, 240, 224, c::SKY);
                draw_text_center_shadow(cv, 128, 20, "LEVEL CLEAR", c::YELLOW, c::BLACK);
                let rows = [
                    (60, "PACKAGES".to_string(), format!("{} X 500", g.s.packages.min(6))),
                    (84, "TIME BONUS".to_string(), format!("{}", cs.time_bonus)),
                    (108, "CLEAR BONUS".to_string(), "1000".to_string()),
                ];
                for (i, (y, a, b)) in rows.iter().enumerate() {
                    if t > 20 + i as i32 * 40 {
                        draw_text(cv, 32, *y, a, c::WHITE);
                        draw_text(cv, 224 - text_width(b), *y, b, c::YELLOW);
                    }
                }
                if t > 150 {
                    cv.hline(32, 130, 192, c::WHITE);
                    draw_text(cv, 32, 140, "SCORE", c::WHITE);
                    let s = format!("{:06}", g.s.score);
                    draw_text(cv, 224 - text_width(&s), 140, &s, c::GREEN_L);
                    draw_text_center_shadow(cv, 128, 176, &format!("LOOP {}", g.s.loop_n), c::ORANGE, c::BLACK);
                    draw_text_center(cv, 128, 196, "NEXT LOOP IS HARDER", c::GRAY_L);
                }
                if (t / 30) % 2 == 0 && t > 60 {
                    draw_text_center(cv, 128, 218, "PRESS START", c::GRAY);
                }
            }
            ClearPhase::News => {
                cv.clear(c::GRAY_L);
                cv.rect(6, 6, 244, 228, c::WHITE);
                cv.frame(6, 6, 244, 228, c::BLACK);
                let mast = "THE DAILY MALL";
                draw_text_big(cv, 128 - big_width(mast, 2) / 2, 14, mast, c::BLACK, 2);
                cv.hline(10, 34, 236, c::BLACK);
                cv.hline(10, 36, 236, c::BLACK);
                draw_text_center(cv, 128, 40, "LATE EDITION - ALL SPIES FOILED", c::GRAY_D);
                cv.hline(10, 50, 236, c::BLACK);
                // headline (bold by double strike)
                let lines = copy::HEADLINES[cs.headline % copy::HEADLINES.len()];
                let slide = (t * 3).min(0);
                let _ = slide;
                for (i, l) in lines.iter().enumerate() {
                    let y = 60 + i as i32 * 12;
                    draw_text(cv, 14, y, l, c::BLACK);
                    draw_text(cv, 15, y, l, c::BLACK);
                }
                let ph = 60 + lines.len() as i32 * 12 + 6;
                cv.rect(14, ph, 70, 52, c::GRAY);
                cv.blit_scaled(self.spr("logo_agent"), 29, ph + 10, 1, false);
                cv.frame(14, ph, 70, 52, c::BLACK);
                for i in 0..6 {
                    let w = [140, 132, 140, 120, 138, 90][i];
                    cv.rect(92, ph + 4 + i as i32 * 8, w, 3, c::GRAY_D);
                }
                for i in 0..5 {
                    cv.rect(14, ph + 62 + i * 8, 228 - (i % 2) * 40, 3, c::GRAY);
                }
                if (t / 30) % 2 == 0 {
                    draw_text_center(cv, 128, 222, "PRESS START", c::GRAY_D);
                }
            }
            ClearPhase::Post => {
                cv.clear(c::VIOLET_D);
                self.draw_spygram(cv, &copy::CLEAR_POSTS[cs.post % copy::CLEAR_POSTS.len()], t, "agent_stand", false);
                if (t / 30) % 2 == 0 {
                    draw_text_center(cv, 128, 222, "PRESS START", c::GRAY_L);
                }
            }
        }
    }

    pub(crate) fn draw_continue(&self, g: &Game, t: i32, cv: &mut Canvas) {
        cv.dim_rect(0, 16, 256, 224, 0);
        cv.shade_rect(0, 16, 256, 224, 0.4);
        draw_text_center_shadow(cv, 128, 56, "CONTINUE?", c::WHITE, c::BLACK);
        let secs = (t + 59) / 60;
        let col = if secs <= 3 { c::RED_L } else { c::YELLOW };
        let s = format!("{secs}");
        draw_text_big(cv, 128 - big_width(&s, 8) / 2 + 4, 80, &s, c::BLACK, 8);
        draw_text_big(cv, 128 - big_width(&s, 8) / 2, 76, &s, col, 8);
        draw_text_center_shadow(cv, 128, 150, &format!("CONTINUES LEFT: {}", g.s.continues), c::WHITE, c::BLACK);
        if (g.frame / 20) % 2 == 0 {
            draw_text_center_shadow(cv, 128, 172, "PRESS START", c::GREEN_L, c::BLACK);
        }
    }

    pub(crate) fn draw_game_over(&self, g: &Game, t: i32, cv: &mut Canvas) {
        cv.clear(c::BLACK);
        // mall corridor with storefronts
        let fy = 150;
        for x in (0..256).step_by(16) {
            cv.blit(self.spr("tile_ceiling"), x, fy - 40);
            cv.blit(self.spr("tile_wall_0"), x, fy - 32);
            cv.blit(self.spr("tile_wall_1"), x, fy - 16);
            cv.blit(self.spr("tile_floor_0"), x, fy);
            cv.rect(x, fy + 8, 16, 90, c::BLACK);
        }
        let ids = [ALL_STORES[0], ALL_STORES[1], ALL_STORES[4]];
        let xs = [4, 88, 172];
        for (i, id) in ids.iter().enumerate() {
            self.draw_storefront(cv, xs[i], fy, *id, t as i64, StoreLook::Normal);
        }
        cv.blit(self.spr("agent_stand"), 120, fy - 24);
        // shutters roll down over storefronts and the agent
        let roll = ((t - 70) * 40 / 160).clamp(0, 40);
        if roll > 0 {
            for x in (0..256).step_by(16) {
                for yy in 0..roll {
                    let col = if (yy / 3) % 2 == 0 { c::GRAY } else { c::GRAY_D };
                    cv.rect(x, fy - 40 + yy, 16, 1, col);
                }
                cv.rect(x + 7, fy - 40, 2, roll, c::GRAY_L);
            }
            cv.rect(0, fy - 40 + roll - 2, 256, 2, c::GRAY_L);
        }
        // PA typewriter
        if t > 10 {
            let n = ((t - 10) / 3) as usize;
            let a: String = copy::GAME_OVER_TYPE[0].chars().take(n).collect();
            let b: String = copy::GAME_OVER_TYPE[1].chars().take(n.saturating_sub(20)).collect();
            draw_text(cv, 128 - text_width(copy::GAME_OVER_TYPE[0]) / 2, 36, &a, c::YELLOW);
            draw_text(cv, 128 - text_width(copy::GAME_OVER_TYPE[1]) / 2, 50, &b, c::YELLOW);
        }
        if t > 330 {
            draw_text_big(cv, 128 - big_width("GAME OVER", 4) / 2 + 2, 82, "GAME OVER", c::RED_D, 4);
            draw_text_big(cv, 128 - big_width("GAME OVER", 4) / 2, 80, "GAME OVER", c::RED_L, 4);
            draw_text_center(cv, 128, 176, &format!("SCORE {:06}", g.s.score), c::WHITE);
            draw_text_center(cv, 128, 190, &format!("HIGH  {:06}", g.hi_session.max(g.s.score)), c::YELLOW);
            if (t / 30) % 2 == 0 {
                draw_text_center(cv, 128, 214, "PRESS START", c::GRAY_L);
            }
        }
        let _ = (SCREEN_W, SCREEN_H);
    }
}
