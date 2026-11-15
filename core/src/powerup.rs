//! Power-up slots and timers. One weapon at a time; armour, speed and radar stack with it.
//! Timers tick once per un-paused frame regardless of whether the player is in the mall or a store
//! (the Game calls `step` each frame except in the map, pause and continue screens).

use crate::types::PowerUp;

pub const WEAPON_FRAMES: u32 = 20 * 60;
pub const SNEAKERS_FRAMES: u32 = 20 * 60;
pub const JUICE_FRAMES: u32 = 12 * 60;
pub const CINNABOMB_FRAMES: u32 = 6 * 60;
/// Speed multiplier for Sneakers and Orange Juli-Ooze.
pub const SPEED_MUL: f32 = 1.5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Timed {
    pub kind: PowerUp,
    pub left: u32,
    pub total: u32,
}

/// What happened when a power-up was granted (for banners / lives).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Granted {
    Nothing,
    ExtraLife,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PowerState {
    /// Rapid fire or spread shot.
    pub weapon: Option<Timed>,
    /// Sneakers or Orange Juli-Ooze (share the slot).
    pub speed: Option<Timed>,
    /// Cinnabomb invincibility.
    pub invincible: Option<Timed>,
    /// Armor vest or soft pretzel: absorbs one hit.
    pub armor: bool,
    /// Radar: reveals package fixtures and package stores for the rest of the level. Survives death.
    pub radar: bool,
}

impl PowerState {
    pub fn new() -> PowerState {
        PowerState::default()
    }

    /// Grant a power-up. Lives are handled by the caller via the return value.
    pub fn grant(&mut self, p: PowerUp) -> Granted {
        match p {
            PowerUp::RapidFire | PowerUp::SpreadShot => {
                self.weapon = Some(Timed { kind: p, left: WEAPON_FRAMES, total: WEAPON_FRAMES });
            }
            PowerUp::ArmorVest | PowerUp::SoftPretzel => self.armor = true,
            PowerUp::Sneakers => {
                self.speed = Some(Timed { kind: p, left: SNEAKERS_FRAMES, total: SNEAKERS_FRAMES });
            }
            PowerUp::OrangeJuliOoze => {
                self.speed = Some(Timed { kind: p, left: JUICE_FRAMES, total: JUICE_FRAMES });
            }
            PowerUp::Radar => self.radar = true,
            PowerUp::OneUp => return Granted::ExtraLife,
            PowerUp::Cinnabomb => {
                self.invincible = Some(Timed { kind: p, left: CINNABOMB_FRAMES, total: CINNABOMB_FRAMES });
            }
        }
        Granted::Nothing
    }

    pub fn step(&mut self) {
        for slot in [&mut self.weapon, &mut self.speed, &mut self.invincible] {
            if let Some(t) = slot {
                if t.left <= 1 {
                    *slot = None;
                } else {
                    t.left -= 1;
                }
            }
        }
    }

    /// Everything is lost on death except radar.
    pub fn on_death(&mut self) {
        let radar = self.radar;
        *self = PowerState::default();
        self.radar = radar;
    }

    /// A continue resets all power-ups (radar too).
    pub fn reset_all(&mut self) {
        *self = PowerState::default();
    }

    /// New level: the radar only lasts for the level.
    pub fn on_new_level(&mut self) {
        self.radar = false;
    }

    /// Absorb a hit with armour if present. Returns true if the hit was absorbed.
    pub fn absorb_hit(&mut self) -> bool {
        if self.armor {
            self.armor = false;
            true
        } else {
            false
        }
    }

    pub fn is_invincible(&self) -> bool {
        self.invincible.is_some()
    }

    pub fn rapid_fire(&self) -> bool {
        matches!(self.weapon, Some(Timed { kind: PowerUp::RapidFire, .. }))
    }

    pub fn spread_shot(&self) -> bool {
        matches!(self.weapon, Some(Timed { kind: PowerUp::SpreadShot, .. }))
    }

    pub fn max_player_bullets(&self) -> usize {
        if self.rapid_fire() {
            4
        } else {
            2
        }
    }

    /// Walk speed multiplier (1.0, or 1.5 with Sneakers / Orange Juli-Ooze).
    pub fn walk_mul(&self) -> f32 {
        if self.speed.is_some() {
            SPEED_MUL
        } else {
            1.0
        }
    }

    pub fn high_jump(&self) -> bool {
        matches!(self.speed, Some(Timed { kind: PowerUp::Sneakers, .. }))
    }

    pub fn fast_search(&self) -> bool {
        self.high_jump()
    }

    /// The timed power-up the HUD should show with a draining bar (most time left wins), if any.
    pub fn hud_timed(&self) -> Option<Timed> {
        [self.weapon, self.speed, self.invincible].into_iter().flatten().max_by_key(|t| (t.left * 1000) / t.total.max(1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_weapon_at_a_time_new_replaces_old() {
        let mut p = PowerState::new();
        p.grant(PowerUp::RapidFire);
        assert!(p.rapid_fire());
        p.grant(PowerUp::SpreadShot);
        assert!(p.spread_shot() && !p.rapid_fire());
        assert_eq!(p.max_player_bullets(), 2);
        p.grant(PowerUp::RapidFire);
        assert_eq!(p.max_player_bullets(), 4);
    }

    #[test]
    fn armor_speed_and_radar_stack_with_weapon() {
        let mut p = PowerState::new();
        p.grant(PowerUp::SpreadShot);
        p.grant(PowerUp::ArmorVest);
        p.grant(PowerUp::Sneakers);
        p.grant(PowerUp::Radar);
        assert!(p.spread_shot() && p.armor && p.speed.is_some() && p.radar);
        assert_eq!(p.walk_mul(), 1.5);
        assert!(p.high_jump() && p.fast_search());
    }

    #[test]
    fn juice_shares_the_sneakers_slot_and_has_no_jump_bonus() {
        let mut p = PowerState::new();
        p.grant(PowerUp::Sneakers);
        p.grant(PowerUp::OrangeJuliOoze);
        assert_eq!(p.speed.unwrap().kind, PowerUp::OrangeJuliOoze);
        assert_eq!(p.speed.unwrap().total, JUICE_FRAMES);
        assert!(!p.high_jump() && !p.fast_search());
        assert_eq!(p.walk_mul(), 1.5);
    }

    #[test]
    fn pretzel_is_armor_like_the_vest() {
        let mut p = PowerState::new();
        p.grant(PowerUp::SoftPretzel);
        assert!(p.armor);
        assert!(p.absorb_hit());
        assert!(!p.armor);
        assert!(!p.absorb_hit());
    }

    #[test]
    fn timers_expire_exactly() {
        let mut p = PowerState::new();
        p.grant(PowerUp::Cinnabomb);
        assert!(p.is_invincible());
        for _ in 0..CINNABOMB_FRAMES - 1 {
            p.step();
            assert!(p.is_invincible());
        }
        p.step();
        assert!(!p.is_invincible());
        p.grant(PowerUp::RapidFire);
        for _ in 0..WEAPON_FRAMES {
            p.step();
        }
        assert!(p.weapon.is_none());
        p.grant(PowerUp::OrangeJuliOoze);
        for _ in 0..JUICE_FRAMES {
            p.step();
        }
        assert!(p.speed.is_none());
    }

    #[test]
    fn armor_and_radar_do_not_expire() {
        let mut p = PowerState::new();
        p.grant(PowerUp::ArmorVest);
        p.grant(PowerUp::Radar);
        for _ in 0..100_000 {
            p.step();
        }
        assert!(p.armor && p.radar);
    }

    #[test]
    fn death_keeps_only_radar() {
        let mut p = PowerState::new();
        p.grant(PowerUp::SpreadShot);
        p.grant(PowerUp::ArmorVest);
        p.grant(PowerUp::Sneakers);
        p.grant(PowerUp::Cinnabomb);
        p.grant(PowerUp::Radar);
        p.on_death();
        assert_eq!(p, PowerState { radar: true, ..PowerState::default() });
    }

    #[test]
    fn continue_resets_everything() {
        let mut p = PowerState::new();
        p.grant(PowerUp::Radar);
        p.grant(PowerUp::ArmorVest);
        p.reset_all();
        assert_eq!(p, PowerState::default());
    }

    #[test]
    fn radar_lasts_one_level() {
        let mut p = PowerState::new();
        p.grant(PowerUp::Radar);
        p.on_new_level();
        assert!(!p.radar);
    }

    #[test]
    fn one_up_is_instant_and_leaves_no_state() {
        let mut p = PowerState::new();
        assert_eq!(p.grant(PowerUp::OneUp), Granted::ExtraLife);
        assert_eq!(p, PowerState::default());
    }

    #[test]
    fn hud_shows_the_timed_item_with_most_time_fraction_left() {
        let mut p = PowerState::new();
        assert!(p.hud_timed().is_none());
        p.grant(PowerUp::RapidFire);
        for _ in 0..600 {
            p.step();
        }
        p.grant(PowerUp::Cinnabomb);
        assert_eq!(p.hud_timed().unwrap().kind, PowerUp::Cinnabomb);
    }

    #[test]
    fn timers_run_in_stores_because_step_is_game_wide() {
        // `step` has no notion of mall vs store: the Game calls it every un-paused frame.
        let mut p = PowerState::new();
        p.grant(PowerUp::Sneakers);
        p.step();
        assert_eq!(p.speed.unwrap().left, SNEAKERS_FRAMES - 1);
    }
}
