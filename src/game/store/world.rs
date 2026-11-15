use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::{first_visit, package_banner, you_got, BubbleLine, BubbleWho, EASTER_EGG, LAST_WORDS, SHOUTS, UI};
use crate::content::powerups::PowerId;
use crate::content::stores::{store_def, StoreDef, StoreId};
use crate::engine::num::round_i;
use crate::engine::pad::{self, Pad};
use crate::engine::rng::Rng;
use crate::game::difficulty::difficulty;
use crate::game::levelstate::{FixtureContent, StoreState};
use crate::game::run::{Run, POINTS};
use crate::game::types::{make_banner, tick_popups, Banner, Bubble, Popup};

use super::collision::{box_free, boxes_overlap, move_axis, Axis, MoveOpts, Vec2, HALF};
use super::room::{
    get_room, guard_walkable, is_door_tile, is_solid_kind, room_px_h, room_px_w, tile_at, walk_distances, Cell, FixtureKind, GuardAxis,
    GuardKind, Room, TileKind, TILE,
};

/**
 * One visit to a store: the top-down room, the agent, the guards and everything that
 * happens in there. Pure rules (no drawing, no DOM, no Math.random/Date): `step(run, pad)` advances
 * the world by one 60 Hz frame; renderers (src/render/store_view.rs) read the public state.
 *
 * Persistent state (opened fixtures, packageTaken) lives in `run.level.stores[id]`, NOT here:
 * the world is rebuilt on every entry, so guards come back and per-visit flags reset.
 *
 * Rust port note: the TS world held a reference to the `Run`; here every method that needs the run takes it
 * explicitly (`step(&mut self, run: &mut Run, pad)`, `can_search(&self, run: &Run)`, ...). The persistent
 * `StoreState` is reached with `store(run)` / `store_mut(run)`.
 */

// ------------------------------------------------------------------ tuning (all in px and 60 Hz frames)
pub const VIEW_W: i32 = 256;
pub const VIEW_H: i32 = 176;
/// Screen y of the room's top edge (below the 16 px HUD).
pub const ROOM_TOP: i32 = 16;
pub const AGENT_SPEED: f64 = 1.25;
pub const STUN_FRAMES: i32 = 60;
pub const HOLD_PACKAGE: i32 = 100;
pub const HOLD_POWER: i32 = 70;
pub const HOLD_JOKE: i32 = 150;
pub const DEATH_FRAMES: i32 = 60;
pub const HURT_FRAMES: i32 = 60;
/// Fixtures within this many px of the agent's box count as touched (in front or to either side).
pub const TOUCH_MARGIN: f64 = 3.0;
pub const BULLET_SPEED: f64 = 3.5;
pub const ENEMY_BULLET_SPEED: f64 = 2.0;
/// Spies may not shoot before this many frames after the agent walks in.
pub const GRACE_FRAMES: i32 = 150;
/// Telegraph before a spy shot (the aim line blinks; stepping out of the line dodges it).
pub const AIM_FRAMES: i32 = 30;
pub const BOT_HP: i32 = 3;
pub const TOY_STUN: i32 = 180;
pub const TOY_LIFE: i32 = 600;
pub const TOY_SPEED: f64 = 0.8;
pub const FITTING_CHANCE: f64 = 0.25;
pub const FITTING_CHANGE_FRAMES: i32 = 50;
pub const INTRO_START: i32 = 12;
/// Frames between the first-visit lines ("about 1 s").
pub const INTRO_GAP: i32 = 60;
pub const INTRO_TAIL: i32 = 60;
pub const BUBBLE_FRAMES: i32 = 90;
pub const EGG_TYPE_RATE: i32 = 3;
pub const EGG_WAIT: i32 = 50;

const TILE_F: f64 = TILE as f64;
const VIEW_W_F: f64 = VIEW_W as f64;
const VIEW_H_F: f64 = VIEW_H as f64;
const DIR_MASK: u32 = pad::UP | pad::DOWN | pad::LEFT | pad::RIGHT;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Dir {
    Up,
    Down,
    Left,
    Right,
}

impl Dir {
    pub const fn as_str(self) -> &'static str {
        match self {
            Dir::Up => "up",
            Dir::Down => "down",
            Dir::Left => "left",
            Dir::Right => "right",
        }
    }
    /// TS `DIR_VEC[d]`.
    pub const fn vec(self) -> (f64, f64) {
        match self {
            Dir::Up => (0.0, -1.0),
            Dir::Down => (0.0, 1.0),
            Dir::Left => (-1.0, 0.0),
            Dir::Right => (1.0, 0.0),
        }
    }
    /// TS `DIR_BIT[d]`.
    pub const fn bit(self) -> u32 {
        match self {
            Dir::Up => pad::UP,
            Dir::Down => pad::DOWN,
            Dir::Left => pad::LEFT,
            Dir::Right => pad::RIGHT,
        }
    }
    pub const fn opposite(self) -> Dir {
        match self {
            Dir::Up => Dir::Down,
            Dir::Down => Dir::Up,
            Dir::Left => Dir::Right,
            Dir::Right => Dir::Left,
        }
    }
}

const DIR_ORDER: [Dir; 4] = [Dir::Up, Dir::Right, Dir::Down, Dir::Left];

// ------------------------------------------------------------------ public state shapes
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HeldKind {
    Package,
    Power,
    Joke,
}

impl HeldKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            HeldKind::Package => "package",
            HeldKind::Power => "power",
            HeldKind::Joke => "joke",
        }
    }
}

#[derive(Clone, Debug)]
pub struct HeldItem {
    pub kind: HeldKind,
    pub power: Option<PowerId>,
    pub label: &'static str,
    pub t: i32,
    pub total: i32,
}

#[derive(Clone, Debug)]
pub struct Agent {
    /// Centre of the 12 x 12 collision box, in room pixels.
    pub x: f64,
    pub y: f64,
    pub facing: Dir,
    pub moving: bool,
    /// Frames spent walking (drives the walk cycle).
    pub anim: i32,
    pub stun: i32,
    /// Invulnerability frames left after armour absorbed a hit.
    pub hurt: i32,
    pub hold: Option<HeldItem>,
    /// 0 = alive; otherwise frames since the fatal hit.
    pub dying: i32,
    pub shoot_cd: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct SearchState {
    pub fixture: usize,
    pub t: i32,
    pub total: i32,
}

#[derive(Clone, Debug)]
pub struct Guard {
    pub id: i32,
    pub kind: GuardKind,
    /// Centre of the box, in room pixels.
    pub x: f64,
    pub y: f64,
    /// Spies: the tile they are on / walking into.
    pub col: i32,
    pub row: i32,
    pub moving: bool,
    pub tx: f64,
    pub ty: f64,
    /// Bots: patrol direction.
    pub dir: Dir,
    pub facing: Dir,
    pub hp: i32,
    pub stun: i32,
    /// Frames left of the aim telegraph (0 = not aiming).
    pub aim: i32,
    pub aim_dir: Dir,
    pub cooldown: i32,
    /// Spies wait this many frames before choosing their next tile.
    pub think: i32,
    /// No shots before this world frame.
    pub armed_at: i32,
    pub hit_flash: i32,
    pub dead: bool,
    pub dead_t: i32,
    pub anim: i32,
    /// Fitting-room spy: frames left of the "mid-change" shriek (0 = normal).
    pub change: i32,
    pub prev_col: i32,
    pub prev_row: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BulletKind {
    Agent,
    Enemy,
    Shoe,
}

impl BulletKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            BulletKind::Agent => "agent",
            BulletKind::Enemy => "enemy",
            BulletKind::Shoe => "shoe",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Bullet {
    pub kind: BulletKind,
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub age: i32,
    /// Frames during which tile collisions are ignored (a shoe leaving its cubicle).
    pub noclip: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct Toy {
    pub id: i32,
    pub x: f64,
    pub y: f64,
    pub dir: Dir,
    pub age: i32,
    pub turns: i32,
    /// Frames before this toy can stun / bounce off a guard again.
    pub cool: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PuffKind {
    Smoke,
    Spark,
}

impl PuffKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            PuffKind::Smoke => "smoke",
            PuffKind::Spark => "spark",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Puff {
    pub x: f64,
    pub y: f64,
    pub kind: PuffKind,
    pub t: i32,
    pub total: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EggPhase {
    Type,
    Wait,
    Item,
    Get,
    Done,
}

impl EggPhase {
    pub const fn as_str(self) -> &'static str {
        match self {
            EggPhase::Type => "type",
            EggPhase::Wait => "wait",
            EggPhase::Item => "item",
            EggPhase::Get => "get",
            EggPhase::Done => "done",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct EggState {
    pub phase: EggPhase,
    pub t: i32,
    /// Characters of the clerk line printed so far.
    pub shown: i32,
    pub item: &'static str,
}

#[derive(Clone, Copy, Debug)]
struct Intro {
    lines: &'static [BubbleLine],
    t: i32,
    next: usize,
    active: bool,
}

const HALF_STEP: f64 = 0.5;

/// A candidate tile for a spy's next step (TS inline object).
#[derive(Clone, Copy)]
struct Cand {
    dir: Dir,
    col: i32,
    row: i32,
    d: i32,
}

pub struct StoreWorld {
    pub store_id: StoreId,
    pub def: &'static StoreDef,
    pub room: Room,
    /// True the first time this store is entered in the game (its guards say their lines).
    pub first_visit: bool,

    pub frame: i32,
    pub exited: bool,
    pub died: bool,

    pub agent: Agent,
    pub guards: Vec<Guard>,
    pub bullets: Vec<Bullet>,
    pub toys: Vec<Toy>,
    pub puffs: Vec<Puff>,
    pub popups: Vec<Popup>,
    pub bubbles: Vec<Bubble>,
    pub banner: Option<Banner>,
    pub search: Option<SearchState>,
    /// Fixture the "PRESS X TO SEARCH" prompt refers to (-1 = nothing in reach). Updated every step.
    pub search_target: i32,
    pub on_booth: bool,
    /// Camera: top-left of the view in room pixels (negative when the room is smaller than the view: centred).
    pub cam_x: i32,
    pub cam_y: i32,
    pub egg: Option<EggState>,
    /// Fitting rooms whose curtain was pulled by a spy (drawn open, contents still unsearched).
    pub peeked: Vec<usize>,
    /// Fitting rooms already rolled for the 25% spy this visit.
    fit_rolled: Vec<usize>,
    shelves_released: Vec<i32>,
    intro: Option<Intro>,
    shots_from: i32,
    next_id: i32,
    rng_ai: Rng,
    rng_fit: Rng,
    rng_toy: Rng,
    rng_egg: Rng,
    rng_words: Rng,
    dist_key: i32,
    dist_map: Vec<i16>,
}

impl StoreWorld {
    /// `room`: optional room override (tests use it to prove rooms of any size and a camera work);
    /// its fixture count must match `run.level.stores[store_id].fixtures`. `None` = the store's own room.
    /// Panics (TS throws) if the store is not open in this level.
    pub fn new(run: &mut Run, store_id: StoreId, rng: &Rng, room: Option<Room>) -> StoreWorld {
        let room = room.unwrap_or_else(|| get_room(store_id).clone());
        if run.level.store(store_id).is_none() {
            panic!("store {} is not open in this level", store_id.as_str());
        }
        // fork every sub-stream up front, in a fixed order
        let rng_ai = rng.fork("guards");
        let rng_fit = rng.fork("fitting");
        let rng_toy = rng.fork("toys");
        let rng_egg = rng.fork("egg");
        let rng_words = rng.fork("words");

        let agent = Agent {
            // the doorway is 2 tiles wide: start on the line between them, just above it
            x: (room.door.col * TILE + TILE) as f64,
            y: room.spawn.row as f64 * TILE_F + TILE_F / 2.0,
            facing: Dir::Up,
            moving: false,
            anim: 0,
            stun: 0,
            hurt: 0,
            hold: None,
            dying: 0,
            shoot_cd: 0,
        };

        let mut w = StoreWorld {
            store_id,
            def: store_def(store_id),
            room,
            first_visit: false,
            frame: 0,
            exited: false,
            died: false,
            agent,
            guards: Vec::new(),
            bullets: Vec::new(),
            toys: Vec::new(),
            puffs: Vec::new(),
            popups: Vec::new(),
            bubbles: Vec::new(),
            banner: None,
            search: None,
            search_target: -1,
            on_booth: false,
            cam_x: 0,
            cam_y: 0,
            egg: None,
            peeked: Vec::new(),
            fit_rolled: Vec::new(),
            shelves_released: Vec::new(),
            intro: None,
            shots_from: GRACE_FRAMES,
            next_id: 1,
            rng_ai,
            rng_fit,
            rng_toy,
            rng_egg,
            rng_words,
            dist_key: -1,
            dist_map: Vec::new(),
        };

        let spawns = w.room.guards.clone();
        for g in &spawns {
            let guard = w.make_guard(g.kind, g.col, g.row, g.axis);
            w.guards.push(guard);
        }

        w.first_visit = !run.has_seen_store(store_id);
        run.mark_store_seen(store_id);
        let lines = if w.first_visit { first_visit(store_id) } else { None };
        if let Some(lines) = lines {
            if !lines.is_empty() {
                w.intro = Some(Intro { lines, t: 0, next: 0, active: true });
                w.shots_from = GRACE_FRAMES.max(w.intro_end() + 45);
            }
        }

        if store_id == StoreId::Gamestonk && !run.easter_egg_done && w.room.clerk.is_some() && w.room.pedestal.is_some() {
            run.easter_egg_done = true;
            let item = *w.rng_egg.pick(EASTER_EGG.items);
            w.egg = Some(EggState { phase: EggPhase::Type, t: 0, shown: 0, item });
        }
        w.update_camera();
        w.search_target = w.find_search_target(run);
        w
    }

    // ------------------------------------------------------------------ the persistent store state
    /// The persistent per-level state of this store (`run.level.stores[id]`).
    pub fn store<'a>(&self, run: &'a Run) -> &'a StoreState {
        run.level.store(self.store_id).expect("store is open")
    }

    pub fn store_mut<'a>(&self, run: &'a mut Run) -> &'a mut StoreState {
        run.level.store_mut(self.store_id).expect("store is open")
    }

    // ------------------------------------------------------------------ public read API (renderers, HUD, Game)
    /// The store's own song, `Booth` on the Sam Baddy listening booth, `Itemget` while the easter-egg item is held.
    pub fn music(&self) -> MusicId {
        if let Some(e) = &self.egg {
            if e.phase == EggPhase::Get {
                return MusicId::Itemget;
            }
        }
        if self.on_booth {
            return MusicId::Booth;
        }
        match self.def.song {
            Some(s) => MusicId::ALL.iter().copied().find(|m| m.as_str() == s).unwrap_or(MusicId::Mall),
            None => MusicId::Mall,
        }
    }

    pub fn name(&self) -> &'static str {
        self.def.name
    }

    /// "NOW PLAYING: SIDE B" is showing (the agent stands on the listening booth).
    pub fn now_playing(&self) -> bool {
        self.on_booth
    }

    pub fn search_progress(&self) -> f64 {
        match &self.search {
            Some(s) => (s.t as f64 / s.total as f64).min(1.0),
            None => 0.0,
        }
    }

    /// A search can start right now (touching an unsearched fixture, free to act).
    pub fn can_search(&self) -> bool {
        self.search.is_none() && self.search_target >= 0 && !self.input_frozen() && self.agent.stun == 0
    }

    pub fn fixture_opened(&self, run: &Run, i: usize) -> bool {
        self.store(run).fixtures.get(i).map_or(false, |f| f.opened)
    }

    /// Radar power-up: this fixture holds the package and has not been searched (renderer flashes a "!").
    pub fn radar_marked(&self, run: &Run, i: usize) -> bool {
        match self.store(run).fixtures.get(i) {
            Some(f) => run.power.radar && !f.opened && f.content == FixtureContent::Package,
            None => false,
        }
    }

    pub fn toy_shelf_released(&self, col: i32, row: i32) -> bool {
        self.shelves_released.contains(&(row * self.room.cols + col))
    }

    /// Easter egg: text printed so far by the typewriter (None when no box is showing).
    pub fn typewriter(&self) -> Option<&'static str> {
        let e = self.egg.as_ref()?;
        if e.phase != EggPhase::Type && e.phase != EggPhase::Wait {
            return None;
        }
        Some(&EASTER_EGG.clerk[..(e.shown as usize).min(EASTER_EGG.clerk.len())])
    }

    pub fn clerk_visible(&self) -> bool {
        matches!(&self.egg, Some(e) if e.phase != EggPhase::Done)
    }

    /// The easter-egg item currently standing on the pedestal (None when none).
    pub fn pedestal_item(&self) -> Option<&'static str> {
        match &self.egg {
            Some(e) if e.phase == EggPhase::Item => Some(e.item),
            _ => None,
        }
    }

    pub fn view_w(&self) -> i32 {
        VIEW_W
    }
    pub fn view_h(&self) -> i32 {
        VIEW_H
    }

    /// Testing / debug helper: put the agent at the centre of a tile.
    pub fn teleport_agent(&mut self, run: &Run, col: i32, row: i32) {
        self.teleport_agent_by(run, col, row, 0.0, 0.0);
    }

    /// `teleportAgent(col, row, dx, dy)`.
    pub fn teleport_agent_by(&mut self, run: &Run, col: i32, row: i32, dx: f64, dy: f64) {
        self.agent.x = col as f64 * TILE_F + TILE_F / 2.0 + dx;
        self.agent.y = row as f64 * TILE_F + TILE_F / 2.0 + dy;
        self.update_camera();
        self.search_target = self.find_search_target(run);
    }

    // ------------------------------------------------------------------ the frame
    pub fn step(&mut self, run: &mut Run, pad: Pad) {
        if self.exited || self.died {
            return;
        }
        self.frame += 1;
        run.tick_powers();
        self.tick_cosmetics();
        if self.agent.dying > 0 {
            self.agent.dying += 1;
            if self.agent.dying > DEATH_FRAMES {
                self.died = true;
            }
            self.update_camera();
            return;
        }
        self.update_egg(run);
        self.update_intro();
        if let Some(h) = &mut self.agent.hold {
            h.t -= 1;
            if h.t <= 0 {
                self.agent.hold = None;
            }
        }

        if !self.input_frozen() {
            self.update_agent(run, pad);
        } else {
            self.agent.moving = false;
        }

        if !self.world_frozen() {
            self.update_guards(run);
            self.update_toys(run);
            self.update_bullets(run);
            self.update_contacts(run);
        }

        if self.agent.dying == 0 {
            let col = (self.agent.x / TILE_F).floor() as i32;
            let row = (self.agent.y / TILE_F).floor() as i32;
            self.on_booth = tile_at(&self.room, col, row) == TileKind::Booth;
            if is_door_tile(&self.room, col, row) && !self.input_frozen() {
                self.exited = true;
                self.search = None;
                run.sfx(SfxId::Door);
            }
        }
        self.update_camera();
        self.search_target = match &self.search {
            Some(s) => s.fixture as i32,
            None => self.find_search_target(run),
        };
    }

    fn input_frozen(&self) -> bool {
        let egg_busy = matches!(&self.egg, Some(e) if e.phase == EggPhase::Type || e.phase == EggPhase::Wait || e.phase == EggPhase::Get);
        self.agent.dying > 0 || self.agent.hold.is_some() || egg_busy
    }

    fn world_frozen(&self) -> bool {
        self.input_frozen()
    }

    fn tick_cosmetics(&mut self) {
        if let Some(b) = &mut self.banner {
            b.t -= 1;
            if b.t <= 0 {
                self.banner = None;
            }
        }
        let mut i = self.bubbles.len();
        while i > 0 {
            i -= 1;
            self.bubbles[i].t -= 1;
            if self.bubbles[i].t <= 0 {
                self.bubbles.remove(i);
            }
        }
        tick_popups(&mut self.popups);
        let mut i = self.puffs.len();
        while i > 0 {
            i -= 1;
            self.puffs[i].t -= 1;
            if self.puffs[i].t <= 0 {
                self.puffs.remove(i);
            }
        }
    }

    // ------------------------------------------------------------------ solidity
    fn clerk_at(&self, col: i32, row: i32) -> bool {
        match self.room.clerk {
            Some(c) => self.clerk_visible() && c.col == col && c.row == row,
            None => false,
        }
    }

    fn solid_for_agent(&self, col: i32, row: i32) -> bool {
        is_solid_kind(tile_at(&self.room, col, row)) || self.clerk_at(col, row)
    }

    /// Guards, toys and shoes cannot leave through the doorway.
    fn solid_for_guard(&self, col: i32, row: i32) -> bool {
        self.solid_for_agent(col, row) || tile_at(&self.room, col, row) == TileKind::Door
    }

    // ------------------------------------------------------------------ the agent
    fn update_agent(&mut self, run: &mut Run, pad: Pad) {
        if self.agent.shoot_cd > 0 {
            self.agent.shoot_cd -= 1;
        }
        if self.agent.hurt > 0 {
            self.agent.hurt -= 1;
        }
        if self.agent.stun > 0 {
            self.agent.stun -= 1;
            self.agent.moving = false;
            self.search = None;
            return;
        }
        if self.search.is_some() && !self.update_search(run, pad) {
            self.agent.moving = false;
            return;
        }
        let fired = self.try_shoot(run, pad);
        if !fired && (pad.pressed & pad::B) != 0 {
            let target = self.find_search_target(run);
            if target >= 0 {
                self.face_fixture(target as usize);
                self.search = Some(SearchState { fixture: target as usize, t: 0, total: run.search_frames() });
                run.sfx(SfxId::SearchTick);
                self.agent.moving = false;
                return;
            }
        }
        // movement: vertical input has priority
        let held = pad.held;
        let up = (held & pad::UP) != 0;
        let down = (held & pad::DOWN) != 0;
        let left = (held & pad::LEFT) != 0;
        let right = (held & pad::RIGHT) != 0;
        let mut axis: Option<Axis> = None;
        let mut sign = 0.0_f64;
        if up || down {
            if up != down {
                axis = Some(Axis::Y);
                sign = if up { -1.0 } else { 1.0 };
            }
        } else if left != right {
            axis = Some(Axis::X);
            sign = if left { -1.0 } else { 1.0 };
        }
        let axis = match axis {
            Some(a) => a,
            None => {
                self.agent.moving = false;
                return;
            }
        };
        self.agent.facing = if axis == Axis::Y {
            if sign < 0.0 {
                Dir::Up
            } else {
                Dir::Down
            }
        } else if sign < 0.0 {
            Dir::Left
        } else {
            Dir::Right
        };
        let speed = AGENT_SPEED * run.walk_factor();
        let mut p = Vec2 { x: self.agent.x, y: self.agent.y };
        let moved = move_axis(&|c, r| self.solid_for_agent(c, r), &mut p, axis, sign * speed, MoveOpts { half: HALF, assist: true });
        self.agent.x = p.x;
        self.agent.y = p.y;
        self.agent.moving = moved;
        if moved {
            self.agent.anim += 1;
        }
    }

    /// Progress the running search. Returns true only if it was CANCELLED this frame (the agent may then act normally).
    fn update_search(&mut self, run: &mut Run, pad: Pad) -> bool {
        let mut s = self.search.expect("search running");
        let fx_open = match self.store(run).fixtures.get(s.fixture) {
            None => true,
            Some(fx) => fx.opened,
        };
        if fx_open {
            self.search = None;
            return true;
        }
        let fresh_dir = pad.pressed & DIR_MASK;
        if (pad.pressed & pad::A) != 0 || (fresh_dir & !self.agent.facing.bit()) != 0 {
            // a fresh press of a different direction, or shooting, cancels the search (and acts on the same frame)
            self.search = None;
            return true;
        }
        s.t += 1;
        self.search = Some(s);
        if s.t % 10 == 0 {
            run.sfx(SfxId::SearchTick);
        }
        if s.t >= s.total {
            self.search = None;
            self.complete_search(run, s.fixture);
            return false;
        }
        false
    }

    fn try_shoot(&mut self, run: &mut Run, pad: Pad) -> bool {
        if self.agent.shoot_cd > 0 || ((pad.pressed | pad.held) & pad::A) == 0 {
            return false;
        }
        let prof = run.fire_profile();
        let alive: i32 = self.bullets.iter().map(|b| if b.kind == BulletKind::Agent { 1 } else { 0 }).sum();
        let n = if prof.spread { 3 } else { 1 };
        if alive + n > prof.max_bullets {
            return false;
        }
        let (ux, uy) = self.agent.facing.vec();
        let angles: &[f64] = if prof.spread { &[-0.32, 0.0, 0.32] } else { &[0.0] };
        for &ang in angles {
            let cos = ang.cos();
            let sin = ang.sin();
            let vx = (ux * cos - uy * sin) * BULLET_SPEED;
            let vy = (ux * sin + uy * cos) * BULLET_SPEED;
            self.bullets.push(Bullet {
                kind: BulletKind::Agent,
                x: self.agent.x + ux * (HALF + 3.0),
                y: self.agent.y + uy * (HALF + 3.0),
                vx,
                vy,
                age: 0,
                noclip: 0,
            });
        }
        self.agent.shoot_cd = prof.cooldown;
        run.sfx(SfxId::Shot);
        true
    }

    // ------------------------------------------------------------------ searching
    /// The best unsearched fixture the agent is touching (front or either side), or -1.
    pub fn find_search_target(&self, run: &Run) -> i32 {
        let a = &self.agent;
        if a.dying > 0 {
            return -1;
        }
        let mut best: i32 = -1;
        let mut best_score = f64::NEG_INFINITY;
        let store = self.store(run);
        for f in &self.room.fixtures {
            if store.fixtures.get(f.index).map_or(false, |s| s.opened) {
                continue;
            }
            let l = (f.col * TILE) as f64;
            let t = (f.row * TILE) as f64;
            let r = l + TILE_F;
            let b = t + TILE_F;
            let gx = (l - (a.x + HALF)).max(a.x - HALF - r).max(0.0);
            let gy = (t - (a.y + HALF)).max(a.y - HALF - b).max(0.0);
            if gx > TOUCH_MARGIN || gy > TOUCH_MARGIN {
                continue;
            }
            let ox = (a.x + HALF).min(r) - (a.x - HALF).max(l);
            let oy = (a.y + HALF).min(b) - (a.y - HALF).max(t);
            let side = self.side_of(f.col, f.row);
            let score = (if side == a.facing { 1000.0 } else { 0.0 }) + ox.max(0.0) + oy.max(0.0) - f.index as f64 * 0.001;
            if score > best_score {
                best_score = score;
                best = f.index as i32;
            }
        }
        best
    }

    /// Which side of the agent a tile is on (dominant axis of the centre-to-centre vector).
    fn side_of(&self, col: i32, row: i32) -> Dir {
        let dx = col as f64 * TILE_F + TILE_F / 2.0 - self.agent.x;
        let dy = row as f64 * TILE_F + TILE_F / 2.0 - self.agent.y;
        if dx.abs() > dy.abs() {
            return if dx > 0.0 { Dir::Right } else { Dir::Left };
        }
        if dy > 0.0 {
            Dir::Down
        } else {
            Dir::Up
        }
    }

    fn face_fixture(&mut self, i: usize) {
        let f = self.room.fixtures[i];
        self.agent.facing = self.side_of(f.col, f.row);
    }

    fn fixture_centre(&self, i: usize) -> (f64, f64) {
        let f = self.room.fixtures[i];
        (f.col as f64 * TILE_F + TILE_F / 2.0, f.row as f64 * TILE_F + TILE_F / 2.0)
    }

    fn complete_search(&mut self, run: &mut Run, i: usize) {
        let spot = self.room.fixtures[i];
        if spot.kind == FixtureKind::Fitting && !self.fit_rolled.contains(&i) {
            self.fit_rolled.push(i);
            if self.rng_fit.chance(FITTING_CHANCE) {
                self.fitting_spy(run, i);
                return; // the fitting room's real contents stay unsearched
            }
        }
        let content = {
            let fx = &mut self.store_mut(run).fixtures[i];
            fx.opened = true;
            fx.content
        };
        let (cx, cy) = self.fixture_centre(i);
        match content {
            FixtureContent::Package => {
                self.store_mut(run).package_taken = true;
                run.add_score(POINTS.package);
                let n = run.packages();
                self.hold(HeldItem { kind: HeldKind::Package, power: None, label: "PACKAGE", t: HOLD_PACKAGE, total: HOLD_PACKAGE });
                self.banner = Some(make_banner(&package_banner(n), HOLD_PACKAGE + 40, None, None));
                self.popup(cx, cy - 10.0, format!("+{}", POINTS.package));
                run.sfx(SfxId::Fanfare);
            }
            FixtureContent::Powerup(power) => {
                let name = run.give_power(power);
                run.add_score(POINTS.powerup);
                self.hold(HeldItem { kind: HeldKind::Power, power: Some(power), label: name, t: HOLD_POWER, total: HOLD_POWER });
                self.banner = Some(make_banner(name, HOLD_POWER + 40, None, None));
                self.popup(cx, cy - 10.0, format!("+{}", POINTS.powerup));
                run.sfx(SfxId::Powerup);
            }
            FixtureContent::Trap => {
                self.puff(cx, cy, PuffKind::Smoke);
                self.banner = Some(make_banner(UI.trap, 90, None, None));
                self.agent.stun = STUN_FRAMES;
                run.sfx(SfxId::Smoke);
            }
            FixtureContent::Nothing => {
                self.puff(cx, cy, PuffKind::Smoke);
                self.banner = Some(make_banner(UI.nothing, 80, None, None));
                run.sfx(SfxId::Smoke);
            }
        }
    }

    fn hold(&mut self, item: HeldItem) {
        self.agent.hold = Some(item);
        self.agent.facing = Dir::Down;
        self.agent.moving = false;
    }

    // ------------------------------------------------------------------ Forever 12 fitting room
    fn fitting_spy(&mut self, run: &mut Run, i: usize) {
        let spot = self.room.fixtures[i];
        self.peeked.push(i);
        let mut g = self.make_guard(GuardKind::Spy, spot.col, spot.row, GuardAxis::H);
        g.change = FITTING_CHANGE_FRAMES;
        g.armed_at = self.frame + FITTING_CHANGE_FRAMES + 60;
        let (gx, gy) = (g.x, g.y);
        self.guards.push(g);
        self.bubbles.push(Bubble { text: SHOUTS.fitting.to_string(), x: gx, y: gy - 10.0, t: 70 });
        run.sfx(SfxId::Shriek);
    }

    fn throw_shoe(&mut self, run: &mut Run, gi: usize) {
        let (gx, gy) = (self.guards[gi].x, self.guards[gi].y);
        let a = &self.agent;
        let mut dx = a.x - gx;
        let mut dy = a.y - gy;
        let h = dx.hypot(dy);
        let len = if h == 0.0 { 1.0 } else { h };
        dx /= len;
        dy /= len;
        self.bullets.push(Bullet {
            kind: BulletKind::Shoe,
            x: gx + dx * 9.0,
            y: gy + dy * 9.0,
            vx: dx * ENEMY_BULLET_SPEED,
            vy: dy * ENEMY_BULLET_SPEED,
            age: 0,
            noclip: 8,
        });
        run.sfx(SfxId::EnemyShot);
    }

    // ------------------------------------------------------------------ guards
    fn make_guard(&mut self, kind: GuardKind, col: i32, row: i32, axis: GuardAxis) -> Guard {
        let id = self.next_id;
        self.next_id += 1;
        Guard {
            id,
            kind,
            x: col as f64 * TILE_F + TILE_F / 2.0,
            y: row as f64 * TILE_F + TILE_F / 2.0,
            col,
            row,
            moving: false,
            tx: col as f64 * TILE_F + TILE_F / 2.0,
            ty: row as f64 * TILE_F + TILE_F / 2.0,
            dir: if axis == GuardAxis::V { Dir::Down } else { Dir::Right },
            facing: Dir::Down,
            hp: if kind == GuardKind::Bot { BOT_HP } else { 1 },
            stun: 0,
            aim: 0,
            aim_dir: Dir::Down,
            cooldown: 0,
            think: 0,
            armed_at: 0,
            hit_flash: 0,
            dead: false,
            dead_t: 0,
            anim: 0,
            change: 0,
            prev_col: col,
            prev_row: row,
        }
    }

    fn spy_speed(&self, run: &Run) -> f64 {
        (0.7 + 0.07 * 0.max(run.loop_ - 1) as f64).min(1.2)
    }

    fn shot_cooldown(&self, run: &Run) -> i32 {
        50.max(round_i(difficulty(run.loop_, run.black_friday).shot_interval as f64 * 0.75))
    }

    fn aim_frames(&self, run: &Run) -> i32 {
        18.max(AIM_FRAMES - 3 * 0.max(run.loop_ - 1))
    }

    fn update_guards(&mut self, run: &mut Run) {
        // first-visit chatter: the guards hold still while they talk (they can still be shot)
        let talking = matches!(&self.intro, Some(i) if i.active);
        let mut i = self.guards.len();
        while i > 0 {
            i -= 1;
            if self.guards[i].dead {
                self.guards[i].dead_t += 1;
                if self.guards[i].dead_t > 16 {
                    self.guards.remove(i);
                }
                continue;
            }
            if self.guards[i].hit_flash > 0 {
                self.guards[i].hit_flash -= 1;
            }
            if self.guards[i].cooldown > 0 {
                self.guards[i].cooldown -= 1;
            }
            if talking {
                continue;
            }
            if self.guards[i].stun > 0 {
                self.guards[i].stun -= 1;
                continue;
            }
            if self.guards[i].kind == GuardKind::Spy {
                self.update_spy(run, i);
            } else {
                self.update_bot(run, i);
            }
        }
    }

    fn spy_can_shoot(&self, g: &Guard) -> bool {
        g.cooldown <= 0 && self.frame >= self.shots_from.max(g.armed_at)
    }

    fn update_spy(&mut self, run: &mut Run, gi: usize) {
        if self.guards[gi].change > 0 {
            self.guards[gi].change -= 1;
            self.guards[gi].facing = Dir::Down;
            if self.guards[gi].change == 14 {
                self.throw_shoe(run, gi);
            }
            return;
        }
        if self.guards[gi].aim > 0 {
            self.guards[gi].aim -= 1;
            if self.guards[gi].aim == 0 {
                self.spy_fire(run, gi);
            }
            return;
        }
        if self.guards[gi].moving {
            let sp = self.spy_speed(run);
            let g = &mut self.guards[gi];
            g.anim += 1;
            let dx = g.tx - g.x;
            let dy = g.ty - g.y;
            if dx.abs() <= sp && dy.abs() <= sp {
                g.x = g.tx;
                g.y = g.ty;
                g.moving = false;
                g.think = 4;
            } else {
                if dx.abs() > sp {
                    g.x += js_sign(dx) * sp;
                } else {
                    g.x = g.tx;
                }
                if dy.abs() > sp {
                    g.y += js_sign(dy) * sp;
                } else {
                    g.y = g.ty;
                }
            }
            return;
        }
        if self.guards[gi].think > 0 {
            self.guards[gi].think -= 1;
            return;
        }
        // at a tile centre: shoot if lined up with a clear path, otherwise take one step
        if self.spy_can_shoot(&self.guards[gi]) {
            let dir = self.line_of_fire(&self.guards[gi]);
            if let Some(dir) = dir {
                let aim = self.aim_frames(run);
                let g = &mut self.guards[gi];
                g.aim = aim;
                g.aim_dir = dir;
                g.facing = dir;
                return;
            }
        }
        self.spy_step(gi);
    }

    fn spy_fire(&mut self, run: &mut Run, gi: usize) {
        let (gx, gy, dir) = {
            let g = &self.guards[gi];
            (g.x, g.y, g.aim_dir)
        };
        let (ux, uy) = dir.vec();
        let speed = self.enemy_bullet_speed(run);
        self.bullets.push(Bullet { kind: BulletKind::Enemy, x: gx + ux * 9.0, y: gy + uy * 9.0, vx: ux * speed, vy: uy * speed, age: 0, noclip: 0 });
        let cd = self.shot_cooldown(run);
        let g = &mut self.guards[gi];
        g.cooldown = cd;
        g.think = 10;
        run.sfx(SfxId::EnemyShot);
    }

    fn enemy_bullet_speed(&self, run: &Run) -> f64 {
        (ENEMY_BULLET_SPEED + 0.1 * 0.max(run.loop_ - 1) as f64).min(2.8)
    }

    /// Direction a spy at this tile centre could shoot the agent along a clear row/column, or None.
    pub fn line_of_fire(&self, g: &Guard) -> Option<Dir> {
        let a = &self.agent;
        let reach = HALF + 1.0;
        let gc = (g.x / TILE_F).floor() as i32;
        let gr = (g.y / TILE_F).floor() as i32;
        let ac = (a.x / TILE_F).floor() as i32;
        let ar = (a.y / TILE_F).floor() as i32;
        if (a.y - g.y).abs() < reach && (a.x - g.x).abs() > 4.0 {
            let step = if ac > gc { 1 } else { -1 };
            let mut clear = true;
            let mut c = gc + step;
            while c != ac + step && clear {
                if self.solid_for_guard(c, gr) {
                    clear = false;
                }
                c += step;
            }
            if clear {
                return Some(if a.x > g.x { Dir::Right } else { Dir::Left });
            }
        }
        if (a.x - g.x).abs() < reach && (a.y - g.y).abs() > 4.0 {
            let step = if ar > gr { 1 } else { -1 };
            let mut clear = true;
            let mut r = gr + step;
            while r != ar + step && clear {
                if self.solid_for_guard(gc, r) {
                    clear = false;
                }
                r += step;
            }
            if clear {
                return Some(if a.y > g.y { Dir::Down } else { Dir::Up });
            }
        }
        None
    }

    fn agent_distances(&mut self) {
        let col = 0.max((self.room.cols - 1).min((self.agent.x / TILE_F).floor() as i32));
        let row = 0.max((self.room.rows - 1).min((self.agent.y / TILE_F).floor() as i32));
        let key = row * self.room.cols + col;
        if key != self.dist_key {
            self.dist_key = key;
            self.dist_map = walk_distances(&self.room, Cell { col, row }, false);
        }
    }

    fn tile_taken(&self, col: i32, row: i32, except: usize) -> bool {
        for (oi, o) in self.guards.iter().enumerate() {
            if oi != except && !o.dead && o.col == col && o.row == row {
                return true;
            }
        }
        false
    }

    /// Spies move tile by tile, favouring the player (shortest walk), with some wandering.
    fn spy_step(&mut self, gi: usize) {
        self.agent_distances();
        let (g_col, g_row, g_prev_col, g_prev_row) = {
            let g = &self.guards[gi];
            (g.col, g.row, g.prev_col, g.prev_row)
        };
        let mut cands: Vec<Cand> = Vec::new();
        for dir in DIR_ORDER {
            let (dx, dy) = dir.vec();
            let col = g_col + dx as i32;
            let row = g_row + dy as i32;
            if !guard_walkable(&self.room, col, row) || self.clerk_at(col, row) || self.tile_taken(col, row, gi) {
                continue;
            }
            let d = self.dist_map[(row * self.room.cols + col) as usize] as i32;
            cands.push(Cand { dir, col, row, d: if d < 0 { 99 } else { d } });
        }
        if cands.is_empty() {
            self.guards[gi].think = 15;
            return;
        }
        let here = self.dist_map[(g_row * self.room.cols + g_col) as usize] as i32;
        // within two tiles of the agent: hold the range, strafing about half the time
        if here >= 0 && here <= 2 && self.rng_ai.chance(0.5) {
            self.guards[gi].think = 20;
            return;
        }
        let mut pick = cands[0];
        if self.rng_ai.chance(0.25) {
            pick = *self.rng_ai.pick(&cands);
        } else {
            let mut best = f64::INFINITY;
            for c in &cands {
                let back = c.col == g_prev_col && c.row == g_prev_row && cands.len() > 1;
                let score = c.d as f64 + (if back { 1.5 } else { 0.0 }) + self.rng_ai.next() * 0.5;
                if score < best {
                    best = score;
                    pick = *c;
                }
            }
        }
        let g = &mut self.guards[gi];
        g.prev_col = g.col;
        g.prev_row = g.row;
        g.col = pick.col;
        g.row = pick.row;
        g.tx = pick.col as f64 * TILE_F + TILE_F / 2.0;
        g.ty = pick.row as f64 * TILE_F + TILE_F / 2.0;
        g.facing = pick.dir;
        g.moving = true;
    }

    /// Security bots patrol back and forth, turning at walls, fixtures and each other.
    fn update_bot(&mut self, run: &Run, gi: usize) {
        let speed = (0.7 + 0.05 * 0.max(run.loop_ - 1) as f64).min(1.2);
        let (gx, gy, gdir) = {
            let g = &self.guards[gi];
            (g.x, g.y, g.dir)
        };
        let (dx, dy) = gdir.vec();
        let nx = gx + dx * speed;
        let ny = gy + dy * speed;
        let mut blocked = !box_free(&|c, r| self.solid_for_guard(c, r), nx, ny, HALF);
        if !blocked {
            for (oi, o) in self.guards.iter().enumerate() {
                if oi != gi && !o.dead && o.kind == GuardKind::Bot && boxes_overlap(nx, ny, HALF, o.x, o.y, HALF) {
                    blocked = true;
                }
            }
        }
        let g = &mut self.guards[gi];
        if blocked {
            g.dir = g.dir.opposite();
            g.facing = g.dir;
            return;
        }
        g.x = nx;
        g.y = ny;
        // keep the tile bookkeeping honest: spies reserve tiles by (col,row) and must see where a bot really is
        g.col = (g.x / TILE_F).floor() as i32;
        g.row = (g.y / TILE_F).floor() as i32;
        g.facing = g.dir;
        g.moving = true;
        g.anim += 1;
    }

    fn hit_guard(&mut self, run: &mut Run, gi: usize) {
        if self.guards[gi].dead {
            return;
        }
        if self.guards[gi].kind == GuardKind::Bot {
            self.guards[gi].hp -= 1;
            if self.guards[gi].hp > 0 {
                self.guards[gi].hit_flash = 8;
                let (x, y) = (self.guards[gi].x, self.guards[gi].y);
                self.puff(x, y, PuffKind::Spark);
                run.sfx(SfxId::HelmetPing);
                return;
            }
        }
        self.kill_guard(run, gi);
    }

    fn kill_guard(&mut self, run: &mut Run, gi: usize) {
        {
            let g = &mut self.guards[gi];
            g.dead = true;
            g.dead_t = 0;
            g.aim = 0;
            g.change = 0;
            g.moving = false;
        }
        let (gx, gy, kind) = {
            let g = &self.guards[gi];
            (g.x, g.y, g.kind)
        };
        run.add_score(POINTS.spy_shot);
        self.popup(gx, gy - 10.0, format!("+{}", POINTS.spy_shot));
        self.puff(gx, gy, PuffKind::Smoke);
        run.sfx(if kind == GuardKind::Bot { SfxId::Crush } else { SfxId::Hurt });
        if kind == GuardKind::Spy && self.rng_words.chance(0.35) {
            let text = *self.rng_words.pick(LAST_WORDS);
            self.bubbles.push(Bubble { text: text.to_string(), x: gx, y: gy - 10.0, t: 70 });
        }
    }

    // ------------------------------------------------------------------ bullets
    fn update_bullets(&mut self, run: &mut Run) {
        let mut i = self.bullets.len();
        while i > 0 {
            i -= 1;
            let mut b = self.bullets[i];
            b.age += 1;
            let mut gone = b.age > 400;
            let mut sub = 0;
            while sub < 2 && !gone {
                b.x += b.vx * HALF_STEP;
                b.y += b.vy * HALF_STEP;
                if b.kind == BulletKind::Agent {
                    let hit = self.guards.iter().position(|o| !o.dead && (o.x - b.x).abs() < HALF + 1.0 && (o.y - b.y).abs() < HALF + 1.0);
                    if let Some(gi) = hit {
                        self.hit_guard(run, gi);
                        gone = true;
                        break;
                    }
                } else if (self.agent.x - b.x).abs() < HALF + 1.0 && (self.agent.y - b.y).abs() < HALF + 1.0 {
                    self.hurt_agent(run);
                    gone = true;
                    break;
                }
                if b.noclip > 0 {
                    sub += 1;
                    continue;
                }
                let col = (b.x / TILE_F).floor() as i32;
                let row = (b.y / TILE_F).floor() as i32;
                if self.solid_for_agent(col, row) {
                    if b.kind == BulletKind::Agent && tile_at(&self.room, col, row) == TileKind::Toyshelf {
                        self.release_toys(run, col, row);
                    }
                    self.puff(b.x - b.vx * HALF_STEP, b.y - b.vy * HALF_STEP, PuffKind::Spark);
                    gone = true;
                }
                sub += 1;
            }
            if b.noclip > 0 {
                b.noclip -= 1;
            }
            if gone {
                self.bullets.remove(i);
            } else {
                self.bullets[i] = b;
            }
        }
    }

    // ------------------------------------------------------------------ being hurt
    fn hurt_agent(&mut self, run: &mut Run) -> bool {
        if self.agent.dying > 0 || self.agent.hurt > 0 || run.invincible() {
            return false;
        }
        if run.absorb_hit() {
            self.agent.hurt = HURT_FRAMES;
            run.sfx(SfxId::Hurt);
            let (x, y) = (self.agent.x, self.agent.y);
            self.puff(x, y, PuffKind::Spark);
            return false;
        }
        self.agent.dying = 1;
        self.agent.moving = false;
        self.search = None;
        run.sfx(SfxId::Death);
        true
    }

    /// Bot contact kills (or is absorbed); a Cinnabomb agent kills whatever he touches.
    fn update_contacts(&mut self, run: &mut Run) {
        for gi in 0..self.guards.len() {
            let (dead, gx, gy, kind, stun) = {
                let g = &self.guards[gi];
                (g.dead, g.x, g.y, g.kind, g.stun)
            };
            if dead || !boxes_overlap(self.agent.x, self.agent.y, HALF, gx, gy, HALF - 1.0) {
                continue;
            }
            if run.invincible() {
                self.kill_guard(run, gi);
            } else if kind == GuardKind::Bot && stun == 0 {
                let was_hurt = self.agent.hurt;
                let killed = self.hurt_agent(run);
                if !killed && was_hurt == 0 && self.agent.hurt > 0 {
                    self.guards[gi].stun = 90;
                }
            }
            if self.agent.dying > 0 {
                return;
            }
        }
    }

    // ------------------------------------------------------------------ KGB Toys
    fn release_toys(&mut self, run: &mut Run, col: i32, row: i32) {
        let key = row * self.room.cols + col;
        if self.shelves_released.contains(&key) {
            return;
        }
        self.shelves_released.push(key);
        run.sfx(SfxId::Bounce);
        let mut open: Vec<Dir> = Vec::new();
        for d in [Dir::Down, Dir::Left, Dir::Right, Dir::Up] {
            let (dx, dy) = d.vec();
            if !self.solid_for_guard(col + dx as i32, row + dy as i32) {
                open.push(d);
            }
        }
        if open.is_empty() {
            return;
        }
        for i in 0..3usize {
            let d = open[i % open.len()];
            let (dx, dy) = d.vec();
            // when fewer than 3 sides are open, the extra toys start a few px further along the same side
            let extra = (i / open.len()) as f64 * 5.0;
            let id = self.next_id;
            self.next_id += 1;
            self.toys.push(Toy {
                id,
                x: (col as f64 + dx) * TILE_F + TILE_F / 2.0 + dx * extra,
                y: (row as f64 + dy) * TILE_F + TILE_F / 2.0 + dy * extra,
                dir: d,
                age: 0,
                turns: 0,
                cool: 0,
            });
        }
    }

    fn update_toys(&mut self, run: &mut Run) {
        let mut i = self.toys.len();
        while i > 0 {
            i -= 1;
            let mut t = self.toys[i];
            t.age += 1;
            if t.cool > 0 {
                t.cool -= 1;
            }
            if t.age >= TOY_LIFE {
                self.puff(t.x, t.y, PuffKind::Smoke);
                self.toys.remove(i);
                continue;
            }
            let (dx, dy) = t.dir.vec();
            let nx = t.x + dx * TOY_SPEED;
            let ny = t.y + dy * TOY_SPEED;
            if box_free(&|c, r| self.solid_for_guard(c, r), nx, ny, 4.0) {
                t.x = nx;
                t.y = ny;
            } else {
                // turn at walls: left or right at random, else straight back
                let idx = DIR_ORDER.iter().position(|d| *d == t.dir).unwrap();
                let cw = DIR_ORDER[(idx + 1) % 4];
                let ccw = DIR_ORDER[(idx + 3) % 4];
                let options: [Dir; 3] = if self.rng_toy.chance(0.5) { [cw, ccw, t.dir.opposite()] } else { [ccw, cw, t.dir.opposite()] };
                for d in options {
                    let (ox, oy) = d.vec();
                    if box_free(&|c, r| self.solid_for_guard(c, r), t.x + ox * TOY_SPEED, t.y + oy * TOY_SPEED, 4.0) {
                        t.dir = d;
                        break;
                    }
                }
                t.turns += 1;
            }
            // stun guards
            for gi in 0..self.guards.len() {
                let (dead, gx, gy) = {
                    let g = &self.guards[gi];
                    (g.dead, g.x, g.y)
                };
                if dead || t.cool > 0 || !boxes_overlap(t.x, t.y, 4.0, gx, gy, HALF) {
                    continue;
                }
                if self.guards[gi].stun < 30 {
                    self.guards[gi].stun = TOY_STUN;
                    self.guards[gi].aim = 0;
                    self.puff(gx, gy - 6.0, PuffKind::Spark);
                }
                t.dir = t.dir.opposite();
                t.cool = 20;
            }
            // set off traps
            for fi in 0..self.room.fixtures.len() {
                let f = self.room.fixtures[fi];
                let fx = self.store(run).fixtures[f.index];
                if fx.opened || fx.content != FixtureContent::Trap {
                    continue;
                }
                let cx = (f.col * TILE) as f64 + TILE_F / 2.0;
                let cy = (f.row * TILE) as f64 + TILE_F / 2.0;
                if (t.x - cx).abs() < TILE_F / 2.0 + 4.0 + 2.0 && (t.y - cy).abs() < TILE_F / 2.0 + 4.0 + 2.0 {
                    self.spring_trap(run, f.index);
                }
            }
            self.toys[i] = t;
        }
    }

    /// A toy set off a trap: smoke that stuns nearby guards (and opens the fixture).
    fn spring_trap(&mut self, run: &mut Run, i: usize) {
        self.store_mut(run).fixtures[i].opened = true;
        let (cx, cy) = self.fixture_centre(i);
        self.puff(cx, cy, PuffKind::Smoke);
        run.sfx(SfxId::Smoke);
        for g in self.guards.iter_mut() {
            if g.dead || (g.x - cx).hypot(g.y - cy) > 56.0 {
                continue;
            }
            g.stun = g.stun.max(TOY_STUN);
            g.aim = 0;
        }
    }

    // ------------------------------------------------------------------ first-visit lines
    fn intro_start(&self, k: i32) -> i32 {
        INTRO_START + k * INTRO_GAP
    }

    fn intro_end(&self) -> i32 {
        let n = self.intro.as_ref().map_or(0, |i| i.lines.len()) as i32;
        if n == 0 {
            0
        } else {
            self.intro_start(n - 1) + INTRO_TAIL
        }
    }

    fn update_intro(&mut self) {
        let mut it = match self.intro {
            Some(it) if it.active => it,
            _ => return,
        };
        it.t += 1;
        if it.next < it.lines.len() && it.t >= self.intro_start(it.next as i32) {
            let line = it.lines[it.next];
            it.next += 1;
            let speaker = self.speaker(line.who);
            if let Some((sx, sy)) = speaker {
                // a speaker's new line replaces his old bubble
                self.bubbles.retain(|b| (b.x - sx).abs() > 1.0 || (b.y - (sy - 10.0)).abs() > 1.0);
                self.bubbles.push(Bubble { text: line.text.to_string(), x: sx, y: sy - 10.0, t: BUBBLE_FRAMES });
            }
        }
        if it.t >= self.intro_end() {
            it.active = false;
        }
        self.intro = Some(it);
    }

    /// Is the first-visit chatter still going (guards hold still)?
    pub fn intro_active(&self) -> bool {
        matches!(&self.intro, Some(i) if i.active)
    }

    fn speaker(&self, who: BubbleWho) -> Option<(f64, f64)> {
        let want = if who == BubbleWho::Spy { GuardKind::Spy } else { GuardKind::Bot };
        let g = self.guards.iter().find(|g| !g.dead && g.kind == want).or_else(|| self.guards.iter().find(|g| !g.dead));
        g.map(|g| (g.x, g.y))
    }

    // ------------------------------------------------------------------ GameStonk easter egg
    fn update_egg(&mut self, run: &mut Run) {
        let mut e = match self.egg {
            Some(e) if e.phase != EggPhase::Done => e,
            _ => return,
        };
        match e.phase {
            EggPhase::Type => {
                e.t += 1;
                let text = EASTER_EGG.clerk;
                let shown = (text.len() as i32).min(e.t / EGG_TYPE_RATE);
                if shown > e.shown {
                    if text.as_bytes()[(shown - 1) as usize] != b' ' {
                        run.sfx(SfxId::Blip);
                    }
                    e.shown = shown;
                }
                if shown >= text.len() as i32 {
                    e.phase = EggPhase::Wait;
                    e.t = 0;
                }
            }
            EggPhase::Wait => {
                e.t += 1;
                if e.t >= EGG_WAIT {
                    e.phase = EggPhase::Item;
                    e.t = 0;
                }
            }
            EggPhase::Item => {
                let ped = self.room.pedestal.expect("pedestal");
                let a = &self.agent;
                if a.stun == 0 && (a.x / TILE_F).floor() as i32 == ped.col && (a.y / TILE_F).floor() as i32 == ped.row {
                    e.phase = EggPhase::Get;
                    e.t = 0;
                    run.add_joke(e.item);
                    self.hold(HeldItem { kind: HeldKind::Joke, power: None, label: e.item, t: HOLD_JOKE, total: HOLD_JOKE });
                    self.banner = Some(make_banner(&you_got(e.item), HOLD_JOKE, None, None));
                }
            }
            EggPhase::Get => {
                e.t += 1;
                if e.t >= HOLD_JOKE {
                    e.phase = EggPhase::Done;
                    let c = self.room.clerk.expect("clerk");
                    self.puff((c.col * TILE) as f64 + TILE_F / 2.0, (c.row * TILE) as f64 + TILE_F / 2.0, PuffKind::Smoke);
                    run.sfx(SfxId::Smoke);
                }
            }
            EggPhase::Done => {}
        }
        self.egg = Some(e);
    }

    // ------------------------------------------------------------------ small helpers
    fn puff(&mut self, x: f64, y: f64, kind: PuffKind) {
        let total = if kind == PuffKind::Smoke { 24 } else { 9 };
        self.puffs.push(Puff { x, y, kind, t: total, total });
    }

    fn popup(&mut self, x: f64, y: f64, text: String) {
        self.popups.push(Popup { x, y, text, t: 50, color: None });
    }

    fn update_camera(&mut self) {
        let w = room_px_w(&self.room);
        let h = room_px_h(&self.room);
        let a = &self.agent;
        self.cam_x = if w <= VIEW_W {
            0 - ((VIEW_W - w) as f64 / 2.0).floor() as i32
        } else {
            0.max((w - VIEW_W).min(round_i(a.x - VIEW_W_F / 2.0)))
        };
        self.cam_y = if h <= VIEW_H {
            0 - ((VIEW_H - h) as f64 / 2.0).floor() as i32
        } else {
            0.max((h - VIEW_H).min(round_i(a.y - VIEW_H_F / 2.0)))
        };
    }

    /// Room cell under a world pixel position (for renderers / tests).
    pub fn cell_at(&self, x: f64, y: f64) -> Cell {
        Cell { col: (x / TILE_F).floor() as i32, row: (y / TILE_F).floor() as i32 }
    }
}

/// JS `Math.sign` (0 stays 0).
fn js_sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        x
    }
}
