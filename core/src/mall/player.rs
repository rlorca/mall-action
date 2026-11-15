//! The agent: walking, jumping (fixed-point parabola), ducking, shooting, boarding cars and escalators,
//! falling, and the Up/Down actions (store doors, calling cars, the getaway car).

use crate::copy;
use crate::events::Sfx;
use crate::input::{PadState, A, B, DOWN, UP};
use crate::layout::{self, floor_y, ESCALATORS, FLOOR_GAP, SHAFTS, SHAFT_W, WALL_L, WALL_R};
use crate::types::{Floor, StoreRole};

use super::bullets::{Owner, PLAYER_BULLET_SPEED};
use super::escalator::{self, RIDE_FRAMES};
use super::state::{Core, Ctx, DeathCause, AUTO_CALL_FRAMES};
use super::world::{self, Opening, CHEST_DY, LOW_DY};
use super::MallOutcome;

/// Fixed point: 1/256 px.
pub const FP: i32 = 256;
/// Gravity (fixed point per frame^2) and jump launch speeds (tuned so the apex is ~20 px / ~30 px).
pub const GRAVITY: i32 = 88;
pub const JUMP_V0: i32 = -960;
pub const HIGH_JUMP_V0: i32 = -1180;
pub const MAX_FALL_V: i32 = 5 * FP;
/// Frames between player shots (rapid fire is faster).
pub const SHOT_COOLDOWN: u32 = 6;
pub const RAPID_COOLDOWN: u32 = 3;
pub const AIM_FRAMES: u32 = 10;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Normal,
    /// Inside car `car` (index into `SHAFTS`).
    Riding { car: usize },
    /// On escalator `idx`; `t` frames into the ride.
    Escalator { idx: usize, up: bool, t: i32 },
    /// Death animation, `t` frames in.
    Dying { t: u32 },
}

#[derive(Clone, Debug)]
pub struct Player {
    pub x: i32,
    /// Feet y in 1/256 px.
    pub yf: i32,
    pub vy: i32,
    pub grounded: bool,
    pub facing: i32,
    pub ducking: bool,
    /// Left the ground by jumping (as opposed to walking off an edge).
    pub jumped: bool,
    /// The jump carries forward momentum (a jump-kick).
    pub kick: bool,
    /// Horizontal direction fixed at take-off.
    pub air_dx: i32,
    pub mode: Mode,
    pub cooldown: u32,
    pub aim: u32,
    pub invuln: u32,
    /// Highest point of the current airtime (for fall damage).
    pub peak_y: i32,
    pub on_roof: Option<usize>,
    pub hidden: bool,
    /// Sub-pixel walking accumulator (thousandths of a pixel).
    pub xacc: i32,
    /// Boarded with a direction held: ignore it until released once.
    pub ride_lock: bool,
    /// Animation clock for walking (advances only when moving).
    pub walk_t: u32,
    /// Frames since the last landing (for the landing squash).
    pub since_land: u32,
}

impl Player {
    pub fn new() -> Player {
        Player {
            x: 0,
            yf: 0,
            vy: 0,
            grounded: false,
            facing: 1,
            ducking: false,
            jumped: false,
            kick: false,
            air_dx: 0,
            mode: Mode::Normal,
            cooldown: 0,
            aim: 0,
            invuln: 0,
            peak_y: 0,
            on_roof: None,
            hidden: false,
            xacc: 0,
            ride_lock: false,
            walk_t: 0,
            since_land: 99,
        }
    }

    pub fn y(&self) -> i32 {
        self.yf.div_euclid(FP)
    }
    pub fn set_y(&mut self, y: i32) {
        self.yf = y * FP;
    }

    pub fn begin_arrival(&mut self) {
        let (x, y) = super::arrival::hang_pos(0);
        self.x = x;
        self.set_y(y);
        self.grounded = false;
        self.facing = 1;
    }

    /// Stand at (x, feet y) with a clean movement state.
    pub fn place(&mut self, x: i32, y: i32) {
        self.x = x;
        self.set_y(y);
        self.vy = 0;
        self.grounded = true;
        self.ducking = false;
        self.jumped = false;
        self.kick = false;
        self.air_dx = 0;
        self.mode = Mode::Normal;
        self.cooldown = 0;
        self.aim = 0;
        self.peak_y = y;
        self.on_roof = None;
        self.xacc = 0;
        self.ride_lock = false;
        self.hidden = false;
    }

    pub fn start_dying(&mut self) {
        self.mode = Mode::Dying { t: 0 };
        self.ducking = false;
        self.kick = false;
        self.ride_lock = false;
    }

    pub fn is_dying(&self) -> bool {
        matches!(self.mode, Mode::Dying { .. })
    }

    /// Could a car arriving level with `floor` swallow him (standing in its opening, grounded, Normal)?
    pub fn can_be_picked_up(&self, floor: Floor, shaft_x: i32) -> bool {
        matches!(self.mode, Mode::Normal)
            && self.grounded
            && self.y() == floor_y(floor)
            && self.x >= shaft_x
            && self.x < shaft_x + SHAFT_W
    }

    /// Climb into car `car` (centred, riding at platform height `car_y`).
    pub fn board(&mut self, car: usize, cx: i32, car_y: i32, lock: bool) {
        self.mode = Mode::Riding { car };
        self.x = cx;
        self.set_y(car_y);
        self.vy = 0;
        self.grounded = true;
        self.ducking = false;
        self.jumped = false;
        self.kick = false;
        self.on_roof = None;
        self.ride_lock = lock;
    }
}

impl Default for Player {
    fn default() -> Self {
        Player::new()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Support {
    Floor,
    Grate,
    CarFloor,
    Roof(usize),
}

impl Core {
    /// Every surface at world x, as (y, kind).
    pub fn surfaces_at(&self, x: i32) -> Vec<(i32, Support)> {
        let mut v = Vec::new();
        let shaft = world::shaft_index_at(x);
        for f in Floor::ALL {
            let sy = floor_y(f);
            match shaft {
                Some(i) if layout::SHAFTS[i].serves(f) => match world::opening_state(layout::SHAFTS[i].id, f, self.cars[i].y) {
                    Some(Opening::CarHere) => v.push((sy, Support::CarFloor)),
                    Some(Opening::GrateAbove) => v.push((sy, Support::Grate)),
                    _ => {}
                },
                _ => v.push((sy, Support::Floor)),
            }
        }
        if let Some(i) = shaft {
            v.push((self.cars[i].roof_y(), Support::Roof(i)));
        }
        v.sort_by_key(|s| s.0);
        v
    }

    /// Is there something to stand on exactly at (x, y)?
    pub fn standing_support(&self, x: i32, y: i32) -> Option<Support> {
        self.surfaces_at(x).into_iter().find(|(s, _)| *s == y).map(|(_, k)| k)
    }
}

fn walk_steps(acc: &mut i32, mul: f32) -> i32 {
    *acc += (mul * 1000.0).round() as i32;
    let n = *acc / 1000;
    *acc -= n * 1000;
    n
}

impl<'a> Ctx<'a> {
    /// The player's whole frame. Cars have already moved this frame.
    pub(super) fn step_player(&mut self, pad: PadState) -> MallOutcome {
        {
            let p = &mut self.core.player;
            p.invuln = p.invuln.saturating_sub(1);
            p.cooldown = p.cooldown.saturating_sub(1);
            p.aim = p.aim.saturating_sub(1);
            p.since_land = p.since_land.saturating_add(1);
        }
        match self.core.player.mode {
            Mode::Dying { t } => {
                self.core.player.mode = Mode::Dying { t: t + 1 };
                self.dying_physics();
                MallOutcome::None
            }
            Mode::Escalator { idx, up, t } => {
                self.step_escalator_ride(idx, up, t);
                MallOutcome::None
            }
            Mode::Riding { car } => self.step_riding(car, pad),
            Mode::Normal => self.step_normal(pad),
        }
    }

    fn step_escalator_ride(&mut self, idx: usize, up: bool, t: i32) {
        let t = t + 1;
        if t >= RIDE_FRAMES {
            let (x, y) = escalator::exit_pos(idx, up);
            let p = &mut self.core.player;
            p.x = x;
            p.set_y(y);
            p.mode = Mode::Normal;
            p.grounded = true;
            p.peak_y = y;
            p.facing = if up { 1 } else { -1 };
            return;
        }
        let (x, y) = escalator::ride_pos(idx, up, t);
        let p = &mut self.core.player;
        p.x = x;
        p.set_y(y);
        p.mode = Mode::Escalator { idx, up, t };
        p.facing = if up { 1 } else { -1 };
        self.core.escs[idx].up = up;
    }

    fn step_riding(&mut self, car: usize, pad: PadState) -> MallOutcome {
        let c = &self.core.cars[car];
        let (cy, cx) = (c.y, SHAFTS[car].center_x());
        let open = c.open_at().is_some();
        {
            let p = &mut self.core.player;
            p.x = cx;
            p.set_y(cy);
            p.grounded = true;
            if p.ride_lock && pad.dy() == 0 {
                p.ride_lock = false;
            }
        }
        if open && pad.dx() != 0 {
            let dx = pad.dx();
            let p = &mut self.core.player;
            p.mode = Mode::Normal;
            p.facing = dx;
            p.x = cx + dx * 14;
            p.grounded = true;
            p.peak_y = cy;
        }
        MallOutcome::None
    }

    fn dying_physics(&mut self) {
        let p = &self.core.player;
        if p.grounded {
            // keep him standing on whatever holds him; if the support vanished he falls
            if self.core.standing_support(p.x, p.y()).is_none() && !matches!(p.mode, Mode::Riding { .. }) {
                let p = &mut self.core.player;
                p.grounded = false;
                p.vy = 0;
            }
        }
        if !self.core.player.grounded {
            self.fall_step(false);
        }
    }

    /// One frame of airtime: gravity, swept landing. `deadly` = a long fall kills.
    fn fall_step(&mut self, deadly: bool) {
        let (x, y_prev) = (self.core.player.x, self.core.player.y());
        {
            let p = &mut self.core.player;
            p.vy = (p.vy + GRAVITY).min(MAX_FALL_V);
            p.yf += p.vy;
        }
        let y_new = self.core.player.y();
        if y_new < self.core.player.peak_y {
            self.core.player.peak_y = y_new;
        }
        if self.core.player.vy <= 0 {
            return;
        }
        let mut land: Option<(i32, Support)> = None;
        for (s, kind) in self.core.surfaces_at(x) {
            let tol = if matches!(kind, Support::Roof(_)) { 3 } else { 0 };
            if y_prev <= s + tol && y_new >= s {
                land = Some((s, kind));
                break;
            }
        }
        // never fall out of the world
        if land.is_none() && y_new >= floor_y(Floor::Parking) {
            land = Some((floor_y(Floor::Parking), Support::Floor));
        }
        if let Some((s, kind)) = land {
            let fall = s - self.core.player.peak_y;
            let jumped = self.core.player.jumped;
            {
                let p = &mut self.core.player;
                p.set_y(s);
                p.vy = 0;
                p.grounded = true;
                p.jumped = false;
                p.kick = false;
                p.air_dx = 0;
                p.peak_y = s;
                p.since_land = 0;
                p.on_roof = if let Support::Roof(i) = kind { Some(i) } else { None };
            }
            if deadly && fall > FLOOR_GAP {
                if self.kill_player(DeathCause::Fall) {
                    return;
                }
            }
            if fall >= 8 || jumped {
                self.out.sfx(if matches!(kind, Support::Roof(_)) { Sfx::Thud } else { Sfx::Land });
            }
        }
    }

    fn step_normal(&mut self, pad: PadState) -> MallOutcome {
        // ride a car roof: follow it
        if let Some(i) = self.core.player.on_roof {
            let roof = self.core.cars[i].roof_y();
            let sx = SHAFTS[i].x;
            let p = &mut self.core.player;
            if p.x >= sx && p.x < sx + SHAFT_W && p.grounded {
                p.set_y(roof);
                p.peak_y = roof;
            } else {
                p.on_roof = None;
            }
        }

        let grounded = self.core.player.grounded;
        let dx = pad.dx();

        // ---- Up / Down actions
        let mut acted = false;
        if grounded && (pad.just_pressed(UP) || pad.just_pressed(DOWN)) {
            if let Some(o) = self.try_actions(pad) {
                match o {
                    Action::Outcome(o) => return o,
                    Action::Done => acted = true,
                }
            }
        }
        if self.core.player.mode != Mode::Normal {
            return MallOutcome::None;
        }

        // ---- standing in a call zone for a while calls the car
        self.update_auto_call(pad, acted);

        // ---- duck
        {
            let p = &mut self.core.player;
            p.ducking = p.grounded && pad.is_held(DOWN) && !acted;
        }

        // ---- shoot
        let rapid = self.run.power.rapid_fire();
        if (pad.just_pressed(A) || (rapid && pad.is_held(A))) && self.core.player.cooldown == 0 {
            self.try_shoot();
        }

        // ---- jump
        if pad.just_pressed(B) && self.core.player.grounded && !self.core.player.ducking {
            let v0 = if self.run.power.high_jump() { HIGH_JUMP_V0 } else { JUMP_V0 };
            let p = &mut self.core.player;
            p.vy = v0;
            p.grounded = false;
            p.jumped = true;
            p.air_dx = dx;
            p.kick = dx != 0;
            p.peak_y = p.y();
            p.on_roof = None;
            if dx != 0 {
                p.facing = dx;
            }
            self.out.sfx(Sfx::Jump);
        }

        // ---- horizontal movement
        let mul = self.run.power.walk_mul();
        {
            let p = &mut self.core.player;
            let mdx = if p.grounded { if p.ducking { 0 } else { dx } } else { p.air_dx };
            if mdx != 0 {
                if p.grounded {
                    p.facing = mdx;
                    p.walk_t += 1;
                }
                let n = walk_steps(&mut p.xacc, mul);
                p.x = (p.x + mdx * n).clamp(WALL_L + 4, WALL_R - 4);
            } else {
                p.xacc = 0;
            }
        }

        // ---- vertical
        if self.core.player.grounded {
            let (x, y) = (self.core.player.x, self.core.player.y());
            match self.core.standing_support(x, y) {
                Some(Support::Roof(i)) => self.core.player.on_roof = Some(i),
                Some(_) => self.core.player.on_roof = None,
                None => {
                    let p = &mut self.core.player;
                    p.grounded = false;
                    p.vy = 0;
                    p.jumped = false;
                    p.kick = false;
                    p.air_dx = 0;
                    p.peak_y = y;
                    p.on_roof = None;
                }
            }
        }
        if !self.core.player.grounded {
            self.fall_step(true);
        }
        MallOutcome::None
    }

    fn try_shoot(&mut self) {
        let max = self.run.power.max_player_bullets();
        if self.core.bullets.player_volleys() >= max {
            return;
        }
        let spread = self.run.power.spread_shot();
        let rapid = self.run.power.rapid_fire();
        let (x, y, face, duck) = {
            let p = &self.core.player;
            (p.x, p.y(), p.facing, p.ducking && p.grounded)
        };
        let by = y - if duck { LOW_DY } else { CHEST_DY };
        let floor = world::nearest_floor(y - 8);
        let g = self.core.bullets.new_group();
        let drifts: &[i32] = if spread { &[-5, 0, 5] } else { &[0] };
        for d in drifts {
            self.core.bullets.fire(Owner::Player, x + face * 9, by, face * PLAYER_BULLET_SPEED, *d, floor, g);
        }
        let p = &mut self.core.player;
        p.cooldown = if rapid { super::player::RAPID_COOLDOWN } else { SHOT_COOLDOWN };
        p.aim = AIM_FRAMES;
        self.out.sfx(Sfx::Shot);
    }

    fn update_auto_call(&mut self, pad: PadState, acted: bool) {
        let p = &self.core.player;
        let still = pad.dx() == 0 && !acted && p.grounded && p.mode == Mode::Normal;
        let floor = world::floor_at_y(p.y());
        if let (true, Some(f)) = (still, floor) {
            for i in 0..3 {
                let c = &self.core.cars[i];
                if !layout::SHAFTS[i].serves(f) || !world::in_call_zone(c.shaft, p.x) {
                    continue;
                }
                if c.level_floor() == Some(f) || c.answering_call_to(f) {
                    self.core.call_wait = 0;
                    return;
                }
                self.core.call_wait += 1;
                if self.core.call_wait >= AUTO_CALL_FRAMES {
                    self.core.cars[i].call_to(f);
                    self.core.call_wait = 0;
                }
                return;
            }
        }
        self.core.call_wait = 0;
    }

    /// Up/Down pressed while grounded: shafts, escalators, stores, the getaway car.
    fn try_actions(&mut self, pad: PadState) -> Option<Action> {
        let (x, y) = (self.core.player.x, self.core.player.y());
        let f = world::floor_at_y(y)?;
        let up = pad.just_pressed(UP);

        // elevator shafts: board an open car in the opening, or call a car that is not here
        for i in 0..3 {
            let s = &SHAFTS[i];
            if !s.serves(f) || !world::in_call_zone(s.id, x) {
                continue;
            }
            let car = &self.core.cars[i];
            if car.open_at() == Some(f) && world::in_opening_zone(s.id, x) {
                let held_dir = pad.dy() != 0;
                let (cx, cy) = (s.center_x(), car.y);
                self.core.player.board(i, cx, cy, held_dir);
                self.core.call_wait = 0;
                return Some(Action::Done);
            }
            if car.level_floor() == Some(f) && car.dir == 0 {
                // doors still opening: nothing yet
                return Some(Action::Done);
            }
            if car.level_floor() != Some(f) {
                let c = &mut self.core.cars[i];
                if !c.answering_call_to(f) {
                    c.call_to(f);
                }
                self.core.call_wait = 0;
                return Some(Action::Done);
            }
        }

        // escalators
        for (idx, e) in ESCALATORS.iter().enumerate() {
            if up && f == e.lower() && world::at_esc_bottom(idx, x) {
                let (ex, ey) = escalator::ride_pos(idx, true, 0);
                let p = &mut self.core.player;
                p.x = ex;
                p.set_y(ey);
                p.mode = Mode::Escalator { idx, up: true, t: 0 };
                p.ducking = false;
                self.core.escs[idx].up = true;
                return Some(Action::Done);
            }
            if !up && f == e.upper && world::at_esc_top(idx, x) {
                let (ex, ey) = escalator::ride_pos(idx, false, 0);
                let p = &mut self.core.player;
                p.x = ex;
                p.set_y(ey);
                p.mode = Mode::Escalator { idx, up: false, t: 0 };
                p.ducking = false;
                self.core.escs[idx].up = false;
                return Some(Action::Done);
            }
        }

        if up {
            // store doors
            for id in layout::stores_on(f) {
                if world::at_store_door(id, x) {
                    let open = match id.role() {
                        StoreRole::Target => !self.run.store_cleared(id),
                        StoreRole::PowerShop => true,
                        StoreRole::Closed => false,
                    };
                    if open {
                        self.out.sfx(Sfx::Door);
                        return Some(Action::Outcome(MallOutcome::EnterStore(id)));
                    }
                    self.out.sfx(Sfx::Buzzer);
                    return Some(Action::Done);
                }
            }
            // the getaway car
            if f == Floor::Parking && x >= layout::CAR_X && x < layout::CAR_X + layout::CAR_W {
                if self.run.has_all_packages() {
                    if !self.core.level_clear_sent {
                        self.core.level_clear_sent = true;
                        self.core.wagon_lights = true;
                        return Some(Action::Outcome(MallOutcome::LevelClear));
                    }
                    return Some(Action::Done);
                }
                let n = self.run.packages_left();
                self.core.banner.show(&copy::packages_left_banner(n), 120);
                self.out.sfx(Sfx::Buzzer);
                return Some(Action::Done);
            }
        }
        None
    }
}

pub(super) enum Action {
    Done,
    Outcome(MallOutcome),
}
