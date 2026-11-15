//! MALL DIRECTORY overlay (Select).
use super::Renderer;
use crate::font::*;
use crate::game::level::*;
use crate::game::mall::PState;
use crate::game::{Game, Scene};
use crate::pixel::{c, Canvas};
use crate::stores::Role;

fn mx(wx: i32) -> i32 {
    16 + wx * 3 / 10
}
fn mfy(f: u8) -> i32 {
    60 + (FLOOR_R as i32 - f as i32) * 24
}
fn my_world(y: i32) -> i32 {
    60 + (y - ROOF_Y) / 2
}

impl Renderer {
    pub(crate) fn draw_map(&self, g: &Game, cv: &mut Canvas) {
        cv.reset_clip();
        cv.rect(0, 0, 256, 240, c::BLUE_D);
        cv.frame(2, 2, 252, 236, c::SKY);
        cv.frame(4, 4, 248, 232, c::BLUE);
        draw_text_center_shadow(cv, 128, 10, "MALL DIRECTORY", c::YELLOW, c::BLACK);
        let blink = (g.frame / 15) % 2 == 0;
        // floors
        for f in 0..=FLOOR_R {
            let y = mfy(f);
            cv.hline(mx(0), y, mx(WORLD_W) - mx(0), c::GRAY_L);
            let label = floor_name(f);
            draw_text(cv, 6 + if label.len() == 1 { 3 } else { 0 }, y - 8, label, c::WHITE);
        }
        // shafts and cars
        for (i, s) in SHAFTS.iter().enumerate() {
            let (x0, y0, y1) = (mx(s.x), mfy(s.top) - 11, mfy(s.bottom));
            cv.rect(x0, y0, 10, y1 - y0, c::GRAY_D);
            cv.frame(x0, y0, 10, y1 - y0, c::BLACK);
            let car = &g.mall.cars[i];
            let cy = my_world(car.y);
            cv.rect(x0 + 1, cy - 8, 8, 8, c::YELLOW);
            cv.frame(x0 + 1, cy - 8, 8, 8, c::ORANGE);
            draw_tiny_center(cv, x0 + 5, y1 + 3, &s.name.to_string(), c::WHITE);
        }
        // escalators
        for e in ESCALATORS.iter() {
            let (x0, y0, x1, y1) = (mx(e.x_low), mfy(e.low), mx(e.x_high()), mfy(e.high()));
            let n = (x1 - x0).max(1);
            for i in 0..=n {
                cv.pset(x0 + i, y0 + (y1 - y0) * i / n, c::WHITE);
                cv.pset(x0 + i, y0 + (y1 - y0) * i / n - 1, c::WHITE);
            }
        }
        // stores
        let in_store = if let Scene::Store = g.scene { g.cur_store } else { None };
        for s in STORE_SLOTS.iter() {
            let st = g.store_state(s.id);
            let (x, y) = (mx(s.x), mfy(s.floor) - 11);
            let col = match st.role() {
                Role::Target if !st.package_taken => c::RED,
                Role::Target => c::GRAY,
                Role::PowerUp => c::BLUE_L,
                Role::Closed => c::BLACK,
            };
            if in_store == Some(s.id) && !blink {
                cv.rect(x, y, 24, 10, c::WHITE);
            } else {
                cv.rect(x, y, 24, 10, col);
                if st.role() == Role::Closed {
                    cv.frame(x, y, 24, 10, c::GRAY_D);
                } else {
                    cv.frame(x, y, 24, 10, c::BLACK);
                }
            }
            if g.has_radar() && st.role() == Role::Target && !st.package_taken {
                draw_text(cv, x + 9, y - 8, "!", if blink { c::YELLOW } else { c::ORANGE });
            }
        }
        // getaway car
        let (gx, gy) = (mx(WAGON_X), mfy(FLOOR_P) - 7);
        cv.rect(gx, gy, 17, 6, c::BROWN);
        cv.rect(gx + 2, gy - 2, 10, 2, c::TAN);
        cv.rect(gx + 2, gy + 5, 3, 2, c::BLACK);
        cv.rect(gx + 11, gy + 5, 3, 2, c::BLACK);
        // player
        if in_store.is_none() && blink {
            let m = &g.mall;
            let (px, py) = (mx(m.p.x as i32), my_world(m.feet_y() as i32));
            cv.rect(px - 1, py - 5, 3, 5, c::WHITE);
            cv.pset(px, py - 7, c::WHITE);
        }
        // legend
        let ly = 200;
        let items = [(c::RED, "PACKAGE"), (c::GRAY, "CLEARED"), (c::BLUE_L, "POWER-UP"), (c::BLACK, "CLOSED")];
        let mut x = 10;
        for (col, label) in items {
            cv.rect(x, ly, 8, 6, col);
            cv.frame(x, ly, 8, 6, c::GRAY_L);
            draw_tiny(cv, x + 10, ly + 1, label, c::WHITE);
            x += 12 + label.len() as i32 * 4 + 6;
        }
        // inventory
        let mut inv = String::from("ITEMS: ");
        let names = ["COUPON", "GUIDE", "ROCK", "RING", "SHARE"];
        for j in g.s.jokes.iter() {
            inv.push_str(names[*j]);
            inv.push(' ');
        }
        if g.s.strip {
            inv.push_str("PHOTO-STRIP ");
        }
        if g.s.jokes.is_empty() && !g.s.strip {
            inv.push_str("NONE");
        }
        draw_text(cv, 10, 214, &inv, c::GRAY_L);
        draw_text_center(cv, 128, 226, "SELECT: BACK", c::GRAY);
        let _ = PState::Walk;
    }
}
