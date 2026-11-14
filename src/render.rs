use crate::{art::Canvas, copy, game::*, splash};
pub fn draw(g: &Game, c: &mut Canvas, gallery: bool) {
    c.clear(0);
    if gallery {
        c.center(12, "FLICKERSOFT SPRITE GALLERY", 16);
        for i in 0..9 {
            let x = 35 + (i % 3) as i32 * 76;
            let y = 40 + (i / 3) as i32 * 62;
            c.outline(x - 4, y - 4, 26, 34, 3);
            c.sprite(x, y, i, g.frame / 10, false);
            c.text(
                x - 4,
                y + 38,
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
                ][i],
                7,
            );
        }
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
        if g.banner_t > 0 && !g.map && !g.paused {
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
    // A hand-composed neon movie-poster skyline. All pixels come from source.
    for y in 0..240 {
        c.rect(
            0,
            y,
            256,
            1,
            if y < 66 {
                0
            } else if y < 110 {
                22
            } else if y < 154 {
                27
            } else {
                8
            },
        );
    }
    for i in 0..45 {
        let x = (i * 73 + 17) % 256;
        let y = (i * 31 + 9) % 155;
        c.pixel(
            x,
            y,
            if (i + g.frame as i32 / 40) % 7 == 0 {
                7
            } else {
                25
            },
        );
    }
    for yy in -11i32..12 {
        for xx in -11i32..12 {
            if xx * xx + yy * yy < 122 {
                c.pixel(220 + xx, 35 + yy, 26)
            }
            if (xx + 5) * (xx + 5) + (yy - 3) * (yy - 3) < 112 {
                c.pixel(220 + xx, 35 + yy, 0)
            }
        }
    }
    c.text(18, 12, "FLICKERSOFT PRESENTS", 25);
    c.text(18, 22, "A RED COAT. SIX PACKAGES. NO RECEIPT.", 5);
    c.big(27, 42, "MALL", 7, 7, 25);
    c.big(19, 95, "ACTION", 6, 16, 11);
    c.rect(19, 141, 211, 1, 29);
    c.center(149, "A SHOPPING MALL ESPIONAGE", 7);
    for i in 0..16 {
        let x = i * 19 - 8;
        let h = 9 + (i * 17) % 24;
        c.rect(x, 183 - h, 17, h, 0);
        for yy in (184 - h..179).step_by(5) {
            for xx in (x + 3..x + 15).step_by(5) {
                if (xx + yy) % 3 != 0 {
                    c.pixel(xx, yy, 15)
                }
            }
        }
    }
    if g.frame / 30 % 2 == 0 {
        c.center(
            164,
            if g.black {
                "BLACK FRIDAY! 70% OFF!"
            } else {
                "PRESS START"
            },
            if g.black { 11 } else { 7 },
        )
    }
    let offset = (g.frame / 4 % 276) as i32;
    for i in 0..7 {
        storefront(g, c, (i % 13) as usize, i as i32 * 92 - offset, 226, 0)
    }
    c.rect(0, 226, 256, 4, 19);
    c.rect(0, 230, 256, 10, 0);
    c.center(232, "ENTER START  Z SHOOT  X JUMP  C CRT", 7);
    c.text(5, 181, &format!("HI {:06}", g.hi), 16);
    c.text(135, 181, "(C)2026 FLICKERSOFT", 5);
}
fn hud(g: &Game, c: &mut Canvas) {
    c.rect(0, 0, 256, 16, 0);
    c.rect(0, 15, 256, 1, 5);
    c.text(3, 2, &format!("{:06}", g.score), 7);
    c.text(
        34,
        2,
        &format!("PKG {}/6", g.count()),
        if g.count() == 6 { 20 } else { 11 },
    );
    c.text(70, 2, &format!("L{}", g.lives), 7);
    let label = if g.scene == Scene::Store {
        STORES[g.store].name
    } else {
        floor_name(g.p.floor)
    };
    let display = if label.len() > 17 {
        let o = (g.frame / 20) as usize % (label.len() + 4);
        let s = format!("{}    {}", label, label);
        s.chars().skip(o).take(17).collect::<String>()
    } else {
        label.into()
    };
    c.text(178, 2, &display, 20);
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
    c.text(3, 9, weapon, 16);
    let timer = g.p.weapon_t.max(g.p.speed_t).max(g.p.food);
    c.rect(45, 10, (timer * 38 / 1200).min(38) as i32, 3, 20);
    if g.p.armor {
        c.text(90, 9, "VEST", 25)
    }
    if g.p.radar {
        c.text(112, 9, "RADAR", 20)
    }
    if g.alarm && g.frame / 20 % 2 == 0 {
        c.text(142, 9, "ALARM", 11)
    }
    c.text(210, 9, &format!("LOOP {}", g.loop_n), 5)
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
        (g.p.y - 142).clamp(0, 80),
    )
}
fn mall(g: &Game, c: &mut Canvas) {
    let (cx, cy) = camera(g);
    sky(c);
    for i in 0..16 {
        let x = i * 57 - cx / 4;
        c.rect(x, 2, 38, 37, 1);
        for wy in [8, 18, 28] {
            for wx in [4, 16, 28] {
                c.rect(x + wx, wy, 3, 5, if (i + wx) % 3 == 0 { 15 } else { 3 })
            }
        }
    }
    c.rect(-cx, 0, 65, 40, 1);
    for y in [4, 14, 24] {
        for x in [8, 24, 40] {
            c.rect(x - cx, y, 5, 5, 15)
        }
    }
    c.line(42 - cx, 0 - cy, 220 - cx, 38 - cy, 6);
    c.rect(220 - cx, 28 - cy, 3, 12, 5);
    for (f, &fy) in FLOOR.iter().enumerate() {
        let y = fy - cy;
        if f > 0 {
            c.rect(-cx, y - 47, 768, 46, if f == 5 { 1 } else { 7 });
            c.rect(-cx, y - 44, 768, 2, 19);
            for x in (0..768).step_by(16) {
                c.rect(x - cx, y - 12, 15, 11, 6);
                c.rect(x - cx, y - 11, 15, 1, 7);
                c.pixel(x + 3 - cx, y - 6, 5)
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
        c.rect(x - 20, top - 27, 2, bottom - top + 28, 14);
        c.rect(x + 18, top - 27, 2, bottom - top + 28, 14);
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
        c.rect(x - 16, y - 26, 32, 26, if l.stopped { 17 } else { 3 });
        c.outline(x - 16, y - 26, 32, 27, 15);
        if !l.stopped {
            c.rect(x - 1, y - 24, 2, 23, 6)
        } else {
            c.rect(x - 13, y - 23, 26, 22, 1)
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
        c.rect(546 - cx, y - 8, 26, 3, 14);
        c.rect(550 - cx, y - 5, 2, 5, 13);
        c.rect(568 - cx, y - 5, 2, 5, 13);
        plant(c, 690 - cx, y);
    }
    for (f, x) in [(2, 245), (4, 645)] {
        let y = FLOOR[f] - cy;
        c.rect(x - 17 - cx, y - 8, 34, 8, 24);
        c.rect(x - 12 - cx, y - 11, 24, 4, 25);
        c.line(x - cx, y - 12, x - cx, y - 24, 25);
        c.pixel(x - 2 - cx, y - 25 + g.frame as i32 % 3, 7)
    }
    c.rect(436 - cx, FLOOR[2] - 36 - cy, 30, 36, 28);
    c.rect(440 - cx, FLOOR[2] - 33 - cy, 22, 7, 7);
    c.text(441 - cx, FLOOR[2] - 31 - cy, "PHOTO", 28);
    c.rect(440 - cx, FLOOR[2] - 24 - cy, 22, 22, 8);
    if g.p.hidden > 0 {
        c.rect(440 - cx, FLOOR[2] - 24 - cy, 22, 22, 29)
    }
    for l in &g.lamps {
        if l.broken {
            if l.dark > 0 {
                c.rect(l.x - 27 - cx, FLOOR[l.floor] - 3 - cy, 54, 2, 0)
            }
            continue;
        }
        let x = l.x - cx;
        let y = l.y - cy;
        if !l.active {
            c.line(x, y - 10, x, y, 5)
        }
        if l.floor == 3 {
            c.rect(x - 5, y, 10, 8, 6);
            for i in 0..4 {
                c.pixel(x - 4 + i * 3, y + ((g.frame as i32 / 4 + i) % 6), 25)
            }
        } else {
            c.rect(x - 7, y, 14, 4, 15);
            c.rect(x - 4, y + 4, 8, 2, 16)
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
    for x in g.walk {
        c.sprite(x - cx, FLOOR[3] - 24 - cy, 2, g.frame / 8, false)
    }
    c.sprite(
        g.cop_x - cx,
        FLOOR[g.cop_floor] - 25 - cy,
        2,
        g.frame / 12,
        g.cop_dir < 0,
    );
    c.rect(g.cop_x - 3 - cx, FLOOR[g.cop_floor] - 3 - cy, 22, 3, 5);
    c.rect(g.cop_x - cx, FLOOR[g.cop_floor] - 2 - cy, 4, 4, 0);
    c.rect(g.cop_x + 13 - cx, FLOOR[g.cop_floor] - 2 - cy, 4, 4, 0);
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
                g.frame / 12,
                en.dir < 0,
            );
            if en.aim > 0 {
                c.text(x + 5, y - 8, "!", 11);
                c.rect(x + if en.dir > 0 { 13 } else { -4 }, y + 9, 7, 3, 6)
            }
        }
    }
    if g.scene == Scene::Arrival {
        let t = g.scene_t.min(90) as i32;
        let x = 42 + t * 2 - cx;
        let y = if t < 80 { t / 3 + 2 - cy } else { 40 - cy };
        agent(c, x, y - 24, g, false)
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
    if small {
        c.sprite(x, y, 6, g.frame / 8, g.p.face == 2);
        if g.p.face == 0 {
            c.rect(x + 4, y + 2, 8, 5, 0)
        }
    } else {
        c.sprite(
            x,
            y + if g.p.duck { 10 } else { 0 },
            0,
            g.frame / 8,
            g.p.dir < 0,
        );
        if g.p.jump > 0 {
            c.rect(x + if g.p.dir > 0 { 10 } else { -7 }, y + 18, 13, 4, 0)
        }
        if g.p.food > 0 && g.frame % 4 == 0 {
            c.outline(x - 2, y - 2, 20, 28, 16)
        }
    }
    if g.p.pose > 0 {
        c.sprite(x, y - 16, if g.p.item == 1 { 4 } else { 7 }, 0, false);
        c.rect(x + 2, y - 2, 2, 6, 7);
        c.rect(x + 12, y - 2, 2, 6, 7);
    }
}
fn storefront(g: &Game, c: &mut Canvas, id: usize, x: i32, y: i32, _cx: i32) {
    if x > 260 || x < -85 {
        return;
    }
    let s = STORES[id];
    let cleared = g.packages[id];
    let color = if cleared {
        4
    } else if s.role == 0 {
        11
    } else if s.role == 1 {
        25
    } else {
        5
    };
    c.rect(
        x,
        y - 40,
        80,
        40,
        if cleared {
            1
        } else {
            [28, 22, 17, 27, 18, 22, 8, 27, 17][s.theme]
        },
    );
    c.rect(
        x,
        y - 40,
        80,
        9,
        if cleared {
            2
        } else if s.role == 0 {
            10
        } else if s.role == 1 {
            23
        } else {
            3
        },
    );
    c.rect(x + 1, y - 40, 78, 1, if s.role == 0 { 12 } else { 25 });
    c.text(
        x + (80 - s.name.len() as i32 * 4) / 2,
        y - 38,
        s.name,
        if cleared { 5 } else { 7 },
    );
    c.outline(x, y - 40, 80, 40, 3);
    if s.role == 2 {
        c.rect(x + 2, y - 29, 76, 29, 4);
        for yy in (y - 27..y - 2).step_by(4) {
            c.rect(x + 2, yy, 76, 1, 2)
        }
        c.text(
            x + 8,
            y - 17,
            if id == 5 { "FOR LEASE" } else { "CLOSING SALE" },
            7,
        );
        return;
    }
    c.rect(
        x + 31,
        y - 29,
        18,
        29,
        if cleared {
            3
        } else if s.role == 0 && g.frame / 25 % 2 == 0 {
            10
        } else {
            color
        },
    );
    c.rect(x + 34, y - 26, 12, 17, 1);
    c.rect(x + 43, y - 12, 3, 1, 16);
    c.outline(x + 34, y - 7, 12, 5, if cleared { 4 } else { 14 });
    for wx in [3, 51] {
        c.rect(
            x + wx,
            y - 28,
            26,
            24,
            if cleared {
                0
            } else {
                [8, 22, 17, 18, 22, 27, 17, 27, 22][s.theme]
            },
        );
        c.line(
            x + wx + 2,
            y - 26,
            x + wx + 9,
            y - 20,
            if cleared { 2 } else { 4 },
        );
        c.rect(x + wx, y - 5, 26, 3, 14);
        if !cleared {
            display(
                c,
                x + wx + 2,
                y - 27,
                s.theme + if wx == 51 { 9 } else { 0 },
                g.frame,
            )
        }
    }
    if g.black && !cleared {
        c.text(x + 3, y - 10, "70%", 16)
    }
}
fn display(c: &mut Canvas, x: i32, y: i32, t: usize, f: u32) {
    let variant = t / 9;
    let t = t % 9;
    let a = (f / 18 % 2) as i32;
    match t {
        0 => {
            if variant % 2 == 0 {
                for (xx, col) in [(3, 30), (15, 16)] {
                    c.rect(x + xx, y + 2, 4, 4, 7);
                    c.rect(x + xx + 1, y + 6, 2, 2, 7);
                    c.rect(x + xx - 2, y + 8, 8, 2, col);
                    c.rect(x + xx - 3, y + 9, 2, 6, col);
                    c.rect(x + xx + 5, y + 9, 2, 6, col);
                    c.rect(x + xx - 1, y + 10, 6, 6, col);
                    c.rect(x + xx, y + 11, 1, 4, 7);
                    c.rect(x + xx, y + 16, 2, 5, 7);
                    c.rect(x + xx + 3, y + 16, 2, 5, 7);
                    c.rect(x + xx - 1, y + 21, 8, 1, 5)
                }
            } else {
                c.rect(x + 2, y + 3, 1, 19, 6);
                c.rect(x + 22, y + 3, 1, 19, 6);
                c.rect(x + 2, y + 3, 21, 1, 7);
                for (xx, col) in [(5, 29), (11, 16), (17, 7)] {
                    c.line(x + xx, y + 4, x + xx - 2, y + 7, 6);
                    c.line(x + xx, y + 4, x + xx + 3, y + 7, 6);
                    c.rect(x + xx - 2, y + 8, 6, 11, col);
                    c.rect(x + xx - 3, y + 8, 8, 3, col)
                }
            }
        }
        1 => {
            if variant % 2 == 0 {
                for (yy, w) in [(0, 18), (11, 22)] {
                    c.rect(x + 1, y + yy, w, 10, 6);
                    c.rect(x + 3, y + yy + 2, w - 6, 6, 22);
                    for j in 0..5 {
                        c.rect(
                            x + 4 + (j * 7 + a * 3) % 12,
                            y + yy + 3 + j % 3,
                            2,
                            1,
                            if j % 2 == 0 { 25 } else { 7 },
                        )
                    }
                    c.pixel(x + w - 1, y + yy + 6, 11)
                }
                c.line(x + 6, y, x + 3, y - 3, 6);
                c.line(x + 8, y, x + 13, y - 3, 6)
            } else {
                for xx in [3, 15] {
                    c.rect(x + xx + 2, y + 1, 1, 6, 6);
                    c.rect(x + xx, y + 6, 8, 14, 4);
                    c.rect(x + xx + 2, y + 8, 4, 4, 20);
                    for yy in 14..18 {
                        c.rect(x + xx + 2, y + yy, 4, 1, 0)
                    }
                    c.pixel(x + xx + 5, y + 13, 11)
                }
            }
        }
        2 => {
            if variant % 2 == 0 {
                for xx in [2, 14] {
                    c.rect(x + xx + 1, y + 2, 7, 4, 0);
                    c.rect(x + xx, y + 4, 9, 3, 0);
                    c.rect(x + xx + 1, y + 7, 7, 6, 14);
                    c.pixel(x + xx + 2, y + 8, 0);
                    c.pixel(x + xx + 6, y + 8, 0);
                    c.pixel(x + xx + 4, y + 11, 0);
                    c.rect(x + xx + 1, y + 13, 7, 6, 14);
                    c.rect(x + xx - 1, y + 13, 3, 4, 14);
                    c.rect(x + xx + 7, y + 13, 3, 4, 14);
                    c.rect(x + xx, y + 19, 3, 3, 13);
                    c.rect(x + xx + 6, y + 19, 3, 3, 13)
                }
            } else {
                c.sprite(x, y + 5, 5, f / 12, false);
                c.rect(x + 17, y + 3, 3, 12, 11);
                c.rect(x + 16, y + 6, 5, 8, 7);
                c.rect(x + 15, y + 14, 2, 4, 11);
                c.rect(x + 20, y + 14, 2, 4, 11);
                c.rect(x + 18, y + 18, 1, 3, if a == 0 { 16 } else { 11 })
            }
        }
        3 => {
            if variant % 2 == 0 {
                c.rect(x + 2, y + 11, 15, 10, 15);
                c.rect(x + 1, y + 10, 17, 2, 7);
                c.rect(x + 4, y + 13, 11, 5, 16);
                c.rect(x + 7, y + 5, 2, 6, 6);
                c.rect(x + 7, y + 4 + a * 2, 7, 2, 7);
                c.rect(x + 12, y + 5 + a * 2, 2, 4, 6);
                c.rect(x + 19, y + 15, 4, 6, 7);
                c.rect(x + 20, y + 13, 1, 4, 11)
            } else {
                for xx in [4, 14] {
                    c.rect(x + xx + 2, y + 13, 1, 9, 15);
                    c.rect(x + xx, y + 4, 5, 11, 14);
                    c.rect(x + xx + 1, y + 3, 3, 1, 16);
                    c.rect(x + xx + 1, y + 6, 1, 6, 15)
                }
                c.rect(x + 1, y + 21, 22, 1, 6)
            }
        }
        4 => {
            if variant % 2 == 0 {
                for yy in [1, 12] {
                    c.rect(x, y + yy + 9, 24, 1, 6);
                    for (xx, col) in [(1, 7), (13, 11)] {
                        c.rect(x + xx + 4, y + yy + 2, 4, 3, col);
                        c.rect(x + xx + 2, y + yy + 5, 7, 2, col);
                        c.rect(x + xx, y + yy + 6, 10, 2, col);
                        c.rect(x + xx, y + yy + 8, 10, 1, 7);
                        c.pixel(x + xx + 5, y + yy + 4, 25)
                    }
                }
            } else {
                c.rect(x + 2, y + 1, 9, 5, 25);
                c.rect(x + 3, y + 6, 7, 11, 25);
                c.text(x + 5, y + 9, "7", 7);
                c.rect(x + 15, y + 12, 8, 8, 15);
                c.line(x + 16, y + 13, x + 21, y + 18, 13);
                c.line(x + 20, y + 12, x + 17, y + 19, 13)
            }
        }
        5 => {
            if variant % 2 == 0 {
                c.rect(x + 1, y + 7, 22, 13, 4);
                c.rect(x + 5, y + 4, 12, 2, 6);
                c.rect(x + 5, y + 4, 1, 4, 6);
                c.rect(x + 17, y + 4, 1, 4, 6);
                for xx in [3, 16] {
                    c.rect(x + xx, y + 11, 5, 7, 0);
                    c.rect(x + xx + 1, y + 12 + a, 3, 3, 6)
                }
                c.rect(x + 9, y + 10, 5, 5, 0);
                c.rect(x + 10, y + 11, 3, 1, 25);
                c.rect(x + 8, y + 17, 7, 1, 7)
            } else {
                for xx in [1, 12] {
                    c.rect(x + xx, y + 2, 10, 10, 0);
                    c.rect(x + xx + 3, y + 5, 4, 4, 29);
                    c.pixel(x + xx + 4, y + 6, 7);
                    c.rect(x + xx, y + 14, 9, 7, 7);
                    c.rect(x + xx + 1, y + 16, 7, 2, 0);
                    c.pixel(x + xx + 2, y + 16, 6);
                    c.pixel(x + xx + 6, y + 16, 6)
                }
            }
        }
        6 => {
            if variant % 2 == 0 {
                c.rect(x + 2, y + 2, 7, 11, 14);
                c.rect(x + 3, y + 3, 5, 7, 15);
                c.rect(x + 5, y + 11, 10, 5, 14);
                c.rect(x + 12, y + 14, 7, 4, 14);
                c.rect(x, y + 9, 4, 3, 6);
                c.rect(x + 12, y + 9, 4, 5, 6);
                c.line(x + 8, y + 16, x + 8, y + 21, 6);
                c.rect(x + 3, y + 21, 13, 1, 7)
            } else {
                c.rect(x + 2, y + 17, 7, 5, 7);
                c.rect(x + 15, y + 17, 7, 5, 7);
                c.rect(x + 4, y + 13, 3, 4, 6);
                c.rect(x + 17, y + 12, 3, 5, 6);
                for yy in -4i32..5 {
                    for xx in -4i32..5 {
                        if xx * xx + yy * yy < 18 {
                            c.pixel(x + 5 + xx, y + 8 + yy, if xx < 0 { 26 } else { 19 });
                            c.pixel(x + 18 + xx, y + 7 + yy, if a == 0 { 16 } else { 29 })
                        }
                    }
                }
            }
        }
        7 => {
            if variant % 2 == 0 {
                c.rect(x + 3, y + 1, 7, 2, 6);
                c.rect(x + 4, y + 3, 5, 15, 28);
                c.rect(x + 5, y + 6 + a * 4, 3, 4, 30);
                c.rect(x + 5, y + 13 - a * 3, 3, 3, 11);
                c.rect(x + 3, y + 18, 7, 3, 6);
                c.rect(x + 2, y + 21, 9, 1, 5)
            } else {
                for yy in -6i32..7 {
                    for xx in -6i32..7 {
                        if xx * xx + yy * yy < 40 {
                            c.pixel(x + 12 + xx, y + 9 + yy, 28)
                        }
                    }
                }
                c.line(x + 12, y + 9, x + 8 - a, y + 4, 30);
                c.line(x + 12, y + 9, x + 17, y + 8 + a, 25);
                c.line(x + 12, y + 9, x + 10, y + 14, 30);
                c.pixel(x + 12, y + 9, 7);
                c.rect(x + 10, y + 15, 4, 5, 6);
                c.rect(x + 6, y + 20, 12, 2, 5)
            }
        }
        _ => {
            if variant % 2 == 0 {
                c.rect(x + 2, y + 1, 19, 12, 6);
                c.rect(x + 4, y + 3, 15, 8, 22);
                c.rect(x + 5, y + 9, 13, 1, 19);
                c.rect(x + 7 + a * 4, y + 6, 3, 3, 20);
                c.rect(x + 10, y + 13, 3, 2, 5);
                c.rect(x + 1, y + 16, 21, 5, 6);
                c.rect(x + 3, y + 17, 7, 1, 0);
                c.rect(x + 4, y + 20, 15, 1, 4);
                c.pixel(x + 19, y + 18, 11)
            } else {
                c.rect(x + 1, y + 1, 22, 21, 7);
                c.text(x + 3, y + 3, "TO THE", 0);
                c.text(x + 5, y + 9, "MOON", 0);
                c.rect(x + 11, y + 13, 3, 5, 11);
                c.rect(x + 10, y + 18, 5, 1, 11);
                c.pixel(x + 12, y + 20, 15)
            }
        }
    }
}
fn room(g: &Game, c: &mut Canvas) {
    let s = STORES[g.store];
    let r = &g.rooms[g.store];
    let ox = (g.p.x - 122).clamp(0, (r.w - 256).max(0));
    let oy = (g.p.y - 120).clamp(0, (r.h - 176).max(0));
    let theme = [28, 23, 14, 18, 24, 27, 17, 8, 22][s.theme];
    c.rect(0, 16, 256, 200, theme);
    for y in (32..208).step_by(16) {
        for x in (0..256).step_by(16) {
            c.rect(
                x,
                y,
                15,
                15,
                if s.theme == 0 {
                    if (x + y) / 16 % 2 == 0 {
                        2
                    } else {
                        3
                    }
                } else if s.theme == 2 {
                    if (x + y) / 16 % 2 == 0 {
                        20
                    } else {
                        18
                    }
                } else if s.theme == 3 {
                    if (x + y) / 16 % 2 == 0 {
                        15
                    } else {
                        7
                    }
                } else if s.theme == 4 {
                    14
                } else if s.theme == 5 {
                    if y % 32 == 0 {
                        13
                    } else {
                        14
                    }
                } else if s.theme == 7 {
                    0
                } else {
                    if (x + y) / 16 % 2 == 0 {
                        22
                    } else {
                        23
                    }
                },
            );
            if s.theme == 7 {
                c.pixel(x + 5, y + 5, 29)
            }
        }
    }
    c.rect(0, 16, 256, 20, theme);
    c.rect(0, 16, 10, 193, theme);
    c.rect(246, 16, 10, 193, theme);
    c.center(23, s.name, 7);
    c.rect(10, 35, 236, 2, 15);
    c.rect(10, 192, 99, 16, theme);
    c.rect(147, 192, 99, 16, theme);
    c.rect(110, 192, 36, 17, 14);
    c.center(199, "EXIT", 16);
    for (i, f) in r.fixtures.iter().enumerate() {
        let x = f.x - ox;
        let y = f.y + 32 - oy;
        c.rect(x + 2, y + 3, f.w, f.h, 0);
        c.rect(x, y, f.w, f.h, theme);
        c.outline(x, y, f.w, f.h, if f.open { 4 } else { 6 });
        if f.open {
            c.rect(x + 3, y + 3, f.w - 6, f.h - 7, 0);
            c.rect(x - 2, y - 2, f.w + 4, 5, 14);
            c.rect(x + 4, y + f.h - 5, 8, 2, 7)
        } else {
            display(c, x + 1, y + 1, s.theme + (i % 2) * 9, g.frame);
            if f.kind == 1 {
                c.rect(x + 2, y + 2, f.w - 4, f.h - 3, 29);
                c.rect(x + f.w / 2, y + 2, 1, f.h - 4, 8)
            }
            if g.p.radar && f.content == 1 && g.frame / 12 % 2 == 0 {
                c.text(x + 10, y - 8, "!", 16)
            }
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
            g.frame / 10,
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
        c.rect(t.x - ox, t.y + 32 - oy, 8, 7, 15);
        c.pixel(t.x + 2 - ox, t.y + 34 - oy, 0)
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
    c.text_scale(42, 40, "SPYGRAM", 7, 2);
    c.rect(39, 60, 178, 80, 22);
    for i in 0..10 {
        c.rect(40 + i * 18, 95 - (i % 3) * 7, 12, 45, 1);
        c.rect(43 + i * 18, 100 - (i % 3) * 7, 3, 3, 15)
    }
    c.sprite(115, 97, 0, 0, false);
    c.rect(129, 98, 6, 9, 7);
    c.text(44, 65, "AGENT_7 / PUBLIC", 25);
    let (a, b, comment) = if complete {
        copy::COMPLETE[g.card % 10]
    } else {
        copy::ARRIVAL[g.card % 10]
    };
    c.text(43, 150, a, 7);
    c.text(43, 159, b, 7);
    c.text(43, 175, &format!("<3 {} LIKES", g.scene_t * 17 + 1), 11);
    c.text(43, 188, comment, 25);
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
    c.rect(x - 5, y - 8, 10, 8, 14);
    c.line(x, y - 8, x, y - 23, 19);
    c.rect(x - 9, y - 20, 9, 5, 18);
    c.rect(x, y - 25, 9, 6, 20);
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
