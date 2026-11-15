//! Top-down store rooms.
use super::{Renderer, SCREEN_H, SCREEN_W};
use crate::font::*;
use crate::game::level::Content;
use crate::game::rooms::{GuardKind, TILE};
use crate::game::store::*;
use crate::game::Game;
use crate::pixel::{c, Canvas};
use crate::stores::{self, Theme};

pub fn theme_slug(t: Theme) -> &'static str {
    match t {
        Theme::Fashion => "fashion",
        Theme::Electronics => "electronics",
        Theme::Toys => "toys",
        Theme::FoodCourt => "food",
        Theme::Sports => "sports",
        Theme::Music => "music",
        Theme::Gadgets => "gadgets",
        Theme::Novelty => "novelty",
        Theme::Games => "games",
    }
}

const TOP: i32 = 16;

impl Renderer {
    pub(crate) fn draw_store(&self, g: &Game, cv: &mut Canvas) {
        let Some(room) = g.room.as_ref() else { return };
        let id = room.id;
        let info = stores::info(id);
        let th = theme_slug(info.theme);
        let st = g.store_state(id);
        cv.reset_clip();
        cv.rect(0, 0, SCREEN_W as i32, SCREEN_H as i32, c::BLACK);
        cv.set_clip(0, TOP, SCREEN_W as i32, TOP + VIEW_H);
        let (mut cx, cy) = room.camera();
        if room.shake > 0 {
            cx += (room.t % 3) - 1;
        }
        let ox = -cx;
        let oy = TOP - cy;
        let egg_active = room.egg.as_ref().map_or(false, |e| e.phase != EggPhase::Done) && !room.clerk_gone;
        for ty in 0..room.layout.h {
            for tx in 0..room.layout.w {
                let ch = room.layout.tile(tx, ty);
                let (x, y) = (tx * TILE + ox, ty * TILE + oy);
                if x < -16 || x > 256 || y < TOP - 16 || y > TOP + VIEW_H {
                    continue;
                }
                let alt = (tx + ty) % 2;
                let floor = if egg_active { "rt_cave_floor".to_string() } else { format!("rt_{th}_floor_{alt}") };
                let draw_floor = |cv: &mut Canvas| cv.blit(self.spr(&floor), x, y);
                match ch {
                    b'#' => {
                        let n = if egg_active {
                            "rt_cave_wall".to_string()
                        } else if ty == 0 {
                            format!("rt_{th}_wall_top")
                        } else {
                            format!("rt_{th}_wall")
                        };
                        cv.blit(self.spr(&n), x, y);
                    }
                    b'D' => {
                        draw_floor(cv);
                        cv.blit(self.spr("rt_door"), x, y);
                    }
                    b'a' | b'b' => {
                        draw_floor(cv);
                        let fi = room.fixtures.iter().position(|f| f.tx == tx && f.ty == ty).unwrap();
                        let open = st.opened[fi];
                        let kind = if ch == b'a' { "a" } else { "b" };
                        cv.blit(self.spr(&format!("rt_{th}_fix_{kind}_{}", open as i32)), x, y);
                    }
                    b'F' => {
                        draw_floor(cv);
                        cv.blit(self.spr("rt_fitting_0"), x, y);
                        let fi = room.fixtures.iter().position(|f| f.tx == tx && f.ty == ty).unwrap();
                        if st.opened[fi] || st.revealed[fi] {
                            cv.blit(self.spr("rt_fitting_1"), x, y);
                        }
                    }
                    b'T' => {
                        draw_floor(cv);
                        let fi = room.fixtures.iter().position(|f| f.tx == tx && f.ty == ty).unwrap();
                        cv.blit(self.spr(&format!("rt_toyshelf_{}", (room.shelf_hit[fi] || st.opened[fi]) as i32)), x, y);
                    }
                    b'c' => {
                        draw_floor(cv);
                        cv.blit(self.spr(&format!("rt_{th}_counter")), x, y);
                    }
                    b'd' => {
                        draw_floor(cv);
                        if egg_active {
                            cv.blit(self.sprites.anim("rt_tv", (g.frame / 6) as usize), x, y);
                        } else {
                            cv.blit(self.spr(&format!("rt_{th}_decor_0")), x, y);
                        }
                    }
                    b'e' => {
                        draw_floor(cv);
                        cv.blit(self.spr(&format!("rt_{th}_decor_1")), x, y);
                    }
                    b'L' => {
                        draw_floor(cv);
                        cv.blit(self.spr(&format!("rt_booth_{}", room.booth as i32)), x, y);
                    }
                    b'p' => {
                        draw_floor(cv);
                        cv.blit(self.spr("rt_pedestal"), x, y);
                    }
                    b'k' => {
                        draw_floor(cv);
                        if !room.clerk_gone {
                            cv.blit(self.spr("tdclerk"), x, y);
                            cv.blit(self.sprites.anim("rt_fire", (g.frame / 8) as usize), x - 16, y);
                            cv.blit(self.sprites.anim("rt_fire", (g.frame / 8) as usize + 1), x + 16, y);
                        }
                    }
                    _ => draw_floor(cv),
                }
            }
        }
        // radar: flashing "!" over the package fixture
        if g.has_radar() && (g.frame / 10) % 2 == 0 {
            for (i, f) in room.fixtures.iter().enumerate() {
                if st.contents[i] == Content::Package && !st.opened[i] {
                    cv.blit(self.sprites.anim("rt_radar", 0), f.tx * TILE + ox, f.ty * TILE + oy - 2);
                }
            }
        }
        // pedestal item
        if let Some(e) = room.egg.as_ref() {
            if e.phase == EggPhase::Pedestal {
                if let Some((tx, ty)) = room.layout.find(b'p') {
                    let name = ["joke_coupon", "joke_guide", "joke_rock", "joke_ring", "joke_share"][e.item];
                    let bob = ((g.frame / 10) % 2) as i32;
                    cv.blit(self.spr(name), tx * TILE + ox, ty * TILE + oy - 4 - bob);
                }
            }
        }
        // toys
        for t in room.toys.iter() {
            cv.blit(self.sprites.anim("toy", (g.frame / 8) as usize), t.x as i32 - 6 + ox, t.y as i32 - 6 + oy);
        }
        // guards
        for gd in room.guards.iter() {
            self.draw_guard(cv, gd, g.frame as i32, ox, oy);
        }
        // player
        self.draw_td_player(cv, room, g, ox, oy);
        // bullets
        for b in room.bullets.iter() {
            if b.shoe {
                cv.blit(self.spr("tdshoe"), b.x as i32 - 4 + ox, b.y as i32 - 3 + oy);
            } else {
                cv.blit(self.spr("tdbullet"), b.x as i32 - 2 + ox, b.y as i32 - 2 + oy);
            }
        }
        for p in room.puffs.iter() {
            let f = ((24 - p.t.min(24)) / 6).clamp(0, 3);
            cv.blit(self.spr(&format!("puff_{f}")), p.x as i32 - 8 + ox, p.y as i32 - 8 + oy);
        }
        for p in room.popups.iter() {
            draw_text_shadow(cv, p.0 as i32 + ox - 8, p.1 as i32 + oy, &p.2, c::WHITE, c::BLACK);
        }
        // egg: dim the cave around, keeping the clerk bright
        if egg_active {
            cv.shade_rect(0, TOP, 256, VIEW_H, 0.6);
        }
        // bubbles
        for b in room.bubbles.iter() {
            if b.delay > 0 || b.guard >= room.guards.len() {
                continue;
            }
            let gd = &room.guards[b.guard];
            self.draw_bubble(cv, gd.x as i32 + ox, gd.y as i32 + oy - 10, &b.text);
        }
        if let Some(e) = room.egg.as_ref() {
            if e.phase == EggPhase::Typing {
                let n = (e.t / 3) as usize;
                let (full1, full2) = split_lines(crate::copy::ZELDA, 36);
                let l1: String = full1.chars().take(n).collect();
                let l2: String = full2.chars().take(n.saturating_sub(full1.chars().count() + 1)).collect();
                draw_box(cv, 12, TOP + 8, 232, 32, c::BLACK, c::WHITE);
                draw_text(cv, 18, TOP + 14, &l1, c::WHITE);
                draw_text(cv, 18, TOP + 26, &l2, c::WHITE);
            }
        }
        cv.reset_clip();
        // banner & bottom strip
        if let Some((text, t)) = &room.banner {
            self.draw_banner(cv, &[text.clone()], text == crate::copy::TRAP, *t, 120);
        }
        self.draw_store_strip(g, room, cv);
    }

    fn draw_guard(&self, cv: &mut Canvas, gd: &Guard, frame: i32, ox: i32, oy: i32) {
        let (x, y) = (gd.x as i32 - 8 + ox, gd.y as i32 - 8 + oy);
        match gd.kind {
            GuardKind::Bot => {
                if matches!(gd.st, GSt::Dying(t) if t < 12 && (frame % 2 == 0)) {
                    return;
                }
                cv.blit(self.sprites.anim("tdbot", (frame / 8) as usize), x, y);
            }
            GuardKind::Spy => {
                let d = match gd.dir {
                    Dir::Up => "u",
                    Dir::Down => "d",
                    _ => "s",
                };
                let flip = gd.dir == Dir::Left;
                let name = match gd.st {
                    GSt::Dying(t) => format!("tdspy_die_{}", ((24 - t.max(0)) / 12).clamp(0, 1)),
                    GSt::Aim(_) => format!("tdspy_aim_{d}"),
                    GSt::Walk => format!("tdspy_{d}_{}", (frame / 10) % 2),
                };
                cv.blit_flip(self.spr(&name), x, y, flip);
            }
        }
        if gd.stun > 0 && (frame / 4) % 2 == 0 {
            cv.pset(x + 4, y - 2, c::YELLOW);
            cv.pset(x + 10, y - 3, c::YELLOW);
        }
    }

    fn draw_td_player(&self, cv: &mut Canvas, room: &StoreRoom, g: &Game, ox: i32, oy: i32) {
        if room.inv > 0 && (room.t / 3) % 2 == 0 && !matches!(room.st, PSt::Dying(_)) {
            return;
        }
        let (x, y) = (room.x as i32 - 8 + ox, room.y as i32 - 8 + oy);
        let f = (room.t / 8) % 2;
        let name = match room.st {
            PSt::Hold { .. } => "tdagent_hold".to_string(),
            PSt::Stun(_) => "tdagent_stun".to_string(),
            PSt::Search { .. } => "tdagent_search".to_string(),
            PSt::Dying(t) => {
                if t % 6 < 3 {
                    "tdagent_stun".to_string()
                } else {
                    "tdagent_d_0".to_string()
                }
            }
            PSt::Walk => {
                let d = match room.face {
                    Dir::Up => "u",
                    Dir::Down => "d",
                    _ => "s",
                };
                format!("tdagent_{d}_{f}")
            }
        };
        let flip = room.face == Dir::Left && !matches!(room.st, PSt::Hold { .. });
        let tint = if g.powers.invincible() && (room.t / 2) % 2 == 0 { Some([c::YELLOW, c::WHITE, c::ORANGE]) } else { None };
        cv.blit_ex(self.spr(&name), x, y, flip, false, tint);
        if let PSt::Hold { item, .. } = room.st {
            let item_name = match item {
                Held::Package => "item_package",
                Held::Power(k) => k.sprite(),
                Held::Joke(i) => ["joke_coupon", "joke_guide", "joke_rock", "joke_ring", "joke_share"][i],
            };
            cv.blit(self.spr(item_name), x, y - 14);
        }
    }

    fn draw_store_strip(&self, g: &Game, room: &StoreRoom, cv: &mut Canvas) {
        let y0 = 16 + VIEW_H;
        cv.rect(0, y0, 256, 240 - y0, c::BLACK);
        cv.hline(0, y0, 256, c::GRAY_D);
        draw_text_center(cv, 128, y0 + 6, stores::info(room.id).name, c::YELLOW);
        match room.st {
            PSt::Search { t, total, .. } => {
                draw_text_center(cv, 128, y0 + 20, "SEARCHING...", c::WHITE);
                let w = 100;
                cv.frame(78, y0 + 32, w + 2, 6, c::WHITE);
                cv.rect(79, y0 + 33, w * t / total.max(1), 4, c::GREEN_L);
            }
            _ => {
                if room.can_search.is_some() && !room.frozen {
                    if (g.frame / 20) % 4 != 3 {
                        draw_text_center(cv, 128, y0 + 20, "PRESS X TO SEARCH", c::WHITE);
                    }
                }
            }
        }
        draw_tiny_center(cv, 128, y0 + 40, "Z SHOOT  X SEARCH  SELECT MAP  START PAUSE", c::GRAY_D);
    }
}

pub fn split_lines(text: &str, width: usize) -> (String, String) {
    let words: Vec<&str> = text.split(' ').collect();
    let mut l1 = String::new();
    let mut l2 = String::new();
    for w in words {
        if l2.is_empty() && l1.chars().count() + w.chars().count() < width {
            if !l1.is_empty() {
                l1.push(' ');
            }
            l1.push_str(w);
        } else {
            if !l2.is_empty() {
                l2.push(' ');
            }
            l2.push_str(w);
        }
    }
    (l1, l2)
}
