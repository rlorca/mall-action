//! The world simulation inside a store: guards (spies and security bots), bullets, wind-up toys, speech bubbles.

use crate::copy;
use crate::events::{Out, Sfx};
use crate::rng::Rng;
use crate::run::{Difficulty, RunState, PTS_SPY_SHOT};
use crate::types::Content;

use super::templates::{SpawnKind, Template, Tile, TILE};
use super::*;

pub(crate) const SPY_SPEED: f32 = 0.75;
pub(crate) const BOT_SPEED: f32 = 0.6;
pub(crate) const ENEMY_BULLET_SPEED: f32 = 2.0;
pub(crate) const SHOE_SPEED: f32 = 1.5;
pub(crate) const AIM_FRAMES: u32 = 20;
pub(crate) const TOY_SPEED: f32 = 0.6;
pub(crate) const TOY_LIFE: u32 = 900;
pub(crate) const GUARD_STUN: u32 = 90;
pub(crate) const BOT_HP: i32 = 3;
pub(crate) const GUARD_DEATH_FRAMES: u32 = 24;
/// How far (px) a smoke puff from a set-off trap stuns guards.
pub(crate) const SMOKE_RADIUS: i32 = 56;
/// Intro bubbles: first line after 5 frames, second 60 frames later, each visible for 90 frames.
pub(crate) const INTRO_FIRST_DELAY: u32 = 5;
pub(crate) const INTRO_GAP: u32 = 60;
pub(crate) const INTRO_BUBBLE_FRAMES: u32 = 90;
pub(crate) const MAX_GUARDS: usize = 6;

pub(crate) fn rects_overlap(a: (i32, i32, i32, i32), b: (i32, i32, i32, i32)) -> bool {
    a.0 < b.0 + b.2 && b.0 < a.0 + a.2 && a.1 < b.1 + b.3 && b.1 < a.1 + a.3
}

pub(crate) fn guard_rect(g: &Guard) -> (i32, i32, i32, i32) {
    (g.x.round() as i32 + BOX_X, g.y.round() as i32 + BOX_Y, BOX_W, BOX_H)
}

fn guard_box_free(grid: &Template, x: f32, y: f32) -> bool {
    let l = x.round() as i32 + BOX_X;
    let t = y.round() as i32 + BOX_Y;
    let (r, b) = (l + BOX_W - 1, t + BOX_H - 1);
    for ty in t.div_euclid(TILE)..=b.div_euclid(TILE) {
        for tx in l.div_euclid(TILE)..=r.div_euclid(TILE) {
            if !grid.tile(tx, ty).guard_walkable() {
                return false;
            }
        }
    }
    true
}

/// A straight, unobstructed line (rows/columns) from a guard to the agent? Returns the firing direction.
pub(crate) fn lined_up(grid: &Template, gx: i32, gy: i32, px: i32, py: i32) -> Option<Dir> {
    let (dx, dy) = (px - gx, py - gy);
    let dir = if dx.abs() <= 5 && dy.abs() >= 8 {
        if dy < 0 {
            Dir::Up
        } else {
            Dir::Down
        }
    } else if dy.abs() <= 5 && dx.abs() >= 8 {
        if dx < 0 {
            Dir::Left
        } else {
            Dir::Right
        }
    } else {
        return None;
    };
    let len = dx.abs().max(dy.abs());
    if len > 12 * TILE {
        return None;
    }
    // Walk the lane in 4 px steps; any solid tile blocks the line.
    let (vx, vy) = dir.vec();
    let mut d = 8;
    while d < len {
        let (x, y) = (gx + vx * d, gy + vy * d);
        if grid.tile(x.div_euclid(TILE), y.div_euclid(TILE)).solid() {
            return None;
        }
        d += 4;
    }
    Some(dir)
}

impl StoreRoom {
    pub(crate) fn step_puffs(&mut self) {
        for p in &mut self.puffs {
            p.t += 1;
        }
        self.puffs.retain(|p| p.t < 24);
    }

    pub(crate) fn step_bubbles(&mut self) {
        let guards = &self.guards;
        for b in &mut self.bubbles {
            if b.delay > 0 {
                b.delay -= 1;
            } else if b.left > 0 {
                b.left -= 1;
            }
        }
        self.bubbles.retain(|b| {
            if b.left == 0 {
                return false;
            }
            match b.guard {
                Some(i) => guards.get(i).map_or(false, |g| !g.gone && g.dying == 0),
                None => true,
            }
        });
    }

    /// Bubble position in room pixels (tip just above the head).
    pub(crate) fn bubble_tip(&self, b: &Bubble) -> (i32, i32) {
        match b.guard {
            Some(i) => {
                let g = &self.guards[i];
                (g.x.round() as i32 + 8, g.y.round() as i32 + 3)
            }
            None => (b.x, b.y),
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Guards
    // -----------------------------------------------------------------------------------------------------

    fn make_guard(kind: SpawnKind, tx: i32, ty: i32) -> Guard {
        let k = spawn_kind(kind);
        Guard {
            kind: k,
            x: (tx * TILE) as f32,
            y: (ty * TILE) as f32,
            face: Dir::Down,
            tx,
            ty,
            target: None,
            hp: if k == GKind::Bot { BOT_HP } else { 1 },
            stun: 0,
            aim: 0,
            cool: 0,
            wait: 0,
            flash: 0,
            anim: 0,
            dying: 0,
            gone: false,
            bot_dir: if kind == SpawnKind::BotV { (0, 1) } else { (1, 0) },
            extra: false,
        }
    }

    /// (Re)create the guards from the template. `first_visit` makes them hold still and say their lines.
    pub(crate) fn spawn_guards(&mut self, first_visit: bool) {
        self.guards.clear();
        self.bubbles.clear();
        for &(k, x, y) in &self.tpl.spawns {
            self.guards.push(Self::make_guard(k, x, y));
        }
        // staggered first shots so two spies never fire in the same frame
        for (i, g) in self.guards.iter_mut().enumerate() {
            g.cool = 20 + i as u32 * 25;
        }
        if first_visit {
            self.add_intro_lines();
        }
    }

    fn add_intro_lines(&mut self) {
        let Some(lines) = copy::store_lines(self.id) else { return };
        let spies: Vec<usize> = self.guards.iter().enumerate().filter(|(_, g)| g.kind == GKind::Spy).map(|(i, _)| i).collect();
        let bots: Vec<usize> = self.guards.iter().enumerate().filter(|(_, g)| g.kind == GKind::Bot).map(|(i, _)| i).collect();
        if self.guards.is_empty() {
            return;
        }
        // A bot-only line (no second line) is spoken by the bot.
        let first = if lines.second_is_bot && lines.second.is_none() && !bots.is_empty() {
            bots[0]
        } else if !spies.is_empty() {
            spies[0]
        } else {
            0
        };
        self.bubbles.push(Bubble {
            guard: Some(first),
            x: 0,
            y: 0,
            text: lines.first.to_string(),
            delay: INTRO_FIRST_DELAY,
            left: INTRO_BUBBLE_FRAMES,
            intro: true,
        });
        if let Some(second) = lines.second {
            let who = if lines.second_is_bot {
                bots.first().copied()
            } else {
                spies.get(1).copied().or_else(|| spies.first().copied())
            }
            .or_else(|| self.guards.iter().position(|_| true))
            .unwrap_or(first);
            self.bubbles.push(Bubble {
                guard: Some(who),
                x: 0,
                y: 0,
                text: second.to_string(),
                delay: INTRO_FIRST_DELAY + INTRO_GAP,
                left: INTRO_BUBBLE_FRAMES,
                intro: true,
            });
        }
    }

    pub(crate) fn compute_dist(&mut self) {
        let (w, h) = (self.grid.w, self.grid.h);
        self.dist.clear();
        self.dist.resize((w * h) as usize, i32::MAX);
        let (cx, cy) = self.player_center();
        let (sx, sy) = ((cx.div_euclid(TILE)).clamp(0, w - 1), (cy.div_euclid(TILE)).clamp(0, h - 1));
        let mut q = std::collections::VecDeque::new();
        self.dist[(sy * w + sx) as usize] = 0;
        q.push_back((sx, sy));
        while let Some((x, y)) = q.pop_front() {
            let d = self.dist[(y * w + x) as usize];
            for dir in [Dir::Up, Dir::Down, Dir::Left, Dir::Right] {
                let (dx, dy) = dir.vec();
                let (nx, ny) = (x + dx, y + dy);
                if nx < 0 || ny < 0 || nx >= w || ny >= h {
                    continue;
                }
                let i = (ny * w + nx) as usize;
                if self.dist[i] != i32::MAX || !self.grid.tile(nx, ny).guard_walkable() {
                    continue;
                }
                self.dist[i] = d + 1;
                q.push_back((nx, ny));
            }
        }
    }

    pub(crate) fn step_world(&mut self, run: &mut RunState, out: &mut Out) {
        let intro = self.bubbles.iter().any(|b| b.intro);
        self.compute_dist();
        self.update_bullets(run, out);
        if self.player.dying > 0 {
            return;
        }
        self.update_toys(run, out);
        self.update_guards(intro, run, out);
    }

    fn update_guards(&mut self, intro: bool, run: &mut RunState, out: &mut Out) {
        let diff = run.difficulty();
        let spy_speed = SPY_SPEED * diff.spy_speed * Difficulty::alarm_speed_mul(run.alarm);
        let interval = diff.shot_interval();
        let can_shoot = self.grace == 0 && !intro;
        let (pcx, pcy) = self.player_center();
        let w = self.grid.w;

        for i in 0..self.guards.len() {
            if self.guards[i].gone {
                continue;
            }
            self.guards[i].anim += 1;
            if self.guards[i].flash > 0 {
                self.guards[i].flash -= 1;
            }
            if self.guards[i].dying > 0 {
                self.guards[i].dying += 1;
                if self.guards[i].dying >= GUARD_DEATH_FRAMES {
                    self.guards[i].gone = true;
                    let (x, y) = (self.guards[i].x.round() as i32, self.guards[i].y.round() as i32);
                    self.puffs.push(Puff { x, y, t: 0, spark: true });
                }
                continue;
            }
            if self.guards[i].stun > 0 {
                self.guards[i].stun -= 1;
                continue;
            }
            if intro {
                continue;
            }
            match self.guards[i].kind {
                GKind::Bot => {
                    let g = &mut self.guards[i];
                    let (dx, dy) = g.bot_dir;
                    let (nx, ny) = (g.x + dx as f32 * BOT_SPEED, g.y + dy as f32 * BOT_SPEED);
                    if guard_box_free(&self.grid, nx, ny) {
                        g.x = nx;
                        g.y = ny;
                    } else {
                        g.bot_dir = (-dx, -dy);
                    }
                    g.face = Dir::from_vec(g.bot_dir.0, g.bot_dir.1);
                }
                GKind::Spy => {
                    // Occupied tiles of the other guards (current and target).
                    let mut occupied: Vec<(i32, i32)> = Vec::new();
                    for (j, o) in self.guards.iter().enumerate() {
                        if j != i && !o.gone {
                            occupied.push((o.tx, o.ty));
                            if let Some(t) = o.target {
                                occupied.push(t);
                            }
                        }
                    }
                    let g = &mut self.guards[i];
                    // Telegraph, then fire along the line he is facing.
                    if g.aim > 0 {
                        g.aim -= 1;
                        if g.aim == 0 {
                            let (vx, vy) = g.face.vec();
                            let (cx, cy) = (g.x + 8.0, g.y + 8.0);
                            self.bullets.push(Bullet {
                                x: cx + vx as f32 * 8.0,
                                y: cy + vy as f32 * 8.0,
                                vx: vx as f32 * ENEMY_BULLET_SPEED,
                                vy: vy as f32 * ENEMY_BULLET_SPEED,
                                kind: BKind::Enemy,
                                volley: 0,
                                age: 0,
                            });
                            g.cool = interval + self.rng.below(30);
                            out.sfx(Sfx::EnemyShot);
                        }
                        continue;
                    }
                    if g.cool > 0 {
                        g.cool -= 1;
                    }
                    if g.wait > 0 {
                        g.wait -= 1;
                    }
                    // Walk towards the next tile centre.
                    if let Some((tx, ty)) = g.target {
                        let (gx, gy) = ((tx * TILE) as f32, (ty * TILE) as f32);
                        let step = |from: f32, to: f32| -> f32 {
                            let d = to - from;
                            if d.abs() <= spy_speed {
                                to
                            } else {
                                from + spy_speed * d.signum()
                            }
                        };
                        g.x = step(g.x, gx);
                        g.y = step(g.y, gy);
                        if g.x == gx && g.y == gy {
                            g.tx = tx;
                            g.ty = ty;
                            g.target = None;
                        }
                        continue;
                    }
                    // At a tile centre: shoot if lined up with a clear path, otherwise pick the next tile.
                    if can_shoot && g.cool == 0 {
                        if let Some(d) = lined_up(&self.grid, g.x.round() as i32 + 8, g.y.round() as i32 + 8, pcx, pcy) {
                            g.face = d;
                            g.aim = AIM_FRAMES;
                            continue;
                        }
                    }
                    if g.wait > 0 {
                        continue;
                    }
                    let here = self.dist.get((g.ty * w + g.tx).max(0) as usize).copied().unwrap_or(i32::MAX);
                    if here <= 1 && self.rng.chance(0.5) {
                        g.wait = 24;
                        continue;
                    }
                    let mut cands: Vec<(Dir, i32)> = Vec::new();
                    for d in [Dir::Up, Dir::Down, Dir::Left, Dir::Right] {
                        let (dx, dy) = d.vec();
                        let (nx, ny) = (g.tx + dx, g.ty + dy);
                        if !self.grid.tile(nx, ny).guard_walkable() || occupied.contains(&(nx, ny)) {
                            continue;
                        }
                        let dd = self.dist.get((ny * w + nx) as usize).copied().unwrap_or(i32::MAX);
                        cands.push((d, dd));
                    }
                    if cands.is_empty() {
                        g.wait = 20;
                        continue;
                    }
                    let pick = if self.rng.chance(0.65) {
                        let best = cands.iter().map(|c| c.1).min().unwrap();
                        let bests: Vec<&(Dir, i32)> = cands.iter().filter(|c| c.1 == best).collect();
                        bests[self.rng.below(bests.len() as u32) as usize].0
                    } else {
                        cands[self.rng.below(cands.len() as u32) as usize].0
                    };
                    let (dx, dy) = pick.vec();
                    g.face = pick;
                    g.target = Some((g.tx + dx, g.ty + dy));
                }
            }
        }

        // Contact: Cinnabomb kills spies, bots kill the agent.
        let pb = self.player_box();
        let invincible = run.power.is_invincible();
        for i in 0..self.guards.len() {
            let g = &self.guards[i];
            if g.gone || g.dying > 0 || !rects_overlap(guard_rect(g), pb) {
                continue;
            }
            match g.kind {
                GKind::Spy if invincible => self.kill_guard(i, run, out),
                GKind::Bot if g.stun == 0 && !intro => {
                    self.hurt_player(run, out);
                }
                _ => {}
            }
        }
    }

    /// Shot by the agent (or flattened by Cinnabomb).
    pub(crate) fn kill_guard(&mut self, i: usize, run: &mut RunState, out: &mut Out) {
        let g = &mut self.guards[i];
        if g.dying > 0 || g.gone {
            return;
        }
        g.dying = 1;
        g.aim = 0;
        g.flash = 0;
        out.sfx(Sfx::Splat);
        let (hx, hy) = (g.x.round() as i32 + 8, g.y.round() as i32 + 3);
        let is_bot = g.kind == GKind::Bot;
        run.add_score(if is_bot { PTS_SPY_SHOT * 2 } else { PTS_SPY_SHOT }, out);
        if !is_bot && self.rng.chance(0.35) {
            let line = *self.rng.pick(&copy::LAST_WORDS);
            self.bubbles.push(Bubble { guard: None, x: hx, y: hy, text: line.to_string(), delay: 0, left: 70, intro: false });
        }
    }

    pub(crate) fn hit_guard(&mut self, i: usize, run: &mut RunState, out: &mut Out) {
        if self.guards[i].kind == GKind::Spy {
            self.kill_guard(i, run, out);
        } else {
            let g = &mut self.guards[i];
            g.hp -= 1;
            g.flash = 8;
            out.sfx(Sfx::HelmetPing);
            if g.hp <= 0 {
                self.kill_guard(i, run, out);
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Bullets
    // -----------------------------------------------------------------------------------------------------

    fn update_bullets(&mut self, run: &mut RunState, out: &mut Out) {
        let bullets = std::mem::take(&mut self.bullets);
        let mut keep: Vec<Bullet> = Vec::new();
        let (w, h) = (self.grid.px_w() as f32, self.grid.px_h() as f32);
        for mut b in bullets {
            b.x += b.vx;
            b.y += b.vy;
            b.age += 1;
            if b.x < 0.0 || b.y < 0.0 || b.x >= w || b.y >= h || b.age > 600 {
                continue;
            }
            let (tx, ty) = ((b.x as i32).div_euclid(TILE), (b.y as i32).div_euclid(TILE));
            let tile = self.grid.tile(tx, ty);
            let stops = if b.kind == BKind::Shoe { tile == Tile::Wall } else { tile.solid() };
            if stops {
                if b.kind == BKind::Player && tile == Tile::ToyShelf {
                    if let Some(f) = self.tpl.fixture_index(tx, ty) {
                        self.release_toys(f, out);
                    }
                }
                if b.kind == BKind::Player {
                    self.puffs.push(Puff { x: b.x as i32 - 4, y: b.y as i32 - 4, t: 16, spark: true });
                }
                continue;
            }
            let brect = (b.x as i32 - 2, b.y as i32 - 2, 4, 4);
            match b.kind {
                BKind::Player => {
                    let mut hit = None;
                    for (i, g) in self.guards.iter().enumerate() {
                        if !g.gone && g.dying == 0 && rects_overlap(guard_rect(g), brect) {
                            hit = Some(i);
                            break;
                        }
                    }
                    if let Some(i) = hit {
                        self.hit_guard(i, run, out);
                        continue;
                    }
                }
                BKind::Enemy | BKind::Shoe => {
                    if rects_overlap(self.player_box(), brect) {
                        if self.player.invuln > 0 || run.power.is_invincible() || self.player.dying > 0 {
                            // passes through a blinking / invincible agent
                        } else {
                            self.hurt_player(run, out);
                            continue;
                        }
                    }
                }
            }
            keep.push(b);
        }
        self.bullets.extend(keep);
    }

    // -----------------------------------------------------------------------------------------------------
    // KGB Toys wind-up toys
    // -----------------------------------------------------------------------------------------------------

    /// Shooting a toy shelf releases 3 wind-up toys (once per shelf per visit).
    pub(crate) fn release_toys(&mut self, fidx: usize, out: &mut Out) {
        if self.released.contains(&fidx) {
            return;
        }
        self.released.push(fidx);
        let (fx, fy) = self.tpl.fixtures[fidx];
        // free neighbours first, nearest tiles after
        let mut spots: Vec<(i32, i32, Dir)> = Vec::new();
        for d in [Dir::Down, Dir::Left, Dir::Right, Dir::Up] {
            let (dx, dy) = d.vec();
            if !self.grid.tile(fx + dx, fy + dy).solid() {
                spots.push((fx + dx, fy + dy, d));
            }
        }
        if spots.is_empty() {
            return;
        }
        for k in 0..3 {
            let (sx, sy, d) = spots[k % spots.len()];
            let (dx, dy) = if k >= spots.len() { d.opposite().vec() } else { d.vec() };
            // march away from the shelf, the three a little apart
            let off = (k as i32 - 1) * 3;
            self.toys.push(Toy {
                x: (sx * TILE + if dy != 0 { off } else { 0 }) as f32,
                y: (sy * TILE + if dx != 0 { off } else { 0 }) as f32,
                dx,
                dy,
                t: 0,
            });
        }
        out.sfx(Sfx::Tick);
    }

    fn update_toys(&mut self, run: &mut RunState, out: &mut Out) {
        let toys = std::mem::take(&mut self.toys);
        let mut keep = Vec::new();
        for mut t in toys {
            t.t += 1;
            if t.t > TOY_LIFE {
                self.puffs.push(Puff { x: t.x as i32, y: t.y as i32, t: 0, spark: true });
                continue;
            }
            let (nx, ny) = (t.x + t.dx as f32 * TOY_SPEED, t.y + t.dy as f32 * TOY_SPEED);
            let tb = |x: f32, y: f32| (x.round() as i32 + 3, y.round() as i32 + 4, 10, 10);
            let blocked_tile = {
                let r = tb(nx, ny);
                let mut hit: Option<(i32, i32)> = None;
                'o: for ty in r.1.div_euclid(TILE)..=(r.1 + r.3 - 1).div_euclid(TILE) {
                    for tx in r.0.div_euclid(TILE)..=(r.0 + r.2 - 1).div_euclid(TILE) {
                        if self.grid.tile(tx, ty).solid() {
                            hit = Some((tx, ty));
                            break 'o;
                        }
                    }
                }
                hit
            };
            if let Some((tx, ty)) = blocked_tile {
                // A trap fixture in the way goes off.
                if let Some(f) = self.tpl.fixture_index(tx, ty) {
                    if !run.is_opened(self.id, f) && self.fixture_content(run, f) == Content::Trap {
                        self.trigger_trap(f, run, out);
                    }
                }
                // turn right (clockwise)
                let (dx, dy) = (-t.dy, t.dx);
                t.dx = dx;
                t.dy = dy;
            } else {
                t.x = nx;
                t.y = ny;
            }
            // Stun any guard it touches.
            let tr = tb(t.x, t.y);
            for g in &mut self.guards {
                if !g.gone && g.dying == 0 && g.stun < 30 && rects_overlap(guard_rect(g), tr) {
                    g.stun = GUARD_STUN;
                    g.aim = 0;
                    g.target = None.or(g.target);
                    out.sfx(Sfx::Thud);
                }
            }
            keep.push(t);
        }
        self.toys = keep;
    }

    /// A trap fixture goes off (set off by a toy): smoke that stuns nearby guards; the fixture stays opened.
    pub(crate) fn trigger_trap(&mut self, fidx: usize, run: &mut RunState, out: &mut Out) {
        run.opened.insert((self.id, fidx));
        let (fx, fy) = self.tpl.fixtures[fidx];
        let (cx, cy) = (fx * TILE + 8, fy * TILE + 8);
        self.puffs.push(Puff { x: cx - 8, y: cy - 8, t: 0, spark: false });
        out.sfx(Sfx::Smoke);
        for g in &mut self.guards {
            if g.gone || g.dying > 0 {
                continue;
            }
            let (gx, gy) = (g.x.round() as i32 + 8, g.y.round() as i32 + 8);
            if (gx - cx).abs().max((gy - cy).abs()) <= SMOKE_RADIUS {
                g.stun = GUARD_STUN;
                g.aim = 0;
            }
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // Forever 12 fitting rooms
    // -----------------------------------------------------------------------------------------------------

    /// A spy was changing in the fitting room: he shrieks, throws a shoe, then fights. The fixture stays
    /// unsearched. Returns false if there was no room for him.
    pub(crate) fn reveal_fitting(&mut self, fidx: usize, _run: &mut RunState, out: &mut Out) -> bool {
        if self.guards.iter().filter(|g| !g.gone && g.dying == 0).count() >= MAX_GUARDS {
            return false;
        }
        let (fx, fy) = self.tpl.fixtures[fidx];
        let (pcx, pcy) = self.player_center();
        let mut best: Option<(i32, i32, i32)> = None;
        for d in [Dir::Down, Dir::Left, Dir::Right, Dir::Up] {
            let (dx, dy) = d.vec();
            let (nx, ny) = (fx + dx, fy + dy);
            if !self.grid.tile(nx, ny).guard_walkable() {
                continue;
            }
            // not on top of the agent
            let r = (nx * TILE, ny * TILE, TILE, TILE);
            if rects_overlap(r, self.player_box()) {
                continue;
            }
            if self.guards.iter().any(|g| !g.gone && g.tx == nx && g.ty == ny) {
                continue;
            }
            // He pops out on the side AWAY from the agent when there is a choice, so the shoe is dodgeable.
            let dist = (nx * TILE + 8 - pcx).abs() + (ny * TILE + 8 - pcy).abs();
            let score = if dist < 20 { dist - 1000 } else { dist };
            if best.map_or(true, |b| score > b.2) {
                best = Some((nx, ny, score));
            }
        }
        let Some((sx, sy, _)) = best else { return false };
        let mut g = Self::make_guard(SpawnKind::Spy, sx, sy);
        g.extra = true;
        g.cool = 75;
        g.wait = 20;
        let gcx = g.x + 8.0;
        let gcy = g.y + 8.0;
        let d = Dir::from_vec(pcx - gcx as i32, pcy - gcy as i32);
        g.face = d;
        self.guards.push(g);
        let idx = self.guards.len() - 1;
        out.sfx(Sfx::Shriek);
        self.bubbles.push(Bubble {
            guard: Some(idx),
            x: 0,
            y: 0,
            text: copy::FITTING_ROOM_SHRIEK.to_string(),
            delay: 0,
            left: 60,
            intro: false,
        });
        // The shoe is lobbed straight at the agent (over fixtures, but not through walls).
        let (sx, sy) = ((pcx as f32 - gcx).max(-1000.0), (pcy as f32 - gcy).max(-1000.0));
        let m = sx.abs().max(sy.abs()).max(1.0);
        self.bullets.push(Bullet {
            x: gcx,
            y: gcy,
            vx: sx / m * SHOE_SPEED,
            vy: sy / m * SHOE_SPEED,
            kind: BKind::Shoe,
            volley: 0,
            age: 0,
        });
        self.show_banner(copy::FITTING_ROOM_SHRIEK, (crate::pixel::pal::WHITE, crate::pixel::pal::MAGENTA, crate::pixel::pal::WHITE));
        true
    }
}

#[allow(dead_code)]
fn _unused(_: &Rng) {}
