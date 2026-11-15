//! `Core`: all the mall state the hook modules (spies, lights, NPCs, pickups) read and the `Ctx` they receive.
//!
//! `Mall` owns a `Core` plus the four hook modules. Each frame `Mall::step` builds a `Ctx` (core + run + out +
//! pad) and hands it to the hooks; `Ctx` is the ONLY door to the rules that change the player (`kill_player`),
//! while `Core` has the read-only queries (player view, elevator cars, openings, walls).

use crate::events::{Event, Out, Sfx, Track};
use crate::input::PadState;
use crate::layout::{self, floor_y, ShaftId, SHAFTS, SHAFT_W, WALL_L, WALL_R};
use crate::pixel::Rect;
use crate::run::RunState;
use crate::types::Floor;
use crate::ui::Banner;

use super::arrival::Arrival;
use super::bullets::{Bullets, Owner};
use super::camera::Camera;
use super::elevator::{Car, CarEvent};
use super::escalator::EscState;
use super::player::{Mode, Player};
use super::world::{self, Opening, CAR_H};
use super::MallOutcome;

/// Why the player is being killed (the single entry point `Ctx::kill_player` takes one of these).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeathCause {
    /// An enemy bullet (armour absorbs it).
    Bullet,
    /// Touched a spy while not jump-kicking (armour absorbs it).
    Spy,
    /// A falling lamp (armour absorbs it).
    Lamp,
    /// A rolling disco ball (armour absorbs it).
    DiscoBall,
    /// Crushed by an elevator car (armour does not help).
    Crushed,
    /// Fell more than one floor (armour does not help).
    Fall,
    /// Debug: ignores every protection.
    Debug,
}

/// Read-only snapshot of the player for the hook modules.
#[derive(Clone, Copy, Debug)]
pub struct PlayerView {
    pub floor: Floor,
    /// World x of the body centre.
    pub x: i32,
    /// World y of the feet.
    pub y: i32,
    /// +1 right, -1 left.
    pub facing: i32,
    pub ducking: bool,
    /// In the air after a jump.
    pub jumping: bool,
    /// Jump-kick: in the air with forward momentum. Touching a spy now kills the SPY.
    pub kicking: bool,
    /// Hidden (photo booth, ...): spies cannot see or hit him. Phase 2 sets it via `Core::player.hidden`.
    pub hidden: bool,
    pub dying: bool,
    /// Blinking invulnerability (after respawn / armour hit).
    pub invulnerable: bool,
    /// Zip line + selfie: spies ignore the player, no control.
    pub in_arrival: bool,
    pub grounded: bool,
    /// Skidding along a wet patch (cannot stop or turn until off it).
    pub sliding: bool,
    /// Detained by the mall cop (no control, cannot be hurt by spies or bullets).
    pub frozen: bool,
    /// Inside a car of this shaft.
    pub riding: Option<ShaftId>,
    pub on_escalator: bool,
    /// Standing on a car roof.
    pub on_roof: bool,
    pub hitbox: Rect,
}

impl PlayerView {
    /// Can bullets / spies hurt him right now?
    pub fn hittable(&self) -> bool {
        !self.dying && !self.hidden && !self.in_arrival
    }
}

/// Read-only snapshot of one elevator car.
#[derive(Clone, Copy, Debug)]
pub struct CarView {
    pub shaft: ShaftId,
    /// Platform world y (feet level inside the car).
    pub y: i32,
    /// -1 up, 0 stopped, +1 down.
    pub dir: i8,
    /// The floor the car is exactly level with, if any.
    pub level: Option<Floor>,
    /// Doors open enough to walk in/out.
    pub doors_open: bool,
    pub occupied: bool,
    pub rect: Rect,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EffectKind {
    Spark,
    Puff,
}

#[derive(Clone, Copy, Debug)]
pub struct Effect {
    pub kind: EffectKind,
    pub x: i32,
    pub y: i32,
    pub t: u32,
}

pub const SPARK_FRAMES: u32 = 12;
pub const PUFF_FRAMES: u32 = 16;
/// Frames of the death animation before the respawn / out-of-lives hand-off (about 1.2 s).
pub const DEATH_FRAMES: u32 = 72;
pub const RESPAWN_INVULN: u32 = 120;
pub const HIT_INVULN: u32 = 45;
/// Standing still in a call zone for this many frames calls the car (half a second).
pub const AUTO_CALL_FRAMES: u32 = 30;
/// Banner height on screen.
pub const BANNER_Y: i32 = 24;

pub struct Core {
    pub player: Player,
    pub cars: [Car; 3],
    pub escs: [EscState; 2],
    pub bullets: Bullets,
    pub cam: Camera,
    pub banner: Banner,
    pub effects: Vec<Effect>,
    pub arrival: Option<Arrival>,
    /// Frames this `Mall` has been stepped.
    pub frame: u32,
    /// Last standing spot on solid floor: (x, feet y).
    pub last_safe: (i32, i32),
    /// Screen shake frames left (the draw offsets the scene; the lights agent can add more).
    pub shake: u32,
    pub(super) level_clear_sent: bool,
    pub(super) out_of_lives_sent: bool,
    pub(super) debug_kill_pending: bool,
    pub(super) last_track: Option<Track>,
    pub(super) hum: bool,
    pub(super) respawned: bool,
    pub(super) call_wait: u32,
    /// Index into `copy::ARRIVAL_POSTS` chosen for this level's selfie.
    pub post: usize,
    /// Set by `Mall::new`: the station wagon's brake lights (after the exit).
    pub wagon_lights: bool,
    /// Wet patches this frame (the janitor sets them; the player and the spies slide on them).
    pub wet: Vec<Wet>,
    /// Lethal rectangles this frame (falling lamps, rolling disco balls): the spies hook kills spies inside them.
    pub lethal: Vec<Lethal>,
    /// Things spawned this frame for the pickups hook (spy drops, fountain coins).
    pub drops: Vec<Drop>,
}

/// A wet patch on a floor (world x range, the feet line of `floor`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Wet {
    pub floor: Floor,
    pub x0: i32,
    pub x1: i32,
}

/// Something that kills whoever overlaps it this frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Lethal {
    pub floor: Floor,
    pub rect: Rect,
    pub cause: DeathCause,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum DropKind {
    Power(crate::types::PowerUp),
    /// A bouncing coin (initial velocity in 1/16 px per frame).
    Coin { vx16: i32, vy16: i32, gold: bool },
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Drop {
    pub floor: Floor,
    /// World x centre and feet / start y.
    pub x: i32,
    pub y: i32,
    pub kind: DropKind,
}

impl Core {
    pub fn new(run: &mut RunState) -> Core {
        let post = run.rng.below(crate::copy::ARRIVAL_POSTS.len() as u32) as usize;
        let mut core = Core {
            player: Player::new(),
            cars: [Car::new(ShaftId::A, Floor::Roof), Car::new(ShaftId::B, Floor::F4), Car::new(ShaftId::C, Floor::F2)],
            escs: [EscState::default(); 2],
            bullets: Bullets::new(),
            cam: Camera::new(),
            banner: Banner::default(),
            effects: Vec::new(),
            arrival: Some(Arrival::new()),
            frame: 0,
            last_safe: (layout::ANCHOR_X - 4, floor_y(Floor::Roof)),
            shake: 0,
            level_clear_sent: false,
            out_of_lives_sent: false,
            debug_kill_pending: false,
            last_track: None,
            hum: false,
            respawned: false,
            call_wait: 0,
            post,
            wagon_lights: false,
            wet: Vec::new(),
            lethal: Vec::new(),
            drops: Vec::new(),
        };
        core.player.begin_arrival();
        let (x, y) = (core.player.x, core.player.y());
        core.cam.snap_to(x, y, 1);
        core
    }

    // ---------------------------------------------------------------- read-only queries for the hooks

    pub fn player_view(&self) -> PlayerView {
        let p = &self.player;
        let y = p.y();
        PlayerView {
            floor: world::nearest_floor(y),
            x: p.x,
            y,
            facing: p.facing,
            ducking: p.ducking && p.grounded,
            jumping: !p.grounded && p.jumped,
            kicking: (!p.grounded && p.jumped && p.kick) || (p.grounded && p.slide_dir != 0 && p.slide_kick),
            hidden: p.hidden,
            dying: matches!(p.mode, Mode::Dying { .. }),
            invulnerable: p.invuln > 0,
            in_arrival: self.arrival.is_some(),
            grounded: p.grounded,
            sliding: p.grounded && p.slide_dir != 0,
            frozen: p.frozen > 0,
            riding: match p.mode {
                Mode::Riding { car } => Some(SHAFTS[car].id),
                _ => None,
            },
            on_escalator: matches!(p.mode, Mode::Escalator { .. }),
            on_roof: p.on_roof.is_some(),
            hitbox: world::player_box(p.x, y, p.ducking && p.grounded),
        }
    }

    pub fn car_view(&self, shaft: ShaftId) -> CarView {
        let i = SHAFTS.iter().position(|s| s.id == shaft).unwrap();
        let c = &self.cars[i];
        CarView {
            shaft,
            y: c.y,
            dir: c.dir,
            level: c.level_floor(),
            doors_open: c.door >= super::elevator::DOOR_USABLE,
            occupied: c.occupied(),
            rect: Rect::new(SHAFTS[i].x, c.y - CAR_H, SHAFT_W, CAR_H),
        }
    }

    /// The shaft opening state on `floor` (None when the shaft does not serve that floor).
    pub fn opening(&self, shaft: ShaftId, floor: Floor) -> Option<Opening> {
        let i = SHAFTS.iter().position(|s| s.id == shaft)?;
        world::opening_state(shaft, floor, self.cars[i].y)
    }

    /// Is world x on a wet patch of `floor`?
    pub fn wet_at(&self, floor: Floor, x: i32) -> bool {
        self.wet.iter().any(|w| w.floor == floor && x >= w.x0 && x < w.x1)
    }

    /// Walkable span of every floor (x0, x1).
    pub fn wall_bounds(&self) -> (i32, i32) {
        (WALL_L, WALL_R)
    }

    /// Register how many spies are inside a car (car C will not leave while anyone is inside).
    pub fn set_car_occupants(&mut self, shaft: ShaftId, n: u32) {
        let i = SHAFTS.iter().position(|s| s.id == shaft).unwrap();
        self.cars[i].extra_occupants = n;
    }

    pub fn is_riding_car(&self, i: usize) -> bool {
        matches!(self.player.mode, Mode::Riding { car } if car == i)
    }

    /// Ask for a screen shake (frames).
    pub fn request_shake(&mut self, frames: u32) {
        self.shake = self.shake.max(frames);
    }

    pub fn add_effect(&mut self, kind: EffectKind, x: i32, y: i32) {
        self.effects.push(Effect { kind, x, y, t: 0 });
    }

    /// Where the camera is looking (hooks use it to cull).
    pub fn view_span(&self) -> (i32, i32) {
        (self.cam.x, self.cam.x + super::camera::VIEW_W)
    }

    /// Is the world position near enough to the player that a sound there should be heard?
    pub fn near_player(&self, x: i32, y: i32) -> bool {
        (y - self.player.y()).abs() <= 120 && (x - self.player.x).abs() <= 150
    }

    pub(super) fn desired_track(&self, run: &RunState) -> Track {
        if matches!(self.player.mode, Mode::Riding { .. }) {
            Track::Elevator
        } else if run.alarm {
            Track::Alarm
        } else {
            Track::MallAmbient
        }
    }
}

/// What every hook module's `step` receives.
pub struct Ctx<'a> {
    pub core: &'a mut Core,
    pub run: &'a mut RunState,
    pub out: &'a mut Out,
    pub pad: PadState,
}

impl<'a> Ctx<'a> {
    /// THE kill entry point. Handles Cinnabomb, invulnerability, armour, lives and the death flow.
    /// Returns true when the player actually died (false when protected / absorbed).
    pub fn kill_player(&mut self, cause: DeathCause) -> bool {
        if matches!(self.core.player.mode, Mode::Dying { .. }) || self.core.arrival.is_some() {
            return false;
        }
        if cause != DeathCause::Debug {
            if self.run.power.is_invincible() {
                return false;
            }
            if !matches!(cause, DeathCause::Crushed | DeathCause::Fall) {
                if self.core.player.invuln > 0 || self.core.player.hidden || self.core.player.frozen > 0 {
                    return false;
                }
                if self.run.power.absorb_hit() {
                    let (x, y) = (self.core.player.x, self.core.player.y());
                    self.core.add_effect(EffectKind::Spark, x, y - 14);
                    self.out.sfx(Sfx::Hurt);
                    self.core.player.invuln = HIT_INVULN;
                    return false;
                }
            }
        }
        match cause {
            DeathCause::Crushed => {
                self.out.sfx(Sfx::Crush);
                self.core.request_shake(24);
            }
            DeathCause::Fall => self.out.sfx(Sfx::Fall),
            _ => {}
        }
        self.out.sfx(Sfx::Death);
        self.run.lose_life();
        self.core.player.start_dying();
        self.set_hum(false);
        true
    }

    pub(super) fn set_hum(&mut self, on: bool) {
        if self.core.hum != on {
            self.core.hum = on;
            self.out.events.push(Event::Hum(on));
        }
    }

    /// Step every elevator car; returns after handling dings, banners and call pickups.
    pub(super) fn step_cars(&mut self, drive: i32) {
        for i in 0..3 {
            let rider = self.core.is_riding_car(i);
            self.core.cars[i].rider = rider;
            let answered = if self.core.cars[i].call { self.core.cars[i].target } else { None };
            let ev = {
                let rng = &mut self.run.rng;
                self.core.cars[i].step(drive, rng)
            };
            if ev == CarEvent::Stopped {
                let (cx, cy) = (SHAFTS[i].center_x(), self.core.cars[i].y);
                if rider || self.core.near_player(cx, cy) {
                    self.out.sfx(Sfx::Ding);
                }
                if rider {
                    if let Some(f) = self.core.cars[i].level_floor() {
                        self.core.banner.show(crate::copy::floor_announcement(f), 150);
                    }
                }
                // a called car that arrives where the caller waits picks him up
                if let (Some(a), Some(l)) = (answered, self.core.cars[i].level_floor()) {
                    if a == l && self.core.player.can_be_picked_up(l, SHAFTS[i].x) {
                        self.core.player.board(i, SHAFTS[i].center_x(), self.core.cars[i].y, false);
                    }
                }
            }
        }
    }

    /// Crush rules (spec 5.4): a moving car overlapping the player who is neither inside nor on its roof.
    pub(super) fn check_crush(&mut self) {
        let p = &self.core.player;
        if !matches!(p.mode, Mode::Normal) || self.core.arrival.is_some() {
            return;
        }
        let (px, py) = (p.x, p.y());
        let pbox = world::player_box(px, py, p.ducking && p.grounded);
        let pfloor = world::floor_at_y(py);
        let mut crushed_by: Option<usize> = None;
        for i in 0..3 {
            let c = &self.core.cars[i];
            let sx = SHAFTS[i].x;
            // top of the shaft: someone on the roof is squashed against the ceiling
            if p.on_roof == Some(i) {
                let top_ceiling = world::ceiling_y(layout::shaft(c.shaft).top);
                if py - world::PLAYER_H < top_ceiling {
                    crushed_by = Some(i);
                    break;
                }
                continue;
            }
            if c.last_move == 0 || px < sx || px >= sx + SHAFT_W {
                continue;
            }
            let car_rect = Rect::new(sx, c.y - CAR_H, SHAFT_W, CAR_H);
            if !pbox.intersects(&car_rect) || py <= c.roof_y() + 3 {
                continue;
            }
            // a car that was called to this very floor swallows its caller instead of crushing him
            if let Some(f) = pfloor {
                if p.grounded && c.answering_call_to(f) {
                    continue;
                }
            }
            crushed_by = Some(i);
            break;
        }
        if let Some(i) = crushed_by {
            if !self.kill_player(DeathCause::Crushed) {
                // protected: never leave him inside a car body, take him aboard
                let (cx, cy) = (SHAFTS[i].center_x(), self.core.cars[i].y);
                self.core.player.board(i, cx, cy, false);
            }
        }
    }

    /// Enemy bullets against the player.
    pub(super) fn step_bullets(&mut self) {
        let (l, r) = self.core.view_span();
        self.core.bullets.step(l, r);
        let pv = self.core.player_view();
        if pv.hittable() && !matches!(self.core.player.mode, Mode::Dying { .. }) {
            if self.core.bullets.take_hit(pv.hitbox, Owner::Enemy).is_some() {
                self.kill_player(DeathCause::Bullet);
            }
        }
    }

    /// Emit music changes and the hum, only on change.
    pub(super) fn update_audio_state(&mut self) {
        let want = self.core.desired_track(self.run);
        if self.core.last_track != Some(want) {
            self.core.last_track = Some(want);
            self.out.music(want);
        }
        let riding = matches!(self.core.player.mode, Mode::Riding { .. });
        self.set_hum(riding);
    }

    /// Remember the last safe spot: standing on a solid floor line, clear of shafts and escalators.
    pub(super) fn track_safe_spot(&mut self) {
        let p = &self.core.player;
        if !matches!(p.mode, Mode::Normal) || !p.grounded || self.core.arrival.is_some() {
            return;
        }
        let y = p.y();
        if world::floor_at_y(y).is_some() && p.on_roof.is_none() && !world::near_shaft(p.x, 14) && !world::near_escalator(p.x, 8) {
            self.core.last_safe = (p.x, y);
        }
    }

    pub(super) fn step_effects(&mut self) {
        for e in self.core.effects.iter_mut() {
            e.t += 1;
        }
        self.core.effects.retain(|e| e.t < if e.kind == EffectKind::Spark { SPARK_FRAMES } else { PUFF_FRAMES });
        self.core.banner.step();
        self.core.shake = self.core.shake.saturating_sub(1);
    }

    /// Death animation progress. Returns `OutOfLives` once when the last life is gone.
    pub(super) fn step_death_flow(&mut self) -> MallOutcome {
        if let Mode::Dying { t } = self.core.player.mode {
            if t >= DEATH_FRAMES {
                if self.run.lives > 0 {
                    self.core.respawn(RESPAWN_INVULN);
                } else if !self.core.out_of_lives_sent {
                    self.core.out_of_lives_sent = true;
                    return MallOutcome::OutOfLives;
                }
            }
        }
        MallOutcome::None
    }
}

impl Core {
    /// Put the player back at the last safe spot, invulnerable, with a clean slate (bullets cleared; the Mall
    /// also tells the hooks to clear their spies and freezes).
    pub fn respawn(&mut self, invuln: u32) {
        let (x, y) = self.last_safe;
        self.player.place(x, y);
        self.player.invuln = invuln;
        self.bullets.clear();
        self.effects.clear();
        self.banner.frames_left = 0;
        for c in self.cars.iter_mut() {
            c.rider = false;
        }
        self.respawned = true;
        self.out_of_lives_sent = false;
        let (px, py) = (self.player.x, self.player.y());
        let face = self.player.facing;
        self.cam.snap_to(px, py, face);
    }

    /// True once after a respawn so the Mall can clear the hook modules.
    pub(super) fn take_respawn_flag(&mut self) -> bool {
        std::mem::replace(&mut self.respawned, false)
    }
}
