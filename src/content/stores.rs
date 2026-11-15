use super::themes::ThemeId;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum StoreRole {
    Target,
    Powerup,
    Closed,
}

impl StoreRole {
    pub const fn as_str(self) -> &'static str {
        match self {
            StoreRole::Target => "target",
            StoreRole::Powerup => "powerup",
            StoreRole::Closed => "closed",
        }
    }
}

/// Discriminants equal the index in `STORES` / `STORE_IDS`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum StoreId {
    Forever12,
    Radioshock,
    Crookstone,
    Gamestonk,
    Kgbtoys,
    Blockbluster,
    Spenders,
    Sambaddy,
    Sharper,
    Hotspy,
    Circuitpity,
    Footlock,
    Borderline,
}

impl StoreId {
    pub const ALL: [StoreId; 13] = [
        StoreId::Forever12,
        StoreId::Radioshock,
        StoreId::Crookstone,
        StoreId::Gamestonk,
        StoreId::Kgbtoys,
        StoreId::Blockbluster,
        StoreId::Spenders,
        StoreId::Sambaddy,
        StoreId::Sharper,
        StoreId::Hotspy,
        StoreId::Circuitpity,
        StoreId::Footlock,
        StoreId::Borderline,
    ];
    pub const fn as_str(self) -> &'static str {
        match self {
            StoreId::Forever12 => "forever12",
            StoreId::Radioshock => "radioshock",
            StoreId::Crookstone => "crookstone",
            StoreId::Gamestonk => "gamestonk",
            StoreId::Kgbtoys => "kgbtoys",
            StoreId::Blockbluster => "blockbluster",
            StoreId::Spenders => "spenders",
            StoreId::Sambaddy => "sambaddy",
            StoreId::Sharper => "sharper",
            StoreId::Hotspy => "hotspy",
            StoreId::Circuitpity => "circuitpity",
            StoreId::Footlock => "footlock",
            StoreId::Borderline => "borderline",
        }
    }
}

/// TS `STORE_IDS`.
pub const STORE_IDS: [StoreId; 13] = StoreId::ALL;

#[derive(Clone, Copy, Debug)]
pub struct StoreDef {
    pub id: StoreId,
    /// Sign text (<= 18 chars so it fits the tiny font on an 80 px sign). Puns, never real brands.
    pub name: &'static str,
    /// What it parodies (for README/comments only; never drawn in game).
    pub parody: &'static str,
    /// Floor index: 1 = 4F, 2 = 3F, 3 = 2F, 4 = 1F.
    pub floor: i32,
    /// Left edge of the ~80 px storefront in mall pixels.
    pub x: f64,
    pub role: StoreRole,
    /// Top-down room theme; None for closed stores.
    pub theme: Option<ThemeId>,
    /// Store song id (an audio MusicId string, e.g. "store.forever12"); None for closed stores.
    pub song: Option<&'static str>,
}

pub const STORE_W: f64 = 80.0;
/// Door is centred; walkable trigger is x + 32 .. x + 48.
pub const DOOR_X: f64 = 32.0;
pub const DOOR_W: f64 = 16.0;
pub const PACKAGES_TOTAL: i32 = 6;

pub const STORES: [StoreDef; 13] = [
    StoreDef { id: StoreId::Forever12, name: "FOREVER 12", parody: "Forever 21", floor: 1, x: 24.0, role: StoreRole::Target, theme: Some(ThemeId::Fashion), song: Some("store.forever12") },
    StoreDef { id: StoreId::Radioshock, name: "RADIOSHOCK", parody: "RadioShack", floor: 1, x: 208.0, role: StoreRole::Target, theme: Some(ThemeId::Electronics), song: Some("store.radioshock") },
    StoreDef { id: StoreId::Crookstone, name: "CROOKSTONE", parody: "Brookstone", floor: 1, x: 432.0, role: StoreRole::Powerup, theme: Some(ThemeId::Gadgets), song: Some("store.crookstone") },
    StoreDef { id: StoreId::Gamestonk, name: "GAMESTONK", parody: "GameStop", floor: 1, x: 640.0, role: StoreRole::Powerup, theme: Some(ThemeId::Games), song: Some("store.gamestonk") },
    StoreDef { id: StoreId::Kgbtoys, name: "KGB TOYS", parody: "KB Toys", floor: 2, x: 24.0, role: StoreRole::Target, theme: Some(ThemeId::Toys), song: Some("store.kgbtoys") },
    StoreDef { id: StoreId::Blockbluster, name: "BLOCKBLUSTER VIDEO", parody: "Blockbuster", floor: 2, x: 208.0, role: StoreRole::Closed, theme: None, song: None },
    StoreDef { id: StoreId::Spenders, name: "SPENDER'S GIFTS", parody: "Spencer's", floor: 2, x: 432.0, role: StoreRole::Powerup, theme: Some(ThemeId::Novelty), song: Some("store.spenders") },
    StoreDef { id: StoreId::Sambaddy, name: "SAM BADDY", parody: "Sam Goody", floor: 3, x: 24.0, role: StoreRole::Target, theme: Some(ThemeId::Music), song: Some("store.sambaddy") },
    StoreDef { id: StoreId::Sharper, name: "SHARPER IMAGINE", parody: "Sharper Image", floor: 3, x: 200.0, role: StoreRole::Powerup, theme: Some(ThemeId::Gadgets), song: Some("store.sharper") },
    StoreDef { id: StoreId::Hotspy, name: "HOT SPY ON A STICK", parody: "Hot Dog on a Stick", floor: 3, x: 296.0, role: StoreRole::Target, theme: Some(ThemeId::Food), song: Some("store.hotspy") },
    StoreDef { id: StoreId::Circuitpity, name: "CIRCUIT PITY", parody: "Circuit City", floor: 3, x: 432.0, role: StoreRole::Closed, theme: None, song: None },
    StoreDef { id: StoreId::Footlock, name: "FOOT LOCKPICKER", parody: "Foot Locker", floor: 4, x: 40.0, role: StoreRole::Target, theme: Some(ThemeId::Sports), song: Some("store.footlock") },
    StoreDef { id: StoreId::Borderline, name: "BORDERLINE BOOKS", parody: "Borders", floor: 4, x: 232.0, role: StoreRole::Closed, theme: None, song: None },
];

/// TS `storeDef(id)`.
pub fn store_def(id: StoreId) -> &'static StoreDef {
    &STORES[id as usize]
}

fn with_role(role: StoreRole, invert: bool) -> Vec<&'static StoreDef> {
    STORES.iter().filter(|s| (s.role == role) != invert).collect()
}

/// TS `TARGET_STORES` (in `STORES` order).
pub fn target_stores() -> Vec<&'static StoreDef> {
    with_role(StoreRole::Target, false)
}
/// TS `POWERUP_STORES`.
pub fn powerup_stores() -> Vec<&'static StoreDef> {
    with_role(StoreRole::Powerup, false)
}
/// TS `CLOSED_STORES`.
pub fn closed_stores() -> Vec<&'static StoreDef> {
    with_role(StoreRole::Closed, false)
}
/// TS `OPEN_STORES` (role != closed).
pub fn open_stores() -> Vec<&'static StoreDef> {
    with_role(StoreRole::Closed, true)
}
