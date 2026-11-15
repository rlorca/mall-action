//! The side-scrolling mall: player, elevators, escalators, spies, lights, NPCs.
//! Pure rules; the renderer only reads this state. All randomness comes from the passed-in Rng.
use super::elevator::{Car, CarEvent, Fall, Opening};
use super::level::*;
use super::powerups::{PowerKind, Powers, Weapon};
use crate::audio::Sfx;
use crate::copy;
use crate::input::*;
use crate::rng::Rng;
use crate::stores::StoreId;

pub const HALF_W: f32 = 5.0;
pub const PLAYER_H: f32 = 24.0;
pub const DUCK_H: f32 = 12.0;
pub const GRAVITY: f32 = 0.25;
pub const JUMP_V: f32 = 3.2;
pub const JUMP_V_HIGH: f32 = 3.9;
pub const BULLET_SPEED: f32 = 4.0;
pub const SPY_BULLET_SPEED: f32 = 2.0;
pub const SPY_CAP: usize = 4;
pub const FIRST_SPAWN: i32 = 300;
pub const SPY_FIRST_SHOT: i32 = 120;
pub const SPY_TELEGRAPH: i32 = 30;
pub const SPY_DEATH: i32 = 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cause {
    Bullet,
    Touch,
    Crush,
    Lamp,
    Fall,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PState {
    /// Sliding down the cable; `t` frames elapsed.
    Zip(i32),
    /// Dropping from the cable to the roof.
    Drop,
    Land(i32),
    Selfie(i32),
    Walk,
    Inside(usize),
    Roof(usize),
    Esc { idx: usize, up: bool, t: i32 },
    Fall { vy: f32, fatal: bool, shaft: usize, start_y: f32 },
    Dying(i32),
    Hidden(i32),
}

#[derive(Clone, Debug)]
pub struct Player {
    pub x: f32,
    pub floor: u8,
    /// Height above the floor (jumps).
    pub z: f32,
    pub vz: f32,
    /// Absolute feet y override for Zip/Drop/Fall states.
    pub y: f32,
    pub face: i8,
    pub st: PState,
    pub duck: bool,
    pub kick: bool,
    pub air_dir: i8,
    pub cd: i32,
    pub inv: i32,
    pub frozen: i32,
    pub slide: i8,
    pub still: i32,
    pub board_delay: i32,
    pub pickup: Option<usize>,
    pub safe_x: f32,
    pub safe_floor: u8,
    pub anim: i32,
    pub shoot_pose: i32,
    pub came_out_of_booth: bool,
    pub moving: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SpyState {
    Walk,
    Aim(i32, bool),
    Duck(i32),
    Wait(i32),
    Dying(i32),
}

#[derive(Clone, Debug)]
pub struct Spy {
    pub x: f32,
    pub floor: u8,
    pub dir: i8,
    pub st: SpyState,
    pub age: i32,
    pub cd: i32,
    pub walk_t: i32,
    pub goal: Option<f32>,
    pub last_volley: u32,
    pub anim: i32,
}

#[derive(Clone, Debug)]
pub struct Bullet {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub floor: u8,
    pub hostile: bool,
    pub volley: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LampState {
    Hang,
    Fall { y: f32, vy: f32, dir: i8 },
    Roll { dir: i8 },
    Wreck(i32),
}

#[derive(Clone, Debug)]
pub struct Lamp {
    pub floor: u8,
    pub x: f32,
    pub disco: bool,
    pub st: LampState,
}

#[derive(Clone, Debug)]
pub struct Coin {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub gold: bool,
    pub floor: u8,
    pub bounces: u8,
    pub ttl: i32,
}

#[derive(Clone, Debug)]
pub struct Pickup {
    pub x: f32,
    pub floor: u8,
    pub kind: PowerKind,
    pub ttl: i32,
}

#[derive(Clone, Debug)]
pub struct Popup {
    pub x: f32,
    pub y: f32,
    pub text: String,
    pub t: i32,
}

#[derive(Clone, Debug)]
pub struct Bubble {
    pub x: f32,
    pub y: f32,
    pub text: String,
    pub t: i32,
}

#[derive(Clone, Debug)]
pub struct Banner {
    pub lines: Vec<String>,
    pub t: i32,
    pub total: i32,
    pub alert: bool,
}

#[derive(Clone, Debug)]
pub struct Janitor {
    pub x: f32,
    pub dir: i8,
    pub mop: i32,
    pub next_mop: i32,
}
#[derive(Clone, Debug)]
pub struct Wet {
    pub cx: f32,
    pub t: i32,
}
pub const WET_W: f32 = 48.0;
pub const WET_FLOOR: u8 = 1;
pub const JANITOR_MIN: f32 = 452.0;
pub const JANITOR_MAX: f32 = 668.0;

#[derive(Clone, Debug)]
pub struct Walker {
    pub x: f32,
    pub dir: i8,
    pub min: f32,
    pub max: f32,
    pub hey: i32,
}
pub const WALKER_FLOOR: u8 = 2;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum CopState {
    Patrol,
    Chase(i32),
    Cooldown(i32),
}
#[derive(Clone, Debug)]
pub struct Cop {
    pub x: f32,
    pub floor: u8,
    pub dir: i8,
    pub st: CopState,
    pub whistle: i32,
}

#[derive(Clone, Debug)]
pub struct Fountain {
    pub floor: u8,
    pub x: f32,
    pub cd: i32,
}

#[derive(Clone, Debug)]
pub struct Dark {
    pub floor: u8,
    pub x0: f32,
    pub x1: f32,
    pub t: i32,
}

/// Things the mall tells the game about (sound, score, flow).
#[derive(Clone, Debug, PartialEq)]
pub enum Ev {
    Sfx(Sfx),
    Score(i32),
    Died(Cause),
    EnterStore(StoreId),
    LevelClear,
    ExtraLife,
    Power(PowerKind),
    PhotoStrip,
}

pub struct Ctx<'a> {
    pub powers: &'a mut Powers,
    pub stores: &'a [StoreState],
    pub loop_n: u32,
    pub bf: bool,
    pub packages: u32,
    pub rng: &'a mut Rng,
}

pub fn floor_from_y(y: f32) -> u8 {
    let f = FLOOR_R as f32 - (y - ROOF_Y as f32) / FLOOR_GAP as f32;
    f.round().clamp(0.0, FLOOR_R as f32) as u8
}

#[derive(Clone)]
pub struct Mall {
    pub t: i32,
    pub p: Player,
    pub cars: [Car; 3],
    pub spies: Vec<Spy>,
    pub bullets: Vec<Bullet>,
    pub lamps: Vec<Lamp>,
    pub coins: Vec<Coin>,
    pub pickups: Vec<Pickup>,
    pub popups: Vec<Popup>,
    pub bubbles: Vec<Bubble>,
    pub dark: Vec<Dark>,
    pub janitor: Janitor,
    pub wet: Option<Wet>,
    pub walkers: [Walker; 2],
    pub cop: Cop,
    pub fountains: Vec<Fountain>,
    pub kiosk_cd: i32,
    pub kiosk_panel: i32,
    pub kiosk_target: Option<StoreId>,
    pub booth_strip_shown: bool,
    pub strip_t: i32,
    pub alarm: bool,
    pub alarm_at: i32,
    pub banner: Option<Banner>,
    pub next_pa: i32,
    pub last_pa: usize,
    pub shake: i32,
    pub spawn_timer: i32,
    pub flash: i32,
    pub ev: Vec<Ev>,
    pub cleared: bool,
    pub next_volley: u32,
    pub post: usize,
    pub control: bool,
    pub ping: Vec<(f32, f32, i32)>,
    pub stat_kills: u32,
    pub dying_cause: Option<Cause>,
    pub drive: i8,
    pub hum: bool,
}

fn shaft_hit(x: f32) -> Option<usize> {
    SHAFTS.iter().position(|s| x >= (s.x + 4) as f32 && x <= (s.x + SHAFT_W - 4) as f32)
}

impl Mall {
    pub fn new(rng: &mut Rng, loop_n: u32) -> Mall {
        let cars = [
            Car::new(SHAFTS[0], *rng.pick(&[5u8, 4, 3, 2])),
            Car::new(SHAFTS[1], *rng.pick(&[4u8, 3, 2, 1, 0])),
            Car::new(SHAFTS[2], *rng.pick(&[3u8, 2, 1])),
        ];
        let mut lamps = Vec::new();
        for (f, x) in LAMPS {
            lamps.push(Lamp { floor: f, x: x as f32, disco: f == 2, st: LampState::Hang });
        }
        let alarm_at = (150 - 20 * (loop_n as i32 - 1)).max(60) * 60;
        let cop_floor = *rng.pick(&[4u8, 3, 2, 1]);
        Mall {
            t: 0,
            p: Player {
                x: SKY_TOP_X as f32,
                floor: FLOOR_R,
                z: 0.0,
                vz: 0.0,
                y: (ROOF_Y - 104 + 24) as f32,
                face: 1,
                st: PState::Zip(0),
                duck: false,
                kick: false,
                air_dir: 0,
                cd: 0,
                inv: 0,
                frozen: 0,
                slide: 0,
                still: 0,
                board_delay: 0,
                pickup: None,
                safe_x: 120.0,
                safe_floor: FLOOR_R,
                anim: 0,
                shoot_pose: 0,
                came_out_of_booth: false,
                moving: false,
            },
            cars,
            spies: vec![],
            bullets: vec![],
            lamps,
            coins: vec![],
            pickups: vec![],
            popups: vec![],
            bubbles: vec![],
            dark: vec![],
            janitor: Janitor { x: 500.0, dir: 1, mop: 0, next_mop: 240 },
            wet: None,
            walkers: [
                Walker { x: 440.0, dir: 1, min: 424.0, max: 584.0, hey: 0 },
                Walker { x: 640.0, dir: -1, min: 604.0, max: 708.0, hey: 0 },
            ],
            cop: Cop { x: 300.0, floor: cop_floor, dir: 1, st: CopState::Patrol, whistle: 0 },
            fountains: FOUNTAINS.iter().map(|(f, x)| Fountain { floor: *f, x: *x as f32, cd: 0 }).collect(),
            kiosk_cd: 0,
            kiosk_panel: 0,
            kiosk_target: None,
            booth_strip_shown: false,
            strip_t: 0,
            alarm: false,
            alarm_at,
            banner: None,
            next_pa: 1800 + rng.range(0, 900),
            last_pa: usize::MAX,
            shake: 0,
            spawn_timer: FIRST_SPAWN,
            flash: 0,
            ev: vec![],
            cleared: false,
            next_volley: 1,
            post: rng.index(copy::ARRIVAL_POSTS.len()),
            control: false,
            ping: vec![],
            stat_kills: 0,
            dying_cause: None,
            drive: 0,
            hum: false,
        }
    }

    // ---------- helpers ----------
    pub fn px(&self) -> f32 {
        self.p.x
    }
    /// Feet y of the player in world space.
    pub fn feet_y(&self) -> f32 {
        match self.p.st {
            PState::Zip(_) | PState::Drop | PState::Fall { .. } => self.p.y,
            PState::Inside(i) => self.cars[i].y as f32,
            PState::Roof(i) => self.cars[i].roof_y() as f32,
            PState::Esc { idx, up, t } => {
                let e = &ESCALATORS[idx];
                let prog = if up { t } else { ESC_RUN - t };
                (floor_y(e.low) - prog) as f32
            }
            _ => floor_y(self.p.floor) as f32 - self.p.z,
        }
    }
    pub fn player_floor(&self) -> u8 {
        match self.p.st {
            PState::Walk | PState::Hidden(_) | PState::Land(_) | PState::Selfie(_) | PState::Dying(_) => self.p.floor,
            _ => floor_from_y(self.feet_y()),
        }
    }
    /// Player is a valid target for spies?
    pub fn visible(&self) -> bool {
        !matches!(
            self.p.st,
            PState::Hidden(_) | PState::Dying(_) | PState::Zip(_) | PState::Drop | PState::Land(_) | PState::Selfie(_)
        )
    }
    pub fn player_x_range(&self) -> (f32, f32) {
        (self.p.x - HALF_W, self.p.x + HALF_W)
    }
    pub fn player_y_range(&self) -> (f32, f32) {
        let f = self.feet_y();
        let h = if self.p.duck { DUCK_H } else { PLAYER_H };
        (f - h, f)
    }
    pub fn grounded(&self) -> bool {
        matches!(self.p.st, PState::Walk) && self.p.z <= 0.0
    }
    fn say(&mut self, x: f32, floor: u8, text: &str) {
        self.bubbles.push(Bubble { x, y: floor_y(floor) as f32 - 30.0, text: text.to_string(), t: 100 });
    }
    fn popup(&mut self, x: f32, y: f32, text: String) {
        self.popups.push(Popup { x, y, text, t: 50 });
    }
    fn score(&mut self, pts: i32, x: f32, y: f32) {
        self.ev.push(Ev::Score(pts));
        let t = if pts >= 0 { format!("{pts}") } else { format!("{pts}") };
        self.popup(x, y, t);
    }
    pub fn set_banner(&mut self, lines: Vec<String>, frames: i32, alert: bool) {
        self.banner = Some(Banner { lines, t: frames, total: frames, alert });
    }
    pub fn pit_at(&self, floor: u8, x: f32) -> Option<usize> {
        let i = shaft_hit(x)?;
        (self.cars[i].opening(floor) == Opening::Pit).then_some(i)
    }
    /// Player is inside the doorway zone (opening or right beside it) of shaft `i`.
    fn near_opening(&self, i: usize, floor: u8) -> bool {
        let s = &SHAFTS[i];
        s.serves(floor) && self.p.x >= (s.x - 14) as f32 && self.p.x <= (s.x + SHAFT_W + 14) as f32
    }
    pub fn cars_occupied(&self, i: usize) -> bool {
        matches!(self.p.st, PState::Inside(j) if j == i)
    }

    // ---------- damage ----------
    fn hurt_player(&mut self, cause: Cause, ctx: &mut Ctx) {
        if self.p.inv > 0 || ctx.powers.invincible() || matches!(self.p.st, PState::Dying(_) | PState::Hidden(_)) {
            return;
        }
        if ctx.powers.armor && matches!(cause, Cause::Bullet | Cause::Touch) {
            ctx.powers.armor = false;
            self.p.inv = 60;
            self.ev.push(Ev::Sfx(Sfx::Hurt));
            return;
        }
        self.kill_player(cause);
    }

    /// Unconditional death (crush, fall): armour does not help.
    pub fn kill_player(&mut self, cause: Cause) {
        if matches!(self.p.st, PState::Dying(_) | PState::Hidden(_)) {
            return;
        }
        self.p.st = PState::Dying(70);
        self.p.kick = false;
        self.p.slide = 0;
        self.bullets.clear();
        self.ev.push(Ev::Sfx(Sfx::Death));
        self.dying_cause = Some(cause);
        if matches!(cause, Cause::Crush | Cause::Fall) {
            self.shake = 12;
        }
    }

    /// Respawn at the last safe spot: clears spies and bullets, removes freeze, blinks for ~2 s.
    pub fn respawn(&mut self) {
        self.p.st = PState::Walk;
        self.p.x = self.p.safe_x;
        self.p.floor = self.p.safe_floor;
        self.p.z = 0.0;
        self.p.vz = 0.0;
        self.p.inv = 120;
        self.p.frozen = 0;
        self.p.slide = 0;
        self.p.kick = false;
        self.p.duck = false;
        self.p.pickup = None;
        self.spies.clear();
        self.bullets.clear();
        if let CopState::Chase(_) = self.cop.st {
            self.cop.st = CopState::Cooldown(300);
        }
        self.spawn_timer = self.spawn_timer.max(180);
        self.dying_cause = None;
    }
}

// ====================== simulation step ======================
impl Mall {
    pub fn step(&mut self, pad: PadState, ctx: &mut Ctx) {
        self.t += 1;
        self.ev.clear();
        self.tick_timers();
        self.update_player(pad, ctx);
        self.update_cars(ctx);
        self.update_npcs(ctx);
        self.update_spies(ctx);
        self.update_bullets(ctx);
        self.update_lights(ctx);
        self.update_items();
        self.check_hazards(ctx);
        self.update_spawns(ctx);
        self.update_alarm_pa(ctx);
    }

    /// While the player is inside a store the mall does not simulate, but the level clock runs.
    pub fn idle_tick(&mut self, ctx: &mut Ctx) {
        self.t += 1;
        self.ev.clear();
        self.update_alarm_pa(ctx);
    }

    fn tick_timers(&mut self) {
        if self.shake > 0 {
            self.shake -= 1;
        }
        if self.flash > 0 {
            self.flash -= 1;
        }
        if self.kiosk_cd > 0 {
            self.kiosk_cd -= 1;
        }
        if self.kiosk_panel > 0 {
            self.kiosk_panel -= 1;
        }
        if self.strip_t > 0 {
            self.strip_t -= 1;
        }
        for pu in self.popups.iter_mut() {
            pu.t -= 1;
            pu.y -= 0.4;
        }
        self.popups.retain(|p| p.t > 0);
        for b in self.bubbles.iter_mut() {
            b.t -= 1;
        }
        self.bubbles.retain(|b| b.t > 0);
        for d in self.dark.iter_mut() {
            d.t -= 1;
        }
        self.dark.retain(|d| d.t > 0);
        for f in self.fountains.iter_mut() {
            if f.cd > 0 {
                f.cd -= 1;
            }
        }
        if let Some(b) = self.banner.as_mut() {
            b.t -= 1;
        }
        if self.banner.as_ref().map_or(false, |b| b.t <= 0) {
            self.banner = None;
        }
        self.ping.retain_mut(|p| {
            p.2 -= 1;
            p.2 > 0
        });
    }

    fn update_alarm_pa(&mut self, ctx: &mut Ctx) {
        if !self.alarm && self.t >= self.alarm_at && self.control {
            self.alarm = true;
            self.set_banner(vec![copy::ALARM_BANNER.to_string()], 150, true);
            self.ev.push(Ev::Sfx(Sfx::Buzzer));
        }
        self.next_pa -= 1;
        if self.next_pa <= 0 && self.control {
            let mut i = ctx.rng.index(copy::PA_LINES.len());
            if i == self.last_pa {
                i = (i + 1) % copy::PA_LINES.len();
            }
            self.last_pa = i;
            self.set_banner(copy::PA_LINES[i].iter().map(|s| s.to_string()).collect(), 220, false);
            self.ev.push(Ev::Sfx(Sfx::PaChime));
            self.next_pa = 3600 + ctx.rng.range(-600, 600);
        }
    }

    fn update_player(&mut self, pad: PadState, ctx: &mut Ctx) {
        self.p.anim += 1;
        if self.p.inv > 0 {
            self.p.inv -= 1;
        }
        if self.p.cd > 0 {
            self.p.cd -= 1;
        }
        if self.p.shoot_pose > 0 {
            self.p.shoot_pose -= 1;
        }
        self.drive = 0;
        match self.p.st {
            PState::Zip(t) => {
                let u = t as f32 / 150.0;
                let (x0, y0) = (SKY_TOP_X as f32, (ROOF_Y - 104) as f32);
                let (x1, y1) = (ANCHOR_X as f32 - 6.0, (ROOF_Y - 20) as f32);
                self.p.x = x0 + (x1 - x0) * u;
                self.p.y = y0 + (y1 - y0) * u + 24.0;
                if t == 0 {
                    self.ev.push(Ev::Sfx(Sfx::Zip));
                }
                self.p.st = if t >= 138 { PState::Drop } else { PState::Zip(t + 1) };
                if t >= 138 {
                    self.p.vz = 0.0;
                }
            }
            PState::Drop => {
                self.p.vz += 0.3;
                self.p.y += self.p.vz;
                if self.p.y >= ROOF_Y as f32 {
                    self.p.y = ROOF_Y as f32;
                    self.p.st = PState::Land(24);
                    self.shake = 5;
                    self.ev.push(Ev::Sfx(Sfx::Land));
                }
            }
            PState::Land(t) => {
                self.p.st = if t <= 1 {
                    self.flash = 6;
                    self.ev.push(Ev::Sfx(Sfx::Camera));
                    PState::Selfie(150)
                } else {
                    PState::Land(t - 1)
                };
            }
            PState::Selfie(t) => {
                let skip = t < 130 && pad.any_pressed();
                if t <= 1 || skip {
                    self.p.st = PState::Walk;
                    self.p.floor = FLOOR_R;
                    self.p.z = 0.0;
                    self.p.safe_x = self.p.x;
                    self.control = true;
                } else {
                    self.p.st = PState::Selfie(t - 1);
                }
            }
            PState::Dying(t) => {
                if t > 0 {
                    self.p.st = PState::Dying(t - 1);
                } else if t == 0 {
                    self.p.st = PState::Dying(-1);
                    let c = self.dying_cause.unwrap_or(Cause::Bullet);
                    self.ev.push(Ev::Died(c));
                }
            }
            PState::Hidden(t) => {
                let leave = t <= 1 || pad.pressed(DOWN) || pad.pressed(LEFT) || pad.pressed(RIGHT) || pad.pressed(B);
                if leave {
                    self.p.st = PState::Walk;
                    if !self.booth_strip_shown {
                        self.booth_strip_shown = true;
                        self.strip_t = 160;
                        self.ev.push(Ev::PhotoStrip);
                    }
                } else {
                    self.p.st = PState::Hidden(t - 1);
                }
            }
            PState::Fall { mut vy, fatal, shaft, start_y } => {
                vy += 0.3;
                self.p.y += vy;
                if !fatal && self.p.y >= self.cars[shaft].roof_y() as f32 {
                    self.p.st = PState::Roof(shaft);
                    self.ev.push(Ev::Sfx(Sfx::Land));
                } else if fatal && self.p.y >= start_y + 56.0 {
                    self.kill_player(Cause::Fall);
                } else {
                    self.p.st = PState::Fall { vy, fatal, shaft, start_y };
                }
            }
            PState::Esc { idx, up, t } => {
                self.shoot(pad, ctx);
                if t + 1 >= ESC_RUN {
                    let e = ESCALATORS[idx];
                    self.p.st = PState::Walk;
                    self.p.floor = if up { e.high() } else { e.low };
                    self.p.x = if up { (e.x_high() + 6) as f32 } else { (e.x_low - 6) as f32 };
                    self.p.z = 0.0;
                } else {
                    self.p.st = PState::Esc { idx, up, t: t + 1 };
                }
                self.p.x = {
                    let e = ESCALATORS[idx];
                    let prog = if up { t } else { ESC_RUN - t };
                    (e.x_low + prog) as f32
                };
            }
            PState::Inside(i) => self.update_inside(i, pad, ctx),
            PState::Roof(i) => self.update_roof(i, pad, ctx),
            PState::Walk => self.update_walk(pad, ctx),
        }
    }

    fn update_inside(&mut self, i: usize, pad: PadState, ctx: &mut Ctx) {
        self.shoot(pad, ctx);
        let s = SHAFTS[i];
        self.p.x = (s.x + SHAFT_W / 2) as f32;
        if self.p.board_delay > 0 {
            self.p.board_delay -= 1;
        } else if s.manual {
            if pad.is(UP) && !pad.is(DOWN) {
                self.drive = -1;
            } else if pad.is(DOWN) && !pad.is(UP) {
                self.drive = 1;
            }
        }
        let car = &self.cars[i];
        if let Some(f) = car.floor_at() {
            if car.dir == 0 && (pad.is(LEFT) || pad.is(RIGHT)) {
                let left = pad.is(LEFT);
                self.p.st = PState::Walk;
                self.p.floor = f;
                self.p.z = 0.0;
                self.p.face = if left { -1 } else { 1 };
                self.p.x = if left { (s.x - 8) as f32 } else { (s.x + SHAFT_W + 8) as f32 };
                self.p.pickup = None;
            }
        }
    }

    fn update_roof(&mut self, i: usize, pad: PadState, ctx: &mut Ctx) {
        self.shoot(pad, ctx);
        let s = SHAFTS[i];
        let roof = self.cars[i].roof_y();
        let dir = pad.is(RIGHT) as i32 - pad.is(LEFT) as i32;
        if dir != 0 {
            self.p.face = dir as i8;
            let nx = self.p.x + dir as f32;
            let lo = (s.x + 8) as f32;
            let hi = (s.x + SHAFT_W - 8) as f32;
            if nx >= lo && nx <= hi {
                self.p.x = nx;
            } else if let Some(f) = (s.bottom..=s.top).find(|f| (floor_y(*f) - roof).abs() <= 10) {
                self.p.st = PState::Walk;
                self.p.floor = f;
                self.p.z = 0.0;
                self.p.x = if dir < 0 { (s.x - 8) as f32 } else { (s.x + SHAFT_W + 8) as f32 };
            }
        }
    }

    fn update_walk(&mut self, pad: PadState, ctx: &mut Ctx) {
        let floor = self.p.floor;
        let spd = ctx.powers.walk_speed();
        let airborne = self.p.z > 0.0;
        if self.p.frozen > 0 {
            self.p.frozen -= 1;
        }
        let frozen = self.p.frozen > 0;
        let mut dir: i32 = if frozen { 0 } else { pad.is(RIGHT) as i32 - pad.is(LEFT) as i32 };
        if self.p.slide != 0 {
            dir = self.p.slide as i32;
        }
        // ---- jumping / air ----
        if airborne {
            dir = self.p.air_dir as i32;
            self.p.z += self.p.vz;
            self.p.vz -= GRAVITY;
            if self.p.z <= 0.0 {
                self.p.z = 0.0;
                self.p.vz = 0.0;
                self.ev.push(Ev::Sfx(Sfx::Land));
                if self.on_wet(floor) && self.p.kick {
                    self.p.slide = if self.p.air_dir != 0 { self.p.air_dir } else { self.p.face };
                } else {
                    self.p.kick = false;
                }
                self.p.air_dir = 0;
            }
        } else if !frozen {
            // ---- interactions on press ----
            if pad.pressed(UP) && self.interact_up(ctx) {
                return;
            }
            if pad.pressed(DOWN) && self.interact_down() {
                return;
            }
            if pad.pressed(B) && self.p.slide == 0 || (pad.pressed(B) && self.p.slide != 0) {
                self.p.vz = if ctx.powers.high_jump() { JUMP_V_HIGH } else { JUMP_V };
                self.p.z = 0.01;
                self.p.air_dir = dir as i8;
                self.p.kick = dir != 0;
                self.ev.push(Ev::Sfx(Sfx::Jump));
            }
        }
        self.p.duck = !airborne && !frozen && pad.is(DOWN) && self.p.slide == 0 && self.p.z <= 0.0;
        // ---- horizontal motion ----
        self.p.moving = dir != 0 && !(self.p.duck && self.p.slide == 0);
        if dir != 0 && !(self.p.duck && self.p.slide == 0) {
            self.p.face = dir as i8;
            let nx = (self.p.x + dir as f32 * spd).clamp((WALL_L + 6) as f32, (WALL_R - 6) as f32);
            self.p.x = nx;
            self.p.still = 0;
        } else {
            self.p.still += 1;
        }
        // ---- wet floor ----
        if floor == WET_FLOOR && self.p.z <= 0.0 {
            let on = self.on_wet(floor);
            if on && self.p.slide == 0 && dir != 0 {
                self.p.slide = dir as i8;
            }
            if !on && self.p.slide != 0 {
                self.p.slide = 0;
                self.p.kick = false;
            }
        }
        // ---- pits ----
        if self.p.z <= 0.0 {
            if let Some(i) = self.pit_at(floor, self.p.x) {
                let car = &self.cars[i];
                let fatal = matches!(car.fall_into(floor), Fall::Fatal);
                self.p.st = PState::Fall { vy: 0.0, fatal, shaft: i, start_y: floor_y(floor) as f32 };
                self.p.y = floor_y(floor) as f32;
                self.p.x = (SHAFTS[i].x + SHAFT_W / 2) as f32;
                self.p.slide = 0;
                self.p.kick = false;
                return;
            }
            // remember the last safe spot (not over a shaft zone, not sliding)
            let near_shaft = SHAFTS.iter().any(|s| s.serves(floor) && (self.p.x - s.cx() as f32).abs() < 44.0);
            if !near_shaft && self.p.slide == 0 {
                self.p.safe_x = self.p.x;
                self.p.safe_floor = floor;
            }
        }
        // ---- auto-call ----
        if self.p.z <= 0.0 && dir == 0 {
            let zone = (0..3).find(|i| {
                self.near_opening(*i, floor) && matches!(self.cars[*i].opening(floor), Opening::Grate | Opening::Pit)
            });
            if let Some(i) = zone {
                if self.p.still == 30 {
                    self.cars[i].call(floor);
                    self.p.pickup = Some(i);
                }
            }
        }
        // ---- pickup: a car called for us must collect us ----
        if let Some(i) = self.p.pickup {
            if !self.near_opening(i, floor) {
                self.p.pickup = None;
            } else if self.cars[i].floor_at() == Some(floor) && self.cars[i].dir == 0 {
                self.p.st = PState::Inside(i);
                self.p.x = SHAFTS[i].cx() as f32;
                self.p.board_delay = 12;
                self.p.pickup = None;
                self.ev.push(Ev::Sfx(Sfx::Door));
                return;
            }
        }
        // ---- shooting ----
        if !frozen {
            self.shoot(pad, ctx);
        }
    }

    fn on_wet(&self, floor: u8) -> bool {
        floor == WET_FLOOR && self.wet.as_ref().map_or(false, |w| (self.p.x - w.cx).abs() <= WET_W / 2.0)
    }

    fn interact_up(&mut self, ctx: &mut Ctx) -> bool {
        let floor = self.p.floor;
        let x = self.p.x;
        // store doors
        for slot in STORE_SLOTS.iter().filter(|s| s.floor == floor) {
            if (x - slot.door_x() as f32).abs() <= 10.0 {
                let st = ctx.stores.iter().find(|s| s.id == slot.id).unwrap();
                if st.open_for_entry() {
                    self.ev.push(Ev::Sfx(Sfx::Door));
                    self.ev.push(Ev::EnterStore(slot.id));
                } else {
                    self.ev.push(Ev::Sfx(Sfx::Buzzer));
                }
                return true;
            }
        }
        // elevators
        for i in 0..3 {
            let s = SHAFTS[i];
            if !s.serves(floor) {
                continue;
            }
            if x >= (s.x + 2) as f32 && x <= (s.x + SHAFT_W - 2) as f32 && self.cars[i].opening(floor) == Opening::CarHere {
                self.p.st = PState::Inside(i);
                self.p.x = s.cx() as f32;
                self.p.board_delay = 12;
                self.ev.push(Ev::Sfx(Sfx::Door));
                return true;
            }
            if self.near_opening(i, floor) {
                self.cars[i].call(floor);
                self.p.pickup = Some(i);
                self.ev.push(Ev::Sfx(Sfx::Beep));
                return true;
            }
        }
        // escalator bottom landing
        for (idx, e) in ESCALATORS.iter().enumerate() {
            if floor == e.low && (x - e.x_low as f32).abs() <= 10.0 {
                self.p.st = PState::Esc { idx, up: true, t: 0 };
                return true;
            }
        }
        // kiosk
        for (f, kx) in KIOSKS {
            if f == floor && (x - kx as f32).abs() <= 14.0 {
                if self.kiosk_cd == 0 {
                    self.kiosk_cd = 1200;
                    self.kiosk_panel = 260;
                    self.kiosk_target = self.nearest_package_store(ctx);
                    self.ev.push(Ev::Sfx(Sfx::Beep));
                } else {
                    self.ev.push(Ev::Sfx(Sfx::Buzzer));
                }
                return true;
            }
        }
        // photo booth
        if floor == PHOTO_BOOTH.0 && (x - PHOTO_BOOTH.1 as f32).abs() <= 12.0 {
            self.p.st = PState::Hidden(300);
            self.p.x = PHOTO_BOOTH.1 as f32;
            self.ev.push(Ev::Sfx(Sfx::Door));
            return true;
        }
        // getaway car
        if floor == FLOOR_P && x >= WAGON_X as f32 - 8.0 && x <= (WAGON_X + WAGON_W) as f32 + 8.0 {
            if ctx.packages >= 6 {
                if !self.cleared {
                    self.cleared = true;
                    self.ev.push(Ev::LevelClear);
                }
            } else {
                let n = 6 - ctx.packages;
                self.set_banner(vec![format!("PACKAGES LEFT: {n}")], 120, true);
                self.ev.push(Ev::Sfx(Sfx::Buzzer));
            }
            return true;
        }
        false
    }

    fn interact_down(&mut self) -> bool {
        let floor = self.p.floor;
        let x = self.p.x;
        for i in 0..3 {
            let s = SHAFTS[i];
            if !s.serves(floor) {
                continue;
            }
            if x >= (s.x + 2) as f32 && x <= (s.x + SHAFT_W - 2) as f32 && self.cars[i].opening(floor) == Opening::CarHere {
                self.p.st = PState::Inside(i);
                self.p.x = s.cx() as f32;
                self.p.board_delay = 12;
                self.ev.push(Ev::Sfx(Sfx::Door));
                return true;
            }
            if self.near_opening(i, floor) {
                self.cars[i].call(floor);
                self.p.pickup = Some(i);
                self.ev.push(Ev::Sfx(Sfx::Beep));
                return true;
            }
        }
        for (idx, e) in ESCALATORS.iter().enumerate() {
            if floor == e.high() && (x - e.x_high() as f32).abs() <= 10.0 {
                self.p.st = PState::Esc { idx, up: false, t: 0 };
                return true;
            }
        }
        false
    }

    pub fn nearest_package_store(&self, ctx: &Ctx) -> Option<StoreId> {
        let pf = self.player_floor() as i32;
        let px = self.p.x as i32;
        STORE_SLOTS
            .iter()
            .filter(|s| ctx.stores.iter().any(|st| st.id == s.id && st.role() == crate::stores::Role::Target && !st.package_taken))
            .min_by_key(|s| (s.floor as i32 - pf).abs() * 200 + (s.door_x() - px).abs())
            .map(|s| s.id)
    }

    fn shoot(&mut self, pad: PadState, ctx: &mut Ctx) {
        if !pad.is(A) || self.p.cd > 0 || self.p.frozen > 0 {
            return;
        }
        let (cd, max) = ctx.powers.fire_params();
        let mine = self.bullets.iter().filter(|b| !b.hostile).count();
        if mine >= max {
            return;
        }
        let feet = self.feet_y();
        let y = feet - if self.p.duck { 6.0 } else { 16.0 };
        let dir = self.p.face as f32;
        let volley = self.next_volley;
        self.next_volley += 1;
        let floor = self.player_floor();
        let n = if ctx.powers.weapon_kind() == Weapon::Spread { 3 } else { 1 };
        if mine + n > max + 1 {
            return;
        }
        for k in 0..n {
            let vy = if n == 3 { (k as f32 - 1.0) * 0.9 } else { 0.0 };
            self.bullets.push(Bullet { x: self.p.x + dir * 8.0, y, vx: dir * BULLET_SPEED, vy, floor, hostile: false, volley });
        }
        self.p.cd = cd;
        self.p.shoot_pose = 10;
        self.ev.push(Ev::Sfx(Sfx::Shot));
        // the mall cop notices shooting in front of him
        let c = &self.cop;
        if c.st == CopState::Patrol
            && c.floor == floor
            && (self.p.x - c.x).abs() <= 128.0
            && ((self.p.x - c.x) * c.dir as f32) > 0.0
        {
            self.cop.st = CopState::Chase(600);
            self.cop.whistle = 70;
            let (cx, cf) = (self.cop.x, self.cop.floor);
            self.say(cx, cf, copy::COP_HEY);
            self.ev.push(Ev::Sfx(Sfx::Whistle));
        }
    }
}

// ====================== elevators, NPCs ======================
impl Mall {
    fn update_cars(&mut self, ctx: &mut Ctx) {
        self.hum = false;
        let pf = self.player_floor();
        for i in 0..3 {
            let drive = match self.p.st {
                PState::Inside(j) if j == i => self.drive,
                _ => 0,
            };
            let occupied = self.cars_occupied(i);
            let ev = self.cars[i].step(drive, occupied, ctx.rng);
            if matches!(self.p.st, PState::Inside(j) if j == i) && self.cars[i].dir != 0 {
                self.hum = true;
            }
            if let Some(CarEvent::Stopped(f)) = ev {
                let cx = SHAFTS[i].cx() as f32;
                let near = (cx - self.p.x).abs() < 260.0 && (f as i32 - pf as i32).abs() <= 1;
                let inside = matches!(self.p.st, PState::Inside(j) if j == i);
                if near || inside {
                    self.ev.push(Ev::Sfx(Sfx::Ding));
                }
                if inside {
                    self.set_banner(vec![copy::FLOORS[f as usize].to_string()], 100, false);
                } else if self.control
                    && (f as i32 - pf as i32).abs() <= 1
                    && (cx - self.p.x).abs() < 200.0
                    && self.live_spies() < self.spy_cap(ctx)
                    && ctx.rng.chance(30)
                {
                    let dir = if self.p.x >= cx { 1 } else { -1 };
                    self.spawn_spy(cx, f, dir);
                    if ctx.rng.chance(60) {
                        let line = *ctx.rng.pick(&copy::ELEVATOR_EXIT);
                        self.say(cx, f, line);
                    }
                }
            }
        }
    }

    fn update_npcs(&mut self, ctx: &mut Ctx) {
        // janitor
        let j = &mut self.janitor;
        if j.mop > 0 {
            j.mop -= 1;
            if j.mop == 0 {
                let cx = (j.x + j.dir as f32 * 20.0).clamp(JANITOR_MIN, JANITOR_MAX);
                self.wet = Some(Wet { cx, t: 600 });
            }
        } else {
            j.x += 0.5 * j.dir as f32;
            if j.x <= JANITOR_MIN {
                j.dir = 1;
            }
            if j.x >= JANITOR_MAX {
                j.dir = -1;
            }
            j.next_mop -= 1;
            if j.next_mop <= 0 {
                j.mop = 60;
                j.next_mop = 400 + ctx.rng.range(0, 200);
            }
        }
        if let Some(w) = self.wet.as_mut() {
            w.t -= 1;
        }
        if self.wet.as_ref().map_or(false, |w| w.t <= 0) {
            self.wet = None;
        }
        // mall walkers
        let (px, pfloor, grounded) = (self.p.x, self.player_floor(), self.grounded());
        let mut push = 0.0f32;
        for w in self.walkers.iter_mut() {
            w.x += 0.8 * w.dir as f32;
            if w.x <= w.min {
                w.dir = 1;
            }
            if w.x >= w.max {
                w.dir = -1;
            }
            if w.hey > 0 {
                w.hey -= 1;
            }
            if pfloor == WALKER_FLOOR && grounded && (px - w.x).abs() < 9.0 {
                push += 0.8 * w.dir as f32;
            }
        }
        if push != 0.0 {
            self.p.x = (self.p.x + push).clamp((WALL_L + 6) as f32, (WALL_R - 6) as f32);
        }
        // mall cop
        if self.cop.whistle > 0 {
            self.cop.whistle -= 1;
        }
        let (px, pfloor) = (self.p.x, self.player_floor());
        match self.cop.st {
            CopState::Patrol | CopState::Cooldown(_) => {
                self.cop.x += self.cop.dir as f32 * 1.0;
                if self.cop.x <= 40.0 {
                    self.cop.dir = 1;
                }
                if self.cop.x >= 700.0 {
                    self.cop.dir = -1;
                }
                if let CopState::Cooldown(t) = self.cop.st {
                    self.cop.st = if t <= 1 { CopState::Patrol } else { CopState::Cooldown(t - 1) };
                }
            }
            CopState::Chase(t) => {
                let d = px - self.cop.x;
                self.cop.dir = if d >= 0.0 { 1 } else { -1 };
                self.cop.x += self.cop.dir as f32 * 1.5;
                let catch = self.cop.floor == pfloor && d.abs() < 14.0 && self.grounded();
                if catch {
                    self.p.frozen = 180;
                    self.p.slide = 0;
                    self.score(-500, self.p.x, self.feet_y() - 30.0);
                    self.say(self.p.x, self.p.floor, copy::DETAINED);
                    self.cop.st = CopState::Cooldown(600);
                    self.ev.push(Ev::Sfx(Sfx::Buzzer));
                } else {
                    self.cop.st = if t <= 1 { CopState::Cooldown(300) } else { CopState::Chase(t - 1) };
                }
            }
        }
    }

    pub fn live_spies(&self) -> usize {
        self.spies.iter().filter(|s| !matches!(s.st, SpyState::Dying(_))).count()
    }
    pub fn spy_cap(&self, ctx: &Ctx) -> usize {
        if ctx.bf {
            SPY_CAP * 2
        } else {
            SPY_CAP
        }
    }
    fn spawn_spy(&mut self, x: f32, floor: u8, dir: i8) {
        self.spies.push(Spy {
            x,
            floor,
            dir,
            st: SpyState::Walk,
            age: 0,
            cd: 0,
            walk_t: 30,
            goal: None,
            last_volley: 0,
            anim: 0,
        });
    }
}

// ====================== spies, bullets, lights, items ======================
impl Mall {
    pub fn spy_speed(&self, loop_n: u32) -> f32 {
        let mut s = 0.6 * (1.0 + 0.10 * (loop_n as f32 - 1.0)).min(1.6);
        if self.alarm {
            s *= 1.25;
        }
        s
    }
    pub fn spy_shot_interval(&self, loop_n: u32) -> i32 {
        let mut i = 150.0 / (1.0 + 0.15 * (loop_n as f32 - 1.0)).min(2.2);
        if self.alarm {
            i *= 0.85;
        }
        (i as i32).max(60)
    }
    pub fn spawn_interval(&self, loop_n: u32, bf: bool) -> i32 {
        let mut i = 360.0 / (1.0 + 0.15 * (loop_n as f32 - 1.0)).min(2.2);
        if self.alarm {
            i /= 1.6;
        }
        if bf {
            i /= 2.0;
        }
        i as i32
    }

    fn update_spies(&mut self, ctx: &mut Ctx) {
        let mut spies = std::mem::take(&mut self.spies);
        let pf = self.player_floor();
        let px = self.p.x;
        let visible = self.visible();
        let speed = self.spy_speed(ctx.loop_n);
        let interval = self.spy_shot_interval(ctx.loop_n);
        let bullet_v = SPY_BULLET_SPEED * if self.alarm { 1.25 } else { 1.0 };
        for s in spies.iter_mut() {
            s.anim += 1;
            s.age += 1;
            if s.cd > 0 {
                s.cd -= 1;
            }
            match s.st {
                SpyState::Dying(t) => {
                    s.st = SpyState::Dying(t - 1);
                    continue;
                }
                SpyState::Duck(t) => {
                    s.st = if t <= 1 { SpyState::Walk } else { SpyState::Duck(t - 1) };
                    continue;
                }
                _ => {}
            }
            // fall into a pit that opened under us
            if self.pit_at(s.floor, s.x).is_some() {
                s.st = SpyState::Dying(0);
                continue;
            }
            // dodge decision: once per volley
            for b in self.bullets.iter().filter(|b| !b.hostile) {
                let toward = (s.x - b.x) * b.vx > 0.0;
                if toward && (s.x - b.x).abs() < 56.0 && (b.y - floor_y(s.floor) as f32).abs() < 30.0 && s.last_volley != b.volley {
                    s.last_volley = b.volley;
                    if ctx.rng.chance(10) {
                        s.st = SpyState::Duck(30);
                    }
                }
            }
            if matches!(s.st, SpyState::Duck(_)) {
                continue;
            }
            let dx = px - s.x;
            let sees = visible && s.floor == pf && dx.abs() <= 160.0;
            match s.st {
                SpyState::Aim(t, high) => {
                    if sees {
                        s.dir = if dx >= 0.0 { 1 } else { -1 };
                    }
                    if t <= 1 {
                        let y = floor_y(s.floor) as f32 - if high { 18.0 } else { 6.0 };
                        self.bullets.push(Bullet {
                            x: s.x + s.dir as f32 * 8.0,
                            y,
                            vx: s.dir as f32 * bullet_v,
                            vy: 0.0,
                            floor: s.floor,
                            hostile: true,
                            volley: 0,
                        });
                        self.ev.push(Ev::Sfx(Sfx::EnemyShot));
                        s.cd = interval;
                        s.st = SpyState::Walk;
                    } else {
                        s.st = SpyState::Aim(t - 1, high);
                    }
                    continue;
                }
                SpyState::Wait(t) => {
                    if sees {
                        s.st = SpyState::Walk;
                    } else {
                        s.st = if t <= 1 { SpyState::Walk } else { SpyState::Wait(t - 1) };
                        continue;
                    }
                }
                _ => {}
            }
            let mut want: f32 = 0.0;
            if sees {
                s.dir = if dx >= 0.0 { 1 } else { -1 };
                if dx.abs() > 40.0 {
                    want = s.dir as f32;
                }
                if s.age >= SPY_FIRST_SHOT && s.cd <= 0 && dx.abs() <= 150.0 && dx.abs() > 20.0 {
                    s.st = SpyState::Aim(SPY_TELEGRAPH, ctx.rng.chance(50));
                    continue;
                }
                s.goal = None;
            } else {
                if let Some(g) = s.goal {
                    if (g - s.x).abs() < 2.0 {
                        s.goal = None;
                        s.st = SpyState::Wait(ctx.rng.range(120, 300));
                        continue;
                    }
                    s.dir = if g > s.x { 1 } else { -1 };
                    want = s.dir as f32;
                } else {
                    s.walk_t -= 1;
                    if s.walk_t <= 0 {
                        s.walk_t = ctx.rng.range(60, 180);
                        s.dir = if ctx.rng.chance(50) { 1 } else { -1 };
                        if ctx.rng.chance(15) {
                            // deliberately go and wait in a shaft opening
                            let opts: Vec<f32> = (0..3)
                                .filter(|i| matches!(self.cars[*i].opening(s.floor), Opening::Grate | Opening::CarHere))
                                .map(|i| SHAFTS[i].cx() as f32)
                                .collect();
                            if !opts.is_empty() {
                                s.goal = Some(*ctx.rng.pick(&opts));
                            }
                        }
                    }
                    want = if s.walk_t % 90 < 70 { s.dir as f32 } else { 0.0 };
                }
            }
            if want != 0.0 {
                let nx = s.x + want * speed;
                let blocked_pit = self.pit_at(s.floor, nx).is_some();
                if blocked_pit || nx < (WALL_L + 8) as f32 || nx > (WALL_R - 8) as f32 {
                    s.dir = -s.dir;
                    s.goal = None;
                } else {
                    s.x = nx;
                }
            }
        }
        self.spies = spies;
        self.spies.retain(|s| !matches!(s.st, SpyState::Dying(t) if t <= 0 && false) && !matches!(s.st, SpyState::Dying(t) if t < -1));
    }

    pub fn kill_spy(&mut self, idx: usize, pts: i32, ctx: &mut Ctx) {
        let (x, floor) = (self.spies[idx].x, self.spies[idx].floor);
        self.spies[idx].st = SpyState::Dying(SPY_DEATH);
        self.stat_kills += 1;
        self.ev.push(Ev::Sfx(Sfx::Hurt));
        self.score(pts, x, floor_y(floor) as f32 - 28.0);
        if ctx.rng.chance(35) {
            let w = *ctx.rng.pick(&copy::LAST_WORDS);
            self.say(x, floor, w);
        }
        if ctx.rng.chance(5) {
            let kind = PowerKind::random_drop(ctx.rng);
            self.pickups.push(Pickup { x, floor, kind, ttl: 900 });
        }
    }

    fn update_bullets(&mut self, ctx: &mut Ctx) {
        let mut bullets = std::mem::take(&mut self.bullets);
        let mut keep = Vec::with_capacity(bullets.len());
        'b: for mut b in bullets.drain(..) {
            b.x += b.vx;
            b.y += b.vy;
            if b.x < 0.0 || b.x > WORLD_W as f32 || b.y < 0.0 || b.y > WORLD_H as f32 {
                continue;
            }
            let fy = floor_y(floor_from_y(b.y + 10.0)) as f32;
            let _ = fy;
            let ffy = floor_y(b.floor) as f32;
            let in_body = |x: f32, half: f32, bx: f32, by: f32, top: f32, bot: f32| (bx - x).abs() <= half && by >= top && by <= bot;
            // mall cop: helmet pings
            if !b.hostile && self.cop.floor == b.floor && in_body(self.cop.x, 9.0, b.x, b.y, ffy - 24.0, ffy) {
                self.ev.push(Ev::Sfx(Sfx::HelmetPing));
                self.ping.push((b.x, b.y, 12));
                continue;
            }
            // mall walkers block bullets from both sides
            if b.floor == WALKER_FLOOR {
                for wi in 0..2 {
                    if in_body(self.walkers[wi].x, 7.0, b.x, b.y, ffy - 24.0, ffy) {
                        if !b.hostile {
                            self.walkers[wi].hey = 60;
                            let wx = self.walkers[wi].x;
                            self.score(-200, wx, ffy - 30.0);
                            self.say(wx, b.floor, copy::HEY);
                        }
                        continue 'b;
                    }
                }
            }
            if b.hostile {
                if self.visible() {
                    let (y0, y1) = self.player_y_range();
                    if (b.x - self.p.x).abs() <= HALF_W + 1.0 && b.y >= y0 && b.y <= y1 {
                        self.hurt_player(Cause::Bullet, ctx);
                        continue;
                    }
                }
                keep.push(b);
                continue;
            }
            // player bullet vs spies
            for si in 0..self.spies.len() {
                let s = &self.spies[si];
                if matches!(s.st, SpyState::Dying(_)) {
                    continue;
                }
                let sfy = floor_y(s.floor) as f32;
                let h = if matches!(s.st, SpyState::Duck(_)) { 12.0 } else { 24.0 };
                if in_body(s.x, 6.0, b.x, b.y, sfy - h, sfy) {
                    self.kill_spy(si, 100, ctx);
                    continue 'b;
                }
            }
            // lamps
            for li in 0..self.lamps.len() {
                let l = &self.lamps[li];
                if l.st == LampState::Hang && l.floor == b.floor && in_body(l.x, 6.0, b.x, b.y, ffy - 40.0, ffy - 14.0) {
                    let dir = if b.vx >= 0.0 { 1 } else { -1 };
                    self.lamps[li].st = LampState::Fall { y: ffy - 30.0, vy: 0.0, dir };
                    self.ev.push(Ev::Sfx(Sfx::LampFall));
                    continue 'b;
                }
            }
            // fountains
            for fi in 0..self.fountains.len() {
                let f = &self.fountains[fi];
                if f.floor == b.floor && f.cd == 0 && in_body(f.x, 16.0, b.x, b.y, ffy - 24.0, ffy) {
                    self.spray(fi, ctx);
                    continue 'b;
                }
            }
            keep.push(b);
        }
        self.bullets = keep;
    }

    fn spray(&mut self, fi: usize, ctx: &mut Ctx) {
        let (floor, x) = (self.fountains[fi].floor, self.fountains[fi].x);
        self.fountains[fi].cd = 900;
        let n = ctx.rng.range(3, 6);
        let gold = ctx.rng.range(0, 20) == 0;
        for k in 0..n {
            self.coins.push(Coin {
                x,
                y: floor_y(floor) as f32 - 20.0,
                vx: (ctx.rng.float() - 0.5) * 2.4,
                vy: -3.0 - ctx.rng.float(),
                gold: gold && k == 0,
                floor,
                bounces: 0,
                ttl: 600,
            });
        }
        self.ev.push(Ev::Sfx(Sfx::Coins));
    }

    fn update_lights(&mut self, ctx: &mut Ctx) {
        let (px, feet) = (self.p.x, self.feet_y());
        for li in 0..self.lamps.len() {
            let (floor, x, disco) = (self.lamps[li].floor, self.lamps[li].x, self.lamps[li].disco);
            let fy = floor_y(floor) as f32;
            match self.lamps[li].st {
                LampState::Fall { y, vy, dir } => {
                    let vy = vy + 0.35;
                    let y = y + vy;
                    // kills whatever is underneath
                    for si in 0..self.spies.len() {
                        let s = &self.spies[si];
                        if s.floor == floor && !matches!(s.st, SpyState::Dying(_)) && (s.x - x).abs() <= 9.0 && y >= fy - 30.0 {
                            self.kill_spy(si, 300, ctx);
                        }
                    }
                    if self.visible() && (px - x).abs() <= 9.0 && y >= feet - 24.0 && feet <= fy + 1.0 && feet >= fy - 40.0 && self.player_floor() == floor {
                        self.hurt_player(Cause::Lamp, ctx);
                    }
                    if y >= fy - 2.0 {
                        self.ev.push(Ev::Sfx(Sfx::Glass));
                        self.shake = 8;
                        self.dark.push(Dark { floor, x0: x - 48.0, x1: x + 48.0, t: 120 });
                        self.lamps[li].st = if disco { LampState::Roll { dir } } else { LampState::Wreck(1) };
                        if disco {
                            self.ev.push(Ev::Sfx(Sfx::Roll));
                        }
                    } else {
                        self.lamps[li].st = LampState::Fall { y, vy, dir };
                    }
                }
                LampState::Roll { dir } => {
                    let nx = x + dir as f32 * 2.0;
                    self.lamps[li].x = nx;
                    for si in 0..self.spies.len() {
                        let s = &self.spies[si];
                        if s.floor == floor && !matches!(s.st, SpyState::Dying(_)) && (s.x - nx).abs() <= 9.0 {
                            self.kill_spy(si, 300, ctx);
                        }
                    }
                    if self.visible() && (px - nx).abs() <= 9.0 && self.player_floor() == floor && feet >= fy - 8.0 {
                        self.hurt_player(Cause::Lamp, ctx);
                    }
                    let ahead = nx + dir as f32 * 8.0;
                    if nx <= (WALL_L + 6) as f32 || nx >= (WALL_R - 6) as f32 || self.pit_at(floor, ahead).is_some() {
                        self.lamps[li].st = LampState::Wreck(1);
                        self.ev.push(Ev::Sfx(Sfx::Glass));
                    }
                }
                _ => {}
            }
        }
    }

    fn update_items(&mut self) {
        let (px, feet) = (self.p.x, self.feet_y());
        let alive = !matches!(self.p.st, PState::Dying(_));
        let mut coins = std::mem::take(&mut self.coins);
        let mut got = vec![];
        coins.retain_mut(|c| {
            c.ttl -= 1;
            c.vy += 0.2;
            c.x += c.vx;
            c.y += c.vy;
            let fy = floor_y(c.floor) as f32 - 3.0;
            if c.y >= fy {
                c.y = fy;
                if c.bounces < 2 {
                    c.vy = -c.vy * 0.5;
                    c.bounces += 1;
                } else {
                    c.vy = 0.0;
                    c.vx = 0.0;
                }
            }
            if alive && (c.x - px).abs() <= 9.0 && (c.y - (feet - 10.0)).abs() <= 16.0 {
                got.push(c.gold);
                return false;
            }
            c.ttl > 0
        });
        self.coins = coins;
        for gold in got {
            if gold {
                self.ev.push(Ev::ExtraLife);
                self.popup(px, feet - 30.0, "1UP".to_string());
                self.ev.push(Ev::Sfx(Sfx::PowerUp));
            } else {
                self.score(50, px, feet - 30.0);
                self.ev.push(Ev::Sfx(Sfx::Coins));
            }
        }
        let mut pk = std::mem::take(&mut self.pickups);
        let pf = self.player_floor();
        pk.retain_mut(|p| {
            p.ttl -= 1;
            if alive && p.floor == pf && (p.x - px).abs() <= 9.0 && matches!(self.p.st, PState::Walk) {
                self.ev.push(Ev::Power(p.kind));
                self.ev.push(Ev::Sfx(Sfx::PowerUp));
                self.popup(px, feet - 30.0, p.kind.name().to_string());
                self.ev.push(Ev::Score(50));
                return false;
            }
            p.ttl > 0
        });
        self.pickups = pk;
    }

    fn check_hazards(&mut self, ctx: &mut Ctx) {
        // elevator crushes
        let pf = self.player_floor();
        for i in 0..3 {
            let s = SHAFTS[i];
            let crush_walk = {
                let car = &self.cars[i];
                matches!(self.p.st, PState::Walk)
                    && self.p.floor == pf
                    && car.crushes_grate(pf)
                    && self.p.x >= (s.x + 2) as f32
                    && self.p.x <= (s.x + SHAFT_W - 2) as f32
                    && !(self.p.pickup == Some(i) && car.called)
            };
            if crush_walk {
                self.kill_player(Cause::Crush);
            }
            if matches!(self.p.st, PState::Roof(j) if j == i) && self.cars[i].crushes_roof_rider() {
                self.kill_player(Cause::Crush);
            }
            for si in 0..self.spies.len() {
                let sp = &self.spies[si];
                if !matches!(sp.st, SpyState::Dying(_))
                    && self.cars[i].crushes_grate(sp.floor)
                    && sp.x >= (s.x + 2) as f32
                    && sp.x <= (s.x + SHAFT_W - 2) as f32
                {
                    self.kill_spy(si, 300, ctx);
                    self.shake = 8;
                    self.ev.push(Ev::Sfx(Sfx::Crush));
                }
            }
        }
        // spies touching the player
        if self.visible() {
            let (y0, y1) = self.player_y_range();
            for si in 0..self.spies.len() {
                let s = &self.spies[si];
                if matches!(s.st, SpyState::Dying(_)) || s.floor != pf {
                    continue;
                }
                let sfy = floor_y(s.floor) as f32;
                if (s.x - self.p.x).abs() < 10.0 && y1 > sfy - 24.0 && y0 < sfy {
                    let slide_kick = self.p.kick && self.p.slide != 0;
                    if slide_kick {
                        self.kill_spy(si, 300, ctx);
                    } else if self.p.kick || ctx.powers.invincible() {
                        self.kill_spy(si, 100, ctx);
                    } else {
                        self.hurt_player(Cause::Touch, ctx);
                    }
                }
            }
        }
    }

    fn update_spawns(&mut self, ctx: &mut Ctx) {
        if !self.control || !matches!(self.p.st, PState::Walk | PState::Inside(_) | PState::Roof(_) | PState::Esc { .. }) {
            return;
        }
        self.spawn_timer -= 1;
        if self.spawn_timer > 0 {
            return;
        }
        self.spawn_timer = self.spawn_interval(ctx.loop_n, ctx.bf) + ctx.rng.range(0, 60);
        if self.live_spies() >= self.spy_cap(ctx) {
            return;
        }
        let pf = self.player_floor() as i32;
        let px = self.p.x as i32;
        let cands: Vec<&StoreSlot> = STORE_SLOTS
            .iter()
            .filter(|s| {
                let d = (s.door_x() - px).abs();
                (s.floor as i32 - pf).abs() <= 1
                    && (64..=200).contains(&d)
                    && ctx.stores.iter().any(|st| st.id == s.id && st.open_for_entry())
            })
            .collect();
        if cands.is_empty() {
            return;
        }
        let slot = **ctx.rng.pick(&cands);
        let dir = if self.p.x >= slot.door_x() as f32 { 1 } else { -1 };
        self.spawn_spy(slot.door_x() as f32, slot.floor, dir);
        self.ev.push(Ev::Sfx(Sfx::Door));
    }
}
