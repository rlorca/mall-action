//! Power-up slots and timers. Timers tick every simulation step (in the mall AND in stores);
//! they only stop when the game is not stepping (map, pause, continue).
use crate::rng::Rng;
use crate::stores::StoreId;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PowerKind {
    Rapid,
    Spread,
    Armor,
    Sneakers,
    Radar,
    OneUp,
    Cinnabomb,
    Ooze,
    Pretzel,
}

pub const SEC: i32 = 60;

impl PowerKind {
    pub fn name(self) -> &'static str {
        crate::copy::POWERUP_NAMES[self as usize]
    }
    pub fn sprite(self) -> &'static str {
        match self {
            PowerKind::Rapid => "item_rapid",
            PowerKind::Spread => "item_spread",
            PowerKind::Armor => "item_armor",
            PowerKind::Sneakers => "item_sneakers",
            PowerKind::Radar => "item_radar",
            PowerKind::OneUp => "item_1up",
            PowerKind::Cinnabomb => "item_cinnabomb",
            PowerKind::Ooze => "item_ooze",
            PowerKind::Pretzel => "item_pretzel",
        }
    }
    pub fn is_food(self) -> bool {
        matches!(self, PowerKind::Cinnabomb | PowerKind::Ooze | PowerKind::Pretzel)
    }
    /// Random power-up for a fixture in `store` (food mostly from Hot Spy on a Stick).
    pub fn random_pickup(rng: &mut Rng, store: StoreId) -> PowerKind {
        if store == StoreId::HotSpyOnAStick && rng.chance(75) {
            return *rng.pick(&[PowerKind::Cinnabomb, PowerKind::Ooze, PowerKind::Pretzel]);
        }
        let all = [
            PowerKind::Rapid,
            PowerKind::Spread,
            PowerKind::Armor,
            PowerKind::Sneakers,
            PowerKind::Radar,
            PowerKind::OneUp,
        ];
        // 1-ups are rare
        loop {
            let k = *rng.pick(&all);
            if k == PowerKind::OneUp && !rng.chance(25) {
                continue;
            }
            return k;
        }
    }
    /// Random drop from a dead spy: 5% chance is rolled by the caller; half of the drops are food.
    pub fn random_drop(rng: &mut Rng) -> PowerKind {
        if rng.chance(50) {
            *rng.pick(&[PowerKind::Cinnabomb, PowerKind::Ooze, PowerKind::Pretzel])
        } else {
            *rng.pick(&[PowerKind::Rapid, PowerKind::Spread, PowerKind::Armor, PowerKind::Sneakers])
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Weapon {
    Normal,
    Rapid,
    Spread,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpeedKind {
    Sneakers,
    Ooze,
}

#[derive(Clone, Debug, Default)]
pub struct Powers {
    pub weapon: Option<(Weapon, i32)>,
    pub speed: Option<(SpeedKind, i32)>,
    pub armor: bool,
    pub radar: bool,
    pub cinna: i32,
    /// Which timed power-up the HUD shows: (name, frames left, total frames).
    pub hud_pick: Option<PowerKind>,
}

pub const RAPID_T: i32 = 20 * SEC;
pub const SNEAKERS_T: i32 = 20 * SEC;
pub const OOZE_T: i32 = 12 * SEC;
pub const CINNA_T: i32 = 6 * SEC;

impl Powers {
    pub fn new() -> Powers {
        Powers::default()
    }
    /// Apply a pickup. Returns true if it was a 1-up (the caller adds the life).
    pub fn grant(&mut self, k: PowerKind) -> bool {
        match k {
            PowerKind::Rapid => {
                self.weapon = Some((Weapon::Rapid, RAPID_T));
                self.hud_pick = Some(k);
            }
            PowerKind::Spread => {
                self.weapon = Some((Weapon::Spread, RAPID_T));
                self.hud_pick = Some(k);
            }
            PowerKind::Armor | PowerKind::Pretzel => {
                self.armor = true;
            }
            PowerKind::Sneakers => {
                self.speed = Some((SpeedKind::Sneakers, SNEAKERS_T));
                self.hud_pick = Some(k);
            }
            PowerKind::Ooze => {
                self.speed = Some((SpeedKind::Ooze, OOZE_T));
                self.hud_pick = Some(k);
            }
            PowerKind::Radar => self.radar = true,
            PowerKind::OneUp => return true,
            PowerKind::Cinnabomb => {
                self.cinna = CINNA_T;
                self.hud_pick = Some(k);
            }
        }
        false
    }
    pub fn tick(&mut self) {
        if let Some((w, t)) = self.weapon {
            self.weapon = if t <= 1 { None } else { Some((w, t - 1)) };
        }
        if let Some((s, t)) = self.speed {
            self.speed = if t <= 1 { None } else { Some((s, t - 1)) };
        }
        if self.cinna > 0 {
            self.cinna -= 1;
        }
        if self.hud_timer().is_none() {
            self.hud_pick = None;
        }
    }
    /// Everything is lost on death except Radar.
    pub fn on_death(&mut self) {
        let radar = self.radar;
        *self = Powers::default();
        self.radar = radar;
    }
    /// Continue: power-ups are reset (Radar too).
    pub fn reset_all(&mut self) {
        *self = Powers::default();
    }
    pub fn weapon_kind(&self) -> Weapon {
        self.weapon.map(|w| w.0).unwrap_or(Weapon::Normal)
    }
    pub fn walk_speed(&self) -> f32 {
        if self.speed.is_some() {
            1.5
        } else {
            1.0
        }
    }
    pub fn fast_search(&self) -> bool {
        matches!(self.speed, Some((SpeedKind::Sneakers, _)))
    }
    pub fn high_jump(&self) -> bool {
        matches!(self.speed, Some((SpeedKind::Sneakers, _)))
    }
    pub fn invincible(&self) -> bool {
        self.cinna > 0
    }
    /// (kind, frames left, total) for the HUD bar: the most recently granted timed power-up still running.
    pub fn hud_timer(&self) -> Option<(PowerKind, i32, i32)> {
        let cands = [
            (self.cinna > 0).then_some((PowerKind::Cinnabomb, self.cinna, CINNA_T)),
            self.weapon.map(|(w, t)| match w {
                Weapon::Spread => (PowerKind::Spread, t, RAPID_T),
                _ => (PowerKind::Rapid, t, RAPID_T),
            }),
            self.speed.map(|(s, t)| match s {
                SpeedKind::Sneakers => (PowerKind::Sneakers, t, SNEAKERS_T),
                SpeedKind::Ooze => (PowerKind::Ooze, t, OOZE_T),
            }),
        ];
        if let Some(p) = self.hud_pick {
            if let Some(c) = cands.iter().flatten().find(|c| c.0 == p) {
                return Some(*c);
            }
        }
        cands.into_iter().flatten().next()
    }
    /// Fire cooldown (frames) and max bullets alive.
    pub fn fire_params(&self) -> (i32, usize) {
        match self.weapon_kind() {
            Weapon::Rapid => (8, 4),
            _ => (18, 2),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_weapon_at_a_time() {
        let mut p = Powers::new();
        p.grant(PowerKind::Rapid);
        p.grant(PowerKind::Spread);
        assert_eq!(p.weapon_kind(), Weapon::Spread);
        p.grant(PowerKind::Rapid);
        assert_eq!(p.weapon_kind(), Weapon::Rapid);
    }
    #[test]
    fn armor_speed_radar_stack_with_weapon() {
        let mut p = Powers::new();
        p.grant(PowerKind::Rapid);
        p.grant(PowerKind::Armor);
        p.grant(PowerKind::Sneakers);
        p.grant(PowerKind::Radar);
        assert!(p.armor && p.radar && p.speed.is_some() && p.weapon.is_some());
        assert!(p.walk_speed() > 1.0 && p.high_jump() && p.fast_search());
    }
    #[test]
    fn timers_expire_after_their_duration() {
        let mut p = Powers::new();
        p.grant(PowerKind::Rapid);
        for _ in 0..RAPID_T - 1 {
            p.tick();
        }
        assert!(p.weapon.is_some());
        p.tick();
        assert!(p.weapon.is_none());
        p.grant(PowerKind::Cinnabomb);
        for _ in 0..CINNA_T {
            p.tick();
        }
        assert!(!p.invincible());
    }
    #[test]
    fn ooze_shares_the_sneakers_slot_but_is_not_a_high_jump() {
        let mut p = Powers::new();
        p.grant(PowerKind::Sneakers);
        p.grant(PowerKind::Ooze);
        assert!(matches!(p.speed, Some((SpeedKind::Ooze, _))));
        assert!(!p.high_jump());
        assert_eq!(p.walk_speed(), 1.5);
    }
    #[test]
    fn pretzel_is_armor() {
        let mut p = Powers::new();
        p.grant(PowerKind::Pretzel);
        assert!(p.armor);
    }
    #[test]
    fn death_keeps_only_radar() {
        let mut p = Powers::new();
        for k in [PowerKind::Rapid, PowerKind::Armor, PowerKind::Sneakers, PowerKind::Radar, PowerKind::Cinnabomb] {
            p.grant(k);
        }
        p.on_death();
        assert!(p.radar);
        assert!(p.weapon.is_none() && p.speed.is_none() && !p.armor && p.cinna == 0);
        p.reset_all();
        assert!(!p.radar);
    }
    #[test]
    fn one_up_is_instant_not_a_slot() {
        let mut p = Powers::new();
        assert!(p.grant(PowerKind::OneUp));
    }
    #[test]
    fn rapid_fires_faster_with_more_bullets() {
        let mut p = Powers::new();
        let base = p.fire_params();
        p.grant(PowerKind::Rapid);
        let r = p.fire_params();
        assert!(r.0 < base.0 && r.1 == 4 && base.1 == 2);
    }
    #[test]
    fn food_comes_mostly_from_hot_spy() {
        let mut rng = Rng::new(3);
        let food = (0..400).filter(|_| PowerKind::random_pickup(&mut rng, StoreId::HotSpyOnAStick).is_food()).count();
        let other = (0..400).filter(|_| PowerKind::random_pickup(&mut rng, StoreId::SamBaddy).is_food()).count();
        assert!(food > 250 && other == 0);
    }
    #[test]
    fn hud_shows_most_recent_timed_powerup() {
        let mut p = Powers::new();
        p.grant(PowerKind::Rapid);
        p.grant(PowerKind::Sneakers);
        assert_eq!(p.hud_timer().unwrap().0, PowerKind::Sneakers);
    }
}
