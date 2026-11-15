//! Painting the room, its characters and the bottom strip. Read-only: nothing here changes the state.

use crate::art;
use crate::copy;
use crate::pixel::{pal, text_width, Fb, FontKind, Rect, H, W};
use crate::run::RunState;
use crate::types::Content;
use crate::ui;

use super::templates::{Tile, CAVE_CLERK_PX, CAVE_PEDESTAL_PX, CAVE_TVS_PX};
use super::*;

/// Dark rooms (black-light novelty shop, the cave) get a thin light outline round characters so black hair
/// and suits never vanish into the floor.
fn rim_color(r: &StoreRoom) -> Option<u8> {
    if r.egg.is_some() {
        Some(pal::LBLUE)
    } else if r.id.info().theme == crate::types::Theme::Novelty {
        Some(pal::LPURPLE)
    } else {
        None
    }
}

fn outline(fb: &mut Fb, rim: Option<u8>, s: &crate::pixel::Sprite, frame: usize, x: i32, y: i32, flip: bool) {
    if let Some(c) = rim {
        for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
            fb.blit_flat(s, frame, x + dx, y + dy, flip, c);
        }
    }
}

enum Ent {
    Toy(usize),
    Guard(usize),
    Player,
}

fn dir_sprite(prefix: &str, d: Dir) -> (String, bool) {
    match d {
        Dir::Up => (format!("{prefix}_up"), false),
        Dir::Down => (format!("{prefix}_down"), false),
        Dir::Left => (format!("{prefix}_side"), true),
        Dir::Right => (format!("{prefix}_side"), false),
    }
}

pub(super) fn draw_room(r: &StoreRoom, fb: &mut Fb, run: &RunState, tick: u32) {
    // Room area background.
    // The cave is a dark blue void (not pure black, so the agent's black hair stays visible).
    fb.rect(0, VIEW_Y, W as i32, VIEW_H, if r.egg.is_some() { pal::NAVY } else { pal::BLACK });
    let (camx, camy) = r.cam();
    let (ox, oy) = (-camx, VIEW_Y - camy);
    let old = fb.set_clip(Rect::new(0, VIEW_Y, VIEW_W, VIEW_H));

    let cave = r.egg.is_some();
    draw_tiles(r, fb, run, tick, ox, oy, cave);
    if cave {
        draw_cave(r, fb, tick, ox, oy);
    }

    // Characters sorted by their feet.
    let mut ents: Vec<(i32, Ent)> = Vec::new();
    for (i, t) in r.toys.iter().enumerate() {
        ents.push((t.y as i32 + 16, Ent::Toy(i)));
    }
    for (i, g) in r.guards.iter().enumerate() {
        if !g.gone {
            ents.push((g.y.round() as i32 + 16, Ent::Guard(i)));
        }
    }
    ents.push((r.player.y + 16, Ent::Player));
    ents.sort_by_key(|e| e.0);
    for (_, e) in &ents {
        match e {
            Ent::Toy(i) => {
                let t = &r.toys[*i];
                art::draw(fb, "windup_toy", t.x as i32 + ox, t.y as i32 + oy, t.dx < 0, tick, 8);
            }
            Ent::Guard(i) => draw_guard(r, fb, &r.guards[*i], tick, ox, oy),
            Ent::Player => draw_player(r, fb, run, tick, ox, oy),
        }
    }

    // Bullets and puffs.
    for b in &r.bullets {
        let (x, y) = (b.x as i32 + ox, b.y as i32 + oy);
        match b.kind {
            BKind::Player => art::draw(fb, "bullet_td", x - 2, y - 2, false, 0, 1),
            BKind::Enemy => art::draw(fb, "bullet_td_enemy", x - 2, y - 2, false, 0, 1),
            BKind::Shoe => art::draw(fb, "shoe", x - 4, y - 4, b.vx < 0.0, tick, 4),
        }
    }
    for p in &r.puffs {
        if p.spark {
            art::draw_frame(fb, "spark", (p.t / 8) as usize, p.x + ox + 4, p.y + oy + 4, false);
        } else {
            art::draw_frame(fb, "puff_smoke", (p.t / 6) as usize, p.x + ox, p.y + oy, false);
        }
    }
    fb.set_clip(old);
    fb.reset_clip();

    // Speech bubbles (screen coordinates, kept on screen by ui::speech_bubble).
    for b in &r.bubbles {
        if b.delay > 0 {
            continue;
        }
        let (tx, ty) = r.bubble_tip(b);
        ui::speech_bubble(fb, &b.text, tx + ox, ty + oy);
    }
    draw_egg_text(r, fb);
    draw_strip(r, fb, run, tick);
}

fn draw_tiles(r: &StoreRoom, fb: &mut Fb, run: &RunState, tick: u32, ox: i32, oy: i32, cave: bool) {
    let g = &r.grid;
    let a = &r.art;
    let (dx, dy) = g.door;
    let (pcx, pcy) = r.player_center();
    let door_open = (pcx - (dx * TILE + 8)).abs() < 26 && (pcy - (dy * TILE + 8)).abs() < 30;
    for ty in 0..g.h {
        for tx in 0..g.w {
            let (x, y) = (tx * TILE + ox, ty * TILE + oy);
            if x + TILE <= 0 || x >= VIEW_W || y + TILE <= VIEW_Y || y >= VIEW_Y + VIEW_H {
                continue;
            }
            let t = g.tile(tx, ty);
            if cave {
                match t {
                    Tile::Wall => art::draw(fb, &a.wall, x, y, false, 0, 1),
                    Tile::Door => art::draw_frame(fb, "t_door", door_open as usize, x, y, false),
                    _ => {}
                }
                continue;
            }
            match t {
                Tile::Wall => art::draw(fb, &a.wall, x, y, false, 0, 1),
                Tile::Door => art::draw_frame(fb, "t_door", door_open as usize, x, y, false),
                Tile::Floor => art::draw(fb, &a.floor, x, y, false, 0, 1),
                Tile::Floor2 => art::draw(fb, &a.floor2, x, y, false, 0, 1),
                _ => {
                    art::draw(fb, &a.floor, x, y, false, 0, 1);
                    let opened = g.fixture_index(tx, ty).map_or(false, |i| run.is_opened(r.id, i));
                    let name: &str = match t {
                        Tile::FixA => {
                            if opened {
                                &a.fixa_o
                            } else {
                                &a.fixa
                            }
                        }
                        Tile::FixB => {
                            if opened {
                                &a.fixb_o
                            } else {
                                &a.fixb
                            }
                        }
                        Tile::Counter => &a.counter,
                        Tile::DecorA => &a.decora,
                        Tile::DecorB => &a.decorb,
                        Tile::Fitting => {
                            if opened {
                                "t_fitting_open"
                            } else {
                                "t_fitting"
                            }
                        }
                        Tile::ToyShelf => {
                            if opened {
                                "t_toyshelf_open"
                            } else {
                                "t_toyshelf"
                            }
                        }
                        Tile::Booth => "t_booth",
                        Tile::Vending => "t_vending",
                        _ => &a.floor,
                    };
                    art::draw(fb, name, x, y, false, tick, 12);
                }
            }
        }
    }
    // Radar: a flashing "!" over fixtures that hold the package.
    if run.power.radar && !cave {
        if let Some(list) = run.fixtures.get(&r.id) {
            for (i, &(fx, fy)) in r.tpl.fixtures.iter().enumerate() {
                if list.get(i) == Some(&Content::Package) && !run.is_opened(r.id, i) {
                    art::draw(fb, "t_exclaim_fixture", fx * TILE + ox, fy * TILE + oy, false, tick, 10);
                }
            }
        }
    }
}

fn draw_cave(r: &StoreRoom, fb: &mut Fb, tick: u32, ox: i32, oy: i32) {
    let Some(egg) = &r.egg else { return };
    for (tx, ty) in CAVE_TVS_PX {
        art::draw(fb, "demo_tv", tx + ox, ty + oy, false, tick, 10);
    }
    if egg.clerk_visible {
        art::draw(fb, "clerk", CAVE_CLERK_PX.0 + ox, CAVE_CLERK_PX.1 + oy, false, tick, 24);
    }
    if matches!(egg.phase, EggPhase::Wait | EggPhase::Hold) {
        let (px, py) = CAVE_PEDESTAL_PX;
        art::draw(fb, "pedestal", px + ox, py + oy, false, 0, 1);
        if egg.phase == EggPhase::Wait {
            let bob = if (tick / 12) % 2 == 0 { 0 } else { 1 };
            art::draw(fb, "gold_coin", px + 4 + ox, py - 8 + oy + bob, false, tick, 6);
        }
    }
}

fn draw_egg_text(r: &StoreRoom, fb: &mut Fb) {
    let Some(egg) = &r.egg else { return };
    let show = egg.phase == EggPhase::Text || (egg.phase == EggPhase::Wait && egg.t < 50);
    if !show {
        return;
    }
    let text = copy::EASTER_EGG_TEXT;
    let n = if egg.phase == EggPhase::Text { (egg.t / EGG_FRAMES_PER_CHAR) as usize } else { text.chars().count() };
    let lines = copy::wrap(text, 28);
    let bw = 28 * 6 + 12;
    let bx = (W as i32 - bw) / 2;
    let by = VIEW_Y + 20;
    let bh = lines.len() as i32 * 10 + 8;
    fb.rect(bx, by, bw, bh, pal::BLACK);
    fb.frame(bx, by, bw, bh, pal::WHITE);
    fb.frame(bx + 2, by + 2, bw - 4, bh - 4, pal::DGRAY);
    let mut left = n;
    for (i, l) in lines.iter().enumerate() {
        let len = l.chars().count();
        let take = left.min(len);
        let s: String = l.chars().take(take).collect();
        fb.text(bx + 7, by + 5 + i as i32 * 10, &s, pal::WHITE);
        left -= take;
        // wrapped lines drop the space between them
        left = left.saturating_sub(1);
        if left == 0 {
            break;
        }
    }
}

fn draw_player(r: &StoreRoom, fb: &mut Fb, run: &RunState, tick: u32, ox: i32, oy: i32) {
    let p = &r.player;
    let (x, y) = (p.x + ox, p.y + oy);
    if p.dying > 0 {
        // Spin round, then blink out.
        if p.dying < 50 {
            let d = [Dir::Down, Dir::Left, Dir::Up, Dir::Right][((p.dying / 5) % 4) as usize];
            let (n, flip) = dir_sprite("agent_td", d);
            art::draw_frame(fb, &n, 0, x, y, flip);
        } else if (p.dying / 3) % 2 == 0 {
            art::draw_frame(fb, "agent_td_stun", 0, x, y + 2, false);
        }
        return;
    }
    if p.invuln > 0 && (tick / 3) % 2 == 0 {
        return;
    }
    let invincible = run.power.is_invincible();
    let recolor = |s: &crate::pixel::Sprite| -> [u8; 3] {
        if invincible {
            let k = (tick / 3) % 3;
            let pal3 = [pal::YELLOW, pal::WHITE, pal::ORANGE];
            [pal3[k as usize], pal3[(k as usize + 1) % 3], pal3[(k as usize + 2) % 3]]
        } else {
            s.colors
        }
    };
    let rim = rim_color(r);
    if let Some((item, _)) = p.hold {
        let s = art::get("agent_td_hold");
        outline(fb, rim, s, 0, x, y, false);
        fb.blit_col(s, 0, x, y, false, recolor(s));
        match item {
            HeldItem::Package => art::draw(fb, "package", x, y - 15, false, 0, 1),
            HeldItem::Power(pu) => art::draw(fb, pu.sprite_name(), x + 2, y - 13, false, 0, 1),
            HeldItem::Joke => art::draw(fb, "gold_coin", x + 4, y - 9, false, tick, 6),
        }
        return;
    }
    if p.stun > 0 {
        let s = art::get("agent_td_stun");
        outline(fb, rim, s, (p.stun / 6) as usize % s.frame_count(), x, y, false);
        fb.blit_col(s, (p.stun / 6) as usize % s.frame_count(), x, y, false, recolor(s));
        // little stars
        art::draw_frame(fb, "spark", ((tick / 5) % 3) as usize, x + 4, y - 6, false);
        return;
    }
    let (name, flip) = dir_sprite("agent_td", p.face);
    let s = art::get(&name);
    let frame = if p.moving { 1 + ((p.anim / 6) % 2) as usize } else { 0 };
    outline(fb, rim, s, frame, x, y, flip);
    fb.blit_col(s, frame, x, y, flip, recolor(s));
    // Search: a little progress ring above the head.
    if let Some(se) = p.search {
        ui::bar(fb, x + 2, y - 5, 12, 3, se.t as f32 / se.total as f32, pal::YELLOW, pal::BLACK);
        fb.frame(x + 1, y - 6, 14, 5, pal::WHITE);
    }
}

fn draw_guard(r: &StoreRoom, fb: &mut Fb, g: &Guard, tick: u32, ox: i32, oy: i32) {
    let (x, y) = (g.x.round() as i32 + ox, g.y.round() as i32 + oy);
    let rim = rim_color(r);
    match g.kind {
        GKind::Bot => {
            let s = art::get("bot_td");
            let frame = ((g.anim / 8) % 2) as usize;
            if g.dying == 0 {
                outline(fb, rim, s, frame, x, y, g.face == Dir::Left);
            }
            if g.dying > 0 {
                if (g.dying / 3) % 2 == 0 {
                    fb.blit_flat(s, frame, x, y, false, pal::WHITE);
                }
            } else if g.flash > 0 {
                fb.blit_flat(s, frame, x, y, false, pal::WHITE);
            } else {
                fb.blit(s, frame, x, y, g.face == Dir::Left);
            }
        }
        GKind::Spy => {
            let (name, flip) = dir_sprite("spy_td", g.face);
            let s = art::get(&name);
            let moving = g.target.is_some();
            let frame = if moving { 1 + ((g.anim / 6) % 2) as usize } else { 0 };
            if g.dying == 0 {
                outline(fb, rim, s, frame, x, y, flip);
            }
            if g.dying > 0 {
                if (g.dying / 3) % 2 == 0 {
                    fb.blit_flat(s, frame, x, y, flip, pal::WHITE);
                }
            } else if g.aim > 0 {
                // Telegraph: flash and show the line of fire.
                let c = if (g.aim / 3) % 2 == 0 { pal::LRED } else { pal::WHITE };
                fb.blit_col(s, 0, x, y, flip, [s.colors[0], c, s.colors[2]]);
                let (vx, vy) = g.face.vec();
                for k in 0..10 {
                    let d = 10 + k * 5;
                    fb.rect(x + 8 + vx * d - 1, y + 8 + vy * d - 1, 2, 2, pal::LRED);
                }
            } else {
                fb.blit(s, frame, x, y, flip);
            }
        }
    }
    if g.stun > 0 && g.dying == 0 {
        art::draw_frame(fb, "spark", ((tick / 6) % 3) as usize, x + 4, y - 7, false);
    }
}

fn draw_strip(r: &StoreRoom, fb: &mut Fb, run: &RunState, tick: u32) {
    let top = VIEW_Y + VIEW_H; // 192
    fb.rect(0, top, W as i32, H as i32 - top, pal::BLACK);
    fb.hline(0, top, W as i32, pal::GRAY);
    fb.hline(0, top + 1, W as i32, pal::DGRAY);
    let info = r.id.info();
    // Name plate in the store's sign colours.
    let tw = text_width(FontKind::Normal, info.name);
    let pw = tw + 14;
    let px = (W as i32 - pw) / 2;
    fb.rect(px, top + 6, pw, 12, info.sign_color);
    fb.frame(px, top + 6, pw, 12, pal::WHITE);
    fb.text_center(W as i32 / 2, top + 9, info.name, info.sign_text);

    if let Some(s) = r.player.search {
        fb.text_center(W as i32 / 2, top + 24, copy::SEARCHING, pal::YELLOW);
        let bw = 120;
        let bx = (W as i32 - bw) / 2;
        fb.frame(bx - 2, top + 34, bw + 4, 10, pal::WHITE);
        ui::bar(fb, bx, top + 36, bw, 6, s.t as f32 / s.total.max(1) as f32, pal::LGREEN, pal::DGRAY);
    } else if r.banner.active() {
        let (fg, bg, border) = r.banner_cols;
        r.banner.draw(fb, top + 22, fg, bg, border);
    } else if r.can_search(run) {
        let c = if (tick / 20) % 2 == 0 { pal::WHITE } else { pal::LYELLOW };
        fb.text_center(W as i32 / 2, top + 28, copy::SEARCH_PROMPT, c);
    }
}
