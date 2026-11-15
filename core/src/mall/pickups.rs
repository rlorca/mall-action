//! Things lying on the floor: power-ups dropped by spies (collected by touching: `run.power.grant`, +50,
//! `Sfx::PowerUp`, a banner with the name; the 1-Up gives a life) and the bouncing coins the fountains spray
//! (+50 each; the gold one is an extra life). Other hooks hand things over through `core.drops`.

use crate::art;
use crate::events::Sfx;
use crate::layout::{floor_y, WALL_L, WALL_R};
use crate::pixel::{Fb, Rect};
use crate::powerup::Granted;
use crate::run::{RunState, PTS_COIN, PTS_POWERUP};
use crate::types::{Floor, PowerUp};

use super::camera::Camera;
use super::state::{Ctx, DropKind};

/// A dropped power-up stays this long (15 s) and blinks for the last 2 s.
pub const PICKUP_FRAMES: u32 = 900;
pub const PICKUP_BLINK: u32 = 120;
/// Coins rest on the floor this long (10 s) before they vanish.
pub const COIN_FRAMES: u32 = 600;
const COIN_GRAVITY_16: i32 = 5;

#[derive(Clone, Copy, Debug)]
pub struct Pickup {
    pub floor: Floor,
    pub x: i32,
    pub item: PowerUp,
    pub age: u32,
}

impl Pickup {
    pub fn rect(&self) -> Rect {
        Rect::new(self.x - 7, floor_y(self.floor) - 15, 14, 15)
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Coin {
    pub floor: Floor,
    pub x16: i32,
    /// Bottom of the coin in 1/16 px.
    pub y16: i32,
    pub vx16: i32,
    pub vy16: i32,
    pub gold: bool,
    pub age: u32,
    pub bounces: u32,
}

impl Coin {
    pub fn x(&self) -> i32 {
        self.x16 >> 4
    }
    pub fn y(&self) -> i32 {
        self.y16 >> 4
    }
    pub fn rect(&self) -> Rect {
        Rect::new(self.x() - 4, self.y() - 8, 8, 8)
    }
    pub fn resting(&self) -> bool {
        self.y() >= floor_y(self.floor) && self.vy16 == 0
    }
}

#[derive(Clone, Debug, Default)]
pub struct Pickups {
    pub items: Vec<Pickup>,
    pub coins: Vec<Coin>,
}

impl Pickups {
    pub fn new() -> Pickups {
        Pickups::default()
    }

    pub fn clear(&mut self) {
        // what lies on the floor stays after a respawn
    }

    pub fn step(&mut self, ctx: &mut Ctx) {
        // ---- new arrivals
        let drops: Vec<_> = ctx.core.drops.drain(..).collect();
        for d in drops {
            match d.kind {
                DropKind::Power(item) => self.items.push(Pickup { floor: d.floor, x: d.x, item, age: 0 }),
                DropKind::Coin { vx16, vy16, gold } => {
                    self.coins.push(Coin { floor: d.floor, x16: d.x << 4, y16: d.y << 4, vx16, vy16, gold, age: 0, bounces: 0 });
                }
            }
        }
        let pv = ctx.core.player_view();
        let can_grab = !pv.dying && !pv.in_arrival && !pv.hidden;
        let grab_box = Rect::new(pv.hitbox.x - 3, pv.hitbox.y - 2, pv.hitbox.w + 6, pv.hitbox.h + 4);

        // ---- power-ups
        let mut i = 0;
        while i < self.items.len() {
            self.items[i].age += 1;
            let it = self.items[i];
            if can_grab && it.rect().intersects(&grab_box) {
                self.items.remove(i);
                match ctx.run.power.grant(it.item) {
                    Granted::ExtraLife => ctx.run.extra_life(ctx.out),
                    _ => {}
                }
                ctx.run.add_score(PTS_POWERUP, ctx.out);
                ctx.out.sfx(Sfx::PowerUp);
                ctx.core.banner.show(it.item.name(), 90);
                continue;
            }
            if it.age >= PICKUP_FRAMES {
                self.items.remove(i);
                continue;
            }
            i += 1;
        }

        // ---- coins
        let mut i = 0;
        while i < self.coins.len() {
            let fy16 = floor_y(self.coins[i].floor) << 4;
            {
                let c = &mut self.coins[i];
                c.age += 1;
                if c.y16 < fy16 || c.vy16 < 0 {
                    c.vy16 += COIN_GRAVITY_16;
                    c.y16 += c.vy16;
                    c.x16 += c.vx16;
                    c.x16 = c.x16.clamp((WALL_L + 6) << 4, (WALL_R - 6) << 4);
                    if c.y16 >= fy16 {
                        c.y16 = fy16;
                        if c.bounces >= 3 || c.vy16 < 24 {
                            c.vy16 = 0;
                            c.vx16 = 0;
                        } else {
                            c.vy16 = -c.vy16 * 9 / 16;
                            c.vx16 = c.vx16 * 3 / 4;
                            c.bounces += 1;
                        }
                    }
                }
            }
            let c = self.coins[i];
            if can_grab && c.rect().intersects(&grab_box) {
                self.coins.remove(i);
                if c.gold {
                    ctx.run.extra_life(ctx.out);
                    ctx.core.banner.show("1-UP!", 90);
                } else {
                    ctx.run.add_score(PTS_COIN, ctx.out);
                    ctx.out.sfx(Sfx::Coins);
                }
                continue;
            }
            if c.age >= COIN_FRAMES + 60 {
                self.coins.remove(i);
                continue;
            }
            i += 1;
        }
    }

    // ------------------------------------------------------------------------------------------ drawing

    pub fn draw(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, tick: u32) {
        for it in &self.items {
            if it.age + PICKUP_BLINK > PICKUP_FRAMES && (it.age / 4) % 2 == 0 {
                continue;
            }
            if !cam.sees_x(it.x - 8, it.x + 8) {
                continue;
            }
            // bobbing a few px above the floor with a soft shadow
            let bob = [0, 1, 2, 2, 1, 0][((tick / 6) % 6) as usize];
            let fy = floor_y(it.floor);
            fb.rect(cam.sx(it.x - 4), cam.sy(fy - 1), 8, 1, crate::pixel::pal::BLACK);
            fb.blit(art::get(it.item.sprite_name()), 0, cam.sx(it.x - 6), cam.sy(fy - 15 - bob), false);
        }
        for c in &self.coins {
            if c.age + 60 > COIN_FRAMES && (c.age / 3) % 2 == 0 {
                continue;
            }
            let name = if c.gold { "gold_coin" } else { "coin" };
            fb.blit(art::get(name), ((c.age / 5) % 4) as usize, cam.sx(c.x() - 4), cam.sy(c.y() - 8), false);
        }
    }

    pub fn draw_top(&self, _fb: &mut Fb, _cam: &Camera, _run: &RunState, _tick: u32) {}
}

#[cfg(test)]
mod tests {}
