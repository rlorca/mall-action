//! Mall spies: spawning, wandering, aiming, dodging, dying. Port of `game/mall/spies.ts`.
//!
//! Spies are addressed by their index in `MallWorld::spies` while a frame is being processed (indices are stable
//! within one function unless it removes entries; see `step_spies`).

use super::geometry::{fy, nearest_floor, opening_state};
use super::types::*;
use super::world::MallWorld;
use crate::audio_ids::SfxId;
use crate::content::copy::{ELEVATOR_EXIT_LINES, LAST_WORDS};
use crate::content::layout::SHAFTS;
use crate::content::powerups::{PowerId, FOOD_POWERS, NON_FOOD_POWERS};
use crate::content::stores::{StoreDef, DOOR_W, DOOR_X, STORES};
use crate::engine::num::round_i;
use crate::game::levelstate::can_enter_store;
use crate::game::run::Run;

pub use crate::game::run::POINTS;

/// First shot no sooner than ~2 s after a spy appears.
pub const FIRST_SHOT_DELAY: i32 = 120;
/// The aiming pose (telegraph) lasts about half a second.
pub const AIM_FRAMES: i32 = 30;
/// Chance a spy ducks an incoming volley (decided once per volley).
pub const DODGE_CHANCE: f64 = 0.1;
pub const SIGHT_RANGE: f64 = 160.0;
pub const STOP_DISTANCE: f64 = 40.0;
pub const EMERGE_FRAMES: i32 = 24;
pub const DEATH_ANIM_FRAMES: i32 = 24; // ~0.4 s
const DUCK_FRAMES: i32 = 26;
const VOLLEY_WINDOW: i32 = 45;
const LAST_WORDS_CHANCE: f64 = 0.35;
const DROP_CHANCE: f64 = 0.05;
const CAR_SPAWN_CHANCE: f64 = 0.25;
const WAIT_CHANCE: f64 = 0.12;

pub fn new_spy(w: &mut MallWorld, x: f64, floor: i32, mode: SpyMode, from: Option<&StoreDef>) -> Spy {
    let id = w.next_spy_id;
    w.next_spy_id += 1;
    let rng = &mut w.spy_rng;
    let face = if rng.chance(0.5) { 1 } else { -1 };
    let fire_cd = FIRST_SHOT_DELAY + rng.between(0, 60);
    let aim_high = rng.chance(0.5);
    Spy {
        id,
        x,
        y: fy(floor),
        face,
        floor,
        mode,
        t: 0,
        fire_cd,
        aim_high,
        anim: 0,
        wander_dir: 0,
        wander_t: 0,
        duck_t: 0,
        volley_t: 0,
        emerge_from: from.map(|f| f.id),
        death_t: 0,
        killed_by: None,
        wait_shaft: None,
        age: 0,
    }
}

/// Cars stopping near the player sometimes let a spy out.
pub fn spawn_spy_at_car(w: &mut MallWorld, run: &Run, car_idx: usize, floor: i32) {
    if w.intro.is_some() || !w.player_alive() {
        return;
    }
    if w.live_spies() >= w.diff.spy_cap {
        return;
    }
    if floor < 1 || floor > 5 {
        return;
    }
    let car_id = w.cars[car_idx].id;
    let cx = w.cars[car_idx].def.x + w.cars[car_idx].def.w / 2.0;
    if (cx - w.player.x).abs() > 200.0 || ((floor - w.player_floor()) as f64).abs() > 1.0 {
        return;
    }
    if w.player.mode == PlayerMode::Ride && w.player.car == Some(car_id) {
        return;
    }
    let rate = w.spawn_rate(run);
    if !w.spy_rng.chance(CAR_SPAWN_CHANCE * 2.0f64.min(rate)) {
        return;
    }
    let mut s = new_spy(w, cx, floor, SpyMode::Emerge, None);
    s.face = if w.player.x < cx { -1 } else { 1 };
    let sy = s.y;
    w.spies.push(s);
    let line = *w.spy_rng.pick(ELEVATOR_EXIT_LINES);
    w.say(cx, sy - 28.0, line, 100);
}

fn spawn_from_door(w: &mut MallWorld, run: &Run) {
    let px = w.player.x;
    let pf = w.player_floor();
    let mut cands: Vec<(&'static StoreDef, f64)> = Vec::new();
    for st in STORES.iter() {
        if ((st.floor - pf) as f64).abs() > 1.0 {
            continue;
        }
        if !can_enter_store(&run.level, st.id) {
            continue;
        }
        let x = st.x + DOOR_X + DOOR_W / 2.0;
        let d = (x - px).abs();
        if d >= 64.0 && d <= 200.0 {
            cands.push((st, x));
        }
    }
    if cands.is_empty() {
        return;
    }
    let (st, x) = *w.spy_rng.pick(&cands);
    let mut s = new_spy(w, x, st.floor, SpyMode::Emerge, Some(st));
    s.face = if px < x { -1 } else { 1 };
    w.spies.push(s);
}

/// Spies are hit by bullets inside this box.
pub fn spy_hit_top(s: &Spy) -> f64 {
    s.y - if s.mode == SpyMode::Duck { SPY_H / 2.0 } else { SPY_H }
}

fn player_floor_for_sight(w: &MallWorld) -> Option<i32> {
    let p = &w.player;
    if p.mode == PlayerMode::Ground && p.floor.is_some() {
        return p.floor;
    }
    if p.mode == PlayerMode::Air && p.floor.is_none() {
        let f = nearest_floor(p.y);
        return if (p.y - fy(f)).abs() < 30.0 { Some(f) } else { None };
    }
    None
}

/// Walk toward x; returns true if blocked.
fn walk(w: &mut MallWorld, i: usize, dir: i32, speed: f64, allow_grate: bool) -> bool {
    let (sx, sy) = (w.spies[i].x, w.spies[i].y);
    let nx = w.try_move_x(sx, sy, dir as f64 * speed, true, allow_grate);
    let moved = nx != sx;
    if moved {
        w.spies[i].x = nx;
        w.spies[i].anim += 1;
    }
    !moved
}

/// Find a shaft opening on the spy's floor that is safe to wait in (a car level or above).
fn pick_wait_shaft(w: &mut MallWorld, i: usize) -> Option<(crate::content::layout::ShaftId, f64)> {
    let mut cands: Vec<(crate::content::layout::ShaftId, f64)> = Vec::new();
    let (sfloor, sx) = (w.spies[i].floor, w.spies[i].x);
    for sh in SHAFTS.iter() {
        if sfloor < sh.top || sfloor > sh.bottom {
            continue;
        }
        let st = opening_state(w.car(sh.id), sfloor);
        if st != OpeningState::Here && st != OpeningState::Above {
            continue;
        }
        let cx = sh.x + sh.w / 2.0;
        if (cx - sx).abs() < 140.0 {
            cands.push((sh.id, cx));
        }
    }
    if cands.is_empty() {
        None
    } else {
        Some(*w.spy_rng.pick(&cands))
    }
}

pub fn step_spies(w: &mut MallWorld, run: &mut Run) {
    let speed = w.spy_speed(run);
    let p_floor = player_floor_for_sight(w);
    let visible = w.player_visible() && w.player_alive();

    // ---- spawning
    if w.intro.is_none() && w.frame >= w.next_spy && visible && w.frame - w.control_frame >= 300 {
        if w.live_spies() < w.diff.spy_cap {
            spawn_from_door(w, run);
        }
        let base = 270;
        let between = w.spy_rng.between(-60, 60);
        let rate = w.spawn_rate(run);
        w.next_spy = w.frame + 60.max(round_i((base + between) as f64 / rate));
    }

    let mut i = w.spies.len();
    while i > 0 {
        i -= 1;
        w.spies[i].t += 1;
        w.spies[i].age += 1;

        // despawn when far away
        {
            let s = &w.spies[i];
            if s.mode != SpyMode::Dying && (((s.floor - w.player_floor()) as f64).abs() >= 2.0 || (s.x - w.player.x).abs() > 420.0) {
                w.spies.remove(i);
                continue;
            }
        }

        if w.spies[i].mode == SpyMode::Dying {
            w.spies[i].death_t += 1;
            let (dt, kb, sx, sy) = (w.spies[i].death_t, w.spies[i].killed_by, w.spies[i].x, w.spies[i].y);
            if dt == 1 && kb != Some(KilledBy::Crush) {
                // last words (about 35% of kills) and the occasional drop
                if w.spy_rng.chance(LAST_WORDS_CHANCE) {
                    let line = *w.spy_rng.pick(LAST_WORDS);
                    w.say(sx, sy - 28.0, line, 90);
                }
                if w.spy_rng.chance(DROP_CHANCE) {
                    drop_powerup(w, sx, sy);
                }
            }
            if dt >= DEATH_ANIM_FRAMES {
                w.spies.remove(i);
            }
            continue;
        }

        // Left standing over a pit (the car was called away): he falls out of the picture.
        if w.spies[i].mode != SpyMode::Emerge {
            let mut fell = false;
            for sh in SHAFTS.iter() {
                let s = &w.spies[i];
                if s.floor < sh.top || s.floor > sh.bottom {
                    continue;
                }
                if s.x > sh.x + 4.0 && s.x < sh.x + sh.w - 4.0 && opening_state(w.car(sh.id), s.floor) == OpeningState::Pit {
                    fell = true;
                    break;
                }
            }
            if fell {
                w.spies.remove(i);
                continue;
            }
        }

        if w.spies[i].mode == SpyMode::Emerge {
            if w.spies[i].t >= EMERGE_FRAMES {
                w.spies[i].mode = SpyMode::Walk;
                w.spies[i].t = 0;
            }
            continue;
        }

        if w.spies[i].duck_t > 0 {
            w.spies[i].duck_t -= 1;
            if w.spies[i].duck_t == 0 && w.spies[i].mode == SpyMode::Duck {
                w.spies[i].mode = SpyMode::Walk;
            }
        }
        if w.spies[i].volley_t > 0 {
            w.spies[i].volley_t -= 1;
        }
        if w.spies[i].fire_cd > 0 {
            w.spies[i].fire_cd -= 1;
        }

        let dx = w.player.x - w.spies[i].x;
        let sees = visible && p_floor == Some(w.spies[i].floor) && dx.abs() <= SIGHT_RANGE;

        // ---- dodge: roll once per incoming volley
        maybe_dodge(w, i);

        // ---- touching the agent
        {
            let s = &w.spies[i];
            let p = &w.player;
            if visible
                && s.mode != SpyMode::Duck
                && (p.x - s.x).abs() < SPY_HALF_W + PLAYER_HALF_W
                && p.y - PLAYER_H < s.y
                && p.y > s.y - SPY_H
            {
                if p.kick && p.mode == PlayerMode::Air {
                    w.kill_spy(run, i, KilledBy::Kick);
                    continue;
                }
                if p.kick && p.slide != 0 {
                    w.kill_spy(run, i, KilledBy::Slide); // a jump-kick landing on a wet patch keeps kicking while sliding
                    continue;
                }
                if run.invincible() {
                    w.kill_spy(run, i, KilledBy::Cinna);
                    continue;
                }
                if p.invuln == 0 {
                    w.hurt_player(run, DeathCause::Touch, true);
                }
            }
        }

        match w.spies[i].mode {
            SpyMode::Aim => {
                // telegraph: stand still, face the agent, then fire
                if visible {
                    w.spies[i].face = if dx < 0.0 { -1 } else { 1 };
                }
                if w.spies[i].t >= AIM_FRAMES {
                    fire(w, run, i);
                    w.spies[i].mode = SpyMode::Walk;
                    w.spies[i].t = 0;
                    let r = w.spy_rng.range(0.9, 1.15);
                    w.spies[i].fire_cd = round_i(w.diff.shot_interval as f64 * r);
                }
            }
            SpyMode::Duck => {}
            SpyMode::Wait => {
                let s = &w.spies[i];
                if sees && s.fire_cd <= 0 && s.age > FIRST_SHOT_DELAY {
                    start_aim(w, i);
                } else if s.t > 240 {
                    let s = &mut w.spies[i];
                    s.mode = SpyMode::Walk;
                    s.wait_shaft = None;
                    s.t = 0;
                }
            }
            SpyMode::Walk => {
                if sees {
                    w.spies[i].face = if dx < 0.0 { -1 } else { 1 };
                    if dx.abs() > STOP_DISTANCE {
                        let dir = if dx < 0.0 { -1 } else { 1 };
                        // blocked by a pit / shaft wall: stay put
                        let _ = walk(w, i, dir, speed, false);
                    }
                    if w.spies[i].fire_cd <= 0 && w.spies[i].age > FIRST_SHOT_DELAY {
                        start_aim(w, i);
                    }
                } else {
                    wander(w, i, speed);
                }
            }
            _ => {}
        }
    }
}

fn start_aim(w: &mut MallWorld, i: usize) {
    let high = w.spy_rng.chance(0.5);
    let s = &mut w.spies[i];
    s.mode = SpyMode::Aim;
    s.t = 0;
    s.aim_high = high;
}

fn fire(w: &mut MallWorld, run: &mut Run, i: usize) {
    let s = &w.spies[i];
    let y = s.y - if s.aim_high { 17.0 } else { 5.0 };
    let b = Bullet { x: s.x + s.face as f64 * 9.0, y, vx: s.face as f64 * SPY_BULLET_SPEED, vy: 0.0, owner: BulletOwner::Spy, age: 0 };
    w.bullets.push(b);
    run.sfx(SfxId::EnemyShot);
}

fn wander(w: &mut MallWorld, i: usize, speed: f64) {
    w.spies[i].wander_t -= 1;
    if w.spies[i].wander_t <= 0 {
        w.spies[i].wander_t = w.spy_rng.between(40, 150);
        let r = w.spy_rng.next();
        w.spies[i].wander_dir = if r < 0.4 {
            -1
        } else if r < 0.8 {
            1
        } else {
            0
        };
        // sometimes go and wait in a shaft opening
        if w.spy_rng.chance(WAIT_CHANCE) {
            if let Some(c) = pick_wait_shaft(w, i) {
                w.spies[i].wait_shaft = Some(c.0);
            }
        }
    }
    if let Some(wid) = w.spies[i].wait_shaft {
        let sh = SHAFTS.iter().find(|k| k.id == wid).unwrap();
        let cx = sh.x + sh.w / 2.0;
        let dx = cx - w.spies[i].x;
        if dx.abs() < 2.0 {
            w.spies[i].mode = SpyMode::Wait;
            w.spies[i].t = 0;
            return;
        }
        // Deliberately step onto the grate / into the open car: allowed for this walk only.
        let dir = if dx < 0.0 { -1 } else { 1 };
        w.spies[i].face = dir;
        if walk(w, i, dir, speed, true) {
            w.spies[i].wait_shaft = None;
        }
        return;
    }
    let wd = w.spies[i].wander_dir;
    if wd != 0 {
        w.spies[i].face = wd;
        if walk(w, i, wd, speed * 0.6, false) {
            w.spies[i].wander_dir = -wd;
        }
    }
}

/// A spy ducks an incoming volley with a 10% chance, decided once per volley.
fn maybe_dodge(w: &mut MallWorld, i: usize) {
    let (mode, sx, sy) = (w.spies[i].mode, w.spies[i].x, w.spies[i].y);
    if mode == SpyMode::Aim || mode == SpyMode::Dying || mode == SpyMode::Emerge {
        return;
    }
    for bi in 0..w.bullets.len() {
        let b = w.bullets[bi];
        if b.owner != BulletOwner::Player {
            continue;
        }
        let toward = (sx - b.x) * b.vx > 0.0;
        let d = (sx - b.x).abs();
        if !toward || d > 110.0 {
            continue;
        }
        if b.y < sy - SPY_H || b.y > sy {
            continue;
        }
        if w.spies[i].volley_t <= 0 {
            // a new volley: roll the dice once
            if w.spy_rng.chance(DODGE_CHANCE) {
                w.spies[i].mode = SpyMode::Duck;
                w.spies[i].duck_t = DUCK_FRAMES;
            }
        }
        w.spies[i].volley_t = VOLLEY_WINDOW; // later bullets in the same volley do not re-roll
        return;
    }
}

/// Player bullets vs spies; called by the world each frame (see `MallWorld::step`).
pub fn bullet_hits_spy(w: &mut MallWorld, run: &mut Run) {
    let mut i = w.bullets.len();
    while i > 0 {
        i -= 1;
        let b = w.bullets[i];
        if b.owner != BulletOwner::Player {
            continue;
        }
        for si in 0..w.spies.len() {
            let s = &w.spies[si];
            if s.mode == SpyMode::Dying {
                continue;
            }
            if b.x > s.x - SPY_HALF_W - 1.0 && b.x < s.x + SPY_HALF_W + 1.0 && b.y >= spy_hit_top(s) && b.y <= s.y {
                w.bullets.remove(i);
                w.kill_spy(run, si, KilledBy::Shot);
                break;
            }
        }
    }
}

fn drop_powerup(w: &mut MallWorld, x: f64, y: f64) {
    let food = w.spy_rng.chance(0.5);
    let pool: Vec<PowerId> = if food { FOOD_POWERS.to_vec() } else { NON_FOOD_POWERS.iter().copied().filter(|id| *id != PowerId::Oneup).collect() };
    let power = *w.spy_rng.pick(&pool);
    w.spawn_pickup(Pickup { x, y: y - 14.0, kind: PickupKind::Power, power: Some(power), vx: 0.0, vy: -1.5, on_ground: false, life: 60 * 12 });
}
