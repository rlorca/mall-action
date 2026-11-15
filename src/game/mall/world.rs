//! The side-scroller mall world: physics, elevators, escalators, shooting, arrival, death and respawn.
//! Port of `game/mall/world.ts`.
//!
//! Differences forced by Rust ownership (the behaviour is identical):
//! * The shared `Run` is passed explicitly (`step(&mut run, pad)`, `hurt_player(&mut run, ..)`) instead of being held by
//!   the world.
//! * The TS `MallModule[]` plug-in list is the concrete `MallExtras` (see `modules/mod.rs`): `extras` is `None` until
//!   `install_extras` is called; the modules run in exactly the TS registration order. While a module hook runs,
//!   `extras` is temporarily taken out of the world (`with_extras`).
//! * Spies are addressed by index (`kill_spy(run, index, by)`); look one up by id with `spy_by_id`.

use super::cars::{call_car, make_cars, step_car};
use super::geometry::*;
use super::modules::MallExtras;
use super::spies::{bullet_hits_spy, spawn_spy_at_car, step_spies};
use super::types::*;
use crate::audio_ids::{MusicId, SfxId};
use crate::content::copy::{packages_left, wrap_words, SpygramPost, FLOOR_BANNERS, LIMITS, PA_LINES, SPYGRAM_ARRIVAL, UI};
use crate::content::layout::{
    EscalatorDef, ShaftDef, ShaftId, ARRIVAL, ESCALATORS, FLOOR_GAP, FLOOR_NAMES, LEVEL_H, LEVEL_W, NUM_FLOORS, SHAFTS, WAGON, WALL_L, WALL_R,
};
use crate::content::stores::{StoreDef, StoreId, DOOR_W, DOOR_X, STORES, STORE_W};
use crate::engine::pad::{has_btn, Pad, A, B, DOWN, LEFT, NO_PAD, RIGHT, UP};
use crate::engine::rng::Rng;
use crate::game::difficulty::{difficulty, Difficulty, ALARM_SPAWN_BONUS, ALARM_SPEED_BONUS};
use crate::game::levelstate::can_enter_store;
use crate::game::run::{LifeOutcome, Run, POINTS};
use crate::game::types::{make_banner, tick_popups, Banner, Bubble, Popup};

pub const GRAVITY: f64 = 0.25;
pub const JUMP_HEIGHT: f64 = 20.0;
pub const WALK_SPEED: f64 = 1.0;
/// Shaft "door window": feet y within this much above a served floor's surface may pass through the shaft wall.
const WINDOW_UP: f64 = 30.0;
const DEATH_FRAMES: i32 = 70;
const AUTO_CALL_FRAMES: i32 = 30;
const BOARD_REACH: f64 = 8.0;
const CALL_REACH: f64 = 14.0;
const INVULN_RESPAWN: i32 = 120;
const CROUCH_FRAMES: i32 = 22;
const SELFIE_FRAMES: i32 = 150;
#[allow(dead_code)]
const FLASH_FRAMES: i32 = 10;
const ZIP_SPEED: f64 = 1.6;
const PA_FIRST: i32 = 2400;
const PA_EVERY: i32 = 3600;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum IntroPhase {
    Zip,
    Drop,
    Crouch,
    Selfie,
}

impl IntroPhase {
    pub const fn as_str(self) -> &'static str {
        match self {
            IntroPhase::Zip => "zip",
            IntroPhase::Drop => "drop",
            IntroPhase::Crouch => "crouch",
            IntroPhase::Selfie => "selfie",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct IntroState {
    pub phase: IntroPhase,
    pub t: i32,
    /// The SPYGRAM post shown during the selfie.
    pub post: SpygramPost,
    /// Length of the zip-line path (px) for animation.
    pub zip_t: f64,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct MallOptions {
    /// Skip the zip-line arrival and start in control on the roof (tests, debugging).
    pub skip_intro: bool,
    /// Start position override (needs skip_intro).
    pub start_x: Option<f64>,
    pub start_floor: Option<i32>,
}

/// TS `Outcome = null | 'continue' | 'gameover'` (use `Option<Outcome>`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Continue,
    Gameover,
}

impl Outcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            Outcome::Continue => "continue",
            Outcome::Gameover => "gameover",
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct Landing {
    y: f64,
    floor: Option<i32>,
    roof: Option<ShaftId>,
}

#[inline]
fn dist(a: f64, b: f64) -> f64 {
    (a - b).abs()
}

#[derive(Clone, Copy, Debug)]
pub struct Cam {
    pub x: f64,
    pub y: f64,
}

pub struct MallWorld {
    pub rng: Rng,
    pub spy_rng: Rng,
    /// Typed state of the installed extras (NPCs, lights, furniture) for the renderer; set by `install_extras`.
    /// Temporarily `None` while one of its hooks runs inside `step`.
    pub extras: Option<Box<MallExtras>>,
    pub diff: Difficulty,

    pub frame: i32,
    /// The pad of the step in progress (modules such as the photo booth read it while the agent is hidden).
    pub pad: Pad,
    /// Frame at which the agent got control (spy clocks start here).
    pub control_frame: i32,
    pub player: PlayerState,
    pub cars: Vec<Car>,
    pub spies: Vec<Spy>,
    pub bullets: Vec<Bullet>,
    pub pickups: Vec<Pickup>,
    pub popups: Vec<Popup>,
    pub bubbles: Vec<Bubble>,
    pub banner: Option<Banner>,
    pub intro: Option<IntroState>,
    pub cam: Cam,
    pub shake: i32,
    /// Set when the agent opens a store door; the Game consumes it (fade into the room) and clears it.
    pub enter_store: Option<StoreId>,
    /// Set exactly once when the agent drives away with all packages; the Game consumes it.
    pub exit_triggered: bool,
    exit_fired: bool,
    pub outcome: Option<Outcome>,
    /// Frame counters for scheduled events.
    pub next_spy: i32,
    pub next_pa: i32,
    pub last_pa: i32,
    pub alarm_shown: bool,
    pub next_spy_id: i32,
    /// Frames the directory-style hum plays, etc.
    pub hum_t: i32,
    /// True when the agent is on a floor next to a car that is exactly level (for tests/HUD).
    pub last_floor_banner: i32,
}

impl MallWorld {
    pub fn new(run: &mut Run, rng: Rng, opts: MallOptions) -> MallWorld {
        let spy_rng = rng.fork("spies");
        let diff = difficulty(run.loop_, run.black_friday);
        let start_floor = opts.start_floor.unwrap_or(0);
        let start_x = opts.start_x.unwrap_or(ARRIVAL.let_go_x);
        let mut w = MallWorld {
            rng,
            spy_rng,
            extras: None,
            diff,
            frame: 0,
            pad: NO_PAD,
            control_frame: 0,
            player: new_player(start_x, fy(start_floor), start_floor),
            cars: make_cars(),
            spies: Vec::new(),
            bullets: Vec::new(),
            pickups: Vec::new(),
            popups: Vec::new(),
            bubbles: Vec::new(),
            banner: None,
            intro: None,
            cam: Cam { x: 0.0, y: 0.0 },
            shake: 0,
            enter_store: None,
            exit_triggered: false,
            exit_fired: false,
            outcome: None,
            next_spy: 300,
            next_pa: PA_FIRST,
            last_pa: -1,
            alarm_shown: false,
            next_spy_id: 1,
            hum_t: 0,
            last_floor_banner: -1,
        };
        if opts.skip_intro {
            w.control_frame = 0;
        } else {
            let post = *w.rng.fork("selfie").pick(SPYGRAM_ARRIVAL);
            w.intro = Some(IntroState { phase: IntroPhase::Zip, t: 0, post, zip_t: 0.0 });
            w.player.x = ARRIVAL.cable_start_x;
            w.player.y = ARRIVAL.cable_start_y + 24.0;
            w.player.mode = PlayerMode::Air;
            w.player.floor = None;
            run.sfx(SfxId::Zip);
        }
        w.snap_camera();
        w
    }

    /// Run a hook of the installed extras with the world borrowed mutably (extras is out of the world meanwhile).
    pub fn with_extras<R>(&mut self, f: impl FnOnce(&mut MallExtras, &mut MallWorld) -> R) -> Option<R> {
        let mut ex = self.extras.take()?;
        let r = f(&mut ex, self);
        self.extras = Some(ex);
        Some(r)
    }

    // ------------------------------------------------------------------ queries
    pub fn car(&self, id: ShaftId) -> &Car {
        self.cars.iter().find(|k| k.id == id).unwrap_or_else(|| panic!("no car {}", id.as_str()))
    }

    pub fn car_mut(&mut self, id: ShaftId) -> &mut Car {
        self.cars.iter_mut().find(|k| k.id == id).unwrap_or_else(|| panic!("no car {}", id.as_str()))
    }

    /// The spy with this id, if it is still in the world.
    pub fn spy_by_id(&self, id: i32) -> Option<&Spy> {
        self.spies.iter().find(|s| s.id == id)
    }

    pub fn spy_by_id_mut(&mut self, id: i32) -> Option<&mut Spy> {
        self.spies.iter_mut().find(|s| s.id == id)
    }

    /// The agent can be targeted by spies / hurt.
    pub fn player_alive(&self) -> bool {
        let m = self.player.mode;
        m != PlayerMode::Dying && m != PlayerMode::Dead
    }

    /// Spies ignore a player who is hidden, dying, arriving or posing for the selfie.
    pub fn player_visible(&self) -> bool {
        let m = self.player.mode;
        m != PlayerMode::Hidden && m != PlayerMode::Dying && m != PlayerMode::Dead && self.intro.is_none()
    }

    /// Floor index the agent is on, or the nearest floor when riding / falling (0 while arriving).
    pub fn player_floor(&self) -> i32 {
        let p = &self.player;
        if let Some(f) = p.floor {
            return f;
        }
        nearest_floor(p.y)
    }

    pub fn hitbox_top(&self) -> f64 {
        self.player.y - if self.player.ducking { PLAYER_DUCK_H } else { PLAYER_H }
    }

    /// What the HUD's LED panel should show: the floor index the agent is nearest.
    pub fn hud_floor(&self) -> i32 {
        self.player_floor()
    }

    pub fn music(&self, run: &Run) -> MusicId {
        if run.alarm_on {
            return MusicId::Alarm;
        }
        if self.player.mode == PlayerMode::Ride {
            return MusicId::Elevator;
        }
        MusicId::Mall
    }

    // ------------------------------------------------------------------ helpers for modules
    pub fn say(&mut self, x: f64, y: f64, text: &str, frames: i32) {
        self.bubbles.push(Bubble { text: text.to_string(), x, y, t: frames });
    }

    pub fn popup(&mut self, x: f64, y: f64, text: &str, color: Option<u8>) {
        self.popups.push(Popup { x, y, text: text.to_string(), t: 50, color });
    }

    pub fn show_banner(&mut self, text: &str, frames: i32, lines: Option<Vec<String>>, color: Option<u8>) {
        self.banner = Some(make_banner(text, frames, lines, color));
    }

    pub fn add_shake(&mut self, n: i32) {
        self.shake = self.shake.max(n);
    }

    /// Kill (or score) the spy at `index`. `by` decides the points; returns false if already dying.
    pub fn kill_spy(&mut self, run: &mut Run, index: usize, by: KilledBy) -> bool {
        if self.spies[index].mode == SpyMode::Dying {
            return false;
        }
        {
            let spy = &mut self.spies[index];
            spy.mode = SpyMode::Dying;
            spy.killed_by = Some(by);
            spy.death_t = 0;
        }
        let pts = if by == KilledBy::Crush || by == KilledBy::Lamp || by == KilledBy::Disco || by == KilledBy::Slide { POINTS.spy_crushed } else { POINTS.spy_shot };
        run.add_score(pts);
        let (sx, sy) = (self.spies[index].x, self.spies[index].y);
        self.popup(sx, sy - 26.0, &pts.to_string(), None);
        run.sfx(if by == KilledBy::Crush { SfxId::Crush } else { SfxId::Death });
        if by == KilledBy::Crush {
            self.add_shake(8);
        }
        true
    }

    /// The agent is hit. `armourable` hits (bullets, touching a spy) can be absorbed by armour; crushes, falls and
    /// falling lamps always kill. Returns true if the agent died.
    pub fn hurt_player(&mut self, run: &mut Run, cause: DeathCause, armourable: bool) -> bool {
        if !self.player_alive() {
            return false;
        }
        let hard = cause == DeathCause::Crush || cause == DeathCause::Roofcrush || cause == DeathCause::Fall;
        if !hard && (self.player.invuln > 0 || run.invincible()) {
            return false;
        }
        if hard && self.player.invuln > 0 && cause != DeathCause::Fall {
            return false;
        }
        if armourable && run.absorb_hit() {
            self.player.invuln = 60;
            let (px, py) = (self.player.x, self.player.y);
            self.popup(px, py - 28.0, "ARMOR!", Some(0x2c));
            run.sfx(SfxId::Hurt);
            return false;
        }
        let p = &mut self.player;
        p.mode = PlayerMode::Dying;
        p.death_t = 0;
        p.cause = Some(cause);
        p.vx = 0.0;
        p.vy = 0.0;
        p.kick = false;
        p.ducking = false;
        p.slide = 0;
        p.frozen = 0;
        run.sfx(SfxId::Death);
        if cause == DeathCause::Crush || cause == DeathCause::Roofcrush || cause == DeathCause::Lamp {
            self.add_shake(10);
        }
        true
    }

    /// Put the agent inside the photo booth (module API).
    pub fn hide_player(&mut self, frames: i32) {
        let p = &mut self.player;
        p.mode = PlayerMode::Hidden;
        p.hide_t = frames;
        p.vx = 0.0;
        p.ducking = false;
    }

    pub fn unhide_player(&mut self) {
        let p = &mut self.player;
        if p.mode == PlayerMode::Hidden {
            p.mode = PlayerMode::Ground;
            p.hide_t = 0;
        }
    }

    pub fn spawn_pickup(&mut self, p: Pickup) {
        self.pickups.push(p);
    }

    // ------------------------------------------------------------------ main step
    pub fn step(&mut self, run: &mut Run, pad: Pad) {
        self.pad = pad;
        self.frame += 1;

        // timers
        {
            let p = &mut self.player;
            if p.invuln > 0 {
                p.invuln -= 1;
            }
            if p.frozen > 0 {
                p.frozen -= 1;
            }
            if p.shoot_cd > 0 {
                p.shoot_cd -= 1;
            }
            if p.shoot_pose > 0 {
                p.shoot_pose -= 1;
            }
        }
        if self.shake > 0 {
            self.shake -= 1;
        }
        tick_popups(&mut self.popups);
        let mut i = self.bubbles.len();
        while i > 0 {
            i -= 1;
            self.bubbles[i].t -= 1;
            if self.bubbles[i].t <= 0 {
                self.bubbles.remove(i);
            }
        }
        if let Some(b) = self.banner.as_mut() {
            b.t -= 1;
            if b.t <= 0 {
                self.banner = None;
            }
        }

        self.check_alarm(run);

        if self.intro.is_some() {
            self.step_intro(run, pad);
            self.step_cars_and_crush(run, pad, true);
            self.update_camera();
            return;
        }

        run.tick_powers();
        self.step_player(run, pad);
        self.step_cars_and_crush(run, pad, false);
        self.step_bullets(run);
        bullet_hits_spy(self, run);
        step_spies(self, run);
        self.with_extras(|ex, w| ex.step(w, run));
        self.step_pickups(run);
        self.step_pa(run);
        self.record_safe_spot();
        self.update_camera();
        if self.player.mode == PlayerMode::Dying {
            self.step_death(run);
        }
    }

    // ------------------------------------------------------------------ arrival
    fn step_intro(&mut self, run: &mut Run, pad: Pad) {
        let mut intro = self.intro.unwrap();
        intro.t += 1;
        match intro.phase {
            IntroPhase::Zip => {
                // Slide down the cable from the skyscraper to just before the anchor post.
                let sx = ARRIVAL.cable_start_x;
                let sy = ARRIVAL.cable_start_y;
                let ex = ARRIVAL.let_go_x;
                let ey = sy + ((ARRIVAL.post_top_y - sy) * (ex - sx)) / (ARRIVAL.post_x - sx);
                let len = (ex - sx).hypot(ey - sy);
                intro.zip_t += ZIP_SPEED;
                let f = 1.0f64.min(intro.zip_t / len);
                let p = &mut self.player;
                p.x = sx + (ex - sx) * f;
                p.y = sy + (ey - sy) * f + 24.0;
                p.face = 1;
                if f >= 1.0 {
                    intro.phase = IntroPhase::Drop;
                    intro.t = 0;
                    p.vy = 0.0;
                    p.peak_y = p.y;
                }
            }
            IntroPhase::Drop => {
                let p = &mut self.player;
                p.vy += GRAVITY * 2.0;
                p.y += p.vy;
                if p.y >= fy(0) {
                    p.y = fy(0);
                    p.vy = 0.0;
                    p.floor = Some(0);
                    p.mode = PlayerMode::Ground;
                    intro.phase = IntroPhase::Crouch;
                    intro.t = 0;
                    run.sfx(SfxId::Thud);
                    self.add_shake(6);
                }
            }
            IntroPhase::Crouch => {
                if intro.t >= CROUCH_FRAMES {
                    intro.phase = IntroPhase::Selfie;
                    intro.t = 0;
                    run.sfx(SfxId::Camera);
                }
            }
            IntroPhase::Selfie => {
                if intro.t >= SELFIE_FRAMES || pad.pressed != 0 {
                    self.intro = None;
                    self.control_frame = self.frame;
                    run.sfx(SfxId::Select);
                    self.show_banner(UI.mission, 220, None, None);
                    self.player.safe = SafeSpot { x: self.player.x, floor: 0 };
                    return;
                }
            }
        }
        self.intro = Some(intro);
    }

    // ------------------------------------------------------------------ alarm / PA
    fn check_alarm(&mut self, run: &mut Run) {
        if !run.alarm_on && run.level_frames >= self.diff.alarm_frames {
            run.alarm_on = true;
            self.show_banner(UI.alarm_banner, 180, None, Some(0x16));
            run.sfx(SfxId::AlarmOn);
        }
    }

    pub fn spy_speed(&self, run: &Run) -> f64 {
        self.diff.spy_speed * if run.alarm_on { ALARM_SPEED_BONUS } else { 1.0 }
    }

    pub fn spawn_rate(&self, run: &Run) -> f64 {
        self.diff.spawn_rate * if run.alarm_on { ALARM_SPAWN_BONUS } else { 1.0 }
    }

    fn step_pa(&mut self, run: &mut Run) {
        if self.frame < self.next_pa {
            return;
        }
        let mut i = self.rng.int(PA_LINES.len() as i32);
        if i == self.last_pa {
            i = (i + 1) % PA_LINES.len() as i32;
        }
        self.last_pa = i;
        let lines = wrap_words(PA_LINES[i as usize], LIMITS.pa_line);
        self.show_banner(&lines[0], 240, Some(lines[1..].to_vec()), None);
        run.sfx(SfxId::PaChime);
        self.next_pa = self.frame + PA_EVERY + self.rng.between(-600, 600);
    }

    // ------------------------------------------------------------------ player
    /// Is `y` (feet) inside the "door window" of a floor served by this shaft?
    fn in_window(&self, s: &ShaftDef, y: f64) -> bool {
        for f in s.top..=s.bottom {
            let fyv = fy(f);
            if y >= fyv - WINDOW_UP && y <= fyv + 1.0 {
                return true;
            }
        }
        false
    }

    fn interior_of(s: &ShaftDef) -> (f64, f64) {
        (s.x + OPENING_EDGE, s.x + s.w - OPENING_EDGE)
    }

    /// Horizontal movement honouring walls and shaft walls: you may only cross a shaft wall at a floor's door window
    /// (feet at/above that floor's surface), and never into a doorway a moving car is blocking.
    pub fn try_move_x(&self, x: f64, y: f64, dx: f64, for_spy: bool, allow_grate: bool) -> f64 {
        if dx == 0.0 {
            return x;
        }
        let mut nx = x + dx;
        nx = (WALL_L + 4.0).max((WALL_R - 4.0).min(nx));
        for s in SHAFTS.iter() {
            // A shaft only has walls where it exists: from its ceiling down to its lowest floor's surface.
            if y <= shaft_ceiling_y(s) || y > fy(s.bottom) + 1.0 {
                continue;
            }
            let (lo, hi) = Self::interior_of(s);
            let was = x > lo && x < hi;
            let will = nx > lo && nx < hi;
            if was == will {
                if was && !self.in_window(s, y) {
                    return x; // inside the shaft: can't leave through walls
                }
                continue;
            }
            // crossing the boundary of the shaft interior
            if !self.in_window(s, y) {
                return x;
            }
            if will {
                // entering: find the floor whose window we are in
                for f in s.top..=s.bottom {
                    let fyv = fy(f);
                    if y >= fyv - WINDOW_UP && y <= fyv + 1.0 {
                        let st = opening_state(self.car(s.id), f);
                        if st == OpeningState::Blocked {
                            return x;
                        }
                        if for_spy && (st == OpeningState::Pit || (st == OpeningState::Above && !allow_grate)) {
                            return x;
                        }
                    }
                }
            }
        }
        nx
    }

    fn support_check_ground(&mut self) {
        let p = &self.player;
        if p.roof.is_some() {
            return;
        }
        let floor = match p.floor {
            Some(f) => f,
            None => return,
        };
        if let Some(s) = shaft_at_x(p.x, floor) {
            let st = opening_state(self.car(s.id), floor);
            if st == OpeningState::Pit {
                self.start_fall();
            }
        }
    }

    fn start_fall(&mut self) {
        let p = &mut self.player;
        p.mode = PlayerMode::Air;
        p.floor = None;
        p.roof = None;
        p.peak_y = p.peak_y.min(p.y);
        p.kick = false;
        p.vy = 0.0;
    }

    /// A surface the agent can land on while falling from y_from to y_to (feet), or None.
    fn landing_surface(&self, x: f64, y_from: f64, y_to: f64) -> Option<Landing> {
        let mut best: Option<Landing> = None;
        for f in 0..NUM_FLOORS {
            let fyv = fy(f);
            if fyv < y_from - 0.01 || fyv > y_to + 0.01 {
                continue;
            }
            if let Some(s) = shaft_at_x(x, f) {
                let st = opening_state(self.car(s.id), f);
                if st == OpeningState::Pit || st == OpeningState::Blocked {
                    continue;
                }
            }
            if best.map_or(true, |b| fyv < b.y) {
                best = Some(Landing { y: fyv, floor: Some(f), roof: None });
            }
        }
        for car in self.cars.iter() {
            if x <= car.def.x + 2.0 || x >= car.def.x + car.def.w - 2.0 {
                continue;
            }
            let roof_now = car_roof_y(car);
            let roof_prev = car.prev_y - crate::content::layout::CAR_H;
            if roof_prev >= y_from - 0.5 && roof_now <= y_to + 0.5 {
                let ry = roof_now.max(y_from - 3.0);
                if best.map_or(true, |b| ry < b.y) {
                    best = Some(Landing { y: ry, floor: None, roof: Some(car.id) });
                }
            }
        }
        best
    }

    fn step_player(&mut self, run: &mut Run, pad: Pad) {
        self.player.anim += 1;
        if self.player.mode != PlayerMode::Air {
            self.player.landed_kick = false;
        }

        match self.player.mode {
            PlayerMode::Dying | PlayerMode::Dead => return,
            PlayerMode::Hidden => {
                // The booth module owns the unhide logic; the core only counts down.
                self.player.hide_t -= 1;
                if self.player.hide_t <= 0 {
                    self.player.mode = PlayerMode::Ground;
                }
                return;
            }
            PlayerMode::Escalator => {
                self.step_escalator();
                self.try_shoot(run, pad);
                return;
            }
            PlayerMode::Ride => {
                self.step_ride(pad);
                self.try_shoot(run, pad);
                return;
            }
            _ => {}
        }

        if self.player.frozen > 0 {
            // frozen by the mall cop: gravity still applies
            if self.player.mode == PlayerMode::Air {
                self.step_air(run);
            }
            self.player.vx = 0.0;
            return;
        }

        if self.player.mode == PlayerMode::Ground {
            self.step_ground(run, pad);
        } else if self.player.mode == PlayerMode::Air {
            self.step_air(run);
            self.try_shoot(run, pad);
        }
    }

    fn step_ground(&mut self, run: &mut Run, pad: Pad) {
        let speed = WALK_SPEED * run.walk_factor();

        // --- interactions (Up / Down edges)
        if pad.pressed & (UP | DOWN) != 0 {
            let dir = if pad.pressed & UP != 0 { -1 } else { 1 };
            if self.try_interact(run, dir) {
                return;
            }
        }
        // Held Up/Down while standing in a level opening also boards (forgiving).
        if pad.held & (UP | DOWN) != 0 && !has_btn(pad.held, LEFT | RIGHT) && self.player.floor.is_some() {
            if self.try_board_held() {
                return;
            }
        }

        let mut dx = 0.0;
        if self.player.slide != 0 {
            dx = self.player.slide as f64 * speed;
            self.player.face = self.player.slide;
            self.player.ducking = false;
        } else {
            self.player.ducking = has_btn(pad.held, DOWN) && !has_btn(pad.held, LEFT | RIGHT) && !has_btn(pad.held, UP);
            if !self.player.ducking {
                let l = has_btn(pad.held, LEFT);
                let r = has_btn(pad.held, RIGHT);
                if l && !r {
                    dx = -speed;
                    self.player.face = -1;
                } else if r && !l {
                    dx = speed;
                    self.player.face = 1;
                }
            }
        }
        self.player.vx = dx;

        // --- jump
        if pad.pressed & B != 0 && !self.player.ducking {
            let h = JUMP_HEIGHT * run.jump_factor();
            let p = &mut self.player;
            p.vy = -(2.0 * GRAVITY * h).sqrt();
            p.mode = PlayerMode::Air;
            p.kick = dx != 0.0 || p.slide != 0;
            p.peak_y = p.y;
            p.floor = None;
            p.roof = None;
            run.sfx(SfxId::Jump);
            p.idle = 0;
            self.try_shoot(run, pad);
            return;
        }

        let before = self.player.x;
        self.player.x = self.try_move_x(self.player.x, self.player.y, dx, false, false);
        if self.player.slide != 0 && self.player.x == before {
            self.player.slide = 0; // hit a wall
        }

        if let Some(rid) = self.player.roof {
            let y = car_roof_y(self.car(rid));
            self.player.y = y;
        } else {
            self.support_check_ground();
        }

        // --- auto-call: standing still in / beside an opening
        if dx == 0.0 && !self.player.ducking && self.player.floor.is_some() {
            let floor = self.player.floor.unwrap();
            let near = shaft_near(self.player.x, floor, CALL_REACH);
            if let Some(near) = near {
                self.player.idle += 1;
                if self.player.idle == AUTO_CALL_FRAMES {
                    self.call_from_here(&near);
                }
            } else {
                self.player.idle = 0;
            }
        } else {
            self.player.idle = 0;
        }

        self.try_shoot(run, pad);
    }

    fn step_air(&mut self, run: &mut Run) {
        let prev_y = self.player.y;
        self.player.vy += GRAVITY;
        let mut ny = self.player.y + self.player.vy;
        // horizontal carry
        let mut dx = self.player.vx;
        if self.player.slide != 0 {
            dx = self.player.slide as f64 * WALK_SPEED * run.walk_factor();
        }
        let nx = self.try_move_x(self.player.x, prev_y, dx, false, false);
        self.player.x = nx;
        if self.player.vy > 0.0 {
            if let Some(hit) = self.landing_surface(self.player.x, prev_y, ny) {
                ny = hit.y;
                self.land(run, hit, ny);
                return;
            }
        }
        self.player.y = ny;
        self.player.peak_y = self.player.peak_y.min(self.player.y);
        // fell past the bottom of the world (should not happen)
        if self.player.y > LEVEL_H + 40.0 {
            self.hurt_player(run, DeathCause::Fall, false);
        }
    }

    fn land(&mut self, run: &mut Run, hit: Landing, y: f64) {
        let p = &mut self.player;
        p.y = y;
        let fall = y - p.peak_y;
        p.vy = 0.0;
        p.landed_kick = p.kick;
        p.mode = PlayerMode::Ground;
        p.floor = hit.floor;
        p.roof = hit.roof;
        if fall > MAX_SAFE_FALL {
            self.hurt_player(run, DeathCause::Fall, false);
            run.sfx(SfxId::Thud);
            self.add_shake(6);
            return;
        }
        if fall > 14.0 {
            run.sfx(SfxId::Land);
        }
        // a kick that lands on a wet patch keeps kicking while sliding (the janitor module decides); otherwise it ends
        let p = &mut self.player;
        if p.slide == 0 {
            p.kick = false;
        }
        p.peak_y = y;
    }

    // ------------------------------------------------------------------ shooting
    fn try_shoot(&mut self, run: &mut Run, pad: Pad) {
        let p = &self.player;
        if !has_btn(pad.held, A) || p.shoot_cd > 0 || p.frozen > 0 || p.mode == PlayerMode::Hidden {
            return;
        }
        let prof = run.fire_profile();
        let mut n = 0;
        for b in self.bullets.iter() {
            if b.owner == BulletOwner::Player {
                n += 1;
            }
        }
        let to_fire = if prof.spread { 3 } else { 1 };
        if n + to_fire > prof.max_bullets {
            return;
        }
        let y = p.y - if p.ducking { 8.0 } else { 16.0 };
        let x = p.x + p.face as f64 * 9.0;
        let spreads: &[f64] = if prof.spread { &[-0.6, 0.0, 0.6] } else { &[0.0] };
        let face = p.face as f64;
        for vy in spreads {
            self.bullets.push(Bullet { x, y, vx: face * PLAYER_BULLET_SPEED, vy: *vy, owner: BulletOwner::Player, age: 0 });
        }
        self.player.shoot_cd = prof.cooldown;
        self.player.shoot_pose = 8;
        run.sfx(SfxId::Shot);
    }

    fn step_bullets(&mut self, run: &mut Run) {
        let mut i = self.bullets.len();
        while i > 0 {
            i -= 1;
            let b0 = self.bullets[i];
            let consumed = self.with_extras(|ex, w| ex.on_bullet(w, run, &b0)).unwrap_or(false);
            if consumed {
                // the hit may have changed the bullet list (it never adds bullets); the bullet is still at index i
                self.bullets.remove(i);
                continue;
            }
            {
                let b = &mut self.bullets[i];
                b.x += b.vx;
                b.y += b.vy;
                b.age += 1;
            }
            let b = self.bullets[i];
            if b.x < 0.0 || b.x > LEVEL_W || b.age > 200 {
                self.bullets.remove(i);
                continue;
            }
            // a moving car that blocks a doorway stops bullets
            let mut blocked = false;
            let fl = nearest_floor(b.y + 12.0);
            for s in SHAFTS.iter() {
                if fl < s.top || fl > s.bottom {
                    continue;
                }
                if b.x > s.x && b.x < s.x + s.w && opening_state(self.car(s.id), fl) == OpeningState::Blocked {
                    blocked = true;
                }
            }
            if blocked {
                self.bullets.remove(i);
                continue;
            }
            if b.owner == BulletOwner::Spy && self.player_alive() && self.player_visible() {
                let top = self.hitbox_top();
                let p = &self.player;
                if b.x > p.x - PLAYER_HALF_W && b.x < p.x + PLAYER_HALF_W && b.y >= top && b.y <= p.y {
                    self.bullets.remove(i);
                    self.hurt_player(run, DeathCause::Shot, true);
                }
            }
        }
    }

    // ------------------------------------------------------------------ cars
    fn car_occupied(&self, ci: usize) -> bool {
        let car = &self.cars[ci];
        let p = &self.player;
        let level = floor_at_y(car.y);
        if level.is_none() {
            return false;
        }
        let inside = |x: f64, y: f64| x > car.def.x && x < car.def.x + car.def.w && (y - car.y).abs() < 1.0;
        if p.mode == PlayerMode::Ground && p.roof.is_none() && inside(p.x, p.y) {
            return true;
        }
        if p.mode == PlayerMode::Ride && p.car == Some(car.id) {
            return true;
        }
        for s in self.spies.iter() {
            if s.mode != SpyMode::Dying && inside(s.x, s.y) {
                return true;
            }
        }
        false
    }

    fn drive_input(&self, ci: usize, pad: Pad) -> Option<i32> {
        let car = &self.cars[ci];
        let p = &self.player;
        let riding = p.mode == PlayerMode::Ride && p.car == Some(car.id);
        let roofing = p.mode == PlayerMode::Ground && p.roof == Some(car.id) && car.def.manual;
        if !riding && !roofing {
            return None;
        }
        if p.frozen > 0 {
            return Some(0);
        }
        let up = has_btn(pad.held, UP);
        let dn = has_btn(pad.held, DOWN);
        Some(if up && !dn {
            -1
        } else if dn && !up {
            1
        } else {
            0
        })
    }

    fn step_cars_and_crush(&mut self, run: &mut Run, pad: Pad, intro_active: bool) {
        for ci in 0..self.cars.len() {
            let drive = if intro_active { None } else { self.drive_input(ci, pad) };
            let occupied = self.car_occupied(ci);
            let res = step_car(&mut self.cars[ci], drive, occupied, &mut self.rng);
            if res.stopped {
                if let Some(floor) = res.floor {
                    self.on_car_stopped(run, ci, floor);
                }
            }
            let car_id = self.cars[ci].id;
            let (car_y, car_dir) = (self.cars[ci].y, self.cars[ci].dir);
            // rider moves with the car
            if self.player.mode == PlayerMode::Ride && self.player.car == Some(car_id) {
                self.player.y = car_y;
                self.player.floor = None;
                if car_dir != 0 && self.frame % 24 == 0 {
                    run.sfx(SfxId::Hum);
                }
            }
            if self.player.mode == PlayerMode::Ground && self.player.roof == Some(car_id) {
                self.player.y = car_roof_y(&self.cars[ci]);
                // crushed against the ceiling at the top of the shaft
                let head = self.player.y - if self.player.ducking { PLAYER_DUCK_H } else { PLAYER_H };
                if head < shaft_ceiling_y(&self.cars[ci].def) {
                    self.hurt_player(run, DeathCause::Roofcrush, false);
                }
            }
        }
        if intro_active {
            return;
        }
        self.crush_check(run);
    }

    fn on_car_stopped(&mut self, run: &mut Run, ci: usize, floor: i32) {
        let car_id = self.cars[ci].id;
        let cx = self.cars[ci].def.x + self.cars[ci].def.w / 2.0;
        let riding_it = self.player.mode == PlayerMode::Ride && self.player.car == Some(car_id);
        let near_player = dist(cx, self.player.x) < 220.0 && ((floor - self.player_floor()) as f64).abs() <= 2.0;
        if near_player || riding_it {
            run.sfx(SfxId::Ding);
        }
        if riding_it && floor != self.last_floor_banner {
            let text = FLOOR_BANNERS.get(floor as usize).copied().unwrap_or(FLOOR_NAMES[floor as usize]);
            self.show_banner(text, 150, None, None);
        }
        self.last_floor_banner = if riding_it { floor } else { -1 };
        spawn_spy_at_car(self, run, ci, floor);
    }

    /// A car coming down onto anyone standing on its grate crushes them (unless called for the agent).
    fn crush_check(&mut self, run: &mut Run) {
        for ci in 0..self.cars.len() {
            let (def, car_y, car_id, protect) = (self.cars[ci].def, self.cars[ci].y, self.cars[ci].id, self.cars[ci].protect_floor);
            for f in def.top..=def.bottom {
                let fyv = fy(f);
                let d = car_y - fyv;
                if d >= 0.0 {
                    continue; // only a car above is a threat
                }
                // agent standing on the grate of floor f
                if self.player_alive() && self.player.mode == PlayerMode::Ground && self.player.floor == Some(f) && self.player.roof.is_none() {
                    if let Some(s) = shaft_at_x(self.player.x, f) {
                        if s.id == car_id {
                            let top = self.hitbox_top();
                            let protected_by_call = protect == Some(f);
                            if car_y > top && !protected_by_call {
                                self.hurt_player(run, DeathCause::Crush, false);
                            }
                        }
                    }
                }
                for si in 0..self.spies.len() {
                    let sp = &self.spies[si];
                    if sp.mode == SpyMode::Dying {
                        continue;
                    }
                    if sp.floor != f || (sp.y - fyv).abs() > 0.5 {
                        continue;
                    }
                    if sp.x > def.x + OPENING_EDGE && sp.x < def.x + def.w - OPENING_EDGE {
                        if car_y > sp.y - 24.0 + 2.0 {
                            self.kill_spy(run, si, KilledBy::Crush);
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ riding
    fn step_ride(&mut self, pad: Pad) {
        let cid = self.player.car.unwrap();
        let (car_y, car_dir, car_x, car_w) = {
            let car = self.car(cid);
            (car.y, car.dir, car.def.x, car.def.w)
        };
        let p = &mut self.player;
        p.floor = None;
        p.vx = 0.0;
        p.ducking = false;
        p.anim += 1;
        // get out: Left / Right while stopped level with a floor
        let lvl = floor_at_y(car_y);
        if car_dir == 0 && lvl.is_some() && (pad.held & (LEFT | RIGHT)) != 0 && (pad.held & (UP | DOWN)) == 0 {
            let lvl = lvl.unwrap();
            p.mode = PlayerMode::Ground;
            p.car = None;
            p.floor = Some(lvl);
            p.y = fy(lvl);
            p.face = if pad.held & LEFT != 0 { -1 } else { 1 };
            p.x = car_x + car_w / 2.0;
            p.idle = 0;
        }
    }

    fn board(&mut self, car_id: ShaftId, floor: i32) {
        let (cx, cy) = {
            let car = self.car(car_id);
            (car.def.x + car.def.w / 2.0, car.y)
        };
        let p = &mut self.player;
        p.mode = PlayerMode::Ride;
        p.car = Some(car_id);
        p.floor = None;
        p.roof = None;
        p.x = cx;
        p.y = cy;
        p.vx = 0.0;
        p.idle = 0;
        p.ducking = false;
        self.car_mut(car_id).protect_floor = None;
        self.last_floor_banner = floor;
    }

    /// Up/Down while standing at / beside a shaft opening: board a level car or call one. Returns true if handled.
    fn try_elevator(&mut self) -> bool {
        let f = match self.player.floor {
            Some(f) => f,
            None => return false,
        };
        let s = match shaft_near(self.player.x, f, CALL_REACH) {
            Some(s) => s,
            None => return false,
        };
        let st = opening_state(self.car(s.id), f);
        if st == OpeningState::Here && dist(self.player.x, s.x + s.w / 2.0) <= s.w / 2.0 + BOARD_REACH {
            self.board(s.id, f);
            return true;
        }
        self.call_from_here(&s);
        true
    }

    fn try_board_held(&mut self) -> bool {
        let f = match self.player.floor {
            Some(f) => f,
            None => return false,
        };
        let s = match shaft_near(self.player.x, f, 0.0) {
            Some(s) => s,
            None => return false,
        };
        if opening_state(self.car(s.id), f) == OpeningState::Here && self.player.idle >= 4 {
            self.board(s.id, f);
            return true;
        }
        false
    }

    fn call_from_here(&mut self, s: &ShaftDef) {
        let f = match self.player.floor {
            Some(f) => f,
            None => return,
        };
        if self.player.mode == PlayerMode::Ride {
            return;
        }
        if opening_state(self.car(s.id), f) == OpeningState::Here {
            return;
        }
        // do not yank a car away from someone else riding it
        if self.car(s.id).goal == Some(fy(f)) {
            return;
        }
        call_car(self.car_mut(s.id), f, true);
    }

    // ------------------------------------------------------------------ interactions
    fn try_interact(&mut self, run: &mut Run, dir: i32) -> bool {
        let f = match self.player.floor {
            Some(f) if self.player.roof.is_none() && self.player.frozen <= 0 => f,
            _ => return false,
        };

        // 1. store door
        for st in STORES.iter() {
            if st.floor != f {
                continue;
            }
            let cx = st.x + DOOR_X + DOOR_W / 2.0;
            if dist(self.player.x, cx) <= DOOR_W / 2.0 + 4.0 {
                if can_enter_store(&run.level, st.id) {
                    self.enter_store = Some(st.id);
                    run.sfx(SfxId::Door);
                    return true;
                }
                return false;
            }
        }
        // 2. elevator
        if self.try_elevator() {
            return true;
        }
        // 3. escalator landings
        for e in ESCALATORS.iter() {
            if dir < 0 && f == e.lower && dist(self.player.x, e.x_low) <= 10.0 {
                return self.board_escalator(run, *e, -1);
            }
            if dir > 0 && f == e.upper && dist(self.player.x, e.x_high) <= 10.0 {
                return self.board_escalator(run, *e, 1);
            }
        }
        // 4. getaway car
        if dir < 0 && f == NUM_FLOORS - 1 && self.player.x > WAGON.x - 6.0 && self.player.x < WAGON.x + WAGON.w + 6.0 {
            self.try_exit(run);
            return true;
        }
        // 5. modules (kiosk, photo booth ...)
        self.with_extras(|ex, w| ex.interact(w, run, dir)).unwrap_or(false)
    }

    fn try_exit(&mut self, run: &mut Run) {
        if run.all_packages() {
            if !self.exit_fired {
                self.exit_fired = true;
                self.exit_triggered = true;
                run.sfx(SfxId::Door);
            }
        } else {
            self.show_banner(&packages_left(6 - run.packages()), 100, None, None);
            run.sfx(SfxId::Buzzer);
        }
    }

    // ------------------------------------------------------------------ escalators
    fn board_escalator(&mut self, run: &mut Run, def: EscalatorDef, dir: i32) -> bool {
        // dir -1 = going UP (from the lower floor); dir 1 = going DOWN (from the upper floor)
        let p = &mut self.player;
        p.mode = PlayerMode::Escalator;
        p.escalator = Some(EscalatorRide { def, dir, t: 0 });
        p.floor = None;
        p.ducking = false;
        p.vx = 0.0;
        p.idle = 0;
        run.sfx(SfxId::Escalator);
        true
    }

    fn step_escalator(&mut self) {
        let p = &mut self.player;
        let mut e = p.escalator.unwrap();
        e.t += 1;
        let total = FLOOR_GAP;
        let t = (e.t as f64).min(total);
        let going_up = e.dir < 0;
        let x0 = if going_up { e.def.x_low } else { e.def.x_high };
        let x1 = if going_up { e.def.x_high } else { e.def.x_low };
        let y0 = fy(if going_up { e.def.lower } else { e.def.upper });
        let y1 = fy(if going_up { e.def.upper } else { e.def.lower });
        p.x = x0 + ((x1 - x0) * t) / total;
        p.y = y0 + ((y1 - y0) * t) / total;
        p.face = if x1 > x0 { 1 } else { -1 };
        if e.t as f64 >= total {
            p.mode = PlayerMode::Ground;
            p.escalator = None;
            p.floor = Some(if going_up { e.def.upper } else { e.def.lower });
            p.y = y1;
            p.x = x1;
            p.peak_y = p.y;
        } else {
            p.escalator = Some(e);
        }
    }

    // ------------------------------------------------------------------ pickups
    fn step_pickups(&mut self, run: &mut Run) {
        let mut i = self.pickups.len();
        while i > 0 {
            i -= 1;
            let mut k = self.pickups[i];
            if !k.on_ground {
                k.vy += GRAVITY;
                k.y += k.vy;
                k.x += k.vx;
                let f = nearest_floor(k.y);
                let fyv = fy(f);
                if k.vy > 0.0 && k.y >= fyv && k.y - k.vy <= fyv + 1.0 {
                    let pit = match shaft_at_x(k.x, f) {
                        Some(s) => opening_state(self.car(s.id), f) == OpeningState::Pit,
                        None => false,
                    };
                    if !pit {
                        k.y = fyv;
                        if k.kind != PickupKind::Power && k.vy.abs() > 1.2 {
                            k.vy = -k.vy * 0.5;
                            run.sfx(SfxId::Bounce);
                        } else {
                            k.vy = 0.0;
                            k.vx = 0.0;
                            k.on_ground = true;
                        }
                    }
                }
                if k.y > LEVEL_H {
                    self.pickups.remove(i);
                    continue;
                }
            }
            k.life -= 1;
            if k.life <= 0 {
                self.pickups.remove(i);
                continue;
            }
            self.pickups[i] = k;
            let p = &self.player;
            if self.player_alive() && p.mode != PlayerMode::Hidden && (k.x - p.x).abs() < 10.0 && k.y > p.y - 26.0 && k.y < p.y + 8.0 {
                self.pickups.remove(i);
                if k.kind == PickupKind::Power && k.power.is_some() {
                    let name = run.give_power(k.power.unwrap());
                    run.add_score(POINTS.powerup);
                    self.show_banner(name, 90, None, None);
                    run.sfx(SfxId::Powerup);
                } else if k.kind == PickupKind::Goldcoin {
                    run.add_life();
                    self.popup(k.x, k.y - 12.0, "1UP", Some(0x28));
                } else {
                    run.add_score(POINTS.coin);
                    self.popup(k.x, k.y - 12.0, "50", None);
                    run.sfx(SfxId::Coin);
                }
            }
        }
    }

    // ------------------------------------------------------------------ safe spot / death
    fn record_safe_spot(&mut self) {
        let p = &self.player;
        let floor = match p.floor {
            Some(f) if p.mode == PlayerMode::Ground && p.roof.is_none() && p.slide == 0 => f,
            _ => return,
        };
        if shaft_near(p.x, floor, 16.0).is_some() {
            return;
        }
        // not right under a spy's nose either: only record when no living spy is within 40 px on this floor
        for s in self.spies.iter() {
            if s.mode != SpyMode::Dying && s.floor == floor && dist(s.x, p.x) < 40.0 {
                return;
            }
        }
        self.player.safe = SafeSpot { x: p.x, floor };
    }

    fn step_death(&mut self, run: &mut Run) {
        self.player.death_t += 1;
        if self.player.death_t < DEATH_FRAMES {
            return;
        }
        self.player.mode = PlayerMode::Dead;
        match run.lose_life() {
            LifeOutcome::Respawn => self.respawn(),
            LifeOutcome::Continue => self.outcome = Some(Outcome::Continue),
            LifeOutcome::Gameover => self.outcome = Some(Outcome::Gameover),
        }
    }

    /// Respawn at the last safe spot: spies and bullets cleared, blinking invulnerability.
    pub fn respawn(&mut self) {
        let p = &mut self.player;
        p.mode = PlayerMode::Ground;
        p.x = p.safe.x;
        p.floor = Some(p.safe.floor);
        p.y = fy(p.safe.floor);
        p.vx = 0.0;
        p.vy = 0.0;
        p.roof = None;
        p.car = None;
        p.escalator = None;
        p.ducking = false;
        p.kick = false;
        p.frozen = 0;
        p.slide = 0;
        p.cause = None;
        p.death_t = 0;
        p.invuln = INVULN_RESPAWN;
        p.peak_y = p.y;
        self.spies.clear();
        self.bullets.clear();
        self.bubbles.clear();
        self.outcome = None;
        self.next_spy = self.frame + 180;
        self.with_extras(|ex, w| ex.on_respawn(w));
        self.snap_camera();
    }

    /// After CONTINUE: 3 fresh lives were granted by Run; put the agent back where he fell.
    pub fn resume(&mut self) {
        self.respawn();
    }

    // ------------------------------------------------------------------ camera
    fn target_cam(&self) -> Cam {
        let p = &self.player;
        let tx = 0.0f64.max((LEVEL_W - 256.0).min(p.x - 128.0));
        let ty = 0.0f64.max((LEVEL_H - 224.0).min(p.y - 150.0));
        Cam { x: tx, y: ty }
    }

    pub fn snap_camera(&mut self) {
        let t = self.target_cam();
        self.cam.x = t.x;
        self.cam.y = t.y;
    }

    fn update_camera(&mut self) {
        let t = self.target_cam();
        self.cam.x += (t.x - self.cam.x) * 0.25;
        self.cam.y += (t.y - self.cam.y) * 0.18;
        if (t.x - self.cam.x).abs() < 0.5 {
            self.cam.x = t.x;
        }
        if (t.y - self.cam.y).abs() < 0.5 {
            self.cam.y = t.y;
        }
    }

    // ------------------------------------------------------------------ store helpers for the Game
    /// Where the agent re-appears after leaving a store (at its door, facing out).
    pub fn return_from_store(&mut self, id: StoreId) {
        let def = STORES.iter().find(|s| s.id == id).unwrap();
        let p = &mut self.player;
        p.mode = PlayerMode::Ground;
        p.floor = Some(def.floor);
        p.y = fy(def.floor);
        p.x = def.x + DOOR_X + DOOR_W / 2.0;
        p.vx = 0.0;
        p.vy = 0.0;
        p.roof = None;
        p.car = None;
        p.ducking = false;
        p.kick = false;
        p.peak_y = p.y;
        p.safe = SafeSpot { x: p.x, floor: def.floor };
        p.invuln = p.invuln.max(60);
        self.enter_store = None;
        self.snap_camera();
    }

    pub fn store_at_door(&self) -> Option<&'static StoreDef> {
        let p = &self.player;
        let floor = p.floor?;
        for st in STORES.iter() {
            if st.floor != floor {
                continue;
            }
            if p.x >= st.x && p.x <= st.x + STORE_W {
                return Some(st);
            }
        }
        None
    }

    /// Alive spy count (HUD/tests).
    pub fn live_spies(&self) -> i32 {
        let mut n = 0;
        for s in self.spies.iter() {
            if s.mode != SpyMode::Dying {
                n += 1;
            }
        }
        n
    }
}

pub fn new_player(x: f64, y: f64, floor: i32) -> PlayerState {
    PlayerState {
        x,
        y,
        vx: 0.0,
        vy: 0.0,
        face: 1,
        mode: PlayerMode::Ground,
        ducking: false,
        kick: false,
        floor: Some(floor),
        roof: None,
        car: None,
        peak_y: y,
        escalator: None,
        invuln: 0,
        frozen: 0,
        shoot_cd: 0,
        idle: 0,
        hide_t: 0,
        death_t: 0,
        cause: None,
        safe: SafeSpot { x, floor },
        anim: 0,
        slide: 0,
        landed_kick: false,
        shoot_pose: 0,
    }
}
