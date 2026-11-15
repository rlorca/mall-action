//! Shared vocabulary: stores, floors, themes, power-ups. Pure data.

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum StoreId {
    Forever12,
    RadioShock,
    Crookstone,
    GameStonk,
    KgbToys,
    BlockblusterVideo,
    SpendersGifts,
    SamBaddy,
    SharperImagine,
    HotSpyOnAStick,
    CircuitPity,
    FootLockpicker,
    BorderlineBooks,
}

pub const STORE_COUNT: usize = 13;

impl StoreId {
    pub const ALL: [StoreId; STORE_COUNT] = [
        StoreId::Forever12,
        StoreId::RadioShock,
        StoreId::Crookstone,
        StoreId::GameStonk,
        StoreId::KgbToys,
        StoreId::BlockblusterVideo,
        StoreId::SpendersGifts,
        StoreId::SamBaddy,
        StoreId::SharperImagine,
        StoreId::HotSpyOnAStick,
        StoreId::CircuitPity,
        StoreId::FootLockpicker,
        StoreId::BorderlineBooks,
    ];

    pub fn index(self) -> usize {
        StoreId::ALL.iter().position(|s| *s == self).unwrap()
    }

    pub fn info(self) -> &'static StoreInfo {
        &STORES[self.index()]
    }

    pub fn role(self) -> StoreRole {
        self.info().role
    }

    pub fn is_open(self) -> bool {
        self.role() != StoreRole::Closed
    }
}

/// Floors, top to bottom. Index = `Floor as usize`; floors are 48 px apart.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Floor {
    Roof = 0,
    F4 = 1,
    F3 = 2,
    F2 = 3,
    F1 = 4,
    Parking = 5,
}

pub const FLOOR_COUNT: usize = 6;

impl Floor {
    pub const ALL: [Floor; FLOOR_COUNT] = [Floor::Roof, Floor::F4, Floor::F3, Floor::F2, Floor::F1, Floor::Parking];

    pub fn from_index(i: usize) -> Option<Floor> {
        Floor::ALL.get(i).copied()
    }
    pub fn index(self) -> usize {
        self as usize
    }
    /// Short label for the LED panel and the map: R 4F 3F 2F 1F P.
    pub fn label(self) -> &'static str {
        ["R", "4F", "3F", "2F", "1F", "P"][self as usize]
    }
    pub fn below(self) -> Option<Floor> {
        Floor::from_index(self.index() + 1)
    }
    pub fn above(self) -> Option<Floor> {
        if self.index() == 0 {
            None
        } else {
            Floor::from_index(self.index() - 1)
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreRole {
    /// Holds a package. Red blinking door.
    Target,
    /// Sells power-ups. Blue door.
    PowerShop,
    /// Rolled-down shutter.
    Closed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Theme {
    Fashion,
    Electronics,
    Toys,
    FoodCourt,
    Sports,
    Music,
    Gadgets,
    Novelty,
    Games,
}

pub const THEMES: [Theme; 9] = [
    Theme::Fashion,
    Theme::Electronics,
    Theme::Toys,
    Theme::FoodCourt,
    Theme::Sports,
    Theme::Music,
    Theme::Gadgets,
    Theme::Novelty,
    Theme::Games,
];

pub struct StoreInfo {
    pub id: StoreId,
    /// Full parody name, e.g. "FOREVER 12".
    pub name: &'static str,
    /// Shown on the sign and the LED marquee.
    pub sign: &'static str,
    pub floor: Floor,
    pub role: StoreRole,
    /// Top-down visual theme (closed stores use Novelty as a placeholder and are never entered).
    pub theme: Theme,
    /// Sign background colour (NES palette index).
    pub sign_color: u8,
    /// Sign text colour.
    pub sign_text: u8,
}

use crate::pixel::pal;

pub const STORES: [StoreInfo; STORE_COUNT] = [
    StoreInfo { id: StoreId::Forever12, name: "FOREVER 12", sign: "FOREVER 12", floor: Floor::F4, role: StoreRole::Target, theme: Theme::Fashion, sign_color: pal::MAGENTA, sign_text: pal::WHITE },
    StoreInfo { id: StoreId::RadioShock, name: "RADIOSHOCK", sign: "RADIOSHOCK", floor: Floor::F4, role: StoreRole::Target, theme: Theme::Electronics, sign_color: pal::DBLUE, sign_text: pal::YELLOW },
    StoreInfo { id: StoreId::Crookstone, name: "CROOKSTONE", sign: "CROOKSTONE", floor: Floor::F4, role: StoreRole::PowerShop, theme: Theme::Gadgets, sign_color: pal::DBROWN, sign_text: pal::TAN },
    StoreInfo { id: StoreId::GameStonk, name: "GAMESTONK", sign: "GAMESTONK", floor: Floor::F4, role: StoreRole::PowerShop, theme: Theme::Games, sign_color: pal::DPURPLE, sign_text: pal::LGREEN },
    StoreInfo { id: StoreId::KgbToys, name: "KGB TOYS", sign: "KGB TOYS", floor: Floor::F3, role: StoreRole::Target, theme: Theme::Toys, sign_color: pal::RED, sign_text: pal::LYELLOW },
    StoreInfo { id: StoreId::BlockblusterVideo, name: "BLOCKBLUSTER VIDEO", sign: "BLOCKBLUSTER", floor: Floor::F3, role: StoreRole::Closed, theme: Theme::Novelty, sign_color: pal::NAVY, sign_text: pal::YELLOW },
    StoreInfo { id: StoreId::SpendersGifts, name: "SPENDER'S GIFTS", sign: "SPENDER'S GIFTS", floor: Floor::F3, role: StoreRole::PowerShop, theme: Theme::Novelty, sign_color: pal::PLUM, sign_text: pal::LCYAN },
    StoreInfo { id: StoreId::SamBaddy, name: "SAM BADDY", sign: "SAM BADDY", floor: Floor::F2, role: StoreRole::Target, theme: Theme::Music, sign_color: pal::DRED, sign_text: pal::WHITE },
    StoreInfo { id: StoreId::SharperImagine, name: "SHARPER IMAGINE", sign: "SHARPER IMAGINE", floor: Floor::F2, role: StoreRole::PowerShop, theme: Theme::Gadgets, sign_color: pal::CHARCOAL, sign_text: pal::LCYAN },
    StoreInfo { id: StoreId::HotSpyOnAStick, name: "HOT SPY ON A STICK", sign: "HOT SPY ON A STICK", floor: Floor::F2, role: StoreRole::Target, theme: Theme::FoodCourt, sign_color: pal::ORANGE, sign_text: pal::DRED },
    StoreInfo { id: StoreId::CircuitPity, name: "CIRCUIT PITY", sign: "CIRCUIT PITY", floor: Floor::F2, role: StoreRole::Closed, theme: Theme::Electronics, sign_color: pal::DGREEN, sign_text: pal::WHITE },
    StoreInfo { id: StoreId::FootLockpicker, name: "FOOT LOCKPICKER", sign: "FOOT LOCKPICKER", floor: Floor::F1, role: StoreRole::Target, theme: Theme::Sports, sign_color: pal::BLACK, sign_text: pal::LRED },
    StoreInfo { id: StoreId::BorderlineBooks, name: "BORDERLINE BOOKS", sign: "BORDERLINE BOOKS", floor: Floor::F1, role: StoreRole::Closed, theme: Theme::Novelty, sign_color: pal::DOLIVE, sign_text: pal::WHITE },
];

pub const PACKAGES_TOTAL: u32 = 6;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PowerUp {
    RapidFire,
    SpreadShot,
    ArmorVest,
    Sneakers,
    Radar,
    OneUp,
    Cinnabomb,
    OrangeJuliOoze,
    SoftPretzel,
}

impl PowerUp {
    pub const ALL: [PowerUp; 9] = [
        PowerUp::RapidFire,
        PowerUp::SpreadShot,
        PowerUp::ArmorVest,
        PowerUp::Sneakers,
        PowerUp::Radar,
        PowerUp::OneUp,
        PowerUp::Cinnabomb,
        PowerUp::OrangeJuliOoze,
        PowerUp::SoftPretzel,
    ];
    pub fn name(self) -> &'static str {
        match self {
            PowerUp::RapidFire => "RAPID FIRE",
            PowerUp::SpreadShot => "SPREAD SHOT",
            PowerUp::ArmorVest => "ARMOR VEST",
            PowerUp::Sneakers => "SNEAKERS",
            PowerUp::Radar => "RADAR",
            PowerUp::OneUp => "1-UP",
            PowerUp::Cinnabomb => "CINNABOMB",
            PowerUp::OrangeJuliOoze => "ORANGE JULI-OOZE",
            PowerUp::SoftPretzel => "SOFT PRETZEL",
        }
    }
    pub fn is_food(self) -> bool {
        matches!(self, PowerUp::Cinnabomb | PowerUp::OrangeJuliOoze | PowerUp::SoftPretzel)
    }
    /// Sprite name in the art manifest (12x12).
    pub fn sprite_name(self) -> &'static str {
        match self {
            PowerUp::RapidFire => "pu_rapid",
            PowerUp::SpreadShot => "pu_spread",
            PowerUp::ArmorVest => "pu_armor",
            PowerUp::Sneakers => "pu_sneakers",
            PowerUp::Radar => "pu_radar",
            PowerUp::OneUp => "pu_oneup",
            PowerUp::Cinnabomb => "pu_cinnabomb",
            PowerUp::OrangeJuliOoze => "pu_juice",
            PowerUp::SoftPretzel => "pu_pretzel",
        }
    }
}

/// What a store fixture can hold.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Content {
    Package,
    PowerUp(PowerUp),
    Trap,
    Nothing,
}
