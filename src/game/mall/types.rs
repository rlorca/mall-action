//! Mall entity types. Port of `game/mall/types.ts`.
//!
//! Discrete -1 / 0 / +1 values of the TS (facing, direction of travel, slide) are `i32`; string-union modes are enums
//! with `as_str()`.

use crate::content::layout::{EscalatorDef, ShaftDef, ShaftId};
use crate::content::powerups::PowerId;
use crate::content::stores::StoreId;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DeathCause {
    Shot,
    Touch,
    Crush,
    Roofcrush,
    Lamp,
    Disco,
    Fall,
}

impl DeathCause {
    pub const fn as_str(self) -> &'static str {
        match self {
            DeathCause::Shot => "shot",
            DeathCause::Touch => "touch",
            DeathCause::Crush => "crush",
            DeathCause::Roofcrush => "roofcrush",
            DeathCause::Lamp => "lamp",
            DeathCause::Disco => "disco",
            DeathCause::Fall => "fall",
        }
    }
}

/// Size constants of the mall sprites / hitboxes (px).
pub const PLAYER_HALF_W: f64 = 5.0;
pub const PLAYER_H: f64 = 24.0;
pub const PLAYER_DUCK_H: f64 = 14.0;
pub const SPY_HALF_W: f64 = 5.0;
pub const SPY_H: f64 = 24.0;
/// Bullet speeds (px/frame): the agent's are twice as fast as the spies'.
pub const PLAYER_BULLET_SPEED: f64 = 4.0;
pub const SPY_BULLET_SPEED: f64 = 2.0;

#[derive(Clone, Debug)]
pub struct Car {
    pub id: ShaftId,
    pub def: ShaftDef,
    /// y of the car's floor (the surface the agent stands on). Roof = y - CAR_H.
    pub y: f64,
    /// y at the start of this frame (swept landing tests).
    pub prev_y: f64,
    /// Motion this frame: -1 up, 0 stopped, +1 down.
    pub dir: i32,
    /// Target floor y when gliding / called / auto-driven; None while being driven by a rider.
    pub goal: Option<f64>,
    /// Last direction of travel (used for gliding to the next floor): -1 or 1.
    pub last_dir: i32,
    /// Frames the (automatic) car waits before choosing a new floor.
    pub wait: i32,
    /// The player called this car to this floor index: it must pick him up, not crush him.
    pub protect_floor: Option<i32>,
    /// Doors open (stopped at a floor).
    pub open: bool,
    /// Frames since it stopped (door animation).
    pub since_stop: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum OpeningState {
    Here,
    Above,
    Blocked,
    Pit,
}

impl OpeningState {
    pub const fn as_str(self) -> &'static str {
        match self {
            OpeningState::Here => "here",
            OpeningState::Above => "above",
            OpeningState::Blocked => "blocked",
            OpeningState::Pit => "pit",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SpyMode {
    Walk,
    Aim,
    Duck,
    Dying,
    Emerge,
    Wait,
}

impl SpyMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            SpyMode::Walk => "walk",
            SpyMode::Aim => "aim",
            SpyMode::Duck => "duck",
            SpyMode::Dying => "dying",
            SpyMode::Emerge => "emerge",
            SpyMode::Wait => "wait",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum KilledBy {
    Shot,
    Crush,
    Lamp,
    Disco,
    Slide,
    Kick,
    Cinna,
}

impl KilledBy {
    pub const fn as_str(self) -> &'static str {
        match self {
            KilledBy::Shot => "shot",
            KilledBy::Crush => "crush",
            KilledBy::Lamp => "lamp",
            KilledBy::Disco => "disco",
            KilledBy::Slide => "slide",
            KilledBy::Kick => "kick",
            KilledBy::Cinna => "cinna",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Spy {
    pub id: i32,
    pub x: f64,
    pub y: f64,
    /// 1 or -1.
    pub face: i32,
    pub floor: i32,
    pub mode: SpyMode,
    /// Frames in current mode.
    pub t: i32,
    /// Frames until this spy may start aiming its next shot.
    pub fire_cd: i32,
    /// Aim high (head) or low (knees) for the current volley.
    pub aim_high: bool,
    /// Walk animation counter.
    pub anim: i32,
    /// Wander state: -1, 0 or 1.
    pub wander_dir: i32,
    pub wander_t: i32,
    /// Ducking incoming volley: frames left, and the cool-down so one volley rolls once.
    pub duck_t: i32,
    pub volley_t: i32,
    /// Store door x he came out of (emerge animation).
    pub emerge_from: Option<StoreId>,
    /// Dying animation frame counter.
    pub death_t: i32,
    /// Cause of death (for score).
    pub killed_by: Option<KilledBy>,
    /// Waiting at a shaft opening.
    pub wait_shaft: Option<ShaftId>,
    /// Tick of life.
    pub age: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BulletOwner {
    Player,
    Spy,
}

impl BulletOwner {
    pub const fn as_str(self) -> &'static str {
        match self {
            BulletOwner::Player => "player",
            BulletOwner::Spy => "spy",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Bullet {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub owner: BulletOwner,
    /// Frames alive.
    pub age: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PickupKind {
    Power,
    Coin,
    Goldcoin,
}

impl PickupKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            PickupKind::Power => "power",
            PickupKind::Coin => "coin",
            PickupKind::Goldcoin => "goldcoin",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Pickup {
    pub x: f64,
    pub y: f64,
    pub kind: PickupKind,
    pub power: Option<PowerId>,
    pub vy: f64,
    pub vx: f64,
    pub on_ground: bool,
    /// Frames left before it disappears.
    pub life: i32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PlayerMode {
    Ground,
    Air,
    Ride,
    Escalator,
    Hidden,
    Dying,
    Dead,
}

impl PlayerMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            PlayerMode::Ground => "ground",
            PlayerMode::Air => "air",
            PlayerMode::Ride => "ride",
            PlayerMode::Escalator => "escalator",
            PlayerMode::Hidden => "hidden",
            PlayerMode::Dying => "dying",
            PlayerMode::Dead => "dead",
        }
    }
}

/// The agent riding an escalator: `dir` -1 = going UP (from the lower floor), 1 = going DOWN (from the upper floor).
#[derive(Clone, Copy, Debug)]
pub struct EscalatorRide {
    pub def: EscalatorDef,
    pub dir: i32,
    pub t: i32,
}

/// The last safe spot (respawn point).
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct SafeSpot {
    pub x: f64,
    pub floor: i32,
}

#[derive(Clone, Debug)]
pub struct PlayerState {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    /// 1 or -1.
    pub face: i32,
    pub mode: PlayerMode,
    pub ducking: bool,
    /// Jump-kick active (jumped while moving).
    pub kick: bool,
    /// Floor index while standing on a floor surface (None in the air, on a roof or in a car).
    pub floor: Option<i32>,
    /// Standing on the roof of this car.
    pub roof: Option<ShaftId>,
    /// Riding inside this car.
    pub car: Option<ShaftId>,
    /// Highest point (lowest y) of the current airtime, to measure falls.
    pub peak_y: f64,
    pub escalator: Option<EscalatorRide>,
    /// Blinking invulnerability frames.
    pub invuln: i32,
    /// Frozen by the mall cop.
    pub frozen: i32,
    pub shoot_cd: i32,
    /// Frames standing still beside / in a shaft opening (auto-call).
    pub idle: i32,
    /// Photo booth hiding.
    pub hide_t: i32,
    pub death_t: i32,
    pub cause: Option<DeathCause>,
    pub safe: SafeSpot,
    pub anim: i32,
    /// Sliding on a wet patch: direction (cannot stop/turn): -1, 0 or 1.
    pub slide: i32,
    /// True for the frame in which a jump-kick landed (a wet patch keeps the kick going while sliding).
    pub landed_kick: bool,
    /// Recoil / shoot pose frames.
    pub shoot_pose: i32,
}
