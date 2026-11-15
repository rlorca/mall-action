//! The top-down store rooms (store agent owns this module): templates, fixtures, search, guards, extras.
//!
//! * `templates` the ASCII room layouts and the tile model (any room size).
//! * `setup`     what every fixture holds at level start.
//! * `ai`        guards, bullets, wind-up toys (the "world" simulation).
//! * `draw`      painting (read-only).
//!
//! Everything here counts frames at 60 Hz. Positions are room pixels; the camera maps them to the screen.

use crate::art::manifest::tile_name;
use crate::copy;
use crate::events::{Out, Sfx, Track};
use crate::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use crate::pixel::Fb;
use crate::powerup::Granted;
use crate::rng::Rng;
use crate::run::{RunState, PTS_POWERUP};
use crate::types::{Content, PowerUp, StoreId, StoreRole};

mod ai;
mod draw;
pub mod setup;
pub mod templates;
#[cfg(test)]
mod tests;

pub use setup::setup_level;
pub use templates::{Template, Tile, TILE};

use templates::{cave_template, template, theme_name, SpawnKind, CAVE_PEDESTAL_PX};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreOutcome {
    None,
    /// The player walked out through the door: fade back to the mall at this store's door.
    Exit,
    /// The player died in the store and no lives remain.
    OutOfLives,
}

// ---------------------------------------------------------------------------------------------------------
// Constants (frames at 60 Hz unless noted)
// ---------------------------------------------------------------------------------------------------------

/// On-screen view of the room: 256x176 at y 16.
pub const VIEW_W: i32 = 256;
pub const VIEW_H: i32 = 176;
pub const VIEW_Y: i32 = 16;

/// Sprite is 16x16; the hit box is 12x10 at (2, 6) so heads may overlap walls above (Zelda style).
pub const BOX_X: i32 = 2;
pub const BOX_Y: i32 = 6;
pub const BOX_W: i32 = 12;
pub const BOX_H: i32 = 10;

/// Corner assist: slide round corners that stick out at most this many pixels.
pub const ASSIST: i32 = 6;
/// A fixture within this many pixels of the agent's box counts as touched.
pub const TOUCH_GAP: i32 = 2;
/// Searching: 0.75 s (0.5 s with Sneakers).
pub const SEARCH_FRAMES: u32 = 45;
pub const SEARCH_FRAMES_FAST: u32 = 30;
/// Trap stun: 1 s.
pub const STUN_FRAMES: u32 = 60;
/// Guards do not shoot for 1 s after you walk in.
pub const GRACE_FRAMES: u32 = 60;
/// Blinking invulnerability after respawning (2 s) and after armour absorbs a hit (1 s).
pub const RESPAWN_INVULN: u32 = 120;
pub const ARMOR_INVULN: u32 = 60;
/// The agent holds a found item overhead for this long; the world freezes meanwhile.
pub const HOLD_FRAMES: u32 = 90;
pub const DEATH_FRAMES: u32 = 80;
pub const BANNER_FRAMES: u32 = 150;
pub const PLAYER_BULLET_SPEED: f32 = 4.0;
pub const SHOOT_COOLDOWN: u32 = 10;
pub const SHOOT_COOLDOWN_RAPID: u32 = 5;
pub const EGG_FRAMES_PER_CHAR: u32 = 3;

// ---------------------------------------------------------------------------------------------------------
// Small types
// ---------------------------------------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Up,
    Down,
    Left,
    Right,
}

impl Dir {
    pub fn vec(self) -> (i32, i32) {
        match self {
            Dir::Up => (0, -1),
            Dir::Down => (0, 1),
            Dir::Left => (-1, 0),
            Dir::Right => (1, 0),
        }
    }
    pub fn bit(self) -> u8 {
        match self {
            Dir::Up => UP,
            Dir::Down => DOWN,
            Dir::Left => LEFT,
            Dir::Right => RIGHT,
        }
    }
    pub fn from_vec(dx: i32, dy: i32) -> Dir {
        if dy.abs() >= dx.abs() {
            if dy < 0 {
                Dir::Up
            } else {
                Dir::Down
            }
        } else if dx < 0 {
            Dir::Left
        } else {
            Dir::Right
        }
    }
    pub fn opposite(self) -> Dir {
        match self {
            Dir::Up => Dir::Down,
            Dir::Down => Dir::Up,
            Dir::Left => Dir::Right,
            Dir::Right => Dir::Left,
        }
    }
}

const DIR_BITS: u8 = UP | DOWN | LEFT | RIGHT;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum HeldItem {
    Package,
    Power(PowerUp),
    /// The easter-egg joke item (drawn as a coin).
    Joke,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Search {
    pub fixture: usize,
    pub t: u32,
    pub total: u32,
}

#[derive(Clone, Debug)]
pub(crate) struct Player {
    pub x: i32,
    pub y: i32,
    pub acc: f32,
    pub face: Dir,
    pub anim: u32,
    pub moving: bool,
    pub stun: u32,
    pub invuln: u32,
    pub cool: u32,
    pub hold: Option<(HeldItem, u32)>,
    pub search: Option<Search>,
    /// 0 = alive; otherwise frames since death began.
    pub dying: u32,
    pub volley: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum GKind {
    Spy,
    Bot,
}

#[derive(Clone, Debug)]
pub(crate) struct Guard {
    pub kind: GKind,
    pub x: f32,
    pub y: f32,
    pub face: Dir,
    pub tx: i32,
    pub ty: i32,
    pub target: Option<(i32, i32)>,
    pub hp: i32,
    pub stun: u32,
    pub aim: u32,
    pub cool: u32,
    pub wait: u32,
    pub flash: u32,
    pub anim: u32,
    /// 0 = alive; counts up while the death animation plays.
    pub dying: u32,
    pub gone: bool,
    pub bot_dir: (i32, i32),
    /// Spawned by a fitting room (not part of the template; does not come back after a death).
    pub extra: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum BKind {
    Player,
    Enemy,
    Shoe,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Bullet {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub kind: BKind,
    pub volley: u32,
    pub age: u32,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Puff {
    pub x: i32,
    pub y: i32,
    pub t: u32,
    pub spark: bool,
}

#[derive(Clone, Debug)]
pub(crate) struct Toy {
    pub x: f32,
    pub y: f32,
    pub dx: i32,
    pub dy: i32,
    pub t: u32,
}

#[derive(Clone, Debug)]
pub(crate) struct Bubble {
    /// Follow this guard (index into `guards`), or sit at (x, y) in room pixels.
    pub guard: Option<usize>,
    pub x: i32,
    pub y: i32,
    pub text: String,
    /// Frames before it appears / frames it stays.
    pub delay: u32,
    pub left: u32,
    pub intro: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum EggPhase {
    Text,
    Wait,
    Hold,
    Vanish,
}

#[derive(Clone, Debug)]
pub(crate) struct Egg {
    pub phase: EggPhase,
    pub t: u32,
    pub item: &'static str,
    pub clerk_visible: bool,
}

pub struct StoreRoom {
    pub id: StoreId,
    pub(crate) tpl: Template,
    /// The grid used for collisions and drawing (the store, or the cave during the easter-egg scene).
    pub(crate) grid: Template,
    pub(crate) art: TileArt,
    pub(crate) player: Player,
    pub(crate) guards: Vec<Guard>,
    pub(crate) bullets: Vec<Bullet>,
    pub(crate) puffs: Vec<Puff>,
    pub(crate) toys: Vec<Toy>,
    pub(crate) released: Vec<usize>,
    pub(crate) bubbles: Vec<Bubble>,
    pub(crate) banner: crate::ui::Banner,
    pub(crate) banner_cols: (u8, u8, u8),
    pub(crate) egg: Option<Egg>,
    pub(crate) rng: Rng,
    pub(crate) t: u32,
    pub(crate) grace: u32,
    pub(crate) dist: Vec<i32>,
    pub(crate) in_booth: bool,
    pub(crate) refused: bool,
    pub(crate) pending_kill: bool,
    pub(crate) lives_after_death: bool,
    /// Debug/test: force the fitting-room reveal (Some(true)) or prevent it (Some(false)).
    pub force_reveal: Option<bool>,
}

/// Pre-built sprite names for one theme.
pub(crate) struct TileArt {
    pub floor: String,
    pub floor2: String,
    pub wall: String,
    pub fixa: String,
    pub fixa_o: String,
    pub fixb: String,
    pub fixb_o: String,
    pub counter: String,
    pub decora: String,
    pub decorb: String,
}

impl TileArt {
    fn new(theme: &str) -> TileArt {
        let n = |k: &str| tile_name(theme, k);
        TileArt {
            floor: n("floor"),
            floor2: n("floor2"),
            wall: n("wall"),
            fixa: n("fixa"),
            fixa_o: n("fixa_o"),
            fixb: n("fixb"),
            fixb_o: n("fixb_o"),
            counter: n("counter"),
            decora: n("decora"),
            decorb: n("decorb"),
        }
    }
}

/// Camera: top-left of the visible window in room pixels. Rooms larger than the view scroll with the focus
/// point (clamped to the room); smaller rooms are centred (negative offset).
pub fn camera(room_w: i32, room_h: i32, focus_x: i32, focus_y: i32) -> (i32, i32) {
    let axis = |room: i32, view: i32, focus: i32| {
        if room <= view {
            -((view - room) / 2)
        } else {
            (focus - view / 2).clamp(0, room - view)
        }
    };
    (axis(room_w, VIEW_W, focus_x), axis(room_h, VIEW_H, focus_y))
}

impl StoreRoom {
    pub fn new(id: StoreId, run: &mut RunState, out: &mut Out) -> StoreRoom {
        StoreRoom::from_template(id, template(id), run, out)
    }

    /// Build a room from any template (used by tests with synthetic big rooms).
    pub fn from_template(id: StoreId, tpl: Template, run: &mut RunState, out: &mut Out) -> StoreRoom {
        let refused = id.role() == StoreRole::Closed || (id.role() == StoreRole::Target && run.store_cleared(id));
        if id.is_open() && !run.fixtures.contains_key(&id) {
            setup::fill_store(run, id);
        }
        let first_visit = run.visited.insert(id);
        let seed = run.rng.next_u32() as u64 | ((id.index() as u64) << 40);
        let (ex, ey) = tpl.entry();
        let egg = if id == StoreId::GameStonk && !run.egg_done && !refused {
            let mut r = Rng::new(seed ^ 0xE66);
            Some(Egg { phase: EggPhase::Text, t: 0, item: *r.pick(&copy::EGG_ITEMS), clerk_visible: true })
        } else {
            None
        };
        let grid = if egg.is_some() { cave_template() } else { tpl.clone() };
        let (cx, cy) = (grid.w, grid.h);
        let _ = (cx, cy);
        let mut room = StoreRoom {
            id,
            art: TileArt::new(theme_name(id.info().theme)),
            grid,
            player: Player {
                x: ex * TILE,
                y: ey * TILE,
                acc: 0.0,
                face: Dir::Up,
                anim: 0,
                moving: false,
                stun: 0,
                invuln: 0,
                cool: 0,
                hold: None,
                search: None,
                dying: 0,
                volley: 0,
            },
            tpl,
            guards: Vec::new(),
            bullets: Vec::new(),
            puffs: Vec::new(),
            toys: Vec::new(),
            released: Vec::new(),
            bubbles: Vec::new(),
            banner: crate::ui::Banner::default(),
            banner_cols: (crate::pixel::pal::WHITE, crate::pixel::pal::DBLUE, crate::pixel::pal::WHITE),
            egg,
            rng: Rng::new(seed),
            t: 0,
            grace: GRACE_FRAMES,
            dist: Vec::new(),
            in_booth: false,
            refused,
            pending_kill: false,
            lives_after_death: true,
            force_reveal: None,
        };
        if !refused {
            out.music(Track::Store(id));
            if room.egg.is_none() {
                room.spawn_guards(first_visit);
            }
        }
        room
    }

    // -----------------------------------------------------------------------------------------------------
    // Geometry helpers
    // -----------------------------------------------------------------------------------------------------

    fn free_box(grid: &Template, x: i32, y: i32) -> bool {
        let (l, t) = (x + BOX_X, y + BOX_Y);
        let (r, b) = (l + BOX_W - 1, t + BOX_H - 1);
        for ty in t.div_euclid(TILE)..=b.div_euclid(TILE) {
            for tx in l.div_euclid(TILE)..=r.div_euclid(TILE) {
                if grid.tile(tx, ty).solid() {
                    return false;
                }
            }
        }
        true
    }

    fn free(&self, x: i32, y: i32) -> bool {
        Self::free_box(&self.grid, x, y)
    }

    pub(crate) fn player_box(&self) -> (i32, i32, i32, i32) {
        (self.player.x + BOX_X, self.player.y + BOX_Y, BOX_W, BOX_H)
    }

    pub(crate) fn player_center(&self) -> (i32, i32) {
        (self.player.x + BOX_X + BOX_W / 2, self.player.y + BOX_Y + BOX_H / 2)
    }

    /// Where the camera looks (room pixels, top-left of the view).
    pub fn cam(&self) -> (i32, i32) {
        let (cx, cy) = self.player_center();
        camera(self.grid.px_w(), self.grid.px_h(), cx, cy)
    }

    /// Player position in room pixels (sprite top-left). Debug/test helper.
    pub fn player_pos(&self) -> (i32, i32) {
        (self.player.x, self.player.y)
    }

    pub fn player_dead(&self) -> bool {
        self.player.dying > 0
    }

    pub fn is_searching(&self) -> bool {
        self.player.search.is_some()
    }

    // -----------------------------------------------------------------------------------------------------
    // Movement
    // -----------------------------------------------------------------------------------------------------

    /// One pixel of movement with Zelda-style corner assist.
    fn step_px(&mut self, dir: Dir) {
        let (dx, dy) = dir.vec();
        let (x, y) = (self.player.x, self.player.y);
        if self.free(x + dx, y + dy) {
            self.player.x += dx;
            self.player.y += dy;
            return;
        }
        // Blocked: if shifting sideways by up to ASSIST px opens the way, slide towards it.
        let (px, py) = (dy.abs(), dx.abs());
        for k in 1..=ASSIST {
            for sign in [-1, 1] {
                let path_clear = (1..=k).all(|j| self.free(x + px * sign * j, y + py * sign * j));
                if path_clear && self.free(x + px * sign * k + dx, y + py * sign * k + dy) {
                    self.player.x += px * sign;
                    self.player.y += py * sign;
                    return;
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Searching
    // -----------------------------------------------------------------------------------------------------

    /// How the agent's box touches fixture `i` (opened or not): the side it touches and the overlap length,
    /// if within TOUCH_GAP px on a side with at least 2 px of overlap along it.
    pub(crate) fn touch(&self, i: usize) -> Option<(Dir, i32)> {
        let (fx, fy) = self.tpl.fixtures[i];
        let (bx, by, bw, bh) = self.player_box();
        let (br, bb) = (bx + bw, by + bh);
        let (l, t, r, b) = (fx * TILE, fy * TILE, fx * TILE + TILE, fy * TILE + TILE);
        let ox = br.min(r) - bx.max(l);
        let oy = bb.min(b) - by.max(t);
        let mut best: Option<(Dir, i32)> = None;
        let mut consider = |d: Dir, ov: i32| {
            let score = ov + if d == self.player.face { 100 } else { 0 };
            if best.map_or(true, |(bd, bo)| score > bo + if bd == self.player.face { 100 } else { 0 }) {
                best = Some((d, ov));
            }
        };
        if ox >= 2 {
            if (0..=TOUCH_GAP).contains(&(t - bb)) {
                consider(Dir::Down, ox);
            } else if (0..=TOUCH_GAP).contains(&(by - b)) {
                consider(Dir::Up, ox);
            }
        }
        if oy >= 2 {
            if (0..=TOUCH_GAP).contains(&(l - br)) {
                consider(Dir::Right, oy);
            } else if (0..=TOUCH_GAP).contains(&(bx - r)) {
                consider(Dir::Left, oy);
            }
        }
        best
    }

    /// The fixture the agent is touching (within TOUCH_GAP px on any side) and the direction to face it.
    /// Prefers the one he is facing, then the one with the most overlap. Opened fixtures do not count.
    pub fn touching_fixture(&self, run: &RunState) -> Option<(usize, Dir)> {
        if self.egg.is_some() {
            return None;
        }
        let mut best: Option<(i32, usize, Dir)> = None;
        for i in 0..self.tpl.fixtures.len() {
            if run.is_opened(self.id, i) {
                continue;
            }
            if let Some((d, ov)) = self.touch(i) {
                let score = ov + if d == self.player.face { 100 } else { 0 };
                if best.map_or(true, |(s, _, _)| score > s) {
                    best = Some((score, i, d));
                }
            }
        }
        best.map(|(_, i, d)| (i, d))
    }

    /// True when pressing B would start a search right now (drives the "PRESS X TO SEARCH" prompt).
    pub fn can_search(&self, run: &RunState) -> bool {
        let p = &self.player;
        p.dying == 0
            && p.stun == 0
            && p.hold.is_none()
            && p.search.is_none()
            && self.egg.is_none()
            && self.touching_fixture(run).is_some()
    }

    fn fixture_content(&self, run: &RunState, i: usize) -> Content {
        run.fixtures.get(&self.id).and_then(|v| v.get(i)).copied().unwrap_or(Content::Nothing)
    }

    fn show_banner(&mut self, text: &str, cols: (u8, u8, u8)) {
        self.banner.show(text, BANNER_FRAMES);
        self.banner_cols = cols;
    }

    fn finish_search(&mut self, fidx: usize, run: &mut RunState, out: &mut Out) {
        use crate::pixel::pal;
        let (fx, fy) = self.tpl.fixtures[fidx];
        let (cx, cy) = (fx * TILE + 8, fy * TILE + 8);
        let is_fitting = self.tpl.tile(fx, fy) == Tile::Fitting;
        if is_fitting {
            let reveal = self.force_reveal.unwrap_or_else(|| self.rng.chance(0.25));
            if reveal && self.reveal_fitting(fidx, run, out) {
                return;
            }
        }
        run.opened.insert((self.id, fidx));
        match self.fixture_content(run, fidx) {
            Content::Package => {
                out.sfx(Sfx::PackageFanfare);
                run.take_package(self.id, out);
                let n = run.packages_found();
                self.player.hold = Some((HeldItem::Package, HOLD_FRAMES));
                self.show_banner(&copy::package_banner(n), (pal::BLACK, pal::YELLOW, pal::WHITE));
            }
            Content::PowerUp(p) => {
                out.sfx(Sfx::PowerUp);
                if run.power.grant(p) == Granted::ExtraLife {
                    run.extra_life(out);
                }
                run.add_score(PTS_POWERUP, out);
                self.player.hold = Some((HeldItem::Power(p), HOLD_FRAMES));
                self.show_banner(p.name(), (pal::BLACK, pal::LGREEN, pal::WHITE));
            }
            Content::Trap => {
                out.sfx(Sfx::Trap);
                self.puffs.push(Puff { x: cx - 8, y: cy - 8, t: 0, spark: false });
                self.player.stun = STUN_FRAMES;
                self.show_banner(copy::TRAP_TEXT, (pal::WHITE, pal::RED, pal::WHITE));
            }
            Content::Nothing => {
                out.sfx(Sfx::Smoke);
                self.puffs.push(Puff { x: cx - 8, y: cy - 8, t: 0, spark: false });
                self.show_banner(copy::NOTHING_TEXT, (pal::WHITE, pal::DBLUE, pal::WHITE));
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Step
    // -----------------------------------------------------------------------------------------------------

    pub fn step(&mut self, pad: PadState, run: &mut RunState, out: &mut Out) -> StoreOutcome {
        if self.refused {
            return StoreOutcome::Exit;
        }
        self.t += 1;
        self.banner.step();
        self.step_puffs();
        if self.pending_kill {
            self.pending_kill = false;
            self.start_death(run, out);
        }
        if self.player.dying > 0 {
            return self.step_dying(run, out);
        }
        self.step_bubbles();
        if self.player.invuln > 0 {
            self.player.invuln -= 1;
        }
        if self.player.cool > 0 {
            self.player.cool -= 1;
        }
        // Stunned this frame? (the counter drops after the check, so 60 means 60 frozen frames)
        let stunned = self.player.stun > 0;
        if stunned {
            self.player.stun -= 1;
        }
        self.player.anim += 1;

        // Egg scene bookkeeping (typewriter, vanish...).
        let mut frozen_input = false;
        if self.egg.is_some() {
            frozen_input = self.step_egg(run, out);
        }

        // Holding an item overhead freezes everything for a moment.
        if let Some((item, t)) = self.player.hold {
            if t <= 1 {
                self.player.hold = None;
                if item == HeldItem::Joke {
                    if let Some(e) = &mut self.egg {
                        e.phase = EggPhase::Vanish;
                        e.t = 0;
                        out.music(Track::Store(self.id));
                    }
                }
            } else {
                self.player.hold = Some((item, t - 1));
            }
            return StoreOutcome::None;
        }

        if !frozen_input && !stunned {
            if let Some(o) = self.step_player(pad, run, out) {
                return o;
            }
        } else if stunned {
            self.player.moving = false;
            self.player.search = None;
        }

        // World.
        if self.grace > 0 {
            self.grace -= 1;
        }
        self.step_world(run, out);
        if self.player.dying > 0 {
            return StoreOutcome::None;
        }

        // Booth music.
        let (cx, cy) = self.player_center();
        let on_booth = self.grid.tile(cx.div_euclid(TILE), cy.div_euclid(TILE)) == Tile::Booth;
        if on_booth != self.in_booth {
            self.in_booth = on_booth;
            if on_booth {
                out.music(Track::Booth);
                self.show_banner(copy::BOOTH_NOW_PLAYING, (crate::pixel::pal::WHITE, crate::pixel::pal::PLUM, crate::pixel::pal::WHITE));
            } else {
                out.music(Track::Store(self.id));
            }
        }

        // Exit through the door.
        let (dx, dy) = self.grid.door;
        if cx.div_euclid(TILE) == dx && cy >= dy * TILE + 10 {
            return StoreOutcome::Exit;
        }
        StoreOutcome::None
    }

    /// Player input. Returns Some(outcome) only to end the step early.
    fn step_player(&mut self, pad: PadState, run: &mut RunState, out: &mut Out) -> Option<StoreOutcome> {
        let dirs = pad.held & DIR_BITS;
        let fresh_dirs = pad.pressed & DIR_BITS;

        // Searching runs by itself until done; only a fresh different direction or shooting cancels it.
        if let Some(mut s) = self.player.search {
            let cancel = pad.just_pressed(A) || (fresh_dirs & !self.player.face.bit()) != 0;
            if !cancel {
                s.t += 1;
                self.player.moving = false;
                if s.t % 9 == 0 {
                    out.sfx(Sfx::SearchTick);
                }
                if s.t >= s.total {
                    self.player.search = None;
                    self.finish_search(s.fixture, run, out);
                } else {
                    self.player.search = Some(s);
                }
                return None;
            }
            self.player.search = None;
        }

        // Shooting.
        let rapid = run.power.rapid_fire();
        let fire = if rapid { pad.is_held(A) } else { pad.just_pressed(A) };
        if fire && self.player.cool == 0 {
            self.shoot(run, out);
        }

        // Start a search with a single tap of B (a held B never chains: it needs a fresh press).
        if pad.just_pressed(B) {
            if let Some((i, d)) = self.touching_fixture(run) {
                self.player.face = d;
                let total = if run.power.fast_search() { SEARCH_FRAMES_FAST } else { SEARCH_FRAMES };
                self.player.search = Some(Search { fixture: i, t: 0, total });
                self.player.moving = false;
                out.sfx(Sfx::SearchTick);
                return None;
            }
        }

        // Movement: vertical wins.
        let (mx, my) = (pad.dx(), pad.dy());
        let dir = if my != 0 {
            Some(if my < 0 { Dir::Up } else { Dir::Down })
        } else if mx != 0 {
            Some(if mx < 0 { Dir::Left } else { Dir::Right })
        } else {
            None
        };
        let _ = dirs;
        self.player.moving = dir.is_some();
        if let Some(d) = dir {
            self.player.face = d;
            self.player.acc += run.power.walk_mul();
            let n = self.player.acc as i32;
            self.player.acc -= n as f32;
            for _ in 0..n {
                self.step_px(d);
            }
        }
        None
    }

    fn shoot(&mut self, run: &RunState, out: &mut Out) {
        let active: Vec<u32> = {
            let mut v: Vec<u32> = self.bullets.iter().filter(|b| b.kind == BKind::Player).map(|b| b.volley).collect();
            v.sort_unstable();
            v.dedup();
            v
        };
        if active.len() >= run.power.max_player_bullets() {
            return;
        }
        self.player.volley += 1;
        let v = self.player.volley;
        let (cx, cy) = self.player_center();
        let (dx, dy) = self.player.face.vec();
        let (sx, sy) = (cx as f32 + dx as f32 * 8.0, cy as f32 + dy as f32 * 8.0);
        let fan: &[f32] = if run.power.spread_shot() { &[-1.6, 0.0, 1.6] } else { &[0.0] };
        for &s in fan {
            // perpendicular drift
            let (px, py) = (dy.abs() as f32, dx.abs() as f32);
            self.bullets.push(Bullet {
                x: sx,
                y: sy,
                vx: dx as f32 * PLAYER_BULLET_SPEED + px * s,
                vy: dy as f32 * PLAYER_BULLET_SPEED + py * s,
                kind: BKind::Player,
                volley: v,
                age: 0,
            });
        }
        self.player.cool = if run.power.rapid_fire() { SHOOT_COOLDOWN_RAPID } else { SHOOT_COOLDOWN };
        out.sfx(Sfx::Shot);
    }

    // -----------------------------------------------------------------------------------------------------
    // Death and respawn
    // -----------------------------------------------------------------------------------------------------

    /// Hurt the agent. Returns true if it killed him.
    pub(crate) fn hurt_player(&mut self, run: &mut RunState, out: &mut Out) -> bool {
        let p = &self.player;
        if p.dying > 0 || p.invuln > 0 || run.power.is_invincible() {
            return false;
        }
        if run.power.absorb_hit() {
            self.player.invuln = ARMOR_INVULN;
            out.sfx(Sfx::Hurt);
            let (cx, cy) = self.player_center();
            self.puffs.push(Puff { x: cx - 8, y: cy - 8, t: 0, spark: true });
            return false;
        }
        self.start_death(run, out);
        true
    }

    fn start_death(&mut self, run: &mut RunState, out: &mut Out) {
        if self.player.dying > 0 {
            return;
        }
        out.sfx(Sfx::Death);
        self.lives_after_death = run.lose_life();
        self.player.dying = 1;
        self.player.search = None;
        self.player.hold = None;
        self.player.moving = false;
    }

    fn step_dying(&mut self, _run: &mut RunState, _out: &mut Out) -> StoreOutcome {
        self.player.dying += 1;
        if self.player.dying < DEATH_FRAMES {
            return StoreOutcome::None;
        }
        if !self.lives_after_death {
            self.player.dying = DEATH_FRAMES;
            return StoreOutcome::OutOfLives;
        }
        // Respawn at the door, blinking; the guards reset.
        let (ex, ey) = self.grid.entry();
        self.player.x = ex * TILE;
        self.player.y = ey * TILE;
        self.player.face = Dir::Up;
        self.player.dying = 0;
        self.player.invuln = RESPAWN_INVULN;
        self.player.stun = 0;
        self.player.acc = 0.0;
        self.bullets.clear();
        self.toys.clear();
        self.bubbles.clear();
        self.puffs.clear();
        self.released.clear();
        self.grace = GRACE_FRAMES;
        if self.egg.is_none() {
            self.spawn_guards(false);
        }
        StoreOutcome::None
    }

    // -----------------------------------------------------------------------------------------------------
    // Easter egg (GameStonk)
    // -----------------------------------------------------------------------------------------------------

    /// Advance the cave scene. Returns true while player input is frozen.
    fn step_egg(&mut self, run: &mut RunState, out: &mut Out) -> bool {
        let Some(mut egg) = self.egg.take() else { return false };
        egg.t += 1;
        let mut frozen = false;
        let text_len = copy::EASTER_EGG_TEXT.chars().count() as u32;
        let mut finished = false;
        match egg.phase {
            EggPhase::Text => {
                frozen = true;
                let shown = (egg.t / EGG_FRAMES_PER_CHAR).min(text_len);
                if egg.t % EGG_FRAMES_PER_CHAR == 0 && egg.t / EGG_FRAMES_PER_CHAR <= text_len {
                    out.sfx(Sfx::TextBlip);
                }
                if shown >= text_len && egg.t >= text_len * EGG_FRAMES_PER_CHAR + 45 {
                    egg.phase = EggPhase::Wait;
                    egg.t = 0;
                    self.puffs.push(Puff { x: CAVE_PEDESTAL_PX.0, y: CAVE_PEDESTAL_PX.1, t: 0, spark: true });
                    out.sfx(Sfx::Ding);
                }
            }
            EggPhase::Wait => {
                // Walk onto the pedestal.
                let (cx, cy) = self.player_center();
                let (px, py) = CAVE_PEDESTAL_PX;
                if cx >= px && cx < px + 16 && cy >= py && cy < py + 16 {
                    out.music(Track::ItemGet);
                    run.add_item(egg.item, out);
                    self.player.hold = Some((HeldItem::Joke, 140));
                    self.player.x = px;
                    self.player.y = py;
                    self.player.search = None;
                    self.show_banner(&copy::you_got(egg.item), (crate::pixel::pal::BLACK, crate::pixel::pal::YELLOW, crate::pixel::pal::WHITE));
                    egg.phase = EggPhase::Hold;
                }
            }
            EggPhase::Hold => {}
            EggPhase::Vanish => {
                frozen = true;
                if egg.t == 1 {
                    let (cx, cy) = templates::CAVE_CLERK_PX;
                    self.puffs.push(Puff { x: cx, y: cy, t: 0, spark: false });
                    out.sfx(Sfx::Smoke);
                }
                if egg.t == 8 {
                    egg.clerk_visible = false;
                }
                if egg.t >= 28 {
                    finished = true;
                }
            }
        }
        if finished {
            run.egg_done = true;
            self.grid = self.tpl.clone();
            self.puffs.clear();
            // The pedestal spot is open floor in the shop; make sure the agent is not stuck in anything.
            if !self.free(self.player.x, self.player.y) {
                let (ex, ey) = self.grid.entry();
                self.player.x = ex * TILE;
                self.player.y = ey * TILE;
            }
            self.grace = GRACE_FRAMES;
            self.spawn_guards(false);
            self.egg = None;
            return false;
        }
        self.egg = Some(egg);
        frozen
    }

    // -----------------------------------------------------------------------------------------------------
    // Debug
    // -----------------------------------------------------------------------------------------------------

    /// Debug/playtest: kill the player right now (normal death flow).
    pub fn debug_kill(&mut self) {
        self.pending_kill = true;
    }

    /// Debug/playtest: one-line description of the room state.
    pub fn debug_state(&self) -> String {
        let alive = self.guards.iter().filter(|g| !g.gone && g.dying == 0).count();
        let (cx, cy) = self.player_center();
        format!(
            "{:?} t={} pos=({},{}) face={:?} guards={} bullets={} toys={} search={} stun={} invuln={} dying={} egg={:?}",
            self.id,
            self.t,
            cx,
            cy,
            self.player.face,
            alive,
            self.bullets.len(),
            self.toys.len(),
            self.player.search.map(|s| s.t as i32).unwrap_or(-1),
            self.player.stun,
            self.player.invuln,
            self.player.dying,
            self.egg.as_ref().map(|e| e.phase),
        )
    }

    /// Draw the room (full screen below the HUD) and its bottom prompt strip.
    pub fn draw(&self, fb: &mut Fb, run: &RunState, tick: u32) {
        draw::draw_room(self, fb, run, tick);
    }

    /// Number of guards still alive (test/debug helper).
    pub fn guards_alive(&self) -> usize {
        self.guards.iter().filter(|g| !g.gone && g.dying == 0).count()
    }
}

/// Spawn kinds -> guard kinds (used by `spawn_guards`).
pub(crate) fn spawn_kind(k: SpawnKind) -> GKind {
    match k {
        SpawnKind::Spy => GKind::Spy,
        SpawnKind::BotH | SpawnKind::BotV => GKind::Bot,
    }
}
