use crate::{art::Canvas, copy, game::*, pixel as px, splash};
pub fn draw(g: &Game, c: &mut Canvas, gallery: bool) {
    c.clear(0);
    if gallery {
        art_gallery(g, c);
        return;
    }
    match g.scene {
        Scene::Splash => {
            for (i, ch) in "FLICKERSOFT".chars().enumerate() {
                if splash::letter_visible(g.scene_t, i) {
                    c.text_scale(
                        19 + i as i32 * 20,
                        88,
                        &ch.to_string(),
                        [11, 15, 16, 20, 25, 29][i % 6],
                        4,
                    )
                }
            }
            if splash::settled(g.scene_t) {
                c.rect(20, 115, 216, 2, 16)
            }
            if splash::presents(g.scene_t) {
                c.center(139, "PRESENTS", 7)
            }
            c.center(213, "AN ORIGINAL 8-BIT CAPER", 4)
        }
        Scene::Title => title(g, c),
        Scene::Arrival | Scene::Selfie | Scene::Mall => {
            mall(g, c);
            if g.scene == Scene::Selfie {
                card(g, c, false)
            }
        }
        Scene::Store => room(g, c),
        Scene::Clear => clear(g, c),
        Scene::News => news(g, c),
        Scene::Post => card(g, c, true),
        Scene::Continue => {
            mall(g, c);
            panel(c, 34, 56, 188, 126);
            c.center(72, "CONTINUE?", 16);
            let n = 9 - (g.scene_t / 60).min(9);
            c.text_scale(117, 93, &n.to_string(), if n <= 3 { 11 } else { 7 }, 5);
            c.center(139, &format!("CONTINUES LEFT: {}", g.continues), 25);
            c.center(160, "START: BACK TO WORK", 7)
        }
        Scene::Over => {
            mall(g, c);
            for x in (0..256).step_by(32) {
                let h = (g.scene_t as i32 / 2).min(190);
                c.rect(x, 16, 30, h, 3);
                for y in (18..16 + h).step_by(4) {
                    c.rect(x, y, 30, 1, 5)
                }
            }
            panel(c, 15, 77, 226, 88);
            c.center(88, "ATTENTION SHOPPERS:", 16);
            c.center(100, "THE MALL IS NOW CLOSED", 7);
            if g.scene_t > 100 {
                c.center(122, "GAME OVER", 11);
                c.center(142, &format!("SCORE {:06}  HI {:06}", g.score, g.hi), 7)
            }
        }
    }
    if matches!(
        g.scene,
        Scene::Mall | Scene::Store | Scene::Arrival | Scene::Selfie
    ) {
        hud(g, c);
        if g.banner_t > 0
            && !g.map
            && !g.paused
            && !(g.scene == Scene::Store
                && (g.banner == copy::VISITS[visit_index(g.store)].0
                    || g.banner == copy::VISITS[visit_index(g.store)].1))
        {
            let lines = (g.banner.len() / 56 + 1).min(3);
            c.rect(4, 18, 248, lines as i32 * 8 + 6, 0);
            c.outline(4, 18, 248, lines as i32 * 8 + 6, 15);
            c.wrap(9, 22, &g.banner, 7, 59);
        }
    }
    if g.map {
        map(g, c)
    }
    if g.paused {
        panel(c, 60, 90, 136, 54);
        if g.frame / 30 % 2 == 0 {
            c.center(107, "PAUSE", 16)
        }
        c.center(126, "START TO RESUME", 7)
    }
}
fn panel(c: &mut Canvas, x: i32, y: i32, w: i32, h: i32) {
    c.rect(x, y, w, h, 0);
    c.outline(x, y, w, h, 15);
    c.outline(x + 2, y + 2, w - 4, h - 4, 3)
}
fn sky(c: &mut Canvas) {
    for y in 0..160 {
        c.rect(
            0,
            y,
            256,
            1,
            if y < 45 {
                0
            } else if y < 90 {
                1
            } else {
                22
            },
        )
    }
    for i in 0..38 {
        c.pixel(
            (i * 73 + 17) % 256,
            (i * 31 + 9) % 135,
            if i % 3 == 0 { 25 } else { 4 },
        )
    }
}
fn title(g: &Game, c: &mut Canvas) {
    for y in 0..240 {
        c.rect(
            0,
            y,
            256,
            1,
            if y < 62 {
                0
            } else if y < 112 {
                22
            } else if y < 154 {
                27
            } else {
                8
            },
        );
    }
    for i in 0..46 {
        let x = (i * 73 + 17) % 256;
        let y = (i * 31 + 9) % 170;
        c.pixel(
            x,
            y,
            if (i + g.frame as i32 / 40) % 7 == 0 {
                7
            } else {
                4
            },
        );
    }
    for yy in -10i32..11 {
        for xx in -10i32..11 {
            if xx * xx + yy * yy < 98 {
                c.pixel(224 + xx, 32 + yy, 32)
            }
            if (xx + 4) * (xx + 4) + (yy - 3) * (yy - 3) < 90 {
                c.pixel(224 + xx, 32 + yy, 0)
            }
        }
    }
    c.center(10, "FLICKERSOFT PRESENTS", 25);
    c.logo(69, 28, "MALL", 5);
    c.logo(39, 70, "ACTION", 5);
    c.center(113, "A SHOPPING MALL ESPIONAGE", 26);
    c.rect(83, 129, 91, 17, 0);
    c.outline(83, 129, 91, 17, 28);
    c.rect(86, 131, 85, 1, 29);
    if g.frame / 30 % 2 == 0 {
        c.label(96, 134, "PRESS START", 7)
    }
    if g.black {
        c.center(152, "BLACK FRIDAY! 70% OFF EVERYTHING", 16)
    }
    // Rooftop key art: silhouetted city, kick pose and a purloined parcel.
    for i in 0..16 {
        let x = i * 19 - 8;
        let h = 9 + (i * 17) % 29;
        c.rect(x, 178 - h, 17, h, 0);
        for yy in (180 - h..175).step_by(5) {
            for xx in (x + 3..x + 15).step_by(5) {
                if (xx + yy) % 3 != 0 {
                    c.pixel(xx, yy, 14)
                }
            }
        }
    }
    c.stamp_scaled(194, 123, px::AGENT_JUMP, [10, 7, 0], 2);
    c.stamp(182, 154, px::PACKAGE, [0, 14, 16], false);
    c.rect(190, 168, 43, 2, 0);
    c.rect(194, 167, 36, 1, 28);
    let offset = (g.frame / 4 % 276) as i32;
    for i in 0..7 {
        storefront(g, c, i % 13, i as i32 * 92 - offset, 225, 0)
    }
    c.text(5, 170, &format!("HI {:06}", g.hi), 16);
    c.text(135, 170, "(C)2026 FLICKERSOFT", 5);
    c.rect(0, 225, 256, 1, 44);
    c.rect(0, 226, 256, 3, 18);
    c.rect(0, 229, 256, 11, 0);
    c.center(233, "ENTER START  Z SHOOT  X JUMP  C CRT", 7);
}
fn art_gallery(g: &Game, c: &mut Canvas) {
    c.center(9, "FLICKERSOFT / SOURCE PIXEL ATLAS", 16);
    let page = (g.frame / 480) % 4;
    c.center(22, &format!("PAGE {}/4 - AUTO CYCLES", page + 1), 5);
    if page == 0 {
        for i in 0..12 {
            let x = 25 + (i % 4) as i32 * 64;
            let y = 42 + (i / 4) as i32 * 62;
            c.rect(x - 7, y - 4, 36, 34, 2);
            c.sprite(x, y, i, g.frame / 10, false);
            c.text(
                x - 9,
                y + 36,
                [
                    "AGENT",
                    "SPY",
                    "COP",
                    "JANITOR",
                    "PACKAGE",
                    "BOT",
                    "STORE AGENT",
                    "POWER-UP",
                    "STORE SPY",
                    "BACK VIEW",
                    "WALKER A",
                    "WALKER B",
                ][i],
                7,
            )
        }
    } else {
        let start = (page - 1) as usize * 12;
        for (i, (name, asset)) in px::ALL.iter().skip(start).take(12).enumerate() {
            let x = 10 + (i % 4) as i32 * 62;
            let y = 42 + (i / 4) as i32 * 61;
            c.rect(x, y, 49, 43, 2);
            c.stamp(
                x + 8,
                y + 3,
                asset,
                [
                    0,
                    if i % 2 == 0 { 19 } else { 14 },
                    if i % 2 == 0 { 26 } else { 16 },
                ],
                false,
            );
            c.text(x, y + 46, &name.chars().take(12).collect::<String>(), 7)
        }
    }
}
fn hud(g: &Game, c: &mut Canvas) {
    c.rect(0, 0, 256, 16, 0);
    c.rect(0, 15, 256, 1, 37);
    c.label(3, 1, &format!("{:06}", g.score), 7);
    c.label(
        45,
        1,
        &format!("PKG {}/6", g.count()),
        if g.count() == 6 { 20 } else { 11 },
    );
    c.stamp(
        96,
        0,
        &[
            "..3333..", ".333333.", ".332222.", "..223232", "..222222", "...2223.", "....33..",
        ],
        [10, 7, 0],
        false,
    );
    c.label(106, 1, &g.lives.to_string(), 7);
    c.rect(176, 0, 80, 15, 1);
    c.rect(178, 1, 76, 13, 0);
    c.rect(179, 2, 74, 1, 36);
    let label = if g.scene == Scene::Store {
        STORES[g.store].name
    } else {
        floor_name(g.p.floor)
    };
    let display = if label.len() > 11 {
        let o = (g.frame / 22) as usize % (label.len() + 4);
        format!("{}    {}", label, label)
            .chars()
            .skip(o)
            .take(11)
            .collect::<String>()
    } else {
        label.into()
    };
    c.label(180 + (72 - display.len() as i32 * 6) / 2, 5, &display, 20);
    let weapon = match g.p.weapon {
        1 => "RAPID",
        2 => "SPREAD",
        _ => {
            if g.p.food > 0 {
                "CINNABOMB"
            } else if g.p.speed > 0 {
                "SNEAKERS"
            } else {
                ""
            }
        }
    };
    c.text(3, 10, weapon, 16);
    let timer = g.p.weapon_t.max(g.p.speed_t).max(g.p.food);
    c.rect(45, 11, (timer * 38 / 1200).min(38) as i32, 3, 20);
    if g.p.armor {
        c.text(90, 10, "VEST", 25)
    }
    if g.p.radar {
        c.text(112, 10, "RADAR", 20)
    }
    if g.alarm && g.frame / 20 % 2 == 0 {
        c.text(142, 10, "ALARM", 11)
    }
}
fn camera(g: &Game) -> (i32, i32) {
    let shake = if g.shake > 0 {
        if g.frame % 2 == 0 {
            2
        } else {
            -2
        }
    } else {
        0
    };
    (
        (g.p.x - 120).clamp(0, 512) + shake,
        (g.p.y - 142).clamp(-100, 80),
    )
}
fn mall(g: &Game, c: &mut Canvas) {
    let (cx, cy) = camera(g);
    sky(c);
    let horizon = 40 - cy;
    for i in 0..16 {
        let x = i * 57 - cx / 4;
        let h = 28 + (i * 31) % 61;
        c.rect(x, horizon - h, 38, h, 1);
        for wy in (horizon - h + 5..horizon - 3).step_by(10) {
            for wx in [5, 16, 28] {
                c.rect(
                    x + wx,
                    wy,
                    3,
                    5,
                    if (i + wx + wy) % 3 == 0 { 15 } else { 3 },
                );
            }
        }
    }
    c.rect(-cx, 0, 65, horizon, 1);
    for y in (5..horizon - 4).step_by(10) {
        for x in [8, 24, 40] {
            c.rect(x - cx, y, 5, 5, if (x + y) % 3 == 0 { 25 } else { 15 });
        }
    }
    c.line(42 - cx, -80 - cy, 220 - cx, 38 - cy, 6);
    c.rect(220 - cx, 28 - cy, 3, 12, 5);
    for (f, &fy) in FLOOR.iter().enumerate() {
        let y = fy - cy;
        if f > 0 {
            c.rect(-cx, y - 47, 768, 46, if f == 5 { 36 } else { 32 });
            c.rect(-cx, y - 44, 768, 2, 38);
            for xx in (0..768).step_by(16) {
                c.pixel(xx + 3 - cx, y - 34, 33);
                c.pixel(xx + 13 - cx, y - 21, 33);
                c.rect(xx - cx, y - 18, 16, 1, 33);
            }

            for x in (0..768).step_by(16) {
                c.rect(x - cx, y - 12, 15, 11, 33);
                c.rect(x - cx, y - 12, 15, 1, 32);
                c.rect(x - cx, y - 1, 15, 1, 34);
                c.rect(x + 1 - cx, y - 10, 13, 8, 32);
                c.pixel(x + 3 - cx, y - 8, 33)
            }
        }
        c.rect(-cx, y, 768, 1, 16);
        c.rect(-cx, y + 1, 768, 4, 18);
        for xx in (0..768).step_by(8) {
            c.rect(xx - cx, y + 2, 3, 1, 25)
        }
        c.rect(-cx, y + 5, 768, 1, 0);
        if f > 0 {
            c.text(3, y - 40, floor_name(f), 16)
        }
    }
    for (id, s) in STORES.iter().enumerate() {
        storefront(g, c, id, s.x - 40 - cx, FLOOR[s.floor] - cy, cx)
    }
    for l in &g.lifts {
        let x = l.x - cx;
        let top = FLOOR[l.min] - cy;
        let bottom = FLOOR[l.max] - cy;
        c.rect(x - 18, top - 27, 36, bottom - top + 28, 0);
        c.rect(x - 15, top - 25, 2, bottom - top + 25, 36);
        c.rect(x + 13, top - 25, 2, bottom - top + 25, 36);
        for yy in (top - 24..bottom).step_by(24) {
            c.line(x - 13, yy, x + 13, yy + 23, 1);
            c.rect(x - 15, yy, 30, 1, 36);
            c.pixel(x - 14, yy, 38);
            c.pixel(x + 14, yy, 38);
        }
        let counter_y = (FLOOR[l.min] + FLOOR[l.max] - l.y) - cy - 20;
        c.rect(x + 10, counter_y, 5, 16, 37);
        for yy in (counter_y + 1..counter_y + 15).step_by(3) {
            c.rect(x + 11, yy, 3, 1, 38);
        }

        c.rect(x - 20, top - 27, 2, bottom - top + 28, 43);
        c.rect(x - 21, top - 27, 1, bottom - top + 28, 44);
        c.rect(x + 18, top - 27, 2, bottom - top + 28, 42);
        c.rect(x + 20, top - 27, 1, bottom - top + 28, 34);
        for f in l.min..=l.max {
            let y = FLOOR[f] - cy;
            if l.y < FLOOR[f] {
                for xx in (-16..16).step_by(4) {
                    c.rect(x + xx, y - 1, 2, 2, 5)
                }
            }
            c.text(x + 22, y - 16, floor_name(f), 15);
        }
        c.line(x - 10, top - 27, x - 10, l.y - 26 - cy, 4);
        c.line(x + 10, top - 27, x + 10, l.y - 26 - cy, 4);
        let y = l.y - cy;
        c.rect(x - 17, y - 28, 34, 29, 42);
        c.outline(x - 17, y - 28, 34, 29, 44);
        c.rect(x - 14, y - 25, 28, 24, 36);
        c.rect(x - 12, y - 24, 24, 1, 7);
        c.rect(x - 13, y - 23, 26, 3, 1);
        c.rect(x - 7, y - 23, 14, 3, 0);
        c.text(x - 2, y - 22, floor_name(nearest_floor(l.y)), 20);

        if !l.stopped {
            c.rect(x - 12, y - 19, 24, 18, 37);
            c.rect(x - 1, y - 19, 2, 18, 1);
            c.rect(x - 11, y - 18, 1, 16, 38);
            c.rect(x + 10, y - 18, 1, 16, 38)
        } else {
            c.rect(x - 12, y - 19, 24, 18, 17);
            c.rect(x - 12, y - 6, 24, 1, 38);
            c.rect(x - 10, y - 19, 1, 18, 18);
            c.rect(x + 9, y - 19, 1, 18, 18)
        }
        c.rect(x - 18, y, 36, 3, 15);
        c.text(
            x - 2,
            top - 35,
            if l.auto {
                "C"
            } else if l.min == 0 {
                "A"
            } else {
                "B"
            },
            16,
        );
    }
    for (bottom, top, x) in [(2, 1, 310), (4, 3, 580)] {
        let y = FLOOR[bottom] - cy;
        for i in 0..49 {
            c.rect(x + i - cx, y - i, 5, 3, 5);
            if (i + g.frame as i32 / 3) % 8 == 0 {
                c.rect(x + i - cx, y - i, 4, 1, 16)
            }
        }
        c.line(x - cx, y - 18, x + 48 - cx, FLOOR[top] - 18 - cy, 25)
    }
    for f in 1..5 {
        let y = FLOOR[f] - cy;
        c.rect(521 - cx, y - 18, 18, 18, 23);
        c.rect(524 - cx, y - 15, 12, 8, 25);
        c.text(527 - cx, y - 13, "?", 0);
        let bx = if f == 2 { 608 } else { 546 };
        c.stamp(bx - cx, y - 11, px::BENCH, [0, 42, 44], false);
        plant(c, if f == 4 { 435 } else { 590 } - cx, y);
        if f == 2 || f == 4 {
            plant(c, 680 - cx, y)
        }
    }
    for (f, x) in [(2, 245), (4, 645)] {
        let y = FLOOR[f] - cy;
        c.stamp(x - 16 - cx, y - 24, px::FOUNTAIN, [0, 24, 26], false);
        c.pixel(x - 2 - cx, y - 25 + (g.frame as i32 / 6) % 3, 7);
        c.pixel(x + 4 - cx, y - 29 + (g.frame as i32 / 8) % 4, 25);
    }
    c.stamp(436 - cx, FLOOR[2] - 36 - cy, px::BOOTH, [0, 28, 30], false);
    c.text(442 - cx, FLOOR[2] - 31 - cy, "PHOTO", 7);
    if g.p.hidden > 0 {
        c.rect(438 - cx, FLOOR[2] - 22 - cy, 17, 17, 28);
        c.line(
            440 - cx,
            FLOOR[2] - 20 - cy,
            440 - cx,
            FLOOR[2] - 7 - cy,
            29,
        );
    }
    for l in &g.lamps {
        if l.broken {
            if l.dark > 0 {
                c.rect(l.x - 27 - cx, FLOOR[l.floor] - 3 - cy, 54, 2, 0)
            }
            continue;
        }
        let x = l.x - cx;
        let art_y = (l.y + 6).min(FLOOR[l.floor] - 12) - cy;
        if !l.active {
            c.line(x, FLOOR[l.floor] - 43 - cy, x, art_y, 4)
        }
        c.stamp(
            x - 8,
            art_y,
            if l.floor == 3 { px::DISCO } else { px::LAMP },
            if l.floor == 3 {
                [0, 5, 26]
            } else {
                [0, 14, 16]
            },
            false,
        );
        if l.floor == 3 {
            c.pixel(x - 3 + (g.frame as i32 / 6) % 7, art_y + 3, 7)
        }
    }
    if g.wet_t > 0 {
        c.rect(g.wet_x - cx, FLOOR[4] - 2 - cy, 48, 2, 25);
        c.text(g.wet_x + 17 - cx, FLOOR[4] - 10 - cy, "!", 16)
    }
    c.sprite(g.janitor - cx, FLOOR[4] - 24 - cy, 3, g.frame / 12, false);
    c.line(
        g.janitor + 14 - cx,
        FLOOR[4] - 15 - cy,
        g.janitor + 25 - cx,
        FLOOR[4] - 1 - cy,
        14,
    );
    for (i, x) in g.walk.iter().enumerate() {
        c.sprite(
            x - cx,
            FLOOR[3] - 24 - cy,
            10 + i,
            (*x / 5).unsigned_abs(),
            false,
        )
    }
    c.sprite(
        g.cop_x - cx,
        FLOOR[g.cop_floor] - 25 - cy,
        2,
        g.frame / 12,
        g.cop_dir < 0,
    );
    c.stamp(
        g.cop_x - 5 - cx,
        FLOOR[g.cop_floor] - 5 - cy,
        px::SEGWAY,
        [0, 4, 6],
        g.cop_dir < 0,
    );
    for x in [120, 280, 500] {
        c.rect(x - cx, FLOOR[5] - 38 - cy, 9, 38, 4);
        c.rect(x - 2 - cx, FLOOR[5] - 39 - cy, 13, 5, 6)
    }
    car(c, 600 - cx, FLOOR[5] - cy);
    for en in &g.enemies {
        let x = en.x - cx;
        let y = en.y - 24 - cy;
        if en.dead > 0 {
            c.rect(x, y + 14, 20, 6, 2);
            c.text(x, y + 5, "+100", 16)
        } else {
            c.sprite(
                x,
                y + if en.duck { 10 } else { 0 },
                1,
                if en.aim > 0 {
                    0
                } else {
                    (en.x / 5).unsigned_abs()
                },
                en.dir < 0,
            );
            if en.aim > 0 {
                c.text(x + 5, y - 8, "!", 11);
                c.rect(x + if en.dir > 0 { 13 } else { -4 }, y + 9, 7, 3, 6)
            }
        }
    }
    if g.scene == Scene::Arrival {
        let t = g.scene_t.min(110) as i32;
        if t < 62 {
            let x = 42 + t * 2 - cx;
            let y = -80 + t * 2 * 118 / 178 - cy;
            agent(c, x, y + 4, g, false);
            c.rect(x + 3, y, 2, 8, 7);
            c.rect(x + 11, y, 2, 8, 7);
        } else {
            let x = (166 + (t - 62) * 2).min(210) - cx;
            let bottom = (30 + (t - 62) * (t - 62) / 12).min(40) - cy;
            agent(
                c,
                x,
                bottom - 24 + if t > 78 && t < 94 { 5 } else { 0 },
                g,
                false,
            );
        }
    } else if g.p.hidden == 0 && (g.p.inv == 0 || g.frame / 5 % 2 == 0) {
        agent(c, g.p.x - cx, g.p.y - 24 - cy, g, false)
    }
    for b in &g.bullets {
        c.rect(b.x - cx, b.y - cy, 4, 2, if b.enemy { 11 } else { 16 })
    }
    for d in &g.drops {
        c.sprite(
            d.x - cx,
            d.y - 8 - cy,
            if d.kind == 12 { 7 } else { 4 },
            g.frame / 10,
            false,
        )
    }
    for b in &g.bubbles {
        bubble(c, b.x - cx, b.y - cy, &b.text)
    }
    if g.photo && g.p.hidden == 0 && g.banner_t > 0 && g.banner.starts_with("PHOTO STRIP") {
        for i in 0..4 {
            c.rect(230, 45 + i * 26, 22, 25, 7);
            c.sprite(233, 47 + i * 26, 6, i as u32, false)
        }
    }
}
fn agent(c: &mut Canvas, x: i32, y: i32, g: &Game, small: bool) {
    // A flat, narrow contact shadow anchors the sprite to the floor.
    c.rect(x + 4, y + if small { 15 } else { 23 }, 8, 1, 1);
    if small {
        c.sprite(
            x,
            y,
            if g.p.face == 0 { 9 } else { 6 },
            ((g.p.x + g.p.y) / 5).unsigned_abs(),
            g.p.face == 2,
        );
        if g.p.face == 1 {
            c.rect(x + 5, y + 3, 5, 2, 7);
            c.pixel(x + 5, y + 3, 0);
            c.pixel(x + 9, y + 3, 0)
        }
    } else if g.p.duck {
        c.stamp(x, y, px::AGENT_DUCK, [10, 7, 0], g.p.dir < 0)
    } else if g.p.jump > 0 {
        c.stamp(x, y, px::AGENT_JUMP, [10, 7, 0], g.p.dir < 0)
    } else {
        c.sprite(x, y, 0, (g.p.x / 5).unsigned_abs(), g.p.dir < 0)
    }
    if g.p.shoot > 0 && !small {
        let gx = x + if g.p.dir > 0 { 9 } else { -2 };
        let gy = y + if g.p.duck { 16 } else { 10 };
        c.stamp(
            gx,
            gy,
            &["22233333", "22233333", "33333...", "..333..."],
            [10, 7, 0],
            g.p.dir < 0,
        );
        if g.p.shoot > 14 {
            c.stamp(
                x + if g.p.dir > 0 { 16 } else { -5 },
                gy - 1,
                &[".3.3.", "..32.", "32233", "..32.", ".3.3."],
                [0, 15, 16],
                g.p.dir < 0,
            )
        }
    }
    if g.p.food > 0 && g.frame % 4 == 0 {
        c.pixel(x - 2, y + 4, 16);
        c.pixel(x + 17, y + 10, 7);
        c.pixel(x + 5, y - 3, 16)
    }
    if g.p.pose > 0 {
        c.sprite(x, y - 16, if g.p.item == 1 { 4 } else { 7 }, 0, false);
        c.rect(x + 2, y - 2, 2, 6, 7);
        c.rect(x + 12, y - 2, 2, 6, 7)
    }
}
fn storefront(g: &Game, c: &mut Canvas, id: usize, x: i32, y: i32, _cx: i32) {
    if x > 260 || x < -84 {
        return;
    }
    let s = STORES[id];
    let cleared = g.packages[id];
    let accent = [29, 25, 15, 11, 20, 30, 25, 29, 20][s.theme];
    // Recessed shop fronts: stone jamb, a lit fascia, deep glazing, brass kickplates.
    c.rect(x - 2, y - 45, 84, 44, 0);
    c.rect(x - 2, y - 45, 2, 44, 5);
    c.rect(x + 80, y - 45, 2, 44, 4);
    c.rect(
        x,
        y - 45,
        80,
        16,
        if cleared {
            2
        } else {
            [8, 22, 13, 27, 17, 27, 17, 8, 22][s.theme]
        },
    );
    c.rect(x, y - 45, 80, 1, if cleared { 4 } else { accent });
    c.rect(x + 1, y - 43, 78, 1, if cleared { 3 } else { 4 });
    let lines: Vec<&str> = match id {
        5 => vec!["BLOCKBLUSTER", "VIDEO"],
        6 => vec!["SPENDER'S", "GIFTS"],
        8 => vec!["SHARPER", "IMAGINE"],
        9 => vec!["HOT SPY", "ON A STICK"],
        11 => vec!["FOOT", "LOCKPICKER"],
        12 => vec!["BORDERLINE", "BOOKS"],
        _ => vec![s.name],
    };
    for (i, line) in lines.iter().enumerate() {
        let yy = if lines.len() == 1 {
            y - 40
        } else {
            y - 44 + i as i32 * 8
        };
        c.label(
            x + (80 - line.len() as i32 * 6) / 2,
            yy,
            line,
            if cleared { 5 } else { 7 },
        );
    }
    c.rect(x, y - 29, 80, 29, if cleared { 1 } else { 2 });
    c.rect(x, y - 29, 80, 1, accent);
    if s.role == 2 {
        for yy in (y - 27..y - 2).step_by(3) {
            c.rect(x + 2, yy, 76, 2, 4);
            c.rect(x + 2, yy + 1, 76, 1, 3)
        }
        let label = if id == 5 { "FOR LEASE" } else { "CLOSING SALE" };
        c.rect(x + 6, y - 22, 68, 12, 0);
        c.text(x + (80 - label.len() as i32 * 4) / 2, y - 18, label, 7);
        c.rect(x + 6, y - 22, 2, 2, 15);
        c.rect(x + 72, y - 12, 2, 2, 15);
        return;
    }
    for (side, wx) in [3, 51].iter().enumerate() {
        c.rect(
            x + wx,
            y - 27,
            26,
            24,
            if cleared {
                0
            } else {
                [27, 1, 17, 13, 22, 27, 17, 0, 22][s.theme]
            },
        );
        c.outline(x + wx, y - 27, 26, 24, if cleared { 3 } else { 4 });
        if !cleared {
            display(
                c,
                x + wx + 1,
                y - 26,
                s.theme + side * 9 + if id == 8 { 18 } else { 0 },
                g.frame,
            );
        }
        // Two interrupted diagonal highlights read as glass, not a grey box.
        c.line(
            x + wx + 2,
            y - 25,
            x + wx + 5,
            y - 22,
            if cleared { 1 } else { 5 },
        );
        c.pixel(x + wx + 6, y - 21, if cleared { 1 } else { 4 });
        c.rect(x + wx, y - 4, 26, 2, 13);
        c.rect(x + wx, y - 4, 26, 1, if cleared { 3 } else { 15 });
    }
    let door = if cleared {
        4
    } else if s.role == 0 {
        if g.frame / 30 % 2 == 0 {
            11
        } else {
            10
        }
    } else {
        24
    };
    c.rect(x + 31, y - 28, 18, 28, 0);
    c.outline(x + 31, y - 28, 18, 28, door);
    c.rect(
        x + 33,
        y - 26,
        14,
        19,
        if cleared {
            1
        } else {
            [8, 22, 13, 27, 17, 27, 17, 8, 22][s.theme]
        },
    );
    c.line(x + 34, y - 25, x + 38, y - 21, 4);
    c.rect(x + 43, y - 14, 3, 2, 15);
    c.rect(x + 33, y - 5, 14, 4, 13);
    c.rect(x + 34, y - 4, 12, 1, 14);
    c.rect(x + 30, y - 1, 20, 1, 6);
    if !cleared {
        c.text(
            x + 37,
            y - 13,
            if s.role == 0 { "!" } else { "+" },
            if s.role == 0 { 11 } else { 25 },
        )
    }
    if g.black && !cleared {
        c.rect(x + 4, y - 13, 16, 8, 7);
        c.text(x + 5, y - 11, "70%", 10)
    }
}
fn display(c: &mut Canvas, x: i32, y: i32, t: usize, f: u32) {
    let v = t / 9;
    let t = t % 9;
    let a = (f / 18 % 2) as i32;
    match t {
        0 => {
            if v % 2 == 0 {
                c.stamp(x, y, px::MANNEQUIN, [0, 29, 7], false);
                c.stamp(x + 12, y, px::MANNEQUIN, [0, 15, 7], true)
            } else {
                c.stamp(x, y, px::RACK, [0, 29, 7], false)
            }
        }
        1 => {
            if v % 2 == 0 {
                c.stamp(x, y, px::TV, [0, 23, 6], false);
                c.stamp(x, y + 11, px::TV, [0, 23, 6], false);
                for yy in [3, 14] {
                    c.line(x + 5, y + yy + 4 - a, x + 8, y + yy + 2 + a, 20);
                    c.line(x + 8, y + yy + 2 + a, x + 12, y + yy + 4 - a, 20);
                    c.rect(x + 14, y + yy + 2, 3, 1, if a == 0 { 25 } else { 20 });
                }
            } else {
                c.stamp(x + 2, y + 2, px::WALKIE, [0, 4, 6], false);
                c.stamp(x + 14, y + 2, px::WALKIE, [0, 4, 6], false)
            }
        }
        2 => {
            if v % 2 == 0 {
                c.stamp(x, y + 3, px::BEAR, [0, 14, 15], false);
                c.stamp(x + 12, y + 3, px::BEAR, [0, 14, 15], false)
            } else {
                c.stamp(x, y + 2, px::TOY_ROBOT, [0, 5, 6], false);
                c.stamp(x + 14, y + 2, px::ROCKET, [0, 11, 7], false)
            }
        }
        3 => {
            if v % 2 == 0 {
                c.stamp(x + 3, y, px::LEMONADE, [0, 15, 16], false);
                c.pixel(x + 15, y + 7 + a, 7)
            } else {
                c.stamp(x, y + 2, px::CORNDOG, [0, 14, 16], false);
                c.stamp(x + 12, y + 2, px::CORNDOG, [0, 14, 16], false)
            }
        }
        4 => {
            if v % 2 == 0 {
                for yy in [2, 13] {
                    c.stamp(x, y + yy, px::SHOE, [0, 24, 7], false);
                    c.stamp(x + 12, y + yy, px::SHOE, [0, 10, 7], true)
                }
            } else {
                c.stamp(x + 1, y + 10, px::BALL, [0, 14, 15], false);
                c.stamp(
                    x + 12,
                    y,
                    &[
                        "..1111111..",
                        ".133333331.",
                        "13223332231",
                        "131.232.131",
                        ".1..232..1.",
                        "....232....",
                        "....232....",
                        "...13331...",
                        "...13331...",
                        "...11111...",
                    ],
                    [0, 24, 7],
                    false,
                );
            }
        }
        5 => {
            if v % 2 == 0 {
                c.stamp(x, y + 6, px::BOOMBOX, [0, 4, 6], false);
                c.pixel(x + 4, y + 13 + a, 25);
                c.pixel(x + 19, y + 13 + a, 25)
            } else {
                c.stamp(x, y, px::VINYL, [0, 3, 29], false);
                c.stamp(x + 12, y, px::VINYL, [0, 3, 15], false);
                for xx in [0, 12] {
                    c.stamp(
                        x + xx,
                        y + 14,
                        &[
                            "11111111111",
                            "13333333321",
                            "13211111221",
                            "13213331221",
                            "13211111221",
                            "13333333321",
                            "11111111111",
                        ],
                        [0, 4, 7],
                        false,
                    )
                }
            }
        }
        6 => {
            if v == 0 {
                c.stamp(x + 3, y - 1, px::CHAIR, [0, 13, 15], false)
            } else if v >= 2 && v % 2 == 0 {
                c.stamp(
                    x + 3,
                    y + 10,
                    &[
                        ".....111111.....",
                        "...1133333211...",
                        "..133333333321..",
                        ".13333333333321.",
                        "1323333333332221",
                        "1322333333322221",
                        ".12223333222221.",
                        "..122222222221..",
                        "...1111111111...",
                    ],
                    [0, 4, 7],
                    false,
                )
            } else {
                c.stamp(
                    x + 4,
                    y + 2,
                    px::ORB,
                    [0, 19, if a == 0 { 26 } else { 20 }],
                    false,
                )
            }
        }
        7 => {
            if v % 2 == 0 {
                c.stamp(
                    x + 7,
                    y,
                    px::LAVA,
                    [0, 28, if a == 0 { 30 } else { 11 }],
                    false,
                )
            } else {
                c.stamp(
                    x + 4,
                    y + 2,
                    px::PLASMA,
                    [0, 28, if a == 0 { 30 } else { 25 }],
                    false,
                )
            }
        }
        _ => {
            if v % 2 == 0 {
                c.stamp(x, y, px::TV, [0, 23, 6], false);
                c.rect(x + 6 + a * 5, y + 5, 2, 3, 20);
                c.stamp(x, y + 12, px::CONSOLE, [0, 4, 6], false)
            } else {
                c.rect(x + 1, y, 22, 22, 7);
                c.text(x + 2, y + 2, "TO THE", 0);
                c.text(x + 4, y + 9, "MOON", 0);
                c.stamp(
                    x + 8,
                    y + 14,
                    &["..1..", ".131.", "13231", ".121.", "1.3.1"],
                    [0, 11, 15],
                    false,
                )
            }
        }
    }
}
fn fixture(
    c: &mut Canvas,
    x: i32,
    y: i32,
    theme: usize,
    index: usize,
    open: bool,
    fitting: bool,
    frame: u32,
) {
    let wood = if theme == 1 || theme == 6 || theme == 8 {
        4
    } else {
        42
    };
    // Cast shadow follows the cabinet's feet, leaving air under racks and chairs.
    c.rect(x + 3, y + 22, 23, 3, 1);
    c.rect(x + 24, y + 5, 2, 19, 1);
    if fitting {
        c.rect(x, y, 24, 24, wood);
        c.rect(x, y, 24, 2, 15);
        c.rect(x + 1, y + 2, 22, 21, 0);
        for i in 0..if open { 2 } else { 5 } {
            let xx = x + 2 + i * 4;
            c.rect(xx, y + 3, 3, 19, 29);
            c.rect(xx + 2, y + 4, 1, 18, 28);
            c.pixel(xx, y + 3, 31)
        }
        if open {
            c.line(x + 13, y + 5, x + 18, y + 8, 7);
            c.line(x + 18, y + 8, x + 21, y + 6, 7);
            c.rect(x + 14, y + 9, 6, 9, 15)
        }
        c.rect(x + 1, y + 23, 22, 1, 15);
        return;
    }
    if theme == 0 && !open && index % 3 == 2 {
        c.stamp(
            x + 3,
            y - 3,
            &[
                "..111111111111..",
                ".13333333333321.",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                "1322222222222221",
                ".13333333333321.",
                "..111111111111..",
            ],
            [0, 3, 44],
            false,
        );
        c.stamp(x + 6, y, px::MANNEQUIN, [0, 29, 7], false);
        return;
    }
    if theme == 0 && !open {
        c.stamp(
            x,
            y + 1,
            px::RACK,
            [0, if index % 3 == 0 { 15 } else { 29 }, 7],
            false,
        );
        return;
    }
    if theme == 6 && index % 2 == 0 && !open {
        display(c, x, y + 1, 6 + if index % 4 == 0 { 0 } else { 9 }, frame);
        return;
    }
    c.stamp(
        x,
        y,
        px::SHELF,
        [0, wood, if wood == 4 { 6 } else { 44 }],
        false,
    );
    if open {
        // Displaced lid, empty cubbies, crumpled paper and one stray hanger.
        c.rect(x + 2, y + 3, 20, 6, 1);
        c.rect(x + 2, y + 13, 20, 6, 1);
        c.line(x + 3, y + 2, x + 19, y - 2, 15);
        c.line(x + 19, y - 2, x + 23, y + 1, wood);
        c.rect(x + 5, y + 17, 4, 2, 7);
        c.pixel(x + 8, y + 16, 6);
        c.rect(x + 15, y + 6, 3, 1, 6);
        return;
    }
    match theme {
        1 | 8 => {
            c.stamp(x, y, px::TV, [0, 23, 6], false);
            c.rect(x + 2, y + 14, 20, 5, 4);
            c.rect(x + 4, y + 16, 7, 1, 0);
            for xx in [14, 17, 20] {
                c.pixel(x + xx, y + 16, 20)
            }
        }
        2 => {
            if index % 2 == 1 {
                c.stamp(x, y + 2, px::TOY_ROBOT, [0, 5, 6], false);
                c.stamp(x + 14, y + 2, px::ROCKET, [0, 11, 7], false);
                return;
            }
            for xx in [1, 13] {
                c.stamp(x + xx, y + 3, px::BEAR, [0, 14, 15], false)
            }
        }
        3 => {
            if index % 2 == 0 {
                c.stamp(x + 3, y, px::LEMONADE, [0, 15, 16], false)
            } else {
                c.stamp(x, y + 2, px::CORNDOG, [0, 14, 16], false);
                c.stamp(x + 12, y + 2, px::CORNDOG, [0, 14, 16], false)
            }
        }
        4 => {
            for yy in [2, 13] {
                c.stamp(x + 1, y + yy, px::SHOE, [0, 24, 7], false);
                c.stamp(x + 12, y + yy, px::SHOE, [0, 10, 7], true)
            }
        }
        5 => {
            if index % 2 == 1 {
                c.stamp(x, y + 3, px::BOOMBOX, [0, 4, 6], false);
                c.rect(x + 2, y + 20, 20, 1, 44);
                return;
            }
            for xx in [2, 13] {
                c.stamp(
                    x + xx,
                    y + 1,
                    px::VINYL,
                    [0, 3, if index % 2 == 0 { 29 } else { 15 }],
                    false,
                );
                c.rect(x + xx, y + 14, 8, 5, 6);
                c.rect(x + xx + 1, y + 16, 6, 1, 0)
            }
        }
        6 | 7 => {
            if index % 2 == 0 {
                c.stamp(x + 7, y, px::LAVA, [0, 28, 30], false)
            } else {
                c.stamp(x + 4, y + 1, px::PLASMA, [0, 28, 25], false)
            }
        }
        _ => {
            for xx in [3, 8, 13, 18] {
                c.rect(x + xx, y + 3, 3, 6, if xx % 2 == 0 { 7 } else { 29 });
                c.pixel(x + xx + 1, y + 4, 0);
                c.rect(x + xx, y + 14, 3, 5, 15)
            }
        }
    }
    // Small white price ticket sits on the shelf lip, rather than filling the object.
    c.rect(x + 16, y + 10, 5, 2, 7);
    c.pixel(x + 18, y + 10, 0);
}
fn room_floor(c: &mut Canvas, x: i32, y: i32, t: usize) {
    let base = [40, 36, 17, 33, 43, 42, 36, 0, 27][t];
    c.rect(x, y, 16, 16, base);
    match t {
        0 => {
            c.pixel(x + 3, y + 5, 41);
            c.pixel(x + 11, y + 13, 41);
            c.pixel(x + 7, y + 9, 41)
        }
        1 | 6 => {
            c.rect(x, y + 15, 16, 1, 2);
            c.rect(x + 15, y, 1, 16, 2);
            c.pixel(x + 1, y + 1, 5);
            c.rect(x + 4, y + 5, 6, 1, 4)
        }
        2 => {
            c.rect(x, y + 15, 16, 1, 18);
            c.rect(x + 15, y, 1, 16, 18);
            c.rect(x + 6, y, 4, 1, 18);
            c.rect(x, y + 6, 1, 4, 18)
        }
        3 => {
            c.rect(x, y + 15, 16, 1, 5);
            c.rect(x + 15, y, 1, 16, 5);
            if (x + y) / 16 % 2 == 0 {
                c.rect(x + 1, y + 1, 14, 14, 7)
            }
        }
        4 | 5 => {
            for yy in [3, 7, 11, 15] {
                c.rect(x, y + yy, 16, 1, 42)
            }
            c.rect(x + if y % 32 == 0 { 4 } else { 12 }, y, 1, 4, 13);
            c.rect(x + 8, y + 8, 1, 4, 13);
            c.rect(x + 2, y + 5, 5, 1, 44)
        }
        7 => {
            c.pixel(x + 3, y + 5, 28);
            c.pixel(x + 4, y + 4, 29);
            c.pixel(x + 5, y + 5, 28);
            c.pixel(x + 4, y + 6, 28)
        }
        _ => {
            c.line(x + 3, y + 2, x + 6, y + 5, 28);
            c.line(x + 6, y + 5, x + 3, y + 8, 28);
            c.line(x + 9, y + 10, x + 12, y + 13, 23);
            c.pixel(x + 10, y + 3, 29)
        }
    }
}
fn room(g: &Game, c: &mut Canvas) {
    let s = STORES[g.store];
    let r = &g.rooms[g.store];
    let ox = (g.p.x - 122).clamp(0, (r.w - 256).max(0));
    let oy = (g.p.y - 120).clamp(0, (r.h - 176).max(0));
    let theme = [28, 23, 18, 13, 14, 27, 17, 8, 22][s.theme];
    c.rect(0, 16, 256, 194, 1);
    for yy in (48..208).step_by(16) {
        for xx in (0..256).step_by(16) {
            room_floor(c, xx, yy, s.theme)
        }
    }
    // A central runner organises the shop around its aisles. Decoration stays non-solid.
    if matches!(s.theme, 0 | 5 | 7 | 8) {
        c.rect(112, 78, 32, 115, if s.theme == 0 { 8 } else { 27 });
        c.outline(113, 79, 30, 112, if s.theme == 7 { 29 } else { 14 });
        for yy in (82..190).step_by(6) {
            c.pixel(115, yy, 15);
            c.pixel(140, yy, 15)
        }
    }
    // Raised back wall, skirting, framed advertisements and recessed display niches.
    c.rect(0, 16, 256, 40, theme);
    c.rect(8, 17, 240, 2, 5);
    c.rect(8, 19, 240, 2, 6);
    for xx in (12..246).step_by(16) {
        c.rect(xx, 22, 1, 30, if s.theme == 7 { 28 } else { 3 })
    }
    let brand_width = s.name.len() as i32 * 6 + 12;
    c.rect((256 - brand_width) / 2, 29, brand_width, 15, 0);
    c.outline(
        (256 - brand_width) / 2,
        29,
        brand_width,
        15,
        if s.theme == 0 { 29 } else { 15 },
    );
    c.label((256 - s.name.len() as i32 * 6) / 2, 33, s.name, 7);
    c.rect(8, 53, 240, 2, 0);
    c.rect(8, 55, 240, 1, 15);
    for xx in [0, 246] {
        c.rect(xx, 18, 10, 191, theme);
        c.rect(xx + 2, 22, 1, 168, 5);
        c.rect(xx + 8, 56, 2, 137, 0);
        for yy in (64..190).step_by(16) {
            c.pixel(xx + 4, yy, if s.theme == 7 { 29 } else { 6 })
        }
    }
    c.rect(10, 192, 100, 16, theme);
    c.rect(146, 192, 100, 16, theme);
    c.rect(10, 192, 100, 2, 15);
    c.rect(146, 192, 100, 2, 15);
    c.rect(110, 193, 36, 16, 13);
    c.rect(111, 194, 34, 13, 14);
    c.rect(111, 194, 34, 1, 15);
    c.text(120, 199, "EXIT", 7);
    for (i, f) in r.fixtures.iter().enumerate() {
        let x = f.x - ox;
        let y = f.y + 32 - oy;
        fixture(c, x, y, s.theme, i, f.open, f.kind == 1, g.frame);
        if !f.open && g.p.radar && f.content == 1 && g.frame / 12 % 2 == 0 {
            c.text(x + 10, y - 8, "!", 16);
        }
        if let Some((idx, t, _)) = g.search {
            if i == idx {
                c.rect(x - 1, y - 7, 26, 4, 0);
                c.rect(
                    x,
                    y - 6,
                    24 - (t as i32 * 24 / if g.p.speed > 0 { 24 } else { 45 }),
                    2,
                    20,
                )
            }
        }
    }
    if g.store == 7 {
        c.rect(200, 176, 28, 20, 23);
        c.text(202, 180, "SIDE B", 7)
    }
    if g.joke_phase > 0 && g.joke_phase <= 240 {
        c.sprite(120, 78, 3, 0, false);
        for x in [88, 151] {
            display(c, x, 80, 8, g.frame)
        }
        if g.joke_phase < 180 {
            panel(c, 14, 111, 228, 42);
            let line = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
            let chars = (g.joke_phase / 3) as usize;
            c.wrap(
                22,
                121,
                &line.chars().take(chars).collect::<String>(),
                7,
                50,
            );
        } else {
            c.sprite(120, 120, 7, g.frame / 10, false)
        }
    }
    for en in &g.enemies {
        if en.hp <= 0 {
            continue;
        }
        c.sprite(
            en.x - ox,
            en.y + 32 - oy,
            if en.bot { 5 } else { 8 },
            ((en.x + en.y) / 5).unsigned_abs(),
            en.dir < 0,
        );
        if en.aim > 0 {
            c.text(en.x + 6 - ox, en.y + 24 - oy, "!", 11)
        }
        if en.stun > 0 {
            c.text(en.x - ox, en.y + 26 - oy, "***", 16)
        }
    }
    if g.p.inv == 0 || g.frame / 5 % 2 == 0 {
        agent(c, g.p.x - ox, g.p.y + 32 - oy, g, true)
    }
    for b in &g.bullets {
        c.rect(b.x - ox, b.y + 32 - oy, 3, 3, if b.enemy { 11 } else { 16 })
    }
    for t in &g.toys {
        c.stamp(t.x - ox, t.y + 32 - oy, px::WINDUP, [0, 15, 7], t.dx < 0)
    }
    for d in &g.drops {
        c.sprite(d.x - ox, d.y + 32 - oy, 7, g.frame / 8, false)
    }
    c.rect(0, 211, 256, 29, 0);
    c.center(214, s.name, 25);
    c.center(
        226,
        if g.search.is_some() {
            "SEARCHING..."
        } else if g.touch_fixture().is_some() {
            "PRESS X TO SEARCH"
        } else {
            "X SEARCH  Z SHOOT  DOWN AT EXIT"
        },
        7,
    );
    if g.first_t > 0 {
        let lines = copy::VISITS[visit_index(g.store)];
        bubble(c, 115, 75, if g.first_t > 90 { lines.0 } else { lines.1 })
    }
}
fn bubble(c: &mut Canvas, x: i32, y: i32, s: &str) {
    if s.is_empty() {
        return;
    }
    let w = s.len() as i32 * 4 + 8;
    let xx = (x - w / 2).clamp(2, (254 - w).max(2));
    let yy = y.clamp(18, 218);
    c.rect(xx, yy, w, 11, 7);
    c.text(xx + 4, yy + 3, s, 0);
    c.rect((x + 5).clamp(xx, xx + w - 4), yy + 11, 3, 2, 7)
}
fn map(g: &Game, c: &mut Canvas) {
    c.clear(0);
    c.center(8, "MALL DIRECTORY", 16);
    c.center(20, "SELECT TO RETURN", 5);
    for f in 0..6 {
        let y = 40 + f as i32 * 24;
        c.text(5, y - 2, floor_name(f), 7);
        c.rect(24, y + 8, 220, 1, 4);
        for (i, s) in STORES.iter().enumerate().filter(|(_, s)| s.floor == f) {
            let x = 24 + s.x * 220 / 768;
            c.rect(
                x - 9,
                y - 5,
                18,
                11,
                if g.packages[i] {
                    4
                } else if s.role == 0 {
                    10
                } else if s.role == 1 {
                    24
                } else {
                    1
                },
            );
            if s.role == 2 {
                c.outline(x - 9, y - 5, 18, 11, 3)
            }
            if g.p.radar && s.role == 0 && !g.packages[i] {
                c.text(x - 1, y - 12, "!", 16)
            }
            if g.scene == Scene::Store && g.store == i && g.frame / 15 % 2 == 0 {
                c.outline(x - 11, y - 7, 22, 15, 7)
            }
        }
    }
    for l in &g.lifts {
        let x = 24 + l.x * 220 / 768;
        let y = 40 + l.min as i32 * 24;
        c.outline(x - 3, y - 10, 7, (l.max - l.min) as i32 * 24 + 20, 14);
        c.rect(x - 3, 40 + (l.y - 40) / 2 - 3, 7, 6, 16)
    }
    for (b, t, x) in [(2, 1, 310), (4, 3, 580)] {
        c.line(
            24 + x * 220 / 768,
            40 + b * 24,
            24 + (x + 48) * 220 / 768,
            40 + t * 24,
            25,
        )
    }
    if g.scene != Scene::Store && g.frame / 15 % 2 == 0 {
        c.text(
            24 + g.p.x * 220 / 768 - 2,
            40 + g.p.floor as i32 * 24 - 5,
            "@",
            7,
        )
    }
    c.text(202, 158, "CAR", 20);
    c.text(6, 185, "RED PACKAGE  BLUE POWER-UP  GREY CLEAR", 7);
    c.text(6, 197, "A/B MANUAL  C AUTO  / ESCALATOR", 15);
    c.wrap(
        6,
        210,
        &format!(
            "INVENTORY: {}{}",
            g.joke.map_or("", |j| copy::ITEMS[j]),
            if g.photo { " PHOTO STRIP" } else { "" }
        ),
        25,
        60,
    );
}
fn card(g: &Game, c: &mut Canvas, complete: bool) {
    panel(c, 31, 34, 194, 181);
    c.rect(34, 37, 188, 17, 29);
    c.big(42, 38, "SPYGRAM", 2, 7, 7);
    c.rect(39, 60, 178, 80, 22);
    for i in 0..10 {
        c.rect(40 + i * 18, 95 - (i % 3) * 7, 12, 45, 1);
        c.rect(43 + i * 18, 100 - (i % 3) * 7, 3, 3, 15)
    }
    c.stamp_scaled(101, 66, px::AGENT, [10, 7, 0], 3);
    c.stamp_scaled(
        143,
        87,
        &[
            "111111", "132221", "132221", "132221", "132221", "132221", "132221", "132221",
            "133331", "111111",
        ],
        [0, 5, 7],
        2,
    );
    c.rect(141, 103, 6, 4, 7);

    c.text(44, 65, "AGENT_7 / PUBLIC", 25);
    let (a, b, comment) = if complete {
        copy::COMPLETE[g.card % 10]
    } else {
        copy::ARRIVAL[g.card % 10]
    };
    c.label(43, 148, a, 7);
    c.label(43, 159, b, 7);
    c.text(43, 175, &format!("<3 {} LIKES", g.scene_t * 17 + 1), 11);
    c.label(43, 188, comment, 25);
    c.text(43, 204, "ANY BUTTON TO SKIP", 5)
}
fn car(c: &mut Canvas, x: i32, y: i32) {
    c.rect(x, y - 16, 76, 12, 14);
    c.rect(x + 14, y - 29, 44, 14, 15);
    c.rect(x + 18, y - 26, 16, 10, 25);
    c.rect(x + 37, y - 26, 16, 10, 25);
    c.rect(x + 3, y - 13, 69, 6, 13);
    c.rect(x + 6, y - 5, 12, 6, 0);
    c.rect(x + 56, y - 5, 12, 6, 0);
    c.rect(x + 9, y - 4, 5, 3, 6);
    c.rect(x + 59, y - 4, 5, 3, 6);
    c.rect(x + 72, y - 15, 4, 4, 16)
}
fn clear(g: &Game, c: &mut Canvas) {
    c.rect(0, 16, 256, 170, 1);
    for x in [20, 120, 220] {
        c.rect(x, 18, 12, 120, 4);
        c.rect(x - 4, 15, 20, 8, 6)
    }
    c.rect(0, 159, 256, 30, 3);
    car(c, 80 + (g.scene_t as i32 / 3).min(150), 160);
    c.sprite(20 + g.scene_t as i32 / 4, 136, 1, g.frame / 8, false);
    c.rect(40 + g.scene_t as i32 / 4, 131, 5, 10, 7);
    c.center(34, "MISSION COMPLETE", 16);
    c.center(57, "PACKAGES 6/6       3000", 7);
    c.center(72, &format!("TIME BONUS       {}", g.time_bonus), 7);
    c.center(87, "CLEAR BONUS       1000", 7);
    c.center(105, &format!("LOOP {} CLEARED", g.loop_n), 20);
    c.center(199, "THE WOOD PANELING IS TACTICAL.", 15);
    c.center(220, "START TO SKIP", 5)
}
fn news(g: &Game, c: &mut Canvas) {
    c.rect(13, 22, 230, 197, 7);
    c.text_scale(25, 32, "THE DAILY MALL", 0, 3);
    c.rect(24, 53, 208, 2, 0);
    c.text(26, 60, "FINAL EDITION / 25 CENTS / 2026", 4);
    c.wrap(25, 80, copy::HEADLINES[g.card % 5], 0, 26);
    c.rect(25, 125, 84, 64, 4);
    c.sprite(58, 146, 0, 0, false);
    for y in (127..194).step_by(5) {
        c.rect(118, y, 109 - (y % 13), 1, 5)
    }
    c.text(26, 205, "START: NEXT PAGE", 0)
}

fn plant(c: &mut Canvas, x: i32, y: i32) {
    c.stamp(x - 8, y - 24, px::PLANT, [0, 18, 20], false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_screen_renders_without_mutating_game() {
        let mut g = Game::new(123, false);
        let mut c = Canvas::new();
        for scene in [
            Scene::Splash,
            Scene::Title,
            Scene::Arrival,
            Scene::Selfie,
            Scene::Mall,
            Scene::Store,
            Scene::Clear,
            Scene::News,
            Scene::Post,
            Scene::Continue,
            Scene::Over,
        ] {
            g.scene = scene;
            for t in [0, 1, 60, 180, 400] {
                g.scene_t = t;
                let before = (g.rng.0, g.score, g.frame);
                draw(&g, &mut c, false);
                assert_eq!(before, (g.rng.0, g.score, g.frame));
                assert!(c.pixels.chunks(4).all(|p| p[3] == 255));
            }
        }
        for i in 0..13 {
            g.scene = Scene::Store;
            g.store = i;
            draw(&g, &mut c, false);
        }
        draw(&g, &mut c, true);
    }
}
