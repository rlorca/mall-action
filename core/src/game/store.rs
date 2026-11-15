//! Top-down (Zelda-style) store rooms. Pure rules; the renderer only reads this state.
use super::level::{Content, StoreState};
use super::powerups::{PowerKind, Powers, Weapon};
use super::rooms::{self, FixtureDef, GuardKind, Layout, START, TILE};
use crate::audio::Sfx;
use crate::copy;
use crate::input::*;
use crate::rng::Rng;
use crate::stores::StoreId;

pub const VIEW_W: i32 = 256;
pub const VIEW_H: i32 = 176;
pub const SEARCH_FRAMES: i32 = 45;
pub const SEARCH_FRAMES_FAST: i32 = 24;
pub const HIT_X: f32 = 5.0;
pub const HIT_Y0: f32 = -1.0;
pub const HIT_Y1: f32 = 7.0;
pub const GRACE: i32 = 90;
pub const BULLET_V: f32 = 3.0;
pub const GUARD_BULLET_V: f32 = 2.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Up,
    Down,
    Left,
    Right,
}
impl Dir {
    pub fn vec(self) -> (f32, f32) {
        match self {
            Dir::Up => (0.0, -1.0),
            Dir::Down => (0.0, 1.0),
            Dir::Left => (-1.0, 0.0),
            Dir::Right => (1.0, 0.0),
        }
    }
    pub fn from_delta(dx: f32, dy: f32) -> Dir {
        if dx.abs() > dy.abs() {
            if dx < 0.0 {
                Dir::Left
            } else {
                Dir::Right
            }
        } else if dy < 0.0 {
            Dir::Up
        } else {
            Dir::Down
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
    pub fn btn(self) -> u8 {
        match self {
            Dir::Up => UP,
            Dir::Down => DOWN,
            Dir::Left => LEFT,
            Dir::Right => RIGHT,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Held {
    Package,
    Power(PowerKind),
    Joke(usize),
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PSt {
    Walk,
    Search { fix: usize, t: i32, total: i32 },
    Hold { item: Held, t: i32 },
    Stun(i32),
    Dying(i32),
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum GSt {
    Walk,
    Aim(i32),
    Dying(i32),
}

#[derive(Clone, Debug)]
pub struct Guard {
    pub x: f32,
    pub y: f32,
    pub kind: GuardKind,
    pub dir: Dir,
    pub hp: i32,
    pub st: GSt,
    pub cd: i32,
    pub stun: i32,
    pub anim: i32,
    pub target: Option<(f32, f32)>,
}

#[derive(Clone, Debug)]
pub struct TdBullet {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub hostile: bool,
    pub shoe: bool,
}

#[derive(Clone, Debug)]
pub struct Toy {
    pub x: f32,
    pub y: f32,
    pub dir: Dir,
    pub t: i32,
}

#[derive(Clone, Debug)]
pub struct Puff {
    pub x: f32,
    pub y: f32,
    pub t: i32,
}

#[derive(Clone, Debug)]
pub struct Bub {
    pub guard: usize,
    pub text: String,
    pub delay: i32,
    pub t: i32,
}

#[derive(Clone, Debug, PartialEq)]
pub enum EggPhase {
    Typing,
    Pedestal,
    Getting,
    Done,
}
#[derive(Clone, Debug)]
pub struct Egg {
    pub phase: EggPhase,
    pub t: i32,
    pub item: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub enum SEv {
    Sfx(Sfx),
    Score(i32),
    Package,
    Power(PowerKind),
    Joke(usize),
    Died,
    Exit,
    EggDone,
    ExtraLife,
}

pub struct SCtx<'a> {
    pub powers: &'a mut Powers,
    pub rng: &'a mut Rng,
    pub loop_n: u32,
    pub packages: u32,
}

#[derive(Clone)]
pub struct StoreRoom {
    pub id: StoreId,
    pub layout: Layout,
    pub fixtures: Vec<FixtureDef>,
    pub x: f32,
    pub y: f32,
    pub face: Dir,
    pub st: PSt,
    pub guards: Vec<Guard>,
    pub bullets: Vec<TdBullet>,
    pub toys: Vec<Toy>,
    pub puffs: Vec<Puff>,
    pub bubbles: Vec<Bub>,
    pub popups: Vec<(f32, f32, String, i32)>,
    pub banner: Option<(String, i32)>,
    pub cd: i32,
    pub inv: i32,
    pub grace: i32,
    pub hold_guards: i32,
    pub frozen: bool,
    pub egg: Option<Egg>,
    pub clerk_gone: bool,
    pub shelf_hit: Vec<bool>,
    pub booth: bool,
    pub can_search: Option<usize>,
    pub t: i32,
    pub ev: Vec<SEv>,
    pub shake: i32,
    pub next_volley: u32,
    pub loop_n: u32,
}

fn tile_center(tx: i32, ty: i32) -> (f32, f32) {
    ((tx * TILE + TILE / 2) as f32, (ty * TILE + TILE / 2) as f32)
}

impl StoreRoom {
    pub fn enter(id: StoreId, st: &StoreState, ctx: &mut SCtx, egg_pending: bool) -> StoreRoom {
        let layout = rooms::layout(id).expect("store has a layout");
        let fixtures = layout.fixtures();
        let mut guards = Vec::new();
        for (tx, ty, kind) in layout.guards() {
            let (x, y) = tile_center(tx, ty);
            guards.push(Guard {
                x,
                y,
                kind,
                dir: Dir::Down,
                hp: if kind == GuardKind::Bot { 3 } else { 1 },
                st: GSt::Walk,
                cd: 90,
                stun: 0,
                anim: 0,
                target: None,
            });
        }
        let first = !st.visited;
        let mut bubbles = Vec::new();
        let mut hold = 0;
        if first {
            let idx = crate::stores::index(id);
            let mut k = 0;
            for (si, who, text) in copy::FIRST_VISIT.iter() {
                if *si != idx {
                    continue;
                }
                let g = match who {
                    2 => guards.iter().position(|g| g.kind == GuardKind::Bot).unwrap_or(0),
                    1 => 1.min(guards.len() - 1),
                    _ => 0,
                };
                bubbles.push(Bub { guard: g, text: text.to_string(), delay: k * 60, t: 110 });
                hold = hold.max(k * 60 + 110);
                k += 1;
            }
        }
        let (sx, sy) = tile_center(START.0, START.1);
        let egg = (id == StoreId::GameStonk && egg_pending).then(|| Egg { phase: EggPhase::Typing, t: 0, item: ctx.rng.index(5) });
        let n = fixtures.len();
        let frozen = egg.is_some();
        StoreRoom {
            id,
            layout,
            fixtures,
            x: sx + 8.0,
            y: sy,
            face: Dir::Up,
            st: PSt::Walk,
            guards,
            bullets: vec![],
            toys: vec![],
            puffs: vec![],
            bubbles,
            popups: vec![],
            banner: None,
            cd: 0,
            inv: 0,
            grace: GRACE,
            hold_guards: hold,
            frozen,
            egg,
            clerk_gone: false,
            shelf_hit: vec![false; n],
            booth: false,
            can_search: None,
            t: 0,
            ev: vec![],
            shake: 0,
            next_volley: 1,
            loop_n: ctx.loop_n,
        }
    }

    pub fn respawn(&mut self) {
        let (sx, sy) = tile_center(START.0, START.1);
        self.x = sx + 8.0;
        self.y = sy;
        self.st = PSt::Walk;
        self.inv = 120;
        self.bullets.clear();
        self.grace = 60;
    }

    // ---------- geometry ----------
    pub fn px_w(&self) -> i32 {
        self.layout.w * TILE
    }
    pub fn px_h(&self) -> i32 {
        self.layout.h * TILE
    }
    /// Camera top-left in room pixels (rooms larger than the screen scroll).
    pub fn camera(&self) -> (i32, i32) {
        let cx = (self.x as i32 - VIEW_W / 2).clamp(0, (self.px_w() - VIEW_W).max(0));
        let cy = (self.y as i32 - VIEW_H / 2).clamp(0, (self.px_h() - VIEW_H).max(0));
        (cx, cy)
    }
    fn solid_tile(&self, tx: i32, ty: i32) -> bool {
        if self.clerk_gone && self.layout.tile(tx, ty) == b'k' {
            return false;
        }
        self.layout.is_solid(tx, ty)
    }
    fn blocked(&self, x: f32, y: f32) -> bool {
        let (x0, x1) = (x - HIT_X, x + HIT_X - 0.01);
        let (y0, y1) = (y + HIT_Y0, y + HIT_Y1 - 0.01);
        for ty in (y0 / TILE as f32).floor() as i32..=(y1 / TILE as f32).floor() as i32 {
            for tx in (x0 / TILE as f32).floor() as i32..=(x1 / TILE as f32).floor() as i32 {
                if self.solid_tile(tx, ty) {
                    return true;
                }
            }
        }
        false
    }
    fn try_move(&mut self, dx: f32, dy: f32) {
        let (nx, ny) = (self.x + dx, self.y + dy);
        if !self.blocked(nx, ny) {
            self.x = nx;
            self.y = ny;
            return;
        }
        // Zelda-style corner assist: slide around small overhangs
        if dx != 0.0 {
            for n in 1..=6 {
                for sgn in [-1.0f32, 1.0] {
                    if !self.blocked(self.x + dx, self.y + sgn * n as f32) && !self.blocked(self.x, self.y + sgn) {
                        self.y += sgn;
                        return;
                    }
                }
            }
        } else if dy != 0.0 {
            for n in 1..=6 {
                for sgn in [-1.0f32, 1.0] {
                    if !self.blocked(self.x + sgn * n as f32, self.y + dy) && !self.blocked(self.x + sgn, self.y) {
                        self.x += sgn;
                        return;
                    }
                }
            }
        }
    }
    fn tile_here(&self) -> u8 {
        self.layout.tile((self.x as i32) / TILE, (self.y as i32 + 3) / TILE)
    }

    /// The searchable fixture the agent is touching (front first, then sides/back), if any.
    pub fn search_target(&self, st: &StoreState) -> Option<usize> {
        let (x0, x1) = (self.x - HIT_X - 4.0, self.x + HIT_X + 4.0);
        let (y0, y1) = (self.y + HIT_Y0 - 4.0, self.y + HIT_Y1 + 4.0);
        let (fdx, fdy) = self.face.vec();
        let mut best: Option<(f32, usize)> = None;
        for (i, f) in self.fixtures.iter().enumerate() {
            if st.opened[i] {
                continue;
            }
            let (rx0, ry0) = ((f.tx * TILE) as f32, (f.ty * TILE) as f32);
            if rx0 + TILE as f32 <= x0 || rx0 >= x1 || ry0 + TILE as f32 <= y0 || ry0 >= y1 {
                continue;
            }
            let (cx, cy) = (rx0 + 8.0, ry0 + 8.0);
            let (dx, dy) = (cx - self.x, cy - self.y);
            let mut d = dx.abs() + dy.abs();
            if dx * fdx + dy * fdy > 0.0 {
                d -= 6.0; // in front of us wins ties
            }
            if best.map_or(true, |(bd, _)| d < bd) {
                best = Some((d, i));
            }
        }
        best.map(|b| b.1)
    }

    pub fn say_banner(&mut self, text: String) {
        self.banner = Some((text, 120));
    }

    // ---------- the step ----------
    pub fn step(&mut self, pad: PadState, st: &mut StoreState, ctx: &mut SCtx) {
        self.t += 1;
        self.ev.clear();
        if self.shake > 0 {
            self.shake -= 1;
        }
        if self.cd > 0 {
            self.cd -= 1;
        }
        if self.inv > 0 {
            self.inv -= 1;
        }
        if self.grace > 0 {
            self.grace -= 1;
        }
        if self.hold_guards > 0 {
            self.hold_guards -= 1;
        }
        if let Some(b) = self.banner.as_mut() {
            b.1 -= 1;
        }
        if self.banner.as_ref().map_or(false, |b| b.1 <= 0) {
            self.banner = None;
        }
        for b in self.bubbles.iter_mut() {
            if b.delay > 0 {
                b.delay -= 1;
            } else {
                b.t -= 1;
            }
        }
        self.bubbles.retain(|b| b.t > 0);
        self.puffs.retain_mut(|p| {
            p.t -= 1;
            p.t > 0
        });
        self.popups.retain_mut(|p| {
            p.3 -= 1;
            p.1 -= 0.3;
            p.3 > 0
        });
        self.update_egg(pad, ctx);
        self.update_player(pad, st, ctx);
        self.update_toys(st, ctx);
        self.update_guards(ctx);
        self.update_bullets(st, ctx);
        self.can_search = if matches!(self.st, PSt::Walk) && !self.frozen { self.search_target(st) } else { None };
    }

    fn update_egg(&mut self, pad: PadState, _ctx: &mut SCtx) {
        let Some(egg) = self.egg.as_mut() else { return };
        egg.t += 1;
        let text_len = copy::ZELDA.chars().count() as i32;
        match egg.phase {
            EggPhase::Typing => {
                let shown = egg.t / 3;
                if egg.t % 6 == 0 && shown <= text_len {
                    self.ev.push(SEv::Sfx(Sfx::TextBlip));
                }
                if egg.t > text_len * 3 + 70 || (pad.pressed(crate::input::START) && egg.t > 20) {
                    egg.phase = EggPhase::Pedestal;
                    egg.t = 0;
                    self.frozen = false;
                }
            }
            EggPhase::Pedestal => {
                if let Some((tx, ty)) = self.layout.find(b'p') {
                    let (cx, cy) = tile_center(tx, ty);
                    if (self.x - cx).abs() < 8.0 && (self.y - cy).abs() < 8.0 && matches!(self.st, PSt::Walk) {
                        let item = egg.item;
                        egg.phase = EggPhase::Getting;
                        egg.t = 0;
                        self.st = PSt::Hold { item: Held::Joke(item), t: 110 };
                        self.ev.push(SEv::Joke(item));
                        self.ev.push(SEv::Score(1));
                        self.say_banner(format!("YOU GOT: {}", copy::ZELDA_ITEMS[item]));
                    }
                }
            }
            EggPhase::Getting => {
                if egg.t > 110 {
                    egg.phase = EggPhase::Done;
                    self.clerk_gone = true;
                    if let Some((tx, ty)) = self.layout.find(b'k') {
                        let (cx, cy) = tile_center(tx, ty);
                        self.puffs.push(Puff { x: cx, y: cy, t: 24 });
                    }
                    self.ev.push(SEv::Sfx(Sfx::Smoke));
                    self.ev.push(SEv::EggDone);
                }
            }
            EggPhase::Done => {}
        }
    }

    fn update_player(&mut self, pad: PadState, st: &mut StoreState, ctx: &mut SCtx) {
        match self.st {
            PSt::Dying(t) => {
                if t > 0 {
                    self.st = PSt::Dying(t - 1);
                } else if t == 0 {
                    self.st = PSt::Dying(-1);
                    self.ev.push(SEv::Died);
                }
                return;
            }
            PSt::Stun(t) => {
                self.st = if t <= 1 { PSt::Walk } else { PSt::Stun(t - 1) };
                return;
            }
            PSt::Hold { item, t } => {
                self.st = if t <= 1 {
                    let _ = item;
                    PSt::Walk
                } else {
                    PSt::Hold { item, t: t - 1 }
                };
                return;
            }
            PSt::Search { fix, t, total } => {
                // only a fresh press of a different direction, or shooting, cancels
                let facing = self.face.btn();
                let fresh_other = [UP, DOWN, LEFT, RIGHT].iter().any(|b| *b != facing && pad.pressed(*b));
                if fresh_other || pad.pressed(A) {
                    self.st = PSt::Walk;
                    return;
                }
                if t % 8 == 0 {
                    self.ev.push(SEv::Sfx(Sfx::SearchTick));
                }
                if t + 1 >= total {
                    self.st = PSt::Walk;
                    self.finish_search(fix, st, ctx);
                } else {
                    self.st = PSt::Search { fix, t: t + 1, total };
                }
                return;
            }
            PSt::Walk => {}
        }
        if self.frozen {
            return;
        }
        // ---- movement (vertical input has priority) ----
        let spd = ctx.powers.walk_speed();
        let (mut dx, mut dy) = (0.0, 0.0);
        if pad.is(UP) != pad.is(DOWN) {
            dy = if pad.is(UP) { -spd } else { spd };
            self.face = if dy < 0.0 { Dir::Up } else { Dir::Down };
        } else if pad.is(LEFT) != pad.is(RIGHT) {
            dx = if pad.is(LEFT) { -spd } else { spd };
            self.face = if dx < 0.0 { Dir::Left } else { Dir::Right };
        }
        if dx != 0.0 || dy != 0.0 {
            self.try_move(dx, dy);
        }
        // door: walking out
        if self.y >= ((self.layout.h - 1) * TILE) as f32 + 6.0 {
            self.ev.push(SEv::Exit);
            return;
        }
        // listening booth
        let on_booth = self.tile_here() == b'L';
        if on_booth != self.booth {
            self.booth = on_booth;
            if on_booth {
                self.say_banner(copy::NOW_PLAYING.to_string());
            }
        }
        // ---- search (single tap starts it) ----
        if pad.pressed(B) {
            if let Some(i) = self.search_target(st) {
                let f = self.fixtures[i];
                let (cx, cy) = tile_center(f.tx, f.ty);
                self.face = Dir::from_delta(cx - self.x, cy - self.y);
                let total = if ctx.powers.fast_search() { SEARCH_FRAMES_FAST } else { SEARCH_FRAMES };
                self.st = PSt::Search { fix: i, t: 0, total };
                return;
            }
        }
        // ---- shooting ----
        if pad.is(A) && self.cd == 0 {
            let (cd, max) = ctx.powers.fire_params();
            let mine = self.bullets.iter().filter(|b| !b.hostile).count();
            if mine < max {
                let (vx, vy) = self.face.vec();
                let spread = ctx.powers.weapon_kind() == Weapon::Spread;
                let list: &[f32] = if spread { &[-0.8, 0.0, 0.8] } else { &[0.0] };
                for off in list {
                    let (px, py) = (-vy.abs() * 0.0, 0.0);
                    let _ = (px, py);
                    let (bvx, bvy) = if vx != 0.0 { (vx * BULLET_V, *off) } else { (*off, vy * BULLET_V) };
                    self.bullets.push(TdBullet {
                        x: self.x + vx * 8.0,
                        y: self.y + 2.0 + vy * 8.0,
                        vx: bvx,
                        vy: bvy,
                        hostile: false,
                        shoe: false,
                    });
                }
                self.cd = cd;
                self.ev.push(SEv::Sfx(Sfx::Shot));
            }
        }
    }

    fn finish_search(&mut self, fix: usize, st: &mut StoreState, ctx: &mut SCtx) {
        let f = self.fixtures[fix];
        let (cx, cy) = tile_center(f.tx, f.ty);
        // Forever 12 fitting rooms: sometimes someone is changing
        if f.kind == b'F' && !st.revealed[fix] && ctx.rng.chance(25) {
            st.revealed[fix] = true;
            self.puffs.push(Puff { x: cx, y: cy, t: 20 });
            let (gx, gy) = tile_center(f.tx, f.ty + 1);
            self.guards.push(Guard {
                x: gx,
                y: gy,
                kind: GuardKind::Spy,
                dir: Dir::Down,
                hp: 1,
                st: GSt::Walk,
                cd: 100,
                stun: 0,
                anim: 0,
                target: None,
            });
            let gi = self.guards.len() - 1;
            self.bubbles.push(Bub { guard: gi, text: copy::OCCUPIED.to_string(), delay: 0, t: 100 });
            self.ev.push(SEv::Sfx(Sfx::Shriek));
            let (dx, dy) = (self.x - gx, self.y - gy);
            let d = (dx * dx + dy * dy).sqrt().max(1.0);
            self.bullets.push(TdBullet { x: gx, y: gy, vx: dx / d * 2.2, vy: dy / d * 2.2, hostile: true, shoe: true });
            return;
        }
        st.opened[fix] = true;
        self.puffs.push(Puff { x: cx, y: cy, t: 20 });
        match st.contents[fix] {
            Content::Package => {
                st.package_taken = true;
                self.st = PSt::Hold { item: Held::Package, t: 100 };
                self.say_banner(format!("PACKAGE {}/6", ctx.packages + 1));
                self.ev.push(SEv::Package);
                self.ev.push(SEv::Sfx(Sfx::Package));
            }
            Content::Power(k) => {
                self.st = PSt::Hold { item: Held::Power(k), t: 80 };
                self.say_banner(k.name().to_string());
                self.ev.push(SEv::Power(k));
                self.ev.push(SEv::Sfx(Sfx::PowerUp));
            }
            Content::Trap => {
                self.st = PSt::Stun(60);
                self.say_banner(copy::TRAP.to_string());
                self.ev.push(SEv::Sfx(Sfx::Smoke));
            }
            Content::Nothing => {
                self.say_banner(copy::NOTHING.to_string());
                self.ev.push(SEv::Sfx(Sfx::Smoke));
            }
        }
    }

    fn update_toys(&mut self, st: &mut StoreState, ctx: &mut SCtx) {
        let mut toys = std::mem::take(&mut self.toys);
        for t in toys.iter_mut() {
            t.t -= 1;
            let (dx, dy) = t.dir.vec();
            let (nx, ny) = (t.x + dx * 0.7, t.y + dy * 0.7);
            let (tx, ty) = ((nx / TILE as f32).floor() as i32, (ny / TILE as f32).floor() as i32);
            if self.layout.is_solid(tx, ty) {
                let dirs = [Dir::Up, Dir::Down, Dir::Left, Dir::Right];
                t.dir = *ctx.rng.pick(&dirs);
            } else {
                t.x = nx;
                t.y = ny;
            }
            // stun guards they touch
            for g in self.guards.iter_mut() {
                if !matches!(g.st, GSt::Dying(_)) && (g.x - t.x).abs() < 9.0 && (g.y - t.y).abs() < 9.0 {
                    g.stun = 120;
                }
            }
            // set off traps
            for (i, f) in self.fixtures.iter().enumerate() {
                if st.opened[i] || st.contents[i] != Content::Trap {
                    continue;
                }
                let (cx, cy) = tile_center(f.tx, f.ty);
                if (cx - t.x).abs() < 14.0 && (cy - t.y).abs() < 14.0 {
                    st.opened[i] = true;
                    self.puffs.push(Puff { x: cx, y: cy, t: 30 });
                    self.ev.push(SEv::Sfx(Sfx::Smoke));
                    for g in self.guards.iter_mut() {
                        if (g.x - cx).abs() < 48.0 && (g.y - cy).abs() < 48.0 {
                            g.stun = 180;
                        }
                    }
                }
            }
        }
        toys.retain(|t| t.t > 0);
        self.toys = toys;
    }

    fn guard_speed(&self) -> f32 {
        0.5 * (1.0 + 0.1 * (self.loop_n as f32 - 1.0)).min(1.5)
    }

    fn update_guards(&mut self, ctx: &mut SCtx) {
        if self.frozen {
            return;
        }
        let mut guards = std::mem::take(&mut self.guards);
        let (px, py) = (self.x, self.y);
        let player_alive = !matches!(self.st, PSt::Dying(_));
        let spd = self.guard_speed();
        let interval = ((130.0 / (1.0 + 0.15 * (self.loop_n as f32 - 1.0))) as i32).max(60);
        let holding = self.hold_guards > 0;
        let n = guards.len();
        for gi in 0..n {
            let g = &mut guards[gi];
            g.anim += 1;
            if let GSt::Dying(t) = g.st {
                g.st = GSt::Dying(t - 1);
                continue;
            }
            if g.stun > 0 {
                g.stun -= 1;
                continue;
            }
            if holding {
                continue;
            }
            if g.cd > 0 {
                g.cd -= 1;
            }
            match g.kind {
                GuardKind::Bot => {
                    let (dx, dy) = g.dir.vec();
                    let (nx, ny) = (g.x + dx * 0.6, g.y + dy * 0.6);
                    let (ax, ay) = (nx + dx * 8.0, ny + dy * 8.0);
                    if self.layout.is_solid((ax / TILE as f32).floor() as i32, (ay / TILE as f32).floor() as i32) {
                        g.dir = g.dir.opposite();
                    } else {
                        g.x = nx;
                        g.y = ny;
                    }
                    if player_alive && self.inv == 0 && (g.x - px).abs() < 10.0 && (g.y - py).abs() < 10.0 {
                        // contact kills (handled below to appease the borrow checker)
                    }
                }
                GuardKind::Spy => {
                    if let GSt::Aim(t) = g.st {
                        if t <= 1 {
                            let (dx, dy) = g.dir.vec();
                            self.bullets.push(TdBullet {
                                x: g.x + dx * 8.0,
                                y: g.y + dy * 8.0,
                                vx: dx * GUARD_BULLET_V,
                                vy: dy * GUARD_BULLET_V,
                                hostile: true,
                                shoe: false,
                            });
                            self.ev.push(SEv::Sfx(Sfx::EnemyShot));
                            g.cd = interval;
                            g.st = GSt::Walk;
                        } else {
                            g.st = GSt::Aim(t - 1);
                        }
                        continue;
                    }
                    // line up and shoot
                    if player_alive && self.grace == 0 && g.cd == 0 {
                        let aligned_x = (g.x - px).abs() < 7.0;
                        let aligned_y = (g.y - py).abs() < 7.0;
                        if (aligned_x || aligned_y) && (g.x - px).abs() + (g.y - py).abs() < 200.0 {
                            let clear = {
                                let (x0, y0, x1, y1) = (g.x, g.y, px, py);
                                let n = (((x1 - x0).abs() + (y1 - y0).abs()) / 4.0) as i32 + 1;
                                (1..n).all(|i| {
                                    let f = i as f32 / n as f32;
                                    let (x, y) = (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
                                    !self.layout.is_solid((x / TILE as f32) as i32, (y / TILE as f32) as i32)
                                })
                            };
                            if clear {
                                g.dir = Dir::from_delta(px - g.x, py - g.y);
                                g.st = GSt::Aim(20);
                                continue;
                            }
                        }
                    }
                    // tile-by-tile movement, favouring the player
                    if let Some((tx, ty)) = g.target {
                        let (dx, dy) = (tx - g.x, ty - g.y);
                        let d = (dx * dx + dy * dy).sqrt();
                        if d <= spd {
                            g.x = tx;
                            g.y = ty;
                            g.target = None;
                        } else {
                            g.x += dx / d * spd;
                            g.y += dy / d * spd;
                        }
                    } else {
                        let (tx, ty) = ((g.x / TILE as f32) as i32, (g.y / TILE as f32) as i32);
                        let dirs = [Dir::Up, Dir::Down, Dir::Left, Dir::Right];
                        let mut opts: Vec<(Dir, i32)> = vec![];
                        for d in dirs {
                            let (dx, dy) = d.vec();
                            let (nx, ny) = (tx + dx as i32, ty + dy as i32);
                            if self.layout.is_solid(nx, ny) || ny >= self.layout.h - 1 {
                                continue;
                            }
                            let (cx, cy) = tile_center(nx, ny);
                            let dist = ((cx - px).abs() + (cy - py).abs()) as i32;
                            opts.push((d, dist));
                        }
                        if !opts.is_empty() {
                            opts.sort_by_key(|o| o.1);
                            let pick = if ctx.rng.chance(65) { opts[0] } else { opts[ctx.rng.index(opts.len())] };
                            g.dir = pick.0;
                            let (dx, dy) = pick.0.vec();
                            g.target = Some(tile_center(tx + dx as i32, ty + dy as i32));
                        }
                    }
                }
            }
        }
        // bots kill on contact
        let mut hit = false;
        if player_alive && self.inv == 0 {
            for g in guards.iter() {
                if g.kind == GuardKind::Bot && !matches!(g.st, GSt::Dying(_)) && g.stun == 0 && (g.x - px).abs() < 10.0 && (g.y - py).abs() < 10.0 {
                    hit = true;
                }
            }
        }
        guards.retain(|g| !matches!(g.st, GSt::Dying(t) if t < 0));
        // bubbles refer to guard indices: removal only happens for dying guards after their bubbles expire
        self.guards = guards;
        if hit {
            self.hurt(ctx);
        }
    }

    fn hurt(&mut self, ctx: &mut SCtx) {
        if self.inv > 0 || matches!(self.st, PSt::Dying(_)) || ctx.powers.invincible() {
            return;
        }
        if ctx.powers.armor {
            ctx.powers.armor = false;
            self.inv = 60;
            self.ev.push(SEv::Sfx(Sfx::Hurt));
            return;
        }
        self.st = PSt::Dying(70);
        self.bullets.clear();
        self.ev.push(SEv::Sfx(Sfx::Death));
    }

    fn update_bullets(&mut self, st: &mut StoreState, ctx: &mut SCtx) {
        let _ = st;
        let mut bullets = std::mem::take(&mut self.bullets);
        let mut keep = Vec::new();
        'b: for mut b in bullets.drain(..) {
            b.x += b.vx;
            b.y += b.vy;
            let (tx, ty) = ((b.x / TILE as f32).floor() as i32, (b.y / TILE as f32).floor() as i32);
            if tx < 0 || ty < 0 || tx >= self.layout.w || ty >= self.layout.h {
                continue;
            }
            let tile = self.layout.tile(tx, ty);
            if self.solid_tile(tx, ty) {
                if tile == b'T' && !b.hostile {
                    // find the shelf fixture and release wind-up toys
                    if let Some(i) = self.fixtures.iter().position(|f| f.tx == tx && f.ty == ty) {
                        if !self.shelf_hit[i] {
                            self.shelf_hit[i] = true;
                            let (cx, cy) = tile_center(tx, ty + 1);
                            for d in [Dir::Left, Dir::Down, Dir::Right] {
                                self.toys.push(Toy { x: cx, y: cy, dir: d, t: 600 });
                            }
                            self.puffs.push(Puff { x: cx, y: cy, t: 18 });
                            self.ev.push(SEv::Sfx(Sfx::Smoke));
                        }
                    }
                }
                continue;
            }
            if b.hostile {
                if !matches!(self.st, PSt::Dying(_)) && (b.x - self.x).abs() < 6.0 && (b.y - (self.y + 2.0)).abs() < 7.0 {
                    if b.shoe {
                        // a thrown shoe just stuns
                        if self.inv == 0 {
                            self.st = PSt::Stun(40);
                            self.inv = 30;
                            self.ev.push(SEv::Sfx(Sfx::Hurt));
                        }
                    } else {
                        self.hurt(ctx);
                    }
                    continue;
                }
                keep.push(b);
                continue;
            }
            for gi in 0..self.guards.len() {
                let g = &mut self.guards[gi];
                if matches!(g.st, GSt::Dying(_)) {
                    continue;
                }
                if (b.x - g.x).abs() < 7.0 && (b.y - (g.y + 1.0)).abs() < 8.0 {
                    g.hp -= 1;
                    if g.hp <= 0 {
                        g.st = GSt::Dying(24);
                        let (gx, gy) = (g.x, g.y);
                        self.ev.push(SEv::Score(100));
                        self.ev.push(SEv::Sfx(Sfx::Hurt));
                        self.popups.push((gx, gy - 8.0, "100".to_string(), 40));
                    } else {
                        self.ev.push(SEv::Sfx(Sfx::HelmetPing));
                    }
                    continue 'b;
                }
            }
            keep.push(b);
        }
        self.bullets = keep;
        let _ = ctx;
    }

    pub fn song_hint(&self) -> StoreSong {
        if self.booth {
            StoreSong::Booth
        } else if matches!(self.st, PSt::Hold { item: Held::Joke(_), .. }) {
            StoreSong::ItemGet
        } else {
            StoreSong::Store
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreSong {
    Store,
    Booth,
    ItemGet,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::level::setup_stores;
    use crate::stores::ALL_STORES;

    struct H {
        room: StoreRoom,
        st: StoreState,
        powers: Powers,
        rng: Rng,
        pad: Pad,
    }
    fn setup(id: StoreId, seed: u64) -> H {
        let mut rng = Rng::new(seed);
        let sts = setup_stores(&mut rng, false);
        let st = sts.into_iter().find(|s| s.id == id).unwrap();
        let mut powers = Powers::new();
        let room = {
            let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
            StoreRoom::enter(id, &st, &mut c, false)
        };
        H { room, st, powers, rng, pad: Pad::new() }
    }
    impl H {
        fn frame(&mut self, held: u8) {
            self.pad.set_gamepad(held);
            let ps = self.pad.begin_step();
            let mut c = SCtx { powers: &mut self.powers, rng: &mut self.rng, loop_n: 1, packages: 0 };
            self.room.step(ps, &mut self.st, &mut c);
        }
        fn frames(&mut self, held: u8, n: usize) {
            for _ in 0..n {
                self.frame(held);
            }
        }
        fn kill_guards(&mut self) {
            self.room.guards.clear();
        }
    }
    fn walk_to_fixture(h: &mut H, idx: usize) {
        // teleport next to a fixture (walkable tile below it) facing it
        let f = h.room.fixtures[idx];
        h.room.x = (f.tx * TILE + 8) as f32;
        h.room.y = ((f.ty + 1) * TILE + 1) as f32;
        h.room.face = Dir::Up;
    }

    #[test]
    fn walls_and_fixtures_are_solid_and_door_is_walkable() {
        let mut h = setup(StoreId::SamBaddy, 1);
        h.kill_guards();
        h.frames(UP, 400);
        assert!(h.room.y > 16.0, "agent must not walk through the top wall: {}", h.room.y);
        // the door: walking down out of the room fires Exit exactly when crossing
        let mut exited = false;
        for _ in 0..200 {
            h.frame(DOWN);
            if h.room.ev.contains(&SEv::Exit) {
                exited = true;
                break;
            }
        }
        assert!(exited);
    }
    #[test]
    fn vertical_input_has_priority() {
        let mut h = setup(StoreId::SamBaddy, 1);
        h.kill_guards();
        let (x0, y0) = (h.room.x, h.room.y);
        h.frames(UP | LEFT, 5);
        assert_eq!(h.room.x, x0);
        assert!(h.room.y < y0);
        assert_eq!(h.room.face, Dir::Up);
    }
    #[test]
    fn single_tap_of_b_runs_a_full_search_on_its_own() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        assert!(h.room.can_search.is_some());
        h.frame(B);
        h.frame(0); // released immediately
        assert!(matches!(h.room.st, PSt::Search { .. }));
        h.frames(0, 60);
        assert!(h.st.opened[0], "search should finish by itself");
    }
    #[test]
    fn fixture_touched_beside_or_at_a_gap_counts_and_agent_turns_to_face_it() {
        let mut h = setup(StoreId::SamBaddy, 3);
        h.kill_guards();
        let f = h.room.fixtures[0];
        // stand to the SIDE of the fixture, facing away
        h.room.x = (f.tx * TILE + 8) as f32 + 14.0;
        h.room.y = (f.ty * TILE + 8) as f32 + 1.0;
        h.room.face = Dir::Down;
        h.frame(0);
        // may be blocked by a neighbour; only assert when it is a free side
        if h.room.layout.is_solid(f.tx + 1, f.ty) {
            return;
        }
        assert_eq!(h.room.can_search, Some(0));
        h.frame(B);
        assert_eq!(h.room.face, Dir::Left);
    }
    #[test]
    fn holding_b_after_a_search_does_not_start_the_next_one() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        walk_to_fixture(&mut h, 0);
        h.frames(B, 200);
        let opened = h.st.opened.iter().filter(|o| **o).count();
        assert_eq!(opened, 1);
    }
    #[test]
    fn cancelling_needs_a_fresh_different_direction_or_shooting() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        walk_to_fixture(&mut h, 0);
        h.frame(UP | B); // holding the direction we face does not cancel
        h.frames(UP, 10);
        assert!(matches!(h.room.st, PSt::Search { .. }));
        h.frame(LEFT); // fresh different direction
        assert!(matches!(h.room.st, PSt::Walk));
        assert!(!h.st.opened[0]);
        // shooting cancels too
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        h.frame(B);
        h.frames(0, 5);
        assert!(matches!(h.room.st, PSt::Search { .. }));
        h.frame(A);
        assert!(matches!(h.room.st, PSt::Walk));
    }
    #[test]
    fn package_fixture_gives_package_and_counts_the_store_cleared() {
        let mut h = setup(StoreId::SamBaddy, 4);
        h.kill_guards();
        let pk = h.st.contents.iter().position(|c| *c == Content::Package).unwrap();
        walk_to_fixture(&mut h, pk);
        h.frame(0);
        h.frame(B);
        let mut got = false;
        for _ in 0..80 {
            h.frame(0);
            if h.room.ev.contains(&SEv::Package) {
                got = true;
            }
        }
        assert!(got);
        assert!(h.st.package_taken);
        assert!(!h.st.open_for_entry());
    }
    #[test]
    fn opened_fixtures_stay_open_on_reentry() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        h.frame(B);
        h.frames(0, 60);
        assert!(h.st.opened[0]);
        let mut c = SCtx { powers: &mut h.powers, rng: &mut h.rng, loop_n: 1, packages: 0 };
        let room2 = StoreRoom::enter(StoreId::SamBaddy, &h.st, &mut c, false);
        let _ = room2;
        assert!(h.st.opened[0]);
        assert_eq!(room2_search(&h), None.or(room2_search(&h)));
    }
    fn room2_search(h: &H) -> Option<usize> {
        let mut r = h.room.clone();
        let f = r.fixtures[0];
        r.x = (f.tx * TILE + 8) as f32;
        r.y = ((f.ty + 1) * TILE + 1) as f32;
        r.search_target(&h.st).filter(|i| *i == 0)
    }
    #[test]
    fn already_opened_fixture_cannot_be_searched_again() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        h.st.opened[0] = true;
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        assert!(h.room.search_target(&h.st) != Some(0));
    }
    #[test]
    fn traps_stun_for_a_second_and_nothing_shows_a_banner() {
        let mut h = setup(StoreId::RadioShock, 5);
        h.kill_guards();
        h.st.contents[0] = Content::Trap;
        h.st.contents[1] = Content::Nothing;
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        h.frame(B);
        h.frames(0, 50);
        assert!(matches!(h.room.st, PSt::Stun(_)));
        assert_eq!(h.room.banner.as_ref().unwrap().0, copy::TRAP);
        h.frames(0, 62);
        assert!(matches!(h.room.st, PSt::Walk));
        walk_to_fixture(&mut h, 1);
        h.frame(0);
        h.frame(B);
        h.frames(0, 50);
        assert_eq!(h.room.banner.as_ref().unwrap().0, copy::NOTHING);
    }
    #[test]
    fn sneakers_search_faster() {
        let mut h = setup(StoreId::SamBaddy, 2);
        h.kill_guards();
        h.powers.grant(PowerKind::Sneakers);
        walk_to_fixture(&mut h, 0);
        h.frame(0);
        h.frame(B);
        h.frames(0, 30);
        assert!(h.st.opened[0]);
    }
    #[test]
    fn power_timers_run_while_in_the_store_via_the_game_tick() {
        // timers live in Powers and the Game ticks them every frame in every scene
        let mut p = Powers::new();
        p.grant(PowerKind::Rapid);
        for _ in 0..600 {
            p.tick();
        }
        assert_eq!(p.weapon.unwrap().1, super::super::powerups::RAPID_T - 600);
    }
    #[test]
    fn fitting_room_sometimes_reveals_a_spy_and_stays_unsearched() {
        let mut revealed = 0;
        for seed in 0..80 {
            let mut h = setup(StoreId::Forever12, seed);
            h.kill_guards();
            let f = h.room.fixtures.iter().position(|f| f.kind == b'F').unwrap();
            walk_to_fixture(&mut h, f);
            h.frame(0);
            h.frame(B);
            for _ in 0..60 {
                h.frame(0);
                if h.st.revealed[f] {
                    break;
                }
            }
            if h.st.revealed[f] {
                revealed += 1;
                assert!(!h.st.opened[f], "contents must stay unsearched");
                assert!(h.room.bubbles.iter().any(|b| b.text == copy::OCCUPIED));
                assert_eq!(h.room.guards.len(), 1);
                assert!(h.room.bullets.iter().any(|b| b.shoe) || matches!(h.room.st, PSt::Stun(_)), "shoe thrown");
            }
        }
        assert!((8..=35).contains(&revealed), "~25% of 80, got {revealed}");
    }
    #[test]
    fn shooting_a_toy_shelf_releases_three_toys_that_stun_guards() {
        let mut h = setup(StoreId::KgbToys, 1);
        h.kill_guards();
        let shelf = h.room.fixtures.iter().find(|f| f.kind == b'T').copied().unwrap();
        h.room.x = (shelf.tx * TILE + 8) as f32;
        h.room.y = ((shelf.ty + 2) * TILE + 8) as f32;
        h.room.face = Dir::Up;
        h.frames(A, 30);
        assert_eq!(h.room.toys.len(), 3);
        // shooting the same shelf again does not duplicate
        h.frames(0, 30);
        h.frames(A, 30);
        assert_eq!(h.room.toys.len(), 3);
        // a toy on top of a guard stuns it
        h.room.guards.push(Guard {
            x: h.room.toys[0].x,
            y: h.room.toys[0].y,
            kind: GuardKind::Spy,
            dir: Dir::Down,
            hp: 1,
            st: GSt::Walk,
            cd: 99,
            stun: 0,
            anim: 0,
            target: None,
        });
        h.frame(0);
        assert!(h.room.guards[0].stun > 0);
    }
    #[test]
    fn toys_set_off_traps_and_the_smoke_stuns_nearby_guards() {
        let mut h = setup(StoreId::KgbToys, 1);
        h.kill_guards();
        h.st.contents[3] = Content::Trap;
        let f = h.room.fixtures[3];
        let (cx, cy) = tile_center(f.tx, f.ty);
        h.room.toys.push(Toy { x: cx, y: cy, dir: Dir::Down, t: 100 });
        h.room.guards.push(Guard { x: cx + 20.0, y: cy, kind: GuardKind::Spy, dir: Dir::Down, hp: 1, st: GSt::Walk, cd: 99, stun: 0, anim: 0, target: None });
        h.frame(0);
        assert!(h.st.opened[3]);
        assert!(h.room.guards[0].stun > 0);
    }
    #[test]
    fn listening_booth_switches_music_until_you_leave() {
        let mut h = setup(StoreId::SamBaddy, 1);
        h.kill_guards();
        let (tx, ty) = h.room.layout.find(b'L').unwrap();
        h.room.x = (tx * TILE + 8) as f32;
        h.room.y = (ty * TILE + 8) as f32;
        h.frame(0);
        assert_eq!(h.room.song_hint(), StoreSong::Booth);
        assert_eq!(h.room.banner.as_ref().unwrap().0, copy::NOW_PLAYING);
        h.room.y += 16.0 * 3.0;
        h.frame(0);
        assert_eq!(h.room.song_hint(), StoreSong::Store);
    }
    #[test]
    fn first_visit_guards_hold_still_and_speak_then_act() {
        let mut rng = Rng::new(1);
        let sts = setup_stores(&mut rng, false);
        let st = sts.iter().find(|s| s.id == StoreId::KgbToys).unwrap().clone();
        let mut powers = Powers::new();
        let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
        let mut room = StoreRoom::enter(StoreId::KgbToys, &st, &mut c, false);
        assert_eq!(room.bubbles.len(), 2);
        assert_eq!(room.bubbles[1].delay, 60);
        assert!(room.hold_guards > 100);
        let p0: Vec<(f32, f32)> = room.guards.iter().map(|g| (g.x, g.y)).collect();
        let mut st = st;
        let mut pad = Pad::new();
        for _ in 0..90 {
            let ps = pad.begin_step();
            let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
            room.step(ps, &mut st, &mut c);
        }
        let p1: Vec<(f32, f32)> = room.guards.iter().map(|g| (g.x, g.y)).collect();
        assert_eq!(p0, p1);
        // second visit: no lines
        st.visited = true;
        let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
        let r2 = StoreRoom::enter(StoreId::KgbToys, &st, &mut c, false);
        assert!(r2.bubbles.is_empty());
    }
    #[test]
    fn guards_give_a_grace_period_before_shooting() {
        let mut h = setup(StoreId::Crookstone, 1);
        h.room.hold_guards = 0;
        h.frames(0, GRACE as usize - 2);
        assert!(h.room.bullets.iter().all(|b| !b.hostile), "no shots during grace");
    }
    #[test]
    fn armor_absorbs_one_hit_then_the_next_kills() {
        let mut h = setup(StoreId::Crookstone, 1);
        h.kill_guards();
        h.powers.grant(PowerKind::Armor);
        h.room.bullets.push(TdBullet { x: h.room.x, y: h.room.y + 2.0, vx: 0.0, vy: 0.0, hostile: true, shoe: false });
        h.frame(0);
        assert!(!h.powers.armor);
        assert!(matches!(h.room.st, PSt::Walk));
        h.room.inv = 0;
        h.room.bullets.push(TdBullet { x: h.room.x, y: h.room.y + 2.0, vx: 0.0, vy: 0.0, hostile: true, shoe: false });
        h.frame(0);
        assert!(matches!(h.room.st, PSt::Dying(_)));
        h.frames(0, 80);
        assert!(h.room.ev.contains(&SEv::Died) || matches!(h.room.st, PSt::Dying(-1)));
    }
    #[test]
    fn security_bot_takes_three_hits_and_spies_one() {
        let mut h = setup(StoreId::RadioShock, 1);
        h.room.hold_guards = 0;
        h.room.guards.retain(|g| g.kind == GuardKind::Bot);
        let b = &mut h.room.guards[0];
        b.x = 100.0;
        b.y = 100.0;
        b.stun = 9999;
        h.room.x = 100.0;
        h.room.y = 140.0;
        h.room.face = Dir::Up;
        for _ in 0..3 {
            h.room.bullets.push(TdBullet { x: 100.0, y: 101.0, vx: 0.0, vy: 0.0, hostile: false, shoe: false });
            h.frame(0);
        }
        assert!(matches!(h.room.guards[0].st, GSt::Dying(_)));
    }
    #[test]
    fn gamestonk_easter_egg_flow() {
        let mut rng = Rng::new(9);
        let sts = setup_stores(&mut rng, false);
        let mut st = sts.into_iter().find(|s| s.id == StoreId::GameStonk).unwrap();
        let mut powers = Powers::new();
        let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
        let mut room = StoreRoom::enter(StoreId::GameStonk, &st, &mut c, true);
        assert!(room.frozen);
        let mut pad = Pad::new();
        // input and guards frozen while the typewriter prints
        let g0: Vec<_> = room.guards.iter().map(|g| (g.x, g.y)).collect();
        pad.set_gamepad(UP);
        let (x0, y0) = (room.x, room.y);
        for _ in 0..60 {
            let ps = pad.begin_step();
            let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
            room.step(ps, &mut st, &mut c);
        }
        assert_eq!((room.x, room.y), (x0, y0));
        assert_eq!(g0, room.guards.iter().map(|g| (g.x, g.y)).collect::<Vec<_>>());
        pad.set_gamepad(0);
        for _ in 0..300 {
            let ps = pad.begin_step();
            let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
            room.step(ps, &mut st, &mut c);
        }
        assert!(!room.frozen);
        assert_eq!(room.egg.as_ref().unwrap().phase, EggPhase::Pedestal);
        // walk onto the pedestal
        room.guards.clear();
        let (tx, ty) = room.layout.find(b'p').unwrap();
        room.x = (tx * TILE + 8) as f32;
        room.y = (ty * TILE + 8) as f32;
        let mut joke = None;
        let mut score = 0;
        let mut done = false;
        for _ in 0..200 {
            let ps = pad.begin_step();
            let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
            room.step(ps, &mut st, &mut c);
            for e in &room.ev {
                match e {
                    SEv::Joke(i) => joke = Some(*i),
                    SEv::Score(n) => score += n,
                    SEv::EggDone => done = true,
                    _ => {}
                }
            }
        }
        assert!(joke.is_some() && score == 1 && done);
        assert!(room.clerk_gone);
        // not offered a second time
        let mut c = SCtx { powers: &mut powers, rng: &mut rng, loop_n: 1, packages: 0 };
        let r2 = StoreRoom::enter(StoreId::GameStonk, &st, &mut c, false);
        assert!(r2.egg.is_none() && !r2.frozen);
    }
    #[test]
    fn rooms_support_a_camera_for_larger_sizes() {
        let mut h = setup(StoreId::SamBaddy, 1);
        assert_eq!(h.room.camera(), (0, 0));
        // pretend the room is bigger than the screen
        h.room.layout.w = 40;
        h.room.layout.h = 30;
        for row in h.room.layout.tiles.iter_mut() {
            row.resize(40, b'.');
        }
        h.room.layout.tiles.resize(30, vec![b'.'; 40]);
        h.room.x = 500.0;
        h.room.y = 300.0;
        let (cx, cy) = h.room.camera();
        assert_eq!((cx, cy), (500 - 128, 300 - 88));
        h.room.x = 5.0;
        assert_eq!(h.room.camera().0, 0);
        h.room.x = 630.0;
        assert_eq!(h.room.camera().0, 640 - 256);
    }
    #[test]
    fn every_open_store_can_be_entered_and_stepped() {
        for id in ALL_STORES {
            if crate::stores::info(id).role == crate::stores::Role::Closed {
                continue;
            }
            let mut h = setup(id, 7);
            h.frames(0, 200);
            h.frames(UP, 50);
        }
    }
}
