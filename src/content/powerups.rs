#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PowerId {
    Rapid,
    Spread,
    Armor,
    Sneakers,
    Radar,
    Oneup,
    Cinnabomb,
    Ooze,
    Pretzel,
}

impl PowerId {
    pub const ALL: [PowerId; 9] = [
        PowerId::Rapid,
        PowerId::Spread,
        PowerId::Armor,
        PowerId::Sneakers,
        PowerId::Radar,
        PowerId::Oneup,
        PowerId::Cinnabomb,
        PowerId::Ooze,
        PowerId::Pretzel,
    ];
    pub const fn as_str(self) -> &'static str {
        match self {
            PowerId::Rapid => "rapid",
            PowerId::Spread => "spread",
            PowerId::Armor => "armor",
            PowerId::Sneakers => "sneakers",
            PowerId::Radar => "radar",
            PowerId::Oneup => "oneup",
            PowerId::Cinnabomb => "cinnabomb",
            PowerId::Ooze => "ooze",
            PowerId::Pretzel => "pretzel",
        }
    }
}

/// TS `POWER_IDS`.
pub const POWER_IDS: [PowerId; 9] = PowerId::ALL;

/// weapon:   one at a time (rapid | spread); a new one replaces the old.
/// speed:    sneakers | ooze share one slot.
/// armor:    vest | pretzel, absorbs one hit.
/// radar:    rest of level; the only power-up kept on death.
/// invincible: cinnabomb.
/// instant:  1-up.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PowerSlot {
    Weapon,
    Speed,
    Armor,
    Radar,
    Invincible,
    Instant,
}

impl PowerSlot {
    pub const fn as_str(self) -> &'static str {
        match self {
            PowerSlot::Weapon => "weapon",
            PowerSlot::Speed => "speed",
            PowerSlot::Armor => "armor",
            PowerSlot::Radar => "radar",
            PowerSlot::Invincible => "invincible",
            PowerSlot::Instant => "instant",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct PowerDef {
    pub id: PowerId,
    pub name: &'static str,
    pub slot: PowerSlot,
    /// Duration in 60 Hz frames; 0 = until hit / rest of level / instant.
    pub frames: i32,
    pub food: bool,
}

const SEC: i32 = 60;

/// Indexed in `PowerId::ALL` order; use `power_def(id)`.
pub const POWERUPS: [PowerDef; 9] = [
    PowerDef { id: PowerId::Rapid, name: "RAPID FIRE", slot: PowerSlot::Weapon, frames: 20 * SEC, food: false },
    PowerDef { id: PowerId::Spread, name: "SPREAD SHOT", slot: PowerSlot::Weapon, frames: 20 * SEC, food: false },
    PowerDef { id: PowerId::Armor, name: "ARMOR VEST", slot: PowerSlot::Armor, frames: 0, food: false },
    PowerDef { id: PowerId::Sneakers, name: "SNEAKERS", slot: PowerSlot::Speed, frames: 20 * SEC, food: false },
    PowerDef { id: PowerId::Radar, name: "RADAR", slot: PowerSlot::Radar, frames: 0, food: false },
    PowerDef { id: PowerId::Oneup, name: "1-UP", slot: PowerSlot::Instant, frames: 0, food: false },
    PowerDef { id: PowerId::Cinnabomb, name: "CINNABOMB", slot: PowerSlot::Invincible, frames: 6 * SEC, food: true },
    PowerDef { id: PowerId::Ooze, name: "ORANGE JULI-OOZE", slot: PowerSlot::Speed, frames: 12 * SEC, food: true },
    PowerDef { id: PowerId::Pretzel, name: "SOFT PRETZEL", slot: PowerSlot::Armor, frames: 0, food: true },
];

/// TS `POWERUPS[id]`.
pub fn power_def(id: PowerId) -> &'static PowerDef {
    &POWERUPS[id as usize]
}

pub const NON_FOOD_POWERS: [PowerId; 6] = [PowerId::Rapid, PowerId::Spread, PowerId::Armor, PowerId::Sneakers, PowerId::Radar, PowerId::Oneup];
pub const FOOD_POWERS: [PowerId; 3] = [PowerId::Cinnabomb, PowerId::Ooze, PowerId::Pretzel];
