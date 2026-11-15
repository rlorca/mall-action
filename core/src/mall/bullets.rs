//! The one shared bullet system: player and enemy bullets live here. Positions are fixed point (1/16 px) so
//! spread shots can drift vertically by sub-pixel amounts. Bullets only exist inside their floor's corridor.

use crate::layout::{floor_y, WALL_L, WALL_R};
use crate::pixel::Rect;
use crate::types::Floor;

use super::world::CORRIDOR_H;

pub const PLAYER_BULLET_SPEED: i32 = 4;
pub const ENEMY_BULLET_SPEED: i32 = 2;
const FX: i32 = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Owner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Bullet {
    pub owner: Owner,
    /// 1/16 px.
    pub x16: i32,
    pub y16: i32,
    pub vx16: i32,
    pub vy16: i32,
    /// The floor the bullet was fired on; it dies when it leaves that corridor.
    pub floor: Floor,
    /// Shots fired together (a spread volley) share a group; the on-screen cap counts groups.
    pub group: u32,
    pub age: u32,
}

impl Bullet {
    pub fn x(&self) -> i32 {
        self.x16.div_euclid(FX)
    }
    pub fn y(&self) -> i32 {
        self.y16.div_euclid(FX)
    }
    /// The 4x2 hit rectangle (centred on the position).
    pub fn rect(&self) -> Rect {
        Rect::new(self.x() - 2, self.y() - 1, 4, 2)
    }
}

#[derive(Clone, Debug, Default)]
pub struct Bullets {
    pub list: Vec<Bullet>,
    next_group: u32,
}

impl Bullets {
    pub fn new() -> Bullets {
        Bullets::default()
    }

    pub fn clear(&mut self) {
        self.list.clear();
    }

    /// Fire one bullet. `vx`/`vy` are px per frame (whole numbers); `vy16` adds sub-pixel drift (1/16 px).
    pub fn fire(&mut self, owner: Owner, x: i32, y: i32, vx: i32, vy16: i32, floor: Floor, group: u32) {
        self.list.push(Bullet { owner, x16: x * FX, y16: y * FX, vx16: vx * FX, vy16, floor, group, age: 0 });
    }

    /// Start a new volley id (one or three bullets that count as a single shot).
    pub fn new_group(&mut self) -> u32 {
        self.next_group += 1;
        self.next_group
    }

    /// Convenience for spies: one enemy bullet flying left/right at 2 px/frame.
    pub fn fire_enemy(&mut self, x: i32, y: i32, dir: i32, floor: Floor) {
        let g = self.new_group();
        self.fire(Owner::Enemy, x, y, dir * ENEMY_BULLET_SPEED, 0, floor, g);
    }

    /// Volleys of player bullets currently alive.
    pub fn player_volleys(&self) -> usize {
        let mut groups: Vec<u32> = self.list.iter().filter(|b| b.owner == Owner::Player).map(|b| b.group).collect();
        groups.sort_unstable();
        groups.dedup();
        groups.len()
    }

    pub fn count(&self, owner: Owner) -> usize {
        self.list.iter().filter(|b| b.owner == owner).count()
    }

    /// Move everything one frame. Player bullets also die when they leave the visible span `[view_l, view_r]`.
    pub fn step(&mut self, view_l: i32, view_r: i32) {
        for b in self.list.iter_mut() {
            b.x16 += b.vx16;
            b.y16 += b.vy16;
            b.age += 1;
        }
        self.list.retain(|b| {
            let x = b.x();
            let y = b.y();
            let fy = floor_y(b.floor);
            if x < WALL_L || x > WALL_R || y > fy || y < fy - CORRIDOR_H {
                return false;
            }
            if b.owner == Owner::Player && (x < view_l - 4 || x > view_r + 4) {
                return false;
            }
            b.age < 600
        });
    }

    /// Remove and return the first bullet of `owner` overlapping `r` (a spy being shot, the player being hit).
    pub fn take_hit(&mut self, r: Rect, owner: Owner) -> Option<Bullet> {
        let i = self.list.iter().position(|b| b.owner == owner && b.rect().intersects(&r))?;
        Some(self.list.remove(i))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn player_bullets_fly_four_pixels_per_frame() {
        let mut b = Bullets::new();
        let g = b.new_group();
        b.fire(Owner::Player, 100, floor_y(Floor::F3) - 15, PLAYER_BULLET_SPEED, 0, Floor::F3, g);
        for _ in 0..10 {
            b.step(0, 768);
        }
        assert_eq!(b.list[0].x(), 140);
    }

    #[test]
    fn bullets_die_at_walls_and_off_screen() {
        let mut b = Bullets::new();
        let g = b.new_group();
        b.fire(Owner::Enemy, 20, floor_y(Floor::F3) - 15, -2, 0, Floor::F3, g);
        for _ in 0..20 {
            b.step(0, 768);
        }
        assert!(b.list.is_empty(), "enemy bullet must die at the left wall");
        b.fire(Owner::Player, 100, floor_y(Floor::F3) - 15, 4, 0, Floor::F3, g);
        for _ in 0..40 {
            b.step(0, 200);
        }
        assert!(b.list.is_empty(), "player bullet must die when it leaves the screen");
    }

    #[test]
    fn spread_drift_ends_when_leaving_the_corridor() {
        let mut b = Bullets::new();
        let g = b.new_group();
        b.fire(Owner::Player, 100, floor_y(Floor::F3) - 15, 4, -16, Floor::F3, g);
        for _ in 0..60 {
            b.step(0, 768);
        }
        assert!(b.list.is_empty());
    }

    #[test]
    fn volleys_count_as_one_shot() {
        let mut b = Bullets::new();
        let g = b.new_group();
        for vy in [-8, 0, 8] {
            b.fire(Owner::Player, 100, floor_y(Floor::Parking) - 15, 4, vy, Floor::Parking, g);
        }
        assert_eq!(b.player_volleys(), 1);
        assert_eq!(b.count(Owner::Player), 3);
    }

    #[test]
    fn take_hit_removes_one_matching_bullet() {
        let mut b = Bullets::new();
        let g = b.new_group();
        b.fire(Owner::Enemy, 100, 150, 2, 0, Floor::F4, g);
        assert!(b.take_hit(Rect::new(90, 140, 20, 20), Owner::Player).is_none());
        assert!(b.take_hit(Rect::new(90, 140, 20, 20), Owner::Enemy).is_some());
        assert!(b.list.is_empty());
    }
}
