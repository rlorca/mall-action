use super::widgets::{draw_banner_at, draw_bar_bg, draw_bubbles, draw_popups, SCREEN_W};
use crate::art::registry::get_sprite;
use crate::content::copy::{EASTER_EGG, UI};
use crate::content::themes::ThemeId;
use crate::engine::font::{draw_text, wrap_text, Align, TextOpts};
use crate::engine::framebuffer::{BlitOpts, Framebuffer};
use crate::engine::num::round_i;
use crate::engine::palette::c;
use crate::game::run::Run;
use crate::game::store::room::{is_solid_kind, tile_at, TileKind, TILE};
use crate::game::store::world::{Agent, BulletKind, Dir, EggPhase, Guard, HeldKind, PuffKind, StoreWorld, ROOM_TOP, VIEW_H, VIEW_W};
use crate::game::store::room::GuardKind;

/// Draws a StoreWorld: the room area (y = 16 .. 192, 256 x 176) and the bottom strip
/// (y = 192 .. 240) with the store name and the search prompt / progress bar. Reads
/// game state only; never mutates it. Everything is clipped to its area, text is
/// clamped or sized to fit so nothing runs off screen.
///
/// Rust port note: `StoreWorld` keeps the persistent per-level state in `Run` (TS: `world.run`), so the
/// renderer takes `&Run` next to the world (fixture_opened / radar_marked / invincible read it).
pub const STRIP_TOP: i32 = ROOM_TOP + VIEW_H; // 192

fn theme_color(t: ThemeId) -> u8 {
    match t {
        ThemeId::Fashion => c::HOTPINK,
        ThemeId::Electronics => c::CYAN,
        ThemeId::Toys => c::YELLOW,
        ThemeId::Food => c::AMBER,
        ThemeId::Sports => c::LTGREEN,
        ThemeId::Music => c::LAVENDER,
        ThemeId::Gadgets => c::LTBLUE,
        ThemeId::Novelty => c::PALEMAGENTA,
        ThemeId::Games => c::LIME,
    }
}

struct Ctx<'a> {
    world: &'a StoreWorld,
    run: &'a Run,
    frame: i32,
    /// Room pixel -> screen pixel offsets.
    ox: i32,
    oy: i32,
}

/// Draw the whole store screen below the HUD.
pub fn draw_store_view(fb: &mut Framebuffer, world: &StoreWorld, run: &Run, frame: i32) {
    let ctx = Ctx { world, run, frame, ox: -world.cam_x, oy: ROOM_TOP - world.cam_y };
    fb.fill_rect(0, ROOM_TOP, SCREEN_W, VIEW_H, c::BLACK);
    fb.push_clip(0, ROOM_TOP, VIEW_W, VIEW_H);
    draw_tiles(fb, &ctx);
    draw_fixture_marks(fb, &ctx);
    draw_entities(fb, &ctx);
    draw_overlays(fb, &ctx);
    fb.pop_clip();
    draw_strip(fb, &ctx);
}

/// Alias kept for AGENTS.md ("drawStore(fb, world, frame)").
pub fn draw_store(fb: &mut Framebuffer, world: &StoreWorld, run: &Run, frame: i32) {
    draw_store_view(fb, world, run, frame)
}

// ------------------------------------------------------------------ tiles
fn spr_name(theme: ThemeId, k: &str) -> String {
    format!("st.{}.{}", theme.as_str(), k)
}

fn draw_tiles(fb: &mut Framebuffer, ctx: &Ctx) {
    let Ctx { world, run, frame, ox, oy } = *ctx;
    let room = &world.room;
    let theme = room.theme;
    let floor = get_sprite(&spr_name(theme, "floor"));
    let wall = get_sprite(&spr_name(theme, "wall"));
    let mut fixture_at: Vec<i32> = vec![-1; (room.cols * room.rows) as usize];
    for f in &room.fixtures {
        fixture_at[(f.row * room.cols + f.col) as usize] = f.index as i32;
    }
    let c0 = 0.max((-ox).div_euclid(TILE));
    let c1 = (room.cols - 1).min((VIEW_W - ox).div_euclid(TILE));
    let r0 = 0.max((ROOM_TOP - oy).div_euclid(TILE));
    let r1 = (room.rows - 1).min((ROOM_TOP + VIEW_H - oy).div_euclid(TILE));
    let none = BlitOpts::default();
    let opened = |i: i32| i >= 0 && world.fixture_opened(run, i as usize);
    for row in r0..=r1 {
        for col in c0..=c1 {
            let kind = tile_at(room, col, row);
            let x = col * TILE + ox;
            let y = row * TILE + oy;
            if kind == TileKind::Wall {
                fb.sprite(wall, x, y, &none);
                continue;
            }
            if kind == TileKind::Door {
                if col == room.door.col {
                    fb.sprite(floor, x, y, &none);
                    fb.sprite(floor, x + TILE, y, &none);
                    fb.sprite(get_sprite("st.door"), x, y, &none);
                }
                continue;
            }
            fb.sprite(floor, x, y, &none);
            match kind {
                TileKind::Counter | TileKind::Decor => {
                    fb.sprite(get_sprite(&spr_name(theme, kind.as_str())), x, y, &none);
                }
                TileKind::Shelf | TileKind::Rack => {
                    let open = opened(fixture_at[(row * room.cols + col) as usize]);
                    let name = if open { format!("{}.open", kind.as_str()) } else { kind.as_str().to_string() };
                    fb.sprite(get_sprite(&spr_name(theme, &name)), x, y, &none);
                }
                TileKind::Fitting => {
                    let i = fixture_at[(row * room.cols + col) as usize];
                    let open = opened(i) || (i >= 0 && world.peeked.contains(&(i as usize)));
                    fb.sprite(get_sprite(if open { "st.fitting.open" } else { "st.fitting" }), x, y, &none);
                }
                TileKind::Toyshelf => {
                    fb.sprite(get_sprite(if world.toy_shelf_released(col, row) { "st.toyshelf.open" } else { "st.toyshelf" }), x, y, &none);
                }
                TileKind::Booth => {
                    let here = world.on_booth && (world.agent.x / TILE as f64).floor() as i32 == col && (world.agent.y / TILE as f64).floor() as i32 == row;
                    let f = if here || (world.on_booth && frame % 16 < 8) { 1 } else { 0 };
                    fb.sprite(get_sprite("st.booth"), x, y, &BlitOpts::default().frame(f));
                }
                TileKind::Tv => {
                    fb.sprite(get_sprite("st.tv"), x, y, &BlitOpts::default().frame((frame.div_euclid(7) + col) % 3));
                }
                TileKind::Pedestal => {
                    if matches!(&world.egg, Some(e) if e.phase != EggPhase::Done) {
                        fb.sprite(get_sprite("st.pedestal"), x, y, &none);
                    }
                }
                _ => {}
            }
        }
    }
}

/// Radar "!" over the package fixture, and a blinking bracket on the fixture a B tap would search.
fn draw_fixture_marks(fb: &mut Framebuffer, ctx: &Ctx) {
    let Ctx { world, run, frame, ox, oy } = *ctx;
    for f in &world.room.fixtures {
        let x = f.col * TILE + ox;
        let y = f.row * TILE + oy;
        if world.radar_marked(run, f.index) && frame % 24 < 14 {
            draw_text(fb, "!", x + TILE / 2, y + 4, c::YELLOW, &TextOpts::default().align(Align::Center).outline(c::BLACK));
        }
    }
    let t: i32 = match &world.search {
        Some(s) => s.fixture as i32,
        None => {
            if world.can_search() {
                world.search_target
            } else {
                -1
            }
        }
    };
    if t >= 0 && (world.search.is_some() || frame % 20 < 14) {
        let f = &world.room.fixtures[t as usize];
        let x = f.col * TILE + ox;
        let y = f.row * TILE + oy;
        let col = if world.search.is_some() { c::YELLOW } else { c::WHITE };
        for (cx, cy, dx, dy) in [(x, y, 1, 1), (x + TILE - 1, y, -1, 1), (x, y + TILE - 1, 1, -1), (x + TILE - 1, y + TILE - 1, -1, -1)] {
            fb.h_line(if dx > 0 { cx } else { cx - 3 }, cy, 4, col);
            fb.v_line(cx, if dy > 0 { cy } else { cy - 3 }, 4, col);
        }
    }
}

// ------------------------------------------------------------------ entities
#[derive(Clone, Copy)]
enum Layer {
    Clerk,
    Pedestal,
    Toy(usize),
    Guard(usize),
    Agent,
}

fn draw_entities(fb: &mut Framebuffer, ctx: &Ctx) {
    let Ctx { world, frame, ox, oy, .. } = *ctx;
    let mut layers: Vec<(f64, Layer)> = Vec::new();

    if world.clerk_visible() {
        if let Some(cl) = &world.room.clerk {
            layers.push(((cl.row * TILE) as f64, Layer::Clerk));
        }
    }
    if world.pedestal_item().is_some() {
        if let Some(p) = &world.room.pedestal {
            layers.push(((p.row * TILE) as f64, Layer::Pedestal));
        }
    }
    for (i, t) in world.toys.iter().enumerate() {
        layers.push((t.y, Layer::Toy(i)));
    }
    for (i, g) in world.guards.iter().enumerate() {
        layers.push((g.y, Layer::Guard(i)));
    }
    layers.push((world.agent.y, Layer::Agent));
    layers.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal)); // stable, like Array.sort
    for (_, l) in &layers {
        match *l {
            Layer::Clerk => {
                let cl = world.room.clerk.as_ref().unwrap();
                fb.sprite(get_sprite("td.clerk"), cl.col * TILE + ox, cl.row * TILE + oy, &BlitOpts::default().frame(frame.div_euclid(20) % 2));
            }
            Layer::Pedestal => {
                let p = world.room.pedestal.as_ref().unwrap();
                let bob = round_i((frame as f64 / 8.0).sin() * 1.5);
                fb.sprite(get_sprite("item.joke"), p.col * TILE + 2 + ox, p.row * TILE + 1 + oy + bob, &BlitOpts::default());
                if frame % 16 < 8 {
                    fb.set_pixel(p.col * TILE + ox + 13, p.row * TILE + oy + 2 + bob, c::WHITE);
                }
            }
            Layer::Toy(i) => {
                let t = &world.toys[i];
                let winding = t.age > 540 && frame % 6 < 3;
                if !winding {
                    fb.sprite(
                        get_sprite("td.toy"),
                        round_i(t.x) - 8 + ox,
                        round_i(t.y) - 8 + oy,
                        &BlitOpts::default().frame(t.age.div_euclid(6) % 2).flip_x(t.dir == Dir::Left),
                    );
                }
            }
            Layer::Guard(i) => draw_guard(fb, ctx, &world.guards[i]),
            Layer::Agent => draw_agent(fb, ctx, &world.agent),
        }
    }

    // projectiles and puffs sit on top of the characters
    for b in &world.bullets {
        if b.kind == BulletKind::Shoe {
            fb.sprite(get_sprite("td.shoe"), round_i(b.x) - 4 + ox, round_i(b.y) - 4 + oy, &BlitOpts::default().frame(b.age.div_euclid(4) % 2));
        } else {
            let solid = if b.kind == BulletKind::Agent { c::WHITE } else { c::YELLOW };
            fb.sprite(get_sprite("td.bullet"), round_i(b.x) - 2 + ox, round_i(b.y) - 2 + oy, &BlitOpts::default().solid(solid));
        }
    }
    for p in &world.puffs {
        let prog = 1.0 - p.t as f64 / p.total as f64;
        if p.kind == PuffKind::Smoke {
            fb.sprite(get_sprite("fx.puff"), round_i(p.x) - 8 + ox, round_i(p.y) - 8 + oy, &BlitOpts::default().frame(3.min((prog * 4.0).floor() as i32)));
        } else {
            fb.sprite(get_sprite("fx.spark"), round_i(p.x) - 4 + ox, round_i(p.y) - 4 + oy, &BlitOpts::default().frame(2.min((prog * 3.0).floor() as i32)));
        }
    }
}

fn draw_guard(fb: &mut Framebuffer, ctx: &Ctx, g: &Guard) {
    let Ctx { world, frame, ox, oy, .. } = *ctx;
    if g.dead && frame % 4 < 2 {
        return;
    }
    let x = round_i(g.x) - 8 + ox;
    let y = round_i(g.y) - 8 + oy;
    let flash = g.hit_flash > 0 && frame % 2 == 0;
    let with_flash = |o: BlitOpts<'static>| if flash { o.solid(c::WHITE) } else { o };
    if g.kind == GuardKind::Bot {
        let f = if g.moving { g.anim.div_euclid(8) % 2 } else { 0 };
        fb.sprite(get_sprite("td.bot"), x, y, &with_flash(BlitOpts::default().frame(f).flip_x(g.facing == Dir::Left)));
    } else if g.change > 0 {
        fb.sprite(get_sprite("td.spy.change"), x, y, &with_flash(BlitOpts::default()));
    } else {
        let walk = if g.moving { g.anim.div_euclid(8) % 2 } else { 0 };
        if g.facing == Dir::Up {
            fb.sprite(get_sprite("td.spy.up"), x, y, &with_flash(BlitOpts::default().frame(walk)));
        } else if g.facing == Dir::Down {
            fb.sprite(get_sprite("td.spy.down"), x, y, &with_flash(BlitOpts::default().frame(walk)));
        } else {
            fb.sprite(get_sprite("td.spy.side"), x, y, &with_flash(BlitOpts::default().frame(walk).flip_x(g.facing == Dir::Left)));
        }
    }
    if g.aim > 0 {
        // telegraph: a blinking line of fire and a "!" over his head
        let (dx, dy) = g.aim_dir.vec();
        let mut px = g.x;
        let mut py = g.y;
        for i in 0..300 {
            px += dx * 2.0;
            py += dy * 2.0;
            if is_solid_kind(tile_at(&world.room, (px / TILE as f64).floor() as i32, (py / TILE as f64).floor() as i32)) {
                break;
            }
            if i > 4 && i % 3 == 0 && (frame.div_euclid(3)) % 2 == 0 {
                fb.fill_rect(round_i(px) + ox, round_i(py) + oy, 2, 2, c::RED);
            }
        }
        draw_text(fb, "!", round_i(g.x) + ox, round_i(g.y) - 17 + oy, c::RED, &TextOpts::default().align(Align::Center).outline(c::WHITE));
    }
    if g.stun > 0 && !g.dead {
        // orbiting stars
        for i in 0..3 {
            let a = frame as f64 / 9.0 + (i as f64 * std::f64::consts::PI * 2.0) / 3.0;
            fb.fill_rect(round_i(g.x + a.cos() * 6.0) + ox - 1, round_i(g.y - 10.0 + a.sin() * 2.0) + oy, 2, 2, c::YELLOW);
        }
    }
}

fn draw_agent(fb: &mut Framebuffer, ctx: &Ctx, a: &Agent) {
    let Ctx { run, frame, ox, oy, .. } = *ctx;
    let x = round_i(a.x) - 8 + ox;
    let y = round_i(a.y) - 8 + oy;
    if a.dying > 0 {
        // spin, then blink away
        if a.dying > 40 && frame % 4 < 2 {
            return;
        }
        let f = a.dying.div_euclid(4) % 4; // 0 down, 1 left, 2 up, 3 right
        let none = BlitOpts::default();
        match f {
            0 => fb.sprite(get_sprite("td.agent.down"), x, y, &none),
            2 => fb.sprite(get_sprite("td.agent.up"), x, y, &none),
            _ => fb.sprite(get_sprite("td.agent.side"), x, y, &BlitOpts::default().flip_x(f == 1)),
        }
        return;
    }
    if a.hurt > 0 && frame % 4 < 2 {
        return; // armour just soaked a hit: blink
    }
    let mut opts = BlitOpts::default();
    if run.invincible() && frame % 4 < 2 {
        opts = opts.solid(if run.power.invincible < 90 && frame % 8 < 4 { c::WHITE } else { c::YELLOW });
    }
    let walk = if a.moving { a.anim.div_euclid(4) % 2 } else { 0 };
    if let Some(hold) = &a.hold {
        fb.sprite(get_sprite("td.agent.hold"), x, y, &opts);
        let item = match hold.kind {
            HeldKind::Package => "item.package".to_string(),
            HeldKind::Joke => "item.joke".to_string(),
            HeldKind::Power => format!("item.{}", hold.power.map(|p| p.as_str()).unwrap_or("undefined")),
        };
        fb.sprite(get_sprite(&item), x + 2, y - 13, &BlitOpts::default());
        if frame % 8 < 4 {
            fb.set_pixel(x - 1, y - 12, c::WHITE);
            fb.set_pixel(x + 17, y - 6, c::WHITE);
        }
        return;
    }
    if a.stun > 0 {
        let mut o = opts;
        o.frame = frame.div_euclid(6) % 2;
        fb.sprite(get_sprite("td.agent.stun"), x, y, &o);
        return;
    }
    let mut o = opts;
    o.frame = walk;
    if a.facing == Dir::Up {
        fb.sprite(get_sprite("td.agent.up"), x, y, &o);
    } else if a.facing == Dir::Down {
        fb.sprite(get_sprite("td.agent.down"), x, y, &o);
    } else {
        o.flip_x = a.facing == Dir::Left;
        fb.sprite(get_sprite("td.agent.side"), x, y, &o);
    }
}

// ------------------------------------------------------------------ overlays (inside the room clip)
fn draw_overlays(fb: &mut Framebuffer, ctx: &Ctx) {
    let world = ctx.world;
    draw_bubbles(fb, &world.bubbles, world.cam_x as f64, (world.cam_y - ROOM_TOP) as f64);
    draw_popups(fb, &world.popups, world.cam_x as f64, (world.cam_y - ROOM_TOP) as f64);
    if let Some(b) = &world.banner {
        draw_banner_at(fb, b, ROOM_TOP + 8);
    }
    if let Some(typed) = world.typewriter() {
        draw_typewriter(fb, ctx, typed);
    }
}

fn char_len(s: &str) -> i32 {
    s.chars().count() as i32
}

/// Zelda-cave style text box: the full line is wrapped once so the words do not jump while it prints.
fn draw_typewriter(fb: &mut Framebuffer, ctx: &Ctx, typed: &str) {
    let frame = ctx.frame;
    let max_w = 196;
    let lines = wrap_text(EASTER_EGG.clerk, max_w, &TextOpts::default());
    let w = max_w + 16;
    let h = lines.len() as i32 * 10 + 12;
    let x = round_i((SCREEN_W - w) as f64 / 2.0);
    let y = ROOM_TOP + 66;
    fb.fill_rect(x, y, w, h, c::BLACK);
    fb.stroke_rect(x, y, w, h, c::WHITE);
    fb.stroke_rect(x + 2, y + 2, w - 4, h - 4, c::MDGRAY);
    let typed_len = char_len(typed);
    let mut left = typed_len;
    for (i, line) in lines.iter().enumerate() {
        let shown: String = line.chars().take(left.max(0) as usize).collect();
        draw_text(fb, &shown, x + 8, y + 6 + i as i32 * 10, c::WHITE, &TextOpts::default());
        left -= char_len(line) + 1; // the space the wrapper swallowed
    }
    if typed_len < char_len(EASTER_EGG.clerk) && frame % 12 < 6 {
        let li = (lines.len() as i32 - 1).min(wrap_index(&lines, typed_len));
        let used = typed_len - lines[..li as usize].iter().map(|l| char_len(l) + 1).sum::<i32>();
        fb.fill_rect(x + 8 + used.max(0) * 6, y + 6 + li * 10 + 6, 5, 1, c::WHITE);
    }
}

fn wrap_index(lines: &[String], chars: i32) -> i32 {
    let mut left = chars;
    for (i, l) in lines.iter().enumerate() {
        if left <= char_len(l) {
            return i as i32;
        }
        left -= char_len(l) + 1;
    }
    lines.len() as i32 - 1
}

// ------------------------------------------------------------------ bottom strip
fn draw_strip(fb: &mut Framebuffer, ctx: &Ctx) {
    let Ctx { world, run, frame, .. } = *ctx;
    let color = theme_color(world.room.theme);
    fb.fill_rect(0, STRIP_TOP, SCREEN_W, 240 - STRIP_TOP, c::BLACK);
    fb.fill_rect(0, STRIP_TOP, SCREEN_W, 1, c::WHITE);
    fb.fill_rect(0, STRIP_TOP + 1, SCREEN_W, 1, color);
    let name = world.name();
    let scale = if (char_len(name) * 6 - 1) * 2 <= SCREEN_W - 16 { 2 } else { 1 };
    draw_text(fb, name, SCREEN_W / 2, STRIP_TOP + 5, color, &TextOpts::default().align(Align::Center).scale(scale).shadow(c::DKBLUE));

    // line 1 (y 213): NOW PLAYING while on the listening booth, SEARCHING... during a search
    // line 2 (y 223): the prompt, or the progress bar
    let py = STRIP_TOP + 21;
    if world.search.is_some() {
        draw_text(fb, UI.searching, SCREEN_W / 2, py, c::WHITE, &TextOpts::default().align(Align::Center));
        fb.stroke_rect(63, py + 10, 130, 9, c::WHITE);
        draw_bar_bg(fb, 65, py + 12, 126, 5, world.search_progress(), c::LIME, c::DKGREEN);
    } else {
        if world.now_playing() {
            draw_text(fb, UI.now_playing, SCREEN_W / 2, py, if frame % 24 < 12 { c::HOTPINK } else { c::CYAN }, &TextOpts::default().align(Align::Center));
        }
        if world.can_search() && frame % 40 < 30 {
            draw_text(fb, UI.press_to_search, SCREEN_W / 2, py + if world.now_playing() { 11 } else { 4 }, c::YELLOW, &TextOpts::default().align(Align::Center));
        }
    }

    // one pip per searchable fixture: filled once it has been searched
    let n = world.room.fixtures.len() as i32;
    let pip = 5;
    let gap = 3;
    let total = n * pip + (n - 1) * gap;
    let mut x = round_i((SCREEN_W - total) as f64 / 2.0);
    for i in 0..n {
        if world.fixture_opened(run, i as usize) {
            fb.fill_rect(x, STRIP_TOP + 42, pip, pip, color);
        } else {
            fb.stroke_rect(x, STRIP_TOP + 42, pip, pip, c::MDGRAY);
        }
        x += pip + gap;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::stores::{open_stores, StoreId};
    use crate::engine::pad::BtnName::{B, Left};
    use crate::game::levelstate::FixtureContent;
    use crate::game::store::testutil::{empty_room, make_world, set_content, Made, MakeOpts};

    /// A palette index no art uses (renders as black but is not c::BLACK), so untouched pixels are detectable.
    const SENTINEL: u8 = 0x0d;

    fn render(m: &Made, frame: i32) -> Framebuffer {
        let mut fb = Framebuffer::new();
        fb.clear(SENTINEL);
        draw_store_view(&mut fb, &m.world, &m.run, frame);
        fb
    }

    fn opts() -> MakeOpts {
        MakeOpts::default()
    }

    fn snapshot(m: &Made) -> String {
        format!("{:?}", (&m.world.agent, &m.world.guards, &m.world.bullets, m.world.frame))
    }

    #[test]
    fn draws_every_store_room_the_room_area_is_filled_the_hud_strip_above_it_is_never_touched() {
        for def in open_stores() {
            let mut m = make_world(def.id, MakeOpts { guards: true, seen: false, ..opts() });
            m.idle(30);
            let fb = render(&m, 30);
            for y in 0..16 {
                for x in 0..256 {
                    assert_eq!(fb.get_pixel(x, y), SENTINEL, "{} {},{}", def.name, x, y);
                }
            }
            let mut sentinels = 0;
            for y in 16..240 {
                for x in 0..256 {
                    if fb.get_pixel(x, y) == SENTINEL {
                        sentinels += 1;
                    }
                }
            }
            assert_eq!(sentinels, 0, "{}", def.name);
        }
    }

    #[test]
    fn is_a_pure_read_drawing_does_not_change_the_world() {
        let mut m = make_world(StoreId::Footlock, MakeOpts { guards: true, ..opts() });
        m.idle(20);
        let snap = snapshot(&m);
        render(&m, 20);
        render(&m, 21);
        assert_eq!(snapshot(&m), snap);
    }

    #[test]
    fn is_deterministic_the_same_state_and_frame_draw_the_same_pixels() {
        let mut a = make_world(StoreId::Hotspy, MakeOpts { seed: 4, guards: true, ..opts() });
        let mut b = make_world(StoreId::Hotspy, MakeOpts { seed: 4, guards: true, ..opts() });
        a.idle(40);
        b.idle(40);
        assert_eq!(render(&a, 40).hash(), render(&b, 40).hash());
    }

    #[test]
    fn the_bottom_strip_shows_the_store_name_the_search_prompt_and_the_progress_bar() {
        let mut m = make_world(StoreId::Crookstone, opts());
        m.teleport(7, 8);
        let idle = render(&m, 5);
        let strip_pixels = |fb: &Framebuffer| -> i32 {
            let mut n = 0;
            for y in STRIP_TOP + 2..240 {
                for x in 0..256 {
                    if fb.get_pixel(x, y) != c::BLACK {
                        n += 1;
                    }
                }
            }
            n
        };
        let name_only = strip_pixels(&idle);
        assert!(name_only > 100);
        m.teleport(3, 2);
        m.idle(2);
        assert!(m.world.can_search());
        let prompt = render(&m, 5);
        assert!(strip_pixels(&prompt) > name_only + 50);
        m.tap(&[B]);
        m.idle(20);
        let lime_pixels = |fb: &Framebuffer| -> i32 {
            let mut n = 0;
            for y in STRIP_TOP + 2..240 {
                for x in 0..256 {
                    if fb.get_pixel(x, y) == c::LIME {
                        n += 1;
                    }
                }
            }
            n
        };
        let early = lime_pixels(&render(&m, 5));
        m.idle(15);
        let later = lime_pixels(&render(&m, 5));
        assert!(later > early);
        assert!(UI.searching.len() * 6 < 256);
    }

    #[test]
    fn the_longest_store_names_fit_the_strip_at_their_size_nothing_leaks_outside_x_0_255() {
        for def in open_stores() {
            assert!(def.name.len() * 6 - 1 <= 256 - 16, "{}", def.name);
        }
    }

    #[test]
    fn rooms_of_any_size_render_small_rooms_are_centred_on_black_big_rooms_scroll() {
        let small = make_world(StoreId::Crookstone, MakeOpts { room: Some(empty_room(10, 7, &[])), ..opts() });
        let fb_s = render(&small, 0);
        assert_eq!(fb_s.get_pixel(2, 20), c::BLACK);
        let mut big = make_world(StoreId::Crookstone, MakeOpts { room: Some(empty_room(40, 24, &[])), ..opts() });
        big.hold(200, &[Left]);
        let fb_b = render(&big, 0);
        let mut sentinels = 0;
        for y in 16..240 {
            for x in 0..256 {
                if fb_b.get_pixel(x, y) == SENTINEL {
                    sentinels += 1;
                }
            }
        }
        assert_eq!(sentinels, 0);
    }

    #[test]
    fn speech_bubbles_banners_and_the_typewriter_box_stay_on_screen() {
        let mut m = make_world(StoreId::Gamestonk, MakeOpts { egg: true, seen: false, guards: true, ..opts() });
        for i in 0..90 {
            m.step(&[]);
            let fb = render(&m, i);
            for y in 0..16 {
                for x in 0..256 {
                    assert_eq!(fb.get_pixel(x, y), SENTINEL);
                }
            }
        }
        assert!(m.world.typewriter().is_some());
        let mut k = make_world(StoreId::Kgbtoys, MakeOpts { seen: false, guards: true, ..opts() });
        k.idle(80);
        assert!(!k.world.bubbles.is_empty());
        let fb = render(&k, 80);
        for y in 0..16 {
            for x in 0..256 {
                assert_eq!(fb.get_pixel(x, y), SENTINEL);
            }
        }
    }

    #[test]
    fn draws_the_package_held_overhead_the_banner_the_popup_and_the_radar_mark() {
        use crate::content::powerups::PowerId;
        use crate::game::store::world::HeldKind;
        let mut m = make_world(StoreId::Radioshock, MakeOpts { guards: true, ..opts() });
        m.run.give_power(PowerId::Radar);
        m.teleport(2, 2);
        set_content(&mut m, 0, FixtureContent::Package);
        let before = render(&m, 0).hash();
        m.tap(&[B]);
        for i in 0..60 {
            m.step(&[]);
            render(&m, i);
        }
        assert_eq!(m.world.agent.hold.as_ref().map(|h| h.kind), Some(HeldKind::Package));
        assert_ne!(render(&m, 61).hash(), before);
    }

    #[test]
    fn draws_smoke_puffs_sparks_and_toys_without_throwing() {
        use crate::engine::pad::BtnName::A;
        use crate::game::store::world::Dir;
        let mut m = make_world(StoreId::Kgbtoys, MakeOpts { guards: true, ..opts() });
        m.teleport(5, 2);
        m.world.agent.facing = Dir::Up;
        m.step(&[A]);
        for i in 0..40 {
            m.step(&[]);
            render(&m, i);
        }
        assert_eq!(m.world.toys.len(), 3);
        assert!(m.world.puffs.len() + m.world.toys.len() > 0);
    }
}
